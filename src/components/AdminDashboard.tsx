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
import { MapMockup } from './MapMockup';
import { RealtimeChannel } from '@supabase/supabase-js';

interface AdminDashboardProps {
  onOpenSqlModal?: () => void;
}

const INITIAL_CAPTAINS: FleetCaptain[] = [
  {
    id: 'b82ac71b-39dd-4172-b567-0e02b2c3d981',
    name: 'Captain Alex Rivera',
    phone: '+1 (555) 749-3021',
    vehicle: 'Yamaha MT-07',
    plate: 'CA #7492',
    rating: 4.96,
    totalTrips: 1420,
    isOnline: true,
    status: 'available',
    todayEarnings: 94.5,
    joinedDate: 'Jan 2024',
    avatar: '🏍️',
  },
  {
    id: 'c93bd82c-40ee-4283-a678-1f13c3d4ea92',
    name: 'Captain Marcus Chen',
    phone: '+1 (555) 882-9014',
    vehicle: 'Kawasaki Ninja 400',
    plate: 'CA #3021',
    rating: 4.89,
    totalTrips: 890,
    isOnline: true,
    status: 'available',
    todayEarnings: 76.0,
    joinedDate: 'Mar 2024',
    avatar: '🛵',
  },
  {
    id: 'd04ce93d-51ff-5394-b789-2g24d4e5fb03',
    name: 'Captain Sofia Rodriguez',
    phone: '+1 (555) 412-6830',
    vehicle: 'Honda CB650R',
    plate: 'CA #9841',
    rating: 4.98,
    totalTrips: 2150,
    isOnline: true,
    status: 'in_ride',
    todayEarnings: 142.0,
    joinedDate: 'Nov 2023',
    avatar: '🏍️',
  },
  {
    id: 'e15df04e-62aa-6405-c890-3h35e5f6gc14',
    name: 'Captain Tariq Hassan',
    phone: '+1 (555) 903-5127',
    vehicle: 'KTM Duke 390',
    plate: 'CA #5512',
    rating: 4.85,
    totalTrips: 640,
    isOnline: false,
    status: 'offline',
    todayEarnings: 45.0,
    joinedDate: 'May 2024',
    avatar: '🛵',
  },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onOpenSqlModal }) => {
  const [activeTab, setActiveTab] = useState<'live_rides' | 'captains' | 'pricing' | 'audit_log'>('live_rides');
  const [rides, setRides] = useState<Ride[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [isGeneratingMock, setIsGeneratingMock] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Platform Settings State
  const [settings, setSettings] = useState<PlatformSettings>({
    baseFare: 5.0,
    perKmRate: 2.0,
    surgeMultiplier: 1.4,
    commissionRate: 15,
    autoDispatch: true,
    maxBroadcastDistanceKm: 6.5,
  });

  // Captains State
  const [captains, setCaptains] = useState<FleetCaptain[]>(INITIAL_CAPTAINS);

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

  return (
    <div id="motoride-admin-dashboard" className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              MotoRide Enterprise Fleet Control
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 font-mono">
              Live Realtime Engine
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-100 mt-1 tracking-tight">
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
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold transition-colors"
            title="Purge completed & cancelled rides to keep demo database pristine"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            Clear Completed
          </button>

          <button
            onClick={loadRides}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold transition-colors"
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
              ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span className="font-medium">{actionNotice.message}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white px-2">
            ✕
          </button>
        </div>
      )}

      {/* Database Setup Alert if needed */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
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
        <div className="bg-[#0b0f19] border border-slate-800/90 rounded-2xl p-3.5 space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Gross Volume</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-black text-white">${analytics.grossBookings.toFixed(2)}</p>
          <span className="text-[10px] text-emerald-400 font-semibold flex items-center">
            <TrendingUp className="w-3 h-3 mr-0.5 inline" /> +18.4% this week
          </span>
        </div>

        {/* Platform Commission Revenue */}
        <div className="bg-[#0b0f19] border border-slate-800/90 rounded-2xl p-3.5 space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Platform Take</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-black text-amber-300">${analytics.platformRevenue.toFixed(2)}</p>
          <span className="text-[10px] text-slate-400">{settings.commissionRate}% Take Rate</span>
        </div>

        {/* In-Flight Active Trips */}
        <div className="bg-[#0b0f19] border border-slate-800/90 rounded-2xl p-3.5 space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">In-Flight Rides</span>
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          </div>
          <p className="text-xl font-black text-sky-300">{analytics.activeRides}</p>
          <span className="text-[10px] text-sky-400 font-semibold">Accepted / En Route</span>
        </div>

        {/* Pending Broadcasts */}
        <div className="bg-[#0b0f19] border border-slate-800/90 rounded-2xl p-3.5 space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Pending Match</span>
            <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <p className="text-xl font-black text-amber-300">{analytics.requestedRides}</p>
          <span className="text-[10px] text-slate-400">Awaiting Captains</span>
        </div>

        {/* Completed Trips */}
        <div className="bg-[#0b0f19] border border-slate-800/90 rounded-2xl p-3.5 space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-black text-emerald-300">{analytics.completedRides}</p>
          <span className="text-[10px] text-slate-400">{analytics.cancelledRides} cancelled</span>
        </div>

        {/* Active Fleet Captains */}
        <div className="bg-[#0b0f19] border border-slate-800/90 rounded-2xl p-3.5 space-y-1 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400">Online Fleet</span>
            <Bike className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-xl font-black text-purple-300">
            {captains.filter((c) => c.isOnline).length} / {captains.length}
          </p>
          <span className="text-[10px] text-emerald-400 font-semibold">100% Verified</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 text-xs overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('live_rides')}
          className={`flex items-center gap-2 px-4 py-3 font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'live_rides'
              ? 'border-emerald-400 text-emerald-300 bg-emerald-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Live Fleet & Rides Stream ({rides.length})
        </button>

        <button
          onClick={() => setActiveTab('captains')}
          className={`flex items-center gap-2 px-4 py-3 font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'captains'
              ? 'border-purple-400 text-purple-300 bg-purple-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Captains & Driver Roster ({captains.length})
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`flex items-center gap-2 px-4 py-3 font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'pricing'
              ? 'border-amber-400 text-amber-300 bg-amber-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Surge & Fare Dispatch Rules
        </button>
      </div>

      {/* ================= TAB 1: LIVE RIDES STREAM ================= */}
      {activeTab === 'live_rides' && (
        <div className="space-y-4">
          {/* Controls Bar: Search & Status Filter Chips */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0b0f19] p-3 rounded-2xl border border-slate-800">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rides by ID, passenger, captain, or location..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
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
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rides Table View */}
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800 text-[10px]">
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
                <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                  {filteredRides.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <div className="space-y-2">
                          <Activity className="w-8 h-8 mx-auto text-slate-600 animate-pulse" />
                          <p className="text-sm font-semibold text-slate-400">No rides found matching this filter.</p>
                          <button
                            onClick={handleGenerateTestRide}
                            className="text-xs text-amber-400 hover:underline font-bold"
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
                          className={`hover:bg-slate-900/70 transition-colors cursor-pointer ${
                            isSelected ? 'bg-slate-900/90 ring-1 ring-emerald-500/40' : ''
                          }`}
                        >
                          {/* ID & Time */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-emerald-400 font-bold">
                                #{ride.id.slice(0, 6)}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(ride.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </td>

                          {/* Passenger */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-100">{ride.passenger_name || 'Sarah Jenkins'}</div>
                            <div className="text-[10px] text-slate-500">{ride.passenger_phone || '+1 (555) 392-1049'}</div>
                          </td>

                          {/* Captain */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {ride.captain_name ? (
                              <div>
                                <span className="font-bold text-slate-100 flex items-center gap-1">
                                  🏍️ {ride.captain_name}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {ride.captain_vehicle || 'Yamaha MT-07'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-amber-400 italic">Unassigned (Searching)</span>
                            )}
                          </td>

                          {/* Route */}
                          <td className="py-3.5 px-4 max-w-xs truncate">
                            <div className="flex items-center gap-1.5 text-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              <span className="truncate">{ride.pickup_location.split(',')[0]}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-md bg-rose-400 shrink-0" />
                              <span className="truncate">{ride.dropoff_location.split(',')[0]}</span>
                            </div>
                          </td>

                          {/* Fare & Distance */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-black text-emerald-400 text-sm">
                              ${ride.fare ? Number(ride.fare).toFixed(2) : '14.50'}
                            </span>
                            <div className="text-[10px] text-slate-500">
                              {ride.distance_km || 4.2} km · ~{ride.estimated_mins || 12} min
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                                ride.status === 'requested'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                                  : ride.status === 'accepted'
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                  : ride.status === 'arrived'
                                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                  : ride.status === 'started'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                  : ride.status === 'completed'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
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
                                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-sky-300 rounded-lg transition-colors"
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
                                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-emerald-300 rounded-lg transition-colors"
                                  title="Force Complete Ride"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={(e) => handleDeleteRide(ride.id, e)}
                                className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
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
            <h3 className="text-sm font-bold text-slate-200">Registered Motorcycle Fleet Captains</h3>
            <span className="text-xs text-slate-400">
              {captains.filter((c) => c.isOnline).length} Active Online
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {captains.map((captain) => (
              <div
                key={captain.id}
                className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-black text-2xl shadow-md">
                        {captain.avatar}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-100">{captain.name}</h4>
                        <p className="text-[10px] text-slate-400">{captain.phone}</p>
                        <span className="text-[10px] font-bold text-amber-400">
                          ★ {captain.rating} ({captain.totalTrips} rides)
                        </span>
                      </div>
                    </div>

                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        captain.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                      }`}
                    />
                  </div>

                  <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 mt-3 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Vehicle:</span>
                      <span className="font-semibold">{captain.vehicle}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">License Plate:</span>
                      <span className="font-mono font-bold text-amber-300">{captain.plate}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">Today's Earnings:</span>
                      <span className="font-bold text-emerald-400">${captain.todayEarnings.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-500 font-mono">ID: {captain.id.slice(0, 8)}...</span>
                  <button
                    onClick={() => toggleCaptainStatus(captain.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                      captain.isOnline
                        ? 'bg-slate-800 hover:bg-slate-700 text-rose-400'
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

      {/* ================= TAB 3: PRICING & DISPATCH ENGINE ================= */}
      {activeTab === 'pricing' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Surge & Dynamic Fare Rules */}
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                Surge Multiplier & Base Pricing
              </h3>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-500/30">
                ACTIVE
              </span>
            </div>

            {/* Surge Slider */}
            <div className="space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Surge Price Multiplier</span>
                <span className="text-base font-black text-amber-400">{settings.surgeMultiplier}x</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.1"
                value={settings.surgeMultiplier}
                onChange={(e) =>
                  setSettings({ ...settings, surgeMultiplier: parseFloat(e.target.value) })
                }
                className="w-full accent-amber-400 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>1.0x (Standard)</span>
                <span>2.0x (Peak Hours)</span>
                <span>3.0x (High Demand Storm)</span>
              </div>
            </div>

            {/* Base Fare & Per-Km Controls */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400">Base Fare ($)</label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.baseFare}
                  onChange={(e) => setSettings({ ...settings, baseFare: parseFloat(e.target.value) || 5.0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400">Per-Km Rate ($)</label>
                <input
                  type="number"
                  step="0.2"
                  value={settings.perKmRate}
                  onChange={(e) => setSettings({ ...settings, perKmRate: parseFloat(e.target.value) || 2.0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Commission Rate */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label className="text-[10px] font-bold uppercase text-slate-400">Platform Take Rate (%)</label>
                <span className="font-bold text-emerald-400">{settings.commissionRate}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                step="1"
                value={settings.commissionRate}
                onChange={(e) =>
                  setSettings({ ...settings, commissionRate: parseInt(e.target.value, 10) })
                }
                className="w-full accent-emerald-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Live Pricing Estimation Preview */}
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-emerald-400" />
                Live Dynamic Fare Calculator (Preview)
              </h3>

              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span>Sample Trip (4.8 km · 12 min):</span>
                  <span className="font-black text-white">
                    ${((settings.baseFare + 4.8 * settings.perKmRate) * settings.surgeMultiplier).toFixed(2)}
                  </span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span>Captain Net Payout (85%):</span>
                  <span className="font-bold text-emerald-400">
                    ${(
                      (settings.baseFare + 4.8 * settings.perKmRate) *
                      settings.surgeMultiplier *
                      ((100 - settings.commissionRate) / 100)
                    ).toFixed(2)}
                  </span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span>Platform Revenue:</span>
                  <span className="font-bold text-amber-400">
                    ${(
                      (settings.baseFare + 4.8 * settings.perKmRate) *
                      settings.surgeMultiplier *
                      (settings.commissionRate / 100)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setActionNotice({ type: 'success', message: 'Dispatch & Surge pricing rules successfully saved.' });
              }}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              Apply Fare Rules
            </button>
          </div>
        </div>
      )}

      {/* ================= TRIP INSPECTOR MODAL ================= */}
      {selectedRide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                  🏍️
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    Trip Inspector #{selectedRide.id.slice(0, 8)}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedRide.status === 'requested'
                          ? 'bg-amber-500/20 text-amber-300'
                          : selectedRide.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-sky-500/20 text-sky-300'
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
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Map Preview */}
              <MapMockup
                pickupLocation={selectedRide.pickup_location}
                dropoffLocation={selectedRide.dropoff_location}
                status={selectedRide.status}
                captainName={selectedRide.captain_name || undefined}
                distanceKm={selectedRide.distance_km || 4.8}
                estimatedMins={selectedRide.estimated_mins || 12}
                heightClass="h-48 sm:h-56"
              />

              {/* Trip Parties Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Passenger */}
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Passenger Details</span>
                  <p className="font-bold text-slate-100">{selectedRide.passenger_name || 'Sarah Jenkins'}</p>
                  <p className="text-slate-400">{selectedRide.passenger_phone || '+1 (555) 392-1049'}</p>
                  <p className="text-[10px] text-slate-500 font-mono">ID: {selectedRide.passenger_id.slice(0, 12)}...</p>
                </div>

                {/* Captain */}
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Assigned Captain</span>
                  <p className="font-bold text-slate-100">{selectedRide.captain_name || 'Not yet accepted'}</p>
                  <p className="text-slate-400">{selectedRide.captain_vehicle || '—'}</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    ID: {selectedRide.captain_id ? `${selectedRide.captain_id.slice(0, 12)}...` : 'Pending Match'}
                  </p>
                </div>
              </div>

              {/* Addresses */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Pickup Address</span>
                    <span className="text-slate-200">{selectedRide.pickup_location}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 border-t border-slate-800/80 pt-2">
                  <Navigation className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Dropoff Destination</span>
                    <span className="text-slate-200">{selectedRide.dropoff_location}</span>
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
                    className="py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-xl text-xs font-bold transition-colors"
                  >
                    Force Accept
                  </button>
                  <button
                    onClick={() => handleOverrideStatus(selectedRide.id, 'completed')}
                    className="py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-xl text-xs font-bold transition-colors"
                  >
                    Force Complete
                  </button>
                  <button
                    onClick={() => handleOverrideStatus(selectedRide.id, 'cancelled')}
                    className="py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-xl text-xs font-bold transition-colors"
                  >
                    Force Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
