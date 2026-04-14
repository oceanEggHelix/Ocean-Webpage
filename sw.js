const CACHE_NAME = 'ocean-cf-v4';

// Nur statische Assets - KEINE Videos!
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/3danimator.html'
];

self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(asset => 
          cache.add(asset).catch(e => console.warn(`Failed: ${asset}`, e))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // 🔥 CRITICAL: Videos IMMER am Cache vorbei
  if (url.pathname.includes('.webm') || url.pathname.includes('.mp4')) {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      }).catch(() => {
        console.warn('Video fetch failed:', url.pathname);
        return new Response('', { status: 404 });
      })
    );
    return;
  }
  
  // Andere Ressourcen normal cachen
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});