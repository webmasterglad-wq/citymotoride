import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { FareBreakdown, calculateMotoFare } from '../utils/fareCalculator';
import {
  ExtendedPlatformPricing,
  DEFAULT_PLATFORM_PRICING,
  TierPricingConfig,
  OfferBiddingConfig,
} from '../types/pricing';
import {
  loadLocalPricing,
  saveRemotePlatformPricing,
  subscribeToPricingUpdates,
  normalizePlatformPricing,
} from '../services/pricingService';

export type { TierPricingConfig, OfferBiddingConfig, ExtendedPlatformPricing };
export { DEFAULT_PLATFORM_PRICING };

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
  lastSyncSource: string | null;
}

const PricingContext = createContext<PricingContextType | undefined>(undefined);

export const PricingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [pricing, setPricing] = useState<ExtendedPlatformPricing>(loadLocalPricing);
  const [lastSyncSource, setLastSyncSource] = useState<string | null>(null);

  // Cross-device, cross-tab, and Supabase Realtime synchronization
  useEffect(() => {
    const unsubscribe = subscribeToPricingUpdates((updatedPricing, source) => {
      setPricing(updatedPricing);
      setLastSyncSource(source);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const updatePricing = (updates: Partial<ExtendedPlatformPricing>) => {
    setPricing((prev) => {
      const nextRaw: Partial<ExtendedPlatformPricing> = {
        ...prev,
        ...updates,
        isAdminConfigured: true,
        updatedBy: 'Admin Panel',
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
        biddingConfig: {
          ...prev.biddingConfig,
          ...(updates.biddingConfig || {}),
        },
        lastUpdated: new Date().toISOString(),
      };
      const next = normalizePlatformPricing(nextRaw);
      // Persist to Supabase and broadcast over Supabase Realtime to all mobile apps
      saveRemotePlatformPricing(next).catch((err) => {
        console.warn('[PricingContext] Save remote pricing error:', err);
      });
      return next;
    });
  };

  const updateTierPricing = (tierId: 'moto_comfort' | 'moto_delivery', updates: Partial<TierPricingConfig>) => {
    setPricing((prev) => {
      const currentTier = prev.tierPricing[tierId];
      const updatedTier = { ...currentTier, ...updates };

      const nextRaw: Partial<ExtendedPlatformPricing> = {
        ...prev,
        isAdminConfigured: true,
        updatedBy: 'Admin Panel',
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
      const next = normalizePlatformPricing(nextRaw);
      // Persist to Supabase and broadcast over Supabase Realtime to all mobile apps
      saveRemotePlatformPricing(next).catch((err) => {
        console.warn('[PricingContext] Save remote tier pricing error:', err);
      });
      return next;
    });
  };

  const resetPricingToDefault = () => {
    const reset = {
      ...DEFAULT_PLATFORM_PRICING,
      lastUpdated: new Date().toISOString(),
    };
    setPricing(reset);
    saveRemotePlatformPricing(reset).catch((err) => {
      console.warn('[PricingContext] Reset remote pricing error:', err);
    });
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
        lastSyncSource,
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
