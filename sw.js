const C="fleetpilot-v11-3-core-repair";
const A=["./","./index.html","./styles.css?v=113000","./app.js?v=113000","./cloud-config.js?v=113000","./cloud.js?v=113000","./manifest.webmanifest?v=113000"];
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));