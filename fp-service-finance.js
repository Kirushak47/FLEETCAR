/* =========================================================
   FleetPilot V15.6 — Service & Finance
   Service work queue, repairs, planned service expenses, payments, expenses and profitability.
   Source order: original app.js lines 5385-6031
   ========================================================= */
const SERVICE_EXPENSE_CATEGORIES=new Set(["repair","tires","inspection"]);

function plannedServiceExpenses(carId=null){
 return (db.expenses||[])
  .filter(x=>{
   const linkedRepair=x.linkedRepairId
    ?(db.repairs||[]).find(r=>String(r.id)===String(x.linkedRepairId))
    :null;

   // Once a planned service expense/request has been converted into a real
   // service task, the repair becomes the operational record. Keep the
   // expense in Finance, but do not show the same work twice in Service.
   if(linkedRepair)return false;

   return x.status==="planned"&&
    SERVICE_EXPENSE_CATEGORIES.has(String(x.category||""))&&
    (!carId||String(x.carId)===String(carId));
  })
  .sort((a,b)=>String(a.date||"9999-12-31").localeCompare(String(b.date||"9999-12-31")))
}

function renderPlannedServiceExpenses(){
 const root=$("#plannedServiceExpenseList");
 if(!root)return;

 const search=String($("#serviceSearch")?.value||"").trim().toLowerCase();
 const statusFilter=$("#serviceStatusFilter")?.value||"all";
 const cityFilter=$("#serviceCityFilter")?.value||"all";

 let rows=plannedServiceExpenses();
 if(statusFilter!=="all"&&statusFilter!=="planned")rows=[];
 rows=rows.filter(x=>{
  const c=car(x.carId),m=c?model(c):{brand:"",model:""};
  const hay=`${m.brand} ${m.model} ${c?.plate||""} ${c?.tenant||""} ${c?.city||""} ${x.title||""} ${x.note||""} ${expenseCategoryText(x.category)}`.toLowerCase();
  return (!search||hay.includes(search))&&(cityFilter==="all"||String(c?.city||"")===cityFilter)
 });

 const count=$("#plannedServiceExpenseCount");
 if(count)count.textContent=String(rows.length);

 root.innerHTML=rows.map(x=>{
  const c=car(x.carId),m=c?model(c):{brand:"Автомобиль",model:""};
  const linked=x.linkedRepairId?db.repairs.find(r=>String(r.id)===String(x.linkedRepairId)):null;
  return `<article class="planned-service-expense-row" data-planned-service-expense="${x.id}">
   <div class="planned-service-expense-icon">${x.category==="tires"?"◉":x.category==="inspection"?"▤":"🔧"}</div>
   <div class="planned-service-expense-main">
    <div class="planned-service-expense-title">
     <strong>${x.title}</strong>
     <span>${expenseCategoryText(x.category)}</span>
    </div>
    <p>${m.brand} ${m.model} · ${c?.plate||"Без номера"}${c?.tenant?` · ${c.tenant}`:""}</p>
    <small>${date(x.date)}${x.note?` · ${x.note}`:""}${linked?` · Связано с ремонтом: ${linked.title}`:""}</small>
   </div>
   <div class="planned-service-expense-value">
    <strong>${money(x.amount)}</strong>
    <span>Запланировано</span>
   </div>
   <button type="button" class="service-row-open-button" onclick="editExpense('${x.id}')" title="Открыть расход">${fpUiIcon("arrow")}</button>
  </article>`
 }).join("")||`<div class="professional-empty planned-service-expense-empty">Плановых сервисных расходов нет.</div>`
}

function renderServiceCrmSummary(){
 const active=activeServiceRepairs();
 const activeCars=new Set(active.map(r=>String(r.carId)));
 const driverRequests=activeDriverRepairRequests();
 const cards=[
  ["В сервисе",activeCars.size,"all","Автомобилей с активными задачами"],
  ["В ремонте",new Set(active.filter(r=>r.status==="repair").map(r=>r.carId)).size,"repair","Работы выполняются"],
  ["Ждут сервис",new Set(active.filter(r=>r.status==="service").map(r=>r.carId)).size,"service","Есть запись в сервис"],
  ["Ждут детали",new Set(active.filter(r=>r.status==="parts").map(r=>r.carId)).size,"parts","Ожидание запчастей"],
  ["Плановые расходы",plannedServiceExpenses().length,"planned","Из раздела «Расходы»"],
  ["Новые заявки",driverRequests.length,"requests","Требуют решения"],
  ["Готово",db.repairs.filter(r=>r.status==="done").length,"done","История завершённых"]
 ];
 const root=$("#serviceCrmSummary");if(!root)return;
 root.innerHTML=cards.map(([label,value,filter,note])=>`
  <button type="button" class="professional-kpi service-kpi-filter ${($("#serviceStatusFilter")?.value||"all")===filter?"active":""}" data-service-kpi="${filter}">
   <span>${label}</span><strong>${value}</strong><small>${note}</small>
  </button>`).join("");
 $$("[data-service-kpi]").forEach(button=>button.onclick=()=>{
  const select=$("#serviceStatusFilter");if(select)select.value=button.dataset.serviceKpi;
  renderRepairs()
 })
}

const SERVICE_COLLAPSED_CARS_KEY="fleetpilot.service.collapsed.v1";
let serviceCollapsedCars=(()=>{
 try{return new Set(JSON.parse(localStorage.getItem(SERVICE_COLLAPSED_CARS_KEY)||"[]").map(String))}
 catch{return new Set()}
})();

function toggleServiceCarTasks(carId){
 const id=String(carId);
 if(serviceCollapsedCars.has(id))serviceCollapsedCars.delete(id);
 else serviceCollapsedCars.add(id);
 try{localStorage.setItem(SERVICE_COLLAPSED_CARS_KEY,JSON.stringify([...serviceCollapsedCars]))}catch{}
 renderRepairs()
}
window.toggleServiceCarTasks=toggleServiceCarTasks;

function serviceNextStatus(status){
 return {planned:"service",service:"repair",parts:"repair",repair:"done"}[status]||""
}
function serviceNextStatusLabel(status){
 return {planned:"Записать в сервис",service:"Начать ремонт",parts:"Детали получены",repair:"Завершить"}[status]||""
}
function serviceRepairCostMeta(repair){
 const planned=Number(repair.planned||0),actual=Number(repair.actual||0);
 if(repair.status==="done")return actual?`Факт ${money(actual)}`:`План ${money(planned)}`;
 return planned?`План ${money(planned)}`:"Стоимость не указана"
}
function serviceLinkedExpense(repair){
 return repair?.linkedExpenseId?db.expenses.find(x=>String(x.id)===String(repair.linkedExpenseId)):db.expenses.find(x=>String(x.linkedRepairId)===String(repair?.id||""))
}
function syncCarServiceStatus(carId){
 const c=car(carId);if(!c)return;
 const active=(db.repairs||[]).filter(r=>String(r.carId)===String(carId)&&!["done","cancelled"].includes(String(r.status||"")));
 c.status=active.some(r=>["repair","parts","service"].includes(r.status))?"repair":(c.tenant?"active":"free")
}
function advanceServiceRepair(id){
 const repair=db.repairs.find(r=>String(r.id)===String(id));if(!repair)return toast("Задача не найдена");
 const previous=structuredClone(repair);
 const next=serviceNextStatus(repair.status);if(!next)return editRepair(repair.id);
 if(next==="done"&&Number(repair.actual||0)<=0&&repair.paymentStatus!=="warranty"){
  editRepair(repair.id);
  setTimeout(()=>toast("Для завершения укажите фактическую сумму или гарантию"),80);
  return
 }
 repair.status=next;
 if(next==="done")repair.completedDate=repair.completedDate||today();
 syncServiceRelations(repair,previous);
 addTimeline(repair.carId,"repair",repair.title,-Number(repair.actual||repair.planned||0),today(),repairStatusText(next));
 logActivity("Изменён статус ремонта","Сервис",`${repair.title} → ${repairStatusText(next)}`,repair.carId);
 save();renderRepairs();renderExpenses();renderFleet();
 if(selectedCarId===repair.carId&&$("#carPage")?.classList.contains("active"))renderCarProfile(repair.carId,"service");
 toast(repairStatusText(next))
}
window.advanceServiceRepair=advanceServiceRepair;

function renderServiceCarTasks(row){
 const {c,m,repairs,requests,plannedExpenses,visibleRepairs}=row;
 const collapsed=serviceCollapsedCars.has(String(c.id));
 const filter=$("#serviceStatusFilter")?.value||"all";
 const repairsToShow=filter==="requests"?[]:visibleRepairs;
 const expenseTasks=(filter==="done"||filter==="requests")?[]:plannedExpenses;
 const total=(filter==="done"?repairsToShow.length:repairsToShow.length+requests.length+expenseTasks.length);
 const activeState=repairs.find(r=>r.status==="repair")?"repair":
  repairs.find(r=>r.status==="service")?"service":
  repairs.find(r=>r.status==="parts")?"parts":
  requests.length?"request":"planned";

 return `<article class="service-car-group status-${activeState}" data-service-car="${c.id}">
  <header class="service-car-group-head">
   <div class="service-car-avatar">🚘</div>
   <div class="service-car-identity">
    <div><h4>${m.brand} ${m.model}</h4><span class="service-car-state ${activeState}">${activeState==="repair"?"В ремонте":activeState==="service"?"Записан в сервис":activeState==="parts"?"Ждёт детали":activeState==="request"?"Есть новая заявка":"Запланировано"}</span></div>
    <p>${c.plate||"Без номера"} · ${c.city||"Город не указан"} · ${c.tenant||"Без водителя"}</p>
   </div>
   <div class="service-car-group-meta">
    <strong>${total}</strong><small>${total===1?"задача":"задач"}</small>
   </div>
   <div class="service-car-group-actions">
    <button type="button" class="service-car-collapse-button ${collapsed?"collapsed":""}" onclick="toggleServiceCarTasks('${c.id}')" title="${collapsed?"Показать задачи":"Скрыть задачи"}" aria-expanded="${!collapsed}">
     <span class="service-collapse-chevron" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    </button>
    <button class="btn" onclick="openCar('${c.id}','service')">Автомобиль</button>
    <button class="btn primary" onclick="openRepairDialog('${c.id}')">+ Задача</button>
   </div>
  </header>
  <div class="service-car-task-list" ${collapsed?"hidden":""}>
   ${requests.map(req=>`<div class="service-task-row request" data-service-request-task="${req.id}">
     <span class="service-task-icon">!</span>
     <div class="service-task-copy"><strong>${DRIVER_REPAIR_CATEGORY_LABELS[req.category]||req.category||"Заявка водителя"}</strong><span>${req.description||"Без описания"}</span><small>${req.driver_email||"Водитель"} · ${km(req.mileage)}</small></div>
     <span class="service-task-status request">${req.status==="accepted"?"Принята":"Новая"}</span>
     <button class="btn" onclick="openRepairFromFleetRequest('${req.id}')">Открыть</button>
    </div>`).join("")}
   ${expenseTasks.map(x=>`<div class="service-task-row planned-expense" data-service-expense-task="${x.id}">
     <span class="service-task-icon">${x.category==="tires"?"◉":x.category==="inspection"?"▤":"₽"}</span>
     <div class="service-task-copy"><strong>${x.title}</strong><span>${expenseCategoryText(x.category)}${x.note?` · ${x.note}`:""}</span><small>${date(x.date)} · план ${money(x.amount)}</small></div>
     <span class="service-task-status planned">План. расход</span>
     <button class="btn" onclick="editExpense('${x.id}')">Открыть</button>
    </div>`).join("")}
   ${repairsToShow.map(r=>{const linkedExpense=serviceLinkedExpense(r),nextLabel=serviceNextStatusLabel(r.status),priority=serviceRepairPriority(r),overdue=serviceRepairIsOverdue(r);return `<div class="service-task-row ${serviceStatusClass(r.status)} priority-${priority} ${overdue?"overdue":""}" data-repair-id="${r.id}" draggable="true" ondragstart="serviceDragStart(event,'${r.id}')">
     <span class="service-task-icon">🔧</span>
     <div class="service-task-copy"><div class="service-task-titleline"><strong>${r.title}</strong><span class="service-priority-chip ${priority}">${servicePriorityText(priority)}</span>${overdue?`<span class="service-overdue-chip">Просрочено</span>`:""}</div><span>${r.service||"Сервис не указан"}${r.mechanic?` · ${r.mechanic}`:""}${r.problem?` · ${r.problem}`:r.note?` · ${r.note}`:""}</span><small>${date(r.date)} · ${km(r.mileage)} · ${serviceRepairCostMeta(r)}${Array.isArray(r.parts)&&r.parts.length?` · запчастей ${r.parts.length}`:""}${Array.isArray(r.checklist)&&r.checklist.length?` · чек-лист ${r.checklist.filter(x=>x.done).length}/${r.checklist.length}`:""}${linkedExpense?` · расход ${expenseStatusText(linkedExpense.status)}`:""}</small></div>
     <div class="service-task-inline-controls"><select aria-label="Приоритет" onchange="updateServiceRepairField('${r.id}','priority',this.value)"><option value="planned" ${priority==="planned"?"selected":""}>Планово</option><option value="today" ${priority==="today"?"selected":""}>Сегодня</option><option value="critical" ${priority==="critical"?"selected":""}>Срочно</option></select><input aria-label="Исполнитель" value="${String(r.mechanic||"").replaceAll('"','&quot;')}" placeholder="Исполнитель" onchange="updateServiceRepairField('${r.id}','mechanic',this.value.trim())"></div>
     <span class="service-task-status ${serviceStatusClass(r.status)}">${repairStatusText(r.status)}</span>
     <div class="service-task-actions">${linkedExpense?`<button class="btn" onclick="openSmartEntity('expense','${linkedExpense.id}','${c.id}')">Расход</button>`:""}${nextLabel?`<button class="btn primary" onclick="advanceServiceRepair('${r.id}')">${nextLabel}</button>`:""}<button class="btn" onclick="editRepair('${r.id}')">Подробнее</button></div>
    </div>`}).join("")}
  </div>
  <div class="service-drop-zones" aria-label="Быстро изменить статус">
   <button type="button" ondragover="serviceDragOver(event)" ondrop="serviceDrop(event,'planned')">План</button>
   <button type="button" ondragover="serviceDragOver(event)" ondrop="serviceDrop(event,'parts')">Запчасти</button>
   <button type="button" ondragover="serviceDragOver(event)" ondrop="serviceDrop(event,'service')">Запись</button>
   <button type="button" ondragover="serviceDragOver(event)" ondrop="serviceDrop(event,'repair')">В ремонте</button>
   <button type="button" ondragover="serviceDragOver(event)" ondrop="serviceDrop(event,'done')">Готово</button>
  </div>
 </article>`
}
function renderRepairs(){
 populateServiceCityFilter();
 populateServiceMechanicFilter();
 renderServiceCrmSummary();
 renderPlannedServiceExpenses();
 const rows=serviceCarsForCurrentView();
 const counter=$("#serviceVisibleCarsCount");if(counter)counter.textContent=String(rows.length);

 const root=$("#repairList");if(!root)return;
 root.innerHTML=rows.map(renderServiceCarTasks).join("")||
  `<div class="professional-empty service-crm-empty"><strong>Ничего не найдено</strong><span>Измените поиск или фильтры.</span></div>`;

 if(selectedWorkspaceRepairCarId){
  const target=document.querySelector(`[data-service-car="${CSS.escape(String(selectedWorkspaceRepairCarId))}"]`);
  if(target){
   requestAnimationFrame(()=>{
    target.scrollIntoView({behavior:"smooth",block:"center"});
    target.classList.add("smart-entity-highlight");
    setTimeout(()=>target.classList.remove("smart-entity-highlight"),2800)
   })
  }
 }
}

function taxSettings(){
 db.settings.tax=db.settings.tax||{vat:"no",method:"ryczalt",ryczaltRate:8.5,monthlyContributions:0,deductVatCosts:true};
 return db.settings.tax
}
function monthLabel(value){
 const [year,month]=value.split("-").map(Number);
 return new Date(year,month-1,1).toLocaleDateString("ru-RU",{month:"long",year:"numeric"})
}
function periodBounds(period){
 const now=new Date(),year=now.getFullYear(),month=now.getMonth();
 if(typeof period==="string"&&period.startsWith("month:")){
  const value=period.slice(6),parts=value.split("-").map(Number),selectedYear=parts[0],selectedMonth=parts[1]-1;
  return{from:new Date(selectedYear,selectedMonth,1),to:new Date(selectedYear,selectedMonth+1,0),months:1,year:selectedYear,month:selectedMonth+1}
 }
 if(period==="month")return{from:new Date(year,month,1),to:new Date(year,month+1,0),months:1,year,month:month+1};
 if(period==="quarter"){
  const quarterStart=Math.floor(month/3)*3;
  return{from:new Date(year,quarterStart,1),to:new Date(year,quarterStart+3,0),months:3,year,quarter:Math.floor(month/3)+1}
 }
 if(period==="year")return{from:new Date(year,0,1),to:new Date(year,11,31),months:12,year};
 const paymentTimes=db.payments.map(p=>new Date((p.date||p.to||today())+"T12:00:00").getTime()).filter(Number.isFinite);
 const earliest=paymentTimes.length?Math.min(...paymentTimes):Date.now();
 return{from:null,to:null,months:Math.max(1,Math.ceil((Date.now()-earliest)/2629800000))}
}
function inPeriod(dateValue,bounds){
 if(!dateValue)return false;
 const d=new Date(dateValue+"T12:00:00");
 return(!bounds.from||d>=bounds.from)&&(!bounds.to||d<=bounds.to)
}

function normalizeRepairExpenseLinks(){
 const expenseByRepair=new Map();
 for(const expense of db.expenses){
  if(!expense.linkedRepairId)continue;
  if(!expenseByRepair.has(expense.linkedRepairId)){
   expenseByRepair.set(expense.linkedRepairId,expense)
  }else{
   const keeper=expenseByRepair.get(expense.linkedRepairId);
   // Prefer the paid/newer meaningful record and remove only an obvious generated duplicate.
   const keeperScore=(keeper.status==="paid"?2:0)+Number(keeper.amount||0);
   const expenseScore=(expense.status==="paid"?2:0)+Number(expense.amount||0);
   if(expenseScore>keeperScore){
    expenseByRepair.set(expense.linkedRepairId,expense)
   }
  }
 }
 const keepIds=new Set([...expenseByRepair.values()].map(x=>x.id));
 db.expenses=db.expenses.filter(expense=>{
  if(!expense.linkedRepairId)return true;
  const keeper=expenseByRepair.get(expense.linkedRepairId);
  return !keeper||keeper.id===expense.id
 });
 for(const repair of db.repairs){
  const expense=repair.linkedExpenseId
   ?db.expenses.find(x=>x.id===repair.linkedExpenseId)
   :db.expenses.find(x=>x.linkedRepairId===repair.id);
  if(expense){
   repair.linkedExpenseId=expense.id;
   expense.linkedRepairId=repair.id;
   expense.financeSource="expense"
  }
 }
}
function financialExpenseRows(bounds,carId=null){
 normalizeRepairExpenseLinks();
 const paidExpenses=db.expenses.filter(x=>
  (!carId||x.carId===carId)&&x.status==="paid"&&inPeriod(x.date,bounds)
 );
 const linkedRepairIds=new Set(paidExpenses.map(x=>x.linkedRepairId).filter(Boolean));
 const legacyRepairs=db.repairs.filter(r=>
  (!carId||r.carId===carId)&&
  r.status==="done"&&
  !linkedRepairIds.has(r.id)&&
  !r.linkedExpenseId&&
  inPeriod(r.completedDate||r.date,bounds)
 );
 return{paidExpenses,legacyRepairs}
}
function financialData(period,carId=null){
 const bounds=periodBounds(period);
 const scopedPayments=db.payments.filter(p=>!carId||p.carId===carId);
 const grossRevenue=scopedPayments.reduce((sum,p)=>sum+allocatedPaymentAmount(p,bounds,"received"),0);
 const expectedRevenue=scopedPayments.reduce((sum,p)=>sum+allocatedPaymentAmount(p,bounds,"expected"),0);

 const {paidExpenses,legacyRepairs}=financialExpenseRows(bounds,carId);
 const repairExpenses=paidExpenses.filter(x=>x.category==="repair");
 const otherExpenses=paidExpenses.filter(x=>x.category!=="repair");
 const repairGross=
  repairExpenses.reduce((s,x)=>s+Number(x.amount||0),0)+
  legacyRepairs.reduce((s,r)=>s+Number(r.actual||r.planned||0),0);
 const otherGross=otherExpenses.reduce((s,x)=>s+Number(x.amount||0),0);
 const grossCosts=repairGross+otherGross;

 const tax=taxSettings(),noTaxes=tax.method==="none",vatPayer=!noTaxes&&tax.vat==="yes",vatFactor=1.23;
 const netRevenue=vatPayer?grossRevenue/vatFactor:grossRevenue;
 const deductInputVat=vatPayer&&tax.deductVatCosts;
 const netCosts=deductInputVat?grossCosts/vatFactor:grossCosts;
 const outputVat=vatPayer?grossRevenue-netRevenue:0;
 const inputVat=deductInputVat?grossCosts-netCosts:0;
 const vatDue=noTaxes?0:Math.max(0,outputVat-inputVat);
 const profitBeforePit=netRevenue-netCosts;

 let pit=0;
 if(tax.method==="ryczalt"&&!noTaxes)pit=Math.max(0,netRevenue*Number(tax.ryczaltRate||0)/100);
 else if(tax.method==="linear"&&!noTaxes)pit=Math.max(0,profitBeforePit*.19);
 else if(tax.method==="scale"&&!noTaxes){
  const taxable=Math.max(0,profitBeforePit);
  pit=bounds.months===1
   ?Math.max(0,taxable*.12-(carId?300/Math.max(1,fleetCars().length):300))
   :(taxable<=120000
     ?Math.max(0,taxable*.12-(carId?3600/Math.max(1,fleetCars().length):3600))
     :10800+(taxable-120000)*.32)
 }

 const contributions=noTaxes?0:fixedContributionShare(carId,bounds);
 const finalProfit=grossRevenue-grossCosts-vatDue-pit-contributions;
 return{
  grossRevenue,expectedRevenue,repairGross,otherGross,grossCosts,
  netRevenue,netCosts,vatDue,pit,contributions,finalProfit,profitBeforePit,
  paymentCount:scopedPayments.filter(p=>overlapDays(paymentPeriod(p),bounds)>0).length
 }
}
function syncTaxMethodFields(){
 const method=$("#taxMethod").value;
 const noTaxes=method==="none";
 const ryczalt=method==="ryczalt";
 $("#taxRyczaltRate").disabled=!ryczalt;
 $("#taxVat").disabled=noTaxes;
 $("#taxMonthlyContributions").disabled=noTaxes;
 $("#taxDeductVatCosts").disabled=noTaxes||$("#taxVat").value!=="yes";
 $("#taxRyczaltField").classList.toggle("disabled-field",!ryczalt);
 $("#taxVatField").classList.toggle("disabled-field",noTaxes);
 $("#taxContributionsField").classList.toggle("disabled-field",noTaxes);
 $("#taxVatCostsField").classList.toggle("disabled-field",noTaxes||$("#taxVat").value!=="yes");
 if(noTaxes){
  $("#taxVat").value="no";
  $("#taxMonthlyContributions").value=0;
  $("#taxDeductVatCosts").checked=false;
 }
}
function taxReportPeriodLabel(period){
 if(period==="month")return new Date().toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
 if(period==="year")return `Текущий ${new Date().getFullYear()} год`;
 return "За всё время"
}
function taxMethodReportLabel(tax){
 if(tax.method==="none")return "Налоги отключены";
 if(tax.method==="ryczalt")return `Ryczałt ${Number(tax.ryczaltRate||0).toLocaleString("ru-RU")}%`;
 if(tax.method==="linear")return "PIT liniowy 19%";
 if(tax.method==="scale")return "PIT — zasady ogólne";
 return "PIT"
}
function taxBreakdownExpenseGroups(bounds){
 const {paidExpenses,legacyRepairs}=financialExpenseRows(bounds,null);
 const groups=new Map();
 const add=(key,label,value)=>{const amount=Number(value||0);if(!amount)return;const row=groups.get(key)||{label,total:0,count:0};row.total+=amount;row.count+=1;groups.set(key,row)};
 paidExpenses.forEach(x=>add(x.category||"other",expenseCategoryText(x.category||"other"),x.amount));
 legacyRepairs.forEach(r=>add("repair","Сервис и ремонты",r.actual||r.planned));
 return [...groups.values()].sort((a,b)=>b.total-a.total)
}
function taxBreakdownRevenueRows(bounds){
 return db.payments.map(p=>({p,amount:allocatedPaymentAmount(p,bounds,"received")})).filter(x=>x.amount>0).sort((a,b)=>String(b.p.date||b.p.to||"").localeCompare(String(a.p.date||a.p.to||"")))
}
function buildTaxBreakdownModel(){
 const period=$("#profitPeriod")?.value||"month";
 const bounds=periodBounds(period),tax=taxSettings(),data=financialData(period);
 const taxTotal=data.vatDue+data.pit+data.contributions;
 return{period,bounds,tax,data,taxTotal,expenseGroups:taxBreakdownExpenseGroups(bounds),revenueRows:taxBreakdownRevenueRows(bounds)}
}
function taxBreakdownHtml(report){
 const {period,tax,data,taxTotal,expenseGroups,revenueRows}=report;
 const vatActive=tax.method!=="none"&&tax.vat==="yes";
 const pitActive=tax.method!=="none";
 const methodLabel=taxMethodReportLabel(tax);
 const revenueDetails=revenueRows.length?revenueRows.slice(0,80).map(({p,amount})=>{const c=car(p.carId);return `<div class="tax-breakdown-row"><span>${c?`${model(c).brand} ${model(c).model} · ${c.plate}`:(p.tenant||"Оплата аренды")}<small>${p.tenant||""}${p.date?` · ${date(p.date)}`:""}</small></span><strong>+ ${money(amount)}</strong></div>`}).join(""):`<div class="tax-breakdown-row"><span>Полученных платежей за период нет</span><strong>${money(0)}</strong></div>`;
 const expenseDetails=expenseGroups.length?expenseGroups.map(x=>`<div class="tax-breakdown-row"><span>${x.label}<small>Операций: ${x.count}</small></span><strong>− ${money(x.total)}</strong></div>`).join(""):`<div class="tax-breakdown-row"><span>Фактических расходов за период нет</span><strong>${money(0)}</strong></div>`;
 const taxRows=[];
 if(vatActive){
  const outputVat=Math.max(0,data.grossRevenue-data.netRevenue),inputVat=Math.max(0,data.grossCosts-data.netCosts);
  taxRows.push(`<div class="tax-breakdown-row"><span>Начисленный VAT<small>VAT с полученного дохода</small></span><strong>${money(outputVat)}</strong></div>`);
  if(tax.deductVatCosts)taxRows.push(`<div class="tax-breakdown-row"><span>Входящий VAT к вычету<small>VAT из фактических расходов, учтённых системой</small></span><strong>− ${money(inputVat)}</strong></div>`);
  taxRows.push(`<div class="tax-breakdown-row"><span>VAT к оплате<small>Начисленный VAT минус входящий VAT</small></span><strong>− ${money(data.vatDue)}</strong></div>`)
 }
 if(pitActive&&tax.method!=="none")taxRows.push(`<div class="tax-breakdown-row"><span>${methodLabel}<small>${tax.method==="ryczalt"?`База ${money(data.netRevenue)} × ${Number(tax.ryczaltRate||0).toLocaleString("ru-RU")}%`:`База расчёта ${money(Math.max(0,data.profitBeforePit))}`}</small></span><strong>− ${money(data.pit)}</strong></div>`);
 if(pitActive)taxRows.push(`<div class="tax-breakdown-row"><span>ZUS / взносы<small>Согласно настройкам налогового профиля</small></span><strong>− ${money(data.contributions)}</strong></div>`);
 if(!taxRows.length)taxRows.push(`<div class="tax-breakdown-row"><span>Налоги для текущего профиля отключены</span><strong>${money(0)}</strong></div>`);
 return `<div class="tax-breakdown-kpis">
   <div class="tax-breakdown-kpi"><span>Заработано / получено</span><strong>${money(data.grossRevenue)}</strong></div>
   <div class="tax-breakdown-kpi"><span>Фактические расходы</span><strong>${money(data.grossCosts)}</strong></div>
   <div class="tax-breakdown-kpi danger"><span>Всего обязательных платежей</span><strong>${money(taxTotal)}</strong></div>
   <div class="tax-breakdown-kpi ${data.finalProfit>=0?"good":"danger"}"><span>Останется после расходов и налогов</span><strong>${money(data.finalProfit)}</strong></div>
  </div>
  <div class="tax-breakdown-grid">
   <section class="tax-breakdown-card"><h3>Заработки за период</h3>${revenueDetails}<div class="tax-breakdown-total"><span>Всего получено</span><strong>${money(data.grossRevenue)}</strong></div></section>
   <section class="tax-breakdown-card"><h3>Фактические расходы</h3>${expenseDetails}<div class="tax-breakdown-total"><span>Всего расходов</span><strong>${money(data.grossCosts)}</strong></div></section>
   <section class="tax-breakdown-card"><h3>Что нужно заплатить</h3>${taxRows.join("")}<div class="tax-breakdown-total"><span>Всего налогов и взносов</span><strong>${money(taxTotal)}</strong></div></section>
   <section class="tax-breakdown-card"><h3>Итог</h3>
    <div class="tax-breakdown-row"><span>Получено</span><strong>+ ${money(data.grossRevenue)}</strong></div>
    <div class="tax-breakdown-row"><span>Расходы</span><strong>− ${money(data.grossCosts)}</strong></div>
    <div class="tax-breakdown-row"><span>Налоги и взносы</span><strong>− ${money(taxTotal)}</strong></div>
    <div class="tax-breakdown-total"><span>Останется</span><strong class="${data.finalProfit<0?"negative":""}">${money(data.finalProfit)}</strong></div>
   </section>
  </div>
  <div class="tax-breakdown-note">Период: ${taxReportPeriodLabel(period)} · Налоговый профиль: ${methodLabel}${vatActive?" · VATowiec 23%":""}. Расчёт строится из текущих данных FleetPilot и предназначен для внутреннего контроля; итоговую налоговую декларацию следует сверять с бухгалтерией.</div>`
}
function openTaxBreakdown(){
 const dialog=$("#taxBreakdownDialog"),body=$("#taxBreakdownBody");if(!dialog||!body)return toast("Окно подробного расчёта не найдено");
 const model=buildTaxBreakdownModel();
 $("#taxBreakdownTitle").textContent=`Подробный расчёт · ${taxReportPeriodLabel(model.period)}`;
 body.innerHTML=taxBreakdownHtml(model);
 dialog.showModal()
}
function buildTaxBreakdownPrintHtml(){
 const model=buildTaxBreakdownModel(),body=taxBreakdownHtml(model);
 return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>FleetPilot — финансовый расчёт</title><style>
  *{box-sizing:border-box}body{margin:0;padding:28px;font-family:Arial,sans-serif;color:#172033;background:#fff;font-size:12px}h1{margin:0 0 4px;font-size:22px}header{margin-bottom:20px;border-bottom:1px solid #dfe4ea;padding-bottom:14px}header p{margin:4px 0;color:#64748b}.tax-breakdown-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}.tax-breakdown-kpi,.tax-breakdown-card{border:1px solid #dfe4ea;border-radius:10px;padding:11px}.tax-breakdown-kpi span{display:block;color:#64748b;margin-bottom:5px}.tax-breakdown-kpi strong{font-size:16px}.tax-breakdown-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start}.tax-breakdown-card h3{font-size:14px;margin:0 0 7px}.tax-breakdown-row,.tax-breakdown-total{display:grid;grid-template-columns:1fr auto;gap:12px;padding:7px 0;border-bottom:1px solid #edf0f4}.tax-breakdown-row small{display:block;color:#64748b;margin-top:2px}.tax-breakdown-row strong,.tax-breakdown-total strong{white-space:nowrap}.tax-breakdown-total{border-top:2px solid #dfe4ea;border-bottom:0;margin-top:4px;font-weight:700}.tax-breakdown-note{margin-top:12px;color:#64748b;line-height:1.45}.good strong{color:#168447}.danger strong,.negative{color:#c93636}@media print{body{padding:10mm}.tax-breakdown-card{break-inside:avoid}}</style></head><body><header><h1>FleetPilot — финансовый расчёт</h1><p>${taxReportPeriodLabel(model.period)}</p></header>${body}</body></html>`
}
function printTaxBreakdown(){
 const frame=document.createElement("iframe");frame.style.position="fixed";frame.style.right="0";frame.style.bottom="0";frame.style.width="0";frame.style.height="0";frame.style.border="0";document.body.appendChild(frame);
 frame.onload=()=>{setTimeout(()=>{try{frame.contentWindow.focus();frame.contentWindow.print()}finally{setTimeout(()=>frame.remove(),1200)}},120)};
 frame.srcdoc=buildTaxBreakdownPrintHtml()
}
window.openTaxBreakdown=openTaxBreakdown;
window.printTaxBreakdown=printTaxBreakdown;

function renderProfitability(){
 normalizeRepairExpenseLinks();
 const period=$("#profitPeriod")?.value||"month",tax=taxSettings(),data=financialData(period);
 $("#profitSummary").innerHTML=[
  ["Доход за дни периода",money(data.grossRevenue),"good"],
  ["Ремонты и расходы",money(data.grossCosts),"danger"],
  ["VAT к оплате",money(data.vatDue),""],
  ["PIT",money(data.pit),""],
  ["Фактическая прибыль",money(data.finalProfit),data.finalProfit>=0?"good":"danger"]
 ].map(x=>`<div class="summary-card ${x[2]}"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
 $("#taxVat").value=tax.vat;
 $("#taxMethod").value=tax.method;
 $("#taxRyczaltRate").value=tax.ryczaltRate;
 $("#taxMonthlyContributions").value=tax.monthlyContributions;
 $("#taxDeductVatCosts").checked=tax.deductVatCosts!==false;
 syncTaxMethodFields();
 $("#carProfitability").innerHTML=fleetCars().map(c=>{
  const d=financialData(period,c.id),m=model(c);
  return `<div class="profitability-row"><div><strong>${m.brand} ${m.model}</strong><small>${c.plate}</small></div><span>Доход периода ${money(d.grossRevenue)}</span><span>Ремонты ${money(d.repairGross)}</span><span>После налогов ${money(d.finalProfit)}</span></div>`
 }).join("");
}

function renderPayments(){
 const search=String($("#paymentSearch")?.value||"").trim().toLowerCase();
 const statusFilter=$("#paymentStatusFilter")?.value||"all";
 const rows=[...db.payments].sort((a,b)=>(b.to||"").localeCompare(a.to||""));
 const expected=rows.reduce((s,p)=>s+Number(p.expected||0),0);
 const received=rows.reduce((s,p)=>s+Number(p.received||0),0);
 const debt=Math.max(0,expected-received);

 $("#paymentSummary").innerHTML=[
  ["Ожидалось",money(expected),"За все записи"],
  ["Получено",money(received),"Фактические поступления"],
  ["Задолженность",money(debt),debt>0?"Требует контроля":"Задолженности нет"],
  ["Записей",rows.length,"В журнале"]
 ].map(([label,value,note])=>`<article class="professional-kpi"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join("");

 const visible=rows.filter(p=>{
  const c=car(p.carId),s=paymentStatus(p);
  const label=`${model(c).brand} ${model(c).model} ${c?.plate||""} ${p.tenant||c?.tenant||""}`.toLowerCase();
  return(!search||label.includes(search))&&(statusFilter==="all"||s===statusFilter)
 });
 const counter=$("#paymentVisibleCount");if(counter)counter.textContent=String(visible.length);
 const visibleRows=fpListRows("payments",visible);

 $("#paymentList").innerHTML=visibleRows.map(p=>{
  const c=car(p.carId),s=paymentStatus(p),rest=Math.max(0,Number(p.expected||0)-Number(p.received||0));
  const allocation=paymentMonthAllocation(p).map(x=>`${x.month}: ${x.days} дн. · ${money(x.received)}`).join(" | ");
  return `<article class="professional-row payment-professional-row">
   <div class="professional-row-icon">₿</div>
   <div class="professional-row-main">
    <strong>${model(c).brand} ${model(c).model} · ${c?.plate||"Без номера"}</strong>
    <span>${p.tenant||c?.tenant||"Без арендатора"} · ${date(p.from)} — ${date(p.to)}</span>
    <small>${paymentTimingText(p.timing||c?.paymentTiming||"advance")}${allocation?` · ${allocation}`:""}</small>
   </div>
   <div class="professional-row-numbers">
    <span class="professional-status ${s}">${paymentStatusText(s)}</span>
    <b>${money(p.received)}</b>
    <small>Осталось ${money(rest)}</small>
   </div>
   <div class="professional-row-actions">
    <button class="btn" onclick="editPayment('${p.id}')">Изменить</button>
    <button class="btn danger" onclick="deletePayment('${p.id}')">Удалить</button>
   </div>
  </article>`
 }).join("")||`<div class="professional-empty">Оплат по выбранным фильтрам нет.</div>`;
 fpAppendListMore($("#paymentList"),"payments",visible.length,renderPayments)
}
function renderExpenses(){
 const search=String($("#expenseSearch")?.value||"").trim().toLowerCase();
 const statusFilter=$("#expenseStatusFilter")?.value||"all";
 const categoryFilter=$("#expenseCategoryFilter")?.value||"all";
 const rows=[...db.expenses].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
 const planned=rows.filter(x=>x.status==="planned"),paid=rows.filter(x=>x.status==="paid");
 const plannedSum=planned.reduce((s,x)=>s+Number(x.amount||0),0);
 const paidSum=paid.reduce((s,x)=>s+Number(x.amount||0),0);

 $("#expenseSummary").innerHTML=[
  ["Запланировано",money(plannedSum),`${planned.length} записей`],
  ["Оплачено",money(paidSum),`${paid.length} записей`],
  ["Всего расходов",money(rows.reduce((s,x)=>s+Number(x.amount||0),0)),"За всё время"],
  ["Записей",rows.length,"В журнале"]
 ].map(([label,value,note])=>`<article class="professional-kpi"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join("");

 const visible=rows.filter(x=>{
  const c=car(x.carId);
  const label=`${x.title} ${x.note||""} ${model(c).brand} ${model(c).model} ${c?.plate||""}`.toLowerCase();
  return(!search||label.includes(search))&&(statusFilter==="all"||x.status===statusFilter)&&(categoryFilter==="all"||x.category===categoryFilter)
 });
 const counter=$("#expenseVisibleCount");if(counter)counter.textContent=String(visible.length);
 const visibleRows=fpListRows("expenses",visible);

 $("#expenseList").innerHTML=visibleRows.map(x=>{
  const c=car(x.carId);
  const linkedRepair=x.linkedRepairId?db.repairs.find(r=>String(r.id)===String(x.linkedRepairId)):null;
  return `<article class="professional-row" data-expense-id="${x.id}">
   <div class="professional-row-icon fp-standard-icon">${fpUiIcon(x.category==="repair"?"repair":x.category==="insurance"?"insurance":x.category==="inspection"?"inspection":x.category==="tires"?"tires":"expense")}</div>
   <div class="professional-row-main">
    <strong>${x.title}</strong>
    <span>${model(c).brand} ${model(c).model} · ${c?.plate||"Без номера"} · ${date(x.date)}</span>
    <small>${expenseCategoryText(x.category)}${x.note?` · ${x.note}`:""}</small>
   </div>
   <div class="professional-row-numbers">
    <span class="professional-status ${x.status}">${expenseStatusText(x.status)}</span>
    <b>${money(x.amount)}</b>
   </div>
   <div class="professional-row-actions">
    ${linkedRepair?`<button class="btn" onclick="openSmartEntity('repair','${linkedRepair.id}','${x.carId}')">В сервис</button>`:""}
    <button class="btn" onclick="editExpense('${x.id}')">Изменить</button>
    <button class="btn danger" onclick="deleteExpense('${x.id}')">Удалить</button>
   </div>
  </article>`
 }).join("")||`<div class="professional-empty">Расходов по выбранным фильтрам нет.</div>`;
 fpAppendListMore($("#expenseList"),"expenses",visible.length,renderExpenses);

 const categories=["repair","insurance","inspection","tires","leasing","other"];
 const total=rows.reduce((s,x)=>s+Number(x.amount||0),0);
 const breakdown=$("#expenseCategoryBreakdown");
 if(breakdown)breakdown.innerHTML=categories.map(category=>{
  const amount=rows.filter(x=>x.category===category).reduce((s,x)=>s+Number(x.amount||0),0);
  const percent=total?Math.round(amount/total*100):0;
  return `<div class="expense-category-row">
   <div><span>${expenseCategoryText(category)}</span><b>${money(amount)}</b></div>
   <div class="expense-category-track"><i style="width:${percent}%"></i></div>
   <small>${percent}%</small>
  </div>`
 }).join("")
}
function addMonthsIso(dateValue,months){const d=new Date(dateValue+"T12:00:00");d.setMonth(d.getMonth()+months);return d.toISOString().slice(0,10)}
function buildInsuranceInstallments(total,count,firstDate,frequency,existing=[]){
 const step=frequency==="quarterly"?3:1;
 const defaultAmount=Math.round((Number(total||0)/Math.max(1,count))*100)/100;
 return Array.from({length:count},(_,i)=>{
  const old=existing[i];
  const fallback=i===count-1?Math.round((Number(total||0)-defaultAmount*(count-1))*100)/100:defaultAmount;
  return{id:old?.id||uid(),number:i+1,due:old?.due||addMonthsIso(firstDate,i*step),amount:old?.amount!=null?Number(old.amount):fallback,paid:Boolean(old?.paid),paidDate:old?.paidDate||"",paidAmount:old?.paidAmount!=null?Number(old.paidAmount):old?.paid?Number(old.amount||fallback):0,paymentNote:old?.paymentNote||"",linkedExpenseId:old?.linkedExpenseId||""}
 })
}
function installmentSummary(doc){
 const list=doc.installments||[];
 const paid=list.filter(x=>x.paid).reduce((s,x)=>s+Number(x.paidAmount??x.amount??0),0);
 const next=list.filter(x=>!x.paid).sort((a,b)=>(a.due||"").localeCompare(b.due||""))[0];
 const scheduled=list.reduce((s,x)=>s+Number(x.amount||0),0);
 return{paid,left:Math.max(0,Number(doc.cost||0)-paid),next,scheduled,difference:Number(doc.cost||0)-scheduled}
}
function toggleInsuranceInstallment(documentId,installmentId){
 const doc=db.documents.find(x=>x.id===documentId),item=doc?.installments?.find(x=>x.id===installmentId);
 if(!doc||!item)return;
 $("#insurancePaymentDocumentId").value=documentId;$("#insurancePaymentInstallmentId").value=installmentId;
 $("#insurancePaymentTitle").textContent=`Рата ${item.number}`;
 $("#insurancePaidAmount").value=item.paidAmount||item.amount||0;$("#insurancePaidDate").value=item.paidDate||today();$("#insurancePaymentNote").value=item.paymentNote||"";$("#insurancePaymentPaid").checked=Boolean(item.paid);
 $("#insurancePaymentSummary").innerHTML=`<strong>${doc.title}</strong><span>${date(item.due)} · запланировано ${money(item.amount)}</span>`;
 $("#insurancePaymentDialog").showModal()
}

let documentInstallmentDraft=[];
function syncVehicleDocumentDates(documentRow,oldRow=null){
 const c=car(documentRow.carId);if(!c)return;
 if(documentRow.type==="insurance"){c.insurance=documentRow.expiry||"";c.insuranceDocumentId=documentRow.id}
 if(documentRow.type==="inspection"){c.inspection=documentRow.expiry||"";c.inspectionDocumentId=documentRow.id}
 if(oldRow&&oldRow.carId!==documentRow.carId){
  const oldCar=car(oldRow.carId);
  if(oldCar?.insuranceDocumentId===documentRow.id){oldCar.insurance="";oldCar.insuranceDocumentId=""}
  if(oldCar?.inspectionDocumentId===documentRow.id){oldCar.inspection="";oldCar.inspectionDocumentId=""}
 }
}
function syncInsuranceExpense(doc,item){
 let expense=item.linkedExpenseId?db.expenses.find(x=>x.id===item.linkedExpenseId):null;
 if(!item.paid){if(expense)db.expenses=db.expenses.filter(x=>x.id!==expense.id);item.linkedExpenseId="";return}
 if(!expense){expense={id:uid()};db.expenses.push(expense);item.linkedExpenseId=expense.id}
 Object.assign(expense,{carId:doc.carId,title:`${doc.title} — Рата ${item.number}`,category:"insurance",date:item.paidDate||today(),amount:Number(item.paidAmount||item.amount||0),status:"paid",note:item.paymentNote||`Оплата раты страхового полиса ${doc.number||""}`.trim(),linkedDocumentId:doc.id,linkedInstallmentId:item.id})
}
function renderInsuranceInstallmentWarning(){
 const warning=$("#insuranceInstallmentTotalWarning");if(!warning)return;
 const total=Number($("#documentCost").value||0),scheduled=documentInstallmentDraft.reduce((s,x)=>s+Number(x.amount||0),0),difference=Math.round((total-scheduled)*100)/100;
 warning.className=`insurance-total-warning ${Math.abs(difference)<.01?"ok":"warning"}`;
 warning.textContent=Math.abs(difference)<.01?`Распределено полностью: ${money(scheduled)}`:`${difference>0?"Не распределено":"Превышение"}: ${money(Math.abs(difference))} · сумма рат ${money(scheduled)}`
}
function renderInsuranceInstallmentEditor(){
 const root=$("#insuranceInstallmentEditorList");if(!root)return;
 root.innerHTML=documentInstallmentDraft.map((item,index)=>`<div class="insurance-installment-edit-row"><strong>Рата ${index+1}</strong><label><span>Сумма</span><input type="number" step="0.01" min="0" data-installment-amount="${index}" value="${Number(item.amount||0)}"></label><label><span>Срок оплаты</span><input type="date" data-installment-due="${index}" value="${item.due||""}"></label><small>${item.paid?`Оплачено ${money(item.paidAmount||item.amount)} · ${date(item.paidDate)}`:"Ожидает оплаты"}</small></div>`).join("");
 root.querySelectorAll("[data-installment-amount]").forEach(input=>input.oninput=()=>{documentInstallmentDraft[Number(input.dataset.installmentAmount)].amount=Number(input.value||0);renderInsuranceInstallmentWarning()});
 root.querySelectorAll("[data-installment-due]").forEach(input=>input.onchange=()=>{documentInstallmentDraft[Number(input.dataset.installmentDue)].due=input.value});
 renderInsuranceInstallmentWarning()
}
function rebuildInsuranceInstallmentDraft(preserve=true){
 documentInstallmentDraft=buildInsuranceInstallments(Number($("#documentCost").value||0),Math.max(2,Number($("#documentInstallmentCount").value||4)),$("#documentFirstInstallment").value||today(),$("#documentInstallmentFrequency").value,preserve?documentInstallmentDraft:[]);
 renderInsuranceInstallmentEditor()
}
let smartNavigationTarget=null;
function clearSmartHighlight(){
 document.querySelectorAll('.smart-target-highlight').forEach(el=>el.classList.remove('smart-target-highlight'))
}
function highlightSmartTarget(selector){
 clearSmartHighlight();
 const target=document.querySelector(selector);
 if(!target)return false;
 target.classList.add('smart-target-highlight');
 target.scrollIntoView({behavior:'smooth',block:'center'});
 setTimeout(()=>target.classList.remove('smart-target-highlight'),5000);
 return true
}
