/* =========================================================
   FleetPilot V15.6 — Dashboard & Analytics
   Search, analytics, attention center, owner dashboard, KPIs, desktop control center.
   Source order: original app.js lines 2618-3650
   ========================================================= */
function renderMorePage(){applyUxSettings();renderGpsConnectionSummary();
 const msgs=assistantMessages();$("#dailyAssistant").innerHTML=msgs.map(x=>`<div class="assistant-message">${x}</div>`).join("");
 renderActivityJournal()
}
function renderGlobalSearch(){
 const q=($("#globalSearchInput")?.value||"").trim().toLowerCase();if(!q){$("#globalSearchResults").innerHTML='<div class="card">Начните вводить запрос.</div>';$("#globalSearchCount").textContent="";return}
 const results=[];
 fleetCars().forEach(c=>{const m=model(c),hay=`${m.brand} ${m.model} ${c.plate} ${c.vin||""} ${c.tenant||""}`.toLowerCase();if(hay.includes(q))results.push({type:"Автомобиль",title:`${m.brand} ${m.model}`,text:`${c.plate} · ${c.tenant||"Без арендатора"}`,action:`openCar('${c.id}')`})});
 db.repairs.forEach(r=>{const c=car(r.carId);if(`${r.title} ${r.note||""} ${c?.plate||""}`.toLowerCase().includes(q))results.push({type:"Ремонт",title:r.title,text:`${c?.plate||""} · ${date(r.date)}`,action:`showPage('repairsPage')`})});
 db.documents.forEach(d=>{const c=car(d.carId);if(`${d.title} ${d.number||""} ${c?.plate||""}`.toLowerCase().includes(q))results.push({type:"Документ",title:d.title,text:`${c?.plate||""} · ${documentTypeText(d.type)}`,action:`showPage('documentsPage')`})});
 db.payments.forEach(p=>{const c=car(p.carId);if(`${p.tenant||""} ${p.week||""} ${c?.plate||""}`.toLowerCase().includes(q))results.push({type:"Оплата",title:`${money(p.received)}`,text:`${c?.plate||""} · ${p.week||date(p.from)}`,action:`showPage('paymentsPage')`})});
 $("#globalSearchCount").textContent=`Найдено: ${results.length}`;$("#globalSearchResults").innerHTML=results.length?results.slice(0,100).map(x=>`<button class="search-result" onclick="${x.action}"><span>${x.type}</span><strong>${x.title}</strong><small>${x.text}</small></button>`).join(""):'<div class="card">Ничего не найдено.</div>'
}
function exportActivityCsv(){const rows=[["Дата","Действие","Раздел","Описание"],...(db.activity||[]).map(x=>[x.date,x.action,x.entity||"",x.details||""])];const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(";")).join("\n");const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`FleetPilot_activity_${today()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}

function renderAnalytics(){renderProfitability();
 if(!$("#analyticsMonth").value)$("#analyticsMonth").value=today().slice(0,7);
 syncAnalyticsPeriodControls();
 const period=analyticsSelectedPeriod();
 const title=period.startsWith("month:")
  ?monthLabel(period.slice(6))
  :period==="year"
    ?`текущий ${new Date().getFullYear()} год`
    :"за всё время";
 $("#analyticsPeriodTitle").textContent=title;
 const rows=fleetCars().map(c=>({c,data:financialData(period,c.id)})).sort((a,b)=>b.data.finalProfit-a.data.finalProfit);
 const all=financialData(period),avg=rows.length?rows.reduce((s,x)=>s+x.data.finalProfit,0)/rows.length:0;
 $("#analyticsSummary").innerHTML=[
  ["Оплата аренды",money(all.grossRevenue)],
  ["Ремонты и расходы",money(all.grossCosts)],
  ["Налоги и взносы",money(all.vatDue+all.pit+all.contributions)],
  ["Чистая прибыль",money(all.finalProfit)]
 ].map(x=>`<div class="summary-card"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
 const forecast=futureFinancialData(30);$("#financialForecast").innerHTML=[["Плановый доход",forecast.revenue],["Плановые расходы",forecast.expenses+forecast.repairs],["Оценка налогов",forecast.tax],["Ожидаемая прибыль",forecast.balance]].map(x=>`<div class="forecast-row"><span>${x[0]}</span><strong>${money(x[1])}</strong></div>`).join("");
 const fh=fleetHealthData();$("#fleetHealthIndex").innerHTML=`<div class="health-index-main"><strong>${fh.overall}%</strong><span>Общий индекс</span></div>${[["Техника",fh.technical],["Документы",fh.documents],["Финансы",fh.finance]].map(x=>`<div class="health-progress"><div><span>${x[0]}</span><strong>${x[1]}%</strong></div><i><b style="width:${x[1]}%"></b></i></div>`).join("")}`;

 const max=Math.max(1,...rows.map(x=>Math.abs(x.data.finalProfit)));
 $("#analyticsCars").innerHTML=rows.map(x=>`<div class="analytics-row">
  <div><strong>${model(x.c).brand} ${model(x.c).model}</strong><small>${x.c.plate}</small></div>
  <div class="analytics-track"><span style="width:${Math.max(3,Math.abs(x.data.finalProfit)/max*100)}%"></span></div>
  <strong class="${x.data.finalProfit<0?"negative":""}">${money(x.data.finalProfit)}</strong>
 </div>`).join("");
 const best=rows[0];
 $("#bestCar").innerHTML=best?`<strong class="big-stat">${model(best.c).brand} ${model(best.c).model}</strong><p>${best.c.plate} · ${money(best.data.finalProfit)}</p>`:"Нет данных";
 const repair=[...db.repairs].filter(x=>x.status==="done").sort((a,b)=>Number(b.actual||b.planned)-Number(a.actual||a.planned))[0];
 $("#largestRepair").innerHTML=repair?`<strong class="big-stat">${repair.title}</strong><p>${car(repair.carId).plate} · ${money(repair.actual||repair.planned)}</p>`:"Нет данных";
 const insurance=[...db.documents].filter(x=>x.type==="insurance").sort((a,b)=>b.cost-a.cost)[0];
 $("#largestInsurance").innerHTML=insurance?`<strong class="big-stat">${insurance.title}</strong><p>${car(insurance.carId).plate} · ${money(insurance.cost)}</p>`:"Нет данных";
 $("#averageProfit").innerHTML=`<strong class="big-stat">${money(avg)}</strong><p>на один автомобиль</p>`;
 const active=fleetCars().filter(c=>c.status==="active").length;
 const repairing=fleetCars().filter(c=>c.status==="repair").length;
 const free=fleetCars().filter(c=>c.status==="free").length;
 $("#fleetKpi").innerHTML=[
  ["Всего машин",fleetCars().length],
  ["На линии",active],
  ["В ремонте",repairing],
  ["Свободны",free],
  ["Доход периода",money(all.grossRevenue)],
  ["Расходы периода",money(all.grossCosts)],
  ["Чистая прибыль",money(all.finalProfit)],
  ["Средняя прибыль",money(avg)]
 ].map(x=>`<div class="kpi-card"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
 const recs=ownerRecommendations(period);
 $("#ownerRecommendations").innerHTML=recs.length?recs.map(x=>`<div class="recommendation-item">💡 ${x}</div>`).join(""):"Рекомендаций пока нет";
 const tenants=tenantStats();
 $("#tenantRatings").innerHTML=tenants.length?tenants.map(x=>`<div class="tenant-row"><div><strong>${x.name}</strong><small>Записей: ${x.records} · Просрочек: ${x.late}</small></div><span>${Math.round(x.score)}%</span><b>${x.debt?money(x.debt):"Без долга"}</b></div>`).join(""):"Данных об арендаторах пока нет";


 requestAnimationFrame(()=>{animateLineCharts($("#analyticsPage"));animateProgressBars($("#analyticsPage"));animateDashboard()})
}



function mondayOf(dateValue=today()){const d=new Date(dateValue+"T12:00:00"),day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d}
function isoFromDate(d){return d.toISOString().slice(0,10)}
function suggestedPaymentPeriod(timing,dateValue=today()){const m=mondayOf(dateValue);if(timing==="arrears")m.setDate(m.getDate()-7);const s=new Date(m);s.setDate(s.getDate()+6);return{from:isoFromDate(m),to:isoFromDate(s),week:isoWeek(isoFromDate(m))}}
function paymentTimingText(v){return v==="arrears"?"После отработанной недели":"Авансом"}
function depositData(carId){const c=car(carId),target=Number(c?.depositTarget||0),rows=(db.deposits||[]).filter(x=>x.carId===carId).sort((a,b)=>a.date.localeCompare(b.date)),paid=rows.reduce((s,x)=>s+Number(x.amount||0),0);return{target,rows,paid,left:Math.max(0,target-paid),progress:target?Math.min(100,paid/target*100):(paid?100:0)}}
function renderDepositChart(carId){const d=depositData(carId);let sum=0,max=Math.max(d.target,...d.rows.map(x=>(sum+=Number(x.amount||0))),1);sum=0;const bars=d.rows.map((x,i)=>{sum+=Number(x.amount||0);return `<div class="deposit-bar-wrap" title="${date(x.date)} · ${money(sum)}"><div class="deposit-bar" style="height:${Math.max(7,sum/max*100)}%"></div><small>${i+1}</small></div>`}).join("");return `<div><div class="deposit-progress-head"><span>Оплачено ${money(d.paid)} из ${money(d.target)}</span><strong>${Math.round(d.progress)}%</strong></div><div class="deposit-progress"><i style="width:${d.progress}%"></i></div><div class="deposit-summary-grid"><div><small>Цель</small><strong>${money(d.target)}</strong></div><div><small>Внесено</small><strong>${money(d.paid)}</strong></div><div><small>Осталось</small><strong>${money(d.left)}</strong></div></div>${d.rows.length?`<div class="deposit-chart">${bars}<div class="deposit-target-line" style="bottom:${Math.min(100,d.target/max*100)}%"></div></div>`:""}</div>`}
function renderDepositRows(carId){const rows=depositData(carId).rows.slice().reverse();return rows.length?rows.map(x=>`<div class="deposit-row"><div><strong>${money(x.amount)}</strong><small>${date(x.date)} · ${x.tenant||"Без имени"}${x.note?` · ${x.note}`:""}</small></div><button class="btn danger" onclick="deleteDeposit('${x.id}')">Удалить</button></div>`).join(""):`<div class="empty-note">Платежей кауции пока нет.</div>`}
function isoWeek(dateValue){
 const d=new Date(dateValue+"T12:00:00");d.setHours(0,0,0,0);d.setDate(d.getDate()+3-(d.getDay()+6)%7);
 const week1=new Date(d.getFullYear(),0,4);
 const week=1+Math.round(((d-week1)/86400000-3+(week1.getDay()+6)%7)/7);
 return`${d.getFullYear()}-W${String(week).padStart(2,"0")}`
}
function rentalDays(from,to){
 if(!from||!to)return 0;
 return Math.max(0,Math.round((new Date(to+"T12:00:00")-new Date(from+"T12:00:00"))/86400000)+1)
}
function checkPaymentDuplicate(){
 const duplicate=db.payments.find(p=>p.id!==$("#paymentId").value&&p.carId===$("#paymentCarId").value&&p.from===$("#paymentFrom").value&&p.to===$("#paymentTo").value);
 const box=$("#paymentDuplicateWarning");
 box.hidden=!duplicate;
 box.textContent=duplicate?`⚠️ За этот период уже есть запись: получено ${money(duplicate.received)}.`:""
}
function recalculateExpectedPayment(){
 const c=car($("#paymentCarId").value),timing=$("#paymentTiming").value||c?.paymentTiming||"advance",count=rentalDays($("#paymentFrom").value,$("#paymentTo").value);
 if($("#paymentAutoExpected").checked&&c&&count){const amount=Math.round(Number(c.weeklyRent||0)/7*count*100)/100;$("#paymentExpected").value=amount;$("#paymentReceived").value=amount}
 $("#paymentExpected").readOnly=$("#paymentAutoExpected").checked;const ref=$("#paymentReferenceWeek").value||($("#paymentFrom").value?isoWeek($("#paymentFrom").value):"");$("#paymentWeek").value=ref;
 $("#paymentCalculationInfo").textContent=c&&count?`${paymentTimingText(timing)} · ${ref} · ${count} дн. × ${money(Number(c.weeklyRent||0)/7)} = ${money(Number($("#paymentExpected").value||0))}`:"Выберите автомобиль и период";
 $("#paymentModeBanner").innerHTML=c?`<strong>${paymentTimingText(timing)}</strong><span>${timing==="advance"?"Оплата за текущую/предстоящую неделю":"Оплата за уже отработанную неделю"}</span>`:"";checkPaymentDuplicate()
}
function healthDetails(c){
 const oilLeft=oil(c),insuranceDays=days(c.insurance),inspectionDays=days(c.inspection);
 const terminalRepairStatuses=new Set(["done","cancelled","canceled","rejected","archived","closed"]);
 const repairs=(db.repairs||[]).filter(r=>String(r.carId)===String(c.id)&&!terminalRepairStatuses.has(String(r.status||"").toLowerCase())),items=[];
 if(oilLeft<=0)items.push({type:"oil",level:"danger",title:"ТО просрочено",value:`${Math.abs(oilLeft)} км`});
 else if(oilLeft<=1500)items.push({type:"oil",level:"warning",title:"Скоро ТО",value:`${oilLeft} км`});
 if(insuranceDays<0)items.push({type:"insurance",level:"danger",title:"Страховка просрочена",value:`${Math.abs(insuranceDays)} дн.`});
 else if(insuranceDays<=30)items.push({type:"insurance",level:"warning",title:"Страховка заканчивается",value:`${insuranceDays} дн.`});
 if(inspectionDays<0)items.push({type:"inspection",level:"danger",title:"Техосмотр просрочен",value:`${Math.abs(inspectionDays)} дн.`});
 else if(inspectionDays<=30)items.push({type:"inspection",level:"warning",title:"Техосмотр заканчивается",value:`${inspectionDays} дн.`});
 if(repairs.some(r=>days(r.date)<0))items.push({type:"repair",level:"danger",title:"Просроченный ремонт",value:String(repairs.length)});
 else if(repairs.length)items.push({type:"repair",level:"warning",title:"Запланирован ремонт",value:String(repairs.length)});
 let score=100;items.forEach(x=>score-=x.level==="danger"?25:12);score=Math.max(0,score);
 return{items,score,level:items.some(x=>x.level==="danger")?"danger":items.length?"warning":"good",oilLeft,insuranceDays,inspectionDays}
}
function healthIcon(type){return{oil:"🛢️",insurance:"🛡️",inspection:"📋",repair:"🔧"}[type]||"⚠️"}
function renderAttention(){
 const rows=[];fleetCars().forEach(c=>healthDetails(c).items.forEach(item=>rows.push({c,m:model(c),item})));
 $("#attentionCount").textContent=rows.length;
 $("#attentionSummary").innerHTML=[["Всего",rows.length],["Критические",rows.filter(x=>x.item.level==="danger").length],["Скоро",rows.filter(x=>x.item.level==="warning").length],["Автомобилей",new Set(rows.map(x=>x.c.id)).size]].map(x=>`<div class="summary-card"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
 $("#attentionList").innerHTML=rows.length?rows.map(x=>`<article class="list-item attention-item ${x.item.level}"><div class="attention-icon">${healthIcon(x.item.type)}</div><div><h3>${x.m.brand} ${x.m.model}</h3><p>${x.c.plate} · ${x.item.title}</p></div><strong>${x.item.value}</strong></article>`).join(""):`<div class="card">Всё хорошо — предупреждений нет.</div>`
}


function startOfWeek(dateValue=new Date()){
 const d=dateValue instanceof Date?new Date(dateValue):new Date(dateValue+"T12:00:00");
 const day=(d.getDay()+6)%7;
 d.setDate(d.getDate()-day);
 d.setHours(0,0,0,0);
 return d
}
function endOfWeek(dateValue=new Date()){
 const d=startOfWeek(dateValue);
 d.setDate(d.getDate()+6);
 d.setHours(23,59,59,999);
 return d
}
function isoDateFromDate(d){return d.toISOString().slice(0,10)}
function weekPlanData(){
 const from=startOfWeek(),to=endOfWeek();
 const activeCars=cityFilteredCars().filter(c=>c.status==="active"&&(c.driverUserId||c.driverName||c.tenant));
 const plannedRevenue=activeCars.reduce((sum,c)=>sum+Number(c.weeklyRent||0),0);
 const plannedExpenses=db.expenses.filter(x=>{
  if(x.status!=="planned"||!x.date)return false;
  if(selectedFleetCity!=="all"&&normalizedCity(car(x.carId)?.city)!==selectedFleetCity)return false;
  const d=new Date(x.date+"T12:00:00");
  return d>=from&&d<=to
 }).reduce((sum,x)=>sum+Number(x.amount||0),0);
 // Finance has one source of truth: db.expenses. Service tasks are mirrored there
 // via linkedRepairId, so adding repair.planned here would count the same cost twice.
 const plannedRepairs=0;
 const totalPlannedCosts=plannedExpenses;
 return{
  from:isoDateFromDate(from),
  to:isoDateFromDate(to),
  activeCars:activeCars.length,
  plannedRevenue,
  plannedExpenses,
  plannedRepairs,
  totalPlannedCosts,
  expectedBalance:plannedRevenue-totalPlannedCosts
 }
}

function financialDataForVisibleCars(period){
 if(selectedFleetCity==="all")return financialData(period);
 const allowed=new Set(cityFilteredCars().map(c=>c.id));
 const bounds=periodBounds(period);
 const payments=db.payments.filter(p=>allowed.has(p.carId));
 const grossRevenue=payments.reduce((sum,p)=>sum+allocatedPaymentAmount(p,bounds,"received"),0);
 const expectedRevenue=payments.reduce((sum,p)=>sum+allocatedPaymentAmount(p,bounds,"expected"),0);

 normalizeRepairExpenseLinks();
 const paidExpenses=db.expenses.filter(x=>allowed.has(x.carId)&&x.status==="paid"&&inPeriod(x.date,bounds));
 const linkedRepairIds=new Set(paidExpenses.map(x=>x.linkedRepairId).filter(Boolean));
 const legacyRepairs=db.repairs.filter(r=>allowed.has(r.carId)&&r.status==="done"&&!r.linkedExpenseId&&!linkedRepairIds.has(r.id)&&inPeriod(r.completedDate||r.date,bounds));
 const repairGross=
  paidExpenses.filter(x=>x.category==="repair").reduce((s,x)=>s+Number(x.amount||0),0)+
  legacyRepairs.reduce((s,r)=>s+Number(r.actual||r.planned||0),0);
 const otherGross=paidExpenses.filter(x=>x.category!=="repair").reduce((s,x)=>s+Number(x.amount||0),0);
 const grossCosts=repairGross+otherGross;

 const tax=taxSettings(),noTaxes=tax.method==="none",vatPayer=!noTaxes&&tax.vat==="yes",vatFactor=1.23;
 const netRevenue=vatPayer?grossRevenue/vatFactor:grossRevenue;
 const deductInputVat=vatPayer&&tax.deductVatCosts;
 const netCosts=deductInputVat?grossCosts/vatFactor:grossCosts;
 const vatDue=noTaxes?0:Math.max(0,(vatPayer?grossRevenue-netRevenue:0)-(deductInputVat?grossCosts-netCosts:0));
 const profitBeforePit=netRevenue-netCosts;
 let pit=0;
 if(tax.method==="ryczalt"&&!noTaxes)pit=Math.max(0,netRevenue*Number(tax.ryczaltRate||0)/100);
 else if(tax.method==="linear"&&!noTaxes)pit=Math.max(0,profitBeforePit*.19);
 else if(tax.method==="scale"&&!noTaxes){
  const taxable=Math.max(0,profitBeforePit);
  pit=bounds.months===1?Math.max(0,taxable*.12-300):(taxable<=120000?Math.max(0,taxable*.12-3600):10800+(taxable-120000)*.32)
 }
 const allCars=Math.max(1,fleetCars().filter(c=>!c.archived).length);
 const visibleCars=cityFilteredCars().filter(c=>!c.archived).length;
 const contributions=noTaxes?0:Number(tax.monthlyContributions||0)*bounds.months*(visibleCars/allCars);
 const finalProfit=grossRevenue-grossCosts-vatDue-pit-contributions;
 return{grossRevenue,expectedRevenue,repairGross,otherGross,grossCosts,netRevenue,netCosts,vatDue,pit,contributions,finalProfit,profitBeforePit,paymentCount:payments.filter(p=>overlapDays(paymentPeriod(p),bounds)>0).length}
}
function actualWeekRevenue(){
 const from=startOfWeek(),to=endOfWeek();
 const allowed=new Set(cityFilteredCars().map(c=>c.id));
 return db.payments.filter(p=>{
  if(!allowed.has(p.carId))return false;
  const value=p.date||p.to;
  if(!value)return false;
  const d=new Date(value+"T12:00:00");
  return d>=from&&d<=to
 }).reduce((s,p)=>s+Number(p.received||0),0)
}
function ownerDashboardData(){
 const month=financialDataForVisibleCars("month");
 const plan=weekPlanData();
 const weekRevenue=actualWeekRevenue();
 return{
  monthProfit:month.finalProfit,
  weekRevenue,
  plannedCosts:plan.totalPlannedCosts,
  expectedProfit:plan.expectedBalance,
  status:plan.expectedBalance<0?"danger":plan.totalPlannedCosts>plan.plannedRevenue*.55?"warning":"good"
 }
}
function animateNumber(el,target,formatter="money"){
 if(!el)return;
 const reduce=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
 const duration=reduce?0:850;
 const start=performance.now();
 const from=0;
 const render=value=>{
  if(formatter==="integer")el.textContent=Math.round(value).toLocaleString("ru-RU");
  else el.textContent=money(value)
 };
 if(!duration){render(target);return}
 const tick=now=>{
  const progress=Math.min(1,(now-start)/duration);
  const eased=1-Math.pow(1-progress,3);
  render(from+(target-from)*eased);
  if(progress<1)requestAnimationFrame(tick)
 };
 requestAnimationFrame(tick)
}
function animateDashboard(){
 $$("[data-animate-value]").forEach((el,index)=>{
  const target=Number(el.dataset.animateValue||0);
  const formatter=el.dataset.animateFormat||"money";
  setTimeout(()=>animateNumber(el,target,formatter),index*70)
 });
}
function animateProgressBars(root=document){
 root.querySelectorAll(".deposit-progress i,.animated-progress-fill").forEach((el,index)=>{
  const target=el.style.width||el.dataset.width||"0%";
  el.style.width="0%";
  setTimeout(()=>requestAnimationFrame(()=>{el.style.width=target}),80+index*70)
 })
}

function fleetScoreData(){
 const cars=cityFilteredCars();
 if(!cars.length)return{score:0,label:"Нет данных",reasons:["Добавьте автомобили для расчёта рейтинга."]};
 let score=100;const reasons=[];let repairs=0;
 for(const c of cars){
  const h=healthDetails(c),name=`${model(c).brand} ${model(c).model}`;
  if(h.level==="danger"){score-=18;reasons.push(`${name}: критическое событие`)}
  else if(h.level==="warning"){score-=8;reasons.push(`${name}: требуется внимание`)}
  if(c.status==="repair"){score-=5;repairs++}
 }
 const incomplete=db.payments.filter(p=>cars.some(c=>c.id===p.carId)&&Number(p.expected||0)>Number(p.received||0)).length;
 score-=Math.min(18,incomplete*3);score=Math.max(0,Math.round(score));
 if(repairs)reasons.push(`В ремонте: ${repairs}`);
 if(incomplete)reasons.push(`Неполных оплат: ${incomplete}`);
 if(!reasons.length)reasons.push("Все основные показатели в норме.");
 return{score,label:score>=90?"Отличное состояние":score>=75?"Хорошее состояние":score>=55?"Нужен контроль":"Высокий риск",reasons:reasons.slice(0,4)}
}
function assistantInsightData(){
 const cars=cityFilteredCars(),plan=weekPlanData(),month=financialDataForVisibleCars("month"),items=[];
 const ins=cars.filter(c=>{const d=days(c.insurance);return d>=0&&d<=14});
 const insp=cars.filter(c=>{const d=days(c.inspection);return d>=0&&d<=14});
 const oilRows=cars.filter(c=>{const d=oil(c);return d>0&&d<=1000});
 const free=cars.filter(c=>c.status==="free");
 items.push({type:plan.expectedBalance>=0?"good":"danger",text:plan.expectedBalance>=0?`Ожидаемый результат недели: ${money(plan.expectedBalance)}.`:`Расходы превышают доход на ${money(Math.abs(plan.expectedBalance))}.`});
 items.push({type:month.finalProfit>=0?"good":"danger",text:`Чистая прибыль месяца: ${money(month.finalProfit)}.`});
 if(ins.length)items.push({type:"warning",text:`У ${ins.length} авто страховка заканчивается в течение 14 дней.`});
 if(insp.length)items.push({type:"warning",text:`У ${insp.length} авто техосмотр заканчивается в течение 14 дней.`});
 if(oilRows.length)items.push({type:"warning",text:`${oilRows.length} авто скоро потребуют замену масла.`});
 if(free.length)items.push({type:"info",text:`Свободных автомобилей без аренды: ${free.length}.`});
 return items.slice(0,5)
}
function renderFleetIntelligence(){
 const data=fleetScoreData(),ring=$("#fleetScoreRing");
 $("#fleetScoreLabel").textContent=data.label;$("#fleetScoreReason").textContent=data.reasons.join(" · ");
 ring.style.setProperty("--score",data.score);
 ring.className=`fleet-score-ring ${data.score>=90?"excellent":data.score>=75?"good":data.score>=55?"warning":"danger"}`;
 animateNumber($("#fleetScoreValue"),data.score,"integer");
 $("#assistantInsights").innerHTML=assistantInsightData().map((x,i)=>`<div class="assistant-insight ${x.type}" style="--insight-index:${i}"><span></span><p>${x.text}</p></div>`).join("")
}
function animateLineCharts(root=document){
 root.querySelectorAll("svg polyline,svg path[data-animate-line]").forEach((el,index)=>{try{const len=el.getTotalLength();el.style.strokeDasharray=len;el.style.strokeDashoffset=len;el.style.transition="none";requestAnimationFrame(()=>setTimeout(()=>{el.style.transition="stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)";el.style.strokeDashoffset="0"},70+index*70))}catch{}})
}

function renderOwnerDashboard(){
 const data=ownerDashboardData();
 const cards=[
  ["Чистая прибыль месяца",data.monthProfit,"profit","wallet"],
  ["Доход текущей недели",data.weekRevenue,"revenue","trend"],
  ["Плановые расходы недели",data.plannedCosts,"costs","expense"],
  ["Ожидаемый результат недели",data.expectedProfit,"expected","check"]
 ];
 $("#ownerDashboardContext").textContent=`${cityLabel()} · данные обновлены автоматически`;
 $("#ownerDashboardGrid").innerHTML=cards.map((x,index)=>`<article class="owner-kpi ${x[2]}" style="--index:${index}">
   <div class="owner-kpi-icon ${x[3]}">${x[3]==="wallet"?"$":x[3]==="trend"?"↗":x[3]==="expense"?"↓":"✓"}</div>
   <div><small>${x[0]}</small><strong data-animate-value="${x[1]}" data-animate-format="money">${money(0)}</strong></div>
  </article>`).join("");
 const status=$("#ownerDashboardStatus");
 status.className=`owner-dashboard-status ${data.status}`;
 status.innerHTML=`<span></span><strong>${data.status==="danger"?"Расходы выше плана":data.status==="warning"?"Нужен контроль":"Финансы стабильны"}</strong>`;
 requestAnimationFrame(animateDashboard)
}

function renderWeekPlan(){
 const data=weekPlanData();
 $("#weekPlanTitle").textContent=`Неделя ${isoWeek(data.from)} · ${cityLabel()}`;
 $("#weekPlanPeriod").textContent=`${date(data.from)} — ${date(data.to)}`;
 $("#weekPlanSummary").innerHTML=[
  ["Машин на линии",data.activeCars,""],
  ["Плановый заработок",money(data.plannedRevenue),"good"],
  ["Плановые расходы",money(data.totalPlannedCosts),data.totalPlannedCosts?"warning":""],
  ["Ожидаемая прибыль",money(data.expectedBalance),data.expectedBalance>=0?"good":"danger"]
 ].map(x=>`<div class="week-plan-card ${x[2]}"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("")
}


let selectedFleetCity="all";
function normalizedCity(value){
 return String(value||"").trim()
}
function fleetCities(){
 return [...new Set(db.cars.map(c=>normalizedCity(c.city)).filter(Boolean))]
  .sort((a,b)=>a.localeCompare(b,"ru"))
}
function cityFilteredCars(){
 const cars=fleetCars();
 return selectedFleetCity==="all"?cars:cars.filter(c=>normalizedCity(c.city)===selectedFleetCity)
}
function refreshCityControls(){
 const cities=fleetCities();
 const filter=$("#fleetCityFilter");
 if(filter){
  const current=cities.includes(selectedFleetCity)?selectedFleetCity:"all";
  selectedFleetCity=current;
  filter.innerHTML=`<option value="all">Все города</option>`+cities.map(city=>`<option value="${city}" ${city===current?"selected":""}>${city}</option>`).join("")
 }
 const datalist=$("#fleetCityOptions");
 if(datalist)datalist.innerHTML=cities.map(city=>`<option value="${city}"></option>`).join("")
}
function cityLabel(){
 return selectedFleetCity==="all"?"весь автопарк":selectedFleetCity
}


const DESKTOP_VIEW_KEY="fleetpilot.desktop.view.v1";

const ACTIVITY_KEY="fleetpilot.activity.v1";

const CONTROL_WINDOWS_KEY="fleetpilot.desktop.windows.v1";
const CONTROL_WINDOWS=[
 {id:"tasks",label:"Сегодня нужно сделать"},
 {id:"efficiency",label:"Эффективность / ТОП автомобилей"},
 {id:"activity",label:"Журнал действий"},
 {id:"gps",label:"GPS-ready"},
 {id:"events",label:"Сегодня и далее"},
 {id:"insights",label:"Что важно сейчас"}
];

function controlWindowSettings(){
 try{
  const saved=JSON.parse(localStorage.getItem(CONTROL_WINDOWS_KEY)||"null");
  if(saved&&typeof saved==="object")return saved
 }catch{}
 return Object.fromEntries(CONTROL_WINDOWS.map(item=>[item.id,true]))
}
function saveControlWindowSettings(settings){
 localStorage.setItem(CONTROL_WINDOWS_KEY,JSON.stringify(settings));
 applyControlWindowSettings()
}
function applyControlWindowSettings(){
 const settings=controlWindowSettings();
 $$("[data-control-window]").forEach(element=>{
  const visible=settings[element.dataset.controlWindow]!==false;
  element.hidden=!visible
 });
 const visibleMain=$$(".control-center-grid>[data-control-window]").filter(el=>!el.hidden).length;
 document.querySelector(".control-center-grid")?.classList.toggle("few-visible-windows",visibleMain<=2)
}
function hideControlWindow(id){
 const settings=controlWindowSettings();
 settings[id]=false;
 saveControlWindowSettings(settings);
 toast("Окно скрыто")
}
function renderControlWindowsOptions(){
 const root=$("#controlWindowsOptions");if(!root)return;
 const settings=controlWindowSettings();
 root.innerHTML=CONTROL_WINDOWS.map(item=>`<label class="control-window-option">
  <div><strong>${item.label}</strong><small>${settings[item.id]!==false?"Отображается":"Скрыто"}</small></div>
  <input type="checkbox" data-window-toggle="${item.id}" ${settings[item.id]!==false?"checked":""}>
  <span></span>
 </label>`).join("");
 root.querySelectorAll("[data-window-toggle]").forEach(input=>{
  input.onchange=()=>{
   const next=controlWindowSettings();
   next[input.dataset.windowToggle]=input.checked;
   saveControlWindowSettings(next);
   renderControlWindowsOptions()
  }
 })
}
function openControlWindowsDialog(){
 renderControlWindowsOptions();
 $("#controlWindowsDialog").showModal()
}
window.hideControlWindow=hideControlWindow;

const TASKS_KEY="fleetpilot.tasks.v1";
const ALERT_KEY="fleetpilot.alert.last.v1";

function readLocalArray(key){
 try{const value=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(value)?value:[]}catch{return[]}
}
function writeLocalArray(key,value){localStorage.setItem(key,JSON.stringify(value))}
function addActivity(text,type="info",carId=""){
 const rows=readLocalArray(ACTIVITY_KEY);
 rows.unshift({id:uid(),date:new Date().toISOString(),text,type,carId});
 writeLocalArray(ACTIVITY_KEY,rows.slice(0,150));
 renderDesktopActivityFeed()
}
function activityIcon(type){return{status:"↔",service:"🔧",insurance:"🛡",inspection:"✓",payment:"$",expense:"↓",car:"🚘",info:"•"}[type]||"•"}
function renderDesktopActivityFeed(){
 const root=$("#desktopActivityFeed");if(!root)return;
 const rows=readLocalArray(ACTIVITY_KEY).slice(0,10);
 root.innerHTML=rows.length?rows.map(row=>`<button type="button" class="activity-row" ${row.carId?`onclick="openCar('${row.carId}')"`:""}>
  <span>${activityIcon(row.type)}</span><div><strong>${row.text}</strong><small>${new Date(row.date).toLocaleString("ru-RU")}</small></div>
 </button>`).join(""):`<div class="control-empty">Действий пока нет</div>`
}

function systemTodayTasks(){
 const rows=[];
 fleetCars().forEach(c=>{
  const m=model(c),h=safeDesktopHealth(c),forecast=forecastService(c);
  if(h.insuranceDays<0)rows.push({id:`sys-ins-${c.id}`,system:true,carId:c.id,text:`Продлить страховку: ${m.brand} ${m.model}`,level:"danger"});
  else if(h.insuranceDays<=7)rows.push({id:`sys-ins-${c.id}`,system:true,carId:c.id,text:`Страховка через ${h.insuranceDays} дн.: ${m.brand} ${m.model}`,level:"warning"});
  if(h.inspectionDays<0)rows.push({id:`sys-insp-${c.id}`,system:true,carId:c.id,text:`Обновить техосмотр: ${m.brand} ${m.model}`,level:"danger"});
  else if(h.inspectionDays<=7)rows.push({id:`sys-insp-${c.id}`,system:true,carId:c.id,text:`Техосмотр через ${h.inspectionDays} дн.: ${m.brand} ${m.model}`,level:"warning"});
  if(h.oilLeft<=0)rows.push({id:`sys-oil-${c.id}`,system:true,carId:c.id,text:`Заменить масло: ${m.brand} ${m.model}`,level:"danger"});
  else if(forecast&&forecast.days<=7)rows.push({id:`sys-oil-${c.id}`,system:true,carId:c.id,text:`Масло примерно через ${forecast.days} дн.: ${m.brand} ${m.model}`,level:"warning"});
 });
 return rows.slice(0,8)
}
function renderTodayTasks(){
 const root=$("#todayTaskList");if(!root)return;
 const manual=readLocalArray(TASKS_KEY).filter(task=>!task.done);
 const rows=[...systemTodayTasks(),...manual].slice(0,10);
 root.innerHTML=rows.length?rows.map(task=>`<label class="today-task ${task.level||""}">
  <input type="checkbox" onchange="${task.system?`openCar('${task.carId}');this.checked=false`:`completeManualTask('${task.id}')`}">
  <span></span><strong>${task.text}</strong>
 </label>`).join(""):`<div class="control-empty success">На сегодня обязательных задач нет</div>`
}
function addManualTask(){
 const text=prompt("Новая задача");
 if(!text?.trim())return;
 const tasks=readLocalArray(TASKS_KEY);
 tasks.unshift({id:uid(),text:text.trim(),done:false,date:today()});
 writeLocalArray(TASKS_KEY,tasks);renderTodayTasks();addActivity(`Добавлена задача: ${text.trim()}`,"info")
}
function completeManualTask(id){
 const tasks=readLocalArray(TASKS_KEY),task=tasks.find(x=>x.id===id);
 if(task){task.done=true;writeLocalArray(TASKS_KEY,tasks);addActivity(`Выполнена задача: ${task.text}`,"info")}
 renderTodayTasks()
}
window.completeManualTask=completeManualTask;

function renderTopProfitCars(){
 const root=$("#topProfitCars");if(!root)return;
 const rows=fleetCars().map(c=>({c,profit:safeDesktopCarProfit(c.id)})).sort((a,b)=>b.profit-a.profit);
 const top=rows.slice(0,3),low=rows.filter(x=>x.profit<0).slice(-2);
 const output=[...top.map((x,i)=>({...x,label:["🥇","🥈","🥉"][i],kind:"top"})),...low.map(x=>({...x,label:"↓",kind:"low"}))];
 root.innerHTML=output.length?output.map(x=>`<button type="button" class="profit-rank-row ${x.kind}" onclick="openCar('${x.c.id}')">
  <span>${x.label}</span><div><strong>${model(x.c).brand} ${model(x.c).model}</strong><small>${x.c.plate}</small></div><b>${money(x.profit)}</b>
 </button>`).join(""):`<div class="control-empty">Нет финансовых данных</div>`
}

function criticalAlerts(){
 const alerts=[];
 fleetCars().forEach(c=>{
  const m=model(c),h=safeDesktopHealth(c),forecast=forecastService(c);
  if(h.insuranceDays<0)alerts.push({carId:c.id,text:`${m.brand} ${m.model}: страховка просрочена на ${Math.abs(h.insuranceDays)} дн.`});
  else if(h.insuranceDays<=7)alerts.push({carId:c.id,text:`${m.brand} ${m.model}: страховка через ${h.insuranceDays} дн.`});
  if(h.inspectionDays<0)alerts.push({carId:c.id,text:`${m.brand} ${m.model}: техосмотр просрочен на ${Math.abs(h.inspectionDays)} дн.`});
  else if(h.inspectionDays<=7)alerts.push({carId:c.id,text:`${m.brand} ${m.model}: техосмотр через ${h.inspectionDays} дн.`});
  if(h.oilLeft<=0)alerts.push({carId:c.id,text:`${m.brand} ${m.model}: требуется замена масла.`});
  else if(forecast&&forecast.days<=7)alerts.push({carId:c.id,text:`${m.brand} ${m.model}: масло примерно через ${forecast.days} дн.`});
 });
 return alerts.slice(0,12)
}
function maybeShowCriticalAlert(force=false){
 const dialog=$("#criticalAlertDialog");if(!dialog||dialog.open)return;
 const alerts=criticalAlerts();if(!alerts.length)return;
 const last=localStorage.getItem(ALERT_KEY);
 if(!force&&last===today())return;
 $("#criticalAlertTitle").textContent=`Требуют внимания — ${new Set(alerts.map(x=>x.carId)).size} авто`;
 $("#criticalAlertList").innerHTML=alerts.map(x=>`<button type="button" onclick="$('#criticalAlertDialog').close();openSmartEntity('${x.type||'vehicle'}','${x.entityId||''}','${x.carId}')">${x.text}<span>›</span></button>`).join("");
 dialog.showModal()
}

let currentVehicleReportHtml="";
let currentVehicleReportFilename="FleetPilot-report.html";

function reportSafe(value,fallback="—"){
 const text=String(value??"").trim();
 return text||fallback
}
function reportDate(value){
 if(!value)return"—";
 try{return new Date(value).toLocaleDateString("ru-RU")}catch{return String(value)}
}
function reportMoney(value){
 const number=Number(value||0);
 return `${number.toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})} zł`
}
function buildVehicleReportHtml(carId){
 const c=car(carId);
 if(!c)throw new Error("Автомобиль не найден");

 const m=model(c)||{brand:"Автомобиль",model:""};
 const h=safeDesktopHealth(c);
 const profit=safeDesktopCarProfit(c.id);
 const repairs=Array.isArray(db.repairs)?db.repairs.filter(x=>x.carId===c.id):[];
 const expenses=Array.isArray(db.expenses)?db.expenses.filter(x=>x.carId===c.id):[];
 const payments=Array.isArray(db.payments)?db.payments.filter(x=>x.carId===c.id):[];
 const generated=new Date().toLocaleString("ru-RU");
 const photo=c.customPhoto||m.image||"";

 const totalExpenses=expenses.reduce((sum,x)=>sum+Number(x.amount||0),0);
 const totalPayments=payments.reduce((sum,x)=>sum+Number(x.amount||0),0);
 const repairTotal=repairs.reduce((sum,x)=>sum+Number(x.actual||x.planned||0),0);

 const repairRows=repairs.length
  ?repairs.slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).map(x=>`
    <tr><td>${reportDate(x.date)}</td><td>${reportSafe(x.title,"Ремонт")}</td><td>${reportMoney(x.actual||x.planned)}</td><td>${reportSafe(x.status,"—")}</td></tr>`).join("")
  :`<tr><td colspan="4" class="empty">Записей о ремонтах нет</td></tr>`;

 const expenseRows=expenses.length
  ?expenses.slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,30).map(x=>`
    <tr><td>${reportDate(x.date)}</td><td>${reportSafe(x.category||x.title,"Расход")}</td><td>${reportMoney(x.amount)}</td><td>${reportSafe(x.note,"")}</td></tr>`).join("")
  :`<tr><td colspan="4" class="empty">Расходов нет</td></tr>`;

 return`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FleetPilot — ${reportSafe(m.brand)} ${reportSafe(m.model,"")}</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:28px;background:#f4f7fb;color:#172033;font-family:Arial,Helvetica,sans-serif}
.report{max-width:960px;margin:auto;background:#fff;border:1px solid #e3e8ef;border-radius:22px;overflow:hidden;box-shadow:0 18px 55px rgba(15,23,42,.10)}
.hero{position:relative;min-height:210px;padding:28px;background:linear-gradient(135deg,#111827,#28385e);color:#fff;overflow:hidden}
.hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35}
.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(15,23,42,.96),rgba(15,23,42,.48))}
.hero-content{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:flex-end;min-height:154px}
.brand{font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#a5b4fc}
h1{margin:8px 0 7px;font-size:32px;letter-spacing:-.04em}
.meta{color:#d7deea;font-size:12px}
.status{padding:9px 12px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(255,255,255,.10);font-size:11px;font-weight:800}
.content{padding:24px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
.card{padding:15px;border:1px solid #e5e9ef;border-radius:15px;background:#f8fafc}
.card small{display:block;color:#8994a5;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.card strong{display:block;margin-top:8px;font-size:18px}
.section{margin-top:26px}
.section h2{margin:0 0 11px;font-size:17px}
.info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}
.info{display:flex;justify-content:space-between;gap:16px;padding:11px 12px;border-bottom:1px solid #edf0f4;font-size:11px}
.info span{color:#7b8798}.info strong{text-align:right}
table{width:100%;border-collapse:collapse;border:1px solid #e5e9ef;border-radius:12px;overflow:hidden}
th{padding:10px;background:#f4f7fb;color:#64748b;font-size:9px;text-align:left;text-transform:uppercase}
td{padding:10px;border-top:1px solid #edf0f4;font-size:10px}
.empty{text-align:center;color:#94a3b8;padding:24px}
.footer{display:flex;justify-content:space-between;padding:16px 24px;border-top:1px solid #edf0f4;color:#8792a3;font-size:9px}
@media(max-width:700px){body{padding:0}.report{border-radius:0}.grid{grid-template-columns:repeat(2,1fr)}.info-grid{grid-template-columns:1fr}.hero-content{display:block}.status{display:inline-block;margin-top:14px}}
@media print{body{padding:0;background:#fff}.report{max-width:none;border:0;border-radius:0;box-shadow:none}.section{break-inside:avoid}.hero{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<main class="report">
 <header class="hero">
  ${photo?`<img src="${photo}" alt="">`:""}
  <div class="hero-content">
   <div><div class="brand">FleetPilot Vehicle Report</div><h1>${reportSafe(m.brand)} ${reportSafe(m.model,"")}</h1><div class="meta">${reportSafe(c.plate)} · ${reportSafe(c.city)} · ${reportSafe(c.tenant,"Без водителя")}</div></div>
   <div class="status">${statusText(c.status)}</div>
  </div>
 </header>
 <div class="content">
  <section class="grid">
   <div class="card"><small>Пробег</small><strong>${km(Number(c.mileage||0))}</strong></div>
   <div class="card"><small>Прибыль месяца</small><strong>${reportMoney(profit)}</strong></div>
   <div class="card"><small>До замены масла</small><strong>${h.oilLeft<=0?"Просрочено":km(h.oilLeft)}</strong></div>
   <div class="card"><small>Платежи всего</small><strong>${reportMoney(totalPayments)}</strong></div>
  </section>

  <section class="section">
   <h2>Основная информация</h2>
   <div class="info-grid">
    <div class="info"><span>Госномер</span><strong>${reportSafe(c.plate)}</strong></div>
    <div class="info"><span>VIN</span><strong>${reportSafe(c.vin)}</strong></div>
    <div class="info"><span>Год выпуска</span><strong>${reportSafe(c.year)}</strong></div>
    <div class="info"><span>Город</span><strong>${reportSafe(c.city)}</strong></div>
    <div class="info"><span>Водитель</span><strong>${reportSafe(c.tenant,"Без водителя")}</strong></div>
    <div class="info"><span>Статус</span><strong>${statusText(c.status)}</strong></div>
    <div class="info"><span>Страховка до</span><strong>${reportDate(c.insurance)}</strong></div>
    <div class="info"><span>Техосмотр до</span><strong>${reportDate(c.inspection)}</strong></div>
    <div class="info"><span>Расходы</span><strong>${reportMoney(totalExpenses)}</strong></div>
    <div class="info"><span>Ремонты</span><strong>${reportMoney(repairTotal)}</strong></div>
   </div>
  </section>

  <section class="section">
   <h2>История ремонтов</h2>
   <table><thead><tr><th>Дата</th><th>Работа</th><th>Стоимость</th><th>Статус</th></tr></thead><tbody>${repairRows}</tbody></table>
  </section>

  <section class="section">
   <h2>Последние расходы</h2>
   <table><thead><tr><th>Дата</th><th>Категория</th><th>Сумма</th><th>Комментарий</th></tr></thead><tbody>${expenseRows}</tbody></table>
  </section>
 </div>
 <footer class="footer"><span>Создано автоматически в FleetPilot</span><span>${generated}</span></footer>
</main>
</body>
</html>`
}

function exportCarPdf(carId){
 try{
  const c=car(carId);
  if(!c)return toast("Автомобиль не найден");

  currentVehicleReportHtml=buildVehicleReportHtml(carId);
  const m=model(c)||{brand:"Автомобиль",model:""};
  currentVehicleReportFilename=`FleetPilot-${String(c.plate||`${m.brand}-${m.model}`).replace(/[^a-zA-Z0-9а-яА-ЯёЁ_-]+/g,"-")}.html`;

  const frame=$("#vehicleReportFrame");
  const dialog=$("#vehicleReportDialog");
  if(!frame||!dialog)throw new Error("Окно отчёта не найдено");

  $("#vehicleReportDialogTitle").textContent=`${m.brand} ${m.model} · ${c.plate||"без номера"}`;
  frame.srcdoc=currentVehicleReportHtml;
  dialog.showModal();
  addActivity(`${m.brand} ${m.model}: сформирован отчёт`,"info",c.id)
 }catch(error){
  console.error("FleetPilot report error",error);
  toast(`Не удалось сформировать отчёт: ${error.message||"ошибка"}`)
 }
}

function printCurrentVehicleReport(){
 const frame=$("#vehicleReportFrame");
 if(!frame?.contentWindow)return toast("Отчёт ещё загружается");
 try{
  frame.contentWindow.focus();
  frame.contentWindow.print()
 }catch(error){
  console.error(error);
  toast("Браузер заблокировал печать")
 }
}

function downloadCurrentVehicleReportHtml(){
 if(!currentVehicleReportHtml)return toast("Сначала сформируйте отчёт");
 const blob=new Blob([currentVehicleReportHtml],{type:"text/html;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const link=document.createElement("a");
 link.href=url;
 link.download=currentVehicleReportFilename;
 document.body.appendChild(link);
 link.click();
 link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000)
}

window.exportCarPdf=exportCarPdf;


function renderControlCenterExtras(){
 renderTodayTasks();renderTopProfitCars();renderDesktopActivityFeed();applyControlWindowSettings()
}

let desktopMapSelectedCity="";
let desktopMapHasInitialFit=false;
let desktopRefreshFrame=0;
const desktopSelection=new Set();
const POLAND_CITY_COORDS={
 "warszawa":[52.2297,21.0122],"warsaw":[52.2297,21.0122],
 "kraków":[50.0647,19.9450],"krakow":[50.0647,19.9450],"cracow":[50.0647,19.9450],
 "łódź":[51.7592,19.4560],"lodz":[51.7592,19.4560],
 "wrocław":[51.1079,17.0385],"wroclaw":[51.1079,17.0385],
 "poznań":[52.4064,16.9252],"poznan":[52.4064,16.9252],
 "gdańsk":[54.3520,18.6466],"gdansk":[54.3520,18.6466],
 "szczecin":[53.4285,14.5528],"bydgoszcz":[53.1235,18.0084],
 "lublin":[51.2465,22.5684],"katowice":[50.2649,19.0238],
 "białystok":[53.1325,23.1688],"bialystok":[53.1325,23.1688],
 "gdynia":[54.5189,18.5305],"częstochowa":[50.8118,19.1203],"czestochowa":[50.8118,19.1203],
 "radom":[51.4027,21.1471],"toruń":[53.0138,18.5984],"torun":[53.0138,18.5984],
 "rzeszów":[50.0412,21.9991],"rzeszow":[50.0412,21.9991],
 "kielce":[50.8661,20.6286],"olsztyn":[53.7784,20.4801],"opole":[50.6751,17.9213],
 "zielona góra":[51.9356,15.5062],"zielona gora":[51.9356,15.5062],
 "bielsko-biała":[49.8224,19.0469],"bielsko biala":[49.8224,19.0469],
 "gliwice":[50.2945,18.6714],"zabrze":[50.3249,18.7857],"rybnik":[50.1022,18.5463],
 "tychy":[50.1372,18.9664],"sopot":[54.4416,18.5601],"koszalin":[54.1944,16.1722],
 "elbląg":[54.1522,19.4045],"elblag":[54.1522,19.4045],
 "płock":[52.5463,19.7065],"plock":[52.5463,19.7065],
 "kalisz":[51.7611,18.0910],"legnica":[51.2070,16.1553],"wałbrzych":[50.7714,16.2843],"walbrzych":[50.7714,16.2843],
 "grudziądz":[53.4837,18.7536],"grudziadz":[53.4837,18.7536],
 "włocławek":[52.6483,19.0678],"wloclawek":[52.6483,19.0678],
 "słupsk":[54.4641,17.0287],"slupsk":[54.4641,17.0287],
 "nowy sącz":[49.6218,20.6970],"nowy sacz":[49.6218,20.6970],
 "jelenia góra":[50.9044,15.7194],"jelenia gora":[50.9044,15.7194],
 "piotrków trybunalski":[51.4052,19.7030],"piotrkow trybunalski":[51.4052,19.7030]
};


function scheduleDesktopLiveRefresh(options={}){
 if(window.innerWidth<1100)return;
 cancelAnimationFrame(desktopRefreshFrame);
 desktopRefreshFrame=requestAnimationFrame(()=>{
  renderDesktopCommandKpis();
  renderDesktopEvents();
  renderDesktopInsights();

  const view=desktopView();
  if(view==="board")renderDesktopBoard();
  if(view==="table")renderDesktopTable();
  if(view==="map"){
   renderDesktopMap(desktopMapSelectedCity,{
    preserveViewport:options.preserveMapViewport!==false,
    forceFit:Boolean(options.forceMapFit)
   })
  }

  syncDesktopSelection();
  requestAnimationFrame(()=>{
   invalidateFleetLeafletMap();
  })
 })
}

function updateCarStatusLive(carId,status){
 const c=car(carId);
 if(!c||!["active","repair","free"].includes(status))return;
 const previous=c.status;
 if(previous===status)return;

 c.status=status;
 save();

 // Update every desktop representation immediately.
 renderFleet();
 scheduleDesktopLiveRefresh({preserveMapViewport:true});
 addActivity(`${model(c).brand} ${model(c).model}: статус изменён на «${statusText(status)}»`,"status",c.id);
 toast(`Статус: ${statusText(status)}`)
}


function invalidateFleetLeafletMap(){
 const map=leafletFleetMap;
 if(!map||typeof map.invalidateSize!=="function")return;
 try{map.invalidateSize({pan:false})}catch(error){console.warn("Leaflet invalidateSize failed",error)}
}

window.openFullFleetMap=function openFullFleetMap(){
 setDesktopView("map");
 openFleetMapV2();

 requestAnimationFrame(()=>{
  const fullMap=$("#desktopMapView");
  if(fullMap){
   fullMap.scrollIntoView({behavior:"smooth",block:"start"});
   fullMap.classList.add("full-map-highlight");
   setTimeout(()=>fullMap.classList.remove("full-map-highlight"),900)
  }

  [0,120,320,650].forEach(delay=>
   setTimeout(invalidateFleetLeafletMap,delay)
  )
 })
}

function desktopView(){
 return localStorage.getItem(DESKTOP_VIEW_KEY)||"list"
}

function setDesktopView(view){
 localStorage.setItem(DESKTOP_VIEW_KEY,view);
 document.documentElement.dataset.desktopFleetView=view;
 $$("[data-fleet-view]").forEach(button=>button.classList.toggle("active",button.dataset.fleetView===view));
 $$("[data-command-view]").forEach(panel=>panel.hidden=panel.dataset.commandView!==view);

 const grid=$("#fleetGrid");
 if(grid)grid.closest("[data-dashboard-block='cars']")?.classList.toggle("desktop-command-hidden",view!=="list");

 requestAnimationFrame(()=>{
  if(view==="board")renderDesktopBoard();
  if(view==="table")renderDesktopTable();
  if(view==="map"){
   renderDesktopMap(desktopMapSelectedCity,{
    preserveViewport:desktopMapHasInitialFit,
    forceFit:!desktopMapHasInitialFit
   });
   requestAnimationFrame(()=>{
    invalidateFleetLeafletMap();
    setTimeout(invalidateFleetLeafletMap,120);
    setTimeout(invalidateFleetLeafletMap,350)
   })
  }
  renderDesktopEvents();
  renderDesktopInsights();
 })
}

function fleetPilotCurrentMonth(){
 const now=new Date();
 return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`
}

function currentMonthCashReceived(){
 const month=fleetPilotCurrentMonth();
 const allowed=new Set(cityFilteredCars().map(c=>c.id));
 return (db.payments||[]).filter(p=>{
  if(!allowed.has(p.carId))return false;
  const cashDate=String(p.date||"");
  return cashDate.slice(0,7)===month
 }).reduce((sum,p)=>sum+Number(p.received||0),0)
}

function currentMonthAccruedRows(){
 const month=fleetPilotCurrentMonth(),[yy,mm]=month.split("-").map(Number);
 const monthStart=new Date(yy,mm-1,1,12),monthEnd=new Date(yy,mm,0,12);
 const allowed=new Set(cityFilteredCars().map(c=>c.id));
 const dayMs=86400000;
 return (db.payments||[]).filter(p=>allowed.has(p.carId)).map(p=>{
  const amount=Number(p.expected??p.received??0);
  const fromRaw=p.periodFrom||p.from||p.date||"",toRaw=p.periodTo||p.to||p.date||fromRaw;
  if(!fromRaw)return null;
  const from=new Date(fromRaw+"T12:00:00"),to=new Date(toRaw+"T12:00:00");
  if(Number.isNaN(from.getTime())||Number.isNaN(to.getTime())||to<monthStart||from>monthEnd)return null;
  const overlapFrom=from>monthStart?from:monthStart,overlapTo=to<monthEnd?to:monthEnd;
  const totalDays=Math.max(1,Math.round((to-from)/dayMs)+1),overlapDays=Math.max(0,Math.round((overlapTo-overlapFrom)/dayMs)+1);
  return {payment:p,amount:amount*(overlapDays/totalDays),overlapDays,totalDays}
 }).filter(Boolean)
}
function currentMonthAccruedIncome(){return currentMonthAccruedRows().reduce((s,x)=>s+x.amount,0)}

function desktopMonthLabel(){
 return new Intl.DateTimeFormat("ru-RU",{month:"long",year:"numeric"}).format(new Date())
}
function desktopCommandKpis(){
 const cars=fleetCars(),active=cars.filter(c=>c.status==="active").length,repair=cars.filter(c=>c.status==="repair").length,free=cars.filter(c=>c.status==="free").length,attentionCount=cars.filter(attention).length;
 const month=financialDataForVisibleCars(fleetPilotCurrentMonth()),week=weekPlanData();
 const accruedMonthIncome=currentMonthAccruedIncome(),paidCosts=Number(month.grossCosts||0),cashReceived=currentMonthCashReceived(),actualCash=cashReceived-paidCosts;
 return[
  ["Прибыль за "+new Intl.DateTimeFormat("ru-RU",{month:"long"}).format(new Date()),money(accruedMonthIncome),"Начислено за текущий месяц",accruedMonthIncome<0?"danger":"good","finance"],
  ["Плановый приход недели",money(week.plannedRevenue||0),`${week.activeCars} авто в активной аренде`,week.plannedRevenue?"primary":"good","finance"],
  ["План расходов недели",money(week.totalPlannedCosts||0),"Ещё предстоит оплатить",week.totalPlannedCosts?"warning":"primary","finance"],
  ["Оплаченные расходы",money(paidCosts),`Оплачено за ${new Intl.DateTimeFormat("ru-RU",{month:"long"}).format(new Date())}`,paidCosts?"warning":"good","finance"],
  ["Фактический результат",money(actualCash),`${money(cashReceived)} получено − ${money(paidCosts)} расходов`,actualCash<0?"danger":"good","finance"],
  ["На линии",`${active} / ${cars.length}`,free?`${free} свободно`:"Все заняты","good","ops"],
  ["Сервис и контроль",String(repair+attentionCount),`${repair} в ремонте · ${attentionCount} требуют внимания`,repair+attentionCount?"warning":"good","ops"]
 ]
}
function renderDesktopCommandKpis(){
 const root=$("#desktopCommandKpis");if(!root)return;
 const rows=desktopCommandKpis();
 root.innerHTML=`<div class="desktop-finance-kpis">${rows.slice(0,5).map(([label,value,hint,type],index)=>`<button type="button" class="desktop-command-kpi ${type}" onclick="handleDesktopKpi(${index})"><small>${label}</small><strong>${value}</strong><span>${hint}</span></button>`).join("")}</div><div class="desktop-ops-kpis">${rows.slice(5).map(([label,value,hint,type],i)=>`<button type="button" class="desktop-command-kpi desktop-ops-kpi ${type}" onclick="handleDesktopKpi(${i+5})"><small>${label}</small><strong>${value}</strong><span>${hint}</span><b>Открыть →</b></button>`).join("")}</div>`
}
function desktopKpiModal(){
 let modal=$("#desktopKpiModal");if(modal)return modal;
 document.body.insertAdjacentHTML("beforeend",`<div id="desktopKpiModal" class="desktop-kpi-modal" hidden><div class="desktop-kpi-dialog"><button class="desktop-kpi-close" type="button" aria-label="Закрыть">×</button><div id="desktopKpiModalBody"></div></div></div>`);
 modal=$("#desktopKpiModal");modal.querySelector(".desktop-kpi-close").onclick=()=>modal.hidden=true;modal.onclick=e=>{if(e.target===modal)modal.hidden=true};return modal
}
function desktopExpenseRows(mode){
 const now=new Date(),month=fleetPilotCurrentMonth(),from=startOfWeek(),to=endOfWeek();
 return (db.expenses||[]).filter(x=>{
  if(selectedFleetCity!=="all"&&normalizedCity(car(x.carId)?.city)!==selectedFleetCity)return false;
  if(mode==="paid")return x.status!=="planned"&&String(x.date||"").slice(0,7)===month;
  const d=x.date?new Date(x.date+"T12:00:00"):null;return x.status==="planned"&&d&&d>=from&&d<=to
 })
}
function openDesktopKpiDetails(index){
 const modal=desktopKpiModal(),body=$("#desktopKpiModalBody"),week=weekPlanData(),month=financialDataForVisibleCars(fleetPilotCurrentMonth()),monthLabel=desktopMonthLabel();
 let title="",subtitle="",rows=[],total=0,summary="";
 if(index===0){title="Прибыль месяца";subtitle=monthLabel;const accrued=currentMonthAccruedRows();rows=accrued.map(x=>{const p=x.payment;return{name:`${model(car(p.carId)||{}).brand||"Автомобиль"} ${model(car(p.carId)||{}).model||""}`.trim(),meta:`${p.periodFrom||p.date||""}${p.periodTo?` — ${p.periodTo}`:""} · ${x.overlapDays}/${x.totalDays} дн.`,amount:x.amount}});total=rows.reduce((s,x)=>s+x.amount,0);summary="Только часть начислений, которая относится к текущему календарному месяцу"}
 if(index===1){title="Плановый приход недели";subtitle=`${week.from} — ${week.to}`;rows=cityFilteredCars().filter(c=>c.status==="active"&&(c.driverUserId||c.driverName||c.tenant)).map(c=>({name:`${model(c).brand} ${model(c).model} · ${c.plate}`,meta:c.driverName||c.tenant||"Активная аренда",amount:Number(c.weeklyRent||0)}));total=rows.reduce((s,x)=>s+x.amount,0);summary="Только автомобили в активной аренде на текущей неделе"}
 if(index===2||index===3){const mode=index===2?"plan":"paid";title=index===2?"План расходов недели":"Оплаченные расходы";subtitle=index===2?`${week.from} — ${week.to}`:monthLabel;rows=desktopExpenseRows(mode).map(x=>({name:x.title||x.name||x.category||"Расход",meta:`${car(x.carId)?.plate||""}${x.date?` · ${x.date}`:""}`,amount:Number(x.amount||0)}));total=rows.reduce((s,x)=>s+x.amount,0);summary=index===2?"Только неоплаченные плановые расходы текущей недели":"Только фактически оплаченные расходы текущего месяца"}
 if(index===4){const received=currentMonthCashReceived(),paid=Number(month.grossCosts||0);title="Фактический результат";subtitle=monthLabel;total=received-paid;summary=`Получено ${money(received)} − оплачено расходов ${money(paid)} = ${money(total)}`;rows=[{name:"Фактически получено",meta:"Текущий месяц",amount:received},{name:"Оплаченные расходы",meta:"Текущий месяц",amount:-paid}]}
 body.innerHTML=`<span class="eyebrow">Финансы</span><h2>${title}</h2><p class="desktop-kpi-period">${subtitle}</p><div class="desktop-kpi-summary">${summary}</div><div class="desktop-kpi-rows">${rows.length?rows.map(r=>`<div><span><strong>${r.name}</strong><small>${r.meta||""}</small></span><b class="${r.amount<0?"negative":""}">${money(r.amount)}</b></div>`).join(""):`<div class="desktop-kpi-empty">За этот период записей нет</div>`}</div><div class="desktop-kpi-total"><span>Итого</span><strong class="${total<0?"negative":""}">${money(total)}</strong></div>`;modal.hidden=false
}
function handleDesktopKpi(index){
 if(index<=4){openDesktopKpiDetails(index);return}
 showPage("fleetPage");if(index===5){$("#fleetFilter").value="active";$("#fleetFilter").dispatchEvent(new Event("change"))}else if(index===6){$("#fleetFilter").value="attention";$("#fleetFilter").dispatchEvent(new Event("change"))}
}
window.handleDesktopKpi=handleDesktopKpi;window.openDesktopKpiDetails=openDesktopKpiDetails;

function renderDesktopBoard(){
 const root=$("#desktopFleetBoard");if(!root)return;
 const statuses=["active","repair","free"];
 root.innerHTML=statuses.map(status=>{
  const cars=fleetCars().filter(c=>c.status===status);
  return`<section class="desktop-board-column">
    <div class="desktop-board-column-head"><strong>${statusText(status)}</strong><span>${cars.length}</span></div>
    <div class="desktop-board-dropzone" data-board-drop="${status}">
      ${cars.map(c=>{const m=model(c),h=healthDetails(c);return`<article class="desktop-board-car health-${h.level}" draggable="true" data-board-car="${c.id}" data-fleet-car-id="${c.id}" onclick="openCar('${c.id}')">
        ${fleetServiceBadgeMarkup(c.id,true)}
        <div><strong>${m.brand} ${m.model}</strong><small>${c.plate}${c.city?` · ${c.city}`:""}</small></div>
        <span>${h.items.length?h.items[0].value:"OK"}</span>
      </article>`}).join("")||`<div class="desktop-board-empty">Нет автомобилей</div>`}
    </div>
  </section>`
 }).join("");
 root.querySelectorAll("[data-board-car]").forEach(card=>{
  card.ondragstart=e=>{
   e.stopPropagation();
   card.classList.add("dragging");
   e.dataTransfer.effectAllowed="move";
   e.dataTransfer.setData("text/plain",card.dataset.boardCar)
  };
  card.ondragend=()=>card.classList.remove("dragging")
 });
 root.querySelectorAll("[data-board-drop]").forEach(zone=>{
  zone.ondragover=e=>{e.preventDefault();zone.classList.add("drag-over")};
  zone.ondragleave=()=>zone.classList.remove("drag-over");
  zone.ondrop=e=>{
   e.preventDefault();zone.classList.remove("drag-over");
   const carId=e.dataTransfer.getData("text/plain");
   updateCarStatusLive(carId,zone.dataset.boardDrop)
  }
 })
}

function safeDesktopCarProfit(carId,period=fleetPilotCurrentMonth()){
 try{return Number(financialData(period,carId)?.finalProfit||0)}catch(error){console.warn("FleetPilot table profit fallback",carId,error);return 0}
}

function desktopDocumentDate(value){
 if(!value)return"Дата не указана";
 const parsed=new Date(`${value}T12:00:00`);
 if(Number.isNaN(parsed.getTime()))return String(value);
 return parsed.toLocaleDateString("ru-RU")
}

function safeDesktopHealth(c){
 try{
  const h=healthDetails(c)||{};
  return{level:h.level||"good",oilLeft:Number.isFinite(Number(h.oilLeft))?Number(h.oilLeft):oil(c),insuranceDays:Number.isFinite(Number(h.insuranceDays))?Number(h.insuranceDays):days(c.insurance),inspectionDays:Number.isFinite(Number(h.inspectionDays))?Number(h.inspectionDays):days(c.inspection)}
 }catch(error){
  console.warn("FleetPilot table health fallback",c?.id,error);
  return{level:"good",oilLeft:oil(c),insuranceDays:days(c.insurance),inspectionDays:days(c.inspection)}
 }
}
function desktopTableRow(c,period){
 try{
  const m=model(c)||{brand:"Автомобиль",model:"Без модели"},h=safeDesktopHealth(c),profit=safeDesktopCarProfit(c.id,period),status=["active","repair","free"].includes(c.status)?c.status:"free";
  return`<tr class="${h.level}" data-table-car="${c.id}">
   <td><input type="checkbox" class="desktop-command-checkbox" value="${c.id}" onchange="toggleDesktopSelection('${c.id}',this.checked)"></td>
   <td><button type="button" class="table-car-link" onclick="openCar('${c.id}')"><strong>${m.brand||"Автомобиль"} ${m.model||""}</strong><small>${c.plate||"Без номера"}</small></button></td>
   <td>${c.city||"—"}</td><td>${c.tenant||"—"}</td>
   <td><span class="table-status ${status}">${statusText(status)}</span></td>
   <td>${km(Number(c.mileage||0))}</td>
   <td class="${h.oilLeft<=1500?"warn":""}">${h.oilLeft<=0?"Просрочено":km(h.oilLeft)}</td>
   <td class="${h.insuranceDays<=30?"warn":""}">${h.insuranceDays<0?"Просрочена":h.insuranceDays>=9999?"—":`${h.insuranceDays} дн.`}</td>
   <td class="${h.inspectionDays<=30?"warn":""}">${h.inspectionDays<0?"Просрочен":h.inspectionDays>=9999?"—":`${h.inspectionDays} дн.`}</td>
   <td class="${profit<0?"negative":"positive"}">${money(profit)}</td>
   <td><button type="button" class="table-open" onclick="openCar('${c.id}')">Открыть</button></td>
  </tr>`
 }catch(error){
  console.error("FleetPilot table row failed",c?.id,error);
  return`<tr class="table-row-error"><td></td><td><strong>Ошибка данных автомобиля</strong><small>${c?.plate||c?.id||"Неизвестная запись"}</small></td><td colspan="8">Откройте автомобиль и сохраните данные повторно.</td><td>${c?.id?`<button type="button" class="table-open" onclick="openCar('${c.id}')">Исправить</button>`:""}</td></tr>`
 }
}
function renderDesktopTable(){
 const root=$("#desktopFleetTableBody");
 if(!root)return;

 try{
  const cars=(Array.isArray(db?.cars)?db.cars:[])
   .filter(c=>!c.archived&&!c.deletedAt);

  if(!cars.length){
   root.innerHTML=`<tr class="desktop-table-empty-row">
    <td colspan="11">
     <div class="desktop-table-empty">
      <span>🚘</span>
      <strong>В автопарке пока нет автомобилей</strong>
      <small>Добавьте первый автомобиль — он сразу появится в таблице.</small>
      <button type="button" onclick="openCarDialog()">+ Добавить автомобиль</button>
     </div>
    </td>
   </tr>`;
   return
  }

  root.innerHTML=cars.map(c=>{
   try{
    const m=model(c);
    const health=safeDesktopHealth(c);
    const gps=gpsStatusForCar(c);
    const profit=safeDesktopCarProfit(c.id);

    return`<tr data-table-car-id="${c.id}">
     <td>
      <input type="checkbox"
       class="desktop-command-checkbox"
       value="${c.id}"
       onchange="toggleDesktopSelection('${c.id}',this.checked)">
     </td>
     <td>
      <button type="button" class="desktop-table-car-link" onclick="openCar('${c.id}')">
       <span class="desktop-table-car-photo">
        ${c.customPhoto?`<img src="${c.customPhoto}" alt="${m.brand} ${m.model}">`:"🚘"}
       </span>
       <span>
        <strong>${m.brand} ${m.model}</strong>
        <small>${c.plate||"Без номера"}</small>
       </span>
      </button>
     </td>
     <td>${c.city||"Без города"}</td>
     <td>${c.tenant||"Без водителя"}</td>
     <td><span class="desktop-table-status ${c.status}">${statusText(c.status)}</span></td>
     <td>${Number(c.mileage||0).toLocaleString("ru-RU")} км</td>
     <td>${health.oilLeft<=0?"Просрочено":`${Math.round(health.oilLeft).toLocaleString("ru-RU")} км`}</td>
     <td>${c.insurance?desktopDocumentDate(c.insurance):"—"}</td>
     <td>${c.inspection?desktopDocumentDate(c.inspection):"—"}</td>
     <td class="${profit<0?"negative":"positive"}">${money(profit)}</td>
     <td>
      ${gps
       ?`<button type="button"
          class="desktop-table-find-gps ${gps.online?"online":"offline"}"
          onclick="findCarOnGps('${c.id}')">
          ${gps.online?"⌖ Найти":"Последняя точка"}
        </button>`
       :`<button type="button" class="desktop-table-open" onclick="openCar('${c.id}')">
          Открыть →
        </button>`
      }
     </td>
    </tr>`
   }catch(error){
    console.error("FleetPilot table row failed",c,error);
    return`<tr class="desktop-table-row-error">
     <td colspan="11">
      Не удалось отобразить автомобиль ${c?.plate||c?.id||""}: ${error.message||"ошибка данных"}
     </td>
    </tr>`
   }
  }).join("");

  syncDesktopSelection()
 }catch(error){
  console.error("FleetPilot table failed",error);
  root.innerHTML=`<tr class="desktop-table-row-error">
   <td colspan="11">Ошибка таблицы: ${error.message||"неизвестная ошибка"}</td>
  </tr>`
 }
}

