const CACHE="fleetpilot-v12-0-professional-polish";
const ASSETS=["./","./index.html","./styles.css?v=120000","./app.js?v=120000","./cloud-config.js?v=120000","./cloud.js?v=120000","./manifest.webmanifest?v=120000"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
