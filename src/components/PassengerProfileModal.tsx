import React, { useState } from 'react';
import {
  User,
  Phone,
  Mail,
  Shield,
  Star,
  Wallet,
  CreditCard,
  MapPin,
  Clock,
  ChevronRight,
  X,
  Check,
  Plus,
  Lock,
  Heart,
  Award,
  Bell,
  Settings,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Camera,
} from 'lucide-react';
import { UserProfile, PaymentMethodType } from '../types/ride';
import { AvatarUploader } from './AvatarUploader';

interface PassengerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
}

export const PassengerProfileModal: React.FC<PassengerProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'wallet' | 'history' | 'saved' | 'safety'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState('sarah.jenkins@example.com');
  const [emergencyContact, setEmergencyContact] = useState('+1 (555) 902-8812 (Mom)');
  const [pickupNotes, setPickupNotes] = useState('Please wait near the main lobby entrance');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Wallet state
  const [walletBalance, setWalletBalance] = useState(84.5);
  const [addAmount, setAddAmount] = useState<number | null>(null);

  // Safety settings
  const [requirePin, setRequirePin] = useState(true);
  const [shareLiveStatus, setShareLiveStatus] = useState(true);

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      name,
      phone,
    });
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleAddFunds = (amount: number) => {
    setWalletBalance((prev) => prev + amount);
    setAddAmount(null);
  };

  const PAST_TRIPS = [
    {
      id: 'trip-902',
      date: 'Today, 2:15 PM',
      pickup: 'Downtown Metro Station',
      dropoff: 'Mission Bay Tech Center',
      fare: 14.5,
      driver: 'Captain Alex Rivera',
      rating: 5,
      vehicle: 'Yamaha MT-07 · Black',
      status: 'Completed',
    },
    {
      id: 'trip-841',
      date: 'Yesterday, 6:40 PM',
      pickup: 'Union Square District',
      dropoff: 'Marina Green Promenade',
      fare: 18.2,
      driver: 'Captain David Miller',
      rating: 5,
      vehicle: 'Honda CB500X · Red',
      status: 'Completed',
    },
    {
      id: 'trip-792',
      date: 'Aug 24, 9:10 AM',
      pickup: 'Civic Center Plaza',
      dropoff: 'Financial District · California St',
      fare: 11.0,
      driver: 'Captain Marcus Chen',
      rating: 5,
      vehicle: 'Kawasaki Ninja · Lime',
      status: 'Completed',
    },
  ];

  const SAVED_PLACES = [
    { label: 'Home', address: '742 Evergreen Terrace, Mission District', icon: '🏠' },
    { label: 'Work', address: 'Tech Plaza Tower 4, SOMA 2nd St', icon: '💼' },
    { label: 'Gym', address: 'Equinox Sports Club, Market St', icon: '🏋️' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative group">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-md"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 font-black text-lg flex items-center justify-center shadow-md">
                  {user.name.charAt(0)}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center shadow">
                <Camera className="w-2.5 h-2.5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-100">{user.name}</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Gold Rider
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span className="text-amber-300 font-bold flex items-center">
                  <Star className="w-3 h-3 fill-amber-300 mr-0.5" /> {user.rating || 4.94}
                </span>
                <span>·</span>
                <span>38 Lifetime Rides</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-3 py-2 bg-slate-950 border-b border-slate-800 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Profile Info
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'wallet'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Wallet & Pay (${walletBalance.toFixed(2)})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'history'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Trip History
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'saved'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Saved Places
          </button>
          <button
            onClick={() => setActiveTab('safety')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'safety'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Safety
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs text-slate-300">
          {savedSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          {/* ================= TAB 1: PROFILE ================= */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* Profile Photo Uploader Section */}
              <AvatarUploader
                currentAvatarUrl={user.avatar_url}
                userName={user.name}
                role="passenger"
                onAvatarChange={(newUrl) => onUpdateUser({ avatar_url: newUrl })}
                accentColor="emerald"
              />

              {!isEditing ? (
                <div className="space-y-3">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Full Name</span>
                      <span className="font-bold text-slate-100">{user.name}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Phone Number</span>
                      <span className="font-bold text-slate-100">{user.phone}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Email Address</span>
                      <span className="font-bold text-slate-100">{email}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Emergency Contact</span>
                      <span className="font-bold text-emerald-400">{emergencyContact}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Default Pickup Note</span>
                      <span className="font-medium text-slate-300 truncate max-w-[200px]">
                        {pickupNotes}
                      </span>
                    </div>
                  </div>

                  {/* Rider Compliments / Badges */}
                  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Rider Badges & Ratings
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                        <Award className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                        <span className="font-bold text-slate-200 block">Always On Time</span>
                        <span className="text-[10px] text-slate-500">100% on time</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                        <Star className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                        <span className="font-bold text-slate-200 block">5-Star Rider</span>
                        <span className="text-[10px] text-slate-500">36 ratings</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                        <Heart className="w-4 h-4 text-rose-400 mx-auto mb-1" />
                        <span className="font-bold text-slate-200 block">Respectful</span>
                        <span className="text-[10px] text-slate-500">Captain favorite</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer"
                  >
                    Edit Profile Details
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400">Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400">Phone Number</label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400">Emergency Contact</label>
                    <input
                      type="text"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400">Default Pickup Notes for Captain</label>
                    <textarea
                      rows={2}
                      value={pickupNotes}
                      onChange={(e) => setPickupNotes(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl shadow-md cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ================= TAB 2: WALLET & PAYMENT ================= */}
          {activeTab === 'wallet' && (
            <div className="space-y-3">
              <div className="bg-gradient-to-tr from-emerald-900/60 to-teal-900/40 border border-emerald-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-300 font-semibold">MotoRide In-App Wallet</span>
                  <Wallet className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <span className="text-3xl font-black text-white">${walletBalance.toFixed(2)}</span>
                  <span className="text-[11px] text-emerald-300/80 block mt-0.5">Available for instant 1-tap checkout</span>
                </div>
              </div>

              {/* Quick Add Funds */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Quick Top Up Balance
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 25, 50].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => handleAddFunds(amt)}
                      className="py-2 bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      +${amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Methods */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Linked Payment Methods
                </span>
                <div className="space-y-1.5">
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CreditCard className="w-4 h-4 text-sky-400" />
                      <div>
                        <span className="font-bold text-slate-200 block">Visa ending in •••• 4242</span>
                        <span className="text-[10px] text-slate-500">Expires 08/28</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold">
                      Default
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <div>
                        <span className="font-bold text-slate-200 block">Apple Pay</span>
                        <span className="text-[10px] text-slate-500">Biometric Touch / Face ID</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold">Connected</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: TRIP HISTORY ================= */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Recent Completed Trips ({PAST_TRIPS.length})
              </span>
              {PAST_TRIPS.map((trip) => (
                <div
                  key={trip.id}
                  className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl space-y-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400">{trip.date}</span>
                    <span className="text-sm font-black text-slate-100">${trip.fare.toFixed(2)}</span>
                  </div>

                  <div className="space-y-1 bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <div className="flex items-center gap-1.5 text-slate-300 truncate">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span className="truncate">{trip.pickup}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 truncate">
                      <span className="w-2 h-2 rounded-sm bg-rose-400 shrink-0" />
                      <span className="truncate">{trip.dropoff}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-slate-400">
                      {trip.driver} · {trip.vehicle}
                    </span>
                    <span className="text-amber-400 font-bold flex items-center">
                      ★ {trip.rating}.0
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ================= TAB 4: SAVED PLACES ================= */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Favorite & Frequent Destinations
              </span>
              {SAVED_PLACES.map((place) => (
                <div
                  key={place.label}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{place.icon}</span>
                    <div>
                      <span className="font-bold text-slate-200 block">{place.label}</span>
                      <span className="text-[11px] text-slate-400 truncate max-w-[220px] block">
                        {place.address}
                      </span>
                    </div>
                  </div>
                  <button className="text-[11px] font-bold text-emerald-400 hover:underline">
                    Edit
                  </button>
                </div>
              ))}
              <button className="w-full py-2.5 bg-slate-900 border border-dashed border-slate-700 hover:border-emerald-500 text-slate-300 font-bold rounded-2xl flex items-center justify-center gap-1.5 transition-colors">
                <Plus className="w-4 h-4 text-emerald-400" />
                Add New Saved Address
              </button>
            </div>
          )}

          {/* ================= TAB 5: SAFETY ================= */}
          {activeTab === 'safety' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-sky-500/10 border border-sky-500/30 rounded-2xl space-y-1">
                <div className="flex items-center gap-2 text-sky-400 font-bold">
                  <Shield className="w-4 h-4" />
                  <span>MotoRide RideShield™ Active</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Every ride is GPS tracked, insured, and verified with 4-digit PIN verification before starting.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Require 4-Digit Safety PIN</span>
                    <span className="text-[10px] text-slate-400">Captain must enter PIN before ride starts</span>
                  </div>
                  <button
                    onClick={() => setRequirePin(!requirePin)}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                      requirePin ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        requirePin ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="w-full h-px bg-slate-800" />

                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Auto-Share Live Ride Status</span>
                    <span className="text-[10px] text-slate-400">Send live link to emergency contact on pickup</span>
                  </div>
                  <button
                    onClick={() => setShareLiveStatus(!shareLiveStatus)}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                      shareLiveStatus ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        shareLiveStatus ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-900/90 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
