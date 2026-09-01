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
  VolumeX,
  KeyRound,
  ShieldCheck,
  X,
  XCircle,
  RotateCcw,
  Sliders,
  Sparkles,
  Camera,
  ExternalLink,
  Star,
  ThumbsUp,
  Settings,
  Bell,
  BellOff,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Ride, RideStatus, UserProfile, CaptainEarningsSummary, getRideServiceInfo } from '../types/ride';
import {
  fetchActiveRequestedRides,
  fetchActiveRideForCaptain,
  claimRideAtomic,
  updateRideStatus,
  subscribeToCaptainRealtime,
  unsubscribeChannel,
  fetchCaptainEarningsSummary,
  getLocalDayBounds,
} from '../services/rideService';
import { isSupabaseConfigured } from '../lib/supabase';
import { InRideChatModal } from './InRideChatModal';
import { CaptainProfileModal } from './CaptainProfileModal';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useTheme } from '../context/ThemeContext';

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
  const [onlineMinutes, setOnlineMinutes] = useState<number>(185);

  // Database-driven Earnings Summary strictly from completed rides
  const [earningsSummary, setEarningsSummary] = useState<CaptainEarningsSummary>({
    todayIncome: 0,
    todayCompletedCount: 0,
    yesterdayIncome: 0,
    yesterdayCompletedCount: 0,
    totalEarnings: 0,
    totalCompletedTrips: 0,
    completedRides: [],
    todayRides: [],
    lastCalculatedAt: new Date().toISOString(),
  });

  const [isClaimingId, setIsClaimingId] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [concurrencyAlert, setConcurrencyAlert] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [tableMissingNotice, setTableMissingNotice] = useState<boolean>(false);
  const [realtimeState, setRealtimeState] = useState<string>('connecting');

  // Chat Modal
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false);

  // Incoming Request Sweet Alert Tune On/Off State with localStorage persistence
  const [isAlertSoundEnabled, setIsAlertSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('motoride_captain_alert_sound');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleAlertSound = () => {
    setIsAlertSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('motoride_captain_alert_sound', String(next));
      if (next) {
        // Play sweet alert tune preview when toggled ON
        playAlertSound(true);
      }
      return next;
    });
  };

  // Passenger Rating & Ride Completion Flow
  const [isRatingPassengerModalOpen, setIsRatingPassengerModalOpen] = useState<boolean>(false);
  const [passengerRatingStars, setPassengerRatingStars] = useState<number>(5);
  const [passengerRatingTags, setPassengerRatingTags] = useState<string[]>(['Polite Rider', 'On Time']);
  const [passengerRatingNotes, setPassengerRatingNotes] = useState<string>('');
  const { isLight } = useTheme();

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

  // Play melodic 3-tone Sweet Alert Tune for incoming requests
  const playAlertSound = (force = false) => {
    if (!isAlertSoundEnabled && !force) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const audioCtx = new AudioCtxClass();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const notes = [
        { freq: 523.25, time: 0, dur: 0.12 },     // C5 (Bright chime start)
        { freq: 659.25, time: 0.12, dur: 0.14 },  // E5 (Melodic harmony)
        { freq: 783.99, time: 0.26, dur: 0.14 },  // G5 (Sweet ascending peak)
        { freq: 1046.50, time: 0.40, dur: 0.35 }, // C6 (Crystal clear bell tail)
      ];

      notes.forEach((n) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, audioCtx.currentTime + n.time);

        // Gentle envelope for sweet bell-like chime
        gain.gain.setValueAtTime(0.001, audioCtx.currentTime + n.time);
        gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + n.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + n.time + n.dur);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + n.time);
        osc.stop(audioCtx.currentTime + n.time + n.dur);
      });
    } catch (e) {}
  };

  // Database-driven earnings fetch for this captain
  const loadEarningsData = async () => {
    if (!isSupabaseConfigured() || !captainUser.id) return;
    const { data } = await fetchCaptainEarningsSummary(captainUser.id);
    if (data) {
      setEarningsSummary(data);
    }
  };

  // Initial fetch
  const loadInitialData = async () => {
    if (!isSupabaseConfigured()) return;
    setTableMissingNotice(false);

    // 1. Fetch real-time Today's Income & lifetime summary
    loadEarningsData();

    // 2. Check if captain already has an ongoing accepted ride
    const { data: activeData } = await fetchActiveRideForCaptain(captainUser.id);
    if (activeData) {
      setActiveRide(activeData);
    }

    // 3. Fetch pending requested rides
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

  // Automatic Daily Reset: Watches calendar date transitions (e.g. 12:00 AM midnight rollover)
  // Automatically switches Today's Income to ₹0 on a new day without manual captain intervention
  useEffect(() => {
    let lastDateKey = getLocalDayBounds().todayDateKey;

    const dateCheckInterval = setInterval(() => {
      const currentDateKey = getLocalDayBounds().todayDateKey;
      if (currentDateKey !== lastDateKey) {
        lastDateKey = currentDateKey;
        loadEarningsData();
      }
    }, 10000);

    return () => clearInterval(dateCheckInterval);
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
            // Refresh database-calculated earnings immediately
            loadEarningsData();
            if (updatedRide.status === 'completed') {
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
      message: `Ride #${ride.id.slice(0, 6)} skipped (${reason}). Moved to Skipped tab.`,
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

  // Toggle quick rating feedback tag
  const handleToggleRatingTag = (tag: string) => {
    setPassengerRatingTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Complete Ride with Passenger Rating Submission
  const handleCompleteRideWithRating = async (skipRating: boolean = false) => {
    if (!activeRide) return;
    setIsUpdatingStatus(true);

    try {
      const { data, error } = await updateRideStatus(activeRide.id, 'completed');
      if (error) {
        setConcurrencyAlert({ type: 'error', message: `Update failed: ${error}` });
      } else if (data) {
        setIsRatingPassengerModalOpen(false);
        setActiveRide(null);
        // Immediately refresh database-calculated earnings
        loadEarningsData();

        try {
          confetti({ particleCount: 80, spread: 90, origin: { y: 0.5 } });
        } catch (e) {}

        const ratingText = skipRating
          ? ''
          : ` Rated ${data.passenger_name || 'Passenger'} ⭐ ${passengerRatingStars}/5.`;

        setConcurrencyAlert({
          type: 'success',
          message: `Trip completed!${ratingText} Earnings of ₹${data.fare?.toFixed(2) || '14.50'} deposited to your wallet.`,
        });

        // Reset rating form for next ride
        setPassengerRatingStars(5);
        setPassengerRatingTags(['Polite Rider', 'On Time']);
        setPassengerRatingNotes('');
      }
    } catch (err: any) {
      setConcurrencyAlert({ type: 'error', message: err?.message || 'Error updating status' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Progression: Arrived -> Started -> Completed -> Cancelled
  const handleProgressRide = async (nextStatus: RideStatus) => {
    if (!activeRide) return;

    // If completing the ride, prompt captain to rate the passenger first
    if (nextStatus === 'completed') {
      setIsRatingPassengerModalOpen(true);
      return;
    }

    setIsUpdatingStatus(true);

    try {
      const { data, error } = await updateRideStatus(activeRide.id, nextStatus);
      if (error) {
        setConcurrencyAlert({ type: 'error', message: `Update failed: ${error}` });
      } else if (data) {
        if (nextStatus === 'cancelled') {
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
      className={`w-full max-w-md sm:max-w-lg mx-auto border rounded-3xl overflow-hidden shadow-2xl flex flex-col font-sans transition-colors duration-200 ${
        isLight
          ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/60'
          : 'bg-[#07090e] border-slate-800 text-slate-100 shadow-2xl'
      }`}
    >
      {/* Uber Driver Top Header Bar */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between transition-colors duration-200 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#0b0f19] border-slate-800'
        }`}
      >
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
              className={`absolute -bottom-1 -right-1 p-0.5 rounded-full border shadow transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-amber-400 text-slate-700 hover:text-slate-950 border-slate-300'
                  : 'bg-slate-900 hover:bg-amber-400 text-slate-300 hover:text-slate-950 border-slate-700'
              }`}
              title="Upload Captain photo"
            >
              <Camera className="w-2.5 h-2.5" />
            </button>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className={`font-black text-sm ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                {currentCaptain.name}
              </span>
              {titleSuffix && <span className="text-amber-500 font-bold text-xs">({titleSuffix})</span>}
            </div>
            <p className={`text-[11px] flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className="text-amber-500 dark:text-amber-300 font-bold flex items-center">
                ★ {currentCaptain.rating || 4.96}
              </span>
              <span>·</span>
              <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                {currentCaptain.vehicle_details?.split('·')[0] || 'Yamaha MT-07'}
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls: Online Toggle */}
        <div className="flex items-center gap-2">
          {/* Uber Online Toggle Button */}
          <button
            id="uber-driver-toggle-online-btn"
            onClick={() => setIsOnline(!isOnline)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black transition-all shadow-lg cursor-pointer ${
              isOnline
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25 ring-2 ring-emerald-400/40'
                : isLight
                ? 'bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {isOnline ? 'ONLINE' : 'GO ONLINE'}
          </button>
        </div>
      </div>

      {/* Today's Income & Shift HUD (Uber Driver Style) */}
      <div
        className={`p-4 border-b space-y-3 transition-colors duration-200 ${
          isLight
            ? 'bg-gradient-to-b from-slate-50 to-white border-slate-200'
            : 'bg-gradient-to-b from-[#0e1424] to-[#07090e] border-slate-800/80'
        }`}
      >
        {/* Today's Income Hero Card */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`text-[11px] font-black uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Today's Income
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300'
              }`}>
                {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <h2 id="captain-today-income-hero" className={`text-2xl sm:text-3xl font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                ₹{earningsSummary.todayIncome.toFixed(2)}
              </h2>
              {earningsSummary.yesterdayIncome > 0 ? (
                <span className={`text-xs font-bold flex items-center ${
                  earningsSummary.todayIncome >= earningsSummary.yesterdayIncome
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}>
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                  {earningsSummary.todayIncome >= earningsSummary.yesterdayIncome
                    ? `+₹${(earningsSummary.todayIncome - earningsSummary.yesterdayIncome).toFixed(2)} vs yesterday`
                    : `₹${earningsSummary.yesterdayIncome.toFixed(2)} yesterday`}
                </span>
              ) : (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {earningsSummary.todayCompletedCount === 0
                    ? '₹0 · No completed rides today'
                    : `${earningsSummary.todayCompletedCount} completed today`}
                </span>
              )}
            </div>
          </div>

          {/* Surge Badge */}
          <div
            className={`px-3 py-1.5 rounded-2xl flex items-center gap-1.5 text-xs font-bold border ${
              isLight
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
            <span>1.4x Surge Area</span>
          </div>
        </div>

        {/* Shift Stats Row */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div
            className={`p-2 rounded-xl border ${
              isLight ? 'bg-slate-100/80 border-slate-200' : 'bg-slate-900/80 border-slate-800'
            }`}
          >
            <span className={`text-[10px] block font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Online Time
            </span>
            <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              {Math.floor(onlineMinutes / 60)}h {onlineMinutes % 60}m
            </span>
          </div>

          <div
            className={`p-2 rounded-xl border ${
              isLight ? 'bg-slate-100/80 border-slate-200' : 'bg-slate-900/80 border-slate-800'
            }`}
          >
            <span className={`text-[10px] block font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Today's Rides
            </span>
            <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              {earningsSummary.todayCompletedCount} {earningsSummary.todayCompletedCount === 1 ? 'ride' : 'rides'}
            </span>
          </div>

          <div
            className={`p-2 rounded-xl border ${
              isLight ? 'bg-slate-100/80 border-slate-200' : 'bg-slate-900/80 border-slate-800'
            }`}
          >
            <span className={`text-[10px] block font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Total Earnings
            </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              ₹{earningsSummary.totalEarnings.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Daily Quest Goal Bar */}
        <div
          className={`p-2.5 rounded-xl border space-y-1 ${
            isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-slate-900/60 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className={`flex items-center gap-1 ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
              <Zap className="w-3 h-3 text-amber-500" />
              Daily Quest: Complete 8 rides for ₹25 bonus
            </span>
            <span className={`font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              {earningsSummary.todayCompletedCount}/8
            </span>
          </div>
          <div className={`w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.min(100, (earningsSummary.todayCompletedCount / 8) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Concurrency / Notification Toast */}
      {concurrencyAlert && (
        <div
          className={`m-3 p-3 rounded-2xl border text-xs flex items-start justify-between gap-2 animate-in slide-in-from-top-2 duration-200 ${
            concurrencyAlert.type === 'error'
              ? isLight
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-rose-500/10 border-rose-500/40 text-rose-300'
              : isLight
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <div className="flex items-start gap-2">
            {concurrencyAlert.type === 'error' ? (
              <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
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
            className={`text-xs px-1 ${isLight ? 'text-slate-400 hover:text-slate-800' : 'text-slate-400 hover:text-white'}`}
          >
            ✕
          </button>
        </div>
      )}

      {/* ================= MAIN VIEW: Active Trip In-Progress vs Incoming Requests ================= */}
      {activeRide ? (
        /* ================= UBER DRIVER ACTIVE TRIP HUD ================= */
        <div id="uber-captain-active-trip" className="p-4 space-y-3.5 flex flex-col animate-in fade-in duration-300">
          {/* Top Service Tier Banner: Moto Courier vs Comfort Moto */}
          {(() => {
            const activeService = getRideServiceInfo(activeRide);
            return (
              <div className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-bold ${activeService.bgBadgeClass}`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{activeService.icon}</span>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wide block">{activeService.badgeLabel} IN PROGRESS</span>
                    <span className="text-[10px] font-medium opacity-90">{activeService.actionInstruction}</span>
                  </div>
                </div>
                <span className="text-[10px] uppercase px-2 py-0.5 rounded font-black bg-slate-950 text-white">
                  {activeRide.status.toUpperCase()}
                </span>
              </div>
            );
          })()}

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

          {/* Passenger Contact Card */}
          <div
            className={`p-3.5 rounded-2xl flex items-center justify-between shadow-md border ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h4 className={`text-xs font-black flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  {activeRide.passenger_name || 'Passenger'}
                  <span className="text-[10px] text-amber-500 font-semibold">★ 4.94</span>
                </h4>
                <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {activeRide.passenger_phone || '+1 (555) 392-1049'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`tel:${activeRide.passenger_phone || '+15553921049'}`}
                className={`p-2.5 rounded-xl border transition-colors ${
                  isLight
                    ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title="Call Passenger"
              >
                <Phone className="w-4 h-4 text-emerald-500" />
              </a>

              <button
                type="button"
                onClick={() => setIsChatOpen(true)}
                className={`p-2.5 rounded-xl border transition-colors relative ${
                  isLight
                    ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title="In-App Chat"
              >
                <MessageSquare className="w-4 h-4 text-sky-500" />
                <span className="w-2 h-2 rounded-full bg-sky-400 absolute top-1 right-1" />
              </button>
            </div>
          </div>

          {/* Trip Addresses */}
          <div
            className={`p-3 rounded-2xl border space-y-2 text-xs ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'
            }`}
          >
            {/* Small Capsule Navigator to Pickup in Google Maps (Left Corner Above Pickup) */}
            {(activeRide.status === 'accepted' || activeRide.status === 'arrived') && (
              <div className="flex items-center justify-start pb-1">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeRide.pickup_location || 'Pickup Location')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="captain-pickup-navigator-capsule"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm transition-all hover:scale-102 active:scale-95 cursor-pointer border border-emerald-400"
                  title="Open Navigation in Google Maps"
                >
                  <Navigation className="w-3 h-3 fill-slate-950 -rotate-45" />
                  <span>Navigate to Pickup</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                </a>
              </div>
            )}

            {/* When trip has started, provide capsule navigator to Destination */}
            {activeRide.status === 'started' && (
              <div className="flex items-center justify-start pb-1">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activeRide.dropoff_location || 'Dropoff Destination')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="captain-dropoff-navigator-capsule"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide uppercase bg-indigo-500 hover:bg-indigo-400 text-white shadow-sm transition-all hover:scale-102 active:scale-95 cursor-pointer border border-indigo-400"
                  title="Open Navigation to Destination in Google Maps"
                >
                  <Navigation className="w-3 h-3 fill-white -rotate-45" />
                  <span>Navigate to Destination</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                </a>
              </div>
            )}

            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className={`text-[9px] uppercase font-bold block ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                  Pickup
                </span>
                <span className={`truncate block font-medium ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                  {activeRide.pickup_location}
                </span>
              </div>
            </div>
            <div className={`flex items-start gap-2 border-t pt-2 ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
              <Navigation className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className={`text-[9px] uppercase font-bold block ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                  Destination
                </span>
                <span className={`truncate block font-medium ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                  {activeRide.dropoff_location}
                </span>
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
              className={`w-full py-2 text-xs font-semibold transition-colors text-center cursor-pointer ${
                isLight ? 'text-slate-500 hover:text-rose-600' : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              Cancel Ride
            </button>
          </div>
        </div>
      ) : (
        /* ================= INCOMING & DECLINED RIDE REQUESTS TABS (INDRIVE / UBER) ================= */
        <div className="p-4 space-y-3">
          {/* Sub-navigation Tabs: Incoming vs Declined */}
          <div className={`flex items-center justify-between border-b pb-2.5 ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
            <div className={`flex items-center gap-1.5 p-1 rounded-2xl border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
            }`}>
              <button
                type="button"
                id="captain-tab-incoming"
                onClick={() => setRequestTab('incoming')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  requestTab === 'incoming'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Incoming</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  requestTab === 'incoming'
                    ? 'bg-slate-950/20 text-slate-950'
                    : isLight
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-slate-800 text-slate-300'
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
                    : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Skipped</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  requestTab === 'declined'
                    ? 'bg-black/30 text-white'
                    : isLight
                    ? 'bg-slate-200 text-slate-700'
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {declinedRides.length}
                </span>
              </button>
            </div>

            {/* Right Controls: Sound Tune ON/OFF Toggle Switch & Skipped History */}
            <div className="flex items-center gap-2">
              {/* Sweet Alert Tune On/Off Switch */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id="captain-toggle-alert-tune-btn"
                  onClick={toggleAlertSound}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer shadow-xs ${
                    isAlertSoundEnabled
                      ? isLight
                        ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
                      : isLight
                      ? 'bg-slate-100 border-slate-300 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                  }`}
                  title={isAlertSoundEnabled ? 'Incoming alert sound is ON (Click to Mute)' : 'Incoming alert sound is MUTED (Click to Turn ON)'}
                >
                  {isAlertSoundEnabled ? (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                      <span className="font-extrabold hidden sm:inline">Sound: ON</span>
                      <span className="font-extrabold sm:hidden">ON</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-3.5 h-3.5" />
                      <span className="font-semibold hidden sm:inline">Sound: OFF</span>
                      <span className="font-semibold sm:hidden">OFF</span>
                    </>
                  )}

                  {/* Toggle Pill Slider */}
                  <div
                    className={`w-7 h-4 rounded-full p-0.5 transition-colors duration-200 flex items-center ${
                      isAlertSoundEnabled ? 'bg-amber-500 justify-end' : 'bg-slate-400 dark:bg-slate-700 justify-start'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full bg-white shadow-xs" />
                  </div>
                </button>

                {/* Quick Test Alert Tune Button */}
                {isAlertSoundEnabled && (
                  <button
                    type="button"
                    onClick={() => playAlertSound(true)}
                    className={`p-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer ${
                      isLight
                        ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300'
                    }`}
                    title="Test incoming alert chime"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                  </button>
                )}
              </div>

              {requestTab === 'declined' && declinedRides.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearDeclined}
                  className={`text-[11px] font-bold transition-colors cursor-pointer ${
                    isLight ? 'text-slate-500 hover:text-rose-600' : 'text-slate-400 hover:text-rose-400'
                  }`}
                >
                  Clear History
                </button>
              )}
            </div>
          </div>

          {!isOnline ? (
            <div
              className={`p-8 text-center rounded-2xl border space-y-2 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <Power className={`w-8 h-8 mx-auto ${isLight ? 'text-slate-400' : 'text-slate-600'}`} />
              <h4 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                You are currently Offline
              </h4>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Go online to start receiving instant ride requests from nearby riders.
              </p>
              <button
                onClick={() => setIsOnline(true)}
                className="mt-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-colors cursor-pointer shadow-md"
              >
                GO ONLINE NOW
              </button>
            </div>
          ) : tableMissingNotice ? (
            <div
              className={`p-6 text-center rounded-2xl border space-y-3 ${
                isLight ? 'bg-amber-50 border-amber-300' : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className={`text-sm font-bold ${isLight ? 'text-amber-800' : 'text-amber-200'}`}>
                Supabase Table Pending
              </h4>
              <p className={`text-xs max-w-sm mx-auto ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                Execute the 1-click SQL script in your Supabase project to activate instant dispatching.
              </p>
              {onOpenSqlModal && (
                <button
                  onClick={onOpenSqlModal}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer"
                >
                  Open SQL Script
                </button>
              )}
            </div>
          ) : requestTab === 'declined' ? (
            /* ================= DECLINED RIDES TAB CONTENT ================= */
            <div className="space-y-3">
              {declinedRides.length === 0 ? (
                <div
                  className={`p-8 text-center rounded-2xl border space-y-3 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800'
                  }`}
                >
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <h4 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                    No Skipped Ride Requests
                  </h4>
                  <p className={`text-xs max-w-xs mx-auto ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    When you skip incoming ride broadcasts, they will be catalogued here for review or reconsideration.
                  </p>
                  <button
                    type="button"
                    onClick={() => setRequestTab('incoming')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      isLight
                        ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5 text-emerald-500" />
                    Back to Incoming ({requestedRides.length})
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className={`flex items-center justify-between text-xs px-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    <span>Skipped trip requests ({declinedRides.length})</span>
                    <span className="text-[10px] text-amber-500 font-medium">Reconsider anytime</span>
                  </div>

                  {declinedRides.map((item) => (
                    <div
                      key={`declined-${item.ride.id}`}
                      id={`declined-ride-${item.ride.id}`}
                      className={`border rounded-2xl p-3.5 space-y-3 shadow-lg transition-all ${
                        isLight
                          ? 'bg-white border-slate-200 hover:border-rose-300 shadow-slate-100'
                          : 'bg-slate-900/90 border-slate-800 hover:border-rose-500/40'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-500 border border-rose-500/30 flex items-center justify-center text-xs font-bold">
                            ✕
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                                {item.ride.passenger_name || 'Passenger'}
                              </h4>
                              <span className="text-[9px] px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-600 dark:text-rose-300 font-bold border border-rose-500/30">
                                {item.reason}
                              </span>
                            </div>
                            <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              Declined at {item.declinedAt} · {item.ride.distance_km || 4.8} km
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-sm font-black block ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                            ₹{item.ride.fare ? Number(item.ride.fare).toFixed(2) : '14.50'}
                          </span>
                        </div>
                      </div>

                      {/* Route points */}
                      <div
                        className={`p-2 rounded-xl border space-y-1 text-xs ${
                          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className={`truncate font-medium ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                            {item.ride.pickup_location}
                          </span>
                        </div>
                        <div className={`flex items-center gap-1.5 border-t pt-1 ${isLight ? 'border-slate-200 text-slate-600' : 'border-slate-900 text-slate-400'}`}>
                          <Navigation className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="truncate">{item.ride.dropoff_location}</span>
                        </div>
                      </div>

                      {/* Actions on Declined Item */}
                      <div className="grid grid-cols-2 gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleRestoreRide(item)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                            isLight
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                          }`}
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-sky-500" />
                          Restore to Stream
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAcceptRide(item.ride)}
                          disabled={isClaimingId === item.ride.id}
                          className="py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
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
            <div
              className={`p-8 text-center rounded-2xl border space-y-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto animate-pulse">
                <Radio className="w-6 h-6" />
              </div>
              <h4 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                Searching in 1.4x Surge Hotspot
              </h4>
              <p className={`text-xs max-w-xs mx-auto ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Waiting for riders. Ride offers will ring with audio alert instantly via Supabase Realtime.
              </p>
              <button
                onClick={loadInitialData}
                className={`flex items-center gap-1.5 text-xs mx-auto pt-1 cursor-pointer transition-colors ${
                  isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-sync Pending List
              </button>
            </div>
          ) : (
            /* ================= INCOMING RIDES ACTIVE STREAM ================= */
            <div className="space-y-3">
              {requestedRides.map((ride) => {
                const serviceInfo = getRideServiceInfo(ride);
                return (
                <div
                  key={ride.id}
                  id={`ride-request-${ride.id}`}
                  className={`border rounded-2xl p-4 space-y-3 shadow-xl transition-all group ${
                    isLight
                      ? 'bg-white border-slate-200 hover:border-emerald-500 shadow-slate-200/50'
                      : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50'
                  }`}
                >
                  {/* TOP SERVICE BADGE: MOTO COURIER or COMFORT MOTO */}
                  <div
                    className={`flex items-center justify-between pb-2.5 border-b ${
                      serviceInfo.isCourier
                        ? 'border-amber-500/20'
                        : isLight
                        ? 'border-slate-100'
                        : 'border-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border flex items-center gap-1.5 shadow-xs ${serviceInfo.bgBadgeClass}`}>
                        <span className="text-xs">{serviceInfo.icon}</span>
                        <span>{serviceInfo.badgeLabel}</span>
                      </span>
                      <span className={`text-[11px] font-bold ${serviceInfo.isCourier ? 'text-amber-600 dark:text-amber-400' : isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                        {serviceInfo.isCourier ? '📦 Parcel & Package Delivery' : '🛵 Passenger Ride'}
                      </span>
                    </div>
                    {serviceInfo.isCourier ? (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
                        📦 CARGO BOX
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        🛵 Helmet Included
                      </span>
                    )}
                  </div>

                  {/* Fare & Passenger Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-base border shadow-xs ${
                          serviceInfo.isCourier
                            ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40'
                            : 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border-sky-500/30'
                        }`}
                      >
                        {serviceInfo.isCourier ? '📦' : '👤'}
                      </div>
                      <div>
                        <h4 className={`text-xs font-black flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                          <span>{serviceInfo.isCourier ? `Sender: ${ride.passenger_name || 'Customer'}` : (ride.passenger_name || 'Passenger Request')}</span>
                          <span className="text-amber-500 text-[10px]">★ 4.94</span>
                        </h4>
                        <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          {ride.distance_km || 4.8} km · ~{ride.estimated_mins || 12} min {serviceInfo.isCourier ? 'delivery' : 'trip'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 block">
                        ₹{ride.fare ? Number(ride.fare).toFixed(2) : '14.50'}
                      </span>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-500/30">
                        0% Commission
                      </span>
                    </div>
                  </div>

                  {/* Route points */}
                  <div
                    className={`p-2.5 rounded-xl border space-y-1.5 text-xs ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] uppercase font-bold text-emerald-600 block">
                          {serviceInfo.isCourier ? 'Package Pickup' : 'Pickup'}
                        </span>
                        <span className={`truncate font-medium block ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                          {ride.pickup_location}
                        </span>
                      </div>
                    </div>
                    <div className={`flex items-start gap-2 border-t pt-1.5 ${isLight ? 'border-slate-200 text-slate-700' : 'border-slate-900 text-slate-300'}`}>
                      <Navigation className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] uppercase font-bold text-rose-500 block">
                          {serviceInfo.isCourier ? 'Delivery Destination' : 'Dropoff'}
                        </span>
                        <span className="truncate font-medium block">{ride.dropoff_location}</span>
                      </div>
                    </div>
                  </div>

                  {/* inDrive / Uber Acceptance, Counter Offer & Decline Bar */}
                  <div className="space-y-2 pt-1">
                    <div className="grid grid-cols-3 gap-2">
                      {/* inDrive Counter Offer 1 */}
                      <button
                        type="button"
                        onClick={() => handleAcceptRide(ride, (ride.fare || 14.5) + 1.0)}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                          isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                      >
                        Offer +₹1
                      </button>

                      {/* inDrive Counter Offer 2 */}
                      <button
                        type="button"
                        onClick={() => handleAcceptRide(ride, (ride.fare || 14.5) + 2.0)}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                          isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                      >
                        Offer +₹2
                      </button>

                      {/* Instant Accept Button (Protected by Atomic Claim RPC) */}
                      <button
                        id={`accept-ride-btn-${ride.id}`}
                        onClick={() => handleAcceptRide(ride)}
                        disabled={isClaimingId === ride.id}
                        className={`py-2.5 font-black rounded-xl text-xs flex items-center justify-center gap-1 shadow-md transition-all cursor-pointer ${
                          serviceInfo.isCourier
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                        }`}
                      >
                        {isClaimingId === ride.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            {serviceInfo.isCourier ? 'Accept Courier' : 'Accept Ride'}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>

                    {/* Skip Request Action */}
                    {decliningRideId === ride.id ? (
                      <div
                        className={`p-2.5 rounded-xl border space-y-2 animate-in fade-in duration-200 ${
                          isLight ? 'bg-rose-50/70 border-rose-300' : 'bg-slate-950 border-rose-500/40'
                        }`}
                      >
                        <div className={`flex items-center justify-between text-[11px] font-bold ${isLight ? 'text-rose-700' : 'text-rose-300'}`}>
                          <span>Select reason to skip:</span>
                          <button
                            type="button"
                            onClick={() => setDecliningRideId(null)}
                            className={`cursor-pointer ${isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'}`}
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
                              className={`p-1.5 rounded-lg border text-left truncate transition-colors cursor-pointer ${
                                isLight
                                  ? 'bg-white hover:bg-rose-100 text-slate-700 hover:text-rose-800 border-slate-200'
                                  : 'bg-slate-900 hover:bg-rose-500/20 text-slate-300 hover:text-rose-200 border-slate-800'
                              }`}
                            >
                              • {reason}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeclineRide(ride, 'Skipped by captain')}
                          className="w-full py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Confirm Skip
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        id={`decline-ride-btn-${ride.id}`}
                        onClick={() => setDecliningRideId(ride.id)}
                        className={`w-full py-2 border rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          isLight
                            ? 'bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border-slate-200 hover:border-rose-300'
                            : 'bg-slate-950/60 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border-slate-800/80 hover:border-rose-500/30'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        Skip
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rate Passenger & Complete Ride Modal */}
      {isRatingPassengerModalOpen && activeRide && (
        <div
          id="captain-rate-passenger-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            className={`w-full max-w-md border rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0f172a] border-slate-800 text-slate-100'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                  <Star className="w-4 h-4 fill-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black">Rate Passenger</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Provide feedback before completing trip
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRatingPassengerModalOpen(false)}
                className={`p-1.5 rounded-full border transition-colors cursor-pointer ${
                  isLight
                    ? 'border-slate-200 hover:bg-slate-100 text-slate-500'
                    : 'border-slate-800 hover:bg-slate-800 text-slate-400'
                }`}
                title="Cancel and return to ride"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Passenger & Fare Card */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/70 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-base shrink-0 shadow-sm">
                  {activeRide.passenger_name ? activeRide.passenger_name.charAt(0).toUpperCase() : 'P'}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-black truncate block">
                    {activeRide.passenger_name || 'Passenger Rider'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                    {activeRide.passenger_phone || '+1 (555) 019-2834'}
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">
                    {activeRide.distance_km || 4.8} km trip completed
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Collect Fare</span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  ₹{activeRide.fare ? Number(activeRide.fare).toFixed(2) : '14.50'}
                </span>
              </div>
            </div>

            {/* Star Rating Section */}
            <div className="text-center space-y-2 py-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                How was your trip with this passenger?
              </span>

              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setPassengerRatingStars(star)}
                    className="p-1.5 transition-transform hover:scale-125 active:scale-95 cursor-pointer focus:outline-none"
                    aria-label={`Rate ${star} star`}
                  >
                    <Star
                      className={`w-7 h-7 transition-colors ${
                        star <= passengerRatingStars
                          ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                          : isLight
                          ? 'text-slate-300 hover:text-amber-300'
                          : 'text-slate-700 hover:text-amber-400'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <span className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {passengerRatingStars === 5 && '⭐⭐⭐⭐⭐ Outstanding Passenger'}
                {passengerRatingStars === 4 && '⭐⭐⭐⭐ Great Experience'}
                {passengerRatingStars === 3 && '⭐⭐⭐ Normal Ride'}
                {passengerRatingStars === 2 && '⭐⭐ Below Average'}
                {passengerRatingStars === 1 && '⭐ Challenging Experience'}
              </span>
            </div>

            {/* Quick Feedback Tags */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                Quick Rider Feedback
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  '⭐ Polite & Respectful',
                  '⏱️ Ready at Pickup',
                  '🛵 Wore Helmet Properly',
                  '💬 Clear Instructions',
                  '💵 Fast Payment',
                  '✨ Friendly Conversation',
                ].map((tag) => {
                  const isSelected = passengerRatingTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleRatingTag(tag)}
                      className={`text-[11px] px-2.5 py-1 rounded-xl border font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-xs'
                          : isLight
                          ? 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Captain Note */}
            <div className="space-y-1">
              <label
                htmlFor="captain-passenger-notes"
                className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block"
              >
                Captain Notes (Optional)
              </label>
              <input
                id="captain-passenger-notes"
                type="text"
                value={passengerRatingNotes}
                onChange={(e) => setPassengerRatingNotes(e.target.value)}
                placeholder="e.g. Excellent passenger, prompt pickup"
                className={`w-full px-3 py-2 text-xs rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                    : 'bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-500'
                }`}
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                id="submit-rating-complete-ride-btn"
                onClick={() => handleCompleteRideWithRating(false)}
                disabled={isUpdatingStatus}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/25 transition-all cursor-pointer hover:scale-[1.01] active:scale-98"
              >
                {isUpdatingStatus ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 stroke-[3]" />
                )}
                Submit Rating & Complete Ride · Collect ₹
                {activeRide.fare ? Number(activeRide.fare).toFixed(2) : '14.50'}
              </button>

              <button
                type="button"
                id="skip-rating-complete-ride-btn"
                onClick={() => handleCompleteRideWithRating(true)}
                disabled={isUpdatingStatus}
                className={`w-full py-2 text-xs font-semibold transition-colors text-center cursor-pointer ${
                  isLight
                    ? 'text-slate-500 hover:text-slate-800'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Skip Rating & Complete Ride
              </button>
            </div>
          </div>
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
        todayIncome={earningsSummary.todayIncome}
        todayEarnings={earningsSummary.todayIncome}
        totalEarnings={earningsSummary.totalEarnings}
        todayRides={earningsSummary.todayRides}
        completedCount={earningsSummary.todayCompletedCount}
      />
    </div>
  );
};
