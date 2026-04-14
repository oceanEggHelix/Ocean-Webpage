const CACHE_NAME = 'ocean-pwa-v11';
const OFFLINE_URL = '/offline.html';

// Dynamische Asset-Erkennung - KEINE festen Pfade mehr!
const STATIC_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/3danimator.html'
];

// Dynamisch cachen - was wirklich existiert
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      
      // Nur wirklich vorhandene Ressourcen cachen
      for (const asset of STATIC_CACHE) {
        try {
          const response = await fetch(asset, { cache: 'reload' });
          if (response && response.ok) {
            await cache.put(asset, response);
            console.log(`✅ Cached: ${asset}`);
          } else {
            console.warn(`⚠️ Not found: ${asset}`);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to cache ${asset}:`, error.message);
        }
      }
      
      // Videos separat mit besserer Strategie
      const videos = ['/assets/ocean-Mobile.webm', '/assets/ocean-Desktop.webm'];
      for (const video of videos) {
        try {
          const response = await fetch(video, { cache: 'reload' });
          if (response && response.ok) {
            await cache.put(video, response);
            console.log(`✅ Video cached: ${video}`);
          }
        } catch (error) {
          console.warn(`⚠️ Video not available: ${video}`);
        }
      }
      
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    (async () => {
      // Lösche alte Caches
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            console.log(`🗑️ Deleting old cache: ${name}`);
            return caches.delete(name);
          }
        })
      );
      await self.clients.claim();
      console.log('[SW] Ready for offline');
    })()
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Nur eigene Domain
  if (url.origin !== self.location.origin) return;
  
  // Nur GET Requests
  if (request.method !== 'GET') return;
  
  // HTML: Cache First mit Offline-Fallback
  if (request.destination === 'document') {
    event.respondWith(
      (async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          console.log(`📄 Cache hit: ${url.pathname}`);
          return cachedResponse;
        }
        
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          console.log(`📄 Offline fallback for: ${url.pathname}`);
          const offlinePage = await caches.match(OFFLINE_URL);
          return offlinePage || new Response('Offline - Bitte verbinde dich mit dem Internet', {
            status: 503,
            headers: { 'Content-Type': 'text/html' }
          });
        }
      })()
    );
    return;
  }
  
  // Assets (Bilder, CSS, JS): Cache First
  if (request.destination === 'image' || 
      request.destination === 'style' || 
      request.destination === 'script' ||
      url.pathname.includes('/assets/')) {
    event.respondWith(
      (async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          // Für Bilder: Transparentes Placeholder
          if (request.destination === 'image') {
            return new Response('', { status: 204 });
          }
          console.warn(`Failed to fetch: ${url.pathname}`);
          return new Response('Not available offline', { status: 404 });
        }
      })()
    );
    return;
  }
  
  // Videos: Network First (bessere Qualität)
  if (url.pathname.includes('.webm') || url.pathname.includes('.mp4')) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            console.log(`🎥 Video from cache: ${url.pathname}`);
            return cachedResponse;
          }
          return new Response('Video not available offline', { status: 404 });
        }
      })()
    );
    return;
  }
  
  // Alles andere: Network with Cache Fallback
  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        const cachedResponse = await caches.match(request);
        return cachedResponse || new Response('Resource not available', { status: 404 });
      }
    })()
  );
});