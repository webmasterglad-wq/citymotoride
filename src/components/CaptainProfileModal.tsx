import React, { useState } from 'react';
import {
  User,
  Bike,
  Shield,
  Star,
  Award,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  X,
  Check,
  CreditCard,
  Building2,
  FileText,
  Sliders,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Clock,
  Compass,
  Zap,
  Camera,
  Sun,
  Moon,
  Settings,
  Eye,
  Volume2,
  Navigation,
} from 'lucide-react';
import { UserProfile } from '../types/ride';
import { AvatarUploader } from './AvatarUploader';
import { useTheme } from '../context/ThemeContext';

interface CaptainProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  captain: UserProfile;
  onUpdateCaptain: (updated: Partial<UserProfile>) => void;
  todayEarnings: number;
  completedCount: number;
}

export const CaptainProfileModal: React.FC<CaptainProfileModalProps> = ({
  isOpen,
  onClose,
  captain,
  onUpdateCaptain,
  todayEarnings,
  completedCount,
}) => {
  const { isLight, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'profile' | 'vehicle' | 'earnings' | 'preferences' | 'checklist'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(captain.name);
  const [phone, setPhone] = useState(captain.phone);
  const [email, setEmail] = useState('alex.rivera.driver@motoride.com');
  const [vehicleDetails, setVehicleDetails] = useState(
    captain.vehicle_details || 'Yamaha MT-07 · Black #4920'
  );
  const [licensePlate, setLicensePlate] = useState('CA 92K49');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Captain Preferences
  const [autoAccept, setAutoAccept] = useState(false);
  const [surgeOnly, setSurgeOnly] = useState(false);
  const [maxRadiusKm, setMaxRadiusKm] = useState(15);
  const [navApp, setNavApp] = useState<'builtin' | 'google' | 'waze'>('builtin');
  const [audioAlerts, setAudioAlerts] = useState(true);

  // Pre-Trip Safety Checklist
  const [checklist, setChecklist] = useState({
    helmetSanitized: true,
    tiresChecked: true,
    brakesWorking: true,
    fuelSufficient: true,
    passengerHelmetReady: true,
  });

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCaptain({
      name,
      phone,
      vehicle_details: vehicleDetails,
    });
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const toggleChecklistItem = (key: keyof typeof checklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity cursor-pointer"
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10 pointer-events-auto">
        <div
          className={`w-screen max-w-md sm:max-w-lg h-full border-l shadow-2xl flex flex-col transition-colors transform animate-in slide-in-from-right duration-300 ease-out ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#07090e] border-slate-800 text-slate-100'
          }`}
        >
          {/* Header */}
          <div className={`p-4 border-b flex items-center justify-between ${
            isLight ? 'bg-slate-50/90 border-slate-200' : 'bg-[#0b0f19] border-slate-800'
          }`}>
            <div className="flex items-center gap-3">
              <div className="relative group">
                {captain.avatar_url ? (
                  <img
                    src={captain.avatar_url}
                    alt={captain.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-400/50 shadow-lg"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 font-black text-xl flex items-center justify-center shadow-lg">
                    🏍️
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow">
                  <Camera className="w-2.5 h-2.5" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{captain.name}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isLight ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}>
                    Top Captain ★
                  </span>
                </div>
                <p className={`text-xs flex items-center gap-1.5 mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  <span className="text-amber-500 font-bold flex items-center">
                    ★ {captain.rating || 4.96}
                  </span>
                  <span>·</span>
                  <span>1,248 Lifetime Rides</span>
                  <span>·</span>
                  <span className="text-emerald-500 font-bold">98% Acceptance</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Quick Theme Toggle Button in Header */}
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-800'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                }`}
                title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
              >
                {isLight ? <Moon className="w-4 h-4 text-amber-600" /> : <Sun className="w-4 h-4 text-amber-400" />}
              </button>

              <button
                onClick={onClose}
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-slate-200 hover:bg-slate-300 border-slate-300 text-slate-700'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
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
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Performance & Info
            </button>
            <button
              onClick={() => setActiveTab('vehicle')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'vehicle'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bike & Docs
            </button>
            <button
              onClick={() => setActiveTab('earnings')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'earnings'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Earnings & Payouts
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'preferences'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Shift Settings
            </button>
            <button
              onClick={() => setActiveTab('checklist')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'checklist'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pre-Trip Safety
            </button>
          </div>

          {/* Tab Body */}
          <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
            {savedSuccess && (
              <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              }`}>
                <Check className="w-4 h-4 text-emerald-500" />
                <span className="font-semibold">Captain profile & settings updated successfully!</span>
              </div>
            )}

            {/* ================= TAB 1: PROFILE & SCORECARD ================= */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                {/* Captain Avatar Photo Uploader */}
                <AvatarUploader
                  currentAvatarUrl={captain.avatar_url}
                  userName={captain.name}
                  role="captain"
                  onAvatarChange={(newUrl) => onUpdateCaptain({ avatar_url: newUrl })}
                  accentColor="amber"
                />

                {/* Performance Metrics Cards */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className={`border p-3 rounded-2xl ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/90 border-slate-800'
                  }`}>
                    <span className={`text-[10px] font-bold block uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Rating</span>
                    <span className="text-lg font-black text-amber-500 block">★ {captain.rating || 4.96}</span>
                    <span className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>280 ratings</span>
                  </div>
                  <div className={`border p-3 rounded-2xl ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/90 border-slate-800'
                  }`}>
                    <span className={`text-[10px] font-bold block uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Acceptance</span>
                    <span className="text-lg font-black text-emerald-500 block">98.4%</span>
                    <span className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Tier 1 status</span>
                  </div>
                  <div className={`border p-3 rounded-2xl ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/90 border-slate-800'
                  }`}>
                    <span className={`text-[10px] font-bold block uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Cancel Rate</span>
                    <span className="text-lg font-black text-sky-500 block">0.8%</span>
                    <span className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Low & healthy</span>
                  </div>
                </div>

                {!isEditing ? (
                  <div className="space-y-3">
                    <div className={`border rounded-2xl p-3.5 space-y-2.5 ${
                      isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-900/80 border-slate-800 text-slate-200'
                    }`}>
                      <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                        <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Captain Name</span>
                        <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{captain.name}</span>
                      </div>
                      <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                        <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Phone Number</span>
                        <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{captain.phone}</span>
                      </div>
                      <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                        <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Driver Email</span>
                        <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{email}</span>
                      </div>
                      <div className={`flex items-center justify-between border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                        <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Registered Bike</span>
                        <span className="font-bold text-amber-500">{vehicleDetails}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>License Plate #</span>
                        <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{licensePlate}</span>
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
                      Edit Captain Information
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
                        className={`w-full p-2.5 border rounded-xl focus:outline-none focus:border-amber-500 ${
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
                        className={`w-full p-2.5 border rounded-xl focus:outline-none focus:border-amber-500 ${
                          isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                        }`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={`text-[11px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Vehicle Name & Model</label>
                      <input
                        type="text"
                        required
                        value={vehicleDetails}
                        onChange={(e) => setVehicleDetails(e.target.value)}
                        className={`w-full p-2.5 border rounded-xl focus:outline-none focus:border-amber-500 ${
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
                        className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-md cursor-pointer"
                      >
                        Save Details
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ================= TAB 2: VEHICLE & DOCUMENTS ================= */}
            {activeTab === 'vehicle' && (
              <div className="space-y-3">
                <div className={`border rounded-2xl p-3.5 space-y-3 ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-900/80 border-slate-800 text-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bike className="w-4 h-4 text-amber-500" />
                      <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{vehicleDetails}</span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-500 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                      Approved
                    </span>
                  </div>

                  <div className={`w-full h-px ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

                  <div className="space-y-2">
                    {[
                      { name: 'Commercial Two-Wheeler Insurance', status: 'Valid until Dec 2026', ok: true },
                      { name: 'Vehicle Registration Certificate (RC)', status: 'Verified & Active', ok: true },
                      { name: 'Motorcycle Driver License (Class M)', status: 'Verified & Active', ok: true },
                      { name: 'Pollution Under Control (PUC)', status: 'Valid until Oct 2026', ok: true },
                    ].map((doc, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 border rounded-xl flex items-center justify-between ${
                          isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-sky-500" />
                          <div>
                            <span className={`font-bold block ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{doc.name}</span>
                            <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{doc.status}</span>
                          </div>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 3: EARNINGS & PAYOUTS ================= */}
            {activeTab === 'earnings' && (
              <div className="space-y-3">
                {/* Hero Card */}
                <div className={`border rounded-2xl p-4 space-y-3 ${
                  isLight
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-gradient-to-tr from-amber-900/60 to-yellow-900/40 border-amber-500/30 text-white'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold ${isLight ? 'text-amber-900' : 'text-amber-300'}`}>Weekly Net Payout</span>
                    <DollarSign className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <span className={`text-3xl font-black ${isLight ? 'text-amber-950' : 'text-white'}`}>
                      ₹{(todayEarnings + 438.2).toFixed(2)}
                    </span>
                    <span className={`text-[11px] block mt-0.5 ${isLight ? 'text-amber-800' : 'text-amber-300/80'}`}>
                      Next direct deposit scheduled for Tuesday
                    </span>
                  </div>
                </div>

                {/* Breakdown */}
                <div className={`border rounded-2xl p-3.5 space-y-2 ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-900/80 border-slate-800 text-slate-300'
                }`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Today's Shift Statistics
                  </span>
                  <div className="space-y-1.5">
                    <div className={`flex justify-between border-b pb-1.5 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                      <span>Base Fare & Distance</span>
                      <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>₹{(todayEarnings * 0.85).toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between border-b pb-1.5 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                      <span>Surge & Bonus Pricing</span>
                      <span className="font-bold text-amber-500">₹{(todayEarnings * 0.15).toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between border-b pb-1.5 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                      <span>Completed Trips</span>
                      <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{completedCount} rides</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="font-bold text-emerald-500">Total Net Driver Earnings</span>
                      <span className="font-black text-emerald-500">₹{todayEarnings.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Linked Bank for Payout */}
                <div className={`border rounded-2xl p-3.5 space-y-2 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
                }`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Direct Payout Account
                  </span>
                  <div className={`p-2.5 border rounded-xl flex items-center justify-between ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <Building2 className="w-4 h-4 text-sky-500" />
                      <div>
                        <span className={`font-bold block ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>HDFC Bank Account (••• 8912)</span>
                        <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>IFSC #••••0021 · Instant UPI / IMPS</span>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      isLight ? 'bg-slate-200 text-slate-800' : 'bg-slate-800 text-slate-300'
                    }`}>
                      Primary
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 4: SHIFT SETTINGS & DISPLAY ================= */}
            {activeTab === 'preferences' && (
              <div className="space-y-3.5">
                {/* Visual Theme Section */}
                <div className={`border rounded-2xl p-3.5 space-y-3 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      App Theme & Display Mode
                    </span>
                    <span className="text-[10px] text-amber-500 font-bold">
                      {isLight ? 'Light Mode Active' : 'Dark Mode Active'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Light Mode Selector Card */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!isLight) toggleTheme();
                        setSavedSuccess(true);
                        setTimeout(() => setSavedSuccess(false), 2000);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isLight
                          ? 'bg-white border-amber-500 shadow-md ring-2 ring-amber-400/30'
                          : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                          <Sun className="w-4 h-4" />
                        </div>
                        {isLight && (
                          <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div>
                        <span className={`font-black text-xs block ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                          Light Mode
                        </span>
                        <span className={`text-[10px] leading-tight block mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Clean daylight UI for bright outdoor riding
                        </span>
                      </div>
                    </button>

                    {/* Dark Mode Selector Card */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isLight) toggleTheme();
                        setSavedSuccess(true);
                        setTimeout(() => setSavedSuccess(false), 2000);
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        !isLight
                          ? 'bg-slate-900 border-amber-500 shadow-md ring-2 ring-amber-400/30'
                          : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-xl bg-slate-800 text-amber-400">
                          <Moon className="w-4 h-4" />
                        </div>
                        {!isLight && (
                          <div className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div>
                        <span className={`font-black text-xs block ${!isLight ? 'text-slate-100' : 'text-slate-800'}`}>
                          Dark Mode
                        </span>
                        <span className={`text-[10px] leading-tight block mt-0.5 ${!isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          High-contrast OLED night mode for reduced glare
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Dispatch & Shift Controls */}
                <div className={`border rounded-2xl p-3.5 space-y-3 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Dispatch & Radar Preferences
                  </span>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`font-bold block ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Auto-Accept Next Trip</span>
                      <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Automatically lock in nearby broadcasts</span>
                    </div>
                    <button
                      onClick={() => setAutoAccept(!autoAccept)}
                      className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                        autoAccept ? 'bg-amber-500' : isLight ? 'bg-slate-300' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          autoAccept ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className={`w-full h-px ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`font-bold block ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Surge-Only Notifications</span>
                      <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Only sound alert for 1.3x+ surge pricing</span>
                    </div>
                    <button
                      onClick={() => setSurgeOnly(!surgeOnly)}
                      className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                        surgeOnly ? 'bg-amber-500' : isLight ? 'bg-slate-300' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          surgeOnly ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className={`w-full h-px ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Max Pickup Radar Radius</span>
                      <span className="font-bold text-amber-500">{maxRadiusKm} km</span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="30"
                      value={maxRadiusKm}
                      onChange={(e) => setMaxRadiusKm(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 5: CHECKLIST ================= */}
            {activeTab === 'checklist' && (
              <div className="space-y-3">
                <div className={`p-3 border rounded-2xl space-y-1 ${
                  isLight ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-slate-900 border-slate-800'
                }`}>
                  <div className="flex items-center gap-2 text-amber-500 font-bold">
                    <Shield className="w-4 h-4" />
                    <span>Daily Captain Safety Protocol</span>
                  </div>
                  <p className={`text-[11px] ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                    Ensure all equipment and motorcycle systems are operating safely before taking rides.
                  </p>
                </div>

                <div className={`border rounded-2xl p-3.5 space-y-2 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}>
                  {[
                    { key: 'helmetSanitized' as const, label: 'Driver helmet sanitized & visor clean' },
                    { key: 'passengerHelmetReady' as const, label: 'Extra passenger safety helmet clean & ready' },
                    { key: 'brakesWorking' as const, label: 'Front & rear hydraulic brakes tested' },
                    { key: 'tiresChecked' as const, label: 'Tire air pressure & tread depth checked' },
                    { key: 'fuelSufficient' as const, label: 'Adequate battery / fuel for continuous trips' },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleChecklistItem(item.key)}
                      className={`w-full p-2.5 border rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                        isLight
                          ? 'bg-white hover:border-amber-400 border-slate-200 shadow-2xs'
                          : 'bg-slate-950 border-slate-800 hover:border-amber-500/50'
                      }`}
                    >
                      <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{item.label}</span>
                      <div
                        className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${
                          checklist[item.key]
                            ? 'bg-emerald-500 text-slate-950'
                            : isLight ? 'bg-slate-200 text-slate-400' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`p-3 border-t flex justify-end ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#0b0f19] border-slate-800'
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
