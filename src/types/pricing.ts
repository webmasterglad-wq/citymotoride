import { PlatformSettings } from './ride';

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

export interface OfferBiddingConfig {
  enabled: boolean;
  tier1Percent: number; // default 0% (Accept Passenger Offer)
  tier2Percent: number; // default 10% (+10% Increase)
  tier3Percent: number; // default 15% (+15% Increase)
  roundToWholeRupee: boolean; // default true
  tier1Label?: string;
  tier2Label?: string;
  tier3Label?: string;
}

export interface ExtendedPlatformPricing extends PlatformSettings {
  isAdminConfigured?: boolean;
  baseIncludedKm: number;
  perMinuteRate: number;
  minimumFare: number;
  tierMultipliers: Record<string, number>;
  tierPricing: {
    moto_comfort: TierPricingConfig;
    moto_delivery: TierPricingConfig;
  };
  biddingConfig: OfferBiddingConfig;
  lastUpdated: string;
  updatedBy: string;
}

export const DEFAULT_PLATFORM_PRICING: ExtendedPlatformPricing = {
  isAdminConfigured: false,
  baseFare: 0.0,
  baseIncludedKm: 0.0,
  perKmRate: 0.0,
  perMinuteRate: 0.0,
  minimumFare: 0.0,
  surgeMultiplier: 1.0,
  commissionRate: 15,
  autoDispatch: true,
  maxBroadcastDistanceKm: 6.5,
  tierMultipliers: {
    moto_comfort: 1.0,
    moto_quick: 1.0,
    moto_delivery: 1.0,
    moto_ev: 1.0,
  },
  tierPricing: {
    moto_comfort: {
      id: 'moto_comfort',
      name: 'Comfort Moto Ride',
      tagline: 'Comfort bike • Clean helmet included',
      icon: '🛵',
      baseFare: 0.0,
      baseIncludedKm: 0.0,
      perKmRate: 0.0,
      perMinuteRate: 0.0,
      minimumFare: 0.0,
    },
    moto_delivery: {
      id: 'moto_delivery',
      name: 'Moto Courier',
      tagline: 'Package & parcel courier',
      icon: '📦',
      baseFare: 0.0,
      baseIncludedKm: 0.0,
      perKmRate: 0.0,
      perMinuteRate: 0.0,
      minimumFare: 0.0,
    },
  },
  biddingConfig: {
    enabled: true,
    tier1Percent: 0,
    tier2Percent: 10,
    tier3Percent: 15,
    roundToWholeRupee: true,
    tier1Label: 'Accept Offer',
    tier2Label: 'Offer +10%',
    tier3Label: 'Offer +15%',
  },
  lastUpdated: new Date().toISOString(),
  updatedBy: 'Default Platform (Pending Admin Setup)',
};
