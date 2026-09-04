import React, { useState, useEffect, useRef } from 'react';
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
  Upload,
  ShieldCheck,
  FileCheck,
  Trash2,
  RefreshCw,
  ExternalLink,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react';
import { UserProfile, Ride } from '../types/ride';
import { AvatarUploader } from './AvatarUploader';
import { useTheme } from '../context/ThemeContext';
import { playSweetAlertTune, unlockAudio } from '../utils/audioAlert';

interface CaptainProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  captain: UserProfile;
  onUpdateCaptain: (updated: Partial<UserProfile>) => void;
  todayEarnings?: number;
  completedCount?: number;
  todayIncome?: number;
  totalEarnings?: number;
  todayRides?: Ride[];
  initialTab?: 'profile' | 'vehicle' | 'earnings' | 'preferences' | 'checklist';
}

export const CaptainProfileModal: React.FC<CaptainProfileModalProps> = ({
  isOpen,
  onClose,
  captain,
  onUpdateCaptain,
  todayEarnings = 0,
  completedCount = 0,
  todayIncome,
  totalEarnings = 0,
  todayRides = [],
  initialTab,
}) => {
  const currentTodayIncome = todayIncome !== undefined ? todayIncome : todayEarnings;
  const currentCompletedCount = completedCount;
  const { isLight, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'profile' | 'vehicle' | 'earnings' | 'preferences' | 'checklist'>(
    initialTab || 'profile'
  );
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(captain.name || '');
  const [phone, setPhone] = useState(captain.phone || '');
  const [email, setEmail] = useState(captain.email || 'alex.rivera.driver@motoride.com');
  const [vehicleDetails, setVehicleDetails] = useState(
    captain.vehicle_details || 'Yamaha MT-07 · Stealth Black #DL-01-AB-7492'
  );
  const [licensePlate, setLicensePlate] = useState('DL-01-AB-7492');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savedSuccessMessage, setSavedSuccessMessage] = useState('Profile changes saved successfully');

  // Dedicated Registered Bike Editing State
  const [isEditingBike, setIsEditingBike] = useState(false);
  const [bikeModel, setBikeModel] = useState('Yamaha MT-07');
  const [bikeColor, setBikeColor] = useState('Stealth Black');
  const [bikePlateInput, setBikePlateInput] = useState('DL-01-AB-7492');

  const syncVehicleFields = (vehStr: string) => {
    const safeStr = vehStr || '';
    setVehicleDetails(safeStr);
    if (safeStr.includes('#')) {
      const parts = safeStr.split('#');
      const plate = parts[1]?.trim() || '';
      setLicensePlate(plate);
      setBikePlateInput(plate);
      if (parts[0].includes('·')) {
        const sub = parts[0].split('·');
        setBikeModel(sub[0]?.trim() || '');
        setBikeColor(sub[1]?.trim() || '');
      } else {
        setBikeModel(parts[0]?.trim() || '');
      }
    } else if (safeStr.includes('·')) {
      const sub = safeStr.split('·');
      setBikeModel(sub[0]?.trim() || '');
      setBikeColor(sub[1]?.trim() || '');
    } else {
      setBikeModel(safeStr.trim());
    }
  };

  // Switch tab if initialTab provided on open
  useEffect(() => {
    if (initialTab && isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Synchronize state whenever captain prop updates (e.g. login, profile changes)
  useEffect(() => {
    if (captain) {
      setName(captain.name || '');
      setPhone(captain.phone || '');
      if (captain.email) {
        setEmail(captain.email);
      }
      if (captain.vehicle_details) {
        syncVehicleFields(captain.vehicle_details);
      }
    }
  }, [captain]);

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

  // RC Document State & Local Storage Persistence
  const rcFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingRc, setIsDraggingRc] = useState(false);
  const [isUploadingRc, setIsUploadingRc] = useState(false);
  const [rcUploadSuccess, setRcUploadSuccess] = useState(false);
  const [showRcUploadModal, setShowRcUploadModal] = useState(false);
  const [previewDocModal, setPreviewDocModal] = useState<boolean>(false);
  const [selectedDocToView, setSelectedDocToView] = useState<{ name: string; url?: string | null; rcNumber?: string } | null>(null);
  const [isEditingRcDetails, setIsEditingRcDetails] = useState(false);

  const [rcDoc, setRcDoc] = useState<{
    rcNumber: string;
    ownerName: string;
    chassisNumber: string;
    engineNumber: string;
    issueDate: string;
    expiryDate: string;
    fileName: string;
    fileSize: string;
    fileUrl: string | null;
    fileType: 'image' | 'pdf' | 'none';
    status: 'verified' | 'under_review' | 'pending';
    uploadedAt: string;
    notes?: string;
  }>(() => {
    const saved = localStorage.getItem(`motoride_captain_rc_${captain.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      rcNumber: 'CA 92K49-RC2024',
      ownerName: captain.name || 'Alex Rivera',
      chassisNumber: 'ME1RG122*N004920',
      engineNumber: 'G3J4E*009124',
      issueDate: '15 Mar 2022',
      expiryDate: '14 Mar 2037',
      fileName: 'vehicle_rc_yamaha_mt07.pdf',
      fileSize: '1.4 MB',
      fileUrl: null,
      fileType: 'pdf',
      status: 'verified',
      uploadedAt: '2026-08-10',
      notes: 'Smart OCR Match: Registration details match plate CA 92K49',
    };
  });

  const [editableRcFields, setEditableRcFields] = useState({
    rcNumber: rcDoc?.rcNumber || '',
    ownerName: rcDoc?.ownerName || '',
    chassisNumber: rcDoc?.chassisNumber || '',
    engineNumber: rcDoc?.engineNumber || '',
    expiryDate: rcDoc?.expiryDate || '',
  });

  // Save RC to localStorage whenever updated
  const updateRcDocState = (updated: Partial<typeof rcDoc>) => {
    setRcDoc((prev) => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem(`motoride_captain_rc_${captain.id}`, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Handle file processing for RC upload
  const processRcFile = (file: File) => {
    if (!file) return;
    setIsUploadingRc(true);
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    const isImg = file.type.startsWith('image/');
    const formattedSize = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    const reader = new FileReader();
    reader.onload = () => {
      setTimeout(() => {
        const resultUrl = reader.result as string;
        updateRcDocState({
          fileName: file.name,
          fileSize: formattedSize,
          fileUrl: resultUrl,
          fileType: isPdf ? 'pdf' : isImg ? 'image' : 'none',
          status: 'verified',
          uploadedAt: new Date().toISOString().split('T')[0],
          notes: `Uploaded on ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · OCR Verified`,
        });
        setIsUploadingRc(false);
        setRcUploadSuccess(true);
        setTimeout(() => setRcUploadSuccess(false), 3000);
      }, 700);
    };

    reader.onerror = () => {
      setIsUploadingRc(false);
    };

    reader.readAsDataURL(file);
  };

  const handleRcFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processRcFile(file);
    }
  };

  const handleRcDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingRc(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processRcFile(file);
    }
  };

  const handleRemoveRcDoc = () => {
    updateRcDocState({
      fileName: '',
      fileSize: '',
      fileUrl: null,
      fileType: 'none',
      status: 'pending',
      uploadedAt: '',
      notes: 'No certificate uploaded',
    });
  };

  const handleSaveRcDetails = (e: React.FormEvent) => {
    e.preventDefault();
    updateRcDocState({
      rcNumber: editableRcFields.rcNumber,
      ownerName: editableRcFields.ownerName,
      chassisNumber: editableRcFields.chassisNumber,
      engineNumber: editableRcFields.engineNumber,
      expiryDate: editableRcFields.expiryDate,
    });
    setIsEditingRcDetails(false);
  };

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const finalVehicle = vehicleDetails.trim();
    onUpdateCaptain({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      vehicle_details: finalVehicle,
    });
    syncVehicleFields(finalVehicle);
    setIsEditing(false);
    setSavedSuccessMessage('Captain profile and registered bike updated successfully!');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleSaveBike = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalModel = bikeModel.trim() || 'Yamaha MT-07';
    const finalColor = bikeColor.trim() || 'Stealth Black';
    const finalPlate = (bikePlateInput.trim() || licensePlate || 'DL-01-AB-7492').toUpperCase();
    const newVehicleDetails = `${finalModel} · ${finalColor} #${finalPlate}`;

    setVehicleDetails(newVehicleDetails);
    setLicensePlate(finalPlate);
    setRcDoc((prev) => ({
      ...prev,
      rcNumber: finalPlate,
      updatedAt: new Date().toISOString(),
    }));

    onUpdateCaptain({
      vehicle_details: newVehicleDetails,
    });

    setIsEditingBike(false);
    setSavedSuccessMessage(`Registered bike updated to ${finalModel}!`);
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
                <span className="font-semibold">{savedSuccessMessage}</span>
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
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-500">{vehicleDetails}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('vehicle');
                              setIsEditingBike(true);
                            }}
                            className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 cursor-pointer"
                          >
                            Change Bike →
                          </button>
                        </div>
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
                        value={name || ''}
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
                        value={phone || ''}
                        onChange={(e) => setPhone(e.target.value)}
                        className={`w-full p-2.5 border rounded-xl focus:outline-none focus:border-amber-500 ${
                          isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                        }`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={`text-[11px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Driver Email ID</label>
                      <input
                        type="email"
                        required
                        value={email || ''}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full p-2.5 border rounded-xl focus:outline-none focus:border-amber-500 ${
                          isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                        }`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={`text-[11px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                        Registered Bike Details
                      </label>
                      <input
                        type="text"
                        required
                        value={vehicleDetails || ''}
                        onChange={(e) => setVehicleDetails(e.target.value)}
                        placeholder="e.g. Yamaha MT-07 · Stealth Black #DL-01-AB-7492"
                        className={`w-full p-2.5 border rounded-xl focus:outline-none focus:border-amber-500 ${
                          isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                        }`}
                      />
                      <div className="flex flex-wrap gap-1 pt-1">
                        {[
                          'Yamaha MT-07 · Stealth Black',
                          'Royal Enfield Classic 350',
                          'KTM 390 Duke · Orange',
                          'Honda CB300R · Gray',
                          'Ather 450X EV Moto',
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setVehicleDetails(`${preset} #${licensePlate}`)}
                            className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                              vehicleDetails.startsWith(preset)
                                ? 'bg-amber-500/20 text-amber-600 border-amber-500/40 font-bold'
                                : isLight
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700'
                            }`}
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
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
              <div className="space-y-4">
                {/* Bike Summary Card with Inline Change Bike capability */}
                <div className={`border rounded-2xl p-3.5 space-y-3 ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-900/80 border-slate-800 text-slate-200'
                }`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                        <Bike className="w-4 h-4" />
                      </div>
                      <div>
                        <span className={`font-black text-sm block ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{vehicleDetails}</span>
                        <span className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Plate: {licensePlate}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-500 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Certified Fleet
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditingBike(!isEditingBike)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                          isLight
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                            : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {isEditingBike ? 'Close' : 'Change Bike'}
                      </button>
                    </div>
                  </div>

                  {/* Inline Bike Editor */}
                  {isEditingBike && (
                    <form onSubmit={handleSaveBike} className="mt-3 pt-3 border-t border-dashed border-slate-300 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                        Update Registered Bike Details
                      </div>

                      {/* Quick Presets */}
                      <div>
                        <label className={`text-[10px] font-bold block mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Quick Fleet Presets:
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { m: 'Yamaha MT-07', c: 'Stealth Black', p: 'DL-01-AB-7492' },
                            { m: 'Royal Enfield Classic 350', c: 'Gunmetal Grey', p: 'MH-02-CD-1902' },
                            { m: 'KTM 390 Duke', c: 'Electric Orange', p: 'KA-05-KT-3900' },
                            { m: 'Honda CB300R', c: 'Matte Axis Gray', p: 'DL-04-XY-8821' },
                            { m: 'Kawasaki Ninja 400', c: 'Lime Green', p: 'TN-09-NJ-4004' },
                            { m: 'Ather 450X EV Moto', c: 'Space Grey', p: 'KA-01-EV-2024' },
                          ].map((preset) => (
                            <button
                              key={preset.m}
                              type="button"
                              onClick={() => {
                                setBikeModel(preset.m);
                                setBikeColor(preset.c);
                                setBikePlateInput(preset.p);
                              }}
                              className={`text-[10px] px-2 py-1 rounded-md border font-semibold transition-colors cursor-pointer ${
                                bikeModel === preset.m
                                  ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                                  : isLight
                                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                              }`}
                            >
                              {preset.m}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="space-y-1">
                          <label className={`text-[11px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                            Make & Model
                          </label>
                          <input
                            type="text"
                            required
                            value={bikeModel || ''}
                            onChange={(e) => setBikeModel(e.target.value)}
                            placeholder="e.g. Yamaha MT-07"
                            className={`w-full p-2 border rounded-xl focus:outline-none focus:border-amber-500 ${
                              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                            }`}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className={`text-[11px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                            Color / Variant
                          </label>
                          <input
                            type="text"
                            required
                            value={bikeColor || ''}
                            onChange={(e) => setBikeColor(e.target.value)}
                            placeholder="e.g. Stealth Black"
                            className={`w-full p-2 border rounded-xl focus:outline-none focus:border-amber-500 ${
                              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className={`text-[11px] font-bold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                          License Plate Number
                        </label>
                        <input
                          type="text"
                          required
                          value={bikePlateInput || ''}
                          onChange={(e) => setBikePlateInput(e.target.value.toUpperCase())}
                          placeholder="e.g. DL-01-AB-7492"
                          className={`w-full p-2 font-mono font-bold uppercase border rounded-xl focus:outline-none focus:border-amber-500 ${
                            isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                          }`}
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditingBike(false)}
                          className={`flex-1 py-2 font-bold rounded-xl border text-xs ${
                            isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Save Registered Bike
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* ================= RC UPLOAD HERO SECTION ================= */}
                <div
                  id="rc-upload-section"
                  className={`border-2 rounded-2xl p-4 space-y-3 transition-all ${
                    isDraggingRc
                      ? 'border-amber-500 bg-amber-500/10'
                      : isLight
                      ? 'bg-white border-amber-300/80 shadow-xs'
                      : 'bg-gradient-to-b from-slate-900 to-slate-950 border-amber-500/30 shadow-md'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingRc(true);
                  }}
                  onDragLeave={() => setIsDraggingRc(false)}
                  onDrop={handleRcDrop}
                >
                  {/* RC Section Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
                        <FileCheck className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className={`font-black text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            Vehicle Registration Certificate (RC)
                          </h3>
                        </div>
                        <span className={`text-[11px] block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Official proof of bike ownership & road fitness
                        </span>
                      </div>
                    </div>

                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 flex items-center gap-1 ${
                      rcDoc.status === 'verified'
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : rcDoc.status === 'under_review'
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                    }`}>
                      {rcDoc.status === 'verified' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Verified & Active
                        </>
                      ) : rcDoc.status === 'under_review' ? (
                        <>
                          <Clock className="w-3 h-3" /> Under Review
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3 h-3" /> Upload Needed
                        </>
                      )}
                    </span>
                  </div>

                  {/* RC Info Metadata Chips */}
                  <div className={`p-3 rounded-xl border text-xs space-y-2 ${
                    isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>RC Number:</span>
                      <span className="font-mono font-black text-amber-600 dark:text-amber-400">{rcDoc.rcNumber}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Registered Owner:</span>
                      <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{rcDoc.ownerName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Chassis / Engine:</span>
                      <span className={`font-mono text-[11px] ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {rcDoc.chassisNumber}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-1.5 border-dashed border-slate-300 dark:border-slate-800">
                      <span className={`text-[11px] font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Fitness Valid Until:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{rcDoc.expiryDate}</span>
                    </div>
                  </div>

                  {/* Hidden File Input for RC */}
                  <input
                    ref={rcFileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleRcFileSelect}
                    className="hidden"
                    id="rc-file-input"
                  />

                  {/* Upload Success Alert */}
                  {rcUploadSuccess && (
                    <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Registration Certificate (RC) uploaded & verified successfully!</span>
                    </div>
                  )}

                  {/* Loading State during Upload / OCR */}
                  {isUploadingRc ? (
                    <div className="p-6 border-2 border-dashed border-amber-500 rounded-xl flex flex-col items-center justify-center space-y-2 bg-amber-500/10">
                      <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
                      <span className="text-xs font-bold text-amber-500">Scanning & Validating RC Document...</span>
                      <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Running Smart OCR & plate match checks</span>
                    </div>
                  ) : rcDoc.fileName ? (
                    /* Active Uploaded Document Card */
                    <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isLight ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-900 border-amber-500/20'
                    }`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        {rcDoc.fileUrl && rcDoc.fileType === 'image' ? (
                          <img
                            src={rcDoc.fileUrl}
                            alt="RC Preview"
                            className="w-10 h-10 object-cover rounded-lg border border-amber-400 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-rose-500/20 text-rose-500 border border-rose-500/30 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className={`text-xs font-bold truncate block ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                            {rcDoc.fileName}
                          </span>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                            <span>{rcDoc.fileSize}</span>
                            <span>•</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">OCR Verified</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons for Uploaded RC */}
                      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => setPreviewDocModal(true)}
                          className={`p-2 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                            isLight
                              ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                          }`}
                          title="View RC Preview"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden xs:inline">Preview</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => rcFileInputRef.current?.click()}
                          className={`p-2 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                            isLight
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                              : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30'
                          }`}
                          title="Replace RC Document"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span className="hidden xs:inline">Replace</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRemoveRcDoc}
                          className="p-2 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs transition-colors cursor-pointer"
                          title="Remove Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Dropzone / Upload Action Trigger when empty */
                    <div
                      onClick={() => rcFileInputRef.current?.click()}
                      className={`p-5 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center space-y-2 cursor-pointer transition-all ${
                        isLight
                          ? 'border-amber-300 bg-amber-50/50 hover:bg-amber-50'
                          : 'border-amber-500/40 bg-amber-950/10 hover:bg-amber-950/20'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <span className={`text-xs font-bold block ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                          Click to upload or drag and drop RC certificate
                        </span>
                        <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          Supports PNG, JPG, WEBP or PDF (Max 10MB)
                        </span>
                      </div>
                      <button
                        type="button"
                        className="mt-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg shadow-sm cursor-pointer"
                      >
                        Select RC File
                      </button>
                    </div>
                  )}

                  {/* Quick Upload Buttons (Camera / Scan / File) */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => rcFileInputRef.current?.click()}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5 text-amber-500" />
                      <span>Take Photo / Scan RC</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => rcFileInputRef.current?.click()}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Upload Digital RC File</span>
                    </button>
                  </div>

                  {/* RC Details Edit Toggle */}
                  <div className="pt-1 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsEditingRcDetails(!isEditingRcDetails)}
                      className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>{isEditingRcDetails ? 'Hide RC Manual Fields' : 'Edit RC Registration Details Manually'}</span>
                    </button>

                    {isEditingRcDetails && (
                      <form onSubmit={handleSaveRcDetails} className="mt-2.5 space-y-2 animate-in fade-in">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={`text-[10px] font-bold block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>RC Number</label>
                            <input
                              type="text"
                              value={editableRcFields.rcNumber || ''}
                              onChange={(e) => setEditableRcFields({ ...editableRcFields, rcNumber: e.target.value })}
                              className={`w-full p-2 text-xs border rounded-lg ${
                                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                              }`}
                            />
                          </div>
                          <div>
                            <label className={`text-[10px] font-bold block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Owner Name</label>
                            <input
                              type="text"
                              value={editableRcFields.ownerName || ''}
                              onChange={(e) => setEditableRcFields({ ...editableRcFields, ownerName: e.target.value })}
                              className={`w-full p-2 text-xs border rounded-lg ${
                                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                              }`}
                            />
                          </div>
                          <div>
                            <label className={`text-[10px] font-bold block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Chassis Number</label>
                            <input
                              type="text"
                              value={editableRcFields.chassisNumber || ''}
                              onChange={(e) => setEditableRcFields({ ...editableRcFields, chassisNumber: e.target.value })}
                              className={`w-full p-2 text-xs border rounded-lg ${
                                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                              }`}
                            />
                          </div>
                          <div>
                            <label className={`text-[10px] font-bold block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Fitness Expiry</label>
                            <input
                              type="text"
                              value={editableRcFields.expiryDate || ''}
                              onChange={(e) => setEditableRcFields({ ...editableRcFields, expiryDate: e.target.value })}
                              className={`w-full p-2 text-xs border rounded-lg ${
                                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-slate-100'
                              }`}
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg cursor-pointer"
                        >
                          Save RC Details
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* Other Vehicle Compliance Documents Vault */}
                <div className={`border rounded-2xl p-3.5 space-y-2.5 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'
                }`}>
                  <span className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Other Compliance Documents
                  </span>

                  <div className="space-y-2">
                    {[
                      { name: 'Commercial Two-Wheeler Insurance', status: 'Valid until Dec 2026', ok: true },
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
                            <span className={`font-bold text-xs block ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{doc.name}</span>
                            <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{doc.status}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDocToView({ name: doc.name });
                              setPreviewDocModal(true);
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors cursor-pointer ${
                              isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            View
                          </button>
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 3: EARNINGS & PAYOUTS ================= */}
            {activeTab === 'earnings' && (
              <div className="space-y-3">
                {/* Hero Card: Today's Income */}
                <div className={`border rounded-2xl p-4 space-y-2.5 ${
                  isLight
                    ? 'bg-gradient-to-br from-amber-50 to-emerald-50/60 border-amber-200 text-amber-950 shadow-sm'
                    : 'bg-gradient-to-tr from-amber-950/60 to-emerald-950/40 border-amber-500/30 text-white'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-black uppercase tracking-wider ${isLight ? 'text-amber-900' : 'text-amber-300'}`}>
                        Today's Income
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isLight ? 'bg-amber-200/80 text-amber-900' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <span className={`text-3xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      ₹{currentTodayIncome.toFixed(2)}
                    </span>
                    <span className={`text-[11px] block mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      {currentCompletedCount === 0
                        ? 'No rides completed yet today · Resets automatically daily'
                        : `${currentCompletedCount} completed ride${currentCompletedCount === 1 ? '' : 's'} today`}
                    </span>
                  </div>
                </div>

                {/* Lifetime & Weekly Summary */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`p-3 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
                    <span className={`text-[10px] font-bold uppercase block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Weekly Net Payout
                    </span>
                    <span className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                      ₹{(currentTodayIncome + 438.2).toFixed(2)}
                    </span>
                  </div>
                  <div className={`p-3 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
                    <span className={`text-[10px] font-bold uppercase block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Total Lifetime
                    </span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      ₹{(totalEarnings > 0 ? totalEarnings : currentTodayIncome + 3240).toFixed(2)}
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
                  <div className="space-y-1.5 text-xs">
                    <div className={`flex justify-between border-b pb-1.5 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                      <span>Base Fare & Distance (Today)</span>
                      <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>₹{(currentTodayIncome * 0.85).toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between border-b pb-1.5 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                      <span>Surge & Bonus Pricing (Today)</span>
                      <span className="font-bold text-amber-500">₹{(currentTodayIncome * 0.15).toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between border-b pb-1.5 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                      <span>Completed Trips Today</span>
                      <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{currentCompletedCount} rides</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">Today's Income Total</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">₹{currentTodayIncome.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Today's Completed Rides List */}
                {todayRides && todayRides.length > 0 && (
                  <div className={`border rounded-2xl p-3.5 space-y-2 ${
                    isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-900/80 border-slate-800 text-slate-300'
                  }`}>
                    <span className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Today's Completed Trips ({todayRides.length})
                    </span>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {todayRides.map((ride) => (
                        <div
                          key={ride.id}
                          className={`p-2 rounded-xl border flex items-center justify-between text-xs ${
                            isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-bold truncate text-slate-900 dark:text-slate-100">
                              {ride.pickup_location.split(',')[0]} → {ride.dropoff_location.split(',')[0]}
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {ride.completed_at
                                ? new Date(ride.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : 'Completed today'}
                            </span>
                          </div>
                          <span className="font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                            +₹{Number(ride.fare || 0).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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

                  {/* Incoming Request Sweet Alert Tune */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`font-bold block ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>Incoming Request Alert Tune</span>
                      <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Play sweet 4-tone melodic chime for new broadcasts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {audioAlerts && (
                        <button
                          type="button"
                          onClick={() => {
                            unlockAudio();
                            playSweetAlertTune(true);
                          }}
                          className={`p-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                            isLight
                              ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                          }`}
                          title="Test melodic chime"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const next = !audioAlerts;
                          setAudioAlerts(next);
                          localStorage.setItem('motoride_captain_alert_sound', String(next));
                          if (next) {
                            unlockAudio();
                            playSweetAlertTune(true);
                          }
                        }}
                        className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                          audioAlerts ? 'bg-amber-500' : isLight ? 'bg-slate-300' : 'bg-slate-700'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                            audioAlerts ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
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
                      value={maxRadiusKm ?? 10}
                      onChange={(e) => setMaxRadiusKm(Number(e.target.value) || 10)}
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

      {/* ================= DOCUMENT PREVIEW MODAL ================= */}
      {previewDocModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className={`w-full max-w-lg rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}>
            {/* Modal Header */}
            <div className={`p-4 border-b flex items-center justify-between ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
            }`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-sm">
                    {selectedDocToView?.name || 'Vehicle Registration Certificate (RC)'}
                  </h4>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verified by Motoride Fleet Auth
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPreviewDocModal(false);
                  setSelectedDocToView(null);
                }}
                className={`p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer ${
                  isLight ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {rcDoc.fileUrl && rcDoc.fileType === 'image' && !selectedDocToView ? (
                /* Real User Uploaded Image */
                <div className="border rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center p-2">
                  <img
                    src={rcDoc.fileUrl}
                    alt="Vehicle RC Scan"
                    className="max-h-80 w-auto object-contain rounded-xl"
                  />
                </div>
              ) : (
                /* High-Fidelity Official Digital Certificate Card */
                <div className={`border-2 rounded-2xl p-5 relative overflow-hidden space-y-4 ${
                  isLight
                    ? 'bg-gradient-to-b from-amber-50/50 to-slate-50 border-amber-300/80 shadow-inner'
                    : 'bg-gradient-to-b from-slate-950 to-[#0d1322] border-amber-500/30'
                }`}>
                  {/* Watermark badge */}
                  <div className="absolute right-3 top-3 opacity-15 pointer-events-none">
                    <ShieldCheck className="w-32 h-32 text-amber-500" />
                  </div>

                  {/* Official Header */}
                  <div className="text-center border-b pb-3 border-amber-400/40">
                    <span className="text-[10px] uppercase font-black tracking-widest text-amber-600 dark:text-amber-400 block">
                      DEPARTMENT OF MOTOR VEHICLES & TRANSPORT
                    </span>
                    <h3 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                      CERTIFICATE OF REGISTRATION
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">FORM 23 · MOTOR VEHICLES ACT</span>
                  </div>

                  {/* Certificate Main Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Regn. Number (RC)</span>
                      <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm block">
                        {rcDoc.rcNumber}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Class of Vehicle</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">
                        MCWG (Motor Cycle with Gear)
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Registered Owner</span>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {rcDoc.ownerName}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Maker & Model</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">
                        {vehicleDetails}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Chassis No.</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 block">
                        {rcDoc.chassisNumber}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Engine No.</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 block">
                        {rcDoc.engineNumber}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Registration Date</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200 block">
                        {rcDoc.issueDate}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Fitness Valid Till</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                        {rcDoc.expiryDate}
                      </span>
                    </div>
                  </div>

                  {/* QR & Security Footer */}
                  <div className="pt-3 border-t border-dashed border-slate-300 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center p-1 border border-amber-400/40">
                        <div className="grid grid-cols-3 gap-0.5 w-full h-full p-1 bg-white rounded">
                          <div className="bg-black" />
                          <div className="bg-black" />
                          <div className="bg-transparent" />
                          <div className="bg-transparent" />
                          <div className="bg-black" />
                          <div className="bg-black" />
                          <div className="bg-black" />
                          <div className="bg-transparent" />
                          <div className="bg-black" />
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase block text-slate-500">DIGITAL SECURITY SEAL</span>
                        <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          ✓ QR AUTH CODE VERIFIED
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block">File: {rcDoc.fileName || 'e-RC_Copy.pdf'}</span>
                      <span className="text-[9px] text-slate-400 block">{rcDoc.fileSize || '1.4 MB'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className={`p-4 border-t flex items-center justify-between gap-2 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setPreviewDocModal(false);
                  rcFileInputRef.current?.click();
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isLight ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300' : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                }`}
              >
                <Upload className="w-3.5 h-3.5 text-amber-500" />
                <span>Upload Replacement RC</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewDocModal(false)}
                className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
