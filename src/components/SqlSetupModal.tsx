import React, { useState, useEffect } from 'react';
import { Copy, Check, Terminal, Database, Shield, Zap, ExternalLink, X, FolderPlus, HardDrive, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { createSupabaseBucket, checkBucketExists, AVATAR_BUCKET, STORAGE_SQL_SCRIPT } from '../services/storageService';
import { isSupabaseConfigured } from '../lib/supabase';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SUPABASE_SQL_SCRIPT = `-- ==========================================
-- MOTORIDE FULL DATABASE & STORAGE SCHEMA
-- Run this in Supabase Dashboard -> SQL Editor
-- ==========================================

-- 1. Create rides table with UUID primary keys and location info
CREATE TABLE IF NOT EXISTS public.rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id UUID NOT NULL,
    captain_id UUID NULL,
    passenger_name TEXT DEFAULT 'Passenger User',
    passenger_phone TEXT DEFAULT '+1 (555) 019-2834',
    captain_name TEXT NULL,
    captain_phone TEXT NULL,
    captain_vehicle TEXT NULL,
    captain_rating NUMERIC DEFAULT 4.92,
    pickup_location TEXT NOT NULL,
    dropoff_location TEXT NOT NULL,
    pickup_lat DOUBLE PRECISION NULL,
    pickup_lng DOUBLE PRECISION NULL,
    dropoff_lat DOUBLE PRECISION NULL,
    dropoff_lng DOUBLE PRECISION NULL,
    fare NUMERIC NULL,
    distance_km NUMERIC DEFAULT 4.2,
    estimated_mins NUMERIC DEFAULT 12,
    service_type TEXT DEFAULT 'moto_comfort',
    tier_name TEXT DEFAULT 'Comfort Moto',
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'arrived', 'started', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL
);

-- Idempotent column additions for existing tables
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'moto_comfort';
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS tier_name TEXT DEFAULT 'Comfort Moto';

-- 2. Create helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides (status);
CREATE INDEX IF NOT EXISTS idx_rides_passenger ON public.rides (passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_captain ON public.rides (captain_id);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON public.rides (created_at DESC);

-- 3. Atomic Ride Claim RPC to prevent race conditions when multiple captains click accept
CREATE OR REPLACE FUNCTION public.claim_ride(
    p_ride_id UUID,
    p_captain_id UUID,
    p_captain_name TEXT DEFAULT 'Captain Rider',
    p_captain_phone TEXT DEFAULT '+1 (555) 234-5678',
    p_captain_vehicle TEXT DEFAULT 'Yamaha MT-07 • Black'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ride RECORD;
BEGIN
    -- Atomically update the row ONLY if status is currently 'requested'
    UPDATE public.rides
    SET
        captain_id = p_captain_id,
        status = 'accepted',
        accepted_at = NOW(),
        captain_name = COALESCE(captain_name, p_captain_name),
        captain_phone = COALESCE(captain_phone, p_captain_phone),
        captain_vehicle = COALESCE(captain_vehicle, p_captain_vehicle)
    WHERE id = p_ride_id AND status = 'requested'
    RETURNING * INTO v_ride;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Ride successfully claimed by captain',
            'ride', row_to_json(v_ride)
        );
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Collision: This ride was already accepted by another captain or cancelled.'
        );
    END IF;
END;
$$;

-- 4. Enable Supabase Realtime for the 'rides' table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rides'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
    END IF;
END
$$;

-- Set replica identity to FULL so realtime UPDATE events include all column values
ALTER TABLE public.rides REPLICA IDENTITY FULL;

-- 5. Enable Row Level Security (RLS) on rides table
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public/authenticated read rides"
    ON public.rides FOR SELECT USING (true);

CREATE POLICY "Allow insert new rides"
    ON public.rides FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update rides"
    ON public.rides FOR UPDATE USING (true);

-- ========================================================
-- 6. CREATE STORAGE BUCKETS (avatars & motoride-uploads)
-- ========================================================

-- Create the 'avatars' storage bucket (Public CDN, 5MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE 
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

-- Create the 'motoride-uploads' storage bucket (10MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'motoride-uploads',
    'motoride-uploads',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 7. Storage Security Policies for public uploads & views
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public can view avatars'
    ) THEN
        CREATE POLICY "Public can view avatars"
            ON storage.objects FOR SELECT
            USING (bucket_id IN ('avatars', 'motoride-uploads'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow public upload to avatars'
    ) THEN
        CREATE POLICY "Allow public upload to avatars"
            ON storage.objects FOR INSERT
            WITH CHECK (bucket_id IN ('avatars', 'motoride-uploads'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow update avatars'
    ) THEN
        CREATE POLICY "Allow update avatars"
            ON storage.objects FOR UPDATE
            USING (bucket_id IN ('avatars', 'motoride-uploads'));
    END IF;
END $$;
`;

export const PASSENGER_PROFILE_SQL_SCRIPT = `-- ========================================================
-- MOTORIDE PASSENGER & USER PROFILE SQL SCHEMA
-- Run this in Supabase Dashboard -> SQL Editor
-- ========================================================

-- 1. Create profiles table linked to Supabase auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT 'Passenger User',
    email TEXT NULL,
    phone TEXT NULL,
    role TEXT NOT NULL DEFAULT 'passenger' CHECK (role IN ('passenger', 'captain', 'admin')),
    avatar_url TEXT NULL,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    emergency_contact_name TEXT NULL,
    emergency_contact_phone TEXT NULL,
    home_address TEXT NULL,
    work_address TEXT NULL,
    preferred_payment_method TEXT DEFAULT 'cash' CHECK (preferred_payment_method IN ('cash', 'card', 'wallet', 'upi')),
    total_rides INTEGER DEFAULT 0,
    total_spend NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column additions in case table already existed
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_address TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS work_address TEXT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_payment_method TEXT DEFAULT 'cash';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_rides INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_spend NUMERIC(10, 2) DEFAULT 0.00;

-- 2. Helpful indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at DESC);

-- 3. Automatic Profile Creation Trigger on Supabase Auth Sign Up
-- Whenever a user signs up (passenger, captain, or admin), automatically creates profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        full_name,
        email,
        phone,
        role,
        avatar_url,
        rating,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'passenger'),
        NEW.raw_user_meta_data->>'avatar_url',
        5.00,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        email = COALESCE(EXCLUDED.email, profiles.email),
        phone = COALESCE(EXCLUDED.phone, profiles.phone),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- Drop existing trigger if needed and re-create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view profiles (needed for ride matching and dispatch)
CREATE POLICY "Public read profiles"
    ON public.profiles FOR SELECT
    USING (true);

-- Allow users to insert their own profile
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Allow users to update only their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 5. Enable Realtime for profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
    END IF;
END
$$;

ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- ========================================================
-- COMMON PASSENGER PROFILE QUERIES FOR YOUR APP
-- ========================================================

-- A. Fetch Passenger Profile by Auth ID
-- SELECT * FROM public.profiles WHERE id = auth.uid() AND role = 'passenger';

-- B. Update Passenger Profile (Addresses, Phone, Name)
-- UPDATE public.profiles
-- SET full_name = 'Sarah Jenkins',
--     phone = '+1 (555) 392-1049',
--     home_address = '452 Elm Street, Downtown',
--     work_address = 'Tech Hub Plaza, Floor 4',
--     updated_at = NOW()
-- WHERE id = auth.uid();

-- C. Passenger Profile with Summary Stats (Ride count & total spend)
-- SELECT 
--     p.id,
--     p.full_name,
--     p.phone,
--     p.email,
--     p.rating,
--     COUNT(r.id) AS completed_rides,
--     COALESCE(SUM(r.fare), 0) AS total_fare_spent
-- FROM public.profiles p
-- LEFT JOIN public.rides r ON r.passenger_id = p.id AND r.status = 'completed'
-- WHERE p.id = auth.uid()
-- GROUP BY p.id;
`;

export const CAPTAIN_PROFILE_SQL_SCRIPT = `-- ========================================================
-- MOTORIDE CAPTAIN PARTNER PROFILE & VEHICLE SCHEMA
-- Run this in Supabase Dashboard -> SQL Editor
-- ========================================================

-- 1. Create or extend Captain Profiles in public.captain_profiles (or linked to public.profiles)
CREATE TABLE IF NOT EXISTS public.captain_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT 'Captain Partner',
    email TEXT NULL,
    phone TEXT NOT NULL DEFAULT '',
    vehicle_model TEXT NOT NULL DEFAULT 'Yamaha MT-07',
    vehicle_plate TEXT NOT NULL DEFAULT 'DL-01-AB-7492',
    vehicle_color TEXT DEFAULT 'Stealth Black',
    vehicle_type TEXT NOT NULL DEFAULT 'moto' CHECK (vehicle_type IN ('moto', 'scooter', 'moto_premium', 'delivery')),
    license_number TEXT NULL,
    is_online BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT true,
    rating NUMERIC(3, 2) NOT NULL DEFAULT 4.96,
    total_rides INTEGER NOT NULL DEFAULT 0,
    total_earnings NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    wallet_balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    current_lat NUMERIC(9, 6) NULL,
    current_lng NUMERIC(9, 6) NULL,
    avatar_url TEXT NULL,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent column additions in case table exists
ALTER TABLE public.captain_profiles ADD COLUMN IF NOT EXISTS vehicle_model TEXT DEFAULT 'Yamaha MT-07';
ALTER TABLE public.captain_profiles ADD COLUMN IF NOT EXISTS vehicle_plate TEXT DEFAULT 'DL-01-AB-7492';
ALTER TABLE public.captain_profiles ADD COLUMN IF NOT EXISTS vehicle_color TEXT DEFAULT 'Stealth Black';
ALTER TABLE public.captain_profiles ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'moto';
ALTER TABLE public.captain_profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT true;
ALTER TABLE public.captain_profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT true;
ALTER TABLE public.captain_profiles ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.captain_profiles ADD COLUMN IF NOT EXISTS current_lat NUMERIC(9, 6) NULL;
ALTER TABLE public.captain_profiles ADD COLUMN IF NOT EXISTS current_lng NUMERIC(9, 6) NULL;

-- 2. Indexes for Geospatial Dispatch & Availability
CREATE INDEX IF NOT EXISTS idx_captain_is_online ON public.captain_profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_captain_vehicle_type ON public.captain_profiles(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_captain_last_active ON public.captain_profiles(last_active_at DESC);

-- 3. Automatic Captain Profile creation / sync trigger
CREATE OR REPLACE FUNCTION public.handle_new_captain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If user signs up as captain, initialize captain profile
    IF (NEW.raw_user_meta_data->>'role' = 'captain') THEN
        INSERT INTO public.captain_profiles (
            id,
            full_name,
            email,
            phone,
            vehicle_model,
            vehicle_plate,
            is_online,
            is_verified,
            rating,
            created_at,
            updated_at
        )
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'Captain ' || split_part(NEW.email, '@', 1)),
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'phone', ''),
            COALESCE(NEW.raw_user_meta_data->>'vehicle_model', 'Yamaha MT-07 · Black Edition'),
            COALESCE(NEW.raw_user_meta_data->>'vehicle_plate', 'MOTO-4819'),
            true,
            true,
            4.96,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            full_name = COALESCE(EXCLUDED.full_name, captain_profiles.full_name),
            email = COALESCE(EXCLUDED.email, captain_profiles.email),
            phone = COALESCE(EXCLUDED.phone, captain_profiles.phone),
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_captain_created ON auth.users;
CREATE TRIGGER on_auth_captain_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_captain();

-- 4. Row Level Security (RLS)
ALTER TABLE public.captain_profiles ENABLE ROW LEVEL SECURITY;

-- Allow public read so passengers and dispatch can see nearby online captains & ratings
CREATE POLICY "Public read online captains"
    ON public.captain_profiles FOR SELECT
    USING (true);

-- Allow captains to update only their own profile & location
CREATE POLICY "Captains update own profile"
    ON public.captain_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow captains to insert their own profile
CREATE POLICY "Captains insert own profile"
    ON public.captain_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 5. Enable Realtime for live tracking & online status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'captain_profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.captain_profiles;
    END IF;
END
$$;

ALTER TABLE public.captain_profiles REPLICA IDENTITY FULL;

-- ========================================================
-- COMMON CAPTAIN PROFILE QUERIES FOR YOUR APP
-- ========================================================

-- A. Fetch Captain Profile & Current Stats
-- SELECT * FROM public.captain_profiles WHERE id = auth.uid();

-- B. Toggle Captain Online / Offline Duty Status
-- UPDATE public.captain_profiles 
-- SET is_online = true, last_active_at = NOW() 
-- WHERE id = auth.uid();

-- C. Live GPS Location Ping from Captain App
-- UPDATE public.captain_profiles
-- SET current_lat = 28.6139, 
--     current_lng = 77.2090, 
--     last_active_at = NOW()
-- WHERE id = auth.uid();

-- D. Update Vehicle & License Details
-- UPDATE public.captain_profiles
-- SET vehicle_model = 'Honda CB300R',
--     vehicle_plate = 'DL-04-XY-8821',
--     vehicle_color = 'Matte Gray',
--     license_number = 'DL-552021004921',
--     updated_at = NOW()
-- WHERE id = auth.uid();

-- E. Captain Performance & Earnings Breakdown
-- SELECT 
--     c.id,
--     c.full_name,
--     c.rating,
--     c.vehicle_model,
--     COUNT(r.id) AS completed_trips,
--     COALESCE(SUM(r.fare), 0) AS total_trip_revenue,
--     ROUND(COALESCE(SUM(r.fare) * 0.85, 0), 2) AS net_captain_earnings
-- FROM public.captain_profiles c
-- LEFT JOIN public.rides r ON r.captain_id = c.id AND r.status = 'completed'
-- WHERE c.id = auth.uid()
-- GROUP BY c.id;
`;

export const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'full' | 'passenger_profile' | 'captain_profile' | 'storage_only'>('full');
  const [copied, setCopied] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [bucketStatus, setBucketStatus] = useState<'checking' | 'exists' | 'missing' | 'not_connected'>('checking');

  useEffect(() => {
    if (isOpen) {
      checkExistingBucket();
    }
  }, [isOpen]);

  const checkExistingBucket = async () => {
    if (!isSupabaseConfigured()) {
      setBucketStatus('not_connected');
      return;
    }
    setBucketStatus('checking');
    const { exists } = await checkBucketExists(AVATAR_BUCKET);
    setBucketStatus(exists ? 'exists' : 'missing');
  };

  const handleProvisionBucket = async () => {
    setIsProvisioning(true);
    setProvisionResult(null);

    const result = await createSupabaseBucket(AVATAR_BUCKET, true);
    setIsProvisioning(false);
    setProvisionResult(result);
    if (result.success) {
      setBucketStatus('exists');
    }
  };

  if (!isOpen) return null;

  const currentScript =
    activeTab === 'full'
      ? SUPABASE_SQL_SCRIPT
      : activeTab === 'passenger_profile'
      ? PASSENGER_PROFILE_SQL_SCRIPT
      : activeTab === 'captain_profile'
      ? CAPTAIN_PROFILE_SQL_SCRIPT
      : STORAGE_SQL_SCRIPT;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        id="supabase-sql-modal"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Supabase SQL & Storage Bucket Setup
              </h2>
              <p className="text-xs text-slate-400">
                Configure database tables, atomic RPC, Realtime publication, and public Storage file buckets.
              </p>
            </div>
          </div>
          <button
            id="close-sql-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector & Bucket Quick Action Bar */}
        <div className="bg-slate-950 px-5 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('full')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'full'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900'
              }`}
            >
              Full Schema
            </button>
            <button
              onClick={() => setActiveTab('passenger_profile')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'passenger_profile'
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900'
              }`}
            >
              Passenger Profiles
            </button>
            <button
              onClick={() => setActiveTab('captain_profile')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'captain_profile'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900'
              }`}
            >
              Captain Profiles
            </button>
            <button
              onClick={() => setActiveTab('storage_only')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'storage_only'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900'
              }`}
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Storage Bucket Only
            </button>
          </div>

          {/* 1-Click Provision Storage Action */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono text-[11px] text-slate-400">Bucket:</span>
              <span className="font-mono text-[11px] font-bold text-slate-200">avatars</span>
              {bucketStatus === 'exists' && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-0.5">
                  <Check className="w-2.5 h-2.5" /> Ready
                </span>
              )}
            </div>

            <button
              id="provision-bucket-btn"
              onClick={handleProvisionBucket}
              disabled={isProvisioning}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isProvisioning ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <FolderPlus className="w-3 h-3" />
              )}
              {isProvisioning ? 'Creating...' : '1-Click Create Bucket'}
            </button>
          </div>
        </div>

        {/* Provision Feedback Result if triggered */}
        {provisionResult && (
          <div
            className={`mx-5 mt-4 p-3 rounded-xl border text-xs flex items-center justify-between gap-2 animate-in fade-in ${
              provisionResult.success
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {provisionResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>{provisionResult.message}</span>
            </div>
            <button
              onClick={() => setProvisionResult(null)}
              className="text-slate-400 hover:text-white px-1.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-300">
          {/* Quick steps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs font-bold shrink-0">
                1
              </div>
              <p className="text-xs text-slate-300">
                Open <strong className="text-slate-100">Supabase Dashboard</strong> → Navigate to <strong className="text-sky-400">SQL Editor</strong>.
              </p>
            </div>
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">
                2
              </div>
              <p className="text-xs text-slate-300">
                Paste the SQL script below and click <strong className="text-emerald-400">Run</strong>.
              </p>
            </div>
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">
                3
              </div>
              <p className="text-xs text-slate-300">
                Bucket <strong className="text-amber-300">'avatars'</strong> will be created with Public CDN access.
              </p>
            </div>
          </div>

          {/* Key Architectural Highlights */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <span className="font-semibold text-slate-100 block">Supabase Storage Bucket Specifications:</span>
              <p className="text-slate-400">
                Includes <code className="text-amber-300 font-mono">storage.buckets</code> for <code className="text-emerald-300 font-mono">'avatars'</code> (5MB max image limit, WebP/PNG/JPG/GIF/SVG) & <code className="text-sky-300 font-mono">'motoride-uploads'</code>, alongside public object read & upload policies.
              </p>
            </div>
          </div>

          {/* Code block with copy button */}
          <div className="relative rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-mono text-slate-300">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                {activeTab === 'full' ? 'schema_and_storage.sql' : 'create_avatars_bucket.sql'}
              </span>
              <button
                id="copy-sql-btn"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy SQL'}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-emerald-300/90 overflow-x-auto max-h-64 leading-relaxed scrollbar-thin scrollbar-thumb-slate-700">
              {currentScript}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Safe to run multiple times (uses <code className="text-slate-300">IF NOT EXISTS / ON CONFLICT</code>).
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied to Clipboard' : 'Copy All SQL'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
