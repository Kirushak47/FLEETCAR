const CACHE="fleetpilot-v18-9-supabase-handover-400-fix";
const ASSETS=[
  "./","./index.html","./manifest.webmanifest",
  "./fp-base.css?v=180000","./fp-service-layout.css?v=180000","./fp-desktop-gps.css?v=180000","./fp-cloud-roles.css?v=180000","./fp-driver.css?v=180000","./fp-crm-service.css?v=180000","./fp-current-ui.css?v=187000","./fp-mobile-v17.css?v=180000",
  "./cloud-config.js?v=180000","./cloud.js?v=189000",
  "./fp-core-data.js?v=187000","./fp-roles-company.js?v=186000","./fp-driver-portal.js?v=189000","./fp-router-navigation.js?v=185000","./fp-files-backups.js?v=180000","./fp-analytics-dashboard.js?v=180000","./fp-gps-map.js?v=180000","./fp-fleet.js?v=187000","./fp-service-finance.js?v=180000","./fp-calendar-vehicle.js?v=185000","./fp-actions-documents.js?v=180000","./fp-boot-hotfixes.js?v=180000"
];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
