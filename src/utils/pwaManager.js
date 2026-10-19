/*
 * EaseLand PWA Management & Registration Module
 * Handles Service Worker registration, install prompts, update lifecycle, and offline awareness.
 */

let deferredPrompt = null;
let swRegistration = null;

/**
 * Check if the application is currently running in standalone (PWA) mode
 */
export function isPwaInstalled() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true ||
    (typeof document !== 'undefined' && document.referrer.includes('android-app://'))
  );
}

/**
 * Check if the user is browsing on an Apple iOS device (iPhone / iPad / iPod)
 */
export function isIOSDevice() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
}

/**
 * Register the EaseLand Service Worker
 */
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Capture the native beforeinstallprompt event for custom install UI
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('easeland-pwa-installable', { detail: { promptAvailable: true } }));
  });

  // Track app installation
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('easeland-pwa-installed'));
  });

  // Online / Offline tracking
  window.addEventListener('online', () => {
    window.dispatchEvent(new CustomEvent('easeland-network-status', { detail: { isOnline: true } }));
  });
  window.addEventListener('offline', () => {
    window.dispatchEvent(new CustomEvent('easeland-network-status', { detail: { isOnline: false } }));
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        swRegistration = reg;

        // Check if there is an updated worker already waiting
        if (reg.waiting) {
          window.dispatchEvent(
            new CustomEvent('easeland-pwa-update-available', {
              detail: { registration: reg, waitingWorker: reg.waiting }
            })
          );
        }

        // Listen for new worker installation
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(
                new CustomEvent('easeland-pwa-update-available', {
                  detail: { registration: reg, waitingWorker: newWorker }
                })
              );
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[EaseLand PWA] Service Worker registration note:', err?.message || err);
      });

    // Handle controller change (reloads tab after skipWaiting)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

/**
 * Trigger the native PWA install prompt
 * @returns {Promise<{ outcome: 'accepted'|'dismissed'|'unavailable' }>}
 */
export async function promptPwaInstall() {
  if (!deferredPrompt) {
    return { outcome: 'unavailable' };
  }

  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    return { outcome };
  } catch (err) {
    console.error('[EaseLand PWA] Install prompt error:', err);
    return { outcome: 'dismissed' };
  }
}

/**
 * Tell the waiting Service Worker to skip waiting and activate immediately
 */
export function skipWaitingAndReload() {
  if (swRegistration && swRegistration.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  } else if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
  }
}

/**
 * Returns whether an install prompt is currently deferred and ready
 */
export function hasDeferredPrompt() {
  return Boolean(deferredPrompt);
}
