/* FleetPilot — rental payment driver binding v7
   The visible driver field is now independent from the hidden paymentTenant value.
   This prevents legacy payment-dialog code from clearing what the user sees. */
(()=>{
'use strict';
if(window.__fpPaymentDriverBindingV7)return;window.__fpPaymentDriverBindingV7=true;
const same=(a,b)=>String(a??'')===String(b??'');
const $=s=>document.querySelector(s);
const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
const getCar=id=>cars().find(c=>same(c.id,id))||null;

function driverSnapshotForCar(carId){
 const c=getCar(carId);if(!c)return{car:null,userId:'',name:'',source:'none'};
 const vehicleName=String(c.tenant||c.driverName||c.driverEmail||'').trim();
 const localUserId=String(c.driverUserId||'');
 if(vehicleName)return{car:c,userId:localUserId,name:vehicleName,source:localUserId?'account':'manual'};
 try{
  const resolved=window.workspaceDriverForCar?.(c)||null;
  if(resolved){
   const name=String(resolved.name||resolved.email||'').trim();
   if(name||resolved.userId)return{car:c,userId:String(resolved.userId||localUserId),name,source:resolved.source||'account'};
  }
 }catch{}
 const row=window.FleetPilotAssignmentState?.forCar?.(c.id)||null;
 const assignedUserId=String(row?.driver_user_id||'');
 if(assignedUserId){
  const name=String(row?.driver_name||row?.driver_email||'').trim();
  return{car:c,userId:assignedUserId,name,source:'account'};
 }
 return{car:c,userId:localUserId,name:'',source:localUserId?'account':'none'};
}

function isEditingExisting(){return Boolean($('#paymentId')?.value)}

function ensureDisplay(){
 const stored=$('#paymentTenant');if(!stored)return null;
 let display=$('#paymentTenantDisplay');
 if(!display){
  display=document.createElement('input');
  display.id='paymentTenantDisplay';
  display.type='text';
  display.className=stored.className||'';
  display.readOnly=true;
  display.tabIndex=0;
  display.autocomplete='off';
  display.setAttribute('aria-readonly','true');
  display.title='Фактический водитель, за которого проводится оплата';
  stored.insertAdjacentElement('afterend',display);
 }
 // Keep the real form field only for saving; legacy code may write to it without affecting UI.
 if(stored.type!=='hidden')stored.type='hidden';
 return display;
}

function paint(){
 const stored=$('#paymentTenant'),select=$('#paymentCarId'),display=ensureDisplay();
 if(!stored||!select||!display)return;
 if(isEditingExisting()){
  display.value=stored.value||'';
  display.placeholder=display.value?'':'Водитель не назначен';
  return;
 }
 const snap=driverSnapshotForCar(select.value);
 const wanted=snap.name||'';
 display.value=wanted;
 display.placeholder=wanted?'':'Водитель не назначен';
 display.dataset.driverUserId=snap.userId||'';
 display.dataset.driverSource=snap.source||'none';
 // The hidden field is still what the native payment submit handler saves.
 stored.value=wanted;
 stored.dataset.driverUserId=snap.userId||'';
 stored.dataset.driverSource=snap.source||'none';
}

async function refreshDriver(){
 paint();
 const select=$('#paymentCarId');if(!select||isEditingExisting())return;
 const c=getCar(select.value);
 if(String(c?.tenant||c?.driverName||c?.driverEmail||'').trim())return;
 try{await window.loadWorkspaceDriverAssignments?.()}catch{}
 try{await window.loadWorkspaceDriverDirectory?.()}catch{}
 paint();
}

function install(){
 const dialog=$('#paymentDialog'),form=$('#paymentForm'),select=$('#paymentCarId'),stored=$('#paymentTenant');
 if(!dialog||!form||!select||!stored)return false;
 ensureDisplay();
 if(!dialog.dataset.fpPaymentDriverBindingV7){
  dialog.dataset.fpPaymentDriverBindingV7='1';
  new MutationObserver(()=>{
   if(!dialog.open)return;
   // Native openPaymentDialog finishes its own writes first, then we render our independent display.
   [0,16,60,150].forEach(ms=>setTimeout(paint,ms));
   setTimeout(refreshDriver,40);
  }).observe(dialog,{attributes:true,attributeFilter:['open']});
 }
 if(!select.dataset.fpPaymentDriverBindingV7){
  select.dataset.fpPaymentDriverBindingV7='1';
  select.addEventListener('change',()=>{paint();setTimeout(refreshDriver,0)});
 }
 if(!form.dataset.fpPaymentDriverBindingV7){
  form.dataset.fpPaymentDriverBindingV7='1';
  // Capture phase guarantees the stored tenant matches the visible driver at save time.
  form.addEventListener('submit',paint,true);
 }
 return true;
}
let n=0;const timer=setInterval(()=>{n++;if(install()||n>80)clearInterval(timer)},100);
document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
window.addEventListener('fleetpilot:access-ready',()=>setTimeout(install,0));
window.addEventListener('fleetpilot:authoritative-assignments',()=>setTimeout(()=>{if($('#paymentDialog')?.open)paint()},0));
window.addEventListener('fleetpilot:driver-assignment-changed',()=>setTimeout(()=>{if($('#paymentDialog')?.open)paint()},0));
window.FleetPilotPaymentDriverBinding={install,render:paint,refresh:refreshDriver,snapshot:driverSnapshotForCar};
})();