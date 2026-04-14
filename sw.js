const CACHE_NAME = 'dna-ocean-cache-v10';

const STATIC_ASSETS = [
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

// ─── CLOUDFLARE-FIX: sauberer Video-Fetch ohne Range-Header ──────────────────
async function fetchVideoForCache(url) {
  // Wir nutzen 'cache: "no-store"', um CF zu zwingen, die Datei frisch vom Origin zu holen
  // ohne sie in Teilbereiche zu zerlegen.
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store', 
    headers: {
      'Accept': 'video/webm,video/*;q=0.9',
    }
  });

  if (response.status === 206) {
    // Falls CF trotzdem 206 sendet, müssen wir den Body als Blob konsumieren 
    // und eine neue 200er Response daraus bauen.
    const blob = await response.blob();
    return new Response(blob, {
      status: 200,
      statusText: 'OK',
      headers: response.headers
    });
  }

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}

// ─── INSTALL ──────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Install – Cloudflare-kompatibles Caching startet…');

  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {

      // 1. Statische Assets
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
          console.log('✅ Static:', asset);
        } catch (err) {
          console.warn('❌ Static failed:', asset, err.message);
        }
      }

      // 2. Videos mit Cloudflare-Fix
      for (const videoUrl of VIDEO_ASSETS) {
        try {
          const response = await fetchVideoForCache(videoUrl);
          if (response) {
            await cache.put(videoUrl, response);
            console.log('🎥 Video cached:', videoUrl);
          } else {
            console.warn('⏭ Video skipped (CF 206):', videoUrl);
          }
        } catch (err) {
          console.warn('❌ Video failed:', videoUrl, err.message);
          // NICHT werfen – SW soll trotzdem installieren
        }
      }

      console.log('[SW] Install abgeschlossen.');
      return self.skipWaiting();
    })
  );
});

// ─── ACTIVATE ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('🗑 Alter Cache gelöscht:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

// ─── FETCH ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;

  if (request.method !== 'GET') return;

  // 1. Videos: Cache-First, bei Miss Network + in Cache schreiben
  if (VIDEO_ASSETS.some(v => url.includes(v))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(request);
        if (cached) {
          console.log('🎥 Video aus Cache:', url.split('/').pop());
          return cached;
        }

        // Nicht im Cache → Netzwerk, dann versuchen zu cachen
        console.log('📥 Video vom Netzwerk:', url.split('/').pop());
        try {
          const response = await fetchVideoForCache(url);
          if (response) {
            // clone vor cache.put(), da body sonst consumed
            const clone = response.clone();
            cache.put(request, clone); // async, kein await nötig
            return response;
          }
        } catch (err) {
          console.warn('Video-Fetch fehlgeschlagen:', err.message);
        }

        // Letzter Ausweg: normaler fetch (für Range-Requests des Video-Players)
        return fetch(request);
      })
    );
    return;
  }

  // 2. Statische Assets: Cache-First
  if (STATIC_ASSETS.some(a => url.includes(a))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // 3. HTML-Dokumente: Network-First mit Cache-Fallback
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(request).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // 4. Alles andere: Netzwerk (JS, CSS, CDN)
});