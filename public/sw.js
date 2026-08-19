const CACHE_NAME = 'suguba-pwa-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/reseller',
  '/reseller/catalog',
  '/reseller/badge',
  '/reseller/calculator',
  '/reseller/channels',
  '/reseller/academy',
  '/reseller/story-generator',
  '/reseller/orders',
  '/reseller/payouts',
  '/reseller/referrals',
  '/driver',
  '/driver/earnings',
  '/supplier',
  '/supplier/ambassadors',
  '/supplier/inventory',
  '/admin',
  '/admin/broadcast',
  '/admin/reports/daily',
  '/admin/sav',
  '/admin/launch-checklist',
  '/diaspora',
  '/b2b/partner',
  '/b2b/quote',
  '/login',
];

// Install Event: Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event: Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Network-first with Cache fallback for reliable 2G/3G/4G in Bamako & Regions
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Cache images & static assets with cache-first strategy
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.hostname.includes('unsplash.com') ||
    url.hostname.includes('quickchart.io') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.svg')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);
      })
    );
    return;
  }

  // Network-first for pages and data, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return caches.match('/');
        });
      })
  );
});
