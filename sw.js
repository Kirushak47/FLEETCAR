const CACHE="fleetpilot-v19-0-31";
const ASSETS=[
  "./","./index.html","./manifest.webmanifest",
  "./fp-base.css?v=1903100","./fp-service-layout.css?v=1903100","./fp-desktop-gps.css?v=1903100","./fp-cloud-roles.css?v=1903100","./fp-driver.css?v=1903100","./fp-crm-service.css?v=1903100","./fp-current-ui.css?v=1903100","./fp-mobile-v17.css?v=1903100","./fp-mobile-audit-v1916.css?v=1903100",
  "./cloud-config.js?v=1903100","./cloud.js?v=1903100",
  "./fp-core-data.js?v=1903100","./fp-roles-company.js?v=1903100","./fp-driver-portal.js?v=1903100","./fp-router-navigation.js?v=1903100","./fp-files-backups.js?v=1903100","./fp-analytics-dashboard.js?v=1903100","./fp-gps-map.js?v=1903100","./fp-fleet.js?v=1903100","./fp-service-finance.js?v=1903100","./fp-calendar-vehicle.js?v=1903100","./fp-actions-documents.js?v=1903100","./fp-boot-hotfixes.js?v=1903100"
];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
