/* FleetPilot — explicit permissions for driver registry and driver creation */
(()=>{'use strict';
 const permission='company.drivers.manage';
 const owner=()=>{const role=String(window.enterpriseCurrentRole?.()||window.FleetPilotCloud?.role||'').toLowerCase();return ['owner','admin','administrator','ceo'].includes(role)||Boolean(window.FleetPilotCloud?.isWorkspaceOwner)};
 const allowed=()=>owner()||(typeof window.enterpriseCan==='function'&&window.enterpriseCan(permission));
 function installDefinition(){
  if(typeof ROLE_PERMISSION_DEFINITIONS!=='object')return false;
  const group=ROLE_PERMISSION_DEFINITIONS.company||(ROLE_PERMISSION_DEFINITIONS.company=[]);
  if(group.some(x=>x?.[0]===permission))return false;
  group.push([permission,'Управлять водителями и создавать водителей']);
  return true
 }
 function controls(){
  const selectors=['#createDriverButton','#openCreateDriver','#openCreateDriverDialog','#addDriver','#newDriver','#createDriver','[data-create-driver]','[data-open-create-driver]'];
  const set=new Set();selectors.forEach(s=>document.querySelectorAll(s).forEach(x=>set.add(x)));
  document.querySelectorAll('button,a').forEach(el=>{const t=(el.textContent||'').trim().toLowerCase();if(/создать водителя|добавить водителя|новый водитель/.test(t))set.add(el)});
  return [...set]
 }
 function dialogs(){return [...document.querySelectorAll('dialog')].filter(d=>/driver/i.test(d.id||'')||/водител/i.test(d.textContent||''))}
 function apply(){installDefinition();const ok=allowed();controls().forEach(el=>{el.hidden=!ok;el.setAttribute('aria-hidden',String(!ok));if('disabled'in el)el.disabled=!ok});if(!ok)dialogs().forEach(d=>{if(d.open&&/создать|добавить|новый/i.test(d.textContent||''))d.close?.()})}
 function refreshDefinitionUi(){const added=installDefinition();if(added&&typeof window.renderRolePermissions==='function')window.renderRolePermissions();apply()}
 const guard=e=>{if(allowed())return;const trigger=e.target?.closest?.('button,a,[role="button"]');if(!trigger)return;const text=(trigger.textContent||'').trim().toLowerCase(),id=String(trigger.id||'').toLowerCase();if(/создать водителя|добавить водителя|новый водитель/.test(text)||(/driver/.test(id)&&/(create|add|new|invite)/.test(id))){e.preventDefault();e.stopImmediatePropagation();window.toast?.('Нет доступа к управлению водителями')}};
 document.addEventListener('click',guard,true);
 document.addEventListener('submit',e=>{if(allowed())return;const form=e.target,id=String(form?.id||'').toLowerCase(),text=(form?.closest?.('dialog')?.textContent||'').toLowerCase();if((/driver/.test(id)&&/(create|add|new|invite)/.test(id))||(/водител/.test(text)&&/создать|добавить|приглас/.test(text))){e.preventDefault();e.stopImmediatePropagation();window.toast?.('Нет доступа к управлению водителями')}},true);
 ['fleetpilot:access-ready','fleetpilot:permissions-changed','fleetpilot:modules-ready'].forEach(ev=>window.addEventListener(ev,()=>setTimeout(refreshDefinitionUi,0)));
 document.addEventListener('DOMContentLoaded',()=>setTimeout(refreshDefinitionUi,0));
 let queued=false;const mo=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;apply()})});document.addEventListener('DOMContentLoaded',()=>mo.observe(document.body,{subtree:true,childList:true}),{once:true});
 window.FleetPilotDriverManagementPermissions={allowed,apply,permission};
})();