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
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center font-black text-slate-950 text-xs tracking-tight shadow-md shadow-amber-500/20">
            MR
          </div>
          <span className={`font-bold tracking-tight text-sm ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
            Moto<span className="text-amber-500">Ride</span>
          </span>
        </div>

        {/* Center/Right: View Switcher - Only shows available app role based on auth */}
        <div
          className={`flex items-center gap-1.5 p-1 rounded-xl border text-xs ${
            isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-300'
          }`}
        >
          {/* Show Passenger App button only if captain is not signed in */}
          {!isCaptainAuthed && (
            <button
              id="view-passenger-btn"
              onClick={() => onChangeView('passenger')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                activeView === 'passenger'
                  ? 'bg-sky-500 text-white font-bold shadow'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Passenger App
            </button>
          )}

          {/* Show Captain App button only if passenger is not signed in */}
          {!isPassengerAuthed && (
            <button
              id="view-captain-btn"
              onClick={() => onChangeView('captain')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                activeView === 'captain'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Captain App
            </button>
          )}
        </div>

        {/* Action buttons & Auth Session */}
        <div className="flex items-center gap-2">
          {/* User badge, Sign Out, Database Setup, and Theme Toggle are only shown when signed in */}
          {getUserForRole(activeView) && (
            <>
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
                    isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="max-w-[120px] truncate">{getUserForRole(activeView)?.name}</span>
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

              {/* Database Setup Button */}
              <button
                type="button"
                id="header-sql-setup-btn"
                onClick={onOpenSqlModal}
                title="Open Supabase SQL Schema setup"
                className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                <Database className="w-3.5 h-3.5 text-emerald-500" />
              </button>

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                {isLight ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              </button>
            </>
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
    </div>
  );
};

