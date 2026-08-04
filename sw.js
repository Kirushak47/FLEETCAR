const C="fleetpilot-v7-5-4";
const A=["./","./index.html","./styles.css?v=754","./app.js?v=754","./manifest.webmanifest?v=754"];
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))));
