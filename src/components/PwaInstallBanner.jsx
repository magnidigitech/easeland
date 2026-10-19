import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share, PlusSquare, Sparkles, CheckCircle2 } from 'lucide-react';
import { promptPwaInstall, isPwaInstalled, isIOSDevice, hasDeferredPrompt } from '../utils/pwaManager';

export default function PwaInstallBanner() {
  const [canInstall, setCanInstall] = useState(false);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if dismissed in this session
    if (sessionStorage.getItem('easeland_pwa_banner_dismissed') === 'true') {
      setIsDismissed(true);
    }

    const installed = isPwaInstalled();
    setAlreadyInstalled(installed);
    const ios = isIOSDevice();
    setIsIOS(ios);

    if (hasDeferredPrompt()) {
      setCanInstall(true);
    }

    const handleInstallable = () => {
      if (!isPwaInstalled()) {
        setCanInstall(true);
      }
    };

    const handleInstalled = () => {
      setAlreadyInstalled(true);
      setCanInstall(false);
      setShowIOSModal(false);
    };

    const handleOpenIOS = () => setShowIOSModal(true);

    window.addEventListener('easeland-pwa-installable', handleInstallable);
    window.addEventListener('easeland-pwa-installed', handleInstalled);
    window.addEventListener('easeland-open-ios-install', handleOpenIOS);

    return () => {
      window.removeEventListener('easeland-pwa-installable', handleInstallable);
      window.removeEventListener('easeland-pwa-installed', handleInstalled);
      window.removeEventListener('easeland-open-ios-install', handleOpenIOS);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    const result = await promptPwaInstall();
    if (result.outcome === 'accepted') {
      setCanInstall(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('easeland_pwa_banner_dismissed', 'true');
    } catch (e) {}
  };

  // Do not show banner if already installed, dismissed, or not installable (unless iOS first visit)
  if (alreadyInstalled || isDismissed) {
    return null;
  }

  // Only show banner if browser triggered installable or on iOS Safari
  if (!canInstall && !isIOS) {
    return null;
  }

  return (
    <>
      {/* Sleek Floating Install Card for Mobile & Tablet */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-amber-400/40 backdrop-blur-xl relative overflow-hidden">
          {/* Subtle Golden Radial Glow */}
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start gap-3 relative z-10">
            {/* App Icon */}
            <div className="w-12 h-12 rounded-xl bg-white p-1.5 shadow-md shrink-0 flex items-center justify-center border border-amber-300/60">
              <img
                src="/icons/icon-96x96.png"
                alt="EaseLand App"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-6">
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-black tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Get Faster App Experience</span>
              </div>
              <h4 className="text-sm font-bold text-white leading-tight mt-0.5">
                Install EaseLand App
              </h4>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                One-tap direct access, instant alerts, and seamless offline search with zero lag.
              </p>

              {/* Install Button */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleInstallClick}
                  className="bg-metallic-gold hover:bg-amber-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow-lg flex items-center gap-1.5 transition-all transform active:scale-95 border border-amber-300"
                >
                  <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{isIOS ? 'Add to Home Screen' : 'Install Free App'}</span>
                </button>
                <button
                  onClick={handleDismiss}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1.5 transition-colors font-medium"
                >
                  Later
                </button>
              </div>
            </div>

            {/* Dismiss Cross */}
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari 'Add to Home Screen' Modal Instructions */}
      {showIOSModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-slate-900 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 relative">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-3">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 p-2 border border-amber-300 flex items-center justify-center shadow-md">
                <img src="/icons/icon-96x96.png" alt="EaseLand" className="w-full h-full object-contain rounded-xl" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Install EaseLand on iOS</h3>
              <p className="text-xs text-slate-600">
                Install EaseLand on your iPhone or iPad for the best direct property discovery experience:
              </p>
            </div>

            <div className="mt-5 space-y-3 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Share className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 block">Step 1: Tap Share</span>
                  <span className="text-slate-500 text-[11px]">Tap the Share icon in the bottom menu bar of Safari.</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 block">Step 2: Add to Home Screen</span>
                  <span className="text-slate-500 text-[11px]">Scroll down and choose 'Add to Home Screen'.</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-emerald-900 block">Step 3: Launch Instantly</span>
                  <span className="text-emerald-700 text-[11px]">EaseLand will open full-screen just like a native app!</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-6 w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
