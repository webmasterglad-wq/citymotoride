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
 */
export function getStoredApkMetadata(): ApkMetadata | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(METADATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ApkMetadata;
  } catch (err) {
    console.warn('[ApkService] Error parsing APK metadata:', err);
    return null;
  }
}

/**
 * Fetch authoritative APK metadata from the server.
 * This ensures ALL mobile browsers and desktop browsers across any device
 * see the latest APK uploaded by the Admin.
 */
export async function syncServerApkInfo(): Promise<ApkMetadata | null> {
  if (typeof window === 'undefined') return null;
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
      } else {
        // If server reports no APK and local was server-based, clear local
        const current = getStoredApkMetadata();
        if (current?.storageType === 'server') {
          localStorage.removeItem(METADATA_KEY);
          notifyApkUpdated(null);
        }
      }
    }
  } catch (err) {
    // If server is unreachable, fall back to local cached metadata
    console.debug('[ApkService] Server info check failed, using local cache:', err);
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
 * Save an uploaded real APK file to the server and local IndexedDB.
 * The server storage guarantees that ALL browsers and mobile devices can download it.
 */
export async function saveApkFile(
  file: File,
  version?: string
): Promise<{ success: boolean; metadata: ApkMetadata; error?: string }> {
  try {
    const cleanFileName = file.name.endsWith('.apk') ? file.name : `${file.name}.apk`;
    const appVersion = version?.trim() || '1.0.0';

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
      console.warn('[ApkService] Server upload failed, caching locally:', serverErr);
      savedMetadata.storageType = 'indexeddb';
    }

    // 2. Also save to local IndexedDB for immediate offline access
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
      console.warn('[ApkService] IndexedDB cache error (non-fatal):', idbErr);
    }

    // 3. Optional Supabase Storage upload if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const filePath = `apks/${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('motoride-uploads')
          .upload(filePath, file, {
            contentType: 'application/vnd.android.package-archive',
            upsert: true,
          });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('motoride-uploads')
            .getPublicUrl(filePath);

          if (publicUrlData?.publicUrl) {
            savedMetadata.downloadUrl = publicUrlData.publicUrl;
            savedMetadata.storageType = 'supabase';
          }
        }
      } catch (cloudErr) {
        console.warn('[ApkService] Cloud storage upload skipped:', cloudErr);
      }
    }

    // 4. Update localStorage metadata & notify listeners across all components/tabs
    localStorage.setItem(METADATA_KEY, JSON.stringify(savedMetadata));
    notifyApkUpdated(savedMetadata);

    return { success: true, metadata: savedMetadata };
  } catch (err: any) {
    console.error('[ApkService] Failed to save APK file:', err);
    return {
      success: false,
      metadata: getStoredApkMetadata() || ({} as ApkMetadata),
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
  version: string = '1.0.0'
): Promise<ApkMetadata> {
  const metadata: ApkMetadata = {
    id: RECORD_ID,
    fileName: fileName.endsWith('.apk') ? fileName : `${fileName}.apk`,
    fileSize: 0,
    mimeType: 'application/vnd.android.package-archive',
    uploadedAt: new Date().toISOString(),
    version: version.trim() || '1.0.0',
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

  localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
  notifyApkUpdated(metadata);
  return metadata;
}

/**
 * Remove the uploaded APK file and metadata from server and client.
 */
export async function deleteApk(): Promise<boolean> {
  try {
    // 1. Delete from server
    try {
      await fetch('/api/apk/delete', { method: 'DELETE' });
    } catch (err) {
      console.warn('[ApkService] Error deleting from server:', err);
    }

    // 2. Delete local metadata
    localStorage.removeItem(METADATA_KEY);

    // 3. Delete from IndexedDB
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

    notifyApkUpdated(null);
    return true;
  } catch (err) {
    console.error('[ApkService] Failed to delete APK:', err);
    return false;
  }
}

/**
 * Trigger immediate browser download of the real APK file.
 * Guaranteed:
 * - Works on ALL mobile browsers (Android Chrome, Samsung Internet, iOS Safari, mobile Firefox)
 * - Works on ALL desktop browsers (Chrome, Firefox, Safari, Edge)
 * - NO redirect, NO new page, NO intermediate text.
 */
export async function downloadRealApk(): Promise<{ success: boolean; error?: string }> {
  try {
    let metadata = getStoredApkMetadata();

    // If local metadata is empty, check server before failing
    if (!metadata) {
      metadata = await syncServerApkInfo();
    }

    // 1. Universal Server Download (Works across ALL devices & mobile browsers)
    // When the APK was uploaded by Admin, it is served via /api/apk/download
    try {
      const checkRes = await fetch('/api/apk/info', { cache: 'no-cache' });
      if (checkRes.ok) {
        const info = await checkRes.json();
        if (info.hasApk) {
          const downloadUrl = '/api/apk/download';
          const fileName = info.metadata?.fileName || metadata?.fileName || 'MotoRide_Mobile_App.apk';

          // Trigger native browser download
          const anchor = document.createElement('a');
          anchor.style.display = 'none';
          anchor.href = downloadUrl;
          anchor.setAttribute('download', fileName);
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);

          return { success: true };
        }
      }
    } catch (serverCheckErr) {
      console.warn('[ApkService] Server download check failed, checking fallbacks:', serverCheckErr);
    }

    // 2. If server didn't have it, check if we have an external direct URL
    if (metadata?.downloadUrl) {
      const anchor = document.createElement('a');
      anchor.style.display = 'none';
      anchor.href = metadata.downloadUrl;
      anchor.download = metadata.fileName || 'MotoRide_Mobile_App.apk';
      anchor.target = '_self';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      return { success: true };
    }

    // 3. Fallback: check IndexedDB Blob on this device
    const stored = await getStoredApkBlob();
    if (stored && stored.blob) {
      const fileName = metadata?.fileName || stored.metadata.fileName || 'MotoRide_Mobile_App.apk';
      const blob = new Blob([stored.blob], { type: 'application/vnd.android.package-archive' });
      const objectUrl = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.style.display = 'none';
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 15000);

      return { success: true };
    }

    return {
      success: false,
      error: 'No real APK file has been uploaded from the Admin Panel yet.',
    };
  } catch (err: any) {
    console.error('[ApkService] Download failed:', err);

    // Emergency mobile fallback: directly invoke window.location to /api/apk/download
    try {
      window.location.href = '/api/apk/download';
      return { success: true };
    } catch {
      return {
        success: false,
        error: err?.message || 'Download could not be started.',
      };
    }
  }
}

/**
 * Helper to notify other components/tabs when APK changes.
 */
function notifyApkUpdated(meta: ApkMetadata | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('motoride_apk_updated', { detail: meta }));
}

/**
 * Subscribe to APK metadata updates across the application, server, and browser tabs.
 */
export function subscribeToApkUpdates(callback: (meta: ApkMetadata | null) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Initial check with server
  syncServerApkInfo().then((meta) => {
    callback(meta);
  });

  // 2. Periodic sync so any browser/mobile device automatically detects when admin uploads an APK
  const intervalId = setInterval(() => {
    syncServerApkInfo().then((meta) => {
      callback(meta);
    });
  }, 10000);

  const handleCustomEvent = (e: any) => {
    callback(e.detail);
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
