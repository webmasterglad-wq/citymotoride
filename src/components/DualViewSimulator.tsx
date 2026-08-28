import React, { useState } from 'react';
import { PassengerApp } from './PassengerApp';
import { CaptainApp } from './CaptainApp';
import { Smartphone, Monitor, ShieldCheck, Zap, SplitSquareVertical, Users } from 'lucide-react';

interface DualViewSimulatorProps {
  onOpenSqlModal: () => void;
}

export const DualViewSimulator: React.FC<DualViewSimulatorProps> = ({ onOpenSqlModal }) => {
  const [captain2Enabled, setCaptain2Enabled] = useState(false);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Simulation Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Real-Time Cross-App Simulator
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                Connected via Supabase
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Simulates your two separate Vercel apps (<code className="text-sky-300">motoride-passenger.vercel.app</code> & <code className="text-emerald-300">motoride-captain.vercel.app</code>) side-by-side.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="toggle-captain2-btn"
            onClick={() => setCaptain2Enabled(!captain2Enabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              captain2Enabled
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-400" />
            {captain2Enabled ? 'Hide Captain 2 (Race Test)' : 'Add Captain 2 (Race Test)'}
          </button>
        </div>
      </div>

      {/* Side-by-Side App Columns */}
      <div className={`grid grid-cols-1 ${captain2Enabled ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6 items-start`}>
        {/* Left Column: Passenger Vercel App */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-2 text-xs font-semibold text-sky-400">
            <span className="flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              Device A: Passenger App
            </span>
            <span className="text-[11px] text-slate-400 font-mono">motoride-passenger.vercel.app</span>
          </div>

          <div className="border-2 border-sky-500/30 rounded-3xl bg-slate-950/80 p-1 shadow-2xl backdrop-blur-sm">
            <PassengerApp onOpenSqlModal={onOpenSqlModal} />
          </div>
        </div>

        {/* Center/Right Column: Captain 1 Vercel App */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-2 text-xs font-semibold text-emerald-400">
            <span className="flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              Device B: Captain App (Alex)
            </span>
            <span className="text-[11px] text-slate-400 font-mono">motoride-captain.vercel.app</span>
          </div>

          <div className="border-2 border-emerald-500/30 rounded-3xl bg-slate-950/80 p-1 shadow-2xl backdrop-blur-sm">
            <CaptainApp
              captainUser={{
                id: 'b82ac71b-39dd-4172-b567-0e02b2c3d981',
                name: 'Captain Alex Rivera',
                phone: '+1 (555) 749-3021',
                role: 'captain',
                rating: 4.96,
                vehicle_details: 'Yamaha MT-07 · Stealth Black #7492',
              }}
              titleSuffix="Alex"
              onOpenSqlModal={onOpenSqlModal}
            />
          </div>
        </div>

        {/* Optional 3rd Column: Captain 2 (Race Condition / Concurrency Test) */}
        {captain2Enabled && (
          <div className="space-y-2 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between px-2 text-xs font-semibold text-purple-400">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" />
                Device C: Captain App 2 (Marcus)
              </span>
              <span className="text-[11px] text-purple-300 font-bold">Concurrency Test</span>
            </div>

            <div className="border-2 border-purple-500/30 rounded-3xl bg-slate-950/80 p-1 shadow-2xl backdrop-blur-sm">
              <CaptainApp
                captainUser={{
                  id: 'c93bd82c-40ee-4283-a678-1f13c3d4ea92',
                  name: 'Captain Marcus Chen',
                  phone: '+1 (555) 882-9014',
                  role: 'captain',
                  rating: 4.89,
                  vehicle_details: 'Kawasaki Ninja 400 · Lime/Black #3021',
                }}
                titleSuffix="Marcus"
                onOpenSqlModal={onOpenSqlModal}
              />
            </div>
          </div>
        )}
      </div>

      {/* Concurrency & Architecture Explanation Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Real-Time Architecture Verification Checklist
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <span className="font-bold text-sky-400 block">1. Instant Booking Flow</span>
            <p className="text-slate-400 leading-relaxed">
              When Passenger clicks <strong>Book MotoRide</strong>, an INSERT payload is written to <code className="text-slate-200">public.rides</code>. Supabase Realtime immediately broadcasts the event to all online Captains without page refreshes.
            </p>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <span className="font-bold text-amber-400 block">2. Atomic Acceptance & Concurrency</span>
            <p className="text-slate-400 leading-relaxed">
              When a Captain presses <strong>Accept Ride</strong>, the atomic RPC <code className="text-slate-200">claim_ride</code> evaluates <code className="text-slate-200">WHERE status = 'requested'</code>. If two Captains click at once, exactly ONE wins and the other receives an instant friendly collision notice.
            </p>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <span className="font-bold text-emerald-400 block">3. Live Lifecycle Progression</span>
            <p className="text-slate-400 leading-relaxed">
              As Captain advances status (<code className="text-slate-200">arrived</code> → <code className="text-slate-200">started</code> → <code className="text-slate-200">completed</code>), Passenger's active card and live GPS route update in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
