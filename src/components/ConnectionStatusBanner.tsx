import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  Database,
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Code2,
  RefreshCw,
  Trash2,
  Info,
  Sun,
  Moon,
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

interface ConnectionStatusBannerProps {
  onOpenSqlModal: () => void;
  onRefreshAll?: () => void;
  activeView: 'dual' | 'passenger' | 'captain' | 'admin';
  onChangeView: (view: 'dual' | 'passenger' | 'captain' | 'admin') => void;
}

export const ConnectionStatusBanner: React.FC<ConnectionStatusBannerProps> = ({
  onOpenSqlModal,
  onRefreshAll,
  activeView,
  onChangeView,
}) => {
  const { theme, isLight, toggleTheme } = useTheme();
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
        {/* Left: Brand + Status Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center font-black text-slate-950 text-sm shadow-md shadow-amber-500/20">
              M
            </div>
            <span className={`font-bold tracking-tight text-sm ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
              Moto<span className="text-amber-500">Ride</span>
            </span>
          </div>

          <div className={`h-4 w-px hidden sm:block ${isLight ? 'bg-slate-300' : 'bg-slate-700'}`} />

          {/* Connection Pill */}
          <div
            id="connection-indicator"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              connectionStatus === 'connected'
                ? isLight
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : connectionStatus === 'checking'
                ? isLight
                  ? 'bg-sky-50 text-sky-800 border-sky-200 animate-pulse font-semibold'
                  : 'bg-sky-500/10 text-sky-300 border-sky-500/30 animate-pulse'
                : connectionStatus === 'not_configured'
                ? isLight
                  ? 'bg-amber-50 text-amber-800 border-amber-200 font-semibold'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : isLight
                ? 'bg-rose-50 text-rose-800 border-rose-200 font-semibold'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            {connectionStatus === 'connected' && <Wifi className="w-3.5 h-3.5 text-emerald-500" />}
            {connectionStatus === 'checking' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500" />}
            {connectionStatus === 'not_configured' && <Key className="w-3.5 h-3.5 text-amber-500" />}
            {connectionStatus === 'error' && <WifiOff className="w-3.5 h-3.5 text-rose-500" />}
            
            <span>{statusMessage}</span>
          </div>
        </div>

        {/* Center/Right: View Switcher */}
        <div
          className={`flex items-center gap-1.5 p-1 rounded-xl border text-xs ${
            isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-slate-950 border-slate-800 text-slate-300'
          }`}
        >
          <button
            id="view-dual-btn"
            onClick={() => onChangeView('dual')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              activeView === 'dual'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dual Simulator
          </button>
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
          <button
            id="view-admin-btn"
            onClick={() => onChangeView('admin')}
            className={`px-3 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeView === 'admin'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                : isLight
                ? 'text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-50 border border-slate-200 shadow-xs'
                : 'text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Admin Dashboard
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Light / Dark Mode Toggle Button */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title={isLight ? 'Switch to Dark Mode' : 'Switch to White Background (Light Mode)'}
          >
            {isLight ? (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Light</span>
              </>
            )}
          </button>

          <button
            id="open-sql-btn"
            onClick={onOpenSqlModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              statusMessage.toLowerCase().includes('table') || statusMessage.toLowerCase().includes('sql')
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 animate-pulse'
                : isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Code2 className={`w-3.5 h-3.5 ${statusMessage.toLowerCase().includes('table') ? 'text-slate-950' : 'text-emerald-500'}`} />
            <span className="hidden md:inline">Setup Database (SQL)</span>
            <span className="md:hidden">SQL</span>
          </button>

          <button
            id="toggle-config-btn"
            onClick={() => setIsOpenConfig(!isOpenConfig)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-amber-500" />
            <span>API Keys</span>
          </button>

          <button
            id="refresh-connection-btn"
            onClick={() => {
              checkConnection();
              if (onRefreshAll) onRefreshAll();
            }}
            title="Refresh Connection and Rides"
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-transparent'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
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
                  value={supabaseUrl}
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
                  value={supabaseKey}
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

