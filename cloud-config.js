window.FLEETPILOT_CLOUD_CONFIG = Object.freeze({
  url: "https://tbpfasumklpdqwnlfncd.supabase.co",
  publishableKey: "sb_publishable_Y8lMZQN7Fc7V2HAixaZZrA_w-7STzMh",
  ownerEmail: "balyshevy@gmail.com",
  redirectUrl: "https://fleetpilot.balyshevy.workers.dev/?email-confirmed=1",
  dashboardUrl: "https://supabase.com/dashboard/project/tbpfasumklpdqwnlfncd"
});
(()=>{const supabase=window.supabase;if(!supabase?.createClient||supabase.createClient.__fleetPilotSingleton)return;const nativeCreate=supabase.createClient.bind(supabase);let sharedClient=null,sharedUrl='',sharedKey='';const create=function(url,key,options){const u=String(url||''),k=String(key||'');if(sharedClient&&u===sharedUrl&&k===sharedKey)return sharedClient;if(sharedClient&&u!==sharedUrl){console.warn('FleetPilot blocked a second Supabase project client in the same page',u);return sharedClient}sharedClient=nativeCreate(url,key,options);sharedUrl=u;sharedKey=k;window.__FLEETPILOT_SUPABASE_CLIENT__=sharedClient;return sharedClient};create.__fleetPilotSingleton=true;create.__nativeCreateClient=nativeCreate;supabase.createClient=create})();

/* Mobile role gate: CRM is never revealed before we know whether this session is a driver. */
(()=>{
 const mobile=()=>window.matchMedia?.('(max-width:1099px)').matches;
 if(mobile())document.documentElement.classList.add('fp-mobile-role-gate');
 const style=document.createElement('style');
 style.setAttribute('data-driver-preboot','1');
 style.textContent='@media(max-width:1099px){html.fp-mobile-role-gate body>.app,html.fp-driver-booting body>.app{visibility:hidden!important;pointer-events:none!important}html.fp-driver-booting body>.ambient-background{display:none!important}html.fp-driver-booting body:before{content:"FleetPilot";position:fixed;inset:0;display:grid;place-items:center;background:#f3f5f8;color:#101828;font:800 20px system-ui;z-index:899998}html.fp-driver-booting body:after{content:"";position:fixed;left:50%;top:55%;width:28px;height:28px;margin:-14px;border:3px solid #d0d5dd;border-top-color:#101828;border-radius:50%;animation:fpBootSpin .8s linear infinite;z-index:899999}}';
 document.head.appendChild(style);
 const ensureDriverAssets=()=>{
  if(!document.querySelector('link[data-driver-app-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href='driver-app/app.css?v=210005';l.setAttribute('data-driver-app-css','1');document.head.appendChild(l)}
  if(window.FleetPilot?.DriverApp)return Promise.resolve();
  const existing=document.querySelector('script[data-driver-app]');if(existing)return new Promise(r=>existing.addEventListener('load',r,{once:true}));
  return new Promise(resolve=>{const s=document.createElement('script');s.src='driver-app/app.js?v=210005';s.async=false;s.setAttribute('data-driver-app','1');s.onload=resolve;s.onerror=resolve;document.body.appendChild(s)})
 };
 window.addEventListener('fleetpilot:access-ready',async event=>{
  const role=String(event.detail?.role||window.FleetPilotCloud?.role||'').toLowerCase();
  if(!mobile()){document.documentElement.classList.remove('fp-mobile-role-gate','fp-driver-booting');return}
  if(role==='driver'){
   document.documentElement.classList.add('fp-driver-booting');
   await ensureDriverAssets();
   window.FleetPilot?.DriverApp?.mount?.();
  }else{
   document.documentElement.classList.remove('fp-mobile-role-gate','fp-driver-booting');
  }
 },{capture:true});
 window.addEventListener('resize',()=>{if(!mobile())document.documentElement.classList.remove('fp-mobile-role-gate','fp-driver-booting')});
})();

function fpLegacyBootShim(){try{if(typeof FLEETPILOT_ROUTES==='object')FLEETPILOT_ROUTES.driversPage='drivers';if(typeof FLEETPILOT_ROUTE_PAGES==='object')FLEETPILOT_ROUTE_PAGES.drivers='driversPage';if(typeof forceInitialFleetRender==='function'){const renderOnly=function(){if(window.innerWidth<1100||!document.querySelector('#fleetPage')?.classList.contains('active'))return;try{renderFleet?.()}catch{}try{renderDesktopCommandKpis?.()}catch{}try{renderDesktopEvents?.()}catch{}try{renderDesktopInsights?.()}catch{}try{renderControlCenterExtras?.()}catch{}try{fleetPilotBootCompleted=true}catch{}};try{forceInitialFleetRender=renderOnly}catch{}window.forceInitialFleetRender=renderOnly}if(typeof scheduleInitialFleetBoot==='function'){const schedule=function(){if(window.innerWidth<1100||!document.querySelector('#fleetPage')?.classList.contains('active'))return;requestAnimationFrame(()=>window.forceInitialFleetRender?.())};try{scheduleInitialFleetBoot=schedule}catch{}window.scheduleInitialFleetBoot=schedule}}catch(error){console.warn('FleetPilot legacy boot shim',error)}}
document.addEventListener('DOMContentLoaded',fpLegacyBootShim,{once:true});window.addEventListener('fleetpilot:access-ready',fpLegacyBootShim);
window.addEventListener('load',()=>{const load=(attr,src)=>new Promise(resolve=>{if(document.querySelector(`script[${attr}]`))return resolve();const s=document.createElement('script');s.src=src;s.setAttribute(attr,'1');s.async=false;s.onload=resolve;s.onerror=()=>{console.error('FleetPilot module load failed',src);resolve()};document.body.appendChild(s)});const css=(attr,href)=>{if(document.querySelector(`link[${attr}]`))return;const l=document.createElement('link');l.rel='stylesheet';l.href=href;l.setAttribute(attr,'1');document.head.appendChild(l)};(async()=>{
 await load('data-fp20-core','modules/core/runtime.js?v=200002');
 await load('data-fp20-router','modules/router/router.js?v=200001');
 await load('data-fp20-boot','modules/core/boot.js?v=200001');
 await load('data-fp20-fleet-status','modules/fleet/status.js?v=200001');
 await load('data-fp20-driver-state','modules/drivers/state.js?v=200001');
 await load('data-fp20-fleet-board','modules/fleet/board.js?v=200003');
 await load('data-fp20-driver-assignment','modules/drivers/assignment.js?v=200001');
 await load('data-fp20-mileage','modules/fleet/mileage.js?v=200001');
 await load('data-fp20-ui-completion','modules/ui/completion.js?v=200001');
 await load('data-fp-critical-consistency','fp-critical-consistency-hotfix.js?v=20260811');
 await load('data-fp-v19-expense-service','modules/finance/expense-service-v19-behavior.js?v=200001');
 css('data-driver-app-css','driver-app/app.css?v=210005');
 await load('data-driver-app','driver-app/app.js?v=210005');
 await load('data-fp-live-permissions','modules/roles/live-permissions.js?v=210004');
 window.dispatchEvent(new CustomEvent('fleetpilot:modules-ready',{detail:{version:'21.0.0-driver-isolated-boot'}}));
 try{window.FleetPilot?.FleetBoard?.render?.()}catch{}
})();},{once:true});