import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { ExtendedPlatformPricing, DEFAULT_PLATFORM_PRICING, TierPricingConfig } from '../types/pricing';

export const PRICING_STORAGE_KEY = 'motoride_platform_pricing_v4';
export const PRICING_SYNC_EVENT = 'motoride:pricing_updated';
export const PRICING_BROADCAST_CHANNEL_NAME = 'motoride_pricing_bc';
export const PRICING_REALTIME_CHANNEL = 'motoride_platform_pricing';

export const SYSTEM_PASSENGER_ID = '00000000-0000-0000-0000-000000000000';
export const SYSTEM_CONFIG_MARKER = '__PLATFORM_CONFIG__';
export const SYSTEM_PICKUP_MARKER = 'SYSTEM_CONFIG_PRICING';

// Browser BroadcastChannel instance (if supported)
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(PRICING_BROADCAST_CHANNEL_NAME);
  }
} catch {
  broadcastChannel = null;
}

// Shared Supabase Realtime channel reference
let sharedRealtimeChannel: RealtimeChannel | null = null;

/**
 * Validates and deeply merges any partial or raw pricing payload with defaults.
 * CRITICAL: Unless explicitly saved by an admin in the admin panel (isAdminConfigured === true),
 * all base fares, per-km rates, and minimum fares default strictly to ₹0.00.
 */
export function normalizePlatformPricing(raw: any): ExtendedPlatformPricing {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_PLATFORM_PRICING;
  }

  // Check if this payload represents an explicit admin update from the Admin Panel
  const isExplicitAdminConfigured = Boolean(
    raw.isAdminConfigured === true ||
    (raw.updatedBy &&
      (raw.updatedBy.includes('Admin Panel') || raw.updatedBy === 'Admin') &&
      raw.updatedBy !== 'System Admin' &&
      !raw.updatedBy.includes('Pending Admin Setup') &&
      !raw.updatedBy.includes('Default System'))
  );

  const savedTierPricing = raw.tierPricing || {};
  const savedComfort = savedTierPricing.moto_comfort || {};
  const savedDelivery = savedTierPricing.moto_delivery || {};
  const savedBidding = raw.biddingConfig || {};

  // If not explicitly configured by an admin, strictly enforce ₹0.00
  const comfortBaseFare = isExplicitAdminConfigured
    ? Number(savedComfort.baseFare ?? raw.baseFare ?? 0.0)
    : 0.0;
  const comfortPerKm = isExplicitAdminConfigured
    ? Number(savedComfort.perKmRate ?? raw.perKmRate ?? 0.0)
    : 0.0;
  const comfortIncludedKm = isExplicitAdminConfigured
    ? Number(savedComfort.baseIncludedKm ?? raw.baseIncludedKm ?? 0.0)
    : 0.0;
  const comfortPerMin = isExplicitAdminConfigured
    ? Number(savedComfort.perMinuteRate ?? raw.perMinuteRate ?? 0.0)
    : 0.0;
  const comfortMinFare = isExplicitAdminConfigured
    ? Number(savedComfort.minimumFare ?? raw.minimumFare ?? 0.0)
    : 0.0;

  // Resolve Moto Courier rates (strictly ₹0.00 if unconfigured)
  const deliveryBaseFare = isExplicitAdminConfigured
    ? Number(savedDelivery.baseFare ?? 0.0)
    : 0.0;
  const deliveryPerKm = isExplicitAdminConfigured
    ? Number(savedDelivery.perKmRate ?? 0.0)
    : 0.0;
  const deliveryIncludedKm = isExplicitAdminConfigured
    ? Number(savedDelivery.baseIncludedKm ?? 0.0)
    : 0.0;
  const deliveryPerMin = isExplicitAdminConfigured
    ? Number(savedDelivery.perMinuteRate ?? 0.0)
    : 0.0;
  const deliveryMinFare = isExplicitAdminConfigured
    ? Number(savedDelivery.minimumFare ?? 0.0)
    : 0.0;

  return {
    ...DEFAULT_PLATFORM_PRICING,
    ...raw,
    isAdminConfigured: isExplicitAdminConfigured,
    baseFare: comfortBaseFare,
    perKmRate: comfortPerKm,
    baseIncludedKm: comfortIncludedKm,
    perMinuteRate: comfortPerMin,
    minimumFare: comfortMinFare,
    surgeMultiplier: Number(raw.surgeMultiplier ?? DEFAULT_PLATFORM_PRICING.surgeMultiplier),
    commissionRate: Number(raw.commissionRate ?? DEFAULT_PLATFORM_PRICING.commissionRate),
    tierMultipliers: {
      ...DEFAULT_PLATFORM_PRICING.tierMultipliers,
      ...(raw.tierMultipliers || {}),
    },
    tierPricing: {
      moto_comfort: {
        ...DEFAULT_PLATFORM_PRICING.tierPricing.moto_comfort,
        ...savedComfort,
        baseFare: comfortBaseFare,
        perKmRate: comfortPerKm,
        baseIncludedKm: comfortIncludedKm,
        perMinuteRate: comfortPerMin,
        minimumFare: comfortMinFare,
      },
      moto_delivery: {
        ...DEFAULT_PLATFORM_PRICING.tierPricing.moto_delivery,
        ...savedDelivery,
        baseFare: deliveryBaseFare,
        perKmRate: deliveryPerKm,
        baseIncludedKm: deliveryIncludedKm,
        perMinuteRate: deliveryPerMin,
        minimumFare: deliveryMinFare,
      },
    },
    biddingConfig: {
      ...DEFAULT_PLATFORM_PRICING.biddingConfig,
      ...savedBidding,
    },
    lastUpdated: raw.lastUpdated || new Date().toISOString(),
    updatedBy: isExplicitAdminConfigured
      ? (raw.updatedBy || 'Admin Panel')
      : 'Default Platform (Pending Admin Setup)',
  };
}

/**
 * Loads pricing from browser localStorage with safe default fallback
 */
export function loadLocalPricing(): ExtendedPlatformPricing {
  try {
    // Purge legacy storage keys to prevent obsolete cached 25.0 / 20.0 fares from appearing
    const legacyKeys = [
      'motoride_platform_pricing_config',
      'motoride_platform_pricing_v2',
      'motoride_platform_pricing_v3',
    ];
    for (const key of legacyKeys) {
      if (typeof window !== 'undefined' && localStorage.getItem(key)) {
        try {
          const legacyObj = JSON.parse(localStorage.getItem(key) || '');
          if (!legacyObj?.isAdminConfigured) {
            localStorage.removeItem(key);
          }
        } catch {
          localStorage.removeItem(key);
        }
      }
    }

    const raw = typeof window !== 'undefined' ? localStorage.getItem(PRICING_STORAGE_KEY) : null;
    if (raw) {
      return normalizePlatformPricing(JSON.parse(raw));
    }
  } catch (err) {
    console.warn('[PricingService] Failed to read local pricing storage:', err);
  }
  return DEFAULT_PLATFORM_PRICING;
}

/**
 * Saves pricing to localStorage and dispatches local and cross-tab events
 */
export function saveLocalPricing(pricing: ExtendedPlatformPricing): void {
  try {
    localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(pricing));
  } catch (err) {
    console.warn('[PricingService] Failed to save local pricing storage:', err);
  }

  // Local window event
  try {
    window.dispatchEvent(new CustomEvent(PRICING_SYNC_EVENT, { detail: pricing }));
  } catch {}

  // Cross-tab BroadcastChannel
  try {
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'pricing_updated', pricing });
    }
  } catch {}
}

/**
 * Fetches the latest platform pricing from Supabase remote database.
 * Tries `platform_settings` table first, followed by system configuration row fallback in `rides`.
 */
export async function fetchRemotePlatformPricing(): Promise<ExtendedPlatformPricing | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    // 1. Try dedicated platform_settings table
    const { data: settingsData, error: settingsError } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'pricing_config')
      .maybeSingle();

    if (!settingsError && settingsData?.value) {
      const normalized = normalizePlatformPricing(settingsData.value);
      saveLocalPricing(normalized);
      return normalized;
    }
  } catch (e) {
    // platform_settings table may not exist yet in user's schema
  }

  try {
    // 2. Fallback: Query system configuration row from rides table
    const { data: rideConfigData, error: rideConfigError } = await supabase
      .from('rides')
      .select('dropoff_location')
      .eq('passenger_name', SYSTEM_CONFIG_MARKER)
      .eq('pickup_location', SYSTEM_PICKUP_MARKER)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!rideConfigError && rideConfigData?.dropoff_location) {
      const parsed = JSON.parse(rideConfigData.dropoff_location);
      const normalized = normalizePlatformPricing(parsed);
      saveLocalPricing(normalized);
      return normalized;
    }
  } catch (err) {
    console.warn('[PricingService] Remote pricing fallback read note:', err);
  }

  return null;
}

/**
 * Persists the updated platform pricing to Supabase and broadcasts to all live mobile apps.
 */
export async function saveRemotePlatformPricing(
  pricing: ExtendedPlatformPricing
): Promise<{ success: boolean; error?: string }> {
  // 1. Immediate local save
  saveLocalPricing(pricing);

  // 2. Broadcast via Supabase Realtime channel to all connected passenger & captain apps
  broadcastPricingUpdate(pricing);

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: true };
  }

  let dbSaved = false;

  // 3. Attempt to save to platform_settings table
  try {
    const { error: settingsError } = await supabase
      .from('platform_settings')
      .upsert({
        key: 'pricing_config',
        value: pricing,
        updated_at: new Date().toISOString(),
      });

    if (!settingsError) {
      dbSaved = true;
    }
  } catch (e) {
    // ignore if table not present
  }

  // 4. Always ensure system configuration row in rides is up to date
  try {
    const payloadJson = JSON.stringify(pricing);
    const { data: updatedRows, error: updateError } = await supabase
      .from('rides')
      .update({
        pickup_location: SYSTEM_PICKUP_MARKER,
        dropoff_location: payloadJson,
        fare: pricing.tierPricing.moto_comfort.perKmRate,
        distance_km: pricing.tierPricing.moto_delivery.perKmRate,
      })
      .eq('passenger_name', SYSTEM_CONFIG_MARKER)
      .select('id');

    if (!updateError && updatedRows && updatedRows.length > 0) {
      dbSaved = true;
    } else {
      const { error: insertError } = await supabase.from('rides').insert({
        passenger_id: SYSTEM_PASSENGER_ID,
        passenger_name: SYSTEM_CONFIG_MARKER,
        pickup_location: SYSTEM_PICKUP_MARKER,
        dropoff_location: payloadJson,
        fare: pricing.tierPricing.moto_comfort.perKmRate,
        distance_km: pricing.tierPricing.moto_delivery.perKmRate,
        status: 'cancelled',
      });
      if (!insertError) {
        dbSaved = true;
      }
    }
  } catch (err: any) {
    console.warn('[PricingService] Remote pricing DB fallback note:', err?.message || err);
  }

  return { success: true };
}

/**
 * Broadcasts pricing to all connected clients over Supabase Realtime WebSocket
 */
export function broadcastPricingUpdate(pricing: ExtendedPlatformPricing): void {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    if (!sharedRealtimeChannel) {
      sharedRealtimeChannel = supabase.channel(PRICING_REALTIME_CHANNEL, {
        config: {
          broadcast: { ack: false },
        },
      });
      sharedRealtimeChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED' && sharedRealtimeChannel) {
          sharedRealtimeChannel
            .send({
              type: 'broadcast',
              event: 'pricing_updated',
              payload: pricing,
            })
            .catch(() => {});
        }
      });
    } else {
      sharedRealtimeChannel
        .send({
          type: 'broadcast',
          event: 'pricing_updated',
          payload: pricing,
        })
        .catch(() => {});
    }
  } catch (err) {
    console.warn('[PricingService] Realtime broadcast error:', err);
  }
}

/**
 * Subscribes to real-time pricing changes across devices, tabs, and network.
 * Immediately fetches the latest remote database pricing on initialization.
 */
export function subscribeToPricingUpdates(
  onUpdate: (pricing: ExtendedPlatformPricing, source: 'remote_broadcast' | 'remote_db' | 'cross_tab' | 'storage') => void
): () => void {
  let isSubscribed = true;

  // 1. Initial Remote Fetch from Supabase
  fetchRemotePlatformPricing().then((remotePricing) => {
    if (isSubscribed && remotePricing) {
      onUpdate(remotePricing, 'remote_db');
    }
  });

  // 2. Window CustomEvent listener
  const handleCustomEvent = (e: Event) => {
    const customEvent = e as CustomEvent<ExtendedPlatformPricing>;
    if (customEvent.detail && isSubscribed) {
      onUpdate(customEvent.detail, 'storage');
    }
  };
  window.addEventListener(PRICING_SYNC_EVENT, handleCustomEvent);

  // 3. Window localStorage storage event (other tabs)
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === PRICING_STORAGE_KEY && e.newValue && isSubscribed) {
      try {
        const parsed = JSON.parse(e.newValue);
        onUpdate(normalizePlatformPricing(parsed), 'storage');
      } catch {}
    }
  };
  window.addEventListener('storage', handleStorageEvent);

  // 4. Browser BroadcastChannel listener
  const handleBroadcastMessage = (event: MessageEvent) => {
    if (event.data?.type === 'pricing_updated' && event.data?.pricing && isSubscribed) {
      onUpdate(normalizePlatformPricing(event.data.pricing), 'cross_tab');
    }
  };
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcastMessage);
  }

  // 5. Supabase Realtime WebSocket (Broadcast + Postgres Changes across mobile apps)
  let supabaseChannel: RealtimeChannel | null = null;
  let postgresChannel: RealtimeChannel | null = null;
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      // 5a. Broadcast channel
      supabaseChannel = supabase
        .channel(PRICING_REALTIME_CHANNEL, {
          config: {
            broadcast: { ack: false },
          },
        })
        .on('broadcast', { event: 'pricing_updated' }, ({ payload }) => {
          if (payload && isSubscribed) {
            const normalized = normalizePlatformPricing(payload);
            saveLocalPricing(normalized);
            onUpdate(normalized, 'remote_broadcast');
          }
        })
        .on('broadcast', { event: 'request_pricing_sync' }, () => {
          const current = loadLocalPricing();
          if (supabaseChannel && current.isAdminConfigured) {
            supabaseChannel
              .send({
                type: 'broadcast',
                event: 'pricing_updated',
                payload: current,
              })
              .catch(() => {});
          }
        });

      supabaseChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED' && supabaseChannel) {
          supabaseChannel
            .send({
              type: 'broadcast',
              event: 'request_pricing_sync',
              payload: {},
            })
            .catch(() => {});
        }
      });

      // 5b. Postgres Changes listener on rides system config row
      postgresChannel = supabase
        .channel('motoride_pricing_db_sync')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'rides',
            filter: `passenger_name=eq.${SYSTEM_CONFIG_MARKER}`,
          },
          (payload: any) => {
            const newRecord = payload.new;
            if (newRecord?.dropoff_location && isSubscribed) {
              try {
                const parsed = JSON.parse(newRecord.dropoff_location);
                const normalized = normalizePlatformPricing(parsed);
                saveLocalPricing(normalized);
                onUpdate(normalized, 'remote_db');
              } catch (e) {
                console.warn('[PricingService] Postgres change payload parse error:', e);
              }
            }
          }
        );
      postgresChannel.subscribe();
    } catch (err) {
      console.warn('[PricingService] Supabase Realtime subscribe note:', err);
    }
  }

  // 6. Mobile Visibility / Focus auto-sync (whenever user returns to app)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && isSubscribed && isSupabaseConfigured()) {
      fetchRemotePlatformPricing().then((remotePricing) => {
        if (isSubscribed && remotePricing) {
          onUpdate(remotePricing, 'remote_db');
        }
      });
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleVisibilityChange);

  // 7. Fast periodic polling (every 4 seconds) to ensure real-time sync across separate mobile apps
  const refreshInterval = setInterval(() => {
    if (isSubscribed && isSupabaseConfigured()) {
      fetchRemotePlatformPricing().then((remotePricing) => {
        if (isSubscribed && remotePricing) {
          onUpdate(remotePricing, 'remote_db');
        }
      });
    }
  }, 4000);

  // Cleanup function
  return () => {
    isSubscribed = false;
    clearInterval(refreshInterval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleVisibilityChange);
    window.removeEventListener(PRICING_SYNC_EVENT, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcastMessage);
    }
    if (supabaseChannel && supabase) {
      supabase.removeChannel(supabaseChannel).catch(() => {});
    }
    if (postgresChannel && supabase) {
      supabase.removeChannel(postgresChannel).catch(() => {});
    }
  };
}
