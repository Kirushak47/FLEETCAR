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
let workspaceDriverAssignmentRows=[];
let workspaceDriverDirectory=[];

/* =========================================================
   V18.10 — Assignment-cycle acceptance + immutable handover audit
   Keeps acceptance tied to the current assignment revision and records
   forced detach/cancel events even when the backend handover row is stale.
   ========================================================= */
function ensureVehicleHandoverAudit(c){
 if(!c)return[];
 if(!Array.isArray(c.vehicleHandoverAudit))c.vehicleHandoverAudit=[];
 return c.vehicleHandoverAudit
}
function addVehicleHandoverAudit(c,type,details={}){
 if(!c)return null;
 const list=ensureVehicleHandoverAudit(c);
 const revision=String(details.revision||c.driverAssignmentRevision||"");
 const key=String(details.key||`${type}:${revision||Date.now()}`);
 if(list.some(x=>String(x.key||"")===key))return list.find(x=>String(x.key||"")===key)||null;
 const row={
  id:`audit-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,key,type,revision,
  at:details.at||new Date().toISOString(),driver_user_id:details.driverUserId||c.driverUserId||"",
  driver_name:details.driverName||c.driverName||c.tenant||"",driver_email:details.driverEmail||c.driverEmail||"",
  mileage:details.mileage!=null?Number(details.mileage):Number(c.mileage||0),
  photos:Array.isArray(details.photos)?details.photos:[],notes:String(details.notes||"")
 };
 list.push(row);
 if(list.length>200)c.vehicleHandoverAudit=list.slice(-200);
 return row
}
function currentAssignmentAuditState(c){
 if(!c?.driverAssignmentRevision)return{accepted:false,acceptedAt:"",closed:false};
 const revision=String(c.driverAssignmentRevision||"");
 const events=ensureVehicleHandoverAudit(c).filter(row=>String(row.revision||"")===revision).sort((a,b)=>Date.parse(a.at||0)-Date.parse(b.at||0));
 let acceptedAt="",closed=false;
 for(const row of events){
  if(row.type==="accepted"){acceptedAt=row.at||acceptedAt;closed=false}
  if(["returned","forced_return","assignment_cancelled"].includes(row.type)){closed=true}
 }
 return{accepted:Boolean(acceptedAt&&!closed),acceptedAt,closed}
}
function currentAssignmentAcceptedLocally(c){
 if(!c?.driverUserId||!c?.driverAssignmentRevision)return false;
 if(Boolean(c.driverAcceptedAt&&c.driverAcceptedRevision===c.driverAssignmentRevision))return true;
 return currentAssignmentAuditState(c).accepted
}
function currentAssignmentAcceptanceDate(c){
 if(c?.driverAcceptedAt&&c.driverAcceptedRevision===c.driverAssignmentRevision)return c.driverAcceptedAt;
 return currentAssignmentAuditState(c).acceptedAt||""
}
window.addVehicleHandoverAudit=addVehicleHandoverAudit;


/* =========================================================
   V18.4 — Single Driver Assignment Pipeline
   Every entry point (new car, car profile, Drivers registry) must call this.
   Assignment never means acceptance. Acceptance is only created by the driver
   after mileage + photo in Driver Portal.
   ========================================================= */
async function assignVehicleDriverUnified(driverUserId,carId,options={}){
 const uid=String(driverUserId||"").trim();
 const cid=String(carId||"").trim();
 if(!uid)throw new Error("Водитель не выбран");
 if(!cid)throw new Error("Автомобиль не выбран");
 await loadWorkspaceDriverDirectory?.();
 const member=(workspaceDriverDirectory||[]).find(x=>String(x.user_id||"")===uid)||null;
 const target=car(cid);if(!target)throw new Error("Автомобиль не найден");
 // One account driver = one current vehicle. Clear stale local links first.
 fleetCars().forEach(c=>{
  if(String(c.driverUserId||"")===uid&&String(c.id)!==cid){
   c.driverUserId="";c.driverEmail="";c.driverName="";c.driverPhone="";c.driverAcceptedAt="";
   if(c.driverAssignmentSource==="account"){c.tenant="";c.driverAssignmentSource=""}
  }
 });
 // If the target has another account driver, detach that assignment first.
 const previous=workspaceDriverForCar(target);
 if(previous?.userId&&String(previous.userId)!==uid&&window.FleetPilotCloud?.assignDriverVehicle){
  await window.FleetPilotCloud.assignDriverVehicle(previous.userId,null);
 }
 // Always create a fresh assignment cycle, even when the same driver is assigned again.
 // Detaching first prevents an old accepted handover from being reused by the backend.
 if(window.FleetPilotCloud?.assignDriverVehicle){
  try{await window.FleetPilotCloud.assignDriverVehicle(uid,null)}catch(error){console.warn("Driver pre-detach",error)}
  await window.FleetPilotCloud.assignDriverVehicle(uid,cid);
 }
 target.driverUserId=uid;
 target.driverEmail=workspaceDriverEmail(member)||options.email||"";
 target.driverName=workspaceDriverName(member)||options.name||target.driverEmail||"Водитель";
 target.driverPhone=workspaceDriverPhone(member)||options.phone||"";
 target.driverAssignmentSource="account";
 target.tenant=target.driverName||target.driverEmail;
 // Critical: assigning/reassigning ALWAYS starts a fresh pending acceptance.
 target.driverAcceptedAt="";
 target.driverAcceptedRevision="";
 target.driverAssignedAt=new Date().toISOString();
 target.driverAssignmentRevision=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
 addVehicleHandoverAudit(target,"assigned",{
  key:`assigned:${target.driverAssignmentRevision}`,revision:target.driverAssignmentRevision,at:target.driverAssignedAt,
  driverUserId:uid,driverName:target.driverName,driverEmail:target.driverEmail,mileage:target.mileage
 });
 save?.();
 await loadWorkspaceDriverAssignments?.();
 renderFleet?.();
 renderDriversRegistry?.();
 if(selectedCarId&&String(selectedCarId)===cid&&$("#carPage")?.classList.contains("active"))openCar(cid);
 window.dispatchEvent(new CustomEvent("fleetpilot:driver-assignment-changed",{detail:{driverUserId:uid,carId:cid,status:"pending"}}));
 return target
}
async function unassignVehicleDriverUnified(driverUserId,carId=""){
 const uid=String(driverUserId||"").trim();
 const targets=fleetCars().filter(c=>(uid&&String(c.driverUserId||"")===uid)||(carId&&String(c.id)===String(carId)));
 // Record the business event BEFORE clearing the assignment. If the current cycle
 // was accepted, this is a forced company repossession; otherwise it is a cancelled assignment.
 targets.forEach(c=>{
  const accepted=currentAssignmentAcceptedLocally(c)||driverAcceptanceBelongsToAssignment(workspaceDriverAssignmentForCar(c.id),c);
  addVehicleHandoverAudit(c,accepted?"forced_return":"assignment_cancelled",{
   key:`${accepted?"forced_return":"assignment_cancelled"}:${c.driverAssignmentRevision||Date.now()}`,
   revision:c.driverAssignmentRevision||"",driverUserId:c.driverUserId,driverName:c.driverName,driverEmail:c.driverEmail,
   mileage:c.mileage,notes:accepted?"Автомобиль отобран компанией":"Назначение отменено компанией"
  });
 });
 if(uid&&window.FleetPilotCloud?.assignDriverVehicle)await window.FleetPilotCloud.assignDriverVehicle(uid,null);
 targets.forEach(c=>{
  c.driverUserId="";c.driverEmail="";c.driverName="";c.driverPhone="";c.driverAcceptedAt="";c.driverAcceptedRevision="";c.driverAssignedAt="";
  if(c.driverAssignmentSource==="account"){c.tenant="";c.driverAssignmentSource=""}
 });
 save?.();
 await loadWorkspaceDriverAssignments?.();
 renderFleet?.();renderDriversRegistry?.();
}
window.assignVehicleDriverUnified=assignVehicleDriverUnified;
window.unassignVehicleDriverUnified=unassignVehicleDriverUnified;

function normalizeDriverIdentity(value){return String(value||"").trim().toLowerCase()}
function workspaceDriverEmail(member){return member?.profiles?.email||member?.email||member?.driver_email||""}
function driverMetaStorageKey(){return `fleetpilot.driver.meta.${window.FleetPilotCloud?.workspace?.id||"default"}`}
function loadDriverMetaStore(){try{return JSON.parse(localStorage.getItem(driverMetaStorageKey())||"{}")||{}}catch{return{}}}
function saveDriverMetaStore(store){try{localStorage.setItem(driverMetaStorageKey(),JSON.stringify(store||{}))}catch{}}
function driverMetaFor(member){const store=loadDriverMetaStore();const email=normalizeDriverIdentity(workspaceDriverEmail(member));return store[String(member?.user_id||"")]||store[email]||{}}
function workspaceDriverName(member){const meta=driverMetaFor(member);return member?.display_name||member?.name||member?.full_name||[member?.first_name||meta.firstName,member?.last_name||meta.lastName].filter(Boolean).join(" ")||""}
function workspaceDriverPhone(member){const meta=driverMetaFor(member);return member?.phone||member?.profiles?.phone||meta.phone||""}
window.FleetPilotDriverMeta={load:loadDriverMetaStore,save:saveDriverMetaStore,key:driverMetaStorageKey};
function workspaceDriverMemberByEmail(email){
 const q=normalizeDriverIdentity(email);if(!q)return null;
 return workspaceDriverDirectory.find(member=>normalizeDriverIdentity(workspaceDriverEmail(member))===q)||null
}
function workspaceDriverAssignmentForCar(carId){
 const id=String(carId||"");
 const c=car(id);
 if(!c?.driverUserId)return null;
 return workspaceDriverAssignmentRows.find(row=>String(row.car_id||"")===id&&String(row.driver_user_id||"")===String(c.driverUserId||"")&&String(row.status||"")!=="returned")||null
}
function driverAssignmentStartedAt(row,c=null){
 const value=row?.assigned_at||row?.assignment_at||row?.created_at||c?.driverAssignedAt||"";
 const t=value?Date.parse(value):NaN;return Number.isFinite(t)?t:0
}
function driverHandoverAcceptedAt(row){
 const value=row?.accepted_at||row?.vehicle_accepted_at||row?.issue_at||"";
 const t=value?Date.parse(value):NaN;return Number.isFinite(t)?t:0
}
function handoverIssueHasPhotoEvidence(row){
 const count=Number(row?.issue_photos_count||0);
 const photos=Array.isArray(row?.issue_photos)?row.issue_photos:(Array.isArray(row?.photos)?row.photos:[]);
 return count>0||photos.length>0
}
function handoverRowIsIssued(row){
 if(!row)return false;
 const status=String(row.status||row.handover_status||"").toLowerCase();
 const issuedStatus=["issued","active","accepted"].includes(status);
 // Some RPC versions return issue_at + mileage/photos but do not return accepted_at.
 // A successful issue row is still a completed acceptance.
 return Boolean(
  row.active_handover_id||row.handover_id||row.accepted_at||row.vehicle_accepted_at||
  (row.issue_at&&issuedStatus)||
  (issuedStatus&&row.issue_mileage!=null&&handoverIssueHasPhotoEvidence(row))
 )&&!row.return_at
}
function driverAcceptanceBelongsToAssignment(row,c=null){
 // A completed acceptance tied to the current assignment revision is authoritative.
 // A stale backend handover from an older issue must never turn it back into pending.
 if(currentAssignmentAcceptedLocally(c))return true;
 const evidence=handoverRowIsIssued(row);
 if(!evidence)return Boolean(c?.driverAcceptedAt&&(!c?.driverAssignmentRevision||c?.driverAcceptedRevision===c?.driverAssignmentRevision));
 const started=driverAssignmentStartedAt(row,c),accepted=driverHandoverAcceptedAt(row);
 if(started&&accepted&&accepted+1000<started)return false;
 if(c?.driverAssignmentRevision&&c?.driverAcceptedRevision&&c.driverAcceptedRevision!==c.driverAssignmentRevision)return false;
 return true
}
window.driverAcceptanceBelongsToAssignment=driverAcceptanceBelongsToAssignment;
function workspaceDriverForCar(c){
 if(!c)return null;
 const row=workspaceDriverAssignmentForCar(c.id);
 const userId=String(c.driverUserId||"");
 const member=workspaceDriverDirectory.find(x=>String(x.user_id||"")===userId)||null;
 const email=c.driverEmail||row?.driver_email||workspaceDriverEmail(member)||"";
 const name=c.driverName||row?.driver_name||workspaceDriverName(member)||"";
 const accepted=driverAcceptanceBelongsToAssignment(row,c);
 if(userId||email)return{userId,email,name:name||email,source:"account",accepted};
 if(c.tenant)return{userId:"",email:c.driverEmail||"",name:c.tenant,source:"manual",accepted:false};
 return null
}
function fleetDriverLabel(c){
 const d=workspaceDriverForCar(c);if(!d)return"Без водителя";
 return d.name||d.email||c.tenant||"Водитель"
}
function fleetDriverMeta(c){
 const d=workspaceDriverForCar(c);if(!d)return"Не назначен";
 if(d.source==="manual")return"Введён вручную";
 return d.accepted?"Автомобиль принят":"Ожидает подтверждения"
}
async function loadWorkspaceDriverDirectory(){
 try{
  const result=await window.FleetPilotCloud?.enterpriseList?.();
  workspaceDriverDirectory=(result?.members||[]).filter(member=>member.role==="driver"&&member.status!=="disabled");
  const api=window.FleetPilotDriverMeta,store=api?.load?.()||{};
  for(const member of workspaceDriverDirectory){const email=normalizeDriverIdentity(workspaceDriverEmail(member));const meta=store[String(member.user_id)]||store[email];if(meta&&email&&!store[String(member.user_id)])store[String(member.user_id)]=meta;if(meta?.pendingCarId&&!workspaceDriverAssignmentRows.some(r=>String(r.driver_user_id)===String(member.user_id)&&String(r.status)!=="returned")){try{await window.FleetPilotCloud.assignDriverVehicle(member.user_id,meta.pendingCarId);meta.pendingCarId="";store[String(member.user_id)]=meta;store[email]=meta}catch(error){console.warn("Pending driver assignment",error)}}}
  api?.save?.(store);
 }catch(error){console.warn("Driver directory",error);workspaceDriverDirectory=[]}
 return workspaceDriverDirectory
}
function driverPickerStatus(member){
 const c=fleetCars().find(car=>String(car.driverUserId||"")===String(member?.user_id||""))||null;
 if(!c)return{label:"Без автомобиля",cls:"free",vehicle:""};
 const vehicle=`${model(c).brand} ${model(c).model} · ${c.plate||"—"}`;
 const accepted=currentAssignmentAcceptedLocally(c)||Boolean(c.driverAcceptedAt);
 return{label:accepted?"Автомобиль принят":"Ожидает приёмки",cls:accepted?"accepted":"pending",vehicle}
}

function renderDriverPickerCards(query=""){
 const root=$("#carDriverPickerResults");if(!root)return;
 const q=String(query||"").trim().toLowerCase();
 const rows=(workspaceDriverDirectory||[]).filter(member=>{const text=`${workspaceDriverName(member)} ${workspaceDriverEmail(member)} ${workspaceDriverPhone(member)}`.toLowerCase();return !q||text.includes(q)});
 root.innerHTML=rows.map(member=>{const status=driverPickerStatus(member);const name=workspaceDriverName(member)||workspaceDriverEmail(member)||"Водитель";const email=workspaceDriverEmail(member);return `<button type="button" class="driver-picker-card" data-pick-driver="${member.user_id}"><span class="driver-picker-avatar">${String(name).trim().charAt(0).toUpperCase()}</span><span class="driver-picker-person"><strong>${name}</strong><small>${email||"Без e-mail"}</small>${status.vehicle?`<em>${status.vehicle}</em>`:""}</span><span class="driver-picker-status ${status.cls}">${status.label}</span></button>`}).join("")||'<div class="driver-picker-empty">Водители не найдены</div>';
 root.querySelectorAll('[data-pick-driver]').forEach(btn=>btn.onclick=()=>{const member=workspaceDriverDirectory.find(x=>String(x.user_id)===String(btn.dataset.pickDriver));if(!member)return;const input=$("#carTenant"),hidden=$("#carDriverUserId"),manual=$("#carDriverManualFields"),selected=$("#carDriverSelected");if(input)input.value=workspaceDriverName(member)||workspaceDriverEmail(member);if(hidden)hidden.value=member.user_id||"";const emailField=$("#carDriverEmail");if(emailField)emailField.value=workspaceDriverEmail(member)||"";if(manual)manual.hidden=true;if(selected){selected.hidden=false;selected.innerHTML=`<span class="driver-picker-avatar">${String(workspaceDriverName(member)||"D").charAt(0).toUpperCase()}</span><span><strong>${workspaceDriverName(member)||workspaceDriverEmail(member)}</strong><small>${workspaceDriverEmail(member)||""}</small></span><button type="button" id="clearCarDriverSelection">Изменить</button>`;selected.querySelector('#clearCarDriverSelection').onclick=()=>{hidden.value="";selected.hidden=true;$("#carDriverPickerSearch")?.focus()}}const search=$("#carDriverPickerSearch"),results=$("#carDriverPickerResults");if(search)search.value="";if(results)results.hidden=true});
}
function ensureRichDriverPicker(){
 const input=$("#carTenant");if(!input||$("#carDriverPickerPanel"))return;
 input.type="hidden";
 input.insertAdjacentHTML("afterend",`<div class="rich-driver-picker"><div id="carDriverSelected" class="driver-picker-selected" hidden></div><div id="carDriverPickerPanel" class="driver-picker-panel driver-picker-dropdown"><div class="driver-picker-search-wrap"><span>⌕</span><input id="carDriverPickerSearch" type="search" autocomplete="off" placeholder="Начните вводить имя, фамилию или e-mail"></div><div id="carDriverPickerResults" class="driver-picker-results" hidden></div><button type="button" id="carDriverManualToggle" class="driver-picker-manual-toggle">+ Ввести водителя вручную</button><div id="carDriverManualFields" class="driver-picker-manual-fields" hidden><input id="carDriverManualName" placeholder="Имя и фамилия"><input id="carDriverEmail" type="email" placeholder="E-mail (необязательно)"><input id="carDriverPhone" type="tel" placeholder="Телефон (необязательно)"></div></div><button type="button" id="carDriverUnlinkButton" class="driver-picker-unlink" hidden>Отвязать водителя</button></div>`);
 const search=$("#carDriverPickerSearch"),results=$("#carDriverPickerResults");
 const openResults=()=>{if(results){results.hidden=false;renderDriverPickerCards(search?.value||"")}};
 if(search){search.onfocus=openResults;search.onclick=openResults;search.oninput=()=>{openResults()}};
 $("#carDriverManualToggle").onclick=()=>{const fields=$("#carDriverManualFields");fields.hidden=!fields.hidden;if(!fields.hidden){$("#carDriverUserId").value="";$("#carDriverSelected").hidden=true}};
 [$("#carDriverManualName"),$("#carDriverEmail")].filter(Boolean).forEach(el=>el.addEventListener("input",()=>{if(!$("#carDriverUserId").value)input.value=$("#carDriverManualName").value.trim()||$("#carDriverEmail").value.trim()}));
}
function renderCarDriverPicker(c=null){
 ensureRichDriverPicker();
 const input=$("#carTenant"),hidden=$("#carDriverUserId"),hint=$("#carDriverHint");if(!input||!hidden)return;
 const current=workspaceDriverForCar(c);hidden.value=current?.userId||"";input.value=current?.name||c?.tenant||"";
 renderDriverPickerCards("");
 const selected=$("#carDriverSelected"),panel=$("#carDriverPickerPanel"),manual=$("#carDriverManualFields");
 if(current?.userId){const member=workspaceDriverDirectory.find(x=>String(x.user_id)===String(current.userId));if(selected){selected.hidden=false;selected.innerHTML=`<span class="driver-picker-avatar">${String(current.name||"D").charAt(0).toUpperCase()}</span><span><strong>${current.name||current.email}</strong><small>${current.email||""}</small></span><button type="button" id="clearCarDriverSelection">Изменить</button>`;selected.querySelector('#clearCarDriverSelection').onclick=()=>{hidden.value="";selected.hidden=true;panel?.removeAttribute("hidden")}}panel?.removeAttribute("hidden");const results=$("#carDriverPickerResults");if(results)results.hidden=true;if(manual)manual.hidden=true}
 else if(c?.tenant){if(manual){manual.hidden=false;$("#carDriverManualName").value=c.tenant||c.driverName||"";$("#carDriverEmail").value=c.driverEmail||"";$("#carDriverPhone").value=c.driverPhone||""}panel?.removeAttribute("hidden")}
 else{selected&&(selected.hidden=true);panel?.removeAttribute("hidden");manual&&(manual.hidden=true)}
 const unlink=$("#carDriverUnlinkButton");
 if(unlink){
  unlink.hidden=!(current?.userId||c?.tenant);
  unlink.onclick=async()=>{
   if(!c||!confirm("Отвязать водителя от этого автомобиля? История выдач останется сохранена."))return;
   try{
    if(current?.userId&&window.unassignVehicleDriverUnified)await window.unassignVehicleDriverUnified(current.userId,c.id);
    c.driverUserId="";c.driverEmail="";c.driverName="";c.driverPhone="";c.driverAcceptedAt="";c.driverAssignmentSource="";c.tenant="";
    save?.();
    await loadWorkspaceDriverAssignments?.();
    renderFleet?.();
    renderCarDriverPicker(c);
    renderDriversRegistry?.();
    toast("Водитель отвязан")
   }catch(error){toast(error.message||String(error))}
  }
 }
 if(hint)hint.textContent=current?.userId?"Водитель связан с аккаунтом FleetPilot.":c?.tenant?"Водитель введён вручную.":"Выберите водителя из списка или введите вручную."
}
async function prepareCarDriverPicker(c=null){await loadWorkspaceDriverDirectory();renderCarDriverPicker(c)}
window.prepareCarDriverPicker=prepareCarDriverPicker;
window.workspaceDriverForCar=workspaceDriverForCar;
window.fleetDriverLabel=fleetDriverLabel;
window.fleetDriverMeta=fleetDriverMeta;

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

function driverVehicleIsAlreadyAccepted(){
 const assignedCar=driverAssignedCar();
 if(currentAssignmentAcceptedLocally(assignedCar))return true;
 // Acceptance must belong to THIS assignment cycle. Old handovers from a previous
 // assignment of the same driver/car are deliberately ignored.
 const state=driverHandoverState||{},ctx=driverPortalContext||{};
 const merged={...ctx,...state};
 const evidence=handoverRowIsIssued(merged);
 if(!evidence)return false;
 const assignedValue=ctx.assigned_at||ctx.assignment_at||assignedCar?.driverAssignedAt||"";
 const issueValue=state.accepted_at||state.vehicle_accepted_at||state.issue_at||ctx.accepted_at||ctx.vehicle_accepted_at||ctx.issue_at||"";
 const assignedAt=assignedValue?Date.parse(assignedValue):0,issueAt=issueValue?Date.parse(issueValue):0;
 if(assignedAt&&issueAt&&issueAt+1000<assignedAt)return false;
 if(assignedCar?.driverAssignmentRevision&&assignedCar?.driverAcceptedRevision&&assignedCar.driverAcceptedRevision!==assignedCar.driverAssignmentRevision)return false;
 return !state.return_at
}

async function loadDriverHandoverState(){
 if(enterpriseCurrentRole()!=="driver")return;
 try{
  driverHandoverState=await window.FleetPilotCloud.getDriverHandoverState();
  const actions=$("#driverHandoverActions");
  if(!actions)return;
  actions.hidden=!driverPortalContext?.car_id;
  const issued=driverVehicleIsAlreadyAccepted();
  const assignedCar=driverAssignedCar();
  if(assignedCar&&issued&&!assignedCar.driverAcceptedAt){assignedCar.driverAcceptedAt=driverHandoverState?.issue_at||new Date().toISOString();assignedCar.driverAcceptedRevision=assignedCar.driverAssignmentRevision||"";save?.()}
  actions.dataset.issued=issued?"1":"0";
  const issueButton=$("#startVehicleIssue"),returnButton=$("#startVehicleReturn");
  if(issueButton){issueButton.hidden=issued;issueButton.style.display=issued?"none":""}
  if(returnButton){returnButton.hidden=!issued;returnButton.style.display=issued?"":"none"}
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
let vehicleHandoverHistoryLimit=10;
let vehicleHandoverHistoryPhotoMap={};
let handoverViewerPhotos=[];let handoverViewerIndex=0;
function openHandoverPhotoViewer(photos,index=0){
 handoverViewerPhotos=Array.isArray(photos)?photos:[];handoverViewerIndex=Math.max(0,Math.min(Number(index)||0,handoverViewerPhotos.length-1));
 const dialog=$("#handoverPhotoViewer"),img=$("#handoverPhotoViewerImage"),counter=$("#handoverPhotoViewerCounter");if(!dialog||!img||!handoverViewerPhotos.length)return;
 const photo=handoverViewerPhotos[handoverViewerIndex];img.src=photo?.data||photo||"";if(counter)counter.textContent=`${handoverViewerIndex+1} / ${handoverViewerPhotos.length}`;if(!dialog.open)dialog.showModal();
}
function stepHandoverPhotoViewer(delta){if(!handoverViewerPhotos.length)return;handoverViewerIndex=(handoverViewerIndex+delta+handoverViewerPhotos.length)%handoverViewerPhotos.length;openHandoverPhotoViewer(handoverViewerPhotos,handoverViewerIndex)}
window.openHandoverPhotoViewer=openHandoverPhotoViewer;
function installHandoverPhotoViewer(){const d=$("#handoverPhotoViewer");if(!d||d.dataset.ready)return;d.dataset.ready="1";$("#closeHandoverPhotoViewer").onclick=()=>d.close();$("#handoverPhotoPrev").onclick=()=>stepHandoverPhotoViewer(-1);$("#handoverPhotoNext").onclick=()=>stepHandoverPhotoViewer(1);d.addEventListener("click",e=>{if(e.target===d)d.close()})}
async function loadVehicleHandoverHistory(carId){
 const root=$("#vehicleHandoverHistory");if(!root)return;installHandoverPhotoViewer();
 root.innerHTML='<div class="driver-empty-state">Загрузка истории передач…</div>';
 try{
  const backendRows=await window.FleetPilotCloud.getVehicleHandoverHistory(carId).catch(()=>[]);
  const c=car(carId),audit=Array.isArray(c?.vehicleHandoverAudit)?c.vehicleHandoverAudit:[],backendEvents=[];
  (backendRows||[]).forEach((row,index)=>{const systemReissue=String(row.return_notes||row.notes||"").includes("__FP_ACCEPTANCE_REISSUE__");if(systemReissue)return;if(row.issue_at)backendEvents.push({source:"backend",type:"issued",at:row.issue_at,row,key:`b-issue-${row.id||row.handover_id||index}-${row.issue_at}`});if(row.return_at)backendEvents.push({source:"backend",type:"returned",at:row.return_at,row,key:`b-return-${row.id||row.handover_id||index}-${row.return_at}`})});
  const auditEvents=audit.map((row,index)=>({source:"audit",type:row.type,at:row.at,row,key:row.key||`a-${index}`})),seen=new Set();
  const events=[...backendEvents,...auditEvents].filter(ev=>{const signature=`${ev.type}|${ev.at||""}|${ev.row?.driver_user_id||ev.row?.driver_email||""}`;if(seen.has(signature))return false;seen.add(signature);return true}).sort((a,b)=>Date.parse(b.at||0)-Date.parse(a.at||0));
  const label={issued:"Выдан",accepted:"Принят водителем",returned:"Возвращён водителем",forced_return:"Автомобиль отобран компанией",assignment_cancelled:"Назначение отменено",assigned:"Назначен водителю"};
  const icon={issued:"●",accepted:"✓",returned:"↩",forced_return:"!",assignment_cancelled:"×",assigned:"→"};
  vehicleHandoverHistoryPhotoMap={};
  const visible=events.slice(0,vehicleHandoverHistoryLimit);
  root.innerHTML=`<div class="handover-compact-list">${visible.map((ev,i)=>{const row=ev.row||{},name=row.driver_name||row.driver_email||"Водитель",mileage=ev.source==="audit"?row.mileage:(ev.type==="returned"?row.return_mileage:row.issue_mileage),photos=ev.source==="audit"?(row.photos||[]):((ev.type==="returned"?row.return_photos:row.issue_photos)||[]),notes=ev.source==="audit"?row.notes:(ev.type==="returned"?row.return_notes:row.issue_notes),key=`h${i}-${Math.abs(String(ev.key||i).split("").reduce((a,ch)=>a+ch.charCodeAt(0),0))}`;vehicleHandoverHistoryPhotoMap[key]=photos;return `<article class="handover-compact-row" data-handover-event="${key}"><button type="button" class="handover-compact-summary" aria-expanded="false"><span class="handover-event-icon type-${ev.type}">${icon[ev.type]||"•"}</span><span class="handover-event-main"><strong>${label[ev.type]||ev.type}</strong><small>${name}${mileage!=null?` · ${km(mileage)}`:""}${photos.length?` · ${photos.length} фото`:""}</small></span><time>${ev.at?new Date(ev.at).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}):"—"}</time><span class="handover-chevron">⌄</span></button><div class="handover-compact-details" hidden>${notes?`<p>${notes}</p>`:""}<div class="handover-photo-history">${photos.slice(0,8).map((photo,pi)=>`<button type="button" class="handover-photo-thumb" data-handover-photo-key="${key}" data-handover-photo-index="${pi}"><img src="${photo.data||photo}" alt="Фото передачи ${pi+1}"></button>`).join("")}</div></div></article>`}).join("")}</div>${events.length>visible.length?`<button type="button" class="btn handover-load-more" id="handoverHistoryMore">Показать ещё (${events.length-visible.length})</button>`:""}`||'<div class="driver-empty-state">Передач автомобиля пока не было.</div>';
  root.querySelectorAll(".handover-compact-summary").forEach(btn=>btn.onclick=()=>{const row=btn.closest(".handover-compact-row"),details=row.querySelector(".handover-compact-details"),open=details.hidden;details.hidden=!open;btn.setAttribute("aria-expanded",String(open));row.classList.toggle("open",open)});
  root.querySelectorAll("[data-handover-photo-key]").forEach(btn=>btn.onclick=e=>{e.stopPropagation();openHandoverPhotoViewer(vehicleHandoverHistoryPhotoMap[btn.dataset.handoverPhotoKey]||[],Number(btn.dataset.handoverPhotoIndex||0))});
  const more=$("#handoverHistoryMore");if(more)more.onclick=()=>{vehicleHandoverHistoryLimit+=10;loadVehicleHandoverHistory(carId)};
 }catch(error){root.innerHTML=`<div class="driver-empty-state">${error.message||error}</div>`}
}

function renderDriverVehicleCard(){
 const root=$("#driverVehicleCard");if(!root)return;
 const assigned=driverPortalContext;
 const assignedCar=driverAssignedCar();

 if(!assigned?.car_id){
  root.innerHTML=`<div class="driver-empty-state">
   <strong>Автомобиль ещё не назначен</strong>
   <span>Владелец или координатор должен назначить автомобиль в профиле автомобиля.</span>
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
   <div><small>${driverVehicleIsAlreadyAccepted()?"Принят":"Назначен"}</small><strong>${driverHandoverState?.issue_at?new Date(driverHandoverState.issue_at).toLocaleDateString("ru-RU"):assigned.assigned_at?new Date(assigned.assigned_at).toLocaleDateString("ru-RU"):"—"}</strong></div>
   <div><small>Следующее ТО</small><strong>${assignedCar?km(Math.max(0,oil(assignedCar))):"—"}</strong></div>
   <div><small>Город</small><strong>${displayCar.city||window.FleetPilotCloud?.membership?.city||"—"}</strong></div>
  </div>`
 const actions=$("#driverHandoverActions");
 if(actions&&driverPortalContext?.car_id){
  const accepted=driverVehicleIsAlreadyAccepted();
  actions.dataset.issued=accepted?"1":"0";
  const issueButton=$("#startVehicleIssue"),returnButton=$("#startVehicleReturn");
  if(issueButton){issueButton.hidden=accepted;issueButton.style.display=accepted?"none":""}
  if(returnButton){returnButton.hidden=!accepted;returnButton.style.display=accepted?"":"none"}
 }
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
  const visibleRows=rows.filter(row=>row.status!=="done"&&(row.driver_action_required===true||row.requires_driver===true||row.driver_message||row.appointment_at||row.scheduled_at||row.date));
  if(count)count.textContent=String(visibleRows.filter(row=>row.status!=="done").length);
  root.innerHTML=visibleRows.map(row=>{
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
  }).join("")||'<div class="driver-empty-state">Для вас сейчас нет действий по сервису.</div>';
  renderDriverProfileService()
 }catch(error){
  if(count)count.textContent="!";
  root.innerHTML=`<div class="driver-empty-state">${error.message||"Не удалось загрузить сервисный план"}</div>`
 }
}
let driverNotificationsVisible=7;
async function renderDriverNotifications(){
 const root=$("#driverNotificationsList");if(!root)return;
 try{
  const rows=await window.FleetPilotCloud.getMyWorkspaceNotifications();
  const visible=rows.slice(0,driverNotificationsVisible);
  root.innerHTML=visible.map(row=>`
   <article class="driver-notification-row ${row.read_at?"read":""}">
    <span>${row.type==="repair"?"🔧":"🔔"}</span>
    <div><strong>${row.title}</strong><small>${row.message||""}</small><em>${new Date(row.created_at).toLocaleString("ru-RU")}</em></div>
   </article>`).join("")||'<div class="driver-empty-state">Новых уведомлений нет.</div>';
  if(rows.length>visible.length){const b=document.createElement("button");b.type="button";b.className="btn driver-notifications-more";b.textContent=`Показать ещё (${rows.length-visible.length})`;b.onclick=()=>{driverNotificationsVisible+=7;renderDriverNotifications()};root.appendChild(b)}
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
  document.body.classList.add("driver-portal-v18")
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
 const minimumMileage=Number(assignedCar?.mileage||driverPortalContext?.mileage||0);
 $("#driverRepairMileage").value=minimumMileage;
 $("#driverRepairMileage").min=Math.max(0,Math.round(minimumMileage));
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


let serviceArchiveFilter="all";
function serviceArchiveRows(){
 const driver=(workspaceRepairAlerts||[]).filter(row=>String(row.status||"")==="rejected").map(row=>({source:"driver",row,when:row.updated_at||row.created_at||""}));
 const internal=(db.repairs||[]).filter(r=>["done","cancelled"].includes(String(r.status||""))).map(row=>({source:"internal",row,when:row.completedDate||row.date||""}));
 return [...driver,...internal].sort((a,b)=>String(b.when).localeCompare(String(a.when)))
}
function renderServiceRequestArchive(){
 const panel=$("#serviceRequestArchivePanel"),root=$("#serviceRequestArchiveList");if(!panel||!root)return;
 const all=serviceArchiveRows();
 const rows=all.filter(x=>serviceArchiveFilter==="all"||x.source===serviceArchiveFilter);
 const count=$("#serviceArchivedRequestCount");if(count)count.textContent=String(rows.length);
 root.innerHTML=rows.map(item=>{
  if(item.source==="driver"){
   const row=item.row,localCar=car(row.car_id),carName=localCar?`${model(localCar).brand} ${model(localCar).model} · ${localCar.plate}`:(row.car_id||"Автомобиль"),category=DRIVER_REPAIR_CATEGORY_LABELS[row.category]||row.category||"Неисправность";
   return `<article class="workspace-request-row service-archive-request" data-archived-request-id="${row.id}"><div><div class="service-inbox-request-heading"><strong>${category} · ${carName}</strong><span class="service-inbox-request-badge rejected">Водитель</span></div><span>${row.description||"Без описания"}</span><small>${row.driver_email||"Водитель"} · ${item.when?new Date(item.when).toLocaleString("ru-RU"):"—"} · ${km(row.mileage)}</small></div><div class="service-archive-actions"><button type="button" class="btn primary" data-restore-request="${row.id}">Вернуть в работу</button></div></article>`
  }
  const row=item.row,localCar=car(row.carId),carName=localCar?`${model(localCar).brand} ${model(localCar).model} · ${localCar.plate}`:(row.carId||"Автомобиль");
  return `<article class="workspace-request-row service-archive-request internal"><div><div class="service-inbox-request-heading"><strong>${row.title||"Сервисная работа"} · ${carName}</strong><span class="service-inbox-request-badge ${row.status==="done"?"accepted":"rejected"}">Сервис</span></div><span>${row.note||row.service||"Внутренняя заявка сервиса"}</span><small>${row.mechanic||"Сервисмен"} · ${item.when?date(item.when):"—"} · ${repairStatusText(row.status)} · ${money(row.actual||row.planned||0)}</small></div><div class="service-archive-actions"><button type="button" class="btn" onclick="openSmartEntity('repair','${row.id}','${row.carId}')">Открыть</button></div></article>`
 }).join("")||'<div class="driver-empty-state service-inbox-empty">Архив заявок пуст.</div>';
 $$("[data-service-archive-filter]").forEach(button=>{button.classList.toggle("active",button.dataset.serviceArchiveFilter===serviceArchiveFilter);button.onclick=()=>{serviceArchiveFilter=button.dataset.serviceArchiveFilter;renderServiceRequestArchive()}});
 $$("[data-restore-request]").forEach(button=>button.onclick=async()=>{const requestId=button.dataset.restoreRequest,request=workspaceRepairAlerts.find(row=>String(row.id)===String(requestId));button.disabled=true;const oldText=button.textContent;button.textContent="Возвращаю…";try{await window.FleetPilotCloud.updateDriverRepairRequest(requestId,"accepted","Возвращено из архива");if(request)request.status="accepted";toast("Заявка возвращена в работу");renderServiceRequestArchive();renderFleetDriverRequestsPanel();await renderWorkspaceRepairRequests()}catch(error){toast(error.message||"Не удалось вернуть заявку")}finally{button.disabled=false;button.textContent=oldText}})
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
  const [rows]=await Promise.all([window.FleetPilotCloud.getDriverAssignments(),loadWorkspaceDriverDirectory()]);
  workspaceDriverAssignmentRows=rows||[];
  // V19.0.2: vehicle profile is the ONLY current-link source of truth.
  // Cloud assignment rows are retained only as backend context and must never resurrect a returned/unlinked driver.
  workspaceDriverAssignments=Object.fromEntries(fleetCars().filter(c=>c.driverUserId).map(c=>[String(c.driverUserId),String(c.id)]));
 }catch(error){console.warn("Driver assignments",error);workspaceDriverAssignments={};workspaceDriverAssignmentRows=[]}
}

function driverAssignmentControl(member){
 if(member.role!=="driver")return"";
 const selected=workspaceDriverAssignments[member.user_id]||fleetCars().find(c=>String(c.driverUserId||"")===String(member.user_id||""))?.id||"";
 return `<select data-driver-assignment="${member.user_id}">
  <option value="">Без автомобиля</option>
  ${fleetCars().map(c=>`<option value="${c.id}" ${c.id===selected?"selected":""}>${model(c).brand} ${model(c).model} · ${c.plate}</option>`).join("")}
 </select>`
}



/* V18.4 — bridge the existing Add/Edit car form into the same assignment API. */
(function installUnifiedCarAssignmentBridge(){
 function install(){
  const form=$("#carForm");if(!form||form.dataset.driverAssignmentBridge==="1")return;
  form.dataset.driverAssignmentBridge="1";
  form.addEventListener("submit",()=>{
   const carIdBefore=String($("#carId")?.value||"");
   const carBefore=carIdBefore?car(carIdBefore):null;
   const snapshot={
    carId:carIdBefore,
    plate:String($("#carPlate")?.value||"").trim(),
    driverUserId:String($("#carDriverUserId")?.value||"").trim(),
    manualName:String($("#carDriverManualName")?.value||$("#carTenant")?.value||"").trim(),
    email:String($("#carDriverEmail")?.value||"").trim(),
    phone:String($("#carDriverPhone")?.value||"").trim(),
    previousDriverUserId:String(carBefore?.driverUserId||""),
    previousManualName:String((!carBefore?.driverUserId&&(carBefore?.driverName||carBefore?.tenant))||"").trim(),
    previousAcceptedAt:String(carBefore?.driverAcceptedAt||""),
    previousAcceptedRevision:String(carBefore?.driverAcceptedRevision||""),
    previousAssignmentRevision:String(carBefore?.driverAssignmentRevision||"")
   };
   // Run after the original car save handler creates/updates the vehicle.
   setTimeout(async()=>{
    const target=(snapshot.carId&&car(snapshot.carId))||fleetCars().find(c=>String(c.plate||"").trim()===snapshot.plate);
    if(!target)return;
    try{
     const assignmentUnchanged=Boolean(snapshot.driverUserId)&&snapshot.driverUserId===snapshot.previousDriverUserId;
     const manualUnchanged=!snapshot.driverUserId&&!snapshot.previousDriverUserId&&snapshot.manualName===snapshot.previousManualName;
     if(snapshot.driverUserId){
      if(assignmentUnchanged){
       // Editing plate, mileage, status, rent, documents, etc. is NOT a reassignment.
       // Preserve the driver's already completed acceptance cycle verbatim.
       target.driverAcceptedAt=snapshot.previousAcceptedAt||target.driverAcceptedAt||"";
       target.driverAcceptedRevision=snapshot.previousAcceptedRevision||target.driverAcceptedRevision||"";
       target.driverAssignmentRevision=snapshot.previousAssignmentRevision||target.driverAssignmentRevision||"";
       save?.();renderFleet?.();renderDriversRegistry?.();
      }else{
       await assignVehicleDriverUnified(snapshot.driverUserId,target.id,{name:snapshot.manualName,email:snapshot.email,phone:snapshot.phone});
       toast("Водитель назначен · ожидаем подтверждения")
      }
     }else if(snapshot.manualName){
      if(!manualUnchanged||target.driverUserId){
       // Manual driver has no acceptance flow/account.
       target.driverUserId="";target.driverName=snapshot.manualName;target.driverEmail=snapshot.email;target.driverPhone=snapshot.phone;
       target.driverAssignmentSource="manual";target.driverAcceptedAt="";target.driverAcceptedRevision="";target.tenant=snapshot.manualName;save?.();renderFleet?.();renderDriversRegistry?.();
      }
     }else if(snapshot.previousDriverUserId){
      await unassignVehicleDriverUnified(snapshot.previousDriverUserId,target.id)
     }
    }catch(error){toast(error.message||String(error))}
   },180)
  },true)
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
 setTimeout(install,700)
})();


/* =========================================================
   V18.5 — Car dialog always uses the shared Driver Picker
   ========================================================= */
(function installCarDriverPickerLifecycle(){
 const boot=()=>{
  const dialog=$("#carDialog");
  if(!dialog||dialog.dataset.driverPickerLifecycle==="1")return;
  dialog.dataset.driverPickerLifecycle="1";
  const refresh=async()=>{
   if(!dialog.open)return;
   const id=String($("#carId")?.value||"");
   try{await prepareCarDriverPicker(id?car(id):null)}catch(error){console.warn("Driver picker",error)}
  };
  new MutationObserver(()=>{if(dialog.open)setTimeout(refresh,0)}).observe(dialog,{attributes:true,attributeFilter:["open"]});
  dialog.addEventListener("click",event=>{
   if(event.target?.id==="carTenant"&&!$("#carDriverPickerPanel"))refresh();
  });
  if(dialog.open)refresh();
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
 setTimeout(boot,500);
})();


/* =========================================================
   V18.7 — Driver handover validation + photo state fix
   ========================================================= */
function handoverCurrentMileage(){
 const input=$("#vehicleHandoverMileage");
 const raw=String(input?.value??"").replace(/\s+/g,"").replace(",",".");
 const n=Number(raw);return Number.isFinite(n)?Math.max(0,Math.round(n)):0
}
function handoverRequirementsState(){
 const type=$("#vehicleHandoverType")?.value||"issue";
 const mileage=handoverCurrentMileage();
 const confirm=Boolean($("#vehicleHandoverConfirm")?.checked);
 const photos=Array.isArray(vehicleHandoverPhotoData)?vehicleHandoverPhotoData:[];
 const assigned=driverAssignedCar();
 const minimum=Number(assigned?.mileage||driverPortalContext?.mileage||0);
 return{type,mileage,confirm,photos,minimum,valid:mileage>=minimum&&photos.length>0&&confirm}
}
function syncHandoverValidationUI(){
 const state=handoverRequirementsState();
 const button=$("#vehicleHandoverSubmit");
 if(button){button.disabled=!state.valid;button.classList.toggle("disabled",!state.valid)}
 if(!state.valid){
  if(state.mileage<state.minimum)handoverMessage(`Пробег не может быть меньше ${state.minimum.toLocaleString("ru-RU")} км. Добавьте фото и подтвердите состояние автомобиля.`,"error");
  else if(!state.photos.length)handoverMessage("Добавьте минимум одну фотографию автомобиля, затем подтвердите приём.","error");
  else if(!state.confirm)handoverMessage("Отметьте подтверждение состояния автомобиля.","error");
 }else handoverMessage("");
 return state
}
async function handleHandoverPhotosChange(event){
 const files=Array.from(event?.target?.files||[]).slice(0,8);
 if(!files.length){vehicleHandoverPhotoData=[];renderHandoverPhotoPreview();syncHandoverValidationUI();return}
 const output=[];
 handoverMessage("Обрабатываем фотографии…");
 try{
  for(const file of files)output.push(await compressHandoverImage(file));
  vehicleHandoverPhotoData=output;
  renderHandoverPhotoPreview();
  syncHandoverValidationUI();
 }catch(error){handoverMessage(error.message||String(error),"error")}
}
async function submitVehicleHandoverFromPortal(event){
 event?.preventDefault?.();event?.stopPropagation?.();
 const state=syncHandoverValidationUI();
 if(!state.valid)return false;
 const submit=$("#vehicleHandoverSubmit");
 if(submit?.dataset.busy==="1")return false;
 if(submit){submit.dataset.busy="1";submit.disabled=true;submit.textContent="Сохраняем…"}
 try{
  const equipment={};$$('[data-handover-equipment]').forEach(input=>equipment[input.dataset.handoverEquipment]=Boolean(input.checked));

  // V19.0.14 — sync return odometer BEFORE backend return detaches the driver.
  if(state.type==="return"){
   const current=Number(driverAssignedCar()?.mileage||driverPortalContext?.mileage||0);
   if(state.mileage<current)throw new Error(`Пробег возврата не может быть меньше текущего: ${current.toLocaleString("ru-RU")} км`);
   if(state.mileage>current&&window.FleetPilotCloud?.updateDriverMileage){
    await window.FleetPilotCloud.updateDriverMileage(state.mileage,"vehicle_return");
   }
  }

  const result=await window.FleetPilotCloud.submitVehicleHandover({
   type:state.type,mileage:state.mileage,fuelLevel:Number($("#vehicleHandoverFuel")?.value||0),
   equipment,photos:state.photos,notes:$("#vehicleHandoverNotes")?.value||""
  });
  const assigned=driverAssignedCar();
  if(assigned){
   if(state.mileage>=Number(assigned.mileage||0)){
    const previousMileage=Number(assigned.mileage||0);
    assigned.mileage=state.mileage;
    if(state.mileage>previousMileage){
     assigned.history=Array.isArray(assigned.history)?assigned.history:[];
     const returnDate=(typeof today==="function"?today():new Date().toISOString().slice(0,10));
     const last=assigned.history[assigned.history.length-1];
     if(!last||Number(last.value)!==state.mileage||last.date!==returnDate){
      assigned.history.push({date:returnDate,value:state.mileage,source:state.type==="return"?"vehicle_return":"vehicle_issue"});
     }
    }
   }
   if(state.type==="issue"){
    assigned.driverAcceptedAt=result?.accepted_at||result?.issue_at||new Date().toISOString();
    assigned.driverAcceptedRevision=assigned.driverAssignmentRevision||"";
    addVehicleHandoverAudit(assigned,"accepted",{
     key:`accepted:${assigned.driverAssignmentRevision||assigned.driverAcceptedAt}`,revision:assigned.driverAssignmentRevision||"",
     at:assigned.driverAcceptedAt,driverUserId:assigned.driverUserId,driverName:assigned.driverName,driverEmail:assigned.driverEmail,
     mileage:state.mileage,photos:state.photos,notes:$("#vehicleHandoverNotes")?.value||""
    });
   }
   if(state.type==="return"){
    const returnedDriver={userId:assigned.driverUserId,name:assigned.driverName||assigned.tenant,email:assigned.driverEmail,revision:assigned.driverAssignmentRevision};
    addVehicleHandoverAudit(assigned,"returned",{
     key:`returned:${assigned.driverAssignmentRevision||Date.now()}`,revision:assigned.driverAssignmentRevision||"",
     driverUserId:returnedDriver.userId,driverName:returnedDriver.name,driverEmail:returnedDriver.email,
     mileage:state.mileage,photos:state.photos,notes:$("#vehicleHandoverNotes")?.value||""
    });
    // Successful return must atomically remove the CURRENT relationship from the vehicle profile.
    assigned.driverUserId="";assigned.driverEmail="";assigned.driverName="";assigned.driverPhone="";
    assigned.driverAcceptedAt="";assigned.driverAcceptedRevision="";assigned.driverAssignedAt="";assigned.driverAssignmentRevision="";
    if(assigned.driverAssignmentSource==="account"||returnedDriver.userId){assigned.tenant="";assigned.driverAssignmentSource=""}
    if(returnedDriver.userId)delete workspaceDriverAssignments[String(returnedDriver.userId)];
    if(driverPortalContext)driverPortalContext={...driverPortalContext,car_id:null,vehicle_snapshot:null,status:"returned",return_at:result?.return_at||new Date().toISOString()};
   }
   save?.();
  }
  // The RPC may return a compact row, while get_driver_handover_state may lag by one
  // realtime tick. Verify against state/history before reopening the portal UI.
  driverHandoverState=result||null;
  if(state.type==="issue"){
   let verified=handoverRowIsIssued(result);
   let latest=result||null;
   for(let attempt=0;!verified&&attempt<4;attempt++){
    if(attempt)await new Promise(resolve=>setTimeout(resolve,250));
    try{
     latest=await window.FleetPilotCloud.getDriverHandoverState?.();
     if(handoverRowIsIssued(latest)){verified=true;break}
    }catch(error){console.warn("Handover verify state",error)}
   }
   if(!verified&&assigned?.id&&window.FleetPilotCloud.getVehicleHandoverHistory){
    try{
     const history=await window.FleetPilotCloud.getVehicleHandoverHistory(assigned.id);
     const active=[...(history||[])].reverse().find(row=>handoverRowIsIssued(row));
     if(active){latest={...(latest||{}),...active,status:"issued",car_id:assigned.id};verified=true}
    }catch(error){console.warn("Handover verify history",error)}
   }
   if(!verified)throw new Error("Приёмка отправлена, но сервер не подтвердил её сохранение. Обновите страницу и повторите попытку.");
   driverHandoverState=latest||result||{status:"issued",issue_at:new Date().toISOString(),issue_mileage:state.mileage,issue_photos:state.photos};
   if(driverPortalContext)driverPortalContext={...driverPortalContext,...driverHandoverState,status:"issued",accepted_at:driverHandoverState.accepted_at||driverHandoverState.issue_at||new Date().toISOString()};
  }else{
   driverHandoverState=result||{status:"returned",return_at:new Date().toISOString()};
  }
  $("#vehicleHandoverDialog")?.close();
  if(state.type==="issue")await loadDriverHandoverState?.();
  renderDriverVehicleCard?.();
  renderDriversRegistry?.();
  renderFleet?.();
  toast(state.type==="issue"?"Автомобиль принят":"Автомобиль возвращён");
  return true
 }catch(error){
  handoverMessage(error.message||String(error),"error");return false
 }finally{
  if(submit){submit.dataset.busy="0";submit.disabled=false;submit.textContent=state.type==="issue"?"Подтвердить приём":"Подтвердить возврат";syncHandoverValidationUI()}
 }
}
function installHandoverValidationFix(){
 const file=$("#vehicleHandoverPhotos"),form=$("#vehicleHandoverForm"),confirm=$("#vehicleHandoverConfirm"),mileage=$("#vehicleHandoverMileage");
 if(file&&!file.dataset.v187){file.dataset.v187="1";file.addEventListener("change",handleHandoverPhotosChange)}
 if(confirm&&!confirm.dataset.v187){confirm.dataset.v187="1";confirm.addEventListener("change",syncHandoverValidationUI)}
 if(mileage&&!mileage.dataset.v187){mileage.dataset.v187="1";mileage.addEventListener("input",syncHandoverValidationUI)}
 if(form&&!form.dataset.v187){form.dataset.v187="1";form.addEventListener("submit",submitVehicleHandoverFromPortal,true)}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",installHandoverValidationFix);else installHandoverValidationFix();
setTimeout(installHandoverValidationFix,500);

const _v187OpenVehicleHandover=openVehicleHandover;
openVehicleHandover=function(type){_v187OpenVehicleHandover(type);installHandoverValidationFix();setTimeout(syncHandoverValidationUI,0)};
window.openVehicleHandover=openVehicleHandover;
