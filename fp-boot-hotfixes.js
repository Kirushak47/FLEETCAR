/* =========================================================
   FleetPilot V15.6 — Boot & Compatibility Fixes
   Startup guard and later compatibility/hotfix overrides through V15.5.
   Source order: original app.js lines 7411-7967
   ========================================================= */
/* FleetPilot V7.5.4 — final DOM boot guard */
(function(){
 function finalBoot(){
  try{
   if(typeof renderAll==="function")renderAll();
   else if(typeof renderFleet==="function")renderFleet();
   if(window.innerWidth>=1100&&typeof initializeDesktopCommandCenter==="function")initializeDesktopCommandCenter();

   // If Supabase session exists, route is restored by fleetpilot:access-ready
   // after membership/role resolution. Guests/demo can restore immediately.
   requestAnimationFrame(()=>{
    try{
     if(!window.FleetPilotCloud?.session||fleetPilotEnterpriseAccessReady){
      fleetPilotApplyRoute({replaceInvalid:false})
     }
    }catch(error){console.error("FleetPilot route restore error",error)}
   })
  }catch(error){console.error("FleetPilot final boot error",error)}
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",finalBoot,{once:true});
 else requestAnimationFrame(finalBoot);
 window.addEventListener("pageshow",()=>requestAnimationFrame(finalBoot));
})();


document.addEventListener("DOMContentLoaded",()=>{
 if(gpsDemoEnabled()){
  const existing=readGpsDevices();
  if(!existing.length){
   const devices=buildGpsDemoDevices();
   gpsWrite(GPS_DEVICES_KEY,devices);
   autoMapDemoDevices(devices)
  }
  startGpsDemoMovement()
 }
});



document.addEventListener("DOMContentLoaded",()=>{
 startUniversalGpsSync();
 updateGpsCountdownUi()
});
window.addEventListener("pageshow",()=>{
 startUniversalGpsSync();
 updateGpsCountdownUi()
});

document.addEventListener("DOMContentLoaded",()=>{
 requestAnimationFrame(updateGpsBadgesOnly)
});

window.addEventListener("fleetpilot:assignments-changed",async()=>{
 if(["owner","coordinator","mechanic"].includes(enterpriseCurrentRole())){
  await loadWorkspaceDriverAssignments();renderFleet();if($("#companyPage")?.classList.contains("active"))renderEnterprisePage()
 }else if(enterpriseCurrentRole()==="driver")renderDriverPortal()
});
window.addEventListener("fleetpilot:repair-requests-changed",async()=>{
 await loadFleetServiceAlerts({rerender:true});
 if($("#repairsPage")?.classList.contains("active"))renderWorkspaceRepairRequests()
});

/* =========================================================
   FleetPilot V11.9 — simplified service workspace
   - removes stage drag/drop workflow
   - task selection + manual ordering inside each vehicle
   - compact New / Accepted / Plan / Expenses summary
   ========================================================= */
let selectedServiceTaskId="";
let selectedServiceRequestId="";

function fpServiceRepairIsActive(r){return !["done","cancelled"].includes(String(r?.status||""))}
function fpServiceOrderValue(r,index=0){
 const n=Number(r?.serviceOrder);
 return Number.isFinite(n)?n:index;
}
function fpNormalizeServiceOrder(carId){
 const rows=(db.repairs||[]).filter(r=>String(r.carId)===String(carId)&&fpServiceRepairIsActive(r));
 rows.sort((a,b)=>fpServiceOrderValue(a)-fpServiceOrderValue(b)||String(a.date||"").localeCompare(String(b.date||"")));
 rows.forEach((r,i)=>r.serviceOrder=i)
}
function selectServiceTask(id){
 selectedServiceTaskId=String(id||"");
 renderRepairs();
 requestAnimationFrame(()=>{
  const row=document.querySelector(`[data-repair-id="${CSS.escape(selectedServiceTaskId)}"]`);
  row?.scrollIntoView({behavior:"smooth",block:"nearest"})
 })
}
window.selectServiceTask=selectServiceTask;

function moveServiceTask(id,direction){
 const repair=(db.repairs||[]).find(r=>String(r.id)===String(id));if(!repair)return;
 fpNormalizeServiceOrder(repair.carId);
 const rows=(db.repairs||[]).filter(r=>String(r.carId)===String(repair.carId)&&fpServiceRepairIsActive(r))
  .sort((a,b)=>Number(a.serviceOrder||0)-Number(b.serviceOrder||0));
 const index=rows.findIndex(r=>String(r.id)===String(id));
 const next=index+(direction<0?-1:1);
 if(index<0||next<0||next>=rows.length)return;
 const a=rows[index],b=rows[next],tmp=a.serviceOrder;
 a.serviceOrder=b.serviceOrder;b.serviceOrder=tmp;
 selectedServiceTaskId=String(id);
 save();renderRepairs()
}
window.moveServiceTask=moveServiceTask;

let fpDraggedServiceTaskId="";
function serviceDragStart(event,id){
 fpDraggedServiceTaskId=String(id);event.dataTransfer?.setData("text/service-task",String(id));
 if(event.dataTransfer)event.dataTransfer.effectAllowed="move"
}
function serviceDragOver(event){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect="move"}
function serviceTaskDrop(event,targetId){
 event.preventDefault();
 const sourceId=event.dataTransfer?.getData("text/service-task")||fpDraggedServiceTaskId;
 if(!sourceId||String(sourceId)===String(targetId))return;
 const source=(db.repairs||[]).find(r=>String(r.id)===String(sourceId));
 const target=(db.repairs||[]).find(r=>String(r.id)===String(targetId));
 if(!source||!target||String(source.carId)!==String(target.carId))return;
 fpNormalizeServiceOrder(source.carId);
 const rows=(db.repairs||[]).filter(r=>String(r.carId)===String(source.carId)&&fpServiceRepairIsActive(r))
  .sort((a,b)=>Number(a.serviceOrder||0)-Number(b.serviceOrder||0));
 const from=rows.findIndex(r=>String(r.id)===String(sourceId));
 const to=rows.findIndex(r=>String(r.id)===String(targetId));
 if(from<0||to<0)return;
 const [moved]=rows.splice(from,1);rows.splice(to,0,moved);rows.forEach((r,i)=>r.serviceOrder=i);
 selectedServiceTaskId=String(sourceId);save();renderRepairs()
}
window.serviceDragStart=serviceDragStart;window.serviceDragOver=serviceDragOver;window.serviceTaskDrop=serviceTaskDrop;

function serviceFilterMatchesRepair(repair,filter){
 if(filter==="done")return repair.status==="done";
 if(["newrequests","acceptedrequests","expenses"].includes(filter))return false;
 if(filter==="plan")return fpServiceRepairIsActive(repair);
 return fpServiceRepairIsActive(repair)
}

function serviceCarsForCurrentView(){
 const search=String($("#serviceSearch")?.value||"").trim().toLowerCase();
 const statusFilter=$("#serviceStatusFilter")?.value||"all";
 const cityFilter=$("#serviceCityFilter")?.value||"all";
 const priorityFilter=$("#servicePriorityFilter")?.value||"all";
 const mechanicFilter=$("#serviceMechanicFilter")?.value||"all";
 const sort=$("#serviceSort")?.value||"priority";
 const rows=fleetCars().map(c=>{
  const m=model(c);
  const repairs=(db.repairs||[]).filter(r=>String(r.carId)===String(c.id));
  const allReq=activeDriverRepairRequests().filter(r=>String(r.car_id)===String(c.id));
  const requests=statusFilter==="newrequests"?allReq.filter(r=>String(r.status||"new")==="new"):
   statusFilter==="acceptedrequests"?allReq.filter(r=>String(r.status||"")==="accepted"):allReq;
  const plannedExpenses=plannedServiceExpenses(c.id);
  let visibleRepairs=repairs.filter(r=>serviceFilterMatchesRepair(r,statusFilter)).filter(r=>
   (priorityFilter==="all"||serviceRepairPriority(r)===priorityFilter)&&
   (mechanicFilter==="all"||String(r.mechanic||"")===mechanicFilter)
  );
  visibleRepairs.sort((a,b)=>fpServiceOrderValue(a)-fpServiceOrderValue(b)||String(a.date||"").localeCompare(String(b.date||"")));
  const statusMatch=statusFilter==="newrequests"||statusFilter==="acceptedrequests"?requests.length>0:
   statusFilter==="expenses"?plannedExpenses.length>0:
   statusFilter==="done"?visibleRepairs.length>0:
   statusFilter==="plan"?visibleRepairs.length>0:
   (visibleRepairs.length>0||requests.length>0||plannedExpenses.length>0);
  const hay=[m.brand,m.model,c.plate,c.tenant,c.city,
   ...repairs.flatMap(r=>[r.title,r.service,r.mechanic,r.note,servicePriorityText(serviceRepairPriority(r))]),
   ...allReq.flatMap(r=>[r.driver_email,r.description,DRIVER_REPAIR_CATEGORY_LABELS[r.category]||r.category]),
   ...plannedExpenses.flatMap(x=>[x.title,x.note,expenseCategoryText(x.category),x.amount])].join(" ").toLowerCase();
  return{c,m,repairs,requests,plannedExpenses,visibleRepairs,statusMatch,hay,priority:serviceTaskPriority(c.id)+(plannedExpenses.length?10:0)}
 }).filter(row=>row.statusMatch&&(cityFilter==="all"||String(row.c.city||"")===cityFilter)&&(!search||row.hay.includes(search)));
 rows.sort((a,b)=>{
  if(sort==="plate")return String(a.c.plate||"").localeCompare(String(b.c.plate||""),"pl");
  if(sort==="newest"){
   const newest=x=>Math.max(0,...x.repairs.map(r=>new Date((r.date||"1970-01-01")+"T12:00:00").getTime()),...x.requests.map(r=>new Date(r.created_at||0).getTime()));
   return newest(b)-newest(a)
  }
  return b.priority-a.priority||String(a.c.plate||"").localeCompare(String(b.c.plate||""),"pl")
 });
 return rows
}

function renderServiceCrmSummary(){
 const requests=activeDriverRepairRequests();
 const cards=[
  ["Новые",requests.filter(r=>String(r.status||"new")==="new").length,"newrequests","Новые обращения"],
  ["Принято",requests.filter(r=>String(r.status||"")==="accepted").length,"acceptedrequests","Приняты в работу"],
  ["План",activeServiceRepairs().length,"plan","Активные задачи"],
  ["Расходы",plannedServiceExpenses().length,"expenses","Запланированные расходы"]
 ];
 const root=$("#serviceCrmSummary");if(!root)return;
 const current=$("#serviceStatusFilter")?.value||"all";
 root.innerHTML=cards.map(([label,value,filter,note])=>`<button type="button" class="professional-kpi service-kpi-filter ${current===filter?"active":""}" data-service-kpi="${filter}"><span>${label}</span><strong>${value}</strong><small>${note}</small></button>`).join("");
 $$('[data-service-kpi]').forEach(button=>button.onclick=()=>{const select=$("#serviceStatusFilter");if(select)select.value=button.dataset.serviceKpi;renderRepairs()})
}

function renderPlannedServiceExpenses(){
 const root=$("#plannedServiceExpenseList");if(!root)return;
 const search=String($("#serviceSearch")?.value||"").trim().toLowerCase();
 const statusFilter=$("#serviceStatusFilter")?.value||"all";
 const cityFilter=$("#serviceCityFilter")?.value||"all";
 let rows=plannedServiceExpenses();
 if(!["all","expenses"].includes(statusFilter))rows=[];
 rows=rows.filter(x=>{const c=car(x.carId),m=c?model(c):{brand:"",model:""};const hay=`${m.brand} ${m.model} ${c?.plate||""} ${c?.tenant||""} ${c?.city||""} ${x.title||""} ${x.note||""} ${expenseCategoryText(x.category)}`.toLowerCase();return(!search||hay.includes(search))&&(cityFilter==="all"||String(c?.city||"")===cityFilter)});
 const count=$("#plannedServiceExpenseCount");if(count)count.textContent=String(rows.length);
 root.innerHTML=rows.map(x=>{const c=car(x.carId),m=c?model(c):{brand:"Автомобиль",model:""};const linked=x.linkedRepairId?db.repairs.find(r=>String(r.id)===String(x.linkedRepairId)):null;return `<article class="planned-service-expense-row" data-planned-service-expense="${x.id}"><div class="planned-service-expense-icon">${fpUiIcon("repair")||""}</div><div class="planned-service-expense-main"><div class="planned-service-expense-title"><strong>${x.title}</strong><span>${expenseCategoryText(x.category)}</span></div><p>${m.brand} ${m.model} · ${c?.plate||"Без номера"}${c?.tenant?` · ${c.tenant}`:""}</p><small>${date(x.date)}${x.note?` · ${x.note}`:""}${linked?` · ${linked.title}`:""}</small></div><div class="planned-service-expense-value"><strong>${money(x.amount)}</strong><span>План</span></div><button type="button" class="service-row-open-button" onclick="editExpense('${x.id}')" title="Открыть">${fpUiIcon("arrow")}</button></article>`}).join("")||`<div class="professional-empty planned-service-expense-empty">Плановых сервисных расходов нет.</div>`
}

function fpSimpleTaskStatus(r){return r.status==="done"?["Готово","done"]:["Активна","active"]}
function renderServiceCarTasks(row){
 const {c,m,repairs,requests,plannedExpenses,visibleRepairs}=row;
 const collapsed=serviceCollapsedCars.has(String(c.id));
 const filter=$("#serviceStatusFilter")?.value||"all";
 const showRepairs=!['newrequests','acceptedrequests','expenses'].includes(filter);
 const repairsToShow=showRepairs?visibleRepairs:[];
 const expenseTasks=filter==="expenses"?plannedExpenses:(filter==="all"?plannedExpenses:[]);
 const total=repairsToShow.length+requests.length+expenseTasks.length;
 return `<article class="service-car-group" data-service-car="${c.id}"><header class="service-car-group-head"><div class="service-car-avatar">${fpUiIcon("repair")||""}</div><div class="service-car-identity"><div><h4>${m.brand} ${m.model}</h4></div><p>${c.plate||"Без номера"} · ${c.city||"Город не указан"} · ${c.tenant||"Без водителя"}</p></div><div class="service-car-group-meta"><strong>${total}</strong><small>${total===1?"задача":"задач"}</small></div><div class="service-car-group-actions"><button type="button" class="service-car-collapse-button ${collapsed?"collapsed":""}" onclick="toggleServiceCarTasks('${c.id}')" title="${collapsed?"Показать задачи":"Скрыть задачи"}" aria-expanded="${!collapsed}"><span class="service-collapse-chevron" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button><button class="btn" onclick="openCar('${c.id}','service')">Автомобиль</button><button class="btn primary" onclick="openRepairDialog('${c.id}')">+ Задача</button></div></header><div class="service-car-task-list" ${collapsed?"hidden":""}>
 ${requests.map(req=>`<div class="service-task-row request ${String(selectedServiceRequestId)===String(req.id)?"selected":""}" data-service-request-task="${req.id}" onclick="selectServiceRequest('${req.id}')"><span class="service-task-icon">${fpUiIcon("repair")||"!"}</span><div class="service-task-copy"><strong>${DRIVER_REPAIR_CATEGORY_LABELS[req.category]||req.category||"Заявка водителя"}</strong><span>${req.description||"Без описания"}</span><small>${req.driver_email||"Водитель"} · ${km(req.mileage)}</small></div><span class="service-task-status request">${req.status==="accepted"?"Принято":"Новая"}</span><div class="service-task-actions"><button class="btn" onclick="event.stopPropagation();selectServiceRequest('${req.id}')">Открыть</button><button class="btn primary" onclick="event.stopPropagation();openRepairFromFleetRequest('${req.id}')">Передать в сервис</button></div></div>`).join("")}
 ${expenseTasks.map(x=>`<div class="service-task-row planned-expense"><span class="service-task-icon">${fpUiIcon("expense")||""}</span><div class="service-task-copy"><strong>${x.title}</strong><span>${expenseCategoryText(x.category)}${x.note?` · ${x.note}`:""}</span><small>${date(x.date)} · ${money(x.amount)}</small></div><span class="service-task-status planned">Расход</span><div class="service-task-actions"><button class="btn" onclick="editExpense('${x.id}')">Открыть</button></div></div>`).join("")}
 ${repairsToShow.map((r,i)=>{const linkedExpense=serviceLinkedExpense(r),priority=serviceRepairPriority(r),overdue=serviceRepairIsOverdue(r),[simpleLabel,simpleClass]=fpSimpleTaskStatus(r);return `<div class="service-task-row service-sortable-row priority-${priority} ${overdue?"overdue":""} ${String(selectedServiceTaskId)===String(r.id)?"selected":""}" data-repair-id="${r.id}" draggable="true" ondragstart="serviceDragStart(event,'${r.id}')" ondragover="serviceDragOver(event)" ondrop="serviceTaskDrop(event,'${r.id}')" onclick="selectServiceTask('${r.id}')"><span class="service-task-icon">${fpUiIcon("repair")||""}</span><div class="service-task-copy"><div class="service-task-titleline"><strong>${r.title}</strong><span class="service-priority-chip ${priority}">${servicePriorityText(priority)}</span>${overdue?`<span class="service-overdue-chip">Просрочено</span>`:""}</div><span>${r.service||"Сервис не указан"}${r.mechanic?` · ${r.mechanic}`:""}${r.problem?` · ${r.problem}`:r.note?` · ${r.note}`:""}</span><small>${date(r.date)} · ${km(r.mileage)} · ${serviceRepairCostMeta(r)}</small></div><div class="service-task-inline-controls"><select aria-label="Приоритет" onclick="event.stopPropagation()" onchange="updateServiceRepairField('${r.id}','priority',this.value)"><option value="planned" ${priority==="planned"?"selected":""}>Планово</option><option value="today" ${priority==="today"?"selected":""}>Сегодня</option><option value="critical" ${priority==="critical"?"selected":""}>Срочно</option></select><input aria-label="Исполнитель" onclick="event.stopPropagation()" value="${String(r.mechanic||"").replaceAll('"','&quot;')}" placeholder="Исполнитель" onchange="updateServiceRepairField('${r.id}','mechanic',this.value.trim())"></div><span class="service-task-status ${simpleClass}">${simpleLabel}</span><div class="service-task-actions"><button class="service-order-button" onclick="event.stopPropagation();moveServiceTask('${r.id}',-1)" title="Выше" aria-label="Переместить выше">↑</button><button class="service-order-button" onclick="event.stopPropagation();moveServiceTask('${r.id}',1)" title="Ниже" aria-label="Переместить ниже">↓</button>${linkedExpense?`<button class="btn" onclick="event.stopPropagation();openSmartEntity('expense','${linkedExpense.id}','${c.id}')">Расход</button>`:""}<button class="btn primary" onclick="event.stopPropagation();editRepair('${r.id}')">Открыть</button></div></div>`}).join("")}
 </div></article>`
}

// Fix accidental recursion left by previous relation patch.
function syncServiceRelations(repair,previous=null){
 if(!repair)return;
 repair.serviceType=repair.serviceType||inferRepairServiceType(repair);
 syncLinkedExpenseFromRepair(repair);
 // V19.0.28: service/history rows never act as a background MAX() odometer source.
 // Only an explicit completion (or editing the mileage of an already completed job)
 // may publish the staff-entered value to the vehicle.
 const completed=String(repair.status||"")==="done";
 const becameDone=completed&&String(previous?.status||"")!=="done";
 const doneMileageChanged=completed&&previous&&Number(previous.mileage||0)!==Number(repair.mileage||0);
 if(completed&&(becameDone||doneMileageChanged||!previous)){
  const c=car(repair.carId),value=Number(repair.mileage||0);
  if(c&&Number.isFinite(value)&&value>=0){
   c.mileage=value;
   c.mileageUpdatedAt=new Date().toISOString();
   c.mileageSource="service_done";
  }
 }
 applyCompletedServiceToVehicle(repair,previous);
 recalculateVehicleMaintenance(repair.carId);
 syncCarServiceStatus(repair.carId)
}
function selectServiceRequest(id){
 selectedServiceRequestId=String(id||"");renderRepairs();
 requestAnimationFrame(()=>document.querySelector(`[data-service-request-task="${CSS.escape(selectedServiceRequestId)}"]`)?.scrollIntoView({behavior:"smooth",block:"nearest"}))
}
window.selectServiceRequest=selectServiceRequest;

async function renderWorkspaceRepairRequests(){
 const root=$("#workspaceRepairRequestsList");if(!root)return;
 if(!["owner","coordinator","mechanic"].includes(enterpriseCurrentRole())){root.innerHTML="";return}
 root.innerHTML='<div class="driver-empty-state">Загрузка…</div>';
 try{
  workspaceRepairAlerts=await window.FleetPilotCloud.getWorkspaceDriverRepairRequests();
  renderFleetDriverRequestsPanel();
  const pending=activeDriverRepairRequests();
  const activeCounter=$("#serviceActiveRequestCount");if(activeCounter)activeCounter.textContent=String(pending.length);
  renderServiceRequestArchive();
  const rows=selectedWorkspaceRepairCarId?pending.filter(row=>String(row.car_id)===String(selectedWorkspaceRepairCarId)):pending;
  const filterBar=selectedWorkspaceRepairCarId?`<div class="workspace-request-filter"><span>Показаны обращения выбранного автомобиля</span><button type="button" class="btn" onclick="clearWorkspaceRepairCarFilter()">Показать все</button></div>`:"";
  root.innerHTML=filterBar+(rows.map(row=>{
   const localCar=car(row.car_id);const carName=localCar?`${model(localCar).brand} ${model(localCar).model} · ${localCar.plate}`:(row.car_id||"Автомобиль");
   const category=DRIVER_REPAIR_CATEGORY_LABELS[row.category]||row.category||"Неисправность";const state=String(row.status||"new");
   return `<article class="workspace-request-row service-inbox-request urgency-${row.urgency} ${String(selectedServiceRequestId)===String(row.id)?"selected":""}" data-workspace-request-id="${row.id}" data-workspace-request-car="${row.car_id}" onclick="selectServiceRequest('${row.id}')"><div class="service-inbox-request-main"><div class="service-inbox-request-heading"><strong>${category} · ${carName}</strong><span class="service-inbox-request-badge ${state}">${state==="accepted"?"Принято":"Новая"}</span></div><span>${row.description||"Без описания"}</span><small>${row.driver_email||"Водитель"} · ${new Date(row.created_at).toLocaleString("ru-RU")} · ${km(row.mileage)}</small></div><div class="service-inbox-request-actions"><select data-request-status="${row.id}" onclick="event.stopPropagation()"><option value="new" ${state==="new"?"selected":""}>Новая</option><option value="accepted" ${state==="accepted"?"selected":""}>Принято</option><option value="rejected">Отклонена</option></select><button type="button" class="btn" onclick="event.stopPropagation();selectServiceRequest('${row.id}')">Открыть</button><button type="button" class="btn primary" onclick="event.stopPropagation();openRepairFromFleetRequest('${row.id}')">Передать в сервис</button></div></article>`
  }).join("")||'<div class="driver-empty-state service-inbox-empty">Новых заявок нет. Все обращения обработаны.</div>');
  $$('[data-request-status]').forEach(select=>select.onchange=async()=>{const request=workspaceRepairAlerts.find(row=>String(row.id)===String(select.dataset.requestStatus));const next=select.value;try{await window.FleetPilotCloud.updateDriverRepairRequest(select.dataset.requestStatus,next,"");if(request)request.status=next;toast(next==="accepted"?"Заявка принята":next==="rejected"?"Заявка отклонена":"Статус заявки обновлён");await renderWorkspaceRepairRequests();renderRepairs();await loadFleetServiceAlerts({rerender:true})}catch(error){toast(error.message||String(error))}});
  requestAnimationFrame(renderFleetServiceAlertIndicators)
 }catch(error){root.innerHTML=`<div class="driver-empty-state">${error.message||error}</div>`}
}


/* =========================================================
   FleetPilot V13.1 — Service request & task hotfix
   ========================================================= */
let serviceRequestDialogId="";
function fpFindServiceRequest(requestId){
 const id=String(requestId||"");
 return (workspaceRepairAlerts||[]).find(row=>String(row.id)===id)
  || (db.serviceRequests||[]).find(row=>String(row.id)===id)
  || null;
}
function fpServiceRequestCarLabel(request){
 const c=request?car(request.car_id):null;
 return c?`${model(c).brand} ${model(c).model} · ${c.plate||"Без номера"}`:"Автомобиль";
}
function openServiceRequestDetails(requestId){
 const request=fpFindServiceRequest(requestId);
 if(!request)return toast("Заявка не найдена");
 serviceRequestDialogId=String(request.id);
 selectedServiceRequestId=serviceRequestDialogId;
 const dialog=$("#serviceRequestDialog");
 const category=DRIVER_REPAIR_CATEGORY_LABELS[request.category]||request.category||"Неисправность";
 const status=String(request.status||"new");
 const created=request.created_at?new Date(request.created_at).toLocaleString("ru-RU"):"—";
 $("#serviceRequestDialogTitle").textContent=category;
 $("#serviceRequestDialogSubtitle").textContent=`${fpServiceRequestCarLabel(request)} · ${status==="accepted"?"Принято":"Новая"}`;
 $("#serviceRequestDialogBody").innerHTML=`
   <div class="service-request-dialog-field wide"><small>Описание</small><span>${repairSafe(request.description||"Без описания")}</span></div>
   <div class="service-request-dialog-field"><small>Автомобиль</small><strong>${repairSafe(fpServiceRequestCarLabel(request))}</strong></div>
   <div class="service-request-dialog-field"><small>Пробег</small><strong>${km(request.mileage||0)}</strong></div>
   <div class="service-request-dialog-field"><small>Водитель</small><span>${repairSafe(request.driver_email||"—")}</span></div>
   <div class="service-request-dialog-field"><small>Создано</small><span>${repairSafe(created)}</span></div>`;
 const accept=$("#serviceRequestAcceptButton");
 if(accept){accept.hidden=status==="accepted";accept.disabled=false}
 const transfer=$("#serviceRequestTransferButton");if(transfer)transfer.disabled=false;
 dialog?.showModal();
 renderRepairs();
}
window.openServiceRequestDetails=openServiceRequestDetails;

async function acceptServiceRequest(requestId){
 const request=fpFindServiceRequest(requestId);if(!request)return toast("Заявка не найдена");
 try{
  await window.FleetPilotCloud.updateDriverRepairRequest(request.id,"accepted","");
  request.status="accepted";
  const local=(db.serviceRequests||[]).find(x=>String(x.id)===String(request.id));if(local)local.status="accepted";
  save();
  toast("Заявка принята");
  await renderWorkspaceRepairRequests();renderRepairs();
  const accept=$("#serviceRequestAcceptButton");if(accept)accept.hidden=true;
 }catch(error){toast(error.message||"Не удалось принять заявку")}
}
window.acceptServiceRequest=acceptServiceRequest;

function transferServiceRequest(requestId){
 const request=fpFindServiceRequest(requestId);
 if(!request)return toast("Заявка не найдена");
 const c=car(request.car_id);if(!c)return toast("Автомобиль из заявки не найден");
 serviceRequestDialogId=String(request.id);
 try{
  openRepairFromDriverRequest(request);
  $("#serviceRequestDialog")?.close();
  requestAnimationFrame(()=>$("#repairTitle")?.focus());
 }catch(error){
  console.error("Service request transfer failed",error);
  toast("Не удалось открыть сервисную задачу");
 }
}
window.transferServiceRequest=transferServiceRequest;

function createServiceTaskForCar(carId){
 const c=car(carId);if(!c)return toast("Автомобиль не найден");
 openRepairDialog(c.id);
 requestAnimationFrame(()=>$("#repairTitle")?.focus());
}
window.createServiceTaskForCar=createServiceTaskForCar;

// Keep the legacy public action working, but route it through the robust lookup.
function openRepairFromFleetRequest(requestId){transferServiceRequest(requestId)}
window.openRepairFromFleetRequest=openRepairFromFleetRequest;

// Compact service rendering: actions always stay inside the card.
function renderServiceCarTasks(row){
 const {c,m,repairs,requests,plannedExpenses,visibleRepairs}=row;
 const collapsed=serviceCollapsedCars.has(String(c.id));
 const filter=$("#serviceStatusFilter")?.value||"all";
 const showRepairs=!["newrequests","acceptedrequests","expenses"].includes(filter);
 const repairsToShow=showRepairs?visibleRepairs:[];
 const expenseTasks=filter==="expenses"?plannedExpenses:(filter==="all"?plannedExpenses:[]);
 const total=repairsToShow.length+requests.length+expenseTasks.length;
 return `<article class="service-car-group" data-service-car="${c.id}">
  <header class="service-car-group-head">
   <div class="service-car-avatar">${fpUiIcon("repair")||""}</div>
   <div class="service-car-identity"><div><h4>${m.brand} ${m.model}</h4></div><p>${c.plate||"Без номера"} · ${c.city||"Город не указан"} · ${c.tenant||"Без водителя"}</p></div>
   <div class="service-car-group-meta"><strong>${total}</strong><small>${total===1?"задача":"задач"}</small></div>
   <div class="service-car-group-actions">
    <button type="button" class="service-car-collapse-button ${collapsed?"collapsed":""}" onclick="toggleServiceCarTasks('${c.id}')" title="${collapsed?"Показать задачи":"Скрыть задачи"}" aria-expanded="${!collapsed}"><span class="service-collapse-chevron" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>
    <button type="button" class="btn" onclick="openCar('${c.id}','service')">Авто</button>
    <button type="button" class="btn primary" onclick="createServiceTaskForCar('${c.id}')">+ Задача</button>
   </div>
  </header>
  <div class="service-car-task-list" ${collapsed?"hidden":""}>
   ${requests.map(req=>`<div class="service-task-row request ${String(selectedServiceRequestId)===String(req.id)?"selected":""}" data-service-request-task="${req.id}"><span class="service-task-icon">${fpUiIcon("repair")||"!"}</span><div class="service-task-copy"><strong>${DRIVER_REPAIR_CATEGORY_LABELS[req.category]||req.category||"Заявка водителя"}</strong><span>${req.description||"Без описания"}</span><small>${req.driver_email||"Водитель"} · ${km(req.mileage)}</small></div><span class="service-task-status request">${req.status==="accepted"?"Принято":"Новая"}</span><div class="service-task-actions"><button type="button" class="btn" onclick="openServiceRequestDetails('${req.id}')">Открыть</button></div></div>`).join("")}
   ${expenseTasks.map(x=>`<div class="service-task-row planned-expense"><span class="service-task-icon">${fpUiIcon("expense")||""}</span><div class="service-task-copy"><strong>${x.title}</strong><span>${expenseCategoryText(x.category)}${x.note?` · ${x.note}`:""}</span><small>${date(x.date)} · ${money(x.amount)}</small></div><span class="service-task-status planned">Расход</span><div class="service-task-actions"><button type="button" class="btn" onclick="editExpense('${x.id}')">Открыть</button></div></div>`).join("")}
   ${repairsToShow.map(r=>{const linkedExpense=serviceLinkedExpense(r),priority=serviceRepairPriority(r),overdue=serviceRepairIsOverdue(r),[simpleLabel,simpleClass]=fpSimpleTaskStatus(r);return `<div class="service-task-row service-sortable-row priority-${priority} ${overdue?"overdue":""} ${String(selectedServiceTaskId)===String(r.id)?"selected":""}" data-repair-id="${r.id}" draggable="true" ondragstart="serviceDragStart(event,'${r.id}')" ondragover="serviceDragOver(event)" ondrop="serviceTaskDrop(event,'${r.id}')" onclick="selectServiceTask('${r.id}')"><span class="service-task-icon">${fpUiIcon("repair")||""}</span><div class="service-task-copy"><div class="service-task-titleline"><strong>${r.title}</strong><span class="service-priority-chip ${priority}">${servicePriorityText(priority)}</span>${overdue?`<span class="service-overdue-chip">Просрочено</span>`:""}</div><span>${r.service||"Сервис не указан"}${r.mechanic?` · ${r.mechanic}`:""}${r.problem?` · ${r.problem}`:r.note?` · ${r.note}`:""}</span><small>${date(r.date)} · ${km(r.mileage)} · ${serviceRepairCostMeta(r)}</small></div><div class="service-task-inline-controls"><select aria-label="Приоритет" onclick="event.stopPropagation()" onchange="updateServiceRepairField('${r.id}','priority',this.value)"><option value="planned" ${priority==="planned"?"selected":""}>Планово</option><option value="today" ${priority==="today"?"selected":""}>Сегодня</option><option value="critical" ${priority==="critical"?"selected":""}>Срочно</option></select></div><span class="service-task-status ${simpleClass}">${simpleLabel}</span><div class="service-task-actions"><button type="button" class="service-order-button" onclick="event.stopPropagation();moveServiceTask('${r.id}',-1)" title="Выше">↑</button><button type="button" class="service-order-button" onclick="event.stopPropagation();moveServiceTask('${r.id}',1)" title="Ниже">↓</button>${linkedExpense?`<button type="button" class="btn" onclick="event.stopPropagation();openSmartEntity('expense','${linkedExpense.id}','${c.id}')">Расход</button>`:""}<button type="button" class="btn primary" onclick="event.stopPropagation();editRepair('${r.id}')">Открыть</button></div></div>`}).join("")}
  </div>
 </article>`;
}

async function renderWorkspaceRepairRequests(){
 const root=$("#workspaceRepairRequestsList");if(!root)return;
 if(!["owner","coordinator","mechanic"].includes(enterpriseCurrentRole())){root.innerHTML="";return}
 root.innerHTML='<div class="driver-empty-state">Загрузка…</div>';
 try{
  workspaceRepairAlerts=await window.FleetPilotCloud.getWorkspaceDriverRepairRequests();
  renderFleetDriverRequestsPanel();
  const pending=activeDriverRepairRequests();
  const activeCounter=$("#serviceActiveRequestCount");if(activeCounter)activeCounter.textContent=String(pending.length);
  renderServiceRequestArchive();
  const rows=selectedWorkspaceRepairCarId?pending.filter(row=>String(row.car_id)===String(selectedWorkspaceRepairCarId)):pending;
  const filterBar=selectedWorkspaceRepairCarId?`<div class="workspace-request-filter"><span>Показаны обращения выбранного автомобиля</span><button type="button" class="btn" onclick="clearWorkspaceRepairCarFilter()">Показать все</button></div>`:"";
  root.innerHTML=filterBar+(rows.map(row=>{
   const localCar=car(row.car_id);const carName=localCar?`${model(localCar).brand} ${model(localCar).model} · ${localCar.plate}`:(row.car_id||"Автомобиль");
   const category=DRIVER_REPAIR_CATEGORY_LABELS[row.category]||row.category||"Неисправность";const state=String(row.status||"new");
   return `<article class="workspace-request-row service-inbox-request urgency-${row.urgency} ${String(selectedServiceRequestId)===String(row.id)?"selected":""}" data-workspace-request-id="${row.id}" data-workspace-request-car="${row.car_id}"><div class="service-inbox-request-main"><div class="service-inbox-request-heading"><strong>${category} · ${carName}</strong><span class="service-inbox-request-badge ${state}">${state==="accepted"?"Принято":"Новая"}</span></div><span>${row.description||"Без описания"}</span><small>${row.driver_email||"Водитель"} · ${new Date(row.created_at).toLocaleString("ru-RU")} · ${km(row.mileage)}</small></div><div class="service-inbox-request-actions"><select data-request-status="${row.id}"><option value="new" ${state==="new"?"selected":""}>Новая</option><option value="accepted" ${state==="accepted"?"selected":""}>Принято</option><option value="rejected">Отклонена</option></select><button type="button" class="btn" onclick="openServiceRequestDetails('${row.id}')">Открыть</button></div></article>`;
  }).join("")||'<div class="driver-empty-state service-inbox-empty">Новых заявок нет. Все обращения обработаны.</div>');
  $$('[data-request-status]').forEach(select=>select.onchange=async()=>{const request=fpFindServiceRequest(select.dataset.requestStatus);const next=select.value;try{await window.FleetPilotCloud.updateDriverRepairRequest(select.dataset.requestStatus,next,"");if(request)request.status=next;const local=(db.serviceRequests||[]).find(x=>String(x.id)===String(select.dataset.requestStatus));if(local)local.status=next;save();toast(next==="accepted"?"Заявка принята":next==="rejected"?"Заявка отклонена":"Статус заявки обновлён");await renderWorkspaceRepairRequests();renderRepairs();await loadFleetServiceAlerts({rerender:true})}catch(error){toast(error.message||String(error))}});
  requestAnimationFrame(renderFleetServiceAlertIndicators);
 }catch(error){root.innerHTML=`<div class="driver-empty-state">${error.message||error}</div>`}
}

// Dialog actions
$("#closeServiceRequestDialog")?.addEventListener("click",()=>$("#serviceRequestDialog")?.close());
$("#serviceRequestAcceptButton")?.addEventListener("click",()=>{if(serviceRequestDialogId)acceptServiceRequest(serviceRequestDialogId)});
$("#serviceRequestTransferButton")?.addEventListener("click",()=>{if(serviceRequestDialogId)transferServiceRequest(serviceRequestDialogId)});

// Override old +Task button with a guarded action.
$("#addRepair")?.addEventListener("click",event=>{event.preventDefault();event.stopImmediatePropagation();const first=fleetCars()[0];if(!first)return toast("Сначала добавьте автомобиль");createServiceTaskForCar(first.id)},true);


// FleetPilot V14.0 — service search retained + Vehicle Core
const SERVICE_INCOMING_COLLAPSED_KEY="fleetpilot.service.incoming.collapsed.v1";
const SERVICE_PLANNING_COLLAPSED_KEY="fleetpilot.service.planning.collapsed.v1";
function serviceIncomingPanelCollapsed(){try{return localStorage.getItem(SERVICE_INCOMING_COLLAPSED_KEY)==="1"}catch{return false}}
function setServiceIncomingCollapsed(collapsed){
 const body=$("#serviceIncomingBody"),button=$("#toggleServiceIncoming");
 if(body)body.hidden=!!collapsed;
 if(button){button.setAttribute("aria-expanded",String(!collapsed));button.textContent=collapsed?"Показать входящие":"Скрыть входящие"}
 try{localStorage.setItem(SERVICE_INCOMING_COLLAPSED_KEY,collapsed?"1":"0")}catch{}
}
function toggleServiceIncoming(){setServiceIncomingCollapsed(!$("#serviceIncomingBody")||!$("#serviceIncomingBody").hidden?true:false)}
window.toggleServiceIncoming=toggleServiceIncoming;
function normalizedIncomingSearch(value){return String(value||"").trim().toLocaleLowerCase("ru-RU")}
function incomingRequestMatches(row,query){
 if(!query)return true;
 const localCar=car(row.car_id);
 const m=localCar?model(localCar):null;
 const category=DRIVER_REPAIR_CATEGORY_LABELS[row.category]||row.category||"";
 const haystack=[
  category,row.description,row.driver_email,row.driver_name,row.driver_phone,row.status,row.urgency,row.car_id,
  localCar?.plate,localCar?.city,localCar?.tenant,m?.brand,m?.model
 ].map(v=>String(v||"")).join(" ").toLocaleLowerCase("ru-RU");
 return query.split(/\s+/).filter(Boolean).every(token=>haystack.includes(token));
}

async function renderWorkspaceRepairRequests(){
 const root=$("#workspaceRepairRequestsList");if(!root)return;
 if(!["owner","coordinator","mechanic"].includes(enterpriseCurrentRole())){root.innerHTML="";return}
 root.innerHTML='<div class="driver-empty-state">Загрузка…</div>';
 try{
  workspaceRepairAlerts=await window.FleetPilotCloud.getWorkspaceDriverRepairRequests();
  renderFleetDriverRequestsPanel();
  const pending=activeDriverRepairRequests();
  const activeCounter=$("#serviceActiveRequestCount");if(activeCounter)activeCounter.textContent=String(pending.length);
  renderServiceRequestArchive();
  let rows=selectedWorkspaceRepairCarId?pending.filter(row=>String(row.car_id)===String(selectedWorkspaceRepairCarId)):pending;
  const query=normalizedIncomingSearch($("#serviceSearch")?.value);
  rows=rows.filter(row=>incomingRequestMatches(row,query));
  const filterBar=selectedWorkspaceRepairCarId?`<div class="workspace-request-filter"><span>Показаны обращения выбранного автомобиля</span><button type="button" class="btn" onclick="clearWorkspaceRepairCarFilter()">Показать все</button></div>`:"";
  root.innerHTML=filterBar+(rows.map(row=>{
   const localCar=car(row.car_id);const carName=localCar?`${model(localCar).brand} ${model(localCar).model} · ${localCar.plate}`:(row.car_id||"Автомобиль");
   const category=DRIVER_REPAIR_CATEGORY_LABELS[row.category]||row.category||"Неисправность";const state=String(row.status||"new");
   return `<article class="workspace-request-row service-inbox-request urgency-${row.urgency} ${String(selectedServiceRequestId)===String(row.id)?"selected":""}" data-workspace-request-id="${row.id}" data-workspace-request-car="${row.car_id}"><div class="service-inbox-request-main"><div class="service-inbox-request-heading"><strong>${category} · ${carName}</strong></div><span>${row.description||"Без описания"}</span><small>${row.driver_email||"Водитель"} · ${new Date(row.created_at).toLocaleString("ru-RU")} · ${km(row.mileage)}</small></div><div class="service-inbox-request-actions"><select data-request-status="${row.id}" aria-label="Статус заявки"><option value="new" ${state==="new"?"selected":""}>Новая</option><option value="accepted" ${state==="accepted"?"selected":""}>Принято</option><option value="rejected">Отклонена</option></select><button type="button" class="btn" onclick="openServiceRequestDetails('${row.id}')">Открыть</button></div></article>`;
  }).join("")||`<div class="driver-empty-state service-inbox-empty">${query?"По этому запросу заявок не найдено.":"Новых заявок нет. Все обращения обработаны."}</div>`);
  $$('[data-request-status]').forEach(select=>select.onchange=async()=>{const request=fpFindServiceRequest(select.dataset.requestStatus);const next=select.value;try{await window.FleetPilotCloud.updateDriverRepairRequest(select.dataset.requestStatus,next,"");if(request)request.status=next;const local=(db.serviceRequests||[]).find(x=>String(x.id)===String(select.dataset.requestStatus));if(local)local.status=next;save();toast(next==="accepted"?"Заявка принята":next==="rejected"?"Заявка отклонена":"Статус заявки обновлён");await renderWorkspaceRepairRequests();renderRepairs();await loadFleetServiceAlerts({rerender:true})}catch(error){toast(error.message||String(error))}});
  requestAnimationFrame(renderFleetServiceAlertIndicators);
 }catch(error){root.innerHTML=`<div class="driver-empty-state">${error.message||error}</div>`}
}

function servicePlanningPanelCollapsed(){try{return localStorage.getItem(SERVICE_PLANNING_COLLAPSED_KEY)==="1"}catch{return false}}
function setServicePlanningCollapsed(collapsed){
 const body=$("#servicePlanningBody"),button=$("#toggleServicePlanning");
 if(body)body.hidden=!!collapsed;
 if(button){button.setAttribute("aria-expanded",String(!collapsed));button.textContent=collapsed?"Показать планирование":"Скрыть планирование"}
 try{localStorage.setItem(SERVICE_PLANNING_COLLAPSED_KEY,collapsed?"1":"0")}catch{}
}
window.toggleServicePlanning=()=>setServicePlanningCollapsed(!$("#servicePlanningBody")?.hidden);

(function initServiceSectionControls(){
 const bind=()=>{
  const incomingToggle=$("#toggleServiceIncoming");
  const planningToggle=$("#toggleServicePlanning");
  if(incomingToggle&&!incomingToggle.dataset.bound){incomingToggle.dataset.bound="1";incomingToggle.addEventListener("click",()=>setServiceIncomingCollapsed(!$("#serviceIncomingBody")?.hidden));}
  if(planningToggle&&!planningToggle.dataset.bound){planningToggle.dataset.bound="1";planningToggle.addEventListener("click",()=>setServicePlanningCollapsed(!$("#servicePlanningBody")?.hidden));}
  setServiceIncomingCollapsed(serviceIncomingPanelCollapsed());
  setServicePlanningCollapsed(servicePlanningPanelCollapsed());
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();

// FleetPilot V14.1.3 — detailed analytics calculation dialog
(function initTaxBreakdownDialog(){
 const bind=()=>{
  $("#openTaxBreakdown")?.addEventListener("click",openTaxBreakdown);
  $("#closeTaxBreakdown")?.addEventListener("click",()=>$("#taxBreakdownDialog")?.close());
  $("#printTaxBreakdown")?.addEventListener("click",printTaxBreakdown);
  $("#taxBreakdownDialog")?.addEventListener("click",event=>{if(event.target===$("#taxBreakdownDialog"))$("#taxBreakdownDialog").close()})
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind()
})();


// FleetPilot V14.2.1 — smart calendar
(function initExpenseDrilldownDialog(){
 const bind=()=>{
  $("#closeExpenseDrilldown")?.addEventListener("click",()=>$("#expenseDrilldownDialog")?.close());
  $("#exportExpenseDrilldownCsv")?.addEventListener("click",expenseDrilldownCsv);
  $("#printExpenseDrilldown")?.addEventListener("click",printExpenseDrilldown);
  $("#expenseDrilldownDialog")?.addEventListener("click",event=>{if(event.target===$("#expenseDrilldownDialog"))$("#expenseDrilldownDialog").close()})
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind()
})();


// FleetPilot V14.2.1 — professional documents register
function fpDocumentDaysLeft(expiry){
 if(!expiry)return null;
 const end=new Date(String(expiry)+"T12:00:00"),now=new Date(today()+"T12:00:00");
 if(Number.isNaN(end.getTime()))return null;
 return Math.ceil((end-now)/86400000)
}
function fpDocumentState(row){
 const days=fpDocumentDaysLeft(row?.expiry);
 if(days===null)return{key:"nodate",label:"Без срока",detail:"Срок действия не указан"};
 if(days<0)return{key:"expired",label:"Просрочен",detail:`Просрочено ${Math.abs(days)} дн.`};
 if(days<=30)return{key:"soon",label:"Скоро истекает",detail:days===0?"Истекает сегодня":`Осталось ${days} дн.`};
 return{key:"valid",label:"Действует",detail:`Осталось ${days} дн.`}
}
function fpDocumentIcon(type){return{insurance:"🛡",inspection:"✓",registration:"▣",technical_passport:"▣",leasing:"¤",credit:"¤",rental_contract:"▤",warranty:"✓",invoice:"▤",authorization:"▤",other:"▤"}[type]||"▤"}
function fpDocumentCarLabel(row){
 const c=car(row?.carId);if(!c)return "Без автомобиля";
 const m=model(c);return `${m?.brand||""} ${m?.model||""} · ${c.plate||"—"}`.trim()
}
function fpPopulateDocumentCarFilter(){
 const select=$("#documentCarFilter");if(!select)return;
 const current=select.value||"all";
 const rows=[...fleetCars()].sort((a,b)=>(a.plate||"").localeCompare(b.plate||"","ru"));
 select.innerHTML='<option value="all">Все автомобили</option>'+rows.map(c=>`<option value="${c.id}">${model(c).brand} ${model(c).model} · ${c.plate}</option>`).join("");
 select.value=[...select.options].some(o=>o.value===current)?current:"all"
}
function renderDocuments(){
 renderDocumentArchive?.();
 const summary=$("#documentSummary"),root=$("#documentList");if(!summary||!root)return;
 fpPopulateDocumentCarFilter();
 const all=[...(db.documents||[])];
 const states=all.map(row=>fpDocumentState(row));
 const expired=states.filter(x=>x.key==="expired").length,soon=states.filter(x=>x.key==="soon").length,valid=states.filter(x=>x.key==="valid").length;
 const unpaidInstallments=all.flatMap(d=>(d.installments||[]).filter(x=>!x.paid)).length;
 summary.innerHTML=[
  ["Всего документов",all.length,"Все записи"],
  ["Действуют",valid,"Срок более 30 дней"],
  ["Скоро истекают",soon,"В течение 30 дней"],
  ["Просрочены",expired,"Требуют внимания"],
  ["Ожидают оплаты",unpaidInstallments,"Страховые раты"]
 ].map(([label,value,note])=>`<article class="professional-kpi"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join("");
 const query=String($("#documentSearch")?.value||"").trim().toLocaleLowerCase("ru-RU"),type=$("#documentTypeFilter")?.value||"all",status=$("#documentStatusFilter")?.value||"all",carFilter=$("#documentCarFilter")?.value||"all";
 let rows=all.filter(row=>{
  const st=fpDocumentState(row),carLabel=fpDocumentCarLabel(row),hay=[row.title,row.number,row.note,row.file,documentTypeText(row.type),carLabel].join(" ").toLocaleLowerCase("ru-RU");
  return(!query||query.split(/\s+/).filter(Boolean).every(token=>hay.includes(token)))&&(type==="all"||row.type===type)&&(status==="all"||st.key===status)&&(carFilter==="all"||String(row.carId)===String(carFilter))
 }).sort((a,b)=>{
  const order={expired:0,soon:1,valid:2,nodate:3};const sa=fpDocumentState(a),sb=fpDocumentState(b);return(order[sa.key]-order[sb.key])||String(a.expiry||"9999").localeCompare(String(b.expiry||"9999"))
 });
 const count=$("#documentVisibleCount");if(count)count.textContent=String(rows.length);
 const hint=$("#documentRegisterHint");if(hint)hint.textContent=`Показано ${rows.length} из ${all.length} · сначала документы, требующие внимания.`;
 root.innerHTML=rows.map(row=>{
  const st=fpDocumentState(row),install=row.type==="insurance"&&row.paymentMode==="installments"?installmentSummary(row):null;
  const paidPct=install&&Number(row.cost||0)>0?Math.min(100,Math.round(install.paid/Number(row.cost||0)*100)):0;
  return `<article class="document-register-row document-register-clickable" data-document-id="${row.id}" role="button" tabindex="0" aria-label="Открыть документ" onclick="openDocumentDialog('', '${row.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDocumentDialog('', '${row.id}')}">
   <div class="document-register-main"><div class="document-register-icon">${fpDocumentIcon(row.type)}</div><div><strong>${row.title||documentTypeText(row.type)||"Документ"}</strong><small>${documentTypeText(row.type)} · ${fpDocumentCarLabel(row)}</small>${install?`<div class="document-installment-progress"><i><b style="width:${paidPct}%"></b></i><em>${money(install.paid)} / ${money(row.cost||0)}</em></div>`:""}</div></div>
   <div class="document-register-cell document-number-cell"><span>Номер</span><strong>${row.number||"—"}</strong><small>${row.fileId?"Есть вложение":"Без вложения"}</small></div>
   <div class="document-register-cell"><span>Срок</span><strong>${row.expiry?date(row.expiry):"Не указан"}</strong><small>${st.detail}</small></div>
   <div class="document-register-cell"><span>Статус</span><span class="document-status-badge ${st.key}"><i class="document-status-dot"></i>${st.label}</span>${Number(row.cost||0)?`<small>Стоимость ${money(row.cost)}</small>`:""}</div>
   <div class="document-register-file-slot ${row.fileId?"has-file":"no-file"}" title="${row.fileId?"К документу прикреплён файл":"Файл не прикреплён"}" aria-label="${row.fileId?"Есть прикреплённый файл":"Нет прикреплённого файла"}"><span aria-hidden="true">▣</span></div>
   <div class="document-register-actions"><button type="button" class="document-delete-icon" title="Удалить документ" aria-label="Удалить документ" onclick="event.stopPropagation();deleteDocument('${row.id}')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/></svg></button></div>
  </article>`
 }).join("")||'<div class="document-empty-professional">По выбранным фильтрам документов нет.</div>';
 ["documentSearch","documentTypeFilter","documentStatusFilter","documentCarFilter"].forEach(id=>{const el=$("#"+id);if(el&&!el.dataset.documentsBound){el.dataset.documentsBound="1";el.addEventListener(id==="documentSearch"?"input":"change",renderDocuments)}})
}
window.renderDocuments=renderDocuments;

function renderDocumentArchive(){
 const root=$("#documentArchiveList"),count=$("#documentArchiveCount");if(!root)return;
 const rows=[...(Array.isArray(db?.deletedDocumentsArchive)?db.deletedDocumentsArchive:[])].sort((a,b)=>String(b.deletedAt||"").localeCompare(String(a.deletedAt||"")));
 if(count)count.textContent=String(rows.length);
 root.innerHTML=rows.map(row=>`<article class="document-register-row document-archive-row"><div class="document-register-main"><div class="document-register-icon">🗑</div><div><strong>${row.title||documentTypeText(row.type)||"Документ"}</strong><small>${documentTypeText(row.type)} · ${fpDocumentCarLabel(row)}</small></div></div><div class="document-register-cell"><span>Удалён</span><strong>${row.deletedAt?new Date(row.deletedAt).toLocaleString("ru-RU"):"—"}</strong><small>${row.deletedBy||"Администратор"}</small></div><div class="document-register-cell"><span>Статус</span><span class="document-status-badge expired">Удалён</span><small>Не используется системой</small></div><div class="document-register-actions"><button type="button" class="btn" onclick="restoreArchivedDocument('${row.id}')">Восстановить</button><button type="button" class="btn danger" onclick="deleteArchivedDocumentForever('${row.id}')">Удалить навсегда</button></div></article>`).join("")||'<div class="document-empty-professional">Архив документов пуст.</div>';
}
function restoreArchivedDocument(id){if(!requireEnterprisePermission("documents.delete"))return;const archive=Array.isArray(db.deletedDocumentsArchive)?db.deletedDocumentsArchive:[],row=archive.find(x=>String(x.id)===String(id));if(!row)return;const restored=structuredClone(row);delete restored.deletedAt;delete restored.deletedBy;db.documents.push(restored);db.deletedDocumentsArchive=archive.filter(x=>String(x.id)!==String(id));syncVehicleDocumentDates?.(restored,null);for(const item of restored.installments||[])if(item.paid)syncInsuranceExpense?.(restored,item);save();renderDocuments();renderExpenses?.();renderFleet?.();toast("Документ восстановлен")}
async function deleteArchivedDocumentForever(id){if(!requireEnterprisePermission("documents.delete"))return;if(!confirm("Удалить документ и файл НАВСЕГДА? Отменить это действие нельзя."))return;const archive=Array.isArray(db.deletedDocumentsArchive)?db.deletedDocumentsArchive:[],row=archive.find(x=>String(x.id)===String(id));if(row?.fileId)try{await deleteDocumentFile(row.fileId)}catch(e){console.warn(e)}db.deletedDocumentsArchive=archive.filter(x=>String(x.id)!==String(id));save();renderDocumentArchive();toast("Документ удалён навсегда")}
window.renderDocumentArchive=renderDocumentArchive;window.restoreArchivedDocument=restoreArchivedDocument;window.deleteArchivedDocumentForever=deleteArchivedDocumentForever;

