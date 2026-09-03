import React, { useState, useEffect, useRef } from 'react';
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
  Wallet,
  Check,
  ChevronRight,
  Radio,
  SlidersHorizontal,
  Flame,
  KeyRound,
  Share2,
  User,
  Camera,
  Calculator,
  ArrowUpDown,
  TrendingUp,
  QrCode,
  Banknote,
  Settings,
  Bell,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
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
  subscribeToPassengerRide,
  unsubscribeChannel,
  subscribeToRideOffers,
  getStoredRideOffers,
  acceptCaptainOffer,
  declineCaptainOffer,
  subscribeToCaptainSkipEvents,
} from '../services/rideService';
import { isSupabaseConfigured } from '../lib/supabase';
import { InRideChatModal } from './InRideChatModal';
import { SafetyToolkitModal } from './SafetyToolkitModal';
import { PassengerProfileModal } from './PassengerProfileModal';
import { FareCalculatorModal } from './FareCalculatorModal';
import { FareBreakdown, calculateEstimatedRoute, calculateMotoFare } from '../utils/fareCalculator';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SERVICE_ZONES, ServiceZone, detectZoneForLocation, resolveLocationCoords, LatLng } from '../utils/geoUtils';
import { useTheme } from '../context/ThemeContext';
import { usePricing } from '../context/PricingContext';
import { GoogleLocationSearchInput } from './GoogleLocationSearchInput';

interface PassengerAppProps {
  passengerUser?: UserProfile;
  onOpenSqlModal?: () => void;
}

const getStoredPassengerId = () => {
  let id = localStorage.getItem('motoride_passenger_uuid');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
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
    name: 'Comfort Moto',
    tagline: 'Comfort bike • Clean helmet included',
    multiplier: 1.0,
    icon: '🛵',
    etaMinsBonus: 0,
    popular: true,
  },
  {
    id: 'moto_delivery',
    name: 'Moto Courier',
    tagline: 'Package & parcel courier delivery',
    multiplier: 0.85,
    icon: '📦',
    etaMinsBonus: 1,
  },
];

export const PassengerApp: React.FC<PassengerAppProps> = ({
  passengerUser = {
    id: getStoredPassengerId(),
    name: 'Sarah Jenkins',
    phone: '+1 (555) 392-1049',
    role: 'passenger',
    rating: 4.94,
  },
  onOpenSqlModal,
}) => {
  const [pickup, setPickup] = useState<string>('');
  const [dropoff, setDropoff] = useState<string>('');
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<LatLng | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>('moto_comfort');
  const [bookingMode] = useState<'indrive'>('indrive');
  const [customBidFare, setCustomBidFare] = useState<number>(0);
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
  const [currentUser, setCurrentUser] = useState<UserProfile>(passengerUser);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<string>('idle');
  const [captainArrivedNotice, setCaptainArrivedNotice] = useState<{ captainName: string; time: string } | null>(null);

  useEffect(() => {
    if (passengerUser) {
      setCurrentUser(passengerUser);
    }
  }, [passengerUser]);

  // Captain Offers State for Mutual Bidding Acceptance
  const [captainOffers, setCaptainOffers] = useState<CaptainOffer[]>([]);
  const [isAcceptingOfferId, setIsAcceptingOfferId] = useState<string | null>(null);

  const { isLight } = useTheme();
  const { pricing, calculateFare } = usePricing();

  // Modals & Post-Ride Feedback
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [tipAmount, setTipAmount] = useState<number>(2);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Safe Driving', 'Clean Helmet']);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const headerAvatarInputRef = useRef<HTMLInputElement>(null);

  const handleHeaderAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (typeof event.target?.result === 'string') {
            setCurrentUser((prev) => ({ ...prev, avatar_url: event.target?.result as string }));
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Recalculate estimated route and fare whenever pickup, dropoff, selectedTier or admin pricing changes
  useEffect(() => {
    if (!pickup.trim() || !dropoff.trim()) {
      setDistanceKm(0);
      setEstimatedMins(0);
      setBaseCalculatedFare(0);
      setCustomBidFare(0);
      setIsAccurateRoute(false);
      return;
    }

    const route = calculateEstimatedRoute(pickup, dropoff);
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
    setCustomBidFare(breakdown.totalFare);
  }, [pickup, dropoff, selectedTier, pricing]);

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
    // Keep custom inDrive bid updated if at default or 0
    setCustomBidFare((prev) => (prev <= 0 || prev <= breakdown.baseFare ? breakdown.totalFare : prev));
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
      if (!isSupabaseConfigured()) return;
      const { data } = await fetchActiveRideForPassenger(passengerUser.id);
      if (isMounted && data) {
        setActiveRide(data);
      } else if (isMounted) {
        // Also check if the latest ride was completed recently and not yet rated
        const { data: latest } = await fetchLatestRideForPassenger(passengerUser.id);
        if (latest && latest.status === 'completed') {
          const isRated = localStorage.getItem(`motoride_rating_${latest.id}`);
          if (!isRated) {
            setActiveRide(latest);
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
      if (!isSupabaseConfigured()) return;
      const { data } = await fetchRideById(currentActiveRideId);
      if (data) {
        if (data.status !== activeRide.status) {
          if (data.status === 'arrived' && activeRide.status !== 'arrived') {
            playCaptainArrivedChime();
            setCaptainArrivedNotice({
              captainName: data.captain_name || 'Your Captain',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            });
          }
          setActiveRide(data);
          if (data.status === 'completed') {
            try {
              confetti({ particleCount: 90, spread: 100, origin: { y: 0.5 } });
            } catch (e) {}
          }
        }

        // Also sync captain offers if available in DB or localStorage
        if (Array.isArray((data as any).captain_offers) && (data as any).captain_offers.length > 0) {
          setCaptainOffers((data as any).captain_offers);
        } else {
          const stored = getStoredRideOffers(currentActiveRideId);
          if (stored.length > 0) {
            setCaptainOffers(stored);
          }
        }
      }
    }, 1500);

    return () => {
      clearInterval(pollInterval);
      if (channelRef.current) {
        unsubscribeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [activeRide?.id, activeRide?.status, passengerUser?.id]);

  // Subscribe to Captain Offers when activeRide is requested (Mutual Acceptance Flow)
  useEffect(() => {
    if (!activeRide?.id || activeRide.status !== 'requested') {
      setCaptainOffers([]);
      return;
    }

    const unsubscribe = subscribeToRideOffers(activeRide.id, (offers) => {
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
    const unsubArrived = subscribeToCaptainArrivedBroadcasts((arrivedRide) => {
      if (activeRide && arrivedRide?.id === activeRide.id) {
        playCaptainArrivedChime();
        setCaptainArrivedNotice({
          captainName: arrivedRide.captain_name || activeRide.captain_name || 'Your Captain',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
    });

    return () => {
      unsubArrived();
    };
  }, [activeRide?.id, activeRide?.captain_name]);

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

  // Safety PIN generated per ride ID
  const safetyPin = getRidePin(activeRide?.id);

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

    if (!isSupabaseConfigured()) {
      setErrorMessage('Supabase is not configured. Please verify your Supabase URL & Key.');
      return;
    }

    setIsSubmitting(true);
    const finalFare = bookingMode === 'indrive' ? customBidFare : baseCalculatedFare;
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
    setActiveRide(null);
    setPickup('');
    setDropoff('');
    setPickupCoords(null);
    setDropoffCoords(null);
    setErrorMessage(null);
    setReviewSubmitted(false);
  };

  return (
    <div
      id="uber-passenger-root"
      className={`w-full max-w-md sm:max-w-lg mx-auto border rounded-3xl overflow-hidden flex flex-col font-sans transition-colors duration-200 ${
        isLight
          ? 'bg-white border-slate-200 text-slate-900 shadow-xl'
          : 'bg-[#07090e] border-slate-800 text-slate-100 shadow-2xl'
      }`}
    >
      {/* Top Mobile Status Header Bar */}
      <div
        className={`px-4 py-3 border-b flex items-center justify-between transition-colors duration-200 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#0b0f19] border-slate-800'
        }`}
      >
        {/* Hidden file input for fast avatar upload from header */}
        <input
          ref={headerAvatarInputRef}
          type="file"
          accept="image/*"
          onChange={handleHeaderAvatarChange}
          className="hidden"
          id="passenger-header-avatar-input"
        />

        <div className="flex items-center gap-2.5">
          <div className="relative group">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="cursor-pointer block"
              title="Open Passenger Profile & Photo"
            >
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-xl object-cover border border-emerald-500/50 shadow-md group-hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black text-sm shadow-md group-hover:scale-105 transition-transform">
                  {currentUser.name.charAt(0)}
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
                  ? 'bg-white hover:bg-emerald-500 text-slate-700 hover:text-white border-slate-300'
                  : 'bg-slate-900 hover:bg-emerald-500 text-slate-300 hover:text-slate-950 border-slate-700'
              }`}
              title="Upload profile picture"
            >
              <Camera className="w-2.5 h-2.5" />
            </button>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className={`font-black text-sm tracking-tight ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                {currentUser.name}
              </span>
            </div>
            <p className={`text-[11px] flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>
                Verified Rider
              </span>
              <span className="text-amber-500 font-bold flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-amber-400 inline" /> {currentUser.rating || 4.94}
              </span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
        </div>
      </div>

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
        <div className="flex flex-col space-y-3 p-4">
          <form onSubmit={handleBookRide} className="space-y-3.5">
            {/* Pickup & Destination Inputs (Google Search Integrated) */}
            <div
              className={`border rounded-2xl p-3 space-y-2.5 relative transition-colors ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
              }`}
            >
              {/* Pickup Google Location Search */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                    <span>Pickup Location</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-600 flex items-center justify-center text-[10px] font-black shrink-0">
                    ●
                  </div>
                  <div className="flex-1">
                    <GoogleLocationSearchInput
                      type="pickup"
                      value={pickup}
                      placeholder="Search Google Maps for Pickup location..."
                      required
                      referenceCoords={pickupCoords}
                      onChange={(val, coords) => {
                        setPickup(val);
                        if (coords) {
                          setPickupCoords(coords);
                        } else if (val && val.trim() !== '') {
                          setPickupCoords(resolveLocationCoords(val));
                        } else {
                          setPickupCoords(null);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Divider with Swap Button */}
              <div className="relative flex items-center justify-center py-0.5">
                <div className={`w-full h-px ml-8 mr-8 ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
                <button
                  type="button"
                  onClick={handleSwapLocations}
                  title="Swap Pickup & Drop-off"
                  className={`absolute right-2 p-1.5 rounded-full border transition-all hover:rotate-180 duration-300 cursor-pointer shadow-xs ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  <ArrowUpDown className="w-3 h-3 text-emerald-500" />
                </button>
              </div>

              {/* Dropoff Google Location Search */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-500/20" />
                    <span>Drop-off Destination</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-rose-500/20 border border-rose-500/50 text-rose-500 flex items-center justify-center text-[10px] font-black shrink-0">
                    ■
                  </div>
                  <div className="flex-1">
                    <GoogleLocationSearchInput
                      type="dropoff"
                      value={dropoff}
                      placeholder="Search Google Maps for Destination..."
                      required
                      referenceCoords={pickupCoords}
                      onChange={(val, coords) => {
                        setDropoff(val);
                        if (coords) {
                          setDropoffCoords(coords);
                        } else if (val && val.trim() !== '') {
                          setDropoffCoords(resolveLocationCoords(val));
                        } else {
                          setDropoffCoords(null);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Location Suggestion Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <span className={`text-[10px] font-bold shrink-0 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                POPULAR:
              </span>
              {DEFAULT_DROPOFFS.slice(0, 4).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    setDropoff(loc);
                    setDropoffCoords(resolveLocationCoords(loc));
                  }}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  {loc.split(',')[0]}
                </button>
              ))}
            </div>

            {/* Distance & Fare Calculation Summary Badge */}
            {(() => {
              const activeTierConfig = selectedTier === 'moto_delivery' ? pricing.tierPricing.moto_delivery : pricing.tierPricing.moto_comfort;
              const hasRoute = Boolean(pickup.trim() && dropoff.trim() && distanceKm > 0);
              return (
                <div
                  className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 text-xs transition-colors ${
                    isLight ? 'bg-emerald-50/60 border-emerald-200/70 text-slate-800' : 'bg-emerald-950/20 border-emerald-500/20 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 font-bold shrink-0">
                      <Navigation className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs text-emerald-700 dark:text-emerald-400">
                          {hasRoute ? `${distanceKm} km` : '— km'}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500">
                          {hasRoute ? `(~${estimatedMins} mins)` : '(Awaiting locations)'}
                        </span>
                        {isAccurateRoute && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                            ROAD GPS
                          </span>
                        )}
                      </div>
                      <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {hasRoute ? activeTierConfig.name : 'Enter pickup & drop-off to calculate fare'}
                        {hasRoute && pricing.surgeMultiplier > 1.0 && (
                          <span className="ml-1 text-amber-500 font-bold">({pricing.surgeMultiplier}x Surge)</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Recommended</span>
                    <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                      {hasRoute ? `₹${baseCalculatedFare.toFixed(2)}` : '—'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Ride Tier Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Choose Motoride Booking Category
                </span>
                <span className={`text-[10px] font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {distanceKm > 0 ? `Rates for ${distanceKm} km` : 'Fares calculated on entry'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {RIDE_TIERS.map((tier) => {
                  const isSelected = selectedTier === tier.id;
                  const tierConfig = tier.id === 'moto_delivery' ? pricing.tierPricing.moto_delivery : pricing.tierPricing.moto_comfort;
                  const hasRoute = Boolean(pickup.trim() && dropoff.trim() && distanceKm > 0);
                  const tierFareObj = calculateFare({
                    distanceKm: distanceKm || 1.5,
                    estimatedMins: estimatedMins || 5,
                    tierId: tier.id,
                    tierName: tierConfig.name,
                    pickupLocation: pickup,
                    isAccurateRoute,
                  });
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setSelectedTier(tier.id)}
                      className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? isLight
                            ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                            : 'bg-slate-800 border-emerald-400 ring-2 ring-emerald-500/20 shadow-lg'
                          : isLight
                          ? 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300 text-slate-600'
                          : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-2xl">{tierConfig.icon || tier.icon}</span>
                        {tier.popular ? (
                          <span className="text-[8px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-black px-1.5 py-0.5 rounded">
                            RECOMMENDED
                          </span>
                        ) : (
                          <span className="text-[8px] bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold px-1.5 py-0.5 rounded">
                            COURIER
                          </span>
                        )}
                      </div>
                      <div>
                        <span className={`text-xs font-black block leading-tight ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                          {tierConfig.name}
                        </span>
                        <span className={`text-xs font-black mt-0.5 block ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                          {hasRoute ? `₹${tierFareObj.totalFare.toFixed(2)}` : `From ₹${tierConfig.baseFare.toFixed(2)}`}
                        </span>
                        <span className={`text-[10px] block mt-0.5 truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          {tierConfig.tagline || tier.tagline}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* inDrive Bidding Controls (Always Active) */}
            <div
              className={`p-3.5 border rounded-2xl space-y-2.5 transition-colors ${
                isLight
                  ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 shadow-sm'
                  : 'bg-gradient-to-r from-emerald-950/40 to-slate-900 border-emerald-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-xs font-black flex items-center gap-1 ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>
                    <Flame className="w-3.5 h-3.5 text-amber-500" />
                    Offer Your Price to Captains
                  </span>
                  <p className={`text-[10px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {pickup.trim() && dropoff.trim() && baseCalculatedFare > 0
                      ? `Suggested Fair Price: ₹${baseCalculatedFare.toFixed(2)} for ${distanceKm} km`
                      : 'Fill pickup & drop-off to compute fair fare'}
                    {pickup.trim() && dropoff.trim() && pricing.surgeMultiplier > 1.0 && (
                      <span className="ml-1 text-amber-600 font-bold">({pricing.surgeMultiplier}x Surge Active)</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-amber-600">
                    {customBidFare > 0 ? `₹${customBidFare.toFixed(2)}` : '—'}
                  </span>
                </div>
              </div>

              {/* Counter buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={!pickup.trim() || !dropoff.trim()}
                  onClick={() => setCustomBidFare((prev) => Math.max(25.0, Number((prev - 5.0).toFixed(2))))}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <Minus className="w-3.5 h-3.5" /> - ₹5
                </button>

                <button
                  type="button"
                  disabled={!pickup.trim() || !dropoff.trim()}
                  onClick={() => setCustomBidFare(baseCalculatedFare)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 text-emerald-700 border-emerald-200 font-black'
                      : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700 font-black'
                  }`}
                >
                  Fair ({baseCalculatedFare > 0 ? `₹${baseCalculatedFare.toFixed(2)}` : '—'})
                </button>

                <button
                  type="button"
                  disabled={!pickup.trim() || !dropoff.trim()}
                  onClick={() => setCustomBidFare((prev) => Number((prev + 5.0).toFixed(2)))}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" /> + ₹5
                </button>
              </div>
            </div>

            {/* Payment Mode (UPI or Cash Only) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Payment Mode
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {paymentMethod === 'upi' ? '⚡ Instant UPI QR' : '💵 Pay Driver Directly'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* UPI Option */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('upi')}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    paymentMethod === 'upi'
                      ? isLight
                        ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-slate-800 border-emerald-400 ring-2 ring-emerald-500/20 shadow-md'
                      : isLight
                      ? 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300 text-slate-600'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      paymentMethod === 'upi'
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                        : isLight
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black block leading-tight ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        UPI
                      </span>
                      {paymentMethod === 'upi' && (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <span className={`text-[10px] block mt-0.5 truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      GPay / PhonePe / Paytm
                    </span>
                  </div>
                </button>

                {/* Cash Option */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    paymentMethod === 'cash'
                      ? isLight
                        ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-slate-800 border-emerald-400 ring-2 ring-emerald-500/20 shadow-md'
                      : isLight
                      ? 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300 text-slate-600'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                        : isLight
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black block leading-tight ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        Cash
                      </span>
                      {paymentMethod === 'cash' && (
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <span className={`text-[10px] block mt-0.5 truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Pay on Drop
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Main Booking Action Button */}
            <button
              id="indrive-book-ride-btn"
              type="submit"
              disabled={isSubmitting || !pickup.trim() || !dropoff.trim()}
              className={`w-full py-4 px-4 font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xl transition-all transform active:scale-[0.99] ${
                !pickup.trim() || !dropoff.trim()
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none border border-slate-300 dark:border-slate-700'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/25 cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Broadcasting Offer to Nearby Captains...
                </>
              ) : !pickup.trim() || !dropoff.trim() ? (
                <>
                  <span>Enter Pickup & Destination to Request</span>
                  <ArrowRight className="w-4 h-4 opacity-40" />
                </>
              ) : (
                <>
                  <span>Request Ride for ₹{customBidFare.toFixed(2)}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
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

          {/* Top Prominent Rating & Review Section when ride is completed */}
          {activeRide.status === 'completed' && !reviewSubmitted && (
            <div
              className={`p-4 border-2 rounded-2xl space-y-3.5 animate-in zoom-in-95 shadow-xl ${
                isLight ? 'bg-gradient-to-b from-amber-50 to-emerald-50/70 border-emerald-400 text-slate-900' : 'bg-gradient-to-b from-slate-900 to-emerald-950/40 border-emerald-500/60 text-slate-100'
              }`}
            >
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-xs shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ride Completed · Rate Captain</span>
                </div>
                <h3 className={`text-base font-black ${isLight ? 'text-slate-950' : 'text-emerald-200'}`}>
                  How was your ride with {activeRide.captain_name || 'your Captain'}?
                </h3>
                <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Please rate your captain to finalize your trip summary
                </p>
              </div>

              {/* Star Rating Selector */}
              <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingStars(star)}
                      className="p-1.5 transition-transform hover:scale-125 active:scale-95 cursor-pointer focus:outline-none"
                      title={`${star} Star${star > 1 ? 's' : ''}`}
                    >
                      <Star
                        className={`w-9 h-9 sm:w-10 sm:h-10 transition-all ${
                          star <= ratingStars
                            ? 'fill-amber-400 text-amber-400 drop-shadow-md scale-110'
                            : isLight
                            ? 'text-slate-300 hover:text-amber-300'
                            : 'text-slate-700 hover:text-amber-400/50'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-black text-amber-500">
                  {ratingStars === 5
                    ? '★★★★★ 5.0 · Exceptional Experience!'
                    : ratingStars === 4
                    ? '★★★★☆ 4.0 · Great Trip'
                    : ratingStars === 3
                    ? '★★★☆☆ 3.0 · Average Experience'
                    : ratingStars === 2
                    ? '★★☆☆☆ 2.0 · Needs Improvement'
                    : '★☆☆☆☆ 1.0 · Poor Experience'}
                </span>
              </div>

              {/* Feedback Quick Compliment Chips */}
              <div className="space-y-1.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider block text-center ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Compliments & Feedback
                </span>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {[
                    'Safe Driving',
                    'Clean Helmet',
                    'Smooth Navigation',
                    'Polite Captain',
                    'On-Time Pickup',
                    'Great Route',
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                            : isLight
                            ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        {isSelected ? `✓ ${tag}` : `+ ${tag}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add Driver Tip */}
              <div className="space-y-1 text-center pt-1">
                <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Add a Captain Tip (Optional)
                </span>
                <div className="flex items-center justify-center gap-2">
                  {[0, 10, 20, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTipAmount(amt)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        tipAmount === amt
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black'
                          : isLight
                          ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          : 'bg-slate-900 text-slate-300 border-slate-700'
                      }`}
                    >
                      {amt === 0 ? 'No Tip' : `+₹${amt}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback Note */}
              <div>
                <input
                  type="text"
                  placeholder="Leave a note for the captain (optional)..."
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-xs rounded-xl border focus:outline-none focus:border-emerald-500 ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                      : 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500'
                  }`}
                />
              </div>

              {/* Submit Feedback and Complete */}
              <button
                type="button"
                onClick={handleSubmitRating}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Star className="w-4 h-4 fill-slate-950 text-slate-950" />
                )}
                <span>Submit {ratingStars}-Star Rating & Finish Ride</span>
              </button>
            </div>
          )}

          {/* Post-Review Thank You Card */}
          {activeRide.status === 'completed' && reviewSubmitted && (
            <div
              className={`p-4 border rounded-2xl space-y-2 text-center animate-in zoom-in-95 ${
                isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              }`}
            >
              <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
                <Check className="w-6 h-6 stroke-[3]" />
              </div>
              <h4 className="font-black text-sm">Thank you for rating your Captain!</h4>
              <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                You rated {activeRide.captain_name || 'Captain'} {ratingStars} ★ {tipAmount > 0 ? `with a ₹${tipAmount} tip` : ''}.
              </p>
            </div>
          )}

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

          {/* Captain Card (Uber Driver Profile Style) */}
          {activeRide.captain_id ? (
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
                      {activeRide.captain_vehicle || 'Yamaha MT-07 · Black #7492'}
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
                  onClick={() => setIsChatOpen(true)}
                  className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors relative cursor-pointer ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-sky-500" />
                  Chat
                  <span className="w-2 h-2 rounded-full bg-sky-500 absolute top-1.5 right-2" />
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
                                  {offer.captain_vehicle || 'Yamaha MT-07'} · ~{offer.eta_minutes || 3}m away
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
              /* Searching State Radar Card */
              <div
                className={`border p-4 rounded-2xl flex items-center gap-3 animate-pulse transition-colors ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-500 flex items-center justify-center">
                  <Radio className="w-5 h-5 animate-spin" />
                </div>
                <div className="flex-1">
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
            );
          })()}

          {/* Stepper Progress Bar */}
          <div
            className={`p-3 rounded-2xl border space-y-1.5 transition-colors ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'
            }`}
          >
            <div className={`flex items-center justify-between text-[10px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <span className={activeRide.status === 'requested' ? 'text-amber-500' : 'text-emerald-500'}>1. Match</span>
              <span className={activeRide.status === 'accepted' ? 'text-amber-500' : ['arrived', 'started', 'completed'].includes(activeRide.status) ? 'text-emerald-500' : ''}>2. En Route</span>
              <span className={activeRide.status === 'arrived' ? 'text-amber-500' : ['started', 'completed'].includes(activeRide.status) ? 'text-emerald-500' : ''}>3. Arrived</span>
              <span className={activeRide.status === 'started' ? 'text-amber-500' : activeRide.status === 'completed' ? 'text-emerald-500' : ''}>4. Trip</span>
              <span className={activeRide.status === 'completed' ? 'text-emerald-500' : ''}>5. Done</span>
            </div>
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
                    ? 'bg-indigo-500 w-3/5'
                    : activeRide.status === 'started'
                    ? 'bg-purple-500 w-4/5'
                    : 'bg-emerald-500 w-full'
                }`}
              />
            </div>
          </div>

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
        onUpdateUser={(updated) => setCurrentUser((prev) => ({ ...prev, ...updated }))}
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
