/* FleetPilot — rental payment tenant sync
   New payments always show the vehicle's current assigned driver.
   Existing payments keep their historical tenant. */
(()=>{
'use strict';
if(window.__fpPaymentTenantSync)return;window.__fpPaymentTenantSync=true;
const same=(a,b)=>String(a??'')===String(b??'');
const $=s=>document.querySelector(s);
function currentTenant(c){
 if(!c)return'';
 // First use the same authoritative resolver as the rest of FleetPilot.
 // It already merges current assignment row + driver directory + vehicle fallback.
 try{
  const assigned=window.workspaceDriverForCar?.(c);
  if(assigned?.name)return assigned.name;
  if(assigned?.email)return assigned.email;
 }catch{}

 // If the local car has not yet been reconciled, recover the active cloud assignment by car id.
 try{
  const row=window.FleetPilotAssignmentState?.forCar?.(c.id);
  const userId=String(row?.driver_user_id||c.driverUserId||'');
  if(userId){
   const members=Array.isArray(window.workspaceDriverDirectory)?window.workspaceDriverDirectory:[];
   const m=members.find(x=>same(x?.user_id||x?.id,userId));
   if(m){
    const name=window.workspaceDriverName?.(m)||m?.display_name||m?.name||m?.full_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ');
    if(name)return name;
    const email=window.workspaceDriverEmail?.(m)||m?.profiles?.email||m?.email;
    if(email)return email;
   }
   if(row?.driver_name)return row.driver_name;
   if(row?.driver_email)return row.driver_email;
  }
 }catch{}

 return c.driverName||c.tenant||c.driverEmail||'';
}
function selectedCar(){
 const carId=$('#paymentCarId')?.value||'';
 return window.car?.(carId)||(window.db?.cars||[]).find(x=>same(x.id,carId));
}
function syncNewPaymentTenant(){
 const id=$('#paymentId')?.value||'';
 if(id)return; // historical payment: never rewrite its saved tenant
 const input=$('#paymentTenant');
 if(!input)return;
 input.value=currentTenant(selectedCar());
}
async function refreshTenantFromCloud(){
 if($('#paymentId')?.value)return;
 try{await window.FleetPilotOperationalDomain?.pullAuthoritativeState?.()}catch{}
 try{await window.loadWorkspaceDriverAssignments?.()}catch{}
 try{await window.loadWorkspaceDriverDirectory?.()}catch{}
 syncNewPaymentTenant();
}
function install(){
 const native=window.openPaymentDialog;
 if(typeof native!=='function')return false;
 if(native.__fpTenantSync)return true;
 const wrapped=function(){
  const result=native.apply(this,arguments);
  syncNewPaymentTenant();
  // Re-resolve after cloud assignment + directory are ready.
  setTimeout(refreshTenantFromCloud,0);
  setTimeout(syncNewPaymentTenant,250);
  setTimeout(syncNewPaymentTenant,800);
  return result;
 };
 wrapped.__fpTenantSync=true;wrapped.__native=native;
 window.openPaymentDialog=wrapped;
 try{openPaymentDialog=wrapped}catch{}
 const select=$('#paymentCarId');
 if(select&&!select.dataset.fpTenantSync){
  select.dataset.fpTenantSync='1';
  select.addEventListener('change',()=>{syncNewPaymentTenant();setTimeout(refreshTenantFromCloud,0)})
 }
 return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>50)clearInterval(timer)},100);
['fleetpilot:modules-ready','fleetpilot:access-ready','fleetpilot:assignments-changed','fleetpilot:driver-assignment-changed','fleetpilot:authoritative-assignments'].forEach(ev=>window.addEventListener(ev,()=>{setTimeout(install,0);setTimeout(syncNewPaymentTenant,20)}));
document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
window.FleetPilotPaymentTenantSync={install,currentTenant,sync:syncNewPaymentTenant,refresh:refreshTenantFromCloud};
})();