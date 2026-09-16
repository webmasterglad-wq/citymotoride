-- ========================================================
-- MOTORIDE COMPLETE SUPABASE RLS SECURITY POLICIES & SCHEMA
-- Run this in your Supabase Dashboard -> SQL Editor
-- This enables full CRUD (SELECT, INSERT, UPDATE, DELETE) &
-- Realtime subscriptions for Rides, Profiles, and Storage.
-- ========================================================

-- 1. Create rides table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS public.rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id UUID NOT NULL,
    captain_id UUID NULL,
    passenger_name TEXT DEFAULT 'Passenger',
    passenger_phone TEXT NULL,
    captain_name TEXT NULL,
    captain_phone TEXT NULL,
    captain_vehicle TEXT NULL,
    captain_rating NUMERIC DEFAULT 5.0,
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
    delivery_notes TEXT NULL,
    captain_offers JSONB DEFAULT '[]'::jsonb,
    chat_messages JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'arrived', 'started', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL
);

-- Idempotent column additions for existing rides table
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'moto_comfort';
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS tier_name TEXT DEFAULT 'Comfort Moto';
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS delivery_notes TEXT NULL;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS captain_offers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS chat_messages JSONB DEFAULT '[]'::jsonb;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_rides_status ON public.rides (status);
CREATE INDEX IF NOT EXISTS idx_rides_passenger ON public.rides (passenger_id);
CREATE INDEX IF NOT EXISTS idx_rides_captain ON public.rides (captain_id);
CREATE INDEX IF NOT EXISTS idx_rides_created_at ON public.rides (created_at DESC);


-- 2. ENABLE ROW LEVEL SECURITY (RLS) & DROP OLD RESTRICTIVE POLICIES
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public/authenticated read rides" ON public.rides;
DROP POLICY IF EXISTS "Allow insert new rides" ON public.rides;
DROP POLICY IF EXISTS "Allow update rides" ON public.rides;
DROP POLICY IF EXISTS "Allow delete rides" ON public.rides;
DROP POLICY IF EXISTS "Allow public select rides" ON public.rides;
DROP POLICY IF EXISTS "Allow public insert rides" ON public.rides;
DROP POLICY IF EXISTS "Allow public update rides" ON public.rides;
DROP POLICY IF EXISTS "Allow public delete rides" ON public.rides;

-- CREATE ALL REQUIRED RLS POLICIES FOR RIDES (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Allow public select rides"
    ON public.rides FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert rides"
    ON public.rides FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update rides"
    ON public.rides FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete rides"
    ON public.rides FOR DELETE
    USING (true);


-- 3. PASSENGER PROFILES TABLE & RLS POLICIES
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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow public select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public delete profiles" ON public.profiles;

CREATE POLICY "Allow public select profiles"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert profiles"
    ON public.profiles FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update profiles"
    ON public.profiles FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete profiles"
    ON public.profiles FOR DELETE
    USING (true);


-- 4. CAPTAIN PROFILES TABLE & RLS POLICIES
CREATE TABLE IF NOT EXISTS public.captain_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT 'Moto Captain',
    email TEXT NULL,
    phone TEXT NULL,
    avatar_url TEXT NULL,
    rating NUMERIC(3, 2) DEFAULT 5.00,
    total_trips INTEGER DEFAULT 0,
    vehicle_model TEXT DEFAULT 'Standard Bike',
    vehicle_plate TEXT DEFAULT 'DL-01-AB-1234',
    vehicle_color TEXT DEFAULT 'Black',
    license_number TEXT NULL,
    is_online BOOLEAN DEFAULT false,
    current_lat DOUBLE PRECISION NULL,
    current_lng DOUBLE PRECISION NULL,
    total_earnings NUMERIC(10, 2) DEFAULT 0.00,
    today_earnings NUMERIC(10, 2) DEFAULT 0.00,
    acceptance_rate NUMERIC(5, 2) DEFAULT 98.50,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.captain_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read online captains" ON public.captain_profiles;
DROP POLICY IF EXISTS "Captains update own profile" ON public.captain_profiles;
DROP POLICY IF EXISTS "Captains insert own profile" ON public.captain_profiles;
DROP POLICY IF EXISTS "Allow public select captain profiles" ON public.captain_profiles;
DROP POLICY IF EXISTS "Allow public insert captain profiles" ON public.captain_profiles;
DROP POLICY IF EXISTS "Allow public update captain profiles" ON public.captain_profiles;
DROP POLICY IF EXISTS "Allow public delete captain profiles" ON public.captain_profiles;

CREATE POLICY "Allow public select captain profiles"
    ON public.captain_profiles FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert captain profiles"
    ON public.captain_profiles FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update captain profiles"
    ON public.captain_profiles FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete captain profiles"
    ON public.captain_profiles FOR DELETE
    USING (true);


-- 5. ATOMIC CLAIM RIDE RPC FUNCTION
CREATE OR REPLACE FUNCTION public.claim_ride(
    p_ride_id UUID,
    p_captain_id UUID,
    p_captain_name TEXT DEFAULT 'Captain',
    p_captain_phone TEXT DEFAULT '',
    p_captain_vehicle TEXT DEFAULT 'Motorcycle'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ride RECORD;
BEGIN
    UPDATE public.rides
    SET
        captain_id = p_captain_id,
        status = 'accepted',
        accepted_at = NOW(),
        captain_name = p_captain_name,
        captain_phone = p_captain_phone,
        captain_vehicle = p_captain_vehicle
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


-- 6. REALTIME PUBLICATION & REPLICA IDENTITY
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rides'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'captain_profiles'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.captain_profiles;
    END IF;
END
$$;

ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER TABLE public.captain_profiles REPLICA IDENTITY FULL;


-- 7. STORAGE BUCKETS & RLS POLICIES FOR UPLOADS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE 
SET public = true, file_size_limit = 5242880;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'motoride-uploads',
    'motoride-uploads',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
    -- SELECT (view files)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public can view avatars'
    ) THEN
        CREATE POLICY "Public can view avatars"
            ON storage.objects FOR SELECT
            USING (bucket_id IN ('avatars', 'motoride-uploads'));
    END IF;

    -- INSERT (upload files)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow public upload to avatars'
    ) THEN
        CREATE POLICY "Allow public upload to avatars"
            ON storage.objects FOR INSERT
            WITH CHECK (bucket_id IN ('avatars', 'motoride-uploads'));
    END IF;

    -- UPDATE (overwrite files)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow update avatars'
    ) THEN
        CREATE POLICY "Allow update avatars"
            ON storage.objects FOR UPDATE
            USING (bucket_id IN ('avatars', 'motoride-uploads'))
            WITH CHECK (bucket_id IN ('avatars', 'motoride-uploads'));
    END IF;

    -- DELETE (remove files)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Allow delete avatars'
    ) THEN
        CREATE POLICY "Allow delete avatars"
            ON storage.objects FOR DELETE
            USING (bucket_id IN ('avatars', 'motoride-uploads'));
    END IF;
END $$;
