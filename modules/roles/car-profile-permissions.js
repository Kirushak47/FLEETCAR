/* FleetPilot — granular permissions for vehicle profile tabs and actions */
(()=>{'use strict';
 const defs=typeof ROLE_PERMISSION_DEFINITIONS==='object'?ROLE_PERMISSION_DEFINITIONS:null;
 if(defs){
  defs.carProfile=defs.carProfile||[];
  const wanted=[
   ['car.profile.info','Автомобиль → Обзор'],
   ['car.profile.service','Автомобиль → Сервис'],
   ['car.profile.finance','Автомобиль → Финансы'],
   ['car.profile.documents','Автомобиль → Документы'],
   ['car.profile.history','Автомобиль → История'],
   ['car.profile.damages','Автомобиль → Повреждения'],
   ['car.profile.finance.edit','Автомобиль → Финансы: изменять'],
   ['car.profile.documents.edit','Автомобиль → Документы: изменять'],
   ['car.profile.service.edit','Автомобиль → Сервис: изменять']
  ];
  const keys=new Set(defs.carProfile.map(x=>x[0]));wanted.forEach(x=>{if(!keys.has(x[0]))defs.carProfile.push(x)});
 }
 const can=p=>typeof window.enterpriseCan==='function'?window.enterpriseCan(p):true;
 const tabPerm={info:'car.profile.info',service:'car.profile.service',finance:'car.profile.finance',documents:'car.profile.documents',history:'car.profile.history',damages:'car.profile.damages'};
 function legacyDefault(tab){const role=window.enterpriseCurrentRole?.()||'';if(role==='owner')return true;if(tab==='finance')return ['accountant'].includes(role);if(tab==='documents')return ['coordinator','accountant','mechanic'].includes(role);if(tab==='service')return ['coordinator','mechanic'].includes(role);return ['coordinator','mechanic'].includes(role)}
 function allowed(tab){const role=window.enterpriseCurrentRole?.()||'';if(role==='owner'||window.FleetPilotCloud?.isWorkspaceOwner)return true;const key=tabPerm[tab];const values=typeof companyPermissions==='object'?companyPermissions?.[role]:null;if(values&&Object.prototype.hasOwnProperty.call(values,key))return Boolean(values[key]);return legacyDefault(tab)}
 window.enterpriseCanCarProfileTab=allowed;
 function apply(){const root=document.querySelector('#carDetail');if(!root)return;root.querySelectorAll('.car-detail-tabs button').forEach(btn=>{const on=String(btn.getAttribute('onclick')||'');const match=on.match(/openCar\([^,]+,\s*['"]([^'"]+)['"]/);if(!match)return;const tab=match[1];const ok=allowed(tab);btn.hidden=!ok;btn.setAttribute('aria-hidden',String(!ok))});
  const finance=root.querySelector('.car-finance-dashboard');if(finance&&!allowed('finance'))finance.remove();
  if(allowed('finance')&&!can('car.profile.finance.edit'))root.querySelectorAll('.car-finance-dashboard button').forEach(b=>{const on=String(b.getAttribute('onclick')||'');if(/openPaymentDialog|openDepositDialog|openExpenseDialog|editExpense/.test(on))b.hidden=true});
  if(allowed('documents')&&!can('car.profile.documents.edit'))root.querySelectorAll('.profile-documents-card .btn.primary').forEach(b=>b.hidden=true);
  if(allowed('service')&&!can('car.profile.service.edit'))root.querySelectorAll('.car-tab-content [onclick*="openRepairDialog"],.car-tab-content [onclick*="editRepair"] textarea,.car-tab-content [onclick*="advanceServiceRepair"]').forEach(b=>b.hidden=true)
 }
 const mo=new MutationObserver(()=>apply());
 window.addEventListener('DOMContentLoaded',()=>{const root=document.querySelector('#carDetail');if(root)mo.observe(root,{childList:true,subtree:true});apply()});
 window.addEventListener('fleetpilot:access-ready',()=>setTimeout(apply,0));
 window.addEventListener('fleetpilot:permissions-changed',()=>setTimeout(apply,0));
 const original=window.openCar;
 if(typeof original==='function')window.openCar=function(id,tab='info'){let target=tab||'info';if(!allowed(target)){target=['info','service','documents','history','damages','finance'].find(allowed)||'info'}return original.call(this,id,target)};
})();