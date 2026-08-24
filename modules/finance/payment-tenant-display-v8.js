/* FleetPilot — payment driver visible display v9
   One visible driver field in the rental payment dialog.
   Resolves the concrete driver from vehicle, shared driver domain, assignment state,
   and finally the latest saved payment for the same car. */
(()=>{
'use strict';
if(window.__fpPaymentTenantDisplayV9)return;window.__fpPaymentTenantDisplayV9=true;
const $=s=>document.querySelector(s);
const same=(a,b)=>String(a??'')===String(b??'');
const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
const payments=()=>Array.isArray(window.db?.payments)?window.db.payments:[];
const getCar=id=>cars().find(c=>same(c.id,id))||null;

function latestPaymentTenant(carId){
 const rows=payments().filter(p=>same(p.carId,carId)&&String(p.tenant||'').trim());
 rows.sort((a,b)=>String(b.date||b.to||b.from||'').localeCompare(String(a.date||a.to||a.from||'')));
 return String(rows[0]?.tenant||'').trim();
}

function resolveDriver(carId){
 const c=getCar(carId);if(!c)return{name:'',userId:'',source:'none'};
 const direct=String(c.tenant||c.driverName||c.driverEmail||'').trim();
 if(direct)return{name:direct,userId:String(c.driverUserId||''),source:c.driverUserId?'account':'manual'};
 try{
  const resolved=window.workspaceDriverForCar?.(c)||null;
  const name=String(resolved?.name||resolved?.email||'').trim();
  if(name)return{name,userId:String(resolved?.userId||c.driverUserId||''),source:resolved?.source||'account'};
 }catch{}
 const row=window.FleetPilotAssignmentState?.forCar?.(c.id)||null;
 const assignmentName=String(row?.driver_name||row?.driver_email||'').trim();
 if(assignmentName)return{name:assignmentName,userId:String(row?.driver_user_id||''),source:'account'};
 const historical=latestPaymentTenant(c.id);
 if(historical)return{name:historical,userId:String(c.driverUserId||''),source:'payment-history'};
 return{name:'',userId:String(c.driverUserId||''),source:'none'};
}

function ensureDisplay(){
 const stored=$('#paymentTenant');if(!stored)return null;
 // Remove display fields created by older fixes so the dialog has exactly one field.
 $('#paymentTenantDisplay')?.remove();
 let display=$('#paymentTenantDisplayV8');
 if(!display){
  display=document.createElement('input');
  display.id='paymentTenantDisplayV8';
  display.type='text';
  display.readOnly=true;
  display.autocomplete='off';
  display.setAttribute('aria-readonly','true');
  display.title='Фактический водитель, за которого проводится оплата';
  stored.insertAdjacentElement('afterend',display);
 }
 stored.type='hidden';
 return display;
}

function paint(){
 const select=$('#paymentCarId'),stored=$('#paymentTenant'),display=ensureDisplay();
 if(!select||!stored||!display)return;
 const existingId=$('#paymentId')?.value||'';
 const existing=existingId?payments().find(p=>same(p.id,existingId)):null;
 const resolved=existing&&String(existing.tenant||'').trim()
  ?{name:String(existing.tenant).trim(),userId:'',source:'payment'}
  :resolveDriver(select.value);
 const name=resolved.name||'';
 display.value=name;
 display.placeholder=name?'':'Водитель не назначен';
 display.dataset.driverUserId=resolved.userId||'';
 display.dataset.driverSource=resolved.source||'none';
 stored.value=name;
 stored.dataset.driverUserId=resolved.userId||'';
 stored.dataset.driverSource=resolved.source||'none';
}

function install(){
 const dialog=$('#paymentDialog'),select=$('#paymentCarId'),form=$('#paymentForm');
 if(!dialog||!select||!form||!$('#paymentTenant'))return false;
 ensureDisplay();
 if(!dialog.dataset.fpTenantDisplayV9){
  dialog.dataset.fpTenantDisplayV9='1';
  new MutationObserver(()=>{
   if(!dialog.open)return;
   [0,20,80,180,400].forEach(ms=>setTimeout(paint,ms));
  }).observe(dialog,{attributes:true,attributeFilter:['open']});
 }
 if(!select.dataset.fpTenantDisplayV9){
  select.dataset.fpTenantDisplayV9='1';
  select.addEventListener('change',()=>{paint();setTimeout(paint,50)});
 }
 if(!form.dataset.fpTenantDisplayV9){
  form.dataset.fpTenantDisplayV9='1';
  form.addEventListener('submit',paint,true);
 }
 paint();
 return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>100)clearInterval(timer)},100);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else install();
window.addEventListener('fleetpilot:access-ready',()=>setTimeout(()=>{install();paint()},0));
window.addEventListener('fleetpilot:authoritative-assignments',()=>setTimeout(paint,0));
})();