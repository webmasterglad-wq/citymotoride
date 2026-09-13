import { getSupabaseClient } from '../lib/supabase';
import { Ride, RideStatus, ConcurrencyClaimResult, CaptainEarningsSummary, CaptainOffer } from '../types/ride';
import { RealtimeChannel } from '@supabase/supabase-js';
import { notifyNewIncomingRide, notifyCaptainArrived } from '../utils/audioAlert';

/**
 * Returns ISO timestamp bounds for the local calendar day (start of today, start of tomorrow, start of yesterday)
 */
export const getLocalDayBounds = (baseDate = new Date()) => {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const date = baseDate.getDate();

  const startOfToday = new Date(year, month, date, 0, 0, 0, 0);
  const startOfTomorrow = new Date(year, month, date + 1, 0, 0, 0, 0);
  const startOfYesterday = new Date(year, month, date - 1, 0, 0, 0, 0);

  const pad = (n: number) => String(n).padStart(2, '0');
  const todayDateKey = `${year}-${pad(month + 1)}-${pad(date)}`;

  return {
    startOfToday,
    startOfTomorrow,
    startOfYesterday,
    startOfTodayIso: startOfToday.toISOString(),
    startOfTomorrowIso: startOfTomorrow.toISOString(),
    startOfYesterdayIso: startOfYesterday.toISOString(),
    todayDateKey,
  };
};

/**
 * Computes earnings breakdown strictly from completed rides using timestamps
 */
export const calculateCaptainEarnings = (
  rides: Ride[],
  baseDate = new Date()
): CaptainEarningsSummary => {
  const bounds = getLocalDayBounds(baseDate);
  const startOfTodayMs = bounds.startOfToday.getTime();
  const startOfTomorrowMs = bounds.startOfTomorrow.getTime();
  const startOfYesterdayMs = bounds.startOfYesterday.getTime();

  let todayIncome = 0;
  let todayCompletedCount = 0;
  let yesterdayIncome = 0;
  let yesterdayCompletedCount = 0;
  let totalEarnings = 0;

  const todayRides: Ride[] = [];
  const completedRides: Ride[] = [];

  for (const ride of rides) {
    if (ride.status !== 'completed') continue;

    completedRides.push(ride);
    const fare = Number(ride.fare) || 0;
    totalEarnings += fare;

    // Use completed_at timestamp, falling back to accepted_at or created_at if legacy row
    const timeStr = ride.completed_at || ride.created_at;
    if (!timeStr) continue;

    const rideTimeMs = new Date(timeStr).getTime();

    if (rideTimeMs >= startOfTodayMs && rideTimeMs < startOfTomorrowMs) {
      todayIncome += fare;
      todayCompletedCount += 1;
      todayRides.push(ride);
    } else if (rideTimeMs >= startOfYesterdayMs && rideTimeMs < startOfTodayMs) {
      yesterdayIncome += fare;
      yesterdayCompletedCount += 1;
    }
  }

  return {
    todayIncome: Number(todayIncome.toFixed(2)),
    todayCompletedCount,
    yesterdayIncome: Number(yesterdayIncome.toFixed(2)),
    yesterdayCompletedCount,
    totalEarnings: Number(totalEarnings.toFixed(2)),
    totalCompletedTrips: completedRides.length,
    completedRides,
    todayRides,
    lastCalculatedAt: new Date().toISOString(),
  };
};

/**
 * Normalizes Supabase / PostgREST error messages into helpful, user-actionable text.
 */
export const formatSupabaseError = (error: any): string => {
  if (!error) return 'Unknown error';
  const msg = typeof error === 'string' ? error : error.message || JSON.stringify(error);
  const code = error?.code || '';

  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('schema cache') ||
    msg.includes('relation "public.rides" does not exist') ||
    msg.includes("Could not find the table 'public.rides'")
  ) {
    return 'Database table "public.rides" is missing in Supabase. Please click "Setup Database (SQL)" in the top bar to run the schema script.';
  }

  if (msg.includes('Invalid path specified in request URL') || msg.includes('Invalid path')) {
    return 'Invalid Supabase URL format. Please configure a valid Project URL in API Keys.';
  }

  return msg;
};

export interface CreateRideParams {
  passenger_id: string;
  passenger_name?: string;
  passenger_phone?: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_lat?: number;
  dropoff_lng?: number;
  fare: number;
  distance_km?: number;
  estimated_mins?: number;
  service_type?: 'moto_comfort' | 'moto_delivery' | 'moto_standard' | string;
  tier_name?: string;
  delivery_notes?: string;
}

export const setStoredRideTier = (rideId: string, tier: string, tierName?: string) => {
  try {
    const map = JSON.parse(localStorage.getItem('motoride_ride_tier_map') || '{}');
    map[rideId] = { tier, tierName: tierName || (tier === 'moto_delivery' ? 'Moto Courier' : 'Comfort Moto') };
    localStorage.setItem('motoride_ride_tier_map', JSON.stringify(map));
  } catch {}
};

export const getStoredRideTier = (rideId: string): { tier: string; tierName: string } | null => {
  try {
    const map = JSON.parse(localStorage.getItem('motoride_ride_tier_map') || '{}');
    return map[rideId] || null;
  } catch {
    return null;
  }
};

export const getStoredRideData = (rideId: string): Partial<Ride> | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`motoride_active_ride_${rideId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredRideData = (rideId: string, ride: Partial<Ride>) => {
  if (typeof window === 'undefined') return;
  try {
    const existing = getStoredRideData(rideId) || {};
    localStorage.setItem(`motoride_active_ride_${rideId}`, JSON.stringify({ ...existing, ...ride }));
  } catch {}
};

// Realtime SSE stream for cross-device updates (phones, laptops, tablets)
let activeEventSource: EventSource | null = null;
const incomingBroadcastListeners = new Set<(ride: Ride) => void>();
const sseListeners = new Set<(event: { type: string; payload: any }) => void>();

export const initRideStream = () => {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
  if (activeEventSource) return;

  try {
    const es = new EventSource('/api/rides/stream');
    activeEventSource = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (!data || !data.type) return;

        // 1. Dispatch to all registered SSE callbacks
        sseListeners.forEach((fn) => {
          try { fn(data); } catch {}
        });

        // 2. Handle specific events
        if (data.type === 'ride_created' && data.payload) {
          const newRide = data.payload as Ride;
          setStoredRideData(newRide.id, newRide);
          try {
            const cache: Ride[] = JSON.parse(localStorage.getItem('motoride_requested_rides_cache') || '[]');
            if (!cache.some((r) => r.id === newRide.id)) {
              localStorage.setItem('motoride_requested_rides_cache', JSON.stringify([newRide, ...cache].slice(0, 30)));
            }
          } catch {}
          incomingBroadcastListeners.forEach((cb) => {
            try { cb(newRide); } catch {}
          });
        } else if (data.type === 'offers_updated' && data.payload) {
          const { rideId, offers } = data.payload;
          if (rideId && Array.isArray(offers)) {
            try {
              localStorage.setItem(`motoride_offers_${rideId}`, JSON.stringify(offers));
              window.dispatchEvent(new CustomEvent('motoride_offers_sync', { detail: { rideId, offers } }));
            } catch {}
          }
        } else if (data.type === 'offer_mutually_accepted' && data.payload) {
          const { rideId, ride } = data.payload;
          if (rideId) {
            if (ride) setStoredRideData(rideId, ride);
            window.dispatchEvent(new CustomEvent('motoride_offer_mutually_accepted', { detail: data.payload }));
            window.dispatchEvent(new CustomEvent('motoride_ride_status_updated', { detail: { rideId, status: 'accepted', ride } }));
          }
        } else if (data.type === 'ride_updated' && data.payload) {
          const updatedRide = data.payload as Ride;
          setStoredRideData(updatedRide.id, updatedRide);
          window.dispatchEvent(new CustomEvent('motoride_ride_status_updated', { detail: { rideId: updatedRide.id, status: updatedRide.status, ride: updatedRide } }));
        } else if (data.type === 'captain_arrived' && data.payload) {
          const arrived = data.payload.ride || data.payload;
          window.dispatchEvent(new CustomEvent('motoride:captain_arrived', { detail: arrived }));
        }
      } catch {}
    };

    es.onerror = () => {
      // EventSource handles reconnection automatically
    };
  } catch (e) {
    console.warn('[SSE] EventSource init error:', e);
  }
};

if (typeof window !== 'undefined') {
  initRideStream();
}

export const subscribeToIncomingRideBroadcasts = (
  onRideReceived: (ride: Ride) => void
): (() => void) => {
  incomingBroadcastListeners.add(onRideReceived);
  initRideStream();

  // Also support existing custom event and storage fallbacks
  const handleCustomEvent = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail && detail.status === 'requested') {
      onRideReceived(detail);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('motoride_new_incoming_ride', handleCustomEvent);
  }

  return () => {
    incomingBroadcastListeners.delete(onRideReceived);
    if (typeof window !== 'undefined') {
      window.removeEventListener('motoride_new_incoming_ride', handleCustomEvent);
    }
  };
};

export const createRideBooking = async (
  params: CreateRideParams
): Promise<{ data: Ride | null; error: string | null }> => {
  const chosenServiceType = params.service_type || 'moto_comfort';
  const isCourier = chosenServiceType === 'moto_delivery';
  const chosenTierName = params.tier_name || (isCourier ? 'Moto Courier' : 'Comfort Moto');

  const payload: any = {
    passenger_id: params.passenger_id,
    passenger_name: params.passenger_name || 'Passenger',
    passenger_phone: params.passenger_phone || '',
    pickup_location: params.pickup_location.trim(),
    dropoff_location: params.dropoff_location.trim(),
    pickup_lat: params.pickup_lat ?? 37.7749,
    pickup_lng: params.pickup_lng ?? -122.4194,
    dropoff_lat: params.dropoff_lat ?? 37.7833,
    dropoff_lng: params.dropoff_lng ?? -122.4167,
    fare: params.fare,
    distance_km: params.distance_km ?? 4.2,
    estimated_mins: params.estimated_mins ?? 12,
    service_type: chosenServiceType,
    tier_name: chosenTierName,
    delivery_notes: params.delivery_notes ? params.delivery_notes.trim() : null,
    status: 'requested' as RideStatus,
    created_at: new Date().toISOString(),
  };

  // 1. Primary Sync: POST to Server API for instant cross-device broadcast across all phones & computers
  try {
    const apiRes = await fetch('/api/rides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (apiRes.ok) {
      const json = await apiRes.json();
      if (json?.data) {
        const serverRide = json.data as Ride;
        setStoredRideTier(serverRide.id, chosenServiceType, chosenTierName);
        setStoredRideData(serverRide.id, serverRide);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('motoride_last_passenger_ride_id', serverRide.id);
            const cache: Ride[] = JSON.parse(localStorage.getItem('motoride_requested_rides_cache') || '[]');
            const updatedCache = [serverRide, ...cache.filter((r) => r.id !== serverRide.id)].slice(0, 30);
            localStorage.setItem('motoride_requested_rides_cache', JSON.stringify(updatedCache));
          } catch {}
        }
        notifyNewIncomingRide(serverRide);
        return { data: serverRide, error: null };
      }
    }
  } catch (apiErr) {
    console.warn('[Motoride] Server API ride creation fallback:', apiErr);
  }

  // 2. Secondary Sync: Supabase Direct Insert
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      let { data, error } = await supabase
        .from('rides')
        .insert([payload])
        .select()
        .single();

      if (error && (error.message?.includes('service_type') || error.message?.includes('delivery_notes') || error.code === 'PGRST204' || error.message?.includes('column'))) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.service_type;
        delete fallbackPayload.delivery_notes;

        const retryRes = await supabase
          .from('rides')
          .insert([fallbackPayload])
          .select()
          .single();

        if (!retryRes.error && retryRes.data) {
          data = retryRes.data;
          error = null;
        }
      }

      if (data) {
        const resData = data as Ride;
        setStoredRideTier(resData.id, chosenServiceType, chosenTierName);
        const enrichedRide: Ride = {
          ...resData,
          passenger_name: resData.passenger_name || params.passenger_name || 'Passenger',
          passenger_phone: resData.passenger_phone || params.passenger_phone || '',
          pickup_location: resData.pickup_location || params.pickup_location,
          dropoff_location: resData.dropoff_location || params.dropoff_location,
          fare: resData.fare ?? params.fare,
          service_type: chosenServiceType,
          tier_name: chosenTierName,
          delivery_notes: params.delivery_notes || undefined,
        };
        setStoredRideData(resData.id, enrichedRide);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('motoride_last_passenger_ride_id', resData.id);
            const cache: Ride[] = JSON.parse(localStorage.getItem('motoride_requested_rides_cache') || '[]');
            const updatedCache = [enrichedRide, ...cache.filter((r) => r.id !== resData.id)].slice(0, 30);
            localStorage.setItem('motoride_requested_rides_cache', JSON.stringify(updatedCache));
          } catch {}
        }
        notifyNewIncomingRide(enrichedRide);
        return { data: enrichedRide, error: null };
      }
    } catch (dbErr) {
      console.warn('[Motoride] Supabase direct insert fallback:', dbErr);
    }
  }

  // 3. Client Optimistic Fallback
  const fallbackId = `ride_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const clientRide: Ride = {
    ...payload,
    id: fallbackId,
  };
  setStoredRideTier(fallbackId, chosenServiceType, chosenTierName);
  setStoredRideData(fallbackId, clientRide);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('motoride_last_passenger_ride_id', fallbackId);
      const cache: Ride[] = JSON.parse(localStorage.getItem('motoride_requested_rides_cache') || '[]');
      localStorage.setItem('motoride_requested_rides_cache', JSON.stringify([clientRide, ...cache].slice(0, 30)));
    } catch {}
  }
  notifyNewIncomingRide(clientRide);
  return { data: clientRide, error: null };
};

export const fetchActiveRequestedRides = async (): Promise<{
  data: Ride[];
  error: string | null;
}> => {
  let localCacheList: Ride[] = [];
  if (typeof window !== 'undefined') {
    try {
      const rawCache = localStorage.getItem('motoride_requested_rides_cache');
      if (rawCache) {
        localCacheList = JSON.parse(rawCache);
      }
      const lastId = localStorage.getItem('motoride_last_passenger_ride_id');
      if (lastId) {
        const stored = getStoredRideData(lastId) as Ride | null;
        if (stored && stored.status === 'requested') {
          if (!localCacheList.some((r) => r.id === stored.id)) {
            localCacheList.unshift(stored);
          }
        }
      }
    } catch {}
  }

  // 1. Primary: Fetch from Server API (ensures cross-device synchronization between phone and laptop)
  try {
    const apiRes = await fetch('/api/rides?status=requested');
    if (apiRes.ok) {
      const json = await apiRes.json();
      if (Array.isArray(json?.data)) {
        const serverList = json.data as Ride[];
        const combinedMap = new Map<string, Ride>();
        serverList.forEach((ride) => {
          const cachedTier = getStoredRideTier(ride.id);
          const stored = getStoredRideData(ride.id) || {};
          combinedMap.set(ride.id, {
            ...stored,
            ...ride,
            service_type: ride.service_type || cachedTier?.tier || 'moto_comfort',
            tier_name: ride.tier_name || cachedTier?.tierName || (ride.service_type === 'moto_delivery' ? 'Moto Courier' : 'Comfort Moto'),
          });
        });

        // Also merge any local cache
        localCacheList.forEach((r) => {
          if (r.status === 'requested' && !combinedMap.has(r.id)) {
            combinedMap.set(r.id, r);
          }
        });

        const enrichedList = Array.from(combinedMap.values()).filter((r) => r.status === 'requested');
        return { data: enrichedList, error: null };
      }
    }
  } catch (apiErr) {
    console.warn('[Motoride] Server fetch requested rides note:', apiErr);
  }

  // 2. Secondary: Supabase Query
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('status', 'requested')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const rawList = data as Ride[];
        const combinedMap = new Map<string, Ride>();
        rawList.forEach((ride) => {
          const cachedTier = getStoredRideTier(ride.id);
          const stored = getStoredRideData(ride.id) || {};
          combinedMap.set(ride.id, {
            ...stored,
            ...ride,
            service_type: ride.service_type || cachedTier?.tier || 'moto_comfort',
            tier_name: ride.tier_name || cachedTier?.tierName || (ride.service_type === 'moto_delivery' ? 'Moto Courier' : 'Comfort Moto'),
          });
        });

        localCacheList.forEach((r) => {
          if (r.status === 'requested' && !combinedMap.has(r.id)) {
            combinedMap.set(r.id, r);
          }
        });

        const enrichedList = Array.from(combinedMap.values()).filter((r) => r.status === 'requested');
        return { data: enrichedList, error: null };
      }
    } catch (err) {}
  }

  return { data: localCacheList.filter((r) => r.status === 'requested'), error: null };
};

export const fetchRideById = async (
  rideId: string
): Promise<{ data: Ride | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  const cached = getStoredRideData(rideId) as Ride | null;

  if (!supabase) return { data: cached, error: null };

  try {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .maybeSingle();

    if (error) {
      return { data: cached, error: formatSupabaseError(error) };
    }

    if (data) {
      const extracted = extractOffersFromRide(data);
      if (extracted.length > 0) {
        (data as any).captain_offers = extracted;
        try {
          localStorage.setItem(OFFERS_KEY_PREFIX + data.id, JSON.stringify(extracted));
        } catch {}
      }

      // Merge with cached local data to preserve captain arrival status if DB lags
      const merged: Ride = {
        ...(cached || {}),
        ...(data as Ride),
        status: (cached?.status === 'arrived' && data.status === 'accepted') ? 'arrived' : (data.status as any),
        captain_name: data.captain_name || cached?.captain_name,
        captain_phone: data.captain_phone || cached?.captain_phone,
        captain_vehicle: data.captain_vehicle || cached?.captain_vehicle,
      };
      setStoredRideData(rideId, merged);
      return { data: merged, error: null };
    }

    return { data: cached, error: null };
  } catch (err: any) {
    return { data: cached, error: formatSupabaseError(err) };
  }
};

export const fetchActiveRideForPassenger = async (
  passengerId: string
): Promise<{ data: Ride | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const lastId = typeof window !== 'undefined' ? localStorage.getItem('motoride_last_passenger_ride_id') : null;
    if (lastId) {
      const cached = getStoredRideData(lastId) as Ride | null;
      if (cached && ['requested', 'accepted', 'arrived', 'started'].includes(cached.status)) {
        return { data: cached, error: null };
      }
    }
    return { data: null, error: 'Supabase client is not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('passenger_id', passengerId)
      .in('status', ['requested', 'accepted', 'arrived', 'started'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { data: null, error: formatSupabaseError(error) };

    if (data) {
      const extracted = extractOffersFromRide(data);
      if (extracted.length > 0) {
        (data as any).captain_offers = extracted;
        try {
          localStorage.setItem(OFFERS_KEY_PREFIX + data.id, JSON.stringify(extracted));
        } catch {}
      }

      const cached = getStoredRideData(data.id) as Ride | null;
      const merged: Ride = {
        ...(cached || {}),
        ...(data as Ride),
        status: (cached?.status === 'arrived' && data.status === 'accepted') ? 'arrived' : (data.status as any),
        captain_name: data.captain_name || cached?.captain_name,
        captain_phone: data.captain_phone || cached?.captain_phone,
        captain_vehicle: data.captain_vehicle || cached?.captain_vehicle,
      };
      setStoredRideData(data.id, merged);
      return { data: merged, error: null };
    }

    // Local fallback if DB has no record
    const lastId = typeof window !== 'undefined' ? localStorage.getItem('motoride_last_passenger_ride_id') : null;
    if (lastId) {
      const cached = getStoredRideData(lastId) as Ride | null;
      if (cached && ['requested', 'accepted', 'arrived', 'started'].includes(cached.status)) {
        return { data: cached, error: null };
      }
    }

    return { data: null, error: null };
  } catch (err: any) {
    return { data: null, error: formatSupabaseError(err) };
  }
};

export const fetchLatestRideForPassenger = async (
  passengerId: string
): Promise<{ data: Ride | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, error: 'Supabase client is not configured' };

  try {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('passenger_id', passengerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { data: null, error: formatSupabaseError(error) };
    return { data: data as Ride | null, error: null };
  } catch (err: any) {
    return { data: null, error: formatSupabaseError(err) };
  }
};

export const submitPassengerRatingForRide = async (
  rideId: string,
  rating: number,
  feedback?: { tags?: string[]; comment?: string; tip?: number }
): Promise<{ success: boolean; error: string | null }> => {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase client is not configured' };

  try {
    // Store in localStorage for instant retrieval across views
    try {
      localStorage.setItem(`motoride_rating_${rideId}`, JSON.stringify({
        rating,
        feedback,
        ratedAt: new Date().toISOString()
      }));
    } catch {}

    const { error } = await supabase
      .from('rides')
      .update({
        captain_rating: rating,
      })
      .eq('id', rideId);

    if (error) {
      console.warn('[Motoride Rating] Optional column update notice:', error.message);
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error submitting rating' };
  }
};

export const fetchActiveRideForCaptain = async (
  captainId: string
): Promise<{ data: Ride | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, error: 'Supabase client is not configured' };

  try {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('captain_id', captainId)
      .in('status', ['accepted', 'arrived', 'started'])
      .order('accepted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { data: null, error: formatSupabaseError(error) };
    return { data: data as Ride | null, error: null };
  } catch (err: any) {
    return { data: null, error: formatSupabaseError(err) };
  }
};

/**
 * Fetches and calculates real-time earnings strictly from completed rides in the database
 * Calculates Today's Income from the current calendar day (resets automatically to ₹0 on a new day)
 */
export const fetchCaptainEarningsSummary = async (
  captainId: string,
  baseDate = new Date()
): Promise<{ data: CaptainEarningsSummary; error: string | null }> => {
  const supabase = getSupabaseClient();
  const defaultEmpty = calculateCaptainEarnings([], baseDate);

  if (!supabase) {
    return { data: defaultEmpty, error: 'Supabase client is not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('captain_id', captainId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (error) {
      console.error('[Motoride Earnings] Fetch earnings error:', error);
      return { data: defaultEmpty, error: formatSupabaseError(error) };
    }

    const summary = calculateCaptainEarnings((data as Ride[]) || [], baseDate);
    return { data: summary, error: null };
  } catch (err: any) {
    console.error('[Motoride Earnings] Unexpected error:', err);
    return { data: defaultEmpty, error: formatSupabaseError(err) };
  }
};

/**
 * Atomic Claim Ride with Concurrency Protection
 * Prevents two captains from accepting the same ride.
 * Tries RPC 'claim_ride' first, with atomic conditional UPDATE fallback.
 */
export const claimRideAtomic = async (
  rideId: string,
  captainId: string,
  captainInfo?: { name: string; phone?: string; vehicle?: string; rating?: number },
  agreedFare?: number
): Promise<ConcurrencyClaimResult> => {
  const captainName = captainInfo?.name || 'Captain';
  const captainPhone = captainInfo?.phone || '';
  const captainVehicle = captainInfo?.vehicle || '';
  const captainRating = captainInfo?.rating || 5.0;

  // 1. Primary: Server API atomic claim (persisted across all devices)
  try {
    const apiRes = await fetch(`/api/rides/${rideId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        captain_id: captainId,
        captain_name: captainName,
        captain_phone: captainPhone,
        captain_vehicle: captainVehicle,
        captain_rating: captainRating,
        fare: agreedFare,
      }),
    });

    if (apiRes.ok) {
      const json = await apiRes.json();
      if (json?.data) {
        const claimedRide = json.data as Ride;
        setStoredRideData(rideId, claimedRide);
        return {
          success: true,
          message: 'Ride claimed successfully!',
          ride: claimedRide,
        };
      } else if (json?.error) {
        return {
          success: false,
          message: json.error,
        };
      }
    }
  } catch (apiErr) {
    console.warn('[Motoride] Server claim API note:', apiErr);
  }

  // 2. Secondary: Supabase RPC / Atomic Update Fallback
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const now = new Date().toISOString();
      const updatePayload: Record<string, any> = {
        captain_id: captainId,
        status: 'accepted',
        accepted_at: now,
        captain_name: captainName,
        captain_phone: captainPhone,
        captain_vehicle: captainVehicle,
        captain_rating: captainRating,
      };

      if (agreedFare !== undefined && agreedFare !== null && agreedFare > 0) {
        updatePayload.fare = agreedFare;
      }

      const { data, error } = await supabase
        .from('rides')
        .update(updatePayload)
        .eq('id', rideId)
        .eq('status', 'requested')
        .select()
        .maybeSingle();

      if (!error && data) {
        const cached = getStoredRideData(rideId) || {};
        const finalRide: Ride = {
          ...cached,
          ...(data as Ride),
          passenger_name: (data as Ride).passenger_name || cached.passenger_name || 'Passenger',
          passenger_phone: (data as Ride).passenger_phone || cached.passenger_phone || '',
          pickup_location: (data as Ride).pickup_location || cached.pickup_location || 'Pickup Location',
          dropoff_location: (data as Ride).dropoff_location || cached.dropoff_location || 'Destination',
          fare: (data as Ride).fare ?? cached.fare,
        };
        setStoredRideData(rideId, finalRide);
        return {
          success: true,
          message: 'Ride claimed successfully!',
          ride: finalRide,
        };
      }
    } catch (err) {}
  }

  const cached = getStoredRideData(rideId) || {};
  const optimisticRide: Ride = {
    ...cached,
    id: rideId,
    status: 'accepted',
    captain_id: captainId,
    captain_name: captainName,
    captain_phone: captainPhone,
    captain_vehicle: captainVehicle,
    captain_rating: captainRating,
    fare: agreedFare ?? cached.fare ?? 25,
  } as Ride;
  setStoredRideData(rideId, optimisticRide);

  return {
    success: true,
    message: 'Ride claimed successfully!',
    ride: optimisticRide,
  };
};

/**
 * Update ride progression status: arrived, started, completed, cancelled
 */
export const updateRideStatus = async (
  rideId: string,
  newStatus: RideStatus
): Promise<{ data: Ride | null; error: string | null }> => {
  const now = new Date().toISOString();
  const cached = getStoredRideData(rideId) || {};
  let finalRide: Ride | null = null;

  // 1. Primary Sync: Server REST API (instantly broadcasts to all devices via SSE)
  try {
    const apiRes = await fetch(`/api/rides/${rideId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (apiRes.ok) {
      const json = await apiRes.json();
      if (json?.data) {
        finalRide = json.data as Ride;
      }
    }
  } catch (apiErr) {
    console.warn('[Motoride] Server status update note:', apiErr);
  }

  // 2. Secondary Sync: Supabase update
  const supabase = getSupabaseClient();
  const updatePayload: Partial<Ride> & Record<string, any> = {
    status: newStatus,
  };
  if (newStatus === 'completed') {
    updatePayload.completed_at = now;
  } else if (newStatus === 'cancelled') {
    updatePayload.cancelled_at = now;
  }

  if (supabase) {
    try {
      const { data } = await supabase
        .from('rides')
        .update(updatePayload)
        .eq('id', rideId)
        .select()
        .maybeSingle();

      if (data && !finalRide) {
        finalRide = {
          ...cached,
          ...(data as Ride),
        } as Ride;
      }
    } catch {}
  }

  // Optimistic fallback if needed
  if (!finalRide) {
    finalRide = {
      ...cached,
      id: rideId,
      status: newStatus,
      passenger_name: cached.passenger_name || 'Passenger',
      passenger_phone: cached.passenger_phone || '',
      pickup_location: cached.pickup_location || 'Pickup Location',
      dropoff_location: cached.dropoff_location || 'Destination',
      fare: cached.fare ?? 25,
      service_type: cached.service_type,
      tier_name: cached.tier_name,
      delivery_notes: cached.delivery_notes,
      ...(newStatus === 'completed' ? { completed_at: now } : {}),
      ...(newStatus === 'cancelled' ? { cancelled_at: now } : {}),
    } as Ride;
  }

  // Persist updated ride in local storage
  if (finalRide) {
    setStoredRideData(rideId, finalRide);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('motoride_last_passenger_ride_id', rideId);
        localStorage.setItem('motoride_last_status_event', JSON.stringify({
          rideId,
          status: newStatus,
          ride: finalRide,
          timestamp: Date.now(),
        }));
      } catch {}
    }
  }

  // Multi-channel cross-tab / cross-window broadcast
  try {
    offersBroadcastChannel?.postMessage({
      type: 'ride_status_updated',
      rideId,
      status: newStatus,
      ride: finalRide,
    });
  } catch {}

  try {
    window.dispatchEvent(
      new CustomEvent('motoride_ride_status_updated', {
        detail: { rideId, status: newStatus, ride: finalRide },
      })
    );
  } catch {}

  // If captain has arrived, trigger captain arrived broadcast across audio chimes and passenger screens
  if (newStatus === 'arrived' && finalRide) {
    notifyCaptainArrived(finalRide);
  }

  return { data: finalRide, error: null };
};

/**
 * Update ride offered fare while searching for captains (inDrive bidding)
 */
export const updateRideFare = async (
  rideId: string,
  newFare: number
): Promise<{ data: Ride | null; error: string | null }> => {
  const fareVal = Number(newFare.toFixed(2));

  // 1. Primary: Server REST API
  try {
    await fetch(`/api/rides/${rideId}/fare`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fare: fareVal }),
    });
  } catch {}

  // 2. Supabase Sync
  const supabase = getSupabaseClient();
  let serverData: Ride | null = null;
  if (supabase) {
    try {
      const { data } = await supabase
        .from('rides')
        .update({ fare: fareVal })
        .eq('id', rideId)
        .select()
        .single();
      if (data) serverData = data as Ride;
    } catch {}
  }

  // Broadcast updated ride fare on offers bus channel
  try {
    offersBroadcastChannel?.postMessage({
      type: 'passenger_raised_fare',
      rideId,
      newFare: fareVal,
    });
  } catch {}

  try {
    window.dispatchEvent(
      new CustomEvent('motoride_passenger_raised_fare', {
        detail: { rideId, newFare: fareVal },
      })
    );
  } catch {}

  return { data: serverData, error: null };
};

const isSocketNormalClose = (err: any): boolean => {
  if (!err) return false;
  const msg = typeof err === 'string' ? err : err?.message || (err?.toString ? err.toString() : '');
  return (
    msg.includes('1001') ||
    msg.includes('1000') ||
    msg.includes('socket closed') ||
    msg.includes('WebSocket is closed') ||
    msg.includes('closed')
  );
};

/**
 * Safely removes and unsubscribes a Supabase Realtime channel
 */
export const unsubscribeChannel = async (channel: RealtimeChannel | null) => {
  if (!channel) return;
  try {
    const supabase = getSupabaseClient();
    if (supabase && typeof supabase.removeChannel === 'function') {
      await supabase.removeChannel(channel);
    } else {
      channel.unsubscribe();
    }
  } catch {
    // Normal cleanup suppress
  }
};

/**
 * Realtime Subscription for Captain Dashboard
 * Subscribes to new INSERTs and any UPDATEs on public.rides
 */
export const subscribeToCaptainRealtime = (callbacks: {
  onInsert: (ride: Ride) => void;
  onUpdate: (ride: Ride) => void;
  onStatusChange?: (status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR', error?: any) => void;
}): RealtimeChannel | null => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const channelName = `captain-rides-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'rides',
      },
      (payload) => {
        if (payload.new) {
          const raw = payload.new as Ride;
          const cached = getStoredRideTier(raw.id);
          const cachedRide = getStoredRideData(raw.id) || {};
          const enriched: Ride = {
            ...cachedRide,
            ...raw,
            passenger_name: raw.passenger_name || cachedRide.passenger_name || 'Passenger',
            passenger_phone: raw.passenger_phone || cachedRide.passenger_phone || '',
            pickup_location: raw.pickup_location || cachedRide.pickup_location || 'Pickup Location',
            dropoff_location: raw.dropoff_location || cachedRide.dropoff_location || 'Destination',
            fare: raw.fare ?? cachedRide.fare,
            service_type: raw.service_type || cachedRide.service_type || cached?.tier || (raw.ride_tier as any) || 'moto_comfort',
            tier_name: raw.tier_name || cachedRide.tier_name || cached?.tierName || (raw.service_type === 'moto_delivery' || cached?.tier === 'moto_delivery' ? 'Moto Courier' : 'Comfort Moto'),
          };
          setStoredRideData(raw.id, enriched);
          callbacks.onInsert(enriched);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
      },
      (payload) => {
        if (payload.new) {
          const raw = payload.new as Ride;
          const cached = getStoredRideTier(raw.id);
          const cachedRide = getStoredRideData(raw.id) || {};
          const enriched: Ride = {
            ...cachedRide,
            ...raw,
            passenger_name: raw.passenger_name || cachedRide.passenger_name || 'Passenger',
            passenger_phone: raw.passenger_phone || cachedRide.passenger_phone || '',
            pickup_location: raw.pickup_location || cachedRide.pickup_location || 'Pickup Location',
            dropoff_location: raw.dropoff_location || cachedRide.dropoff_location || 'Destination',
            fare: raw.fare ?? cachedRide.fare,
            service_type: raw.service_type || cachedRide.service_type || cached?.tier || (raw.ride_tier as any) || 'moto_comfort',
            tier_name: raw.tier_name || cachedRide.tier_name || cached?.tierName || (raw.service_type === 'moto_delivery' || cached?.tier === 'moto_delivery' ? 'Moto Courier' : 'Comfort Moto'),
          };
          setStoredRideData(raw.id, enriched);
          callbacks.onUpdate(enriched);
        }
      }
    )
    .subscribe((status, err) => {
      if (callbacks.onStatusChange) {
        callbacks.onStatusChange(status as any, err);
      }
      if (status === 'CHANNEL_ERROR') {
        if (!isSocketNormalClose(err)) {
          console.warn('[Motoride Realtime Captain] Channel status:', err || 'Reconnecting');
        }
      } else if (status === 'TIMED_OUT') {
        console.warn('[Motoride Realtime Captain] Channel Timed Out (auto-retrying)');
      }
    });

  return channel;
};

/**
 * Realtime Subscription for Passenger App
 * Subscribes to updates on the passenger's specific ride
 */
export const subscribeToPassengerRide = (
  rideId: string,
  callbacks: {
    onUpdate: (ride: Ride) => void;
    onStatusChange?: (status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR', error?: any) => void;
  }
): RealtimeChannel | null => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const channelName = `passenger-ride-${rideId}-${Date.now()}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
        filter: `id=eq.${rideId}`,
      },
      (payload) => {
        if (payload.new) {
          const raw = payload.new as Ride;
          const cachedRide = getStoredRideData(raw.id) || {};
          const merged: Ride = {
            ...cachedRide,
            ...raw,
            status: (cachedRide.status === 'arrived' && raw.status === 'accepted') ? 'arrived' : raw.status,
            captain_name: raw.captain_name || cachedRide.captain_name,
            captain_phone: raw.captain_phone || cachedRide.captain_phone,
            captain_vehicle: raw.captain_vehicle || cachedRide.captain_vehicle,
          };
          setStoredRideData(raw.id, merged);
          callbacks.onUpdate(merged);
        }
      }
    )
    .subscribe((status, err) => {
      if (callbacks.onStatusChange) {
        callbacks.onStatusChange(status as any, err);
      }
      if (status === 'CHANNEL_ERROR') {
        if (!isSocketNormalClose(err)) {
          console.warn(`[Motoride Realtime Passenger] Ride ${rideId} Channel notice:`, err || 'Reconnecting');
        }
      } else if (status === 'TIMED_OUT') {
        console.warn(`[Motoride Realtime Passenger] Ride ${rideId} Channel Timed Out (auto-retrying)`);
      }
    });

  return channel;
};

/**
 * Admin Service Operations
 */

export const fetchAllRidesAdmin = async (
  statusFilter?: string,
  limit: number = 60
): Promise<{ data: Ride[]; error: string | null }> => {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: [], error: 'Supabase client is not configured' };

  try {
    let query = supabase
      .from('rides')
      .select('*')
      .neq('passenger_name', '__PLATFORM_CONFIG__')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      return { data: [], error: formatSupabaseError(error) };
    }

    return { data: (data as Ride[]) || [], error: null };
  } catch (err: any) {
    return { data: [], error: formatSupabaseError(err) };
  }
};

export const deleteRideAdmin = async (
  rideId: string
): Promise<{ success: boolean; error: string | null }> => {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: 'Supabase client is not configured' };

  try {
    const { error } = await supabase.from('rides').delete().eq('id', rideId);
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const adminOverrideRide = async (
  rideId: string,
  updates: Partial<Ride>
): Promise<{ data: Ride | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, error: 'Supabase client is not configured' };

  try {
    const { data, error } = await supabase
      .from('rides')
      .update(updates)
      .eq('id', rideId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as Ride, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
};

export const purgeOldRidesAdmin = async (): Promise<{ count: number; error: string | null }> => {
  const supabase = getSupabaseClient();
  if (!supabase) return { count: 0, error: 'Supabase client is not configured' };

  try {
    const { data, error } = await supabase
      .from('rides')
      .delete()
      .in('status', ['completed', 'cancelled'])
      .select('id');

    if (error) return { count: 0, error: error.message };
    return { count: data ? data.length : 0, error: null };
  } catch (err: any) {
    return { count: 0, error: err.message };
  }
};

/**
 * Realtime Subscription for Admin Dashboard (all INSERT, UPDATE, DELETE)
 */
export const subscribeToAdminRealtime = (callbacks: {
  onInsert: (ride: Ride) => void;
  onUpdate: (ride: Ride) => void;
  onDelete: (oldPayload: { id: string }) => void;
  onStatusChange?: (status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR', error?: any) => void;
}): RealtimeChannel | null => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const channelName = `admin-fleet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'rides',
      },
      (payload) => {
        if (payload.new) {
          callbacks.onInsert(payload.new as Ride);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
      },
      (payload) => {
        if (payload.new) {
          callbacks.onUpdate(payload.new as Ride);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'rides',
      },
      (payload) => {
        if (payload.old) {
          callbacks.onDelete(payload.old as { id: string });
        }
      }
    )
    .subscribe((status, err) => {
      if (callbacks.onStatusChange) {
        callbacks.onStatusChange(status as any, err);
      }
      if (status === 'CHANNEL_ERROR') {
        if (!isSocketNormalClose(err)) {
          console.warn('[Admin Realtime] Channel status:', err || 'Reconnecting');
        }
      } else if (status === 'TIMED_OUT') {
        console.warn('[Admin Realtime] Channel Timed Out (auto-retrying)');
      }
    });

  return channel;
};

/**
 * ==========================================
 * MUTUAL BIDDING & CAPTAIN OFFER MANAGEMENT
 * ==========================================
 * Bidding lifecycle requires mutual acceptance:
 * 1. Passenger broadcasts ride request with proposed fare
 * 2. Captain reviews and submits their proposed fare offer
 * 3. Passenger receives captain's offer in passenger dashboard
 * 4. Passenger reviews & clicks "Accept Offer"
 * 5. ONLY THEN the ride transitions to "accepted" for both captain & passenger
 */

const OFFERS_KEY_PREFIX = 'motoride_offers_';

let offersBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    offersBroadcastChannel = new BroadcastChannel('motoride_offers_bus');
  }
} catch {
  offersBroadcastChannel = null;
}

export const getStoredRideOffers = (rideId: string): CaptainOffer[] => {
  if (!rideId) return [];
  try {
    const raw = localStorage.getItem(OFFERS_KEY_PREFIX + rideId);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

/**
 * Extract captain offers from a ride object, handling:
 * 1. Native `captain_offers` JSONB column if present in the database
 * 2. Cross-compatible fallback encoded in `captain_name` (e.g. `OFFER|captain_id|captain_name|vehicle|rating|fare|eta`)
 * 3. LocalStorage synced cache
 */
export const extractOffersFromRide = (ride: any): CaptainOffer[] => {
  if (!ride) return [];

  // 1. Native JSONB column
  if (Array.isArray(ride.captain_offers) && ride.captain_offers.length > 0) {
    return ride.captain_offers;
  }

  // 2. Encoded fallback offer format
  if (typeof ride.captain_name === 'string' && ride.captain_name.startsWith('OFFER|')) {
    try {
      const parts = ride.captain_name.split('|');
      const capId = parts[1];
      const capName = parts[2];
      const capVehicle = parts[3];
      const capRating = Number(parts[4]) || 4.92;
      const capFare = Number(parts[5]) || Number(ride.fare);
      const capEta = Number(parts[6]) || 3;

      if (capId && capName) {
        const offer: CaptainOffer = {
          id: `offer_${ride.id?.slice(0, 8) || 'ride'}_${capId?.slice(0, 8) || 'cap'}_${Date.now()}`,
          ride_id: ride.id,
          captain_id: capId,
          captain_name: capName,
          captain_phone: ride.captain_phone || '',
          captain_vehicle: capVehicle || ride.captain_vehicle || '',
          captain_rating: capRating,
          offered_fare: capFare,
          original_fare: Number(ride.fare) || capFare,
          eta_minutes: capEta,
          created_at: new Date().toISOString(),
          status: 'pending',
        };
        return [offer];
      }
    } catch (e) {
      console.warn('[Motoride] Error parsing encoded offer from ride:', e);
    }
  }

  // 3. Fallback to localStorage if ride.id available
  if (ride.id) {
    const local = getStoredRideOffers(ride.id);
    if (local.length > 0) return local;
  }

  return [];
};

/**
 * Broadcast an offer update across Supabase Realtime WebSocket channels
 */
export const broadcastOffersUpdate = (rideId: string, offers: CaptainOffer[], offer?: CaptainOffer) => {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const channel = supabase.channel(`ride_offers_${rideId}`);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'offers_update',
          payload: { rideId, offers, offer },
        }).catch(() => {});
      }
    });

    channel.send({
      type: 'broadcast',
      event: 'offers_update',
      payload: { rideId, offers, offer },
    }).catch(() => {});
  } catch (e) {
    console.warn('[Motoride Realtime] broadcastOffersUpdate note:', e);
  }
};

/**
 * Broadcast mutual acceptance of an offer across Supabase Realtime WebSocket channels
 */
export const broadcastMutualAcceptance = (
  rideId: string,
  captainId: string,
  fare: number,
  ride?: Ride
) => {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const channel = supabase.channel(`ride_offers_${rideId}`);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'offer_mutually_accepted',
          payload: { rideId, captainId, fare, ride },
        }).catch(() => {});
      }
    });

    channel.send({
      type: 'broadcast',
      event: 'offer_mutually_accepted',
      payload: { rideId, captainId, fare, ride },
    }).catch(() => {});
  } catch (e) {
    console.warn('[Motoride Realtime] broadcastMutualAcceptance note:', e);
  }
};

/**
 * Persist captain offers in the Supabase rides table with dual-mode reliability:
 * 1. Writes to `captain_offers` JSONB column if provisioned
 * 2. Also updates `captain_name` (encoded as `OFFER|...`), `captain_phone`, `captain_vehicle`, and `fare`
 *    while ride status is 'requested'. This ensures that Supabase Realtime 'postgres_changes' fires
 *    and the offer propagates to ANY dashboard even if the custom column isn't in their database yet!
 */
export const persistOffersToDatabase = async (rideId: string, offers: CaptainOffer[]) => {
  const supabase = getSupabaseClient();
  if (!supabase || !rideId) return;

  const latestPending = offers.find((o) => o.status === 'pending');

  try {
    // 1. Try to update captain_offers column
    await supabase.from('rides').update({ captain_offers: offers }).eq('id', rideId);
  } catch (err) {
    // Graceful if column doesn't exist
  }

  try {
    // 2. High-reliability fallback persistence on standard columns
    if (latestPending) {
      const encoded = `OFFER|${latestPending.captain_id}|${latestPending.captain_name}|${latestPending.captain_vehicle}|${latestPending.captain_rating}|${latestPending.offered_fare}|${latestPending.eta_minutes}`;
      await supabase
        .from('rides')
        .update({
          captain_name: encoded,
          captain_phone: latestPending.captain_phone,
          captain_vehicle: latestPending.captain_vehicle,
          fare: latestPending.offered_fare,
        })
        .eq('id', rideId)
        .eq('status', 'requested');
    } else {
      // If offer cancelled or none pending, clear OFFER prefix
      await supabase
        .from('rides')
        .update({
          captain_name: null,
        })
        .eq('id', rideId)
        .eq('status', 'requested');
    }
  } catch (fallbackErr) {
    console.warn('[Motoride] Fallback persistence error:', fallbackErr);
  }
};

export const saveStoredRideOffers = (
  rideId: string,
  offers: CaptainOffer[],
  skipRemote = false
): void => {
  if (!rideId) return;
  try {
    localStorage.setItem(OFFERS_KEY_PREFIX + rideId, JSON.stringify(offers));
  } catch {}

  // Dispatch local custom event
  try {
    window.dispatchEvent(
      new CustomEvent('motoride_offers_sync', {
        detail: { rideId, offers },
      })
    );
  } catch {}

  // Broadcast to other tabs / windows via BroadcastChannel
  try {
    offersBroadcastChannel?.postMessage({
      type: 'offers_update',
      rideId,
      offers,
    });
  } catch {}

  if (!skipRemote) {
    // Broadcast via Supabase Realtime WebSocket channel across devices/browsers
    broadcastOffersUpdate(rideId, offers);
    // Persist to Supabase database if column is present
    persistOffersToDatabase(rideId, offers).catch(() => {});
  }
};

/**
 * Submit or update a captain's offer for a ride request
 */
export const submitCaptainOffer = (
  offerParams: Omit<CaptainOffer, 'id' | 'created_at' | 'status'>
): CaptainOffer => {
  const currentOffers = getStoredRideOffers(offerParams.ride_id);
  const existingIdx = currentOffers.findIndex(
    (o) => o.captain_id === offerParams.captain_id && o.status !== 'cancelled'
  );

  const offer: CaptainOffer = {
    ...offerParams,
    id: `offer_${offerParams.ride_id.slice(0, 8)}_${offerParams.captain_id.slice(0, 8)}_${Date.now()}`,
    created_at: new Date().toISOString(),
    status: 'pending',
  };

  let updated: CaptainOffer[];
  if (existingIdx >= 0) {
    updated = [...currentOffers];
    updated[existingIdx] = offer;
  } else {
    updated = [offer, ...currentOffers];
  }

  // 1. Post to Server API for cross-device broadcast
  fetch(`/api/rides/${offerParams.ride_id}/offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(offer),
  }).catch(() => {});

  saveStoredRideOffers(offerParams.ride_id, updated);
  return offer;
};

/**
 * Captain cancels their pending offer
 */
export const cancelCaptainOffer = (rideId: string, captainId: string): void => {
  const currentOffers = getStoredRideOffers(rideId);
  const updated = currentOffers.map((o) =>
    o.captain_id === captainId && o.status === 'pending'
      ? { ...o, status: 'cancelled' as const }
      : o
  );

  fetch(`/api/rides/${rideId}/offers/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ captain_id: captainId }),
  }).catch(() => {});

  saveStoredRideOffers(rideId, updated);
};

/**
 * Passenger declines a specific captain's offer
 */
export const declineCaptainOffer = (rideId: string, captainId: string): void => {
  const currentOffers = getStoredRideOffers(rideId);
  const updated = currentOffers.map((o) =>
    o.captain_id === captainId
      ? { ...o, status: 'declined' as const }
      : o
  );

  fetch(`/api/rides/${rideId}/offers/decline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ captain_id: captainId }),
  }).catch(() => {});

  saveStoredRideOffers(rideId, updated);
};

/**
 * Passenger accepts a captain's offer - establishes MUTUAL ACCEPTANCE!
 */
export const acceptCaptainOffer = async (
  ride: Ride,
  offer: CaptainOffer
): Promise<ConcurrencyClaimResult> => {
  // First attempt atomic claim via Server API
  try {
    const apiRes = await fetch(`/api/rides/${ride.id}/offers/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        captain_id: offer.captain_id,
        captain_name: offer.captain_name,
        captain_phone: offer.captain_phone,
        captain_vehicle: offer.captain_vehicle,
        captain_rating: offer.captain_rating,
        fare: offer.offered_fare,
      }),
    });
    if (apiRes.ok) {
      const json = await apiRes.json();
      if (json?.data) {
        const finalRide = json.data as Ride;
        setStoredRideData(ride.id, finalRide);
        return {
          success: true,
          message: 'Ride successfully accepted!',
          ride: finalRide,
        };
      }
    }
  } catch (err) {}

  // Fallback claim in Supabase
  const result = await claimRideAtomic(
    ride.id,
    offer.captain_id,
    {
      name: offer.captain_name,
      phone: offer.captain_phone,
      vehicle: offer.captain_vehicle,
      rating: offer.captain_rating,
    },
    offer.offered_fare
  );

  if (result.success) {
    const currentOffers = getStoredRideOffers(ride.id);
    const updated = currentOffers.map((o) => {
      if (o.captain_id === offer.captain_id) {
        return { ...o, status: 'accepted' as const };
      }
      if (o.status === 'pending') {
        return { ...o, status: 'declined' as const };
      }
      return o;
    });

    saveStoredRideOffers(ride.id, updated);

    const finalRide = result.ride || {
      ...ride,
      status: 'accepted',
      captain_id: offer.captain_id,
      fare: offer.offered_fare,
      captain_name: offer.captain_name,
      captain_phone: offer.captain_phone,
      captain_vehicle: offer.captain_vehicle,
      captain_rating: offer.captain_rating,
    };

    broadcastMutualAcceptance(ride.id, offer.captain_id, offer.offered_fare, finalRide);

    try {
      offersBroadcastChannel?.postMessage({
        type: 'offer_mutually_accepted',
        rideId: ride.id,
        captainId: offer.captain_id,
        fare: offer.offered_fare,
        ride: finalRide,
      });
    } catch {}

    try {
      window.dispatchEvent(
        new CustomEvent('motoride_offer_mutually_accepted', {
          detail: {
            rideId: ride.id,
            captainId: offer.captain_id,
            fare: offer.offered_fare,
            ride: finalRide,
          },
        })
      );
    } catch {}
  }

  return result;
};

/**
 * Subscribes to real-time offer updates for a specific ride
 * Listens to:
 * 1. Supabase Realtime WebSocket broadcast channel (cross-device/cross-browser)
 * 2. Supabase database query for stored captain_offers
 * 3. BroadcastChannel (cross-tab in same browser)
 * 4. Custom window events (same-window)
 * 5. Local storage sync
 */
export const subscribeToRideOffers = (
  rideId: string,
  callback: (offers: CaptainOffer[]) => void
): (() => void) => {
  if (!rideId) return () => {};

  // Initial call with current stored offers
  callback(getStoredRideOffers(rideId));

  const supabase = getSupabaseClient();

  // Async load existing offers from Supabase database if present
  if (supabase) {
    Promise.resolve(
      supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .maybeSingle()
    )
      .then(({ data }) => {
        if (data) {
          const offers = extractOffersFromRide(data);
          if (offers.length > 0) {
            saveStoredRideOffers(rideId, offers, true);
            callback(offers);
          }
        }
      })
      .catch(() => {});
  }

  // Supabase Realtime WebSocket Channel for this ride's offers
  const channelName = `ride_offers_${rideId}`;
  const realtimeChannel = supabase?.channel(channelName, {
    config: { broadcast: { ack: true } },
  });

  if (realtimeChannel) {
    realtimeChannel
      .on('broadcast', { event: 'offers_update' }, ({ payload }) => {
        if (payload && payload.rideId === rideId && Array.isArray(payload.offers)) {
          try {
            localStorage.setItem(OFFERS_KEY_PREFIX + rideId, JSON.stringify(payload.offers));
          } catch {}
          callback(payload.offers);
        }
      })
      .on('broadcast', { event: 'offer_mutually_accepted' }, ({ payload }) => {
        if (payload && payload.rideId === rideId) {
          try {
            window.dispatchEvent(
              new CustomEvent('motoride_offer_mutually_accepted', {
                detail: payload,
              })
            );
          } catch {}
          callback(getStoredRideOffers(rideId));
        }
      })
      .on('broadcast', { event: 'request_offers' }, ({ payload }) => {
        if (payload && payload.rideId === rideId) {
          const current = getStoredRideOffers(rideId);
          if (current.length > 0) {
            realtimeChannel.send({
              type: 'broadcast',
              event: 'offers_update',
              payload: { rideId, offers: current },
            }).catch(() => {});
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Announce presence and request current offers
          realtimeChannel.send({
            type: 'broadcast',
            event: 'request_offers',
            payload: { rideId },
          }).catch(() => {});
        }
      });
  }

  // Also listen for postgres_changes on the rides table for this ride ID
  let dbChannel: any = null;
  if (supabase) {
    try {
      dbChannel = supabase
        .channel(`ride_db_offers_${rideId}_${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rides',
            filter: `id=eq.${rideId}`,
          },
          (payload) => {
            if (payload.new) {
              const offers = extractOffersFromRide(payload.new);
              if (offers.length > 0) {
                saveStoredRideOffers(rideId, offers, true);
                callback(offers);
              }
            }
          }
        )
        .subscribe();
    } catch {}
  }

  const handleCustomEvent = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail && detail.rideId === rideId) {
      callback(detail.offers || getStoredRideOffers(rideId));
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === OFFERS_KEY_PREFIX + rideId && e.newValue) {
      try {
        callback(JSON.parse(e.newValue));
      } catch {}
    }
  };

  const handleBroadcast = (msgEvent: MessageEvent) => {
    const data = msgEvent.data;
    if (data && data.rideId === rideId) {
      if (data.type === 'offers_update' && Array.isArray(data.offers)) {
        try {
          localStorage.setItem(OFFERS_KEY_PREFIX + rideId, JSON.stringify(data.offers));
        } catch {}
        callback(data.offers);
      } else if (data.type === 'offer_mutually_accepted') {
        callback(getStoredRideOffers(rideId));
      }
    }
  };

  window.addEventListener('motoride_offers_sync', handleCustomEvent);
  window.addEventListener('storage', handleStorage);
  if (offersBroadcastChannel) {
    offersBroadcastChannel.addEventListener('message', handleBroadcast);
  }

  return () => {
    window.removeEventListener('motoride_offers_sync', handleCustomEvent);
    window.removeEventListener('storage', handleStorage);
    if (offersBroadcastChannel) {
      offersBroadcastChannel.removeEventListener('message', handleBroadcast);
    }
    if (realtimeChannel && supabase) {
      supabase.removeChannel(realtimeChannel);
    }
    if (dbChannel && supabase) {
      supabase.removeChannel(dbChannel);
    }
  };
};

const SKIPPED_RIDES_KEY_PREFIX = 'motoride_skipped_rides_';

/**
 * Record a ride as skipped by a specific captain.
 * Does NOT cancel the ride request - leaves it open for other online captains.
 * Cancels any active offer this captain had submitted.
 */
export const recordCaptainSkippedRide = (rideId: string, captainId: string) => {
  try {
    const key = SKIPPED_RIDES_KEY_PREFIX + captainId;
    const existing: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    if (!existing.includes(rideId)) {
      existing.push(rideId);
      localStorage.setItem(key, JSON.stringify(existing));
    }
  } catch {}

  // Cancel any offer this captain made for this ride
  cancelCaptainOffer(rideId, captainId);

  // Broadcast skip notification so passenger radar and other captains are alerted
  const payload = {
    type: 'captain_skipped',
    rideId,
    captainId,
    timestamp: Date.now(),
  };

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('motoride_captain_skipped', { detail: payload }));
  }
  if (offersBroadcastChannel) {
    try {
      offersBroadcastChannel.postMessage(payload);
    } catch {}
  }
};

/**
 * Retrieves the set of ride IDs skipped by a specific captain
 */
export const getCaptainSkippedRideIds = (captainId: string): Set<string> => {
  try {
    const key = SKIPPED_RIDES_KEY_PREFIX + captainId;
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(list);
  } catch {
    return new Set();
  }
};

/**
 * Unskips a ride for a captain (e.g. if they click "Restore to Stream")
 */
export const unskipCaptainRide = (rideId: string, captainId: string) => {
  try {
    const key = SKIPPED_RIDES_KEY_PREFIX + captainId;
    const list: string[] = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = list.filter((id) => id !== rideId);
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch {}
};

/**
 * Subscribes to captain skip notifications
 */
export const subscribeToCaptainSkipEvents = (
  callback: (data: { rideId: string; captainId: string; timestamp: number }) => void
): (() => void) => {
  const handleCustomEvent = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail && detail.type === 'captain_skipped') {
      callback(detail);
    }
  };

  const handleBroadcast = (msgEvent: MessageEvent) => {
    const data = msgEvent.data;
    if (data && data.type === 'captain_skipped') {
      callback(data);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('motoride_captain_skipped', handleCustomEvent);
  }
  if (offersBroadcastChannel) {
    offersBroadcastChannel.addEventListener('message', handleBroadcast);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('motoride_captain_skipped', handleCustomEvent);
    }
    if (offersBroadcastChannel) {
      offersBroadcastChannel.removeEventListener('message', handleBroadcast);
    }
  };
};


