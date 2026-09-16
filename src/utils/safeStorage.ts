/**
 * MotoRide Safe Storage Utility
 * Prevents DOMException, SecurityError, and QuotaExceededError in mobile browsers,
 * private browsing modes, and restricted iframe environments.
 */

class SafeStorageService {
  private memoryFallback: Map<string, string> = new Map();
  private isStorageAvailable: boolean = false;

  constructor() {
    this.checkAvailability();
  }

  private checkAvailability() {
    if (typeof window === 'undefined') {
      this.isStorageAvailable = false;
      return;
    }

    try {
      const testKey = '__motoride_test_storage__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      this.isStorageAvailable = true;
    } catch {
      this.isStorageAvailable = false;
    }
  }

  public getItem(key: string): string | null {
    if (this.isStorageAvailable) {
      try {
        const val = window.localStorage.getItem(key);
        return val !== null ? val : (this.memoryFallback.get(key) ?? null);
      } catch {
        return this.memoryFallback.get(key) ?? null;
      }
    }
    return this.memoryFallback.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    const strVal = String(value);
    this.memoryFallback.set(key, strVal);

    if (this.isStorageAvailable) {
      try {
        window.localStorage.setItem(key, strVal);
      } catch (err) {
        // Suppress QuotaExceededError or SecurityError
        console.warn(`[SafeStorage] Failed to persist key "${key}":`, err);
      }
    }
  }

  public removeItem(key: string): void {
    this.memoryFallback.delete(key);
    if (this.isStorageAvailable) {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }
  }

  public clear(): void {
    this.memoryFallback.clear();
    if (this.isStorageAvailable) {
      try {
        window.localStorage.clear();
      } catch {}
    }
  }

  public getJSON<T>(key: string, fallback: T): T {
    try {
      const raw = this.getItem(key);
      if (!raw || raw === 'undefined' || raw === 'null') {
        return fallback;
      }
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  public setJSON<T>(key: string, value: T): void {
    try {
      this.setItem(key, JSON.stringify(value));
    } catch {}
  }
}

export const safeStorage = new SafeStorageService();

/**
 * Installs global fallback polyfill on window.localStorage if it throws or is inaccessible.
 */
export function initGlobalStorageSafety(): void {
  if (typeof window === 'undefined') return;

  try {
    const testKey = '__storage_probe__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
  } catch {
    console.warn('[MotoRide] window.localStorage throws or is restricted. Activating in-memory storage fallback.');
    const memStore = new Map<string, string>();
    const safeMock: Storage = {
      getItem: (k: string) => memStore.get(k) ?? null,
      setItem: (k: string, v: string) => { memStore.set(k, String(v)); },
      removeItem: (k: string) => { memStore.delete(k); },
      clear: () => { memStore.clear(); },
      key: (idx: number) => Array.from(memStore.keys())[idx] ?? null,
      get length() { return memStore.size; },
    };

    try {
      Object.defineProperty(window, 'localStorage', {
        value: safeMock,
        configurable: true,
        writable: true,
      });
    } catch {}
  }
}
