export type RideStatus =
  | 'requested'
  | 'accepted'
  | 'arrived'
  | 'started'
  | 'completed'
  | 'cancelled';

export interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
}

export interface Ride {
  id: string;
  passenger_id: string;
  captain_id: string | null;
  pickup_location: string;
  dropoff_location: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  fare: number | null;
  status: RideStatus;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  passenger_name?: string | null;
  passenger_phone?: string | null;
  captain_name?: string | null;
  captain_phone?: string | null;
  captain_vehicle?: string | null;
  captain_rating?: number | null;
  distance_km?: number | null;
  estimated_mins?: number | null;
  service_type?: 'moto_standard' | 'moto_comfort' | 'moto_delivery' | 'moto_xl' | string | null;
  ride_tier?: 'moto_standard' | 'moto_comfort' | 'moto_delivery' | 'moto_xl' | string | null;
  tier_name?: string | null;
  delivery_notes?: string | null;
  captain_offers?: CaptainOffer[] | null;
}

export interface RideServiceInfo {
  type: 'moto_delivery' | 'moto_comfort' | 'moto_standard';
  title: string;
  badgeLabel: string;
  badgeText: string;
  icon: string;
  bgBadgeClass: string;
  textBadgeClass: string;
  borderBadgeClass: string;
  tagline: string;
  actionInstruction: string;
  isCourier: boolean;
}

export const getRideServiceInfo = (ride?: Partial<Ride> | null): RideServiceInfo => {
  if (!ride) {
    return {
      type: 'moto_comfort',
      title: 'Comfort Moto',
      badgeLabel: 'COMFORT MOTO',
      badgeText: '🛵 COMFORT MOTO',
      icon: '🛵',
      bgBadgeClass: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      textBadgeClass: 'text-emerald-600 dark:text-emerald-400',
      borderBadgeClass: 'border-emerald-500',
      tagline: 'Comfort Passenger Ride • Sanitized Helmet',
      actionInstruction: 'Pick up passenger & provide helmet',
      isCourier: false,
    };
  }

  const rawType = (ride.service_type || ride.ride_tier || '').toLowerCase();
  const rawTierName = (ride.tier_name || '').toLowerCase();
  const combined = `${ride.pickup_location || ''} ${ride.dropoff_location || ''} ${ride.passenger_name || ''}`.toLowerCase();

  if (
    rawType.includes('delivery') ||
    rawType.includes('courier') ||
    rawTierName.includes('courier') ||
    rawTierName.includes('delivery') ||
    combined.includes('[courier]') ||
    combined.includes('[delivery]') ||
    combined.includes('moto courier') ||
    combined.includes('courier') ||
    combined.includes('package')
  ) {
    return {
      type: 'moto_delivery',
      title: 'Moto Courier',
      badgeLabel: 'MOTO COURIER',
      badgeText: '📦 MOTO COURIER',
      icon: '📦',
      bgBadgeClass: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
      textBadgeClass: 'text-amber-600 dark:text-amber-400',
      borderBadgeClass: 'border-amber-500',
      tagline: 'Package & Item Delivery • Safe Cargo Box',
      actionInstruction: 'Pick up package from sender & deliver to dropoff',
      isCourier: true,
    };
  }

  return {
    type: 'moto_comfort',
    title: 'Comfort Moto',
    badgeLabel: 'COMFORT MOTO',
    badgeText: '🛵 COMFORT MOTO',
    icon: '🛵',
    bgBadgeClass: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    textBadgeClass: 'text-emerald-600 dark:text-emerald-400',
    borderBadgeClass: 'border-emerald-500',
    tagline: 'Comfort Passenger Ride • Sanitized Helmet',
    actionInstruction: 'Pick up passenger & provide helmet',
    isCourier: false,
  };
};

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'passenger' | 'captain' | 'admin';
  rating?: number;
  vehicle_details?: string;
  avatar_url?: string;
  acceptance_rate?: number;
  total_trips?: number;
}

export interface RideTier {
  id: 'moto_standard' | 'moto_comfort' | 'moto_delivery' | 'moto_xl';
  name: string;
  tagline: string;
  multiplier: number;
  icon: string;
  etaMinsBonus: number;
  popular?: boolean;
}

export type PaymentMethodType = 'upi' | 'cash' | 'wallet';

export interface ChatMessage {
  id: string;
  rideId: string;
  sender: 'passenger' | 'captain';
  senderName: string;
  text: string;
  timestamp: string;
}

export interface ConcurrencyClaimResult {
  success: boolean;
  message: string;
  ride?: Ride;
}

export interface FleetCaptain {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  rating: number;
  totalTrips: number;
  isOnline: boolean;
  status: 'available' | 'in_ride' | 'offline';
  todayEarnings: number;
  joinedDate: string;
  avatar: string;
}

export interface PlatformSettings {
  baseFare: number;
  perKmRate: number;
  surgeMultiplier: number;
  commissionRate: number;
  autoDispatch: boolean;
  maxBroadcastDistanceKm: number;
}

export interface AdminAnalyticsSummary {
  totalRides: number;
  activeRides: number;
  requestedRides: number;
  completedRides: number;
  cancelledRides: number;
  grossBookings: number;
  platformRevenue: number;
  avgFare: number;
  avgDurationMins: number;
  avgDistanceKm: number;
}

export interface CaptainEarningsSummary {
  todayIncome: number;
  todayCompletedCount: number;
  yesterdayIncome: number;
  yesterdayCompletedCount: number;
  totalEarnings: number;
  totalCompletedTrips: number;
  completedRides: Ride[];
  todayRides: Ride[];
  lastCalculatedAt: string;
}

export interface CaptainOffer {
  id: string;
  ride_id: string;
  captain_id: string;
  captain_name: string;
  captain_phone?: string;
  captain_vehicle?: string;
  captain_rating?: number;
  captain_avatar?: string;
  offered_fare: number;
  original_fare: number;
  eta_minutes?: number;
  created_at: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
}

/**
 * Generates the deterministic 4-digit safety ride PIN for a ride
 */
export const getRidePin = (rideId?: string | null): string => {
  if (!rideId) return '4829';
  const sum = Math.abs(rideId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
  return `${(sum % 9000) + 1000}`;
};

