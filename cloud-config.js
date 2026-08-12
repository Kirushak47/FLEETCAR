window.FLEETPILOT_CLOUD_CONFIG = Object.freeze({
  url: "https://tbpfasumklpdqwnlfncd.supabase.co",
  publishableKey: "sb_publishable_Y8lMZQN7Fc7V2HAixaZZrA_w-7STzMh",
  ownerEmail: "balyshevy@gmail.com",
  redirectUrl: "https://kirushak47.github.io/FLEETCAR/?email-confirmed=1",
  dashboardUrl: "https://supabase.com/dashboard/project/tbpfasumklpdqwnlfncd"
});

(()=>{
 const supabase=window.supabase;
 if(!supabase?.createClient||supabase.createClient.__fleetPilotSingleton)return;
 const nativeCreate=supabase.createClient.bind(supabase);
 let sharedClient=null,sharedUrl='',sharedKey='';
 const create=function(url,key,options){
  const u=String(url||''),k=String(key||'');
  if(sharedClient&&u===sharedUrl&&k===sharedKey)return sharedClient;
  if(sharedClient&&u!==sharedUrl){console.warn('FleetPilot blocked a second Supabase project client in the same page',u);return sharedClient}
  sharedClient=nativeCreate(url,key,options);sharedUrl=u;sharedKey=k;window.__FLEETPILOT_SUPABASE_CLIENT__=sharedClient;return sharedClient
 };
 create.__fleetPilotSingleton=true;create.__nativeCreateClient=nativeCreate;supabase.createClient=create
})();

/* Route fix must run before normal boot handlers. Drivers used to have no route at all,
   so showPage('driversPage') silently wrote #/fleet and F5 could only restore Autopark. */
function fpInstallStableRoutes(){
 try{
  if(typeof FLEETPILOT_ROUTES==='object')FLEETPILOT_ROUTES.driversPage='drivers';
  if(typeof FLEETPILOT_ROUTE_PAGES==='object')FLEETPILOT_ROUTE_PAGES.drivers='driversPage';
 }catch(error){console.warn('FleetPilot route map patch',error)}

 // Legacy desktop boot must render only; it must never choose the active page/view.
 try{
  if(typeof forceInitialFleetRender==='function'){
   forceInitialFleetRender=function(){
    if(window.innerWidth<1100)return;
    const fleetPage=document.querySelector('#fleetPage');
    if(!fleetPage?.classList.contains('active'))return;
    try{renderFleet?.()}catch{}
    try{renderDesktopCommandKpis?.()}catch{}
    try{renderDesktopEvents?.()}catch{}
    try{renderDesktopInsights?.()}catch{}
    try{renderControlCenterExtras?.()}catch{}
    fleetPilotBootCompleted=true;
   };
   window.forceInitialFleetRender=forceInitialFleetRender;
  }
  if(typeof scheduleInitialFleetBoot==='function'){
   scheduleInitialFleetBoot=function(){
    if(window.innerWidth<1100)return;
    if(!document.querySelector('#fleetPage')?.classList.contains('active'))return;
    requestAnimationFrame(()=>{try{forceInitialFleetRender()}catch{}})
   };
   window.scheduleInitialFleetBoot=scheduleInitialFleetBoot;
  }
 }catch(error){console.warn('FleetPilot desktop boot patch',error)}
}

// Registered from cloud-config, before the later app boot listeners.
document.addEventListener('DOMContentLoaded',fpInstallStableRoutes,{once:true});
window.addEventListener('fleetpilot:access-ready',fpInstallStableRoutes);

window.addEventListener("load",()=>{
 const load=(attr,src)=>{if(document.querySelector(`script[${attr}]`))return;const s=document.createElement('script');s.src=src;s.setAttribute(attr,'1');s.async=false;document.body.appendChild(s)};
 // Old fp-route-stability-v1 intentionally disabled: its MutationObserver/timer restore loop caused visible hangs.
 load('data-fp-critical-consistency','fp-critical-consistency-hotfix.js?v=20260811');
 load('data-fp-driver-assignment-v3','fp-driver-assignment-v3.js?v=20260811d');
 load('data-fp-driver-return-mileage','fp-driver-return-mileage-hotfix.js?v=20260812');
 load('data-fp-ui-completion-v1','fp-ui-completion-v1.js?v=20260812b');
 load('data-fp-fleet-board-v2','fp-fleet-board-v2.js?v=20260812b')
},{once:true});