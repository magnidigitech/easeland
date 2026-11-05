/*
 * EaseLand PWA Management & Registration Module
 * Handles Service Worker registration, install prompts, update lifecycle, and offline awareness.
 */

import { getAppVersion } from './cacheBuster.js';

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
  if (typeof window === 'undefined') {
    return;
  }

  // Active PWA Mobile Zoom Guard: restricts zooming to maps and properties
  setupPwaMobileZoomGuard();

  if (!('serviceWorker' in navigator)) {
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
    const swUrl = '/sw.js?v=' + encodeURIComponent(getAppVersion());
    navigator.serviceWorker
      .register(swUrl, { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        swRegistration = reg;

        // Auto-check for updates when tab regains focus or visibility
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && reg && typeof reg.update === 'function') {
              reg.update().catch(() => {});
            }
          });
        }

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

/**
 * Whitelist check: determines if the touched DOM element is part of an
 * authorized interactive zoom surface (Map engine or Property media/inspection).
 * Returns true if zoom should be permitted; false if page-level viewport zoom should be prevented.
 */
export function isZoomAllowedElement(target) {
  if (!target || typeof target !== 'object') return false;

  // Normalize element (e.g. text nodes or SVGs)
  const el = target.nodeType === 1 ? target : (target.parentElement || null);
  if (!el || typeof el.closest !== 'function') return false;

  const ZOOM_ALLOWED_SELECTORS = [
    '.leaflet-container',
    '.leaflet-map-pane',
    '.leaflet-pane',
    '.gm-style',
    '.zoomable-map',
    '.zoomable-property',
    '.property-zoom-container',
    '.property-media-canvas',
    '[data-allow-zoom="true"]'
  ].join(', ');

  try {
    return Boolean(el.closest(ZOOM_ALLOWED_SELECTORS));
  } catch (err) {
    return false;
  }
}

/**
 * PWA Mobile Zoom Guard
 * Prevents whole-page viewport scaling and double-tap zoom distortion in the PWA mobile version,
 * ensuring the app feels native while preserving interactive zoom strictly on Maps and Properties.
 */
export function setupPwaMobileZoomGuard() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  // Prevent duplicate initialization
  if (window.__easelandZoomGuardActive) {
    return () => {};
  }
  window.__easelandZoomGuardActive = true;

  // 1. iOS Safari / WebKit gesture prevention (pinch-to-zoom on viewport)
  const onGestureStart = (e) => {
    if (!isZoomAllowedElement(e.target)) {
      if (typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
    }
  };

  const onGestureChange = (e) => {
    if (!isZoomAllowedElement(e.target)) {
      if (typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
    }
  };

  // 2. Android Chrome & iOS multi-touch pinch prevention on viewport
  const onTouchMove = (e) => {
    if (e.touches && e.touches.length > 1) {
      if (!isZoomAllowedElement(e.target)) {
        if (typeof e.preventDefault === 'function') {
          e.preventDefault();
        }
      }
    }
  };

  // 3. Double-tap to zoom prevention on non-zoomable UI
  let lastTouchEndTime = 0;
  const onTouchEnd = (e) => {
    const now = Date.now();
    const timeDiff = now - lastTouchEndTime;
    lastTouchEndTime = now;

    if (timeDiff <= 320 && timeDiff > 0) {
      const target = e.target;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (!isInput && !isZoomAllowedElement(target)) {
        if (typeof e.preventDefault === 'function') {
          e.preventDefault();
        }
      }
    }
  };

  // 4. Standalone PWA keyboard zoom prevention (Ctrl + / Ctrl - / Ctrl 0)
  const onKeyDown = (e) => {
    if (isPwaInstalled() && (e.ctrlKey || e.metaKey)) {
      if (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0') {
        e.preventDefault();
      }
    }
  };

  window.addEventListener('gesturestart', onGestureStart, { passive: false });
  window.addEventListener('gesturechange', onGestureChange, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: false });
  window.addEventListener('keydown', onKeyDown);

  return () => {
    window.__easelandZoomGuardActive = false;
    window.removeEventListener('gesturestart', onGestureStart);
    window.removeEventListener('gesturechange', onGestureChange);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('keydown', onKeyDown);
  };
}
