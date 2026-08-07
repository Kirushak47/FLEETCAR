const CACHE="fleetpilot-v14-2-3-navigation-fix";
const ASSETS=["./","./index.html","./styles.css?v=142600","./app.js?v=142600","./cloud-config.js?v=142600","./cloud.js?v=142600","./manifest.webmanifest?v=142600"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
