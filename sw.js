const CACHE="fleetpilot-v11-3-7-service-crm";
const ASSETS=["./","./index.html","./styles.css?v=113700","./app.js?v=113700","./cloud-config.js?v=113700","./cloud.js?v=113700","./manifest.webmanifest?v=113700"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
