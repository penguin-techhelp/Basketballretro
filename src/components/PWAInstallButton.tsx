import React, { useState } from 'react';
import { usePWAInstall } from '../services/usePWAInstall';
import { Download } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-2 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-3 py-1.5 text-xs shadow-md border border-amber-300 transition-transform active:scale-95 cursor-pointer uppercase tracking-wider"
        title="Install Retro Hoops '95 App"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 px-2.5 py-1 text-xs font-medium cursor-pointer"
          title="Install on iPhone / iPad"
        >
          <Download className="w-3 h-3 text-amber-400" />
          <span>Install iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-xl bg-zinc-900 border-2 border-amber-500/50 p-6 shadow-2xl text-zinc-100">
              <h3 className="text-base font-bold text-amber-400 uppercase tracking-wider mb-2">
                🏀 Install on iPhone / iPad
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed mb-4">
                1. Tap the <strong className="text-amber-300">Share</strong> button in Safari toolbar.<br />
                2. Scroll down and tap <strong className="text-amber-300">Add to Home Screen</strong>.<br />
                3. Enjoy instant fullscreen arcade action!
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded bg-amber-500 hover:bg-amber-400 py-2 text-xs font-bold text-zinc-950 uppercase tracking-widest cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
