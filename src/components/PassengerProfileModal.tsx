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
  Sliders,
  Volume2,
  VolumeX,
  Compass,
  Smile,
  Sun,
  Moon,
  Bike,
} from 'lucide-react';
import { UserProfile, PaymentMethodType } from '../types/ride';
import { AvatarUploader } from './AvatarUploader';
import { useTheme } from '../context/ThemeContext';

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
  const { isLight, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'wallet' | 'history' | 'saved' | 'safety'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState('sarah.jenkins@example.com');
  const [emergencyContact, setEmergencyContact] = useState('+1 (555) 902-8812 (Mom)');
  const [pickupNotes, setPickupNotes] = useState('Please wait near the main lobby entrance');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Wallet state
  const [walletBalance, setWalletBalance] = useState(84.5);

  // Ride Preferences state
  const [helmetSize, setHelmetSize] = useState<'M' | 'L' | 'XL'>('M');
  const [quietRide, setQuietRide] = useState(false);
  const [soundEffects, setSoundEffects] = useState(true);
  const [defaultPayment, setDefaultPayment] = useState<PaymentMethodType>('upi');
  const [weatherGear, setWeatherGear] = useState(true);

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
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
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
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop backdrop overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity cursor-pointer"
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10 pointer-events-auto">
        <div
          className={`w-screen max-w-md sm:max-w-lg h-full border-l shadow-2xl flex flex-col transition-colors transform animate-in slide-in-from-right duration-300 ease-out ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0b0f19] border-slate-800 text-slate-100'
          }`}
        >
          {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between ${
          isLight ? 'bg-slate-50/90 border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}>
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
                <h3 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{user.name}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  Gold Rider
                </span>
              </div>
              <p className={`text-xs flex items-center gap-1.5 mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                <span className="text-amber-500 font-bold flex items-center">
                  <Star className="w-3 h-3 fill-amber-400 mr-0.5" /> {user.rating || 4.94}
                </span>
                <span>·</span>
                <span>38 Completed Rides</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isLight ? 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
              title="Toggle Theme"
            >
              {isLight ? <Moon className="w-4 h-4 text-amber-600" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                isLight ? 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={`flex items-center gap-1 px-3 py-2 border-b overflow-x-auto no-scrollbar ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-950 border-slate-800'
        }`}>
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Profile Info
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'preferences'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ride Preferences
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'wallet'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Wallet & Pay (₹{walletBalance.toFixed(2)})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'history'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Trip History
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'saved'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Saved Places
          </button>
          <button
            onClick={() => setActiveTab('safety')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'safety'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Safety
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
          {savedSuccess && (
            <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
              isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            }`}>
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="font-semibold">Settings and preferences saved successfully!</span>
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
                  <div className={`border rounded-2xl p-3.5 space-y-2.5 ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-900/80 border-slate-800 text-slate-200'
                  }`}>
                    <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                      <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Full Name</span>
                      <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{user.name}</span>
                    </div>
                    <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                      <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Phone Number</span>
                      <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{user.phone}</span>
                    </div>
                    <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                      <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Email Address</span>
                      <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{email}</span>
                    </div>
                    <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                      <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Emergency Contact</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{emergencyContact}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Default Pickup Note</span>
                      <span className={`font-medium truncate max-w-[200px] ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {pickupNotes}
                      </span>
                    </div>
                  </div>

                  {/* Rider Compliments / Badges */}
                  <div className={`border rounded-2xl p-3.5 space-y-2 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/50 border-slate-800'
                  }`}>
                    <span className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Rider Badges & Ratings
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className={`p-2.5 rounded-xl border ${
                        isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-950 border-slate-800/80'
                      }`}>
                        <Award className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                        <span className={`font-bold block ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>Always On Time</span>
                        <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>100% on time</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border ${
                        isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-950 border-slate-800/80'
                      }`}>
                        <Star className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                        <span className={`font-bold block ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>5-Star Rider</span>
                        <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>36 ratings</span>
                      </div>
                      <div className={`p-2.5 rounded-xl border ${
                        isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-950 border-slate-800/80'
                      }`}>
                        <Heart className="w-4 h-4 text-rose-500 mx-auto mb-1" />
                        <span className={`font-bold block ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>Respectful</span>
                        <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Captain favorite</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsEditing(true)}
                    className={`w-full py-2.5 font-bold rounded-xl border transition-colors cursor-pointer ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                    }`}
                  >
                    Edit Profile Details
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="space-y-3">
                  <div className="space-y-1">
                    <label className={`text-[11px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`w-full p-2.5 border rounded-xl focus:outline-none focus:border-emerald-500 ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={`text-[11px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Phone Number</label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={`w-full p-2.5 border rounded-xl focus:outline-none focus:border-emerald-500 ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={`text-[11px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full p-2.5 border rounded-xl focus:outline-none focus:border-emerald-500 ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={`text-[11px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Emergency Contact</label>
                    <input
                      type="text"
                      value={emergencyContact}
                      onChange={(e) => setEmergencyContact(e.target.value)}
                      className={`w-full p-2.5 border rounded-xl focus:outline-none focus:border-emerald-500 ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                      }`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={`text-[11px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Default Pickup Notes for Captain</label>
                    <textarea
                      rows={2}
                      value={pickupNotes}
                      onChange={(e) => setPickupNotes(e.target.value)}
                      className={`w-full p-2.5 border rounded-xl focus:outline-none focus:border-emerald-500 ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                      }`}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className={`flex-1 py-2.5 font-bold rounded-xl border ${
                        isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
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

          {/* ================= TAB 2: PREFERENCES & SETTINGS ================= */}
          {activeTab === 'preferences' && (
            <div className="space-y-3.5">
              <div className={`p-3.5 border rounded-2xl space-y-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
              }`}>
                <span className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  MotoRide Rider Preferences
                </span>

                {/* Helmet Size */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Preferred Helmet Size</span>
                    <span className="text-[10px] text-emerald-500 font-bold">Captain will bring this size</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['M', 'L', 'XL'] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setHelmetSize(size);
                          setSavedSuccess(true);
                          setTimeout(() => setSavedSuccess(false), 2000);
                        }}
                        className={`py-2 rounded-xl font-black text-xs border transition-all cursor-pointer ${
                          helmetSize === size
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                            : isLight
                            ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                            : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                        }`}
                      >
                        Size {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`w-full h-px ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

                {/* Quiet Ride Preference */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`font-bold block ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Quiet Ride (No Chit-Chat)</span>
                    <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Politely notify captain you prefer silence</span>
                  </div>
                  <button
                    onClick={() => {
                      setQuietRide(!quietRide);
                      setSavedSuccess(true);
                      setTimeout(() => setSavedSuccess(false), 2000);
                    }}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                      quietRide ? 'bg-emerald-500' : isLight ? 'bg-slate-300' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        quietRide ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className={`w-full h-px ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

                {/* Weather Windbreaker */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`font-bold block ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Rain & Wind Gear Assistance</span>
                    <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Request extra disposable hairnet & raincoat on wet days</span>
                  </div>
                  <button
                    onClick={() => {
                      setWeatherGear(!weatherGear);
                      setSavedSuccess(true);
                      setTimeout(() => setSavedSuccess(false), 2000);
                    }}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                      weatherGear ? 'bg-emerald-500' : isLight ? 'bg-slate-300' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        weatherGear ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className={`w-full h-px ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

                {/* Sound & Haptic FX */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`font-bold block ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Dispatch Sound & Audio Chimes</span>
                    <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Play audio tones on match and arrival</span>
                  </div>
                  <button
                    onClick={() => {
                      setSoundEffects(!soundEffects);
                      setSavedSuccess(true);
                      setTimeout(() => setSavedSuccess(false), 2000);
                    }}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                      soundEffects ? 'bg-emerald-500' : isLight ? 'bg-slate-300' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        soundEffects ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: WALLET & PAYMENT ================= */}
          {activeTab === 'wallet' && (
            <div className="space-y-3">
              <div className={`border rounded-2xl p-4 space-y-3 ${
                isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-gradient-to-tr from-emerald-900/60 to-teal-900/40 border-emerald-500/30 text-white'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>MotoRide In-App Wallet</span>
                  <Wallet className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <span className={`text-3xl font-black ${isLight ? 'text-emerald-900' : 'text-white'}`}>₹{walletBalance.toFixed(2)}</span>
                  <span className={`text-[11px] block mt-0.5 ${isLight ? 'text-emerald-700' : 'text-emerald-300/80'}`}>Available for instant 1-tap checkout</span>
                </div>
              </div>

              {/* Quick Add Funds */}
              <div className={`border rounded-2xl p-3.5 space-y-2.5 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
              }`}>
                <span className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Quick Top Up Balance
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[50, 100, 200].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => handleAddFunds(amt)}
                      className={`py-2 font-bold rounded-xl border transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                        isLight
                          ? 'bg-white hover:bg-emerald-500 hover:text-slate-950 text-slate-800 border-slate-300 shadow-xs'
                          : 'bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 border-slate-700'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      +₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Methods */}
              <div className={`border rounded-2xl p-3.5 space-y-2 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
              }`}>
                <span className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Linked Payment Methods
                </span>
                <div className="space-y-1.5">
                  <div className={`p-2.5 border rounded-xl flex items-center justify-between ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <CreditCard className="w-4 h-4 text-sky-500" />
                      <div>
                        <span className={`font-bold block ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>UPI / Google Pay / PhonePe</span>
                        <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Instant scan & pay</span>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      isLight ? 'bg-slate-200 text-slate-800' : 'bg-slate-800 text-slate-300'
                    }`}>
                      Default
                    </span>
                  </div>

                  <div className={`p-2.5 border rounded-xl flex items-center justify-between ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <DollarSign className="w-4 h-4 text-emerald-500" />
                      <div>
                        <span className={`font-bold block ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>Cash on Trip Finish</span>
                        <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Pay captain directly</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-500 font-bold">Supported</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 4: TRIP HISTORY ================= */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <span className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Recent Completed Trips ({PAST_TRIPS.length})
              </span>
              {PAST_TRIPS.map((trip) => (
                <div
                  key={trip.id}
                  className={`p-3.5 border rounded-2xl space-y-2 transition-colors ${
                    isLight ? 'bg-slate-50 border-slate-200 hover:border-slate-300' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{trip.date}</span>
                    <span className={`text-sm font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>₹{trip.fare.toFixed(2)}</span>
                  </div>

                  <div className={`space-y-1 p-2.5 rounded-xl border ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800/80'
                  }`}>
                    <div className={`flex items-center gap-1.5 truncate ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate">{trip.pickup}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      <span className="w-2 h-2 rounded-sm bg-rose-500 shrink-0" />
                      <span className="truncate">{trip.dropoff}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                      {trip.driver} · {trip.vehicle}
                    </span>
                    <span className="text-amber-500 font-bold flex items-center">
                      ★ {trip.rating}.0
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ================= TAB 5: SAVED PLACES ================= */}
          {activeTab === 'saved' && (
            <div className="space-y-3">
              <span className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Favorite & Frequent Destinations
              </span>
              {SAVED_PLACES.map((place) => (
                <div
                  key={place.label}
                  className={`p-3 border rounded-2xl flex items-center justify-between ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{place.icon}</span>
                    <div>
                      <span className={`font-bold block ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{place.label}</span>
                      <span className={`text-[11px] truncate max-w-[220px] block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {place.address}
                      </span>
                    </div>
                  </div>
                  <button className="text-[11px] font-bold text-emerald-500 hover:underline cursor-pointer">
                    Edit
                  </button>
                </div>
              ))}
              <button className={`w-full py-2.5 border border-dashed font-bold rounded-2xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                isLight ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700' : 'bg-slate-900 hover:border-emerald-500 border-slate-700 text-slate-300'
              }`}>
                <Plus className="w-4 h-4 text-emerald-500" />
                Add New Saved Address
              </button>
            </div>
          )}

          {/* ================= TAB 6: SAFETY ================= */}
          {activeTab === 'safety' && (
            <div className="space-y-3">
              <div className={`p-3.5 border rounded-2xl space-y-1 ${
                isLight ? 'bg-sky-50 border-sky-200 text-sky-900' : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
              }`}>
                <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold">
                  <Shield className="w-4 h-4" />
                  <span>MotoRide RideShield™ Active</span>
                </div>
                <p className={`text-[11px] ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Every ride is GPS tracked, verified with a 4-digit PIN before start, and protected with round-the-clock emergency support.
                </p>
              </div>

              <div className={`border rounded-2xl p-3.5 space-y-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`font-bold block ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>Require 4-Digit Safety PIN</span>
                    <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Captain must enter PIN before ride starts</span>
                  </div>
                  <button
                    onClick={() => setRequirePin(!requirePin)}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                      requirePin ? 'bg-emerald-500' : isLight ? 'bg-slate-300' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        requirePin ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className={`w-full h-px ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

                <div className="flex items-center justify-between">
                  <div>
                    <span className={`font-bold block ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>Auto-Share Live Ride Status</span>
                    <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Send live link to emergency contact on pickup</span>
                  </div>
                  <button
                    onClick={() => setShareLiveStatus(!shareLiveStatus)}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                      shareLiveStatus ? 'bg-emerald-500' : isLight ? 'bg-slate-300' : 'bg-slate-700'
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
        <div className={`p-3 border-t flex justify-end ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/90 border-slate-800'
        }`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl font-bold transition-colors cursor-pointer ${
              isLight
                ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </div>
);
};
