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

/* Compatibility shim for the legacy boot. It will disappear when the legacy files are fully split.
   It only prevents the old desktop renderer from choosing Autopark during page refresh. */
function fpLegacyBootShim(){
 try{
  if(typeof FLEETPILOT_ROUTES==='object')FLEETPILOT_ROUTES.driversPage='drivers';
  if(typeof FLEETPILOT_ROUTE_PAGES==='object')FLEETPILOT_ROUTE_PAGES.drivers='driversPage';
  if(typeof forceInitialFleetRender==='function'){
   const renderOnly=function(){if(window.innerWidth<1100||!document.querySelector('#fleetPage')?.classList.contains('active'))return;try{renderFleet?.()}catch{}try{renderDesktopCommandKpis?.()}catch{}try{renderDesktopEvents?.()}catch{}try{renderDesktopInsights?.()}catch{}try{renderControlCenterExtras?.()}catch{}try{fleetPilotBootCompleted=true}catch{}};
   try{forceInitialFleetRender=renderOnly}catch{}window.forceInitialFleetRender=renderOnly;
  }
  if(typeof scheduleInitialFleetBoot==='function'){
   const schedule=function(){if(window.innerWidth<1100||!document.querySelector('#fleetPage')?.classList.contains('active'))return;requestAnimationFrame(()=>window.forceInitialFleetRender?.())};
   try{scheduleInitialFleetBoot=schedule}catch{}window.scheduleInitialFleetBoot=schedule;
  }
 }catch(error){console.warn('FleetPilot legacy boot shim',error)}
}
document.addEventListener('DOMContentLoaded',fpLegacyBootShim,{once:true});
window.addEventListener('fleetpilot:access-ready',fpLegacyBootShim);

window.addEventListener("load",()=>{
 const load=(attr,src)=>new Promise(resolve=>{if(document.querySelector(`script[${attr}]`))return resolve();const s=document.createElement('script');s.src=src;s.setAttribute(attr,'1');s.async=false;s.onload=resolve;s.onerror=()=>{console.error('FleetPilot module load failed',src);resolve()};document.body.appendChild(s)});
 (async()=>{
  await load('data-fp20-core','modules/core/runtime.js?v=200001');
  await load('data-fp20-router','modules/router/router.js?v=200001');
  await load('data-fp20-boot','modules/core/boot.js?v=200001');
  await load('data-fp20-fleet-status','modules/fleet/status.js?v=200001');
  await load('data-fp20-driver-state','modules/drivers/state.js?v=200001');
  await load('data-fp20-fleet-board','modules/fleet/board.js?v=200001');
  // Compatibility patches not migrated yet.
  await load('data-fp-critical-consistency','fp-critical-consistency-hotfix.js?v=20260811');
  await load('data-fp-driver-assignment-v3','fp-driver-assignment-v3.js?v=20260811d');
  await load('data-fp-driver-return-mileage','fp-driver-return-mileage-hotfix.js?v=20260812');
  await load('data-fp-ui-completion-v1','fp-ui-completion-v1.js?v=20260812b');
  window.dispatchEvent(new CustomEvent('fleetpilot:modules-ready',{detail:{version:'20.0.0-alpha.1'}}));
 })();
},{once:true});