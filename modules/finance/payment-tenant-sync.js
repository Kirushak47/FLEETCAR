/* FleetPilot — rental payment tenant sync
   New payments always show the vehicle's current driver, including manual drivers.
   Existing payments keep their historical tenant. */
(()=>{
'use strict';
if(window.__fpPaymentTenantSync)return;window.__fpPaymentTenantSync=true;
const same=(a,b)=>String(a??'')===String(b??'');
const $=s=>document.querySelector(s);
function manualTenant(c){
 if(!c)return'';
 if(!c.driverUserId&&String(c.tenant||'').trim())return String(c.tenant).trim();
 if(c.driverAssignmentSource==='manual')return String(c.tenant||c.driverName||c.driverEmail||'').trim();
 return'';
}
function currentTenant(c){
 if(!c)return'';
 const manual=manualTenant(c);if(manual)return manual;
 try{
  const assigned=window.workspaceDriverForCar?.(c);
  if(assigned?.name)return assigned.name;
  if(assigned?.email)return assigned.email;
 }catch{}
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
 return String(c.tenant||c.driverName||c.driverEmail||'').trim();
}
function selectedCar(){
 const carId=$('#paymentCarId')?.value||'';
 return window.car?.(carId)||(window.db?.cars||[]).find(x=>same(x.id,carId));
}
function syncNewPaymentTenant(){
 if($('#paymentId')?.value)return;
 const input=$('#paymentTenant');if(!input)return;
 const c=selectedCar();
 const value=currentTenant(c);
 if(value)input.value=value;
}
async function refreshTenantFromCloud(){
 if($('#paymentId')?.value)return;
 const c=selectedCar();
 if(manualTenant(c)){syncNewPaymentTenant();return}
 try{await window.loadWorkspaceDriverAssignments?.()}catch{}
 try{await window.loadWorkspaceDriverDirectory?.()}catch{}
 syncNewPaymentTenant();
}
function installDirectWatch(){
 const dialog=$('#paymentDialog');if(!dialog||dialog.dataset.fpTenantWatch)return;
 dialog.dataset.fpTenantWatch='1';
 const apply=()=>{if(dialog.open&&!$('#paymentId')?.value){syncNewPaymentTenant();setTimeout(syncNewPaymentTenant,50);setTimeout(syncNewPaymentTenant,250)}};
 new MutationObserver(apply).observe(dialog,{attributes:true,attributeFilter:['open']});
 dialog.addEventListener('toggle',apply);
 const select=$('#paymentCarId');if(select&&!select.dataset.fpTenantSync){select.dataset.fpTenantSync='1';select.addEventListener('change',()=>{syncNewPaymentTenant();setTimeout(refreshTenantFromCloud,0)})}
}
function install(){
 installDirectWatch();
 const native=window.openPaymentDialog;
 if(typeof native!=='function')return false;
 if(native.__fpTenantSync)return true;
 const wrapped=function(){
  const result=native.apply(this,arguments);
  syncNewPaymentTenant();setTimeout(syncNewPaymentTenant,0);setTimeout(syncNewPaymentTenant,100);setTimeout(refreshTenantFromCloud,200);
  return result;
 };
 wrapped.__fpTenantSync=true;wrapped.__native=native;
 window.openPaymentDialog=wrapped;try{openPaymentDialog=wrapped}catch{}
 return true;
}
let tries=0;const timer=setInterval(()=>{tries++;installDirectWatch();if(install()||tries>50)clearInterval(timer)},100);
['fleetpilot:modules-ready','fleetpilot:access-ready','fleetpilot:assignments-changed','fleetpilot:driver-assignment-changed','fleetpilot:authoritative-assignments'].forEach(ev=>window.addEventListener(ev,()=>{setTimeout(install,0);setTimeout(syncNewPaymentTenant,20)}));
document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
window.FleetPilotPaymentTenantSync={install,currentTenant,manualTenant,sync:syncNewPaymentTenant,refresh:refreshTenantFromCloud};
})();