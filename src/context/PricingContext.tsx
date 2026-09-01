import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PlatformSettings } from '../types/ride';
import { FareBreakdown, calculateMotoFare } from '../utils/fareCalculator';

export interface TierPricingConfig {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  baseFare: number;
  baseIncludedKm: number;
  perKmRate: number;
  perMinuteRate: number;
  minimumFare: number;
}

export interface ExtendedPlatformPricing extends PlatformSettings {
  baseIncludedKm: number;
  perMinuteRate: number;
  minimumFare: number;
  tierMultipliers: Record<string, number>;
  tierPricing: {
    moto_comfort: TierPricingConfig;
    moto_delivery: TierPricingConfig;
  };
  lastUpdated: string;
  updatedBy: string;
}

export const DEFAULT_PLATFORM_PRICING: ExtendedPlatformPricing = {
  baseFare: 25.0,
  baseIncludedKm: 1.5,
  perKmRate: 9.0,
  perMinuteRate: 0.5,
  minimumFare: 25.0,
  surgeMultiplier: 1.0,
  commissionRate: 15,
  autoDispatch: true,
  maxBroadcastDistanceKm: 6.5,
  tierMultipliers: {
    moto_comfort: 1.0,
    moto_quick: 1.15,
    moto_delivery: 0.85,
    moto_ev: 0.95,
  },
  tierPricing: {
    moto_comfort: {
      id: 'moto_comfort',
      name: 'Comfort Moto Ride',
      tagline: 'Comfort bike • Clean helmet included',
      icon: '🛵',
      baseFare: 25.0,
      baseIncludedKm: 1.5,
      perKmRate: 9.0,
      perMinuteRate: 0.5,
      minimumFare: 25.0,
    },
    moto_delivery: {
      id: 'moto_delivery',
      name: 'Moto Courier',
      tagline: 'Package & parcel courier delivery',
      icon: '📦',
      baseFare: 20.0,
      baseIncludedKm: 1.5,
      perKmRate: 7.5,
      perMinuteRate: 0.3,
      minimumFare: 20.0,
    },
  },
  lastUpdated: new Date().toISOString(),
  updatedBy: 'System Admin',
};

const STORAGE_KEY = 'motoride_platform_pricing_config';
const SYNC_EVENT = 'motoride:pricing_updated';

interface PricingContextType {
  pricing: ExtendedPlatformPricing;
  updatePricing: (updates: Partial<ExtendedPlatformPricing>) => void;
  updateTierPricing: (tierId: 'moto_comfort' | 'moto_delivery', updates: Partial<TierPricingConfig>) => void;
  resetPricingToDefault: () => void;
  calculateFare: (params: {
    distanceKm: number;
    estimatedMins: number;
    tierId?: string;
    tierMultiplier?: number;
    tierName?: string;
    pickupLocation?: string;
    customSurgeMultiplier?: number;
    isAccurateRoute?: boolean;
  }) => FareBreakdown;
  isCustomized: boolean;
}

const PricingContext = createContext<PricingContextType | undefined>(undefined);

function loadSavedPricing(): ExtendedPlatformPricing {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const savedTierPricing = parsed.tierPricing || {};
      return {
        ...DEFAULT_PLATFORM_PRICING,
        ...parsed,
        tierMultipliers: {
          ...DEFAULT_PLATFORM_PRICING.tierMultipliers,
          ...(parsed.tierMultipliers || {}),
        },
        tierPricing: {
          moto_comfort: {
            ...DEFAULT_PLATFORM_PRICING.tierPricing.moto_comfort,
            ...(savedTierPricing.moto_comfort || {}),
            // Ensure synchronization with top-level baseFare/perKmRate if legacy
            baseFare: savedTierPricing.moto_comfort?.baseFare ?? parsed.baseFare ?? DEFAULT_PLATFORM_PRICING.tierPricing.moto_comfort.baseFare,
            perKmRate: savedTierPricing.moto_comfort?.perKmRate ?? parsed.perKmRate ?? DEFAULT_PLATFORM_PRICING.tierPricing.moto_comfort.perKmRate,
            baseIncludedKm: savedTierPricing.moto_comfort?.baseIncludedKm ?? parsed.baseIncludedKm ?? DEFAULT_PLATFORM_PRICING.tierPricing.moto_comfort.baseIncludedKm,
            perMinuteRate: savedTierPricing.moto_comfort?.perMinuteRate ?? parsed.perMinuteRate ?? DEFAULT_PLATFORM_PRICING.tierPricing.moto_comfort.perMinuteRate,
            minimumFare: savedTierPricing.moto_comfort?.minimumFare ?? parsed.minimumFare ?? DEFAULT_PLATFORM_PRICING.tierPricing.moto_comfort.minimumFare,
          },
          moto_delivery: {
            ...DEFAULT_PLATFORM_PRICING.tierPricing.moto_delivery,
            ...(savedTierPricing.moto_delivery || {}),
          },
        },
      };
    }
  } catch (err) {
    console.warn('Failed to load saved platform pricing', err);
  }
  return DEFAULT_PLATFORM_PRICING;
}

export const PricingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pricing, setPricing] = useState<ExtendedPlatformPricing>(loadSavedPricing);

  // Sync across tabs and windows
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const savedTierPricing = parsed.tierPricing || {};
          setPricing({
            ...DEFAULT_PLATFORM_PRICING,
            ...parsed,
            tierMultipliers: {
              ...DEFAULT_PLATFORM_PRICING.tierMultipliers,
              ...(parsed.tierMultipliers || {}),
            },
            tierPricing: {
              moto_comfort: {
                ...DEFAULT_PLATFORM_PRICING.tierPricing.moto_comfort,
                ...(savedTierPricing.moto_comfort || {}),
              },
              moto_delivery: {
                ...DEFAULT_PLATFORM_PRICING.tierPricing.moto_delivery,
                ...(savedTierPricing.moto_delivery || {}),
              },
            },
          });
        } catch {
          // ignore
        }
      }
    };

    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ExtendedPlatformPricing>;
      if (customEvent.detail) {
        setPricing(customEvent.detail);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(SYNC_EVENT, handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(SYNC_EVENT, handleCustomEvent);
    };
  }, []);

  const updatePricing = (updates: Partial<ExtendedPlatformPricing>) => {
    setPricing((prev) => {
      const next: ExtendedPlatformPricing = {
        ...prev,
        ...updates,
        tierMultipliers: {
          ...prev.tierMultipliers,
          ...(updates.tierMultipliers || {}),
        },
        tierPricing: {
          moto_comfort: {
            ...prev.tierPricing.moto_comfort,
            ...(updates.tierPricing?.moto_comfort || {}),
            ...(updates.baseFare !== undefined ? { baseFare: updates.baseFare } : {}),
            ...(updates.perKmRate !== undefined ? { perKmRate: updates.perKmRate } : {}),
            ...(updates.baseIncludedKm !== undefined ? { baseIncludedKm: updates.baseIncludedKm } : {}),
            ...(updates.perMinuteRate !== undefined ? { perMinuteRate: updates.perMinuteRate } : {}),
            ...(updates.minimumFare !== undefined ? { minimumFare: updates.minimumFare } : {}),
          },
          moto_delivery: {
            ...prev.tierPricing.moto_delivery,
            ...(updates.tierPricing?.moto_delivery || {}),
          },
        },
        lastUpdated: new Date().toISOString(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: next }));
      } catch (err) {
        console.error('Failed to save platform pricing to storage', err);
      }
      return next;
    });
  };

  const updateTierPricing = (tierId: 'moto_comfort' | 'moto_delivery', updates: Partial<TierPricingConfig>) => {
    setPricing((prev) => {
      const currentTier = prev.tierPricing[tierId];
      const updatedTier = { ...currentTier, ...updates };

      const next: ExtendedPlatformPricing = {
        ...prev,
        tierPricing: {
          ...prev.tierPricing,
          [tierId]: updatedTier,
        },
        // If updating comfort moto, sync primary platform default rates
        ...(tierId === 'moto_comfort'
          ? {
              baseFare: updatedTier.baseFare,
              baseIncludedKm: updatedTier.baseIncludedKm,
              perKmRate: updatedTier.perKmRate,
              perMinuteRate: updatedTier.perMinuteRate,
              minimumFare: updatedTier.minimumFare,
            }
          : {}),
        lastUpdated: new Date().toISOString(),
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: next }));
      } catch (err) {
        console.error('Failed to save tier pricing to storage', err);
      }
      return next;
    });
  };

  const resetPricingToDefault = () => {
    const reset = {
      ...DEFAULT_PLATFORM_PRICING,
      lastUpdated: new Date().toISOString(),
    };
    setPricing(reset);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reset));
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: reset }));
    } catch (err) {
      console.error('Failed to reset platform pricing', err);
    }
  };

  const calculateFare = (params: {
    distanceKm: number;
    estimatedMins: number;
    tierId?: string;
    tierMultiplier?: number;
    tierName?: string;
    pickupLocation?: string;
    customSurgeMultiplier?: number;
    isAccurateRoute?: boolean;
  }): FareBreakdown => {
    const isDelivery = params.tierId === 'moto_delivery';
    const tierConfig = isDelivery
      ? pricing.tierPricing.moto_delivery
      : pricing.tierPricing.moto_comfort;

    const baseFare = tierConfig?.baseFare ?? (isDelivery ? 20.0 : pricing.baseFare);
    const baseIncludedKm = tierConfig?.baseIncludedKm ?? (isDelivery ? 1.5 : pricing.baseIncludedKm);
    const perKmRate = tierConfig?.perKmRate ?? (isDelivery ? 7.5 : pricing.perKmRate);
    const perMinuteRate = tierConfig?.perMinuteRate ?? (isDelivery ? 0.3 : pricing.perMinuteRate);
    const minimumFare = tierConfig?.minimumFare ?? (isDelivery ? 20.0 : pricing.minimumFare);

    return calculateMotoFare({
      ...params,
      tierId: params.tierId || 'moto_comfort',
      tierMultiplier: 1.0, // Direct rates applied
      tierName: tierConfig?.name ?? (isDelivery ? 'Moto Courier' : 'Comfort Moto Ride'),
      customBaseFare: baseFare,
      customPerKmRate: perKmRate,
      customBaseIncludedKm: baseIncludedKm,
      customPerMinuteRate: perMinuteRate,
      customMinimumFare: minimumFare,
      customSurgeMultiplier:
        params.customSurgeMultiplier !== undefined
          ? params.customSurgeMultiplier
          : pricing.surgeMultiplier > 1.0
          ? pricing.surgeMultiplier
          : undefined,
    });
  };

  const isCustomized =
    pricing.baseFare !== DEFAULT_PLATFORM_PRICING.baseFare ||
    pricing.perKmRate !== DEFAULT_PLATFORM_PRICING.perKmRate ||
    pricing.surgeMultiplier !== DEFAULT_PLATFORM_PRICING.surgeMultiplier ||
    pricing.commissionRate !== DEFAULT_PLATFORM_PRICING.commissionRate ||
    pricing.minimumFare !== DEFAULT_PLATFORM_PRICING.minimumFare ||
    pricing.tierPricing.moto_delivery.baseFare !== DEFAULT_PLATFORM_PRICING.tierPricing.moto_delivery.baseFare ||
    pricing.tierPricing.moto_delivery.perKmRate !== DEFAULT_PLATFORM_PRICING.tierPricing.moto_delivery.perKmRate;

  return (
    <PricingContext.Provider
      value={{
        pricing,
        updatePricing,
        updateTierPricing,
        resetPricingToDefault,
        calculateFare,
        isCustomized,
      }}
    >
      {children}
    </PricingContext.Provider>
  );
};

export const usePricing = (): PricingContextType => {
  const context = useContext(PricingContext);
  if (!context) {
    throw new Error('usePricing must be used within a PricingProvider');
  }
  return context;
};
