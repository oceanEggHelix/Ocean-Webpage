const CACHE_NAME = 'dna-ocean-cache-v9';

// Statische Assets (HTML bewusst NICHT drin!)
const STATIC_ASSETS = [
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

// Videos – werden wie bei Netlify SOFORT gecached
const VIDEO_ASSETS = [
  '/assets/ocean-Mobile.webm',
  '/assets/ocean-Desktop.webm'
];

self.addEventListener('install', event => {
  console.log('[SW] Install – caching static assets & videos…');

  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {

      // 1. Statische Assets cachen
      console.log('[SW] Caching static assets:', STATIC_ASSETS);
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
          console.log('✅ Cached:', asset);
        } catch (err) {
          console.warn('❌ Failed:', asset, err);
        }
      }

      // 2. Videos hart & sofort cachen (wie bei Netlify)
      console.log('[SW] Pre-caching videos:', VIDEO_ASSETS);
      for (const video of VIDEO_ASSETS) {
        try {
          const response = await fetch(video, { cache: 'reload' });
          if (!response.ok) throw new Error(response.status);
          await cache.put(video, response.clone());
          console.log('🎥 Video cached:', video);
        } catch (err) {
          console.warn('❌ Video failed:', video, err);
        }
      }

      console.log('[SW] All caching done.');
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activate – cleaning old caches…');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) {
          console.log('🗑 Deleting old cache:', key);
          return caches.delete(key);
        }
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  if (event.request.method !== 'GET') return;

  // 1. VIDEO: Cache First
  if (VIDEO_ASSETS.some(v => url.includes(v))) {
    const filename = url.split('/').pop();
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          console.log('🎥 Video from cache:', filename);
          return cached;
        }
        console.log('📥 Video from network:', filename);
        return fetch(event.request);
      })
    );
    return;
  }

  // 2. STATIC ASSETS: Cache First
  if (STATIC_ASSETS.some(a => url.includes(a))) {
    const filename = url.split('/').pop();
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          console.log('🖼 Asset from cache:', filename);
          return cached;
        }
        return fetch(event.request).then(resp => {
          if (resp.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, resp.clone()));
          }
          return resp;
        });
      })
    );
    return;
  }

  // 3. ALLES ANDERE → Netzwerk (HTML, JS, CDN)
});