/* =========================================================
   FleetPilot V15.6 — Files, Backups & History
   Document attachments, IndexedDB files, backups, damage/history and activity utilities.
   Source order: original app.js lines 2207-2617
   ========================================================= */
const FILE_DB_NAME="FleetPilotFiles",FILE_STORE="files";
function openFileDatabase(){return new Promise((resolve,reject)=>{const request=indexedDB.open(FILE_DB_NAME,1);request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains(FILE_STORE))database.createObjectStore(FILE_STORE,{keyPath:"id"})};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function saveDocumentFile(file,documentId,existingId=""){
 if(!file)return existingId||"";
 if(file.size>25*1024*1024)throw new Error("Максимальный размер файла — 25 МБ");
 const id=existingId||uid(),database=await openFileDatabase();
 await new Promise((resolve,reject)=>{const tx=database.transaction(FILE_STORE,"readwrite");tx.objectStore(FILE_STORE).put({id,documentId,name:file.name,type:file.type||"application/octet-stream",size:file.size,updatedAt:new Date().toISOString(),blob:file});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});database.close();return id
}
async function getDocumentFile(id){if(!id)return null;const database=await openFileDatabase();const row=await new Promise((resolve,reject)=>{const req=database.transaction(FILE_STORE,"readonly").objectStore(FILE_STORE).get(id);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)});database.close();return row}
async function deleteDocumentFile(id){if(!id)return;const database=await openFileDatabase();await new Promise((resolve,reject)=>{const tx=database.transaction(FILE_STORE,"readwrite");tx.objectStore(FILE_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});database.close()}
async function fileStorageStats(){const database=await openFileDatabase();const rows=await new Promise((resolve,reject)=>{const req=database.transaction(FILE_STORE,"readonly").objectStore(FILE_STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)});database.close();return{count:rows.length,size:rows.reduce((s,x)=>s+Number(x.size||0),0)}}
function humanSize(bytes){if(!bytes)return"0 Б";const units=["Б","КБ","МБ","ГБ"];const i=Math.min(units.length-1,Math.floor(Math.log(bytes)/Math.log(1024)));return`${(bytes/1024**i).toFixed(i?1:0)} ${units[i]}`}
let activeFileUrl="";
async function openDocumentAttachment(fileId,title="Документ"){
 const row=await getDocumentFile(fileId);if(!row){toast("Файл не найден");return}
 if(activeFileUrl)URL.revokeObjectURL(activeFileUrl);activeFileUrl=URL.createObjectURL(row.blob);
 $("#fileViewerTitle").textContent=title;$("#fileViewerFrame").hidden=true;$("#fileViewerImage").hidden=true;$("#fileViewerFallback").hidden=true;
 if(row.type==="application/pdf"){$("#fileViewerFrame").src=activeFileUrl;$("#fileViewerFrame").hidden=false}
 else if(row.type.startsWith("image/")){$("#fileViewerImage").src=activeFileUrl;$("#fileViewerImage").hidden=false}
 else{$("#fileViewerFallback").hidden=false;$("#fileViewerFallback").innerHTML=`Предпросмотр этого формата недоступен.<br><button class="btn primary" onclick="downloadDocumentAttachment('${fileId}')">Скачать ${row.name}</button>`}
 $("#fileViewerDialog").showModal()
}
async function downloadDocumentAttachment(fileId){const row=await getDocumentFile(fileId);if(!row)return;const url=URL.createObjectURL(row.blob),a=document.createElement("a");a.href=url;a.download=row.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}

const BACKUP_DB_NAME="FleetPilotBackups";
const BACKUP_STORE="snapshots";
let backupTimer=null;
function openBackupDatabase(){
 return new Promise((resolve,reject)=>{
  if(!("indexedDB" in window))return reject(new Error("IndexedDB недоступна"));
  const request=indexedDB.open(BACKUP_DB_NAME,1);
  request.onupgradeneeded=()=>{
   const database=request.result;
   if(!database.objectStoreNames.contains(BACKUP_STORE))database.createObjectStore(BACKUP_STORE,{keyPath:"id"})
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error("Не удалось открыть автокопии"))
 })
}
async function writeAutoBackup(savedAt=new Date().toISOString(),reason="Автоматическая"){
 try{const database=await openBackupDatabase();await new Promise((resolve,reject)=>{const tx=database.transaction(BACKUP_STORE,"readwrite"),store=tx.objectStore(BACKUP_STORE),snapshot={id:`snapshot_${Date.now()}`,savedAt,reason,version:"5.1",data:structuredClone(db)};store.put(snapshot);store.put({...snapshot,id:"latest"});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});database.close();await pruneBackups();if($("#dataBackupStatus"))renderDataPage()}catch(error){console.warn("Auto backup failed",error)}
}
function scheduleAutoBackup(savedAt){
 clearTimeout(backupTimer);
 backupTimer=setTimeout(()=>writeAutoBackup(savedAt),250)
}

async function listBackups(){const database=await openBackupDatabase();const rows=await new Promise((resolve,reject)=>{const req=database.transaction(BACKUP_STORE,"readonly").objectStore(BACKUP_STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)});database.close();return rows.filter(x=>x.id!=="latest").sort((a,b)=>b.savedAt.localeCompare(a.savedAt))}
async function pruneBackups(){const rows=await listBackups();for(const row of rows.slice(12)){const database=await openBackupDatabase();await new Promise((resolve,reject)=>{const tx=database.transaction(BACKUP_STORE,"readwrite");tx.objectStore(BACKUP_STORE).delete(row.id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});database.close()}}
async function restoreBackupById(id){const database=await openBackupDatabase();const snapshot=await new Promise((resolve,reject)=>{const req=database.transaction(BACKUP_STORE,"readonly").objectStore(BACKUP_STORE).get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});database.close();if(!snapshot?.data)return;if(!confirm(`Восстановить копию от ${new Date(snapshot.savedAt).toLocaleString("ru-RU")}?`))return;db=structuredClone(snapshot.data);save();showPage("fleetPage");toast("Копия восстановлена")}

async function readAutoBackup(){
 const database=await openBackupDatabase();
 const result=await new Promise((resolve,reject)=>{
  const tx=database.transaction(BACKUP_STORE,"readonly");
  const request=tx.objectStore(BACKUP_STORE).get("latest");
  request.onsuccess=()=>resolve(request.result||null);
  request.onerror=()=>reject(request.error)
 });
 database.close();
 return result
}
function databaseStats(){
 return{
  cars:db.cars.length,
  records:db.cars.length+db.repairs.length+db.payments.length+db.expenses.length+db.documents.length
 }
}
function backupPayload(){
 return{
  application:"FleetPilot",
  formatVersion:1,
  appVersion:"14.2.0",
  exportedAt:new Date().toISOString(),
  data:structuredClone(db)
 }
}
function downloadBackup(){
 const payload=backupPayload();
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob);
 const link=document.createElement("a");
 link.href=url;
 link.download=`FleetPilot_backup_${today()}.json`;
 document.body.appendChild(link);
 link.click();
 link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 toast("Резервная копия скачана")
}
function validateImportedBackup(parsed){
 const candidate=parsed?.application==="FleetPilot"&&parsed?.data?parsed.data:parsed;
 if(!isFleetDatabase(candidate))throw new Error("Это не резервная копия FleetPilot");
 return candidate
}
async function importBackupFile(file){
 if(!file)return;
 if(file.size>35*1024*1024)throw new Error("Файл слишком большой");
 const parsed=JSON.parse(await file.text());
 const imported=validateImportedBackup(parsed);
 const importedCars=Array.isArray(imported.cars)?imported.cars.length:0;

 if(!confirm(`Восстановить резервную копию?\n\nАвтомобили: ${importedCars}\nЭкспорт: ${parsed?.exportedAt?new Date(parsed.exportedAt).toLocaleString("ru-RU"):"дата не указана"}\n\nТекущие локальные данные будут заменены.`))return;

 await writeAutoBackup(new Date().toISOString());
 const normalized=structuredClone(imported);
 normalized.settings=normalized.settings||structuredClone(seed.settings);
 for(const key of ["cars","repairs","payments","expenses","documents","deposits","timeline","damages","activity","serviceRequests"]){
  if(!Array.isArray(normalized[key]))normalized[key]=[]
 }
 normalized.cars.forEach(c=>{
  if(c.inFleet===undefined)c.inFleet=true;
  if(c.modelKey==="skoda-octavia")c.modelKey="skoda-octavia-3"
 });

 db=normalized;
 save();
 await writeAutoBackup();
 applyTheme();applyUxSettings();applyAdaptiveMode();
 showPage("fleetPage");
 toast(`Восстановлено автомобилей: ${importedCars}`);

 setTimeout(async()=>{
  const uploaded=await window.FleetPilotCloud?.pushNow?.({silent:false,force:true});
  if(uploaded)toast("Резервная копия загружена в облако")
 },700)
}
async function restoreLatestAutoBackup(){
 try{
  const snapshot=await readAutoBackup();
  if(!snapshot?.data)throw new Error("Автокопия не найдена");
  if(!confirm(`Восстановить автокопию от ${new Date(snapshot.savedAt).toLocaleString("ru-RU")}?`))return;
  db=structuredClone(snapshot.data);
  save();
  showPage("fleetPage");
  toast("Автокопия восстановлена")
 }catch(error){
  toast(error.message||"Не удалось восстановить автокопию")
 }
}
async function renderDataPage(){
 const stats=databaseStats();
 $("#dataCarsCount").textContent=stats.cars;
 $("#dataRecordsCount").textContent=stats.records;
 const meta=readJsonStorage(META_KEY);
 $("#dataLastSaved").textContent=meta?.lastSaved
  ?new Date(meta.lastSaved).toLocaleString("ru-RU",{dateStyle:"short",timeStyle:"short"})
  :"—";
 try{
  const backup=await readAutoBackup();
  $("#dataBackupStatus").textContent=backup?.savedAt
   ?new Date(backup.savedAt).toLocaleString("ru-RU",{dateStyle:"short",timeStyle:"short"})
   :"Не создана";
  $("#restoreAutoBackup").disabled=!backup
 }catch{
  $("#dataBackupStatus").textContent="Недоступна";
  $("#restoreAutoBackup").disabled=true
 }
 try{const stats=await fileStorageStats();$("#fileStorageStats").innerHTML=`<strong>${stats.count}</strong> файлов · <strong>${humanSize(stats.size)}</strong>`}catch{$("#fileStorageStats").textContent="Недоступно"}
 try{const backups=await listBackups();$("#backupHistory").innerHTML=backups.length?backups.map(x=>`<button class="backup-history-row" onclick="restoreBackupById('${x.id}')"><div><strong>${x.reason||"Автокопия"}</strong><small>${new Date(x.savedAt).toLocaleString("ru-RU")}</small></div><span>Восстановить</span></button>`).join(""):"Копий пока нет"}catch{$("#backupHistory").textContent="История недоступна"}
 }

function analyticsSelectedPeriod(){
 const mode=$("#analyticsPeriod")?.value||"year";
 if(mode==="selectedMonth"){
  if(!$("#analyticsMonth").value)$("#analyticsMonth").value=today().slice(0,7);
  return`month:${$("#analyticsMonth").value}`
 }
 return mode
}
function syncAnalyticsPeriodControls(){
 const selected=$("#analyticsPeriod").value==="selectedMonth";
 $("#analyticsMonth").disabled=!selected;
 $("#analyticsMonth").classList.toggle("disabled-control",!selected)
}

function addTimeline(carId,type,title,amount=0,dateValue=today(),note=""){
 db.timeline=db.timeline||[];
 db.timeline.push({id:uid(),carId,type,title,amount:Number(amount||0),date:dateValue,note})
}
function timelineIcon(type){return{payment:"💳",repair:"🔧",expense:"💰",document:"📄",mileage:"🛣️",damage:"📷",car:"🚘"}[type]||"•"}
function renderTimeline(carId){
 const rows=(db.timeline||[]).filter(x=>x.carId===carId).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,50);
 return rows.length?rows.map(x=>`<div class="timeline-row"><div class="timeline-icon">${timelineIcon(x.type)}</div><div><strong>${x.title}</strong><small>${date(x.date)}${x.note?` · ${x.note}`:""}</small></div><b class="${x.amount<0?"negative":x.amount>0?"positive":""}">${x.amount?money(x.amount):""}</b></div>`).join(""):"История пока пуста"
}
function damageStageText(value){return{before:"До ремонта",during:"В процессе",after:"После ремонта"}[value]||value}
function damageLocationText(value){return{front:"Передняя часть",rear:"Задняя часть",left:"Левая сторона",right:"Правая сторона",interior:"Салон",other:"Другое"}[value]||value}
function renderDamageGallery(carId){
 const rows=(db.damages||[]).filter(x=>x.carId===carId).sort((a,b)=>b.date.localeCompare(a.date));
 return rows.length?rows.map(x=>{
  const photos=x.photos||[];
  const cover=photos[0];
  return `<article class="damage-album">
   <button class="damage-cover" onclick="openDamageViewer('${x.id}',0)">${cover?`<img src="${cover}" alt="${x.title}">`:`<span>📷</span>`}<b>${photos.length} фото</b></button>
   <div class="damage-album-body"><div class="damage-album-head"><div><strong>${x.title}</strong><small>${date(x.date)} · ${damageStageText(x.stage)} · ${damageLocationText(x.location)}</small></div></div><p>${x.note||""}</p>
   <div class="damage-thumbnails">${photos.slice(0,5).map((p,i)=>`<button onclick="openDamageViewer('${x.id}',${i})"><img src="${p}" alt="Фото ${i+1}"></button>`).join("")}${photos.length>5?`<button class="more-photos" onclick="openDamageViewer('${x.id}',5)">+${photos.length-5}</button>`:""}</div>
   <div class="item-actions"><button class="btn" onclick="editDamage('${x.id}')">Редактировать</button><button class="btn danger" onclick="deleteDamage('${x.id}')">Удалить</button></div></div>
  </article>`
 }).join(""):"Фотографий повреждений нет"
}
let damageViewerState={damageId:null,index:0,scale:1};
function openDamageViewer(damageId,index=0){
 const damage=db.damages.find(x=>x.id===damageId);if(!damage?.photos?.length)return;
 damageViewerState={damageId,index:Math.max(0,Math.min(index,damage.photos.length-1)),scale:1};
 renderDamageViewer();$("#damageViewer").showModal()
}
function renderDamageViewer(){
 const damage=db.damages.find(x=>x.id===damageViewerState.damageId);if(!damage)return;
 const photos=damage.photos||[],index=(damageViewerState.index+photos.length)%photos.length;damageViewerState.index=index;
 const image=$("#damageViewerImage");image.src=photos[index];image.style.transform=`scale(${damageViewerState.scale})`;
 $("#damageViewerTitle").textContent=damage.title;
 $("#damageViewerMeta").textContent=`${date(damage.date)} · ${damageStageText(damage.stage)} · ${damageLocationText(damage.location)}`;
 $("#damageViewerCounter").textContent=`${index+1} / ${photos.length}`;
 $("#damagePrev").hidden=photos.length<2;$("#damageNext").hidden=photos.length<2
}
function moveDamageViewer(step){damageViewerState.index+=step;damageViewerState.scale=1;renderDamageViewer()}
function zoomDamageViewer(delta){damageViewerState.scale=Math.max(1,Math.min(3,damageViewerState.scale+delta));renderDamageViewer()}

function ownershipData(c){
 const all=financialData("all",c.id);
 const insurance=db.documents.filter(d=>d.carId===c.id&&d.type==="insurance").reduce((s,d)=>s+Number(d.cost||0),0);
 const totalCosts=all.grossCosts+insurance;
 const purchase=Number(c.purchasePrice||0);
 const remaining=Math.max(0,purchase+totalCosts-all.grossRevenue);
 return{...all,insurance,totalCosts,purchase,remaining,paidOff:purchase>0&&remaining===0,netAfterPurchase:all.grossRevenue-totalCosts-purchase}
}
function renderOwnership(c){
 const d=ownershipData(c);
 return `<div class="ownership-grid">
  <div><small>Стоимость покупки</small><strong>${money(d.purchase)}</strong></div>
  <div><small>Доход за всё время</small><strong>${money(d.grossRevenue)}</strong></div>
  <div><small>Ремонты, расходы и страховки</small><strong>${money(d.totalCosts)}</strong></div>
  <div><small>Результат с учётом покупки</small><strong class="${d.netAfterPurchase<0?"negative":"positive"}">${money(d.netAfterPurchase)}</strong></div>
 </div><div class="payback-status ${d.paidOff?"done":""}">${!d.purchase?"Укажите стоимость покупки автомобиля":d.paidOff?"✅ Автомобиль окупился":`До окупаемости осталось ${money(d.remaining)}`}</div>`
}
function tenantStats(){
 const map=new Map();
 for(const p of db.payments){
  const c=car(p.carId),name=p.tenant||c?.tenant||"Без имени";
  if(!map.has(name))map.set(name,{name,expected:0,received:0,records:0,late:0});
  const row=map.get(name);
  row.expected+=Number(p.expected||0);row.received+=Number(p.received||0);row.records++;
  if(Number(p.received||0)<Number(p.expected||0))row.late++
 }
 return[...map.values()].map(x=>({...x,debt:Math.max(0,x.expected-x.received),score:Math.max(0,100-x.late*15-Math.min(40,x.debt/100))})).sort((a,b)=>b.score-a.score)
}
function ownerRecommendations(period){
 const out=[],rows=fleetCars().map(c=>({c,d:financialData(period,c.id),h:healthDetails(c)}));
 rows.filter(x=>x.d.grossCosts>x.d.grossRevenue*.35&&x.d.grossCosts>0).forEach(x=>out.push(`${model(x.c).brand} ${model(x.c).model}: расходы превышают 35% полученной аренды.`));
 rows.filter(x=>x.h.level==="danger").forEach(x=>out.push(`${model(x.c).brand} ${model(x.c).model}: есть критические предупреждения.`));
 const best=[...rows].sort((a,b)=>b.d.finalProfit-a.d.finalProfit)[0];
 if(best&&best.d.finalProfit>0)out.push(`${model(best.c).brand} ${model(best.c).model} — самая прибыльная машина за выбранный период.`);
 const unpaid=tenantStats().filter(x=>x.debt>0);
 if(unpaid.length)out.push(`Арендаторов с задолженностью: ${unpaid.length}.`);
 return out.slice(0,8)
}
function daysBetween(a,b){return Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/86400000)}
function forecastService(c){
 const history=(c.history||[])
  .filter(x=>x&&x.date&&Number.isFinite(Number(x.value)))
  .map(x=>({date:x.date,value:Number(x.value)}))
  .sort((a,b)=>a.date.localeCompare(b.date));

 if(history.length<2)return null;

 // Use up to the latest 8 unique readings, avoiding duplicate dates.
 const unique=[];
 for(const item of history){
  const last=unique[unique.length-1];
  if(last&&last.date===item.date){
   if(item.value>last.value)unique[unique.length-1]=item;
  }else{
   unique.push(item)
  }
 }
 const recent=unique.slice(-8);
 if(recent.length<2)return null;

 const dailyRates=[];
 for(let i=1;i<recent.length;i++){
  const prev=recent[i-1],curr=recent[i];
  const dayDiff=daysBetween(prev.date,curr.date);
  const kmDiff=curr.value-prev.value;
  if(dayDiff>0&&kmDiff>=0){
   const rate=kmDiff/dayDiff;
   // Reject impossible/outlier fleet readings above 1000 km/day.
   if(rate>0&&rate<=1000)dailyRates.push(rate)
  }
 }
 if(!dailyRates.length)return null;

 // Median is more stable than first-vs-last and resists one bad reading.
 const sorted=[...dailyRates].sort((a,b)=>a-b);
 const middle=Math.floor(sorted.length/2);
 const median=sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
 if(!Number.isFinite(median)||median<=0)return null;

 const remaining=Math.max(0,oil(c));
 const daysLeft=Math.ceil(remaining/median);

 return{
  days:daysLeft,
  averageDailyKm:Math.round(median),
  remainingKm:remaining,
  confidence:dailyRates.length>=3?"good":"limited"
 }
}
let pendingDamagePhotos=[];
function renderPendingDamagePhotos(){
 $("#damagePhotoPreview").innerHTML=pendingDamagePhotos.map((p,i)=>`<div class="pending-damage-photo"><img src="${p}" alt="Фото ${i+1}"><button type="button" onclick="removePendingDamagePhoto(${i})">✕</button></div>`).join("")
}
function removePendingDamagePhoto(index){pendingDamagePhotos.splice(index,1);renderPendingDamagePhotos()}
function openDamageDialog(carId,id=""){
 const damage=id?db.damages.find(x=>x.id===id):null;
 $("#damageId").value=damage?.id||"";$("#damageCarId").value=damage?.carId||carId;$("#damageDialogTitle").textContent=damage?"Редактировать повреждение":"Повреждение автомобиля";
 $("#damageTitle").value=damage?.title||"";$("#damageDate").value=damage?.date||today();$("#damageStage").value=damage?.stage||"before";$("#damageLocation").value=damage?.location||"other";$("#damageNote").value=damage?.note||"";$("#damagePhotoFile").value="";
 pendingDamagePhotos=[...(damage?.photos||[])];renderPendingDamagePhotos();$("#damageDialog").showModal()
}
function editDamage(id){const damage=db.damages.find(x=>x.id===id);if(damage)openDamageDialog(damage.carId,id)}
function deleteDamage(id){
 if(!confirm("Удалить запись о повреждении и все фотографии?"))return;
 db.damages=db.damages.filter(x=>x.id!==id);save();if(selectedCarId)openCar(selectedCarId)
}


function logActivity(action,entity="",details="",carId=""){
 db.activity=db.activity||[];
db.serviceRequests=Array.isArray(db.serviceRequests)?db.serviceRequests:[];db.activity.push({id:uid(),date:new Date().toISOString(),action,entity,details,carId});if(db.activity.length>1000)db.activity=db.activity.slice(-1000)
}
function futureFinancialData(daysAhead=30){
 const start=new Date(),end=new Date();end.setDate(end.getDate()+daysAhead);
 const active=fleetCars().filter(c=>c.status==="active");
 const weekly=active.reduce((s,c)=>s+Number(c.weeklyRent||0),0);
 const revenue=weekly/7*daysAhead;
 const expenses=db.expenses.filter(x=>x.status==="planned"&&x.date&&new Date(x.date+"T12:00:00")>=start&&new Date(x.date+"T12:00:00")<=end).reduce((s,x)=>s+Number(x.amount||0),0);
 const repairs=db.repairs.filter(x=>x.status!=="done"&&x.date&&new Date(x.date+"T12:00:00")>=start&&new Date(x.date+"T12:00:00")<=end).reduce((s,x)=>s+Number(x.planned||0),0);
 const tax=taxSettings(),estimatedTax=tax.method==="none"?0:tax.method==="ryczalt"?revenue*Number(tax.ryczaltRate||0)/100:Math.max(0,(revenue-expenses-repairs)*(tax.method==="linear"?.19:.12));
 return{revenue,expenses,repairs,tax:estimatedTax,balance:revenue-expenses-repairs-estimatedTax}
}
function fleetHealthData(){
 const rows=fleetCars().map(c=>healthDetails(c));if(!rows.length)return{overall:100,technical:100,documents:100,finance:100};
 const overall=Math.round(rows.reduce((s,x)=>s+x.score,0)/rows.length);
 const technical=Math.round(rows.reduce((s,x)=>s-(x.oilLeft<=0?35:x.oilLeft<=1500?15:0)-(x.items.some(i=>i.type==="repair"&&i.level==="danger")?35:x.items.some(i=>i.type==="repair")?15:0),100*rows.length)/rows.length);
 const documents=Math.round(rows.reduce((s,x)=>s-(x.insuranceDays<0?50:x.insuranceDays<=30?20:0)-(x.inspectionDays<0?50:x.inspectionDays<=30?20:0),100*rows.length)/rows.length);
 const debt=db.payments.reduce((s,p)=>s+Math.max(0,Number(p.expected||0)-Number(p.received||0)),0);const finance=Math.max(0,Math.round(100-Math.min(100,debt/100)));
 return{overall:Math.max(0,overall),technical:Math.max(0,technical),documents:Math.max(0,documents),finance}
}
function assistantMessages(){
 const messages=[],health=fleetHealthData(),week=weekPlanData();
 const attention=fleetCars().flatMap(c=>healthDetails(c).items.map(i=>({c,i}))).sort((a,b)=>(a.i.level==="danger"?-1:1));
 attention.slice(0,4).forEach(x=>messages.push(`${model(x.c).brand} ${model(x.c).model}: ${x.i.title} — ${x.i.value}.`));
 messages.push(`На этой неделе плановый заработок ${money(week.plannedRevenue)}, расходы ${money(week.totalPlannedCosts)}, ожидаемый остаток ${money(week.expectedBalance)}.`);
 messages.push(`Общее здоровье автопарка — ${health.overall}%.`);
 if(!attention.length)messages.unshift("Критических предупреждений нет.");return messages
}
function activityCategory(row){
 const text=`${row?.action||""} ${row?.entity||""} ${row?.details||""}`.toLowerCase();
 if(/пробег|автомоб|машин|арендатор|статус/.test(text))return"vehicle";
 if(/ремонт|сервис|масл|техосмотр|шина/.test(text))return"service";
 if(/оплат|расход|доход|платеж|сумм|финанс/.test(text))return"finance";
 if(/документ|страхов|полис|договор|карта/.test(text))return"documents";
 return"system"
}
function activityCategoryLabel(category){
 return{vehicle:"Автомобиль",service:"Сервис",finance:"Финансы",documents:"Документы",system:"Система"}[category]||"Система"
}
function activityCategoryIcon(category){
 return{vehicle:"🚘",service:"🔧",finance:"$",documents:"📄",system:"•"}[category]||"•"
}
function activityRowsFiltered(){
 const query=($("#activitySearch")?.value||"").trim().toLowerCase();
 const category=$("#activityTypeFilter")?.value||"all";
 const period=$("#activityPeriodFilter")?.value||"all";
 const now=Date.now();
 return(db.activity||[])
  .slice()
  .sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")))
  .filter(row=>{
   const rowCategory=activityCategory(row);
   if(category!=="all"&&rowCategory!==category)return false;
   if(query&&!`${row.action||""} ${row.entity||""} ${row.details||""}`.toLowerCase().includes(query))return false;
   if(period!=="all"){
    const stamp=new Date(row.date).getTime();
    if(Number.isNaN(stamp))return false;
    if(period==="today"&&new Date(row.date).toDateString()!==new Date().toDateString())return false;
    if(period==="7"&&now-stamp>7*86400000)return false;
    if(period==="30"&&now-stamp>30*86400000)return false
   }
   return true
  })
}
function renderActivityJournal(){
 const root=$("#activityLog");if(!root)return;
 const rows=activityRowsFiltered();
 root.innerHTML=rows.length?rows.slice(0,200).map(row=>{
  const category=activityCategory(row);
  const dt=new Date(row.date);
  const valid=!Number.isNaN(dt.getTime());
  const dateText=valid?dt.toLocaleDateString("ru-RU"):"—";
  const timeText=valid?dt.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}):"";
  return`<article class="activity-journal-row ${category}">
    <div class="activity-journal-time"><strong>${timeText}</strong><small>${dateText}</small></div>
    <div class="activity-journal-icon">${activityCategoryIcon(category)}</div>
    <div class="activity-journal-main">
      <div class="activity-journal-title"><strong>${row.action||"Изменение"}</strong><span>${activityCategoryLabel(category)}</span></div>
      <small>${row.entity||"FleetPilot"}</small>
      ${row.details?`<p>${row.details}</p>`:""}
    </div>
  </article>`
 }).join(""):`<div class="activity-journal-empty"><span>🕘</span><strong>Записей не найдено</strong><small>Измените фильтры или выполните действие в FleetPilot.</small></div>`
}
