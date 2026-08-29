import { LatLng, resolveLocationCoords, calculateDistanceKm, detectZoneForLocation } from './geoUtils';

export interface FareBreakdown {
  baseFare: number;
  baseIncludedKm: number;
  distanceKm: number;
  billableDistanceKm: number;
  perKmRate: number;
  distanceFare: number;
  timeMinutes: number;
  perMinuteRate: number;
  timeFare: number;
  subtotal: number;
  surgeMultiplier: number;
  surgeAmount: number;
  zoneName: string;
  tierId: string;
  tierName: string;
  tierMultiplier: number;
  minimumFare: number;
  totalFare: number;
  currency: string;
  currencySymbol: string;
  isAccurateRoute: boolean;
}

export interface RouteDistanceResult {
  distanceKm: number;
  estimatedMins: number;
  pickupCoords: LatLng;
  dropoffCoords: LatLng;
  zoneName: string;
  surgeMultiplier: number;
}

/**
 * Standard Platform Pricing Defaults (Tricity Moto INR)
 */
export const DEFAULT_PRICING = {
  baseFare: 20.0,           // ₹20 base fee (covers first 1.5 km)
  baseIncludedKm: 1.5,      // 1.5 km included in base
  perKmRate: 8.0,           // ₹8 per km after base distance
  perMinuteRate: 0.5,       // ₹0.50 per minute of estimated trip time
  minimumFare: 25.0,        // ₹25 absolute minimum ride charge
  roadCircuityFactor: 1.25, // Multiplier for straight-line Haversine to real road route
};

/**
 * Calculates geographic & estimated road distance between two address strings or LatLng coordinates.
 */
export function calculateEstimatedRoute(
  pickup: string | LatLng,
  dropoff: string | LatLng
): RouteDistanceResult {
  const pickupCoords = typeof pickup === 'string' ? resolveLocationCoords(pickup) : pickup;
  const dropoffCoords = typeof dropoff === 'string' ? resolveLocationCoords(dropoff) : dropoff;

  // Direct great-circle distance
  const straightDistance = calculateDistanceKm(pickupCoords, dropoffCoords);
  
  // Calculate road network distance with circuity factor
  let roadDistance = Number((straightDistance * DEFAULT_PRICING.roadCircuityFactor).toFixed(1));

  // Minimum sensible distance floor for any distinct pickup/dropoff
  if (straightDistance < 0.2) {
    // If the two strings or coords are virtually identical
    const isSameAddress = typeof pickup === 'string' && typeof dropoff === 'string' && pickup.trim().toLowerCase() === dropoff.trim().toLowerCase();
    roadDistance = isSameAddress ? 0.0 : 1.2;
  } else if (roadDistance < 1.0) {
    roadDistance = 1.0;
  }

  // Realistic city motorcycle speed (~25-32 km/h in Indian urban conditions)
  // Base 3 minutes dispatch/boarding + variable travel time
  let estimatedMins = Math.max(3, Math.round(roadDistance * 2.2 + 3));

  // Detect zone & dynamic surge for pickup location
  const zone = detectZoneForLocation(typeof pickup === 'string' ? pickup : pickupCoords);

  return {
    distanceKm: roadDistance,
    estimatedMins,
    pickupCoords,
    dropoffCoords,
    zoneName: zone.name,
    surgeMultiplier: zone.surgeMultiplier || 1.0,
  };
}

/**
 * Comprehensive Fare Calculator Engine.
 * Supports base allowance, per-km rates, time charges, zone surge, and vehicle category tiers.
 */
export function calculateMotoFare({
  distanceKm,
  estimatedMins,
  tierId = 'moto_comfort',
  tierMultiplier = 1.0,
  tierName = 'Comfort Ride',
  pickupLocation,
  customBaseFare,
  customPerKmRate,
  customSurgeMultiplier,
  isAccurateRoute = false,
}: {
  distanceKm: number;
  estimatedMins: number;
  tierId?: string;
  tierMultiplier?: number;
  tierName?: string;
  pickupLocation?: string;
  customBaseFare?: number;
  customPerKmRate?: number;
  customSurgeMultiplier?: number;
  isAccurateRoute?: boolean;
}): FareBreakdown {
  const baseFare = customBaseFare ?? DEFAULT_PRICING.baseFare;
  const baseIncludedKm = DEFAULT_PRICING.baseIncludedKm;
  const perKmRate = customPerKmRate ?? DEFAULT_PRICING.perKmRate;
  const perMinuteRate = DEFAULT_PRICING.perMinuteRate;
  const minimumFare = DEFAULT_PRICING.minimumFare;

  // Determine surge from location or custom override
  let surgeMultiplier = 1.0;
  let zoneName = 'Standard Area';
  if (customSurgeMultiplier !== undefined) {
    surgeMultiplier = customSurgeMultiplier;
  } else if (pickupLocation) {
    const zone = detectZoneForLocation(pickupLocation);
    surgeMultiplier = zone.surgeMultiplier || 1.0;
    zoneName = zone.name;
  }

  // Billable distance after base allowance
  const safeDistance = Math.max(0, distanceKm);
  const billableDistanceKm = Math.max(0, Number((safeDistance - baseIncludedKm).toFixed(2)));
  const distanceFare = Number((billableDistanceKm * perKmRate).toFixed(2));

  // Time charge
  const safeMins = Math.max(1, estimatedMins);
  const timeFare = Number((safeMins * perMinuteRate).toFixed(2));

  // Subtotal before surge and tier
  const subtotal = Number((baseFare + distanceFare + timeFare).toFixed(2));

  // Surge calculation
  const surgeAmount = Number((subtotal * Math.max(0, surgeMultiplier - 1.0)).toFixed(2));

  // Total with Tier multiplier applied
  const rawTotal = (subtotal + surgeAmount) * (tierMultiplier || 1.0);
  const totalFare = Number(Math.max(minimumFare, Math.round(rawTotal)).toFixed(2));

  return {
    baseFare,
    baseIncludedKm,
    distanceKm: safeDistance,
    billableDistanceKm,
    perKmRate,
    distanceFare,
    timeMinutes: safeMins,
    perMinuteRate,
    timeFare,
    subtotal,
    surgeMultiplier,
    surgeAmount,
    zoneName,
    tierId,
    tierName,
    tierMultiplier: tierMultiplier || 1.0,
    minimumFare,
    totalFare,
    currency: 'INR',
    currencySymbol: '₹',
    isAccurateRoute,
  };
}
