/* FleetPilot Driver Domain V2 — single source of truth for driver state */
(()=>{
'use strict';
if(window.__fpDriverDomainV2)return;window.__fpDriverDomainV2=true;

const same=(a,b)=>String(a??'')===String(b??'');
const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
const activeCars=()=>cars().filter(c=>!c?.deletedAt);
const getMemberId=m=>String(m?.user_id||m?.id||'');
const getMemberEmail=m=>window.workspaceDriverEmail?.(m)||m?.profiles?.email||m?.email||'';
const getMemberName=m=>window.workspaceDriverName?.(m)||m?.display_name||m?.name||m?.full_name||[m?.first_name,m?.last_name].filter(Boolean).join(' ')||getMemberEmail(m)||'Водитель';
const getMemberPhone=m=>window.workspaceDriverPhone?.(m)||m?.phone||m?.profiles?.phone||'';
const getCarForDriver=userId=>activeCars().find(c=>same(c.driverUserId,userId))||null;

function driverUiState(userId){
 const c=getCarForDriver(userId);
 return c?{code:'active',label:'На линии',className:'accepted',car:c}:{code:'free',label:'Без автомобиля',className:'free',car:null};
}
window.FleetPilotDriverDomain=Object.freeze({driverUiState,getCarForDriver});

// Driver status is intentionally independent from vehicle operational status and handover acceptance.
// Acceptance still exists for the driver's handover flow, but it is NOT a driver registry status.
window.driverPickerStatus=function(member){
 const state=driverUiState(getMemberId(member));
 const c=state.car;
 return {label:state.label,cls:state.className,vehicle:c?`${window.model?.(c)?.brand||''} ${window.model?.(c)?.model||''} · ${c.plate||'—'}`.trim():''};
};
window.fleetDriverMeta=function(c){
 if(!c)return'Не назначен';
 return c.driverUserId||c.tenant?'На линии':'Не назначен';
};

function normalizeFilter(){
 const select=document.querySelector('#driversRegistryFilter');
 if(!select)return;
 const wanted=[['','Все'],['active','На линии'],['free','Без автомобиля']];
 const current=select.value;
 const signature=[...select.options].map(o=>`${o.value}:${o.textContent}`).join('|');
 const target=wanted.map(x=>x.join(':')).join('|');
 if(signature!==target){
   select.innerHTML=wanted.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');
   select.value=wanted.some(([v])=>v===current)?current:'';
 }
}

async function renderDriversRegistryV2(){
 const root=document.querySelector('#driversRegistryList');if(!root)return;
 normalizeFilter();
 root.innerHTML='<div class="owner-empty">Загрузка водителей…</div>';
 try{
   await window.loadWorkspaceDriverDirectory?.();
   const members=(window.workspaceDriverDirectory||[]).filter(m=>m.role==='driver'&&m.status!=='disabled');
   const query=(document.querySelector('#driversRegistrySearch')?.value||'').trim().toLowerCase();
   const filter=document.querySelector('#driversRegistryFilter')?.value||'';
   const accountRows=members.map(member=>{
     const userId=getMemberId(member),state=driverUiState(userId);
     return {type:'account',member,userId,state,assignedCar:state.car,name:getMemberName(member),email:getMemberEmail(member),phone:getMemberPhone(member)};
   });
   const knownEmails=new Set(accountRows.map(x=>String(x.email||'').trim().toLowerCase()).filter(Boolean));
   const manualRows=activeCars().filter(c=>c.tenant&&!c.driverUserId&&!knownEmails.has(String(c.driverEmail||'').trim().toLowerCase())).map(c=>({type:'manual',member:null,userId:'',state:{code:'active',label:'На линии',className:'accepted',car:c},assignedCar:c,name:c.tenant||c.driverName||'Водитель',email:c.driverEmail||'',phone:c.driverPhone||''}));
   const rows=[...accountRows,...manualRows].filter(item=>{
     const c=item.assignedCar;
     const text=`${item.name} ${item.email} ${item.phone} ${c?`${window.model?.(c)?.brand||''} ${window.model?.(c)?.model||''} ${c.plate||''} ${c.city||''}`:''}`.toLowerCase();
     if(query&&!text.includes(query))return false;
     if(filter==='active'&&item.state.code!=='active')return false;
     if(filter==='free'&&item.state.code!=='free')return false;
     return true;
   });
   const visible=typeof window.fpListRows==='function'?window.fpListRows('driversRegistry',rows):rows.slice(0,10);
   root.innerHTML=visible.map(item=>{
     const c=item.assignedCar,cls=item.state.className,status=item.state.label;
     const m=c?window.model?.(c)||{}:{};
     const vehicle=c?`<button type="button" class="driver-vehicle-link" data-open-driver-car="${c.id}">${m.brand||''} ${m.model||''}<small>${c.plate||'Без номера'}</small></button>`:'<span class="driver-no-car">Без автомобиля</span>';
     return `<article class="driver-registry-card ${cls}" data-open-driver-profile="${item.type==='account'?item.userId:''}" role="${item.type==='account'?'button':'article'}" tabindex="${item.type==='account'?'0':'-1'}"><div class="driver-registry-avatar">${String(item.name||'D').trim().charAt(0).toUpperCase()}</div><div class="driver-registry-main"><strong>${item.name||'Водитель'}</strong><small>${item.email||'Без e-mail'}</small></div><div class="driver-registry-phone">${item.phone||'—'}</div><div class="driver-registry-vehicle">${vehicle}</div><div class="driver-registry-city">${c?.city||'Без города'}</div><span class="driver-registry-status ${cls}">${status}</span><div class="driver-registry-actions">${item.type==='account'?`<button type="button" class="btn" data-edit-driver="${item.userId}">Редактировать</button><button type="button" class="driver-delete-button" data-delete-driver="${item.userId}">Удалить</button>`:`<button type="button" class="driver-delete-button" data-delete-manual-driver="${c?.id||''}">Удалить</button>`}</div></article>`;
   }).join('')||'<div class="owner-empty">Водители не найдены.</div>';
   window.fpAppendListMore?.(root,'driversRegistry',rows.length,renderDriversRegistryV2);
   root.querySelectorAll('[data-open-driver-car]').forEach(b=>b.onclick=e=>{e.stopPropagation();window.openCar?.(b.dataset.openDriverCar)});
   root.querySelectorAll('[data-open-driver-profile]').forEach(card=>{
     const id=card.dataset.openDriverProfile;if(!id)return;
     card.onclick=e=>{if(e.target.closest('button'))return;window.openAdminDriverProfile?.(id)||window.openFleetPilotDriverProfile?.(id)};
     card.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();window.openAdminDriverProfile?.(id)||window.openFleetPilotDriverProfile?.(id)}};
   });
   root.querySelectorAll('[data-edit-driver]').forEach(b=>b.onclick=e=>{e.stopPropagation();window.openEditDriverProfile?.(b.dataset.editDriver)});
   root.querySelectorAll('[data-delete-driver]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const id=b.dataset.deleteDriver;const assigned=getCarForDriver(id);if(assigned)return window.toast?.('Сначала снимите водителя в профиле автомобиля');if(!confirm('Удалить водителя из текущего Workspace? История останется сохранена.'))return;try{await window.FleetPilotCloud?.enterpriseUpdateMember?.(id,{status:'disabled'});await window.loadWorkspaceDriverDirectory?.();renderDriversRegistryV2();window.toast?.('Водитель удалён')}catch(err){window.toast?.(err.message||String(err))}});
   root.querySelectorAll('[data-delete-manual-driver]').forEach(b=>b.onclick=e=>{e.stopPropagation();const c=window.car?.(String(b.dataset.deleteManualDriver));if(!c)return;if(!confirm('Удалить ручного водителя из автомобиля?'))return;c.tenant='';c.driverName='';c.driverEmail='';c.driverPhone='';c.driverUserId='';c.driverAssignmentSource='';window.save?.();window.renderFleet?.();renderDriversRegistryV2()});
 }catch(error){root.innerHTML=`<div class="owner-empty">${error.message||error}</div>`}
}
window.renderDriversRegistry=renderDriversRegistryV2;

// Re-render only the driver registry. Never navigate, reload or mutate vehicle status here.
let refreshTimer=0;
function refreshRegistry(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{try{renderDriversRegistryV2()}catch{}},80)}
window.addEventListener('fleetpilot:driver-assignment-changed',refreshRegistry);
window.addEventListener('fleetpilot:assignments-changed',refreshRegistry);
window.addEventListener('fleetpilot:access-ready',refreshRegistry);
document.addEventListener('change',e=>{if(e.target?.id==='driversRegistryFilter')refreshRegistry()});
document.addEventListener('input',e=>{if(e.target?.id==='driversRegistrySearch')refreshRegistry()});

// Kill stale labels left in already-rendered DOM without using them as state.
function scrubLegacyLabels(){
 document.querySelectorAll('#driversRegistryList .driver-registry-status').forEach(el=>{
   const card=el.closest('[data-open-driver-profile]');
   const id=card?.dataset.openDriverProfile;
   if(id){const s=driverUiState(id);el.textContent=s.label;el.className=`driver-registry-status ${s.className}`}
 });
}
new MutationObserver(scrubLegacyLabels).observe(document.documentElement,{subtree:true,childList:true});
setTimeout(()=>{normalizeFilter();refreshRegistry();scrubLegacyLabels()},0);
console.info('FleetPilot Driver Domain V2 active');
})();
