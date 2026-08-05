const C="fleetpilot-cloud-v2-1";
const A=["./","./index.html","./styles.css?v=9210","./app.js?v=9210","./cloud-config.js?v=9210","./cloud.js?v=9210","./manifest.webmanifest?v=9210"];
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
