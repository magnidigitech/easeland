import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleNetworkEvent = (e) => {
      if (e.detail?.isOnline) {
        handleOnline();
      } else {
        handleOffline();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('easeland-network-status', handleNetworkEvent);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('easeland-network-status', handleNetworkEvent);
    };
  }, []);

  if (!isOffline && !showReconnected) {
    return null;
  }

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%] sm:w-auto animate-in fade-in slide-in-from-top-4 duration-300">
      {isOffline ? (
        <div className="bg-slate-900/95 backdrop-blur-md text-white border border-amber-500/50 px-4 py-2.5 rounded-full shadow-2xl flex items-center justify-between sm:justify-center gap-3 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-slate-200">
              Offline mode active. Browsing cached listings.
            </span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-amber-400 hover:text-amber-300 ml-2 font-bold flex items-center gap-1 shrink-0"
            title="Retry connecting"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Retry</span>
          </button>
        </div>
      ) : (
        <div className="bg-emerald-950/95 backdrop-blur-md text-emerald-200 border border-emerald-500/50 px-4 py-2.5 rounded-full shadow-2xl flex items-center justify-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
          <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Back online! Live marketplace synced.</span>
        </div>
      )}
    </div>
  );
}
