const C="fleetpilot-v12-6-2-white-screen-fix";
const CORE=["./","./index.html","./styles.css?v=126200","./app.js?v=126200","./cloud-config.js?v=126200","./cloud.js?v=126200","./manifest.webmanifest?v=126200"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(C).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()))
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==C).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 const isCore=url.pathname.endsWith("/")||url.pathname.endsWith("/index.html")||url.pathname.endsWith("/app.js")||url.pathname.endsWith("/styles.css");
 if(isCore){
  event.respondWith(fetch(request).then(response=>{
   const copy=response.clone();
   caches.open(C).then(cache=>cache.put(request,copy));
   return response
  }).catch(()=>caches.match(request)));
  return
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request)))
});