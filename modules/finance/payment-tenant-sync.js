/* FleetPilot — rental payment driver binding v2
   Driver is derived from the selected vehicle, never typed manually.
   Existing payments preserve the historical tenant saved at the time of payment. */
(()=>{
'use strict';
if(window.__fpPaymentDriverBindingV2)return;window.__fpPaymentDriverBindingV2=true;
const same=(a,b)=>String(a??'')===String(b??'');
const $=s=>document.querySelector(s);
const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
const getCar=id=>cars().find(c=>same(c.id,id))||null;
function memberById(userId){
 const uid=String(userId||'');
 const list=Array.isArray(window.workspaceDriverDirectory)?window.workspaceDriverDirectory:[];
 return list.find(m=>same(m?.user_id||m?.id,uid))||null;
}
function memberLabel(member){
 if(!member)return'';
 return String(
  window.workspaceDriverName?.(member)||member?.display_name||member?.name||member?.full_name||
  [member?.first_name,member?.last_name].filter(Boolean).join(' ')||
  window.workspaceDriverEmail?.(member)||member?.profiles?.email||member?.email||''
 ).trim();
}
function driverSnapshotForCar(carId){
 const c=getCar(carId);if(!c)return{car:null,userId:'',name:'',source:'none'};
 // 1) Authoritative cloud assignment for THIS vehicle.
 const row=window.FleetPilotAssignmentState?.forCar?.(c.id)||null;
 const assignedUserId=String(row?.driver_user_id||'');
 if(assignedUserId){
  const m=memberById(assignedUserId);
  const name=memberLabel(m)||String(row?.driver_name||row?.driver_email||c.driverName||c.driverEmail||'').trim();
  return{car:c,userId:assignedUserId,name,source:'account'};
 }
 // 2) Local account assignment for THIS vehicle, when cloud state has not loaded yet.
 const localUserId=String(c.driverUserId||'');
 if(localUserId){
  const m=memberById(localUserId);
  const name=memberLabel(m)||String(c.driverName||c.driverEmail||'').trim();
  return{car:c,userId:localUserId,name,source:'account'};
 }
 // 3) Manual driver belongs only to this vehicle.
 const manual=String(c.tenant||c.driverName||c.driverEmail||'').trim();
 if(manual)return{car:c,userId:'',name:manual,source:'manual'};
 return{car:c,userId:'',name:'',source:'none'};
}
function isEditingExisting(){return Boolean($('#paymentId')?.value)}
function renderDriver(){
 const input=$('#paymentTenant'),select=$('#paymentCarId');if(!input||!select)return;
 input.readOnly=true;
 input.setAttribute('aria-readonly','true');
 input.title='Арендатор определяется автоматически по выбранному автомобилю';
 if(isEditingExisting())return; // historical payment stays untouched
 const snap=driverSnapshotForCar(select.value);
 input.value=snap.name||'';
 input.placeholder=snap.name?'':'Водитель не назначен';
 input.dataset.driverUserId=snap.userId||'';
 input.dataset.driverSource=snap.source;
}
async function refreshDriver(){
 if(isEditingExisting())return;
 const select=$('#paymentCarId');if(!select)return;
 const c=getCar(select.value);
 // Manual driver requires no network lookup.
 if(c&&!c.driverUserId&&String(c.tenant||'').trim()){renderDriver();return}
 try{await window.loadWorkspaceDriverAssignments?.()}catch{}
 try{await window.loadWorkspaceDriverDirectory?.()}catch{}
 renderDriver();
}
function install(){
 const dialog=$('#paymentDialog'),form=$('#paymentForm'),select=$('#paymentCarId'),input=$('#paymentTenant');
 if(!dialog||!form||!select||!input)return false;
 input.readOnly=true;
 if(!dialog.dataset.fpPaymentDriverBinding){
  dialog.dataset.fpPaymentDriverBinding='2';
  new MutationObserver(()=>{
   if(!dialog.open)return;
   if(isEditingExisting()){input.readOnly=true;return}
   // Wait for native openPaymentDialog to finish selecting the requested car.
   setTimeout(renderDriver,0);
   setTimeout(refreshDriver,50);
  }).observe(dialog,{attributes:true,attributeFilter:['open']});
 }
 if(!select.dataset.fpPaymentDriverBinding){
  select.dataset.fpPaymentDriverBinding='2';
  select.addEventListener('change',()=>{renderDriver();setTimeout(refreshDriver,0)});
 }
 if(!form.dataset.fpPaymentDriverBinding){
  form.dataset.fpPaymentDriverBinding='2';
  // Capture phase runs before the native onsubmit handler. This guarantees the
  // saved payment gets the driver belonging to the selected car, regardless of UI timing.
  form.addEventListener('submit',()=>{
   if(isEditingExisting())return;
   const snap=driverSnapshotForCar(select.value);
   input.value=snap.name||'';
   input.dataset.driverUserId=snap.userId||'';
   input.dataset.driverSource=snap.source;
  },true);
 }
 return true;
}
let n=0;const timer=setInterval(()=>{n++;if(install()||n>80)clearInterval(timer)},100);
document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
window.addEventListener('fleetpilot:access-ready',()=>setTimeout(install,0));
window.addEventListener('fleetpilot:authoritative-assignments',()=>setTimeout(()=>{if($('#paymentDialog')?.open)renderDriver()},0));
window.FleetPilotPaymentDriverBinding={install,render:renderDriver,refresh:refreshDriver,snapshot:driverSnapshotForCar};
})();