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
 if(c.driverUserId){
  const members=Array.isArray(window.workspaceDriverDirectory)?window.workspaceDriverDirectory:[];
  const m=members.find(x=>same(x?.user_id||x?.id,c.driverUserId));
  if(m){
   const name=window.workspaceDriverName?.(m)||m?.display_name||m?.name||m?.full_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ');
   if(name)return name;
   const email=window.workspaceDriverEmail?.(m)||m?.profiles?.email||m?.email;
   if(email)return email;
  }
  if(c.driverName)return c.driverName;
 }
 return c.tenant||c.driverName||c.driverEmail||'';
}
function syncNewPaymentTenant(){
 const id=$('#paymentId')?.value||'';
 if(id)return; // historical payment: never rewrite its saved tenant
 const carId=$('#paymentCarId')?.value||'';
 const c=window.car?.(carId)||(window.db?.cars||[]).find(x=>same(x.id,carId));
 const input=$('#paymentTenant');
 if(input)input.value=currentTenant(c);
}
function install(){
 const native=window.openPaymentDialog;
 if(typeof native!=='function')return false;
 if(native.__fpTenantSync)return true;
 const wrapped=function(){
  const result=native.apply(this,arguments);
  // Directory may already be loaded; use it immediately. If it refreshes asynchronously,
  // re-apply only for a new payment so saved historical rows stay untouched.
  syncNewPaymentTenant();
  Promise.resolve(window.loadWorkspaceDriverDirectory?.()).then(syncNewPaymentTenant).catch(()=>{});
  return result;
 };
 wrapped.__fpTenantSync=true;wrapped.__native=native;
 window.openPaymentDialog=wrapped;
 try{openPaymentDialog=wrapped}catch{}
 const select=$('#paymentCarId');
 if(select&&!select.dataset.fpTenantSync){select.dataset.fpTenantSync='1';select.addEventListener('change',syncNewPaymentTenant)}
 return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>50)clearInterval(timer)},100);
['fleetpilot:modules-ready','fleetpilot:access-ready','fleetpilot:assignments-changed','fleetpilot:driver-assignment-changed'].forEach(ev=>window.addEventListener(ev,()=>setTimeout(install,0)));
document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
window.FleetPilotPaymentTenantSync={install,currentTenant,sync:syncNewPaymentTenant};
})();