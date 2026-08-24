/* FleetPilot — payment driver visible display v10
   One visible driver field in the rental payment dialog.
   Also detects ANY overlapping rental-payment period for the same vehicle,
   not only an exact from/to duplicate. */
(()=>{
'use strict';
if(window.__fpPaymentTenantDisplayV10)return;window.__fpPaymentTenantDisplayV10=true;
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

function overlaps(aFrom,aTo,bFrom,bTo){
 if(!aFrom||!aTo||!bFrom||!bTo)return false;
 return String(aFrom)<=String(bTo)&&String(aTo)>=String(bFrom);
}
function overlappingPayments(){
 const carId=$('#paymentCarId')?.value||'';
 const from=$('#paymentFrom')?.value||'';
 const to=$('#paymentTo')?.value||'';
 const currentId=$('#paymentId')?.value||'';
 if(!carId||!from||!to)return[];
 return payments().filter(p=>
  !same(p.id,currentId)&&
  same(p.carId,carId)&&
  overlaps(from,to,p.from,p.to)
 );
}
function formatRange(p){
 const f=p?.from||'',t=p?.to||'';
 return f&&t?`${f} — ${t}`:(f||t||'период не указан');
}
function renderOverlapWarning(){
 const box=$('#paymentDuplicateWarning');if(!box)return;
 const rows=overlappingPayments();
 box.hidden=!rows.length;
 if(!rows.length){box.textContent='';return}
 const received=rows.reduce((sum,p)=>sum+Number(p.received||0),0);
 if(rows.length===1){
  const p=rows[0];
  const who=String(p.tenant||'').trim();
  box.textContent=`⚠️ Выбранный период пересекается с уже сохранённой оплатой${who?` (${who})`:''}: ${formatRange(p)}, получено ${window.money?window.money(p.received):Number(p.received||0).toFixed(2)}.`;
 }else{
  box.textContent=`⚠️ Выбранный период пересекается с ${rows.length} уже сохранёнными оплатами. Всего получено: ${window.money?window.money(received):received.toFixed(2)}.`;
 }
}
function installOverlapGuard(){
 // Replace the legacy exact-match visual check with overlap-aware logic.
 try{window.checkPaymentDuplicate=renderOverlapWarning}catch{}
 const form=$('#paymentForm');if(!form||form.dataset.fpOverlapGuardV10)return;
 form.dataset.fpOverlapGuardV10='1';
 form.addEventListener('submit',event=>{
  const rows=overlappingPayments();
  if(!rows.length)return;
  const received=rows.reduce((sum,p)=>sum+Number(p.received||0),0);
  const msg=rows.length===1
   ?`За выбранный период уже есть пересекающаяся оплата: ${formatRange(rows[0])}, получено ${window.money?window.money(rows[0].received):Number(rows[0].received||0).toFixed(2)}.\n\nВсё равно сохранить новую запись?`
   :`Выбранный период пересекается с ${rows.length} оплатами, всего получено ${window.money?window.money(received):received.toFixed(2)}.\n\nВсё равно сохранить новую запись?`;
  if(!confirm(msg)){
   event.preventDefault();
   event.stopImmediatePropagation();
  }
 },true);
}

function install(){
 const dialog=$('#paymentDialog'),select=$('#paymentCarId'),form=$('#paymentForm');
 if(!dialog||!select||!form||!$('#paymentTenant'))return false;
 ensureDisplay();
 installOverlapGuard();
 if(!dialog.dataset.fpTenantDisplayV10){
  dialog.dataset.fpTenantDisplayV10='1';
  new MutationObserver(()=>{
   if(!dialog.open)return;
   [0,20,80,180,400].forEach(ms=>setTimeout(()=>{paint();renderOverlapWarning()},ms));
  }).observe(dialog,{attributes:true,attributeFilter:['open']});
 }
 if(!select.dataset.fpTenantDisplayV10){
  select.dataset.fpTenantDisplayV10='1';
  select.addEventListener('change',()=>{paint();renderOverlapWarning();setTimeout(()=>{paint();renderOverlapWarning()},50)});
 }
 for(const id of ['paymentFrom','paymentTo','paymentReferenceWeek','paymentTiming']){
  const el=$('#'+id);if(el&&!el.dataset.fpOverlapV10){el.dataset.fpOverlapV10='1';el.addEventListener('change',()=>setTimeout(renderOverlapWarning,0));el.addEventListener('input',()=>setTimeout(renderOverlapWarning,0))}
 }
 if(!form.dataset.fpTenantDisplayV10){
  form.dataset.fpTenantDisplayV10='1';
  form.addEventListener('submit',paint,true);
 }
 paint();renderOverlapWarning();
 return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>100)clearInterval(timer)},100);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else install();
window.addEventListener('fleetpilot:access-ready',()=>setTimeout(()=>{install();paint();renderOverlapWarning()},0));
window.addEventListener('fleetpilot:authoritative-assignments',()=>setTimeout(paint,0));
})();