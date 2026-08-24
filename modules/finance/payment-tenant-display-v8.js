/* FleetPilot — payment tenant picker v13
   Uses FleetPilotCore bridge instead of window.db because legacy db lives in global lexical scope.
   Assigned account driver is selected automatically; manual tenants remain selectable.
   Payment warning detects partial period overlap and shows only the amount attributable to the selected days. */
(()=>{
'use strict';
if(window.__fpPaymentTenantPickerV13)return;window.__fpPaymentTenantPickerV13=true;
const $=s=>document.querySelector(s);
const same=(a,b)=>String(a??'')===String(b??'');
const clean=v=>String(v||'').trim();
const core=()=>window.FleetPilotCore||window.FleetPilot?.Core||null;
const cars=()=>{
 try{const rows=core()?.cars?.();if(Array.isArray(rows))return rows}catch{}
 try{const rows=window.fleetCars?.();if(Array.isArray(rows))return rows}catch{}
 return[];
};
const payments=()=>{
 try{if(typeof db!=='undefined'&&Array.isArray(db?.payments))return db.payments}catch{}
 try{const direct=core()?.db?.();if(Array.isArray(direct?.payments))return direct.payments}catch{}
 try{if(Array.isArray(window.__FLEETPILOT_DB__?.payments))return window.__FLEETPILOT_DB__.payments}catch{}
 return[];
};
const getCar=id=>{
 try{const c=window.car?.(id);if(c)return c}catch{}
 return cars().find(c=>same(c.id,id))||null;
};
function resolveAssignedDriver(carId){
 const c=getCar(carId);if(!c)return{name:'',email:'',userId:'',source:'none'};
 try{
  const resolved=window.workspaceDriverForCar?.(c)||null;
  const name=clean(resolved?.name||resolved?.email);
  if(name)return{name,email:clean(resolved?.email),userId:clean(resolved?.userId||c.driverUserId),source:resolved?.source||'account'};
 }catch{}
 const row=window.FleetPilotAssignmentState?.forCar?.(c.id)||null;
 const rowName=clean(row?.driver_name||row?.driver_email);
 if(rowName)return{name:rowName,email:clean(row?.driver_email),userId:clean(row?.driver_user_id),source:'account'};
 if(clean(c.driverUserId)){
  const name=clean(c.driverName||c.tenant||c.driverEmail);
  if(name)return{name,email:clean(c.driverEmail),userId:clean(c.driverUserId),source:'account'};
 }
 const manual=clean(c.tenant||c.driverName||c.driverEmail);
 if(manual)return{name:manual,email:clean(c.driverEmail),userId:'',source:'manual'};
 return{name:'',email:'',userId:'',source:'none'};
}
function tenantChoices(){
 const map=new Map();
 const add=(name,email='',userId='',source='manual')=>{
  name=clean(name);email=clean(email);userId=clean(userId);if(!name)return;
  const key=userId?`u:${userId}`:`n:${name.toLowerCase()}`;
  const prev=map.get(key);if(!prev||source==='account')map.set(key,{name,email,userId,source});
 };
 cars().forEach(c=>{
  const name=clean(c.driverName||c.tenant||c.driverEmail);
  if(name)add(name,c.driverEmail,c.driverUserId,c.driverUserId?'account':'manual');
 });
 const directory=Array.isArray(window.workspaceDriverDirectory)?window.workspaceDriverDirectory:[];
 directory.filter(m=>String(m?.role||'').toLowerCase()==='driver'&&m?.status!=='disabled').forEach(m=>{
  const email=clean(window.workspaceDriverEmail?.(m)||m?.profiles?.email||m?.email);
  const name=clean(window.workspaceDriverName?.(m)||m?.display_name||m?.name||m?.full_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||email);
  add(name,email,m?.user_id||m?.id,'account');
 });
 return[...map.values()].sort((a,b)=>a.source==='account'&&b.source!=='account'?-1:b.source==='account'&&a.source!=='account'?1:a.name.localeCompare(b.name,'ru'));
}
function ensurePicker(){
 const stored=$('#paymentTenant');if(!stored)return null;
 $('#paymentTenantDisplay')?.remove();$('#paymentTenantDisplayV8')?.remove();
 let picker=$('#paymentTenantPicker');
 if(!picker){
  picker=document.createElement('select');picker.id='paymentTenantPicker';picker.title='Фактический водитель, за которого проводится оплата';
  stored.insertAdjacentElement('afterend',picker);
  picker.addEventListener('change',()=>{const opt=picker.selectedOptions?.[0];stored.value=clean(picker.value);stored.dataset.driverUserId=clean(opt?.dataset?.userId);stored.dataset.driverSource=clean(opt?.dataset?.source)||'manual'});
 }
 stored.type='hidden';return picker;
}
function fillPicker({preserveUserChoice=false}={}){
 const stored=$('#paymentTenant'),picker=ensurePicker(),carId=$('#paymentCarId')?.value||'';if(!stored||!picker)return;
 const oldValue=preserveUserChoice?clean(picker.value):'';
 const assigned=resolveAssignedDriver(carId);
 const choices=tenantChoices();
 const selectedName=oldValue||assigned.name||'';
 if(selectedName&&!choices.some(x=>x.name.toLowerCase()===selectedName.toLowerCase()))choices.unshift({name:selectedName,email:assigned.email||'',userId:assigned.userId||'',source:assigned.source||'manual'});
 const account=choices.filter(x=>x.source==='account'),manual=choices.filter(x=>x.source!=='account');
 const esc=s=>String(s||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 let html='<option value="">Водитель не назначен</option>';
 if(account.length)html+='<optgroup label="Водители с аккаунтом">'+account.map(x=>`<option value="${esc(x.name)}" data-user-id="${esc(x.userId)}" data-source="account">${esc(x.name)}${x.email&&x.email!==x.name?` · ${esc(x.email)}`:''}</option>`).join('')+'</optgroup>';
 if(manual.length)html+='<optgroup label="Вписаны вручную">'+manual.map(x=>`<option value="${esc(x.name)}" data-user-id="" data-source="manual">${esc(x.name)}</option>`).join('')+'</optgroup>';
 picker.innerHTML=html;picker.value=selectedName;
 const opt=picker.selectedOptions?.[0];stored.value=clean(picker.value);stored.dataset.driverUserId=clean(opt?.dataset?.userId);stored.dataset.driverSource=clean(opt?.dataset?.source)||assigned.source||'none';
}

const dayMs=86400000;
function parseDay(value){const s=clean(value);if(!s)return NaN;const t=new Date(s+'T12:00:00').getTime();return Number.isFinite(t)?t:NaN}
function inclusiveDays(from,to){const a=parseDay(from),b=parseDay(to);if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)return 0;return Math.round((b-a)/dayMs)+1}
function overlapInfo(payment,selectedFrom,selectedTo){
 const pf=clean(payment?.from),pt=clean(payment?.to);if(!pf||!pt||!selectedFrom||!selectedTo)return null;
 const overlapFrom=pf>selectedFrom?pf:selectedFrom;
 const overlapTo=pt<selectedTo?pt:selectedTo;
 if(overlapFrom>overlapTo)return null;
 const paymentDays=inclusiveDays(pf,pt),overlapDays=inclusiveDays(overlapFrom,overlapTo);
 if(!paymentDays||!overlapDays)return null;
 const received=Number(payment?.received||0);
 const allocated=Math.round((received/paymentDays*overlapDays)*100)/100;
 return{payment,overlapFrom,overlapTo,paymentDays,overlapDays,received,allocated};
}
function overlappingPaymentParts(){
 const carId=clean($('#paymentCarId')?.value),from=clean($('#paymentFrom')?.value),to=clean($('#paymentTo')?.value),currentId=clean($('#paymentId')?.value);
 if(!carId||!from||!to)return[];
 return payments().filter(p=>!same(p.id,currentId)&&same(p.carId,carId)).map(p=>overlapInfo(p,from,to)).filter(Boolean);
}
function fmtMoney(v){try{return window.money?window.money(v):`${Number(v||0).toFixed(2)} zł`}catch{return `${Number(v||0).toFixed(2)} zł`}}
function fmtDate(v){try{return window.date?window.date(v):v}catch{return v}}
function renderOverlapWarning(){
 const box=$('#paymentDuplicateWarning');if(!box)return;
 const parts=overlappingPaymentParts();
 box.hidden=!parts.length;
 if(!parts.length){box.textContent='';return}
 const total=parts.reduce((s,x)=>s+x.allocated,0);
 const days=[...new Set(parts.flatMap(x=>{const arr=[];let t=parseDay(x.overlapFrom),end=parseDay(x.overlapTo);while(t<=end){arr.push(new Date(t).toISOString().slice(0,10));t+=dayMs}return arr}))].length;
 if(parts.length===1){
  const x=parts[0],who=clean(x.payment.tenant);
  box.textContent=`⚠️ За выбранный период уже получено ${fmtMoney(x.allocated)}${who?` (${who})`:''}. Пересечение: ${fmtDate(x.overlapFrom)} — ${fmtDate(x.overlapTo)} · ${x.overlapDays} дн. из оплаты ${fmtDate(x.payment.from)} — ${fmtDate(x.payment.to)} (${fmtMoney(x.received)}).`;
 }else{
  box.textContent=`⚠️ За выбранный период уже получено ${fmtMoney(total)}. Найдено ${parts.length} пересекающихся оплат, покрыто ${days} дн.`;
 }
}
function scheduleOverlapWarning(){setTimeout(renderOverlapWarning,0);setTimeout(renderOverlapWarning,40)}
function installOverlapWarning(){
 try{window.checkPaymentDuplicate=renderOverlapWarning}catch{}
 for(const id of ['paymentCarId','paymentFrom','paymentTo','paymentReferenceWeek','paymentTiming']){
  const el=$('#'+id);if(!el||el.dataset.fpOverlapV13)continue;
  el.dataset.fpOverlapV13='1';el.addEventListener('change',scheduleOverlapWarning);el.addEventListener('input',scheduleOverlapWarning);
 }
}

function install(){
 const dialog=$('#paymentDialog'),select=$('#paymentCarId'),form=$('#paymentForm');if(!dialog||!select||!form||!$('#paymentTenant'))return false;
 ensurePicker();installOverlapWarning();
 if(!dialog.dataset.fpTenantPickerV13){dialog.dataset.fpTenantPickerV13='1';new MutationObserver(()=>{if(!dialog.open)return;[0,30,100,250].forEach(ms=>setTimeout(()=>{fillPicker();renderOverlapWarning()},ms));Promise.resolve(window.loadWorkspaceDriverDirectory?.()).then(()=>fillPicker({preserveUserChoice:true})).catch(()=>{})}).observe(dialog,{attributes:true,attributeFilter:['open']})}
 if(!select.dataset.fpTenantPickerV13){select.dataset.fpTenantPickerV13='1';select.addEventListener('change',()=>{fillPicker();scheduleOverlapWarning();setTimeout(()=>fillPicker(),60)})}
 if(!form.dataset.fpTenantPickerV13){form.dataset.fpTenantPickerV13='1';form.addEventListener('submit',()=>fillPicker({preserveUserChoice:true}),true)}
 fillPicker();renderOverlapWarning();return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>100)clearInterval(timer)},100);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else install();
window.addEventListener('fleetpilot:access-ready',()=>setTimeout(()=>{install();fillPicker();renderOverlapWarning()},0));
window.addEventListener('fleetpilot:authoritative-assignments',()=>setTimeout(()=>fillPicker({preserveUserChoice:true}),0));
})();