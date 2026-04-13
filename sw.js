const CACHE_NAME = 'dna-ocean-cache-v9';

// NUR EXPLIZITE DATEIPFADE - keine Root-URLs
const RESOURCES_TO_CACHE = [
  // Explizite HTML Pfade
  '/index.html',
  '/3danimator.html',
  
  // CDN Ressourcen (Three.js)
  'https://unpkg.com/three@0.128.0/build/three.module.js',
  'https://unpkg.com/three@0.128.0/examples/jsm/controls/OrbitControls.js',
  
  // Videos
  '/assets/ocean-Mobile.webm',
  '/assets/ocean-Desktop.webm',

  // Bilder
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
  console.log('Service Worker installing - caching resources');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // 1. ZUERST: Statische Ressourcen cachen (mit Error-Handling)
        const staticResources = RESOURCES_TO_CACHE.filter(url => 
          !url.includes('.webm') && !url.includes('.mp4')
        );
        
        console.log('Caching static resources:', staticResources);
        
        // cache.addAll mit individuellem Error-Handling
        return Promise.allSettled(
          staticResources.map(resource => {
            return cache.add(resource)
              .then(() => console.log(`✅ Cached: ${resource}`))
              .catch(error => console.error(`❌ Failed to cache ${resource}:`, error));
          })
        ).then(results => {
          console.log('Static resources caching completed');
          
          // 2. DANACH: Videos separat cachen
          const videoResources = RESOURCES_TO_CACHE.filter(url => 
            url.includes('.webm') || url.includes('.mp4')
          );
          
          if (videoResources.length > 0) {
            console.log('Now caching videos:', videoResources);
            return Promise.allSettled(
              videoResources.map(videoUrl => {
                return fetch(videoUrl, { cache: 'reload' })
                  .then(response => {
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    console.log(`✅ Video fetched: ${videoUrl}`);
                    return cache.put(videoUrl, response);
                  })
                  .then(() => console.log(`✅ Video cached: ${videoUrl}`))
                  .catch(error => console.error(`❌ Video caching failed for ${videoUrl}:`, error));
              })
            );
          }
        }).then(() => {
          console.log('All caching operations completed');
          return self.skipWaiting();
        });
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker ready');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = request.url;

  // Nur GET Requests cachen
  if (request.method !== 'GET') return;

  // 1. VIDEO Requests
  if (url.includes('ocean-Mobile') || url.includes('ocean-Desktop') || url.includes('.webm') || url.includes('.mp4')) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            console.log('🎥 Video from cache:', getFilename(url));
            return response;
          }
          console.log('📥 Video from network:', getFilename(url));
          return fetch(request);
        })
    );
    return;
  }

  // 2. THREE.JS CDN Requests (wichtig für Cloudflare)
  if (url.includes('unpkg.com/three') || url.includes('cdn.jsdelivr.net/npm/three') || url.includes('.module.js')) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            console.log('📦 Three.js module from cache:', getFilename(url));
            return response;
          }
          
          return fetch(request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.ok) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(request, responseClone))
                  .catch(err => console.warn('Could not cache Three.js module:', err));
              }
              return networkResponse;
            })
            .catch(error => {
              console.error('Three.js module fetch failed:', error, url);
              // Fallback: Versuche es mit einem anderen CDN
              if (url.includes('unpkg.com')) {
                const fallbackUrl = url.replace('unpkg.com', 'cdn.jsdelivr.net/npm');
                return fetch(fallbackUrl);
              }
              return new Response('// Offline fallback - Three.js module not available', {
                status: 503,
                headers: { 'Content-Type': 'application/javascript' }
              });
            });
        })
    );
    return;
  }

  // 3. HTML/CSS/JS Requests (lokale Dateien)
  if (request.destination === 'document' || 
      request.destination === 'style' || 
      request.destination === 'script' ||
      url.includes('/assets/')) {
    
    event.respondWith(
      caches.match(request)
        .then(response => {
          // Aus Cache zurückgeben falls vorhanden
          if (response) {
            console.log('📄 From cache:', getFilename(url));
            return response;
          }
          
          // Vom Netzwerk laden
          return fetch(request)
            .then(networkResponse => {
              // Nur erfolgreiche Responses cachen
              if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(request, responseToCache))
                  .catch(err => console.warn('Could not cache:', getFilename(url), err));
              }
              return networkResponse;
            })
            .catch(error => {
              console.log('Fetch failed:', getFilename(url));
              // Für HTML: Fallback zur index.html
              if (request.destination === 'document') {
                return caches.match('/index.html');
              }
              return new Response('// Offline - resource not available', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' }
              });
            });
        })
    );
    return;
  }

  // 4. Alle anderen Requests (Bilder, etc.) - Cache First
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, responseToCache));
          }
          return networkResponse;
        });
      })
      .catch(() => {
        // Fallback für Bilder
        if (request.destination === 'image') {
          return new Response('Image not available', { status: 404 });
        }
        return new Response('Offline', { status: 503 });
      })
  );
});

// Hilfsfunktion für lesbare Logs
function getFilename(url) {
  return url.split('/').pop() || url;
}