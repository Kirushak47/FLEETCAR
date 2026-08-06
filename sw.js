const CACHE="fleetpilot-v11-3-1-stable-rollback";
const ASSETS=[
  "./",
  "./index.html",
  "./styles.css?v=113110",
  "./app.js?v=113110",
  "./cloud-config.js?v=113110",
  "./cloud.js?v=113110",
  "./manifest.webmanifest?v=113110"
];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
