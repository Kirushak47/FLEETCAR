/* FleetPilot — rental payment tenant sync
   New payments show only the driver actually assigned to the selected vehicle.
   Existing payments keep their historical tenant. */
(()=>{
'use strict';
if(window.__fpPaymentTenantSync)return;window.__fpPaymentTenantSync=true;
const same=(a,b)=>String(a??'')===String(b??'');
const $=s=>document.querySelector(s);
function driverFromDirectory(userId){
 const uid=String(userId||'');if(!uid)return'';
 const members=Array.isArray(window.workspaceDriverDirectory)?window.workspaceDriverDirectory:[];
 const m=members.find(x=>same(x?.user_id||x?.id,uid));if(!m)return'';
 return String(window.workspaceDriverName?.(m)||m?.display_name||m?.name||m?.full_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||window.workspaceDriverEmail?.(m)||m?.profiles?.email||m?.email||'').trim();
}
function currentTenant(c){
 if(!c)return'';
 const source=String(c.driverAssignmentSource||'');
 // Manual driver is explicitly stored on this vehicle only.
 if(source==='manual')return String(c.tenant||c.driverName||c.driverEmail||'').trim();
 // Account driver: resolve strictly by this vehicle's current assignment/user id.
 const row=window.FleetPilotAssignmentState?.forCar?.(c.id)||null;
 const uid=String(row?.driver_user_id||c.driverUserId||'');
 if(uid){
  const name=driverFromDirectory(uid);if(name)return name;
  if(row?.driver_name)return String(row.driver_name).trim();
  if(row?.driver_email)return String(row.driver_email).trim();
  if(c.driverName)return String(c.driverName).trim();
  if(c.driverEmail)return String(c.driverEmail).trim();
 }
 // Legacy manual cars may have tenant but no explicit source/user id.
 if(!uid&&!source&&String(c.tenant||'').trim())return String(c.tenant).trim();
 return'';
}
function selectedCar(){
 const carId=$('#paymentCarId')?.value||'';
 return window.car?.(carId)||(window.db?.cars||[]).find(x=>same(x.id,carId))||null;
}
function syncNewPaymentTenant(){
 if($('#paymentId')?.value)return;
 const input=$('#paymentTenant');if(!input)return;
 input.value=currentTenant(selectedCar());
}
async function refreshTenant(){
 if($('#paymentId')?.value)return;
 const c=selectedCar();
 if(c?.driverAssignmentSource==='manual'){syncNewPaymentTenant();return}
 try{await window.loadWorkspaceDriverAssignments?.()}catch{}
 try{await window.loadWorkspaceDriverDirectory?.()}catch{}
 syncNewPaymentTenant();
}
function installDirectWatch(){
 const dialog=$('#paymentDialog');if(!dialog||dialog.dataset.fpTenantWatch==='2')return;
 dialog.dataset.fpTenantWatch='2';
 const apply=()=>{if(dialog.open&&!$('#paymentId')?.value){syncNewPaymentTenant();setTimeout(refreshTenant,0);setTimeout(syncNewPaymentTenant,150)}};
 new MutationObserver(apply).observe(dialog,{attributes:true,attributeFilter:['open']});
 const select=$('#paymentCarId');if(select&&!select.dataset.fpTenantSyncStrict){select.dataset.fpTenantSyncStrict='1';select.addEventListener('change',()=>{syncNewPaymentTenant();setTimeout(refreshTenant,0)})}
}
function install(){
 installDirectWatch();
 let native=window.openPaymentDialog;
 if(typeof native!=='function')return false;
 while(native?.__fpTenantSync&&native.__native)native=native.__native;
 if(typeof native!=='function')return false;
 const wrapped=function(){const result=native.apply(this,arguments);syncNewPaymentTenant();setTimeout(refreshTenant,0);setTimeout(syncNewPaymentTenant,200);return result};
 wrapped.__fpTenantSync=true;wrapped.__native=native;
 window.openPaymentDialog=wrapped;try{openPaymentDialog=wrapped}catch{}
 return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>50)clearInterval(timer)},100);
['fleetpilot:modules-ready','fleetpilot:access-ready','fleetpilot:assignments-changed','fleetpilot:driver-assignment-changed','fleetpilot:authoritative-assignments'].forEach(ev=>window.addEventListener(ev,()=>setTimeout(syncNewPaymentTenant,30)));
document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
window.FleetPilotPaymentTenantSync={install,currentTenant,sync:syncNewPaymentTenant,refresh:refreshTenant};
})();