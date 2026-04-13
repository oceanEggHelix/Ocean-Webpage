const CACHE_NAME = 'ocean-assets-v1';

const ASSETS = [
  '/assets/ocean-Mobile.webm',
  '/assets/ocean-Desktop.webm',
  '/assets/tsde_demo_cover.jpg',
  '/assets/gallery/tsde_engine.jpg',
  '/assets/gallery/motion_synth.jpg',
  '/assets/gallery/camera_rig.jpg',
  '/assets/gallery/spline_editor.jpg',
  '/assets/gallery/Blender_Host1.jpg',
  '/assets/gallery/Blender_Host2.jpg',
  '/assets/gallery/live_control.jpg',
  '/assets/gallery/Blender_Host3.jpg',
  '/assets/gallery/Blender_Host4.jpg'
];

self.addEventListener('install', event => {
  console.log('[SW] Install – caching assets…');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Adding assets:', ASSETS);
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] Activate – cleaning old caches…');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // HTML, JS, CSS, CDN → NICHT abfangen
  if (event.request.destination === 'document' ||
      event.request.destination === 'script' ||
      event.request.destination === 'style' ||
      url.origin !== location.origin) {
    return;
  }

  // Nur Assets cachen
  if (url.pathname.startsWith('/assets/')) {
    console.log('[SW] Asset request:', url.pathname);

    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          console.log('[SW] Cache hit:', url.pathname);
          return cached;
        }

        console.log('[SW] Network fetch:', url.pathname);
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            console.log('[SW] Caching new asset:', url.pathname);
            cache.put(event.request, clone);
          });
          return response;
        });
      })
    );
  }
});