/* =========================================================
   FleetPilot V15.6 — Roles & Company
   Existing roles, permissions, workspace/company administration and access checks.
   Source order: original app.js lines 514-969
   ========================================================= */
function toggleQuickActions(force){const menu=$("#quickActionMenu"),open=typeof force==="boolean"?force:menu.hidden;menu.hidden=!open;$("#quickActionButton").classList.toggle("active",open)}

const ENTERPRISE_ROLE_LABELS={
 owner:"Владелец",
 coordinator:"Координатор",
 accountant:"Бухгалтер",
 mechanic:"Механик",
 driver:"Водитель",
 user:"Пользователь"
};
const ENTERPRISE_ROLE_ACCESS={
 owner:["dashboardPage","fleetPage","repairsPage","paymentsPage","expensesPage","calendarPage","analyticsPage","documentsPage","companyPage","dataPage","morePage","mobileMapPage","searchPage","carPage"],
 coordinator:["dashboardPage","fleetPage","repairsPage","calendarPage","documentsPage","companyPage","dataPage","mobileMapPage","searchPage","carPage"],
 accountant:["dashboardPage","paymentsPage","expensesPage","analyticsPage","documentsPage","calendarPage","searchPage"],
 mechanic:["dashboardPage","fleetPage","repairsPage","documentsPage","calendarPage","searchPage","carPage"],
 driver:["driverPortalPage","driverProfilePage"],
 user:["dashboardPage","fleetPage","repairsPage","paymentsPage","expensesPage","calendarPage","analyticsPage","documentsPage","morePage","mobileMapPage","searchPage","carPage"]
};
let fleetPilotEnterpriseAccessReady=false;

function enterpriseCurrentRole(){
 return window.FleetPilotCloud?.role||document.body.dataset.enterpriseRole||"user"
}
function enterpriseCanOpen(pageId){
 // Before Supabase resolves workspace membership, do not generate false "no access" errors.
 if(window.FleetPilotCloud?.session&&!fleetPilotEnterpriseAccessReady)return true;
 if(window.FleetPilotCloud?.session&&!window.FleetPilotCloud?.membership)return false;
 const role=enterpriseCurrentRole();
 const legacy=(ENTERPRISE_ROLE_ACCESS[role]||ENTERPRISE_ROLE_ACCESS.user).includes(pageId);
 if(role==="owner"||window.FleetPilotCloud?.isWorkspaceOwner)return legacy;
 if(enterprisePermissionConfigured(role)){
  if(["dashboardPage","morePage","attentionPage"].includes(pageId))return true;
  return enterprisePagePermission(pageId)
 }
 return legacy
}

function applyPlatformAdminUI(){
 const isAdmin=Boolean(window.FleetPilotCloud?.isPlatformAdmin);
 const adminSection=$("#cloudAdminSection");
 if(adminSection)adminSection.hidden=!isAdmin;

 const supabaseButton=$("#openSupabaseDashboard");
 if(supabaseButton)supabaseButton.hidden=!isAdmin;

 document.body.classList.toggle("platform-admin",isAdmin);
 document.body.classList.toggle("workspace-owner",Boolean(window.FleetPilotCloud?.isWorkspaceOwner));
}

function applyEnterpriseAccess(){
 applyPlatformAdminUI();
 if(!window.FleetPilotCloud)return;
 const role=enterpriseCurrentRole();

 $$("[data-desktop-page]").forEach(button=>{
  const page=button.dataset.desktopPage;
  button.hidden=!enterpriseCanOpen(page)
 });

 $$("[data-role-nav]").forEach(button=>{
  if(button.dataset.desktopPage){button.hidden=!enterpriseCanOpen(button.dataset.desktopPage);return}
  const roles=(button.dataset.roleNav||"").split(",");
  button.hidden=enterprisePermissionConfigured(role)?false:!roles.includes(role)
 });

 $$("[data-role-page]").forEach(page=>{
  const roles=(page.dataset.rolePage||"").split(",");
  page.dataset.roleDenied=enterprisePermissionConfigured(role)?String(!enterpriseCanOpen(page.id)):String(!roles.includes(role))
 });

 document.querySelectorAll(".bottom-nav button[data-page]").forEach(button=>{
  button.hidden=!enterpriseCanOpen(button.dataset.page)
 });
 applyActionPermissions();
 applyMobileRoleNavigation();
 let roleContext=document.querySelector(".mobile-role-context");
 if(!roleContext){
  roleContext=document.createElement("span");roleContext.className="mobile-role-context";
  document.querySelector(".topbar>div:first-child")?.appendChild(roleContext)
 }
 if(roleContext)roleContext.textContent=ENTERPRISE_ROLE_LABELS[role]||"Пользователь";
 document.body.dataset.enterpriseRole=role;
 document.body.classList.toggle("driver-only-ui",role==="driver")
}
window.applyEnterpriseAccess=applyEnterpriseAccess;
window.addEventListener("fleetpilot:access-ready",async()=>{
 fleetPilotEnterpriseAccessReady=true;
 try{
  companyPermissions=await window.FleetPilotCloud.getRolePermissions();
  fleetPilotPermissionsLoaded=true;
 }catch(error){
  console.warn("Role permissions unavailable; using legacy role access",error);
 }
 applyEnterpriseAccess();

 const role=enterpriseCurrentRole();
 const defaultPage=role==="driver"?"driverPortalPage":"dashboardPage";

 // The URL/deep-link wins after role and membership are known.
 const currentRoute=fleetPilotCurrentRoute();
 if(currentRoute){
  fleetPilotApplyRoute({replaceInvalid:true})
 }else{
  const activePage=document.querySelector(".page.active")?.id;
  if(!activePage||!enterpriseCanOpen(activePage))showPage(defaultPage)
 }

 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  if(fleetPilotCurrentRoute())fleetPilotApplyRoute({replaceInvalid:false})
 }));

 if(role==="driver"){
  document.body.classList.add("driver-only-ui");
  renderDriverPortal();
  renderDriverProfile()
 }else{
  document.body.classList.remove("driver-only-ui");
  if(["owner","coordinator","mechanic"].includes(role))loadFleetServiceAlerts({rerender:false})
 }
});

function enterpriseMessage(text,type=""){
 const el=$("#enterpriseMessage");if(!el)return;
 el.hidden=!text;el.textContent=text;el.className=`cloud-message ${type}`
}
function inviteMessage(text,type=""){
 const el=$("#inviteMemberMessage");if(!el)return;
 el.hidden=!text;el.textContent=text;el.className=`cloud-message ${type}`
}
function enterpriseMemberEmail(member){
 return member?.profiles?.email||member?.email||"Без email"
}
function enterpriseRoleOptions(selected){
 return Object.entries(ENTERPRISE_ROLE_LABELS)
  .filter(([key])=>key!=="user")
  .map(([key,label])=>`<option value="${key}" ${key===selected?"selected":""}>${label}</option>`).join("")
}

const ROLE_PERMISSION_DEFINITIONS={
 cars:[
  ["cars.view","Видеть автомобили"],
  ["cars.create","Добавлять автомобили"],
  ["cars.edit","Редактировать автомобили"],
  ["cars.delete","Удалять автомобили"],
  ["cars.assign","Назначать водителей"],
  ["cars.mileage","Изменять пробег"],
  ["cars.gps","Видеть GPS и карту"]
 ],
 finance:[
  ["finance.view","Видеть финансы"],
  ["finance.expenses","Добавлять расходы"],
  ["finance.payments","Редактировать платежи"],
  ["finance.analytics","Видеть прибыль и аналитику"]
 ],
 service:[
  ["service.view","Видеть ремонты"],
  ["service.create","Создавать ремонты"],
  ["service.edit","Менять статус ремонта"],
  ["service.photos","Добавлять фотографии"],
  ["service.calendar","Видеть календарь"]
 ],
 documents:[
  ["documents.view","Видеть документы"],
  ["documents.create","Добавлять документы"],
  ["documents.delete","Удалять документы"],
  ["documents.contracts","Видеть договоры"]
 ],
 company:[
  ["company.team","Видеть команду"],
  ["company.invite","Приглашать пользователей"],
  ["company.roles","Менять роли"],
  ["company.permissions","Менять права"],
  ["company.data","Управлять данными и резервными копиями"]
 ],
 driver:[
  ["driver.portal","Использовать кабинет водителя"],
  ["driver.tasks","Выполнять задания"],
  ["driver.photos","Загружать фотоконтроль"],
  ["driver.protocols","Подписывать протоколы"]
 ]
};
const ROLE_PERMISSION_LABELS={
 coordinator:"Координатор",
 accountant:"Бухгалтер",
 mechanic:"Механик",
 driver:"Водитель"
};
let companyPermissions={};
let selectedPermissionRole="coordinator";
let fleetPilotPermissionsLoaded=false;

const PAGE_PERMISSION_MAP={
 fleetPage:"cars.view",
 carPage:"cars.view",
 mobileMapPage:"cars.gps",
 repairsPage:"service.view",
 paymentsPage:"finance.view",
 expensesPage:"finance.view",
 analyticsPage:"finance.analytics",
 documentsPage:"documents.view",
 companyPage:"company.team",
 dataPage:"company.data",
 calendarPage:"service.calendar",
 driverPortalPage:"driver.portal",
 driverProfilePage:"driver.portal"
};

const ACTION_PERMISSION_SELECTORS={
 "cars.create":["#headerAdd","[data-quick-action=\"car\"]"],
 "cars.edit":["#carSubmitButton","[onclick*=\"openCarDialog(\"]"],
 "cars.delete":["[onclick*=\"deleteCar(\"]"],
 "cars.mileage":["#mileageDialog button[type=\"submit\"]"],
 "service.create":["#addRepair","[data-quick-action=\"repair\"]"],
 "service.edit":["#repairSubmitButton","[onclick*=\"editRepair\"]","[onclick*=\"deleteRepair(\"]"],
 "finance.expenses":["#addExpense","[data-quick-action=\"expense\"]"],
 "finance.payments":["#addPayment","[data-quick-action=\"payment\"]"],
 "documents.create":["#addDocument","[data-quick-action=\"document\"]"],
 "documents.delete":["[onclick*=\"deleteDocument(\"]"],
 "company.invite":["#openInviteMember","#openInviteMemberSecondary"],
 "company.permissions":["[data-company-tab=\"permissions\"]"],
 "company.roles":["select[data-enterprise-role]"]
};

function enterprisePermissionConfigured(role=enterpriseCurrentRole()){
 const values=companyPermissions?.[role];
 return Boolean(values&&Object.keys(values).length)
}
function enterpriseLegacyPermissionAllowed(role,permission){
 const page=Object.entries(PAGE_PERMISSION_MAP).find(([,key])=>key===permission)?.[0];
 if(page)return(ENTERPRISE_ROLE_ACCESS[role]||ENTERPRISE_ROLE_ACCESS.user).includes(page);
 const defaults={
  coordinator:["cars.view","cars.create","cars.edit","cars.assign","cars.mileage","cars.gps","service.view","service.create","service.edit","service.photos","service.calendar","documents.view","documents.create","documents.delete","documents.contracts","company.team"],
  accountant:["cars.view","finance.view","finance.expenses","finance.payments","finance.analytics","service.calendar","documents.view","documents.create","documents.contracts"],
  mechanic:["cars.view","cars.mileage","cars.gps","service.view","service.create","service.edit","service.photos","service.calendar","documents.view","documents.create","documents.contracts"],
  driver:["driver.portal","driver.tasks","driver.photos","driver.protocols"],
  user:["cars.view","cars.gps","finance.view","finance.analytics","service.view","service.calendar","documents.view"]
 };
 return(defaults[role]||defaults.user).includes(permission)
}
function enterpriseCan(permission){
 const role=enterpriseCurrentRole();
 if(role==="owner"||window.FleetPilotCloud?.isWorkspaceOwner)return true;
 if(!permission)return true;
 const values=companyPermissions?.[role]||{};
 // Explicit administrator choices always win. Sparse permission objects from older
 // versions inherit the role defaults instead of accidentally hiding whole modules.
 if(Object.prototype.hasOwnProperty.call(values,permission))return Boolean(values[permission]);
 return enterpriseLegacyPermissionAllowed(role,permission)
}
function enterprisePagePermission(pageId){
 if(pageId==="searchPage")return enterpriseCan("cars.view")||enterpriseCan("service.view")||enterpriseCan("documents.view")||enterpriseCan("finance.view");
 return enterpriseCan(PAGE_PERMISSION_MAP[pageId])
}
function requireEnterprisePermission(permission,message="У вашей роли нет доступа к этому действию"){
 if(enterpriseCan(permission))return true;
 toast(message);
 return false
}
function applyActionPermissions(){
 Object.entries(ACTION_PERMISSION_SELECTORS).forEach(([permission,selectors])=>{
  const allowed=enterpriseCan(permission);
  selectors.forEach(selector=>{
   document.querySelectorAll(selector).forEach(element=>{
    element.hidden=!allowed;
    element.setAttribute("aria-hidden",String(!allowed));
   })
  })
 });
 const quickVisible=[...document.querySelectorAll("#quickActionMenu button")].some(button=>!button.hidden);
 const quickButton=$("#quickActionButton");if(quickButton)quickButton.hidden=!quickVisible;
}
function ensureMobileMoreNavigation(){
 let sheet=document.getElementById("mobileMoreNavSheet");
 if(sheet)return sheet;
 sheet=document.createElement("div");
 sheet.id="mobileMoreNavSheet";
 sheet.className="mobile-more-nav-sheet mobile-menu-v16";
 sheet.hidden=true;
 sheet.innerHTML=`
  <button type="button" class="mobile-more-nav-backdrop" data-mobile-more-close aria-label="Закрыть меню"></button>
  <section class="mobile-more-nav-panel" role="dialog" aria-modal="true" aria-label="Меню FleetPilot">
   <header class="mobile-more-nav-head">
    <div><small>FleetPilot</small><strong>Меню</strong><span id="mobileMenuRoleLabel"></span></div>
    <button type="button" class="mobile-more-nav-close" data-mobile-more-close aria-label="Закрыть">×</button>
   </header>
   <div class="mobile-more-nav-grid" id="mobileMoreNavGrid"></div>
  </section>`;
 document.body.appendChild(sheet);
 sheet.querySelectorAll("[data-mobile-more-close]").forEach(button=>button.addEventListener("click",()=>closeMobileMoreNavigation()));
 return sheet
}
function closeMobileMoreNavigation(){
 const sheet=document.getElementById("mobileMoreNavSheet");
 if(!sheet)return;
 sheet.hidden=true;
 document.body.classList.remove("mobile-more-nav-open")
}
function openMobileMoreNavigation(){
 const sheet=ensureMobileMoreNavigation();
 const roleLabel=sheet.querySelector("#mobileMenuRoleLabel");
 if(roleLabel){
  const role=enterpriseCurrentRole();
  roleLabel.textContent=ROLE_PERMISSION_LABELS?.[role]||role||"Пользователь"
 }
 sheet.hidden=false;
 document.body.classList.add("mobile-more-nav-open")
}
function mobileNavItemMeta(button){
 return {
  page:button.dataset.page,
  label:button.querySelector("small")?.textContent?.trim()||button.dataset.page||"Раздел",
  icon:button.querySelector(".mobile-nav-icon")?.innerHTML||"•"
 }
}
function renderMobileMoreNavigation(buttons){
 const sheet=ensureMobileMoreNavigation();
 const grid=sheet.querySelector("#mobileMoreNavGrid");
 if(!grid)return;
 grid.innerHTML=buttons.map(button=>{
  const item=mobileNavItemMeta(button);
  const active=button.classList.contains("active")?" active":"";
  return `<button type="button" class="mobile-more-nav-item${active}" data-mobile-more-page="${item.page}"><span class="mobile-more-nav-icon">${item.icon}</span><span class="mobile-more-nav-copy"><strong>${item.label}</strong><small>${button.classList.contains("active")?"Открыто сейчас":"Открыть раздел"}</small></span><span class="mobile-more-nav-arrow">›</span></button>`
 }).join("")||`<div class="mobile-more-nav-empty">Для этой роли нет доступных разделов</div>`;
 grid.querySelectorAll("[data-mobile-more-page]").forEach(button=>button.addEventListener("click",()=>{
  closeMobileMoreNavigation();
  showPage(button.dataset.mobileMorePage)
 }))
}
function applyMobileRoleNavigation(){
 const nav=document.querySelector(".bottom-nav");if(!nav)return;
 const role=enterpriseCurrentRole();
 if(role==="driver")return;
 const allButtons=[...nav.querySelectorAll("button[data-page]")];
 allButtons.forEach(button=>{
  const page=button.dataset.page;
  const allowed=enterpriseCanOpen(page);
  button.dataset.roleAllowed=allowed?"1":"0";
  if(!button.dataset.mobileNavBound){
   button.addEventListener("click",()=>showPage(page));
   button.dataset.mobileNavBound="1"
  }
 });
 if(!window.matchMedia?.("(max-width: 1099px)").matches){
  allButtons.forEach(button=>button.hidden=button.dataset.roleAllowed!=="1");
  nav.querySelector(".mobile-menu-launcher")?.remove();
  closeMobileMoreNavigation();
  return
 }
 const allowedButtons=allButtons.filter(button=>button.dataset.roleAllowed==="1");
 allButtons.forEach(button=>button.hidden=true);
 let launcher=nav.querySelector(".mobile-menu-launcher");
 if(!launcher){
  launcher=document.createElement("button");
  launcher.type="button";
  launcher.className="mobile-menu-launcher";
  launcher.innerHTML=`<span class="mobile-menu-launcher-icon">☰</span><span class="mobile-menu-launcher-copy"><strong>Меню</strong><small>Разделы FleetPilot</small></span><span class="mobile-menu-launcher-arrow">⌃</span>`;
  launcher.addEventListener("click",()=>{
   const currentAllowed=[...nav.querySelectorAll("button[data-page]")].filter(button=>button.dataset.roleAllowed==="1");
   renderMobileMoreNavigation(currentAllowed);
   openMobileMoreNavigation()
  });
  nav.appendChild(launcher)
 }
 launcher.hidden=false;
 renderMobileMoreNavigation(allowedButtons);
 closeMobileMoreNavigation()
}
window.closeMobileMoreNavigation=closeMobileMoreNavigation;

function activateCompanyTab(tab){
 $$("[data-company-tab]").forEach(btn=>btn.classList.toggle("active",btn.dataset.companyTab===tab));
 $$("[data-company-panel]").forEach(panel=>panel.classList.toggle("active",panel.dataset.companyPanel===tab));
 if(tab==="permissions")renderRolePermissions();
 if(tab==="settings")fillWorkspaceSettings();
 if(tab==="activity")renderCompanyActivity()
}
function renderPermissionRoleTabs(){
 const root=$("#rolePermissionTabs");if(!root)return;
 root.innerHTML=Object.entries(ROLE_PERMISSION_LABELS).map(([role,label])=>`
  <button type="button" class="${role===selectedPermissionRole?"active":""}" data-permission-role="${role}">
   <strong>${label}</strong><small>${role}</small>
  </button>`).join("");
 $$("[data-permission-role]").forEach(btn=>btn.onclick=()=>{
  selectedPermissionRole=btn.dataset.permissionRole;
  renderRolePermissions()
 })
}
function renderRolePermissions(){
 renderPermissionRoleTabs();
 const root=$("#rolePermissionsGrid");if(!root)return;
 const values=companyPermissions[selectedPermissionRole]||{};
 root.innerHTML=Object.entries(ROLE_PERMISSION_DEFINITIONS).map(([group,items])=>`
  <article class="permission-group">
   <h4>${({cars:"Автомобили",finance:"Финансы",service:"Сервис",documents:"Документы",company:"Команда и доступ",driver:"Кабинет водителя"}[group]||group)}</h4>
   ${items.map(([key,label])=>`
    <label class="permission-switch">
     <span>${label}</span>
     <input type="checkbox" data-permission-key="${key}" ${values[key]?"checked":""}>
     <i></i>
    </label>`).join("")}
  </article>`).join("")
}
async function loadRolePermissions(){
 try{
  companyPermissions=await window.FleetPilotCloud.getRolePermissions();
  fleetPilotPermissionsLoaded=true;
  renderRolePermissions();
  applyEnterpriseAccess()
 }catch(error){enterpriseMessage(error.message||String(error),"error")}
}
function fillWorkspaceSettings(){
 const ws=window.FleetPilotCloud?.workspace||{};
 if($("#workspaceSettingsName"))$("#workspaceSettingsName").value=ws.name||"";
 if($("#workspaceSettingsCity"))$("#workspaceSettingsCity").value=ws.city||window.FleetPilotCloud?.membership?.city||"";
 if($("#workspaceSettingsCurrency"))$("#workspaceSettingsCurrency").value=ws.currency||"PLN";
 if($("#workspaceSettingsTimezone"))$("#workspaceSettingsTimezone").value=ws.timezone||"Europe/Warsaw"
}
async function renderCompanyActivity(){
 const root=$("#companyActivityLog");if(!root)return;
 root.innerHTML='<div class="owner-empty">Загрузка…</div>';
 try{
  const rows=await window.FleetPilotCloud.getWorkspaceActivity();
  root.innerHTML=rows.map(row=>`
   <article class="activity-row">
    <div class="activity-dot"></div>
    <div><strong>${row.actor_email||"Пользователь"}</strong><span>${row.action}</span>
     <small>${new Date(row.created_at).toLocaleString("ru-RU")}</small>
    </div>
   </article>`).join("")||'<div class="owner-empty">Журнал пока пуст.</div>'
 }catch(error){root.innerHTML=`<div class="owner-empty">${error.message||error}</div>`}
}
async function renderEnterprisePage(){
 const root=$("#enterpriseMembersList");if(!root)return;
 applyEnterpriseAccess();

 const workspace=window.FleetPilotCloud?.workspace;
 const membership=window.FleetPilotCloud?.membership;
 if($("#workspaceTitle"))$("#workspaceTitle").textContent=workspace?.name||"Компания";

 if(!membership){
  enterpriseMessage("Рабочее пространство ещё не создано. Выполните SQL-миграцию V10 и войдите повторно.","error");
  root.innerHTML="";
  return
 }

 enterpriseMessage("Загрузка…");
 try{
  const {members,invites}=await window.FleetPilotCloud.enterpriseList();
  const query=($("#enterpriseMemberSearch")?.value||"").trim().toLowerCase();
  const roleFilter=$("#enterpriseRoleFilter")?.value||"";
  const filtered=members.filter(member=>{
   const text=`${enterpriseMemberEmail(member)} ${member.role} ${member.city||""}`.toLowerCase();
   return(!query||text.includes(query))&&(!roleFilter||member.role===roleFilter)
  });

  $("#enterpriseMembersCount").textContent=members.filter(x=>x.status==="active").length;
  $("#enterpriseOwnersCount").textContent=members.filter(x=>x.role==="owner"&&x.status==="active").length;
  $("#enterpriseInvitesCount").textContent=invites.filter(x=>x.status==="pending").length;
  $("#enterpriseCitiesCount").textContent=new Set(members.map(x=>x.city).filter(Boolean)).size;
  const roleCounts={};
  members.forEach(member=>roleCounts[member.role]=(roleCounts[member.role]||0)+1);
  if($("#companyRoleSummary"))$("#companyRoleSummary").innerHTML=Object.entries(ENTERPRISE_ROLE_LABELS)
   .filter(([role])=>roleCounts[role])
   .map(([role,label])=>`<div><span>${label}</span><strong>${roleCounts[role]}</strong></div>`).join("");
  const ws=window.FleetPilotCloud?.workspace||{};
  if($("#companyWorkspaceSummary"))$("#companyWorkspaceSummary").innerHTML=`
   <div><span>Название</span><strong>${ws.name||"—"}</strong></div>
   <div><span>Город</span><strong>${ws.city||membership.city||"—"}</strong></div>
   <div><span>Валюта</span><strong>${ws.currency||"PLN"}</strong></div>
   <div><span>Часовой пояс</span><strong>${ws.timezone||"Europe/Warsaw"}</strong></div>`;

  const canManage=enterpriseCurrentRole()==="owner";
  root.innerHTML=filtered.map(member=>`
   <article class="enterprise-member-card">
    <div class="enterprise-member-avatar">${enterpriseMemberEmail(member)[0]?.toUpperCase()||"U"}</div>
    <div class="enterprise-member-main">
     <strong>${enterpriseMemberEmail(member)}</strong>
     <small>${member.city||"Все города"} · добавлен ${new Date(member.created_at).toLocaleDateString("ru-RU")}</small>
    </div>
    <select data-enterprise-role="${member.user_id}" ${(canManage&&member.user_id!==window.FleetPilotCloud.session?.user?.id)?"":"disabled"}>${enterpriseRoleOptions(member.role)}</select>
    <input data-enterprise-city="${member.user_id}" value="${member.city||""}" placeholder="Город" ${(canManage&&member.user_id!==window.FleetPilotCloud.session?.user?.id)?"":"disabled"}>
    <span class="enterprise-status ${member.status}">${member.status==="active"?"Активен":"Отключён"}</span>
    ${driverAssignmentControl(member)}
    ${canManage&&member.user_id!==window.FleetPilotCloud.session?.user?.id?`<button type="button" class="enterprise-member-toggle" data-enterprise-toggle="${member.user_id}" data-status="${member.status}">${member.status==="active"?"Отключить":"Включить"}</button>`:""}
   </article>`).join("")||`<div class="owner-empty">Участники не найдены.</div>`;

  const inviteRoot=$("#enterpriseInvitesList");
  inviteRoot.innerHTML=invites.filter(x=>x.status==="pending").map(invite=>`
   <article class="enterprise-invite-row">
    <div><strong>${invite.email}</strong><small>${ENTERPRISE_ROLE_LABELS[invite.role]||invite.role} · ${invite.city||"все города"}</small></div>
    <span>до ${new Date(invite.expires_at).toLocaleDateString("ru-RU")}</span>
    ${canManage?`<button type="button" data-cancel-invite="${invite.id}">Отменить</button>`:""}
   </article>`).join("")||`<div class="owner-empty">Активных приглашений нет.</div>`;

  $$("[data-enterprise-role]").forEach(select=>select.onchange=async()=>{
   await window.FleetPilotCloud.enterpriseUpdateMember(select.dataset.enterpriseRole,{role:select.value});
   toast("Роль обновлена");renderEnterprisePage()
  });
  $$("[data-enterprise-city]").forEach(input=>input.onchange=async()=>{
   await window.FleetPilotCloud.enterpriseUpdateMember(input.dataset.enterpriseCity,{city:input.value.trim()||null});
   toast("Город обновлён")
  });
  $$("[data-enterprise-toggle]").forEach(button=>button.onclick=async()=>{
   const next=button.dataset.status==="active"?"disabled":"active";
   await window.FleetPilotCloud.enterpriseUpdateMember(button.dataset.enterpriseToggle,{status:next});
   renderEnterprisePage()
  });
  $$("[data-cancel-invite]").forEach(button=>button.onclick=async()=>{
   await window.FleetPilotCloud.enterpriseCancelInvite(button.dataset.cancelInvite);
   renderEnterprisePage()
  });
  $$("[data-driver-assignment]").forEach(select=>select.onchange=async()=>{
   try{
    await window.FleetPilotCloud.assignDriverVehicle(select.dataset.driverAssignment,select.value||null);
    workspaceDriverAssignments[select.dataset.driverAssignment]=select.value||null;
    toast(select.value?"Автомобиль назначен":"Назначение снято")
   }catch(error){toast(error.message||String(error))}
  });
  enterpriseMessage("")
 }catch(error){
  console.error(error);
  enterpriseMessage(error.message||String(error),"error")
 }
}
window.renderEnterprisePage=renderEnterprisePage;


