import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from Vite environment variables
const ENV_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const ENV_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Sanitizes Supabase URL to prevent "Invalid path specified in request URL" errors.
 * Handles common user inputs like dashboard URLs, trailing slashes, /rest/v1 suffix, quotes, etc.
 */
export const sanitizeSupabaseUrl = (inputUrl?: string | null): string => {
  if (!inputUrl) return '';
  let url = inputUrl.trim();

  // Strip wrapping double or single quotes
  url = url.replace(/^["']|["']$/g, '').trim();

  if (!url) return '';

  // If user pasted dashboard URL (e.g. https://supabase.com/dashboard/project/abcdefghijk)
  const dashboardMatch = url.match(/supabase\.com\/(?:dashboard\/)?project\/([a-zA-Z0-9_-]+)/i);
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  // Ensure protocol is present
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    
    // If it's a *.supabase.co domain, the base endpoint is always strictly https://<host>
    if (parsed.hostname.toLowerCase().endsWith('.supabase.co')) {
      return `https://${parsed.hostname}`;
    }

    // For custom domains or local Docker instances, strip /rest/v1 or subpaths
    const cleanedPath = parsed.pathname
      .replace(/\/rest(?:\/v1)?\/?$/i, '')
      .replace(/\/auth(?:\/v1)?\/?$/i, '')
      .replace(/\/realtime(?:\/v1)?\/?$/i, '')
      .replace(/\/+$/, '');

    return `${parsed.origin}${cleanedPath}`;
  } catch {
    // Fallback regex cleaning
    return url
      .replace(/\/rest(?:\/v1)?\/?$/i, '')
      .replace(/\/auth(?:\/v1)?\/?$/i, '')
      .replace(/\/+$/, '');
  }
};

/**
 * Sanitizes anon / public API key
 */
export const sanitizeSupabaseKey = (inputKey?: string | null): string => {
  if (!inputKey) return '';
  return inputKey.trim().replace(/^["']|["']$/g, '').trim();
};

// Allow runtime override for testing in AI Studio preview or when configuring in UI
export const getStoredSupabaseConfig = () => {
  const rawCustomUrl = localStorage.getItem('motoride_supabase_url');
  const rawCustomKey = localStorage.getItem('motoride_supabase_anon_key');

  const rawUrl = rawCustomUrl || ENV_SUPABASE_URL;
  const rawKey = rawCustomKey || ENV_SUPABASE_ANON_KEY;

  const url = sanitizeSupabaseUrl(rawUrl);
  const anonKey = sanitizeSupabaseKey(rawKey);

  return {
    rawUrl,
    url,
    rawKey,
    anonKey,
    isCustom: Boolean(rawCustomUrl || rawCustomKey),
    isEnvProvided: Boolean(ENV_SUPABASE_URL && ENV_SUPABASE_ANON_KEY),
  };
};

export const saveCustomSupabaseConfig = (url: string, anonKey: string) => {
  const cleanUrl = sanitizeSupabaseUrl(url);
  const cleanKey = sanitizeSupabaseKey(anonKey);

  if (cleanUrl) {
    localStorage.setItem('motoride_supabase_url', cleanUrl);
  } else {
    localStorage.removeItem('motoride_supabase_url');
  }

  if (cleanKey) {
    localStorage.setItem('motoride_supabase_anon_key', cleanKey);
  } else {
    localStorage.removeItem('motoride_supabase_anon_key');
  }

  // Reset cached instance
  supabaseInstance = null;
  currentConfig = { url: '', anonKey: '' };
};

export const clearCustomSupabaseConfig = () => {
  localStorage.removeItem('motoride_supabase_url');
  localStorage.removeItem('motoride_supabase_anon_key');
  supabaseInstance = null;
  currentConfig = { url: '', anonKey: '' };
};

let supabaseInstance: SupabaseClient | null = null;
let currentConfig = { url: '', anonKey: '' };

export const getSupabaseClient = (): SupabaseClient | null => {
  const { url, anonKey } = getStoredSupabaseConfig();

  if (!url || !anonKey) {
    return null;
  }

  // Reuse instance if config hasn't changed
  if (supabaseInstance && currentConfig.url === url && currentConfig.anonKey === anonKey) {
    return supabaseInstance;
  }

  try {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    currentConfig = { url, anonKey };
    return supabaseInstance;
  } catch (err) {
    console.error('[Motoride Supabase] Client init error:', err);
    return null;
  }
};

export const isSupabaseConfigured = (): boolean => {
  const { url, anonKey } = getStoredSupabaseConfig();
  return Boolean(url && anonKey && url.startsWith('http') && anonKey.length > 10);
};

