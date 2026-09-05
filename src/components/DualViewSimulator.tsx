import React, { useState } from 'react';
import { PassengerApp } from './PassengerApp';
import { CaptainApp } from './CaptainApp';
import { Smartphone, Monitor, ShieldCheck, Zap, SplitSquareVertical, Users } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

interface DualViewSimulatorProps {
  onOpenSqlModal: () => void;
}

export const DualViewSimulator: React.FC<DualViewSimulatorProps> = ({ onOpenSqlModal }) => {
  const { isLight } = useTheme();
  const { getUserForRole } = useAuth();
  const captainUser = getUserForRole('captain');
  const passengerUser = getUserForRole('passenger');
  const [captain2Enabled, setCaptain2Enabled] = useState(false);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Simulation Banner */}
      <div
        className={`border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 transition-colors duration-200 ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
            : 'bg-slate-900 border-slate-800 text-slate-100 shadow-lg'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              Real-Time Cross-App Simulator
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                  isLight
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                Connected via Supabase
              </span>
            </h2>
            <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Simulates your two separate Vercel apps (<code className={isLight ? 'text-sky-700 font-bold' : 'text-sky-300'}>motoride-passenger.vercel.app</code> & <code className={isLight ? 'text-emerald-700 font-bold' : 'text-emerald-300'}>motoride-captain.vercel.app</code>) side-by-side.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="toggle-captain2-btn"
            onClick={() => setCaptain2Enabled(!captain2Enabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              captain2Enabled
                ? isLight
                  ? 'bg-purple-100 border-purple-300 text-purple-800 font-bold'
                  : 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                : isLight
                ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-500" />
            {captain2Enabled ? 'Hide Captain 2 (Race Test)' : 'Add Captain 2 (Race Test)'}
          </button>
        </div>
      </div>

      {/* Side-by-Side App Columns */}
      <div className={`grid grid-cols-1 ${captain2Enabled ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6 items-start`}>
        {/* Left Column: Passenger Vercel App */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-2 text-xs font-bold text-sky-600">
            <span className="flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              Device A: Passenger App
            </span>
            <span className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>motoride-passenger.vercel.app</span>
          </div>

          <div
            className={`border-2 rounded-3xl p-1 shadow-xl transition-all duration-200 ${
              isLight ? 'border-sky-300/70 bg-slate-50/50 shadow-slate-200/50' : 'border-sky-500/30 bg-slate-950/80 shadow-2xl backdrop-blur-sm'
            }`}
          >
            <PassengerApp
              passengerUser={
                passengerUser
                  ? {
                      id: passengerUser.id,
                      name: passengerUser.name,
                      email: passengerUser.email,
                      phone: passengerUser.phone,
                      role: 'passenger',
                      rating: passengerUser.rating || 4.94,
                      avatar_url: passengerUser.avatar_url,
                    }
                  : undefined
              }
              onOpenSqlModal={onOpenSqlModal}
            />
          </div>
        </div>

        {/* Center/Right Column: Captain 1 Vercel App */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-2 text-xs font-bold text-emerald-600">
            <span className="flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" />
              Device B: Captain App 1
            </span>
            <span className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>motoride-captain.vercel.app</span>
          </div>

          <div
            className={`border-2 rounded-3xl p-1 shadow-xl transition-all duration-200 ${
              isLight ? 'border-emerald-300/70 bg-slate-50/50 shadow-slate-200/50' : 'border-emerald-500/30 bg-slate-950/80 shadow-2xl backdrop-blur-sm'
            }`}
          >
            <CaptainApp
              captainUser={
                captainUser
                  ? {
                      id: captainUser.id,
                      name: captainUser.name,
                      email: captainUser.email,
                      phone: captainUser.phone,
                      role: 'captain',
                      rating: captainUser.rating || 5.0,
                      vehicle_details: captainUser.vehicle_details || '',
                      avatar_url: captainUser.avatar_url,
                    }
                  : {
                      id: 'captain-sim-01',
                      name: 'Captain 1',
                      email: 'captain1@motoride.com',
                      phone: '',
                      role: 'captain',
                      rating: 5.0,
                      vehicle_details: '',
                    }
              }
              titleSuffix="1"
              onOpenSqlModal={onOpenSqlModal}
            />
          </div>
        </div>

        {/* Optional 3rd Column: Captain 2 (Race Condition / Concurrency Test) */}
        {captain2Enabled && (
          <div className="space-y-2 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between px-2 text-xs font-bold text-purple-600">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-4 h-4" />
                Device C: Captain App 2
              </span>
              <span className="text-[11px] text-purple-600 font-bold">Concurrency Test</span>
            </div>

            <div
              className={`border-2 rounded-3xl p-1 shadow-xl transition-all duration-200 ${
                isLight ? 'border-purple-300/70 bg-slate-50/50 shadow-slate-200/50' : 'border-purple-500/30 bg-slate-950/80 shadow-2xl backdrop-blur-sm'
              }`}
            >
              <CaptainApp
                captainUser={{
                  id: 'captain-sim-02',
                  name: 'Captain 2',
                  phone: '',
                  role: 'captain',
                  rating: 5.0,
                  vehicle_details: '',
                }}
                titleSuffix="2"
                onOpenSqlModal={onOpenSqlModal}
              />
            </div>
          </div>
        )}
      </div>

      {/* Concurrency & Architecture Explanation Card */}
      <div
        className={`border rounded-2xl p-5 space-y-4 transition-colors duration-200 ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Real-Time Architecture Verification Checklist
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div
            className={`p-3.5 rounded-xl border space-y-1.5 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
            }`}
          >
            <span className="font-bold text-sky-600 block">1. Instant Booking Flow</span>
            <p className={`leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              When Passenger clicks <strong>Book MotoRide</strong>, an INSERT payload is written to <code className={isLight ? 'text-slate-800 font-bold' : 'text-slate-200'}>public.rides</code>. Supabase Realtime immediately broadcasts the event to all online Captains without page refreshes.
            </p>
          </div>

          <div
            className={`p-3.5 rounded-xl border space-y-1.5 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
            }`}
          >
            <span className="font-bold text-amber-600 block">2. Atomic Acceptance & Concurrency</span>
            <p className={`leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              When a Captain presses <strong>Accept Ride</strong>, the atomic RPC <code className={isLight ? 'text-slate-800 font-bold' : 'text-slate-200'}>claim_ride</code> evaluates <code className={isLight ? 'text-slate-800 font-bold' : 'text-slate-200'}>WHERE status = 'requested'</code>. If two Captains click at once, exactly ONE wins and the other receives an instant friendly collision notice.
            </p>
          </div>

          <div
            className={`p-3.5 rounded-xl border space-y-1.5 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
            }`}
          >
            <span className="font-bold text-emerald-600 block">3. Live Lifecycle Progression</span>
            <p className={`leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              As Captain advances status (<code className={isLight ? 'text-slate-800 font-bold' : 'text-slate-200'}>arrived</code> → <code className={isLight ? 'text-slate-800 font-bold' : 'text-slate-200'}>started</code> → <code className={isLight ? 'text-slate-800 font-bold' : 'text-slate-200'}>completed</code>), Passenger's active card and live GPS route update in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

