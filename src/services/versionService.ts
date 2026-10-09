// Real-time Internet Version Synchronization Service
// Ensures that whenever a player is connected to the internet, they receive the latest version.

export interface RemoteVersionInfo {
  version: string;
  buildTime: number;
  builtAt: string;
  releaseNotes?: string;
}

export type VersionStatus = 'checking' | 'latest' | 'update_available' | 'offline' | 'updating';

type Listener = (info: {
  status: VersionStatus;
  isOnline: boolean;
  hasUpdate: boolean;
  currentVersion: string;
  currentBuildTime: number;
  remoteInfo: RemoteVersionInfo | null;
  lastChecked: number | null;
  isInMatch: boolean;
}) => void;

class VersionService {
  private currentBuildTime: number = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : Date.now();
  private currentVersion: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.4.0';
  private remoteInfo: RemoteVersionInfo | null = null;
  private hasUpdate: boolean = false;
  private status: VersionStatus = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'latest';
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private lastChecked: number | null = null;
  private isInMatch: boolean = false;
  private listeners: Set<Listener> = new Set();
  private pollIntervalId: any = null;
  private isChecking: boolean = false;

  constructor() {
    if (typeof window === 'undefined') return;

    // Track online/offline transitions
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Track tab focus / visibility
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Listen for Service Worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // A new service worker has taken over
        this.notify();
      });
    }

    // Initial check when internet is active
    if (this.isOnline) {
      // Small timeout to allow initial render to settle
      setTimeout(() => {
        this.checkForUpdates(false);
      }, 1500);
    }

    // Periodic check every 60 seconds while online
    this.pollIntervalId = setInterval(() => {
      if (this.isOnline && !this.isChecking) {
        this.checkForUpdates(false);
      }
    }, 60000);
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.status = 'checking';
    this.notify();
    // Internet connection was detected/restored: immediately check for latest version
    this.checkForUpdates(false);
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.status = 'offline';
    this.notify();
  };

  private handleVisibilityChange = () => {
    if (!document.hidden && this.isOnline) {
      this.checkForUpdates(false);
    }
  };

  public setMatchState(inMatch: boolean) {
    this.isInMatch = inMatch;
    // If player just finished a match and an update is waiting, auto-prompt or apply
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Send immediate initial state
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(state);
      } catch (err) {
        console.error('Error in version listener:', err);
      }
    });
  }

  public getState() {
    return {
      status: this.status,
      isOnline: this.isOnline,
      hasUpdate: this.hasUpdate,
      currentVersion: this.currentVersion,
      currentBuildTime: this.currentBuildTime,
      remoteInfo: this.remoteInfo,
      lastChecked: this.lastChecked,
      isInMatch: this.isInMatch,
    };
  }

  /**
   * Check the server for the latest build manifest and query service worker updates.
   */
  public async checkForUpdates(manual: boolean = false): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (!navigator.onLine) {
      this.isOnline = false;
      this.status = 'offline';
      this.notify();
      return false;
    }

    this.isOnline = true;
    this.isChecking = true;
    this.status = 'checking';
    this.notify();

    // 1. Tell Service Worker to check for updates
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
        }
      } catch (swErr) {
        console.warn('SW update check error:', swErr);
      }
    }

    // 2. Query version.json with no-cache headers and timestamp query param
    try {
      const cacheBust = Date.now();
      const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
      const versionUrl = `${basePath}version.json?t=${cacheBust}`;

      const res = await fetch(versionUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });

      if (res.ok) {
        const data: RemoteVersionInfo = await res.json();
        this.remoteInfo = data;
        this.lastChecked = Date.now();

        // Check if remote build timestamp is newer than current running build
        const isRemoteNewer = typeof data.buildTime === 'number' && data.buildTime > this.currentBuildTime + 500;
        const isVersionDifferent = Boolean(data.version && data.version !== this.currentVersion);

        if (isRemoteNewer || isVersionDifferent) {
          this.hasUpdate = true;
          this.status = 'update_available';
          this.notify();
          this.isChecking = false;
          return true;
        } else {
          this.hasUpdate = false;
          this.status = 'latest';
          this.notify();
          this.isChecking = false;
          return false;
        }
      } else {
        // If version.json is not found (e.g. dev mode without public copy), fallback to latest
        this.status = 'latest';
        this.lastChecked = Date.now();
        this.notify();
        this.isChecking = false;
        return false;
      }
    } catch (err) {
      console.warn('Version check failed (offline or network error):', err);
      if (!navigator.onLine) {
        this.isOnline = false;
        this.status = 'offline';
      } else {
        this.status = this.hasUpdate ? 'update_available' : 'latest';
      }
      this.isChecking = false;
      this.notify();
      return false;
    }
  }

  /**
   * Applies the latest update:
   * 1. Purges all browser cache storage
   * 2. Signals service worker to skip waiting
   * 3. Reloads the window to immediately execute the newest code bundles
   */
  public async applyUpdate(): Promise<void> {
    if (typeof window === 'undefined') return;

    this.status = 'updating';
    this.notify();

    try {
      // 1. Purge all Workbox / browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // 2. Signal service worker to skip waiting
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
    } catch (e) {
      console.warn('Cache clearing error during update:', e);
    }

    // 3. Force clean reload with cache-busting query parameter
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.set('_v', Date.now().toString());
    window.location.href = cleanUrl.toString();
  }
}

export const versionService = new VersionService();
