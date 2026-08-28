import { getSupabaseClient } from '../lib/supabase';
import { Ride, RideStatus, ConcurrencyClaimResult } from '../types/ride';
import { RealtimeChannel } from '@supabase/supabase-js';

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
}

export const createRideBooking = async (
  params: CreateRideParams
): Promise<{ data: Ride | null; error: string | null }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { data: null, error: 'Supabase client is not configured' };
  }

  try {
    const payload = {
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
      status: 'requested' as RideStatus,
      created_at: new Date().toISOString(),
      accepted_at: null,
      completed_at: null,
      cancelled_at: null,
    };

    const { data, error } = await supabase
      .from('rides')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[Motoride] Insert ride error:', error.message || error);
      return { data: null, error: formatSupabaseError(error) };
    }

    return { data: data as Ride, error: null };
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

    return { data: (data as Ride[]) || [], error: null };
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
    return { data: data as Ride | null, error: null };
  } catch (err: any) {
    return { data: null, error: formatSupabaseError(err) };
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
 * Atomic Claim Ride with Concurrency Protection
 * Prevents two captains from accepting the same ride.
 * Tries RPC 'claim_ride' first, with atomic conditional UPDATE fallback.
 */
export const claimRideAtomic = async (
  rideId: string,
  captainId: string,
  captainInfo?: { name: string; phone?: string; vehicle?: string; rating?: number }
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
        return {
          success: true,
          message: 'Ride claimed successfully!',
          ride: rpcData.ride as Ride,
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
    const { data, error } = await supabase
      .from('rides')
      .update({
        captain_id: captainId,
        status: 'accepted',
        accepted_at: now,
        captain_name: captainName,
        captain_phone: captainPhone,
        captain_vehicle: captainVehicle,
        captain_rating: captainRating,
      })
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
    .subscribe((status, err) => {
      if (callbacks.onStatusChange) {
        callbacks.onStatusChange(status as any, err);
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('[Motoride Realtime Captain] Channel Error:', err);
      } else if (status === 'TIMED_OUT') {
        console.error('[Motoride Realtime Captain] Channel Timed Out:', err);
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
        console.error(`[Motoride Realtime Passenger] Ride ${rideId} Channel Error:`, err);
      } else if (status === 'TIMED_OUT') {
        console.error(`[Motoride Realtime Passenger] Ride ${rideId} Channel Timed Out:`, err);
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
        console.error('[Admin Realtime] Channel Error:', err);
      }
    });

  return channel;
};

