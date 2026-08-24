/* FleetPilot — rental payment driver binding v4
   Driver is derived from the selected vehicle, never typed manually.
   Existing payments preserve the historical tenant saved at the time of payment. */
(()=>{
'use strict';
if(window.__fpPaymentDriverBindingV4)return;window.__fpPaymentDriverBindingV4=true;
const same=(a,b)=>String(a??'')===String(b??'');
const $=s=>document.querySelector(s);
const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
const getCar=id=>cars().find(c=>same(c.id,id))||null;

function driverSnapshotForCar(carId){
 const c=getCar(carId);if(!c)return{car:null,userId:'',name:'',source:'none'};

 // Primary source: FleetPilot's shared driver domain. This function has access to the
 // lexical workspace driver directory used by Driver Portal, unlike window.workspaceDriverDirectory.
 try{
  const resolved=window.workspaceDriverForCar?.(c)||null;
  if(resolved){
   const name=String(resolved.name||resolved.email||c.driverName||c.tenant||c.driverEmail||'').trim();
   if(name||resolved.userId){
    return{car:c,userId:String(resolved.userId||c.driverUserId||''),name,source:resolved.source||'account'};
   }
  }
 }catch(error){console.warn('Payment driver domain resolve failed',error)}

 // Secondary source: authoritative assignment row for this exact vehicle.
 const row=window.FleetPilotAssignmentState?.forCar?.(c.id)||null;
 const assignedUserId=String(row?.driver_user_id||'');
 if(assignedUserId){
  const name=String(row?.driver_name||row?.driver_email||c.driverName||c.tenant||c.driverEmail||'').trim();
  return{car:c,userId:assignedUserId,name,source:'account'};
 }

 // Local vehicle snapshot while cloud state is still loading.
 const localUserId=String(c.driverUserId||'');
 if(localUserId){
  const name=String(c.driverName||c.tenant||c.driverEmail||'').trim();
  return{car:c,userId:localUserId,name,source:'account'};
 }

 const manual=String(c.tenant||c.driverName||c.driverEmail||'').trim();
 if(manual)return{car:c,userId:'',name:manual,source:'manual'};
 return{car:c,userId:'',name:'',source:'none'};
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
 try{await window.loadWorkspaceDriverAssignments?.()}catch{}
 try{await window.loadWorkspaceDriverDirectory?.()}catch{}
 renderDriver();
}
function install(){
 const dialog=$('#paymentDialog'),form=$('#paymentForm'),select=$('#paymentCarId'),input=$('#paymentTenant');
 if(!dialog||!form||!select||!input)return false;
 input.readOnly=true;
 if(!dialog.dataset.fpPaymentDriverBindingV4){
  dialog.dataset.fpPaymentDriverBindingV4='1';
  new MutationObserver(()=>{
   if(!dialog.open)return;
   if(isEditingExisting()){input.readOnly=true;return}
   [0,16,60,150,350].forEach(ms=>setTimeout(renderDriver,ms));
   setTimeout(refreshDriver,40);
   setTimeout(refreshDriver,180);
  }).observe(dialog,{attributes:true,attributeFilter:['open']});
 }
 if(!select.dataset.fpPaymentDriverBindingV4){
  select.dataset.fpPaymentDriverBindingV4='1';
  select.addEventListener('change',()=>{renderDriver();setTimeout(refreshDriver,0);setTimeout(refreshDriver,120)});
 }
 if(!form.dataset.fpPaymentDriverBindingV4){
  form.dataset.fpPaymentDriverBindingV4='1';
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