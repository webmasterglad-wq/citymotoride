import React, { useEffect, useState } from 'react';
import {
  Navigation,
  MapPin,
  Compass,
  ShieldCheck,
  Layers,
  Crosshair,
  Plus,
  Minus,
  Sparkles,
  Zap,
} from 'lucide-react';
import { RideStatus } from '../types/ride';

interface MapMockupProps {
  pickupLocation: string;
  dropoffLocation: string;
  status?: RideStatus;
  captainName?: string;
  captainVehicle?: string;
  distanceKm?: number;
  estimatedMins?: number;
  heightClass?: string;
  interactive?: boolean;
}

export const MapMockup: React.FC<MapMockupProps> = ({
  pickupLocation,
  dropoffLocation,
  status = 'requested',
  captainName,
  captainVehicle,
  distanceKm = 4.2,
  estimatedMins = 12,
  heightClass = 'h-64 sm:h-72',
  interactive = true,
}) => {
  const [bikeProgress, setBikeProgress] = useState(0.12);
  const [trafficActive, setTrafficActive] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [nearbyMotos, setNearbyMotos] = useState([
    { id: 1, x: 28, y: 42, rot: 35 },
    { id: 2, x: 65, y: 25, rot: -40 },
    { id: 3, x: 80, y: 70, rot: 110 },
  ]);

  // Animate bike marker based on status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'accepted') {
      setBikeProgress(0.2);
    } else if (status === 'arrived') {
      setBikeProgress(0.32);
    } else if (status === 'started') {
      interval = setInterval(() => {
        setBikeProgress((prev) => (prev >= 0.92 ? 0.35 : prev + 0.04));
      }, 1200);
    } else if (status === 'completed') {
      setBikeProgress(0.96);
    } else {
      setBikeProgress(0.12);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status]);

  // Subtle wandering animation for nearby mock bikes when idle
  useEffect(() => {
    if (status === 'requested' || status === 'completed' || status === 'cancelled') {
      const interval = setInterval(() => {
        setNearbyMotos((prev) =>
          prev.map((m) => ({
            ...m,
            x: Math.max(15, Math.min(85, m.x + (Math.random() * 4 - 2))),
            y: Math.max(15, Math.min(85, m.y + (Math.random() * 4 - 2))),
            rot: m.rot + (Math.random() * 20 - 10),
          }))
        );
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [status]);

  return (
    <div
      id="uber-map-container"
      className={`relative w-full ${heightClass} bg-[#0c0f17] rounded-2xl overflow-hidden shadow-2xl border border-slate-800 select-none transition-all duration-300`}
    >
      {/* City Map Background Canvas styling */}
      <div
        className="absolute inset-0 opacity-40 transition-transform duration-500"
        style={{
          transform: `scale(${zoomLevel})`,
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.08) 0%, transparent 70%),
            linear-gradient(to right, rgba(30, 41, 59, 0.45) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(30, 41, 59, 0.45) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 28px 28px, 28px 28px',
        }}
      />

      {/* Styled Simulated City Roads, Waterway, and Park */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.5s ease' }}
      >
        <defs>
          <linearGradient id="uberRouteGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00ff88" />
            <stop offset="45%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>

          <filter id="uberGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <pattern id="parkPattern" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="6" cy="6" r="1" fill="#064e3b" opacity="0.4" />
          </pattern>
        </defs>

        {/* Ambient City Blocks / Buildings */}
        <rect x="20" y="20" width="70" height="45" rx="6" fill="#131c2e" opacity="0.7" />
        <rect x="110" y="15" width="90" height="50" rx="6" fill="#131c2e" opacity="0.6" />
        <rect x="220" y="25" width="110" height="40" rx="6" fill="#131c2e" opacity="0.6" />
        <rect x="30" y="190" width="80" height="60" rx="6" fill="#131c2e" opacity="0.7" />
        <rect x="230" y="170" width="120" height="60" rx="6" fill="#131c2e" opacity="0.6" />

        {/* City Park Polygon */}
        <polygon points="120,80 200,85 190,145 110,135" fill="#064e3b" opacity="0.25" />
        <polygon points="120,80 200,85 190,145 110,135" fill="url(#parkPattern)" />

        {/* River Waterway */}
        <path
          d="M-40 230 Q 150 180 320 250 T 600 210"
          stroke="#0369a1"
          strokeWidth="16"
          strokeLinecap="round"
          fill="none"
          opacity="0.2"
        />

        {/* Major Arterial Roads */}
        <path d="M-30 75 L 550 75" stroke="#1e293b" strokeWidth="8" fill="none" opacity="0.8" />
        <path d="M-30 155 L 550 155" stroke="#1e293b" strokeWidth="8" fill="none" opacity="0.8" />
        <path d="M95 -20 L 95 320" stroke="#1e293b" strokeWidth="8" fill="none" opacity="0.8" />
        <path d="M210 -20 L 210 320" stroke="#1e293b" strokeWidth="8" fill="none" opacity="0.8" />
        <path d="M350 -20 L 350 320" stroke="#1e293b" strokeWidth="8" fill="none" opacity="0.8" />

        {/* Diagonal Boulevard */}
        <path d="M-20 260 Q 140 180 380 40" stroke="#334155" strokeWidth="6" fill="none" opacity="0.7" />

        {/* Traffic Flow Overlay (Uber Live Traffic style) */}
        {trafficActive && (
          <>
            <path d="M-30 75 L 140 75" stroke="#10b981" strokeWidth="3" strokeDasharray="6 4" fill="none" opacity="0.7" />
            <path d="M140 75 L 260 75" stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 4" fill="none" opacity="0.7" />
            <path d="M260 75 L 500 75" stroke="#10b981" strokeWidth="3" strokeDasharray="6 4" fill="none" opacity="0.7" />
            <path d="M210 10 L 210 160" stroke="#10b981" strokeWidth="3" strokeDasharray="6 4" fill="none" opacity="0.7" />
          </>
        )}

        {/* Active Route Glow Underlay */}
        <path
          d="M 50 155 Q 110 155 130 110 T 250 90 T 360 75"
          stroke="#00ff88"
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.15"
          fill="none"
        />

        {/* Active Navigation Route Path */}
        <path
          d="M 50 155 Q 110 155 130 110 T 250 90 T 360 75"
          stroke="url(#uberRouteGradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={status === 'started' ? '8 6' : 'none'}
          className={status === 'started' ? 'animate-[dash_1.5s_linear_infinite]' : ''}
          fill="none"
          filter="url(#uberGlow)"
        />
      </svg>

      {/* Nearby Idle Captains (inDrive / Uber visual radar) */}
      {(status === 'requested' || status === 'completed' || status === 'cancelled') && (
        <>
          {nearbyMotos.map((moto) => (
            <div
              key={moto.id}
              className="absolute transition-all duration-1000 ease-out pointer-events-none z-10"
              style={{
                left: `${moto.x}%`,
                top: `${moto.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className="w-7 h-7 rounded-full bg-slate-900/90 border border-emerald-400/60 shadow-lg flex items-center justify-center text-[12px]"
                style={{ transform: `rotate(${moto.rot}deg)` }}
                title="Nearby Moto"
              >
                🏍️
              </div>
            </div>
          ))}
        </>
      )}

      {/* Radar Search Rings when in 'requested' state */}
      {status === 'requested' && (
        <div className="absolute left-[50px] top-[155px] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
          <div className="w-24 h-24 rounded-full border border-sky-400/40 bg-sky-500/10 animate-ping" />
          <div className="w-44 h-44 -mt-34 -ml-10 rounded-full border border-emerald-400/20 animate-pulse" />
        </div>
      )}

      {/* Pickup Marker (Uber Square/Circle Pin) */}
      <div
        className="absolute left-[50px] top-[155px] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-20"
        title={`Pickup: ${pickupLocation}`}
      >
        <div className="bg-slate-950/95 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xl border border-slate-700 whitespace-nowrap mb-1 flex items-center gap-1 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="max-w-[120px] truncate">{pickupLocation.split(',')[0]}</span>
        </div>
        <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/50 border-2 border-white ring-4 ring-emerald-500/20 font-black text-[10px]">
          ●
        </div>
      </div>

      {/* Dropoff Destination Marker */}
      <div
        className="absolute left-[360px] top-[75px] max-sm:left-[78%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-20"
        title={`Destination: ${dropoffLocation}`}
      >
        <div className="bg-slate-950/95 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xl border border-slate-700 whitespace-nowrap mb-1 flex items-center gap-1 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          <span className="max-w-[120px] truncate">{dropoffLocation.split(',')[0]}</span>
        </div>
        <div className="w-6 h-6 rounded-md bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/50 border-2 border-white ring-4 ring-rose-500/20">
          <Navigation className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Active Captain Motorbike Icon with Real-Time Heading */}
      {status !== 'requested' && status !== 'cancelled' && (
        <div
          className="absolute transition-all duration-1000 ease-out z-30"
          style={{
            left: `${Math.min(90, Math.max(10, 14 + bikeProgress * 70))}%`,
            top: `${Math.min(80, Math.max(18, 62 - bikeProgress * 36))}%`,
          }}
        >
          <div className="relative -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            {/* Captain Floating Tag */}
            <div className="bg-slate-950/95 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xl whitespace-nowrap mb-1 flex items-center gap-1 border border-amber-400/40 backdrop-blur-md">
              <span>🏍️ {captainName ? captainName.split(' ')[0] : 'Captain'}</span>
              <span className="text-[9px] bg-amber-400/20 text-amber-200 px-1 rounded">
                {status === 'accepted' ? 'En Route' : status === 'arrived' ? 'Arrived' : 'In Trip'}
              </span>
            </div>

            {/* Vehicle Icon Marker */}
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-2xl shadow-amber-400/40 border-2 border-slate-950 ring-4 ring-amber-400/30 animate-bounce">
              <Compass className="w-5 h-5 text-slate-950 rotate-45" />
            </div>
          </div>
        </div>
      )}

      {/* Top Floating HUD: Live ETA & Route stats */}
      <div className="absolute top-3 left-3 bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2 text-xs shadow-xl z-20">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-bold text-slate-100">
          {status === 'started' ? 'In Transit' : status === 'arrived' ? 'At Pickup' : 'GPS Active'}
        </span>
        <span className="text-slate-600">|</span>
        <span className="text-emerald-400 font-bold">{distanceKm} km</span>
        <span className="text-slate-400 font-medium">({estimatedMins} min)</span>
      </div>

      {/* Interactive Map Controls (Zoom & Layers) */}
      {interactive && (
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-20">
          <button
            type="button"
            onClick={() => setTrafficActive(!trafficActive)}
            title={trafficActive ? 'Hide Live Traffic' : 'Show Live Traffic'}
            className={`p-1.5 rounded-lg text-xs font-semibold backdrop-blur-md border transition-all ${
              trafficActive
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZoomLevel((z) => (z >= 1.3 ? 1 : z + 0.15))}
            className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 backdrop-blur-md transition-colors"
            title="Zoom Map"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZoomLevel(1)}
            className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 backdrop-blur-md transition-colors"
            title="Reset Map Center"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom Subtle Overlay */}
      <div className="absolute bottom-2 left-3 text-[10px] text-slate-500 font-mono pointer-events-none z-10">
        © MotoRide Vector Navigation · Live RT
      </div>
    </div>
  );
};
