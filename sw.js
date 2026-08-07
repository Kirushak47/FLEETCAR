const CACHE="fleetpilot-v13-1-1-service-layout-fix";
const ASSETS=["./","./index.html","./styles.css?v=131100","./app.js?v=131100","./cloud-config.js?v=131100","./cloud.js?v=131100","./manifest.webmanifest?v=131100"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
