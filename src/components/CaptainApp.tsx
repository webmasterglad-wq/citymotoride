import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  MapPin,
  Navigation,
  DollarSign,
  Clock,
  Phone,
  MessageSquare,
  User,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Radio,
  Power,
  RefreshCw,
  ShieldAlert,
  Loader2,
  Check,
  Award,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  Target,
  Zap,
  Volume2,
  KeyRound,
  ShieldCheck,
  X,
  XCircle,
  RotateCcw,
  Sliders,
  Sparkles,
  Camera,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Ride, RideStatus, UserProfile } from '../types/ride';
import {
  fetchActiveRequestedRides,
  fetchActiveRideForCaptain,
  claimRideAtomic,
  updateRideStatus,
  subscribeToCaptainRealtime,
  unsubscribeChannel,
} from '../services/rideService';
import { isSupabaseConfigured } from '../lib/supabase';
import { MapMockup } from './MapMockup';
import { InRideChatModal } from './InRideChatModal';
import { CaptainProfileModal } from './CaptainProfileModal';
import { RealtimeChannel } from '@supabase/supabase-js';

interface CaptainAppProps {
  captainUser?: UserProfile;
  titleSuffix?: string;
  onOpenSqlModal?: () => void;
}

interface DeclinedRideItem {
  ride: Ride;
  declinedAt: string;
  reason: string;
}

const getStoredCaptainId = (key = 'motoride_captain_uuid') => {
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : 'b82ac71b-39dd-4172-b567-0e02b2c3d981';
    localStorage.setItem(key, id);
  }
  return id;
};

export const CaptainApp: React.FC<CaptainAppProps> = ({
  captainUser = {
    id: getStoredCaptainId('motoride_captain_1_uuid'),
    name: 'Captain Alex Rivera',
    phone: '+1 (555) 749-3021',
    role: 'captain',
    rating: 4.96,
    vehicle_details: 'Yamaha MT-07 · Stealth Black #7492',
    acceptance_rate: 98,
    total_trips: 1420,
  },
  titleSuffix = '',
  onOpenSqlModal,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [requestedRides, setRequestedRides] = useState<Ride[]>([]);
  const [declinedRides, setDeclinedRides] = useState<DeclinedRideItem[]>([]);
  const [requestTab, setRequestTab] = useState<'incoming' | 'declined'>('incoming');
  const [decliningRideId, setDecliningRideId] = useState<string | null>(null);

  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [currentCaptain, setCurrentCaptain] = useState<UserProfile>(captainUser);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [completedCount, setCompletedCount] = useState<number>(6);
  const [todayEarnings, setTodayEarnings] = useState<number>(94.5);
  const [onlineMinutes, setOnlineMinutes] = useState<number>(185);

  const [isClaimingId, setIsClaimingId] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [concurrencyAlert, setConcurrencyAlert] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [tableMissingNotice, setTableMissingNotice] = useState<boolean>(false);
  const [realtimeState, setRealtimeState] = useState<string>('connecting');

  // Chat Modal
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const headerAvatarInputRef = useRef<HTMLInputElement>(null);

  const handleHeaderAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (typeof event.target?.result === 'string') {
            setCurrentCaptain((prev) => ({ ...prev, avatar_url: event.target?.result as string }));
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Play crisp incoming chime
  const playAlertSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {}
  };

  // Initial fetch
  const loadInitialData = async () => {
    if (!isSupabaseConfigured()) return;
    setTableMissingNotice(false);

    // 1. Check if captain already has an ongoing accepted ride
    const { data: activeData } = await fetchActiveRideForCaptain(captainUser.id);
    if (activeData) {
      setActiveRide(activeData);
    }

    // 2. Fetch pending requested rides
    const { data: pendingData, error } = await fetchActiveRequestedRides();
    if (error) {
      if (error.includes('missing') || error.includes('SQL') || error.includes('schema cache')) {
        setTableMissingNotice(true);
      }
    } else if (pendingData) {
      setRequestedRides(pendingData);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [captainUser.id]);

  // Establish Supabase Realtime Subscription
  useEffect(() => {
    if (!isOnline) {
      if (channelRef.current) {
        unsubscribeChannel(channelRef.current);
        channelRef.current = null;
      }
      setRealtimeState('offline');
      return;
    }

    const channel = subscribeToCaptainRealtime({
      onInsert: (newRide: Ride) => {
        if (newRide.status === 'requested') {
          playAlertSound();
          setRequestedRides((prev) => {
            if (prev.some((r) => r.id === newRide.id)) {
              return prev;
            }
            return [newRide, ...prev];
          });
        }
      },
      onUpdate: (updatedRide: Ride) => {
        if (updatedRide.captain_id === captainUser.id) {
          if (updatedRide.status === 'completed' || updatedRide.status === 'cancelled') {
            setActiveRide(null);
            if (updatedRide.status === 'completed') {
              setCompletedCount((c) => c + 1);
              setTodayEarnings((e) => Number((e + (updatedRide.fare || 14.5)).toFixed(2)));
              try {
                confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
              } catch (e) {}
            }
          } else {
            setActiveRide(updatedRide);
          }
        }

        // Maintain pending requested rides list
        setRequestedRides((prev) => {
          if (updatedRide.status === 'requested') {
            return prev.map((r) => (r.id === updatedRide.id ? updatedRide : r));
          } else {
            return prev.filter((r) => r.id !== updatedRide.id);
          }
        });
      },
      onStatusChange: (status) => {
        setRealtimeState(status);
      },
    });

    channelRef.current = channel;

    // Polling fallback to keep state updated even during network/socket reconnects
    const pollInterval = setInterval(() => {
      if (isSupabaseConfigured() && isOnline) {
        loadInitialData();
      }
    }, 4000);

    return () => {
      clearInterval(pollInterval);
      if (channelRef.current) {
        unsubscribeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [isOnline, captainUser.id]);

  // Handle Atomic Claim Ride (Concurrency Protected)
  const handleAcceptRide = async (ride: Ride, customFareOffer?: number) => {
    setIsClaimingId(ride.id);
    setConcurrencyAlert(null);

    const result = await claimRideAtomic(ride.id, captainUser.id, {
      name: captainUser.name,
      phone: captainUser.phone,
      vehicle: captainUser.vehicle_details,
      rating: captainUser.rating,
    });

    setIsClaimingId(null);

    if (result.success && result.ride) {
      setActiveRide(result.ride);
      setRequestedRides((prev) => prev.filter((r) => r.id !== ride.id));
      setDeclinedRides((prev) => prev.filter((d) => d.ride.id !== ride.id));
      setConcurrencyAlert({
        type: 'success',
        message: `Ride accepted! Proceed to pickup: ${ride.pickup_location}`,
      });

      try {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
      } catch (e) {}
    } else {
      setConcurrencyAlert({
        type: 'error',
        message: result.message || 'Ride was claimed by another nearby Captain.',
      });
      setRequestedRides((prev) => prev.filter((r) => r.id !== ride.id));
    }
  };

  // Handle Captain Declining an Incoming Ride
  const handleDeclineRide = (ride: Ride, reason: string = 'Passed by captain') => {
    const newItem: DeclinedRideItem = {
      ride,
      declinedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reason,
    };

    setDeclinedRides((prev) => [newItem, ...prev.filter((d) => d.ride.id !== ride.id)]);
    setRequestedRides((prev) => prev.filter((r) => r.id !== ride.id));
    setDecliningRideId(null);

    setConcurrencyAlert({
      type: 'error',
      message: `Ride #${ride.id.slice(0, 6)} declined (${reason}). Moved to Declined tab.`,
    });
  };

  // Restore a declined ride back to incoming broadcasts
  const handleRestoreRide = (item: DeclinedRideItem) => {
    setDeclinedRides((prev) => prev.filter((d) => d.ride.id !== item.ride.id));
    setRequestedRides((prev) => [item.ride, ...prev.filter((r) => r.id !== item.ride.id)]);
    setRequestTab('incoming');
    setConcurrencyAlert({
      type: 'success',
      message: `Ride #${item.ride.id.slice(0, 6)} restored to active incoming stream.`,
    });
  };

  // Clear all declined history
  const handleClearDeclined = () => {
    setDeclinedRides([]);
    setConcurrencyAlert({
      type: 'success',
      message: 'Declined requests list cleared.',
    });
  };

  // Progression: Arrived -> Started -> Completed -> Cancelled
  const handleProgressRide = async (nextStatus: RideStatus) => {
    if (!activeRide) return;
    setIsUpdatingStatus(true);

    try {
      const { data, error } = await updateRideStatus(activeRide.id, nextStatus);
      if (error) {
        setConcurrencyAlert({ type: 'error', message: `Update failed: ${error}` });
      } else if (data) {
        if (nextStatus === 'completed') {
          setActiveRide(null);
          setCompletedCount((c) => c + 1);
          setTodayEarnings((e) => Number((e + (data.fare || 14.5)).toFixed(2)));
          setConcurrencyAlert({
            type: 'success',
            message: `Trip completed! Earnings of ₹${data.fare?.toFixed(2) || '14.50'} deposited to your wallet.`,
          });
        } else if (nextStatus === 'cancelled') {
          setActiveRide(null);
          setConcurrencyAlert({ type: 'error', message: 'Trip was cancelled.' });
        } else {
          setActiveRide(data);
        }
      }
    } catch (err: any) {
      setConcurrencyAlert({ type: 'error', message: err?.message || 'Error updating status' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div
      id={`uber-captain-root${titleSuffix ? '-' + titleSuffix.toLowerCase() : ''}`}
      className="w-full max-w-md sm:max-w-lg mx-auto bg-[#07090e] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col font-sans"
    >
      {/* Uber Driver Top Header Bar */}
      <div className="bg-[#0b0f19] px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        {/* Hidden file input for fast avatar upload from driver header */}
        <input
          ref={headerAvatarInputRef}
          type="file"
          accept="image/*"
          onChange={handleHeaderAvatarChange}
          className="hidden"
          id="captain-header-avatar-input"
        />

        <div className="flex items-center gap-3">
          <div className="relative group">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="cursor-pointer block"
              title="Open Captain Profile & Photo"
            >
              {currentCaptain.avatar_url ? (
                <img
                  src={currentCaptain.avatar_url}
                  alt={currentCaptain.name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-2xl object-cover border border-amber-400/50 shadow-md group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-black text-lg shadow-md group-hover:scale-105 transition-transform">
                  🏍️
                </div>
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                headerAvatarInputRef.current?.click();
              }}
              className="absolute -bottom-1 -right-1 p-0.5 bg-slate-900 hover:bg-amber-400 text-slate-300 hover:text-slate-950 rounded-full border border-slate-700 shadow transition-colors cursor-pointer"
              title="Upload Captain photo"
            >
              <Camera className="w-2.5 h-2.5" />
            </button>
          </div>

          <button
            onClick={() => setIsProfileOpen(true)}
            className="text-left group cursor-pointer hover:opacity-90 transition-opacity"
            title="Open Captain Profile & Performance"
          >
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm text-slate-100">{currentCaptain.name}</span>
              {titleSuffix && <span className="text-amber-400 text-xs">({titleSuffix})</span>}
              <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-500/30">
                PROFILE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <span className="text-amber-300 font-bold flex items-center">
                ★ {currentCaptain.rating || 4.96}
              </span>
              <span>·</span>
              <span className="text-slate-300 group-hover:text-amber-400 transition-colors">
                {currentCaptain.vehicle_details?.split('·')[0] || 'Yamaha MT-07'}
              </span>
            </p>
          </button>
        </div>

        {/* Action Controls: Profile + Online Toggle */}
        <div className="flex items-center gap-2">
          <button
            id="captain-profile-header-btn"
            onClick={() => setIsProfileOpen(true)}
            className="p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Captain Profile & Performance"
          >
            <User className="w-4 h-4 text-amber-400" />
          </button>

          {/* Uber Online Toggle Button */}
          <button
            id="uber-driver-toggle-online-btn"
            onClick={() => setIsOnline(!isOnline)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black transition-all shadow-lg cursor-pointer ${
              isOnline
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25 ring-2 ring-emerald-400/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {isOnline ? 'ONLINE' : 'GO ONLINE'}
          </button>
        </div>
      </div>

      {/* Today's Earnings & Shift HUD (Uber Driver Style) */}
      <div className="p-4 bg-gradient-to-b from-[#0e1424] to-[#07090e] border-b border-slate-800/80 space-y-3">
        {/* Earnings Hero */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Today's Net Earnings
            </span>
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-black text-white tracking-tight">
                ₹{todayEarnings.toFixed(2)}
              </h2>
              <span className="text-xs font-bold text-emerald-400 flex items-center">
                <TrendingUp className="w-3 h-3 mr-0.5" /> +₹28.50 vs yesterday
              </span>
            </div>
          </div>

          {/* Surge Badge */}
          <div className="bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-2xl flex items-center gap-1.5 text-xs text-amber-300">
            <Flame className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
            <span className="font-bold">1.4x Surge Area</span>
          </div>
        </div>

        {/* Shift Stats Row */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-medium">Online Time</span>
            <span className="font-bold text-slate-100">
              {Math.floor(onlineMinutes / 60)}h {onlineMinutes % 60}m
            </span>
          </div>

          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-medium">Completed</span>
            <span className="font-bold text-slate-100">{completedCount} rides</span>
          </div>

          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-medium">Acceptance</span>
            <span className="font-bold text-emerald-400">98%</span>
          </div>
        </div>

        {/* Daily Quest Goal Bar */}
        <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
            <span className="flex items-center gap-1 text-amber-300">
              <Zap className="w-3 h-3 text-amber-400" />
              Daily Quest: Complete 8 rides for ₹25 bonus
            </span>
            <span className="font-mono text-slate-400">{completedCount}/8</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.min(100, (completedCount / 8) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Concurrency / Notification Toast */}
      {concurrencyAlert && (
        <div
          className={`m-3 p-3 rounded-2xl border text-xs flex items-start justify-between gap-2 animate-in slide-in-from-top-2 duration-200 ${
            concurrencyAlert.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <div className="flex items-start gap-2">
            {concurrencyAlert.type === 'error' ? (
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-bold block">
                {concurrencyAlert.type === 'error' ? 'Collision Notice' : 'Ride Dispatched'}
              </span>
              <span>{concurrencyAlert.message}</span>
            </div>
          </div>
          <button
            onClick={() => setConcurrencyAlert(null)}
            className="text-slate-400 hover:text-white text-xs px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* ================= MAIN VIEW: Active Trip In-Progress vs Incoming Requests ================= */}
      {activeRide ? (
        /* ================= UBER DRIVER ACTIVE TRIP HUD ================= */
        <div id="uber-captain-active-trip" className="p-4 space-y-3.5 flex flex-col animate-in fade-in duration-300">
          {/* Turn-by-Turn Navigation Header Banner */}
          <div className="bg-emerald-500 text-slate-950 p-3.5 rounded-2xl flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-950 text-white flex items-center justify-center font-black">
                <Navigation className="w-5 h-5 -rotate-45" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-900 block">
                  {activeRide.status === 'accepted' && 'NEXT: 350m TO PICKUP'}
                  {activeRide.status === 'arrived' && 'WAITING AT PICKUP SPOT'}
                  {activeRide.status === 'started' && 'NEXT: 200m TURN RIGHT ONTO MARKET ST'}
                </span>
                <span className="text-sm font-black leading-tight block">
                  {activeRide.status === 'accepted' ? activeRide.pickup_location.split(',')[0] : activeRide.dropoff_location.split(',')[0]}
                </span>
              </div>
            </div>

            <div className="text-right pl-2 border-l border-slate-900/20">
              <span className="text-xs font-black block leading-none">35 mph</span>
              <span className="text-[9px] font-bold text-slate-800">Speed Limit</span>
            </div>
          </div>

          {/* Full Navigation Vector Map */}
          <MapMockup
            pickupLocation={activeRide.pickup_location}
            dropoffLocation={activeRide.dropoff_location}
            status={activeRide.status}
            captainName={captainUser.name}
            distanceKm={activeRide.distance_km || 4.2}
            estimatedMins={activeRide.estimated_mins || 12}
            heightClass="h-52 sm:h-60"
          />

          {/* Passenger Contact Card */}
          <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                  {activeRide.passenger_name || 'Passenger'}
                  <span className="text-[10px] text-amber-400 font-semibold">★ 4.94</span>
                </h4>
                <p className="text-[11px] text-slate-400">{activeRide.passenger_phone || '+1 (555) 392-1049'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`tel:${activeRide.passenger_phone || '+15553921049'}`}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                title="Call Passenger"
              >
                <Phone className="w-4 h-4 text-emerald-400" />
              </a>

              <button
                type="button"
                onClick={() => setIsChatOpen(true)}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors relative"
                title="In-App Chat"
              >
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <span className="w-2 h-2 rounded-full bg-sky-400 absolute top-1 right-1" />
              </button>
            </div>
          </div>

          {/* Trip Addresses */}
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800 space-y-2 text-xs">
            <div className="flex items-start gap-2 text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Pickup</span>
                <span className="truncate block font-medium">{activeRide.pickup_location}</span>
              </div>
            </div>
            <div className="flex items-start gap-2 text-slate-300 border-t border-slate-800/80 pt-2">
              <Navigation className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Destination</span>
                <span className="truncate block font-medium">{activeRide.dropoff_location}</span>
              </div>
            </div>
          </div>

          {/* Tactile Action Slider / Buttons */}
          <div className="space-y-2 pt-1">
            {activeRide.status === 'accepted' && (
              <button
                id="uber-driver-arrived-btn"
                onClick={() => handleProgressRide('arrived')}
                disabled={isUpdatingStatus}
                className="w-full py-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-sky-500/25 transition-all cursor-pointer"
              >
                {isUpdatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                I Have Arrived at Pickup
              </button>
            )}

            {activeRide.status === 'arrived' && (
              <button
                id="uber-driver-start-trip-btn"
                onClick={() => handleProgressRide('started')}
                disabled={isUpdatingStatus}
                className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/25 transition-all cursor-pointer"
              >
                {isUpdatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                Passenger On Board · Start Trip
              </button>
            )}

            {activeRide.status === 'started' && (
              <button
                id="uber-driver-complete-btn"
                onClick={() => handleProgressRide('completed')}
                disabled={isUpdatingStatus}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 transition-all cursor-pointer"
              >
                {isUpdatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                Complete Ride · Collect ₹{activeRide.fare ? Number(activeRide.fare).toFixed(2) : '14.50'}
              </button>
            )}

            <button
              id="uber-driver-cancel-btn"
              onClick={() => handleProgressRide('cancelled')}
              disabled={isUpdatingStatus}
              className="w-full py-2 text-slate-400 hover:text-rose-400 text-xs font-semibold transition-colors text-center"
            >
              Cancel Ride
            </button>
          </div>
        </div>
      ) : (
        /* ================= INCOMING & DECLINED RIDE REQUESTS TABS (INDRIVE / UBER) ================= */
        <div className="p-4 space-y-3">
          {/* Sub-navigation Tabs: Incoming vs Declined */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                id="captain-tab-incoming"
                onClick={() => setRequestTab('incoming')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  requestTab === 'incoming'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Incoming</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  requestTab === 'incoming' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-300'
                }`}>
                  {requestedRides.length}
                </span>
              </button>

              <button
                type="button"
                id="captain-tab-declined"
                onClick={() => setRequestTab('declined')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  requestTab === 'declined'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Declined</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  requestTab === 'declined' ? 'bg-black/30 text-white' : 'bg-slate-800 text-slate-300'
                }`}>
                  {declinedRides.length}
                </span>
              </button>
            </div>

            {requestTab === 'declined' && declinedRides.length > 0 && (
              <button
                type="button"
                onClick={handleClearDeclined}
                className="text-[11px] font-bold text-slate-400 hover:text-rose-400 transition-colors"
              >
                Clear History
              </button>
            )}
          </div>

          {!isOnline ? (
            <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 space-y-2">
              <Power className="w-8 h-8 text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-200">You are currently Offline</h4>
              <p className="text-xs text-slate-400">
                Go online to start receiving instant ride requests from nearby riders.
              </p>
              <button
                onClick={() => setIsOnline(true)}
                className="mt-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-colors"
              >
                GO ONLINE NOW
              </button>
            </div>
          ) : tableMissingNotice ? (
            <div className="p-6 text-center bg-amber-500/10 rounded-2xl border border-amber-500/30 space-y-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-amber-200">Supabase Table Pending</h4>
              <p className="text-xs text-slate-300 max-w-sm mx-auto">
                Execute the 1-click SQL script in your Supabase project to activate instant dispatching.
              </p>
              {onOpenSqlModal && (
                <button
                  onClick={onOpenSqlModal}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-colors"
                >
                  Open SQL Script
                </button>
              )}
            </div>
          ) : requestTab === 'declined' ? (
            /* ================= DECLINED RIDES TAB CONTENT ================= */
            <div className="space-y-3">
              {declinedRides.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-200">No Declined Ride Requests</h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    When you decline or pass on incoming ride broadcasts, they will be catalogued here for review or reconsideration.
                  </p>
                  <button
                    type="button"
                    onClick={() => setRequestTab('incoming')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Radio className="w-3.5 h-3.5 text-emerald-400" />
                    Back to Incoming ({requestedRides.length})
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs px-1 text-slate-400">
                    <span>Passed or declined trip requests ({declinedRides.length})</span>
                    <span className="text-[10px] text-amber-400 font-medium">Reconsider anytime</span>
                  </div>

                  {declinedRides.map((item) => (
                    <div
                      key={`declined-${item.ride.id}`}
                      id={`declined-ride-${item.ride.id}`}
                      className="bg-slate-900/90 border border-slate-800 hover:border-rose-500/40 rounded-2xl p-3.5 space-y-3 shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center justify-center text-xs font-bold">
                            ✕
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-200">
                                {item.ride.passenger_name || 'Passenger'}
                              </h4>
                              <span className="text-[9px] px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                                {item.reason}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              Declined at {item.declinedAt} · {item.ride.distance_km || 4.8} km
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-black text-slate-300 block">
                            ₹{item.ride.fare ? Number(item.ride.fare).toFixed(2) : '14.50'}
                          </span>
                        </div>
                      </div>

                      {/* Route points */}
                      <div className="bg-slate-950 p-2 rounded-xl border border-slate-800/80 space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="truncate">{item.ride.pickup_location}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 border-t border-slate-900 pt-1">
                          <Navigation className="w-3 h-3 text-rose-400 shrink-0" />
                          <span className="truncate">{item.ride.dropoff_location}</span>
                        </div>
                      </div>

                      {/* Actions on Declined Item */}
                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleRestoreRide(item)}
                          className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                          Restore to Stream
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAcceptRide(item.ride)}
                          disabled={isClaimingId === item.ride.id}
                          className="py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
                        >
                          {isClaimingId === item.ride.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Reconsider & Accept
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : requestedRides.length === 0 ? (
            /* ================= INCOMING RIDES EMPTY STATE ================= */
            <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto animate-pulse">
                <Radio className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-200">Searching in 1.4x Surge Hotspot</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Waiting for riders. Ride offers will ring with audio alert instantly via Supabase Realtime.
              </p>
              <button
                onClick={loadInitialData}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mx-auto pt-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-sync Pending List
              </button>
            </div>
          ) : (
            /* ================= INCOMING RIDES ACTIVE STREAM ================= */
            <div className="space-y-3">
              {requestedRides.map((ride) => (
                <div
                  key={ride.id}
                  id={`ride-request-${ride.id}`}
                  className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 space-y-3 shadow-xl transition-all group"
                >
                  {/* Fare & Passenger Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-300 flex items-center justify-center font-bold text-sm border border-sky-500/30">
                        👤
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-100 flex items-center gap-1">
                          {ride.passenger_name || 'Passenger Request'}
                          <span className="text-amber-400 text-[10px]">★ 4.94</span>
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {ride.distance_km || 4.8} km · ~{ride.estimated_mins || 12} min trip
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-black text-emerald-400 block">
                        ₹{ride.fare ? Number(ride.fare).toFixed(2) : '14.50'}
                      </span>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-500/30">
                        0% Commission
                      </span>
                    </div>
                  </div>

                  {/* Route points */}
                  <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-start gap-2 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span className="truncate font-medium">{ride.pickup_location}</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-300 border-t border-slate-900 pt-1.5">
                      <Navigation className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                      <span className="truncate font-medium">{ride.dropoff_location}</span>
                    </div>
                  </div>

                  {/* inDrive / Uber Acceptance, Counter Offer & Decline Bar */}
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-3 gap-2">
                      {/* inDrive Counter Offer 1 */}
                      <button
                        type="button"
                        onClick={() => handleAcceptRide(ride, (ride.fare || 14.5) + 1.0)}
                        className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center justify-center gap-1"
                      >
                        Offer +₹1
                      </button>

                      {/* inDrive Counter Offer 2 */}
                      <button
                        type="button"
                        onClick={() => handleAcceptRide(ride, (ride.fare || 14.5) + 2.0)}
                        className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center justify-center gap-1"
                      >
                        Offer +₹2
                      </button>

                      {/* Instant Accept Button (Protected by Atomic Claim RPC) */}
                      <button
                        id={`accept-ride-btn-${ride.id}`}
                        onClick={() => handleAcceptRide(ride)}
                        disabled={isClaimingId === ride.id}
                        className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                      >
                        {isClaimingId === ride.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            Accept
                            <ChevronRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>

                    {/* Decline / Pass Request Action */}
                    {decliningRideId === ride.id ? (
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-rose-500/40 space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between text-[11px] font-bold text-rose-300">
                          <span>Select reason to decline:</span>
                          <button
                            type="button"
                            onClick={() => setDecliningRideId(null)}
                            className="text-slate-400 hover:text-white"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          {['Pickup too far', 'Low fare rate', 'Heavy traffic', 'Taking a break'].map((reason) => (
                            <button
                              key={reason}
                              type="button"
                              onClick={() => handleDeclineRide(ride, reason)}
                              className="p-1.5 bg-slate-900 hover:bg-rose-500/20 text-slate-300 hover:text-rose-200 rounded-lg border border-slate-800 text-left truncate transition-colors cursor-pointer"
                            >
                              • {reason}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeclineRide(ride, 'Passed by captain')}
                          className="w-full py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Confirm Quick Decline
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        id={`decline-ride-btn-${ride.id}`}
                        onClick={() => setDecliningRideId(ride.id)}
                        className="w-full py-2 bg-slate-950/60 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-slate-800/80 hover:border-rose-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        Decline / Pass Request
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* In-Ride Chat Modal */}
      {activeRide && (
        <InRideChatModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          rideId={activeRide.id}
          currentUserRole="captain"
          currentUserName={currentCaptain.name}
          otherPartyName={activeRide.passenger_name || 'Passenger'}
          otherPartyRole="Passenger"
        />
      )}

      {/* Captain Profile & Performance Modal / Page */}
      <CaptainProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        captain={currentCaptain}
        onUpdateCaptain={(updated) => setCurrentCaptain((prev) => ({ ...prev, ...updated }))}
        todayEarnings={todayEarnings}
        completedCount={completedCount}
      />
    </div>
  );
};
