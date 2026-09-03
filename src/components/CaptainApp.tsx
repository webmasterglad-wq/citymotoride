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
import { Ride, RideStatus, UserProfile, CaptainEarningsSummary, getRideServiceInfo, CaptainOffer, getRidePin } from '../types/ride';
import {
  fetchActiveRequestedRides,
  fetchActiveRideForCaptain,
  claimRideAtomic,
  updateRideStatus,
  subscribeToCaptainRealtime,
  unsubscribeChannel,
  fetchCaptainEarningsSummary,
  getLocalDayBounds,
  submitCaptainOffer,
  cancelCaptainOffer,
  getStoredRideOffers,
  persistOffersToDatabase,
  recordCaptainSkippedRide,
  getCaptainSkippedRideIds,
  unskipCaptainRide,
} from '../services/rideService';
import { isSupabaseConfigured } from '../lib/supabase';
import { InRideChatModal } from './InRideChatModal';
import { CaptainProfileModal } from './CaptainProfileModal';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useTheme } from '../context/ThemeContext';
import { usePricing, DEFAULT_PLATFORM_PRICING } from '../context/PricingContext';
import {
  playSweetAlertTune,
  subscribeToIncomingRideBroadcasts,
  unlockAudio,
  notifyCaptainArrived,
} from '../utils/audioAlert';

interface CaptainAppProps {
  captainUser?: UserProfile;
  titleSuffix?: string;
  onOpenSqlModal?: () => void;
}

interface DeclinedRideItem {
  ride: Ride;
  declinedAt: string;
  reason?: string;
}

export const DEMO_CAPTAINS: UserProfile[] = [
  {
    id: 'b82ac71b-39dd-4172-b567-0e02b2c3d981',
    name: 'Captain Alex Rivera',
    phone: '+1 (555) 749-3021',
    role: 'captain',
    rating: 4.96,
    vehicle_details: 'Yamaha MT-07 · Stealth Black #7492',
    acceptance_rate: 98,
    total_trips: 1420,
  },
  {
    id: 'c93bd82c-40ee-5283-c678-1f13c3d4e092',
    name: 'Captain Marcus Chen',
    phone: '+1 (555) 882-1944',
    role: 'captain',
    rating: 4.92,
    vehicle_details: 'Honda CBR650R · Grand Prix Red #3821',
    acceptance_rate: 96,
    total_trips: 890,
  },
  {
    id: 'd04ce93d-51ff-6394-d789-2024d4e5f103',
    name: 'Captain Sara Vance',
    phone: '+1 (555) 304-9182',
    role: 'captain',
    rating: 4.98,
    vehicle_details: 'KTM 390 Duke · Electric Orange #5103',
    acceptance_rate: 99,
    total_trips: 1640,
  },
];

const getStoredCaptainId = (key = 'motoride_captain_uuid') => {
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : 'b82ac71b-39dd-4172-b567-0e02b2c3d981';
    localStorage.setItem(key, id);
  }
  return id;
};

export const CaptainApp: React.FC<CaptainAppProps> = ({
  captainUser = DEMO_CAPTAINS[0],
  titleSuffix = '',
  onOpenSqlModal,
}) => {
  const { pricing } = usePricing();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [requestedRides, setRequestedRides] = useState<Ride[]>([]);
  const [declinedRides, setDeclinedRides] = useState<DeclinedRideItem[]>([]);
  const [requestTab, setRequestTab] = useState<'incoming' | 'declined'>('incoming');

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

  // Ride PIN Verification State for starting trip
  const [enteredPin, setEnteredPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const pinInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Reset PIN state whenever active ride changes
  useEffect(() => {
    setEnteredPin('');
    setPinVerified(false);
    setPinError(null);
    setIsVerifyingPin(false);
  }, [activeRide?.id]);

  // Incoming Request Sweet Alert Tune On/Off State with localStorage persistence
  const [isAlertSoundEnabled, setIsAlertSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('motoride_captain_alert_sound');
    return saved !== null ? saved === 'true' : true;
  });

  // Track captain's submitted fare offers per rideId
  const [myOffers, setMyOffers] = useState<Record<string, CaptainOffer>>({});

  const requestedRidesRef = useRef<Ride[]>([]);
  const isOnlineRef = useRef<boolean>(isOnline);
  const initialLoadDoneRef = useRef<boolean>(false);
  const currentCaptainRef = useRef<UserProfile>(currentCaptain);

  useEffect(() => {
    if (captainUser) {
      setCurrentCaptain(captainUser);
    }
  }, [captainUser]);

  useEffect(() => {
    currentCaptainRef.current = currentCaptain;
  }, [currentCaptain]);

  useEffect(() => {
    requestedRidesRef.current = requestedRides;
  }, [requestedRides]);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  const toggleAlertSound = () => {
    setIsAlertSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('motoride_captain_alert_sound', String(next));
      if (next) {
        unlockAudio();
        // Play sweet alert tune preview when toggled ON
        playSweetAlertTune(true);
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

  // Play melodic Sweet Alert Tune for incoming requests
  const playAlertSound = (force = false) => {
    if (!isAlertSoundEnabled && !force) return;
    playSweetAlertTune(force);
  };

  // Database-driven earnings fetch for this captain
  const loadEarningsData = async () => {
    const activeCapId = currentCaptainRef.current?.id || currentCaptain.id;
    if (!isSupabaseConfigured() || !activeCapId) return;
    const { data } = await fetchCaptainEarningsSummary(activeCapId);
    if (data) {
      setEarningsSummary(data);
    }
  };

  // Initial fetch & Polling synchronization
  const loadInitialData = async () => {
    if (!isSupabaseConfigured()) return;
    setTableMissingNotice(false);

    const activeCapId = currentCaptainRef.current?.id || currentCaptain.id;

    // 1. Fetch real-time Today's Income & lifetime summary
    loadEarningsData();

    // 2. Check if captain already has an ongoing accepted ride
    const { data: activeData } = await fetchActiveRideForCaptain(activeCapId);
    if (activeData) {
      setActiveRide(activeData);
    }

    // 3. Fetch pending requested rides - exclude rides skipped by this captain
    const { data: pendingData, error } = await fetchActiveRequestedRides();
    if (error) {
      if (error.includes('missing') || error.includes('SQL') || error.includes('schema cache')) {
        setTableMissingNotice(true);
      }
    } else if (pendingData) {
      const skippedSet = getCaptainSkippedRideIds(activeCapId);
      const filteredPending = pendingData.filter((r) => !skippedSet.has(r.id));

      // Check if new incoming requests arrived during polling
      if (initialLoadDoneRef.current && isOnlineRef.current) {
        const prevIds = new Set(requestedRidesRef.current.map((r) => r.id));
        const hasNewIncoming = filteredPending.some((r) => r.status === 'requested' && !prevIds.has(r.id));
        if (hasNewIncoming) {
          playSweetAlertTune();
        }
      }
      initialLoadDoneRef.current = true;
      setRequestedRides(filteredPending);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [currentCaptain.id]);

  // Subscribe to in-app & cross-tab broadcast notifications
  useEffect(() => {
    const unsubBroadcasts = subscribeToIncomingRideBroadcasts((incomingRide: Ride) => {
      if (!isOnlineRef.current) return;
      if (incomingRide && (!incomingRide.status || incomingRide.status === 'requested')) {
        const activeCapId = currentCaptainRef.current?.id || currentCaptain.id;
        const skippedSet = getCaptainSkippedRideIds(activeCapId);
        if (skippedSet.has(incomingRide.id)) return;

        playSweetAlertTune();
        setRequestedRides((prev) => {
          if (prev.some((r) => r.id === incomingRide.id)) {
            return prev;
          }
          return [incomingRide, ...prev];
        });
      }
    });

    return () => unsubBroadcasts();
  }, [currentCaptain.id]);

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
  }, [currentCaptain.id]);

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
          const activeCapId = currentCaptainRef.current?.id || currentCaptain.id;
          const skippedSet = getCaptainSkippedRideIds(activeCapId);
          if (skippedSet.has(newRide.id)) return;

          playSweetAlertTune();
          setRequestedRides((prev) => {
            if (prev.some((r) => r.id === newRide.id)) {
              return prev;
            }
            return [newRide, ...prev];
          });
        }
      },
      onUpdate: (updatedRide: Ride) => {
        const activeCapId = currentCaptainRef.current?.id || currentCaptain.id;
        if (updatedRide.captain_id === activeCapId) {
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
            const skippedSet = getCaptainSkippedRideIds(activeCapId);
            if (skippedSet.has(updatedRide.id)) {
              return prev.filter((r) => r.id !== updatedRide.id);
            }
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
  }, [isOnline, currentCaptain.id]);

  // Sync stored offers for requested rides on load and whenever requestedRides changes
  useEffect(() => {
    const updated: Record<string, CaptainOffer> = {};
    requestedRides.forEach((r) => {
      const offers = getStoredRideOffers(r.id);
      const mine = offers.find((o) => o.captain_id === captainUser.id && o.status !== 'cancelled');
      if (mine) {
        updated[r.id] = mine;
      }
    });
    setMyOffers((prev) => ({ ...prev, ...updated }));
  }, [requestedRides, captainUser.id]);

  // Listen for realtime offer sync and mutual acceptance from passenger
  useEffect(() => {
    const handleOffersSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const activeCapId = currentCaptainRef.current?.id || currentCaptain.id;
      if (detail && detail.rideId && detail.offers) {
        const myOffer = (detail.offers as CaptainOffer[]).find(
          (o) => o.captain_id === activeCapId
        );
        if (myOffer) {
          setMyOffers((prev) => ({ ...prev, [detail.rideId]: myOffer }));
        } else {
          setMyOffers((prev) => {
            const next = { ...prev };
            delete next[detail.rideId];
            return next;
          });
        }
      }
    };

    const handleMutualAccepted = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const activeCapId = currentCaptainRef.current?.id || currentCaptain.id;
      if (detail && detail.captainId === activeCapId) {
        if (detail.ride) {
          setActiveRide(detail.ride);
          setRequestedRides((prev) => prev.filter((r) => r.id !== detail.rideId));
          setDeclinedRides((prev) => prev.filter((d) => d.ride.id !== detail.rideId));
          setConcurrencyAlert({
            type: 'success',
            message: `Mutual acceptance confirmed! Passenger accepted your offer of ₹${Number(detail.fare).toFixed(2)}. Proceed to pickup!`,
          });
          try {
            confetti({ particleCount: 65, spread: 75, origin: { y: 0.6 } });
          } catch (e) {}
        }
      }
    };

    // Also listen to cross-tab BroadcastChannel
    let capBroadcastChannel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        capBroadcastChannel = new BroadcastChannel('motoride_offers_bus');
        capBroadcastChannel.onmessage = (msgEvent: MessageEvent) => {
          const data = msgEvent.data;
          const activeCapId = currentCaptainRef.current?.id || currentCaptain.id;
          if (data && data.type === 'offer_mutually_accepted' && data.captainId === activeCapId) {
            if (data.ride) {
              setActiveRide(data.ride);
              setRequestedRides((prev) => prev.filter((r) => r.id !== data.rideId));
              setDeclinedRides((prev) => prev.filter((d) => d.ride.id !== data.rideId));
              setConcurrencyAlert({
                type: 'success',
                message: `Mutual acceptance confirmed! Passenger accepted your offer of ₹${Number(data.fare).toFixed(2)}. Proceed to pickup!`,
              });
              try {
                confetti({ particleCount: 65, spread: 75, origin: { y: 0.6 } });
              } catch (e) {}
            }
          } else if (data && data.type === 'offers_update' && data.rideId && Array.isArray(data.offers)) {
            const myOffer = (data.offers as CaptainOffer[]).find(
              (o) => o.captain_id === activeCapId
            );
            if (myOffer) {
              setMyOffers((prev) => ({ ...prev, [data.rideId]: myOffer }));
            }
          }
        };
      }
    } catch {}

    window.addEventListener('motoride_offers_sync', handleOffersSync);
    window.addEventListener('motoride_offer_mutually_accepted', handleMutualAccepted);

    return () => {
      window.removeEventListener('motoride_offers_sync', handleOffersSync);
      window.removeEventListener('motoride_offer_mutually_accepted', handleMutualAccepted);
      if (capBroadcastChannel) {
        capBroadcastChannel.close();
      }
    };
  }, [currentCaptain.id]);

  // Handle Captain Sending Fare Offer (Awaiting Passenger Acceptance)
  const handleSendCaptainOffer = async (ride: Ride, fareOffer: number) => {
    setIsClaimingId(ride.id);
    setConcurrencyAlert(null);

    const offer = submitCaptainOffer({
      ride_id: ride.id,
      captain_id: currentCaptain.id,
      captain_name: currentCaptain.name,
      captain_phone: currentCaptain.phone,
      captain_vehicle: currentCaptain.vehicle_details,
      captain_rating: currentCaptain.rating,
      captain_avatar: currentCaptain.avatar_url,
      offered_fare: fareOffer,
      original_fare: Number(ride.fare) || fareOffer,
      eta_minutes: 3,
    });

    setMyOffers((prev) => ({ ...prev, [ride.id]: offer }));

    try {
      await persistOffersToDatabase(ride.id, [
        offer,
        ...getStoredRideOffers(ride.id).filter((o) => o.captain_id !== currentCaptain.id),
      ]);
    } catch {}

    setIsClaimingId(null);

    setConcurrencyAlert({
      type: 'success',
      message: `Offer of ₹${fareOffer} sent to ${ride.passenger_name || 'passenger'}! Waiting for passenger to accept in their dashboard...`,
    });
  };

  // Handle Captain Cancelling Sent Offer
  const handleCancelCaptainOffer = (rideId: string) => {
    cancelCaptainOffer(rideId, currentCaptain.id);
    setMyOffers((prev) => {
      const next = { ...prev };
      delete next[rideId];
      return next;
    });
    setConcurrencyAlert({
      type: 'success',
      message: 'Offer withdrawn. You can select another fare option or skip.',
    });
  };

  // Handle Atomic Claim Ride (Concurrency Protected)
  const handleAcceptRide = async (ride: Ride, customFareOffer?: number) => {
    setIsClaimingId(ride.id);
    setConcurrencyAlert(null);

    const agreedFare = customFareOffer && customFareOffer > 0 ? customFareOffer : (ride.fare || 25);

    const result = await claimRideAtomic(
      ride.id,
      currentCaptain.id,
      {
        name: currentCaptain.name,
        phone: currentCaptain.phone,
        vehicle: currentCaptain.vehicle_details,
        rating: currentCaptain.rating,
      },
      agreedFare
    );

    setIsClaimingId(null);

    if (result.success && result.ride) {
      setActiveRide(result.ride);
      setRequestedRides((prev) => prev.filter((r) => r.id !== ride.id));
      setDeclinedRides((prev) => prev.filter((d) => d.ride.id !== ride.id));
      
      const fareNotice = customFareOffer && customFareOffer !== ride.fare
        ? ` with agreed offer of ₹${Number(customFareOffer).toFixed(2)}`
        : ` (Fare: ₹${Number(agreedFare).toFixed(2)})`;

      setConcurrencyAlert({
        type: 'success',
        message: `Ride accepted${fareNotice}! Proceed to pickup: ${ride.pickup_location}`,
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

  // Handle Captain Skipping an Incoming Ride (No reason prompt, passes to next online captain)
  const handleDeclineRide = (ride: Ride) => {
    const activeCapId = currentCaptainRef.current?.id || currentCaptain.id;
    // 1. Cancel any active fare offer this captain submitted for this ride
    cancelCaptainOffer(ride.id, activeCapId);
    setMyOffers((prev) => {
      const next = { ...prev };
      delete next[ride.id];
      return next;
    });

    // 2. Persist captain's skip so this captain doesn't see it again, but other captains online do
    recordCaptainSkippedRide(ride.id, activeCapId);

    // 3. Move to Skipped tab (no reason shown)
    const newItem: DeclinedRideItem = {
      ride,
      declinedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setDeclinedRides((prev) => [newItem, ...prev.filter((d) => d.ride.id !== ride.id)]);
    setRequestedRides((prev) => prev.filter((r) => r.id !== ride.id));

    // 4. Clean confirmation toast without showing any reason
    setConcurrencyAlert({
      type: 'success',
      message: `Ride request skipped. Passed on to next available online captain.`,
    });
  };

  // Restore a declined ride back to incoming broadcasts
  const handleRestoreRide = (item: DeclinedRideItem) => {
    const activeCapId = currentCaptainRef.current?.id || currentCaptain.id;
    unskipCaptainRide(item.ride.id, activeCapId);
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
    const activeCapId = currentCaptainRef.current?.id || currentCaptain.id;
    declinedRides.forEach((item) => {
      unskipCaptainRide(item.ride.id, activeCapId);
    });
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
          if (nextStatus === 'arrived') {
            notifyCaptainArrived(data);
            setConcurrencyAlert({
              type: 'success',
              message: `Notified ${data.passenger_name || activeRide.passenger_name || 'passenger'} that you have arrived at pickup!`,
            });
          }
        }
      }
    } catch (err: any) {
      setConcurrencyAlert({ type: 'error', message: err?.message || 'Error updating status' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Verify rider PIN and start the trip
  const handleVerifyPinAndStart = async (pinToVerify?: string) => {
    if (!activeRide) return;
    const pin = (pinToVerify !== undefined ? pinToVerify : enteredPin).trim();
    const expectedPin = getRidePin(activeRide.id);

    if (pin.length < 4) {
      setPinError('Please enter all 4 digits of the rider PIN.');
      return;
    }

    if (pin !== expectedPin) {
      setPinError(`Incorrect PIN. Please ask ${activeRide.passenger_name || 'the passenger'} for their 4-digit Ride PIN.`);
      setPinVerified(false);
      return;
    }

    setPinError(null);
    setPinVerified(true);
    setIsVerifyingPin(true);

    try {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    } catch (e) {}

    setConcurrencyAlert({
      type: 'success',
      message: `PIN verified! Starting ride with ${activeRide.passenger_name || 'passenger'}.`,
    });

    await handleProgressRide('started');
    setIsVerifyingPin(false);
  };

  const handlePinDigitChange = (index: number, val: string) => {
    const cleaned = val.replace(/\D/g, '');
    const currentChars = (enteredPin + '    ').slice(0, 4).split('');

    if (!cleaned) {
      currentChars[index] = ' ';
      const updated = currentChars.join('').trimEnd();
      setEnteredPin(updated);
      setPinError(null);
      return;
    }

    const digit = cleaned.slice(-1);
    currentChars[index] = digit;
    const newPin = currentChars.join('').trimEnd();
    setEnteredPin(newPin);
    setPinError(null);

    // Auto advance focus
    if (index < 3 && digit) {
      pinInputsRef.current[index + 1]?.focus();
    }

    // Auto-verify if all 4 digits are present and match
    const fullPin = currentChars.join('');
    if (fullPin.length === 4 && !fullPin.includes(' ') && activeRide) {
      const expectedPin = getRidePin(activeRide.id);
      if (fullPin === expectedPin) {
        handleVerifyPinAndStart(fullPin);
      }
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && (!enteredPin[index] || enteredPin[index] === ' ') && index > 0) {
      pinInputsRef.current[index - 1]?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;
    setEnteredPin(pasted);
    setPinError(null);
    const targetIdx = Math.min(pasted.length - 1, 3);
    pinInputsRef.current[targetIdx]?.focus();
    if (pasted.length === 4 && activeRide) {
      const expected = getRidePin(activeRide.id);
      if (pasted === expected) {
        handleVerifyPinAndStart(pasted);
      }
    }
  };

  const handleClearPin = () => {
    setEnteredPin('');
    setPinError(null);
    setPinVerified(false);
    pinInputsRef.current[0]?.focus();
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

      {/* Online Captain Switcher Bar (Allows testing passing skipped ride to next online captain) */}
      <div
        className={`px-3.5 py-2 border-b flex items-center justify-between text-xs transition-colors ${
          isLight ? 'bg-slate-100/90 border-slate-200' : 'bg-[#090d17] border-slate-800'
        }`}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
          <span>Active Driver:</span>
        </div>
        <div className="flex items-center gap-1.5">
          {DEMO_CAPTAINS.map((cap) => {
            const isCurrent = cap.id === currentCaptain.id;
            return (
              <button
                key={cap.id}
                type="button"
                id={`switch-captain-btn-${cap.id.slice(0, 5)}`}
                onClick={() => {
                  setCurrentCaptain(cap);
                  setActiveRide(null);
                  setDeclinedRides([]);
                  setRequestTab('incoming');
                  setConcurrencyAlert({
                    type: 'success',
                    message: `Switched dashboard to ${cap.name}.`,
                  });
                }}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-black ring-1 ring-amber-400'
                    : isLight
                    ? 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {cap.name.replace('Captain ', '')}
              </button>
            );
          })}
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

          {/* PIN Verification to Start Ride Option */}
          {(activeRide.status === 'accepted' || activeRide.status === 'arrived') && (
            <div
              id="captain-pin-verification-card"
              className={`p-4 rounded-2xl border transition-all space-y-3 ${
                pinError
                  ? isLight
                    ? 'bg-rose-50/70 border-rose-300 shadow-sm'
                    : 'bg-rose-950/20 border-rose-500/40 shadow-sm'
                  : pinVerified
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-300 shadow-sm'
                    : 'bg-emerald-950/20 border-emerald-500/40 shadow-sm'
                  : isLight
                  ? 'bg-gradient-to-b from-amber-50/60 to-slate-50 border-amber-200/90 shadow-sm'
                  : 'bg-gradient-to-b from-amber-950/25 to-slate-900 border-amber-500/30 shadow-md'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                      pinVerified
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {pinVerified ? <Check className="w-5 h-5 stroke-[3]" /> : <KeyRound className="w-4 h-4" />}
                  </div>
                  <div>
                    <h5 className={`text-xs font-black flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      <span>Enter Rider Safety PIN</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase ${
                        activeRide.status === 'arrived'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {activeRide.status === 'arrived' ? 'At Pickup' : 'Ride Accepted'}
                      </span>
                    </h5>
                    <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Ask {activeRide.passenger_name || 'the rider'} for their 4-digit Ride PIN
                    </p>
                  </div>
                </div>

                {/* Clear Input Helper if digits entered */}
                {enteredPin.trim().length > 0 && !pinVerified && (
                  <button
                    type="button"
                    id="captain-clear-pin-btn"
                    onClick={handleClearPin}
                    className={`text-[10px] px-2.5 py-1.5 rounded-xl font-bold border flex items-center gap-1 transition-all cursor-pointer ${
                      isLight
                        ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200 shadow-2xs'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* 4 Digit Boxes */}
              <div className="flex items-center justify-center gap-2.5 py-1">
                {[0, 1, 2, 3].map((idx) => {
                  const digit = enteredPin[idx] || '';
                  return (
                    <input
                      key={idx}
                      ref={(el) => {
                        pinInputsRef.current[idx] = el;
                      }}
                      id={`captain-pin-digit-${idx}`}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      autoComplete="one-time-code"
                      value={digit.trim()}
                      onChange={(e) => handlePinDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(idx, e)}
                      onPaste={handlePinPaste}
                      disabled={isUpdatingStatus || pinVerified}
                      className={`w-12 h-13 text-xl font-mono font-black text-center rounded-xl border transition-all focus:outline-none ${
                        pinError
                          ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                          : pinVerified
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                          : digit.trim()
                          ? isLight
                            ? 'border-emerald-500 bg-emerald-50 text-slate-950 ring-2 ring-emerald-500/20'
                            : 'border-emerald-400 bg-emerald-950/30 text-emerald-300 ring-2 ring-emerald-400/20'
                          : isLight
                          ? 'border-slate-300 bg-white text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                          : 'border-slate-700 bg-slate-950 text-slate-100 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20'
                      }`}
                      placeholder="•"
                    />
                  );
                })}
              </div>

              {/* Error or Verified Status */}
              {pinError && (
                <div className="flex items-center justify-between gap-1.5 px-1 text-rose-500 text-[11px] font-bold animate-in fade-in duration-200">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{pinError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearPin}
                    className="text-[10px] underline hover:text-rose-400 shrink-0 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}

              {pinVerified && (
                <div className="flex items-center gap-1.5 px-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold animate-in fade-in duration-200">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>PIN verified successfully! Starting trip...</span>
                </div>
              )}

              {/* Verify & Start Ride Button */}
              <button
                id="captain-verify-start-trip-btn"
                type="button"
                onClick={() => handleVerifyPinAndStart()}
                disabled={isUpdatingStatus || isVerifyingPin || enteredPin.trim().length < 4}
                className={`w-full py-3.5 px-4 font-black rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all transform active:scale-[0.99] ${
                  enteredPin.trim().length === 4 && !pinError
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/25 cursor-pointer font-black'
                    : isLight
                    ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed shadow-none'
                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed shadow-none'
                }`}
              >
                {isUpdatingStatus || isVerifyingPin ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying & Starting Trip...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>{enteredPin.trim().length === 4 ? 'Verify PIN & Start Ride' : 'Enter 4-Digit PIN to Start'}</span>
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Tactile Action Slider / Buttons */}
          <div className="space-y-2 pt-1">
            {activeRide.status === 'accepted' && (
              <button
                id="uber-driver-arrived-btn"
                onClick={() => handleProgressRide('arrived')}
                disabled={isUpdatingStatus}
                className="w-full py-3.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-sky-500/20 transition-all cursor-pointer"
              >
                {isUpdatingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                I Have Arrived at Pickup Spot
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
                              <span className="text-[9px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30">
                                Passed to Next Captain
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

                  {/* 3 Acceptance Fare Price Options (Connected to Admin Dynamic Pricing) */}
                  {(() => {
                    const existingOffer = myOffers[ride.id];
                    if (existingOffer && existingOffer.status === 'pending') {
                      return (
                        <div className="pt-2 space-y-2.5">
                          <div className={`p-3 rounded-2xl border ${
                            isLight ? 'bg-amber-50/90 border-amber-300 text-amber-950' : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                </span>
                                <span className="text-xs font-black">
                                  Offer Sent: ₹{existingOffer.offered_fare}
                                </span>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                Awaiting Passenger
                              </span>
                            </div>
                            <p className={`text-[11px] mt-1.5 leading-snug ${isLight ? 'text-amber-800' : 'text-amber-300/90'}`}>
                              Waiting for {ride.passenger_name || 'Passenger'} to accept your offer in passenger dashboard. Ride starts upon mutual acceptance.
                            </p>
                          </div>

                          <button
                            type="button"
                            id={`cancel-offer-btn-${ride.id}`}
                            onClick={() => handleCancelCaptainOffer(ride.id)}
                            className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isLight
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                            }`}
                          >
                            <X className="w-3.5 h-3.5 text-rose-500" />
                            <span>Cancel / Change Offer</span>
                          </button>
                        </div>
                      );
                    }

                    if (existingOffer && existingOffer.status === 'declined') {
                      return (
                        <div className="pt-2 space-y-2">
                          <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                            isLight ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                          }`}>
                            <div className="flex items-center gap-1.5">
                              <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                              <span>Passenger declined offer of ₹{existingOffer.offered_fare}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCancelCaptainOffer(ride.id)}
                              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-rose-500 text-white hover:bg-rose-600 cursor-pointer shadow-xs"
                            >
                              Propose New Fare
                            </button>
                          </div>
                        </div>
                      );
                    }

                    const bidding = pricing?.biddingConfig || DEFAULT_PLATFORM_PRICING.biddingConfig;
                    const baseFare = Number(ride.fare || 25.0);
                    
                    // Option 1: Base Fare
                    const t1Percent = bidding.tier1Percent ?? 0;
                    const rawT1 = baseFare * (1 + t1Percent / 100);
                    const t1Fare = bidding.roundToWholeRupee ? Math.round(rawT1) : Number(rawT1.toFixed(2));
                    
                    // Option 2: Tier 2 Fare
                    const t2Percent = bidding.tier2Percent ?? 10;
                    const rawT2 = baseFare * (1 + t2Percent / 100);
                    const t2Fare = bidding.roundToWholeRupee ? Math.round(rawT2) : Number(rawT2.toFixed(2));
                    
                    // Option 3: Tier 3 Fare
                    const t3Percent = bidding.tier3Percent ?? 15;
                    const rawT3 = baseFare * (1 + t3Percent / 100);
                    const t3Fare = bidding.roundToWholeRupee ? Math.round(rawT3) : Number(rawT3.toFixed(2));

                    return (
                      <div className="pt-2 space-y-2">
                        {/* 1. First show: Accept for ₹{t1Fare} */}
                        <button
                          id={`accept-offer-form1-${ride.id}`}
                          type="button"
                          onClick={() => handleSendCaptainOffer(ride, t1Fare)}
                          disabled={isClaimingId === ride.id}
                          className={`w-full py-3 px-4 rounded-2xl text-sm font-black border transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98 ${
                            isLight
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-emerald-600/20'
                              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400 shadow-emerald-500/20'
                          }`}
                        >
                          {isClaimingId === ride.id ? (
                            <Loader2 className="w-5 h-5 animate-spin my-0.5" />
                          ) : (
                            <span className="flex items-center gap-2 tracking-tight font-black">
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>Accept for ₹{t1Fare}</span>
                            </span>
                          )}
                        </button>

                        {/* 2. Offer your fare label */}
                        <div className="flex items-center gap-2 pt-1">
                          <div className={`h-px flex-1 ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
                          <span className={`text-[11px] font-bold tracking-tight uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            Offer your fare
                          </span>
                          <div className={`h-px flex-1 ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
                        </div>

                        {/* 3. Offer Fare buttons: ₹110      ₹115 */}
                        <div className="grid grid-cols-2 gap-2.5">
                          {/* Fare 2 */}
                          <button
                            id={`accept-offer-form2-${ride.id}`}
                            type="button"
                            onClick={() => handleSendCaptainOffer(ride, t2Fare)}
                            disabled={isClaimingId === ride.id}
                            className={`py-3 px-3 rounded-2xl text-base font-black font-mono border transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95 ${
                              isLight
                                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-500 shadow-amber-500/20'
                                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-amber-500/20'
                            }`}
                          >
                            {isClaimingId === ride.id ? (
                              <Loader2 className="w-4 h-4 animate-spin my-0.5" />
                            ) : (
                              <span>₹{t2Fare}</span>
                            )}
                          </button>

                          {/* Fare 3 */}
                          <button
                            id={`accept-offer-form3-${ride.id}`}
                            type="button"
                            onClick={() => handleSendCaptainOffer(ride, t3Fare)}
                            disabled={isClaimingId === ride.id}
                            className={`py-3 px-3 rounded-2xl text-base font-black font-mono border transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95 ${
                              isLight
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 shadow-indigo-600/20'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-indigo-600/20'
                            }`}
                          >
                            {isClaimingId === ride.id ? (
                              <Loader2 className="w-4 h-4 animate-spin my-0.5" />
                            ) : (
                              <span>₹{t3Fare}</span>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                    {/* Skip Request Action - 1-click direct skip, reason hidden, passes to next online captain */}
                    <button
                      type="button"
                      id={`decline-ride-btn-${ride.id}`}
                      onClick={() => handleDeclineRide(ride)}
                      className={`w-full py-2.5 border rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-98 ${
                        isLight
                          ? 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border-slate-300 hover:border-rose-300'
                          : 'bg-slate-800/80 hover:bg-rose-500/15 text-slate-300 hover:text-rose-300 border-slate-700 hover:border-rose-500/40'
                      }`}
                    >
                      <XCircle className="w-4 h-4 text-rose-500" />
                      <span>Skip Request</span>
                    </button>
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
