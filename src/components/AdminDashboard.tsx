import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LayoutDashboard,
  Radio,
  Car,
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  MapPin,
  Navigation,
  Shield,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Sliders,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Eye,
  SlidersHorizontal,
  Zap,
  Activity,
  Flame,
  KeyRound,
  Compass,
  ArrowUpRight,
  Sparkles,
  Phone,
  Bike,
  RotateCcw,
  Check,
  X,
  ChevronDown,
  Layers,
  FileText,
  User,
  UserCheck,
  UserX,
  CreditCard,
  Wallet,
  Star,
  Award,
  Mail,
  Heart,
  Settings,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Ride, RideStatus, FleetCaptain, PlatformSettings, AdminAnalyticsSummary } from '../types/ride';
import {
  fetchAllRidesAdmin,
  deleteRideAdmin,
  adminOverrideRide,
  purgeOldRidesAdmin,
  createMockRideAdmin,
  subscribeToAdminRealtime,
  unsubscribeChannel,
} from '../services/rideService';
import { isSupabaseConfigured } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useTheme } from '../context/ThemeContext';
import { usePricing, DEFAULT_PLATFORM_PRICING, ExtendedPlatformPricing } from '../context/PricingContext';

interface AdminDashboardProps {
  onOpenSqlModal?: () => void;
}

const INITIAL_CAPTAINS: FleetCaptain[] = [
  {
    id: 'b82ac71b-39dd-4172-b567-0e02b2c3d981',
    name: 'Captain Alex Rivera',
    phone: '+1 (555) 749-3021',
    vehicle: 'Yamaha MT-07',
    plate: 'CH 01 AB 7492',
    rating: 4.96,
    totalTrips: 1420,
    isOnline: true,
    status: 'available',
    todayEarnings: 780.0,
    joinedDate: 'Jan 2024',
    avatar: '🏍️',
  },
  {
    id: 'c93bd82c-40ee-4283-a678-1f13c3d4ea92',
    name: 'Captain Vikram Chen',
    phone: '+1 (555) 882-9014',
    vehicle: 'Hero Splendor Plus',
    plate: 'PB 65 AC 3021',
    rating: 4.89,
    totalTrips: 890,
    isOnline: true,
    status: 'available',
    todayEarnings: 620.0,
    joinedDate: 'Mar 2024',
    avatar: '🛵',
  },
  {
    id: 'd04ce93d-51ff-5394-b789-2g24d4e5fb03',
    name: 'Captain Sofia Sharma',
    phone: '+1 (555) 412-6830',
    vehicle: 'Honda Activa 6G',
    plate: 'HR 70 D 9841',
    rating: 4.98,
    totalTrips: 2150,
    isOnline: true,
    status: 'in_ride',
    todayEarnings: 940.0,
    joinedDate: 'Nov 2023',
    avatar: '🏍️',
  },
  {
    id: 'e15df04e-62aa-6405-c890-3h35e5f6gc14',
    name: 'Captain Tariq Singh',
    phone: '+1 (555) 903-5127',
    vehicle: 'KTM Duke 250',
    plate: 'CH 01 AE 5512',
    rating: 4.85,
    totalTrips: 640,
    isOnline: false,
    status: 'offline',
    todayEarnings: 350.0,
    joinedDate: 'May 2024',
    avatar: '🛵',
  },
];

export interface AdminPassenger {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar_url?: string;
  rating: number;
  totalTrips: number;
  completedTrips: number;
  totalSpend: number;
  walletBalance: number;
  status: 'active' | 'vip' | 'new' | 'suspended';
  joinedDate: string;
  lastActive: string;
  emergencyContact: string;
  savedPlaces: { name: string; address: string; icon: string }[];
  preferences: {
    helmetSize: 'M' | 'L' | 'XL';
    quietRide: boolean;
    requirePin: boolean;
    shareLiveStatus: boolean;
    weatherGear: boolean;
  };
  notes?: string;
}

const INITIAL_PASSENGERS: AdminPassenger[] = [
  {
    id: 'pass-sarah-jenkins-01',
    name: 'Sarah Jenkins',
    phone: '+1 (555) 392-1049',
    email: 'sarah.jenkins@example.com',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    rating: 4.94,
    totalTrips: 42,
    completedTrips: 40,
    totalSpend: 5840.0,
    walletBalance: 184.5,
    status: 'vip',
    joinedDate: 'Jan 2024',
    lastActive: '10 mins ago',
    emergencyContact: '+1 (555) 902-8812 (Mom)',
    savedPlaces: [
      { name: 'Home', address: '240 Elm St, Sector 17, City Core', icon: '🏠' },
      { name: 'Work', address: 'Cyber Tech Park Tower 4, Suite 800', icon: '💼' },
      { name: 'Fitness Gym', address: 'Gold Horizon Fitness & Spa, Sector 22', icon: '🏋️' },
    ],
    preferences: {
      helmetSize: 'M',
      quietRide: false,
      requirePin: true,
      shareLiveStatus: true,
      weatherGear: true,
    },
    notes: 'Premium daily commuter. Prefers Yamaha MT-07 or KTM Duke for express morning routes.',
  },
  {
    id: 'pass-david-kumar-02',
    name: 'David Kumar',
    phone: '+1 (555) 782-9014',
    email: 'david.kumar@gmail.com',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    rating: 4.88,
    totalTrips: 19,
    completedTrips: 18,
    totalSpend: 2430.0,
    walletBalance: 45.0,
    status: 'active',
    joinedDate: 'Mar 2024',
    lastActive: '1 hour ago',
    emergencyContact: '+1 (555) 481-9920 (Brother)',
    savedPlaces: [
      { name: 'Home', address: '482 Maple Ave, Greenfield', icon: '🏠' },
      { name: 'University Campus', address: 'Metro Institute of Tech, Block B', icon: '🎓' },
    ],
    preferences: {
      helmetSize: 'L',
      quietRide: true,
      requirePin: true,
      shareLiveStatus: false,
      weatherGear: true,
    },
    notes: 'Regular student commuter. Prefers quiet rides with UPI auto-pay.',
  },
  {
    id: 'pass-elena-rostova-03',
    name: 'Elena Rostova',
    phone: '+1 (555) 721-4490',
    email: 'elena.r@corporate.org',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    rating: 4.99,
    totalTrips: 76,
    completedTrips: 75,
    totalSpend: 11450.0,
    walletBalance: 520.0,
    status: 'vip',
    joinedDate: 'Oct 2023',
    lastActive: 'Yesterday',
    emergencyContact: '+1 (555) 303-9182 (Spouse)',
    savedPlaces: [
      { name: 'Penthouse Residence', address: '77 Skyview Terrace, Central Heights', icon: '🏢' },
      { name: 'Corporate HQ', address: 'Financial District Plaza, Tower A', icon: '💼' },
      { name: 'Intl Airport', address: 'Terminal 2 Drop-off Gate 4', icon: '✈️' },
    ],
    preferences: {
      helmetSize: 'M',
      quietRide: true,
      requirePin: true,
      shareLiveStatus: true,
      weatherGear: true,
    },
    notes: 'Executive Corporate Rider. Platinum member with high surge tolerance and direct wallet settlement.',
  },
  {
    id: 'pass-arjun-patel-04',
    name: 'Arjun Patel',
    phone: '+1 (555) 604-1928',
    email: 'arjun.patel@techhub.io',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    rating: 4.91,
    totalTrips: 28,
    completedTrips: 27,
    totalSpend: 3820.0,
    walletBalance: 90.0,
    status: 'active',
    joinedDate: 'Feb 2024',
    lastActive: '3 hours ago',
    emergencyContact: '+1 (555) 712-4091 (Sister)',
    savedPlaces: [
      { name: 'Apartment', address: 'Flat 304, Palm Grove Residency', icon: '🏠' },
      { name: 'Co-Working Studio', address: 'Innov8 Hub, 5th Floor, Sector 34', icon: '💼' },
    ],
    preferences: {
      helmetSize: 'XL',
      quietRide: false,
      requirePin: false,
      shareLiveStatus: true,
      weatherGear: false,
    },
    notes: 'Software engineer at Innov8. Regularly books morning slots between 8:30 AM and 9:15 AM.',
  },
  {
    id: 'pass-priya-nair-05',
    name: 'Priya Nair',
    phone: '+1 (555) 839-2041',
    email: 'priya.nair@designworks.com',
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    rating: 4.97,
    totalTrips: 53,
    completedTrips: 51,
    totalSpend: 7190.0,
    walletBalance: 310.0,
    status: 'vip',
    joinedDate: 'Nov 2023',
    lastActive: '2 days ago',
    emergencyContact: '+1 (555) 919-4820 (Father)',
    savedPlaces: [
      { name: 'Design Studio', address: 'The Loft, 12 Art District Ave', icon: '🎨' },
      { name: 'Home Villa', address: '22 Blossom Gardens, North Enclave', icon: '🏡' },
      { name: 'Organic Bistro', address: 'Green Leaf Cafe, High Street', icon: '☕' },
    ],
    preferences: {
      helmetSize: 'M',
      quietRide: false,
      requirePin: true,
      shareLiveStatus: true,
      weatherGear: true,
    },
    notes: 'Creative Director. Always rates captains 5-stars for prompt helmet provision and safe speed.',
  },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onOpenSqlModal }) => {
  const { isLight } = useTheme();
  const { pricing, updatePricing, resetPricingToDefault, calculateFare, isCustomized } = usePricing();
  const [activeTab, setActiveTab] = useState<'live_rides' | 'captains' | 'passengers' | 'pricing' | 'bidding' | 'audit_log'>('live_rides');
  const [rides, setRides] = useState<Ride[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [isGeneratingMock, setIsGeneratingMock] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Platform Settings State (Synced from PricingContext)
  const [settings, setSettings] = useState<ExtendedPlatformPricing>(pricing);
  const [pricingActiveCategory, setPricingActiveCategory] = useState<'both' | 'moto_comfort' | 'moto_delivery'>('both');
  const [simDistAdmin, setSimDistAdmin] = useState<number>(4.8);
  const [simTierAdmin, setSimTierAdmin] = useState<'moto_comfort' | 'moto_delivery'>('moto_comfort');
  const [simOfferFareAdmin, setSimOfferFareAdmin] = useState<number>(100);

  useEffect(() => {
    setSettings(pricing);
  }, [pricing]);

  const handleSavePricing = () => {
    updatePricing(settings);
    setActionNotice({
      type: 'success',
      message: 'Fare calculation rules successfully deployed to all live passenger booking apps in real-time.',
    });
    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch {
      // ignore
    }
  };

  const handleResetPricing = () => {
    resetPricingToDefault();
    setSettings(DEFAULT_PLATFORM_PRICING);
    setActionNotice({
      type: 'success',
      message: 'Pricing rules reset to standard platform factory defaults.',
    });
  };

  // Captains State
  const [captains, setCaptains] = useState<FleetCaptain[]>(INITIAL_CAPTAINS);

  // Passengers State
  const [passengersList, setPassengersList] = useState<AdminPassenger[]>(INITIAL_PASSENGERS);
  const [selectedPassenger, setSelectedPassenger] = useState<AdminPassenger | null>(null);
  const [passengerSearchQuery, setPassengerSearchQuery] = useState<string>('');
  const [passengerStatusFilter, setPassengerStatusFilter] = useState<string>('all');
  const [passengerSortBy, setPassengerSortBy] = useState<'spend' | 'trips' | 'rating' | 'name'>('spend');
  const [passengerActiveSubTab, setPassengerActiveSubTab] = useState<'overview' | 'rides' | 'wallet' | 'safety' | 'notes'>('overview');
  const [creditAdjustmentAmount, setCreditAdjustmentAmount] = useState<number>(50);
  const [passengerNoteDraft, setPassengerNoteDraft] = useState<string>('');

  const channelRef = useRef<RealtimeChannel | null>(null);

  // Load All Rides
  const loadRides = async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);

    const { data, error } = await fetchAllRidesAdmin(statusFilter === 'all' ? undefined : statusFilter, 100);
    if (error) {
      setErrorMessage(error);
    } else {
      setRides(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadRides();
  }, [statusFilter]);

  // Supabase Realtime Subscription for Admin
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const channel = subscribeToAdminRealtime({
      onInsert: (newRide) => {
        setRides((prev) => {
          if (prev.some((r) => r.id === newRide.id)) return prev;
          return [newRide, ...prev];
        });
      },
      onUpdate: (updatedRide) => {
        setRides((prev) => prev.map((r) => (r.id === updatedRide.id ? updatedRide : r)));
        if (selectedRide?.id === updatedRide.id) {
          setSelectedRide(updatedRide);
        }
      },
      onDelete: ({ id }) => {
        setRides((prev) => prev.filter((r) => r.id !== id));
        if (selectedRide?.id === id) {
          setSelectedRide(null);
        }
      },
    });

    channelRef.current = channel;

    // Polling fallback to keep fleet table synced
    const pollInterval = setInterval(() => {
      if (isSupabaseConfigured()) {
        fetchAllRidesAdmin(statusFilter === 'all' ? undefined : statusFilter, 100).then(({ data }) => {
          if (data) setRides(data);
        });
      }
    }, 6000);

    return () => {
      clearInterval(pollInterval);
      if (channelRef.current) {
        unsubscribeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [selectedRide?.id, statusFilter]);

  // Analytics Computation
  const analytics: AdminAnalyticsSummary = useMemo(() => {
    const total = rides.length;
    const active = rides.filter((r) => ['accepted', 'arrived', 'started'].includes(r.status)).length;
    const requested = rides.filter((r) => r.status === 'requested').length;
    const completed = rides.filter((r) => r.status === 'completed').length;
    const cancelled = rides.filter((r) => r.status === 'cancelled').length;

    const completedList = rides.filter((r) => r.status === 'completed' || r.fare);
    const grossBookings = completedList.reduce((acc, r) => acc + (Number(r.fare) || 0), 0);
    const platformRevenue = (grossBookings * settings.commissionRate) / 100;
    const avgFare = completedList.length ? grossBookings / completedList.length : 14.5;
    const avgDistance = completedList.length
      ? completedList.reduce((acc, r) => acc + (r.distance_km || 4.2), 0) / completedList.length
      : 4.2;

    return {
      totalRides: total,
      activeRides: active,
      requestedRides: requested,
      completedRides: completed,
      cancelledRides: cancelled,
      grossBookings: Number(grossBookings.toFixed(2)),
      platformRevenue: Number(platformRevenue.toFixed(2)),
      avgFare: Number(avgFare.toFixed(2)),
      avgDurationMins: Math.round(avgDistance * 2.5 + 4),
      avgDistanceKm: Number(avgDistance.toFixed(1)),
    };
  }, [rides, settings.commissionRate]);

  // Filtered Rides for Table
  const filteredRides = useMemo(() => {
    return rides.filter((r) => {
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesStatus;

      const matchesSearch =
        r.id.toLowerCase().includes(q) ||
        (r.passenger_name && r.passenger_name.toLowerCase().includes(q)) ||
        (r.captain_name && r.captain_name.toLowerCase().includes(q)) ||
        r.pickup_location.toLowerCase().includes(q) ||
        r.dropoff_location.toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [rides, statusFilter, searchQuery]);

  // Admin Actions
  const handleGenerateTestRide = async () => {
    setIsGeneratingMock(true);
    const { data, error } = await createMockRideAdmin();
    setIsGeneratingMock(false);

    if (error) {
      setActionNotice({ type: 'error', message: `Generation failed: ${error}` });
    } else if (data) {
      setActionNotice({
        type: 'success',
        message: `New test ride created for ${data.passenger_name || 'Passenger'} ($${data.fare?.toFixed(2)})!`,
      });
      try {
        confetti({ particleCount: 35, spread: 60, origin: { y: 0.6 } });
      } catch (e) {}
    }
  };

  const handlePurgeOldRides = async () => {
    if (!window.confirm('Are you sure you want to purge all completed and cancelled rides?')) {
      return;
    }
    const { count, error } = await purgeOldRidesAdmin();
    if (error) {
      setActionNotice({ type: 'error', message: `Purge failed: ${error}` });
    } else {
      setActionNotice({ type: 'success', message: `Purged ${count} completed/cancelled ride records.` });
      loadRides();
    }
  };

  const handleDeleteRide = async (rideId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this ride record permanently?')) return;

    const { success, error } = await deleteRideAdmin(rideId);
    if (!success) {
      setActionNotice({ type: 'error', message: `Delete failed: ${error}` });
    } else {
      setActionNotice({ type: 'success', message: `Ride #${rideId.slice(0, 6)} deleted.` });
      setRides((prev) => prev.filter((r) => r.id !== rideId));
      if (selectedRide?.id === rideId) setSelectedRide(null);
    }
  };

  const handleOverrideStatus = async (rideId: string, newStatus: RideStatus) => {
    const { data, error } = await adminOverrideRide(rideId, { status: newStatus });
    if (error) {
      setActionNotice({ type: 'error', message: `Status update failed: ${error}` });
    } else if (data) {
      setActionNotice({
        type: 'success',
        message: `Ride #${rideId.slice(0, 6)} status updated to "${newStatus}".`,
      });
      setRides((prev) => prev.map((r) => (r.id === rideId ? data : r)));
      if (selectedRide?.id === rideId) setSelectedRide(data);
    }
  };

  const toggleCaptainStatus = (id: string) => {
    setCaptains((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const nextOnline = !c.isOnline;
        return {
          ...c,
          isOnline: nextOnline,
          status: nextOnline ? 'available' : 'offline',
        };
      })
    );
  };

  // Dynamically aggregate and update passengers with real live rides
  const allPassengers = useMemo(() => {
    const passengerMap = new Map<string, AdminPassenger>();
    passengersList.forEach((p) => {
      passengerMap.set(p.id, { ...p });
    });

    // Also process rides to dynamically attach or count rides from Supabase
    rides.forEach((r) => {
      const pid = r.passenger_id || 'pass-anon';
      const pname = r.passenger_name || 'Passenger Rider';
      const pphone = r.passenger_phone || '+1 (555) 000-0000';

      let existing = passengerMap.get(pid);
      if (!existing) {
        for (const p of passengerMap.values()) {
          if (p.name.toLowerCase() === pname.toLowerCase() || p.phone === pphone) {
            existing = p;
            break;
          }
        }
      }

      if (!existing) {
        const newPass: AdminPassenger = {
          id: pid,
          name: pname,
          phone: pphone,
          email: `${pname.toLowerCase().replace(/\s+/g, '.')}@example.com`,
          rating: 4.9,
          totalTrips: 1,
          completedTrips: r.status === 'completed' ? 1 : 0,
          totalSpend: r.fare ? Number(r.fare) : 120.0,
          walletBalance: 100.0,
          status: 'new',
          joinedDate: 'Recent',
          lastActive: 'Just now',
          emergencyContact: '+1 (555) 911-0000',
          savedPlaces: [
            { name: 'Pickup Point', address: r.pickup_location, icon: '📍' },
            { name: 'Destination', address: r.dropoff_location, icon: '🏁' },
          ],
          preferences: {
            helmetSize: 'M',
            quietRide: false,
            requirePin: true,
            shareLiveStatus: true,
            weatherGear: true,
          },
          notes: 'Auto-registered passenger from Live Fleet Booking.',
        };
        passengerMap.set(pid, newPass);
      }
    });

    return Array.from(passengerMap.values());
  }, [passengersList, rides]);

  // Filtered and Sorted Passengers List
  const filteredPassengers = useMemo(() => {
    return allPassengers
      .filter((p) => {
        const matchesStatus =
          passengerStatusFilter === 'all' || p.status === passengerStatusFilter;
        const q = passengerSearchQuery.toLowerCase().trim();
        const matchesQuery =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.phone.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q);
        return matchesStatus && matchesQuery;
      })
      .sort((a, b) => {
        if (passengerSortBy === 'spend') return b.totalSpend - a.totalSpend;
        if (passengerSortBy === 'trips') return b.totalTrips - a.totalTrips;
        if (passengerSortBy === 'rating') return b.rating - a.rating;
        return a.name.localeCompare(b.name);
      });
  }, [allPassengers, passengerSearchQuery, passengerStatusFilter, passengerSortBy]);

  const openPassengerProfile = (passengerId: string, name?: string | null, phone?: string | null) => {
    let found = allPassengers.find((p) => p.id === passengerId);
    if (!found && name) {
      found = allPassengers.find((p) => p.name.toLowerCase() === name.toLowerCase());
    }
    if (!found && phone) {
      found = allPassengers.find((p) => p.phone === phone);
    }
    if (!found) {
      found = allPassengers[0];
    }
    setSelectedPassenger(found || null);
    setPassengerNoteDraft(found?.notes || '');
    setPassengerActiveSubTab('overview');
  };

  const handleTogglePassengerStatus = (passengerId: string) => {
    setPassengersList((prev) =>
      prev.map((p) => {
        if (p.id !== passengerId) return p;
        const nextStatus: AdminPassenger['status'] =
          p.status === 'active' ? 'vip' : p.status === 'vip' ? 'suspended' : 'active';
        return { ...p, status: nextStatus };
      })
    );
    if (selectedPassenger && selectedPassenger.id === passengerId) {
      setSelectedPassenger((prev) =>
        prev
          ? {
              ...prev,
              status:
                prev.status === 'active'
                  ? 'vip'
                  : prev.status === 'vip'
                  ? 'suspended'
                  : 'active',
            }
          : null
      );
    }
    setActionNotice({
      type: 'success',
      message: `Updated passenger account status successfully.`,
    });
  };

  const handleAddPassengerCredit = (passengerId: string, amount: number) => {
    setPassengersList((prev) =>
      prev.map((p) => {
        if (p.id !== passengerId) return p;
        return { ...p, walletBalance: Number((p.walletBalance + amount).toFixed(2)) };
      })
    );
    if (selectedPassenger && selectedPassenger.id === passengerId) {
      setSelectedPassenger((prev) =>
        prev
          ? { ...prev, walletBalance: Number((prev.walletBalance + amount).toFixed(2)) }
          : null
      );
    }
    setActionNotice({
      type: 'success',
      message: `Credited ₹${amount.toFixed(2)} to passenger wallet.`,
    });
    confetti({ particleCount: 35, spread: 60, origin: { y: 0.6 } });
  };

  const handleSavePassengerNotes = (passengerId: string, notes: string) => {
    setPassengersList((prev) =>
      prev.map((p) => (p.id === passengerId ? { ...p, notes } : p))
    );
    if (selectedPassenger && selectedPassenger.id === passengerId) {
      setSelectedPassenger((prev) => (prev ? { ...prev, notes } : null));
    }
    setActionNotice({
      type: 'success',
      message: `Saved internal notes for passenger profile.`,
    });
  };

  const passengerRides = useMemo(() => {
    if (!selectedPassenger) return [];
    return rides.filter(
      (r) =>
        r.passenger_id === selectedPassenger.id ||
        (r.passenger_name && r.passenger_name.toLowerCase() === selectedPassenger.name.toLowerCase()) ||
        (r.passenger_phone && r.passenger_phone === selectedPassenger.phone)
    );
  }, [selectedPassenger, rides]);

  return (
    <div id="motoride-admin-dashboard" className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className={`flex flex-wrap items-center justify-between gap-4 pb-4 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">
              MotoRide Enterprise Fleet Control
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
              Live Realtime Engine
            </span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-black mt-1 tracking-tight ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
            Admin Operations & Dispatch Central
          </h1>
        </div>

        {/* Header Action Tools */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            id="admin-spawn-test-ride-btn"
            onClick={handleGenerateTestRide}
            disabled={isGeneratingMock}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
          >
            {isGeneratingMock ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            )}
            Simulate Ride Broadcast
          </button>

          <button
            onClick={handlePurgeOldRides}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${isLight ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'}`}
            title="Purge completed & cancelled rides to keep demo database pristine"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
            Clear Completed
          </button>

          <button
            onClick={loadRides}
            className={`p-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${isLight ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'}`}
            title="Refresh All Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Action Toast Alert */}
      {actionNotice && (
        <div
          className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 animate-in slide-in-from-top-2 duration-200 ${
            actionNotice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-600 dark:text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
            <span className="font-medium">{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white px-2">
            ✕
          </button>
        </div>
      )}

      {/* Database Setup Alert if needed */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Database Connection Error</span>
              <span>{errorMessage}</span>
            </div>
          </div>
          {onOpenSqlModal && (
            <button
              onClick={onOpenSqlModal}
              className="px-3 py-1.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold shrink-0"
            >
              Open SQL Setup
            </button>
          )}
        </div>
      )}

      {/* Real-time KPI Metric Hero Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Gross Bookings */}
        <div className={`border rounded-2xl p-3.5 space-y-1 shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b0f19] border-slate-800/90'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Gross Volume</span>
            <span className="font-bold text-emerald-500 text-xs">₹</span>
          </div>
          <p className={`text-xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>₹{analytics.grossBookings.toFixed(2)}</p>
          <span className="text-[10px] text-emerald-500 font-semibold flex items-center">
            <TrendingUp className="w-3 h-3 mr-0.5 inline" /> +18.4% this week
          </span>
        </div>

        {/* Platform Commission Revenue */}
        <div className={`border rounded-2xl p-3.5 space-y-1 shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b0f19] border-slate-800/90'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Platform Take</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-black text-amber-500">₹{analytics.platformRevenue.toFixed(2)}</p>
          <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{settings.commissionRate}% Take Rate</span>
        </div>

        {/* In-Flight Active Trips */}
        <div className={`border rounded-2xl p-3.5 space-y-1 shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b0f19] border-slate-800/90'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>In-Flight Rides</span>
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />
          </div>
          <p className="text-xl font-black text-sky-500">{analytics.activeRides}</p>
          <span className="text-[10px] text-sky-500 font-semibold">Accepted / En Route</span>
        </div>

        {/* Pending Broadcasts */}
        <div className={`border rounded-2xl p-3.5 space-y-1 shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b0f19] border-slate-800/90'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Pending Match</span>
            <Radio className="w-4 h-4 text-amber-500 animate-pulse" />
          </div>
          <p className="text-xl font-black text-amber-500">{analytics.requestedRides}</p>
          <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Awaiting Captains</span>
        </div>

        {/* Completed Trips */}
        <div className={`border rounded-2xl p-3.5 space-y-1 shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b0f19] border-slate-800/90'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-black text-emerald-500">{analytics.completedRides}</p>
          <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{analytics.cancelledRides} cancelled</span>
        </div>

        {/* Active Fleet Captains */}
        <div className={`border rounded-2xl p-3.5 space-y-1 shadow-sm ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b0f19] border-slate-800/90'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] uppercase font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Online Fleet</span>
            <Bike className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-xl font-black text-purple-500">
            {captains.filter((c) => c.isOnline).length} / {captains.length}
          </p>
          <span className="text-[10px] text-emerald-500 font-semibold">100% Verified</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className={`flex items-center gap-2 border-b text-xs overflow-x-auto no-scrollbar ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <button
          onClick={() => setActiveTab('live_rides')}
          className={`flex items-center gap-2 px-4 py-3 font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'live_rides'
              ? 'border-emerald-500 text-emerald-600 bg-emerald-500/10'
              : isLight ? 'border-transparent text-slate-600 hover:text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Live Fleet & Rides ({rides.length})
        </button>

        <button
          onClick={() => setActiveTab('captains')}
          className={`flex items-center gap-2 px-4 py-3 font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'captains'
              ? 'border-purple-500 text-purple-600 bg-purple-500/10'
              : isLight ? 'border-transparent text-slate-600 hover:text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Bike className="w-4 h-4" />
          Captains Roster ({captains.length})
        </button>

        <button
          onClick={() => setActiveTab('passengers')}
          className={`flex items-center gap-2 px-4 py-3 font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'passengers'
              ? 'border-sky-500 text-sky-600 bg-sky-500/10'
              : isLight ? 'border-transparent text-slate-600 hover:text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Passenger Profiles ({allPassengers.length})
        </button>

        <button
          id="admin-tab-pricing-btn"
          onClick={() => setActiveTab('pricing')}
          className={`flex items-center gap-2 px-4 py-3 font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'pricing'
              ? 'border-amber-500 text-amber-600 bg-amber-500/10'
              : isLight ? 'border-transparent text-slate-600 hover:text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Surge & Fare Dispatch Rules
        </button>

        <button
          id="admin-tab-bidding-btn"
          onClick={() => setActiveTab('bidding')}
          className={`flex items-center gap-2 px-4 py-3 font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'bidding'
              ? 'border-indigo-500 text-indigo-600 bg-indigo-500/10'
              : isLight ? 'border-transparent text-slate-600 hover:text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-indigo-500" />
          Captain 3-Form Offer Rules
        </button>
      </div>

      {/* ================= TAB 1: LIVE RIDES STREAM ================= */}
      {activeTab === 'live_rides' && (
        <div className="space-y-4">
          {/* Controls Bar: Search & Status Filter Chips */}
          <div className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b0f19] border-slate-800'}`}>
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery || ''}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rides by ID, passenger, captain, or location..."
                className={`w-full border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-emerald-500 ${isLight ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400' : 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-500'}`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'All Rides' },
                { id: 'requested', label: 'Requested' },
                { id: 'accepted', label: 'Accepted' },
                { id: 'arrived', label: 'Arrived' },
                { id: 'started', label: 'In-Trip' },
                { id: 'completed', label: 'Completed' },
                { id: 'cancelled', label: 'Cancelled' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setStatusFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    statusFilter === filter.id
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : isLight ? 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200' : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rides Table View */}
          <div className={`border rounded-3xl overflow-hidden shadow-md ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b0f19] border-slate-800'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`font-bold uppercase tracking-wider border-b text-[10px] ${isLight ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-slate-900/90 text-slate-400 border-slate-800'}`}>
                  <tr>
                    <th className="py-3 px-4">Ride ID / Time</th>
                    <th className="py-3 px-4">Passenger</th>
                    <th className="py-3 px-4">Captain</th>
                    <th className="py-3 px-4">Route (Pickup → Dropoff)</th>
                    <th className="py-3 px-4">Fare & Distance</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y font-medium ${isLight ? 'divide-slate-100 text-slate-700' : 'divide-slate-800/60 text-slate-300'}`}>
                  {filteredRides.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <div className="space-y-2">
                          <Activity className="w-8 h-8 mx-auto text-slate-400 animate-pulse" />
                          <p className="text-sm font-semibold">No rides found matching this filter.</p>
                          <button
                            onClick={handleGenerateTestRide}
                            className="text-xs text-amber-500 hover:underline font-bold cursor-pointer"
                          >
                            + Click to create a test simulated ride
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRides.map((ride) => {
                      const isSelected = selectedRide?.id === ride.id;
                      return (
                        <tr
                          key={ride.id}
                          onClick={() => setSelectedRide(ride)}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? isLight ? 'bg-emerald-50 ring-1 ring-emerald-400' : 'bg-slate-900/90 ring-1 ring-emerald-500/40'
                              : isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-900/70'
                          }`}
                        >
                          {/* ID & Time */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                #{ride.id.slice(0, 6)}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(ride.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </td>

                          {/* Passenger */}
                          <td
                            className="py-3.5 px-4 whitespace-nowrap"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPassengerProfile(ride.passenger_id, ride.passenger_name, ride.passenger_phone);
                            }}
                            title="Click to view Passenger Profile in Admin Panel"
                          >
                            <div className="flex items-center gap-1.5 group/p">
                              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black shrink-0 group-hover/p:scale-110 transition-transform">
                                {(ride.passenger_name || 'Sarah').charAt(0)}
                              </div>
                              <div>
                                <div className={`font-bold hover:text-emerald-500 flex items-center gap-1 cursor-pointer ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                                  <span>{ride.passenger_name || 'Sarah Jenkins'}</span>
                                  <User className="w-3 h-3 text-slate-400 group-hover/p:text-emerald-500 transition-colors" />
                                </div>
                                <div className="text-[10px] text-slate-400">{ride.passenger_phone || '+1 (555) 392-1049'}</div>
                              </div>
                            </div>
                          </td>

                          {/* Captain */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {ride.captain_name ? (
                              <div>
                                <span className={`font-bold flex items-center gap-1 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                                  🏍️ {ride.captain_name}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {ride.captain_vehicle || 'Yamaha MT-07'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-amber-500 italic">Unassigned (Searching)</span>
                            )}
                          </td>

                          {/* Route */}
                          <td className="py-3.5 px-4 max-w-xs truncate">
                            <div className={`flex items-center gap-1.5 ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="truncate">{ride.pickup_location.split(',')[0]}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-md bg-rose-500 shrink-0" />
                              <span className="truncate">{ride.dropoff_location.split(',')[0]}</span>
                            </div>
                          </td>

                          {/* Fare & Distance */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                              ₹{ride.fare ? Number(ride.fare).toFixed(2) : '120.00'}
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {ride.distance_km || 4.2} km · ~{ride.estimated_mins || 12} min
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                ride.status === 'requested'
                                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 animate-pulse'
                                  : ride.status === 'accepted'
                                  ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/40'
                                  : ride.status === 'arrived'
                                  ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/40'
                                  : ride.status === 'started'
                                  ? 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/40'
                                  : ride.status === 'completed'
                                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/40'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {ride.status.toUpperCase()}
                            </span>
                          </td>

                          {/* Quick Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRide(ride);
                                }}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isLight ? 'hover:bg-slate-100 text-slate-600 hover:text-sky-600' : 'hover:bg-slate-800 text-slate-400 hover:text-sky-300'}`}
                                title="View Trip Inspector & Map"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {ride.status !== 'completed' && ride.status !== 'cancelled' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOverrideStatus(ride.id, 'completed');
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isLight ? 'hover:bg-emerald-50 text-slate-600 hover:text-emerald-600' : 'hover:bg-slate-800 text-slate-400 hover:text-emerald-300'}`}
                                  title="Force Complete Ride"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={(e) => handleDeleteRide(ride.id, e)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isLight ? 'hover:bg-rose-50 text-slate-400 hover:text-rose-600' : 'hover:bg-rose-500/20 text-slate-400 hover:text-rose-400'}`}
                                title="Delete Record"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: CAPTAINS & DRIVER ROSTER ================= */}
      {activeTab === 'captains' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Registered Motorcycle Fleet Captains</h3>
            <span className="text-xs text-slate-400">
              {captains.filter((c) => c.isOnline).length} Active Online
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {captains.map((captain) => (
              <div
                key={captain.id}
                className={`border rounded-2xl p-4 space-y-3.5 shadow-md flex flex-col justify-between ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b0f19] border-slate-800'}`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-black text-2xl shadow-md">
                        {captain.avatar}
                      </div>
                      <div>
                        <h4 className={`text-xs font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{captain.name}</h4>
                        <p className="text-[10px] text-slate-400">{captain.phone}</p>
                        <span className="text-[10px] font-bold text-amber-500">
                          ★ {captain.rating} ({captain.totalTrips} rides)
                        </span>
                      </div>
                    </div>

                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        captain.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                  </div>

                  <div className={`p-2.5 rounded-xl border mt-3 space-y-1 text-[11px] ${isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950/80 border-slate-800/80 text-slate-300'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Vehicle:</span>
                      <span className="font-semibold">{captain.vehicle}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">License Plate:</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-300">{captain.plate}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Today's Income:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{captain.todayEarnings.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className={`pt-2 border-t flex items-center justify-between gap-2 ${isLight ? 'border-slate-100' : 'border-slate-800/80'}`}>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {captain.id.slice(0, 8)}...</span>
                  <button
                    onClick={() => toggleCaptainStatus(captain.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      captain.isOnline
                        ? isLight ? 'bg-rose-50 hover:bg-rose-100 text-rose-600' : 'bg-slate-800 hover:bg-slate-700 text-rose-400'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    }`}
                  >
                    {captain.isOnline ? 'Set Offline' : 'Set Online'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB: PASSENGERS & CUSTOMER ROSTER ================= */}
      {activeTab === 'passengers' && (
        <div className="space-y-4">
          {/* Top Bar with Search, Status Filter & Sorting */}
          <div className={`flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b0f19] border-slate-800'}`}>
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={passengerSearchQuery || ''}
                onChange={(e) => setPassengerSearchQuery(e.target.value)}
                placeholder="Search passengers by name, phone, email, or ID..."
                className={`w-full border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-sky-500 ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                    : 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-500'
                }`}
              />
              {passengerSearchQuery && (
                <button
                  onClick={() => setPassengerSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'All Passengers' },
                { id: 'vip', label: '⭐ VIP Riders' },
                { id: 'active', label: 'Active' },
                { id: 'new', label: 'New Signups' },
                { id: 'suspended', label: 'Suspended' },
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setPassengerStatusFilter(chip.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    passengerStatusFilter === chip.id
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                      : isLight
                      ? 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Sort by:</span>
              <select
                value={passengerSortBy || 'spend'}
                onChange={(e) => setPassengerSortBy(e.target.value as any)}
                className={`border rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none cursor-pointer ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-200'
                }`}
              >
                <option value="spend">Highest Lifetime Spend (₹)</option>
                <option value="trips">Most Total Trips</option>
                <option value="rating">Top Passenger Rating ★</option>
                <option value="name">Alphabetical (Name)</option>
              </select>
            </div>
          </div>

          {/* Passenger Cards Grid */}
          {filteredPassengers.length === 0 ? (
            <div className={`p-12 text-center rounded-3xl border ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b0f19] border-slate-800'}`}>
              <Users className="w-10 h-10 mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-bold text-slate-400">No passengers found matching your search or filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPassengers.map((passenger) => {
                const tripsFromDb = rides.filter(
                  (r) =>
                    r.passenger_id === passenger.id ||
                    (r.passenger_name && r.passenger_name.toLowerCase() === passenger.name.toLowerCase())
                );
                const totalRidesCount = Math.max(passenger.totalTrips, tripsFromDb.length);

                return (
                  <div
                    key={passenger.id}
                    className={`border rounded-2xl p-4.5 space-y-3.5 shadow-md flex flex-col justify-between transition-all hover:shadow-lg ${
                      isLight ? 'bg-white border-slate-200' : 'bg-[#0b0f19] border-slate-800'
                    }`}
                  >
                    <div>
                      {/* Card Header: Avatar & Info */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {passenger.avatar_url ? (
                            <img
                              src={passenger.avatar_url}
                              alt={passenger.name}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded-2xl object-cover border-2 border-sky-400/40 shadow-sm"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white flex items-center justify-center font-black text-lg shadow-sm">
                              {passenger.name.charAt(0)}
                            </div>
                          )}

                          <div>
                            <div className="flex items-center gap-1.5">
                              <h4 className={`text-sm font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                                {passenger.name}
                              </h4>
                              {passenger.status === 'vip' && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                                  VIP
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5 inline" /> {passenger.phone}
                            </p>
                            <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1 mt-0.5">
                              <Star className="w-3 h-3 fill-amber-400 inline" /> {passenger.rating} · {totalRidesCount} trips
                            </span>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            passenger.status === 'vip'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : passenger.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : passenger.status === 'new'
                              ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {passenger.status}
                        </span>
                      </div>

                      {/* Metrics Snapshot */}
                      <div className={`p-3 rounded-xl border mt-3.5 space-y-1.5 text-xs ${
                        isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-950/80 border-slate-800 text-slate-300'
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> Email:
                          </span>
                          <span className="font-mono text-[11px] truncate max-w-[160px]">{passenger.email}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Wallet className="w-3 h-3 text-emerald-500" /> Wallet Balance:
                          </span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{passenger.walletBalance.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <DollarSign className="w-3 h-3 text-amber-500" /> Total Spend:
                          </span>
                          <span className="font-black text-slate-900 dark:text-white">
                            ₹{passenger.totalSpend.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-sky-500" /> Safety PIN:
                          </span>
                          <span className={passenger.preferences.requirePin ? 'text-emerald-500 font-bold' : 'text-slate-400'}>
                            {passenger.preferences.requirePin ? 'Mandatory (4-Digit)' : 'Optional'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className={`pt-3 border-t flex items-center justify-between gap-2 ${
                      isLight ? 'border-slate-100' : 'border-slate-800/80'
                    }`}>
                      <button
                        onClick={() => openPassengerProfile(passenger.id, passenger.name, passenger.phone)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-sky-500/20"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Inspect Profile</span>
                      </button>

                      <button
                        onClick={() => handleAddPassengerCredit(passenger.id, 50)}
                        className={`py-1.5 px-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                          isLight
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}
                        title="Add ₹50 Courtesy Credit"
                      >
                        +₹50
                      </button>

                      <button
                        onClick={() => handleTogglePassengerStatus(passenger.id)}
                        className={`py-1.5 px-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                          passenger.status === 'suspended'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                        title="Toggle Passenger Status"
                      >
                        {passenger.status === 'vip' ? '⭐' : passenger.status === 'suspended' ? 'Activate' : 'VIP'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: PRICING & DISPATCH ENGINE ================= */}
      {activeTab === 'pricing' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Sync Status Banner */}
          <div
            className={`p-4 rounded-3xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
              isLight
                ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border-emerald-200 text-slate-800'
                : 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-sky-950/30 border-emerald-500/30 text-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center border border-emerald-500/30">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black">Live Passenger Fare Engine Synchronization</h3>
                  <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                    LIVE ACTIVE
                  </span>
                </div>
                <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Changes made here update the passenger fare calculation, suggested inDrive bidding rates, and driver payouts instantly.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetPricing}
                className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
                title="Reset pricing parameters to default"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
              <button
                type="button"
                onClick={handleSavePricing}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Deploy to Passenger App</span>
              </button>
            </div>
          </div>

          {/* Category Tabs Selector (Comfort Ride vs Moto Courier) */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border bg-emerald-500/5 border-emerald-500/20">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Category Pricing Engines:
              </span>
              <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-900 p-1 rounded-xl">
                {[
                  { id: 'both', label: 'All Ride Categories (Split View)', icon: '⚡' },
                  { id: 'moto_comfort', label: 'Comfort Moto Ride', icon: '🛵' },
                  { id: 'moto_delivery', label: 'Moto Courier / Delivery', icon: '📦' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPricingActiveCategory(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      pricingActiveCategory === tab.id
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-xs'
                        : isLight
                        ? 'text-slate-700 hover:text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-slate-500 flex items-center gap-2">
              <span>Comfort: ₹{settings.tierPricing.moto_comfort.baseFare} base / ₹{settings.tierPricing.moto_comfort.perKmRate}/km</span>
              <span>•</span>
              <span>Courier: ₹{settings.tierPricing.moto_delivery.baseFare} base / ₹{settings.tierPricing.moto_delivery.perKmRate}/km</span>
            </div>
          </div>

          {/* Captain 3-Form Bidding Banner Link */}
          <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            isLight ? 'bg-indigo-50/70 border-indigo-200' : 'bg-indigo-950/30 border-indigo-800/60'
          }`}>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-500">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                    Captain 3-Form Ride Acceptance Bidding
                  </span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-full">
                    {settings.biddingConfig.enabled ? `Active (0%, +${settings.biddingConfig.tier2Percent}%, +${settings.biddingConfig.tier3Percent}%)` : 'Disabled'}
                  </span>
                </div>
                <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Manage passenger proposed fare forms, counter-bidding percentages (+10%, +15%), and button labels.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('bidding')}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Manage 3-Form Rules</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Category 1 - Comfort Moto Ride Pricing */}
            {(pricingActiveCategory === 'both' || pricingActiveCategory === 'moto_comfort') && (
              <div className={`border rounded-3xl p-5 space-y-4 shadow-md ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b0f19] border-slate-800'}`}>
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🛵</span>
                    <div>
                      <h3 className={`text-sm font-black flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        Comfort Moto Ride
                      </h3>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                        Passenger pillion ride with helmet
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                    PRIMARY
                  </span>
                </div>

                {/* Base Fare */}
                <div className={`p-3.5 rounded-2xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Comfort Base Pickup (₹)</label>
                    <span className="font-mono text-xs font-bold text-emerald-600">₹{settings.tierPricing.moto_comfort.baseFare.toFixed(2)}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={settings.tierPricing.moto_comfort.baseFare}
                    onChange={(e) => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setSettings({
                        ...settings,
                        baseFare: val,
                        tierPricing: {
                          ...settings.tierPricing,
                          moto_comfort: {
                            ...settings.tierPricing.moto_comfort,
                            baseFare: val,
                          },
                        },
                      });
                    }}
                    className={`w-full border rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-emerald-500 ${
                      isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                    }`}
                  />
                  <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Flag-drop fare for passenger moto trips.
                  </p>
                </div>

                {/* Included Base Distance */}
                <div className={`p-3.5 rounded-2xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Comfort Included Distance (km)</label>
                    <span className="font-mono text-xs font-bold text-sky-600">{settings.tierPricing.moto_comfort.baseIncludedKm} km</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={settings.tierPricing.moto_comfort.baseIncludedKm}
                    onChange={(e) => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setSettings({
                        ...settings,
                        baseIncludedKm: val,
                        tierPricing: {
                          ...settings.tierPricing,
                          moto_comfort: {
                            ...settings.tierPricing.moto_comfort,
                            baseIncludedKm: val,
                          },
                        },
                      });
                    }}
                    className={`w-full border rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-sky-500 ${
                      isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                    }`}
                  />
                </div>

                {/* Per-Km Rate */}
                <div className={`p-3.5 rounded-2xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Comfort Per-Km Rate (₹/km)</label>
                    <span className="font-mono text-xs font-bold text-emerald-600">₹{settings.tierPricing.moto_comfort.perKmRate.toFixed(2)}/km</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={settings.tierPricing.moto_comfort.perKmRate}
                    onChange={(e) => {
                      const val = Math.max(1, parseFloat(e.target.value) || 1);
                      setSettings({
                        ...settings,
                        perKmRate: val,
                        tierPricing: {
                          ...settings.tierPricing,
                          moto_comfort: {
                            ...settings.tierPricing.moto_comfort,
                            perKmRate: val,
                          },
                        },
                      });
                    }}
                    className={`w-full border rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-emerald-500 ${
                      isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                    }`}
                  />
                </div>

                {/* Per-Minute Time Rate & Minimum Fare */}
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-3 rounded-2xl border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block">Time (₹/min)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={settings.tierPricing.moto_comfort.perMinuteRate}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setSettings({
                          ...settings,
                          perMinuteRate: val,
                          tierPricing: {
                            ...settings.tierPricing,
                            moto_comfort: {
                              ...settings.tierPricing.moto_comfort,
                              perMinuteRate: val,
                            },
                          },
                        });
                      }}
                      className={`w-full border rounded-xl px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-teal-500 ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    />
                  </div>

                  <div className={`p-3 rounded-2xl border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block">Min Fare (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={settings.tierPricing.moto_comfort.minimumFare}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setSettings({
                          ...settings,
                          minimumFare: val,
                          tierPricing: {
                            ...settings.tierPricing,
                            moto_comfort: {
                              ...settings.tierPricing.moto_comfort,
                              minimumFare: val,
                            },
                          },
                        });
                      }}
                      className={`w-full border rounded-xl px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-amber-500 ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Column 2: Category 2 - Moto Courier / Delivery Pricing */}
            {(pricingActiveCategory === 'both' || pricingActiveCategory === 'moto_delivery') && (
              <div className={`border rounded-3xl p-5 space-y-4 shadow-md ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b0f19] border-slate-800'}`}>
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📦</span>
                    <div>
                      <h3 className={`text-sm font-black flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        Moto Courier / Delivery
                      </h3>
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold block">
                        Package & parcel courier dispatch
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-sky-500/20 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-full font-bold">
                    COURIER TIER
                  </span>
                </div>

                {/* Base Fare */}
                <div className={`p-3.5 rounded-2xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Courier Base Pickup (₹)</label>
                    <span className="font-mono text-xs font-bold text-sky-600">₹{settings.tierPricing.moto_delivery.baseFare.toFixed(2)}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={settings.tierPricing.moto_delivery.baseFare}
                    onChange={(e) => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setSettings({
                        ...settings,
                        tierPricing: {
                          ...settings.tierPricing,
                          moto_delivery: {
                            ...settings.tierPricing.moto_delivery,
                            baseFare: val,
                          },
                        },
                      });
                    }}
                    className={`w-full border rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-sky-500 ${
                      isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                    }`}
                  />
                  <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Flag-drop rate specifically for document/package courier trips.
                  </p>
                </div>

                {/* Included Base Distance */}
                <div className={`p-3.5 rounded-2xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Courier Included Distance (km)</label>
                    <span className="font-mono text-xs font-bold text-sky-600">{settings.tierPricing.moto_delivery.baseIncludedKm} km</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={settings.tierPricing.moto_delivery.baseIncludedKm}
                    onChange={(e) => {
                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                      setSettings({
                        ...settings,
                        tierPricing: {
                          ...settings.tierPricing,
                          moto_delivery: {
                            ...settings.tierPricing.moto_delivery,
                            baseIncludedKm: val,
                          },
                        },
                      });
                    }}
                    className={`w-full border rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-sky-500 ${
                      isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                    }`}
                  />
                </div>

                {/* Per-Km Rate */}
                <div className={`p-3.5 rounded-2xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Courier Per-Km Rate (₹/km)</label>
                    <span className="font-mono text-xs font-bold text-sky-600">₹{settings.tierPricing.moto_delivery.perKmRate.toFixed(2)}/km</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={settings.tierPricing.moto_delivery.perKmRate}
                    onChange={(e) => {
                      const val = Math.max(1, parseFloat(e.target.value) || 1);
                      setSettings({
                        ...settings,
                        tierPricing: {
                          ...settings.tierPricing,
                          moto_delivery: {
                            ...settings.tierPricing.moto_delivery,
                            perKmRate: val,
                          },
                        },
                      });
                    }}
                    className={`w-full border rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-sky-500 ${
                      isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                    }`}
                  />
                </div>

                {/* Per-Minute Time Rate & Minimum Fare */}
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-3 rounded-2xl border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block">Time (₹/min)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={settings.tierPricing.moto_delivery.perMinuteRate}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setSettings({
                          ...settings,
                          tierPricing: {
                            ...settings.tierPricing,
                            moto_delivery: {
                              ...settings.tierPricing.moto_delivery,
                              perMinuteRate: val,
                            },
                          },
                        });
                      }}
                      className={`w-full border rounded-xl px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-teal-500 ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    />
                  </div>

                  <div className={`p-3 rounded-2xl border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block">Min Fare (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={settings.tierPricing.moto_delivery.minimumFare}
                      onChange={(e) => {
                        const val = Math.max(0, parseFloat(e.target.value) || 0);
                        setSettings({
                          ...settings,
                          tierPricing: {
                            ...settings.tierPricing,
                            moto_delivery: {
                              ...settings.tierPricing.moto_delivery,
                              minimumFare: val,
                            },
                          },
                        });
                      }}
                      className={`w-full border rounded-xl px-2 py-1.5 text-xs font-bold focus:outline-none focus:border-amber-500 ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Column 3: Surge Multiplier, Commission & Live Category Simulator */}
            <div className={`border rounded-3xl p-5 space-y-4 shadow-md flex flex-col justify-between ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b0f19] border-slate-800'}`}>
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                    <Flame className="w-4 h-4 text-amber-500" />
                    Market Surge & Simulator
                  </h3>
                  <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                    LIVE
                  </span>
                </div>

                {/* Surge Slider */}
                <div className={`p-3 rounded-2xl border space-y-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">Surge Multiplier</span>
                    <span className="text-base font-black text-amber-500">{settings.surgeMultiplier.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="3.0"
                    step="0.1"
                    value={settings.surgeMultiplier}
                    onChange={(e) => setSettings({ ...settings, surgeMultiplier: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <div className="grid grid-cols-4 gap-1 pt-0.5">
                    {[
                      { label: '1.0x Base', val: 1.0 },
                      { label: '1.3x Rain', val: 1.3 },
                      { label: '1.6x Peak', val: 1.6 },
                      { label: '2.2x High', val: 2.2 },
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => setSettings({ ...settings, surgeMultiplier: p.val })}
                        className={`px-1.5 py-1 rounded-lg text-[9px] font-bold border transition-colors cursor-pointer text-center ${
                          settings.surgeMultiplier === p.val
                            ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                            : isLight
                            ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                            : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Commission Take Rate */}
                <div className={`p-3 rounded-2xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Platform Take Rate</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">{settings.commissionRate}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={settings.commissionRate}
                    onChange={(e) => setSettings({ ...settings, commissionRate: parseInt(e.target.value, 10) })}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Simulator Category Selector & Distance */}
                <div className={`p-3 rounded-2xl border space-y-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Simulate Category</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSimTierAdmin('moto_comfort')}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          simTierAdmin === 'moto_comfort'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-black'
                            : 'bg-transparent text-slate-500 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        🛵 Comfort
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimTierAdmin('moto_delivery')}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          simTierAdmin === 'moto_delivery'
                            ? 'bg-sky-500 text-slate-950 border-sky-500 font-black'
                            : 'bg-transparent text-slate-500 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        📦 Courier
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Distance:</span>
                    <span className="font-mono font-bold text-emerald-600">{simDistAdmin.toFixed(1)} km (~{Math.round(simDistAdmin * 2.2 + 3)} min)</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="25"
                    step="0.5"
                    value={simDistAdmin}
                    onChange={(e) => setSimDistAdmin(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Real-time Calculation Result */}
                {(() => {
                  const activeConfig = simTierAdmin === 'moto_delivery' ? settings.tierPricing.moto_delivery : settings.tierPricing.moto_comfort;
                  const simulatedMins = Math.round(simDistAdmin * 2.2 + 3);
                  const chargeableKm = Math.max(0, simDistAdmin - activeConfig.baseIncludedKm);
                  const subtotal = activeConfig.baseFare + (chargeableKm * activeConfig.perKmRate) + (simulatedMins * activeConfig.perMinuteRate);
                  const surgedTotal = Math.max(activeConfig.minimumFare, Math.round(subtotal * settings.surgeMultiplier * 100) / 100);
                  const captainPayout = Math.round(surgedTotal * ((100 - settings.commissionRate) / 100) * 100) / 100;
                  const platformRevenue = Math.round((surgedTotal - captainPayout) * 100) / 100;

                  return (
                    <div className="space-y-1.5 text-xs">
                      <div className={`p-2.5 rounded-xl border flex justify-between items-center ${
                        simTierAdmin === 'moto_delivery'
                          ? isLight ? 'bg-sky-50 border-sky-200 text-slate-800' : 'bg-sky-950/30 border-sky-500/30 text-sky-100'
                          : isLight ? 'bg-emerald-50 border-emerald-200 text-slate-800' : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-100'
                      }`}>
                        <div>
                          <span className="font-bold block">{activeConfig.name} Fair Fare</span>
                          <span className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            Base ₹{activeConfig.baseFare} + {chargeableKm.toFixed(1)}km @ ₹{activeConfig.perKmRate}/km
                          </span>
                        </div>
                        <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                          ₹{surgedTotal.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
                        <span>Captain Take-Home: <strong className="text-emerald-600">₹{captainPayout.toFixed(2)}</strong></span>
                        <span>Platform Fee: <strong className="text-amber-600">₹{platformRevenue.toFixed(2)}</strong></span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Deploy Button */}
              <div className="space-y-2 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleSavePricing}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Deploy & Broadcast Fare Rules</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 5: CAPTAIN 3-FORM OFFER & BIDDING RULES ================= */}
      {activeTab === 'bidding' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Description & Status Banner */}
          <div className={`p-5 rounded-3xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm ${
            isLight ? 'bg-gradient-to-r from-indigo-50/80 to-white border-indigo-200/80' : 'bg-gradient-to-r from-indigo-950/40 to-[#0b0f19] border-indigo-800/60'
          }`}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-500 border border-indigo-500/30">
                  <Sparkles className="w-4 h-4" />
                </span>
                <h2 className={`text-base sm:text-lg font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  Captain 3-Form Offer & Counter-Bidding Dispatch Central
                </h2>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-black">
                  IN-DRIVE REALTIME ENGINE
                </span>
              </div>
              <p className={`text-xs max-w-3xl ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Configure the three dynamic acceptance forms presented to Captains when a passenger books a ride and offers a custom fare price:
                <strong> 1. Accept Passenger Offer Price</strong>,
                <strong> 2. 10% Increased Price</strong>, and
                <strong> 3. 15% Increased Price</strong>.
              </p>
            </div>

            {/* Master Toggle & Quick Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const updated = {
                    ...settings,
                    biddingConfig: {
                      ...settings.biddingConfig,
                      enabled: !settings.biddingConfig.enabled,
                    },
                  };
                  setSettings(updated);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                  settings.biddingConfig.enabled
                    ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md shadow-emerald-500/20'
                    : isLight
                    ? 'bg-slate-100 text-slate-600 border-slate-300'
                    : 'bg-slate-900 text-slate-400 border-slate-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${settings.biddingConfig.enabled ? 'bg-slate-950' : 'bg-slate-400'}`} />
                {settings.biddingConfig.enabled ? '3-Form Bidding: ACTIVE' : '3-Form Bidding: DISABLED'}
              </button>

              <button
                type="button"
                onClick={handleSavePricing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Deploy Rules
              </button>
            </div>
          </div>

          {/* Main 2-Column Grid: Form Tiers Settings (Left) & Real-time Live Simulator (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (7 Cols): The 3 Forms Configuration */}
            <div className="lg:col-span-7 space-y-4">
              {/* Quick Strategy Preset Chips */}
              <div className={`p-4 rounded-3xl border space-y-2 ${isLight ? 'bg-white border-slate-200' : 'bg-[#0b0f19] border-slate-800'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Quick Bidding Strategy Presets
                  </span>
                  <span className="text-[10px] text-indigo-500 font-bold">1-Click Apply</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { name: 'Standard (0%, +10%, +15%)', t1: 0, t2: 10, t3: 15, t2l: 'Offer +10%', t3l: 'Offer +15%' },
                    { name: 'Peak Hours (0%, +12%, +20%)', t1: 0, t2: 12, t3: 20, t2l: 'Offer +12%', t3l: 'Offer +20%' },
                    { name: 'High Demand (0%, +15%, +25%)', t1: 0, t2: 15, t3: 25, t2l: 'Offer +15%', t3l: 'Offer +25%' },
                    { name: 'Competitive (0%, +5%, +10%)', t1: 0, t2: 5, t3: 10, t2l: 'Offer +5%', t3l: 'Offer +10%' },
                  ].map((preset) => {
                    const isSelected =
                      settings.biddingConfig.tier1Percent === preset.t1 &&
                      settings.biddingConfig.tier2Percent === preset.t2 &&
                      settings.biddingConfig.tier3Percent === preset.t3;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setSettings({
                            ...settings,
                            biddingConfig: {
                              ...settings.biddingConfig,
                              tier1Percent: preset.t1,
                              tier2Percent: preset.t2,
                              tier3Percent: preset.t3,
                              tier2Label: preset.t2l,
                              tier3Label: preset.t3l,
                            },
                          });
                        }}
                        className={`p-2 rounded-2xl text-[11px] font-bold border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                            : isLight
                            ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                            : 'bg-slate-950 hover:bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        <span className="block font-black truncate">{preset.name.split(' ')[0]}</span>
                        <span className="text-[9px] opacity-80">{preset.name.match(/\((.*?)\)/)?.[0] || ''}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form Tier 1: Passenger Base Offer (0% Markup) */}
              <div className={`p-5 rounded-3xl border space-y-3 transition-all ${
                isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b0f19] border-slate-800 shadow-sm'
              }`}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center border border-emerald-500/30">
                      1
                    </span>
                    <div>
                      <h3 className={`text-sm font-black flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        Form 1: Accept Passenger Offer Price
                      </h3>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                        Base direct acceptance with zero negotiation markup
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black border border-emerald-500/20">
                    BASE OFFER (0%)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className={`p-3 rounded-2xl border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block">Button Display Label</label>
                    <input
                      type="text"
                      value={settings.biddingConfig?.tier1Label ?? ''}
                      onChange={(e) => {
                        setSettings({
                          ...settings,
                          biddingConfig: {
                            ...settings.biddingConfig,
                            tier1Label: e.target.value,
                          },
                        });
                      }}
                      placeholder="Accept Offer"
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-emerald-500 ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    />
                  </div>

                  <div className={`p-3 rounded-2xl border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Markup Percentage</label>
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{settings.biddingConfig.tier1Percent}%</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.biddingConfig.tier1Percent}
                      disabled
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-bold opacity-75 cursor-not-allowed ${
                        isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    />
                    <span className="text-[9px] text-slate-400 block">Locked to 0% to directly match passenger's offer price.</span>
                  </div>
                </div>
              </div>

              {/* Form Tier 2: 10% Increased in Accept Offer Price */}
              <div className={`p-5 rounded-3xl border space-y-3 transition-all ${
                isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b0f19] border-slate-800 shadow-sm'
              }`}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center border border-amber-500/30">
                      2
                    </span>
                    <div>
                      <h3 className={`text-sm font-black flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        Form 2: 10% Increased Offer Price
                      </h3>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold block">
                        Moderate counter-offer (+{settings.biddingConfig.tier2Percent}% markup)
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black border border-amber-500/20">
                    +{settings.biddingConfig.tier2Percent}% COUNTER
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className={`p-3 rounded-2xl border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block">Button Display Label</label>
                    <input
                      type="text"
                      value={settings.biddingConfig?.tier2Label ?? ''}
                      onChange={(e) => {
                        setSettings({
                          ...settings,
                          biddingConfig: {
                            ...settings.biddingConfig,
                            tier2Label: e.target.value,
                          },
                        });
                      }}
                      placeholder="Offer +10%"
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-amber-500 ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    />
                  </div>

                  <div className={`p-3 rounded-2xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Increase Percentage</label>
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400">+{settings.biddingConfig.tier2Percent}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      step="1"
                      value={settings.biddingConfig.tier2Percent}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setSettings({
                          ...settings,
                          biddingConfig: {
                            ...settings.biddingConfig,
                            tier2Percent: val,
                            tier2Label: `Offer +${val}%`,
                          },
                        });
                      }}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex items-center gap-1 pt-1">
                      {[5, 8, 10, 12, 15].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setSettings({
                              ...settings,
                              biddingConfig: {
                                ...settings.biddingConfig,
                                tier2Percent: pct,
                                tier2Label: `Offer +${pct}%`,
                              },
                            });
                          }}
                          className={`flex-1 py-1 rounded-lg text-[9px] font-bold border transition-colors cursor-pointer text-center ${
                            settings.biddingConfig.tier2Percent === pct
                              ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                              : isLight
                              ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                              : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          +{pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Tier 3: 15% Increase in Passenger Accept Price Offer */}
              <div className={`p-5 rounded-3xl border space-y-3 transition-all ${
                isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0b0f19] border-slate-800 shadow-sm'
              }`}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center border border-indigo-500/30">
                      3
                    </span>
                    <div>
                      <h3 className={`text-sm font-black flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                        Form 3: 15% Increased Offer Price
                      </h3>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold block">
                        Maximum counter-bid (+{settings.biddingConfig.tier3Percent}% markup for traffic/peak)
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black border border-indigo-500/20">
                    +{settings.biddingConfig.tier3Percent}% COUNTER
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className={`p-3 rounded-2xl border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block">Button Display Label</label>
                    <input
                      type="text"
                      value={settings.biddingConfig?.tier3Label ?? ''}
                      onChange={(e) => {
                        setSettings({
                          ...settings,
                          biddingConfig: {
                            ...settings.biddingConfig,
                            tier3Label: e.target.value,
                          },
                        });
                      }}
                      placeholder="Offer +15%"
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    />
                  </div>

                  <div className={`p-3 rounded-2xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Increase Percentage</label>
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">+{settings.biddingConfig.tier3Percent}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="80"
                      step="1"
                      value={settings.biddingConfig.tier3Percent}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setSettings({
                          ...settings,
                          biddingConfig: {
                            ...settings.biddingConfig,
                            tier3Percent: val,
                            tier3Label: `Offer +${val}%`,
                          },
                        });
                      }}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                    <div className="flex items-center gap-1 pt-1">
                      {[12, 15, 18, 20, 25].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setSettings({
                              ...settings,
                              biddingConfig: {
                                ...settings.biddingConfig,
                                tier3Percent: pct,
                                tier3Label: `Offer +${pct}%`,
                              },
                            });
                          }}
                          className={`flex-1 py-1 rounded-lg text-[9px] font-bold border transition-colors cursor-pointer text-center ${
                            settings.biddingConfig.tier3Percent === pct
                              ? 'bg-indigo-500 text-white border-indigo-500 shadow-xs'
                              : isLight
                              ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                              : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                          }`}
                        >
                          +{pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rounding & Persistence Preferences */}
              <div className={`p-4 rounded-3xl border flex items-center justify-between gap-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
              }`}>
                <div>
                  <h4 className={`text-xs font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                    Round Counter Fares to Nearest Rupee
                  </h4>
                  <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Clean fare numbers (e.g. ₹110 instead of ₹110.40) for seamless passenger cash & UPI settlements.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSettings({
                      ...settings,
                      biddingConfig: {
                        ...settings.biddingConfig,
                        roundToWholeRupee: !settings.biddingConfig.roundToWholeRupee,
                      },
                    });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    settings.biddingConfig.roundToWholeRupee
                      ? 'bg-emerald-500 text-slate-950 border-emerald-500 font-black'
                      : isLight
                      ? 'bg-white text-slate-600 border-slate-300'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  {settings.biddingConfig.roundToWholeRupee ? 'Enabled (Whole ₹)' : 'Disabled (Cents)'}
                </button>
              </div>
            </div>

            {/* Right Column (5 Cols): Live Captain Request Simulator & Real-time Visualizer */}
            <div className={`lg:col-span-5 border rounded-3xl p-5 space-y-4 shadow-md flex flex-col justify-between ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#0b0f19] border-slate-800'
            }`}>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                  <h3 className={`text-sm font-black flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                    <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
                    Live Captain Dashboard Preview
                  </h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                    WYSIWYG SIMULATOR
                  </span>
                </div>

                {/* Passenger Proposed Fare Tester */}
                <div className={`p-3.5 rounded-2xl border space-y-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Test Passenger Offered Fare</span>
                    <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                      ₹{simOfferFareAdmin.toFixed(0)}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="30"
                    max="500"
                    step="5"
                    value={simOfferFareAdmin}
                    onChange={(e) => setSimOfferFareAdmin(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />

                  <div className="grid grid-cols-5 gap-1 pt-1">
                    {[50, 80, 100, 150, 250].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSimOfferFareAdmin(val)}
                        className={`py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer text-center ${
                          simOfferFareAdmin === val
                            ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-xs'
                            : isLight
                            ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                            : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        ₹{val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Exact Simulated Captain Incoming Request Card */}
                {(() => {
                  const baseFare = simOfferFareAdmin;
                  const calc1 = settings.biddingConfig.roundToWholeRupee
                    ? Math.round(baseFare * (1 + settings.biddingConfig.tier1Percent / 100))
                    : Number((baseFare * (1 + settings.biddingConfig.tier1Percent / 100)).toFixed(2));
                  const calc2 = settings.biddingConfig.roundToWholeRupee
                    ? Math.round(baseFare * (1 + settings.biddingConfig.tier2Percent / 100))
                    : Number((baseFare * (1 + settings.biddingConfig.tier2Percent / 100)).toFixed(2));
                  const calc3 = settings.biddingConfig.roundToWholeRupee
                    ? Math.round(baseFare * (1 + settings.biddingConfig.tier3Percent / 100))
                    : Number((baseFare * (1 + settings.biddingConfig.tier3Percent / 100)).toFixed(2));

                  const captainSharePct = (100 - settings.commissionRate) / 100;

                  return (
                    <div className="space-y-3">
                      {/* Realistic Captain UI Card */}
                      <div className={`p-4 rounded-2xl border-2 shadow-lg space-y-3 ${
                        isLight ? 'bg-amber-500/5 border-amber-500/30' : 'bg-amber-500/10 border-amber-500/30'
                      }`}>
                        {/* Passenger header & Offer badge */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center font-bold text-xs">
                              PR
                            </span>
                            <div>
                              <span className="font-black text-xs block text-slate-900 dark:text-white">Priya Sharma</span>
                              <span className="text-[10px] text-slate-500">⭐ 4.9 • 3.8 km trip</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] uppercase font-black text-amber-600 dark:text-amber-400 block tracking-wider">
                              Passenger Offer
                            </span>
                            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                              ₹{baseFare.toFixed(0)}
                            </span>
                          </div>
                        </div>

                        {/* Route snippet */}
                        <div className="text-[11px] space-y-1 p-2 rounded-xl bg-black/5 dark:bg-black/20 text-slate-700 dark:text-slate-300">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-emerald-500 font-black">●</span>
                            <span className="truncate">Cyber City Hub, Tower 3</span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-rose-500 font-black">■</span>
                            <span className="truncate">Sector 18 Metro Terminal</span>
                          </div>
                        </div>

                        {/* The Acceptance Fare Buttons Preview */}
                        <div className="pt-2 space-y-2">
                          {/* First show: Accept for ₹calc1 */}
                          <div className="w-full py-3 px-4 rounded-2xl bg-emerald-500 text-slate-950 font-black text-center shadow-md shadow-emerald-500/20 cursor-default flex items-center justify-center gap-2">
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span className="text-sm font-black">Accept for ₹{calc1}</span>
                          </div>

                          {/* Offer your fare */}
                          <div className="flex items-center gap-2 pt-1">
                            <div className={`h-px flex-1 ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
                            <span className={`text-[11px] font-bold tracking-tight uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              Offer your fare
                            </span>
                            <div className={`h-px flex-1 ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
                          </div>

                          {/* Offer fare buttons: ₹calc2      ₹calc3 */}
                          <div className="grid grid-cols-2 gap-2.5">
                            {/* Fare 2 */}
                            <div className="py-3 px-3 rounded-2xl bg-amber-500 text-slate-950 font-black text-center shadow-md shadow-amber-500/20 cursor-default flex items-center justify-center">
                              <span className="text-base font-black font-mono">
                                ₹{calc2}
                              </span>
                            </div>

                            {/* Fare 3 */}
                            <div className="py-3 px-3 rounded-2xl bg-indigo-600 text-white font-black text-center shadow-md shadow-indigo-600/20 cursor-default flex items-center justify-center">
                              <span className="text-base font-black font-mono">
                                ₹{calc3}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Financial Distribution Table */}
                      <div className={`p-3.5 rounded-2xl border space-y-2 text-xs ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                      }`}>
                        <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
                          <span>Form Option</span>
                          <span>Agreed Fare</span>
                          <span>Captain Payout</span>
                          <span>Platform Cut ({settings.commissionRate}%)</span>
                        </div>

                        {[
                          { name: 'Form 1 (Base Offer)', fare: calc1, color: 'text-emerald-500' },
                          { name: `Form 2 (+${settings.biddingConfig.tier2Percent}%)`, fare: calc2, color: 'text-amber-500' },
                          { name: `Form 3 (+${settings.biddingConfig.tier3Percent}%)`, fare: calc3, color: 'text-indigo-500' },
                        ].map((row) => {
                          const capPayout = (row.fare * captainSharePct).toFixed(2);
                          const platCut = (row.fare * (settings.commissionRate / 100)).toFixed(2);
                          return (
                            <div key={row.name} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-200/40 dark:border-slate-800/40 last:border-none">
                              <span className={`font-bold ${row.color}`}>{row.name}</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-white">₹{row.fare}</span>
                              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">₹{capPayout}</span>
                              <span className="font-mono text-amber-600 dark:text-amber-400">₹{platCut}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Deploy Action */}
              <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={handleSavePricing}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 transition-all cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Deploy & Sync 3-Form Bidding Rules</span>
                </button>
                <p className="text-[10px] text-center text-slate-400">
                  Instantly updates live pricing context for all active Captains across tabs.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TRIP INSPECTOR MODAL ================= */}
      {selectedRide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isLight ? 'bg-white border-slate-200' : 'bg-[#0f172a] border-slate-800'}`}>
            {/* Header */}
            <div className={`p-4 border-b flex items-center justify-between ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center font-bold">
                  🏍️
                </div>
                <div>
                  <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                    Trip Inspector #{selectedRide.id.slice(0, 8)}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedRide.status === 'requested'
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                          : selectedRide.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                          : 'bg-sky-500/20 text-sky-600 dark:text-sky-300'
                      }`}
                    >
                      {selectedRide.status.toUpperCase()}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Created at: {new Date(selectedRide.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedRide(null)}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Trip Parties Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Passenger */}
                <div className={`p-3.5 rounded-2xl border space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Passenger Details</span>
                    <button
                      onClick={() => {
                        setSelectedRide(null);
                        openPassengerProfile(selectedRide.passenger_id, selectedRide.passenger_name, selectedRide.passenger_phone);
                      }}
                      className="text-[10px] font-black text-sky-500 hover:text-sky-400 flex items-center gap-1 cursor-pointer"
                    >
                      <User className="w-3 h-3" /> View Profile
                    </button>
                  </div>
                  <p className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{selectedRide.passenger_name || 'Sarah Jenkins'}</p>
                  <p className="text-slate-400">{selectedRide.passenger_phone || '+1 (555) 392-1049'}</p>
                  <p className="text-[10px] text-slate-400 font-mono">ID: {selectedRide.passenger_id.slice(0, 12)}...</p>
                </div>

                {/* Captain */}
                <div className={`p-3.5 rounded-2xl border space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Assigned Captain</span>
                  <p className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{selectedRide.captain_name || 'Not yet accepted'}</p>
                  <p className="text-slate-400">{selectedRide.captain_vehicle || '—'}</p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    ID: {selectedRide.captain_id ? `${selectedRide.captain_id.slice(0, 12)}...` : 'Pending Match'}
                  </p>
                </div>
              </div>

              {/* Addresses */}
              <div className={`p-3.5 rounded-2xl border space-y-2 text-xs ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Pickup Address</span>
                    <span className={isLight ? 'text-slate-800' : 'text-slate-200'}>{selectedRide.pickup_location}</span>
                  </div>
                </div>
                <div className={`flex items-start gap-2 border-t pt-2 ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
                  <Navigation className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Dropoff Destination</span>
                    <span className={isLight ? 'text-slate-800' : 'text-slate-200'}>{selectedRide.dropoff_location}</span>
                  </div>
                </div>
              </div>

              {/* Admin Force Override Buttons */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">
                  Admin Force State Override
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleOverrideStatus(selectedRide.id, 'accepted')}
                    className={`py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${isLight ? 'bg-sky-100 hover:bg-sky-200 text-sky-800' : 'bg-slate-800 hover:bg-slate-700 text-sky-300'}`}
                  >
                    Force Accept
                  </button>
                  <button
                    onClick={() => handleOverrideStatus(selectedRide.id, 'completed')}
                    className={`py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${isLight ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800' : 'bg-slate-800 hover:bg-slate-700 text-emerald-300'}`}
                  >
                    Force Complete
                  </button>
                  <button
                    onClick={() => handleOverrideStatus(selectedRide.id, 'cancelled')}
                    className={`py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${isLight ? 'bg-rose-100 hover:bg-rose-200 text-rose-800' : 'bg-slate-800 hover:bg-slate-700 text-rose-300'}`}
                  >
                    Force Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= PASSENGER PROFILE INSPECTOR MODAL ================= */}
      {selectedPassenger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div
            className={`border rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#0f172a] border-slate-800'
            }`}
          >
            {/* Modal Header */}
            <div className={`p-5 border-b flex items-start justify-between gap-4 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
            }`}>
              <div className="flex items-center gap-3.5">
                {selectedPassenger.avatar_url ? (
                  <img
                    src={selectedPassenger.avatar_url}
                    alt={selectedPassenger.name}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-sky-400/50 shadow-md"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-md">
                    {selectedPassenger.name.charAt(0)}
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`text-lg font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      {selectedPassenger.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        selectedPassenger.status === 'vip'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30'
                          : selectedPassenger.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : selectedPassenger.status === 'new'
                          ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {selectedPassenger.status === 'vip' ? '⭐ VIP Passenger' : selectedPassenger.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-0.5">
                    Member since <span className="font-semibold text-slate-600 dark:text-slate-300">{selectedPassenger.joinedDate}</span> · Last active <span className="font-semibold text-slate-600 dark:text-slate-300">{selectedPassenger.lastActive}</span>
                  </p>

                  <div className="flex items-center gap-3 text-xs mt-1">
                    <span className="text-amber-500 font-bold flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 inline" /> {selectedPassenger.rating}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className={`font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      {Math.max(selectedPassenger.totalTrips, passengerRides.length)} Total Rides
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{selectedPassenger.walletBalance.toFixed(2)} Balance
                    </span>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedPassenger(null)}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className={`flex items-center border-b px-4 text-xs font-bold ${
              isLight ? 'bg-white border-slate-200' : 'bg-slate-900/40 border-slate-800'
            }`}>
              <button
                onClick={() => setPassengerActiveSubTab('overview')}
                className={`py-3 px-3 border-b-2 transition-all cursor-pointer ${
                  passengerActiveSubTab === 'overview'
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                Overview & Safety
              </button>
              <button
                onClick={() => setPassengerActiveSubTab('rides')}
                className={`py-3 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  passengerActiveSubTab === 'rides'
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <span>Fleet Rides</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-800">
                  {passengerRides.length}
                </span>
              </button>
              <button
                onClick={() => setPassengerActiveSubTab('wallet')}
                className={`py-3 px-3 border-b-2 transition-all cursor-pointer ${
                  passengerActiveSubTab === 'wallet'
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                Wallet & Credits (₹)
              </button>
              <button
                onClick={() => setPassengerActiveSubTab('notes')}
                className={`py-3 px-3 border-b-2 transition-all cursor-pointer ${
                  passengerActiveSubTab === 'notes'
                    ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                Admin CRM Notes
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
              {/* SUB-TAB 1: OVERVIEW & SAFETY */}
              {passengerActiveSubTab === 'overview' && (
                <div className="space-y-4">
                  {/* Contact & Identifiers Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className={`p-3.5 rounded-2xl border space-y-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Contact Information</span>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-sky-500" /> Phone:</span>
                          <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{selectedPassenger.phone}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-sky-500" /> Email:</span>
                          <span className="font-mono text-[11px] text-slate-300 truncate max-w-[140px]">{selectedPassenger.email}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-rose-500" /> Emergency SOS:</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">{selectedPassenger.emergencyContact}</span>
                        </div>
                      </div>
                    </div>

                    <div className={`p-3.5 rounded-2xl border space-y-2 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Ride & Comfort Preferences</span>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Helmet Preference:</span>
                          <span className="font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300">
                            Size {selectedPassenger.preferences.helmetSize}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Start-Trip PIN:</span>
                          <span className={selectedPassenger.preferences.requirePin ? 'text-emerald-500 font-bold' : 'text-slate-400'}>
                            {selectedPassenger.preferences.requirePin ? '✓ Enforced' : 'Off'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Quiet Ride Mode:</span>
                          <span className={selectedPassenger.preferences.quietRide ? 'text-sky-400 font-bold' : 'text-slate-400'}>
                            {selectedPassenger.preferences.quietRide ? '✓ Preferred' : 'No Preference'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Saved Places */}
                  <div className={`p-4 rounded-2xl border space-y-2.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Saved Frequent Destinations ({selectedPassenger.savedPlaces.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedPassenger.savedPlaces.map((place, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border flex items-start gap-2 text-xs ${
                            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                          }`}
                        >
                          <span className="text-base shrink-0">{place.icon}</span>
                          <div className="min-w-0">
                            <span className={`font-bold block ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{place.name}</span>
                            <span className="text-[10px] text-slate-400 truncate block">{place.address}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Status Control Bar */}
                  <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                    isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}>
                    <span className="text-slate-400">Passenger Account State:</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePassengerStatus(selectedPassenger.id)}
                        className={`px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer ${
                          selectedPassenger.status === 'vip'
                            ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/20'
                            : selectedPassenger.status === 'suspended'
                            ? 'bg-rose-500 text-white'
                            : 'bg-emerald-500 text-slate-950'
                        }`}
                      >
                        Status: {selectedPassenger.status.toUpperCase()} (Click to Cycle)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 2: FLEET RIDES */}
              {passengerActiveSubTab === 'rides' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Live & Historical Rides Stream for this Passenger:</span>
                    <span className="font-bold text-sky-500">{passengerRides.length} record(s) found</span>
                  </div>

                  {passengerRides.length === 0 ? (
                    <div className={`p-8 text-center rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
                      <Navigation className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                      <p className="text-xs font-semibold text-slate-400">No live or recorded trips found in the active session for this passenger ID.</p>
                      <button
                        onClick={handleGenerateTestRide}
                        className="mt-3 px-3 py-1.5 bg-amber-500 text-slate-950 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Simulate Test Booking
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {passengerRides.map((ride) => (
                        <div
                          key={ride.id}
                          className={`p-3 rounded-2xl border space-y-2 text-xs transition-all ${
                            isLight ? 'bg-slate-50 border-slate-200 hover:border-sky-300' : 'bg-slate-950 border-slate-800 hover:border-sky-500/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-emerald-500 font-bold">#{ride.id.slice(0, 6)}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  ride.status === 'completed'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : ride.status === 'cancelled'
                                    ? 'bg-rose-500/20 text-rose-400'
                                    : 'bg-sky-500/20 text-sky-400'
                                }`}
                              >
                                {ride.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-amber-500">₹{ride.fare || 120}</span>
                              <button
                                onClick={() => {
                                  setSelectedRide(ride);
                                }}
                                className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-sky-500 hover:text-white transition-colors text-[10px] font-bold cursor-pointer"
                              >
                                Inspect Trip
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1 text-[11px]">
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="truncate">{ride.pickup_location}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                              <span className="truncate">{ride.dropoff_location}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 border-t pt-1.5 border-slate-200 dark:border-slate-800">
                            <span>Captain: {ride.captain_name || 'Unassigned / Searching'}</span>
                            <span>{new Date(ride.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB 3: WALLET & CREDITS */}
              {passengerActiveSubTab === 'wallet' && (
                <div className="space-y-4">
                  {/* Balance Display */}
                  <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                    isLight ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-950/30 border-emerald-800/60'
                  }`}>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">
                        Current Passenger Wallet Balance
                      </span>
                      <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                        ₹{selectedPassenger.walletBalance.toFixed(2)}
                      </p>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Lifetime Rides Spend: ₹{selectedPassenger.totalSpend.toFixed(2)}
                      </span>
                    </div>

                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                      <Wallet className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Admin Courtesy Credit Issuer */}
                  <div className={`p-4 rounded-2xl border space-y-3 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
                  }`}>
                    <span className="text-xs font-bold block text-slate-700 dark:text-slate-200">
                      Grant Instant Courtesy / Support Credit
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {[50, 100, 200, 500].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => handleAddPassengerCredit(selectedPassenger.id, amt)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all shadow-sm shadow-emerald-500/20 cursor-pointer active:scale-95"
                        >
                          +₹{amt}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <input
                        type="number"
                        min="1"
                        step="10"
                        value={creditAdjustmentAmount ?? 0}
                        onChange={(e) => setCreditAdjustmentAmount(parseFloat(e.target.value) || 0)}
                        placeholder="Custom Amount"
                        className={`border rounded-xl px-3 py-1.5 text-xs font-bold w-32 focus:outline-none focus:border-emerald-500 ${
                          isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                        }`}
                      />
                      <button
                        onClick={() => handleAddPassengerCredit(selectedPassenger.id, creditAdjustmentAmount)}
                        className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        Grant Custom Credit
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-TAB 4: ADMIN CRM NOTES */}
              {passengerActiveSubTab === 'notes' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-400">Internal Admin & Support Team Notes:</span>
                    <span className="text-[10px] text-slate-500">Visible only to Admin Staff</span>
                  </div>

                  <textarea
                    rows={4}
                    value={passengerNoteDraft || ''}
                    onChange={(e) => setPassengerNoteDraft(e.target.value)}
                    placeholder="Add operational notes, customer incident logs, or VIP handling instructions..."
                    className={`w-full border rounded-2xl p-3.5 text-xs focus:outline-none focus:border-sky-500 resize-none ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-slate-100'
                    }`}
                  />

                  <button
                    onClick={() => handleSavePassengerNotes(selectedPassenger.id, passengerNoteDraft)}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Save Notes to Passenger Record
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className={`p-4 border-t flex items-center justify-between text-xs ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-900/80 border-slate-800 text-slate-400'
            }`}>
              <span className="font-mono text-[10px]">Passenger ID: {selectedPassenger.id}</span>
              <button
                onClick={() => setSelectedPassenger(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
