/*
 * EaseLand Cache Buster Utility Module
 * Provides unified versioning, URL cache busting, and client-side cache invalidation.
 */

const FALLBACK_VERSION = '1.0.0';

/**
 * Returns the current application build version or timestamp
 */
export function getAppVersion() {
  if (typeof __BUILD_TIME__ !== 'undefined' && __BUILD_TIME__) {
    return String(__BUILD_TIME__);
  }
  if (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) {
    return String(__APP_VERSION__);
  }
  return FALLBACK_VERSION;
}

/**
 * Appends a cache-busting parameter to a URL
 * @param {string} url - Target URL or path
 * @param {string} [paramName='_cb'] - Query parameter key
 * @param {string|number} [customValue] - Optional custom cache-buster value
 * @returns {string} URL with cache buster query parameter
 */
export function withCacheBuster(url, paramName = '_cb', customValue = null) {
  if (!url || typeof url !== 'string') return '';

  const value = customValue !== null && customValue !== undefined
    ? String(customValue)
    : getAppVersion();

  // Handle hash fragment if present
  const hashIndex = url.indexOf('#');
  let baseAndQuery = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hashPart = hashIndex === -1 ? '' : url.slice(hashIndex);

  const separator = baseAndQuery.includes('?') ? '&' : '?';
  return baseAndQuery + separator + encodeURIComponent(paramName) + '=' + encodeURIComponent(value) + hashPart;
}

/**
 * Checks if a URL already contains a cache-busting parameter
 * @param {string} url
 * @param {string} [paramName='_cb']
 * @returns {boolean}
 */
export function isCacheBusted(url, paramName = '_cb') {
  if (!url || typeof url !== 'string') return false;
  const regex = new RegExp('[?&]' + paramName + '=[^&#]+');
  return regex.test(url);
}

/**
 * Returns standard HTTP headers to prevent caching
 * @returns {Record<string, string>}
 */
export function getNoCacheHeaders() {
  return {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
}

/**
 * Drop-in wrapper around fetch with automatic cache-busting
 * @param {string} inputUrl
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export async function fetchWithCacheBuster(inputUrl, init = {}) {
  const method = (init.method || 'GET').toUpperCase();
  let finalUrl = inputUrl;

  if (method === 'GET') {
    finalUrl = withCacheBuster(inputUrl);
  }

  const existingHeaders = init.headers || {};
  const noCacheHeaders = method === 'GET' ? getNoCacheHeaders() : {};

  const mergedHeaders = {
    ...noCacheHeaders,
    ...existingHeaders
  };

  return fetch(finalUrl, {
    ...init,
    headers: mergedHeaders
  });
}

/**
 * Purges all client-side browser caches (CacheStorage, service workers)
 */
export async function clearAppCaches() {
  const results = {
    cacheStorageCleared: 0,
    serviceWorkersUpdated: 0
  };

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await window.caches.keys();
      for (let i = 0; i < keys.length; i++) {
        const deleted = await window.caches.delete(keys[i]);
        if (deleted) {
          results.cacheStorageCleared++;
        }
      }
    } catch (e) {
      console.warn('[EaseLand CacheBuster] CacheStorage purge note:', e);
    }
  }

  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let i = 0; i < registrations.length; i++) {
        await registrations[i].update();
        results.serviceWorkersUpdated++;
      }
    } catch (e) {
      console.warn('[EaseLand CacheBuster] ServiceWorker update note:', e);
    }
  }

  return results;
}
