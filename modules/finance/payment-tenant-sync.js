/* FleetPilot — rental payment driver binding v5
   Payment driver follows the vehicle snapshot.
   IMPORTANT: a manually entered vehicle tenant is a fully valid driver even without account/user id. */
(()=>{
'use strict';
if(window.__fpPaymentDriverBindingV5)return;window.__fpPaymentDriverBindingV5=true;
const same=(a,b)=>String(a??'')===String(b??'');
const $=s=>document.querySelector(s);
const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
const getCar=id=>cars().find(c=>same(c.id,id))||null;

function driverSnapshotForCar(carId){
 const c=getCar(carId);if(!c)return{car:null,userId:'',name:'',source:'none'};

 // Manual text saved on the vehicle is authoritative for payment display.
 // It must work even when the driver has no FleetPilot account and no Supabase assignment.
 const vehicleName=String(c.tenant||c.driverName||c.driverEmail||'').trim();
 const localUserId=String(c.driverUserId||'');
 if(vehicleName){
  return{car:c,userId:localUserId,name:vehicleName,source:localUserId?'account':'manual'};
 }

 // If the local vehicle has no readable name, try the shared driver domain.
 try{
  const resolved=window.workspaceDriverForCar?.(c)||null;
  if(resolved){
   const name=String(resolved.name||resolved.email||'').trim();
   if(name||resolved.userId)return{car:c,userId:String(resolved.userId||localUserId),name,source:resolved.source||'account'};
  }
 }catch(error){console.warn('Payment driver domain resolve failed',error)}

 // Last fallback: authoritative assignment row for this exact vehicle.
 const row=window.FleetPilotAssignmentState?.forCar?.(c.id)||null;
 const assignedUserId=String(row?.driver_user_id||'');
 if(assignedUserId){
  const name=String(row?.driver_name||row?.driver_email||'').trim();
  return{car:c,userId:assignedUserId,name,source:'account'};
 }
 return{car:c,userId:localUserId,name:'',source:localUserId?'account':'none'};
}

function isEditingExisting(){return Boolean($('#paymentId')?.value)}
function paint(snap){
 const input=$('#paymentTenant');if(!input)return;
 input.readOnly=true;input.setAttribute('aria-readonly','true');
 input.title='Арендатор определяется автоматически по выбранному автомобилю';
 input.value=snap?.name||'';
 input.placeholder=snap?.name?'':'Водитель не назначен';
 input.dataset.driverUserId=snap?.userId||'';
 input.dataset.driverSource=snap?.source||'none';
 input.dispatchEvent(new Event('input',{bubbles:true}));
 input.dispatchEvent(new Event('change',{bubbles:true}));
}
function renderDriver(){
 const select=$('#paymentCarId');if(!select)return;
 if(isEditingExisting())return;
 paint(driverSnapshotForCar(select.value));
}
async function refreshDriver(){
 if(isEditingExisting())return;
 const select=$('#paymentCarId');if(!select)return;
 // Paint local/manual data first. Cloud refresh must never erase a manual tenant.
 renderDriver();
 const c=getCar(select.value);
 if(String(c?.tenant||c?.driverName||c?.driverEmail||'').trim())return;
 try{await window.loadWorkspaceDriverAssignments?.()}catch{}
 try{await window.loadWorkspaceDriverDirectory?.()}catch{}
 renderDriver();
}
function install(){
 const dialog=$('#paymentDialog'),form=$('#paymentForm'),select=$('#paymentCarId'),input=$('#paymentTenant');
 if(!dialog||!form||!select||!input)return false;
 input.readOnly=true;
 if(!dialog.dataset.fpPaymentDriverBindingV5){
  dialog.dataset.fpPaymentDriverBindingV5='1';
  new MutationObserver(()=>{
   if(!dialog.open)return;
   if(isEditingExisting()){input.readOnly=true;return}
   [0,16,60,150,350].forEach(ms=>setTimeout(renderDriver,ms));
   setTimeout(refreshDriver,40);
  }).observe(dialog,{attributes:true,attributeFilter:['open']});
 }
 if(!select.dataset.fpPaymentDriverBindingV5){
  select.dataset.fpPaymentDriverBindingV5='1';
  select.addEventListener('change',()=>{renderDriver();setTimeout(refreshDriver,0)});
 }
 if(!form.dataset.fpPaymentDriverBindingV5){
  form.dataset.fpPaymentDriverBindingV5='1';
  form.addEventListener('submit',()=>{
   if(isEditingExisting())return;
   paint(driverSnapshotForCar(select.value));
  },true);
 }
 return true;
}
let n=0;const timer=setInterval(()=>{n++;if(install()||n>80)clearInterval(timer)},100);
document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
window.addEventListener('fleetpilot:access-ready',()=>setTimeout(install,0));
window.addEventListener('fleetpilot:authoritative-assignments',()=>setTimeout(()=>{if($('#paymentDialog')?.open)refreshDriver()},0));
window.addEventListener('fleetpilot:driver-assignment-changed',()=>setTimeout(()=>{if($('#paymentDialog')?.open)refreshDriver()},0));
window.FleetPilotPaymentDriverBinding={install,render:renderDriver,refresh:refreshDriver,snapshot:driverSnapshotForCar};
})();