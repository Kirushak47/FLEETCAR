/* FleetPilot Permission Core V2 — centralized role/page/action enforcement */
(()=>{'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 const role=()=>String(window.enterpriseCurrentRole?.()||window.FleetPilotCloud?.role||'user').toLowerCase();
 const owner=()=>['owner','admin','administrator','ceo'].includes(role())||Boolean(window.FleetPilotCloud?.isWorkspaceOwner);
 const can=p=>owner()||(typeof window.enterpriseCan==='function'&&Boolean(window.enterpriseCan(p)));
 const defs={
  cars:[['cars.view','Видеть автомобили'],['cars.create','Добавлять автомобили'],['cars.edit','Редактировать автомобили'],['cars.delete','Удалять автомобили'],['cars.assign','Назначать водителей'],['cars.mileage','Изменять пробег'],['cars.gps','Видеть GPS и карту']],
  finance:[['finance.view','Видеть финансы'],['finance.expenses','Добавлять расходы'],['finance.payments','Редактировать платежи'],['finance.analytics','Видеть прибыль и аналитику']],
  service:[['service.view','Видеть ремонты'],['service.create','Создавать ремонты'],['service.edit','Менять статус ремонта'],['service.photos','Добавлять фотографии'],['service.calendar','Видеть календарь']],
  documents:[['documents.view','Видеть документы'],['documents.create','Добавлять документы'],['documents.delete','Удалять документы'],['documents.contracts','Видеть договоры']],
  company:[['company.team','Видеть команду'],['company.drivers.manage','Управлять водителями и создавать водителей'],['company.invite','Приглашать пользователей'],['company.roles','Менять роли'],['company.permissions','Менять права'],['company.data','Управлять данными и резервными копиями']],
  carProfile:[['car.profile.info','Обзор'],['car.profile.service','Сервис'],['car.profile.finance','Финансы'],['car.profile.documents','Документы'],['car.profile.history','История'],['car.profile.damages','Повреждения'],['car.profile.finance.edit','Финансы: изменять'],['car.profile.documents.edit','Документы: изменять'],['car.profile.service.edit','Сервис: изменять']],
  driver:[['driver.portal','Использовать кабинет водителя'],['driver.tasks','Выполнять задания'],['driver.photos','Загружать фотоконтроль'],['driver.protocols','Подписывать протоколы']]
 };
 const actionMap={
  'cars.create':['#headerAdd','[data-quick-action="car"]','[onclick*="openCarDialog(\'\')"]'],
  'cars.edit':['#carSubmitButton','[onclick*="openCarDialog("]'],
  'cars.delete':['[onclick*="deleteCar("]'],
  'cars.assign':['[data-driver-assignment]','[data-assign-driver]','[onclick*="assignDriver"]'],
  'cars.mileage':['#mileageDialog button[type="submit"]','[onclick*="openMileage"]'],
  'service.create':['#addRepair','[data-quick-action="repair"]','[onclick*="openRepairDialog(\'\')"]'],
  'service.edit':['#repairSubmitButton','[onclick*="editRepair"]','[onclick*="deleteRepair("]','[onclick*="advanceServiceRepair"]'],
  'finance.expenses':['#addExpense','[data-quick-action="expense"]','[onclick*="openExpenseDialog"]'],
  'finance.payments':['#addPayment','[data-quick-action="payment"]','[onclick*="openPaymentDialog"]','[onclick*="openDepositDialog"]'],
  'documents.create':['#addDocument','[data-quick-action="document"]','[onclick*="openDocumentDialog"]'],
  'documents.delete':['[onclick*="deleteDocument("]'],
  'company.drivers.manage':['#createDriverButton','#openCreateDriver','#openCreateDriverDialog','#addDriver','#newDriver','#createDriver','[data-create-driver]','[data-open-create-driver]'],
  'company.invite':['#openInviteMember','#openInviteMemberSecondary'],
  'company.permissions':['[data-company-tab="permissions"]','#saveRolePermissions','#resetRolePermissions'],
  'company.roles':['select[data-enterprise-role]'],
  'company.data':['[data-company-tab="data"]','#createManualSnapshot']
 };
 function installDefinitions(){
  if(typeof ROLE_PERMISSION_DEFINITIONS!=='object')return;
  for(const [group,items] of Object.entries(defs)){
   const target=ROLE_PERMISSION_DEFINITIONS[group]||(ROLE_PERMISSION_DEFINITIONS[group]=[]);
   const existing=new Set(target.map(x=>x?.[0]));items.forEach(x=>{if(!existing.has(x[0]))target.push(x)})
  }
  try{if(typeof ROLE_PERMISSION_LABELS==='object'&&!ROLE_PERMISSION_LABELS.user)ROLE_PERMISSION_LABELS.user='Пользователь'}catch{}
 }
 function applyActions(){
  for(const [perm,selectors] of Object.entries(actionMap)){
   const ok=can(perm);
   selectors.forEach(sel=>{try{document.querySelectorAll(sel).forEach(el=>{el.hidden=!ok;el.setAttribute('aria-hidden',String(!ok));if('disabled'in el)el.disabled=!ok})}catch{}})
  }
  document.querySelectorAll('button,a').forEach(el=>{
   const text=(el.textContent||'').trim().toLowerCase();
   if(/создать водителя|добавить водителя|новый водитель/.test(text)&&!can('company.drivers.manage')){el.hidden=true;el.setAttribute('aria-hidden','true')}
  })
 }
 function applyPages(){try{window.applyEnterpriseAccess?.()}catch{};applyActions();try{window.FleetPilotDriverManagementPermissions?.apply?.()}catch{};try{window.enterpriseCanCarProfileTab&&document.querySelector('#carDetail')&&window.dispatchEvent(new Event('fleetpilot:permissions-changed'))}catch{}}
 function guardClick(e){
  const target=e.target?.closest?.('button,a,[role="button"],select');if(!target)return;
  for(const [perm,selectors] of Object.entries(actionMap)){
   let match=false;for(const sel of selectors){try{if(target.matches(sel)||target.closest(sel)){match=true;break}}catch{}}
   if(match&&!can(perm)){e.preventDefault();e.stopImmediatePropagation();window.toast?.('Нет доступа к этому действию');return}
  }
  const text=(target.textContent||'').trim().toLowerCase();if(/создать водителя|добавить водителя|новый водитель/.test(text)&&!can('company.drivers.manage')){e.preventDefault();e.stopImmediatePropagation();window.toast?.('Нет доступа к управлению водителями')}
 }
 function guardSubmit(e){
  const form=e.target,id=String(form?.id||'').toLowerCase(),dialogText=(form?.closest?.('dialog')?.textContent||'').toLowerCase();
  const tests=[
   ['company.drivers.manage',/driver/.test(id)&&/(create|add|new|invite)/.test(id)||(/водител/.test(dialogText)&&/создать|добавить|приглас/.test(dialogText))],
   ['cars.edit',/car.*form|vehicle.*form/.test(id)],['service.edit',/repair.*form|service.*form/.test(id)],['finance.expenses',/expense.*form/.test(id)],['finance.payments',/payment.*form|deposit.*form/.test(id)],['documents.create',/document.*form/.test(id)]
  ];
  for(const [perm,hit] of tests)if(hit&&!can(perm)){e.preventDefault();e.stopImmediatePropagation();window.toast?.('Нет доступа к этому действию');return}
 }
 function wrapSavePermissions(){
  const cloud=window.FleetPilotCloud;if(!cloud||typeof cloud.saveRolePermissions!=='function'||cloud.saveRolePermissions.__fpPermissionV2)return;
  const raw=cloud.saveRolePermissions.bind(cloud);
  const wrapped=async(...args)=>{const out=await raw(...args);try{if(typeof companyPermissions==='object'&&args[0])companyPermissions[args[0]]=args[1]||{}}catch{};window.dispatchEvent(new CustomEvent('fleetpilot:permissions-changed',{detail:{role:args[0],permissions:args[1]||{}}));setTimeout(()=>FP.LivePermissions?.refresh?.({force:true}),0);applyPages();return out};
  wrapped.__fpPermissionV2=true;cloud.saveRolePermissions=wrapped
 }
 function boot(){installDefinitions();wrapSavePermissions();applyPages();try{renderRolePermissions?.()}catch{}}
 document.addEventListener('click',guardClick,true);document.addEventListener('submit',guardSubmit,true);
 ['fleetpilot:access-ready','fleetpilot:permissions-applied','fleetpilot:permissions-changed','fleetpilot:modules-ready'].forEach(ev=>window.addEventListener(ev,()=>setTimeout(boot,0)));
 document.addEventListener('DOMContentLoaded',()=>{boot();new MutationObserver(()=>applyActions()).observe(document.body,{subtree:true,childList:true})},{once:true});
 setInterval(()=>{wrapSavePermissions();applyActions()},5000);
 FP.PermissionCoreV2={boot,apply:applyPages,can,defs};
})();