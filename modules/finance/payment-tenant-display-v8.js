/* FleetPilot — payment tenant picker v11
   Rental payment dialog uses one visible dropdown.
   Assigned account driver is selected automatically; manual tenants remain selectable.
   Duplicate warning detects any overlapping payment period for the same vehicle. */
(()=>{
'use strict';
if(window.__fpPaymentTenantPickerV11)return;window.__fpPaymentTenantPickerV11=true;
const $=s=>document.querySelector(s);
const same=(a,b)=>String(a??'')===String(b??'');
const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
const payments=()=>Array.isArray(window.db?.payments)?window.db.payments:[];
const getCar=id=>cars().find(c=>same(c.id,id))||null;
const clean=v=>String(v||'').trim();

function paymentHistoryTenant(carId){
 const rows=payments().filter(p=>same(p.carId,carId)&&clean(p.tenant));
 rows.sort((a,b)=>String(b.date||b.to||b.from||'').localeCompare(String(a.date||a.to||a.from||'')));
 return clean(rows[0]?.tenant);
}

function resolveAssignedDriver(carId){
 const c=getCar(carId);if(!c)return{name:'',email:'',userId:'',source:'none'};
 // Account-backed vehicle assignment has priority when available.
 try{
  const resolved=window.workspaceDriverForCar?.(c)||null;
  const name=clean(resolved?.name||resolved?.email);
  if(name)return{name,email:clean(resolved?.email),userId:clean(resolved?.userId||c.driverUserId),source:resolved?.source||'account'};
 }catch{}
 const row=window.FleetPilotAssignmentState?.forCar?.(c.id)||null;
 const rowName=clean(row?.driver_name||row?.driver_email);
 if(rowName)return{name:rowName,email:clean(row?.driver_email),userId:clean(row?.driver_user_id),source:'account'};
 // Local account data from the vehicle.
 if(clean(c.driverUserId)){
  const name=clean(c.driverName||c.tenant||c.driverEmail);
  if(name)return{name,email:clean(c.driverEmail),userId:clean(c.driverUserId),source:'account'};
 }
 // Manual tenant typed into the vehicle card.
 const manual=clean(c.tenant||c.driverName||c.driverEmail);
 if(manual)return{name:manual,email:clean(c.driverEmail),userId:'',source:'manual'};
 const historical=paymentHistoryTenant(c.id);
 if(historical)return{name:historical,email:'',userId:'',source:'payment-history'};
 return{name:'',email:'',userId:'',source:'none'};
}

function tenantChoices(){
 const map=new Map();
 const add=(name,email='',userId='',source='manual')=>{
  name=clean(name);email=clean(email);userId=clean(userId);if(!name)return;
  const key=(userId?`u:${userId}`:`n:${name.toLowerCase()}`);
  const prev=map.get(key);
  if(!prev||source==='account')map.set(key,{name,email,userId,source});
 };
 // Vehicle records are reliable for both account drivers and manually entered tenants.
 cars().forEach(c=>{
  const name=clean(c.driverName||c.tenant||c.driverEmail);
  if(name)add(name,c.driverEmail,c.driverUserId,c.driverUserId?'account':'manual');
 });
 // If the shared directory is exposed, add its richer account records too.
 const directory=Array.isArray(window.workspaceDriverDirectory)?window.workspaceDriverDirectory:[];
 directory.filter(m=>String(m?.role||'').toLowerCase()==='driver'&&m?.status!=='disabled').forEach(m=>{
  const email=clean(window.workspaceDriverEmail?.(m)||m?.profiles?.email||m?.email);
  const name=clean(window.workspaceDriverName?.(m)||m?.display_name||m?.name||m?.full_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||email);
  add(name,email,m?.user_id||m?.id,'account');
 });
 // Preserve historical manual tenants that may no longer be attached to a car.
 payments().forEach(p=>add(p.tenant,'','', 'history'));
 return [...map.values()].sort((a,b)=>{
  if(a.source==='account'&&b.source!=='account')return-1;
  if(b.source==='account'&&a.source!=='account')return 1;
  return a.name.localeCompare(b.name,'ru');
 });
}

function ensurePicker(){
 const stored=$('#paymentTenant');if(!stored)return null;
 $('#paymentTenantDisplay')?.remove();
 $('#paymentTenantDisplayV8')?.remove();
 let picker=$('#paymentTenantPicker');
 if(!picker){
  picker=document.createElement('select');
  picker.id='paymentTenantPicker';
  picker.title='Фактический водитель, за которого проводится оплата';
  stored.insertAdjacentElement('afterend',picker);
  picker.addEventListener('change',()=>{
   const opt=picker.selectedOptions?.[0];
   stored.value=clean(picker.value);
   stored.dataset.driverUserId=clean(opt?.dataset?.userId);
   stored.dataset.driverSource=clean(opt?.dataset?.source)||'manual';
  });
 }
 stored.type='hidden';
 return picker;
}

function fillPicker({preserveUserChoice=false}={}){
 const stored=$('#paymentTenant'),picker=ensurePicker(),carId=$('#paymentCarId')?.value||'';
 if(!stored||!picker)return;
 const oldValue=preserveUserChoice?clean(picker.value):'';
 const currentPaymentId=clean($('#paymentId')?.value);
 const currentPayment=currentPaymentId?payments().find(p=>same(p.id,currentPaymentId)):null;
 const assigned=currentPayment&&clean(currentPayment.tenant)
  ?{name:clean(currentPayment.tenant),email:'',userId:'',source:'payment'}
  :resolveAssignedDriver(carId);
 const choices=tenantChoices();
 const selectedName=oldValue||assigned.name||'';
 const selectedKey=selectedName.toLowerCase();
 const hasSelected=choices.some(x=>x.name.toLowerCase()===selectedKey);
 if(selectedName&&!hasSelected)choices.unshift({name:selectedName,email:'',userId:assigned.userId||'',source:assigned.source||'manual'});
 const account=choices.filter(x=>x.source==='account');
 const manual=choices.filter(x=>x.source!=='account');
 const esc=s=>String(s||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 let html='<option value="">Водитель не назначен</option>';
 if(account.length){
  html+='<optgroup label="Водители с аккаунтом">'+account.map(x=>`<option value="${esc(x.name)}" data-user-id="${esc(x.userId)}" data-source="account">${esc(x.name)}${x.email&&x.email!==x.name?` · ${esc(x.email)}`:''}</option>`).join('')+'</optgroup>';
 }
 if(manual.length){
  html+='<optgroup label="Вписаны вручную">'+manual.map(x=>`<option value="${esc(x.name)}" data-user-id="" data-source="${esc(x.source)}">${esc(x.name)}</option>`).join('')+'</optgroup>';
 }
 picker.innerHTML=html;
 picker.value=selectedName;
 // Assigned driver is automatic default. User can still pick another tenant manually.
 const opt=picker.selectedOptions?.[0];
 stored.value=clean(picker.value);
 stored.dataset.driverUserId=clean(opt?.dataset?.userId);
 stored.dataset.driverSource=clean(opt?.dataset?.source)||assigned.source||'none';
}

function overlaps(aFrom,aTo,bFrom,bTo){
 if(!aFrom||!aTo||!bFrom||!bTo)return false;
 return String(aFrom)<=String(bTo)&&String(aTo)>=String(bFrom);
}
function overlappingPayments(){
 const carId=$('#paymentCarId')?.value||'',from=$('#paymentFrom')?.value||'',to=$('#paymentTo')?.value||'',currentId=$('#paymentId')?.value||'';
 if(!carId||!from||!to)return[];
 return payments().filter(p=>!same(p.id,currentId)&&same(p.carId,carId)&&overlaps(from,to,p.from,p.to));
}
function fmtMoney(v){return window.money?window.money(v):Number(v||0).toFixed(2)}
function formatRange(p){return p?.from&&p?.to?`${p.from} — ${p.to}`:(p?.from||p?.to||'период не указан')}
function renderOverlapWarning(){
 const box=$('#paymentDuplicateWarning');if(!box)return;
 const rows=overlappingPayments();box.hidden=!rows.length;
 if(!rows.length){box.textContent='';return}
 const total=rows.reduce((s,p)=>s+Number(p.received||0),0);
 if(rows.length===1){const p=rows[0],who=clean(p.tenant);box.textContent=`⚠️ Выбранный период пересекается с уже сохранённой оплатой${who?` (${who})`:''}: ${formatRange(p)}, получено ${fmtMoney(p.received)}.`}
 else box.textContent=`⚠️ Выбранный период пересекается с ${rows.length} уже сохранёнными оплатами. Всего получено: ${fmtMoney(total)}.`;
}
function installOverlapGuard(){
 try{window.checkPaymentDuplicate=renderOverlapWarning}catch{}
 const form=$('#paymentForm');if(!form||form.dataset.fpOverlapGuardV11)return;
 form.dataset.fpOverlapGuardV11='1';
 form.addEventListener('submit',event=>{
  const rows=overlappingPayments();if(!rows.length)return;
  const total=rows.reduce((s,p)=>s+Number(p.received||0),0);
  const msg=rows.length===1?`За выбранный период уже есть пересекающаяся оплата: ${formatRange(rows[0])}, получено ${fmtMoney(rows[0].received)}.\n\nВсё равно сохранить новую запись?`:`Выбранный период пересекается с ${rows.length} оплатами, всего получено ${fmtMoney(total)}.\n\nВсё равно сохранить новую запись?`;
  if(!confirm(msg)){event.preventDefault();event.stopImmediatePropagation()}
 },true);
}

function install(){
 const dialog=$('#paymentDialog'),select=$('#paymentCarId'),form=$('#paymentForm');
 if(!dialog||!select||!form||!$('#paymentTenant'))return false;
 ensurePicker();installOverlapGuard();
 if(!dialog.dataset.fpTenantPickerV11){
  dialog.dataset.fpTenantPickerV11='1';
  new MutationObserver(()=>{
   if(!dialog.open)return;
   [0,30,100,250].forEach(ms=>setTimeout(()=>{fillPicker();renderOverlapWarning()},ms));
   Promise.resolve(window.loadWorkspaceDriverDirectory?.()).then(()=>fillPicker({preserveUserChoice:true})).catch(()=>{});
  }).observe(dialog,{attributes:true,attributeFilter:['open']});
 }
 if(!select.dataset.fpTenantPickerV11){
  select.dataset.fpTenantPickerV11='1';
  select.addEventListener('change',()=>{fillPicker();renderOverlapWarning();setTimeout(()=>fillPicker(),60)});
 }
 for(const id of ['paymentFrom','paymentTo','paymentReferenceWeek','paymentTiming']){
  const el=$('#'+id);if(el&&!el.dataset.fpOverlapV11){el.dataset.fpOverlapV11='1';el.addEventListener('change',()=>setTimeout(renderOverlapWarning,0));el.addEventListener('input',()=>setTimeout(renderOverlapWarning,0))}
 }
 if(!form.dataset.fpTenantPickerV11){form.dataset.fpTenantPickerV11='1';form.addEventListener('submit',()=>fillPicker({preserveUserChoice:true}),true)}
 fillPicker();renderOverlapWarning();return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>100)clearInterval(timer)},100);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else install();
window.addEventListener('fleetpilot:access-ready',()=>setTimeout(()=>{install();fillPicker();renderOverlapWarning()},0));
window.addEventListener('fleetpilot:authoritative-assignments',()=>setTimeout(()=>fillPicker({preserveUserChoice:true}),0));
})();