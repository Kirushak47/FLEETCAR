/* FleetPilot 20 — Boot Coordinator
   Boot may render the active page, but it must never choose another page or rewrite the route. */
(()=>{
 'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 if(FP.Boot)return;
 function loadScriptOnce(attr,src){
  if(document.querySelector(`script[${attr}]`))return;
  const script=document.createElement('script');script.src=src;script.async=false;script.setAttribute(attr,'1');document.body.appendChild(script)
 }
 function loadVehicleReportV2(){loadScriptOnce('data-fp-vehicle-report-v2','modules/reports/vehicle-report-v2.js?v=220102')}
 function loadExpenseDocumentSync(){loadScriptOnce('data-fp-expense-document-sync','modules/finance/expense-document-sync.js?v=220200')}
 function loadPaymentTenantSync(){/* disabled: replaced by payment-tenant-display-v8.js direct loader */}
 function install(){
  try{
   loadVehicleReportV2();
   loadExpenseDocumentSync();
   if(typeof forceInitialFleetRender==='function'){
    const renderOnly=function(){
     if(window.innerWidth<1100)return;
     const page=document.querySelector('#fleetPage');
     if(!page?.classList.contains('active'))return;
     try{window.renderFleet?.()}catch{}
     try{window.renderDesktopCommandKpis?.()}catch{}
     try{window.renderDesktopEvents?.()}catch{}
     try{window.renderDesktopInsights?.()}catch{}
     try{window.renderControlCenterExtras?.()}catch{}
     try{fleetPilotBootCompleted=true}catch{}
    };
    try{forceInitialFleetRender=renderOnly}catch{}window.forceInitialFleetRender=renderOnly;
   }
   if(typeof scheduleInitialFleetBoot==='function'){
    const schedule=function(){if(window.innerWidth<1100||!document.querySelector('#fleetPage')?.classList.contains('active'))return;requestAnimationFrame(()=>window.forceInitialFleetRender?.())};
    try{scheduleInitialFleetBoot=schedule}catch{}window.scheduleInitialFleetBoot=schedule;
   }
  }catch(error){console.warn('FleetPilot modular boot install',error)}
 }
 FP.Boot=Object.freeze({install,loadVehicleReportV2,loadExpenseDocumentSync,loadPaymentTenantSync});
 install();
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
 window.addEventListener('fleetpilot:access-ready',install);
 console.info('FleetPilot 20 boot coordinator ready');
})();