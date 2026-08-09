/* =========================================================
   FleetPilot V15.6 — Fleet
   Fleet table/cards, vehicle list rendering, filters and fleet dashboard presentation.
   Source order: original app.js lines 4578-5384
   ========================================================= */
/* =========================================================
   Stable vehicle table — works from one automobile
   ========================================================= */

function stableFleetTableCars(){
 return(Array.isArray(db?.cars)?db.cars:[])
  .filter(c=>!c.archived&&!c.deletedAt)
}

function stableFleetTableRoot(){
 return(
  $("#desktopFleetTableBody")||
  $("#desktopFleetTable")||
  $("#fleetTableBody")||
  $("#largeFleetTable")||
  $("#fleetTable")
 )
}

function renderStableFleetTable(){
 const root=stableFleetTableRoot();
 if(!root)return;

 const cars=stableFleetTableCars();

 if(!cars.length){
  root.innerHTML=`<div class="stable-table-empty">
   <span>🚘</span>
   <strong>Автомобилей пока нет</strong>
   <small>Добавьте первый автомобиль, и он появится в таблице.</small>
  </div>`;
  return
 }

 const rows=cars.map(c=>{
  const m=typeof model==="function"?model(c):{brand:"Автомобиль",model:""};
  const health=typeof safeDesktopHealth==="function"
   ?safeDesktopHealth(c)
   :{oilLeft:0,insuranceDays:0,inspectionDays:0};
  const gps=typeof gpsStatusForCar==="function"?gpsStatusForCar(c):null;
  const profit=typeof safeDesktopCarProfit==="function"
   ?safeDesktopCarProfit(c.id)
   :0;

  return`<tr>
   <td>
    <button type="button" class="stable-table-car" onclick="openCar('${c.id}')">
     <span class="stable-table-avatar">${c.customPhoto?`<img src="${c.customPhoto}" alt="">`:"🚘"}</span>
     <span><strong>${m.brand} ${m.model}</strong><small>${c.plate||"Без номера"}</small></span>
    </button>
   </td>
   <td><span class="stable-table-status ${c.status}">${statusText(c.status)}</span></td>
   <td>${c.tenant||"Без водителя"}</td>
   <td>${Number(c.mileage||0).toLocaleString("ru-RU")} км</td>
   <td>${health.oilLeft<=0?"Просрочено":`${Math.round(health.oilLeft).toLocaleString("ru-RU")} км`}</td>
   <td>${c.insurance?desktopDocumentDate(c.insurance):"—"}</td>
   <td>${c.inspection?desktopDocumentDate(c.inspection):"—"}</td>
   <td class="${profit<0?"negative":"positive"}">${money(profit)}</td>
   <td>${gps?`<button class="stable-table-gps ${gps.online?"online":"offline"}" onclick="findCarOnGps('${c.id}')">${gps.online?"GPS online":"GPS offline"}</button>`:"—"}</td>
   <td><button type="button" class="stable-table-open" onclick="openCar('${c.id}')">Открыть →</button></td>
  </tr>`
 }).join("");

 root.innerHTML=`<div class="stable-fleet-table-wrap">
  <table class="stable-fleet-table">
   <thead>
    <tr>
     <th>Автомобиль</th>
     <th>Статус</th>
     <th>Водитель</th>
     <th>Пробег</th>
     <th>Масло</th>
     <th>Страховка</th>
     <th>Техосмотр</th>
     <th>Прибыль</th>
     <th>GPS</th>
     <th></th>
    </tr>
   </thead>
   <tbody>${rows}</tbody>
  </table>
 </div>`
}

window.renderStableFleetTable=renderStableFleetTable;

function renderDesktopEvents(){
 const root=$("#desktopEventFeed");if(!root)return;
 const events=allEvents().filter(e=>e.days>=0).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,10);
 root.innerHTML=events.length?events.map(e=>`<button type="button" class="desktop-event ${e.days<=7?"urgent":e.days<=30?"soon":""}" onclick="openCar('${e.carId}')">
  <button type="button" class="smart-event-button" onclick="openSmartEntity('${e.type}','${e.entityId||''}','${e.carId||''}')"><span>${eventIcon(e.type)}</span><div><strong>${e.title}</strong><small>${e.car}</small></div><time>${e.days===0?"Сегодня":e.days===1?"Завтра":`${e.days} дн.`}</time></button>
 </button>`).join(""):`<div class="command-empty">Ближайших событий нет</div>`
}

function desktopInsightRows(){
 const cars=fleetCars(),rows=[];
 const attentionCars=cars.filter(attention);
 if(attentionCars.length)rows.push({type:"warning",text:`${attentionCars.length} автомобилей требуют внимания.`});
 const upcoming=allEvents().filter(e=>e.days>=0&&e.days<=7);
 if(upcoming.length)rows.push({type:"info",text:`На ближайшие 7 дней запланировано ${upcoming.length} событий.`});
 const planned=weekPlanData();
 if(planned.totalPlannedCosts>0)rows.push({type:"money",text:`На этой неделе нужно подготовить ${money(planned.totalPlannedCosts)} на плановые расходы.`});
 const free=cars.filter(c=>c.status==="free");
 if(free.length)rows.push({type:"info",text:`Свободных автомобилей: ${free.length}. Их можно быстрее вывести на линию.`});
 const best=cars.map(c=>({c,profit:financialData(fleetPilotCurrentMonth(),c.id).finalProfit})).sort((a,b)=>b.profit-a.profit)[0];
 if(best&&best.profit>0)rows.push({type:"good",text:`Лидер месяца: ${model(best.c).brand} ${model(best.c).model} — ${money(best.profit)}.`});
 return rows.slice(0,5)
}

function renderDesktopInsights(){
 const root=$("#desktopAiInsights");if(!root)return;
 root.innerHTML=desktopInsightRows().map(row=>`<article class="desktop-ai-row ${row.type}"><span></span><p>${row.text}</p></article>`).join("")||`<div class="command-empty">Сейчас всё стабильно.</div>`
}

function safeDesktopRender(name,callback){
 try{callback()}catch(error){console.error(`FleetPilot desktop render failed: ${name}`,error)}
}

let fleetPilotBootCompleted=false;
let fleetPilotBootAttempts=0;

function fleetPilotCarsAreLoaded(){
 return Boolean(db&&Array.isArray(db.cars))
}

function forceInitialFleetRender(){
 if(window.innerWidth<1100)return;

 fleetPilotBootAttempts++;

 const fleetPage=$("#fleetPage");
 const fleetGrid=$("#fleetGrid");
 const carsBlock=fleetGrid?.closest("[data-dashboard-block='cars']");

 // Make the fleet page and the list visible before rendering.
 $$(".page").forEach(page=>page.classList.toggle("active",page.id==="fleetPage"));
 if(fleetPage)fleetPage.classList.add("active");

 document.documentElement.dataset.desktopFleetView="list";
 localStorage.setItem(DESKTOP_VIEW_KEY,"list");

 $$("[data-fleet-view]").forEach(button=>{
  button.classList.toggle("active",button.dataset.fleetView==="list")
 });
 $$("[data-command-view]").forEach(panel=>{
  panel.hidden=true
 });

 if(carsBlock){
  carsBlock.hidden=false;
  carsBlock.classList.remove("desktop-command-hidden");
  carsBlock.style.removeProperty("display")
 }

 // Wait for IndexedDB/local data initialization if necessary.
 if(!fleetPilotCarsAreLoaded()){
  if(fleetPilotBootAttempts<20){
   setTimeout(forceInitialFleetRender,80)
  }
  return
 }

 safeDesktopRender("initial fleet",renderFleet);
 safeDesktopRender("initial summary",renderDesktopCommandKpis);
 safeDesktopRender("initial events",renderDesktopEvents);
 safeDesktopRender("initial insights",renderDesktopInsights);
 safeDesktopRender("initial control center",renderControlCenterExtras);
 safeDesktopRender("initial window settings",applyControlWindowSettings);

 requestAnimationFrame(()=>{
  if(carsBlock){
   carsBlock.hidden=false;
   carsBlock.classList.remove("desktop-command-hidden");
   carsBlock.style.removeProperty("display")
  }

  // A second pass is intentional: images, fonts and layout can finish
  // after the first render on GitHub Pages/PWA.
  requestAnimationFrame(()=>{
   safeDesktopRender("fleet second pass",renderFleet);
   if(carsBlock){
    carsBlock.hidden=false;
    carsBlock.classList.remove("desktop-command-hidden");
    carsBlock.style.removeProperty("display")
   }
   fleetPilotBootCompleted=true
  })
 })
}

function scheduleInitialFleetBoot(){
 if(window.innerWidth<1100||fleetPilotBootCompleted)return;
 fleetPilotBootAttempts=0;
 requestAnimationFrame(forceInitialFleetRender);
 setTimeout(forceInitialFleetRender,120);
 setTimeout(forceInitialFleetRender,350)
}

function initializeDesktopCommandCenter(){
 if(window.innerWidth<1100)return;
 const saved=desktopView();
 const view=["list","board","table","map"].includes(saved)?saved:"list";
 const grid=$("#fleetGrid"),carsBlock=grid?.closest("[data-dashboard-block='cars']");
 document.documentElement.dataset.desktopFleetView=view;
 $$("[data-fleet-view]").forEach(button=>button.classList.toggle("active",button.dataset.fleetView===view));
 $$("[data-command-view]").forEach(panel=>panel.hidden=panel.dataset.commandView!==view);
 if(carsBlock){
  carsBlock.classList.toggle("desktop-command-hidden",view!=="list");
  if(view==="list"){carsBlock.classList.remove("desktop-command-hidden");carsBlock.style.removeProperty("display")}
 }
 safeDesktopRender("KPI",renderDesktopCommandKpis);
 safeDesktopRender("events",renderDesktopEvents);
 safeDesktopRender("insights",renderDesktopInsights);
 safeDesktopRender("selection",syncDesktopSelection);
 safeDesktopRender("control center",renderControlCenterExtras);
 requestAnimationFrame(()=>{
  safeDesktopRender("view",()=>setDesktopView(view));
  requestAnimationFrame(()=>{
   if(view==="list"&&carsBlock){carsBlock.classList.remove("desktop-command-hidden");carsBlock.style.removeProperty("display")}
   safeDesktopRender("events second pass",renderDesktopEvents);
   safeDesktopRender("insights second pass",renderDesktopInsights);
   invalidateFleetLeafletMap()
  })
 })
}
function renderDesktopCommand(){initializeDesktopCommandCenter()}

function toggleDesktopSelection(id,checked){
 checked?desktopSelection.add(id):desktopSelection.delete(id);syncDesktopSelection()
}
function syncDesktopSelection(){
 $$(".desktop-command-checkbox").forEach(input=>input.checked=desktopSelection.has(input.value));
 const bar=$("#desktopBulkBar");if(!bar)return;
 bar.hidden=!desktopSelection.size;$("#desktopBulkCount").textContent=desktopSelection.size
}
function clearDesktopSelection(){desktopSelection.clear();syncDesktopSelection()}
function applyDesktopBulkStatus(){
 const status=$("#desktopBulkStatus").value;
 if(!status||!desktopSelection.size)return toast("Выберите статус");
 desktopSelection.forEach(id=>{const c=car(id);if(c)c.status=status});
 save();clearDesktopSelection();renderFleet();
 scheduleDesktopLiveRefresh({preserveMapViewport:true});
 toast("Статусы обновлены")
}
function applyDesktopBulkCity(){
 const city=normalizedCity($("#desktopBulkCity").value);
 if(!city||!desktopSelection.size)return toast("Укажите город");
 desktopSelection.forEach(id=>{const c=car(id);if(c)c.city=city});
 save();clearDesktopSelection();
 desktopMapHasInitialFit=false;
 renderFleet();
 scheduleDesktopLiveRefresh({preserveMapViewport:false,forceMapFit:true});
 toast("Город обновлён")
}
window.toggleDesktopSelection=toggleDesktopSelection;


const OWNER_DASHBOARD_KEY="fleetpilot.owner.dashboard.v1";
const OWNER_WIDGETS=[
 {id:"gps",label:"GPS автопарка"},
 {id:"events",label:"Последние события"},
 {id:"profit",label:"ТОП-5 по прибыли"},
 {id:"attention",label:"Требуют внимания"}
];

function ownerDashboardSettings(){
 try{
  const value=JSON.parse(localStorage.getItem(OWNER_DASHBOARD_KEY)||"null");
  return value&&Array.isArray(value.visible)?value:{visible:OWNER_WIDGETS.map(x=>x.id)}
 }catch{
  return{visible:OWNER_WIDGETS.map(x=>x.id)}
 }
}
function saveOwnerDashboardSettings(settings){
 localStorage.setItem(OWNER_DASHBOARD_KEY,JSON.stringify(settings))
}
function fleetPilotIsOwner(){
 return Boolean(window.FleetPilotCloud?.isOwner)
}
function ownerDashboardMoney(value){
 return`${Number(value||0).toLocaleString("pl-PL",{maximumFractionDigits:0})} zł`
}
function ownerActiveCars(){
 return(Array.isArray(db?.cars)?db.cars:[]).filter(c=>!c.archived&&!c.deletedAt)
}
function ownerCarAttention(car){
 try{
  const h=safeDesktopHealth(car);
  const gps=gpsStatusForCar(car);
  return car.status==="repair"||h.oilLeft<=1000||h.insuranceDays<=7||h.inspectionDays<=7||(gps&&!gps.online)
 }catch{return car.status==="repair"}
}
function ownerDashboardEvents(){
 const activity=Array.isArray(db?.activity)?db.activity:[];
 const timeline=Array.isArray(db?.timeline)?db.timeline:[];
 return[...activity,...timeline]
  .sort((a,b)=>new Date(b.createdAt||b.date||0)-new Date(a.createdAt||a.date||0))
  .slice(0,6)
}
function ownerDashboardEventText(item){
 return item.title||item.action||item.text||item.description||"Изменение в автопарке"
}
function ownerDashboardEventDate(item){
 const value=item.createdAt||item.date||item.updatedAt;
 return value?new Date(value).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):""
}
function renderOwnerDashboard(){
 const root=$("#ownerDashboard");
 if(!root)return;

 const owner=fleetPilotIsOwner();
 root.hidden=!owner;
 const settingsButton=$("#ownerDashboardSettingsButton");
 if(settingsButton)settingsButton.hidden=!owner;
 if(!owner)return;

 const cars=ownerActiveCars();
 const gpsRows=cars.map(car=>({car,gps:gpsStatusForCar(car)}));
 const online=gpsRows.filter(row=>row.gps?.online).length;
 const drivers=cars.filter(car=>car.tenant&&car.status==="active").length;
 const attention=cars.filter(ownerCarAttention);
 const expiringDocs=cars.filter(car=>{
  try{
   const h=safeDesktopHealth(car);
   return h.insuranceDays<=14||h.inspectionDays<=14
  }catch{return false}
 });
 const serviceSoon=cars.filter(car=>{
  try{return safeDesktopHealth(car).oilLeft<=1500}catch{return false}
 });
 const totalProfit=cars.reduce((sum,car)=>sum+Number(safeDesktopCarProfit(car.id)||0),0);

 const kpis=[
  ["⌖","Автомобилей онлайн",`${online} / ${cars.length}`,"GPS сейчас"],
  ["↗","Доход за период",ownerDashboardMoney(totalProfit),"По данным FleetPilot"],
  ["♟","Водителей на линии",drivers,"Активные арендаторы"],
  ["!","Требуют внимания",attention.length,"Документы, ТО или GPS"],
  ["▤","Документы скоро истекают",expiringDocs.length,"В ближайшие 14 дней"],
  ["◇","ТО в ближайшее время",serviceSoon.length,"До 1 500 км"]
 ];
 $("#ownerDashboardKpis").innerHTML=kpis.map(([icon,label,value,note])=>`
  <article class="owner-kpi-card">
   <span class="owner-kpi-icon">${icon}</span>
   <div><small>${label}</small><strong>${value}</strong><p>${note}</p></div>
  </article>`).join("");

 const visible=new Set(ownerDashboardSettings().visible);
 $$("[data-owner-widget]").forEach(widget=>widget.hidden=!visible.has(widget.dataset.ownerWidget));

 $("#ownerGpsStatus").innerHTML=`
  <div class="owner-gps-main">
    <div class="owner-gps-ring">
      <strong>${online}</strong>
      <small>из ${cars.length}</small>
    </div>
    <div>
      <span>Автомобилей онлайн</span>
      <h4>${online} / ${cars.length}</h4>
      <p>${online===cars.length&&cars.length?"Все трекеры передают данные":"Часть автомобилей требует проверки GPS"}</p>
    </div>
  </div>
  <div class="owner-gps-metrics">
    <div><small>GPS подключено</small><strong>${gpsRows.filter(row=>row.gps).length}</strong></div>
    <div><small>Нет сигнала</small><strong>${gpsRows.filter(row=>row.gps&&!row.gps.online).length}</strong></div>
    <div><small>В движении</small><strong>${gpsRows.filter(row=>row.gps?.online&&Number(row.gps.speed||0)>3).length}</strong></div>
  </div>
  <button type="button" class="owner-gps-open-map" onclick="openFullFleetMap()">Открыть карту автопарка</button>`;

 const events=ownerDashboardEvents();
 $("#ownerRecentEvents").innerHTML=events.map(item=>`
  <div class="owner-list-row">
   <span class="owner-list-icon">↻</span>
   <div><strong>${ownerDashboardEventText(item)}</strong><small>${ownerDashboardEventDate(item)}</small></div>
  </div>`).join("")||`<div class="owner-empty">Пока нет новых событий.</div>`;

 const top=[...cars].sort((a,b)=>safeDesktopCarProfit(b.id)-safeDesktopCarProfit(a.id)).slice(0,5);
 $("#ownerTopProfit").innerHTML=top.map((car,index)=>`
  <button type="button" class="owner-list-row owner-profit-row" onclick="openCar('${car.id}')">
   <span class="owner-rank">${index+1}</span>
   <div><strong>${model(car).brand} ${model(car).model}</strong><small>${car.plate||"Без номера"}</small></div>
   <b>${ownerDashboardMoney(safeDesktopCarProfit(car.id))}</b>
  </button>`).join("")||`<div class="owner-empty">Добавьте первый автомобиль.</div>`;

 $("#ownerAttentionCars").innerHTML=attention.slice(0,6).map(car=>{
  let note="Требуется проверка";
  try{
   const h=safeDesktopHealth(car),gps=gpsStatusForCar(car);
   if(vehicleEffectiveStatus(car)==="repair")note="Автомобиль в ремонте";
   else if(h.insuranceDays<=7)note=`Страховка: ${h.insuranceDays} дн.`;
   else if(h.inspectionDays<=7)note=`Техосмотр: ${h.inspectionDays} дн.`;
   else if(h.oilLeft<=1000)note=`Масло через ${Math.max(0,Math.round(h.oilLeft))} км`;
   else if(gps&&!gps.online)note="Нет сигнала GPS"
  }catch{}
  return`<button type="button" class="owner-list-row owner-attention-row" onclick="openCar('${car.id}')">
   <span class="owner-alert-dot"></span>
   <div><strong>${model(car).brand} ${model(car).model}</strong><small>${note}</small></div><b>›</b>
  </button>`
 }).join("")||`<div class="owner-empty owner-all-good">✓ Всё под контролем</div>`;
}
function hideOwnerDashboardWidget(id){
 const settings=ownerDashboardSettings();
 settings.visible=settings.visible.filter(item=>item!==id);
 saveOwnerDashboardSettings(settings);
 renderOwnerDashboard()
}
function renderOwnerDashboardSettings(){
 const root=$("#ownerDashboardWidgetSettings");if(!root)return;
 const visible=new Set(ownerDashboardSettings().visible);
 root.innerHTML=OWNER_WIDGETS.map(item=>`
  <label class="owner-widget-setting-row">
   <span>${item.label}</span>
   <input type="checkbox" value="${item.id}" ${visible.has(item.id)?"checked":""}>
  </label>`).join("")
}
function openOwnerDashboardSettings(){
 renderOwnerDashboardSettings();
 $("#ownerDashboardSettingsDialog")?.showModal()
}
window.hideOwnerDashboardWidget=hideOwnerDashboardWidget;

function renderFleet(){
 refreshCityControls();
 applyUxSettings();
 renderFleetIntelligence();
 renderWeekPlan();
 const period="month",monthText="текущий месяц";
 const q=$("#fleetSearch").value.toLowerCase(),f=$("#fleetFilter").value;
 const source=f==="archive"
  ?archivedCars().filter(c=>selectedFleetCity==="all"||normalizedCity(c.city)===selectedFleetCity)
  :cityFilteredCars();
 const list=source.filter(c=>{const m=model(c),hay=`${m.brand} ${m.model} ${c.plate} ${c.tenant} ${c.city||""}`.toLowerCase();const usage=vehicleEffectiveStatus(c),service=vehicleServiceState(c);return hay.includes(q)&&(f==="all"||f==="archive"||(f==="favorites"?c.favorite:(f==="attention"?attention(c):(f==="repair"?service!=="none":usage===f))))}).sort((a,b)=>Number(b.favorite)-Number(a.favorite)||String(a.plate).localeCompare(String(b.plate)));
 const debt=db.payments.reduce((s,p)=>s+Math.max(0,p.expected-p.received),0);
 const healthRows=cityFilteredCars().map(c=>({c,h:healthDetails(c)}));
 const fleetHealthAverage=cityFilteredCars().length?Math.round(cityFilteredCars().reduce((sum,c)=>sum+vehicleHealthScore(c).score,0)/cityFilteredCars().length):100;
 $("#attentionCount").textContent=healthRows.reduce((s,x)=>s+x.h.items.length,0);
 $("#healthSummary").innerHTML=[
  ["🚨 Требуют внимания",healthRows.filter(x=>x.h.level!=="good").length,healthRows.some(x=>x.h.level==="danger")?"danger":"warning"],
  ["🔴 Критические",healthRows.filter(x=>x.h.level==="danger").length,"danger"],
  ["🛢️ ТО скоро",healthRows.filter(x=>x.h.oilLeft>0&&x.h.oilLeft<=1500).length,"warning"],
  ["🛡️ Страховка",healthRows.filter(x=>x.h.insuranceDays>=0&&x.h.insuranceDays<=30).length,"warning"]
 ].map((x,index)=>`<button class="health-tile ${x[2]} animated-health-tile" style="--tile-index:${index}" onclick="showPage('attentionPage')"><span>${x[0]}</span><strong data-animate-value="${x[1]}" data-animate-format="integer">${x[1]}</strong></button>`).join("");
 $("#fleetSummary").innerHTML=[["Всего",cityFilteredCars().length],["На линии",cityFilteredCars().filter(c=>vehicleEffectiveStatus(c)==="active").length],["В сервисе",cityFilteredCars().filter(c=>vehicleServiceState(c)==="service").length],["Требуют внимания",cityFilteredCars().filter(attention).length],["Состояние парка",fleetHealthAverage+"/100"],["Общий долг",money(debt)]].map(x=>`<div class="summary-card"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");
 $("#fleetGrid").innerHTML=list.map(c=>{const m=model(c),o=oil(c),ins=days(c.insurance),insp=days(c.inspection),att=attention(c);const last=[...db.payments].filter(p=>p.carId===c.id).sort((a,b)=>b.to.localeCompare(a.to))[0];
 const monthData=financialData(period,c.id),monthProfit=monthData.finalProfit;
 const events=eventsForCar(c.id).filter(e=>e.days>=0).sort((a,b)=>a.date.localeCompare(b.date));
 const nextEvent=events[0],serviceForecast=forecastService(c);const health=healthDetails(c),effectiveStatus=vehicleEffectiveStatus(c),serviceState=vehicleServiceState(c),healthScore=vehicleHealthScore(c),activeRepairs=(db.repairs||[]).filter(r=>String(r.carId)===String(c.id)&&!["done","cancelled","canceled","rejected","archived","closed"].includes(String(r.status||"").toLowerCase()));return `<div class="fleet-card-responsive-wrap"><div class="mobile-fleet-card"><article class="car-card no-photo-card health-${health.level} animated-car-card" data-fleet-car-id="${c.id}" style="--card-index:${list.indexOf(c)}">
<div class="no-photo-hero ${effectiveStatus} ${c.customPhoto?"has-custom-photo":""}">
 ${c.customPhoto?`<img class="custom-car-photo" src="${c.customPhoto}" alt="${m.brand} ${m.model}">`:""}
 <div class="custom-photo-shade"></div>
 <div class="photo-service-task-badge">${fleetServiceBadgeMarkup(c.id)}</div>
 <div class="hero-top">
  <div class="hero-status-row"><span class="status ${effectiveStatus}">${statusText(effectiveStatus)}</span><span class="vehicle-health-inline">${healthScore.score}/100</span></div>
  <div class="hero-card-controls">
   <button class="favorite-button ${c.favorite?"active":""}" onclick="event.stopPropagation();toggleFavorite('${c.id}')" aria-label="Избранное">${c.favorite?"★":"☆"}</button>
   ${(()=>{
    const gps=gpsStatusForCar(c);
    if(!gps)return"";
    return`<button type="button"
      class="hero-gps-tracker ${gps.online?"online":"offline"}"
      data-gps-car-id="${c.id}"
      onclick="event.stopPropagation();findCarOnGps('${c.id}')"
      title="${gps.online?`GPS Online · ${Math.round(gps.speed||0)} км/ч`:`GPS Offline · ${gpsSignalText(gps)}`}"
      aria-label="Найти автомобиль на GPS">
      <span class="hero-gps-pulse"></span>
      <span class="hero-gps-pin">⌖</span>
      <span data-gps-label>${gps.online?"GPS":"OFF"}</span>
      <b data-gps-speed>${gps.online?Math.round(gps.speed||0):""}</b>
    </button>`
   })()}
   <button class="card-menu-button" onclick="openCarQuickMenu('${c.id}',event)" aria-label="Быстрые действия">⋮</button>
   <span class="model-year">${c.year}</span>
  </div>
 </div>
 ${c.customPhoto?"":`<div class="vehicle-symbol">🚘</div>`}
 <div class="hero-title">
  <h3>${m.brand} ${m.model}</h3>
  <p>${c.plate} · ${c.tenant||"Без арендатора"}</p>
 </div>
 <div class="hero-business-metrics">
  <button type="button" class="hero-business-metric mileage" onclick="event.stopPropagation();openMileage('${c.id}')">
    <strong>${km(c.mileage)}</strong>
    <small>Пробег</small>
  </button>
  <span class="hero-business-divider"></span>
  <div class="hero-business-metric profit ${monthProfit<0?"negative":""}">
    <strong data-animate-value="${monthProfit}" data-animate-format="money">${money(0)}</strong>
    <small>Прибыль за месяц</small>
  </div>
 </div>
</div>
<div class="car-heading no-photo-heading">
 <div class="section-label">Состояние автомобиля</div>
</div>
<div class="car-body"><div class="vehicle-vitals minimal-service-strip">
<button type="button" class="minimal-service-chip oil ${health.oilLeft<=0?"danger":health.oilLeft<=1500?"warning":"good"}" onclick="event.stopPropagation();openQuickService('${c.id}','oil')">
<span class="minimal-service-accent"></span><span class="minimal-service-icon"><svg viewBox="0 0 24 24"><path d="M4 9h10l2 3h3a2 2 0 0 1 2 2v2h-2v-1h-3.2l-2.3-3.5H8V15H4V9Zm1-4h7v2H5V5Zm-2 8h3v4H3v-4Zm15.5-6.5c.9 1.2 1.5 2.1 1.5 3a1.5 1.5 0 1 1-3 0c0-.9.6-1.8 1.5-3Z"/></svg></span>
<span class="minimal-service-copy"><strong>${health.oilLeft<=0?"0":Math.max(0,Math.round(health.oilLeft)).toLocaleString("ru-RU")}</strong><small>${health.oilLeft<=0?"требует замены":"км до замены"}</small></span>
</button>
<button type="button" class="minimal-service-chip insurance ${health.insuranceDays<0?"danger":health.insuranceDays<=30?"warning":"good"}" onclick="event.stopPropagation();openQuickService('${c.id}','insurance')">
<span class="minimal-service-accent"></span><span class="minimal-service-icon"><svg viewBox="0 0 24 24"><path d="M12 2 4.5 5.2V11c0 5 3.2 9.5 7.5 11 4.3-1.5 7.5-6 7.5-11V5.2L12 2Zm0 3 4.5 1.9V11c0 3.5-1.9 6.8-4.5 8.2C9.4 17.8 7.5 14.5 7.5 11V6.9L12 5Zm-1 3v3H8v2h3v3h2v-3h3v-2h-3V8h-2Z"/></svg></span>
<span class="minimal-service-copy"><strong>${Math.max(0,health.insuranceDays)}</strong><small>${health.insuranceDays<0?"страховка просрочена":"дн. страховка"}</small></span>
</button>
<button type="button" class="minimal-service-chip inspection ${health.inspectionDays<0?"danger":health.inspectionDays<=30?"warning":"good"}" onclick="event.stopPropagation();openQuickService('${c.id}','inspection')">
<span class="minimal-service-accent"></span><span class="minimal-service-icon"><svg viewBox="0 0 24 24"><path d="M9 3h6l1 2h3a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2h3l1-2Zm1.2 2-.5 1H5v12h14V7h-4.7l-.5-1h-3.6Zm.3 8.2 5.1-5.1 1.4 1.4-6.5 6.5-3.4-3.4 1.4-1.4 2 2Z"/></svg></span>
<span class="minimal-service-copy"><strong>${Math.max(0,health.inspectionDays)}</strong><small>${health.inspectionDays<0?"техосмотр просрочен":"дн. техосмотр"}</small></span>
</button>
</div>${(()=>{
 const notices=[];
 if(health.insuranceDays<0)notices.push({type:"insurance",level:"danger",icon:"S",text:`Страховка просрочена на ${Math.abs(health.insuranceDays)} дн.`});
 else if(health.insuranceDays<=30)notices.push({type:"insurance",level:"warning",icon:"S",text:`Страховка заканчивается через ${health.insuranceDays} дн.`});
 if(health.inspectionDays<0)notices.push({type:"inspection",level:"danger",icon:"T",text:`Техосмотр просрочен на ${Math.abs(health.inspectionDays)} дн.`});
 else if(health.inspectionDays<=30)notices.push({type:"inspection",level:"warning",icon:"T",text:`Техосмотр заканчивается через ${health.inspectionDays} дн.`});
 if(health.oilLeft<=0)notices.push({type:"oil",level:"danger",icon:"O",text:`Замена масла просрочена на ${Math.abs(health.oilLeft)} км.`});
 else if(serviceForecast&&serviceForecast.days<=30)notices.push({type:"oil",level:"warning",icon:"O",text:`Замена масла ориентировочно через ${serviceForecast.days} дн. (${km(health.oilLeft)}).`});
 return notices.length?`<div class="service-notification-list">${notices.map(n=>`<button type="button" class="service-notification-row ${n.level}" onclick="event.stopPropagation();openQuickService('${c.id}','${n.type}')"><span>${n.icon}</span><strong>${n.text}</strong><b>›</b></button>`).join("")}</div>`:"";
})()}<div class="metrics no-photo-metrics compact-car-metrics single-event-metrics">
<div class="metric next-event-metric ${nextEvent&&nextEvent.days<=14?"warn":""}">
 <small>Ближайшее событие</small>
 <strong>${nextEvent?`${nextEvent.title} · ${nextEvent.days} дн.`:"Нет запланированных событий"}</strong>
</div>
</div><div class="actions"><button class="btn" onclick="openMileage('${c.id}')">+ Пробег</button><button class="btn primary" onclick="openCar('${c.id}')">Открыть</button></div></div></article></div>
<div class="desktop-fleet-row health-${health.level}" data-command-car="${c.id}" data-fleet-car-id="${c.id}">
<label class="desktop-list-check" onclick="event.stopPropagation()"><input type="checkbox" class="desktop-command-checkbox" value="${c.id}" onchange="toggleDesktopSelection('${c.id}',this.checked)"><span></span></label>
  <span class="desktop-row-accent"></span>
  <div class="desktop-car-photo-wrap" onclick="openCar('${c.id}')">
    ${c.customPhoto?`<img class="desktop-car-photo" src="${c.customPhoto}" alt="${m.brand} ${m.model}">`:`<div class="desktop-car-photo-placeholder">🚘</div>`}
    <div class="desktop-photo-service-task-badge">${fleetServiceBadgeMarkup(c.id,true)}</div>
  </div>
  <div class="desktop-car-identity">
    <div class="desktop-car-title-line">
      <div><h3>${m.brand} ${m.model}</h3><p>${c.plate}${c.tenant?` · ${c.tenant}`:""}</p></div>
      <span class="desktop-status ${effectiveStatus}">${statusText(effectiveStatus)}</span>
    </div>
    ${(()=>{
      const gps=gpsStatusForCar(c);
      if(!gps)return"";
      const updated=new Date(gps.updatedAt);
      const updatedText=Number.isNaN(updated.getTime())?"Нет времени":updated.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
      return`<div class="desktop-gps-line">
        <div class="desktop-gps-status-card ${gps.online?"online":"offline"}">
          <span class="desktop-gps-status-icon">
            <i></i>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"/></svg>
          </span>
          <span class="desktop-gps-status-copy">
            <small>GPS ${gps.online?"ONLINE":"OFFLINE"}</small>
            <strong>${gps.online?`${Math.round(gps.speed||0)} км/ч`:`Последний сигнал ${updatedText}`}</strong>
          </span>
          <button type="button" class="desktop-gps-locate" onclick="event.stopPropagation();findCarOnGps('${c.id}')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 2h2v3.1A7 7 0 0 1 18.9 11H22v2h-3.1A7 7 0 0 1 13 18.9V22h-2v-3.1A7 7 0 0 1 5.1 13H2v-2h3.1A7 7 0 0 1 11 5.1V2Zm1 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 2.5A2.5 2.5 0 1 1 12 14a2.5 2.5 0 0 1 0-5Z"/></svg>
            Найти
          </button>
        </div>
      </div>`
    })()}
    <div class="desktop-service-mini-grid">
      <button type="button" class="desktop-service-mini ${health.oilLeft<=0?"danger":health.oilLeft<=1500?"warning":"good"}" onclick="event.stopPropagation();openQuickService('${c.id}','oil')">
        <span class="desktop-service-symbol"><svg viewBox="0 0 24 24"><path d="M4 9h10l2 3h3a2 2 0 0 1 2 2v2h-2v-1h-3.2l-2.3-3.5H8V15H4V9Zm1-4h7v2H5V5Zm-2 8h3v4H3v-4Zm15.5-6.5c.9 1.2 1.5 2.1 1.5 3a1.5 1.5 0 1 1-3 0c0-.9.6-1.8 1.5-3Z"/></svg></span>
        <span class="desktop-service-copy"><small>Масло</small><strong>${health.oilLeft<=0?"Просрочено":Math.max(0,Math.round(health.oilLeft)).toLocaleString("ru-RU")}</strong><em>${health.oilLeft<=0?`${km(Math.abs(health.oilLeft))} сверх срока`:"км до замены"}</em></span>
      </button>
      <button type="button" class="desktop-service-mini ${health.insuranceDays<0?"danger":health.insuranceDays<=30?"warning":"good"}" onclick="event.stopPropagation();openQuickService('${c.id}','insurance')">
        <span class="desktop-service-symbol"><svg viewBox="0 0 24 24"><path d="M12 2 4.5 5.2V11c0 5 3.2 9.5 7.5 11 4.3-1.5 7.5-6 7.5-11V5.2L12 2Zm0 3 4.5 1.9V11c0 3.5-1.9 6.8-4.5 8.2C9.4 17.8 7.5 14.5 7.5 11V6.9L12 5Zm-1 3v3H8v2h3v3h2v-3h3v-2h-3V8h-2Z"/></svg></span>
        <span class="desktop-service-copy desktop-document-copy">
          <small>Страховка</small>
          <strong>${health.insuranceDays<0?"Просрочена":`${Math.max(0,health.insuranceDays)} дн.`}</strong>
          <em>${desktopDocumentDate(c.insurance)}${health.insuranceDays<0?` · ${Math.abs(health.insuranceDays)} дн. просрочки`:""}</em>
        </span>
      </button>
      <button type="button" class="desktop-service-mini ${health.inspectionDays<0?"danger":health.inspectionDays<=30?"warning":"good"}" onclick="event.stopPropagation();openQuickService('${c.id}','inspection')">
        <span class="desktop-service-symbol"><svg viewBox="0 0 24 24"><path d="M9 3h6l1 2h3a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2h3l1-2Zm1.2 2-.5 1H5v12h14V7h-4.7l-.5-1h-3.6Zm.3 8.2 5.1-5.1 1.4 1.4-6.5 6.5-3.4-3.4 1.4-1.4 2 2Z"/></svg></span>
        <span class="desktop-service-copy desktop-document-copy">
          <small>Техосмотр</small>
          <strong>${health.inspectionDays<0?"Просрочен":`${Math.max(0,health.inspectionDays)} дн.`}</strong>
          <em>${desktopDocumentDate(c.inspection)}${health.inspectionDays<0?` · ${Math.abs(health.inspectionDays)} дн. просрочки`:""}</em>
        </span>
      </button>
    </div>
  </div>
  <div class="desktop-car-kpis">
    <button type="button" class="desktop-kpi" onclick="event.stopPropagation();openMileage('${c.id}')"><strong>${km(c.mileage)}</strong><small>Пробег</small></button>
    <span class="desktop-kpi-divider"></span>
    <div class="desktop-kpi profit ${monthProfit<0?"negative":""}"><strong data-animate-value="${monthProfit}" data-animate-format="money">${money(0)}</strong><small>Прибыль за месяц</small></div>
    <span class="desktop-kpi-divider"></span>
    <button type="button" class="desktop-kpi vehicle-health-kpi" onclick="event.stopPropagation();openCar('${c.id}','info')"><strong>${healthScore.score}/100</strong><small>Состояние · ${activeRepairs.length} задач</small></button>
  </div>
  <div class="desktop-today-card ${nextEvent&&nextEvent.days<=14?"warning":""}" ${nextEvent?`role="button" tabindex="0" onclick="event.stopPropagation();openSmartEntity('${nextEvent.type}','${nextEvent.entityId||""}','${c.id}')"`:""}>
    <small>Сегодня</small>
    <strong>${nextEvent?nextEvent.title:"Автомобиль не требует внимания"}</strong>
    <span>${nextEvent?`${nextEvent.days} дн.`:"Все основные показатели в норме"}</span>
  </div>

  ${(()=>{
    const reminders=[];

    if(health.insuranceDays<0){
      reminders.push({
        type:"insurance",
        level:"danger",
        icon:"🛡",
        title:"Страховка просрочена",
        detail:`на ${Math.abs(health.insuranceDays)} дн.`
      });
    }else if(health.insuranceDays<=30){
      reminders.push({
        type:"insurance",
        level:health.insuranceDays<=7?"danger":"warning",
        icon:"🛡",
        title:"Страховка заканчивается",
        detail:`через ${health.insuranceDays} дн.`
      });
    }

    if(health.inspectionDays<0){
      reminders.push({
        type:"inspection",
        level:"danger",
        icon:"✓",
        title:"Техосмотр просрочен",
        detail:`на ${Math.abs(health.inspectionDays)} дн.`
      });
    }else if(health.inspectionDays<=30){
      reminders.push({
        type:"inspection",
        level:health.inspectionDays<=7?"danger":"warning",
        icon:"✓",
        title:"Техосмотр заканчивается",
        detail:`через ${health.inspectionDays} дн.`
      });
    }

    if(health.oilLeft<=0){
      reminders.push({
        type:"oil",
        level:"danger",
        icon:"◉",
        title:"Требуется замена масла",
        detail:`превышение ${km(Math.abs(health.oilLeft))}`
      });
    }else if(serviceForecast&&serviceForecast.days<=30){
      reminders.push({
        type:"oil",
        level:serviceForecast.days<=7?"danger":"warning",
        icon:"◉",
        title:"Замена масла",
        detail:`примерно через ${serviceForecast.days} дн. · ${km(health.oilLeft)}`
      });
    }

    const repairEvent=events.find(event=>event.type==="repair"&&event.days<=30);
    if(repairEvent){
      reminders.push({
        type:"repair",
        level:repairEvent.days<=7?"warning":"info",
        icon:"R",
        title:repairEvent.title,
        detail:repairEvent.days===0?"сегодня":repairEvent.days===1?"завтра":`через ${repairEvent.days} дн.`
      });
    }

    return reminders.length
      ?`<div class="desktop-car-reminders">${reminders.slice(0,4).map(reminder=>`
        <button type="button"
          class="desktop-car-reminder ${reminder.level}"
          onclick="event.stopPropagation();${reminder.type==="repair"?`openCar('${c.id}')`:`openQuickService('${c.id}','${reminder.type}')`}">
          <span class="desktop-reminder-icon">${reminder.icon}</span>
          <span class="desktop-reminder-copy">
            <strong>${reminder.title}</strong>
            <small>${reminder.detail}</small>
          </span>
          <b>›</b>
        </button>`).join("")}</div>`
      :`<div class="desktop-car-reminders clear">
        <div class="desktop-car-reminder-ok"><span>✓</span><strong>Ближайших обязательных действий нет</strong></div>
       </div>`;
  })()}

  <div class="desktop-row-actions">
    <button class="desktop-secondary-action desktop-pdf-btn" onclick="event.stopPropagation();exportCarPdf('${c.id}')" title="Сформировать PDF">
      <span>PDF</span><small>Отчёт</small>
    </button>
    <button class="btn primary desktop-open-btn" onclick="openCar('${c.id}')"><span>Открыть автомобиль</span><b>→</b></button>
    <button class="desktop-more-btn" onclick="openCarQuickMenu('${c.id}',event)" aria-label="Дополнительные действия">⋮</button>
  </div>
</div></div>`}).join("")||`<div class="card">Автомобили не найдены</div>`;;
 renderDesktopCommand();
 requestAnimationFrame(()=>{animateDashboard();animateProgressBars($("#fleetPage"))})
 requestAnimationFrame(updateGpsBadgesOnly);
}

function activeServiceRepairs(){
 return (db.repairs||[]).filter(r=>!["done","cancelled"].includes(String(r.status||"planned")))
}
function serviceCarTasks(carId){
 const repairs=activeServiceRepairs().filter(r=>String(r.carId)===String(carId));
 const requests=activeDriverRepairRequests().filter(r=>String(r.car_id)===String(carId));
 return{repairs,requests,total:repairs.length+requests.length}
}
function serviceTaskPriority(carId){
 const {repairs,requests}=serviceCarTasks(carId);
 if(requests.some(x=>String(x.urgency)==="critical"))return 100;
 if(repairs.some(x=>String(x.status)==="repair"))return 80;
 if(repairs.some(x=>String(x.status)==="service"))return 60;
 if(repairs.some(x=>String(x.status)==="parts"))return 50;
 if(requests.length)return 40;
 if(repairs.length)return 20;
 return 0
}
function serviceStatusClass(status){
 return {repair:"danger",service:"service",parts:"parts",planned:"planned",done:"done",cancelled:"cancelled"}[status]||"planned"
}
function servicePriorityValue(priority){return {critical:3,today:2,planned:1}[String(priority||"planned")]||1}
function servicePriorityText(priority){return {critical:"Срочно",today:"Сегодня",planned:"Планово"}[String(priority||"planned")]||"Планово"}
function serviceRepairIsOverdue(repair){
 if(!repair?.date||["done","cancelled"].includes(String(repair.status||"")))return false;
 return String(repair.date)<today()
}
function serviceRepairPriority(repair){
 if(repair?.priority)return repair.priority;
 if(serviceRepairIsOverdue(repair))return "critical";
 return String(repair?.date||"")===today()?"today":"planned"
}
function populateServiceMechanicFilter(){
 const select=$("#serviceMechanicFilter");if(!select)return;
 const current=select.value||"all";
 const names=[...new Set((db.repairs||[]).map(r=>String(r.mechanic||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pl"));
 select.innerHTML='<option value="all">Все исполнители</option>'+names.map(name=>`<option value="${name.replaceAll('"','&quot;')}">${name}</option>`).join("");
 select.value=names.includes(current)?current:"all"
}
function updateServiceRepairField(id,field,value){
 const repair=(db.repairs||[]).find(r=>String(r.id)===String(id));if(!repair)return;
 if(!["priority","mechanic","status"].includes(field))return;
 if(field==="status"&&value==="done"&&Number(repair.actual||0)<=0&&repair.paymentStatus!=="warranty"){
  editRepair(repair.id);setTimeout(()=>toast("Для завершения укажите фактическую сумму или гарантию"),80);return
 }
 const previous=structuredClone(repair);
 repair[field]=value;
 if(field==="status"&&value==="done")repair.completedDate=repair.completedDate||today();
 syncServiceRelations(repair,previous);
 logActivity("Изменена сервисная задача","Сервис",`${repair.title} · ${field}`,repair.carId);
 save();renderRepairs();renderExpenses();renderFleet()
}
window.updateServiceRepairField=updateServiceRepairField;
function serviceDragStart(event,id){event.dataTransfer.setData("text/service-repair",String(id));event.dataTransfer.effectAllowed="move"}
function serviceDragOver(event){event.preventDefault();event.dataTransfer.dropEffect="move"}
function serviceDrop(event,status){
 event.preventDefault();const id=event.dataTransfer.getData("text/service-repair");if(!id)return;
 updateServiceRepairField(id,"status",status)
}
window.serviceDragStart=serviceDragStart;window.serviceDragOver=serviceDragOver;window.serviceDrop=serviceDrop;
function serviceFilterMatchesRepair(repair,filter){
 if(filter==="all")return repair.status!=="done"&&repair.status!=="cancelled";
 if(filter==="done")return repair.status==="done";
 if(filter==="requests")return false;
 return repair.status===filter
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
  const requests=activeDriverRepairRequests().filter(r=>String(r.car_id)===String(c.id));
  const plannedExpenses=plannedServiceExpenses(c.id);
  const visibleRepairs=repairs.filter(r=>serviceFilterMatchesRepair(r,statusFilter)).filter(r=>
   (priorityFilter==="all"||serviceRepairPriority(r)===priorityFilter)&&
   (mechanicFilter==="all"||String(r.mechanic||"")===mechanicFilter)
  );
  const statusMatch=statusFilter==="requests"?requests.length>0:
   statusFilter==="planned"?(visibleRepairs.length>0||plannedExpenses.length>0):
   statusFilter==="all"?(visibleRepairs.length>0||requests.length>0||plannedExpenses.length>0):
   statusFilter==="done"?visibleRepairs.length>0:visibleRepairs.length>0;
  const hay=[
   m.brand,m.model,c.plate,c.tenant,c.city,
   ...repairs.flatMap(r=>[r.title,r.service,r.mechanic,r.note,repairStatusText(r.status),servicePriorityText(serviceRepairPriority(r))]),
   ...requests.flatMap(r=>[r.driver_email,r.description,DRIVER_REPAIR_CATEGORY_LABELS[r.category]||r.category]),
   ...plannedExpenses.flatMap(x=>[x.title,x.note,expenseCategoryText(x.category),x.amount])
  ].join(" ").toLowerCase();
  return{c,m,repairs,requests,plannedExpenses,visibleRepairs,statusMatch,hay,priority:serviceTaskPriority(c.id)+(plannedExpenses.length?10:0)}
 }).filter(row=>
  row.statusMatch&&
  (cityFilter==="all"||String(row.c.city||"")===cityFilter)&&
  (!search||row.hay.includes(search))
 );

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
function populateServiceCityFilter(){
 const select=$("#serviceCityFilter");if(!select)return;
 const current=select.value||"all";
 const cities=[...new Set(fleetCars().map(c=>String(c.city||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pl"));
 select.innerHTML='<option value="all">Все города</option>'+cities.map(city=>`<option value="${city.replaceAll('"',"&quot;")}">${city}</option>`).join("");
 select.value=cities.includes(current)?current:"all"
}



/* =========================================================
   V18.7 — Fleet Board source of truth
   ========================================================= */
function setVehicleOperationalStatus(carId,status,options={}){
 const c=car(String(carId||""));
 if(!c)return false;
 const next=String(status||"").toLowerCase();
 if(!["active","repair","free"].includes(next))return false;
 c.status=next;
 save?.();
 renderFleet?.();
 renderStableFleetTable?.();
 try{renderDesktopCommandKpis?.()}catch{}
 try{renderDesktopCommand?.()}catch{}
 try{renderControlCenterExtras?.()}catch{}
 window.dispatchEvent(new CustomEvent("fleetpilot:vehicle-status-changed",{detail:{carId:c.id,status:next,source:options.source||"fleet-board"}}));
 return true
}
window.setVehicleOperationalStatus=setVehicleOperationalStatus;

// Any legacy control that changes c.status can announce a refresh; all badges now read the same field.
window.addEventListener("fleetpilot:vehicle-status-changed",()=>{
 requestAnimationFrame(()=>{try{renderFleet?.()}catch{};try{renderStableFleetTable?.()}catch{}})
});
