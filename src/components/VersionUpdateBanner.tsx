import React, { useEffect, useState } from 'react';
import { versionService, VersionStatus, RemoteVersionInfo } from '../services/versionService';
import { RefreshCw, Wifi, WifiOff, CheckCircle2, Sparkles } from 'lucide-react';

export const VersionUpdateBanner: React.FC = () => {
  const [versionState, setVersionState] = useState(versionService.getState());
  const [showStatusToast, setShowStatusToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    let toastTimeout: any;

    const unsubscribe = versionService.subscribe((state) => {
      const prevOnline = versionState.isOnline;
      setVersionState(state);

      // Notify when connection is restored
      if (!prevOnline && state.isOnline) {
        setToastMessage('🌐 Connected to Internet: Synced to latest version!');
        setShowStatusToast(true);
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => setShowStatusToast(false), 4000);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(toastTimeout);
    };
  }, [versionState.isOnline]);

  const handleUpdateClick = () => {
    versionService.applyUpdate();
  };

  const handleManualCheck = async () => {
    const hasNew = await versionService.checkForUpdates(true);
    if (!hasNew && versionState.isOnline) {
      setToastMessage('✅ You are playing the latest version!');
      setShowStatusToast(true);
      setTimeout(() => setShowStatusToast(false), 3000);
    }
  };

  // If update is available
  if (versionState.hasUpdate) {
    if (versionState.isInMatch) {
      // In active match: compact, non-intrusive indicator
      return (
        <div className="fixed top-2 right-2 z-50 animate-bounce">
          <button
            onClick={handleUpdateClick}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-[10px] rounded border border-amber-300 shadow-lg cursor-pointer"
            title="Click to update to latest build"
          >
            <Sparkles className="w-3 h-3 text-zinc-950 animate-spin" />
            <span>UPDATE READY ⚡</span>
          </button>
        </div>
      );
    }

    // In menu/title: prominent arcade update bar
    return (
      <div className="w-full bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white px-4 py-2 border-b-2 border-yellow-300 shadow-xl flex flex-wrap items-center justify-between gap-2 z-50 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-200"></span>
          </span>
          <span className="font-bold tracking-wider uppercase">
            ⚡ NEW RETRO HOOPS VERSION AVAILABLE! {versionState.remoteInfo?.version ? `(v${versionState.remoteInfo.version})` : ''}
          </span>
          {versionState.remoteInfo?.releaseNotes && (
            <span className="hidden md:inline text-amber-100 text-[11px] font-mono">
              • {versionState.remoteInfo.releaseNotes}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUpdateClick}
            disabled={versionState.status === 'updating'}
            className="flex items-center gap-1.5 bg-yellow-300 hover:bg-yellow-200 text-zinc-950 font-extrabold px-3 py-1 rounded shadow border border-yellow-100 uppercase tracking-widest text-xs transition active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${versionState.status === 'updating' ? 'animate-spin' : ''}`} />
            <span>{versionState.status === 'updating' ? 'UPDATING...' : 'UPDATE & RESTART'}</span>
          </button>
        </div>
      </div>
    );
  }

  // Offline banner according to PWA Skill
  if (!versionState.isOnline) {
    return (
      <div className="fixed bottom-3 left-3 z-50 flex items-center gap-2 rounded-lg bg-zinc-900/90 border border-amber-500/50 px-3 py-1.5 text-xs font-medium text-amber-300 shadow-lg backdrop-blur-sm">
        <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        <span>Offline Mode — Cached data is being used.</span>
      </div>
    );
  }

  // Transient Online Synced Toast
  if (showStatusToast) {
    return (
      <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-lg bg-emerald-950/90 border border-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-200 shadow-xl backdrop-blur-sm animate-fade-in">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>{toastMessage}</span>
      </div>
    );
  }

  return null;
};
