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

export const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'full' | 'storage_only'>('full');
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

  const currentScript = activeTab === 'full' ? SUPABASE_SQL_SCRIPT : STORAGE_SQL_SCRIPT;

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('full')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'full'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-900'
              }`}
            >
              Full Schema (Tables + Realtime + Storage)
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
              Storage Bucket SQL Only ('avatars')
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
