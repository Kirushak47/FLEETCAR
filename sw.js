const C="fleetpilot-v12-6-3-leaflet-runtime-fix";
const CORE=["./","./index.html","./styles.css?v=126300","./app.js?v=126300","./cloud-config.js?v=126300","./cloud.js?v=126300","./manifest.webmanifest?v=126300"];
self.addEventListener("install",event=>event.waitUntil(caches.open(C).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==C).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 const core=url.pathname.endsWith("/")||url.pathname.endsWith("/index.html")||url.pathname.endsWith("/app.js")||url.pathname.endsWith("/styles.css");
 if(core){
  event.respondWith(fetch(request).then(response=>{
   caches.open(C).then(cache=>cache.put(request,response.clone()));
   return response
  }).catch(()=>caches.match(request)));
 }else{
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request)))
 }
});