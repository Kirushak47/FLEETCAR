/* =========================================================
   FleetPilot V15.6 — Actions & Documents
   Deposits, CRUD actions, document dialogs/files, form handlers and data actions.
   Source order: original app.js lines 6892-7410
   ========================================================= */
function openDepositDialog(carId="",id=""){if(!requireFleetCar())return;const row=id?(db.deposits||[]).find(x=>x.id===id):null,c=car(row?.carId||carId||fleetCars()[0]?.id);$("#depositId").value=row?.id||"";$("#depositCarId").innerHTML=opts(row?.carId||carId||c?.id);$("#depositTenant").value=row?.tenant||c?.tenant||"";$("#depositAmount").value=row?.amount||"";$("#depositDate").value=row?.date||today();$("#depositNote").value=row?.note||"";$("#depositDialog").showModal()}
function deleteDeposit(id){if(!confirm("Удалить этот платёж кауции?"))return;const row=db.deposits.find(x=>x.id===id);db.deposits=db.deposits.filter(x=>x.id!==id);logActivity("Удалён платёж кауции","Кауция",row?money(row.amount):"",row?.carId);save();if(selectedCarId)openCar(selectedCarId,"finance")}
window.openDamageDialog=openDamageDialog;window.editDamage=editDamage;window.deleteDamage=deleteDamage;window.openDamageViewer=openDamageViewer;window.removePendingDamagePhoto=removePendingDamagePhoto;window.toggleInsuranceInstallment=toggleInsuranceInstallment;window.openDocumentAttachment=openDocumentAttachment;window.downloadDocumentAttachment=downloadDocumentAttachment;window.restoreBackupById=restoreBackupById;window.openQuickService=openQuickService;window.toggleFavorite=toggleFavorite;window.toggleArchive=toggleArchive;window.openCarQuickMenu=openCarQuickMenu;window.openCar=openCar;window.openDepositDialog=openDepositDialog;window.deleteDeposit=deleteDeposit;window.openMileage=openMileage;window.openCarDialog=openCarDialog;window.openRepairDialog=openRepairDialog;window.openPaymentDialog=openPaymentDialog;window.openExpenseDialog=openExpenseDialog;window.openDocumentDialog=openDocumentDialog;
window.editRepair=id=>openRepairDialog("",id);window.editPayment=id=>openPaymentDialog("",id);window.editExpense=id=>openExpenseDialog("",id);window.editDocument=id=>openDocumentDialog("",id);
window.deleteRepair=id=>{if(!requireEnterprisePermission("service.edit"))return;
 const repair=db.repairs.find(x=>x.id===id);if(!repair)return;
 const expense=repair.linkedExpenseId?db.expenses.find(x=>x.id===repair.linkedExpenseId):db.expenses.find(x=>x.linkedRepairId===id);
 let removeExpense=false;
 if(expense){
  removeExpense=confirm(`Ремонт связан с расходом ${money(expense.amount)}.\n\nOK — удалить ремонт и расход.\nОтмена — удалить только техническую запись.`);
 }else if(!confirm("Удалить ремонт?"))return;
 if(expense&&!removeExpense){
  expense.linkedRepairId="";
  expense.financeSource="expense"
 }
 if(expense&&removeExpense)db.expenses=db.expenses.filter(x=>x.id!==expense.id);
 db.repairs=db.repairs.filter(x=>x.id!==id);
 recalculateVehicleMaintenance(repair.carId);syncCarServiceStatus(repair.carId);
 save();renderRepairs();renderExpenses();renderFleet();renderProfitability();
 toast(removeExpense?"Ремонт и расход удалены":"Техническая запись удалена")
};window.deletePayment=id=>{if(!requireEnterprisePermission("finance.payments"))return;if(confirm("Удалить оплату?")){db.payments=db.payments.filter(x=>x.id!==id);save();renderPayments()}};window.deleteExpense=id=>{if(!requireEnterprisePermission("finance.expenses"))return;if(confirm("Удалить плановый расход?")){const old=db.expenses.find(x=>x.id===id);db.expenses=db.expenses.filter(x=>x.id!==id);save();renderExpenses();renderRepairs();if(old&&selectedCarId===old.carId&&$("#carPage")?.classList.contains("active"))openCar(old.carId,"service")}};window.deleteDocument=async id=>{if(!requireEnterprisePermission("documents.delete"))return;if(confirm("Удалить документ? Связанные автоматические расходы по его ратам тоже будут удалены.")){const d=db.documents.find(x=>x.id===id);if(d?.fileId)await deleteDocumentFile(d.fileId);const linkedIds=new Set((d?.installments||[]).map(x=>x.linkedExpenseId).filter(Boolean));db.expenses=db.expenses.filter(x=>!linkedIds.has(x.id));const c=car(d?.carId);if(c?.insuranceDocumentId===id){c.insurance="";c.insuranceDocumentId=""}if(c?.inspectionDocumentId===id){c.inspection="";c.inspectionDocumentId=""}db.documents=db.documents.filter(x=>x.id!==id);logActivity("Удалён документ","Документы",d?.title||"");save();renderDocuments();renderExpenses();renderFleet()}};window.deleteCar=id=>{if(!requireEnterprisePermission("cars.delete"))return;if(confirm("Удалить автомобиль и все связанные записи?")){db.cars=db.cars.filter(x=>x.id!==id);db.repairs=db.repairs.filter(x=>x.carId!==id);db.payments=db.payments.filter(x=>x.carId!==id);db.expenses=db.expenses.filter(x=>x.carId!==id);db.documents=db.documents.filter(x=>x.carId!==id);db.deposits=(db.deposits||[]).filter(x=>x.carId!==id);db.timeline=(db.timeline||[]).filter(x=>x.carId!==id);db.damages=(db.damages||[]).filter(x=>x.carId!==id);save();showPage("fleetPage");toast("Автомобиль и связанные данные удалены")}};
$("#carModelKey").onchange=toggleCustomModelFields;
$("#carForm").onsubmit=async e=>{
 e.preventDefault();

 const submitButton=$("#carSubmitButton");
 if(submitButton?.disabled)return;
 const originalText=submitButton?.textContent||"Сохранить";

 if(submitButton){
  submitButton.disabled=true;
  submitButton.textContent="Сохраняю…"
 }

 try{
  const existingId=$("#carId").value;
  const id=existingId||uid();
  const old=existingId?car(existingId):null;
  const modelValue=$("#carModelKey").value;
  const isCustom=modelValue==="__custom__";

  if(isCustom&&!$("#carCustomBrand").value.trim()){
   toast("Укажите марку автомобиля");
   $("#carCustomBrand")?.focus();
   return
  }
  if(isCustom&&!$("#carCustomModel").value.trim()){
   toast("Укажите модель автомобиля");
   $("#carCustomModel")?.focus();
   return
  }
  if(!$("#carPlate").value.trim()){
   toast("Укажите госномер автомобиля");
   $("#carPlate")?.focus();
   return
  }
  if(!$("#carCity").value.trim()){
   toast("Укажите город эксплуатации");
   $("#carCity")?.focus();
   return
  }

  const mileage=Number($("#carMileage").value||0);
  const lastOil=Number($("#carLastOil").value||0);
  const oilInterval=Number($("#carOilInterval").value||10000);

  if(mileage<0||lastOil<0||oilInterval<=0){
   toast("Проверьте пробег и интервал масла");
   return
  }

  const previousMileage=Number(old?.mileage||0);
  const typedDriver=$("#carTenant").value.trim();
  const selectedDriver=workspaceDriverMemberByEmail?.(typedDriver)||null;
  const selectedDriverUserId=$("#carDriverUserId")?.value||selectedDriver?.user_id||"";
  const previousDriverUserId=old?.driverUserId||"";

  if(selectedDriverUserId){
   const occupiedCarId=workspaceDriverAssignments?.[selectedDriverUserId];
   if(occupiedCarId&&String(occupiedCarId)!==String(id)){
    const occupied=car(occupiedCarId);
    const label=occupied?`${model(occupied).brand} ${model(occupied).model} · ${occupied.plate}`:"другой автомобиль";
    if(!confirm(`Этот водитель уже назначен на ${label}. Переназначить его на текущий автомобиль?`))return
   }
  }

  const obj={
   id,
   inFleet:true,
   favorite:old?.favorite||false,
   archived:old?.archived||false,
   modelKey:isCustom?"__custom__":modelValue,
   customBrand:isCustom?$("#carCustomBrand").value.trim():"",
   customModel:isCustom?$("#carCustomModel").value.trim():"",
   year:Number($("#carYear").value),
   plate:$("#carPlate").value.trim(),
   vin:$("#carVin").value.trim(),
   tenant:selectedDriver?(workspaceDriverName?.(selectedDriver)||workspaceDriverEmail?.(selectedDriver)||typedDriver):typedDriver,
   driverUserId:selectedDriverUserId,
   driverEmail:selectedDriver?workspaceDriverEmail?.(selectedDriver)||typedDriver:"",
   driverName:selectedDriver?workspaceDriverName?.(selectedDriver)||"":"",
   driverAssignmentSource:selectedDriverUserId?"account":(typedDriver?"manual":""),
   driverAcceptedAt:selectedDriverUserId===previousDriverUserId?(old?.driverAcceptedAt||""):"",
   status:$("#carStatus").value,
   mileage,
   oilInterval,
   lastOil,
   city:normalizedCity($("#carCity").value),
   weeklyRent:Number($("#carWeeklyRent").value||0),
   paymentTiming:$("#carPaymentTiming").value,
   depositTarget:Number($("#carDepositTarget").value||0),
   purchasePrice:Number($("#carPurchasePrice").value||0),
   purchaseDate:$("#carPurchaseDate").value,
   insurance:$("#carInsurance").value,
   inspection:$("#carInspection").value,
   tireSeason:$("#carTireSeason").value,
   tireSize:$("#carTireSize").value.trim(),
   tireInstalled:$("#carTireInstalled").value,
   tireMileage:Number($("#carTireMileage").value||0),
   customPhoto:pendingCarPhoto,
   history:old?.history||[{date:today(),value:mileage}]
  };

  if(old){
   Object.assign(old,obj)
  }else{
   db.cars.push(obj)
  }

  if(old&&mileage!==previousMileage){
   obj.history=obj.history||[];
   obj.history.push({date:today(),value:mileage})
  }

  const saved=save();
  if(saved===false){
   toast("Не удалось сохранить автомобиль");
   return
  }

  try{
   if(previousDriverUserId&&previousDriverUserId!==selectedDriverUserId){
    await window.FleetPilotCloud?.assignDriverVehicle?.(previousDriverUserId,null);
    delete workspaceDriverAssignments[previousDriverUserId]
   }
   if(selectedDriverUserId&&previousDriverUserId!==selectedDriverUserId){
    await window.FleetPilotCloud?.assignDriverVehicle?.(selectedDriverUserId,id);
    workspaceDriverAssignments[selectedDriverUserId]=id
   }
   await loadWorkspaceDriverAssignments?.();
  }catch(error){
   console.error("Driver assignment sync failed",error);
   toast(`Автомобиль сохранён, но назначение водителя не синхронизировано: ${error?.message||error}`)
  }
  save();

  $("#carDialog").close();
  renderFleet();
  renderRepairs();
  renderExpenses();

  if(selectedCarId===id&&$("#carPage")?.classList.contains("active")){
   openCar(id)
  }

  toast(old?"Изменения автомобиля сохранены":"Автомобиль добавлен")
 }catch(error){
  console.error("Car save failed",error);
  toast(error?.message||"Не удалось сохранить автомобиль")
 }finally{
  if(submitButton){
   submitButton.disabled=false;
   submitButton.textContent=originalText
  }
 }
};

$("#quickServiceForm").onsubmit=e=>{
 e.preventDefault();
 const carId=$("#quickServiceCarId").value,type=$("#quickServiceType").value,c=car(carId),cfg=quickServiceDefaults(type);
 if(!c||!cfg)return;
 const performed=$("#quickServiceDate").value||today(),cost=Number($("#quickServiceCost").value||0),provider=$("#quickServiceProvider").value.trim(),note=$("#quickServiceNote").value.trim();
 const details=[provider,note].filter(Boolean).join(" · ");
 if(type==="oil"){
  const mileage=Number($("#quickServiceMileage").value||c.mileage),interval=Number($("#quickServiceOilInterval").value||c.oilInterval||10000);
  if(mileage<c.mileage)return toast("Пробег при замене не может быть меньше текущего");
  if(interval<1000)return toast("Укажите корректный интервал замены");
  if(mileage>c.mileage){
   c.mileage=mileage;
   c.history=c.history||[];
   c.history.push({date:performed,value:mileage})
  }
  c.lastOil=mileage;
  c.oilInterval=interval;
  db.repairs.push({id:uid(),carId,title:"Замена масла",date:performed,mileage,planned:cost,actual:cost,status:"done",service:provider,note});
  addTimeline(carId,"repair","Замена масла",-cost,performed,details||`Следующая через ${km(interval)}`);
  logActivity("Выполнена замена масла","Сервис",`${km(mileage)} · ${money(cost)}`,carId);
  if($("#quickServiceAddExpense").checked)addQuickServiceExpense(carId,"Замена масла","repair",performed,cost,details);
 }else{
  const expiry=$("#quickServiceExpiry").value;
  if(!expiry)return toast("Укажите новую дату окончания");
  if(type==="insurance")c.insurance=expiry;
  else c.inspection=expiry;
  const title=type==="insurance"?"Страховка продлена":"Техосмотр обновлён";
  addTimeline(carId,"document",title,-cost,performed,`${date(expiry)}${details?` · ${details}`:""}`);
  logActivity(title,type==="insurance"?"Страховка":"Техосмотр",date(expiry),carId);
  if($("#quickServiceAddExpense").checked)addQuickServiceExpense(carId,cfg.expenseTitle,cfg.category,performed,cost,details);
 }
 save();
 $("#quickServiceDialog").close();
 if(selectedCarId===carId&&$("#carPage").classList.contains("active"))openCar(carId);
 else renderFleet();
 renderExpenses();
 serviceSuccessAnimation(carId,type,type==="oil"?"Масло заменено":type==="insurance"?"Страховка обновлена":"Техосмотр обновлён")
};

$("#mileageForm").onsubmit=e=>{e.preventDefault();const c=car($("#mileageCarId").value),v=Number($("#newMileage").value);if(v<c.mileage)return toast("Новый пробег меньше текущего");c.mileage=v;c.history.push({date:$("#mileageDate").value,value:v});addTimeline(c.id,"mileage","Обновлён пробег",0,$("#mileageDate").value,km(v));logActivity("Обновлён пробег","Автомобиль",`${km(v)}`,c.id);save();$("#mileageDialog").close();selectedCarId===c.id?openCar(c.id):renderFleet();toast("Пробег обновлён")};
$("#expenseCategory").onchange=syncExpenseRepairFields;
$("#expenseCarId").onchange=()=>{$("#expenseRepairMileage").value=currentConfirmedMileage($("#expenseCarId").value)};
$("#repairCarId").onchange=()=>{$("#repairMileage").value=currentConfirmedMileage($("#repairCarId").value);updateRepairCarMeta()};
$("#repairTitle")?.addEventListener("blur",()=>{const select=$("#repairServiceType");if(select&&select.value==="other")select.value=inferRepairServiceType({title:$("#repairTitle").value,problem:$("#repairProblem")?.value||"",note:$("#repairNote")?.value||""})});
$("#repairAddPart")?.addEventListener("click",()=>{repairEditorParts.push({name:"",qty:1,price:0});renderRepairPartsEditor()});
$("#repairAddChecklist")?.addEventListener("click",()=>{repairEditorChecklist.push({text:"",done:false});renderRepairChecklistEditor()});
$("#repairLaborCost")?.addEventListener("input",updateRepairCalculatedTotal);
$("#repairPhotosBeforeInput")?.addEventListener("change",e=>{addRepairPhotos("before",e.target.files);e.target.value=""});
$("#repairPhotosAfterInput")?.addEventListener("change",e=>{addRepairPhotos("after",e.target.files);e.target.value=""});
$("#repairForm").onsubmit=async e=>{
 e.preventDefault();

 const submitButton=$("#repairSubmitButton");
 if(submitButton?.disabled)return;
 const originalSubmitText=submitButton?.textContent||"Сохранить";
 if(submitButton){
  submitButton.disabled=true;
  submitButton.textContent="Сохраняю…"
 }

 try{
  const pageBeforeSave=$(".page.active")?.id||"repairsPage";
  const id=$("#repairId").value||uid();
  const old=db.repairs.find(x=>x.id===id);
  const carId=$("#repairCarId").value;
  const mileage=Number($("#repairMileage").value||0);
  const minimum=currentConfirmedMileage(carId);

  if(!carId){
   toast("Выберите автомобиль");
   return
  }
  if(!$("#repairTitle").value.trim()){
   toast("Укажите, что нужно сделать");
   $("#repairTitle")?.focus();
   return
  }
  if(!$("#repairDate").value){
   toast("Укажите дату");
   $("#repairDate")?.focus();
   return
  }
  if(mileage<minimum){
   toast(`Пробег не может быть меньше ${km(minimum)}`);
   $("#repairMileage")?.focus();
   return
  }

  const status=$("#repairStatus").value;
  const actual=Number($("#repairActual").value||0);
  const paymentStatus=$("#repairPaymentStatus").value;
  if(status==="done"&&actual<=0&&paymentStatus!=="warranty"){
   toast("Укажите фактическую сумму или выберите гарантию");
   return
  }

  const obj={
   id,carId,title:$("#repairTitle").value.trim(),serviceType:$("#repairServiceType")?.value||"other",date:$("#repairDate").value,
   mileage,planned:Number($("#repairPlanned").value||0),actual,status,
   service:$("#repairService").value.trim(),problem:$("#repairProblem")?.value.trim()||"",note:$("#repairNote").value.trim(),
   parts:structuredClone(repairEditorParts.filter(p=>String(p.name||"").trim()).map(p=>({name:String(p.name||"").trim(),qty:Math.max(1,Number(p.qty||1)),price:Number(p.price||0)}))),
   checklist:structuredClone(repairEditorChecklist.filter(x=>String(x.text||"").trim()).map(x=>({text:String(x.text||"").trim(),done:Boolean(x.done)}))),photosBefore:[...repairEditorPhotos.before],photosAfter:[...repairEditorPhotos.after],laborCost:Number($("#repairLaborCost")?.value||0),
   paymentStatus,paidAmount:Number($("#repairPaidAmount").value||0),
   completedDate:$("#repairCompletedDate").value||(status==="done"?today():""),
   mechanic:$("#repairMechanic")?.value.trim()||"",priority:$("#repairPriority")?.value||"planned",
   warrantyUntil:$("#repairWarrantyUntil").value,
   linkedRequestId:$("#repairLinkedRequestId").value,
   linkedExpenseId:$("#repairLinkedExpenseId").value
  };

  // Cloud mileage update must never freeze or block the local repair.
  let mileageCloudWarning="";
  try{
   const cloudUpdate=window.FleetPilotCloud?.updateStaffVehicleMileage
    ?window.FleetPilotCloud.updateStaffVehicleMileage(
      carId,mileage,
      obj.linkedRequestId?"driver_request_service":obj.title.toLowerCase().includes("масл")?"oil_service":"service"
     )
    :Promise.resolve();

   await Promise.race([
    cloudUpdate,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error("timeout")),4500))
   ])
  }catch(error){
   mileageCloudWarning="Пробег сохранён локально, облако обновится позже";
   console.warn("Vehicle mileage cloud update skipped",error)
  }

  const previous=old?structuredClone(old):null;
  const history=Array.isArray(old?.history)?[...old.history]:[];
  if(!old){obj.createdAt=new Date().toISOString()}
  else{for(const key of ["status","priority","mechanic","planned","actual"]){if(String(previous?.[key]??"")!==String(obj[key]??""))history.push({at:new Date().toISOString(),text:repairHistoryLabel(key,obj[key])})}if(previous?.title!==obj.title)history.push({at:new Date().toISOString(),text:"Изменено название задачи"});if(previous?.problem!==obj.problem)history.push({at:new Date().toISOString(),text:"Обновлено описание проблемы"});if(JSON.stringify(previous?.parts||[])!==JSON.stringify(obj.parts))history.push({at:new Date().toISOString(),text:"Обновлён список запчастей"});if(JSON.stringify(previous?.checklist||[])!==JSON.stringify(obj.checklist))history.push({at:new Date().toISOString(),text:"Обновлён чек-лист работ"})}
  obj.history=history.slice(-60);obj.updatedAt=new Date().toISOString();
  old?Object.assign(old,obj):db.repairs.push(obj);
  const c=car(carId);
  if(c&&mileage>Number(c.mileage||0))c.mileage=mileage;
  syncServiceRelations(obj,previous);
  if(!old)addTimeline(obj.carId,"repair",obj.title,-Number(obj.actual||obj.planned||0),obj.date,repairStatusText(obj.status));
  logActivity(old?"Изменён ремонт":"Добавлен ремонт","Сервис",obj.title,obj.carId);

  const saved=save();
  if(saved===false){
   toast("Не удалось сохранить ремонт");
   return
  }

  $("#repairDialog").close();
  renderRepairs();
  renderExpenses();
  renderFleet();

  // Driver notification is non-blocking.
  try{
   if(["planned","parts","service","repair","done"].includes(obj.status)){
    const notifyPromise=window.FleetPilotCloud?.notifyAssignedDriverService?.(obj);
    if(notifyPromise)Promise.resolve(notifyPromise).catch(error=>console.warn("Driver service notification",error))
   }
  }catch(error){
   console.warn("Driver service notification",error)
  }

  // Link request in cloud, but do not block UI.
  if(obj.linkedRequestId){
   try{
    const linkPromise=window.FleetPilotCloud?.linkDriverRequestRepair?.(
     obj.linkedRequestId,obj.id,status==="done"?"done":"repair",
     `Ремонт: ${obj.title} · пробег ${obj.mileage} км`
    );
    if(linkPromise){
     await Promise.race([
      linkPromise,
      new Promise((_,reject)=>setTimeout(()=>reject(new Error("timeout")),4500))
     ])
    }
   }catch(error){
    console.warn("Driver request cloud link delayed",error)
   }

   // Locally hide transferred request immediately, even if cloud is slow.
   const localRequest=(workspaceRepairAlerts||[]).find(row=>String(row.id)===String(obj.linkedRequestId));
   if(localRequest)localRequest.status=status==="done"?"done":"repair";
   renderFleetDriverRequestsPanel();
  }

  const destination=(pageBeforeSave==="repairsPage"||obj.linkedRequestId)?"repairsPage":pageBeforeSave;
  showPage(destination);

  if(destination==="repairsPage"){
   // Refresh cloud requests in background; do not block the saved repair.
   Promise.resolve(loadFleetServiceAlerts({rerender:true}))
    .then(()=>renderWorkspaceRepairRequests())
    .catch(error=>console.warn("Service request refresh delayed",error));

   setTimeout(()=>{
    const row=document.querySelector(`[data-repair-id="${CSS.escape(obj.id)}"]`);
    row?.scrollIntoView({behavior:"smooth",block:"center"});
    row?.classList.add("smart-entity-highlight");
    setTimeout(()=>row?.classList.remove("smart-entity-highlight"),2800)
   },120)
  }

  toast(
   obj.linkedRequestId
    ?(mileageCloudWarning?"Заявка передана в сервис. "+mileageCloudWarning:"Заявка передана в сервис")
    :(mileageCloudWarning?"Ремонт сохранён. "+mileageCloudWarning:"Ремонт и пробег сохранены")
  )
 }catch(error){
  console.error("Repair save failed",error);
  toast(error?.message||"Не удалось сохранить ремонт")
 }finally{
  if(submitButton){
   submitButton.disabled=false;
   submitButton.textContent=originalSubmitText
  }
 }
};

const repairSubmitButton=$("#repairSubmitButton");
if(repairSubmitButton){
 repairSubmitButton.addEventListener("click",event=>{
  const form=$("#repairForm");
  if(!form)return;
  // Native submit remains primary. This fallback only ensures browser validation is visible.
  if(!form.checkValidity()){
   event.preventDefault();
   form.reportValidity()
  }
 })
}

$("#depositForm").onsubmit=e=>{e.preventDefault();const id=$("#depositId").value||uid(),old=db.deposits.find(x=>x.id===id),obj={id,carId:$("#depositCarId").value,tenant:$("#depositTenant").value.trim(),amount:Number($("#depositAmount").value||0),date:$("#depositDate").value,note:$("#depositNote").value.trim()};old?Object.assign(old,obj):db.deposits.push(obj);addTimeline(obj.carId,"payment","Внесена кауция",obj.amount,obj.date,obj.note);logActivity(old?"Изменена кауция":"Добавлена кауция","Кауция",money(obj.amount),obj.carId);save();$("#depositDialog").close();if(selectedCarId===obj.carId)openCar(obj.carId,"finance");toast("Платёж кауции сохранён")};
$("#paymentForm").onsubmit=e=>{e.preventDefault();const duplicate=db.payments.find(p=>p.id!==$("#paymentId").value&&p.carId===$("#paymentCarId").value&&p.from===$("#paymentFrom").value&&p.to===$("#paymentTo").value);if(duplicate&&!confirm("За этот расчётный период уже есть запись. Всё равно сохранить?"))return;const id=$("#paymentId").value||uid(),old=db.payments.find(x=>x.id===id),from=$("#paymentFrom").value,obj={id,carId:$("#paymentCarId").value,tenant:$("#paymentTenant").value.trim(),timing:$("#paymentTiming").value,referenceWeek:$("#paymentReferenceWeek").value.trim(),from,to:$("#paymentTo").value,expected:Number($("#paymentExpected").value),received:Number($("#paymentReceived").value),date:$("#paymentDate").value,accrualMonth:$("#paymentAccrualMonth").value||monthFromDate(from),week:$("#paymentWeek").value.trim(),note:$("#paymentNote").value.trim()};old?Object.assign(old,obj):(db.payments.push(obj),addTimeline(obj.carId,"payment","Оплата аренды",Number(obj.received||0),obj.date||obj.to,`${date(obj.from)} — ${date(obj.to)}`));logActivity(old?"Изменена оплата":"Добавлена оплата","Аренда",`${money(obj.received)} · ${obj.accrualMonth}`,obj.carId);save();$("#paymentDialog").close();renderPayments();toast("Оплата сохранена")};
$("#expenseForm").onsubmit=e=>{e.preventDefault();const id=$("#expenseId").value||uid(),old=db.expenses.find(x=>x.id===id),category=$("#expenseCategory").value,isLinkedRepair=category==="repair"&&$("#expenseCreateRepair")?.checked,paymentState=$("#expensePaymentStatus")?.value||"unpaid",autoStatus=isLinkedRepair?(paymentState==="paid"?"paid":(["warranty","insurance"].includes(paymentState)?"cancelled":"planned")):$("#expenseStatus").value,obj={id,carId:$("#expenseCarId").value,title:$("#expenseTitle").value.trim(),category,date:$("#expenseDate").value,amount:Number($("#expenseAmount").value),status:autoStatus,note:$("#expenseNote").value.trim(),linkedRepairId:old?.linkedRepairId||""};old?Object.assign(old,obj):db.expenses.push(obj);const linked=createOrUpdateRepairFromExpense(obj);if(!old)addTimeline(obj.carId,"expense",obj.title,-Number(obj.amount||0),obj.date,expenseStatusText(obj.status));logActivity(old?"Изменён расход":"Добавлен расход","Расходы",`${obj.title} · ${money(obj.amount)}`,obj.carId);save();$("#expenseDialog").close();renderExpenses();renderRepairs();renderProfitability?.();renderFleet?.();renderDesktopCommandKpis?.();if(selectedCarId===obj.carId&&$("#carPage")?.classList.contains("active"))openCar(obj.carId,"service");toast(linked?(obj.status==="paid"?"Ремонт сохранён как фактический расход":"Расход и ремонт сохранены"):"Расход сохранён")};
$("#documentForm").onsubmit=async e=>{e.preventDefault();try{const id=$("#documentId").value||uid(),old=db.documents.find(x=>x.id===id),oldSnapshot=old?structuredClone(old):null,type=$("#documentType").value,paymentMode=type==="insurance"?$("#documentPaymentMode").value:"full",cost=Number($("#documentCost").value||0),installmentCount=Number($("#documentInstallmentCount").value||4),firstInstallment=$("#documentFirstInstallment").value||today(),installmentFrequency=$("#documentInstallmentFrequency").value,installments=paymentMode==="installments"?documentInstallmentDraft.map((x,i)=>({...x,number:i+1,amount:Number(x.amount||0)})):[],selectedFile=$("#documentAttachment").files?.[0],fileId=selectedFile?await saveDocumentFile(selectedFile,id,old?.fileId||""):old?.fileId||"",obj={id,carId:$("#documentCarId").value,type,title:$("#documentTitle").value.trim(),number:$("#documentNumber").value.trim(),expiry:$("#documentExpiry").value,cost,paymentMode,installmentCount,firstInstallment,installmentFrequency,installments,file:$("#documentFile").value.trim(),fileId,note:$("#documentNote").value.trim()};old?Object.assign(old,obj):db.documents.push(obj);syncVehicleDocumentDates(obj,oldSnapshot);for(const item of obj.installments||[])if(item.paid)syncInsuranceExpense(obj,item);if(!old)addTimeline(obj.carId,"document",obj.title,-Number(obj.cost||0),obj.expiry||today(),documentTypeText(obj.type));logActivity(old?"Изменён документ":"Добавлен документ","Документы",obj.title,obj.carId);save();$("#documentDialog").close();renderDocuments();renderExpenses();renderFleet();if(selectedCarId===obj.carId)openCar(obj.carId,"documents");toast(type==="insurance"?"Страховка и профиль автомобиля обновлены":type==="inspection"?"Техосмотр и профиль автомобиля обновлены":"Документ сохранён в профиле и общем реестре")}catch(error){toast(error.message||"Не удалось сохранить документ")}};
$("#insurancePaymentForm").onsubmit=e=>{e.preventDefault();const doc=db.documents.find(x=>x.id===$("#insurancePaymentDocumentId").value),item=doc?.installments?.find(x=>x.id===$("#insurancePaymentInstallmentId").value);if(!doc||!item)return toast("Рата не найдена");item.paid=$("#insurancePaymentPaid").checked;item.paidAmount=item.paid?Number($("#insurancePaidAmount").value||0):0;item.paidDate=item.paid?$("#insurancePaidDate").value:"";item.paymentNote=$("#insurancePaymentNote").value.trim();syncInsuranceExpense(doc,item);save();$("#insurancePaymentDialog").close();renderDocuments();renderExpenses();renderProfitability();renderFleet();if(selectedCarId===doc.carId)openCar(doc.carId,"documents");toast(item.paid?"Оплата добавлена в расходы":"Оплата и связанный расход отменены")};
$("#rebuildInsuranceInstallments").onclick=()=>rebuildInsuranceInstallmentDraft(false);
$("#documentInstallmentCount").onchange=()=>rebuildInsuranceInstallmentDraft(true);
$("#documentFirstInstallment").onchange=()=>rebuildInsuranceInstallmentDraft(true);
$("#documentInstallmentFrequency").onchange=()=>rebuildInsuranceInstallmentDraft(true);
$("#documentCost").oninput=renderInsuranceInstallmentWarning;
$$(".theme-switcher button").forEach(button=>button.onclick=()=>setTheme(button.dataset.themeMode));
$("#quickActionButton").onclick=()=>toggleQuickActions();
$("#quickActionMenu").onclick=e=>{const action=e.target.closest("[data-quick-action]")?.dataset.quickAction;
 if(action&&!simpleModeQuickActions().includes(action))return;if(!action)return;toggleQuickActions(false);if(action==="car")openCarDialog();if(action==="payment")openPaymentDialog();if(action==="repair")openRepairDialog();if(action==="expense")openExpenseDialog();if(action==="document")openDocumentDialog();if(action==="deposit")openDepositDialog()};
document.addEventListener("click",e=>{if(!e.target.closest("#quickActionButton")&&!e.target.closest("#quickActionMenu"))toggleQuickActions(false)});
$("#depositCarId").onchange=()=>{$("#depositTenant").value=car($("#depositCarId").value)?.tenant||""};$$(".bottom-nav button").forEach(b=>b.onclick=()=>showPage(b.dataset.page));$$("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).close());$("#headerAdd").onclick=()=>openCarDialog();$("#addRepair").onclick=()=>openRepairDialog();$("#addPayment").onclick=()=>openPaymentDialog();$("#addExpense").onclick=()=>openExpenseDialog();$("#addDocument").onclick=()=>openDocumentDialog();$("#backToFleet").onclick=()=>showPage("fleetPage");$("#fleetSearch").oninput=renderFleet;$("#fleetFilter").onchange=renderFleet;
$("#fleetCityFilter").onchange=e=>{selectedFleetCity=e.target.value;renderFleet()};$("#paymentCarId").onchange=()=>{const c=car($("#paymentCarId").value),timing=c?.paymentTiming||"advance",p=suggestedPaymentPeriod(timing);$("#paymentTiming").value=timing;$("#paymentFrom").value=p.from;$("#paymentTo").value=p.to;$("#paymentReferenceWeek").value=p.week;recalculateExpectedPayment()};$("#paymentTiming").onchange=()=>{const p=suggestedPaymentPeriod($("#paymentTiming").value);$("#paymentFrom").value=p.from;$("#paymentTo").value=p.to;$("#paymentReferenceWeek").value=p.week;recalculateExpectedPayment()};$("#paymentReferenceWeek").oninput=()=>{$("#paymentWeek").value=$("#paymentReferenceWeek").value;recalculateExpectedPayment()};
$("#paymentFrom").onchange=recalculateExpectedPayment;
$("#paymentTo").onchange=recalculateExpectedPayment;
$("#paymentAutoExpected").onchange=recalculateExpectedPayment;
$("#openAttention").onclick=()=>showPage("attentionPage");
$("#backFromAttention").onclick=()=>showPage("fleetPage");
const calendarTypeFilter=$("#calendarTypeFilter");if(calendarTypeFilter)calendarTypeFilter.onchange=renderCalendar;
$$("[data-calendar-view]").forEach(btn=>btn.onclick=()=>setCalendarView(btn.dataset.calendarView));
const calendarPrevPeriod=$("#calendarPrevPeriod");if(calendarPrevPeriod)calendarPrevPeriod.onclick=()=>moveCalendarPeriod(-1);
const calendarNextPeriod=$("#calendarNextPeriod");if(calendarNextPeriod)calendarNextPeriod.onclick=()=>moveCalendarPeriod(1);
const calendarTodayTop=$("#calendarTodayTop");if(calendarTodayTop)calendarTodayTop.onclick=()=>{calendarAnchorDate=today();calendarViewMonth=new Date();calendarViewMonth=new Date(calendarViewMonth.getFullYear(),calendarViewMonth.getMonth(),1);const input=$("#calendarSelectedDate");if(input)input.value=calendarViewMode==="day"?today():"";renderCalendar()};
const calendarSelectedDate=$("#calendarSelectedDate");if(calendarSelectedDate)calendarSelectedDate.onchange=()=>selectCalendarDay(calendarSelectedDate.value);
const calendarPrevMonth=$("#calendarPrevMonth");if(calendarPrevMonth)calendarPrevMonth.onclick=()=>moveCalendarMonth(-1);
const calendarNextMonth=$("#calendarNextMonth");if(calendarNextMonth)calendarNextMonth.onclick=()=>moveCalendarMonth(1);
const calendarToday=$("#calendarToday");if(calendarToday)calendarToday.onclick=()=>selectCalendarDay(today());
const calendarClearDay=$("#calendarClearDay");if(calendarClearDay)calendarClearDay.onclick=()=>selectCalendarDay("");
const paymentSearch=$("#paymentSearch");if(paymentSearch)paymentSearch.oninput=renderPayments;
const paymentStatusFilter=$("#paymentStatusFilter");if(paymentStatusFilter)paymentStatusFilter.onchange=renderPayments;
const expenseSearch=$("#expenseSearch");if(expenseSearch)expenseSearch.oninput=renderExpenses;
const expenseStatusFilter=$("#expenseStatusFilter");if(expenseStatusFilter)expenseStatusFilter.onchange=renderExpenses;
const expenseCategoryFilter=$("#expenseCategoryFilter");if(expenseCategoryFilter)expenseCategoryFilter.onchange=renderExpenses;$("#analyticsPeriod").onchange=renderAnalytics;$("#analyticsMonth").onchange=renderAnalytics;function syncInsuranceFields(){const show=$("#documentType").value==="insurance"&&$("#documentPaymentMode").value==="installments";$$(".insurance-installment-field").forEach(x=>x.style.display=show?"grid":"none");if(show&&!documentInstallmentDraft.length)rebuildInsuranceInstallmentDraft(false)}$("#documentType").onchange=syncInsuranceFields;$("#documentPaymentMode").onchange=syncInsuranceFields;
$("#profitPeriod").onchange=renderProfitability;
$("#taxMethod").onchange=syncTaxMethodFields;
$("#taxVat").onchange=syncTaxMethodFields;

$("#saveTaxSettings").onclick=()=>{
 const tax=taxSettings();
 tax.method=$("#taxMethod").value;
 if(tax.method==="none"){
  tax.vat="no";
  tax.monthlyContributions=0;
  tax.deductVatCosts=false;
 }else{
  tax.vat=$("#taxVat").value;
  tax.monthlyContributions=Number($("#taxMonthlyContributions").value||0);
  tax.deductVatCosts=$("#taxDeductVatCosts").checked;
 }
 tax.ryczaltRate=Number($("#taxRyczaltRate").value||0);
 save();renderProfitability();renderFleet();toast("Налоговый профиль сохранён")
};


$("#carPhotoFile").onchange=async e=>{
 const file=e.target.files?.[0];
 if(!file)return;
 try{
  pendingCarPhoto=await compressCarPhoto(file);
  renderCarPhotoPreview();
  toast("Фотография подготовлена")
 }catch(error){
  e.target.value="";
  toast(error.message||"Не удалось обработать фотографию")
 }
};
$("#removeCarPhoto").onclick=()=>{
 pendingCarPhoto="";
 $("#carPhotoFile").value="";
 renderCarPhotoPreview();
 toast("Фотография удалена")
};


$("#damagePhotoFile").onchange=async e=>{
 const files=[...(e.target.files||[])];if(!files.length)return;
 try{
  const compressed=[];for(const file of files)compressed.push(await compressCarPhoto(file));
  pendingDamagePhotos.push(...compressed);renderPendingDamagePhotos();toast(`${compressed.length} фото добавлено`)
 }catch(error){toast(error.message||"Не удалось обработать фото")}finally{e.target.value=""}
};
$("#damageForm").onsubmit=e=>{
 e.preventDefault();
 if(!pendingDamagePhotos.length&&!confirm("Сохранить повреждение без фотографий?"))return;
 const id=$("#damageId").value||uid(),old=db.damages.find(x=>x.id===id);
 const obj={id,carId:$("#damageCarId").value,title:$("#damageTitle").value.trim(),date:$("#damageDate").value,stage:$("#damageStage").value,location:$("#damageLocation").value,note:$("#damageNote").value.trim(),photos:[...pendingDamagePhotos]};
 old?Object.assign(old,obj):db.damages.push(obj);
 addTimeline(obj.carId,"damage",old?`Обновлено повреждение: ${obj.title}`:obj.title,0,obj.date,obj.note);
 save();$("#damageDialog").close();if(selectedCarId)openCar(selectedCarId);toast("Повреждение сохранено")
};
$("#closeDamageViewer").onclick=()=>$("#damageViewer").close();
$("#damagePrev").onclick=()=>moveDamageViewer(-1);$("#damageNext").onclick=()=>moveDamageViewer(1);
$("#damageViewerImage").ondblclick=()=>zoomDamageViewer(damageViewerState.scale>1?-2:1);
$("#damageViewer").onclick=e=>{if(e.target===$("#damageViewer"))$("#damageViewer").close()};
document.addEventListener("keydown",e=>{if(!$("#damageViewer").open)return;if(e.key==="ArrowLeft")moveDamageViewer(-1);if(e.key==="ArrowRight")moveDamageViewer(1);if(e.key==="Escape")$("#damageViewer").close();if(e.key==="+")zoomDamageViewer(.25);if(e.key==="-")zoomDamageViewer(-.25)});


async function renderCloudVersions(){
 const root=$("#cloudVersionsList");if(!root)return;
 root.innerHTML='<div class="driver-empty-state">Загрузка облачных версий…</div>';
 try{
  const versions=await window.FleetPilotCloud.getCloudFleetVersions();
  root.innerHTML=versions.map(version=>`
   <article class="cloud-version-row">
    <div>
     <strong>${new Date(version.created_at).toLocaleString("ru-RU")}</strong>
     <span>${version.cars_count} авто · ${version.records_count} записей</span>
     <small>${version.actor_email||"FleetPilot"} · ${version.device_name||"устройство не указано"}</small>
    </div>
    <button type="button" class="btn" data-cloud-version="${version.id}">Восстановить</button>
   </article>`).join("")||'<div class="driver-empty-state">Облачных версий пока нет.</div>';
  $$("[data-cloud-version]").forEach(button=>button.onclick=async()=>{
   if(!confirm("Восстановить выбранную облачную версию?"))return;
   await window.FleetPilotCloud.restoreCloudFleetVersion(button.dataset.cloudVersion)
  })
 }catch(error){root.innerHTML=`<div class="driver-empty-state">${error.message||error}</div>`}
}
$("#exportBackup").onclick=downloadBackup;
if($("#refreshCloudVersions"))$("#refreshCloudVersions").onclick=renderCloudVersions;
$("#importBackup").onchange=async e=>{
 const file=e.target.files?.[0];
 try{
  await importBackupFile(file)
 }catch(error){
  toast(error.message||"Не удалось импортировать файл")
 }finally{
  e.target.value=""
 }
};
$("#restoreAutoBackup").onclick=restoreLatestAutoBackup;
$("#eraseAllData").onclick=()=>{
 if(!confirm("Удалить все автомобили и записи на этом устройстве?"))return;
 if(!confirm("Это действие нельзя отменить без резервной копии. Продолжить?"))return;
 db=structuredClone(seed);
 save();
 showPage("fleetPage");
 toast("Все данные удалены")
};
fleetPilotRouteReady=true;


