/* FleetPilot — granular permissions for vehicle profile tabs and actions */
(()=>{'use strict';
 const TAB_PERM={info:'car.profile.info',service:'car.profile.service',finance:'car.profile.finance',documents:'car.profile.documents',history:'car.profile.history',damages:'car.profile.damages'};
 const FALLBACK_PERM={info:'cars.view',service:'service.view',finance:'finance.view',documents:'documents.view',history:'cars.view',damages:'service.view'};
 const WANTED=[
  ['car.profile.info','Обзор'],
  ['car.profile.service','Сервис'],
  ['car.profile.finance','Финансы'],
  ['car.profile.documents','Документы'],
  ['car.profile.history','История'],
  ['car.profile.damages','Повреждения'],
  ['car.profile.finance.edit','Финансы: изменять'],
  ['car.profile.documents.edit','Документы: изменять'],
  ['car.profile.service.edit','Сервис: изменять']
 ];
 function role(){try{return window.enterpriseCurrentRole?.()||''}catch{return''}}
 function owner(){return role()==='owner'||Boolean(window.FleetPilotCloud?.isWorkspaceOwner)}
 function explicitValue(key){
  try{
   const values=typeof companyPermissions==='object'?(companyPermissions?.[role()]||{}):{};
   return Object.prototype.hasOwnProperty.call(values,key)?Boolean(values[key]):null
  }catch{return null}
 }
 function canBase(key){try{return typeof window.enterpriseCan==='function'?Boolean(window.enterpriseCan(key)):true}catch{return true}}
 function allowed(tab){
  if(owner())return true;
  const key=TAB_PERM[tab];if(!key)return false;
  const explicit=explicitValue(key);
  return explicit===null?canBase(FALLBACK_PERM[tab]):explicit
 }
 function canEdit(area){
  if(owner())return true;
  const key=`car.profile.${area}.edit`;
  const explicit=explicitValue(key);
  if(explicit!==null)return explicit;
  return area==='finance'?canBase('finance.payments')||canBase('finance.expenses'):area==='documents'?canBase('documents.create'):canBase('service.edit')
 }
 window.enterpriseCanCarProfileTab=allowed;
 window.enterpriseCanCarProfileEdit=canEdit;

 function installDefinitions(){
  try{
   if(typeof ROLE_PERMISSION_DEFINITIONS!=='object')return;
   ROLE_PERMISSION_DEFINITIONS.carProfile=WANTED.slice();
   if(typeof renderRolePermissions==='function'&&document.querySelector('#rolePermissionsGrid'))renderRolePermissions()
  }catch(error){console.warn('FleetPilot car-profile permission definitions',error)}
 }
 function parseTab(button){
  const on=String(button?.getAttribute?.('onclick')||'');
  const m=on.match(/openCar\([^,]+,\s*['"]([^'"]+)['"]/);
  return m?.[1]||button?.dataset?.carTab||''
 }
 function firstAllowed(){return ['info','service','documents','history','damages','finance'].find(allowed)||''}
 function apply(){
  const root=document.querySelector('#carDetail');if(!root)return;
  root.querySelectorAll('.car-detail-tabs button').forEach(btn=>{
   const tab=parseTab(btn);if(!tab)return;
   const ok=allowed(tab);btn.hidden=!ok;btn.disabled=!ok;btn.setAttribute('aria-hidden',String(!ok));
  });
  if(!canEdit('finance'))root.querySelectorAll('.car-finance-dashboard button').forEach(b=>{const on=String(b.getAttribute('onclick')||'');if(/openPaymentDialog|openDepositDialog|openExpenseDialog|editExpense|setExpense|deleteExpense/i.test(on))b.hidden=true});
  if(!canEdit('documents'))root.querySelectorAll('.profile-documents-card .btn.primary,[onclick*="openDocumentDialog"]').forEach(b=>b.hidden=true);
  if(!canEdit('service'))root.querySelectorAll('.car-tab-content [onclick*="openRepairDialog"],.car-tab-content [onclick*="editRepair"],.car-tab-content [onclick*="advanceServiceRepair"]').forEach(b=>b.hidden=true);
 }

 let rawOpenCar=null;
 function wrapOpenCar(){
  const current=window.openCar;
  if(typeof current!=='function')return;
  if(current.__fleetPilotCarProfilePermissions)return;
  rawOpenCar=current;
  const wrapped=function(id,tab='info'){
   let target=String(tab||'info');
   if(!allowed(target))target=firstAllowed();
   if(!target){try{window.toast?.('Нет доступа к профилю автомобиля')}catch{};return}
   const result=rawOpenCar.call(this,id,target);
   queueMicrotask(apply);
   requestAnimationFrame(apply);
   return result
  };
  wrapped.__fleetPilotCarProfilePermissions=true;
  wrapped.__rawOpenCar=rawOpenCar;
  window.openCar=wrapped
 }

 async function refreshPermissions(){
  try{
   if(typeof loadRolePermissions==='function')await loadRolePermissions();
   else if(window.FleetPilotCloud?.getRolePermissions&&typeof companyPermissions==='object')companyPermissions=await window.FleetPilotCloud.getRolePermissions();
  }catch{}
  installDefinitions();wrapOpenCar();apply();
  const active=document.querySelector('#carPage.page.active');
  if(active){
   const hash=String(location.hash||'');const m=hash.match(/#\/car\/([^/]+)(?:\/([^/]+))?/);
   if(m){const id=decodeURIComponent(m[1]),tab=m[2]||'info';if(!allowed(tab))window.openCar?.(id,firstAllowed())}
  }
 }

 const observer=new MutationObserver(()=>apply());
 function boot(){
  installDefinitions();wrapOpenCar();
  const root=document.querySelector('#carDetail');if(root)observer.observe(root,{childList:true,subtree:true});
  apply()
 }
 document.addEventListener('DOMContentLoaded',boot,{once:true});
 window.addEventListener('fleetpilot:access-ready',()=>setTimeout(()=>{boot();refreshPermissions()},0));
 window.addEventListener('fleetpilot:modules-ready',()=>setTimeout(boot,0));
 window.addEventListener('fleetpilot:permissions-changed',refreshPermissions);
 document.addEventListener('click',event=>{
  const save=event.target.closest?.('#saveRolePermissions');
  if(save)setTimeout(refreshPermissions,500);
  const tabButton=event.target.closest?.('#carDetail .car-detail-tabs button');
  if(tabButton){const tab=parseTab(tabButton);if(tab&&!allowed(tab)){event.preventDefault();event.stopImmediatePropagation();try{window.toast?.('Для этой вкладки нет доступа')}catch{}}}
 },true);
 setTimeout(boot,50);setTimeout(boot,500);setTimeout(boot,1500);
})();