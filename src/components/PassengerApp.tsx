import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin,
  Navigation,
  DollarSign,
  Clock,
  Phone,
  MessageSquare,
  Star,
  CheckCircle2,
  AlertCircle,
  XCircle,
  X,
  Loader2,
  Compass,
  Bike,
  Shield,
  ArrowRight,
  Search,
  Plus,
  Minus,
  CreditCard,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Radio,
  SlidersHorizontal,
  Flame,
  KeyRound,
  Share2,
  User,
  Calculator,
  ArrowUpDown,
  TrendingUp,
  QrCode,
  Banknote,
  Settings,
  Bell,
  Sparkles,
  Zap,
  ExternalLink,
  Route,
  Globe,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  playSweetAlertTune,
  playCaptainArrivedChime,
  subscribeToCaptainArrivedBroadcasts,
} from '../utils/audioAlert';
import { Ride, RideStatus, UserProfile, RideTier, PaymentMethodType, getRideServiceInfo, CaptainOffer, getRidePin } from '../types/ride';
import {
  createRideBooking,
  fetchActiveRideForPassenger,
  fetchLatestRideForPassenger,
  fetchRideById,
  submitPassengerRatingForRide,
  updateRideStatus,
  updateRideFare,
  subscribeToPassengerRide,
  unsubscribeChannel,
  subscribeToRideOffers,
  getStoredRideOffers,
  extractOffersFromRide,
  acceptCaptainOffer,
  declineCaptainOffer,
  subscribeToCaptainSkipEvents,
  getStoredRideData,
  setStoredRideData,
} from '../services/rideService';
import { subscribeToUnreadCount, markMessagesAsRead } from '../services/chatService';
import { ChatMessage } from '../types/ride';
import { isSupabaseConfigured } from '../lib/supabase';
import { InRideChatModal } from './InRideChatModal';
import { SafetyToolkitModal } from './SafetyToolkitModal';
import { PassengerProfileModal } from './PassengerProfileModal';
import { FareCalculatorModal } from './FareCalculatorModal';
import { FareBreakdown, calculateEstimatedRoute, calculateMotoFare } from '../utils/fareCalculator';
import { RealtimeChannel } from '@supabase/supabase-js';
import { InDriveTimelineBar } from './InDriveTimelineBar';
import { SERVICE_ZONES, ServiceZone, detectZoneForLocation, resolveLocationCoords, strictResolveLocationCoords, LatLng } from '../utils/geoUtils';
import { useTheme } from '../context/ThemeContext';
import { usePricing } from '../context/PricingContext';
import { useAuth } from '../context/AuthContext';
import { GoogleLocationSearchInput } from './GoogleLocationSearchInput';
import { GoogleMapBackground } from './GoogleMapBackground';
import { usePassengerLiveGPS } from '../hooks/usePassengerLiveGPS';

interface PassengerAppProps {
  passengerUser?: UserProfile;
  onOpenSqlModal?: () => void;
}

const getStoredPassengerId = () => {
  let id = localStorage.getItem('motoride_passenger_uuid');
  if (!id || id.startsWith('pass-')) {
    const generateUUID = (): string => {
      if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
    id = generateUUID();
    localStorage.setItem('motoride_passenger_uuid', id);
  }
  return id;
};

const DEFAULT_PICKUPS = [
  'Sector 17 Plaza, Chandigarh',
  'Phase 7 Market & Food Court, Mohali',
  'VIP Road Shopping Plaza, Zirakpur',
  'Sector 5 Major Town Park & Market, Panchkula',
  'Kharar Bus Stand & Flyover, Kharar',
  'Modern Housing Complex (MHC), Manimajra',
];

const DEFAULT_DROPOFFS = [
  'Elante Mall, Industrial Area Phase 1',
  'Bestech Square Mall, Sector 66',
  'Cosmo Mall & Ambala Highway, Zirakpur',
  'Sector 20 Market & HUDA Complex, Panchkula',
  'Chandigarh University (CU) Main Gate, Gharuan-Kharar',
  'Fun Republic Mall & Multiplex, Manimajra',
];

const RIDE_TIERS: RideTier[] = [
  {
    id: 'moto_comfort',
    name: 'Comfort Moto Ride',
    tagline: 'Comfort bike • Clean helmet included',
    multiplier: 1.0,
    icon: '🛵',
    etaMinsBonus: 0,
    popular: true,
  },
  {
    id: 'moto_delivery',
    name: 'Moto Courier',
    tagline: 'Package & parcel courier',
    multiplier: 0.85,
    icon: '📦',
    etaMinsBonus: 1,
  },
];

export const PassengerApp: React.FC<PassengerAppProps> = ({
  passengerUser = {
    id: getStoredPassengerId(),
    name: 'Rider',
    phone: '',
    role: 'passenger',
    rating: 5.0,
  },
  onOpenSqlModal,
}) => {
  const [pickup, setPickup] = useState<string>('');
  const [dropoff, setDropoff] = useState<string>('');
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<LatLng | null>(null);

  // Real-Time Live GPS Tracker
  const liveGPS = usePassengerLiveGPS(pickupCoords);

  const handleUseLiveLocationAsPickup = (coords?: LatLng, address?: string) => {
    const targetCoords = coords || liveGPS.coords;
    const targetAddress =
      address ||
      (liveGPS.nearestLandmark
        ? `${liveGPS.nearestLandmark} (Current Location)`
        : `Current Location (${targetCoords.lat.toFixed(4)}, ${targetCoords.lng.toFixed(4)})`);
    setPickupCoords(targetCoords);
    setPickup(targetAddress);
  };
  const [selectedTier, setSelectedTier] = useState<string>('moto_comfort');
  const [bookingMode] = useState<'indrive'>('indrive');
  const [customBidFare, setCustomBidFare] = useState<number>(0);
  const [customBidInput, setCustomBidInput] = useState<string>('');
  const [hasUserModifiedBid, setHasUserModifiedBid] = useState<boolean>(false);
  const [passengerNotes, setPassengerNotes] = useState<string>('');
  const [isCommentBoxOpen, setIsCommentBoxOpen] = useState<boolean>(false);
  const [isRaisingFare, setIsRaisingFare] = useState<boolean>(false);
  const [raiseFareSuccess, setRaiseFareSuccess] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('upi');
  const [skipNotice, setSkipNotice] = useState<string | null>(null);

  // Distance & Fare Calculator State
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [estimatedMins, setEstimatedMins] = useState<number>(0);
  const [baseCalculatedFare, setBaseCalculatedFare] = useState<number>(0);
  const [isAccurateRoute, setIsAccurateRoute] = useState<boolean>(false);
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState<boolean>(false);
  const [fareBreakdown, setFareBreakdown] = useState<FareBreakdown>(() => {
    return calculateMotoFare({
      distanceKm: 0,
      estimatedMins: 0,
      tierId: 'moto_comfort',
      tierMultiplier: 1.0,
      tierName: 'Comfort Ride',
      pickupLocation: '',
    });
  });

  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [previousRide, setPreviousRide] = useState<Ride | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile>(passengerUser);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<string>('idle');
  const [captainArrivedNotice, setCaptainArrivedNotice] = useState<{ captainName: string; time: string } | null>(null);

  const { isLight } = useTheme();
  const { pricing, calculateFare } = usePricing();
  const { updateUser } = useAuth();
  const activeTierConfig = selectedTier === 'moto_delivery' ? pricing.tierPricing.moto_delivery : pricing.tierPricing.moto_comfort;

  useEffect(() => {
    if (passengerUser) {
      setCurrentUser((prev) => ({
        ...prev,
        ...passengerUser,
        email: passengerUser.email || prev.email,
      }));
    }
  }, [passengerUser]);

  // Captain Offers State for Mutual Bidding Acceptance
  const [captainOffers, setCaptainOffers] = useState<CaptainOffer[]>([]);
  const [isAcceptingOfferId, setIsAcceptingOfferId] = useState<string | null>(null);

  // Modals & Post-Ride Feedback
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [latestCaptainMsg, setLatestCaptainMsg] = useState<ChatMessage | null>(null);

  // Subscribe to real-time chat updates & unread alerts for active ride
  useEffect(() => {
    if (!activeRide?.id) {
      setUnreadChatCount(0);
      setLatestCaptainMsg(null);
      return;
    }

    const unsubscribe = subscribeToUnreadCount(activeRide.id, 'passenger', (count, latest) => {
      setUnreadChatCount(count);
      if (latest) {
        setLatestCaptainMsg(latest);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeRide?.id]);
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);
  const [isWindowCollapsed, setIsWindowCollapsed] = useState<boolean>(false);
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Safe Driving', 'Clean Helmet']);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const activeRideRef = useRef<Ride | null>(null);

  useEffect(() => {
    activeRideRef.current = activeRide;
  }, [activeRide]);

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Recalculate estimated route and fare whenever pickup, dropoff, selectedTier or admin pricing changes
  useEffect(() => {
    if (!pickup.trim() || !dropoff.trim()) {
      setDistanceKm(0);
      setEstimatedMins(0);
      setBaseCalculatedFare(0);
      setCustomBidFare(0);
      setCustomBidInput('');
      setHasUserModifiedBid(false);
      setIsAccurateRoute(false);
      return;
    }

    const route = calculateEstimatedRoute(pickupCoords || pickup, dropoffCoords || dropoff);
    const tierObj = RIDE_TIERS.find((t) => t.id === selectedTier) || RIDE_TIERS[0];
    
    setDistanceKm(route.distanceKm);
    setEstimatedMins(route.estimatedMins + (tierObj.etaMinsBonus || 0));

    const breakdown = calculateFare({
      distanceKm: route.distanceKm,
      estimatedMins: route.estimatedMins + (tierObj.etaMinsBonus || 0),
      tierId: tierObj.id,
      tierMultiplier: tierObj.multiplier,
      tierName: tierObj.name,
      pickupLocation: pickup,
      isAccurateRoute: false,
    });

    setFareBreakdown(breakdown);
    setBaseCalculatedFare(breakdown.totalFare);
    if (!hasUserModifiedBid || customBidFare <= 0) {
      setCustomBidFare(breakdown.totalFare);
      setCustomBidInput(breakdown.totalFare.toFixed(0));
    }
  }, [pickup, dropoff, pickupCoords, dropoffCoords, selectedTier, pricing, hasUserModifiedBid]);

  // Handler when map directions engine computes precise road route
  const handleRouteCalculated = (newDistKm: number, newDurMins: number) => {
    if (newDistKm <= 0 || !pickup.trim() || !dropoff.trim()) return;
    const tierObj = RIDE_TIERS.find((t) => t.id === selectedTier) || RIDE_TIERS[0];
    
    setDistanceKm(newDistKm);
    setEstimatedMins(newDurMins + (tierObj.etaMinsBonus || 0));
    setIsAccurateRoute(true);

    const breakdown = calculateFare({
      distanceKm: newDistKm,
      estimatedMins: newDurMins + (tierObj.etaMinsBonus || 0),
      tierId: tierObj.id,
      tierMultiplier: tierObj.multiplier,
      tierName: tierObj.name,
      pickupLocation: pickup,
      isAccurateRoute: true,
    });

    setFareBreakdown(breakdown);
    setBaseCalculatedFare(breakdown.totalFare);
    // Keep custom inDrive bid updated if user hasn't customized it
    if (!hasUserModifiedBid || customBidFare <= 0) {
      setCustomBidFare(breakdown.totalFare);
      setCustomBidInput(breakdown.totalFare.toFixed(0));
    }
  };

  // Swap pickup and dropoff locations
  const handleSwapLocations = () => {
    const currentPick = pickup;
    const currentPickCoords = pickupCoords;
    setPickup(dropoff);
    setPickupCoords(dropoffCoords);
    setDropoff(currentPick);
    setDropoffCoords(currentPickCoords);
  };



  // Load existing active ride on mount
  useEffect(() => {
    let isMounted = true;
    const loadInitialRide = async () => {
      const { data } = await fetchActiveRideForPassenger(passengerUser.id);
      if (isMounted && data) {
        setActiveRide(data);
      }
      
      if (isMounted) {
        // Also check if the latest ride was completed recently and not yet rated
        const { data: latest } = await fetchLatestRideForPassenger(passengerUser.id);
        if (latest) {
          setPreviousRide(latest);
          if (latest.status === 'completed') {
            const isRated = localStorage.getItem(`motoride_rating_${latest.id}`);
            if (!isRated) {
              setActiveRide(latest);
            }
          }
        }
      }
    };
    loadInitialRide();
    return () => {
      isMounted = false;
    };
  }, [passengerUser.id]);



  // Realtime Subscription & Polling Fallback
  useEffect(() => {
    if (!activeRide?.id || activeRide.status === 'completed' || activeRide.status === 'cancelled') {
      if (channelRef.current) {
        unsubscribeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    const currentActiveRideId = activeRide.id;

    const channel = subscribeToPassengerRide(currentActiveRideId, {
      onUpdate: (updatedRide) => {
        setActiveRide(updatedRide);

        // Realtime detection of incoming captain offers
        const incomingOffers = extractOffersFromRide(updatedRide);
        if (incomingOffers.length > 0) {
          setCaptainOffers(incomingOffers);
        }

        if (updatedRide.status === 'accepted' && activeRide.status === 'requested') {
          try {
            confetti({ particleCount: 45, spread: 60, origin: { y: 0.6 } });
          } catch (e) {}
        } else if (updatedRide.status === 'arrived' && activeRide.status !== 'arrived') {
          playCaptainArrivedChime();
          setCaptainArrivedNotice({
            captainName: updatedRide.captain_name || 'Your Captain',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          });
        } else if (updatedRide.status === 'completed') {
          try {
            confetti({ particleCount: 90, spread: 100, origin: { y: 0.5 } });
          } catch (e) {}
        }
      },
      onStatusChange: (status) => {
        setRealtimeStatus(status);
      },
    });

    channelRef.current = channel;

    // Fast polling fallback: Poll this exact ride ID to catch status transitions instantly
    const pollInterval = setInterval(async () => {
      const current = activeRideRef.current;
      const cached = getStoredRideData(currentActiveRideId);
      const res = await fetchRideById(currentActiveRideId);
      const data = res.data;
      const latest: Ride | null = (cached && cached.status === 'arrived' && data?.status !== 'arrived')
        ? ({ ...(data || {}), ...cached, id: currentActiveRideId } as Ride)
        : ((data || (cached ? { ...cached, id: currentActiveRideId } : null)) as Ride | null);

      if (latest && current) {
        if (latest.status !== current.status) {
          if (latest.status === 'arrived' && current.status !== 'arrived') {
            playCaptainArrivedChime();
            setCaptainArrivedNotice({
              captainName: latest.captain_name || current.captain_name || 'Your Captain',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            });
          }
          setActiveRide(latest);
          activeRideRef.current = latest;
          if (latest.status === 'completed') {
            try {
              confetti({ particleCount: 90, spread: 100, origin: { y: 0.5 } });
            } catch (e) {}
          }
        }

        // Also sync captain offers using extractOffersFromRide
        const offers = extractOffersFromRide(latest);
        if (offers.length > 0) {
          setCaptainOffers(offers);
        } else {
          const stored = getStoredRideOffers(currentActiveRideId);
          if (stored.length > 0) {
            setCaptainOffers(stored);
          }
        }
      }
    }, 1200);

    return () => {
      clearInterval(pollInterval);
      if (channelRef.current) {
        unsubscribeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [activeRide?.id, activeRide?.status, passengerUser?.id]);

  const prevOffersCountRef = useRef(0);

  // Subscribe to Captain Offers when activeRide is requested (Mutual Acceptance Flow)
  useEffect(() => {
    if (!activeRide?.id || activeRide.status !== 'requested') {
      setCaptainOffers([]);
      prevOffersCountRef.current = 0;
      return;
    }

    const unsubscribe = subscribeToRideOffers(activeRide.id, (offers) => {
      const pendingCount = offers.filter((o) => o.status === 'pending').length;
      if (pendingCount > prevOffersCountRef.current) {
        try {
          playSweetAlertTune();
        } catch {}
      }
      prevOffersCountRef.current = pendingCount;
      setCaptainOffers(offers);
    });

    return () => {
      unsubscribe();
    };
  }, [activeRide?.id, activeRide?.status]);

  // Subscribe to Captain Skip events when activeRide is requested
  useEffect(() => {
    if (!activeRide?.id || activeRide.status !== 'requested') {
      setSkipNotice(null);
      return;
    }

    const unsubSkip = subscribeToCaptainSkipEvents((eventData) => {
      if (eventData.rideId === activeRide.id) {
        setSkipNotice('A nearby captain passed · Routing request to next available online captain...');
        const timer = setTimeout(() => {
          setSkipNotice(null);
        }, 6000);
        return () => clearTimeout(timer);
      }
    });

    return () => {
      unsubSkip();
    };
  }, [activeRide?.id, activeRide?.status]);

  // Subscribe to Captain Arrived broadcast alerts across tabs / simulator
  useEffect(() => {
    const handleIncomingArrivalOrStatus = (incoming: any) => {
      if (!incoming) return;
      const current = activeRideRef.current;
      const storedLastId = typeof window !== 'undefined' ? localStorage.getItem('motoride_last_passenger_ride_id') : null;
      const targetId = current?.id || storedLastId;
      const incomingId = incoming.id || incoming.rideId;

      // Allow match if same ID, or if we have an active ride and incoming is an arrival broadcast
      const isMatch = (targetId && incomingId && String(targetId).trim() === String(incomingId).trim())
        || (targetId && !incomingId)
        || (!targetId && incomingId);

      if (!isMatch) return;

      const incomingStatus = incoming.status || (incoming.type === 'CAPTAIN_ARRIVED_BROADCAST' ? 'arrived' : undefined);
      if (!incomingStatus) return;

      const prevStatus = current?.status;

      setActiveRide((prev) => {
        const base = prev || current || (targetId ? getStoredRideData(targetId) : null) || ({} as Ride);
        const updated: Ride = {
          ...base,
          ...(incoming.ride || incoming),
          id: base.id || incomingId || targetId || '',
          status: incomingStatus as any,
          captain_name: incoming.captain_name || incoming.ride?.captain_name || base.captain_name || 'Captain Driver',
          captain_phone: incoming.captain_phone || incoming.ride?.captain_phone || base.captain_phone || '',
          captain_vehicle: incoming.captain_vehicle || incoming.ride?.captain_vehicle || base.captain_vehicle || 'Motorcycle',
          captain_rating: incoming.captain_rating || incoming.ride?.captain_rating || base.captain_rating || 5.0,
        };
        activeRideRef.current = updated;
        if (updated.id) {
          setStoredRideData(updated.id, updated);
          try {
            localStorage.setItem('motoride_last_passenger_ride_id', updated.id);
          } catch {}
        }
        return updated;
      });

      if (incomingStatus === 'arrived' && prevStatus !== 'arrived') {
        playCaptainArrivedChime();
        setCaptainArrivedNotice({
          captainName: incoming.captain_name || incoming.ride?.captain_name || current?.captain_name || 'Your Captain',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      } else if (incomingStatus === 'completed' && prevStatus !== 'completed') {
        setReviewSubmitted(false);
        try {
          confetti({ particleCount: 90, spread: 100, origin: { y: 0.5 } });
        } catch (e) {}
      } else if (incomingStatus === 'accepted' && prevStatus === 'requested') {
        try {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        } catch (e) {}
      }
    };

    // 1. AudioAlert subscription (covers custom event, broadcast channel, and storage)
    const unsubArrived = subscribeToCaptainArrivedBroadcasts((arrivedRide) => {
      handleIncomingArrivalOrStatus(arrivedRide);
    });

    // 2. Direct BroadcastChannel on motoride_offers_bus
    let passBroadcastChannel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        passBroadcastChannel = new BroadcastChannel('motoride_offers_bus');
        passBroadcastChannel.onmessage = (msgEvent: MessageEvent) => {
          const data = msgEvent.data;
          if (data && (data.type === 'ride_status_updated' || data.status)) {
            handleIncomingArrivalOrStatus(data.ride || data);
          }
        };
      }
    } catch {}

    // 3. Direct CustomEvent for motoride_ride_status_updated
    const handleStatusUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        handleIncomingArrivalOrStatus(detail.ride || detail);
      }
    };
    window.addEventListener('motoride_ride_status_updated', handleStatusUpdate);

    // 4. Direct CustomEvent for motoride:captain_arrived
    const handleCaptainArrivedEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        handleIncomingArrivalOrStatus({ ...(detail.ride || detail), status: 'arrived' });
      }
    };
    window.addEventListener('motoride:captain_arrived', handleCaptainArrivedEvent);

    // 5. Direct StorageEvent for cross-tab updates
    const handleStorage = (e: StorageEvent) => {
      if ((e.key === 'motoride_last_arrived_event' || e.key === 'motoride_last_status_event') && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          handleIncomingArrivalOrStatus(parsed.ride || parsed);
        } catch {}
      } else if (e.key && e.key.startsWith('motoride_active_ride_') && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.status === 'arrived') {
            handleIncomingArrivalOrStatus(parsed);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // 6. Fast local poll every 700ms to catch any arrival that occurred in localStorage
    const statusWatchInterval = setInterval(() => {
      const current = activeRideRef.current;
      const targetId = current?.id || (typeof window !== 'undefined' ? localStorage.getItem('motoride_last_passenger_ride_id') : null);
      if (targetId) {
        const cached = getStoredRideData(targetId);
        if (cached && cached.status === 'arrived' && current?.status !== 'arrived') {
          handleIncomingArrivalOrStatus(cached);
        }
      }
    }, 700);

    return () => {
      unsubArrived();
      if (passBroadcastChannel) {
        try { passBroadcastChannel.close(); } catch {}
      }
      window.removeEventListener('motoride_ride_status_updated', handleStatusUpdate);
      window.removeEventListener('motoride:captain_arrived', handleCaptainArrivedEvent);
      window.removeEventListener('storage', handleStorage);
      clearInterval(statusWatchInterval);
    };
  }, []);

  // Passenger Accepts Captain's Offer - Establishes Mutual Acceptance
  const handleAcceptCaptainOffer = async (offer: CaptainOffer) => {
    if (!activeRide) return;
    setIsAcceptingOfferId(offer.id);
    setErrorMessage(null);

    try {
      const result = await acceptCaptainOffer(activeRide, offer);
      if (result.success && result.ride) {
        setActiveRide(result.ride);
        try {
          confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
        } catch (e) {}
      } else {
        setErrorMessage(result.message || 'Could not accept this offer. The ride or offer may no longer be available.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error accepting offer. Please try again.');
    } finally {
      setIsAcceptingOfferId(null);
    }
  };

  // Passenger Declines Captain's Offer
  const handleDeclineCaptainOffer = (captainId: string) => {
    if (!activeRide) return;
    declineCaptainOffer(activeRide.id, captainId);
  };

  // Handle inDrive 25s offer expiration
  const handleOfferTimeout = (offer: CaptainOffer) => {
    if (!activeRide) return;
    // Don't expire if user is currently accepting
    if (isAcceptingOfferId === offer.id) return;
    declineCaptainOffer(activeRide.id, offer.captain_id);
    setSkipNotice(
      `Offer of ₹${offer.offered_fare} from ${offer.captain_name || 'Captain'} expired (25s). Waiting for other nearby captains...`
    );
    setTimeout(() => {
      setSkipNotice((prev) => (prev?.includes(offer.offered_fare.toString()) ? null : prev));
    }, 5000);
  };

  // Safety PIN generated per ride ID
  const safetyPin = getRidePin(activeRide?.id);

  const minAllowedFare = Math.max(10, activeTierConfig.minimumFare || 10);

  const handleCustomBidInputChange = (val: string) => {
    setCustomBidInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setCustomBidFare(num);
      setHasUserModifiedBid(true);
    }
  };

  const handleCustomBidInputBlur = () => {
    if (!pickup.trim() || !dropoff.trim()) return;
    const num = parseFloat(customBidInput);
    if (isNaN(num) || num < minAllowedFare) {
      const fallback = Math.max(minAllowedFare, baseCalculatedFare > 0 ? baseCalculatedFare : minAllowedFare);
      setCustomBidFare(fallback);
      setCustomBidInput(fallback.toFixed(0));
      setHasUserModifiedBid(fallback !== baseCalculatedFare);
    } else {
      const rounded = Number(num.toFixed(2));
      setCustomBidFare(rounded);
      setCustomBidInput(rounded.toString());
      setHasUserModifiedBid(true);
    }
  };

  const handleAdjustBid = (delta: number) => {
    setHasUserModifiedBid(true);
    const fallbackBase = baseCalculatedFare > 0 ? baseCalculatedFare : (activeTierConfig.baseFare || 25);
    const current = customBidFare > 0 ? customBidFare : fallbackBase;
    const next = Math.max(minAllowedFare, Math.round(current + delta));
    setCustomBidFare(next);
    setCustomBidInput(next.toString());
  };

  const handleResetToFairFare = () => {
    const target = baseCalculatedFare > 0 ? baseCalculatedFare : (activeTierConfig.baseFare || 25);
    setHasUserModifiedBid(false);
    setCustomBidFare(target);
    setCustomBidInput(target.toFixed(0));
  };

  const handleRaiseRideFare = async (amountToAdd: number) => {
    if (!activeRide || activeRide.status !== 'requested') return;
    const currentFare = Number(activeRide.fare) || baseCalculatedFare || 15;
    const newFare = Math.round(currentFare + amountToAdd);
    setIsRaisingFare(true);
    try {
      const { data, error } = await updateRideFare(activeRide.id, newFare);
      if (error) {
        setErrorMessage(`Could not update offer: ${error}`);
      } else if (data) {
        setActiveRide(data);
        setRaiseFareSuccess(`Offer raised to ₹${newFare.toFixed(2)}! Broadcasted to nearby captains.`);
        setTimeout(() => setRaiseFareSuccess(null), 3500);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update offer');
    } finally {
      setIsRaisingFare(false);
    }
  };

  // Book Ride Action
  const handleBookRide = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!pickup.trim() || !dropoff.trim()) {
      setErrorMessage('Please provide valid pickup and dropoff locations.');
      return;
    }

    if (pickup.trim().toLowerCase() === dropoff.trim().toLowerCase()) {
      setErrorMessage('Pickup and dropoff cannot be the same address.');
      return;
    }

    const finalFare = customBidFare > 0 ? customBidFare : baseCalculatedFare;
    if (finalFare <= 0) {
      setErrorMessage('Please specify an offer fare greater than ₹0.');
      return;
    }

    setIsSubmitting(true);
    const selectedTierObj = RIDE_TIERS.find((t) => t.id === selectedTier) || RIDE_TIERS[0];

    try {
      const { data, error } = await createRideBooking({
        passenger_id: passengerUser.id,
        passenger_name: passengerUser.name,
        passenger_phone: passengerUser.phone,
        pickup_location: pickup,
        dropoff_location: dropoff,
        fare: finalFare,
        distance_km: distanceKm,
        estimated_mins: estimatedMins,
        service_type: selectedTier,
        tier_name: selectedTierObj.name,
        delivery_notes: passengerNotes.trim() || undefined,
      });

      if (error) {
        setErrorMessage(`Booking failed: ${error}`);
      } else if (data) {
        setActiveRide(data);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to book ride');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Advance or switch ride lifecycle step from the interactive timeline tabs
  const handleStepTabClick = async (targetStatus: RideStatus) => {
    if (!activeRide) return;

    const defaultCaptain = {
      captain_id: activeRide.captain_id || 'cap_1',
      captain_name: activeRide.captain_name || 'Vikram Singh (Captain)',
      captain_vehicle: activeRide.captain_vehicle || 'Honda Activa 6G • MH 02 AB 1234',
      captain_phone: activeRide.captain_phone || '+91 98765 43210',
      captain_rating: activeRide.captain_rating || 4.96,
    };

    if (targetStatus === 'arrived') {
      playCaptainArrivedChime();
      setCaptainArrivedNotice({
        captainName: defaultCaptain.captain_name,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      const updated: Ride = {
        ...activeRide,
        ...defaultCaptain,
        status: 'arrived',
      };
      setActiveRide(updated);
      activeRideRef.current = updated;
      try {
        await updateRideStatus(activeRide.id, 'arrived');
      } catch (e) {
        console.warn('Update arrived status error:', e);
      }
    } else if (targetStatus === 'started') {
      const updated: Ride = {
        ...activeRide,
        ...defaultCaptain,
        status: 'started',
      };
      setActiveRide(updated);
      activeRideRef.current = updated;
      try {
        await updateRideStatus(activeRide.id, 'started');
      } catch (e) {
        console.warn('Update started status error:', e);
      }
    } else if (targetStatus === 'completed') {
      // Promptly display rating form to rate the captain
      setReviewSubmitted(false);
      try {
        localStorage.removeItem(`motoride_rating_${activeRide.id}`);
      } catch (e) {}
      try {
        confetti({ particleCount: 80, spread: 90, origin: { y: 0.5 } });
      } catch (e) {}
      const updated: Ride = {
        ...activeRide,
        ...defaultCaptain,
        status: 'completed',
        completed_at: new Date().toISOString(),
      };
      setActiveRide(updated);
      activeRideRef.current = updated;
      try {
        await updateRideStatus(activeRide.id, 'completed');
      } catch (e) {
        console.warn('Update completed status error:', e);
      }
    } else if (targetStatus === 'accepted') {
      const updated: Ride = {
        ...activeRide,
        ...defaultCaptain,
        status: 'accepted',
      };
      setActiveRide(updated);
      activeRideRef.current = updated;
      try {
        await updateRideStatus(activeRide.id, 'accepted');
      } catch (e) {
        console.warn('Update accepted status error:', e);
      }
    } else if (targetStatus === 'requested') {
      const updated: Ride = { ...activeRide, status: 'requested' };
      setActiveRide(updated);
      activeRideRef.current = updated;
      try {
        await updateRideStatus(activeRide.id, 'requested');
      } catch (e) {
        console.warn('Update requested status error:', e);
      }
    }
  };

  // Cancel Ride Action
  const handleCancelRide = async () => {
    if (!activeRide) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await updateRideStatus(activeRide.id, 'cancelled');
      if (error) {
        setErrorMessage(`Cancellation failed: ${error}`);
      } else if (data) {
        setActiveRide(data);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error cancelling ride');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!activeRide) return;
    setIsSubmitting(true);
    try {
      await submitPassengerRatingForRide(activeRide.id, ratingStars, {
        tags: selectedTags,
        comment: feedbackComment,
        tip: tipAmount,
      });
      localStorage.setItem(`motoride_rating_${activeRide.id}`, 'true');
      setReviewSubmitted(true);
      try {
        confetti({ particleCount: 80, spread: 80, origin: { y: 0.6 } });
      } catch (e) {}
    } catch (err: any) {
      console.warn('Rating submission note:', err);
      setReviewSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBookAnother = () => {
    if (activeRide) {
      setPreviousRide(activeRide);
    }
    setActiveRide(null);
    setPickup('');
    setDropoff('');
    setPickupCoords(null);
    setDropoffCoords(null);
    setErrorMessage(null);
    setReviewSubmitted(false);
  };

  const recommendedFare = baseCalculatedFare > 0 ? baseCalculatedFare : (activeTierConfig.baseFare || 25);
  const displayFare = customBidFare > 0 ? customBidFare : recommendedFare;

  return (
    <div
      id="uber-passenger-root"
      className="relative w-full h-full min-h-[580px] flex flex-col overflow-hidden font-sans select-none"
    >
      {/* 1. Full-screen Google Map Background Layer */}
      <GoogleMapBackground
        pickupLocation={pickup}
        dropoffLocation={dropoff}
        pickupCoords={pickupCoords}
        dropoffCoords={dropoffCoords}
        activeRide={activeRide}
        isSheetCollapsed={isWindowCollapsed}
        passengerLiveLocation={liveGPS.coords}
        passengerLiveHeading={liveGPS.heading}
        passengerLiveSpeed={liveGPS.speed}
        passengerLiveAccuracy={liveGPS.accuracy}
        passengerLiveStatus={liveGPS.status}
        isSimulating={liveGPS.isSimulating}
        onToggleSimulation={liveGPS.toggleSimulation}
        onUseLiveLocationAsPickup={handleUseLiveLocationAsPickup}
        onRetryGPS={liveGPS.retryGPS}
        passengerAvatarUrl={currentUser.avatar_url || '/passenger-icon.svg'}
        passengerName={currentUser.name}
        nearestLandmark={liveGPS.nearestLandmark}
        compassDirection={liveGPS.compassDirection}
        onSelectCoords={(coords, type) => {
          if (type === 'pickup') {
            setPickupCoords(coords);
            setPickup(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
          } else {
            setDropoffCoords(coords);
            setDropoff(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
          }
        }}
      />

      {/* 2. Top Floating Header Bar */}
      <div className="absolute top-2.5 left-3 right-3 sm:left-6 sm:right-6 z-20 pointer-events-none flex items-center justify-between">
        {/* Two lines button in top left corner - click to show whole passenger profile details */}
        <button
          type="button"
          id="passenger-profile-two-lines-btn"
          onClick={() => setIsProfileOpen(true)}
          className={`pointer-events-auto h-11 w-11 rounded-2xl border shadow-lg backdrop-blur-xl flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group hover:scale-105 active:scale-95 ${
            isLight
              ? 'bg-white/95 hover:bg-white border-slate-200/90 text-slate-800 hover:text-emerald-600 shadow-slate-200/60'
              : 'bg-slate-950/90 hover:bg-slate-900 border-slate-800 text-slate-200 hover:text-emerald-400 shadow-black/60'
          }`}
          title="Passenger profile details"
          aria-label="Open passenger profile details"
        >
          <span className="w-5 h-[2.5px] rounded-full bg-current block transition-transform group-hover:scale-x-110 group-hover:bg-emerald-500" />
          <span className="w-5 h-[2.5px] rounded-full bg-current block transition-transform group-hover:scale-x-110 group-hover:bg-emerald-500" />
        </button>

        {/* Action Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {/* Real-time GPS Location Status in Passenger Dashboard Header */}
          {liveGPS.coords && (
            <button
              type="button"
              id="header-live-gps-pill-btn"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('motoride-center-on-gps'));
              }}
              className={`px-2.5 py-1.5 rounded-xl border shadow-md backdrop-blur-xl flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                isLight
                  ? 'bg-white/90 hover:bg-blue-50 text-blue-600 border-blue-200/80 shadow-blue-500/10'
                  : 'bg-slate-950/85 hover:bg-blue-950/60 text-blue-400 border-blue-900/60 shadow-black/40'
              }`}
              title="Click to view and center your real-time GPS location on the map"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <Navigation className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20" />
              <span className="hidden sm:inline max-w-[120px] truncate">
                {liveGPS.nearestLandmark ? liveGPS.nearestLandmark.split(',')[0] : 'Live GPS'}
              </span>
              <span className="text-[10px] text-blue-500 font-normal hidden lg:inline">
                (Show Map)
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsCalculatorModalOpen(true)}
            className={`p-2 rounded-xl border shadow-md backdrop-blur-xl transition-all cursor-pointer hover:scale-105 active:scale-95 ${
              isLight
                ? 'bg-white/90 hover:bg-white text-slate-800 border-slate-200'
                : 'bg-slate-950/85 hover:bg-slate-900 text-slate-200 border-slate-800'
            }`}
            title="Fare & Distance Estimator"
          >
            <Calculator className="w-4 h-4 text-emerald-500" />
          </button>

          {activeRide && (
            <button
              type="button"
              onClick={() => setIsSafetyOpen(true)}
              className={`px-2.5 py-1.5 rounded-xl border shadow-md backdrop-blur-xl flex items-center gap-1 text-xs font-bold transition-all cursor-pointer ${
                isLight
                  ? 'bg-amber-50/90 text-amber-900 border-amber-300 hover:bg-amber-100'
                  : 'bg-amber-950/80 text-amber-200 border-amber-500/40 hover:bg-amber-900/60'
              }`}
              title="Emergency Safety Toolkit"
            >
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Safety</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Passenger Booking Page at Bottom of Main Page with Center Drop Down Button */}
      <div
        id="passenger-bottom-window-sheet"
        className={`absolute bottom-0 left-0 right-0 z-20 w-full max-w-lg sm:max-w-xl mx-auto transition-transform duration-300 ease-in-out flex flex-col pointer-events-auto ${
          isWindowCollapsed
            ? 'translate-y-[calc(100%-82px)]'
            : 'translate-y-0 h-[50vh] max-h-[50vh]'
        }`}
      >
        {/* Center Button to Drop Down / Expand Window Style */}
        <div className="w-full flex items-center justify-center -mb-3.5 z-30 pointer-events-auto">
          <button
            id="passenger-window-dropdown-toggle-btn"
            type="button"
            onClick={() => setIsWindowCollapsed(!isWindowCollapsed)}
            className={`group px-5 py-2 rounded-full border shadow-2xl flex items-center gap-2 text-xs font-black transition-all cursor-pointer hover:scale-105 active:scale-95 ${
              isWindowCollapsed
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 border-white/80 ring-4 ring-emerald-500/25 animate-bounce'
                : isLight
                ? 'bg-slate-900/95 hover:bg-slate-900 text-white border-slate-700/80 shadow-slate-900/30'
                : 'bg-white/95 hover:bg-white text-slate-950 border-white/50 shadow-black/50'
            }`}
            title={isWindowCollapsed ? "Expand Passenger Booking Window (Half Screen)" : "Drop Down Window to View Full Google Map"}
          >
            {isWindowCollapsed ? (
              <>
                <ChevronUp className="w-4 h-4 stroke-[3]" />
                <span>Expand Booking</span>
                <span className="text-[10px] font-semibold opacity-80">(Half Page)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 stroke-[3] transition-transform group-hover:translate-y-0.5" />
                <span>Drop Down Window</span>
                <span className="text-[10px] font-semibold opacity-75">View Map</span>
              </>
            )}
          </button>
        </div>

        {/* Window Container Box */}
        <div
          className={`w-full h-full border-t border-x rounded-t-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl transition-colors duration-200 ${
            isLight
              ? 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-900/20'
              : 'bg-[#07090e]/95 border-slate-800 text-slate-100 shadow-black/80'
          }`}
        >
          {/* If Window is Dropped Down: Sleek Bottom Mini-Dock Bar */}
          {isWindowCollapsed ? (
            <div
              onClick={() => setIsWindowCollapsed(false)}
              className="p-3.5 pt-5 flex items-center justify-between gap-3 cursor-pointer hover:opacity-95"
            >
              {!activeRide ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
                    🛵
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-black truncate ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      {pickup ? pickup.split(',')[0] : 'Choose Pickup'} → {dropoff ? dropoff.split(',')[0] : 'Choose Dropoff'}
                    </p>
                    <p className="text-[10px] text-emerald-600 font-bold">
                      Estimated ₹{displayFare.toFixed(0)} · Click to open booking
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-sm shrink-0">
                    🏍️
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-400 text-slate-950">
                        {activeRide.status}
                      </span>
                      <span className={`text-xs font-black truncate ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        {activeRide.captain_name || 'Captain Driver'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold">
                      PIN: <span className="text-amber-500 font-mono">{safetyPin}</span> · Click to view ride progress & rating
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsWindowCollapsed(false);
                }}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shrink-0 shadow-sm cursor-pointer"
              >
                Open Booking
              </button>
            </div>
          ) : (
            /* If Window is Expanded: Scrollable Booking Page / Active Ride Content capped at Half Page */
            <div className="overflow-y-auto flex-1 max-h-[calc(50vh-35px)] scrollbar-thin">
              {/* Database Error Banner */}
              {errorMessage && (
                <div className="m-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs flex items-center justify-between gap-2 animate-in fade-in">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                    <span className="leading-tight">{errorMessage}</span>
                  </div>
                  {(errorMessage.includes('SQL') || errorMessage.includes('missing')) && onOpenSqlModal && (
                    <button
                      onClick={onOpenSqlModal}
                      className="px-2.5 py-1 bg-amber-500 text-slate-950 rounded-lg text-xs font-bold shrink-0"
                    >
                      SQL Fix
                    </button>
                  )}
                </div>
              )}

      {/* Active Ride Mode vs Booking Mode */}
      {!activeRide ? (
        /* ================= INDRIVE OFFER PRICE BOOKING INTERFACE ================= */
        <form onSubmit={handleBookRide} className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-1">
            <h3 className={`text-sm font-black uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
              Book Moto Ride (inDrive Style)
            </h3>
            <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-600 font-bold rounded-full border border-emerald-500/20">
              Fair Fare Bidding
            </span>
          </div>

          {/* Previous Ride Summary Card */}
          {previousRide && (
            <div className={`p-3 rounded-2xl border text-left transition-all ${
              isLight 
                ? 'bg-slate-50 border-slate-200 shadow-xs' 
                : 'bg-slate-900/40 border-slate-800'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs">⏱️</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Previous Ride Summary
                  </span>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  previousRide.status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-rose-500/10 text-rose-500'
                }`}>
                  {previousRide.status === 'completed' ? 'Completed' : 'Cancelled'}
                </span>
              </div>
              
              <div className="text-xs space-y-1 opacity-85">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate text-slate-600 dark:text-slate-300 font-medium text-[11px]">
                    {previousRide.pickup_location?.split(',')[0] || 'Previous Pickup'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span className="truncate text-slate-600 dark:text-slate-300 font-medium text-[11px]">
                    {previousRide.dropoff_location?.split(',')[0] || 'Previous Dropoff'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-500/10">
                <span className="text-[10px] text-slate-500 font-bold">
                  {previousRide.captain_name ? `Captain: ${previousRide.captain_name}` : 'No Captain assigned'} · ₹{Number(previousRide.fare || 0).toFixed(0)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPickup(previousRide.pickup_location);
                    setDropoff(previousRide.dropoff_location);
                    if (previousRide.pickup_lat && previousRide.pickup_lng) {
                      setPickupCoords({ lat: previousRide.pickup_lat, lng: previousRide.pickup_lng });
                    }
                    if (previousRide.dropoff_lat && previousRide.dropoff_lng) {
                      setDropoffCoords({ lat: previousRide.dropoff_lat, lng: previousRide.dropoff_lng });
                    }
                    setCustomBidFare(Number(previousRide.fare || 0));
                    setHasUserModifiedBid(true);
                  }}
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black rounded-lg transition-all cursor-pointer shadow-xs"
                >
                  Repeat Route
                </button>
              </div>
            </div>
          )}

          {/* Locations Input */}
          <div className="space-y-3 p-3 bg-slate-500/5 rounded-2xl border border-slate-500/10">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wide opacity-75">
                Pickup Location
              </label>
              <GoogleLocationSearchInput
                type="pickup"
                value={pickup}
                placeholder="Enter pickup address..."
                onChange={(val, coords) => {
                  setPickup(val);
                  if (coords) setPickupCoords(coords);
                }}
                currentGpsCoords={liveGPS.coords}
                currentGpsLabel={liveGPS.nearestLandmark}
                onUseCurrentGps={handleUseLiveLocationAsPickup}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wide opacity-75">
                Dropoff Location
              </label>
              <GoogleLocationSearchInput
                type="dropoff"
                value={dropoff}
                placeholder="Where is your destination?"
                onChange={(val, coords) => {
                  setDropoff(val);
                  if (coords) setDropoffCoords(coords);
                }}
              />
            </div>

            {distanceKm > 0 && (
              <div className="flex items-center justify-between pt-1 text-[11px] font-bold text-slate-500">
                <span>Distance: {distanceKm.toFixed(1)} km</span>
                <span>Est. Time: {estimatedMins} mins</span>
              </div>
            )}
          </div>

          {/* Service Selection / Ride Tiers */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wide opacity-75 block px-1">
              Choose Service
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {RIDE_TIERS.map((tier) => {
                const isSelected = selectedTier === tier.id;
                const calculatedTierFare = baseCalculatedFare > 0 
                  ? baseCalculatedFare * tier.multiplier 
                  : (tier.id === 'moto_delivery' ? 20 : 25);
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedTier(tier.id)}
                    className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between min-h-[90px] cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500 text-slate-900 dark:text-slate-100 shadow-sm shadow-emerald-500/10'
                        : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between w-full">
                      <span className="text-2xl">{tier.icon}</span>
                      {tier.popular && (
                        <span className="text-[8px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          Popular
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black leading-tight mt-1 truncate">
                        {tier.name}
                      </p>
                      <p className="text-[9px] text-slate-500 truncate leading-none mt-0.5">
                        Est. ₹{calculatedTierFare.toFixed(0)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Delivery Note (if Moto Courier selected) */}
          {selectedTier === 'moto_delivery' && (
            <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
              <label className="text-[10px] font-black uppercase tracking-wide opacity-75 block px-1">
                Courier Parcel Details
              </label>
              <input
                type="text"
                value={passengerNotes}
                onChange={(e) => setPassengerNotes(e.target.value)}
                placeholder="What are we delivering? (e.g. Keys, Documents, Gift box)"
                className={`w-full text-xs px-3 py-2.5 rounded-xl border outline-none bg-white/50 dark:bg-slate-900/50 ${
                  isLight
                    ? 'border-slate-200 focus:border-emerald-500'
                    : 'border-slate-800 focus:border-emerald-500'
                }`}
              />
            </div>
          )}

          {/* Fare Bidding Segment (inDrive style) */}
          <div className="space-y-2 p-3 bg-slate-500/5 rounded-2xl border border-slate-500/10">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-black">Your Offer Price</h4>
                <p className="text-[9px] text-slate-500 font-bold">
                  Recommended: ₹{recommendedFare.toFixed(0)} (Min. ₹10)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const current = customBidFare > 0 ? customBidFare : recommendedFare;
                    const next = Math.max(10, Math.round(current - 10));
                    setCustomBidFare(next);
                    setHasUserModifiedBid(true);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-500/10 hover:bg-slate-500/20 text-lg flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  -
                </button>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  ₹{displayFare.toFixed(0)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const current = customBidFare > 0 ? customBidFare : recommendedFare;
                    const next = Math.round(current + 10);
                    setCustomBidFare(next);
                    setHasUserModifiedBid(true);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-500/10 hover:bg-slate-500/20 text-lg flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Quick Bid Increment Chips */}
            <div className="flex gap-2 justify-center pt-1 border-t border-slate-500/5">
              {[10, 20, 50].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    const current = customBidFare > 0 ? customBidFare : recommendedFare;
                    setCustomBidFare(current + amt);
                    setHasUserModifiedBid(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 text-xs font-black rounded-xl border border-emerald-500/20 cursor-pointer flex-1 text-center"
                >
                  +₹{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Option Selector */}
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black uppercase tracking-wide opacity-75">
              Payment Method
            </span>
            <div className="flex gap-2 text-xs font-black">
              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                  paymentMethod === 'upi'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                    : 'bg-transparent border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-700'
                }`}
              >
                UPI
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                    : 'bg-transparent border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-700'
                }`}
              >
                Cash
              </button>
            </div>
          </div>

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isSubmitting || !pickup.trim() || !dropoff.trim()}
            className={`w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-500/20 disabled:text-slate-500 text-slate-950 font-black rounded-2xl text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                Searching for Captains...
              </>
            ) : (
              <>
                🛵 Find a Captain
              </>
            )}
          </button>
        </form>
      ) : (
        /* ================= UBER / INDRIVE LIVE ACTIVE RIDE TRACKER ================= */
        <div id="uber-active-ride-sheet" className="p-4 space-y-3.5 flex flex-col animate-in fade-in duration-300">
          {/* Prominent Live Status Headline */}
          <div className={`flex items-center justify-between pb-2 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  RIDE #{activeRide.id.slice(0, 6)}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <h2 className={`text-base font-black mt-0.5 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                {activeRide.status === 'requested' && 'Searching for Nearby Captains...'}
                {activeRide.status === 'accepted' && 'Captain is on the Way (ETA ~3m)'}
                {activeRide.status === 'arrived' && 'Captain has Arrived at Pickup!'}
                {activeRide.status === 'started' && 'En Route to Destination'}
                {activeRide.status === 'completed' && 'Trip Completed · Rate Your Captain'}
                {activeRide.status === 'cancelled' && 'Ride Request Cancelled'}
              </h2>
            </div>
            <div className="text-right">
              <span className={`text-base font-black ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                ₹{activeRide.fare ? Number(activeRide.fare).toFixed(2) : baseCalculatedFare.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Service Category Badge */}
          {(() => {
            const serviceInfo = getRideServiceInfo(activeRide);
            return (
              <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                serviceInfo.isCourier
                  ? isLight
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{serviceInfo.icon}</span>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider block">
                      {serviceInfo.badgeLabel}
                    </span>
                    <span className="text-[10px] opacity-80 block">
                      {serviceInfo.isCourier ? 'Parcel & Package Courier Service' : 'Comfort Passenger Ride • Sanitized Helmet'}
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                  serviceInfo.isCourier ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300' : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                }`}>
                  {serviceInfo.isCourier ? 'Package' : 'Passenger'}
                </span>
              </div>
            );
          })()}

          {/* Interactive Stepper Progress Tabs Bar */}
          <div
            id="passenger-ride-progression-timeline"
            className={`p-3 rounded-2xl border space-y-2 transition-colors ${
              isLight ? 'bg-slate-50 border-slate-200 shadow-sm' : 'bg-slate-900/80 border-slate-800 shadow-md'
            }`}
          >
            <div className="flex items-center justify-between gap-1 overflow-x-auto pb-0.5 text-[11px] font-bold">
              {/* 1. Match */}
              <button
                type="button"
                id="passenger-tab-match-step"
                onClick={() => handleStepTabClick('requested')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                  activeRide.status === 'requested'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm ring-2 ring-amber-500/20'
                    : 'text-emerald-500 hover:bg-emerald-500/10'
                }`}
                title="Matching with Captains"
              >
                <span>1. Match</span>
              </button>

              {/* 2. En Route */}
              <button
                type="button"
                id="passenger-tab-enroute-step"
                onClick={() => handleStepTabClick('accepted')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                  activeRide.status === 'accepted'
                    ? 'bg-sky-500 text-slate-950 font-black shadow-sm ring-2 ring-sky-500/20'
                    : ['arrived', 'started', 'completed'].includes(activeRide.status)
                    ? 'text-emerald-500 hover:bg-emerald-500/10'
                    : isLight ? 'text-slate-500 hover:text-sky-600' : 'text-slate-400 hover:text-sky-400'
                }`}
                title="Captain En Route to Pickup"
              >
                <span>2. En Route</span>
              </button>

              {/* 3. Arrived (Captain Arrived) */}
              <button
                type="button"
                id="passenger-tab-arrived-step"
                onClick={() => handleStepTabClick('arrived')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                  activeRide.status === 'arrived'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-sm ring-2 ring-emerald-500/20 animate-pulse'
                    : ['started', 'completed'].includes(activeRide.status)
                    ? 'text-emerald-500 hover:bg-emerald-500/10'
                    : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 underline decoration-dotted'
                }`}
                title="Captain Arrived at Pickup Spot"
              >
                <span>3. Arrived</span>
                {activeRide.status === 'accepted' && (
                  <span className="text-[9px] bg-emerald-400 text-slate-950 font-black px-1 rounded">TAP</span>
                )}
              </button>

              {/* 4. Trip */}
              <button
                type="button"
                id="passenger-tab-trip-step"
                onClick={() => handleStepTabClick('started')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                  activeRide.status === 'started'
                    ? 'bg-indigo-500 text-white font-black shadow-sm ring-2 ring-indigo-500/20 animate-pulse'
                    : activeRide.status === 'completed'
                    ? 'text-emerald-500 hover:bg-emerald-500/10'
                    : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 underline decoration-dotted'
                }`}
                title="Trip in Progress to Destination"
              >
                <span>4. Trip</span>
                {activeRide.status === 'arrived' && (
                  <span className="text-[9px] bg-indigo-500 text-white font-black px-1 rounded">START</span>
                )}
              </button>

              {/* 5. Done */}
              <button
                type="button"
                id="passenger-tab-done-step"
                onClick={() => handleStepTabClick('completed')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                  activeRide.status === 'completed'
                    ? 'bg-emerald-600 text-white font-black shadow-sm ring-2 ring-emerald-500/30'
                    : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 underline decoration-dotted'
                }`}
                title="Trip Completed & Rate Captain"
              >
                <span>5. Done</span>
                {['started', 'arrived'].includes(activeRide.status) && (
                  <span className="text-[9px] bg-amber-400 text-slate-950 font-black px-1 rounded">RATE</span>
                )}
              </button>
            </div>

            {/* Progress Bar Track */}
            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
              <div
                className={`h-full transition-all duration-500 ${
                  activeRide.status === 'cancelled'
                    ? 'bg-rose-500 w-full'
                    : activeRide.status === 'requested'
                    ? 'bg-amber-500 w-1/5 animate-pulse'
                    : activeRide.status === 'accepted'
                    ? 'bg-sky-500 w-2/5'
                    : activeRide.status === 'arrived'
                    ? 'bg-emerald-500 w-3/5'
                    : activeRide.status === 'started'
                    ? 'bg-indigo-500 w-4/5'
                    : 'bg-emerald-500 w-full'
                }`}
              />
            </div>
          </div>

          {/* Captain Arrived Announcement Banner */}
          {(activeRide.status === 'arrived' || captainArrivedNotice) && (
            <div
              id="captain-arrived-alert-banner"
              className={`p-4 rounded-2xl border-2 shadow-xl animate-in zoom-in-95 duration-200 ${
                isLight
                  ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50 border-emerald-500 text-slate-900'
                  : 'bg-gradient-to-r from-emerald-950/60 via-teal-950/40 to-slate-900 border-emerald-500 text-slate-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-lg flex-shrink-0 shadow-md">
                    🎉
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        Captain Has Arrived!
                      </h3>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    </div>
                    <p className={`text-xs mt-0.5 leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      <strong>{activeRide.captain_name || captainArrivedNotice?.captainName || 'Your Captain'}</strong> is waiting at your pickup point. Please board and share your 4-digit PIN <strong>{safetyPin}</strong>.
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20">
                        📍 At Pickup Spot
                      </span>
                      <button
                        type="button"
                        onClick={() => playCaptainArrivedChime()}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-300 hover:bg-amber-500/30 cursor-pointer"
                      >
                        🔔 Replay Alert Sound
                      </button>
                    </div>
                  </div>
                </div>
                {captainArrivedNotice && (
                  <button
                    type="button"
                    onClick={() => setCaptainArrivedNotice(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1.5 py-0.5 rounded cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Trip in Progress Announcement Banner */}
          {activeRide.status === 'started' && (
            <div
              id="passenger-trip-in-progress-banner"
              className={`p-4 rounded-2xl border-2 shadow-lg animate-in fade-in duration-300 ${
                isLight
                  ? 'bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 border-indigo-400 text-slate-900'
                  : 'bg-gradient-to-r from-indigo-950/60 via-slate-900 to-emerald-950/40 border-indigo-500/60 text-slate-100'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-500 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0 animate-bounce">
                    🏍️
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Trip In Progress
                      </span>
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                    </div>
                    <h4 className="text-sm font-black truncate mt-0.5">
                      En route to {activeRide.dropoff_location || dropoff || 'Destination'}
                    </h4>
                    <p className={`text-[11px] mt-0.5 truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Riding safely with {activeRide.captain_name || 'Vikram Singh (Captain)'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-indigo-200/50 dark:border-indigo-800/40 flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                  Reached your destination?
                </span>
                <button
                  type="button"
                  id="passenger-complete-trip-btn"
                  onClick={() => handleStepTabClick('completed')}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Complete & Rate Captain</span>
                </button>
              </div>
            </div>
          )}

          {/* Captain Card (Uber Driver Profile Style) */}
          {(activeRide.captain_id || ['accepted', 'arrived', 'started', 'completed'].includes(activeRide.status)) ? (
            <div
              className={`border p-3.5 rounded-2xl space-y-3 shadow-lg transition-colors ${
                isLight ? 'bg-white border-slate-200 shadow-slate-100' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-black text-2xl shadow-md">
                    🏍️
                  </div>
                  <div>
                    <h4 className={`text-sm font-black flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      {activeRide.captain_name || 'Captain Driver'}
                      <span className="text-[11px] font-bold text-amber-500 flex items-center">
                        ★ {activeRide.captain_rating || 4.96}
                      </span>
                    </h4>
                    <p className={`text-xs font-medium ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      {activeRide.captain_vehicle || 'Motorcycle'}
                    </p>
                  </div>
                </div>

                {/* Safety PIN Badge */}
                <div
                  className={`text-center px-2.5 py-1.5 rounded-xl border ${
                    isLight
                      ? 'bg-amber-50 border-amber-300'
                      : 'bg-slate-950 border-amber-500/40'
                  }`}
                >
                  <span className="text-[9px] uppercase font-bold text-amber-600 block">RIDE PIN</span>
                  <span className="font-mono text-sm font-black text-amber-700 tracking-wider">
                    {safetyPin}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Call, Chat, Safety Toolkit */}
              <div className={`grid grid-cols-3 gap-2 pt-1 border-t ${isLight ? 'border-slate-100' : 'border-slate-800/80'}`}>
                <a
                  href={`tel:${activeRide.captain_phone || '+15557493021'}`}
                  className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                  Call
                </a>

                <button
                  type="button"
                  id="passenger-in-ride-chat-btn"
                  onClick={() => {
                    setIsChatOpen(true);
                    setUnreadChatCount(0);
                    if (activeRide) markMessagesAsRead(activeRide.id, 'passenger');
                  }}
                  className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors relative cursor-pointer ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
                  Chat
                  {unreadChatCount > 0 ? (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black absolute -top-1.5 -right-1 flex items-center justify-center animate-bounce shadow">
                      {unreadChatCount}
                    </span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-sky-500 absolute top-1.5 right-2" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsSafetyOpen(true)}
                  className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-amber-500" />
                  Safety
                </button>
              </div>

              {/* Real-Time Live GPS Tracking Indicator */}
              {liveGPS.coords && (
                <div
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs ${
                    isLight
                      ? 'bg-blue-50/90 border border-blue-100 text-blue-900'
                      : 'bg-blue-950/40 border border-blue-900/50 text-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    <span className="text-[11px] truncate">
                      <strong>Live GPS:</strong> {liveGPS.nearestLandmark || 'Current Location'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('motoride-center-on-gps'));
                    }}
                    className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline shrink-0 flex items-center gap-1 cursor-pointer ml-2"
                  >
                    <Navigation className="w-2.5 h-2.5 fill-blue-500/20" />
                    <span>Show on Map</span>
                  </button>
                </div>
              )}

              {/* Passenger Dashboard Message Board */}
              {latestCaptainMsg && (
                <div
                  id="passenger-in-ride-message-board"
                  onClick={() => {
                    setIsChatOpen(true);
                    setUnreadChatCount(0);
                    if (activeRide) markMessagesAsRead(activeRide.id, 'passenger');
                  }}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between gap-3 ${
                    unreadChatCount > 0
                      ? 'bg-sky-500/15 border-sky-500/50 shadow-md shadow-sky-500/10 animate-pulse'
                      : isLight
                      ? 'bg-sky-50/70 border-sky-200/80 hover:bg-sky-100/70'
                      : 'bg-sky-950/40 border-sky-800/60 hover:bg-sky-900/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-sky-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                      <MessageSquare className="w-4 h-4 fill-slate-950" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-black uppercase tracking-wide ${unreadChatCount > 0 ? 'text-sky-400' : isLight ? 'text-sky-800' : 'text-sky-300'}`}>
                          Message Board · {activeRide.captain_name || 'Captain'}
                        </span>
                        {unreadChatCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black uppercase">
                            {unreadChatCount} new
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 ml-auto font-mono">{latestCaptainMsg.timestamp}</span>
                      </div>
                      <p className={`text-xs font-semibold truncate ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                        "{latestCaptainMsg.text}"
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black shadow-sm">
                    Open Chat
                  </span>
                </div>
              )}
            </div>
          ) : (() => {
            const pendingOffers = captainOffers.filter((o) => o.status === 'pending');

            if (pendingOffers.length > 0) {
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <h4 className={`text-xs font-black uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        Captain Offers Received ({pendingOffers.length})
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Mutual Acceptance Required
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {pendingOffers.map((offer) => {
                      const baseRideFare = Number(activeRide.fare) || offer.original_fare;
                      const fareDiff = offer.offered_fare - baseRideFare;

                      return (
                        <div
                          key={offer.id}
                          id={`captain-offer-${offer.id}`}
                          className={`p-3.5 rounded-2xl border transition-all shadow-md ${
                            isLight
                              ? 'bg-white border-emerald-300 ring-1 ring-emerald-500/15 shadow-slate-200/60'
                              : 'bg-slate-900 border-emerald-500/40 ring-1 ring-emerald-500/20'
                          }`}
                        >
                          {/* inDrive Style Timeline Bar: Countdown to accept driver's offer */}
                          {/* Timeline bar removed per request */}

                          {/* Captain Info & Offered Fare */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shrink-0 shadow-sm">
                                🏍️
                              </div>
                              <div className="min-w-0">
                                <h5 className={`text-xs font-black truncate flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                                  <span className="truncate">{offer.captain_name || 'Captain Driver'}</span>
                                  <span className="text-[10px] text-amber-500 font-bold shrink-0">
                                    ★ {offer.captain_rating || 4.96}
                                  </span>
                                </h5>
                                <p className={`text-[11px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                  {offer.captain_vehicle || 'Motorcycle'} · ~{offer.eta_minutes || 3}m away
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 block font-mono">
                                ₹{offer.offered_fare}
                              </span>
                              {fareDiff === 0 ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 inline-block">
                                  Matches your fare
                                </span>
                              ) : fareDiff > 0 ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 inline-block">
                                  +₹{fareDiff} counter
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 inline-block">
                                  -₹{Math.abs(fareDiff)} discount
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons: Accept & Decline */}
                          <div className="grid grid-cols-3 gap-2 pt-3">
                            <button
                              type="button"
                              id={`decline-captain-offer-${offer.id}`}
                              onClick={() => handleDeclineCaptainOffer(offer.captain_id)}
                              disabled={isAcceptingOfferId === offer.id}
                              className={`py-2 px-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                                isLight
                                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                              }`}
                            >
                              <X className="w-3.5 h-3.5 text-rose-500" />
                              <span>Decline</span>
                            </button>

                            <button
                              type="button"
                              id={`accept-captain-offer-${offer.id}`}
                              onClick={() => handleAcceptCaptainOffer(offer)}
                              disabled={isAcceptingOfferId === offer.id}
                              className="col-span-2 py-2 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/25 transition-all cursor-pointer active:scale-98"
                            >
                              {isAcceptingOfferId === offer.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-4 h-4 stroke-[3]" />
                                  <span>Accept Offer · ₹{offer.offered_fare}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {/* Searching State Radar Card */}
                <div
                  className={`border p-4 rounded-2xl space-y-3 transition-colors ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-500 flex items-center justify-center shrink-0">
                      <Radio className="w-5 h-5 animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                        Broadcasting Request to Captains
                      </h4>
                      {skipNotice ? (
                        <p className="text-[11px] font-bold text-amber-500 animate-pulse">
                          {skipNotice}
                        </p>
                      ) : (
                        <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Nearby drivers are reviewing your request of ₹{activeRide.fare?.toFixed(2) || '14.50'}. Captain fare offers will appear here for mutual acceptance.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* inDrive Style Live Broadcast Search Timeline Bar removed */}
                </div>

                {/* Offer Your Price to Captain (Raise Offer while searching) */}
                <div
                  className={`p-3.5 border rounded-2xl space-y-2.5 transition-colors ${
                    isLight
                      ? 'bg-gradient-to-r from-amber-50 to-orange-50/60 border-amber-200 shadow-xs'
                      : 'bg-gradient-to-r from-amber-950/30 to-slate-900 border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-500" />
                        <h4 className={`text-xs font-black uppercase tracking-wider ${isLight ? 'text-amber-900' : 'text-amber-300'}`}>
                          Offer Your Price to Captains
                        </h4>
                      </div>
                      <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        Raise your offer to get accepted by nearby drivers faster
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Offer</span>
                      <span className="text-base font-black text-amber-600 dark:text-amber-400">
                        ₹{Number(activeRide.fare || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {raiseFareSuccess && (
                    <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{raiseFareSuccess}</span>
                    </div>
                  )}

                  {/* Quick Raise Chips */}
                  <div className="grid grid-cols-3 gap-2 pt-0.5">
                    {[10, 20, 50].map((extra) => (
                      <button
                        key={extra}
                        type="button"
                        id={`raise-offer-btn-${extra}`}
                        disabled={isRaisingFare}
                        onClick={() => handleRaiseRideFare(extra)}
                        className={`py-2 px-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 active:scale-95 ${
                          isLight
                            ? 'bg-white hover:bg-amber-500 hover:text-slate-950 text-slate-800 border-amber-300 shadow-xs'
                            : 'bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border-slate-700'
                        }`}
                      >
                        {isRaisingFare ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3 stroke-[3]" />}
                        <span>+₹{extra}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ================= RATING TO CAPTAIN AT LAST (COMPLETED STEP) ================= */}
          {activeRide.status === 'completed' && (
            <div
              id="passenger-rate-captain-card"
              className={`p-4 rounded-2xl border-2 shadow-xl space-y-4 animate-in zoom-in-95 duration-200 ${
                isLight
                  ? 'bg-gradient-to-b from-amber-50/80 via-white to-emerald-50/50 border-amber-300 shadow-amber-500/10'
                  : 'bg-gradient-to-b from-amber-950/40 via-slate-900 to-emerald-950/20 border-amber-500/40 shadow-black/40'
              }`}
            >
              <div className="text-center space-y-1">
                <div className="inline-flex p-2 rounded-2xl bg-amber-400/20 text-amber-500 mb-1">
                  <Star className="w-8 h-8 fill-amber-400 stroke-amber-500" />
                </div>
                <h3 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  {reviewSubmitted ? 'Rating Submitted!' : 'Rate Your Captain'}
                </h3>
                <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {reviewSubmitted
                    ? `Thank you for rating ${activeRide.captain_name || 'Captain'}!`
                    : `How was your ride with ${activeRide.captain_name || 'Captain Vikram Singh'}?`}
                </p>
              </div>

              {!reviewSubmitted ? (
                <div className="space-y-3 pt-1">
                  {/* Interactive 5-Star Selection */}
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="flex items-center justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          id={`passenger-star-${star}`}
                          onClick={() => setRatingStars(star)}
                          className="p-1 cursor-pointer transition-transform hover:scale-125 active:scale-95"
                          title={`${star} Star${star > 1 ? 's' : ''}`}
                        >
                          <Star
                            className={`w-8 h-8 transition-colors ${
                              star <= ratingStars
                                ? 'text-amber-400 fill-amber-400 drop-shadow-md'
                                : isLight
                                ? 'text-slate-300 hover:text-amber-300'
                                : 'text-slate-700 hover:text-amber-400'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-black text-amber-500">
                      {ratingStars === 5 && '⭐⭐⭐⭐⭐ Outstanding Ride!'}
                      {ratingStars === 4 && '⭐⭐⭐⭐ Very Good Ride'}
                      {ratingStars === 3 && '⭐⭐⭐ Good Trip'}
                      {ratingStars === 2 && '⭐⭐ Fair Experience'}
                      {ratingStars === 1 && '⭐ Poor Experience'}
                    </span>
                  </div>

                  {/* Compliment Badges */}
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Compliments (Tap to choose)
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        '🪖 Clean Helmet',
                        '⚡ On-Time Pickup',
                        '🛡️ Safe Driving',
                        '💬 Polite Captain',
                        '🏍️ Clean Bike',
                        '🧭 Great Route',
                      ].map((tag) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              setSelectedTags((prev) =>
                                isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                              );
                            }}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-xs'
                                : isLight
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Tip to Captain */}
                  <div className="space-y-1.5">
                    <label className={`text-[10px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Tip your Captain (100% goes to driver)
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[0, 10, 20, 30, 50].map((tip) => (
                        <button
                          key={tip}
                          type="button"
                          onClick={() => setTipAmount(tip)}
                          className={`py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            tipAmount === tip
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-xs'
                              : isLight
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          {tip === 0 ? 'No Tip' : `₹${tip}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feedback Note */}
                  <div>
                    <input
                      type="text"
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Leave a short note for Captain..."
                      className={`w-full px-3 py-2 text-xs rounded-xl border transition-colors ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-amber-500'
                          : 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500 focus:border-amber-500'
                      }`}
                    />
                  </div>

                  {/* Submit Rating Button */}
                  <button
                    type="button"
                    id="passenger-submit-rating-btn"
                    onClick={handleSubmitRating}
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-98 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Star className="w-4 h-4 fill-slate-950" />
                        <span>Submit Rating · {ratingStars} Stars{tipAmount > 0 ? ` (+₹${tipAmount} Tip)` : ''}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-center space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Rating Recorded Successfully</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Your {ratingStars}★ review has been recorded for Captain {activeRide.captain_name || 'Driver'}.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-1">
            {activeRide.status === 'requested' || activeRide.status === 'accepted' ? (
              <button
                id="uber-cancel-ride-btn"
                onClick={handleCancelRide}
                disabled={isSubmitting}
                className={`w-full py-3 border rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  isLight
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                    : 'bg-slate-900 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                }`}
              >
                <XCircle className="w-4 h-4" />
                Cancel Ride
              </button>
            ) : activeRide.status === 'completed' ? (
              <button
                id="uber-book-another-btn"
                onClick={handleBookAnother}
                className={`w-full py-3.5 font-black rounded-2xl text-xs sm:text-sm transition-all shadow-xl cursor-pointer ${
                  reviewSubmitted
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                    : isLight
                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                    : 'bg-white hover:bg-slate-200 text-slate-950'
                }`}
              >
                {reviewSubmitted ? 'Book Another MotoRide' : 'Skip & Book Another MotoRide'}
              </button>
            ) : activeRide.status === 'cancelled' ? (
              <button
                id="uber-book-another-btn"
                onClick={handleBookAnother}
                className={`w-full py-3.5 font-black rounded-2xl text-xs transition-colors shadow-xl cursor-pointer ${
                  isLight
                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                    : 'bg-white hover:bg-slate-200 text-slate-950'
                }`}
              >
                Book Another MotoRide
              </button>
            ) : null}
          </div>
        </div>
      )}
            </div>
          )}
        </div>
      </div>

      {/* In-Ride Chat Modal */}
      {activeRide && (
        <InRideChatModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          rideId={activeRide.id}
          currentUserRole="passenger"
          currentUserName={currentUser.name}
          otherPartyName={activeRide.captain_name || 'Captain'}
          otherPartyRole="Captain"
        />
      )}

      {/* Safety Toolkit Modal */}
      {activeRide && (
        <SafetyToolkitModal
          isOpen={isSafetyOpen}
          onClose={() => setIsSafetyOpen(false)}
          rideId={activeRide.id}
          pinCode={safetyPin}
          captainName={activeRide.captain_name || undefined}
          vehicleDetails={activeRide.captain_vehicle || undefined}
        />
      )}

      {/* Passenger Profile Modal / Page */}
      <PassengerProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={currentUser}
        onUpdateUser={(updated) => {
          setCurrentUser((prev) => ({ ...prev, ...updated }));
          updateUser('passenger', {
            name: updated.name,
            email: updated.email,
            phone: updated.phone,
          });
        }}
      />

      {/* Fare Calculator & Distance Analysis Modal */}
      <FareCalculatorModal
        isOpen={isCalculatorModalOpen}
        onClose={() => setIsCalculatorModalOpen(false)}
        breakdown={fareBreakdown}
        pickupLocation={pickup}
        dropoffLocation={dropoff}
        initialDistanceKm={distanceKm}
        initialEstimatedMins={estimatedMins}
        initialPickup={pickup}
        initialDropoff={dropoff}
        initialTierId={selectedTier}
        onApplySimulatedRoute={(simDist, simMins) => {
          handleRouteCalculated(simDist, simMins);
        }}
      />
    </div>
  );
};
