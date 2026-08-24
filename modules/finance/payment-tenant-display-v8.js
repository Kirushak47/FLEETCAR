/* FleetPilot — payment driver visible display v8
   Independent UI-only driver field for the rental payment dialog.
   The hidden legacy #paymentTenant remains the value saved by native payment logic. */
(()=>{
'use strict';
if(window.__fpPaymentTenantDisplayV8)return;window.__fpPaymentTenantDisplayV8=true;
const $=s=>document.querySelector(s);
const same=(a,b)=>String(a??'')===String(b??'');
const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
const getCar=id=>cars().find(c=>same(c.id,id))||null;

function vehicleDriverName(carId){
 const c=getCar(carId);if(!c)return'';
 return String(c.tenant||c.driverName||c.driverEmail||'').trim();
}

function ensureDisplay(){
 const stored=$('#paymentTenant');if(!stored)return null;
 const label=stored.closest('label');if(!label)return null;
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
 const dialog=$('#paymentDialog'),select=$('#paymentCarId'),stored=$('#paymentTenant'),display=ensureDisplay();
 if(!dialog||!select||!stored||!display)return;
 const editing=Boolean($('#paymentId')?.value);
 const name=editing?String(stored.value||'').trim():vehicleDriverName(select.value);
 display.value=name;
 display.placeholder=name?'':'Водитель не назначен';
 if(!editing&&name)stored.value=name;
}

function install(){
 const dialog=$('#paymentDialog'),select=$('#paymentCarId'),form=$('#paymentForm');
 if(!dialog||!select||!form||!$('#paymentTenant'))return false;
 ensureDisplay();
 if(!dialog.dataset.fpTenantDisplayV8){
  dialog.dataset.fpTenantDisplayV8='1';
  new MutationObserver(()=>{
   if(!dialog.open)return;
   [0,20,80,180,400].forEach(ms=>setTimeout(paint,ms));
  }).observe(dialog,{attributes:true,attributeFilter:['open']});
 }
 if(!select.dataset.fpTenantDisplayV8){
  select.dataset.fpTenantDisplayV8='1';
  select.addEventListener('change',()=>{paint();setTimeout(paint,50)});
 }
 if(!form.dataset.fpTenantDisplayV8){
  form.dataset.fpTenantDisplayV8='1';
  form.addEventListener('submit',paint,true);
 }
 setInterval(()=>{if(dialog.open)paint()},250);
 paint();
 return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>100)clearInterval(timer)},100);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else install();
window.addEventListener('fleetpilot:access-ready',()=>setTimeout(install,0));
})();