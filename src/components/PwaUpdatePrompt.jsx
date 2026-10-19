import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import { skipWaitingAndReload } from '../utils/pwaManager';

export default function PwaUpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUpdate = () => {
      setUpdateAvailable(true);
    };

    window.addEventListener('easeland-pwa-update-available', handleUpdate);
    return () => {
      window.removeEventListener('easeland-pwa-update-available', handleUpdate);
    };
  }, []);

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-top-4 duration-300">
      <div className="bg-slate-950 text-white border-2 border-amber-400 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
              Update Available
            </h4>
            <p className="text-[11px] text-slate-300">
              A newer version of EaseLand is ready.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => skipWaitingAndReload()}
            className="bg-metallic-gold hover:bg-amber-400 text-slate-950 text-xs font-black px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-md transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Update</span>
          </button>
          <button
            onClick={() => setUpdateAvailable(false)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
