/* FleetPilot — payment tenant picker v12
   Uses FleetPilotCore bridge instead of window.db because legacy db lives in global lexical scope.
   Assigned account driver is selected automatically; manual tenants remain selectable.
   Duplicate warning detects any overlapping payment period for the same vehicle. */
(()=>{
'use strict';
if(window.__fpPaymentTenantPickerV12)return;window.__fpPaymentTenantPickerV12=true;
const $=s=>document.querySelector(s);
const same=(a,b)=>String(a??'')===String(b??'');
const clean=v=>String(v||'').trim();
const core=()=>window.FleetPilotCore||window.FleetPilot?.Core||null;
const cars=()=>{
 try{const rows=core()?.cars?.();if(Array.isArray(rows))return rows}catch{}
 try{const rows=window.fleetCars?.();if(Array.isArray(rows))return rows}catch{}
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
function install(){
 const dialog=$('#paymentDialog'),select=$('#paymentCarId'),form=$('#paymentForm');if(!dialog||!select||!form||!$('#paymentTenant'))return false;
 ensurePicker();
 if(!dialog.dataset.fpTenantPickerV12){dialog.dataset.fpTenantPickerV12='1';new MutationObserver(()=>{if(!dialog.open)return;[0,30,100,250].forEach(ms=>setTimeout(()=>fillPicker(),ms));Promise.resolve(window.loadWorkspaceDriverDirectory?.()).then(()=>fillPicker({preserveUserChoice:true})).catch(()=>{})}).observe(dialog,{attributes:true,attributeFilter:['open']})}
 if(!select.dataset.fpTenantPickerV12){select.dataset.fpTenantPickerV12='1';select.addEventListener('change',()=>{fillPicker();setTimeout(()=>fillPicker(),60)})}
 if(!form.dataset.fpTenantPickerV12){form.dataset.fpTenantPickerV12='1';form.addEventListener('submit',()=>fillPicker({preserveUserChoice:true}),true)}
 fillPicker();return true;
}
let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>100)clearInterval(timer)},100);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else install();
window.addEventListener('fleetpilot:access-ready',()=>setTimeout(()=>{install();fillPicker()},0));
window.addEventListener('fleetpilot:authoritative-assignments',()=>setTimeout(()=>fillPicker({preserveUserChoice:true}),0));
})();