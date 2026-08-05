const C="fleetpilot-v10-6-2-service-alerts";
const A=["./","./index.html","./styles.css?v=106200","./app.js?v=106200","./cloud-config.js?v=106200","./cloud.js?v=106200","./manifest.webmanifest?v=106200"];
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));