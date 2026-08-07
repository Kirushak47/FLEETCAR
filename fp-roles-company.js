/* =========================================================
   FleetPilot V15.6 — Roles & Company
   Existing roles, permissions, workspace/company administration and access checks.
   Source order: original app.js lines 514-969
   ========================================================= */

// Build marker for fast verification after GitHub deploy.
window.FLEETPILOT_BUILD="18.2";
window.addEventListener("DOMContentLoaded",()=>{
 document.querySelector(".topbar .eyebrow")?.replaceChildren(document.createTextNode("FleetPilot V18.2"));
 document.documentElement.dataset.fleetpilotBuild="18.2";
});

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
 if(role==="driver"&&["driverPortalPage","driverProfilePage"].includes(pageId))return true;
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
function driverDisplayName(member){return workspaceDriverName?.(member)||enterpriseMemberEmail(member)}
function createDriverMessage(text,type=""){const el=$("#createDriverMessage");if(!el)return;el.hidden=!text;el.textContent=text;el.className=`cloud-message ${type}`}
function rememberDriverInviteMeta({email,userId,firstName,lastName,gender,phone}){const api=window.FleetPilotDriverMeta;if(!api)return;const store=api.load();const meta={firstName:firstName||"",lastName:lastName||"",gender:gender||"",phone:phone||"",updatedAt:new Date().toISOString()};if(email)store[normalizeDriverIdentity(email)]=meta;if(userId)store[String(userId)]=meta;api.save(store)}
async function syncDriverAssignmentLocal(userId,carId){workspaceDriverAssignments[userId]=carId||"";const member=(workspaceDriverDirectory||[]).find(x=>String(x.user_id)===String(userId));fleetCars().forEach(c=>{if(String(c.driverUserId||"")===String(userId)&&String(c.id)!==String(carId||"")){c.driverUserId="";c.driverEmail="";c.driverName="";c.driverAcceptedAt="";if(c.driverAssignmentSource==="account"){c.tenant="";c.driverAssignmentSource=""}}});if(carId){const c=car(String(carId));if(c){c.driverUserId=userId;c.driverEmail=workspaceDriverEmail(member)||c.driverEmail||"";c.driverName=workspaceDriverName(member)||c.driverName||"";c.driverAssignmentSource="account";c.driverAcceptedAt="";c.tenant=c.driverName||c.driverEmail||c.tenant||""}}save?.()}
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
 document.body.classList.remove("mobile-more-nav-open");
 document.querySelector(".mobile-header-menu-button")?.setAttribute("aria-expanded","false")
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
function ensureMobileHeaderMenuButton(){
 const topbar=document.querySelector(".topbar");
 if(!topbar)return null;
 let button=topbar.querySelector(".mobile-header-menu-button");
 if(button)return button;
 button=document.createElement("button");
 button.type="button";
 button.className="mobile-header-menu-button";
 button.setAttribute("aria-label","Открыть меню FleetPilot");
 button.setAttribute("aria-expanded","false");
 button.innerHTML=`<span class="mobile-header-menu-icon" aria-hidden="true">☰</span>`;
 button.addEventListener("click",()=>{
  const nav=document.querySelector(".bottom-nav");
  if(!nav)return;
  const allowed=[...nav.querySelectorAll("button[data-page]")].filter(item=>item.dataset.roleAllowed==="1");
  renderMobileMoreNavigation(allowed);
  openMobileMoreNavigation();
  button.setAttribute("aria-expanded","true")
 });
 topbar.insertBefore(button,topbar.firstChild);
 return button
}
function applyMobileRoleNavigation(){
 const nav=document.querySelector(".bottom-nav");if(!nav)return;
 const role=enterpriseCurrentRole();
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
 const isMobile=window.matchMedia?.("(max-width: 1099px)").matches;
 if(role==="driver"){
  nav.hidden=true;
  document.querySelector(".mobile-header-menu-button")?.remove();
  closeMobileMoreNavigation();
  return
 }
 if(!isMobile){
  nav.hidden=false;
  allButtons.forEach(button=>button.hidden=button.dataset.roleAllowed!=="1");
  nav.querySelector(".mobile-menu-launcher")?.remove();
  document.querySelector(".mobile-header-menu-button")?.remove();
  closeMobileMoreNavigation();
  return
 }
 // Mobile CRM navigation: the old bottom bar is intentionally disabled.
 // A single header button opens the complete role-aware navigation drawer.
 nav.hidden=true;
 allButtons.forEach(button=>button.hidden=true);
 nav.querySelector(".mobile-menu-launcher")?.remove();
 const headerButton=ensureMobileHeaderMenuButton();
 if(headerButton)headerButton.hidden=false;
 const allowedButtons=allButtons.filter(button=>button.dataset.roleAllowed==="1");
 renderMobileMoreNavigation(allowedButtons);
 closeMobileMoreNavigation()
}
window.closeMobileMoreNavigation=closeMobileMoreNavigation;

function activateCompanyTab(tab){
 $$("[data-company-tab]").forEach(btn=>btn.classList.toggle("active",btn.dataset.companyTab===tab));
 $$("[data-company-panel]").forEach(panel=>panel.classList.toggle("active",panel.dataset.companyPanel===tab));
 if(tab==="permissions")renderRolePermissions();
 if(tab==="drivers")renderDriversRegistry();
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

function driverRegistryAssignmentRow(userId){
 const row=(workspaceDriverAssignmentRows||[]).find(row=>String(row.driver_user_id||"")===String(userId||"")&&String(row.status||"")!=="returned");if(row)return row;
 const c=fleetCars().find(c=>String(c.driverUserId||"")===String(userId||""));return c?{driver_user_id:userId,car_id:c.id,status:c.driverAcceptedAt?"issued":"assigned",issue_at:c.driverAcceptedAt||null,driver_email:c.driverEmail||"",driver_name:c.driverName||c.tenant||""}:null
}
function driverRegistryCarForRow(row){return row?.car_id?car(String(row.car_id)):null}
function driverRegistryAccepted(row){return Boolean(row?.active_handover_id||row?.accepted_at||row?.vehicle_accepted_at||(row?.status==="issued"&&row?.issue_mileage!=null&&Number(row?.issue_photos_count||0)>0))}
async function renderDriversRegistry(){
 const root=$("#driversRegistryList");if(!root)return;
 root.innerHTML='<div class="owner-empty">Загрузка водителей…</div>';
 try{
  await loadWorkspaceDriverAssignments?.();
  const members=(workspaceDriverDirectory||[]).filter(member=>member.role==="driver"&&member.status!=="disabled");
  const query=($("#driversRegistrySearch")?.value||"").trim().toLowerCase();
  const filter=$("#driversRegistryFilter")?.value||"";
  const accountRows=await Promise.all(members.map(async member=>{
   const assignment=driverRegistryAssignmentRow(member.user_id);
   const assignedCar=driverRegistryCarForRow(assignment);
   let accepted=driverRegistryAccepted(assignment);
   if(assignment?.car_id&&!accepted&&window.FleetPilotCloud?.getVehicleHandoverHistory){
    try{
     const history=await window.FleetPilotCloud.getVehicleHandoverHistory(assignment.car_id);
     const active=[...(history||[])].reverse().find(row=>!row.return_at&&String(row.driver_user_id||member.user_id)===String(member.user_id));
     if(active){accepted=true;assignment.issue_at=active.issue_at||new Date().toISOString();assignment.handover_id=active.id||assignment.handover_id;if(assignedCar)assignedCar.driverAcceptedAt=assignment.issue_at}
    }catch(error){console.warn("Driver acceptance sync",error)}
   }
   return{type:"account",member,assignment,assignedCar,accepted,name:workspaceDriverName(member)||workspaceDriverEmail(member),email:workspaceDriverEmail(member)}
  }));
  const knownEmails=new Set(accountRows.map(x=>normalizeDriverIdentity(x.email)).filter(Boolean));
  const manualRows=fleetCars().filter(c=>c.tenant&&!c.driverUserId&&!knownEmails.has(normalizeDriverIdentity(c.driverEmail))).map(c=>({
   type:"manual",member:null,assignment:null,assignedCar:c,accepted:false,name:c.tenant||c.driverName||"Водитель",email:c.driverEmail||""
  }));
  const rows=[...accountRows,...manualRows].filter(item=>{
   const c=item.assignedCar;
   const text=`${item.name} ${item.email} ${c?`${model(c).brand} ${model(c).model} ${c.plate}`:""}`.toLowerCase();
   if(query&&!text.includes(query))return false;
   if(filter==="assigned"&&!c)return false;
   if(filter==="free"&&c)return false;
   if(filter==="pending"&&(!c||item.type!=="account"||item.accepted))return false;
   if(filter==="accepted"&&(!c||!item.accepted))return false;
   if(filter==="manual"&&item.type!=="manual")return false;
   return true
  });
  root.innerHTML=rows.map(item=>{
   const c=item.assignedCar;
   const vehicle=c?`${model(c).brand} ${model(c).model} · ${c.plate||"—"}`:"Автомобиль не назначен";
   const status=item.type==="manual"?"Введён вручную":!c?"Без автомобиля":item.accepted?"Автомобиль принят":"Ожидает приёмки";
   const cls=item.type==="manual"?"manual":!c?"free":item.accepted?"accepted":"pending";
   return `<article class="driver-registry-card ${cls}">
    <div class="driver-registry-avatar">${String(item.name||"D").trim().charAt(0).toUpperCase()}</div>
    <div class="driver-registry-main">
      <strong>${item.name||"Водитель"}</strong>
      <small>${item.email||"Без e-mail"}</small>
      ${item.member&&workspaceDriverPhone?.(item.member)?`<small>${workspaceDriverPhone(item.member)}</small>`:""}
      <div class="driver-registry-vehicle"><span>🚗</span><b>${vehicle}</b></div>
    </div>
    <span class="driver-registry-status ${cls}">${status}</span>
    <div class="driver-registry-actions">${item.type==="account"?`<label class="driver-registry-select"><small>Автомобиль</small>${driverAssignmentControl(item.member)}</label><button type="button" class="btn" data-edit-driver="${item.member.user_id}">Редактировать</button><button type="button" class="driver-delete-button" data-delete-driver="${item.member.user_id}">Удалить</button>`:`<span class="driver-registry-manual">Ручная запись</span><button type="button" class="driver-delete-button" data-delete-manual-driver="${c?.id||""}">Удалить</button>`}</div>
   </article>`
  }).join("")||'<div class="owner-empty">Водители не найдены.</div>';
  $$('[data-driver-assignment]').forEach(select=>select.onchange=async()=>{
   try{
    await window.FleetPilotCloud.assignDriverVehicle(select.dataset.driverAssignment,select.value||null);
    await syncDriverAssignmentLocal(select.dataset.driverAssignment,select.value||null);
    await loadWorkspaceDriverAssignments?.();
    renderFleet?.();
    renderDriversRegistry();
    if(selectedCarId&&$("#carPage")?.classList.contains("active"))openCar(selectedCarId);
    toast(select.value?"Автомобиль назначен":"Назначение снято")
   }catch(error){toast(error.message||String(error));renderDriversRegistry()}
  })

  root.querySelectorAll('[data-edit-driver]').forEach(button=>button.onclick=()=>openEditDriverProfile(button.dataset.editDriver));
  root.querySelectorAll('[data-delete-driver]').forEach(button=>button.onclick=async()=>{const userId=button.dataset.deleteDriver;const assignment=driverRegistryAssignmentRow(userId);if(assignment?.car_id)return toast("Сначала снимите автомобиль с водителя");if(!confirm("Удалить водителя из текущего Workspace? История останется сохранена."))return;try{await window.FleetPilotCloud.enterpriseUpdateMember(userId,{status:"disabled"});toast("Водитель удалён");await loadWorkspaceDriverDirectory?.();renderDriversRegistry();renderEnterprisePage?.()}catch(error){toast(error.message||String(error))}});
  root.querySelectorAll('[data-delete-manual-driver]').forEach(button=>button.onclick=()=>{const c=car(String(button.dataset.deleteManualDriver));if(!c)return;if(!confirm("Удалить ручного водителя из автомобиля?"))return;c.tenant="";c.driverName="";c.driverEmail="";c.driverPhone="";c.driverUserId="";c.driverAssignmentSource="";save?.();renderFleet?.();renderDriversRegistry()});
 }catch(error){root.innerHTML=`<div class="owner-empty">${error.message||error}</div>`}
}
function openEditDriverProfile(userId){
 const member=(workspaceDriverDirectory||[]).find(x=>String(x.user_id)===String(userId));if(!member)return;
 const meta=driverMetaFor(member)||{};
 $("#editDriverUserId").value=userId;
 $("#editDriverFirstName").value=member.first_name||meta.firstName||"";
 $("#editDriverLastName").value=member.last_name||meta.lastName||"";
 $("#editDriverGender").value=member.gender||meta.gender||"";
 $("#editDriverPhone").value=workspaceDriverPhone(member)||"";
 $("#editDriverCity").value=member.city||"";
 $("#editDriverEmail").value=workspaceDriverEmail(member)||"";
 $("#editDriverProfileMessage").hidden=true;
 $("#editDriverProfileDialog")?.showModal();
}
window.openEditDriverProfile=openEditDriverProfile;
setTimeout(()=>{const form=$("#editDriverProfileForm");if(form)form.onsubmit=async event=>{event.preventDefault();const userId=$("#editDriverUserId").value;const member=(workspaceDriverDirectory||[]).find(x=>String(x.user_id)===String(userId));if(!member)return;const firstName=$("#editDriverFirstName").value.trim(),lastName=$("#editDriverLastName").value.trim(),gender=$("#editDriverGender").value,phone=$("#editDriverPhone").value.trim(),city=$("#editDriverCity").value.trim();try{rememberDriverInviteMeta({email:workspaceDriverEmail(member),userId,firstName,lastName,gender,phone});await window.FleetPilotCloud.enterpriseUpdateMember(userId,{city:city||null});$("#editDriverProfileDialog").close();await loadWorkspaceDriverDirectory?.();renderDriversRegistry();renderFleet?.();toast("Данные водителя обновлены")}catch(error){const el=$("#editDriverProfileMessage");el.hidden=false;el.className="cloud-message error";el.textContent=error.message||String(error)}}},120);
window.renderDriversRegistry=renderDriversRegistry;
function fillCreateDriverCars(){const select=$("#createDriverCar");if(!select)return;select.innerHTML='<option value="">Не назначать сейчас</option>'+fleetCars().map(c=>`<option value="${c.id}">${model(c).brand} ${model(c).model} · ${c.plate||"—"}</option>`).join("")}
function openCreateDriverDialog(){createDriverMessage("");$("#createDriverForm")?.reset();fillCreateDriverCars();$("#createDriverDialog")?.showModal()}
window.openCreateDriverDialog=openCreateDriverDialog;
setTimeout(()=>{const b=$("#openCreateDriver");if(b)b.onclick=openCreateDriverDialog;const form=$("#createDriverForm");if(form)form.onsubmit=async e=>{e.preventDefault();const firstName=$("#createDriverFirstName").value.trim(),lastName=$("#createDriverLastName").value.trim(),gender=$("#createDriverGender")?.value||"",email=$("#createDriverEmail").value.trim(),phone=$("#createDriverPhone").value.trim(),city=$("#createDriverCity").value.trim(),carId=$("#createDriverCar").value;createDriverMessage("Создаём приглашение…");try{const result=await window.FleetPilotCloud.enterpriseInvite({email,role:"driver",city,first_name:firstName,last_name:lastName,display_name:`${firstName} ${lastName}`.trim(),gender,phone});rememberDriverInviteMeta({email,firstName,lastName,gender,phone});if(carId){const api=window.FleetPilotDriverMeta,store=api?.load?.()||{},key=normalizeDriverIdentity(email),meta=store[key]||{};meta.pendingCarId=carId;store[key]=meta;api?.save?.(store)}$("#createDriverDialog").close();toast(result?.emailSent===false?"Водитель добавлен. Аккаунт уже существует.":"Приглашение водителю отправлено");await loadWorkspaceDriverDirectory?.();if(carId){const member=workspaceDriverMemberByEmail(email);if(member){await window.FleetPilotCloud.assignDriverVehicle(member.user_id,carId);await syncDriverAssignmentLocal(member.user_id,carId);const api=window.FleetPilotDriverMeta,store=api?.load?.()||{},key=normalizeDriverIdentity(email);if(store[key]){store[key].pendingCarId="";api.save(store)}}}renderDriversRegistry();renderEnterprisePage?.()}catch(error){createDriverMessage(error.message||String(error),"error")}}},100);
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
   if(member.role==="driver")return false;
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
    await loadWorkspaceDriverAssignments?.();
    renderFleet?.();
    if(selectedCarId&&$("#carPage")?.classList.contains("active"))openCar(selectedCarId);
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


