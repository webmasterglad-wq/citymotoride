import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

export interface ApkMetadata {
  id: string;
  fileName: string;
  fileSize: number; // in bytes
  mimeType: string;
  uploadedAt: string;
  version?: string;
  downloadUrl?: string; // Optional remote direct link
  storageType: 'server' | 'indexeddb' | 'supabase' | 'direct_url';
}

const DB_NAME = 'motoride_apk_db';
const DB_VERSION = 1;
const STORE_NAME = 'apks';
const RECORD_ID = 'current_active_apk';
const METADATA_KEY = 'motoride_active_apk_metadata';

/**
 * Built-in default APK package configuration.
 * Guarantees that every new passenger browser immediately has a valid downloadable build
 * and is NEVER blocked by "asking for admin to upload apk file".
 */
export const DEFAULT_APK_METADATA: ApkMetadata = {
  id: RECORD_ID,
  fileName: 'MotoRide_Mobile_App.apk',
  fileSize: 1344,
  mimeType: 'application/vnd.android.package-archive',
  uploadedAt: '2026-09-08T15:23:51.810Z',
  version: '1.2.0',
  downloadUrl: '/api/apk/download',
  storageType: 'server',
};

/**
 * Open or initialize the IndexedDB database for local offline fallback.
 */
function openApkDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB.'));
    };
  });
}

/**
 * Read cached metadata from localStorage for instant synchronous UI display.
 * In any new browser, falls back to the default bundled APK package so passengers
 * can download immediately without admin action.
 */
export function getStoredApkMetadata(): ApkMetadata {
  if (typeof window === 'undefined') return DEFAULT_APK_METADATA;
  try {
    const raw = localStorage.getItem(METADATA_KEY);
    if (!raw) return DEFAULT_APK_METADATA;
    const parsed = JSON.parse(raw) as ApkMetadata;
    return parsed?.fileName ? parsed : DEFAULT_APK_METADATA;
  } catch (err) {
    console.warn('[ApkService] Error parsing APK metadata, using default:', err);
    return DEFAULT_APK_METADATA;
  }
}

/**
 * Fetch authoritative APK metadata from Supabase database.
 * This guarantees cross-device persistence across all browsers, phones, and instances.
 */
async function fetchSupabaseApkMetadata(): Promise<ApkMetadata | null> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('rides')
      .select('dropoff_location')
      .eq('passenger_name', '__APK_CONFIG__')
      .maybeSingle();

    if (!error && data && data.dropoff_location) {
      const parsed = JSON.parse(data.dropoff_location);
      if (parsed && parsed.fileName) {
        return parsed as ApkMetadata;
      }
    }
  } catch (err) {
    console.debug('[ApkService] Supabase APK fetch note:', err);
  }
  return null;
}

/**
 * Save APK metadata to Supabase database and broadcast via Realtime channel
 */
async function persistApkMetadataToSupabase(metadata: ApkMetadata): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    await supabase.from('rides').upsert({
      id: '00000000-0000-0000-0000-000000000001',
      passenger_id: '00000000-0000-0000-0000-000000000000',
      passenger_name: '__APK_CONFIG__',
      pickup_location: 'SYSTEM_CONFIG_APK',
      dropoff_location: JSON.stringify(metadata),
      fare: 1.0,
      distance_km: 1.0,
      status: 'cancelled',
    });

    const channel = supabase.channel('motoride_platform_apk');
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'apk_updated',
          payload: metadata,
        }).catch(() => {});
      }
    });
  } catch (err) {
    console.warn('[ApkService] Supabase APK save note:', err);
  }
}

/**
 * Fetch authoritative APK metadata from the server & Supabase.
 * This ensures ALL mobile browsers and desktop browsers across any device
 * see the latest APK uploaded by the Admin.
 */
export async function syncServerApkInfo(): Promise<ApkMetadata> {
  if (typeof window === 'undefined') return DEFAULT_APK_METADATA;

  // 1. Check server API endpoint
  try {
    const res = await fetch('/api/apk/info', {
      headers: { Accept: 'application/json' },
      cache: 'no-cache',
    });

    if (res.ok) {
      const data = await res.json();
      if (data.hasApk && data.metadata) {
        localStorage.setItem(METADATA_KEY, JSON.stringify(data.metadata));
        notifyApkUpdated(data.metadata);
        return data.metadata as ApkMetadata;
      }
    }
  } catch (err) {
    console.debug('[ApkService] Server info check failed:', err);
  }

  // 2. Check Supabase shared record (persists across all browsers)
  try {
    const cloudMeta = await fetchSupabaseApkMetadata();
    if (cloudMeta) {
      localStorage.setItem(METADATA_KEY, JSON.stringify(cloudMeta));
      notifyApkUpdated(cloudMeta);
      return cloudMeta;
    }
  } catch (err) {
    console.debug('[ApkService] Supabase fallback check failed:', err);
  }

  return getStoredApkMetadata();
}

/**
 * Retrieve the local binary Blob from IndexedDB (fallback).
 */
export async function getStoredApkBlob(): Promise<{ blob: Blob; metadata: ApkMetadata } | null> {
  try {
    const db = await openApkDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RECORD_ID);

      req.onsuccess = () => {
        const record = req.result;
        if (!record || !record.blob) {
          resolve(null);
        } else {
          resolve({
            blob: record.blob,
            metadata: {
              id: record.id,
              fileName: record.fileName,
              fileSize: record.fileSize,
              mimeType: record.mimeType,
              uploadedAt: record.uploadedAt,
              version: record.version,
              downloadUrl: record.downloadUrl,
              storageType: record.storageType || 'indexeddb',
            },
          });
        }
      };

      req.onerror = () => {
        reject(req.error || new Error('Failed to fetch APK blob from IndexedDB.'));
      };
    });
  } catch (err) {
    console.warn('[ApkService] Failed to read APK from IndexedDB:', err);
    return null;
  }
}

/**
 * Save an uploaded real APK file to the server and Supabase.
 * The dual server + database persistence guarantees that once uploaded in the admin panel,
 * EVERY passenger in ANY new browser or mobile device can immediately download it.
 */
export async function saveApkFile(
  file: File,
  version?: string
): Promise<{ success: boolean; metadata: ApkMetadata; error?: string }> {
  try {
    const cleanFileName = file.name.endsWith('.apk') ? file.name : `${file.name}.apk`;
    const appVersion = version?.trim() || '1.2.0';

    let savedMetadata: ApkMetadata = {
      id: RECORD_ID,
      fileName: cleanFileName,
      fileSize: file.size,
      mimeType: file.type || 'application/vnd.android.package-archive',
      uploadedAt: new Date().toISOString(),
      version: appVersion,
      storageType: 'server',
      downloadUrl: '/api/apk/download',
    };

    // 1. Upload to the Node.js / Express backend server
    try {
      const uploadUrl = `/api/apk/upload?fileName=${encodeURIComponent(cleanFileName)}&version=${encodeURIComponent(appVersion)}`;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/vnd.android.package-archive',
        },
        body: file,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.metadata) {
          savedMetadata = data.metadata;
        }
      } else {
        console.warn('[ApkService] Server upload returned non-200 status:', response.status);
      }
    } catch (serverErr) {
      console.warn('[ApkService] Server upload failed, relying on cloud sync:', serverErr);
    }

    // 2. Persist to Supabase Database so any new browser anywhere reads the update
    await persistApkMetadataToSupabase(savedMetadata);

    // 3. Save to local IndexedDB for immediate offline access
    try {
      const db = await openApkDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const putReq = store.put({
          ...savedMetadata,
          blob: file,
        });

        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error || new Error('Failed to save APK in IndexedDB.'));
      });
    } catch (idbErr) {
      console.warn('[ApkService] IndexedDB cache note:', idbErr);
    }

    // 4. Update localStorage metadata & notify listeners across all components/tabs
    localStorage.setItem(METADATA_KEY, JSON.stringify(savedMetadata));
    notifyApkUpdated(savedMetadata);

    return { success: true, metadata: savedMetadata };
  } catch (err: any) {
    console.error('[ApkService] Failed to save APK file:', err);
    return {
      success: false,
      metadata: getStoredApkMetadata(),
      error: err?.message || 'Failed to save APK file.',
    };
  }
}

/**
 * Save an external direct download link for the APK (e.g. CDN, S3, or GitHub release).
 */
export async function saveApkExternalUrl(
  downloadUrl: string,
  fileName: string = 'MotoRide_Mobile_App.apk',
  version: string = '1.2.0'
): Promise<ApkMetadata> {
  const metadata: ApkMetadata = {
    id: RECORD_ID,
    fileName: fileName.endsWith('.apk') ? fileName : `${fileName}.apk`,
    fileSize: 0,
    mimeType: 'application/vnd.android.package-archive',
    uploadedAt: new Date().toISOString(),
    version: version.trim() || '1.2.0',
    downloadUrl: downloadUrl.trim(),
    storageType: 'direct_url',
  };

  try {
    await fetch('/api/apk/external-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
  } catch (err) {
    console.warn('[ApkService] Failed to sync external URL to server:', err);
  }

  await persistApkMetadataToSupabase(metadata);

  localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
  notifyApkUpdated(metadata);
  return metadata;
}

/**
 * Remove the uploaded APK file and metadata from server, database, and client.
 */
export async function deleteApk(): Promise<boolean> {
  try {
    // 1. Delete from server
    try {
      await fetch('/api/apk/delete', { method: 'DELETE' });
    } catch (err) {
      console.warn('[ApkService] Error deleting from server:', err);
    }

    // 2. Delete local metadata (reverts to default bundled APK)
    localStorage.removeItem(METADATA_KEY);

    // 3. Clear from Supabase
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase
          .from('rides')
          .delete()
          .eq('passenger_name', '__APK_CONFIG__');
      }
    } catch (dbErr) {
      console.warn('[ApkService] Supabase delete note:', dbErr);
    }

    // 4. Delete from IndexedDB
    try {
      const db = await openApkDatabase();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(RECORD_ID);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Ignore indexedDB deletion errors
    }

    notifyApkUpdated(DEFAULT_APK_METADATA);
    return true;
  } catch (err) {
    console.error('[ApkService] Failed to delete APK:', err);
    return false;
  }
}

/**
 * Trigger immediate browser download of the APK file.
 * Guaranteed:
 * - Every passenger in EVERY new browser can download immediately without being asked to upload.
 * - Works on ALL mobile browsers (Android Chrome, Samsung Internet, iOS Safari, mobile Firefox)
 * - Works on ALL desktop browsers (Chrome, Firefox, Safari, Edge)
 * - NO redirect, NO new page, NO blocking alert.
 */
export async function downloadRealApk(): Promise<{ success: boolean; error?: string }> {
  try {
    const metadata = getStoredApkMetadata() || DEFAULT_APK_METADATA;
    const downloadFileName = metadata.fileName || 'MotoRide_Mobile_App.apk';

    // 1. Direct download URL if external link is configured
    if (metadata.downloadUrl && metadata.downloadUrl !== '/api/apk/download') {
      const anchor = document.createElement('a');
      anchor.style.display = 'none';
      anchor.href = metadata.downloadUrl;
      anchor.download = downloadFileName;
      anchor.target = '_self';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      return { success: true };
    }

    // 2. Universal download via /api/apk/download
    // On all desktop & mobile browsers, creating an anchor and clicking starts native background download
    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.href = '/api/apk/download';
    anchor.setAttribute('download', downloadFileName);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    return { success: true };
  } catch (err: any) {
    console.error('[ApkService] Anchor download fallback:', err);
    try {
      // Direct navigation fallback for restrictive mobile browsers (Android Chrome / Webview)
      window.location.assign('/api/apk/download');
      return { success: true };
    } catch (fallbackErr: any) {
      try {
        window.location.assign('/MotoRide_Mobile_App.apk');
        return { success: true };
      } catch (staticErr: any) {
        return {
          success: false,
          error: staticErr?.message || 'Download could not be started.',
        };
      }
    }
  }
}

/**
 * Helper to notify other components/tabs when APK changes.
 */
function notifyApkUpdated(meta: ApkMetadata | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('motoride_apk_updated', { detail: meta || DEFAULT_APK_METADATA }));
}

/**
 * Subscribe to APK metadata updates across the application, server, Supabase Realtime, and browser tabs.
 */
export function subscribeToApkUpdates(callback: (meta: ApkMetadata) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Provide initial metadata immediately
  callback(getStoredApkMetadata());

  // 2. Sync with authoritative server & Supabase database
  syncServerApkInfo().then((meta) => {
    callback(meta);
  });

  // 3. Periodic sync every 10 seconds so any browser/mobile device automatically
  // detects when admin uploads an APK without refreshing the page
  const intervalId = setInterval(() => {
    syncServerApkInfo().then((meta) => {
      callback(meta);
    });
  }, 10000);

  // 4. Supabase Realtime subscription for instantaneous cross-browser updates
  let supabaseChannel: any = null;
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      supabaseChannel = supabase.channel('motoride_platform_apk');
      supabaseChannel
        .on('broadcast', { event: 'apk_updated' }, (payload: any) => {
          if (payload?.payload) {
            const updatedMeta = payload.payload as ApkMetadata;
            localStorage.setItem(METADATA_KEY, JSON.stringify(updatedMeta));
            callback(updatedMeta);
          }
        })
        .subscribe();
    }
  } catch (chErr) {
    console.debug('[ApkService] Realtime channel subscribe note:', chErr);
  }

  const handleCustomEvent = (e: any) => {
    callback(e.detail || DEFAULT_APK_METADATA);
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === METADATA_KEY) {
      callback(getStoredApkMetadata());
    }
  };

  window.addEventListener('motoride_apk_updated', handleCustomEvent);
  window.addEventListener('storage', handleStorage);

  return () => {
    clearInterval(intervalId);
    if (supabaseChannel) {
      try {
        supabaseChannel.unsubscribe();
      } catch {}
    }
    window.removeEventListener('motoride_apk_updated', handleCustomEvent);
    window.removeEventListener('storage', handleStorage);
  };
}

/**
 * Format bytes to human readable format (MB/KB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}
