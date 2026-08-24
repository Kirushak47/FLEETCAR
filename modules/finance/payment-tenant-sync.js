/* FleetPilot — rental payment tenant sync (observer-only, no openPaymentDialog wrapper)
   New payments show the driver assigned to the currently selected vehicle.
   Existing payments keep the historical tenant saved on the payment. */
(()=>{
'use strict';
if(window.__fpPaymentTenantSyncObserver)return;window.__fpPaymentTenantSyncObserver=true;
const same=(a,b)=>String(a??'')===String(b??'');
const $=s=>document.querySelector(s);
function getCarById(id){return window.car?.(String(id||''))||(window.db?.cars||[]).find(c=>same(c.id,id))||null}
function memberName(userId){
 const uid=String(userId||'');if(!uid)return'';
 const list=Array.isArray(window.workspaceDriverDirectory)?window.workspaceDriverDirectory:[];
 const m=list.find(x=>same(x?.user_id||x?.id,uid));if(!m)return'';
 return String(window.workspaceDriverName?.(m)||m?.display_name||m?.name||m?.full_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||window.workspaceDriverEmail?.(m)||m?.profiles?.email||m?.email||'').trim();
}
function tenantForCar(c){
 if(!c)return'';
 // Manual driver: the tenant belongs only to this vehicle.
 if(!c.driverUserId&&String(c.tenant||'').trim())return String(c.tenant).trim();
 if(c.driverAssignmentSource==='manual')return String(c.tenant||c.driverName||c.driverEmail||'').trim();
 // Account driver: resolve by this vehicle's active assignment first.
 const row=window.FleetPilotAssignmentState?.forCar?.(c.id)||null;
 const uid=String(row?.driver_user_id||c.driverUserId||'');
 if(uid){
  const name=memberName(uid);if(name)return name;
  if(row?.driver_name)return String(row.driver_name).trim();
  if(row?.driver_email)return String(row.driver_email).trim();
  if(c.driverName)return String(c.driverName).trim();
  if(c.driverEmail)return String(c.driverEmail).trim();
 }
 // Legacy/manual fallback only from this same vehicle.
 return String(c.tenant||'').trim();
}
function apply(){
 const dialog=$('#paymentDialog');
 if(!dialog?.open)return;
 if($('#paymentId')?.value)return; // editing an old payment: preserve historical tenant
 const select=$('#paymentCarId'),input=$('#paymentTenant');
 if(!select||!input)return;
 const c=getCarById(select.value);
 input.value=tenantForCar(c);
}
async function refreshAndApply(){
 if($('#paymentId')?.value)return;
 const select=$('#paymentCarId');const c=getCarById(select?.value);
 if(c&&!c.driverUserId&&String(c.tenant||'').trim()){apply();return}
 try{await window.loadWorkspaceDriverAssignments?.()}catch{}
 try{await window.loadWorkspaceDriverDirectory?.()}catch{}
 apply();
}
function install(){
 const dialog=$('#paymentDialog'),select=$('#paymentCarId');
 if(!dialog||!select)return false;
 if(!dialog.dataset.fpTenantObserver){
  dialog.dataset.fpTenantObserver='1';
  new MutationObserver(()=>{
   if(dialog.open&&!$('#paymentId')?.value){
    // Let native openPaymentDialog finish selecting the requested vehicle first.
    setTimeout(apply,0);setTimeout(refreshAndApply,80);setTimeout(apply,250);
   }
  }).observe(dialog,{attributes:true,attributeFilter:['open']});
 }
 if(!select.dataset.fpTenantObserver){
  select.dataset.fpTenantObserver='1';
  select.addEventListener('change',()=>{apply();setTimeout(refreshAndApply,0)});
 }
 return true;
}
let attempts=0;const timer=setInterval(()=>{attempts++;if(install()||attempts>60)clearInterval(timer)},100);
document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
window.addEventListener('fleetpilot:access-ready',()=>setTimeout(install,0));
window.FleetPilotPaymentTenantSync={install,apply,tenantForCar,refresh:refreshAndApply};
})();