import React, { useEffect, useState } from 'react';
import {
  Navigation,
  MapPin,
  Compass,
  Layers,
  Crosshair,
  Plus,
  Minus,
  Zap,
  Globe,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { RideStatus } from '../types/ride';
import { GoogleMapView } from './GoogleMapView';
import { LatLng, SERVICE_ZONES, ServiceZone, detectZoneForLocation } from '../utils/geoUtils';
import { calculateEstimatedRoute } from '../utils/fareCalculator';
import { useTheme } from '../context/ThemeContext';

interface MapMockupProps {
  pickupLocation: string;
  dropoffLocation: string;
  pickupCoords?: LatLng | null;
  dropoffCoords?: LatLng | null;
  status?: RideStatus;
  captainName?: string;
  captainVehicle?: string;
  distanceKm?: number;
  estimatedMins?: number;
  heightClass?: string;
  interactive?: boolean;
  onRouteCalculated?: (distanceKm: number, durationMins: number) => void;
  onSelectZoneLocation?: (pickup: string, dropoff: string) => void;
}

export const MapMockup: React.FC<MapMockupProps> = ({
  pickupLocation,
  dropoffLocation,
  pickupCoords,
  dropoffCoords,
  status = 'requested',
  captainName,
  captainVehicle,
  distanceKm = 4.2,
  estimatedMins = 12,
  heightClass = 'h-64 sm:h-72',
  interactive = true,
  onRouteCalculated,
  onSelectZoneLocation,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Map Engine selector: 'google' (Google Maps Platform) or 'vector' (Vector Canvas HUD)
  const [engine, setEngine] = useState<'google' | 'vector'>(() => {
    const saved = localStorage.getItem('motoride_map_engine');
    if (saved === 'vector') return 'vector';
    return 'google';
  });

  const [bikeProgress, setBikeProgress] = useState(0.12);
  const [trafficActive, setTrafficActive] = useState(true);
  const [showZones, setShowZones] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeVectorZone, setActiveVectorZone] = useState<string | null>(null);

  const [nearbyMotos, setNearbyMotos] = useState([
    { id: 1, x: 28, y: 42, rot: 35, name: 'Gurpreet S.' },
    { id: 2, x: 65, y: 25, rot: -40, name: 'Vikram R.' },
    { id: 3, x: 80, y: 70, rot: 110, name: 'Alex M.' },
    { id: 4, x: 45, y: 78, rot: 215, name: 'Rahul K.' },
  ]);

  const handleToggleEngine = (newEngine: 'google' | 'vector') => {
    setEngine(newEngine);
    localStorage.setItem('motoride_map_engine', newEngine);
  };

  const currentZone = detectZoneForLocation(pickupLocation);

  // Animate bike marker based on status in vector mode
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

  // Synchronize route calculation when using Vector HUD
  useEffect(() => {
    if (engine === 'vector' && onRouteCalculated && pickupLocation && dropoffLocation) {
      const route = calculateEstimatedRoute(pickupLocation, dropoffLocation);
      if (route.distanceKm > 0) {
        onRouteCalculated(route.distanceKm, route.estimatedMins);
      }
    }
  }, [engine, pickupLocation, dropoffLocation]);

  // Render Google Maps Platform when selected
  if (engine === 'google') {
    return (
      <div className="relative">
        <GoogleMapView
          pickupLocation={pickupLocation}
          dropoffLocation={dropoffLocation}
          pickupCoords={pickupCoords}
          dropoffCoords={dropoffCoords}
          status={status}
          captainName={captainName}
          captainVehicle={captainVehicle}
          distanceKm={distanceKm}
          estimatedMins={estimatedMins}
          heightClass={heightClass}
          interactive={interactive}
          onSwitchToVector={() => handleToggleEngine('vector')}
          onRouteCalculated={onRouteCalculated}
          onSelectZoneLocation={onSelectZoneLocation}
        />
      </div>
    );
  }

  // Alternate Vector Canvas Simulation HUD for Tricity Region
  return (
    <div
      id="uber-map-container"
      className={`relative w-full ${heightClass} ${
        isLight ? 'bg-[#ffffff] border-slate-200 shadow-md ring-1 ring-slate-100' : 'bg-[#0c0f17] border-slate-800 shadow-2xl'
      } rounded-2xl overflow-hidden border select-none transition-all duration-300`}
    >
      {/* City Map Background Canvas styling */}
      <div
        className="absolute inset-0 opacity-40 transition-transform duration-500"
        style={{
          transform: `scale(${zoomLevel})`,
          backgroundImage: isLight
            ? `
              radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.05) 0%, transparent 70%),
              linear-gradient(to right, rgba(203, 213, 225, 0.4) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(203, 213, 225, 0.4) 1px, transparent 1px)
            `
            : `
              radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.08) 0%, transparent 70%),
              linear-gradient(to right, rgba(30, 41, 59, 0.45) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(30, 41, 59, 0.45) 1px, transparent 1px)
            `,
          backgroundSize: '100% 100%, 28px 28px, 28px 28px',
        }}
      />

      {/* Styled Simulated City Roads, Waterway, and 6 Service Zones */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 600 320"
        preserveAspectRatio="none"
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
        </defs>

        {/* 6 Regional Service Area Zones (Vector Polygons) */}
        {showZones && (
          <>
            {/* 1. Kharar Zone (North-West) */}
            <polygon
              points="20,40 130,30 140,130 30,140"
              fill="rgba(236, 72, 153, 0.08)"
              stroke="#ec4899"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            {/* 2. Chandigarh Central (North-Center) */}
            <polygon
              points="150,20 360,20 370,140 160,140"
              fill="rgba(16, 185, 129, 0.08)"
              stroke="#10b981"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            {/* 3. Manimajra & IT Park (North-East) */}
            <polygon
              points="380,30 460,30 470,120 390,130"
              fill="rgba(6, 182, 212, 0.08)"
              stroke="#06b6d4"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            {/* 4. Panchkula (East) */}
            <polygon
              points="480,40 580,50 570,180 475,170"
              fill="rgba(139, 92, 246, 0.08)"
              stroke="#8b5cf6"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            {/* 5. Mohali (South-West) */}
            <polygon
              points="40,160 250,155 240,290 50,290"
              fill="rgba(14, 165, 233, 0.08)"
              stroke="#0ea5e9"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            {/* 6. Zirakpur (South-East) */}
            <polygon
              points="270,165 480,165 470,300 280,300"
              fill="rgba(245, 158, 11, 0.08)"
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
          </>
        )}

        {/* Sukhna Lake / Ghaggar River Waterways */}
        <path
          d="M 330 20 Q 360 40 370 70"
          stroke={isLight ? '#7dd3fc' : '#0284c7'}
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
          opacity={isLight ? '0.6' : '0.35'}
        />
        <path
          d="M 480 30 Q 510 140 500 310"
          stroke={isLight ? '#38bdf8' : '#0369a1'}
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          opacity={isLight ? '0.45' : '0.2'}
        />

        {/* Major Arterial Connecting Highways (Tricity Expressways) */}
        {/* Madhya Marg (Kharar -> Chandigarh -> Manimajra -> Panchkula) */}
        <path d="M 10 90 L 590 90" stroke={isLight ? '#cbd5e1' : '#1e293b'} strokeWidth="8" fill="none" opacity="0.9" />
        {/* Dakshin Marg (Mohali -> Tribune Chowk -> Zirakpur) */}
        <path d="M 10 180 L 590 180" stroke={isLight ? '#cbd5e1' : '#1e293b'} strokeWidth="8" fill="none" opacity="0.9" />
        {/* Himalaya Marg / Jan Marg */}
        <path d="M 210 -10 L 210 330" stroke={isLight ? '#cbd5e1' : '#1e293b'} strokeWidth="7" fill="none" opacity="0.85" />
        <path d="M 340 -10 L 340 330" stroke={isLight ? '#cbd5e1' : '#1e293b'} strokeWidth="7" fill="none" opacity="0.85" />
        {/* Airport Expressway (Mohali to Zirakpur/Highway) */}
        <path d="M 30 250 Q 250 240 450 250" stroke={isLight ? '#e2e8f0' : '#334155'} strokeWidth="6" fill="none" opacity="0.8" />

        {/* Traffic Flow Overlays */}
        {trafficActive && (
          <>
            <path d="M 10 90 L 220 90" stroke="#10b981" strokeWidth="3" strokeDasharray="6 4" fill="none" opacity="0.8" />
            <path d="M 220 90 L 370 90" stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 4" fill="none" opacity="0.8" />
            <path d="M 370 90 L 590 90" stroke="#10b981" strokeWidth="3" strokeDasharray="6 4" fill="none" opacity="0.8" />
            <path d="M 210 10 L 210 300" stroke="#10b981" strokeWidth="3" strokeDasharray="6 4" fill="none" opacity="0.8" />
          </>
        )}

        {/* Active Route Glow Underlay */}
        <path
          d="M 110 160 Q 220 170 260 120 T 420 90"
          stroke="#10b981"
          strokeWidth="12"
          strokeLinecap="round"
          opacity="0.18"
          fill="none"
        />

        {/* Active Navigation Route Path */}
        <path
          d="M 110 160 Q 220 170 260 120 T 420 90"
          stroke="url(#uberRouteGradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={status === 'started' ? '8 6' : 'none'}
          className={status === 'started' ? 'animate-[dash_1.5s_linear_infinite]' : ''}
          fill="none"
          filter="url(#uberGlow)"
        />
      </svg>

      {/* 6 Regional Service Area Labels on Vector Map */}
      {showZones && (
        <div className="absolute inset-0 pointer-events-none z-10 text-[9px] font-black tracking-wider uppercase">
          {/* Kharar */}
          <div className={`absolute top-[18%] left-[10%] px-1.5 py-0.5 rounded border shadow-sm ${
            isLight ? 'text-pink-700 bg-white/90 border-pink-300' : 'text-pink-400 bg-slate-950/70 border-pink-500/30'
          }`}>
            Kharar
          </div>
          {/* Chandigarh */}
          <div className={`absolute top-[12%] left-[42%] px-1.5 py-0.5 rounded border shadow-sm ${
            isLight ? 'text-emerald-700 bg-white/90 border-emerald-300' : 'text-emerald-400 bg-slate-950/70 border-emerald-500/30'
          }`}>
            Chandigarh
          </div>
          {/* Manimajra */}
          <div className={`absolute top-[16%] left-[68%] px-1.5 py-0.5 rounded border shadow-sm ${
            isLight ? 'text-cyan-700 bg-white/90 border-cyan-300' : 'text-cyan-400 bg-slate-950/70 border-cyan-500/30'
          }`}>
            Manimajra
          </div>
          {/* Panchkula */}
          <div className={`absolute top-[28%] left-[84%] px-1.5 py-0.5 rounded border shadow-sm ${
            isLight ? 'text-purple-700 bg-white/90 border-purple-300' : 'text-purple-400 bg-slate-950/70 border-purple-500/30'
          }`}>
            Panchkula
          </div>
          {/* Mohali */}
          <div className={`absolute top-[68%] left-[18%] px-1.5 py-0.5 rounded border shadow-sm ${
            isLight ? 'text-sky-700 bg-white/90 border-sky-300' : 'text-sky-400 bg-slate-950/70 border-sky-500/30'
          }`}>
            Mohali
          </div>
          {/* Zirakpur */}
          <div className={`absolute top-[72%] left-[58%] px-1.5 py-0.5 rounded border shadow-sm ${
            isLight ? 'text-amber-700 bg-white/90 border-amber-300' : 'text-amber-400 bg-slate-950/70 border-amber-500/30'
          }`}>
            Zirakpur
          </div>
        </div>
      )}

      {/* Nearby Idle Captains */}
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
                className={`w-7 h-7 rounded-full ${isLight ? 'bg-white border-emerald-500 shadow-md text-slate-900' : 'bg-slate-900/90 border-emerald-400/60 shadow-lg text-white'} border flex items-center justify-center text-[12px]`}
                style={{ transform: `rotate(${moto.rot}deg)` }}
                title={moto.name}
              >
                🏍️
              </div>
            </div>
          ))}
        </>
      )}

      {/* Pickup Marker */}
      <div
        className="absolute left-[20%] top-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-20"
        title={`Pickup: ${pickupLocation}`}
      >
        <div className={`${isLight ? 'bg-white/95 text-slate-900 border-slate-200 shadow-md' : 'bg-slate-950/95 text-white border-slate-700 shadow-xl'} text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap mb-1 flex items-center gap-1 backdrop-blur-md`}>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="max-w-[120px] truncate">{pickupLocation.split(',')[0]}</span>
        </div>
        <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/50 border-2 border-white ring-4 ring-emerald-500/20 font-black text-[10px]">
          ●
        </div>
      </div>

      {/* Dropoff Destination Marker */}
      <div
        className="absolute left-[70%] top-[28%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer z-20"
        title={`Destination: ${dropoffLocation}`}
      >
        <div className={`${isLight ? 'bg-white/95 text-slate-900 border-slate-200 shadow-md' : 'bg-slate-950/95 text-white border-slate-700 shadow-xl'} text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap mb-1 flex items-center gap-1 backdrop-blur-md`}>
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span className="max-w-[120px] truncate">{dropoffLocation.split(',')[0]}</span>
        </div>
        <div className="w-6 h-6 rounded-md bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/50 border-2 border-white ring-4 ring-rose-500/20">
          <Navigation className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Active Captain Motorbike Icon */}
      {status !== 'requested' && status !== 'cancelled' && (
        <div
          className="absolute transition-all duration-1000 ease-out z-30"
          style={{
            left: `${Math.min(85, Math.max(20, 20 + bikeProgress * 50))}%`,
            top: `${Math.min(75, Math.max(28, 50 - bikeProgress * 22))}%`,
          }}
        >
          <div className="relative -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className={`${isLight ? 'bg-white/95 text-slate-900 border-amber-300' : 'bg-slate-950/95 text-amber-300 border-amber-400/40'} text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap mb-1 flex items-center gap-1 border backdrop-blur-md`}>
              <span>🏍️ {captainName ? captainName.split(' ')[0] : 'Captain'}</span>
              <span className="text-[9px] bg-amber-400/20 text-amber-800 dark:text-amber-200 px-1 rounded font-bold">
                {status === 'accepted' ? 'En Route' : status === 'arrived' ? 'Arrived' : 'In Trip'}
              </span>
            </div>

            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-2xl shadow-amber-400/40 border-2 border-slate-950 ring-4 ring-amber-400/30 animate-bounce">
              <Compass className="w-5 h-5 text-slate-950 rotate-45" />
            </div>
          </div>
        </div>
      )}

      {/* Top Floating HUD */}
      <div className={`absolute top-3 left-3 backdrop-blur-md px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs shadow-md z-20 ${
        isLight ? 'bg-white/95 border-slate-200 text-slate-900' : 'bg-slate-950/95 border-slate-800 text-slate-100'
      }`}>
        <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
        <span className="font-bold flex items-center gap-1">
          <span className={`text-[10px] px-1 py-0.2 rounded font-mono font-bold ${
            isLight ? 'bg-sky-100 text-sky-800' : 'bg-sky-500/20 text-sky-300'
          }`}>
            VECTOR HUD
          </span>
          <span className={`text-[11px] font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
            {currentZone.name.split(' ')[0]}
          </span>
        </span>
        <span className={isLight ? 'text-slate-300' : 'text-slate-600'}>|</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{distanceKm} km</span>
        <span className={isLight ? 'text-slate-500 font-medium' : 'text-slate-400 font-medium'}>({estimatedMins} min)</span>
      </div>

      {/* Interactive Map Controls */}
      {interactive && (
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-20">
          <button
            type="button"
            onClick={() => setShowZones(!showZones)}
            title={showZones ? 'Hide Service Zones' : 'Show 6 Service Zones'}
            className={`p-1.5 rounded-lg text-xs font-semibold backdrop-blur-md border transition-all cursor-pointer ${
              showZones
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-300 shadow-sm'
                : isLight
                ? 'bg-white/90 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
                : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setTrafficActive(!trafficActive)}
            title={trafficActive ? 'Hide Live Traffic' : 'Show Live Traffic'}
            className={`p-1.5 rounded-lg text-xs font-semibold backdrop-blur-md border transition-all cursor-pointer ${
              trafficActive
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-600 dark:text-sky-300 shadow-sm'
                : isLight
                ? 'bg-white/90 border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm'
                : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZoomLevel((z) => (z >= 1.3 ? 1 : z + 0.15))}
            className={`p-1.5 rounded-lg border backdrop-blur-md transition-colors cursor-pointer ${
              isLight
                ? 'bg-white/90 hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
            title="Zoom Map"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZoomLevel(1)}
            className={`p-1.5 rounded-lg border backdrop-blur-md transition-colors cursor-pointer ${
              isLight
                ? 'bg-white/90 hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
            title="Reset Map Center"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom Service Area Indicator */}
      <div className={`absolute bottom-2 left-3 text-[10px] font-medium pointer-events-none z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-md backdrop-blur-sm border ${
        isLight ? 'bg-white/90 text-slate-700 border-slate-200 shadow-sm' : 'bg-slate-950/70 text-slate-400 border-slate-800'
      }`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span>Service Area: <strong>Zirakpur · Chandigarh · Panchkula · Manimajra · Mohali · Kharar</strong></span>
      </div>
    </div>
  );
};
