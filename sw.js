const C="fleetpilot-v11-2-vehicle-alerts";
const A=["./","./index.html","./styles.css?v=112000","./app.js?v=112000","./cloud-config.js?v=112000","./cloud.js?v=112000","./manifest.webmanifest?v=112000"];
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));