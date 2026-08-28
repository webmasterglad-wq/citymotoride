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
  Loader2,
  Compass,
  Bike,
  Shield,
  ArrowRight,
  Sparkles,
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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Ride, RideStatus, UserProfile, RideTier, PaymentMethodType } from '../types/ride';
import {
  createRideBooking,
  fetchActiveRideForPassenger,
  updateRideStatus,
  subscribeToPassengerRide,
  unsubscribeChannel,
} from '../services/rideService';
import { isSupabaseConfigured } from '../lib/supabase';
import { MapMockup } from './MapMockup';
import { InRideChatModal } from './InRideChatModal';
import { SafetyToolkitModal } from './SafetyToolkitModal';
import { PassengerProfileModal } from './PassengerProfileModal';
import { RealtimeChannel } from '@supabase/supabase-js';

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
  'Downtown Metro Station, 4th & Market St',
  'Civic Center Plaza, Grove St',
  'Union Square Shopping District',
  'Mission District · 24th Street',
  'Financial District · California St',
];

const DEFAULT_DROPOFFS = [
  'Mission Bay Tech Center, 16th St',
  'Marina Green Promenade, Marina Blvd',
  'Golden Gate Park · Conservatory of Flowers',
  'Fisherman’s Wharf · Pier 39',
  'SOMA Arts Center, Folsom St',
];

const RIDE_TIERS: RideTier[] = [
  {
    id: 'moto_standard',
    name: 'Moto Standard',
    tagline: 'Fastest & most popular',
    multiplier: 1.0,
    icon: '🏍️',
    etaMinsBonus: 0,
    popular: true,
  },
  {
    id: 'moto_comfort',
    name: 'Moto Comfort',
    tagline: 'Premium bike & clean helmet',
    multiplier: 1.25,
    icon: '🛵',
    etaMinsBonus: 1,
  },
  {
    id: 'moto_delivery',
    name: 'Moto Courier',
    tagline: 'Package or document drop',
    multiplier: 0.85,
    icon: '📦',
    etaMinsBonus: 2,
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
  const [pickup, setPickup] = useState(DEFAULT_PICKUPS[0]);
  const [dropoff, setDropoff] = useState(DEFAULT_DROPOFFS[0]);
  const [selectedTier, setSelectedTier] = useState<string>('moto_standard');
  const [bookingMode, setBookingMode] = useState<'instant' | 'indrive'>('instant');
  const [customBidFare, setCustomBidFare] = useState<number>(14.5);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('wallet');

  const [baseCalculatedFare, setBaseCalculatedFare] = useState<number>(14.5);
  const [distanceKm, setDistanceKm] = useState<number>(4.8);
  const [estimatedMins, setEstimatedMins] = useState<number>(12);

  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile>(passengerUser);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<string>('idle');

  // Modals
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [tipAmount, setTipAmount] = useState<number>(2);
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

  // Recalculate base fare when pickup/dropoff or tier changes
  useEffect(() => {
    const base = 5.0;
    const perKm = 2.0;
    const pseudoDistance = Math.max(2.1, ((pickup.length + dropoff.length) % 7) + 2.5);
    const tierObj = RIDE_TIERS.find((t) => t.id === selectedTier) || RIDE_TIERS[0];
    const rawFare = (base + pseudoDistance * perKm) * tierObj.multiplier;
    const fare = Number(rawFare.toFixed(2));
    
    setBaseCalculatedFare(fare);
    setCustomBidFare(fare);
    setDistanceKm(Number(pseudoDistance.toFixed(1)));
    setEstimatedMins(Math.round(pseudoDistance * 2.5 + 4) + tierObj.etaMinsBonus);
  }, [pickup, dropoff, selectedTier]);

  // Load existing active ride on mount
  useEffect(() => {
    let isMounted = true;
    const loadInitialRide = async () => {
      if (!isSupabaseConfigured()) return;
      const { data } = await fetchActiveRideForPassenger(passengerUser.id);
      if (isMounted && data) {
        setActiveRide(data);
      }
    };
    loadInitialRide();
    return () => {
      isMounted = false;
    };
  }, [passengerUser.id]);

  // Realtime Subscription
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

    // Polling fallback to keep ride state fresh during socket reconnects
    const pollInterval = setInterval(async () => {
      if (!isSupabaseConfigured() || !passengerUser?.id) return;
      const { data } = await fetchActiveRideForPassenger(passengerUser.id);
      if (data) {
        setActiveRide(data);
      }
    }, 3500);

    return () => {
      clearInterval(pollInterval);
      if (channelRef.current) {
        unsubscribeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [activeRide?.id, passengerUser?.id]);

  // Safety PIN generated per ride ID
  const safetyPin = activeRide ? `${(Math.abs(activeRide.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 9000) + 1000}` : '4829';

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

  const handleBookAnother = () => {
    setActiveRide(null);
    setErrorMessage(null);
    setReviewSubmitted(false);
  };

  return (
    <div id="uber-passenger-root" className="w-full max-w-md sm:max-w-lg mx-auto bg-[#07090e] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col font-sans">
      {/* Top Mobile Status Header Bar */}
      <div className="bg-[#0b0f19] px-4 py-3 border-b border-slate-800 flex items-center justify-between">
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
              className="absolute -bottom-1 -right-1 p-0.5 bg-slate-900 hover:bg-emerald-500 text-slate-300 hover:text-slate-950 rounded-full border border-slate-700 shadow transition-colors cursor-pointer"
              title="Upload profile picture"
            >
              <Camera className="w-2.5 h-2.5" />
            </button>
          </div>

          <button
            onClick={() => setIsProfileOpen(true)}
            className="text-left group cursor-pointer hover:opacity-90 transition-opacity"
            title="Open Passenger Profile"
          >
            <div className="flex items-center gap-1.5">
              <span className="font-black text-sm text-slate-100 tracking-tight">{currentUser.name}</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-500/30">
                PROFILE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <span className="text-slate-300 group-hover:text-emerald-400 transition-colors">View Account</span>
              <span className="text-amber-400 font-bold flex items-center gap-0.5">
                <Star className="w-2.5 h-2.5 fill-amber-400 inline" /> {currentUser.rating || 4.94}
              </span>
            </p>
          </button>
        </div>

        {/* Action Controls: Profile + Wallet */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsProfileOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-700/80 px-2.5 py-1 rounded-full flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer transition-colors"
            title="Wallet & Balance"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-black text-emerald-300">₹84.50</span>
          </button>
          <button
            id="passenger-profile-btn"
            onClick={() => setIsProfileOpen(true)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Passenger Profile & Settings"
          >
            <User className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Database Error Banner */}
      {errorMessage && (
        <div className="m-3 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
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
        /* ================= UBER / INDRIVE BOOKING INTERFACE ================= */
        <div className="flex flex-col space-y-3 p-4">
          {/* Uber Vector Map Preview */}
          <MapMockup
            pickupLocation={pickup}
            dropoffLocation={dropoff}
            distanceKm={distanceKm}
            estimatedMins={estimatedMins}
            heightClass="h-48 sm:h-56"
          />

          {/* Mode Tabs: Uber Instant vs inDrive Bidding */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900/90 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setBookingMode('instant')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                bookingMode === 'instant'
                  ? 'bg-slate-800 text-white shadow-md border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Uber Fixed Price
            </button>

            <button
              type="button"
              onClick={() => setBookingMode('indrive')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                bookingMode === 'indrive'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-300" />
              inDrive Custom Offer
            </button>
          </div>

          <form onSubmit={handleBookRide} className="space-y-3.5">
            {/* Pickup & Destination Inputs (Uber Pill Card) */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 space-y-2.5 relative">
              {/* Pickup */}
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 flex items-center justify-center text-[10px] font-black shrink-0">
                  ●
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    required
                    value={pickup}
                    onChange={(e) => setPickup(e.target.value)}
                    placeholder="Pickup location"
                    className="w-full bg-transparent text-xs font-semibold text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="w-full h-px bg-slate-800 ml-8" />

              {/* Dropoff */}
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-rose-500/20 border border-rose-500/50 text-rose-400 flex items-center justify-center text-[10px] font-black shrink-0">
                  ■
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    required
                    value={dropoff}
                    onChange={(e) => setDropoff(e.target.value)}
                    placeholder="Where to? (Destination)"
                    className="w-full bg-transparent text-xs font-semibold text-slate-100 placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Quick Location Suggestion Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <span className="text-[10px] text-slate-500 font-bold shrink-0">POPULAR:</span>
              {DEFAULT_DROPOFFS.slice(0, 3).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setDropoff(loc)}
                  className="text-[10px] px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  {loc.split(',')[0]}
                </button>
              ))}
            </div>

            {/* Ride Tier Selection (Uber Style) */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Choose Vehicle Category
              </span>
              <div className="grid grid-cols-3 gap-2">
                {RIDE_TIERS.map((tier) => {
                  const isSelected = selectedTier === tier.id;
                  const price = (baseCalculatedFare * tier.multiplier / (RIDE_TIERS.find(t=>t.id===selectedTier)?.multiplier || 1)).toFixed(2);
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setSelectedTier(tier.id)}
                      className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                        isSelected
                          ? 'bg-slate-800 border-emerald-400 ring-2 ring-emerald-500/20 shadow-lg'
                          : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xl">{tier.icon}</span>
                        {tier.popular && (
                          <span className="text-[8px] bg-amber-400/20 text-amber-300 font-black px-1.5 py-0.2 rounded">
                            FAST
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-100 block leading-tight">
                          {tier.name.split(' ')[1]}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-black mt-0.5 block">
                          ₹{price}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* inDrive Bidding Controls (When inDrive Mode active) */}
            {bookingMode === 'indrive' && (
              <div className="p-3.5 bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-2xl space-y-2.5 animate-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-emerald-300 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      Offer Your Price to Captains
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Drivers will accept or make a counter-offer.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-amber-400">₹{customBidFare.toFixed(2)}</span>
                  </div>
                </div>

                {/* Counter buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCustomBidFare((prev) => Math.max(8.0, Number((prev - 1.0).toFixed(2))))}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <Minus className="w-3.5 h-3.5" /> - ₹1.00
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustomBidFare(baseCalculatedFare)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-[10px] font-bold border border-slate-700 transition-colors"
                  >
                    Fair (₹{baseCalculatedFare.toFixed(2)})
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustomBidFare((prev) => Number((prev + 1.0).toFixed(2)))}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> + ₹1.00
                  </button>
                </div>
              </div>
            )}

            {/* Payment Method Selector Bar */}
            <div className="flex items-center justify-between p-3 bg-slate-900/60 border border-slate-800 rounded-2xl text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">Moto Wallet · ₹84.50</span>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                Auto-Pay
              </span>
            </div>

            {/* Main Booking Action Button */}
            <button
              id="uber-book-ride-btn"
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 px-4 font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-xl transition-all transform active:scale-[0.99] cursor-pointer ${
                bookingMode === 'indrive'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-emerald-500/25'
                  : 'bg-white hover:bg-slate-200 text-slate-950 shadow-white/10'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Broadcasting to Nearby Captains...
                </>
              ) : bookingMode === 'indrive' ? (
                <>
                  <span>Request Ride for ₹{customBidFare.toFixed(2)}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Confirm MotoRide · ₹{baseCalculatedFare.toFixed(2)}</span>
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
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  RIDE #{activeRide.id.slice(0, 6)}
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <h2 className="text-base font-black text-slate-100 mt-0.5">
                {activeRide.status === 'requested' && 'Searching for Nearby Captains...'}
                {activeRide.status === 'accepted' && 'Captain is on the Way (ETA ~3m)'}
                {activeRide.status === 'arrived' && 'Captain has Arrived at Pickup!'}
                {activeRide.status === 'started' && 'En Route to Destination'}
                {activeRide.status === 'completed' && 'You have Arrived!'}
                {activeRide.status === 'cancelled' && 'Ride Request Cancelled'}
              </h2>
            </div>
            <div className="text-right">
              <span className="text-base font-black text-emerald-400">
                ₹{activeRide.fare ? Number(activeRide.fare).toFixed(2) : baseCalculatedFare.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Full Interactive Navigation Map */}
          <MapMockup
            pickupLocation={activeRide.pickup_location}
            dropoffLocation={activeRide.dropoff_location}
            status={activeRide.status}
            captainName={activeRide.captain_name || undefined}
            distanceKm={activeRide.distance_km || distanceKm}
            estimatedMins={activeRide.estimated_mins || estimatedMins}
            heightClass="h-56 sm:h-64"
          />

          {/* Captain Card (Uber Driver Profile Style) */}
          {activeRide.captain_id ? (
            <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-black text-2xl shadow-md">
                    🏍️
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-100 flex items-center gap-1.5">
                      {activeRide.captain_name || 'Captain Driver'}
                      <span className="text-[11px] font-bold text-amber-400 flex items-center">
                        ★ {activeRide.captain_rating || 4.96}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-300 font-medium">
                      {activeRide.captain_vehicle || 'Yamaha MT-07 · Black #7492'}
                    </p>
                  </div>
                </div>

                {/* Safety PIN Badge */}
                <div className="text-center bg-slate-950 px-2.5 py-1.5 rounded-xl border border-amber-500/40">
                  <span className="text-[9px] uppercase font-bold text-amber-400 block">RIDE PIN</span>
                  <span className="font-mono text-sm font-black text-amber-300 tracking-wider">
                    {safetyPin}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Call, Chat, Safety Toolkit */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80">
                <a
                  href={`tel:${activeRide.captain_phone || '+15557493021'}`}
                  className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  Call
                </a>

                <button
                  type="button"
                  onClick={() => setIsChatOpen(true)}
                  className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors relative"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                  Chat
                  <span className="w-2 h-2 rounded-full bg-sky-400 absolute top-1.5 right-2" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsSafetyOpen(true)}
                  className="py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  Safety
                </button>
              </div>
            </div>
          ) : (
            /* Searching State Radar Card */
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                <Radio className="w-5 h-5 animate-spin" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-slate-200">Broadcasting Request to Drivers</h4>
                <p className="text-[11px] text-slate-400">
                  Nearby captains are reviewing your offer of ₹{activeRide.fare?.toFixed(2) || '14.50'}
                </p>
              </div>
            </div>
          )}

          {/* Stepper Progress Bar */}
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
              <span className={activeRide.status === 'requested' ? 'text-amber-400' : 'text-emerald-400'}>1. Match</span>
              <span className={activeRide.status === 'accepted' ? 'text-amber-400' : ['arrived', 'started', 'completed'].includes(activeRide.status) ? 'text-emerald-400' : ''}>2. En Route</span>
              <span className={activeRide.status === 'arrived' ? 'text-amber-400' : ['started', 'completed'].includes(activeRide.status) ? 'text-emerald-400' : ''}>3. Arrived</span>
              <span className={activeRide.status === 'started' ? 'text-amber-400' : activeRide.status === 'completed' ? 'text-emerald-400' : ''}>4. Trip</span>
              <span className={activeRide.status === 'completed' ? 'text-emerald-400' : ''}>5. Done</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  activeRide.status === 'cancelled'
                    ? 'bg-rose-500 w-full'
                    : activeRide.status === 'requested'
                    ? 'bg-amber-400 w-1/5 animate-pulse'
                    : activeRide.status === 'accepted'
                    ? 'bg-sky-400 w-2/5'
                    : activeRide.status === 'arrived'
                    ? 'bg-indigo-400 w-3/5'
                    : activeRide.status === 'started'
                    ? 'bg-purple-400 w-4/5'
                    : 'bg-emerald-400 w-full'
                }`}
              />
            </div>
          </div>

          {/* Rating & Review Dialog if completed */}
          {activeRide.status === 'completed' && !reviewSubmitted && (
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl space-y-3 animate-in zoom-in-95">
              <div className="text-center">
                <h3 className="text-sm font-black text-emerald-300">Rate your Ride with {activeRide.captain_name || 'Captain'}</h3>
                <p className="text-[11px] text-slate-400">How was the ride and safety gear?</p>
              </div>

              {/* Star Rating */}
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingStars(star)}
                    className="p-1 transition-transform hover:scale-125"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= ratingStars ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* Add Driver Tip */}
              <div className="space-y-1 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Add a Captain Tip</span>
                <div className="flex items-center justify-center gap-2">
                  {[0, 1, 2, 3, 5].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTipAmount(amt)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors ${
                        tipAmount === amt
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
                          : 'bg-slate-900 text-slate-300 border-slate-700'
                      }`}
                    >
                      {amt === 0 ? 'No Tip' : `+₹${amt}`}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReviewSubmitted(true)}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-colors"
              >
                Submit Feedback
              </button>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-1">
            {activeRide.status === 'requested' || activeRide.status === 'accepted' ? (
              <button
                id="uber-cancel-ride-btn"
                onClick={handleCancelRide}
                disabled={isSubmitting}
                className="w-full py-3 bg-slate-900 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-2xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                Cancel Ride
              </button>
            ) : activeRide.status === 'completed' || activeRide.status === 'cancelled' ? (
              <button
                id="uber-book-another-btn"
                onClick={handleBookAnother}
                className="w-full py-3.5 bg-white hover:bg-slate-200 text-slate-950 font-black rounded-2xl text-xs transition-colors shadow-xl"
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
    </div>
  );
};
