/* =========================================================
   FleetPilot V15.6 — Router & Navigation
   Hash routes, page switching, deep links, mobile/desktop page navigation.
   Source order: original app.js lines 1610-2206
   ========================================================= */
/* =========================================================
   FleetPilot V11.3.5 — Deep Links
   Uses hash routes so Cloudflare always serves index.html.
   ========================================================= */
const FLEETPILOT_ROUTES={
 dashboardPage:"dashboard",
 fleetPage:"fleet",
 repairsPage:"service",
 paymentsPage:"rent",
 expensesPage:"expenses",
 documentsPage:"documents",
 calendarPage:"calendar",
 analyticsPage:"analytics",
 companyPage:"company",
 dataPage:"data",
 attentionPage:"attention",
 searchPage:"search",
 driverPortalPage:"driver",
 driverProfilePage:"driver/profile"
};
const FLEETPILOT_ROUTE_PAGES=Object.fromEntries(
 Object.entries(FLEETPILOT_ROUTES).map(([page,route])=>[route,page])
);
function fleetPilotDefaultCrmPage(){
 const candidates=["fleetPage","paymentsPage","expensesPage","repairsPage","documentsPage","analyticsPage","calendarPage"];
 for(const pageId of candidates){try{if(enterpriseCanOpen(pageId))return pageId}catch{}}
 return "fleetPage"
}
const FLEETPILOT_CAR_TABS=new Set(["info","service","finance","history","documents","damages"]);
let fleetPilotRouteReady=false;
let fleetPilotApplyingRoute=false;

function fleetPilotHash(route){
 return `#/${String(route||"dashboard").replace(/^\/+/,"")}`
}
function fleetPilotCurrentRoute(){
 return decodeURIComponent(String(location.hash||"").replace(/^#\/?/,""))
}
function fleetPilotSetRoute(route,{replace=false}={}){
 if(!fleetPilotRouteReady||fleetPilotApplyingRoute)return;
 const hash=fleetPilotHash(route);
 if(location.hash===hash)return;
 const url=`${location.pathname}${location.search}${hash}`;
 try{
  history[replace?"replaceState":"pushState"]({fleetpilot:true},"",url)
 }catch{
  location.hash=hash
 }
}
function fleetPilotRouteForPage(pageId){
 return FLEETPILOT_ROUTES[pageId]||"dashboard"
}
function fleetPilotCarRoute(carId,tab="info"){
 const safeId=encodeURIComponent(String(carId||""));
 const safeTab=FLEETPILOT_CAR_TABS.has(tab)?tab:"info";
 return safeTab==="info"?`car/${safeId}`:`car/${safeId}/${safeTab}`
}
function fleetPilotFindCar(routeId){
 const decoded=decodeURIComponent(String(routeId||""));
 const normalized=decoded.trim().toLowerCase();
 return db.cars.find(c=>String(c.id)===decoded)
  ||db.cars.find(c=>String(c.plate||"").trim().toLowerCase()===normalized)
  ||null
}
function fleetPilotApplyRoute({replaceInvalid=true}={}){
 const route=fleetPilotCurrentRoute();
 if(!route){
  fleetPilotApplyingRoute=true;
  const landing=enterpriseCurrentRole()==="driver"?"driverPortalPage":fleetPilotDefaultCrmPage();
  try{showPage(landing)}finally{fleetPilotApplyingRoute=false}
  fleetPilotSetRoute(fleetPilotRouteForPage(landing),{replace:true});
  return
 }

 const parts=route.split("/").filter(Boolean);
 const root=parts[0];

 fleetPilotApplyingRoute=true;
 try{
  if(root==="car"){
   const target=fleetPilotFindCar(parts[1]);
   const tab=FLEETPILOT_CAR_TABS.has(parts[2])?parts[2]:"info";
   if(target){
    openCar(target.id,tab);
    return
   }
   toast("Автомобиль по ссылке не найден");
   showPage("fleetPage");
   if(replaceInvalid)setTimeout(()=>fleetPilotSetRoute("fleet",{replace:true}),0);
   return
  }

  let pageId=FLEETPILOT_ROUTE_PAGES[root];
  if(pageId==="dashboardPage"&&enterpriseCurrentRole()!=="driver")pageId=fleetPilotDefaultCrmPage();
  if(pageId&&document.getElementById(pageId)){
   showPage(pageId);
   if(root==="dashboard"&&replaceInvalid)setTimeout(()=>fleetPilotSetRoute(fleetPilotRouteForPage(pageId),{replace:true}),0);
   return
  }
  const landing=enterpriseCurrentRole()==="driver"?"driverPortalPage":fleetPilotDefaultCrmPage();
  showPage(landing);
  if(replaceInvalid)setTimeout(()=>fleetPilotSetRoute(fleetPilotRouteForPage(landing),{replace:true}),0)
 }finally{
  fleetPilotApplyingRoute=false
 }
}
function initializeFleetPilotDeepLinks(){
 fleetPilotRouteReady=true;
 fleetPilotApplyRoute();
}
function copyFleetPilotLink(route){
 const url=`${location.origin}${location.pathname}${location.search}${fleetPilotHash(route)}`;
 if(navigator.clipboard?.writeText){
  navigator.clipboard.writeText(url).then(()=>toast("Ссылка скопирована")).catch(()=>prompt("Скопируйте ссылку",url))
 }else{
  prompt("Скопируйте ссылку",url)
 }
}
function copyCurrentCarLink(carId,tab="info"){
 copyFleetPilotLink(fleetPilotCarRoute(carId,tab))
}
window.copyFleetPilotLink=copyFleetPilotLink;
window.copyCurrentCarLink=copyCurrentCarLink;

window.addEventListener("popstate",()=>{
 if(fleetPilotRouteReady)fleetPilotApplyRoute({replaceInvalid:false})
});
window.addEventListener("hashchange",()=>{
 if(fleetPilotRouteReady&&!fleetPilotApplyingRoute)fleetPilotApplyRoute({replaceInvalid:false})
});

function showPage(id){
 if(window.FleetPilotCloud?.session&&!fleetPilotEnterpriseAccessReady){return}
 applyEnterpriseAccess();
 const resolvedRole=enterpriseCurrentRole();
 if(id==="dashboardPage"&&resolvedRole!=="driver")id=fleetPilotDefaultCrmPage();
 // V18.2: a driver lives inside Driver Portal and must never be bounced through CRM dashboard.
 if(resolvedRole==="driver"&&!['driverPortalPage','driverProfilePage'].includes(id))id="driverPortalPage";
 // V18.3: Driver Portal is a dedicated shell. Never run CRM access denial against its own pages.
 const driverOwnPage=resolvedRole==="driver"&&['driverPortalPage','driverProfilePage'].includes(id);
 const notificationCenterPage=id==="attentionPage"&&resolvedRole!=="driver";
 if(!driverOwnPage&&!notificationCenterPage&&!enterpriseCanOpen(id)){
  if(fleetPilotEnterpriseAccessReady&&resolvedRole!=="driver")toast("У вашей роли нет доступа к этому разделу");
  const role=enterpriseCurrentRole();
  id=role==="driver"?"driverPortalPage":fleetPilotDefaultCrmPage()
 }
 if(enterpriseCurrentRole()!=="driver"&&window.innerWidth<1100&&isSimpleMode()&&!SIMPLE_ALLOWED_PAGES.has(id))id=fleetPilotDefaultCrmPage();
 if(id!=="carPage"&&fleetPilotRouteReady&&!fleetPilotApplyingRoute){
  fleetPilotSetRoute(fleetPilotRouteForPage(id))
 }
 const previous=$(".page.active");$$(".page").forEach(p=>p.classList.toggle("active",p.id===id));
 syncDesktopNavigation(id);
 const incoming=$("#"+id);if(incoming&&incoming!==previous){incoming.classList.remove("page-enter");void incoming.offsetWidth;incoming.classList.add("page-enter")}if(id==="companyPage"){loadRolePermissions();}if(id==="driversPage"){loadWorkspaceDriverAssignments().then(()=>renderDriversRegistry());}if(id==="driverPortalPage"){renderDriverPortal();setDriverBottomNavActive("vehicle")}if(id==="driverProfilePage"){renderDriverProfile();setDriverBottomNavActive("profile")}if(id==="fleetPage")loadFleetServiceAlerts();if(id==="repairsPage")renderWorkspaceRepairRequests();
$("#globalSearchButton").onclick=()=>{showPage("searchPage");setTimeout(()=>$("#globalSearchInput").focus(),50)};
$("#closeGlobalSearch").onclick=()=>showPage(fleetPilotDefaultCrmPage());$("#globalSearchInput").oninput=renderGlobalSearch;
$("#exportActivityLog").onclick=exportActivityCsv;
["activitySearch","activityTypeFilter","activityPeriodFilter"].forEach(id=>{
 const element=$("#"+id);
 if(element)element.addEventListener(id==="activitySearch"?"input":"change",renderActivityJournal)
});$("#createManualSnapshot").onclick=async()=>{await writeAutoBackup(new Date().toISOString(),"Ручной снимок");toast("Снимок создан")};
$("#closeFileViewer").onclick=()=>$("#fileViewerDialog").close();$("#fileViewerDialog").addEventListener("close",()=>{if(activeFileUrl){URL.revokeObjectURL(activeFileUrl);activeFileUrl=""}});

$("#customizeDashboard").onclick=()=>{renderDashboardSettings();$("#dashboardSettingsDialog").showModal()};
$("#openDashboardSettings").onclick=()=>{renderDashboardSettings();$("#dashboardSettingsDialog").showModal()};
$$(".mode-switcher button").forEach(b=>b.onclick=()=>setUiMode(b.dataset.uiMode));
$("#dashboardSettingsForm").onsubmit=e=>{
 e.preventDefault();
 const settings=uxSettings(),rows=[...$("#dashboardBlockList").children];
 settings.order=rows.map(x=>x.dataset.blockId);
 settings.visible=rows.filter(x=>x.querySelector("input").checked).map(x=>x.dataset.blockId);
 saveUxSettings(settings);$("#dashboardSettingsDialog").close();renderFleet();toast("Главная настроена")
};
$("#resetDashboardSettings").onclick=()=>{localStorage.removeItem(UX_KEY);renderDashboardSettings();applyUxSettings();toast("Настройки сброшены")};


["quickServiceExpiry","quickServiceMileage","quickServiceOilInterval","quickServiceCost"].forEach(id=>{
 const el=$("#"+id);if(el)el.oninput=updateQuickServicePreview
});




const desktopBrand=document.querySelector(".desktop-brand");
if(desktopBrand){desktopBrand.setAttribute("role","button");desktopBrand.setAttribute("tabindex","0");desktopBrand.onclick=()=>showPage(enterpriseCurrentRole()==="driver"?"driverPortalPage":fleetPilotDefaultCrmPage());}
const dashboardOpenFleet=$("#dashboardOpenFleet");
if(dashboardOpenFleet)dashboardOpenFleet.onclick=()=>showPage("fleetPage");
$$('[data-dashboard-go]').forEach(button=>button.onclick=()=>showPage(button.dataset.dashboardGo));

const ownerSettingsButton=$("#ownerDashboardSettingsButton");
if(ownerSettingsButton)ownerSettingsButton.onclick=openOwnerDashboardSettings;
$$("[data-hide-owner-widget]").forEach(button=>button.onclick=()=>hideOwnerDashboardWidget(button.dataset.hideOwnerWidget));
const ownerMapButton=$("#ownerOpenMap");
if(ownerMapButton)ownerMapButton.onclick=openFullFleetMap;
const ownerDashboardForm=$("#ownerDashboardSettingsDialog form");
if(ownerDashboardForm)ownerDashboardForm.onsubmit=event=>{
 event.preventDefault();
 const visible=$$("#ownerDashboardWidgetSettings input:checked").map(input=>input.value);
 saveOwnerDashboardSettings({visible});
 $("#ownerDashboardSettingsDialog").close();
 renderOwnerDashboard();
 toast("Дашборд обновлён")
};
const ownerDashboardReset=$("#ownerDashboardReset");
if(ownerDashboardReset)ownerDashboardReset.onclick=()=>{
 saveOwnerDashboardSettings({visible:OWNER_WIDGETS.map(item=>item.id)});
 renderOwnerDashboardSettings();
 renderOwnerDashboard()
};



$$("[data-company-tab]").forEach(button=>button.onclick=()=>activateCompanyTab(button.dataset.companyTab));
$("#refreshDriversRegistry")?.addEventListener("click",()=>renderDriversRegistry?.());
$("#driversRegistrySearch")?.addEventListener("input",()=>renderDriversRegistry?.());
$("#driversRegistryFilter")?.addEventListener("change",()=>renderDriversRegistry?.());
const openInviteMemberSecondary=$("#openInviteMemberSecondary");
if(openInviteMemberSecondary)openInviteMemberSecondary.onclick=()=>$("#openInviteMember")?.click();

const saveRolePermissionsButton=$("#saveRolePermissions");
if(saveRolePermissionsButton)saveRolePermissionsButton.onclick=async()=>{
 const values={};
 $$("[data-permission-key]").forEach(input=>values[input.dataset.permissionKey]=input.checked);
 try{
  await window.FleetPilotCloud.saveRolePermissions(selectedPermissionRole,values);
  companyPermissions[selectedPermissionRole]=values;
  toast("Права сохранены");
  window.FleetPilotCloud.logWorkspaceActivity("Изменены права роли","role",selectedPermissionRole,{permissions:values})
 }catch(error){enterpriseMessage(error.message||String(error),"error")}
};
const resetRolePermissionsButton=$("#resetRolePermissions");
if(resetRolePermissionsButton)resetRolePermissionsButton.onclick=async()=>{
 if(!confirm("Вернуть стандартные права для этой роли?"))return;
 try{
  await window.FleetPilotCloud.resetRolePermissions(selectedPermissionRole);
  await loadRolePermissions();
  toast("Стандартные права восстановлены")
 }catch(error){enterpriseMessage(error.message||String(error),"error")}
};
const workspaceSettingsForm=$("#workspaceSettingsForm");
if(workspaceSettingsForm)workspaceSettingsForm.onsubmit=async event=>{
 event.preventDefault();
 try{
  await window.FleetPilotCloud.updateWorkspaceSettings({
   name:$("#workspaceSettingsName").value,
   city:$("#workspaceSettingsCity").value,
   currency:$("#workspaceSettingsCurrency").value,
   timezone:$("#workspaceSettingsTimezone").value
  });
  $("#workspaceTitle").textContent=window.FleetPilotCloud.workspace?.name||"Компания";
  toast("Настройки сохранены");
  window.FleetPilotCloud.logWorkspaceActivity("Изменены настройки компании","workspace",window.FleetPilotCloud.workspace?.id,{})
 }catch(error){enterpriseMessage(error.message||String(error),"error")}
};
const refreshActivityLog=$("#refreshActivityLog");
if(refreshActivityLog)refreshActivityLog.onclick=renderCompanyActivity;




function setDriverBottomNavActive(name){
 $$("[data-driver-nav]").forEach(button=>button.classList.toggle("active",button.dataset.driverNav===name))
}
function openDriverSection(name){
 if(name==="repair"){
  openDriverRepairDialog();
  return
 }
 if(name==="profile"){
  showPage("driverProfilePage");
  setDriverBottomNavActive("profile");
  return
 }

 showPage("driverPortalPage");
 setDriverBottomNavActive(name);
 requestAnimationFrame(()=>{
  const target=document.querySelector(`[data-driver-anchor="${name}"]`);
  target?.scrollIntoView({behavior:"smooth",block:"start"})
 })
}
$$("[data-driver-nav]").forEach(button=>button.onclick=()=>openDriverSection(button.dataset.driverNav));

const changePasswordForm=$("#changePasswordForm");
if(changePasswordForm)changePasswordForm.onsubmit=async event=>{
 event.preventDefault();
 const password=$("#directNewPassword").value;
 const repeat=$("#directNewPasswordRepeat").value;
 const messageEl=$("#directPasswordMessage");

 const setMessage=(text,type="")=>{
  messageEl.hidden=!text;
  messageEl.textContent=text;
  messageEl.className=`cloud-message ${type}`
 };

 if(password.length<8)return setMessage("Пароль должен содержать минимум 8 символов.","error");
 if(password!==repeat)return setMessage("Пароли не совпадают.","error");

 setMessage("Сохраняем новый пароль…");
 try{
  await window.FleetPilotCloud.changePasswordDirect(password);
  setMessage("Пароль успешно изменён.","success");
  setTimeout(()=>{
   $("#changePasswordDialog").close();
   changePasswordForm.reset();
   toast("Пароль изменён")
  },700)
 }catch(error){
  setMessage(error.message||String(error),"error")
 }
};

const driverOpenServicePlan=$("#driverOpenServicePlan");
if(driverOpenServicePlan)driverOpenServicePlan.onclick=()=>{
 showPage("driverPortalPage");
 setDriverBottomNavActive("vehicle");
 requestAnimationFrame(()=>document.querySelector('[data-driver-anchor="service"]')?.scrollIntoView({behavior:"smooth",block:"start"}))
};

const openDriverProfilePage=$("#openDriverProfilePage");
if(openDriverProfilePage)openDriverProfilePage.onclick=()=>showPage("driverProfilePage");

const driverOpenProfileDialog=$("#driverOpenProfileDialog");
if(driverOpenProfileDialog)driverOpenProfileDialog.onclick=()=>window.FleetPilotCloud?.openProfile?.();

const driverOpenAccountSettings=$("#driverOpenAccountSettings");
if(driverOpenAccountSettings)driverOpenAccountSettings.onclick=()=>window.FleetPilotCloud?.openProfile?.();

const driverSignOut=$("#driverSignOut");
if(driverSignOut)driverSignOut.onclick=()=>window.FleetPilotCloud?.signOut?.();


const startVehicleIssue=$("#startVehicleIssue");
if(startVehicleIssue)startVehicleIssue.onclick=()=>openVehicleHandover("issue");
const startVehicleReturn=$("#startVehicleReturn");
if(startVehicleReturn)startVehicleReturn.onclick=()=>openVehicleHandover("return");

const vehicleHandoverPhotos=$("#vehicleHandoverPhotos");
if(vehicleHandoverPhotos)vehicleHandoverPhotos.onchange=async event=>{
 const files=[...(event.target.files||[])].slice(0,8);
 handoverMessage("Подготавливаем фотографии…");
 try{
  vehicleHandoverPhotoData=[];
  for(const file of files)vehicleHandoverPhotoData.push(await compressHandoverImage(file));
  renderHandoverPhotoPreview();
  handoverMessage("")
 }catch(error){handoverMessage(error.message||String(error),"error")}
};

/* V19.0 — Vehicle Handover is owned exclusively by fp-driver-portal.js.
   The old router submit handler was removed because it caused two independent
   submit flows to run for one click and overwrite acceptance/return state. */

const openDriverRepairRequest=$("#openDriverRepairRequest");
if(openDriverRepairRequest)openDriverRepairRequest.onclick=openDriverRepairDialog;
const refreshDriverRepairRequests=$("#refreshDriverRepairRequests");
if(refreshDriverRepairRequests)refreshDriverRepairRequests.onclick=renderDriverRepairRequests;


const serviceSearch=$("#serviceSearch");
const serviceFind=$("#serviceFind");
const serviceSearchReset=$("#serviceSearchReset");
function applyGlobalServiceSearch(){
 selectedWorkspaceRepairCarId=null;
 renderRepairs();
 renderWorkspaceRepairRequests();
}
function resetGlobalServiceSearch(){
 if(serviceSearch)serviceSearch.value="";
 selectedWorkspaceRepairCarId=null;
 renderRepairs();
 renderWorkspaceRepairRequests();
}
if(serviceFind)serviceFind.onclick=applyGlobalServiceSearch;
if(serviceSearchReset)serviceSearchReset.onclick=resetGlobalServiceSearch;
if(serviceSearch)serviceSearch.onkeydown=event=>{if(event.key==="Enter"){event.preventDefault();applyGlobalServiceSearch()}};
const serviceStatusFilter=$("#serviceStatusFilter");
if(serviceStatusFilter)serviceStatusFilter.onchange=()=>{selectedWorkspaceRepairCarId=null;renderRepairs()};
const serviceCityFilter=$("#serviceCityFilter");
if(serviceCityFilter)serviceCityFilter.onchange=()=>{selectedWorkspaceRepairCarId=null;renderRepairs()};
const servicePriorityFilter=$("#servicePriorityFilter");
if(servicePriorityFilter)servicePriorityFilter.onchange=()=>{selectedWorkspaceRepairCarId=null;renderRepairs()};
const serviceMechanicFilter=$("#serviceMechanicFilter");
if(serviceMechanicFilter)serviceMechanicFilter.onchange=()=>{selectedWorkspaceRepairCarId=null;renderRepairs()};
const serviceSort=$("#serviceSort");
if(serviceSort)serviceSort.onchange=renderRepairs;
const clearServiceFilters=$("#clearServiceFilters");
if(clearServiceFilters)clearServiceFilters.onclick=()=>{
 if(serviceSearch)serviceSearch.value="";
 if(serviceStatusFilter)serviceStatusFilter.value="all";
 if(serviceCityFilter)serviceCityFilter.value="all";
 if(servicePriorityFilter)servicePriorityFilter.value="all";
 if(serviceMechanicFilter)serviceMechanicFilter.value="all";
 if(serviceSort)serviceSort.value="priority";
 selectedWorkspaceRepairCarId=null;
 renderRepairs();
 renderWorkspaceRepairRequests()
};

const toggleServiceRequestArchive=$("#toggleServiceRequestArchive");
if(toggleServiceRequestArchive)toggleServiceRequestArchive.onclick=()=>setServiceRequestArchiveVisible(true);
const closeServiceRequestArchive=$("#closeServiceRequestArchive");
if(closeServiceRequestArchive)closeServiceRequestArchive.onclick=()=>setServiceRequestArchiveVisible(false);

const fleetDriverRequestsOpenService=$("#fleetDriverRequestsOpenService");
if(fleetDriverRequestsOpenService)fleetDriverRequestsOpenService.onclick=()=>{
 selectedWorkspaceRepairCarId=null;
 showPage("repairsPage");
 renderWorkspaceRepairRequests()
};

const refreshWorkspaceRepairRequests=$("#refreshWorkspaceRepairRequests");
if(refreshWorkspaceRepairRequests)refreshWorkspaceRepairRequests.onclick=renderWorkspaceRepairRequests;
const driverRepairForm=$("#driverRepairForm");
if(driverRepairForm)driverRepairForm.onsubmit=async event=>{
 event.preventDefault();
 driverRepairMessage("Отправляем заявку…");
 try{
  const assignedCar=driverAssignedCar();
  const normalizeMileageValue=value=>{
   const raw=String(value??"").replace(/\s+/g,"").replace(",",".").replace(/[^0-9.]/g,"");
   const parsed=Number(raw);
   return Number.isFinite(parsed)?Math.max(0,Math.round(parsed)):0
  };
  const currentMileage=normalizeMileageValue(assignedCar?.id&&typeof currentConfirmedMileage==="function"?currentConfirmedMileage(assignedCar.id):(assignedCar?.mileage||driverPortalContext?.mileage||0));
  const reportMileage=normalizeMileageValue($("#driverRepairMileage").value);
  if(reportMileage<currentMileage)throw new Error(`Пробег не может быть меньше текущего: ${currentMileage.toLocaleString("ru-RU")} км`);
  await window.FleetPilotCloud.submitDriverRepairRequest({
   category:$("#driverRepairCategory").value,
   urgency:$("#driverRepairUrgency").value,
   mileage:reportMileage,
   description:$("#driverRepairDescription").value,
   dashboardWarning:$("#driverRepairDashboardWarning").checked
  });
  // A service request records the mileage reported by the driver, but it is not
  // an authoritative odometer update. The vehicle mileage changes only through
  // an explicit mileage action / handover / confirmed completed service.
  $("#driverRepairDialog").close();
  driverRepairForm.reset();
  toast("Заявка отправлена");
  await renderDriverRepairRequests();
  await renderDriverNotifications()
 }catch(error){driverRepairMessage(error.message||String(error),"error")}
};

const openInviteMember=$("#openInviteMember");
if(openInviteMember)openInviteMember.onclick=()=>{
 inviteMessage("");
 $("#inviteMemberForm")?.reset();
 $("#inviteMemberDialog")?.showModal()
};
const inviteMemberForm=$("#inviteMemberForm");
if(inviteMemberForm)inviteMemberForm.onsubmit=async event=>{
 event.preventDefault();
 inviteMessage("Создаём приглашение…");
 try{
  const role=$("#inviteMemberRole").value;
  const firstName=$("#inviteMemberFirstName")?.value?.trim()||"";
  const lastName=$("#inviteMemberLastName")?.value?.trim()||"";
  const gender=$("#inviteMemberGender")?.value||"";
  const phone=$("#inviteMemberPhone")?.value?.trim()||"";
  const result=await window.FleetPilotCloud.enterpriseInvite({
   email:$("#inviteMemberEmail").value,
   role,
   city:$("#inviteMemberCity").value,
   first_name:firstName,last_name:lastName,display_name:`${firstName} ${lastName}`.trim(),gender,phone
  });
  if(role==="driver")rememberDriverInviteMeta?.({email:$("#inviteMemberEmail").value,firstName,lastName,gender,phone});
  $("#inviteMemberDialog").close();
  toast(result?.emailSent===false
   ?"Приглашение сохранено. Пользователь уже зарегистрирован — ему нужно войти."
   :"Приглашение отправлено на email");
  renderEnterprisePage()
 }catch(error){
  inviteMessage(error.message||String(error),"error")
 }
};
const refreshEnterpriseMembers=$("#refreshEnterpriseMembers");
if(refreshEnterpriseMembers)refreshEnterpriseMembers.onclick=renderEnterprisePage;
const enterpriseMemberSearch=$("#enterpriseMemberSearch");
if(enterpriseMemberSearch)enterpriseMemberSearch.oninput=renderEnterprisePage;
const enterpriseRoleFilter=$("#enterpriseRoleFilter");
if(enterpriseRoleFilter)enterpriseRoleFilter.onchange=renderEnterprisePage;
setTimeout(applyEnterpriseAccess,500);

function safeOpenCalendarPage(){
 showPage("calendarPage")
}

function safeOpenAnalyticsPage(){
 showPage("analyticsPage")
}

window.safeOpenCalendarPage=safeOpenCalendarPage;
window.safeOpenAnalyticsPage=safeOpenAnalyticsPage;

function syncDesktopNavigation(pageId){
 $$("[data-desktop-page]").forEach(button=>button.classList.toggle("active",button.dataset.desktopPage===pageId))
}
$$("[data-desktop-page]").forEach(button=>{
 button.onclick=()=>{
  const pageId=button.dataset.desktopPage;

  if(pageId==="calendarPage"){
   safeOpenCalendarPage()
  }else if(pageId==="analyticsPage"){
   safeOpenAnalyticsPage()
  }else{
   showPage(pageId)
  }

  syncDesktopNavigation(pageId)
 }
});
$("#desktopAddCar").onclick=()=>openCarDialog();
$("#desktopSearchButton").onclick=()=>$("#fleetSearch")?.focus();
$("#desktopThemeToggle").onclick=()=>toggleTheme();
$("#desktopSettingsButton").onclick=()=>showPage("morePage");



$$("[data-theme-mode]").forEach(button=>{
 button.onclick=()=>setTheme(button.dataset.themeMode)
});

$("#mobileMapShowAll").onclick=showAllMobileMapCities;
$("#openGpsSetup").onclick=openGpsSetup;
$("#closeGpsSetup").onclick=()=>$("#gpsSetupDialog").close();
$("#startGpsDemo").onclick=startGpsDemo;
$("#testGpsConnection").onclick=testGpsConnection;
$("#gpsSetupForm").onsubmit=saveGpsConnection;
$("#closeGpsMapping").onclick=()=>$("#gpsMappingDialog").close();
$("#saveGpsMapping").onclick=saveGpsMapping;
$("#customizeControlWindows").onclick=openControlWindowsDialog;
$("#showAllControlWindows").onclick=()=>{
 const settings=Object.fromEntries(CONTROL_WINDOWS.map(item=>[item.id,true]));
 saveControlWindowSettings(settings);
 renderControlWindowsOptions();
 toast("Все окна включены")
};
$("#printVehicleReport").onclick=printCurrentVehicleReport;
$("#downloadVehicleReportHtml").onclick=downloadCurrentVehicleReportHtml;
$("#closeVehicleReport").onclick=()=>$("#vehicleReportDialog").close();
$("#addQuickTask").onclick=addManualTask;
$("#openAnalyticsFromTop").onclick=safeOpenAnalyticsPage;
$("#clearActivityFeed").onclick=()=>{if(confirm("Очистить ленту действий?")){writeLocalArray(ACTIVITY_KEY,[]);renderDesktopActivityFeed()}};
$("#criticalShowCars").onclick=()=>{localStorage.setItem(ALERT_KEY,today());$("#criticalAlertDialog").close();selectedFleetCity="all";showPage("fleetPage");const filter=$("#fleetFilter");if(filter){filter.value="attention";filter.dispatchEvent(new Event("change",{bubbles:true}))}renderFleet();requestAnimationFrame(()=>$("#fleetGrid")?.scrollIntoView({behavior:"smooth",block:"start"}))};
$("#criticalRemindLater").onclick=()=>{$("#criticalAlertDialog").close()};
$("#criticalAlertDialog").addEventListener("close",()=>localStorage.setItem(ALERT_KEY,today()));


document.addEventListener("DOMContentLoaded",()=>{
 applyTheme();
 if(window.innerWidth>=1100){
  setTimeout(scheduleInitialFleetBoot,0)
 }
});
window.addEventListener("pageshow",()=>applyTheme());
window.addEventListener("pageshow",()=>{if(gpsDemoEnabled())startGpsDemoMovement()});

$$("[data-fleet-view]").forEach(button=>button.onclick=()=>{
 const view=button.dataset.fleetView;

 if(view==="map"){
  openFullFleetMap();
  return
 }

 setDesktopView(view);

 if(view==="table"){
  requestAnimationFrame(renderDesktopTable)
 }
});
$("#desktopMapFilter").onchange=()=>{
 fleetMapV2SelectedCity="";
 renderFleetMapV2({fit:true})
};
$("#commandOpenCalendar").onclick=safeOpenCalendarPage;
$("#desktopApplyStatus").onclick=applyDesktopBulkStatus;
$("#desktopApplyCity").onclick=applyDesktopBulkCity;
$("#desktopClearSelection").onclick=clearDesktopSelection;
$("#selectAllDesktopCars").onchange=e=>{
 if(e.target.checked)fleetCars().forEach(c=>desktopSelection.add(c.id));else desktopSelection.clear();
 syncDesktopSelection()
};
document.addEventListener("keydown",event=>{
 if(event.target&&["INPUT","TEXTAREA","SELECT"].includes(event.target.tagName))return;
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="n"){event.preventDefault();openCarDialog()}
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="f"){event.preventDefault();showPage("fleetPage");setTimeout(()=>$("#fleetSearch")?.focus(),30)}
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="p"){event.preventDefault();if(requireFleetCar())openPaymentDialog()}
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();$("#globalSearchButton").click()}
 if(event.key==="Escape"&&desktopSelection.size)clearDesktopSelection()
});
window.addEventListener("resize",()=>{if(window.innerWidth>=1100){applyControlWindowSettings();initializeDesktopCommandCenter();scheduleDesktopLiveRefresh({preserveMapViewport:true})}});
window.addEventListener("load",()=>{
 if(window.innerWidth>=1100){
  applyControlWindowSettings();
  scheduleInitialFleetBoot();
  setTimeout(()=>scheduleDesktopLiveRefresh({preserveMapViewport:true}),500);
  setTimeout(()=>maybeShowCriticalAlert(),700)
 }
});

$$(".bottom-nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===id));$("#pageTitle").textContent={dashboardPage:"Главная",fleetPage:"Автопарк",driversPage:"Водители",repairsPage:"Ремонты",paymentsPage:"Оплаты аренды",expensesPage:"Плановые расходы",documentsPage:"Документы",calendarPage:"Календарь",analyticsPage:"Аналитика",dataPage:"Данные",attentionPage:"Внимание",morePage:"Ещё",mobileMapPage:"Карта",searchPage:"Поиск",carPage:"Автомобиль"}[id];$("#headerAdd").hidden=id!=="fleetPage"||!enterpriseCan("cars.create");if(id==="dashboardPage")renderOwnerDashboard();if(id==="fleetPage")renderFleet();if(id==="repairsPage")renderRepairs();if(id==="paymentsPage")renderPayments();if(id==="expensesPage")renderExpenses();if(id==="documentsPage")renderDocuments();if(id==="calendarPage")renderCalendar();if(id==="analyticsPage")renderAnalytics();if(id==="dataPage")renderDataPage();if(id==="attentionPage")renderAttention();if(id==="morePage")renderMorePage();if(id==="mobileMapPage"){
 renderMobileGpsMap({fit:true});
 updateGpsCountdownUi();
 requestAnimationFrame(()=>{
  mobileFleetMap?.invalidateSize({pan:false});
  setTimeout(()=>mobileFleetMap?.invalidateSize({pan:false}),180)
 })
}if(id==="searchPage")renderGlobalSearch()}
function attention(c){return oil(c)<=1000||days(c.insurance)<=30||days(c.inspection)<=30}



