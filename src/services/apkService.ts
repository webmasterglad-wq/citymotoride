import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

export interface ApkMetadata {
  id: string;
  fileName: string;
  fileSize: number; // in bytes
  mimeType: string;
  uploadedAt: string;
  version?: string;
  downloadUrl?: string; // Optional remote direct link
  storageType: 'indexeddb' | 'supabase' | 'direct_url';
}

const DB_NAME = 'motoride_apk_db';
const DB_VERSION = 1;
const STORE_NAME = 'apks';
const RECORD_ID = 'current_active_apk';
const METADATA_KEY = 'motoride_active_apk_metadata';

/**
 * Open or initialize the IndexedDB database for large binary APK file storage.
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
 * Read cached metadata from localStorage for fast synchronous checks.
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
 * Retrieve the actual binary Blob from IndexedDB.
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
 * Save an uploaded real APK file into IndexedDB and optionally upload to Supabase Storage.
 */
export async function saveApkFile(
  file: File,
  version?: string
): Promise<{ success: boolean; metadata: ApkMetadata; error?: string }> {
  try {
    // 1. Prepare metadata
    const metadata: ApkMetadata = {
      id: RECORD_ID,
      fileName: file.name.endsWith('.apk') ? file.name : `${file.name}.apk`,
      fileSize: file.size,
      mimeType: file.type || 'application/vnd.android.package-archive',
      uploadedAt: new Date().toISOString(),
      version: version?.trim() || '1.0.0',
      storageType: 'indexeddb',
    };

    // 2. Save directly to IndexedDB (stores the real binary file blob)
    const db = await openApkDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const putReq = store.put({
        ...metadata,
        blob: file,
      });

      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error || new Error('Failed to save APK in IndexedDB.'));
    });

    // 3. Try to upload to Supabase Storage if configured (optional cloud backup)
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
            metadata.downloadUrl = publicUrlData.publicUrl;
            metadata.storageType = 'supabase';
          }
        }
      } catch (cloudErr) {
        console.warn('[ApkService] Cloud storage upload skipped, using IndexedDB:', cloudErr);
      }
    }

    // 4. Update localStorage metadata & notify listeners
    localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
    notifyApkUpdated(metadata);

    return { success: true, metadata };
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
export function saveApkExternalUrl(
  downloadUrl: string,
  fileName: string = 'MotoRide_Mobile_App.apk',
  version: string = '1.0.0'
): ApkMetadata {
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
 * Guaranteed: NO redirect, NO new page, NO intermediate text.
 */
export async function downloadRealApk(): Promise<{ success: boolean; error?: string }> {
  try {
    const metadata = getStoredApkMetadata();

    // 1. Check if we have an IndexedDB Blob
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

    // 2. If no IndexedDB blob, check if we have a direct download URL
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

    return {
      success: false,
      error: 'No real APK file has been uploaded from the Admin Panel yet.',
    };
  } catch (err: any) {
    console.error('[ApkService] Download failed:', err);
    return {
      success: false,
      error: err?.message || 'Download could not be started.',
    };
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
 * Subscribe to APK metadata updates across the application and browser tabs.
 */
export function subscribeToApkUpdates(callback: (meta: ApkMetadata | null) => void): () => void {
  if (typeof window === 'undefined') return () => {};

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
