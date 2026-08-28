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
}

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  role: 'passenger' | 'captain';
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

export type PaymentMethodType = 'apple_pay' | 'cash' | 'card' | 'wallet';

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

