const CACHE="fleetpilot-v19-0-17";
const ASSETS=[
  "./","./index.html","./manifest.webmanifest",
  "./fp-base.css?v=1901700","./fp-service-layout.css?v=1901700","./fp-desktop-gps.css?v=1901700","./fp-cloud-roles.css?v=1901700","./fp-driver.css?v=1901700","./fp-crm-service.css?v=1901700","./fp-current-ui.css?v=1901700","./fp-mobile-v17.css?v=1901700","./fp-mobile-audit-v1916.css?v=1901700",
  "./cloud-config.js?v=1901700","./cloud.js?v=1901700",
  "./fp-core-data.js?v=1901700","./fp-roles-company.js?v=1901700","./fp-driver-portal.js?v=1901700","./fp-router-navigation.js?v=1901700","./fp-files-backups.js?v=1901700","./fp-analytics-dashboard.js?v=1901700","./fp-gps-map.js?v=1901700","./fp-fleet.js?v=1901700","./fp-service-finance.js?v=1901700","./fp-calendar-vehicle.js?v=1901700","./fp-actions-documents.js?v=1901700","./fp-boot-hotfixes.js?v=1901700"
];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
