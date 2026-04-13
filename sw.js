const CACHE_NAME = 'ocean-assets-v2';

// Assets (Bilder etc.)
const ASSETS = [
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

// Videos separat – werden sofort gecached
const VIDEOS = [
  '/assets/ocean-Mobile.webm',
  '/assets/ocean-Desktop.webm'
];

self.addEventListener('install', event => {
  console.log('[SW] Install – caching assets & videos…');

  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('[SW] Caching static assets:', ASSETS);
      await cache.addAll(ASSETS);

      console.log('[SW] Pre-caching videos:', VIDEOS);
      for (const video of VIDEOS) {
        try {
          const response = await fetch(video, { cache: 'reload' });
          await cache.put(video, response.clone());
          console.log('[SW] Video cached:', video);
        } catch (err) {
          console.warn('[SW] Failed to cache video:', video, err);
        }
      }
    })
  );

  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] Activate – cleaning old caches…');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // HTML, JS, CSS, CDN → nicht anfassen
  if (event.request.destination === 'document' ||
      event.request.destination === 'script' ||
      event.request.destination === 'style' ||
      url.origin !== location.origin) {
    return;
  }

  // VIDEO: Cache First
  if (VIDEOS.includes(url.pathname)) {
    console.log('[SW] Video request:', url.pathname);

    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          console.log('[SW] Video cache hit:', url.pathname);
          return cached;
        }

        console.log('[SW] Video network fetch:', url.pathname);
        return fetch(event.request).then(response => {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          return response;
        });
      })
    );
    return;
  }

  // Assets: Cache First
  if (ASSETS.includes(url.pathname)) {
    console.log('[SW] Asset request:', url.pathname);

    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          console.log('[SW] Asset cache hit:', url.pathname);
          return cached;
        }

        return fetch(event.request).then(response => {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
          return response;
        });
      })
    );
  }
});