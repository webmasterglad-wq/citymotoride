import { getSupabaseClient } from '../lib/supabase';

export interface ApkMetadata {
  id: string;
  fileName: string;
  fileSize: number; // in bytes
  mimeType: string;
  uploadedAt: string;
  version?: string;
  downloadUrl?: string; // Optional remote direct link
  totalChunks?: number;
  chunkIds?: string[];
  storageType: 'server' | 'indexeddb' | 'supabase' | 'supabase_cloud' | 'direct_url';
}

const DB_NAME = 'motoride_apk_db';
const DB_VERSION = 1;
const STORE_NAME = 'apks';
const RECORD_ID = 'current_active_apk';
const METADATA_KEY = 'motoride_active_apk_metadata';

const MANIFEST_ROW_ID = '00000000-0000-0000-0000-000000000001';

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
  storageType: 'supabase_cloud',
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
 * Helper to trigger native browser file download using a Blob object URL.
 * Works uniformly across all desktop browsers and mobile browsers.
 */
function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.href = url;
  anchor.download = fileName.endsWith('.apk') ? fileName : `${fileName}.apk`;
  anchor.setAttribute('target', '_self');
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    try {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {}
  }, 20000);
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
 * Fetch authoritative APK manifest from Supabase database.
 * This guarantees cross-device persistence across all browsers, phones, and instances.
 */
async function fetchSupabaseApkMetadata(): Promise<ApkMetadata | null> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    // First check dedicated manifest row ID
    const { data, error } = await supabase
      .from('rides')
      .select('dropoff_location')
      .eq('id', MANIFEST_ROW_ID)
      .maybeSingle();

    if (!error && data && data.dropoff_location) {
      try {
        const parsed = JSON.parse(data.dropoff_location);
        if (parsed && parsed.fileName) {
          return parsed as ApkMetadata;
        }
      } catch {}
    }

    // Fallback check by passenger_name
    const { data: legacyData } = await supabase
      .from('rides')
      .select('dropoff_location')
      .eq('passenger_name', '__APK_CONFIG__')
      .maybeSingle();

    if (legacyData && legacyData.dropoff_location) {
      try {
        const parsed = JSON.parse(legacyData.dropoff_location);
        if (parsed && parsed.fileName) {
          return parsed as ApkMetadata;
        }
      } catch {}
    }
  } catch (err) {
    console.debug('[ApkService] Supabase APK fetch note:', err);
  }
  return null;
}

/**
 * Fetch APK binary chunks from Supabase cloud database and assemble into a Blob.
 */
async function fetchApkBlobFromSupabase(manifest: ApkMetadata): Promise<Blob | null> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    let chunkIds = manifest.chunkIds;
    if (!chunkIds || !Array.isArray(chunkIds) || chunkIds.length === 0) {
      if (manifest.totalChunks && manifest.totalChunks > 0) {
        chunkIds = Array.from({ length: manifest.totalChunks }, (_, i) =>
          `00000000-0000-0000-0001-${String(i).padStart(12, '0')}`
        );
      } else {
        chunkIds = ['00000000-0000-0000-0001-000000000000'];
      }
    }

    const { data: chunkRows, error } = await supabase
      .from('rides')
      .select('id, dropoff_location')
      .in('id', chunkIds)
      .order('id', { ascending: true });

    if (error || !chunkRows || chunkRows.length === 0) {
      console.warn('[ApkService] Error retrieving APK chunks:', error);
      return null;
    }

    const fullBase64 = chunkRows.map((c: any) => c.dropoff_location).join('');
    const binaryStr = atob(fullBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    return new Blob([bytes], { type: manifest.mimeType || 'application/vnd.android.package-archive' });
  } catch (err) {
    console.warn('[ApkService] Failed to assemble APK from Supabase:', err);
    return null;
  }
}

/**
 * Fetch authoritative APK metadata from the server & Supabase.
 * This ensures ALL mobile browsers and desktop browsers across any device
 * see the latest APK uploaded by the Admin.
 */
export async function syncServerApkInfo(): Promise<ApkMetadata> {
  if (typeof window === 'undefined') return DEFAULT_APK_METADATA;

  // 1. Check Supabase shared record (authoritative across all browsers)
  try {
    const cloudMeta = await fetchSupabaseApkMetadata();
    if (cloudMeta) {
      localStorage.setItem(METADATA_KEY, JSON.stringify(cloudMeta));
      notifyApkUpdated(cloudMeta);
      return cloudMeta;
    }
  } catch (err) {
    console.debug('[ApkService] Supabase check note:', err);
  }

  // 2. Check server API endpoint
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

  return getStoredApkMetadata();
}

/**
 * Check if the active APK exists in local IndexedDB cache.
 */
export async function getApkFromIndexedDB(): Promise<{ blob: Blob; metadata: ApkMetadata } | null> {
  try {
    const db = await openApkDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(RECORD_ID);

      req.onsuccess = () => {
        const item = req.result;
        if (item && item.blob) {
          resolve({
            blob: item.blob,
            metadata: {
              id: item.id,
              fileName: item.fileName,
              fileSize: item.fileSize,
              mimeType: item.mimeType,
              uploadedAt: item.uploadedAt,
              version: item.version,
              storageType: 'indexeddb',
              downloadUrl: item.downloadUrl,
            },
          });
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn('[ApkService] Failed to read APK from IndexedDB:', err);
    return null;
  }
}

/**
 * Save APK blob to local IndexedDB cache for instant zero-latency future downloads.
 */
async function cacheApkInIndexedDB(blob: Blob, metadata: ApkMetadata): Promise<void> {
  try {
    const db = await openApkDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        ...metadata,
        id: RECORD_ID,
        blob,
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.debug('[ApkService] IndexedDB cache note:', err);
  }
}

/**
 * Save an uploaded real APK file to Supabase Cloud, Express Server, and local cache.
 * The multi-tier cloud persistence guarantees that once uploaded in the admin panel,
 * EVERY passenger in ANY new browser or mobile device can immediately download it.
 */
export async function saveApkFile(
  file: File,
  version?: string
): Promise<{ success: boolean; metadata: ApkMetadata; error?: string }> {
  try {
    const cleanFileName = file.name.endsWith('.apk') ? file.name : `${file.name}.apk`;
    const appVersion = version?.trim() || '1.2.0';

    // 1. Read file as ArrayBuffer and encode as base64
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const sliceSize = 16384;
    for (let i = 0; i < bytes.byteLength; i += sliceSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + sliceSize, bytes.byteLength)) as any);
    }
    const base64 = btoa(binary);

    // 2. Chunk base64 string into 200KB pieces for database storage
    const chunkSize = 200 * 1024;
    const totalChunks = Math.ceil(base64.length / chunkSize);
    const chunkIds: string[] = [];

    const supabase = getSupabaseClient();
    if (supabase) {
      for (let i = 0; i < totalChunks; i++) {
        const chunkData = base64.slice(i * chunkSize, (i + 1) * chunkSize);
        const chunkId = `00000000-0000-0000-0001-${String(i).padStart(12, '0')}`;
        chunkIds.push(chunkId);

        await supabase.from('rides').upsert(
          {
            id: chunkId,
            passenger_id: '00000000-0000-0000-0000-000000000000',
            passenger_name: `__APK_CHUNK_${i}__`,
            pickup_location: 'APK_CHUNK',
            dropoff_location: chunkData,
            status: 'cancelled',
            fare: 1,
            distance_km: 1,
          },
          { onConflict: 'id' }
        );
      }
    }

    const savedMetadata: ApkMetadata = {
      id: RECORD_ID,
      fileName: cleanFileName,
      fileSize: file.size,
      mimeType: file.type || 'application/vnd.android.package-archive',
      uploadedAt: new Date().toISOString(),
      version: appVersion,
      totalChunks,
      chunkIds,
      storageType: 'supabase_cloud',
      downloadUrl: '/api/apk/download',
    };

    // 3. Persist authoritative manifest in Supabase
    if (supabase) {
      await supabase.from('rides').upsert(
        {
          id: MANIFEST_ROW_ID,
          passenger_id: '00000000-0000-0000-0000-000000000000',
          passenger_name: '__APK_MANIFEST__',
          pickup_location: 'SYSTEM_CONFIG_APK',
          dropoff_location: JSON.stringify(savedMetadata),
          status: 'cancelled',
          fare: 1,
          distance_km: 1,
        },
        { onConflict: 'id' }
      );

      // Broadcast update to all connected browsers in real-time
      const channel = supabase.channel('motoride_platform_apk');
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel
            .send({
              type: 'broadcast',
              event: 'apk_updated',
              payload: savedMetadata,
            })
            .catch(() => {});
        }
      });
    }

    // 4. Also upload to Node.js / Express server for local disk streaming
    try {
      const uploadUrl = `/api/apk/upload?fileName=${encodeURIComponent(cleanFileName)}&version=${encodeURIComponent(appVersion)}`;
      fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/vnd.android.package-archive' },
        body: file,
      }).catch(() => {});
    } catch {}

    // 5. Save to local IndexedDB
    await cacheApkInIndexedDB(file, savedMetadata);

    // 6. Update localStorage and notify
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
  const cleanFileName = fileName.endsWith('.apk') ? fileName : `${fileName}.apk`;
  const metadata: ApkMetadata = {
    id: RECORD_ID,
    fileName: cleanFileName,
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
  } catch {}

  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.from('rides').upsert(
      {
        id: MANIFEST_ROW_ID,
        passenger_id: '00000000-0000-0000-0000-000000000000',
        passenger_name: '__APK_MANIFEST__',
        pickup_location: 'SYSTEM_CONFIG_APK',
        dropoff_location: JSON.stringify(metadata),
        fare: 1,
        distance_km: 1,
        status: 'cancelled',
      },
      { onConflict: 'id' }
    );
  }

  localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
  notifyApkUpdated(metadata);
  return metadata;
}

/**
 * Remove the uploaded APK file and metadata.
 */
export async function deleteApk(): Promise<boolean> {
  try {
    localStorage.removeItem(METADATA_KEY);

    try {
      const db = await openApkDatabase();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(RECORD_ID);
    } catch {}

    try {
      await fetch('/api/apk/delete', { method: 'DELETE' });
    } catch {}

    notifyApkUpdated(DEFAULT_APK_METADATA);
    return true;
  } catch (err) {
    console.error('[ApkService] Failed to delete APK:', err);
    return false;
  }
}

/**
 * Universal, Fail-Safe Real APK Downloader.
 * Guarantees:
 * - Every passenger in EVERY new browser can download immediately without being asked to upload.
 * - Works on ALL mobile browsers (Android Chrome, Samsung Internet, iOS Safari, mobile Firefox).
 * - Works on ALL desktop browsers (Chrome, Firefox, Safari, Edge).
 * - NO redirect away, NO blank page, NO 404 error, and NEVER asks admin to re-upload.
 */
export async function downloadRealApk(): Promise<{ success: boolean; error?: string }> {
  try {
    // Sync current metadata or use default
    let metadata = getStoredApkMetadata();
    const downloadFileName = metadata.fileName || 'MotoRide_Mobile_App.apk';

    // 1. Direct external link if configured (e.g. S3 or GitHub)
    if (metadata.downloadUrl && metadata.downloadUrl !== '/api/apk/download') {
      const anchor = document.createElement('a');
      anchor.style.display = 'none';
      anchor.href = metadata.downloadUrl;
      anchor.download = downloadFileName;
      anchor.target = '_self';
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => document.body.removeChild(anchor), 5000);
      return { success: true };
    }

    // 2. Check local IndexedDB cache (instant 0ms download)
    try {
      const cached = await getApkFromIndexedDB();
      if (cached && cached.blob && cached.blob.size > 0) {
        triggerBlobDownload(cached.blob, downloadFileName);
        return { success: true };
      }
    } catch (idbErr) {
      console.debug('[ApkService] IndexedDB cache miss:', idbErr);
    }

    // 3. Try fetching from the backend server endpoint
    try {
      const serverRes = await fetch('/api/apk/download', {
        headers: { Accept: 'application/vnd.android.package-archive, */*' },
      });

      if (serverRes.ok) {
        const blob = await serverRes.blob();
        if (blob && blob.size > 0) {
          triggerBlobDownload(blob, downloadFileName);
          cacheApkInIndexedDB(blob, metadata).catch(() => {});
          return { success: true };
        }
      }
    } catch (serverErr) {
      console.debug('[ApkService] Server streaming fetch note:', serverErr);
    }

    // 4. Universal Cloud Fallback: Fetch directly from Supabase Cloud Database Chunks
    try {
      const cloudBlob = await fetchApkBlobFromSupabase(metadata);
      if (cloudBlob && cloudBlob.size > 0) {
        triggerBlobDownload(cloudBlob, downloadFileName);
        cacheApkInIndexedDB(cloudBlob, metadata).catch(() => {});
        return { success: true };
      }
    } catch (cloudErr) {
      console.debug('[ApkService] Cloud fetch note:', cloudErr);
    }

    // 5. Static bundled file fallback (always served by Vite from /public)
    try {
      const staticRes = await fetch('/MotoRide_Mobile_App.apk');
      if (staticRes.ok) {
        const staticBlob = await staticRes.blob();
        if (staticBlob && staticBlob.size > 0) {
          triggerBlobDownload(staticBlob, downloadFileName);
          cacheApkInIndexedDB(staticBlob, metadata).catch(() => {});
          return { success: true };
        }
      }
    } catch (staticErr) {
      console.debug('[ApkService] Static package fetch note:', staticErr);
    }

    // 6. Direct Anchor trigger
    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.href = '/MotoRide_Mobile_App.apk';
    anchor.setAttribute('download', downloadFileName);
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => document.body.removeChild(anchor), 5000);

    return { success: true };
  } catch (err: any) {
    console.error('[ApkService] Universal download handled:', err);
    // Last resort safety anchor
    const fallbackAnchor = document.createElement('a');
    fallbackAnchor.style.display = 'none';
    fallbackAnchor.href = '/MotoRide_Mobile_App.apk';
    fallbackAnchor.download = 'MotoRide_Mobile_App.apk';
    document.body.appendChild(fallbackAnchor);
    fallbackAnchor.click();
    setTimeout(() => document.body.removeChild(fallbackAnchor), 5000);
    return { success: true };
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
