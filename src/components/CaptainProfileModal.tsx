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
} from 'lucide-react';
import { UserProfile } from '../types/ride';
import { AvatarUploader } from './AvatarUploader';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#07090e] border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 bg-[#0b0f19] border-b border-slate-800 flex items-center justify-between">
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
                <h3 className="text-base font-black text-slate-100">{captain.name}</h3>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                  Top Captain ★
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span className="text-amber-300 font-bold flex items-center">
                  ★ {captain.rating || 4.96}
                </span>
                <span>·</span>
                <span>1,248 Lifetime Rides</span>
                <span>·</span>
                <span className="text-emerald-400 font-bold">98% Acceptance</span>
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
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Performance & Info
          </button>
          <button
            onClick={() => setActiveTab('vehicle')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'vehicle'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Bike & Docs
          </button>
          <button
            onClick={() => setActiveTab('earnings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'earnings'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Earnings & Payouts
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'preferences'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Shift Settings
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'checklist'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pre-Trip Safety
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs text-slate-300">
          {savedSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Captain profile updated successfully!</span>
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
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Rating</span>
                  <span className="text-lg font-black text-amber-300 block">★ {captain.rating || 4.96}</span>
                  <span className="text-[9px] text-slate-500">Based on 280 rides</span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Acceptance</span>
                  <span className="text-lg font-black text-emerald-400 block">98.4%</span>
                  <span className="text-[9px] text-slate-500">Tier 1 status</span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Cancel Rate</span>
                  <span className="text-lg font-black text-sky-400 block">0.8%</span>
                  <span className="text-[9px] text-slate-500">Low & healthy</span>
                </div>
              </div>

              {!isEditing ? (
                <div className="space-y-3">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Captain Name</span>
                      <span className="font-bold text-slate-100">{captain.name}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Phone Number</span>
                      <span className="font-bold text-slate-100">{captain.phone}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Driver Email</span>
                      <span className="font-bold text-slate-100">{email}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-slate-400">Assigned Vehicle</span>
                      <span className="font-bold text-amber-300">{vehicleDetails}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Registration Plate</span>
                      <span className="font-mono font-bold text-slate-200">{licensePlate}</span>
                    </div>
                  </div>

                  {/* Rider Compliments Badges */}
                  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Customer Compliments & Badges (148)
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-400" />
                        <div>
                          <span className="font-bold text-slate-200 block">Smooth Rider</span>
                          <span className="text-[10px] text-slate-400">64 compliments</span>
                        </div>
                      </div>
                      <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        <div>
                          <span className="font-bold text-slate-200 block">Clean Helmet</span>
                          <span className="text-[10px] text-slate-400">52 compliments</span>
                        </div>
                      </div>
                      <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center gap-2">
                        <Clock className="w-4 h-4 text-sky-400" />
                        <div>
                          <span className="font-bold text-slate-200 block">Quick Navigation</span>
                          <span className="text-[10px] text-slate-400">32 compliments</span>
                        </div>
                      </div>
                      <div className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center gap-2">
                        <Zap className="w-4 h-4 text-purple-400" />
                        <div>
                          <span className="font-bold text-slate-200 block">Great Energy</span>
                          <span className="text-[10px] text-slate-400">20 compliments</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer"
                  >
                    Edit Driver Profile
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400">Captain Full Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400">Phone Number</label>
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400">Driver Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400">Vehicle Make & Model</label>
                    <input
                      type="text"
                      required
                      value={vehicleDetails}
                      onChange={(e) => setVehicleDetails(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400">License Plate Number</label>
                    <input
                      type="text"
                      required
                      value={licensePlate}
                      onChange={(e) => setLicensePlate(e.target.value)}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 focus:outline-none focus:border-amber-500"
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
                      className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl shadow-md cursor-pointer"
                    >
                      Save Profile
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ================= TAB 2: VEHICLE & DOCUMENTS ================= */}
          {activeTab === 'vehicle' && (
            <div className="space-y-3">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                    <Bike className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-slate-100">{vehicleDetails}</h4>
                    <p className="text-[11px] text-slate-400">Plate: {licensePlate} · 2-Seater Commuter</p>
                  </div>
                </div>
              </div>

              {/* Verified Documents */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Driver Compliance & Verification
                </span>
                <div className="space-y-1.5">
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="font-bold text-slate-200 block">Class M Driver License</span>
                        <span className="text-[10px] text-slate-500">Valid until Oct 2028</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                      Verified
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="font-bold text-slate-200 block">Commercial RideShare Insurance</span>
                        <span className="text-[10px] text-slate-500">Policy #MR-9921-ACTIVE</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                      Active
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="font-bold text-slate-200 block">Helmet & Vehicle Annual Inspection</span>
                        <span className="text-[10px] text-slate-500">Passed DOT Safety Standards</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                      Approved
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: EARNINGS & PAYOUTS ================= */}
          {activeTab === 'earnings' && (
            <div className="space-y-3">
              <div className="bg-gradient-to-tr from-amber-950/60 to-slate-900 border border-amber-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-amber-300 font-semibold">Weekly Net Payout</span>
                  <DollarSign className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <span className="text-3xl font-black text-white">
                    ${(todayEarnings + 438.2).toFixed(2)}
                  </span>
                  <span className="text-[11px] text-amber-300/80 block mt-0.5">
                    Next direct deposit scheduled for Tuesday
                  </span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Today's Shift Statistics
                </span>
                <div className="space-y-1.5 text-slate-300">
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span>Base Fare & Distance</span>
                    <span className="font-bold text-slate-100">${(todayEarnings * 0.85).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span>Surge & Bonus Pricing</span>
                    <span className="font-bold text-amber-300">${(todayEarnings * 0.15).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-1.5">
                    <span>Completed Trips</span>
                    <span className="font-bold text-slate-100">{completedCount} rides</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="font-bold text-emerald-400">Total Net Driver Earnings</span>
                    <span className="font-black text-emerald-400">${todayEarnings.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Linked Bank for Payout */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Direct Payout Account
                </span>
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="w-4 h-4 text-sky-400" />
                    <div>
                      <span className="font-bold text-slate-200 block">Chase Bank Checking (••• 8912)</span>
                      <span className="text-[10px] text-slate-500">Routing #••••0021 · Direct Deposit</span>
                    </div>
                  </div>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold">
                    Primary
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 4: PREFERENCES ================= */}
          {activeTab === 'preferences' && (
            <div className="space-y-3">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Auto-Accept Next Trip</span>
                    <span className="text-[10px] text-slate-400">Automatically lock in nearby broadcasts</span>
                  </div>
                  <button
                    onClick={() => setAutoAccept(!autoAccept)}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                      autoAccept ? 'bg-amber-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        autoAccept ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="w-full h-px bg-slate-800" />

                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 block">Surge-Only Notifications</span>
                    <span className="text-[10px] text-slate-400">Only sound alert for 1.3x+ surge pricing</span>
                  </div>
                  <button
                    onClick={() => setSurgeOnly(!surgeOnly)}
                    className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                      surgeOnly ? 'bg-amber-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        surgeOnly ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="w-full h-px bg-slate-800" />

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-200">Max Pickup Radius</span>
                    <span className="font-bold text-amber-400">{maxRadiusKm} km</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="30"
                    value={maxRadiusKm}
                    onChange={(e) => setMaxRadiusKm(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 5: CHECKLIST ================= */}
          {activeTab === 'checklist' && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <Shield className="w-4 h-4" />
                  <span>Daily Captain Safety Protocol</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Ensure all equipment and motorcycle systems are operating safely before taking rides.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2">
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
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer"
                  >
                    <span className="text-slate-200 font-medium">{item.label}</span>
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${
                        checklist[item.key]
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-500'
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
        <div className="p-3 bg-[#0b0f19] border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition-colors cursor-pointer"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
