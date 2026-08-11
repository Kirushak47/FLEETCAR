const CACHE="fleetpilot-v19-0-44-mobile-assignment-stability";
const ASSETS=[
  "./","./index.html","./manifest.webmanifest",
  "./fp-base.css?v=1903300","./fp-service-layout.css?v=1903300","./fp-desktop-gps.css?v=1903300","./fp-cloud-roles.css?v=1903300","./fp-driver.css?v=1903300","./fp-crm-service.css?v=1903300","./fp-current-ui.css?v=1903300","./fp-mobile-v17.css?v=1903300","./fp-mobile-audit-v1916.css?v=1903300",
  "./cloud-config.js?v=1903300","./cloud.js?v=1903300",
  "./fp-core-data.js?v=1903300","./fp-roles-company.js?v=1903300","./fp-driver-portal.js?v=1903300","./fp-router-navigation.js?v=1903300","./fp-files-backups.js?v=1903300","./fp-analytics-dashboard.js?v=1903300","./fp-gps-map.js?v=1903300","./fp-fleet.js?v=1903300","./fp-service-finance.js?v=1903300","./fp-calendar-vehicle.js?v=1903300","./fp-actions-documents.js?v=1903300","./fp-boot-hotfixes.js?v=1903300","./fp-critical-consistency-hotfix.js?v=20260811","./fp-driver-assignment-v3.js?v=20260811d","./fp-operational-domain-v1.js?v=20260812b"
];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{if(event.request.method!=="GET")return;event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
