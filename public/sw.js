/*
 * EaseLand Progressive Web App Service Worker
 * Version: 1.0.0
 * Provides robust offline support, intelligent asset caching, and graceful offline fallback.
 */

// Extract version from query param if available (e.g. /sw.js?v=20261022), fallback to v1.0.0
const swQuery = new URLSearchParams(self.location.search);
const SW_VERSION = swQuery.get('v') || 'v1.0.0';
const CACHE_NAME = 'easeland-static-' + SW_VERSION;
const RUNTIME_CACHE = 'easeland-runtime-' + SW_VERSION;

// Core App Shell assets cached during installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/easeland_emblem_transparent.png',
  '/easeland_logo.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon-180x180.png',
  '/icons/apple-touch-icon.png'
];

// Install Event: pre-cache application shell and skip waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use allSettled so a single missing asset does not abort SW installation
      const results = await Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          fetch(url, { cache: 'no-cache' }).then((res) => {
            if (res.ok) {
              return cache.put(url, res);
            }
            return null;
          }).catch((err) => {
            console.warn('[EaseLand SW] Failed to pre-cache:', url, err);
          })
        )
      );
      return self.skipWaiting();
    })
  );
});

// Activate Event: purge stale caches and claim clients immediately
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            console.log('[EaseLand SW] Removing outdated cache:', cacheName);
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: apply tailored caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 2. Bypass Service Worker caching for API, Uploads, Auth, and Analytics endpoints
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/uploads/') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken') ||
    url.hostname.includes('facebook.net') ||
    url.hostname.includes('google-analytics.com')
  ) {
    return;
  }

  // 3. Navigation requests (HTML pages): Network-First with Offline Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // Try matching cached page first
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;

          // Try matching cached root
          const cachedRoot = await caches.match('/');
          if (cachedRoot) return cachedRoot;

          // Otherwise return dedicated offline page
          const offlinePage = await caches.match('/offline.html');
          if (offlinePage) return offlinePage;

          return new Response('Offline - EaseLand is temporarily unreachable', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
          });
        })
    );
    return;
  }

  // 4. Static assets (JS chunks, CSS, images, fonts, icons): Stale-While-Revalidate
  const isStaticAsset =
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.woff2') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('unpkg.com');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Default: Network with Cache Fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});

// Message Event: allow client to trigger skipWaiting or query version
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
