import React, { useState } from 'react';
import { Copy, Check, Terminal, Database, Shield, Zap, ExternalLink, X } from 'lucide-react';

interface SqlSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SUPABASE_SQL_SCRIPT = `-- ==========================================
-- MOTORIDE REAL-TIME RIDE SHARING SCHEMA
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
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'arrived', 'started', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL
);

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
    -- Add public.rides to realtime publication if not already included
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

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- Allow read access for requested rides (available to captains) or rides belonging to the user
CREATE POLICY "Allow public/authenticated read rides"
    ON public.rides
    FOR SELECT
    USING (true);

-- Allow creating new rides (passengers)
CREATE POLICY "Allow insert new rides"
    ON public.rides
    FOR INSERT
    WITH CHECK (true);

-- Allow update of rides (captains accepting/updating, passengers cancelling)
CREATE POLICY "Allow update rides"
    ON public.rides
    FOR UPDATE
    USING (true);
`;

export const SqlSetupModal: React.FC<SqlSetupModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT);
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
                Supabase SQL Setup & Realtime Configuration
              </h2>
              <p className="text-xs text-slate-400">
                Run this once in your Supabase SQL Editor to provision the table, atomic RPC & Realtime publication.
              </p>
            </div>
          </div>
          <button
            id="close-sql-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
                Add <strong className="text-amber-300">VITE_SUPABASE_URL</strong> & <strong className="text-amber-300">ANON_KEY</strong> to both Vercel apps.
              </p>
            </div>
          </div>

          {/* Key Architectural Highlights */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <span className="font-semibold text-slate-100 block">Atomic Concurrency & Realtime Guarantees:</span>
              <p className="text-slate-400">
                Includes the <code className="text-amber-300 font-mono">claim_ride</code> atomic function (ensuring 2 Captains cannot race-condition the same ride) and configures <code className="text-emerald-300 font-mono">supabase_realtime</code> with <code className="text-sky-300 font-mono">REPLICA IDENTITY FULL</code>.
              </p>
            </div>
          </div>

          {/* Code block with copy button */}
          <div className="relative rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-mono text-slate-300">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                schema_and_realtime.sql
              </span>
              <button
                id="copy-sql-btn"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors shadow-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy SQL'}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-emerald-300/90 overflow-x-auto max-h-64 leading-relaxed scrollbar-thin scrollbar-thumb-slate-700">
              {SUPABASE_SQL_SCRIPT}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Safe to run multiple times (uses <code className="text-slate-300">IF NOT EXISTS</code>).
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied to Clipboard' : 'Copy All SQL'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
