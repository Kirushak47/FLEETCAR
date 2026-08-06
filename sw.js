const CACHE="fleetpilot-v11-3-3-dashboard-service";
const ASSETS=["./","./index.html","./styles.css?v=113300","./app.js?v=113300","./cloud-config.js?v=113300","./cloud.js?v=113300","./manifest.webmanifest?v=113300"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
