import { getSupabaseClient } from '../lib/supabase';
import { Ride, RideStatus, ConcurrencyClaimResult, CaptainEarningsSummary, CaptainOffer } from '../types/ride';
import { RealtimeChannel } from '@supabase/supabase-js';
import { notifyNewIncomingRide } from '../utils/audioAlert';

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

export const createRideBooking = async (
  params: CreateRideParams
): Promise<{ data: Ride | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { data: null, error: 'Supabase client is not configured' };
  }

  const chosenServiceType = params.service_type || 'moto_comfort';
  const isCourier = chosenServiceType === 'moto_delivery';
  const chosenTierName = params.tier_name || (isCourier ? 'Moto Courier' : 'Comfort Moto');

  try {
    const payload: any = {
      passenger_id: params.passenger_id,
      passenger_name: params.passenger_name || 'Passenger User',
      passenger_phone: params.passenger_phone || '+1 (555) 019-2834',
      captain_id: null,
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
      status: 'requested' as RideStatus,
      created_at: new Date().toISOString(),
      accepted_at: null,
      completed_at: null,
      cancelled_at: null,
    };

    let { data, error } = await supabase
      .from('rides')
      .insert([payload])
      .select()
      .single();

    // If column service_type doesn't exist yet on user's database schema, fallback without the column
    if (error && (error.message?.includes('service_type') || error.code === 'PGRST204' || error.message?.includes('column'))) {
      console.warn('[Motoride] Retrying ride insert without optional service_type column:', error.message);
      const fallbackPayload = { ...payload };
      delete fallbackPayload.service_type;

      const retryRes = await supabase
        .from('rides')
        .insert([fallbackPayload])
        .select()
        .single();

      if (retryRes.error) {
        return { data: null, error: formatSupabaseError(retryRes.error) };
      }

      const resData = retryRes.data as Ride;
      setStoredRideTier(resData.id, chosenServiceType, chosenTierName);
      const enrichedRide: Ride = {
        ...resData,
        service_type: chosenServiceType,
        tier_name: chosenTierName,
      };
      notifyNewIncomingRide(enrichedRide);
      return {
        data: enrichedRide,
        error: null,
      };
    }

    if (error) {
      console.error('[Motoride] Insert ride error:', error.message || error);
      return { data: null, error: formatSupabaseError(error) };
    }

    const resData = data as Ride;
    setStoredRideTier(resData.id, chosenServiceType, chosenTierName);
    const enrichedRide: Ride = {
      ...resData,
      service_type: resData.service_type || chosenServiceType,
      tier_name: chosenTierName,
    };
    notifyNewIncomingRide(enrichedRide);
    return {
      data: enrichedRide,
      error: null,
    };
  } catch (err: any) {
    console.error('[Motoride] Unexpected insert error:', err);
    return { data: null, error: formatSupabaseError(err) };
  }
};

export const fetchActiveRequestedRides = async (): Promise<{
  data: Ride[];
  error: string | null;
}> => {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: [], error: 'Supabase client is not configured' };

  try {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('status', 'requested')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Motoride] Fetch requested rides error:', error.message || error);
      return { data: [], error: formatSupabaseError(error) };
    }

    const rawList = (data as Ride[]) || [];
    const enrichedList = rawList.map((ride) => {
      const cached = getStoredRideTier(ride.id);
      return {
        ...ride,
        service_type: ride.service_type || cached?.tier || (ride.ride_tier as any) || 'moto_comfort',
        tier_name: ride.tier_name || cached?.tierName || (ride.service_type === 'moto_delivery' || cached?.tier === 'moto_delivery' ? 'Moto Courier' : 'Comfort Moto'),
      };
    });

    return { data: enrichedList, error: null };
  } catch (err: any) {
    return { data: [], error: formatSupabaseError(err) };
  }
};

export const fetchRideById = async (
  rideId: string
): Promise<{ data: Ride | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, error: 'Supabase client is not configured' };

  try {
    const { data, error } = await supabase
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .maybeSingle();

    if (error) {
      return { data: null, error: formatSupabaseError(error) };
    }

    if (data) {
      const extracted = extractOffersFromRide(data);
      if (extracted.length > 0) {
        (data as any).captain_offers = extracted;
        try {
          localStorage.setItem(OFFERS_KEY_PREFIX + data.id, JSON.stringify(extracted));
        } catch {}
      }
    }

    return { data: data as Ride | null, error: null };
  } catch (err: any) {
    return { data: null, error: formatSupabaseError(err) };
  }
};

export const fetchActiveRideForPassenger = async (
  passengerId: string
): Promise<{ data: Ride | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, error: 'Supabase client is not configured' };

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
    }

    return { data: data as Ride | null, error: null };
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
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, message: 'Supabase is not connected' };
  }

  const captainName = captainInfo?.name || 'Captain ' + captainId.slice(0, 5);
  const captainPhone = captainInfo?.phone || '+1 (555) 839-2049';
  const captainVehicle = captainInfo?.vehicle || 'Yamaha MT-07 • Black #7492';
  const captainRating = captainInfo?.rating || 4.92;

  // Attempt 1: Call RPC 'claim_ride' if provisioned
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('claim_ride', {
      p_ride_id: rideId,
      p_captain_id: captainId,
      p_captain_name: captainName,
      p_captain_phone: captainPhone,
      p_captain_vehicle: captainVehicle,
    });

    if (!rpcError && rpcData) {
      if (rpcData.success) {
        let finalRide = rpcData.ride as Ride;
        const updates: Record<string, any> = {
          captain_name: captainName,
          captain_phone: captainPhone,
          captain_vehicle: captainVehicle,
          captain_rating: captainRating,
        };
        if (agreedFare !== undefined && agreedFare !== null && agreedFare > 0) {
          updates.fare = agreedFare;
        }
        try {
          await supabase.from('rides').update(updates).eq('id', rideId);
          finalRide = { ...finalRide, ...updates };
        } catch {}
        return {
          success: true,
          message: 'Ride claimed successfully!',
          ride: finalRide,
        };
      } else {
        return {
          success: false,
          message: rpcData.message || 'Ride was already accepted by another captain.',
        };
      }
    }
  } catch (rpcErr) {
    console.warn('[Motoride] RPC claim_ride not available or failed, falling back to direct atomic UPDATE:', rpcErr);
  }

  // Attempt 2: Direct Atomic Conditional UPDATE (WHERE id = rideId AND status = 'requested')
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

    if (error) {
      console.error('[Motoride] Atomic update error:', error);
      return {
        success: false,
        message: `Database error: ${error.message}`,
      };
    }

    if (!data) {
      // 0 rows updated means status was no longer 'requested' (claimed by another captain or cancelled)
      return {
        success: false,
        message: 'Collision detected: Another captain already accepted this ride!',
      };
    }

    return {
      success: true,
      message: 'Ride successfully accepted!',
      ride: data as Ride,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to accept ride due to network error.',
    };
  }
};

/**
 * Update ride progression status: arrived, started, completed, cancelled
 */
export const updateRideStatus = async (
  rideId: string,
  newStatus: RideStatus
): Promise<{ data: Ride | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  if (!supabase) return { data: null, error: 'Supabase client is not configured' };

  try {
    const updatePayload: Partial<Ride> & Record<string, any> = {
      status: newStatus,
    };

    if (newStatus === 'completed') {
      updatePayload.completed_at = new Date().toISOString();
    } else if (newStatus === 'cancelled') {
      updatePayload.cancelled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('rides')
      .update(updatePayload)
      .eq('id', rideId)
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as Ride, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
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
          const enriched: Ride = {
            ...raw,
            service_type: raw.service_type || cached?.tier || (raw.ride_tier as any) || 'moto_comfort',
            tier_name: raw.tier_name || cached?.tierName || (raw.service_type === 'moto_delivery' || cached?.tier === 'moto_delivery' ? 'Moto Courier' : 'Comfort Moto'),
          };
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
          const enriched: Ride = {
            ...raw,
            service_type: raw.service_type || cached?.tier || (raw.ride_tier as any) || 'moto_comfort',
            tier_name: raw.tier_name || cached?.tierName || (raw.service_type === 'moto_delivery' || cached?.tier === 'moto_delivery' ? 'Moto Courier' : 'Comfort Moto'),
          };
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
          callbacks.onUpdate(payload.new as Ride);
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

export const createMockRideAdmin = async (): Promise<{ data: Ride | null; error: string | null }> => {
  const samplePassengers = [
    { name: 'Elena Rostova', phone: '+1 (555) 492-1084' },
    { name: 'David Kim', phone: '+1 (555) 238-9912' },
    { name: 'Aisha Patel', phone: '+1 (555) 871-3349' },
    { name: 'Lucas Vance', phone: '+1 (555) 604-7721' },
    { name: 'Zoe Martinez', phone: '+1 (555) 319-4820' },
  ];

  const samplePickups = [
    'Montgomery St Financial District',
    'Chinatown Gate, Grant Ave',
    'Powell St Cable Car Turnaround',
    'Hayes Valley Pavilion, Octavia St',
    'SoMa Tech Incubator, Howard St',
  ];

  const sampleDropoffs = [
    'Salesforce Transit Center, Mission St',
    'Embarcadero Ferry Building Pier 1',
    'Oracle Park Gate, King St',
    'Presidio Main Post Lawn',
    'Mission Dolores Park, Dolores St',
  ];

  const p = samplePassengers[Math.floor(Math.random() * samplePassengers.length)];
  const pick = samplePickups[Math.floor(Math.random() * samplePickups.length)];
  const drop = sampleDropoffs[Math.floor(Math.random() * sampleDropoffs.length)];
  const dist = Number((2.5 + Math.random() * 5).toFixed(1));
  const mins = Math.round(dist * 2.8 + 3);
  const fare = Number((5.5 + dist * 2.2).toFixed(2));

  return createRideBooking({
    passenger_id: crypto.randomUUID ? crypto.randomUUID() : 'gen-pass-' + Date.now(),
    passenger_name: p.name,
    passenger_phone: p.phone,
    pickup_location: pick,
    dropoff_location: drop,
    fare,
    distance_km: dist,
    estimated_mins: mins,
  });
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
          captain_phone: ride.captain_phone || '+1 (555) 839-2049',
          captain_vehicle: capVehicle || ride.captain_vehicle || 'Yamaha MT-07 • Black',
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
  saveStoredRideOffers(rideId, updated);
};

/**
 * Passenger accepts a captain's offer - establishes MUTUAL ACCEPTANCE!
 * 1. Atomically claims the ride in the database for this captain at agreed fare
 * 2. Marks the offer as 'accepted'
 * 3. Marks any other pending offers on this ride as 'declined'
 * 4. Broadcasts the mutual acceptance event across all tabs, windows, and Supabase Realtime
 */
export const acceptCaptainOffer = async (
  ride: Ride,
  offer: CaptainOffer
): Promise<ConcurrencyClaimResult> => {
  // First attempt atomic claim in Supabase
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
    // Update local offers state: mark this offer as accepted, others declined
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

    // Broadcast mutual acceptance over Supabase Realtime
    broadcastMutualAcceptance(ride.id, offer.captain_id, offer.offered_fare, finalRide);

    // Broadcast mutual acceptance message over BroadcastChannel
    try {
      offersBroadcastChannel?.postMessage({
        type: 'offer_mutually_accepted',
        rideId: ride.id,
        captainId: offer.captain_id,
        fare: offer.offered_fare,
        ride: finalRide,
      });
    } catch {}

    // Dispatch local custom event
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


