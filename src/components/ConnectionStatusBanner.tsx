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
    <div className="w-full bg-slate-900/95 border-b border-slate-800 text-slate-200 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand + Status Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center font-black text-slate-950 text-sm shadow-md shadow-amber-500/20">
              M
            </div>
            <span className="font-bold text-slate-100 tracking-tight text-sm">
              Moto<span className="text-amber-400">Ride</span>
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          {/* Connection Pill */}
          <div
            id="connection-indicator"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : connectionStatus === 'checking'
                ? 'bg-sky-500/10 text-sky-300 border-sky-500/30 animate-pulse'
                : connectionStatus === 'not_configured'
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            {connectionStatus === 'connected' && <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
            {connectionStatus === 'checking' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />}
            {connectionStatus === 'not_configured' && <Key className="w-3.5 h-3.5 text-amber-400" />}
            {connectionStatus === 'error' && <WifiOff className="w-3.5 h-3.5 text-rose-400" />}
            
            <span>{statusMessage}</span>
          </div>
        </div>

        {/* Center/Right: View Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            id="view-dual-btn"
            onClick={() => onChangeView('dual')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeView === 'dual'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dual Simulator (Side-by-Side)
          </button>
          <button
            id="view-passenger-btn"
            onClick={() => onChangeView('passenger')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeView === 'passenger'
                ? 'bg-sky-500 text-white font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Passenger App
          </button>
          <button
            id="view-captain-btn"
            onClick={() => onChangeView('captain')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeView === 'captain'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Captain App
          </button>
          <button
            id="view-admin-btn"
            onClick={() => onChangeView('admin')}
            className={`px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              activeView === 'admin'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Admin Dashboard
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            id="open-sql-btn"
            onClick={onOpenSqlModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              statusMessage.toLowerCase().includes('table') || statusMessage.toLowerCase().includes('sql')
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Code2 className={`w-3.5 h-3.5 ${statusMessage.toLowerCase().includes('table') ? 'text-slate-950' : 'text-emerald-400'}`} />
            <span>Setup Database (SQL)</span>
          </button>

          <button
            id="toggle-config-btn"
            onClick={() => setIsOpenConfig(!isOpenConfig)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            API Keys
          </button>

          <button
            id="refresh-connection-btn"
            onClick={() => {
              checkConnection();
              if (onRefreshAll) onRefreshAll();
            }}
            title="Refresh Connection and Rides"
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Supabase Config Drawer if toggled */}
      {isOpenConfig && (
        <div className="border-t border-slate-800 bg-slate-950 p-4 animate-in slide-in-from-top-2 duration-200">
          <form onSubmit={handleSaveCredentials} className="max-w-4xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-400" />
                Configure Shared Supabase Project
              </span>
              <span className="text-[11px] text-slate-400">
                Both Passenger & Captain apps must connect to this same Supabase URL & Anon Key.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  VITE_SUPABASE_URL (Project URL)
                </label>
                <input
                  id="input-supabase-url"
                  type="text"
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                />
                {supabaseUrl && cleanPreviewUrl !== supabaseUrl && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400 font-mono">
                    <Info className="w-3 h-3 flex-shrink-0" />
                    <span>Auto-sanitized to: <strong>{cleanPreviewUrl}</strong></span>
                  </div>
                )}
                <div className="mt-1 text-[10px] text-slate-500">
                  Find in: Supabase Dashboard &gt; Project Settings &gt; API &gt; <strong>Project URL</strong>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  VITE_SUPABASE_ANON_KEY (Public Client Key Only)
                </label>
                <input
                  id="input-supabase-key"
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                />
                <div className="mt-1 text-[10px] text-slate-500">
                  Find in: Supabase Dashboard &gt; Project Settings &gt; API &gt; <strong>anon public key</strong>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-rose-400">
                ⚠️ Never use SUPABASE_SERVICE_ROLE_KEY in client apps. Use publishable/anon key.
              </span>
              <div className="flex items-center gap-2">
                {isCustom && (
                  <button
                    type="button"
                    onClick={handleClearCredentials}
                    className="flex items-center gap-1 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 rounded-xl text-xs transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Reset to Default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpenConfig(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  id="save-supabase-config-btn"
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition-colors"
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

