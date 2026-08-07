const CACHE="fleetpilot-v11-3-9-4-auth-route-boot-fix";
const ASSETS=["./","./index.html","./styles.css?v=113940","./app.js?v=113940","./cloud-config.js?v=113940","./cloud.js?v=113940","./manifest.webmanifest?v=113940"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
