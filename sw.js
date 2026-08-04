const C="fleetpilot-v7-11-2";
const A=["./","./index.html","./styles.css?v=7112","./app.js?v=7112","./manifest.webmanifest?v=7112"];
self.addEventListener("install",e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==C).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>e.respondWith(caches.match(e.request).then(response=>response||fetch(e.request))));
