const CACHE="fleetpilot-v19-0-21";
const ASSETS=[
  "./","./index.html","./manifest.webmanifest",
  "./fp-base.css?v=1901800","./fp-service-layout.css?v=1901800","./fp-desktop-gps.css?v=1901800","./fp-cloud-roles.css?v=1901800","./fp-driver.css?v=1901800","./fp-crm-service.css?v=1901800","./fp-current-ui.css?v=1901800","./fp-mobile-v17.css?v=1901800","./fp-mobile-audit-v1916.css?v=1901800",
  "./cloud-config.js?v=1901800","./cloud.js?v=1901800",
  "./fp-core-data.js?v=1902100","./fp-roles-company.js?v=1901800","./fp-driver-portal.js?v=1902100","./fp-router-navigation.js?v=1901800","./fp-files-backups.js?v=1901800","./fp-analytics-dashboard.js?v=1901800","./fp-gps-map.js?v=1901800","./fp-fleet.js?v=1901800","./fp-service-finance.js?v=1901800","./fp-calendar-vehicle.js?v=1901800","./fp-actions-documents.js?v=1902100","./fp-boot-hotfixes.js?v=1901800"
];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
