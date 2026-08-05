const C="fleetpilot-cloud-v1";
const A=["./","./index.html","./styles.css?v=9000","./app.js?v=9000","./cloud-config.js?v=9000","./cloud.js?v=9000","./manifest.webmanifest?v=9000"];
self.addEventListener("install",event=>event.waitUntil(caches.open(C).then(cache=>cache.addAll(A)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==C).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>event.respondWith(caches.match(event.request).then(response=>response||fetch(event.request))));
