/* =========================================================
   FleetPilot V15.6 — Driver Portal
   Driver UI, repair requests, vehicle assignment, driver documents and notifications.
   Source order: original app.js lines 970-1609
   ========================================================= */
const DRIVER_REPAIR_CATEGORY_LABELS={
 engine:"Двигатель",suspension:"Ходовая",brakes:"Тормоза",electric:"Электрика",
 body:"Кузов",tires:"Шины и колёса",climate:"Климат",other:"Другое"
};
const DRIVER_REPAIR_URGENCY_LABELS={
 normal:"Можно ехать",service:"Нужен сервис",critical:"Движение опасно"
};
const DRIVER_REPAIR_STATUS_LABELS={
 new:"Новая",accepted:"Принята",scheduled:"Назначен сервис",
 repair:"В ремонте",done:"Готово",rejected:"Отклонена"
};
let driverPortalContext=null;
let workspaceDriverAssignments={};

function driverPortalMessage(text,type=""){
 const el=$("#driverPortalMessage");if(!el)return;
 el.hidden=!text;el.textContent=text;el.className=`cloud-message ${type}`
}
function driverRepairMessage(text,type=""){
 const el=$("#driverRepairMessage");if(!el)return;
 el.hidden=!text;el.textContent=text;el.className=`cloud-message ${type}`
}
function driverAssignedCar(){
 const carId=driverPortalContext?.car_id;
 return carId?car(carId):null
}

let driverHandoverState=null;
let vehicleHandoverPhotoData=[];

function handoverMessage(text,type=""){
 const el=$("#vehicleHandoverMessage");if(!el)return;
 el.hidden=!text;el.textContent=text;el.className=`cloud-message ${type}`
}
async function compressHandoverImage(file){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error("Не удалось прочитать фотографию"));
  reader.onload=()=>{
   const image=new Image();
   image.onerror=()=>reject(new Error("Некорректная фотография"));
   image.onload=()=>{
    const max=1280;
    const scale=Math.min(1,max/Math.max(image.width,image.height));
    const canvas=document.createElement("canvas");
    canvas.width=Math.round(image.width*scale);
    canvas.height=Math.round(image.height*scale);
    canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
    resolve({
     name:file.name,
     type:"image/jpeg",
     data:canvas.toDataURL("image/jpeg",.72)
    })
   };
   image.src=reader.result
  };
  reader.readAsDataURL(file)
 })
}
function renderHandoverPhotoPreview(){
 const root=$("#vehicleHandoverPhotoPreview");if(!root)return;
 root.innerHTML=vehicleHandoverPhotoData.map((photo,index)=>`
  <div><img src="${photo.data}" alt="Фото ${index+1}">
   <button type="button" onclick="removeHandoverPhoto(${index})">✕</button></div>`).join("")
}
function removeHandoverPhoto(index){
 vehicleHandoverPhotoData.splice(index,1);
 renderHandoverPhotoPreview()
}
window.removeHandoverPhoto=removeHandoverPhoto;

async function loadDriverHandoverState(){
 if(enterpriseCurrentRole()!=="driver")return;
 try{
  driverHandoverState=await window.FleetPilotCloud.getDriverHandoverState();
  const actions=$("#driverHandoverActions");
  if(!actions)return;
  actions.hidden=!driverPortalContext?.car_id;
  $("#startVehicleIssue").hidden=Boolean(driverHandoverState?.active_handover_id);
  $("#startVehicleReturn").hidden=!driverHandoverState?.active_handover_id
 }catch(error){
  console.warn("Handover state",error)
 }
}
function openVehicleHandover(type){
 if(!driverPortalContext?.car_id)return toast("Автомобиль не назначен");
 const assignedCar=driverAssignedCar();
 const snapshot=driverPortalContext.vehicle_snapshot||{};
 const displayCar=assignedCar||snapshot;
 const brand=assignedCar?model(assignedCar).brand:(snapshot.brand||"Автомобиль");
 const modelName=assignedCar?model(assignedCar).model:(snapshot.model||"");

 $("#vehicleHandoverType").value=type;
 $("#vehicleHandoverTitle").textContent=type==="issue"?"Принять автомобиль":"Вернуть автомобиль";
 $("#vehicleHandoverSubmit").textContent=type==="issue"?"Подтвердить приём":"Подтвердить возврат";
 $("#vehicleHandoverConfirmText").textContent=type==="issue"
  ?"Подтверждаю получение автомобиля в указанном состоянии"
  :"Подтверждаю возврат автомобиля в указанном состоянии";
 $("#vehicleHandoverCarSummary").innerHTML=`<strong>${brand} ${modelName}</strong><span>${displayCar.plate||"—"}</span>`;
 $("#vehicleHandoverMileage").value=displayCar.mileage||driverPortalContext.mileage||0;
 $("#vehicleHandoverFuel").value="50";
 $("#vehicleHandoverNotes").value="";
 $("#vehicleHandoverConfirm").checked=false;
 $$("[data-handover-equipment]").forEach(input=>input.checked=true);
 vehicleHandoverPhotoData=[];
 renderHandoverPhotoPreview();
 handoverMessage("");
 $("#vehicleHandoverDialog").showModal()
}
async function loadVehicleHandoverHistory(carId){
 const root=$("#vehicleHandoverHistory");if(!root)return;
 root.innerHTML='<div class="driver-empty-state">Загрузка истории передач…</div>';
 try{
  const rows=await window.FleetPilotCloud.getVehicleHandoverHistory(carId);
  root.innerHTML=rows.map(row=>{
   const issue=row.issue_at?new Date(row.issue_at).toLocaleString("ru-RU"):"—";
   const returned=row.return_at?new Date(row.return_at).toLocaleString("ru-RU"):null;
   const distance=row.return_mileage!=null?Math.max(0,row.return_mileage-row.issue_mileage):null;
   return `<article class="handover-history-row">
    <div class="handover-history-line"></div>
    <div class="handover-history-content">
     <div class="handover-history-head">
      <strong>${row.driver_name||row.driver_email||"Водитель"}</strong>
      <span class="${returned?"completed":"active"}">${returned?"Возвращён":"Выдан"}</span>
     </div>
     <div class="handover-history-grid">
      <div><small>Выдача</small><b>${issue}</b></div>
      <div><small>Пробег при выдаче</small><b>${km(row.issue_mileage)}</b></div>
      <div><small>Возврат</small><b>${returned||"Автомобиль у водителя"}</b></div>
      <div><small>Пробег при возврате</small><b>${row.return_mileage!=null?km(row.return_mileage):"—"}</b></div>
      <div><small>Пройдено</small><b>${distance!=null?km(distance):"—"}</b></div>
      <div><small>Фото</small><b>${(row.issue_photos_count||0)+(row.return_photos_count||0)}</b></div>
     </div>
     ${row.issue_notes?`<p><strong>При выдаче:</strong> ${row.issue_notes}</p>`:""}
     ${row.return_notes?`<p><strong>При возврате:</strong> ${row.return_notes}</p>`:""}
     <div class="handover-photo-history">
      ${(row.issue_photos||[]).slice(0,8).map(photo=>`<img src="${photo.data}" alt="Фото выдачи">`).join("")}
      ${(row.return_photos||[]).slice(0,8).map(photo=>`<img src="${photo.data}" alt="Фото возврата">`).join("")}
     </div>
    </div>
   </article>`
  }).join("")||'<div class="driver-empty-state">Передач автомобиля пока не было.</div>'
 }catch(error){root.innerHTML=`<div class="driver-empty-state">${error.message||error}</div>`}
}
function renderDriverVehicleCard(){
 const root=$("#driverVehicleCard");if(!root)return;
 const assigned=driverPortalContext;
 const assignedCar=driverAssignedCar();

 if(!assigned?.car_id){
  root.innerHTML=`<div class="driver-empty-state">
   <strong>Автомобиль ещё не назначен</strong>
   <span>Владелец или координатор должен назначить автомобиль в разделе «Компания → Команда».</span>
  </div>`;
  return
 }

 const snapshot=assigned.vehicle_snapshot||{};
 const displayCar=assignedCar||snapshot;
 const brand=assignedCar?model(assignedCar).brand:(snapshot.brand||"Автомобиль");
 const modelName=assignedCar?model(assignedCar).model:(snapshot.model||"");
 const plate=displayCar.plate||"—";
 const mileage=Number(displayCar.mileage||assigned.mileage||0);

 root.innerHTML=`
  <div class="driver-vehicle-main">
   <div class="driver-vehicle-icon">🚗</div>
   <div>
    <span class="eyebrow">Назначенный автомобиль</span>
    <h3>${brand} ${modelName}</h3>
    <p>${plate} · ${displayCar.vin||"VIN не указан"}</p>
   </div>
   <span class="driver-vehicle-status">${statusText(displayCar.status||"active")}</span>
  </div>
  <div class="driver-vehicle-stats">
   <div><small>Пробег</small><strong>${km(mileage)}</strong></div>
   <div><small>${driverHandoverState?.active_handover_id?"Выдан":"Назначен"}</small><strong>${driverHandoverState?.issue_at?new Date(driverHandoverState.issue_at).toLocaleDateString("ru-RU"):assigned.assigned_at?new Date(assigned.assigned_at).toLocaleDateString("ru-RU"):"—"}</strong></div>
   <div><small>Следующее ТО</small><strong>${assignedCar?km(Math.max(0,oil(assignedCar))):"—"}</strong></div>
   <div><small>Город</small><strong>${displayCar.city||window.FleetPilotCloud?.membership?.city||"—"}</strong></div>
  </div>`
}
function renderDriverDocuments(){
 const root=$("#driverDocumentsList");if(!root)return;
 const assignedCar=driverAssignedCar();
 const docs=(db.documents||[]).filter(doc=>!doc.carId||doc.carId===assignedCar?.id).slice(0,8);
 root.innerHTML=docs.map(doc=>`
  <article class="driver-list-row">
   <div><strong>${doc.name||documentTypeText(doc.type)||"Документ"}</strong>
   <small>${doc.date?date(doc.date):doc.expiry?`до ${date(doc.expiry)}`:"Доступен"}</small></div>
  </article>`).join("")||'<div class="driver-empty-state">Документов пока нет.</div>'
}
async function renderDriverRepairRequests(){
 const root=$("#driverRepairRequestsList");if(!root)return;
 root.innerHTML='<div class="driver-empty-state">Загрузка…</div>';
 try{
  const rows=await window.FleetPilotCloud.getMyDriverRepairRequests();
  root.innerHTML=rows.map(row=>`
   <article class="driver-request-row urgency-${row.urgency}">
    <div class="driver-request-main">
     <strong>${DRIVER_REPAIR_CATEGORY_LABELS[row.category]||row.category}</strong>
     <span>${row.description}</span>
     <small>${new Date(row.created_at).toLocaleString("ru-RU")} · ${km(row.mileage)}</small>
     ${row.manager_comment?`<em>Комментарий: ${row.manager_comment}</em>`:""}
    </div>
    <div class="driver-request-badges">
     <span class="urgency">${DRIVER_REPAIR_URGENCY_LABELS[row.urgency]||row.urgency}</span>
     <span class="status">${DRIVER_REPAIR_STATUS_LABELS[row.status]||row.status}</span>
    </div>
   </article>`).join("")||'<div class="driver-empty-state">Заявок пока нет.</div>'
 }catch(error){root.innerHTML=`<div class="driver-empty-state">${error.message||error}</div>`}
}

let driverServiceFeedRows=[];
async function renderDriverServiceFeed(){
 const root=$("#driverTasksList"),count=$("#driverServicePlanCount");
 if(!root)return;
 root.innerHTML='<div class="driver-empty-state">Загрузка сервисного плана…</div>';
 try{
  const rows=await window.FleetPilotCloud.getDriverServiceFeed();
  driverServiceFeedRows=rows;
  if(count)count.textContent=String(rows.filter(row=>row.status!=="done").length);
  root.innerHTML=rows.map(row=>{
   const due=row.date?days(row.date):null;
   const urgency=due!=null&&due<0?"overdue":due!=null&&due<=3?"urgent":due!=null&&due<=14?"soon":"normal";
   const statusLabel=repairStatusText(row.status);
   return `<article class="driver-service-plan-row ${urgency}">
    <div class="driver-service-plan-icon">🔧</div>
    <div class="driver-service-plan-main">
      <div class="driver-service-plan-title"><strong>${row.title||"Сервис"}</strong><span>${statusLabel}</span></div>
      <p>${row.note||"Запланированное обслуживание автомобиля"}</p>
      <div class="driver-service-plan-meta">
        <span>📅 ${row.date?date(row.date):"Дата уточняется"}</span>
        <span>🧭 ${row.mileage?km(row.mileage):"Пробег не указан"}</span>
        ${due!=null?`<b>${due<0?`Просрочено ${Math.abs(due)} дн.`:due===0?"Сегодня":`Через ${due} дн.`}</b>`:""}
      </div>
    </div>
   </article>`
  }).join("")||'<div class="driver-empty-state">Запланированных сервисных работ нет.</div>';
  renderDriverProfileService()
 }catch(error){
  if(count)count.textContent="!";
  root.innerHTML=`<div class="driver-empty-state">${error.message||"Не удалось загрузить сервисный план"}</div>`
 }
}
async function renderDriverNotifications(){
 const root=$("#driverNotificationsList");if(!root)return;
 try{
  const rows=await window.FleetPilotCloud.getMyWorkspaceNotifications();
  root.innerHTML=rows.map(row=>`
   <article class="driver-notification-row ${row.read_at?"read":""}">
    <span>${row.type==="repair"?"🔧":"🔔"}</span>
    <div><strong>${row.title}</strong><small>${row.message||""}</small>
    <em>${new Date(row.created_at).toLocaleString("ru-RU")}</em></div>
   </article>`).join("")||'<div class="driver-empty-state">Новых уведомлений нет.</div>'
 }catch(error){root.innerHTML='<div class="driver-empty-state">Не удалось загрузить уведомления.</div>'}
}
async function renderDriverPortal(){
 if(enterpriseCurrentRole()!=="driver")return;
 driverPortalMessage("Загрузка…");
 try{
  driverPortalContext=await window.FleetPilotCloud.getDriverPortalContext();
  await loadDriverHandoverState();
  renderDriverVehicleCard();
  renderDriverDocuments();
  renderDriverProfile();
  await Promise.all([renderDriverRepairRequests(),renderDriverNotifications(),renderDriverServiceFeed()]);
  driverPortalMessage("")
 }catch(error){
  driverPortalMessage(error.message||String(error),"error")
 }
}

function driverProfileDisplayName(){
 const profile=window.FleetPilotCloud?.profile||{};
 const savedName=localStorage.getItem(`fleetpilot.profile.name.v2.${window.FleetPilotCloud?.session?.user?.id||"guest"}`);
 return savedName||profile.full_name||profile.name||profile.email?.split("@")[0]||"Пользователь FleetPilot"
}

function renderDriverProfileService(){
 const history=$("#driverProfileServiceHistory");
 const alert=$("#driverProfileServiceAlert");
 const active=driverServiceFeedRows
  .filter(row=>row.status!=="done"&&row.status!=="cancelled")
  .sort((a,b)=>(a.date||"9999-12-31").localeCompare(b.date||"9999-12-31"));
 const completed=driverServiceFeedRows
  .filter(row=>row.status==="done")
  .sort((a,b)=>(b.date||"").localeCompare(a.date||""));

 if(alert){
  const first=active[0];
  alert.hidden=!first;
  if(first){
   const due=first.date?days(first.date):null;
   $("#driverProfileServiceAlertTitle").textContent=first.title||"Запланирован сервис";
   $("#driverProfileServiceAlertText").textContent=[
    first.date?date(first.date):"Дата уточняется",
    first.mileage?km(first.mileage):"",
    due===0?"Сегодня":due!=null&&due<0?`Просрочено на ${Math.abs(due)} дн.`:due!=null?`Через ${due} дн.`:"",
    first.note||""
   ].filter(Boolean).join(" · ")
  }
 }

 if(history){
  const rows=[...active,...completed].slice(0,20);
  history.innerHTML=rows.map(row=>`
   <article class="driver-profile-history-row ${row.status==="done"?"completed":"active"}">
    <span class="driver-profile-history-dot"></span>
    <div>
     <div class="driver-profile-history-title">
      <strong>${row.title||"Сервис"}</strong>
      <em>${repairStatusText(row.status)}</em>
     </div>
     <p>${row.note||"Без дополнительного комментария"}</p>
     <small>${row.date?date(row.date):"Дата не указана"}${row.mileage?` · ${km(row.mileage)}`:""}</small>
    </div>
   </article>`).join("")||'<div class="driver-empty-state">Истории обслуживания пока нет.</div>'
 }
}
function renderDriverProfile(){
 if(enterpriseCurrentRole()!=="driver")return;

 const cloud=window.FleetPilotCloud||{};
 const email=cloud.session?.user?.email||cloud.profile?.email||"—";
 const name=driverProfileDisplayName();
 const workspaceName=cloud.workspace?.name||"—";
 const city=cloud.membership?.city||cloud.workspace?.city||"—";
 const assigned=driverAssignedCar();
 const snapshot=driverPortalContext?.vehicle_snapshot||{};
 const vehicleName=assigned
  ?`${model(assigned).brand} ${model(assigned).model} · ${assigned.plate||"—"}`
  :driverPortalContext?.car_id
    ?`${snapshot.brand||"Автомобиль"} ${snapshot.model||""} · ${snapshot.plate||"—"}`
    :"Не назначен";

 if($("#driverProfileName"))$("#driverProfileName").textContent=name;
 if($("#driverProfileEmail"))$("#driverProfileEmail").textContent=email;
 if($("#driverProfileWorkspace"))$("#driverProfileWorkspace").textContent=workspaceName;
 if($("#driverProfileCity"))$("#driverProfileCity").textContent=city;
 if($("#driverProfileVehicle"))$("#driverProfileVehicle").textContent=vehicleName;
 if($("#driverProfileAvatar"))$("#driverProfileAvatar").textContent=(name.trim()[0]||"F").toUpperCase();
 renderDriverProfileService()
}
async function openDriverRepairDialog(){
 if(!driverPortalContext)await renderDriverPortal();
 const assignedCar=driverAssignedCar();
 if(!driverPortalContext?.car_id){
  toast("Сначала нужно назначить автомобиль");
  return
 }
 $("#driverRepairMileage").value=assignedCar?.mileage||driverPortalContext?.mileage||0;
 const brand=assignedCar?model(assignedCar).brand:(driverPortalContext?.vehicle_snapshot?.brand||"");
 const modelName=assignedCar?model(assignedCar).model:(driverPortalContext?.vehicle_snapshot?.model||"");
 $("#driverRepairVehicleSummary").innerHTML=`<strong>${brand} ${modelName}</strong><span>${assignedCar?.plate||driverPortalContext?.vehicle_snapshot?.plate||"—"}</span>`;
 driverRepairMessage("");
 $("#driverRepairDialog").showModal()
}

let workspaceRepairAlerts=[];
let selectedWorkspaceRepairCarId=null;
window.selectedWorkspaceRepairCarId=selectedWorkspaceRepairCarId;

function activeWorkspaceRepairAlerts(){
 // Only requests that are still actionable in the incoming queue may light the fleet wrench.
 // Cloud-linked requests use statuses like "repair"/"done" after transfer and must not be counted twice.
 return workspaceRepairAlerts.filter(row=>["new","accepted"].includes(String(row?.status||"new")))
}
function repairAlertsForCar(carId){
 return activeWorkspaceRepairAlerts().filter(row=>String(row.car_id)===String(carId))
}
function repairAlertLevel(rows){
 if(rows.some(row=>row.urgency==="critical"))return"critical";
 if(rows.some(row=>row.urgency==="service"))return"service";
 return"normal"
}

function fleetServiceBadgeMarkup(carId,desktop=false){
 const requestRows=repairAlertsForCar(carId);
 const terminalRepairStatuses=new Set(["done","cancelled","canceled","rejected","archived","closed"]);
 const repairRows=(db.repairs||[]).filter(r=>
  String(r.carId)===String(carId)&&
  !terminalRepairStatuses.has(String(r.status||"").toLowerCase())
 );
 const total=requestRows.length+repairRows.length;
 if(!total)return"";
 return `<button type="button" class="car-service-alert-icon photo-task-indicator ${desktop?"desktop-inline-service-alert":""}" data-car-service-alert="${carId}" onclick="event.stopPropagation();openFleetServiceAlert('${carId}')" title="Сервисные задачи: ${total}" aria-label="Открыть сервисные задачи"><span class="service-wrench-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4l-3 3-3-3 3-3Z" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span><b>${total}</b></button>`
}
function renderFleetServiceAlertIndicators(){
 document.querySelectorAll("[data-car-service-alert].dynamic-service-alert").forEach(node=>node.remove())
}

function activeDriverRepairRequests(){
 return (workspaceRepairAlerts||[])
  .filter(row=>["new","accepted"].includes(String(row.status||"new")))
  .sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||"")))
}

function renderFleetDriverRequestsPanel(){
 const panel=$("#fleetDriverRequestsPanel");
 const list=$("#fleetDriverRequestsList");
 if(!panel||!list)return;

 const rows=activeDriverRepairRequests();
 if(!rows.length){
  panel.hidden=true;
  list.innerHTML="";
  return
 }

 panel.hidden=false;
 const cars=new Set(rows.map(row=>String(row.car_id||"")).filter(Boolean));
 $("#fleetDriverRequestsTitle").textContent=`${rows.length} ${rows.length===1?"активная заявка":"активных заявок"}`;
 $("#fleetDriverRequestsText").textContent=`Автомобилей с обращениями: ${cars.size}`;

 list.innerHTML="";
 $("#fleetDriverRequestsTitle").textContent=`Активных заявок: ${rows.length}`;
 $("#fleetDriverRequestsText").textContent=`Автомобилей с обращениями: ${cars.size}`
}

function openRepairFromFleetRequest(requestId){
 const request=(workspaceRepairAlerts||[]).find(row=>String(row.id)===String(requestId));
 if(!request)return toast("Заявка не найдена");
 openRepairFromDriverRequest(request)
}
window.openRepairFromFleetRequest=openRepairFromFleetRequest;

async function loadFleetServiceAlerts({rerender=false}={}){
 if(!["owner","coordinator","mechanic"].includes(enterpriseCurrentRole()))return[];
 try{
  workspaceRepairAlerts=await window.FleetPilotCloud.getWorkspaceDriverRepairRequests();
  renderFleetDriverRequestsPanel();
  if(typeof renderFleet==="function"&&(rerender||$("#fleetPage")?.classList.contains("active")))renderFleet();
  requestAnimationFrame(renderFleetServiceAlertIndicators);
  return workspaceRepairAlerts
 }catch(error){
  workspaceRepairAlerts=[];
  renderFleetDriverRequestsPanel();
  console.warn("Fleet service alerts failed",error);
  return[]
 }
}
function openFleetServiceAlert(carId){
 selectedWorkspaceRepairCarId=String(carId);
 if(serviceCollapsedCars.has(String(carId))){serviceCollapsedCars.delete(String(carId));try{localStorage.setItem(SERVICE_COLLAPSED_CARS_KEY,JSON.stringify([...serviceCollapsedCars]))}catch{}}
 const search=$("#serviceSearch");if(search)search.value="";
 const city=$("#serviceCityFilter");if(city)city.value="all";
 const priority=$("#servicePriorityFilter");if(priority)priority.value="all";
 const mechanic=$("#serviceMechanicFilter");if(mechanic)mechanic.value="all";
 const status=$("#serviceStatusFilter");if(status)status.value="all";
 showPage("repairsPage");
 setTimeout(async()=>{
  try{await renderWorkspaceRepairRequests()}catch{}
  renderRepairs();
  const target=document.querySelector(`[data-service-car="${CSS.escape(String(carId))}"]`);
  if(target){
   target.scrollIntoView({behavior:"smooth",block:"center"});
   target.classList.add("smart-entity-highlight");
   setTimeout(()=>target.classList.remove("smart-entity-highlight"),2800)
  }
 },80)
}
function openAllFleetServiceAlerts(){
 selectedWorkspaceRepairCarId=null;
 showPage("repairsPage");
 setTimeout(()=>renderWorkspaceRepairRequests(),50)
}
window.openFleetServiceAlert=openFleetServiceAlert;
function clearWorkspaceRepairCarFilter(){
 selectedWorkspaceRepairCarId=null;
 renderWorkspaceRepairRequests();
 renderRepairs()
}
window.openAllFleetServiceAlerts=openAllFleetServiceAlerts;
window.clearWorkspaceRepairCarFilter=clearWorkspaceRepairCarFilter;


function archivedDriverRepairRequests(){
 return (workspaceRepairAlerts||[])
  .filter(row=>String(row.status||"")==="rejected")
  .sort((a,b)=>String(b.updated_at||b.created_at||"").localeCompare(String(a.updated_at||a.created_at||"")))
}

function renderServiceRequestArchive(){
 const panel=$("#serviceRequestArchivePanel");
 const root=$("#serviceRequestArchiveList");
 if(!panel||!root)return;

 const rows=archivedDriverRepairRequests();
 const count=$("#serviceArchivedRequestCount");
 if(count)count.textContent=String(rows.length);

 root.innerHTML=rows.map(row=>{
  const localCar=car(row.car_id);
  const carName=localCar?`${model(localCar).brand} ${model(localCar).model} · ${localCar.plate}`:(row.car_id||"Автомобиль");
  const category=DRIVER_REPAIR_CATEGORY_LABELS[row.category]||row.category||"Неисправность";
  const when=row.updated_at||row.created_at;
  return `<article class="workspace-request-row service-archive-request" data-archived-request-id="${row.id}">
   <div>
    <div class="service-inbox-request-heading">
     <strong>${category} · ${carName}</strong>
     <span class="service-inbox-request-badge rejected">Отклонена</span>
    </div>
    <span>${row.description||"Без описания"}</span>
    <small>${row.driver_email||"Водитель"} · ${when?new Date(when).toLocaleString("ru-RU"):"—"} · ${km(row.mileage)}</small>
   </div>
   <div class="service-archive-actions">
    <button type="button" class="btn primary" data-restore-request="${row.id}">Вернуть в работу</button>
   </div>
  </article>`
 }).join("")||'<div class="driver-empty-state service-inbox-empty">Архив заявок пуст.</div>';

 $$("[data-restore-request]").forEach(button=>button.onclick=async()=>{
  const requestId=button.dataset.restoreRequest;
  const request=workspaceRepairAlerts.find(row=>String(row.id)===String(requestId));
  button.disabled=true;
  const oldText=button.textContent;
  button.textContent="Возвращаю…";
  try{
   await window.FleetPilotCloud.updateDriverRepairRequest(requestId,"accepted","Возвращено из архива");
   if(request)request.status="accepted";
   toast("Заявка возвращена в работу");
   renderServiceRequestArchive();
   renderFleetDriverRequestsPanel();
   await renderWorkspaceRepairRequests();
  }catch(error){
   toast(error.message||"Не удалось вернуть заявку")
  }finally{
   button.disabled=false;
   button.textContent=oldText
  }
 })
}

function setServiceRequestArchiveVisible(visible){
 const panel=$("#serviceRequestArchivePanel");
 if(!panel)return;
 panel.hidden=!visible;
 if(visible){
  renderServiceRequestArchive();
  requestAnimationFrame(()=>panel.scrollIntoView({behavior:"smooth",block:"start"}))
 }
}
window.setServiceRequestArchiveVisible=setServiceRequestArchiveVisible;

async function renderWorkspaceRepairRequests(){
 const root=$("#workspaceRepairRequestsList");if(!root)return;
 if(!["owner","coordinator","mechanic"].includes(enterpriseCurrentRole())){
  root.innerHTML="";
  return
 }
 root.innerHTML='<div class="driver-empty-state">Загрузка…</div>';
 try{
  workspaceRepairAlerts=await window.FleetPilotCloud.getWorkspaceDriverRepairRequests();
  renderFleetDriverRequestsPanel();

  const pending=activeDriverRepairRequests();
  const activeCounter=$("#serviceActiveRequestCount");
  if(activeCounter)activeCounter.textContent=String(pending.length);
  renderServiceRequestArchive();
  const rows=selectedWorkspaceRepairCarId
   ?pending.filter(row=>String(row.car_id)===String(selectedWorkspaceRepairCarId))
   :pending;

  const filterBar=selectedWorkspaceRepairCarId?`
   <div class="workspace-request-filter">
    <span>Показаны новые обращения выбранного автомобиля</span>
    <button type="button" class="btn" onclick="clearWorkspaceRepairCarFilter()">Показать все</button>
   </div>`:"";

  root.innerHTML=filterBar+(rows.map(row=>{
   const localCar=car(row.car_id);
   const carName=localCar?`${model(localCar).brand} ${model(localCar).model} · ${localCar.plate}`:(row.car_id||"Автомобиль");
   const category=DRIVER_REPAIR_CATEGORY_LABELS[row.category]||row.category||"Неисправность";
   const state=String(row.status||"new");

   return `<article class="workspace-request-row service-inbox-request urgency-${row.urgency}" data-workspace-request-id="${row.id}" data-workspace-request-car="${row.car_id}">
    <div class="service-inbox-request-main">
     <div class="service-inbox-request-heading">
      <strong>${category} · ${carName}</strong>
      <span class="service-inbox-request-badge ${state}">${state==="accepted"?"Принята":"Новая"}</span>
     </div>
     <span>${row.description||"Без описания"}</span>
     <small>${row.driver_email||"Водитель"} · ${new Date(row.created_at).toLocaleString("ru-RU")} · ${km(row.mileage)}</small>
    </div>
    <div class="service-inbox-request-actions">
     <select data-request-status="${row.id}">
      <option value="new" ${state==="new"?"selected":""}>Новая</option>
      <option value="accepted" ${state==="accepted"?"selected":""}>Принята</option>
      <option value="rejected">Отклонена</option>
     </select>
     <button type="button" class="btn primary" data-transfer-service="${row.id}">Передать в сервис</button>
    </div>
   </article>`
  }).join("")||'<div class="driver-empty-state service-inbox-empty">Новых заявок нет. Все обращения обработаны.</div>');

  $$("[data-request-status]").forEach(select=>select.onchange=async()=>{
   const request=workspaceRepairAlerts.find(row=>String(row.id)===String(select.dataset.requestStatus));
   const next=select.value;
   try{
    await window.FleetPilotCloud.updateDriverRepairRequest(select.dataset.requestStatus,next,"");
    if(request)request.status=next;
    toast(next==="accepted"?"Заявка принята":next==="rejected"?"Заявка отклонена":"Статус заявки обновлён");
    await renderWorkspaceRepairRequests();
    await loadFleetServiceAlerts({rerender:true})
   }catch(error){
    toast(error.message||String(error))
   }
  });

  $$("[data-transfer-service]").forEach(button=>button.onclick=()=>{
   const request=workspaceRepairAlerts.find(row=>String(row.id)===String(button.dataset.transferService));
   if(!request)return toast("Заявка не найдена");
   openRepairFromDriverRequest(request)
  });

  requestAnimationFrame(renderFleetServiceAlertIndicators)
 }catch(error){
  root.innerHTML=`<div class="driver-empty-state">${error.message||error}</div>`
 }
}
async function loadWorkspaceDriverAssignments(){
 try{
  const rows=await window.FleetPilotCloud.getDriverAssignments();
  workspaceDriverAssignments=Object.fromEntries(rows.filter(row=>row.status!=="returned"&&row.car_id).map(row=>[row.driver_user_id,row.car_id]));
  const activeByCar=new Map(rows.filter(row=>row.status!=="returned"&&row.car_id).map(row=>[String(row.car_id),row]));
  fleetCars().forEach(c=>{
   const assignment=activeByCar.get(String(c.id));
   if(!assignment&&c.driverUserId){c.driverUserId="";c.tenant="";if(c.status==="active")c.status="free"}
  })
 }catch{workspaceDriverAssignments={}}
}
function driverAssignmentControl(member){
 if(member.role!=="driver")return"";
 const selected=workspaceDriverAssignments[member.user_id]||"";
 return `<select data-driver-assignment="${member.user_id}">
  <option value="">Без автомобиля</option>
  ${fleetCars().map(c=>`<option value="${c.id}" ${c.id===selected?"selected":""}>${model(c).brand} ${model(c).model} · ${c.plate}</option>`).join("")}
 </select>`
}

