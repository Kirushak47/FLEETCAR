const CACHE="fleetpilot-v14-2-3-navigation-fix";
const ASSETS=["./","./index.html","./styles.css?v=142500","./app.js?v=142500","./cloud-config.js?v=142500","./cloud.js?v=142500","./manifest.webmanifest?v=142500"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
