/* =========================================================
   FleetPilot V15.6 — GPS & Maps
   GPS configuration, trackers, Leaflet maps, desktop and mobile map rendering.
   Source order: original app.js lines 3651-4577
   ========================================================= */
/* =========================================================
   Fleet Map V2
   Lazy initialization, reliable tiles and city-based markers
   ========================================================= */

let fleetMapV2=null;
let fleetMapV2Layer=null;
let fleetMapV2SelectedCity="";
let fleetMapV2RowsCache=[];


const GPS_CONFIG_KEY="fleetpilot.gps.config.v1";
const GPS_DEVICES_KEY="fleetpilot.gps.devices.v1";
const GPS_MAPPING_KEY="fleetpilot.gps.mapping.v1";
const GPS_DEMO_KEY="fleetpilot.gps.demo.v1";
let gpsDemoTimer=null;


function gpsRead(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
function gpsWrite(key,value){localStorage.setItem(key,JSON.stringify(value))}
function readGpsConfig(){return gpsRead(GPS_CONFIG_KEY,null)}
function readGpsDevices(){return gpsRead(GPS_DEVICES_KEY,[])}
function readGpsMapping(){return gpsRead(GPS_MAPPING_KEY,{})}



const GPS_SYNC_INTERVAL_MS=30000;
let gpsAutoSyncTimer=null;
let gpsCountdownTimer=null;
let gpsNextSyncAt=0;
let gpsSyncBusy=false;

function gpsConnectionActive(){
 return Boolean(readGpsConfig())
}

function gpsSecondsToNextSync(){
 if(!gpsConnectionActive()||!gpsNextSyncAt)return null;
 return Math.max(0,Math.ceil((gpsNextSyncAt-Date.now())/1000))
}

function updateGpsCountdownUi(){
 const seconds=gpsSecondsToNextSync();
 const config=readGpsConfig();
 const devices=readGpsDevices();
 const online=devices.filter(device=>{
  const stamp=new Date(device.updatedAt).getTime();
  return device.online!==false&&Number.isFinite(stamp)&&Date.now()-stamp<15*60*1000
 }).length;

 const desktop=$("#gpsSyncCountdown");
 const mobile=$("#mobileGpsCountdown");
 const status=$("#mobileGpsSyncStatus");
 const time=$("#mobileGpsSyncTime");

 if(desktop)desktop.textContent=seconds===null?"—":seconds;
 if(mobile)mobile.textContent=seconds===null?"—":seconds;

 if(status)status.textContent=config?`${config.providerLabel||"GPS"} · ${online}/${devices.length} online`:"GPS не подключён";
 if(time){
  if(!config)time.textContent="Подключите GPS в настройках";
  else if(gpsSyncBusy)time.textContent="Синхронизация координат…";
  else time.textContent=`Следующее обновление через ${seconds??0} сек.`
 }
}


function gpsSignalText(gps){
 const signal=new Date(gps?.updatedAt||0);
 return Number.isNaN(signal.getTime())
  ?"Нет сигнала"
  :signal.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})
}

function updateGpsBadgesOnly(){
 document.querySelectorAll("[data-gps-car-id]").forEach(button=>{
  const carId=button.dataset.gpsCarId;
  const c=(db?.cars||[]).find(item=>item.id===carId);
  const gps=c?gpsStatusForCar(c):null;

  if(!gps){
   button.hidden=true;
   return
  }

  button.hidden=false;
  button.classList.toggle("online",Boolean(gps.online));
  button.classList.toggle("offline",!gps.online);
  button.setAttribute(
   "aria-label",
   gps.online
    ?`GPS online, скорость ${Math.round(gps.speed||0)} км/ч. Найти автомобиль`
    :`GPS offline, последний сигнал ${gpsSignalText(gps)}. Показать последнюю точку`
  );
  button.title=gps.online
   ?`GPS Online · ${Math.round(gps.speed||0)} км/ч`
   :`GPS Offline · ${gpsSignalText(gps)}`;

  const label=button.querySelector("[data-gps-label]");
  if(label)label.textContent=gps.online?"GPS":"OFF";

  const speed=button.querySelector("[data-gps-speed]");
  if(speed)speed.textContent=gps.online?`${Math.round(gps.speed||0)}`:"";
 });

 document.querySelectorAll("[data-mobile-gps-copy]").forEach(element=>{
  const carId=element.dataset.mobileGpsCopy;
  const c=(db?.cars||[]).find(item=>item.id===carId);
  const gps=c?gpsStatusForCar(c):null;
  if(!gps)return;
  element.textContent=gps.online
   ?`${Math.round(gps.speed||0)} км/ч`
   :`Сигнал ${gpsSignalText(gps)}`
 })
}

function gpsDesktopMapIsVisible(){
 const view=$("#desktopMapView");
 return Boolean(
  window.innerWidth>=1100 &&
  view &&
  !view.hidden &&
  view.offsetParent!==null
 )
}

function gpsMobileMapIsVisible(){
 const page=$("#mobileMapPage");
 return Boolean(
  window.innerWidth<1100 &&
  page &&
  page.classList.contains("active")
 )
}

async function performAutomaticGpsSync(){
 if(gpsSyncBusy||!gpsConnectionActive())return;
 gpsSyncBusy=true;
 updateGpsCountdownUi();

 try{
  if(gpsDemoEnabled())updateGpsDemoDevices();
  else await fetchGpsDevices();

  updateGpsBadgesOnly();

  // Only the currently visible map is redrawn.
  // Main page, tables, analytics and other pages remain untouched.
  if(gpsDesktopMapIsVisible()&&typeof renderFleetMapV2==="function"){
   renderFleetMapV2({fit:false})
  }

  if(gpsMobileMapIsVisible()&&typeof renderMobileGpsMap==="function"){
   renderMobileGpsMap({fit:false})
  }
 }catch(error){
  console.error("GPS auto sync failed",error);
  const mobileError=$("#mobileMapError");
  if(mobileError&&gpsMobileMapIsVisible()){
   mobileError.hidden=false;
   mobileError.textContent=`GPS: ${error.message}`
  }
 }finally{
  gpsSyncBusy=false;
  gpsNextSyncAt=Date.now()+GPS_SYNC_INTERVAL_MS;
  updateGpsCountdownUi()
 }
}

function startUniversalGpsSync(){
 clearInterval(gpsAutoSyncTimer);
 clearInterval(gpsCountdownTimer);

 if(!gpsConnectionActive()){
  gpsNextSyncAt=0;
  updateGpsCountdownUi();
  return
 }

 gpsNextSyncAt=Date.now()+GPS_SYNC_INTERVAL_MS;
 gpsAutoSyncTimer=setInterval(performAutomaticGpsSync,GPS_SYNC_INTERVAL_MS);
 gpsCountdownTimer=setInterval(updateGpsCountdownUi,1000);
 updateGpsCountdownUi()
}

function stopUniversalGpsSync(){
 clearInterval(gpsAutoSyncTimer);
 clearInterval(gpsCountdownTimer);
 gpsAutoSyncTimer=null;
 gpsCountdownTimer=null;
 gpsNextSyncAt=0;
 updateGpsCountdownUi()
}

function gpsDemoEnabled(){
 return localStorage.getItem(GPS_DEMO_KEY)==="1"
}

function gpsDemoBasePoints(){
 return[
  {lat:52.2297,lng:21.0122,name:"Toyota Prius III Demo",plate:"WAW 001"},
  {lat:52.2364,lng:21.0219,name:"Toyota Auris Demo",plate:"WAW 002"},
  {lat:52.2188,lng:20.9852,name:"Toyota Corolla Demo",plate:"WAW 003"},
  {lat:52.2471,lng:21.0410,name:"Skoda Fabia Demo",plate:"WAW 004"},
  {lat:52.2085,lng:21.0315,name:"Toyota Camry Demo",plate:"WAW 005"},
  {lat:52.2580,lng:20.9960,name:"Ford Mondeo Demo",plate:"WAW 006"}
 ]
}

function buildGpsDemoDevices(){
 const cars=(Array.isArray(db?.cars)?db.cars:[]).filter(c=>!c.archived&&!c.deletedAt);
 const source=cars.length?cars:[
  {id:"demo-car-1",plate:"WAW 001",city:"Warszawa"},
  {id:"demo-car-2",plate:"BIA 002",city:"Białystok"},
  {id:"demo-car-3",plate:"KR 003",city:"Kraków"}
 ];
 const counters={};
 return source.map((c,index)=>{
  const m=typeof model==="function"?model(c):{brand:"Автомобиль",model:""};
  const city=normalizeMapCity(c.city);
  const key=normalizeCityKey(city);
  const center=coordinatesForCity(city)||[52.2297,21.0122];
  const n=counters[key]||0;counters[key]=n+1;
  const angle=Math.PI*2*(n%8)/8;
  const radius=.0045*(Math.floor(n/8)+1);
  const lat=center[0]+Math.sin(angle)*radius;
  const lng=center[1]+Math.cos(angle)*radius;
  return{
   id:`demo-${c.id||index+1}`,name:`${m.brand||"Автомобиль"} ${m.model||""}`.trim(),
   plate:c.plate||`DEMO ${index+1}`,latitude:lat,longitude:lng,
   demoBaseLat:lat,demoBaseLng:lng,demoCity:city,
   speed:index%4===3?0:18+(index*9)%48,updatedAt:new Date().toISOString(),
   online:index%5!==4,linkedCarId:c.id||""
  }
 })
}

function updateGpsDemoDevices(){
 if(!gpsDemoEnabled())return readGpsDevices();

 const tick=Date.now()/7000;
 const devices=readGpsDevices().map((device,index)=>{
  if(!String(device.id).startsWith("demo-"))return device;

  const moving=device.online!==false;
  const angle=tick+index*1.41;
  const baseLat=Number(device.demoBaseLat??device.latitude??52.2297);
  const baseLng=Number(device.demoBaseLng??device.longitude??21.0122);
  const radius=moving?0.0012+(index%3)*0.00035:0;

  return{
   ...device,
   demoBaseLat:baseLat,
   demoBaseLng:baseLng,
   latitude:baseLat+Math.sin(angle)*radius,
   longitude:baseLng+Math.cos(angle)*radius,
   speed:moving?Math.round(18+34*Math.abs(Math.sin(angle*1.3))):0,
   updatedAt:new Date().toISOString()
  }
 });

 gpsWrite(GPS_DEVICES_KEY,devices);
 return devices
}

function startGpsDemoMovement(){
 startUniversalGpsSync()
}

function stopGpsDemoMovement(){
 stopUniversalGpsSync()
}

function autoMapDemoDevices(devices){
 const cars=(Array.isArray(db?.cars)?db.cars:[])
  .filter(c=>!c.archived&&!c.deletedAt);
 const mapping={};

 devices.forEach((device,index)=>{
  if(device.linkedCarId&&cars.some(c=>c.id===device.linkedCarId)){
   mapping[device.id]=device.linkedCarId
  }else if(cars[index]){
   mapping[device.id]=cars[index].id
  }
 });

 gpsWrite(GPS_MAPPING_KEY,mapping);
 return mapping
}

function startGpsDemo(){
 const devices=buildGpsDemoDevices();
 const config={
  provider:"demo",
  providerLabel:"GPS Demo",
  apiUrl:"",
  token:"",
  authMode:"none",
  updatedAt:new Date().toISOString(),
  demo:true
 };

 gpsWrite(GPS_CONFIG_KEY,config);
 gpsWrite(GPS_DEVICES_KEY,devices);
 localStorage.setItem(GPS_DEMO_KEY,"1");
 autoMapDemoDevices(devices);
 startUniversalGpsSync();

 $("#gpsSetupDialog")?.close();
 renderGpsConnectionSummary();
 renderFleet();

 setDesktopView("map");

 requestAnimationFrame(()=>{
  if(typeof renderFleetMapV2==="function"){
   renderFleetMapV2({fit:true})
  }
 });

 toast(`GPS Demo запущен: ${devices.length} автомобилей`)
}
window.startGpsDemo=startGpsDemo;

function normalizeGpsDevice(raw,index=0){
 const lat=Number(raw.latitude??raw.lat??raw.position?.latitude??raw.position?.lat);
 const lng=Number(raw.longitude??raw.lng??raw.lon??raw.position?.longitude??raw.position?.lng??raw.position?.lon);
 return{
  id:String(raw.id??raw.deviceId??raw.imei??`device-${index}`),
  name:String(raw.name??raw.vehicleName??raw.label??`GPS ${index+1}`),
  plate:String(raw.plate??raw.registration??""),
  latitude:Number.isFinite(lat)?lat:null,
  longitude:Number.isFinite(lng)?lng:null,
  speed:Number(raw.speed??raw.position?.speed??0)||0,
  updatedAt:String(raw.updatedAt??raw.lastUpdate??raw.timestamp??new Date().toISOString()),
  online:raw.online!==false
 }
}
function gpsArray(payload){
 if(Array.isArray(payload))return payload;
 for(const key of["devices","vehicles","items","data"])if(Array.isArray(payload?.[key]))return payload[key];
 return[]
}
async function fetchGpsDevices(config=readGpsConfig()){
 if(config?.demo||config?.provider==="demo"){
  const devices=readGpsDevices().length?readGpsDevices():buildGpsDemoDevices();
  gpsWrite(GPS_DEVICES_KEY,devices);
  return devices
 }
 if(!config?.apiUrl)throw new Error("Укажите адрес API");
 let url=config.apiUrl.trim();
 const headers={Accept:"application/json"};
 if(config.authMode==="bearer"&&config.token)headers.Authorization=`Bearer ${config.token}`;
 if(config.authMode==="query"&&config.token){const u=new URL(url,location.href);u.searchParams.set("token",config.token);url=u.toString()}
 const response=await fetch(url,{headers,cache:"no-store"});
 if(!response.ok)throw new Error(`Сервер ответил ${response.status}`);
 const devices=gpsArray(await response.json()).map(normalizeGpsDevice);
 if(!devices.length)throw new Error("GPS-устройства не найдены");
 gpsWrite(GPS_DEVICES_KEY,devices);
 return devices
}
function gpsForCar(carId){
 const mapping=readGpsMapping();
 const deviceId=Object.keys(mapping).find(id=>mapping[id]===carId);
 return readGpsDevices().find(x=>x.id===deviceId)||null
}
function gpsPositionForCar(c){
 const d=gpsForCar(c.id);
 return d&&Number.isFinite(d.latitude)&&Number.isFinite(d.longitude)?[d.latitude,d.longitude]:null
}
function gpsStatusForCar(c){
 const d=gpsForCar(c.id);if(!d)return null;
 const stamp=new Date(d.updatedAt).getTime();
 return{...d,online:d.online!==false&&Number.isFinite(stamp)&&Date.now()-stamp<15*60*1000}
}
function findCarOnGps(carId){
 const c=(db?.cars||[]).find(x=>x.id===carId);
 if(!c)return toast("Автомобиль не найден");
 const gps=gpsStatusForCar(c);
 if(!gps||!Number.isFinite(gps.latitude)||!Number.isFinite(gps.longitude))return toast("Для автомобиля нет GPS-координат");

 if(window.innerWidth<1100){
  showPage("mobileMapPage");
  requestAnimationFrame(()=>{
   renderMobileGpsMap({fit:false});
   setTimeout(()=>{
    const map=ensureMobileFleetMap();
    if(map)map.flyTo([gps.latitude,gps.longitude],16,{duration:.65})
   },180)
  })
 }else{
  setDesktopView("map");
  requestAnimationFrame(()=>{
   renderFleetMapV2({fit:false});
   setTimeout(()=>{
    const map=ensureFleetMapV2();
    if(map)map.flyTo([gps.latitude,gps.longitude],15,{duration:.65});
    const row=fleetMapV2RowsCache.find(item=>item.cars.some(car=>car.id===c.id));
    if(row){fleetMapV2SelectedCity=row.key;renderFleetMapV2Panel(row)}
   },180)
  })
 }
}
window.findCarOnGps=findCarOnGps;


function currentGpsFormConfig(){
 return{
  provider:$("#gpsProvider").value,
  providerLabel:$("#gpsProvider").selectedOptions[0]?.textContent||"GPS",
  apiUrl:$("#gpsApiUrl").value.trim(),
  token:$("#gpsApiToken").value.trim(),
  authMode:$("#gpsAuthMode").value,
  updatedAt:new Date().toISOString()
 }
}
function renderGpsConnectionSummary(){
 const root=$("#gpsConnectionSummary");if(!root)return;
 const config=readGpsConfig(),devices=readGpsDevices(),mapping=readGpsMapping();
 if(!config){root.innerHTML=`<div class="gps-summary-empty"><span>⌖</span><div><strong>GPS не подключён</strong><small>Нажмите «Подключить GPS» и введите данные системы.</small></div></div>`;return}
 root.innerHTML=`<div class="gps-summary-connected ${config.demo?"demo":""}">
  <span class="gps-summary-status"></span>
  <div>
    <strong>${config.providerLabel}${config.demo?" · тестовый режим":""}</strong>
    <small>${devices.length} устройств · ${Object.values(mapping).filter(Boolean).length} сопоставлено${config.demo?" · обновление каждые 30 сек.":""}</small>
  </div>
  <div class="gps-summary-buttons">
    <button onclick="syncGpsNow()">Синхронизировать</button>
    <button onclick="openGpsMapping()">Сопоставить</button>
    <button onclick="disconnectGps()">Отключить</button>
  </div>
</div>`
}
function openGpsSetup(){
 const c=readGpsConfig()||{};
 $("#gpsProvider").value=c.provider||"generic";$("#gpsApiUrl").value=c.apiUrl||"";$("#gpsApiToken").value=c.token||"";$("#gpsAuthMode").value=c.authMode||"bearer";$("#gpsTestResult").hidden=true;$("#gpsSetupDialog").showModal()
}
async function testGpsConnection(){
 const r=$("#gpsTestResult");r.hidden=false;r.className="gps-test-result loading";r.textContent="Проверяем…";
 try{const d=await fetchGpsDevices(currentGpsFormConfig());r.className="gps-test-result success";r.textContent=`Подключение успешно. Найдено: ${d.length}`}
 catch(e){r.className="gps-test-result danger";r.textContent=`Ошибка: ${e.message}`}
}
async function saveGpsConnection(e){
 e.preventDefault();const config=currentGpsFormConfig();if(!config.apiUrl)return toast("Укажите адрес API");
 try{const devices=await fetchGpsDevices(config);gpsWrite(GPS_CONFIG_KEY,config);$("#gpsSetupDialog").close();renderGpsConnectionSummary();openGpsMapping(devices);toast("GPS подключён")}
 catch(err){const r=$("#gpsTestResult");r.hidden=false;r.className="gps-test-result danger";r.textContent=`Ошибка: ${err.message}`}
}
function openGpsMapping(devices=readGpsDevices()){
 const root=$("#gpsMappingList"),mapping=readGpsMapping(),cars=(db?.cars||[]).filter(c=>!c.archived&&!c.deletedAt);
 root.innerHTML=devices.map(d=>`<div class="gps-mapping-row"><div><strong>${d.name}</strong><small>${d.plate||d.id}</small></div><span>→</span><select data-gps-device="${d.id}"><option value="">Не сопоставлено</option>${cars.map(c=>{const m=model(c);return`<option value="${c.id}" ${mapping[d.id]===c.id?"selected":""}>${m.brand} ${m.model} · ${c.plate||"Без номера"}</option>`}).join("")}</select></div>`).join("");
 $("#gpsMappingDialog").showModal()
}
function saveGpsMapping(){
 const mapping={};$$("[data-gps-device]").forEach(s=>{if(s.value)mapping[s.dataset.gpsDevice]=s.value});gpsWrite(GPS_MAPPING_KEY,mapping);$("#gpsMappingDialog").close();renderGpsConnectionSummary();renderFleet();if(typeof renderFleetMapV2==="function")renderFleetMapV2({fit:true});toast("Сопоставление сохранено")
}
async function syncGpsNow(){
 try{
  if(gpsDemoEnabled())updateGpsDemoDevices();
  const devices=await fetchGpsDevices();
  renderGpsConnectionSummary();
  updateGpsBadgesOnly();

  if(gpsDesktopMapIsVisible()&&typeof renderFleetMapV2==="function"){
   renderFleetMapV2({fit:false})
  }
  if(gpsMobileMapIsVisible()&&typeof renderMobileGpsMap==="function"){
   renderMobileGpsMap({fit:false})
  }

  gpsNextSyncAt=Date.now()+GPS_SYNC_INTERVAL_MS;
  updateGpsCountdownUi();
  toast(`GPS обновлён: ${devices.length}`)
 }catch(error){
  toast(`Ошибка GPS: ${error.message}`)
 }
}

function disconnectGps(){
 if(!confirm("Отключить GPS?"))return;
 stopUniversalGpsSync();[GPS_CONFIG_KEY,GPS_DEVICES_KEY,GPS_MAPPING_KEY,GPS_DEMO_KEY].forEach(k=>localStorage.removeItem(k));renderGpsConnectionSummary();renderFleet();if(typeof renderFleetMapV2==="function")renderFleetMapV2({fit:true});toast("GPS отключён")
}
window.openGpsSetup=openGpsSetup;window.openGpsMapping=openGpsMapping;window.syncGpsNow=syncGpsNow;window.disconnectGps=disconnectGps;

function normalizeMapCity(city){
 const raw=String(city||"").trim();
 if(!raw)return"Без города";
 return raw.split(",")[0].trim()
}

function normalizeCityKey(city){
 return normalizeMapCity(city)
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .replace(/\s+/g," ")
  .trim()
}

function coordinatesForCity(city){
 const key=normalizeCityKey(city);
 return POLAND_CITY_COORDS[key]||null
}

function fleetMapV2Cars(){
 const filter=$("#desktopMapFilter")?.value||"all";
 const source=Array.isArray(db?.cars)?db.cars:[];
 const cars=source.filter(c=>!c.archived&&!c.deletedAt);

 return cars.filter(c=>{
  if(filter==="all")return true;
  if(filter==="attention")return typeof attention==="function"?attention(c):false;
  return c.status===filter
 })
}

function nearestFleetMapCity(latitude,longitude,fallbackCity="Без города"){
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return normalizeMapCity(fallbackCity);
 let best=normalizeMapCity(fallbackCity),dist=Infinity;
 const seen=new Set();
 Object.entries(POLAND_CITY_COORDS).forEach(([name,coords])=>{
  const key=normalizeCityKey(name); if(seen.has(key))return; seen.add(key);
  const a=latitude-coords[0],b=(longitude-coords[1])*Math.cos(latitude*Math.PI/180);
  const d=a*a+b*b;if(d<dist){dist=d;best=normalizeMapCity(name)}
 });
 return dist<=.16?best:normalizeMapCity(fallbackCity)
}

function fleetMapV2Rows(){
 const grouped=new Map();

 fleetMapV2Cars().forEach(c=>{
  const profileCity=normalizeMapCity(c.city);
  const liveGps=gpsPositionForCar(c);
  const city=liveGps?nearestFleetMapCity(liveGps[0],liveGps[1],profileCity):profileCity;
  const key=normalizeCityKey(city);
  const row=grouped.get(key)||{
   key,
   city,
   coords:coordinatesForCity(city)||liveGps,
   cars:[],
   attention:0,
   profit:0
  };

  row.cars.push(c);

  try{
   row.profit+=typeof safeDesktopCarProfit==="function"
    ?Number(safeDesktopCarProfit(c.id)||0)
    :0
  }catch(error){
   console.warn("Fleet Map: profit calculation failed",c.id,error)
  }

  try{
   if(typeof attention==="function"&&attention(c))row.attention++
  }catch(error){
   console.warn("Fleet Map: attention calculation failed",c.id,error)
  }

  grouped.set(key,row)
 });

 return[...grouped.values()].sort((a,b)=>
  b.cars.length-a.cars.length||a.city.localeCompare(b.city,"ru")
 )
}

function fleetMapV2CarLevel(c){
 if(c.status==="repair")return"danger";
 if(attention(c))return"warning";
 if(c.status==="free")return"free";
 return"good"
}

function fleetMapV2CityLevel(row){
 if(row.cars.some(c=>c.status==="repair"))return"danger";
 if(row.attention>0)return"warning";
 if(row.cars.every(c=>c.status==="free"))return"free";
 return"good"
}

function fleetMapV2OffsetPoint(coords,index,total){
 if(total<=1)return coords;

 const ring=Math.floor(index/8)+1;
 const slot=index%8;
 const angle=Math.PI*2*slot/8+(ring%2?0.24:0);
 const radius=0.0065*ring;

 return[
  coords[0]+Math.sin(angle)*radius,
  coords[1]+Math.cos(angle)*radius/Math.max(.55,Math.cos(coords[0]*Math.PI/180))
 ]
}

function fleetMapV2CityIcon(row){
 const level=fleetMapV2CityLevel(row);
 const size=Math.max(46,Math.min(70,44+row.cars.length*2));

 return L.divIcon({
  className:"fleet-map-v2-city-wrap",
  html:`<div class="fleet-map-v2-city ${level}" style="width:${size}px;height:${size}px">
   <strong>${row.cars.length}</strong>
   <small>${row.city}</small>
  </div>`,
  iconSize:[size,size],
  iconAnchor:[size/2,size/2]
 })
}

function fleetMapV2CarIcon(c){
 const level=fleetMapV2CarLevel(c);

 return L.divIcon({
  className:"fleet-map-v2-car-wrap",
  html:`<div class="fleet-map-v2-car ${level}"><span>🚗</span></div>`,
  iconSize:[34,34],
  iconAnchor:[17,17],
  popupAnchor:[0,-18]
 })
}

function ensureFleetMapV2(){
 const container=$("#leafletFleetMap");
 if(!container||typeof L==="undefined")return null;
 if(fleetMapV2)return fleetMapV2;

 // Clean stale Leaflet state from earlier failed initialization.
 if(container._leaflet_id)container._leaflet_id=null;
 container.innerHTML="";

 fleetMapV2=L.map(container,{
  zoomControl:true,
  attributionControl:true,
  preferCanvas:true
 }).setView([52.05,19.25],6);

 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  maxZoom:19,
  minZoom:4,
  attribution:"&copy; OpenStreetMap contributors"
 }).addTo(fleetMapV2);

 fleetMapV2Layer=L.layerGroup().addTo(fleetMapV2);

 [40,120,260,500].forEach(delay=>
  setTimeout(()=>fleetMapV2?.invalidateSize({pan:false}),delay)
 );

 return fleetMapV2
}

function renderFleetMapV2Panel(selectedRow=null){
 const panel=$("#mapCityCars"),title=$("#mapSelectedCity"),count=$("#mapSelectedCount"),status=$("#leafletMapStatus");
 if(!panel||!title||!count)return;
 title.textContent=selectedRow?.city||"Все города";
 count.textContent=selectedRow?`${selectedRow.cars.length} автомобилей`:`${fleetMapV2RowsCache.reduce((s,r)=>s+r.cars.length,0)} автомобилей`;

 if(selectedRow){
  const gpsRows=selectedRow.cars.map(c=>({c,g:gpsStatusForCar(c)}));
  const online=gpsRows.filter(x=>x.g?.online).length;
  const offline=gpsRows.filter(x=>x.g&&!x.g.online).length;
  const moving=gpsRows.filter(x=>x.g?.online&&Number(x.g.speed)>0);
  const avg=moving.length?Math.round(moving.reduce((s,x)=>s+Number(x.g.speed||0),0)/moving.length):0;
  const latest=gpsRows.map(x=>new Date(x.g?.updatedAt||0)).filter(d=>!Number.isNaN(d.getTime())).sort((a,b)=>b-a)[0];
  panel.innerHTML=`<button class="map-back-to-cities" onclick="showAllFleetMapCities()">← Все города</button>
   <div class="map-city-overview">
    <div><small>Город</small><strong>${selectedRow.city}</strong></div>
    <div class="map-city-overview-grid">
     <span><small>Всего</small><strong>${selectedRow.cars.length}</strong></span>
     <span class="online"><small>Online</small><strong>${online}</strong></span>
     <span class="offline"><small>Offline</small><strong>${offline}</strong></span>
     <span><small>Ср. скорость</small><strong>${avg} км/ч</strong></span>
    </div>
    <small class="map-city-last-update">Последний сигнал: ${latest?latest.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}):"—"}</small>
   </div>`+
   selectedRow.cars.map(c=>{
    const m=model(c),gps=gpsStatusForCar(c);
    return`<div class="map-car-row map-car-row-v2">
     <span class="map-car-status ${fleetMapV2CarLevel(c)}"></span>
     <button class="map-car-main" onclick="openCar('${c.id}')"><strong>${m.brand} ${m.model}</strong>
     <small>${c.plate||"Без номера"} · ${gps?`GPS ${gps.online?"online":"offline"}${gps.online?` · ${Math.round(gps.speed||0)} км/ч`:""}`:statusText(c.status)}</small></button>
     ${gps?`<button class="map-car-locate" onclick="findCarOnGps('${c.id}')" title="Найти">⌖</button>`:`<b>›</b>`}
    </div>`
   }).join("")
 }else{
  panel.innerHTML=fleetMapV2RowsCache.length?fleetMapV2RowsCache.map(row=>{
   const gps=row.cars.map(c=>gpsStatusForCar(c)).filter(Boolean),on=gps.filter(x=>x.online).length,off=gps.filter(x=>!x.online).length;
   return`<button class="map-city-summary-row" onclick="focusFleetMapV2City('${row.key.replace(/'/g,"\\'")}')">
    <span class="map-city-dot ${fleetMapV2CityLevel(row)}"></span><div><strong>${row.city}</strong>
    <small>${row.cars.length} авто · ${on} online${off?` · ${off} offline`:""}</small></div><b>›</b></button>`
  }).join(""):`<div class="map-empty">Нет автомобилей для выбранного фильтра</div>`
 }
 const unknown=fleetMapV2RowsCache.filter(r=>!r.coords&&r.city!=="Без города");
 if(status){status.hidden=!unknown.length;status.textContent=unknown.length?`Не удалось разместить: ${unknown.map(r=>r.city).join(", ")}`:""}
}


let mobileFleetMap=null;
let mobileFleetLayer=null;
let mobileSelectedCity="";

function ensureMobileFleetMap(){
 const container=$("#mobileLeafletMap");
 if(!container||typeof L==="undefined")return null;
 if(mobileFleetMap)return mobileFleetMap;

 mobileFleetMap=L.map(container,{zoomControl:true,attributionControl:true}).setView([52.05,19.25],6);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
  maxZoom:19,minZoom:4,attribution:"&copy; OpenStreetMap"
 }).addTo(mobileFleetMap);
 mobileFleetLayer=L.layerGroup().addTo(mobileFleetMap);
 [50,180,400].forEach(delay=>setTimeout(()=>mobileFleetMap?.invalidateSize({pan:false}),delay));
 return mobileFleetMap
}

function mobileMapRows(){
 return fleetMapV2Rows()
}

function renderMobileMapList(selected=null){
 const root=$("#mobileMapList"),title=$("#mobileMapTitle"),count=$("#mobileMapCount");
 if(!root||!title||!count)return;
 const rows=mobileMapRows();

 if(selected){
  title.textContent=selected.city;
  count.textContent=`${selected.cars.length} автомобилей`;
  const gpsRows=selected.cars.map(c=>({c,gps:gpsStatusForCar(c)}));
  const on=gpsRows.filter(x=>x.gps?.online).length;
  root.innerHTML=`<button class="mobile-map-back" onclick="showAllMobileMapCities()">← Все города</button>
   <div class="mobile-city-summary"><strong>${selected.city}</strong><span>${on} online · ${gpsRows.length-on} offline</span></div>`+
   gpsRows.map(({c,gps})=>{
    const m=model(c);
    return`<div class="mobile-map-car">
     <span class="mobile-map-car-dot ${gps?.online?"online":gps?"offline":""}"></span>
     <button class="mobile-map-car-main" onclick="openCar('${c.id}')"><strong>${m.brand} ${m.model}</strong><small>${c.plate||"Без номера"}${gps?` · ${gps.online?`${Math.round(gps.speed||0)} км/ч`:"offline"}`:""}</small></button>
     ${gps?`<button class="mobile-map-find" onclick="findCarOnGps('${c.id}')">Найти</button>`:""}
    </div>`
   }).join("")
 }else{
  title.textContent="Все города";
  count.textContent=`${rows.reduce((sum,row)=>sum+row.cars.length,0)} автомобилей`;
  root.innerHTML=rows.map(row=>{
   const gps=row.cars.map(c=>gpsStatusForCar(c)).filter(Boolean);
   const online=gps.filter(x=>x.online).length;
   return`<button class="mobile-map-city" onclick="focusMobileMapCity('${row.key.replace(/'/g,"\\'")}')">
    <span class="map-city-dot ${fleetMapV2CityLevel(row)}"></span>
    <span><strong>${row.city}</strong><small>${row.cars.length} авто · ${online} online</small></span><b>›</b>
   </button>`
  }).join("")||`<div class="map-empty">Автомобилей пока нет</div>`
 }
}

function renderMobileGpsMap(options={}){
 const map=ensureMobileFleetMap();if(!map||!mobileFleetLayer)return;
 const rows=mobileMapRows();
 const selected=rows.find(row=>row.key===mobileSelectedCity)||null;
 renderMobileMapList(selected);
 mobileFleetLayer.clearLayers();
 const bounds=[];

 rows.forEach(row=>{
  row.cars.forEach((c,index)=>{
   const point=gpsPositionForCar(c)||fleetMapV2OffsetPoint(row.coords,index,row.cars.length);
   if(!point)return;
   bounds.push(point);
   const marker=L.marker(point,{icon:fleetMapV2CarIcon(c)});
   const m=model(c),gps=gpsStatusForCar(c);
   marker.bindPopup(`<div class="fleet-car-popup"><strong>${m.brand} ${m.model}</strong><span>${c.plate||""}</span><span>${gps?.online?`${Math.round(gps.speed||0)} км/ч`:"GPS offline"}</span><button onclick="openCar('${c.id}')">Открыть →</button></div>`);
   marker.addTo(mobileFleetLayer)
  })
 });

 if(options.fit!==false&&bounds.length)map.fitBounds(bounds,{padding:[35,35],maxZoom:12});
 setTimeout(()=>map.invalidateSize({pan:false}),80)
}

function focusMobileMapCity(key){
 const row=mobileMapRows().find(x=>x.key===key);if(!row)return;
 mobileSelectedCity=key;renderMobileMapList(row);
 const map=ensureMobileFleetMap();
 const points=row.cars.map(c=>gpsPositionForCar(c)).filter(Boolean);
 if(points.length>1)map.fitBounds(points,{padding:[40,40],maxZoom:13});
 else if(points.length===1)map.flyTo(points[0],14,{duration:.5});
 else if(row.coords)map.flyTo(row.coords,11,{duration:.5})
}
function showAllMobileMapCities(){
 mobileSelectedCity="";renderMobileMapList(null);renderMobileGpsMap({fit:true})
}
window.focusMobileMapCity=focusMobileMapCity;
window.showAllMobileMapCities=showAllMobileMapCities;

function showAllFleetMapCities(){
 fleetMapV2SelectedCity="";
 renderFleetMapV2Panel(null);
 const map=ensureFleetMapV2();
 const bounds=fleetMapV2RowsCache.filter(row=>row.coords).map(row=>row.coords);
 if(map&&bounds.length)map.fitBounds(bounds,{padding:[45,45],maxZoom:8})
}
window.showAllFleetMapCities=showAllFleetMapCities;

function focusFleetMapV2City(cityKey){
 const map=ensureFleetMapV2(),row=fleetMapV2RowsCache.find(x=>x.key===cityKey);if(!row)return;
 fleetMapV2SelectedCity=row.key;renderFleetMapV2Panel(row);
 if(map){
  const pts=row.cars.map(c=>gpsPositionForCar(c)).filter(Boolean);
  if(pts.length>1)map.fitBounds(pts,{padding:[55,55],maxZoom:13});
  else if(pts.length===1)map.flyTo(pts[0],14,{duration:.5});
  else if(row.coords)map.flyTo(row.coords,11,{duration:.5});
  setTimeout(()=>map.invalidateSize({pan:false}),100)
 }
}
window.focusFleetMapV2City=focusFleetMapV2City;

function renderFleetMapV2(options={}){
 const status=$("#leafletMapStatus");

 try{
  const map=ensureFleetMapV2();
  fleetMapV2RowsCache=fleetMapV2Rows();

  const selected=fleetMapV2RowsCache.find(row=>row.key===fleetMapV2SelectedCity)||null;
  renderFleetMapV2Panel(selected);

  if(!map||!fleetMapV2Layer){
   if(status){
    status.hidden=false;
    status.textContent=typeof L==="undefined"
     ?"Не загрузилась библиотека карты Leaflet."
     :"Не удалось создать карту."
   }
   return
  }

  fleetMapV2Layer.clearLayers();
  const bounds=[];

 fleetMapV2RowsCache.forEach(row=>{
  if(!row.coords)return;
  bounds.push(row.coords);

  const cityMarker=L.marker(row.coords,{
   icon:fleetMapV2CityIcon(row),
   keyboard:true,
   riseOnHover:true
  });

  cityMarker.bindTooltip(`${row.city}: ${row.cars.length} авто`,{
   direction:"top",
   offset:[0,-18]
  });

  cityMarker.on("click",()=>{
   fleetMapV2SelectedCity=row.key;
   renderFleetMapV2Panel(row);
   map.flyTo(row.coords,row.cars.length>1?10:12,{duration:.5})
  });

  cityMarker.addTo(fleetMapV2Layer);

  row.cars.forEach((c,index)=>{
   const point=gpsPositionForCar(c)||fleetMapV2OffsetPoint(row.coords,index,row.cars.length);
   const m=model(c);

   const marker=L.marker(point,{
    icon:fleetMapV2CarIcon(c),
    keyboard:true,
    riseOnHover:true
   });

   marker.bindPopup(`
    <div class="fleet-car-popup">
     <strong>${m.brand} ${m.model}</strong>
     <span>${c.plate||"Без номера"}</span>
     <em class="${fleetMapV2CarLevel(c)}">${statusText(c.status)}</em>
     <span>${km(Number(c.mileage||0))}</span>
     <button type="button" onclick="openCar('${c.id}')">Открыть →</button>
    </div>
   `);

   marker.on("click",()=>renderFleetMapV2Panel(row));
   marker.addTo(fleetMapV2Layer)
  })
 });

 if(bounds.length&&options.fit!==false){
  map.fitBounds(bounds,{padding:[45,45],maxZoom:8,animate:false})
 }else if(!bounds.length&&options.fit!==false){
  map.setView([52.05,19.25],6,{animate:false})
 }

 [0,80,200,450].forEach(delay=>
   setTimeout(()=>map.invalidateSize({pan:false}),delay)
  );

  if(status&&fleetMapV2RowsCache.some(row=>row.coords)){
   const unknown=fleetMapV2RowsCache.filter(row=>!row.coords&&row.city!=="Без города");
   status.hidden=!unknown.length;
   if(unknown.length)status.textContent=`Не удалось разместить: ${unknown.map(row=>row.city).join(", ")}`
  }
 }catch(error){
  console.error("Fleet Map V2 render failed",error);
  if(status){
   status.hidden=false;
   status.textContent=`Ошибка карты: ${error.message||"неизвестная ошибка"}`
  }
 }
}

function openFleetMapV2(){
 fleetMapV2SelectedCity="";
 requestAnimationFrame(()=>{
  renderFleetMapV2({fit:true});
  setTimeout(()=>renderFleetMapV2({fit:true}),180);
  setTimeout(invalidateFleetLeafletMap,360)
 })
}

// Compatibility wrapper for existing desktop code.
function renderDesktopMap(selectedCity="",options={}){
 if(selectedCity)fleetMapV2SelectedCity=normalizeCityKey(selectedCity);
 renderFleetMapV2({fit:options.forceFit!==false})
}


