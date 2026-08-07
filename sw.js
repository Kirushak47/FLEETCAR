const CACHE="fleetpilot-v13-1-5-global-service-search";
const ASSETS=["./","./index.html","./styles.css?v=131500","./app.js?v=131500","./cloud-config.js?v=131500","./cloud.js?v=131500","./manifest.webmanifest?v=131500"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
