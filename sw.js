const CACHE="fleetpilot-v15-0-mobile-roles-redesign";
const ASSETS=["./","./index.html","./styles.css?v=152000","./app.js?v=152000","./cloud-config.js?v=152000","./cloud.js?v=152000","./manifest.webmanifest?v=152000"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
