const CACHE_NAME = 'dna-ocean-cache-v8';

// NUR EXPLIZITE DATEIPFADE - keine Root-URLs
const RESOURCES_TO_CACHE = [
  // Explizite HTML Pfade
  '/index.html',
  '/3danimator.html',
  
  // CSS
  //'/css/styles.css',
  


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
  //'/assets/gallery/time_stretch.jpg',
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
  if (url.includes('ocean-Mobile') || url.includes('BigBuckBunny')) {
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

  // 2. THREE.JS MODULE Requests
  if (url.includes('/js/three/') || url.includes('.module.js')) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            console.log('📦 Three.js module from cache');
            return response;
          }
          
          return fetch(request)
            .then(networkResponse => {
              if (networkResponse.ok) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(request, responseClone));
              }
              return networkResponse;
            })
            .catch(error => {
              console.error('Three.js module fetch failed:', error);
              return new Response('// Offline fallback', {
                headers: { 'Content-Type': 'application/javascript' }
              });
            });
        })
    );
    return;
  }

  // 3. HTML/CSS Requests (nur explizite Dateien)
  if (request.destination === 'document' || request.destination === 'style') {
    event.respondWith(
      caches.match(request)
        .then(response => {
          // Aus Cache zurückgeben falls vorhanden
          if (response) {
            return response;
          }
          
          // Vom Netzwerk laden
          return fetch(request)
            .then(networkResponse => {
              // Nur erfolgreiche Responses cachen
              if (networkResponse && networkResponse.status === 200) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(request, responseToCache));
              }
              return networkResponse;
            })
            .catch(error => {
              console.log('Fetch failed:', getFilename(url));
              // Für HTML: Fallback zur index.html
              if (request.destination === 'document') {
                return caches.match('/index.html');
              }
              return new Response('// Offline');
            });
        })
    );
  }
});

// Hilfsfunktion für lesbare Logs
function getFilename(url) {
  return url.split('/').pop() || url;
}