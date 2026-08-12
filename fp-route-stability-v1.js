/* FleetPilot Route Stability V1 — keep current section on refresh */
(()=>{
'use strict';
if(window.__fpRouteStabilityV1)return;window.__fpRouteStabilityV1=true;
const initialHash=String(location.hash||'');
const initialRoute=initialHash.replace(/^#\/?/,'');

// The old desktop boot helper forcibly activated fleetPage/list on every boot.
// Never allow a desktop render helper to decide navigation.
if(typeof window.forceInitialFleetRender==='function'){
  window.forceInitialFleetRender=function(){
    try{
      const active=document.querySelector('.page.active');
      if(active?.id!=='fleetPage')return;
      window.renderFleet?.();
      window.renderDesktopCommandKpis?.();
      window.renderDesktopEvents?.();
      window.renderDesktopInsights?.();
      window.renderControlCenterExtras?.();
    }catch(e){console.warn('FleetPilot stable fleet boot',e)}
  };
}
if(typeof window.scheduleInitialFleetBoot==='function'){
  window.scheduleInitialFleetBoot=function(){
    if(window.innerWidth<1100)return;
    const active=document.querySelector('.page.active');
    if(active?.id!=='fleetPage')return;
    requestAnimationFrame(()=>window.forceInitialFleetRender?.());
  };
}

function restoreInitialRoute(){
  if(!initialRoute)return;
  // Only restore if the URL itself was not changed by the user meanwhile.
  if(String(location.hash||'')!==initialHash)return;
  try{window.fleetPilotApplyRoute?.({replaceInvalid:false})}catch(e){console.warn('FleetPilot route restore',e)}
}
[0,80,180,350,700].forEach(ms=>setTimeout(restoreInitialRoute,ms));

// If a stale boot render activates Autopark without changing the URL, restore the URL's page once.
let guardUntil=Date.now()+1400;
const observer=new MutationObserver(()=>{
  if(Date.now()>guardUntil){observer.disconnect();return}
  if(!initialRoute||String(location.hash||'')!==initialHash)return;
  const active=document.querySelector('.page.active');
  const routeMap={fleet:'fleetPage',service:'repairsPage',rent:'paymentsPage',expenses:'expensesPage',documents:'documentsPage',calendar:'calendarPage',analytics:'analyticsPage',company:'companyPage',data:'dataPage',attention:'attentionPage',search:'searchPage',driver:'driverPortalPage'};
  const root=initialRoute.split('/')[0];
  const expected=routeMap[root];
  if(expected&&active&&active.id!==expected)setTimeout(restoreInitialRoute,0);
});
observer.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
console.info('FleetPilot Route Stability V1 active',initialRoute||'(empty)');
})();