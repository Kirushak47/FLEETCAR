/* FleetPilot — rental payment driver binding v6
   Keeps the visible payment dialog driver field synchronized with the selected vehicle.
   Manual vehicle tenant is valid even without a FleetPilot account. */
(()=>{
'use strict';
if(window.__fpPaymentDriverBindingV6)return;window.__fpPaymentDriverBindingV6=true;
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
function paint(){
 const input=$('#paymentTenant'),select=$('#paymentCarId');if(!input||!select)return;
 if(isEditingExisting()){input.readOnly=true;return}
 const snap=driverSnapshotForCar(select.value);
 input.readOnly=true;
 input.setAttribute('aria-readonly','true');
 input.title='Арендатор определяется автоматически по выбранному автомобилю';
 const wanted=snap.name||'';
 if(input.value!==wanted)input.value=wanted;
 input.placeholder=wanted?'':'Водитель не назначен';
 input.dataset.driverUserId=snap.userId||'';
 input.dataset.driverSource=snap.source||'none';
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

let visibleSyncTimer=0;
function startVisibleSync(){
 clearInterval(visibleSyncTimer);
 paint();
 visibleSyncTimer=setInterval(()=>{
  const dialog=$('#paymentDialog');
  if(!dialog?.open){clearInterval(visibleSyncTimer);visibleSyncTimer=0;return}
  paint();
 },100);
}

function install(){
 const dialog=$('#paymentDialog'),form=$('#paymentForm'),select=$('#paymentCarId'),input=$('#paymentTenant');
 if(!dialog||!form||!select||!input)return false;
 input.readOnly=true;
 if(!dialog.dataset.fpPaymentDriverBindingV6){
  dialog.dataset.fpPaymentDriverBindingV6='1';
  new MutationObserver(()=>{
   if(dialog.open){startVisibleSync();setTimeout(refreshDriver,30)}
   else if(visibleSyncTimer){clearInterval(visibleSyncTimer);visibleSyncTimer=0}
  }).observe(dialog,{attributes:true,attributeFilter:['open']});
 }
 if(!select.dataset.fpPaymentDriverBindingV6){
  select.dataset.fpPaymentDriverBindingV6='1';
  select.addEventListener('change',()=>{paint();setTimeout(refreshDriver,0)});
 }
 if(!form.dataset.fpPaymentDriverBindingV6){
  form.dataset.fpPaymentDriverBindingV6='1';
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