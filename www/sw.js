const CACHE_NAME = 'holy-emis-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/login.html',
  '/admin.html',
  '/parent.html',
  '/manifest.json',
  '/admin-desktop.css',
  '/admin-mobile.css',
  '/shared.js',
  '/config.js',
  '/supabase.js',
  '/libs/supabase.umd.js',
  '/libs/lucide.min.js',
  '/libs/xlsx.full.min.js',
  '/nepali.datepicker.v3.0.0.min.css',
  '/nepali.datepicker.v3.0.0.min.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Do not intercept supabase API requests
  if (event.request.url.includes('supabase.co')) {
    return;
  }
  
  // Cache-first strategy for local assets
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }
      return fetch(event.request).then(fetchResponse => {
        if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
          return fetchResponse;
        }
        const responseToCache = fetchResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return fetchResponse;
      });
    })
  );
});