/**
 * EaseLand — Meta Pixel & Conversion Tracking Utility
 * Meta Pixel ID: 1091569030464660
 * 
 * Production-safe, privacy-compliant event instrumentation.
 * Ensures zero PII (no passwords, emails, phone numbers, or private user data).
 * Handles React Strict Mode and duplicate navigation gracefully.
 */

export const META_PIXEL_ID = '1091569030464660';

let isInitialized = typeof window !== 'undefined' && typeof window.fbq === 'function';
let lastTrackedPath = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : null;
const trackedEventCache = new Set();

/**
 * Checks if tracking is permitted by user consent.
 */
export function isTrackingPermitted() {
  if (typeof window === 'undefined') return false;
  try {
    const consent = localStorage.getItem('easeland_cookie_consent');
    if (consent === 'declined' || consent === 'false') {
      return false;
    }
  } catch (e) {
    // If localStorage unavailable, permit default non-sensitive tracking
  }
  return true;
}

/**
 * Initializes Meta Pixel in the browser once.
 */
export function initMetaPixel() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (isInitialized || window._easelandMetaPixelReady) return true;
  if (!isTrackingPermitted()) return false;

  try {
    // Official Meta Pixel Bootstrap snippet
    (function(f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function() {
        if (n.callMethod) {
          n.callMethod.apply(n, arguments);
        } else {
          n.queue.push(arguments);
        }
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = true;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      if (s && s.parentNode) {
        s.parentNode.insertBefore(t, s);
      } else if (b.head) {
        b.head.appendChild(t);
      }
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    if (typeof window.fbq === 'function') {
      window.fbq('init', META_PIXEL_ID);
      isInitialized = true;
      window._easelandMetaPixelReady = true;
      return true;
    }
  } catch (err) {
    console.warn('Meta Pixel initialization note:', err);
  }
  return false;
}

/**
 * Safely dispatches standard or custom Meta Pixel events.
 */
function sendPixelEvent(eventType, eventName, params = null) {
  if (typeof window === 'undefined') return;
  if (!isTrackingPermitted()) return;

  try {
    if (!isInitialized) {
      initMetaPixel();
    }
    if (typeof window.fbq === 'function') {
      const hasParams = params && Object.keys(params).length > 0;
      if (eventType === 'trackCustom') {
        if (hasParams) {
          window.fbq('trackCustom', eventName, params);
        } else {
          window.fbq('trackCustom', eventName);
        }
      } else {
        if (hasParams) {
          window.fbq('track', eventName, params);
        } else {
          window.fbq('track', eventName);
        }
      }
    }
  } catch (err) {
    console.warn('Meta Pixel event dispatch note:', err);
  }
}

/**
 * Tracks PageView on initial load and client-side SPA route transitions.
 * Suppresses duplicate consecutive emissions for the same path.
 */
export function trackPageView(currentPath = null) {
  if (typeof window === 'undefined') return;
  const path = currentPath || window.location.pathname + window.location.search;

  if (lastTrackedPath === path) {
    return; // Prevent duplicate PageView from component rerender
  }
  lastTrackedPath = path;

  sendPixelEvent('track', 'PageView');
}

/**
 * Tracks successful account registration.
 * Triggered ONLY upon confirmed server creation of user account.
 */
export function trackRegistrationComplete(method = 'mobile') {
  if (trackedEventCache.has('complete_registration')) {
    return;
  }
  trackedEventCache.add('complete_registration');

  sendPixelEvent('track', 'CompleteRegistration', {
    status: 'success',
    method: String(method || 'mobile').toLowerCase()
  });
}

/**
 * Tracks successful property inquiry submission (Standard Meta Lead Event).
 * Triggered ONLY when inquiry API returns confirmed success.
 */
export function trackLeadSubmitted(property = {}) {
  const propId = property.propertyId || property.id || 'general';
  const propTitle = property.title || property.propertyTitle || 'Property Listing';
  const propType = property.propertyType || property.category || 'Real Estate';
  const priceNum = Number(property.price) || 0;

  const payload = {
    content_name: propTitle,
    content_category: propType,
    content_ids: [String(propId)]
  };
  if (priceNum > 0) {
    payload.value = priceNum;
    payload.currency = 'INR';
  }

  sendPixelEvent('track', 'Lead', payload);
}

/**
 * Tracks genuine view of an Admin-approved LIVE property details page (ViewContent).
 */
export function trackPropertyView(property = {}) {
  if (!property) return;
  const propId = property.propertyId || property.id;
  if (!propId) return;

  const cacheKey = 'view_' + String(propId);
  if (trackedEventCache.has(cacheKey)) {
    return; // Avoid multiple ViewContent emissions in same session for same property
  }
  trackedEventCache.add(cacheKey);

  const propTitle = property.title || 'Property Listing';
  const propType = property.propertyType || property.category || 'Real Estate';
  const priceNum = Number(property.price) || 0;

  const payload = {
    content_name: propTitle,
    content_category: propType,
    content_ids: [String(propId)],
    content_type: 'product'
  };
  if (priceNum > 0) {
    payload.value = priceNum;
    payload.currency = 'INR';
  }

  sendPixelEvent('track', 'ViewContent', payload);
}

/**
 * Tracks qualified property contact initiation (WhatsApp or Call EaseLand).
 */
export function trackContactInitiated(method = 'WhatsApp', property = {}) {
  const propId = property.propertyId || property.id || 'general';
  const propTitle = property.title || property.propertyTitle || 'Property Listing';

  sendPixelEvent('track', 'Contact', {
    contact_method: method,
    content_name: propTitle,
    content_ids: [String(propId)]
  });
}

/**
 * Update consent setting.
 */
export function setTrackingConsent(granted = true) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('easeland_cookie_consent', granted ? 'granted' : 'declined');
    if (granted && !isInitialized) {
      initMetaPixel();
      trackPageView();
    }
  } catch (e) {}
}

/**
 * Internal testing helper to reset deduplication and state between tests.
 */
export function _resetTrackingStateForTesting() {
  lastTrackedPath = null;
  trackedEventCache.clear();
  isInitialized = false;
  if (typeof window !== 'undefined') {
    delete window._easelandMetaPixelReady;
  }
}
