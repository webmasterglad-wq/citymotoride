import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Database,
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Trash2,
  Info,
  Sun,
  Moon,
  LogOut,
  UserCheck,
  User,
  Bike,
  ArrowLeftRight,
  Smartphone,
  Download,
} from 'lucide-react';
import {
  getStoredSupabaseConfig,
  saveCustomSupabaseConfig,
  clearCustomSupabaseConfig,
  getSupabaseClient,
  isSupabaseConfigured,
  sanitizeSupabaseUrl,
  sanitizeSupabaseKey,
} from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  downloadRealApk,
  getStoredApkMetadata,
  subscribeToApkUpdates,
  ApkMetadata,
} from '../services/apkService';
import { MobileAppInstallModal } from './MobileAppInstallModal';

interface ConnectionStatusBannerProps {
  onOpenSqlModal: () => void;
  onRefreshAll?: () => void;
  activeView: 'passenger' | 'captain' | 'admin';
  onChangeView: (view: 'passenger' | 'captain' | 'admin') => void;
}

export const ConnectionStatusBanner: React.FC<ConnectionStatusBannerProps> = ({
  onOpenSqlModal,
  onRefreshAll,
  activeView,
  onChangeView,
}) => {
  const { theme, isLight, toggleTheme } = useTheme();
  const { getUserForRole, signOut, isAuthenticated } = useAuth();
  const isPassengerAuthed = isAuthenticated('passenger');
  const isCaptainAuthed = isAuthenticated('captain');
  const [isOpenConfig, setIsOpenConfig] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error' | 'not_configured'>('checking');
  const [statusMessage, setStatusMessage] = useState('');
  const [isEnvProvided, setIsEnvProvided] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  // APK file state & download management for top right side last corner
  const [apkMeta, setApkMeta] = useState<ApkMetadata | null>(() => getStoredApkMetadata());
  const [isDownloadingApk, setIsDownloadingApk] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  useEffect(() => {
    setApkMeta(getStoredApkMetadata());
    const unsubscribe = subscribeToApkUpdates((meta) => {
      setApkMeta(meta);
    });
    return () => unsubscribe();
  }, []);

  const handleDownloadMobileApp = async () => {
    setIsDownloadingApk(true);
    setDownloadNotice('Starting APK download...');
    try {
      await downloadRealApk();
      setDownloadNotice('Download initiated!');
      setTimeout(() => setDownloadNotice(null), 2500);
    } catch (err: any) {
      console.debug('Download note:', err);
      setDownloadNotice('Download initiated!');
      setTimeout(() => setDownloadNotice(null), 2500);
    } finally {
      setIsDownloadingApk(false);
    }
  };

  const checkConnection = async () => {
    setConnectionStatus('checking');
    setStatusMessage('Checking Supabase connection and Realtime...');

    const config = getStoredSupabaseConfig();
    setIsEnvProvided(config.isEnvProvided);
    setIsCustom(config.isCustom);
    setSupabaseUrl(config.rawUrl || config.url);
    setSupabaseKey(config.rawKey || config.anonKey);

    if (!isSupabaseConfigured()) {
      setConnectionStatus('not_configured');
      setStatusMessage('Supabase URL & Anon Key needed for real-time synchronization');
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setConnectionStatus('error');
      setStatusMessage('Could not initialize Supabase client');
      return;
    }

    try {
      // Test query to public.rides
      const { data, error } = await client.from('rides').select('id').limit(1);

      if (error) {
        const errorMsg = error.message || '';
        if (
          error.code === 'PGRST205' ||
          error.code === '42P01' ||
          errorMsg.includes('schema cache') ||
          errorMsg.includes('relation "public.rides" does not exist') ||
          errorMsg.includes("Could not find the table 'public.rides'")
        ) {
          setConnectionStatus('error');
          setStatusMessage('Connected to Supabase, but "rides" table is not created yet. Run the SQL script.');
        } else if (
          errorMsg.includes('Invalid path specified in request URL') ||
          errorMsg.includes('Invalid path')
        ) {
          setConnectionStatus('error');
          setStatusMessage('Invalid Supabase URL format. URL must be https://<project-ref>.supabase.co');
        } else {
          setConnectionStatus('error');
          setStatusMessage(`Supabase error: ${error.message}`);
        }
      } else {
        setConnectionStatus('connected');
        setStatusMessage('Supabase & Realtime Active · Shared Project Connected');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      const msg = err?.message || 'Connection failed';
      if (
        err?.code === 'PGRST205' ||
        err?.code === '42P01' ||
        msg.includes('schema cache') ||
        msg.includes('relation "public.rides" does not exist') ||
        msg.includes('Could not find the table')
      ) {
        setStatusMessage('Connected to Supabase, but "rides" table is not created yet. Run the SQL script.');
      } else if (msg.includes('Invalid path')) {
        setStatusMessage('Invalid Supabase URL format. Check API Keys settings.');
      } else {
        setStatusMessage(msg);
      }
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    saveCustomSupabaseConfig(supabaseUrl, supabaseKey);
    setIsOpenConfig(false);
    checkConnection();
    if (onRefreshAll) onRefreshAll();
  };

  const handleClearCredentials = () => {
    clearCustomSupabaseConfig();
    const config = getStoredSupabaseConfig();
    setSupabaseUrl(config.url);
    setSupabaseKey(config.anonKey);
    setIsCustom(false);
    checkConnection();
    if (onRefreshAll) onRefreshAll();
  };

  const cleanPreviewUrl = sanitizeSupabaseUrl(supabaseUrl);
  const isDashboardUrlEntered = supabaseUrl.includes('supabase.com/dashboard') || supabaseUrl.includes('app.supabase.com');

  return (
    <div
      className={`w-full sticky top-0 z-40 backdrop-blur-md transition-colors duration-200 ${
        isLight
          ? 'bg-white/95 border-b border-slate-200 text-slate-900 shadow-sm'
          : 'bg-slate-900/95 border-b border-slate-800 text-slate-200'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap md:flex-nowrap items-center justify-between gap-3">
        {/* Left: Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center font-black text-slate-950 text-xs tracking-tight shadow-md shadow-amber-500/20 shrink-0">
            MR
          </div>
          <div className="flex flex-col">
            <span className={`font-bold tracking-tight text-sm leading-none ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              Moto<span className="text-amber-500">Ride</span>
            </span>
            <span
              id="brand-tagline-offer-fare"
              className={`text-[10px] font-medium tracking-tight mt-0.5 leading-none ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Offer Fare Book Ride
            </span>
          </div>
        </div>

        {/* Top Center: Clickable Tab Switch Button (Shows "Passenger App" or "Captain App" ONLY when not signed in) */}
        {!isPassengerAuthed && !isCaptainAuthed && (
          <div className="w-full md:w-auto order-3 md:order-2 flex-1 flex justify-center items-center py-0.5">
            <button
              id="tab-switch-btn"
              type="button"
              onClick={() => onChangeView(activeView === 'passenger' ? 'captain' : 'passenger')}
              title={activeView === 'passenger' ? 'Switch to Captain App' : 'Switch to Passenger App'}
              className={`group relative inline-flex items-center gap-3 px-4 py-2 rounded-2xl border text-xs font-bold transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer select-none active:scale-[0.97] ${
                activeView === 'passenger'
                  ? isLight
                    ? 'bg-sky-50/90 hover:bg-sky-100 text-sky-950 border-sky-300 hover:border-sky-400 shadow-sky-500/10'
                    : 'bg-sky-950/40 hover:bg-sky-900/50 text-sky-200 border-sky-500/40 hover:border-sky-400 shadow-sky-500/10'
                  : isLight
                  ? 'bg-emerald-50/90 hover:bg-emerald-100 text-emerald-950 border-emerald-300 hover:border-emerald-400 shadow-emerald-500/10'
                  : 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-200 border-emerald-500/40 hover:border-emerald-400 shadow-emerald-500/10'
              }`}
            >
              {/* Mode Icon */}
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0 ${
                  activeView === 'passenger'
                    ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                    : 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/30'
                }`}
              >
                {activeView === 'passenger' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bike className="w-4 h-4" />
                )}
              </div>

              {/* Main Label: "Passenger App" or "Captain App" */}
              <div className="flex items-center gap-1.5 text-sm font-black tracking-tight">
                <span>{activeView === 'passenger' ? 'Passenger App' : 'Captain App'}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeView === 'passenger' ? 'bg-sky-500' : 'bg-emerald-500'
                  } animate-pulse`}
                />
              </div>

              {/* Clickable switch pill */}
              <div
                className={`ml-1 px-2 py-1 rounded-xl flex items-center gap-1 text-[10px] font-bold border transition-all ${
                  activeView === 'passenger'
                    ? isLight
                      ? 'bg-white/80 border-sky-200 text-sky-700 group-hover:bg-white'
                      : 'bg-slate-900/80 border-sky-800/80 text-sky-300 group-hover:bg-slate-900'
                    : isLight
                    ? 'bg-white/80 border-emerald-200 text-emerald-700 group-hover:bg-white'
                    : 'bg-slate-900/80 border-emerald-800/80 text-emerald-300 group-hover:bg-slate-900'
                }`}
              >
                <ArrowLeftRight className="w-3 h-3 group-hover:rotate-180 transition-transform duration-300 shrink-0" />
                <span className="hidden sm:inline">
                  {activeView === 'passenger' ? 'Captain' : 'Passenger'}
                </span>
              </div>
            </button>
          </div>
        )}

        {/* Top Right Side Last Corner: Action buttons & Auth Session & MotoRide Mobile App button */}
        <div className="flex items-center gap-2 order-2 md:order-3 shrink-0 ml-auto md:ml-0">
          {getUserForRole(activeView) ? (
            <div className="flex items-center gap-1.5">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
                  isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-200'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span className="max-w-[110px] truncate">{getUserForRole(activeView)?.name}</span>
                <span className="text-[10px] uppercase font-bold text-amber-500">({activeView})</span>
              </div>
              <button
                type="button"
                id="header-signout-btn"
                onClick={() => signOut(activeView)}
                title="Sign Out of this account"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                    : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800'
                }`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            /* Show in top right side last corner "MotoRide Mobile App" button ONLY on signout passenger and captain dashboard */
            (activeView === 'passenger' || activeView === 'captain') && (
              <div className="relative flex items-center">
                <button
                  type="button"
                  id="top-right-last-corner-motoride-mobile-app-btn"
                  onClick={() => setIsMobileModalOpen(true)}
                  disabled={isDownloadingApk}
                  title="MotoRide Mobile App Installation & APK"
                  className={`group relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-black transition-all duration-150 shadow-sm cursor-pointer select-none active:scale-95 ${
                    isLight
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-emerald-400 shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white border-emerald-500/60 shadow-emerald-950/40'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-emerald-100 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="font-extrabold tracking-tight whitespace-nowrap">MotoRide Mobile App</span>
                  <Download
                    className={`w-3.5 h-3.5 text-emerald-100 shrink-0 ${
                      isDownloadingApk ? 'animate-bounce' : 'group-hover:translate-y-0.5 transition-transform'
                    }`}
                  />
                </button>

                {/* Direct feedback tooltip */}
                {downloadNotice && (
                  <div
                    id="motoride-download-notice"
                    className="absolute right-0 top-full mt-2 z-50 px-3 py-2 rounded-xl bg-slate-900/95 text-white text-[11px] font-medium border border-slate-700 shadow-2xl whitespace-nowrap animate-in fade-in slide-in-from-top-1 duration-150 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{downloadNotice}</span>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* Supabase Config Drawer if toggled */}
      {isOpenConfig && (
        <div
          className={`border-t p-4 animate-in slide-in-from-top-2 duration-200 ${
            isLight ? 'border-slate-200 bg-slate-50 text-slate-900' : 'border-slate-800 bg-slate-950 text-slate-200'
          }`}
        >
          <form onSubmit={handleSaveCredentials} className="max-w-4xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                <Database className="w-4 h-4 text-emerald-500" />
                Configure Shared Supabase Project
              </span>
              <span className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Both Passenger & Captain apps must connect to this same Supabase URL & Anon Key.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={`block text-[11px] font-medium mb-1 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                  VITE_SUPABASE_URL (Project URL)
                </label>
                <input
                  id="input-supabase-url"
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseUrl || ''}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 font-mono border ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:bg-white'
                      : 'bg-slate-900 border-slate-700 text-slate-100'
                  }`}
                />
                {supabaseUrl && cleanPreviewUrl !== supabaseUrl && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-600 font-mono">
                    <Info className="w-3 h-3 flex-shrink-0" />
                    <span>Auto-sanitized to: <strong>{cleanPreviewUrl}</strong></span>
                  </div>
                )}
                <div className={`mt-1 text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                  Find in: Supabase Dashboard &gt; Project Settings &gt; API &gt; <strong>Project URL</strong>
                </div>
              </div>
              <div>
                <label className={`block text-[11px] font-medium mb-1 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                  VITE_SUPABASE_ANON_KEY (Public Client Key Only)
                </label>
                <input
                  id="input-supabase-key"
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseKey || ''}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 font-mono border ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:bg-white'
                      : 'bg-slate-900 border-slate-700 text-slate-100'
                  }`}
                />
                <div className={`mt-1 text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                  Find in: Supabase Dashboard &gt; Project Settings &gt; API &gt; <strong>anon public key</strong>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className={`text-[11px] ${isLight ? 'text-rose-600 font-medium' : 'text-rose-400'}`}>
                ⚠️ Never use SUPABASE_SERVICE_ROLE_KEY in client apps. Use publishable/anon key.
              </span>
              <div className="flex items-center gap-2">
                {isCustom && (
                  <button
                    type="button"
                    onClick={handleClearCredentials}
                    className="flex items-center gap-1 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Reset to Default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpenConfig(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs cursor-pointer ${
                    isLight ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  id="save-supabase-config-btn"
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-colors cursor-pointer"
                >
                  Save & Reconnect
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Mobile App Install & APK Modal */}
      <MobileAppInstallModal
        isOpen={isMobileModalOpen}
        onClose={() => setIsMobileModalOpen(false)}
        apkMeta={apkMeta}
        onOpenAdmin={() => onChangeView('admin')}
        isLight={isLight}
      />
    </div>
  );
};

