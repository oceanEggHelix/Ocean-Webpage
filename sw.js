const CACHE_NAME = 'dna-ocean-cache-v11';

const STATIC_ASSETS = [
  '/', // Wichtig für Cloudflare Pages Root-Zugriff
  '/index.html',
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

const VIDEO_ASSETS = [
  '/assets/ocean-Mobile.webm',
  '/assets/ocean-Desktop.webm'
];

// --- HELPER: Erzeugt eine 206 Partial Response aus einer 200er Cache-Response ---
async function createPartialResponse(request, cachedResponse) {
  const arrayBuffer = await cachedResponse.arrayBuffer();
  const rangeHeader = request.headers.get('range');
  const match = rangeHeader.match(/bytes=(\d+)-(\d+)?/);
  
  if (match) {
    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : arrayBuffer.byteLength - 1;
    const slicedBuffer = arrayBuffer.slice(start, end + 1);
    
    return new Response(slicedBuffer, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type': cachedResponse.headers.get('Content-Type') || 'video/webm',
        'Content-Range': `bytes ${start}-${end}/${arrayBuffer.byteLength}`,
        'Content-Length': slicedBuffer.byteLength,
        'Accept-Ranges': 'bytes'
      }
    });
  }
  return new Response(arrayBuffer, { headers: cachedResponse.headers });
}

// --- CLOUDFLARE-FIX: Video sauber in den Cache laden ---
async function fetchVideoForCache(url) {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: { 'Accept': 'video/webm,video/*;q=0.9' }
  });

  if (response.status === 206 || response.ok) {
    const blob = await response.blob();
    return new Response(blob, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'video/webm',
        'Content-Length': blob.size
      }
    });
  }
  throw new Error(`HTTP ${response.status}`);
}

// --- INSTALL ---
self.addEventListener('install', event => {
  console.log('[SW] Install gestartet...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Statics
      for (const asset of STATIC_ASSETS) {
        try { await cache.add(asset); } catch (e) { console.warn('Fail:', asset); }
      }
      // Videos
      for (const video of VIDEO_ASSETS) {
        try {
          const res = await fetchVideoForCache(video);
          await cache.put(video, res);
        } catch (e) { console.warn('Video Fail:', video); }
      }
      return self.skipWaiting();
    })
  );
});

// --- ACTIVATE ---
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// --- FETCH ---
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // A. VIDEO HANDLING (mit Range-Support für Scroll)
  if (VIDEO_ASSETS.some(v => url.pathname.includes(v))) {
    event.respondWith(
      caches.match(request).then(async cachedResponse => {
        if (cachedResponse) {
          if (request.headers.has('range')) {
            return createPartialResponse(request, cachedResponse);
          }
          return cachedResponse;
        }
        return fetch(request);
      })
    );
    return;
  }

  // B. NAVIGATION / HTML (Offline Fix für Cloudflare Pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match('/') || caches.match('/index.html'))
    );
    return;
  }

  // C. STATISCHE ASSETS & REST
  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request).then(res => {
        if (res.ok && res.status !== 206) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return res;
      });
    })
  );
});