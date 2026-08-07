/* =========================================================
   FleetPilot V15.6 — Calendar & Vehicle Profile
   Smart navigation, calendar, expense drilldown, Vehicle Core/profile and vehicle dialogs.
   Source order: original app.js lines 6032-6891
   ========================================================= */
function openSmartEntity(type,entityId,carId=''){
 smartNavigationTarget={type,entityId:String(entityId||''),carId:String(carId||'')};
 if(type==='repair'){
  const row=db.repairs.find(x=>String(x.id)===String(entityId));
  const search=$("#serviceSearch");if(search)search.value="";
  const status=$("#serviceStatusFilter");if(status)status.value="all";
  const city=$("#serviceCityFilter");if(city)city.value="all";
  const priority=$("#servicePriorityFilter");if(priority)priority.value="all";
  const mechanic=$("#serviceMechanicFilter");if(mechanic)mechanic.value="all";
  selectedWorkspaceRepairCarId=row?.carId?String(row.carId):String(carId||"");
  if(row?.carId&&serviceCollapsedCars?.has(String(row.carId))){
   serviceCollapsedCars.delete(String(row.carId));
   try{localStorage.setItem(SERVICE_COLLAPSED_CARS_KEY,JSON.stringify([...serviceCollapsedCars]))}catch{}
  }
  showPage('repairsPage');
  setTimeout(()=>{
   renderRepairs();
   if(!highlightSmartTarget(`[data-repair-id="${CSS.escape(String(entityId))}"]`)&&row)editRepair(row.id)
  },80);return
 }
 if(type==='driver_request'){
  selectedWorkspaceRepairCarId=String(carId||'');
  showPage('repairsPage');
  setTimeout(async()=>{
   await renderWorkspaceRepairRequests();
   highlightSmartTarget(`[data-workspace-request-id="${CSS.escape(String(entityId))}"]`)
  },80);return
 }
 if(type==='document'||type==='insurance'||type==='inspection'||type==='installment'){
  let row=db.documents.find(x=>String(x.id)===String(entityId));
  if(!row&&carId&&['insurance','inspection'].includes(type))row=db.documents.find(x=>String(x.carId)===String(carId)&&String(x.type)===String(type));
  showPage('documentsPage');
  setTimeout(()=>{
   renderDocuments();
   if(row){if(!highlightSmartTarget(`[data-document-id="${CSS.escape(String(row.id))}"]`))openDocumentDialog('',row.id)}
   else if(carId)openCar(String(carId),'info')
  },80);return
 }
 if(type==='expense'){
  const search=$("#expenseSearch");if(search)search.value="";
  const status=$("#expenseStatusFilter");if(status)status.value="all";
  const category=$("#expenseCategoryFilter");if(category)category.value="all";
  showPage('expensesPage');
  setTimeout(()=>{renderExpenses();if(!highlightSmartTarget(`[data-expense-id="${CSS.escape(String(entityId))}"]`)){const row=db.expenses.find(x=>String(x.id)===String(entityId));if(row)editExpense(row.id)}},80);return
 }
 if(carId){showPage('fleetPage');setTimeout(()=>openCar(String(carId)),60)}
}
window.openSmartEntity=openSmartEntity;
function allEvents(){
 const result=[];
 for(const c of cityFilteredCars()){
  const m=model(c);
  if(c.insurance){const doc=(db.documents||[]).find(x=>x.carId===c.id&&x.type==="insurance");result.push({date:c.insurance,carId:c.id,entityId:doc?.id||"",title:"Окончание страховки",type:"insurance",car:m.brand+" "+m.model+" · "+c.plate})}
  if(c.inspection){const doc=(db.documents||[]).find(x=>x.carId===c.id&&x.type==="inspection");result.push({date:c.inspection,carId:c.id,entityId:doc?.id||"",title:"Техосмотр",type:"inspection",car:m.brand+" "+m.model+" · "+c.plate})}
 }
 for(const r of db.repairs.filter(x=>!["done","cancelled"].includes(String(x.status||""))))result.push({date:r.date,carId:r.carId,entityId:r.id,title:r.title,type:"repair",car:model(car(r.carId)).brand+" "+model(car(r.carId)).model+" · "+car(r.carId).plate});
 for(const x of db.expenses.filter(x=>x.status==="planned")){
  const linked=x.linkedRepairId?db.repairs.find(r=>String(r.id)===String(x.linkedRepairId)):null;
  if(linked&&!['done','cancelled'].includes(String(linked.status||'')))continue;
  result.push({date:x.date,carId:x.carId,entityId:x.id,title:x.title,type:"expense",car:model(car(x.carId)).brand+" "+model(car(x.carId)).model+" · "+car(x.carId).plate,amount:x.amount})
 }
 for(const d of db.documents){
  for(const i of d.installments||[])if(!i.paid)result.push({date:i.due,carId:d.carId,entityId:d.id,title:`${d.title}: рата ${i.number}`,type:"installment",car:model(car(d.carId)).brand+" "+model(car(d.carId)).model+" · "+car(d.carId).plate,amount:i.amount});
  if(d.expiry)result.push({date:d.expiry,carId:d.carId,entityId:d.id,title:`Документ: ${d.title}`,type:d.type||"document",car:model(car(d.carId)).brand+" "+model(car(d.carId)).model+" · "+car(d.carId).plate});
 }
 return result.filter(x=>x.date).map(x=>({...x,days:days(x.date)}))
}
function eventsForCar(carId){return allEvents().filter(x=>x.carId===carId)}
function fpUiIcon(name){
 const icons={
  insurance:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.7 2.9 8.1 7 10 4.1-1.9 7-5.3 7-10V6l-7-3Zm0 3.1 4 1.7V11c0 3.1-1.7 5.5-4 6.9-2.3-1.4-4-3.8-4-6.9V7.8l4-1.7Z"/></svg>`,
  inspection:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 4a5.5 5.5 0 1 0 3.4 9.8l4.7 4.7 1.4-1.4-4.7-4.7A5.5 5.5 0 0 0 9.5 4Zm0 2a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"/></svg>`,
  repair:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4.5 4.5 0 0 0-5.5 5.5L4 17l3 3 5.2-5.2a4.5 4.5 0 0 0 5.5-5.5l-2.8 2.8-2.1-.9-.9-2.1 2.8-2.8Z"/></svg>`,
  expense:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v14H5V5Zm2 3v2h10V8H7Zm0 4v2h6v-2H7Zm8 0v4h2v-4h-2Z"/></svg>`,
  installment:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v12H4V6Zm2 3h12V8H6v1Zm0 3v4h5v-4H6Zm7 0v1.8h5V12h-5Zm0 3v1h5v-1h-5Z"/></svg>`,
  document:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6V3Zm2 2v14h8V8h-3V5H8Zm2 7h4v2h-4v-2Zm0 4h4v2h-4v-2Z"/></svg>`,
  calendar:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h2v2h8V3h2v2h2v16H4V5h2V3Zm12 8H6v8h12v-8ZM6 7v2h12V7H6Z"/></svg>`,
  tires:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 3a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 2.5A3.5 3.5 0 1 0 12 15a3.5 3.5 0 0 0 0-7Z"/></svg>`,
  arrow:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6-1.4-1.4 4.6-4.6-4.6-4.6L9 6Z"/></svg>`
 };
 return icons[name]||icons.calendar
}
function eventIcon(type){return fpUiIcon({insurance:"insurance",inspection:"inspection",repair:"repair",expense:"expense",installment:"installment",payment:"installment",document:"document"}[type]||"calendar") }
let calendarViewMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
let calendarViewMode="month";
let calendarAnchorDate=today();
function calendarIsoLocal(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function calendarDate(value){return new Date((value||today())+"T12:00:00")}
function startOfCalendarWeek(value){const d=calendarDate(value),shift=(d.getDay()+6)%7;d.setDate(d.getDate()-shift);return d}
function setCalendarView(mode){
 if(!["month","week","day"].includes(mode))mode="month";
 calendarViewMode=mode;
 $$("[data-calendar-view]").forEach(btn=>btn.classList.toggle("active",btn.dataset.calendarView===mode));
 if(mode==="day"&&!$("#calendarSelectedDate")?.value){const input=$("#calendarSelectedDate");if(input)input.value=calendarAnchorDate}
 renderCalendar()
}
window.setCalendarView=setCalendarView;
function selectCalendarDay(value,switchToDay=false){
 const input=$("#calendarSelectedDate");if(input)input.value=value||"";
 if(value){calendarAnchorDate=value;const d=calendarDate(value);calendarViewMonth=new Date(d.getFullYear(),d.getMonth(),1)}
 if(switchToDay&&value)calendarViewMode="day";
 $$("[data-calendar-view]").forEach(btn=>btn.classList.toggle("active",btn.dataset.calendarView===calendarViewMode));
 renderCalendar()
}
window.selectCalendarDay=selectCalendarDay;
function openCalendarDay(value){selectCalendarDay(value,true)}
window.openCalendarDay=openCalendarDay;
function moveCalendarMonth(delta){calendarViewMonth=new Date(calendarViewMonth.getFullYear(),calendarViewMonth.getMonth()+delta,1);calendarAnchorDate=calendarIsoLocal(calendarViewMonth);renderCalendar()}
function moveCalendarPeriod(delta){
 const d=calendarDate(calendarAnchorDate||today());
 if(calendarViewMode==="month"){d.setDate(1);d.setMonth(d.getMonth()+delta);calendarViewMonth=new Date(d.getFullYear(),d.getMonth(),1)}
 else if(calendarViewMode==="week")d.setDate(d.getDate()+delta*7);
 else d.setDate(d.getDate()+delta);
 calendarAnchorDate=calendarIsoLocal(d);
 const input=$("#calendarSelectedDate");if(input)input.value=calendarViewMode==="day"?calendarAnchorDate:"";
 if(calendarViewMode!=="month")calendarViewMonth=new Date(d.getFullYear(),d.getMonth(),1);
 renderCalendar()
}
window.moveCalendarPeriod=moveCalendarPeriod;
function calendarViewBounds(){
 const anchor=calendarDate(calendarAnchorDate||today());
 if(calendarViewMode==="day")return{from:anchor,to:anchor,label:anchor.toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long",year:"numeric"})};
 if(calendarViewMode==="week"){
  const from=startOfCalendarWeek(calendarAnchorDate),to=new Date(from);to.setDate(to.getDate()+6);
  return{from,to,label:`${from.toLocaleDateString("ru-RU",{day:"numeric",month:"short"})} — ${to.toLocaleDateString("ru-RU",{day:"numeric",month:"short",year:"numeric"})}`}
 }
 const from=new Date(calendarViewMonth.getFullYear(),calendarViewMonth.getMonth(),1),to=new Date(calendarViewMonth.getFullYear(),calendarViewMonth.getMonth()+1,0);
 return{from,to,label:from.toLocaleDateString("ru-RU",{month:"long",year:"numeric"})}
}
function renderCalendarMonthGrid(all){
 const root=$("#calendarMonthGrid"),title=$("#calendarMonthTitle");if(!root)return;
 const year=calendarViewMonth.getFullYear(),month=calendarViewMonth.getMonth();
 if(title)title.textContent=calendarViewMonth.toLocaleDateString("ru-RU",{month:"long",year:"numeric"});
 const selected=$("#calendarSelectedDate")?.value||"";
 const first=new Date(year,month,1),offset=(first.getDay()+6)%7,daysInMonth=new Date(year,month+1,0).getDate();
 const cells=[];
 ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].forEach(x=>cells.push(`<span class="calendar-weekday">${x}</span>`));
 for(let i=0;i<offset;i++)cells.push('<span class="calendar-day empty"></span>');
 for(let day=1;day<=daysInMonth;day++){
  const d=new Date(year,month,day),iso=calendarIsoLocal(d),dayEvents=all.filter(x=>x.date===iso),count=dayEvents.length;
  const isToday=iso===today(),isSelected=iso===selected||iso===calendarAnchorDate;
  const dots=[...new Set(dayEvents.map(x=>x.type))].slice(0,3).map(type=>`<i class="calendar-event-dot type-${type}"></i>`).join("");
  cells.push(`<button type="button" class="calendar-day ${isToday?"today":""} ${isSelected?"selected":""} ${count?"has-events":""}" onclick="openCalendarDay('${iso}')"><strong>${day}</strong>${count?`<span>${count}</span><em>${dots}</em>`:""}</button>`)
 }
 root.innerHTML=cells.join("")
}
function calendarEventTypeLabel(type){return{insurance:"Страховка",inspection:"ТО",repair:"Сервис",expense:"Расход",installment:"Платёж",document:"Документ"}[type]||"Событие"}
function renderCalendar(){
 const typeFilter=$("#calendarTypeFilter")?.value||"all";
 const all=allEvents().filter(x=>typeFilter==="all"||x.type===typeFilter);
 const bounds=calendarViewBounds(),fromIso=calendarIsoLocal(bounds.from),toIso=calendarIsoLocal(bounds.to);
 const events=all.filter(x=>x.date>=fromIso&&x.date<=toIso).sort((a,b)=>a.date.localeCompare(b.date));
 const overdue=all.filter(x=>x.days<0).length;
 $$("[data-calendar-view]").forEach(btn=>btn.classList.toggle("active",btn.dataset.calendarView===calendarViewMode));
 const periodLabel=$("#calendarSelectedDayLabel");if(periodLabel)periodLabel.textContent=bounds.label;
 const agendaTitle=$("#calendarAgendaTitle");if(agendaTitle)agendaTitle.textContent=calendarViewMode==="month"?"События месяца":calendarViewMode==="week"?"События недели":"События дня";
 $("#calendarSummary").innerHTML=[
  ["Сегодня",all.filter(x=>x.days===0).length,"События на сегодня"],
  ["В периоде",events.length,bounds.label],
  ["7 дней",all.filter(x=>x.days>=0&&x.days<=7).length,"Ближайшая неделя"],
  ["Просрочено",overdue,"Требует внимания"]
 ].map(([label,value,note])=>`<article class="professional-kpi"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join("");
 const counter=$("#calendarVisibleCount");if(counter)counter.textContent=String(events.length);
 const grouped=new Map();events.forEach(event=>{const key=event.date;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(event)});
 $("#calendarList").innerHTML=events.length?[...grouped.entries()].map(([group,items])=>{
  const groupDate=calendarDate(group),groupLabel=groupDate.toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"});
  return `<section class="calendar-day-group"><h4><span>${groupLabel}</span><b>${items.length}</b></h4>${items.map(e=>`<article class="calendar-professional-row ${e.days<0?"overdue":e.days<=7?"urgent":e.days<=30?"soon":""}" onclick="openSmartEntity('${e.type}','${e.entityId||''}','${e.carId||''}')"><div class="calendar-professional-date"><strong>${groupDate.getDate()}</strong><span>${groupDate.toLocaleDateString("ru-RU",{weekday:"short"})}</span></div><div class="calendar-professional-icon fp-standard-icon type-${e.type}">${eventIcon(e.type)}</div><div class="calendar-professional-main"><div class="calendar-event-title-line"><strong>${e.title}</strong><em>${calendarEventTypeLabel(e.type)}</em></div><span>${e.car}${e.amount?` · ${money(e.amount)}`:""}</span><small>${e.days<0?`Просрочено ${Math.abs(e.days)} дн.`:e.days===0?"Сегодня":`через ${e.days} дн.`}</small></div><b class="fp-row-chevron">${fpUiIcon("arrow")}</b></article>`).join("")}</section>`
 }).join(""):`<div class="professional-empty">В выбранном ${calendarViewMode==="day"?"дне":calendarViewMode==="week"?"периоде недели":"месяце"} событий нет.</div>`;
 renderCalendarMonthGrid(all);
 const overview=$("#calendarMonthOverview");
 if(overview){overview.innerHTML=[0,1,2,3].map(offset=>{const base=calendarDate(calendarAnchorDate||today()),d=new Date(base.getFullYear(),base.getMonth()+offset,1),key=calendarIsoLocal(d).slice(0,7),count=all.filter(x=>(x.date||"").startsWith(key)).length;return `<button type="button" class="calendar-month-card ${calendarViewMonth.getFullYear()===d.getFullYear()&&calendarViewMonth.getMonth()===d.getMonth()?"selected":""}" onclick="calendarViewMonth=new Date(${d.getFullYear()},${d.getMonth()},1);calendarAnchorDate='${calendarIsoLocal(d)}';calendarViewMode='month';renderCalendar()"><span>${d.toLocaleDateString("ru-RU",{month:"long"})}</span><strong>${count}</strong><small>событий</small></button>`}).join("")}
}

function tireSeasonText(value){return{summer:"Летние",winter:"Зимние",allseason:"Всесезонные"}[value]||"Не указано"}
function carTireSnapshot(c){
 const rows=(db.expenses||[]).filter(x=>x.carId===c.id&&x.category==="tires").sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
 const planned=rows.find(x=>x.status==="planned");
 const paid=rows.find(x=>x.status==="paid");
 const usedKm=c.tireMileage?Math.max(0,Number(c.mileage||0)-Number(c.tireMileage||0)):null;
 return{planned,paid,usedKm}
}

let selectedCarFinancePeriod="month";
function carFinancePeriodLabel(period){return{month:"Месяц",quarter:"Квартал",year:"Год"}[period]||"Месяц"}
function plannedFinanceForCar(carId,period="month"){
 const bounds=periodBounds(period);
 const plannedExpenses=(db.expenses||[]).filter(x=>x.carId===carId&&x.status==="planned"&&x.date&&inPeriod(x.date,bounds));
 const linkedRepairIds=new Set(plannedExpenses.map(x=>String(x.linkedRepairId||"")).filter(Boolean));
 const linkedExpenseIds=new Set(plannedExpenses.map(x=>String(x.id||"")));
 const plannedRepairs=(db.repairs||[]).filter(r=>{
  if(r.carId!==carId||["done","cancelled"].includes(String(r.status||""))||!r.date||!inPeriod(r.date,bounds))return false;
  if(r.linkedExpenseId&&linkedExpenseIds.has(String(r.linkedExpenseId)))return false;
  if(linkedRepairIds.has(String(r.id)))return false;
  return true
 });
 const expenseTotal=plannedExpenses.reduce((s,x)=>s+Number(x.amount||0),0);
 const repairTotal=plannedRepairs.reduce((s,r)=>s+Number(r.planned||0),0);
 const rows=[
  ...plannedExpenses.map(x=>({id:x.id,kind:"expense",title:x.title,date:x.date,amount:Number(x.amount||0),category:expenseCategoryText(x.category)})),
  ...plannedRepairs.map(r=>({id:r.id,kind:"repair",title:r.title,date:r.date,amount:Number(r.planned||0),category:"Сервис"}))
 ].sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));
 return{plannedExpenses,plannedRepairs,expenseTotal,repairTotal,total:expenseTotal+repairTotal,rows}
}
function setCarFinancePeriod(period){
 if(!["month","quarter","year"].includes(period))period="month";
 selectedCarFinancePeriod=period;
 if(selectedCarId)renderCarProfile(selectedCarId,"finance")
}

let expenseDrilldownState={carId:null,tab:"fact",category:"all"};
function carFinancePeriodRangeLabel(period){
 const bounds=periodBounds(period),opts={day:"2-digit",month:"2-digit",year:"numeric"};
 if(bounds.from&&bounds.to)return `${bounds.from.toLocaleDateString("ru-RU",opts)} — ${bounds.to.toLocaleDateString("ru-RU",opts)}`;
 return carFinancePeriodLabel(period)
}
function carFinanceFactRows(carId,period){
 const bounds=periodBounds(period),{paidExpenses,legacyRepairs}=financialExpenseRows(bounds,carId);
 return [
  ...paidExpenses.map(x=>({id:x.id,kind:"expense",title:x.title||expenseCategoryText(x.category||"other"),date:x.date,amount:Number(x.amount||0),category:x.category||"other",categoryLabel:expenseCategoryText(x.category||"other"),note:x.note||""})),
  ...legacyRepairs.map(r=>({id:r.id,kind:"repair",title:r.title||"Ремонт",date:r.completedDate||r.date,amount:Number(r.actual||r.planned||0),category:"repair",categoryLabel:"Сервис и ремонты",note:r.service||r.note||""}))
 ].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")))
}
function carFinancePlanRows(carId,period){
 return plannedFinanceForCar(carId,period).rows.map(x=>({
  ...x,
  categoryKey:x.kind==="repair"?"repair":((db.expenses||[]).find(e=>String(e.id)===String(x.id))?.category||"other"),
  categoryLabel:x.category||"Прочее",
  note:""
 }))
}
function expenseDrilldownCategoryKey(row){return row.categoryKey||row.category||"other"}
function expenseDrilldownCategoryLabel(key){return key==="repair"?"Сервис":expenseCategoryText(key||"other")}
function expenseDrilldownRows(){
 const {carId,tab,category}=expenseDrilldownState,period=selectedCarFinancePeriod||"month";
 const rows=tab==="plan"?carFinancePlanRows(carId,period):carFinanceFactRows(carId,period);
 return category==="all"?rows:rows.filter(x=>expenseDrilldownCategoryKey(x)===category)
}
function expenseDrilldownAllRows(){
 const {carId,tab}=expenseDrilldownState,period=selectedCarFinancePeriod||"month";
 return tab==="plan"?carFinancePlanRows(carId,period):carFinanceFactRows(carId,period)
}
function expenseDrilldownCategories(rows){
 const map=new Map();
 rows.forEach(row=>{const key=expenseDrilldownCategoryKey(row),v=map.get(key)||{key,label:expenseDrilldownCategoryLabel(key),total:0,count:0};v.total+=Number(row.amount||0);v.count++;map.set(key,v)});
 return [...map.values()].sort((a,b)=>b.total-a.total)
}
function renderExpenseDrilldown(){
 const dialog=$("#expenseDrilldownDialog"),body=$("#expenseDrilldownBody");if(!dialog||!body)return;
 const c=car(expenseDrilldownState.carId);if(!c)return;
 const period=selectedCarFinancePeriod||"month",finance=financialData(period,c.id),allRows=expenseDrilldownAllRows(),rows=expenseDrilldownRows(),total=allRows.reduce((s,x)=>s+Number(x.amount||0),0),visibleTotal=rows.reduce((s,x)=>s+Number(x.amount||0),0),income=Number(finance.grossRevenue||0),pct=income>0?total/income*100:0;
 const categories=expenseDrilldownCategories(allRows);
 $("#expenseDrilldownTitle").textContent=`${expenseDrilldownState.tab==="plan"?"План расходов":"Факт расходов"} · ${c.plate}`;
 const categoryButtons=[`<button type="button" class="${expenseDrilldownState.category==="all"?"active":""}" onclick="setExpenseDrilldownCategory('all')">Все <span>${allRows.length}</span></button>`,...categories.map(x=>`<button type="button" class="${expenseDrilldownState.category===x.key?"active":""}" onclick="setExpenseDrilldownCategory('${x.key}')">${x.label} <span>${x.count}</span></button>`)].join("");
 const rowsHtml=rows.length?rows.map(x=>`<button type="button" class="expense-drilldown-row" onclick="openExpenseDrilldownEntity('${x.kind}','${x.id}')"><span class="expense-drilldown-row-main"><strong>${x.title||"Без названия"}</strong><small>${date(x.date)} · ${x.categoryLabel||expenseDrilldownCategoryLabel(expenseDrilldownCategoryKey(x))}${x.note?` · ${x.note}`:""}</small></span><b>${money(x.amount)}</b>${fpUiIcon("arrow")}</button>`).join(""):`<div class="professional-empty">Для выбранного фильтра записей нет.</div>`;
 body.innerHTML=`<div class="expense-drilldown-tabs"><button type="button" class="${expenseDrilldownState.tab==="fact"?"active":""}" onclick="setExpenseDrilldownTab('fact')">Факт</button><button type="button" class="${expenseDrilldownState.tab==="plan"?"active":""}" onclick="setExpenseDrilldownTab('plan')">План</button></div>
  <div class="expense-drilldown-kpis"><article><small>${expenseDrilldownState.tab==="plan"?"Запланировано":"Потрачено"}</small><strong>${money(total)}</strong><span>${allRows.length} операций</span></article><article><small>Доля от дохода</small><strong>${pct.toLocaleString("ru-RU",{maximumFractionDigits:1})}%</strong><span>Доход ${money(income)}</span></article><article><small>Показано</small><strong>${money(visibleTotal)}</strong><span>${rows.length} операций</span></article></div>
  <div class="expense-drilldown-period">${carFinancePeriodLabel(period)} · ${carFinancePeriodRangeLabel(period)}</div>
  <div class="expense-drilldown-filters">${categoryButtons}</div>
  <div class="expense-drilldown-list">${rowsHtml}</div>`
}
function openExpenseDrilldown(carId,tab="fact"){
 expenseDrilldownState={carId,tab:tab==="plan"?"plan":"fact",category:"all"};
 renderExpenseDrilldown();$("#expenseDrilldownDialog")?.showModal()
}
function setExpenseDrilldownTab(tab){expenseDrilldownState.tab=tab==="plan"?"plan":"fact";expenseDrilldownState.category="all";renderExpenseDrilldown()}
function setExpenseDrilldownCategory(category){expenseDrilldownState.category=category||"all";renderExpenseDrilldown()}
function openExpenseDrilldownEntity(kind,id){$("#expenseDrilldownDialog")?.close();openSmartEntity(kind,id,expenseDrilldownState.carId)}
function expenseDrilldownCsv(){
 const rows=expenseDrilldownAllRows(),header=["Дата","Тип","Название","Категория","Сумма"],lines=[header,...rows.map(x=>[x.date||"",x.kind||"",x.title||"",x.categoryLabel||expenseDrilldownCategoryLabel(expenseDrilldownCategoryKey(x)),Number(x.amount||0).toFixed(2)])];
 const csv=lines.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(";")).join("\n"),blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`FleetPilot_${expenseDrilldownState.tab}_${car(expenseDrilldownState.carId)?.plate||"car"}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)
}
function printExpenseDrilldown(){
 const c=car(expenseDrilldownState.carId),rows=expenseDrilldownAllRows(),total=rows.reduce((s,x)=>s+Number(x.amount||0),0),title=expenseDrilldownState.tab==="plan"?"План расходов":"Факт расходов",period=selectedCarFinancePeriod||"month";
 const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:24px}h1{margin:0 0 4px;font-size:22px}p{color:#64748b;margin:0 0 18px}.row{display:grid;grid-template-columns:110px 1fr auto;gap:14px;padding:9px 0;border-bottom:1px solid #e5e7eb}.row small{display:block;color:#64748b;margin-top:3px}.total{display:flex;justify-content:space-between;padding-top:14px;margin-top:8px;border-top:2px solid #cbd5e1;font-size:18px;font-weight:700}</style></head><body><h1>${title} · ${c?.plate||""}</h1><p>${carFinancePeriodLabel(period)} · ${carFinancePeriodRangeLabel(period)}</p>${rows.map(x=>`<div class="row"><span>${date(x.date)}</span><span><strong>${x.title||"Без названия"}</strong><small>${x.categoryLabel||expenseDrilldownCategoryLabel(expenseDrilldownCategoryKey(x))}</small></span><b>${money(x.amount)}</b></div>`).join("")}<div class="total"><span>Всего</span><strong>${money(total)}</strong></div></body></html>`;
 const frame=document.createElement("iframe");frame.style.cssText="position:fixed;width:0;height:0;border:0;right:0;bottom:0";document.body.appendChild(frame);frame.onload=()=>setTimeout(()=>{try{frame.contentWindow.focus();frame.contentWindow.print()}finally{setTimeout(()=>frame.remove(),1200)}},100);frame.srcdoc=html
}
window.openExpenseDrilldown=openExpenseDrilldown;window.setExpenseDrilldownTab=setExpenseDrilldownTab;window.setExpenseDrilldownCategory=setExpenseDrilldownCategory;window.openExpenseDrilldownEntity=openExpenseDrilldownEntity;window.expenseDrilldownCsv=expenseDrilldownCsv;window.printExpenseDrilldown=printExpenseDrilldown;

function vehicleProfileDocuments(c){
 if(!c)return[];
 const ids=new Set([c.insuranceDocumentId,c.inspectionDocumentId].filter(Boolean).map(String));
 return [...(db.documents||[])].filter(d=>String(d.carId||"")===String(c.id)||ids.has(String(d.id))).sort((a,b)=>{
  const aa=String(a.expiry||"9999-12-31"),bb=String(b.expiry||"9999-12-31");
  return aa.localeCompare(bb)
 })
}
function carTabButton(carId,tab,label,activeTab){
 const active=String(tab)===String(activeTab);
 return `<button type="button" class="${active?"active":""}" onclick="openCar('${carId}','${tab}')" aria-current="${active?"page":"false"}">${label}</button>`
}
window.carTabButton=carTabButton;

function renderCarProfileFallback(id,activeTab,error){
 const c=car(id);if(!c)return;
 const m=model(c),docs=vehicleProfileDocuments(c),safeTab=FLEETPILOT_CAR_TABS.has(activeTab)?activeTab:"info";
 console.error("FleetPilot car profile render error",error);
 showPage("carPage");
 const root=$("#carDetail");if(!root)return;
 root.innerHTML=`<div class="detail-summary ${c.status||"active"}"><div class="detail-content"><span class="status ${c.status||"active"}">${statusText(c.status||"active")}</span><h2>${m.brand} ${m.model}</h2><p>${c.plate||"Без номера"} · ${c.year||""} · ${c.city||"Город не указан"}</p></div></div><div class="car-detail-tabs">${carTabButton(c.id,"info","Обзор",safeTab)}${carTabButton(c.id,"service","Сервис",safeTab)}${carTabButton(c.id,"finance","Финансы",safeTab)}${carTabButton(c.id,"documents","Документы",safeTab)}${carTabButton(c.id,"history","История",safeTab)}${carTabButton(c.id,"damages","Повреждения",safeTab)}</div><div class="card"><h3>Профиль автомобиля</h3><p>Основные данные автомобиля загружены. Один из дополнительных виджетов не смог отрисоваться.</p><div class="vehicle-core-actions"><button class="btn primary" onclick="openMileage('${c.id}')">Обновить пробег</button><button class="btn" onclick="openRepairDialog('${c.id}')">Запланировать ремонт</button></div>${safeTab==="documents"?`<div class="profile-fallback-documents"><h4>Документы</h4>${docs.map(d=>`<button class="inline-entity-link" onclick="openDocumentDialog('', '${d.id}')">${d.title||documentTypeText(d.type)} · ${d.expiry?date(d.expiry):"без срока"}</button>`).join("")||"Документов нет"}</div>`:""}</div>`;
 toast("Профиль открыт в безопасном режиме")
}
function renderCarProfile(id,activeTab="info"){
 try{return renderCarProfileCore(id,activeTab)}catch(error){return renderCarProfileFallback(id,activeTab,error)}
}
window.renderCarProfile=renderCarProfile;

function openCar(id,activeTab="info"){
 const target=car(id);
 if(!target){toast("Автомобиль не найден");return}
 const tab=FLEETPILOT_CAR_TABS.has(activeTab)?activeTab:"info";
 selectedCarId=target.id;
 showPage("carPage");
 renderCarProfile(target.id,tab);
 if(fleetPilotRouteReady&&!fleetPilotApplyingRoute)fleetPilotSetRoute(fleetPilotCarRoute(target.id,tab));
 requestAnimationFrame(()=>{try{window.scrollTo({top:0,left:0,behavior:"auto"})}catch{window.scrollTo(0,0)}})
}
window.openCar=openCar;

function renderCarProfileCore(id,activeTab="info"){
 if(isSimpleMode()&&!simpleModeCarTab(activeTab))activeTab="info";
 selectedCarId=id;
 const c=car(id),m=model(c),payments=db.payments.filter(x=>x.carId===id),received=payments.reduce((s,x)=>s+x.received,0),debt=payments.reduce((s,x)=>s+Math.max(0,x.expected-x.received),0),rep=db.repairs.filter(x=>x.carId===id),exp=db.expenses.filter(x=>x.carId===id),docs=vehicleProfileDocuments(c),monthProfit=financialData("month",c.id).finalProfit,forecast=forecastService(c);
 const tire=carTireSnapshot(c);
 const effectiveStatus=vehicleEffectiveStatus(c),healthScore=vehicleHealthScore(c);
 const lastCompleted=[...rep].filter(r=>r.status==="done").sort((a,b)=>String(b.completedDate||b.date||"").localeCompare(String(a.completedDate||a.date||"")))[0];
 const vehicleCore=`<section class="vehicle-core-overview">
   <div class="vehicle-core-main">
    <div><span class="eyebrow">Vehicle Core</span><h3>Состояние автомобиля</h3><p>${statusText(effectiveStatus)} · ${(window.fleetDriverLabel?.(c)||c.tenant||"Без водителя")} · ${c.city||"Город не указан"}</p></div>
    <div class="vehicle-health-score ${healthScore.score<60?"danger":healthScore.score<80?"warning":"good"}"><small>Health Score</small><strong>${healthScore.score}</strong><span>/100</span></div>
   </div>
   <div class="vehicle-core-kpis">
    <div class="vehicle-core-kpi"><small>Пробег</small><strong>${km(c.mileage)}</strong></div>
    <div class="vehicle-core-kpi ${oil(c)<=0?"danger":oil(c)<=1500?"warning":"good"}"><small>Масло</small><strong>${oil(c)<=0?"Просрочено":km(oil(c))}</strong></div>
    <div class="vehicle-core-kpi ${days(c.insurance)<0?"danger":days(c.insurance)<=30?"warning":"good"}"><small>Страховка до</small><strong>${c.insurance?date(c.insurance):"—"}</strong></div>
    <div class="vehicle-core-kpi ${days(c.inspection)<0?"danger":days(c.inspection)<=30?"warning":"good"}"><small>Техосмотр до</small><strong>${c.inspection?date(c.inspection):"—"}</strong></div>
    <div class="vehicle-core-kpi ${rep.filter(r=>!["done","cancelled"].includes(String(r.status||""))).length?"warning":"good"}"><small>Активный сервис</small><strong>${rep.filter(r=>!["done","cancelled"].includes(String(r.status||""))).length}</strong></div>
    <div class="vehicle-core-kpi"><small>Последнее обслуживание</small><strong>${lastCompleted?date(lastCompleted.completedDate||lastCompleted.date):"—"}</strong></div>
   </div>
   <div class="vehicle-core-actions"><button class="btn primary" onclick="openMileage('${c.id}')">Обновить пробег</button>${isSimpleMode()?"":`<button class="btn" onclick="openRepairDialog('${c.id}')">Запланировать ремонт</button>`}</div>
  </section>`;
 const upcomingRepairs=rep.filter(x=>!["done","cancelled"].includes(String(x.status||""))).sort((a,b)=>String(a.date||"9999-12-31").localeCompare(String(b.date||"9999-12-31")));
 const info=`${vehicleCore}<div class="detail-tab-grid"><div class="card car-operation-card"><div class="card-title-row"><div><span class="eyebrow">Эксплуатация</span><h3>Шины и сезонность</h3></div><button class="btn" onclick="openCarDialog('${c.id}')">Изменить</button></div><div class="car-operation-grid"><div><small>Сезон</small><strong>${tireSeasonText(c.tireSeason)}</strong></div><div><small>Размер</small><strong>${c.tireSize||"Не указан"}</strong></div><div><small>Установлены</small><strong>${c.tireInstalled?date(c.tireInstalled):"—"}</strong></div><div><small>Пробег на комплекте</small><strong>${tire.usedKm===null?"—":km(tire.usedKm)}</strong></div></div>${tire.planned?`<button class="car-operation-alert" onclick="openSmartEntity('expense','${tire.planned.id}','${c.id}')"><span>Ближайшая задача по шинам</span><strong>${tire.planned.title} · ${date(tire.planned.date)}</strong><b>${money(tire.planned.amount)}</b></button>`:tire.paid?`<div class="car-operation-note"><span>Последняя операция</span><strong>${tire.paid.title} · ${date(tire.paid.date)}</strong></div>`:`<div class="car-operation-note"><span>История шин</span><strong>Записей пока нет</strong></div>`}</div><div class="card"><h3>Прогноз обслуживания</h3>${forecast?`<div class="service-forecast"><div><small>Осталось</small><strong>${km(forecast.remainingKm)}</strong></div><div><small>В среднем за день</small><strong>${km(forecast.averageDailyKm)}</strong></div><div><small>Ориентировочно</small><strong>${forecast.days} дн.</strong></div></div><p class="forecast-note">${forecast.confidence==="limited"?"Предварительный прогноз — пока мало записей пробега.":"Расчёт по медиане последних записей пробега."}</p>`:"<p>Недостаточно корректной истории пробега для прогноза.</p>"}</div><div class="card"><h3>Ближайшие ремонты</h3>${upcomingRepairs.slice(0,6).map(x=>`<p><button class="inline-entity-link" onclick="openSmartEntity('repair','${x.id}','${c.id}')">${date(x.date)} · ${x.title} · ${money(x.planned)}</button></p>`).join("")||"Нет запланированных ремонтов"}</div></div>`;
 const serviceActive=rep.filter(x=>!["done","cancelled"].includes(String(x.status||"")));
 const serviceHistory=rep.filter(x=>["done","cancelled"].includes(String(x.status||""))).sort((a,b)=>String(b.completedDate||b.date||"").localeCompare(String(a.completedDate||a.date||"")));
 const carRequests=activeDriverRepairRequests().filter(x=>String(x.car_id)===String(c.id));
 const carPlannedServiceExpenses=plannedServiceExpenses(c.id);
 const service=`<div class="car-service-profile">
  <div class="car-service-profile-head">
   <div><span class="eyebrow">История обслуживания</span><h3>Сервис автомобиля</h3><p>Активные технические задачи и выполненные ремонты по этому автомобилю.</p></div>
   <button class="btn primary" onclick="openRepairDialog('${c.id}')">+ Добавить ремонт</button>
  </div>
  <div class="car-service-kpis">
   <div><span>Активные задачи</span><strong>${serviceActive.length+carRequests.length+carPlannedServiceExpenses.length}</strong></div>
   <div><span>Выполнено ремонтов</span><strong>${serviceHistory.filter(x=>x.status==="done").length}</strong></div>
   <div><span>Расходы на ремонт</span><strong>${money(rep.filter(x=>x.status==="done").reduce((s,x)=>s+Number(x.actual||0),0))}</strong></div>
   <div><span>Последний ремонт</span><strong>${serviceHistory[0]?date(serviceHistory[0].completedDate||serviceHistory[0].date):"—"}</strong></div>
  </div>

  ${(carRequests.length||serviceActive.length)?`<section class="car-service-section">
   <div class="car-service-section-head"><div><span class="eyebrow">Сейчас</span><h4>Активные задачи</h4></div><span>${carRequests.length+serviceActive.length}</span></div>
   <div class="car-service-timeline active">
    ${carRequests.map(req=>`<article class="car-service-entry request">
      <div class="car-service-dot"></div>
      <div class="car-service-entry-main">
       <div class="car-service-entry-title"><strong>${DRIVER_REPAIR_CATEGORY_LABELS[req.category]||req.category||"Заявка водителя"}</strong><span class="car-service-entry-status request">${req.status==="accepted"?"Принята":"Новая"}</span></div>
       <p>${req.description||"Без описания"}</p>
       <div class="car-service-entry-meta"><span>${new Date(req.created_at).toLocaleDateString("ru-RU")}</span><span>${km(req.mileage)}</span><span>${req.driver_email||"Водитель"}</span></div>
      </div>
      <button class="car-service-open" onclick="openRepairFromFleetRequest('${req.id}')" title="Открыть заявку">${fpUiIcon("arrow")}</button>
     </article>`).join("")}
    ${serviceActive.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).map(r=>`<article class="car-service-entry ${serviceStatusClass(r.status)}">
      <div class="car-service-dot"></div>
      <div class="car-service-entry-main">
       <div class="car-service-entry-title"><strong>${r.title}</strong><span class="car-service-entry-status ${serviceStatusClass(r.status)}">${repairStatusText(r.status)}</span></div>
       <p>${r.service||"Сервис не указан"}${r.note?` · ${r.note}`:""}</p>
       <div class="car-service-entry-meta"><span>${serviceTypeText(inferRepairServiceType(r))}</span><span>${date(r.date)}</span><span>${km(r.mileage)}</span><span>${serviceRepairCostMeta(r)}</span>${serviceLinkedExpense(r)?`<span>${expenseStatusText(serviceLinkedExpense(r).status)}</span>`:""}</div>
      </div>
      <button class="car-service-open" onclick="openSmartEntity('repair','${r.id}','${c.id}')" title="Открыть в сервисе">${fpUiIcon("arrow")}</button>
     </article>`).join("")}
   </div>
  </section>`:""}

  ${carPlannedServiceExpenses.length?`<section class="car-service-section car-planned-expenses-section">
   <div class="car-service-section-head"><div><span class="eyebrow">Планирование</span><h4>Плановые сервисные расходы</h4></div><span>${carPlannedServiceExpenses.length}</span></div>
   <div class="car-service-timeline planned-expenses">
    ${carPlannedServiceExpenses.map(x=>`<article class="car-service-entry planned">
      <div class="car-service-dot"></div>
      <div class="car-service-entry-main">
       <div class="car-service-entry-title"><strong>${x.title}</strong><span class="car-service-entry-status planned">Запланировано</span></div>
       <p>${expenseCategoryText(x.category)}${x.note?` · ${x.note}`:""}</p>
       <div class="car-service-entry-meta"><span>${date(x.date)}</span><span>${money(x.amount)}</span></div>
      </div>
      <button class="car-service-open" onclick="openSmartEntity('expense','${x.id}','${c.id}')" title="Открыть расход">${fpUiIcon("arrow")}</button>
     </article>`).join("")}
   </div>
  </section>`:""}

  <section class="car-service-section">
   <div class="car-service-section-head"><div><span class="eyebrow">История</span><h4>Завершённые ремонты</h4></div><span>${serviceHistory.length}</span></div>
   <div class="car-service-timeline history">
    ${serviceHistory.map(r=>`<article class="car-service-entry ${r.status==="done"?"done":"cancelled"}">
      <div class="car-service-dot"></div>
      <div class="car-service-entry-main">
       <div class="car-service-entry-title"><strong>${r.title}</strong><span class="car-service-entry-status ${r.status==="done"?"done":"cancelled"}">${repairStatusText(r.status)}</span></div>
       <p>${r.service||"Сервис не указан"}${r.note?` · ${r.note}`:""}</p>
       <div class="car-service-entry-meta">
        <span>${serviceTypeText(inferRepairServiceType(r))}</span>
        <span>${date(r.completedDate||r.date)}</span>
        <span>${km(r.mileage)}</span>
        <span>${money(r.actual||r.planned||0)}</span>
        ${r.warrantyUntil?`<span>Гарантия до ${date(r.warrantyUntil)}</span>`:""}
        ${serviceLinkedExpense(r)?`<button class="inline-entity-link" onclick="event.stopPropagation();openSmartEntity('expense','${serviceLinkedExpense(r).id}','${c.id}')">Расход ${money(serviceLinkedExpense(r).amount)}</button>`:""}
       </div>
      </div>
      <button class="car-service-open" onclick="openSmartEntity('repair','${r.id}','${c.id}')" title="Открыть в сервисе">${fpUiIcon("arrow")}</button>
     </article>`).join("")||`<div class="professional-empty">История ремонтов пока пустая.</div>`}
   </div>
  </section>
 </div>`;
 const financePeriod=selectedCarFinancePeriod||"month";
 const financeData=financialData(financePeriod,c.id);
 const financePlan=plannedFinanceForCar(c.id,financePeriod);
 const operatingResult=financeData.grossRevenue-financeData.grossCosts;
 const forecastAfterPlan=financeData.finalProfit-financePlan.total;
 const paidRows=exp.filter(x=>x.status==="paid"&&x.date&&inPeriod(x.date,periodBounds(financePeriod))).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
 const finance=`<div class="car-finance-dashboard">
  <div class="car-finance-toolbar">
   <div><span class="eyebrow">Финансы автомобиля</span><h3>${carFinancePeriodLabel(financePeriod)}</h3><p>Фактические и плановые деньги без двойного учёта связанных ремонтов.</p></div>
   <div class="car-finance-periods">
    ${["month","quarter","year"].map(p=>`<button type="button" class="${financePeriod===p?"active":""}" onclick="setCarFinancePeriod('${p}')">${carFinancePeriodLabel(p)}</button>`).join("")}
   </div>
  </div>
  <div class="car-finance-kpis">
   <article class="income"><small>Получено</small><strong>${money(financeData.grossRevenue)}</strong><span>ожидается ${money(financeData.expectedRevenue)}</span></article>
   <article class="expense interactive" role="button" tabindex="0" onclick="openExpenseDrilldown('${c.id}','fact')"><small>Факт расходов <i>ⓘ</i></small><strong>${money(financeData.grossCosts)}</strong><span>${financeData.grossRevenue>0?(financeData.grossCosts/financeData.grossRevenue*100).toLocaleString("ru-RU",{maximumFractionDigits:1}):"0"}% дохода · открыть состав</span></article>
   <article class="planned interactive" role="button" tabindex="0" onclick="openExpenseDrilldown('${c.id}','plan')"><small>План расходов <i>ⓘ</i></small><strong>${money(financePlan.total)}</strong><span>${financeData.grossRevenue>0?(financePlan.total/financeData.grossRevenue*100).toLocaleString("ru-RU",{maximumFractionDigits:1}):"0"}% дохода · ${financePlan.rows.length} записей</span></article>
   <article class="result ${financeData.finalProfit<0?"negative":"positive"}"><small>Чистый результат</small><strong>${money(financeData.finalProfit)}</strong><span>операционно ${money(operatingResult)}</span></article>
  </div>
  <div class="car-finance-grid car-finance-masonry">
   <div class="car-finance-column">
   <section class="card car-finance-breakdown">
    <div class="section-head"><div><span class="eyebrow">Факт</span><h3>Структура результата</h3></div><button class="btn primary" onclick="openPaymentDialog('${c.id}')">+ Оплата</button></div>
    <div class="car-finance-lines">
     <div><span>Полученная аренда</span><strong>${money(financeData.grossRevenue)}</strong></div>
     <div><span>Сервис и ремонты</span><strong>− ${money(financeData.repairGross)}</strong></div>
     <div><span>Остальные расходы</span><strong>− ${money(financeData.otherGross)}</strong></div>
     <div><span>VAT</span><strong>− ${money(financeData.vatDue)}</strong></div>
     <div><span>PIT</span><strong>− ${money(financeData.pit)}</strong></div>
     <div><span>Взносы</span><strong>− ${money(financeData.contributions)}</strong></div>
     <div class="total"><span>Чистый результат</span><strong>${money(financeData.finalProfit)}</strong></div>
    </div>
   </section>
   <section class="card"><h3>Аренда</h3><div class="detail-stat-grid"><div><small>Ставка за неделю</small><strong>${money(c.weeklyRent)}</strong></div><div><small>Порядок оплаты</small><strong>${paymentTimingText(c.paymentTiming||"advance")}</strong></div><div><small>Получено всего</small><strong>${money(received)}</strong></div><div><small>Текущий долг</small><strong>${money(debt)}</strong></div></div></section>
   <section class="card"><div class="section-head"><h3>Кауция водителя</h3><button class="btn primary" onclick="openDepositDialog('${c.id}')">+ Платёж</button></div>${renderDepositChart(c.id)}<div class="deposit-history">${renderDepositRows(c.id)}</div></section>
   </div>
   <div class="car-finance-column">
   <section class="card car-finance-plan">
    <div class="section-head"><div><span class="eyebrow">План</span><h3>Будущие расходы</h3></div><button class="btn" onclick="openExpenseDialog('${c.id}')">+ Запланировать</button></div>
    <div class="car-finance-plan-summary"><span>После текущего плана</span><strong class="${forecastAfterPlan<0?"negative":"positive"}">${money(forecastAfterPlan)}</strong></div>
    <div class="car-finance-plan-list">${financePlan.rows.slice(0,8).map(x=>`<button type="button" onclick="openSmartEntity('${x.kind}','${x.id}','${c.id}')"><span><strong>${x.title}</strong><small>${date(x.date)} · ${x.category}</small></span><b>${money(x.amount)}</b>${fpUiIcon("arrow")}</button>`).join("")||`<div class="professional-empty">На выбранный период плановых расходов нет.</div>`}</div>
   </section>
   <section class="card"><h3>Себестоимость и окупаемость</h3>${renderOwnership(c)}</section>
   <section class="card car-expense-preview"><div class="section-head"><h3>Фактические расходы периода</h3><button class="btn" onclick="showPage('expensesPage')">Все расходы</button></div>${paidRows.slice(0,8).map(x=>`<button type="button" class="car-expense-preview-row" onclick="openSmartEntity('expense','${x.id}','${c.id}')"><span class="fp-standard-icon">${fpUiIcon(x.category==="repair"?"repair":x.category==="insurance"?"insurance":x.category==="inspection"?"inspection":x.category==="tires"?"tires":"expense")}</span><span><strong>${x.title}</strong><small>${date(x.date)} · ${expenseCategoryText(x.category)}</small></span><b>${money(x.amount)}</b><i>${fpUiIcon("arrow")}</i></button>`).join("")||`<div class="professional-empty">Фактических расходов за период нет.</div>`}</section>
   </div>
  </div>
 </div>`;
 const history=`<div class="detail-tab-grid">
  <div class="card"><div class="section-head"><div><span class="eyebrow">Vehicle Handover</span><h3>История выдачи и возврата</h3></div></div><div id="vehicleHandoverHistory"></div></div>
  <div class="card"><div class="section-head"><h3>Лента событий</h3></div><div class="timeline">${renderTimeline(c.id)}</div></div>
 </div>`;
 const documents=`<div class="detail-tab-grid"><div class="card profile-documents-card"><div class="section-head"><div><span class="eyebrow">Единый реестр</span><h3>Документы автомобиля</h3><p>Одна запись для профиля и общего раздела «Документы».</p></div><button class="btn primary" onclick="openDocumentDialog('${c.id}')">+ Добавить документ</button></div><p class="profile-document-sync-note">Страховка и ТО автоматически обновляют Vehicle Core. Лизинг, кредит, договоры, техпаспорт и другие файлы сохраняются здесь и одновременно в общем реестре.</p>${docs.map(d=>{const st=fpDocumentState(d);return `<div class="detail-document-row profile-document-row" data-document-id="${d.id}"><button type="button" class="profile-document-main" onclick="openDocumentDialog('', '${d.id}')"><div><strong>${d.title||documentTypeText(d.type)||"Документ"}</strong><small>${documentTypeText(d.type)}${d.number?` · № ${d.number}`:""}${d.expiry?` · до ${date(d.expiry)}`:" · без срока"}</small></div><span class="professional-status ${st.key}">${st.label}</span></button><div class="profile-document-actions"><b>${money(d.cost||0)}</b>${d.fileId?`<button type="button" class="btn" onclick="openDocumentAttachment('${d.fileId}','${String(d.title||"Документ").replaceAll("'","&#39;")}')">Файл</button>`:""}</div></div>`}).join("")||`<div class="professional-empty"><strong>Документов пока нет.</strong><span>Добавьте страховку, ТО, лизинг, договор или другой документ — он сразу появится и в общем реестре.</span><button class="btn primary" onclick="openDocumentDialog('${c.id}')">+ Добавить документ</button></div>`}</div><div class="card"><h3>Страховка в рассрочку</h3>${docs.filter(d=>d.type==="insurance"&&d.paymentMode==="installments").map(d=>{const s=installmentSummary(d);return `<button type="button" class="inline-entity-link profile-installment-link" onclick="openDocumentDialog('', '${d.id}')">${d.title}: оплачено ${money(s.paid)}, осталось ${money(s.left)}${s.next?`, следующая рата ${date(s.next.due)}`:""}</button>`}).join("")||"Нет страховых рат"}</div></div>`;
 const damages=`<div class="card"><div class="section-head"><h3>Повреждения</h3><button class="btn primary" onclick="openDamageDialog('${c.id}')">+ Добавить</button></div><div class="damage-gallery">${renderDamageGallery(c.id)}</div></div>`;
 const tabContent={info,service,finance,history,documents,damages}[activeTab]||info;
 showPage("carPage");
 $("#carDetail").innerHTML=`<div class="detail-summary ${attention(c)?"attention":effectiveStatus} ${c.customPhoto?"has-custom-photo":""}">${c.customPhoto?`<img class="detail-custom-photo" src="${c.customPhoto}" alt="${m.brand} ${m.model}"><div class="detail-photo-shade"></div>`:""}<div class="detail-content"><span class="status ${attention(c)?"attention":effectiveStatus}">${attention(c)?"Требует внимания":statusText(effectiveStatus)}</span><h2>${m.brand} ${m.model}</h2><p>${c.plate} · ${c.year} · ${c.city||"Город не указан"} · ${(window.fleetDriverLabel?.(c)||c.tenant||"Без водителя")}</p></div><div class="detail-summary-profit"><small>Прибыль месяца</small><strong>${money(monthProfit)}</strong></div></div><div class="car-detail-tabs">${carTabButton(c.id,"info","Обзор",activeTab)}${carTabButton(c.id,"service","Сервис",activeTab)}${carTabButton(c.id,"finance","Финансы",activeTab)}${carTabButton(c.id,"documents","Документы",activeTab)}${carTabButton(c.id,"history","История",activeTab)}${carTabButton(c.id,"damages","Повреждения",activeTab)}</div><div class="car-tab-content">${tabContent}</div><div class="card car-management-card"><button class="btn" onclick="copyCurrentCarLink('${c.id}','${activeTab}')">🔗 Скопировать ссылку</button><button class="btn" onclick="toggleFavorite('${c.id}')">${c.favorite?"★ Убрать из избранного":"☆ В избранное"}</button><button class="btn" onclick="openCarDialog('${c.id}')">Редактировать автомобиль</button>${isSimpleMode()?"":`<button class="btn archive-btn" onclick="toggleArchive('${c.id}')">${c.archived?"Вернуть из архива":"Переместить в архив"}</button><button class="btn danger" onclick="deleteCar('${c.id}')">Удалить автомобиль</button>`}</div>`
 if(activeTab==="history")loadVehicleHandoverHistory(c.id);
}
function requireFleetCar(){if(fleetCars().length)return true;toast("Сначала добавьте автомобиль в автопарк");return false}
function modelOptions(sel=""){const grouped={};Object.entries(MODELS).forEach(([k,m])=>{(grouped[m.brand]||(grouped[m.brand]=[])).push([k,m])});return Object.keys(grouped).sort((a,b)=>a.localeCompare(b,"pl")).map(brand=>`<optgroup label="${brand}">${grouped[brand].sort((a,b)=>a[1].model.localeCompare(b[1].model,"pl")).map(([k,m])=>`<option value="${k}" ${k===sel?"selected":""}>${m.model}${m.years?` (${m.years})`:""}</option>`).join("")}</optgroup>`).join("")+`<optgroup label="Другое"><option value="__custom__" ${sel==="__custom__"?"selected":""}>＋ Добавить свою марку и модель</option></optgroup>`}
function toggleCustomModelFields(){const custom=$("#carModelKey").value==="__custom__";$("#customModelFields").hidden=!custom;$("#carCustomBrand").required=custom;$("#carCustomModel").required=custom}

let pendingCarPhoto="";
async function compressCarPhoto(file){
 if(!file)return"";
 if(!file.type.startsWith("image/"))throw new Error("Выбранный файл не является изображением");
 if(file.size>12*1024*1024)throw new Error("Файл слишком большой. Максимум 12 МБ");
 const source=await new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(new Error("Не удалось прочитать фотографию"));
  reader.readAsDataURL(file)
 });
 const image=await new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(new Error("Не удалось открыть фотографию"));
  img.src=source
 });
 const maxWidth=1280,maxHeight=800;
 const scale=Math.min(1,maxWidth/image.width,maxHeight/image.height);
 const width=Math.max(1,Math.round(image.width*scale));
 const height=Math.max(1,Math.round(image.height*scale));
 const canvas=document.createElement("canvas");
 canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext("2d");
 ctx.fillStyle="#ffffff";ctx.fillRect(0,0,width,height);
 ctx.drawImage(image,0,0,width,height);
 return canvas.toDataURL("image/jpeg",.82)
}
function renderCarPhotoPreview(){
 const box=$("#carPhotoPreview");
 if(!box)return;
 box.innerHTML=pendingCarPhoto
  ?`<img src="${pendingCarPhoto}" alt="Предпросмотр автомобиля">`
  :`<span>📷</span><small>Фотография автомобиля не выбрана</small>`;
 $("#removeCarPhoto").disabled=!pendingCarPhoto
}

function openCarDialog(id=""){if(!requireEnterprisePermission(id?"cars.edit":"cars.create"))return;const c=id?car(id):null,custom=Boolean(c&&(c.customBrand||c.customModel));$("#carId").value=c?.id||"";$("#carModelKey").innerHTML=modelOptions(custom?"__custom__":(c?.modelKey||"toyota-prius-3"));$("#carModelKey").value=custom?"__custom__":(c?.modelKey||"toyota-prius-3");$("#carCustomBrand").value=c?.customBrand||"";$("#carCustomModel").value=c?.customModel||"";toggleCustomModelFields();$("#carYear").value=c?.year||new Date().getFullYear();$("#carPlate").value=c?.plate||"";$("#carVin").value=c?.vin||"";$("#carTenant").value=c?.tenant||"";$("#carStatus").value=c?.status||"active";$("#carMileage").value=c?.mileage||0;$("#carOilInterval").value=c?.oilInterval||10000;$("#carLastOil").value=c?.lastOil||0;$("#carCity").value=c?.city||"";refreshCityControls();$("#carWeeklyRent").value=c?.weeklyRent||700;$("#carPaymentTiming").value=c?.paymentTiming||"advance";$("#carDepositTarget").value=c?.depositTarget||0;$("#carPurchasePrice").value=c?.purchasePrice||"";$("#carPurchaseDate").value=c?.purchaseDate||"";$("#carInsurance").value=c?.insurance||addDays(today(),365);$("#carInspection").value=c?.inspection||addDays(today(),365);$("#carTireSeason").value=c?.tireSeason||"";$("#carTireSize").value=c?.tireSize||"";$("#carTireInstalled").value=c?.tireInstalled||"";$("#carTireMileage").value=c?.tireMileage||"";pendingCarPhoto=c?.customPhoto||"";$("#carPhotoFile").value="";renderCarPhotoPreview();window.prepareCarDriverPicker?.(c);$("#carDialog").showModal()}

function quickServiceDefaults(type){
 return{
  oil:{title:"Замена масла",expenseTitle:"Замена масла",category:"repair",provider:"Сервис",nextDays:0},
  insurance:{title:"Продлить страховку",expenseTitle:"Страховка",category:"insurance",provider:"Страховая компания",nextDays:365},
  inspection:{title:"Продлить техосмотр",expenseTitle:"Техосмотр",category:"inspection",provider:"Станция техосмотра",nextDays:365}
 }[type]
}

function openQuickService(carId,type){
 const c=car(carId),cfg=quickServiceDefaults(type);
 if(!c||!cfg)return;
 $("#quickServiceCarId").value=carId;
 $("#quickServiceType").value=type;
 $("#quickServiceTitle").textContent=cfg.title;
 $("#quickServiceCarInfo").innerHTML=`<strong>${model(c).brand} ${model(c).model}</strong><span>${c.plate} · ${km(c.mileage)}</span>`;
 $("#quickServiceDate").value=today();
 $("#quickServiceCost").value="";
 $("#quickServiceProvider").value="";
 $("#quickServiceNote").value="";
 $("#quickServiceAddExpense").checked=true;
 $("#quickServiceDateSection").hidden=type==="oil";
 $("#quickServiceOilSection").hidden=type!=="oil";
 $("#quickServiceProviderLabel").firstChild.textContent=cfg.provider;
 if(type==="oil"){
  $("#quickServiceMileage").value=c.mileage;
  $("#quickServiceOilInterval").value=c.oilInterval||10000;
  $("#quickServiceExpiry").value="";
 }else{
  const current=type==="insurance"?c.insurance:c.inspection;
  const base=current&&days(current)>0?current:today();
  $("#quickServiceExpiry").value=addDays(base,365);
 }
 updateQuickServicePreview();
 $("#quickServiceDialog").showModal()
}

function updateQuickServicePreview(){
 const type=$("#quickServiceType").value,c=car($("#quickServiceCarId").value),cost=Number($("#quickServiceCost").value||0);
 if(!c)return;
 if(type==="oil"){
  const mileage=Number($("#quickServiceMileage").value||c.mileage),interval=Number($("#quickServiceOilInterval").value||c.oilInterval||10000);
  $("#quickServicePreview").innerHTML=`После сохранения следующая замена будет через <strong>${km(interval)}</strong>, ориентировочно на пробеге <strong>${km(mileage+interval)}</strong>${cost?` · расход ${money(cost)}`:""}.`
 }else{
  const label=type==="insurance"?"Страховка":"Техосмотр",expiry=$("#quickServiceExpiry").value;
  $("#quickServicePreview").innerHTML=`${label} будет действовать до <strong>${date(expiry)}</strong>${cost?` · расход ${money(cost)}`:""}.`
 }
}

function addQuickServiceExpense(carId,title,category,dateValue,cost,note){
 if(!cost)return;
 const obj={id:uid(),carId,title,category,date:dateValue,amount:Number(cost),status:"paid",note};
 db.expenses.push(obj);
 addTimeline(carId,"expense",title,-Number(cost),dateValue,"Оплачен");
 logActivity("Добавлен расход","Расходы",`${title} · ${money(cost)}`,carId)
}

function serviceSuccessAnimation(carId,type,message){
 toast(message);
 requestAnimationFrame(()=>{
  const selector=`[onclick*="openQuickService('${carId}','${type}')"]`;
  const card=$(selector);
  if(card){
   card.classList.add("service-updated");
   setTimeout(()=>card.classList.remove("service-updated"),900)
  }
 })
}

function openMileage(id){const c=car(id);$("#mileageCarId").value=id;$("#newMileage").value=c.mileage;$("#mileageDate").value=today();$("#mileageInfo").textContent=`${model(c).brand} ${model(c).model} · ${c.plate} · до масла ${km(Math.max(0,oil(c)))}`;$("#mileageDialog").showModal()}
let repairEditorParts=[];
let repairEditorChecklist=[];
let repairEditorPhotos={before:[],after:[]};
function repairSafe(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function renderRepairPartsEditor(){
 const host=$("#repairPartsEditor");if(!host)return;
 host.innerHTML=repairEditorParts.length?repairEditorParts.map((part,index)=>`<div class="repair-part-row"><input value="${repairSafe(part.name)}" placeholder="Название / артикул" oninput="repairEditorParts[${index}].name=this.value"><input type="number" min="1" step="1" value="${Number(part.qty||1)}" aria-label="Количество" oninput="repairEditorParts[${index}].qty=Math.max(1,Number(this.value||1));updateRepairCalculatedTotal()"><input type="number" min="0" step="0.01" value="${Number(part.price||0)}" placeholder="Цена" oninput="repairEditorParts[${index}].price=Number(this.value||0);updateRepairCalculatedTotal()"><button type="button" class="repair-row-remove" onclick="repairEditorParts.splice(${index},1);renderRepairPartsEditor();updateRepairCalculatedTotal()">✕</button></div>`).join(""):`<div class="repair-editor-empty">Запчасти пока не добавлены</div>`;
 updateRepairCalculatedTotal()
}
function renderRepairChecklistEditor(){
 const host=$("#repairChecklistEditor");if(!host)return;
 host.innerHTML=repairEditorChecklist.length?repairEditorChecklist.map((item,index)=>`<label class="repair-check-row"><input type="checkbox" ${item.done?"checked":""} onchange="repairEditorChecklist[${index}].done=this.checked"><input value="${repairSafe(item.text)}" placeholder="Что нужно выполнить" oninput="repairEditorChecklist[${index}].text=this.value"><button type="button" class="repair-row-remove" onclick="repairEditorChecklist.splice(${index},1);renderRepairChecklistEditor()">✕</button></label>`).join(""):`<div class="repair-editor-empty">Добавьте этапы работ, чтобы ничего не забыть</div>`
}
function renderRepairPhotos(){
 for(const type of ["before","after"]){const host=$(type==="before"?"#repairPhotosBefore":"#repairPhotosAfter");if(!host)continue;const list=repairEditorPhotos[type]||[];host.innerHTML=list.length?list.map((src,index)=>`<figure class="repair-photo-item"><img src="${src}" alt="Фото ${type==="before"?"до":"после"} ремонта"><button type="button" onclick="repairEditorPhotos.${type}.splice(${index},1);renderRepairPhotos()">✕</button></figure>`).join(""):`<div class="repair-photo-empty">Нет фото</div>`}
}
function updateRepairCalculatedTotal(){
 const parts=repairEditorParts.reduce((sum,p)=>sum+Number(p.qty||1)*Number(p.price||0),0),labor=Number($("#repairLaborCost")?.value||0),total=parts+labor;
 if($("#repairPartsTotal"))$("#repairPartsTotal").textContent=money(parts);if($("#repairCalculatedTotal"))$("#repairCalculatedTotal").textContent=money(total)
}
function repairHistoryLabel(key,value){
 if(key==="status")return `Статус → ${repairStatusText(value)}`;if(key==="priority")return `Приоритет → ${servicePriorityText(value)}`;if(key==="mechanic")return `Исполнитель → ${value||"не назначен"}`;if(key==="actual")return `Фактическая сумма → ${money(Number(value||0))}`;if(key==="planned")return `Плановая сумма → ${money(Number(value||0))}`;return `Изменено: ${key}`
}
function renderRepairHistory(repair){
 const host=$("#repairHistory");if(!host)return;const history=Array.isArray(repair?.history)?repair.history:[];
 const rows=[...(repair?.id?[{at:repair.createdAt||repair.date||today(),text:"Задача создана"}]:[]),...history].slice(-25).reverse();
 host.innerHTML=rows.length?rows.map(row=>`<div class="repair-history-row"><span></span><div><strong>${repairSafe(row.text||"Изменение")}</strong><small>${row.at?new Date(row.at.length<=10?row.at+"T12:00:00":row.at).toLocaleString("ru-RU"):"—"}</small></div></div>`).join(""):`<div class="repair-editor-empty">История появится после сохранения задачи</div>`
}
function updateRepairCarMeta(){const c=car($("#repairCarId")?.value);if(!c||!$("#repairCarMeta"))return;const m=model(c);$("#repairCarMeta").textContent=`${m.brand} ${m.model} · ${c.plate} · ${km(c.mileage)}`}
async function compressRepairPhoto(file){
 const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
 const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=source});
 const max=1280,scale=Math.min(1,max/Math.max(img.width,img.height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL("image/jpeg",.76)
}
async function addRepairPhotos(type,files){
 const target=repairEditorPhotos[type]||(repairEditorPhotos[type]=[]),room=Math.max(0,4-target.length);if(!room)return toast("Можно сохранить до 4 фото в каждом блоке");
 for(const file of [...files].slice(0,room)){if(!file.type.startsWith("image/"))continue;if(file.size>12*1024*1024){toast("Слишком большое фото пропущено");continue}try{target.push(await compressRepairPhoto(file))}catch(error){console.warn("Repair photo",error);toast("Не удалось обработать одно из фото")}}renderRepairPhotos()
}
function openRepairDialog(carId="",id=""){if(!requireEnterprisePermission(id?"service.edit":"service.create"))return;
 if(!requireFleetCar())return;
 const r=id?db.repairs.find(v=>v.id===id):null,selected=r?.carId||carId||fleetCars()[0]?.id||"";
 if(!selected)return toast("Сначала добавьте автомобиль");
 const latestMileage=currentConfirmedMileage(selected);
 repairEditorParts=structuredClone(Array.isArray(r?.parts)?r.parts:[]);
 repairEditorChecklist=structuredClone(Array.isArray(r?.checklist)?r.checklist:[]);
 repairEditorPhotos={before:[...(r?.photosBefore||[])],after:[...(r?.photosAfter||[])]};
 const setValue=(id,value)=>{const el=$(id);if(el)el.value=value??""};
 const setHtml=(id,value)=>{const el=$(id);if(el)el.innerHTML=value??""};
 setValue("#repairId",r?.id||"");
 setHtml("#repairCarId",opts(selected));
 setValue("#repairTitle",r?.title||"");
 setValue("#repairServiceType",r?.serviceType||inferRepairServiceType(r||{}));
 setValue("#repairProblem",r?.problem||"");
 setValue("#repairDate",r?.date||today());
 setValue("#repairMileage",Math.max(Number(r?.mileage||0),latestMileage));
 setValue("#repairPlanned",r?.planned||"");
 setValue("#repairLaborCost",r?.laborCost||"");
 setValue("#repairActual",r?.actual||"");
 setValue("#repairStatus",r?.status||"planned");
 setValue("#repairService",r?.service||"");
 setValue("#repairMechanic",r?.mechanic||"");
 setValue("#repairPriority",serviceRepairPriority(r||{}));
 setValue("#repairPaymentStatus",r?.paymentStatus||"unpaid");
 setValue("#repairPaidAmount",r?.paidAmount||"");
 setValue("#repairCompletedDate",r?.completedDate||"");
 setValue("#repairWarrantyUntil",r?.warrantyUntil||"");
 setValue("#repairLinkedRequestId",r?.linkedRequestId||"");
 setValue("#repairLinkedExpenseId",r?.linkedExpenseId||"");
 const source=$("#repairSourceRequest");
 if(source){source.hidden=!r?.linkedRequestId;source.innerHTML=r?.linkedRequestId?`<strong>Заявка водителя</strong><span>${repairSafe(r.problem||r.note||"")}</span>`:""}
 setValue("#repairNote",r?.note||"");
 const title=$("#repairDialogTitle");if(title)title.textContent=r?.title||"Новая сервисная задача";
 const subtitle=$("#repairDialogSubtitle");if(subtitle)subtitle.textContent=r?`ID ${String(r.id).slice(0,8)} · ${repairStatusText(r.status)}`:"Создайте задачу";
 updateRepairCarMeta();renderRepairPartsEditor();renderRepairChecklistEditor();renderRepairPhotos();renderRepairHistory(r);updateRepairCalculatedTotal();
 const dialog=$("#repairDialog");if(dialog&&!dialog.open)dialog.showModal();
}
function openPaymentDialog(carId="",id=""){if(!requireEnterprisePermission("finance.payments"))return;
 if(!requireFleetCar())return;const p=id?db.payments.find(x=>x.id===id):null,c=car(p?.carId||carId||db.cars[0]?.id),timing=p?.timing||c?.paymentTiming||"advance",period=suggestedPaymentPeriod(timing);
 $("#paymentId").value=p?.id||"";$("#paymentCarId").innerHTML=opts(p?.carId||carId);$("#paymentTenant").value=p?.tenant||c?.tenant||"";$("#paymentTiming").value=timing;$("#paymentFrom").value=p?.from||period.from;$("#paymentTo").value=p?.to||period.to;$("#paymentExpected").value=p?.expected??c?.weeklyRent??0;$("#paymentReceived").value=p?.received??c?.weeklyRent??0;$("#paymentDate").value=p?.date||today();$("#paymentAccrualMonth").value=p?.accrualMonth||monthFromDate(p?.from||period.from);$("#paymentReferenceWeek").value=p?.referenceWeek||p?.week||period.week;$("#paymentWeek").value=p?.week||p?.referenceWeek||period.week;$("#paymentNote").value=p?.note||"";$("#paymentAutoExpected").checked=!p;$("#paymentDialog").showModal();recalculateExpectedPayment()
}

function monthFromDate(value){return value?String(value).slice(0,7):""}
function paymentAccrualDate(payment){
 return payment.from||payment.to||(payment.accrualMonth?`${payment.accrualMonth}-01`:payment.date)
}
function safeLocalDate(value){
 if(!value)return null;
 const date=new Date(`${value}T12:00:00`);
 return Number.isNaN(date.getTime())?null:date
}
function inclusiveDays(from,to){
 if(!from||!to)return 0;
 return Math.max(0,Math.round((to-from)/86400000)+1)
}
function paymentPeriod(payment){
 let from=safeLocalDate(payment.from),to=safeLocalDate(payment.to);
 if(from&&to&&from>to)[from,to]=[to,from];
 if(from&&to)return{from,to,days:inclusiveDays(from,to),source:"period"};
 const fallback=safeLocalDate(payment.accrualMonth?`${payment.accrualMonth}-01`:payment.date||payment.to||payment.from);
 return fallback?{from:fallback,to:fallback,days:1,source:"fallback"}:null
}
function overlapDays(period,bounds){
 if(!period)return 0;
 const from=bounds.from&&period.from<bounds.from?bounds.from:period.from;
 const to=bounds.to&&period.to>bounds.to?bounds.to:period.to;
 return from<=to?inclusiveDays(from,to):0
}
function allocatedPaymentAmount(payment,bounds,field="received"){
 const amount=Number(payment[field]||0);
 if(!amount)return 0;
 const period=paymentPeriod(payment);
 if(!period)return 0;
 const overlap=overlapDays(period,bounds);
 if(!overlap)return 0;
 return amount*(overlap/Math.max(1,period.days))
}
function paymentMonthAllocation(payment){
 const period=paymentPeriod(payment);
 if(!period)return[];
 const result=[];
 let cursor=new Date(period.from);
 while(cursor<=period.to){
  const year=cursor.getFullYear(),month=cursor.getMonth();
  const monthStart=new Date(year,month,1);
  const monthEnd=new Date(year,month+1,0);
  const bounds={from:monthStart,to:monthEnd};
  const days=overlapDays(period,bounds);
  if(days){
   result.push({
    month:`${year}-${String(month+1).padStart(2,"0")}`,
    days,
    received:allocatedPaymentAmount(payment,bounds,"received"),
    expected:allocatedPaymentAmount(payment,bounds,"expected")
   })
  }
  cursor=new Date(year,month+1,1)
 }
 return result
}
function fixedContributionShare(carId,bounds){
 const total=Number(taxSettings().monthlyContributions||0)*bounds.months;
 if(!carId)return total;
 const eligible=fleetCars().filter(c=>!c.archived);
 return eligible.length?total/eligible.length:total
}

function syncExpenseRepairFields(){const root=$("#expenseRepairFields");if(root)root.hidden=$("#expenseCategory")?.value!=="repair"}
function currentConfirmedMileage(carId){
 const c=car(carId),local=Number(c?.mileage||0);
 const values=db.repairs.filter(r=>r.carId===carId).map(r=>Number(r.mileage||0));
 return Math.max(local,...values,0)
}
function createOrUpdateRepairFromExpense(expense){
 if(expense.category!=="repair"||!$("#expenseCreateRepair")?.checked)return null;

 let repair=expense.linkedRepairId?db.repairs.find(r=>r.id===expense.linkedRepairId):null;
 if(!repair){
  // Recover an existing reverse link before creating a new technical record.
  repair=db.repairs.find(r=>r.linkedExpenseId===expense.id)||null
 }
 const mileage=Math.max(currentConfirmedMileage(expense.carId),Number($("#expenseRepairMileage").value||0));
 if(!repair){
  repair={id:uid(),linkedExpenseId:expense.id};
  db.repairs.push(repair)
 }

 Object.assign(repair,{
  carId:expense.carId,
  title:expense.title,
  date:expense.date,
  mileage,
  planned:Number(expense.amount||0),
  actual:expense.status==="paid"?Number(expense.amount||0):Number(repair.actual||0),
  paidAmount:expense.status==="paid"?Number(expense.amount||0):Number(repair.paidAmount||0),
  paymentStatus:$("#expensePaymentStatus").value||"paid",
  status:$("#expenseRepairStatus").value||"done",
  service:$("#expenseRepairService").value.trim(),
  note:expense.note,
  linkedExpenseId:expense.id,
  linkedRequestId:repair.linkedRequestId||"",
  completedDate:$("#expenseRepairStatus").value==="done"?expense.date:repair.completedDate||"",
  warrantyUntil:repair.warrantyUntil||""
 });

 expense.linkedRepairId=repair.id;
 expense.financeSource=expense.financeSource||"expense";
 expense.serviceConvertedAt=expense.serviceConvertedAt||new Date().toISOString();
 const c=car(expense.carId);
 if(c&&mileage>Number(c.mileage||0))c.mileage=mileage;
 return repair
}
function syncLinkedExpenseFromRepair(repair){
 const amount=Number(repair.actual||0);
 const shouldCreate=repair.status==="done"&&amount>0&&["paid","partial","driver"].includes(repair.paymentStatus);

 let expense=repair.linkedExpenseId?db.expenses.find(x=>x.id===repair.linkedExpenseId):null;
 if(!expense)expense=db.expenses.find(x=>String(x.linkedRepairId)===String(repair.id))||null;

 // A service-generated expense follows the repair lifecycle. If the repair is reopened,
 // cancelled, or no longer has a billable amount, remove only the automatic finance row.
 if(!shouldCreate){
  if(expense&&expense.financeSource==="service"){
   db.expenses=db.expenses.filter(x=>String(x.id)!==String(expense.id));
   repair.linkedExpenseId="";
   return null
  }
  return expense||null
 }

 if(!expense){
  expense={id:uid(),financeSource:"service"};
  db.expenses.push(expense)
 }

 Object.assign(expense,{
  carId:repair.carId,
  title:repair.title,
  category:"repair",
  date:repair.completedDate||repair.date||today(),
  amount,
  status:repair.paymentStatus==="paid"?"paid":"planned",
  note:repair.note||repair.problem||"",
  linkedRepairId:repair.id
 });
 if(!expense.financeSource)expense.financeSource="service";
 repair.linkedExpenseId=expense.id;
 return expense
}
function syncServiceRelations(repair){
 if(!repair)return;
 syncLinkedExpenseFromRepair(repair);
 const c=car(repair.carId);
 if(c&&Number(repair.mileage||0)>Number(c.mileage||0))c.mileage=Number(repair.mileage||0);
}
function openRepairFromDriverRequest(request){
 const c=car(request.car_id);if(!c)return toast("Автомобиль из заявки не найден");
 openRepairDialog(c.id);
 $("#repairTitle").value=DRIVER_REPAIR_CATEGORY_LABELS[request.category]||"Ремонт по заявке";
 if($("#repairServiceType"))$("#repairServiceType").value={engine:"engine",suspension:"suspension",brakes:"brakes",electric:"electrical",body:"body",tires:"tires"}[request.category]||"other";
 $("#repairDate").value=today();
 $("#repairMileage").value=Math.max(Number(c.mileage||0),Number(request.mileage||0));
 $("#repairStatus").value="repair";
 $("#repairPaymentStatus").value="unpaid";
 $("#repairLinkedRequestId").value=request.id;
 $("#repairSourceRequest").hidden=false;
 $("#repairSourceRequest").innerHTML=`<strong>Передача заявки в сервис</strong><span>${request.driver_email||"Водитель"} · ${request.description}</span><small>После сохранения заявка исчезнет из входящих и появится в ремонтах · пробег ${km(request.mileage)}</small>`;
 $("#repairNote").value=request.description||""
}
function openExpenseDialog(carId="",id=""){if(!requireEnterprisePermission("finance.expenses"))return;
 if(!requireFleetCar())return;
 const x=id?db.expenses.find(v=>v.id===id):null,selected=x?.carId||carId||fleetCars()[0]?.id||"";
 $("#expenseId").value=x?.id||"";$("#expenseCarId").innerHTML=opts(selected);$("#expenseTitle").value=x?.title||"";$("#expenseCategory").value=x?.category||"repair";$("#expenseDate").value=x?.date||today();$("#expenseAmount").value=x?.amount||"";$("#expenseStatus").value=x?.status||"planned";$("#expenseNote").value=x?.note||"";
 const linked=x?.linkedRepairId?db.repairs.find(r=>r.id===x.linkedRepairId):null;
 $("#expenseCreateRepair").checked=x?.category==="repair"||!x;$("#expenseRepairMileage").value=linked?.mileage||currentConfirmedMileage(selected);$("#expenseRepairService").value=linked?.service||"";$("#expenseRepairStatus").value=linked?.status||"done";$("#expensePaymentStatus").value=linked?.paymentStatus||(x?.status==="paid"?"paid":"unpaid");
 syncExpenseRepairFields();$("#expenseDialog").showModal()
}
function openDocumentDialog(carId="",id=""){if(!requireEnterprisePermission(id?"documents.view":"documents.create"))return;
 if(!requireFleetCar())return;
 const d=id?db.documents.find(v=>v.id===id):null,selected=d?.carId||carId||fleetCars()[0]?.id||"";
 $("#documentId").value=d?.id||"";$("#documentCarId").innerHTML=opts(selected);$("#documentType").value=d?.type||"insurance";$("#documentTitle").value=d?.title||"";$("#documentNumber").value=d?.number||"";$("#documentExpiry").value=d?.expiry||"";$("#documentCost").value=d?.cost||"";$("#documentPaymentMode").value=d?.paymentMode||"full";$("#documentInstallmentCount").value=d?.installmentCount||4;$("#documentFirstInstallment").value=d?.firstInstallment||today();$("#documentInstallmentFrequency").value=d?.installmentFrequency||"monthly";
 documentInstallmentDraft=structuredClone(d?.installments||buildInsuranceInstallments(Number(d?.cost||0),Number(d?.installmentCount||4),d?.firstInstallment||today(),d?.installmentFrequency||"monthly",[]));
 syncInsuranceFields();renderInsuranceInstallmentEditor();
 $("#documentFile").value=d?.file||"";$("#documentAttachment").value="";$("#documentAttachmentPreview").innerHTML=d?.fileId?`<div class="attached-file"><span>Файл прикреплён</span><button type="button" class="btn" onclick="openDocumentAttachment('${d.fileId}','${(d.title||"Документ").replaceAll("'","\'")}')">Открыть</button></div>`:"";$("#documentNote").value=d?.note||"";$("#documentDialog").showModal()
}
function applyDocumentTypeDefaults(){
 const type=$("#documentType")?.value||"other",title=$("#documentTitle");
 if(title&&!title.value.trim())title.value=documentTypeText(type);
 syncInsuranceFields();
}
window.applyDocumentTypeDefaults=applyDocumentTypeDefaults;

