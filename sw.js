const C="fleetpilot-v12-3-1-click-fix";
const A=["./","./index.html","./styles.css?v=123100","./app.js?v=123100","./cloud-config.js?v=123100","./cloud.js?v=123100","./manifest.webmanifest?v=123100"];
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));