const C="fleetpilot-v8-0-2";
const A=["./","./index.html","./styles.css?v=8002","./app.js?v=8002","./manifest.webmanifest?v=8002"];
self.addEventListener("install",event=>event.waitUntil(
 caches.open(C).then(cache=>cache.addAll(A)).then(()=>self.skipWaiting())
));
self.addEventListener("activate",event=>event.waitUntil(
 caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==C).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
));
self.addEventListener("fetch",event=>event.respondWith(
 caches.match(event.request).then(response=>response||fetch(event.request))
));