/* FleetPilot critical consistency hotfixes — 2026-08-11 */
(()=>{
  'use strict';
  const $id=id=>document.getElementById(id);
  const asNumber=value=>Number.isFinite(Number(value))?Number(value):0;
  const same=(a,b)=>String(a??'')===String(b??'');

  const dedupeIds=new Set(['activitySearch','activityTypeFilter','activityPeriodFilter','fileViewerDialog']);
  const originalAdd=EventTarget.prototype.addEventListener;
  const listenerKeys=new WeakMap();
  EventTarget.prototype.addEventListener=function(type,listener,options){
    if(dedupeIds.has(this?.id)&&typeof listener==='function'){
      let keys=listenerKeys.get(this);if(!keys){keys=new Set();listenerKeys.set(this,keys)}
      const key=`${type}|${listener.toString()}`;
      if(keys.has(key))return;
      keys.add(key)
    }
    return originalAdd.call(this,type,listener,options)
  };

  let approvedMileageReduction=null;
  let approvedMileageTimer=0;
  const nativeConfirm=window.confirm.bind(window);
  window.confirm=function(message){
    const text=String(message||'');
    if(approvedMileageReduction&&text.startsWith('Пробег уменьшается с ')){
      approvedMileageReduction=null;
      clearTimeout(approvedMileageTimer);
      return true
    }
    return nativeConfirm(message)
  };
  const repairForm=$id('repairForm');
  if(repairForm){
    repairForm.addEventListener('submit',event=>{
      const status=$id('repairStatus')?.value;
      if(status!=='done')return;
      const carId=$id('repairCarId')?.value;
      const c=typeof car==='function'?car(carId):null;
      const entered=asNumber($id('repairMileage')?.value);
      const current=asNumber(c?.mileage);
      if(c&&entered<current){
        const ok=nativeConfirm(`Пробег уменьшается с ${typeof km==='function'?km(current):current} до ${typeof km==='function'?km(entered):entered}. Подтвердить исправление?`);
        if(!ok){event.preventDefault();event.stopImmediatePropagation();return}
        approvedMileageReduction={carId,entered,current};
        clearTimeout(approvedMileageTimer);
        approvedMileageTimer=setTimeout(()=>{approvedMileageReduction=null},10000)
      }
    },true)
  }

  if(typeof window.openRepairDialog==='function'){
    const originalOpenRepairDialog=window.openRepairDialog;
    window.openRepairDialog=function(carId='',id=''){
      const result=originalOpenRepairDialog.apply(this,arguments);
      if(id){
        const row=(db.repairs||[]).find(r=>same(r.id,id));
        const input=$id('repairMileage');
        if(row&&input&&Number.isFinite(Number(row.mileage)))input.value=Number(row.mileage)
      }
      return result
    }
  }

  window.createOrUpdateRepairFromExpense=function(expense){
    if(expense.category!=='repair'||!$id('expenseCreateRepair')?.checked)return null;
    let repair=expense.linkedRepairId?(db.repairs||[]).find(r=>same(r.id,expense.linkedRepairId)):null;
    if(!repair)repair=(db.repairs||[]).find(r=>same(r.linkedExpenseId,expense.id))||null;
    const inputMileage=asNumber($id('expenseRepairMileage')?.value);
    const mileage=Number.isFinite(inputMileage)&&inputMileage>=0?inputMileage:(typeof currentConfirmedMileage==='function'?currentConfirmedMileage(expense.carId):0);
    if(!repair){repair={id:uid(),linkedExpenseId:expense.id};db.repairs.push(repair)}
    const paymentStatus=$id('expensePaymentStatus')?.value||'unpaid';
    const repairStatus=$id('expenseRepairStatus')?.value||'done';
    const wasPaid=repair.paymentStatus==='paid';
    Object.assign(repair,{
      carId:expense.carId,title:expense.title,date:expense.date,mileage,
      planned:asNumber(expense.amount),
      actual:expense.status==='paid'?asNumber(expense.amount):asNumber(repair.actual),
      paidAmount:expense.status==='paid'?asNumber(expense.amount):asNumber(repair.paidAmount),
      paymentStatus,status:repairStatus,
      service:$id('expenseRepairService')?.value.trim()||'',note:expense.note,
      linkedExpenseId:expense.id,linkedRequestId:repair.linkedRequestId||'',
      completedDate:repairStatus==='done'?(repair.completedDate||expense.date||today()):'',
      warrantyUntil:repair.warrantyUntil||''
    });
    if(paymentStatus==='paid')repair.paidDate=wasPaid&&repair.paidDate?repair.paidDate:today();
    else repair.paidDate='';
    expense.linkedRepairId=repair.id;
    expense.financeSource=expense.financeSource||'expense';
    expense.serviceConvertedAt=expense.serviceConvertedAt||new Date().toISOString();
    if(expense.status==='paid'){
      expense.paidDate=repair.paidDate||today();
      expense.date=expense.paidDate
    }else expense.paidDate='';
    const c=typeof car==='function'?car(expense.carId):null;
    if(c&&repairStatus==='done'&&Number.isFinite(mileage)&&mileage>=0){
      c.mileage=mileage;c.mileageUpdatedAt=new Date().toISOString();c.mileageSource='service_done'
    }
    return repair
  };

  window.syncLinkedExpenseFromRepair=function(repair){
    const plannedAmount=Math.max(0,asNumber(repair.planned));
    const actualAmount=Math.max(0,asNumber(repair.actual));
    const completed=repair.status==='done';
    const excluded=['warranty','insurance'].includes(String(repair.paymentStatus||''));
    const amount=completed?(actualAmount||plannedAmount):plannedAmount;
    const shouldCreate=amount>0&&!excluded;
    let expense=repair.linkedExpenseId?(db.expenses||[]).find(x=>same(x.id,repair.linkedExpenseId)):null;
    if(!expense)expense=(db.expenses||[]).find(x=>same(x.linkedRepairId,repair.id))||null;
    if(!shouldCreate){
      if(expense&&expense.financeSource==='service'){
        db.expenses=db.expenses.filter(x=>!same(x.id,expense.id));repair.linkedExpenseId='';return null
      }
      return expense||null
    }
    if(!expense){expense={id:uid(),financeSource:'service'};db.expenses.push(expense)}
    const paid=repair.paymentStatus==='paid';
    if(paid&&!repair.paidDate)repair.paidDate=today();
    if(!paid)repair.paidDate='';
    const eventDate=paid?(repair.paidDate||today()):((completed?repair.completedDate:repair.date)||repair.date||today());
    Object.assign(expense,{
      carId:repair.carId,title:repair.title,category:'repair',date:eventDate,
      paidDate:paid?eventDate:'',amount,status:paid?'paid':'planned',
      note:repair.note||repair.problem||'',linkedRepairId:repair.id,financeSource:'service'
    });
    repair.linkedExpenseId=expense.id;
    return expense
  };

  window.syncServiceRelations=function(repair,previous=null){
    if(!repair)return;
    const becamePaid=repair.paymentStatus==='paid'&&previous?.paymentStatus!=='paid';
    if(repair.paymentStatus==='paid')repair.paidDate=repair.paidDate||previous?.paidDate||(becamePaid?today():today());
    else repair.paidDate='';
    window.syncLinkedExpenseFromRepair(repair);
    if(String(repair.status||'')!=='done')return;
    const c=typeof car==='function'?car(repair.carId):null,value=Number(repair.mileage);
    if(c&&Number.isFinite(value)&&value>=0){
      c.mileage=value;c.mileageUpdatedAt=new Date().toISOString();c.mileageSource='service_done'
    }
  };

  window.financialExpenseRows=function(bounds,carId=null){
    if(typeof normalizeRepairExpenseLinks==='function')normalizeRepairExpenseLinks();
    const paidExpenses=(db.expenses||[]).filter(x=>(!carId||same(x.carId,carId))&&x.status==='paid'&&inPeriod(x.paidDate||x.date,bounds));
    const linkedRepairIds=new Set(paidExpenses.map(x=>x.linkedRepairId).filter(Boolean).map(String));
    const legacyRepairs=(db.repairs||[]).filter(r=>(!carId||same(r.carId,carId))&&r.status!=='cancelled'&&r.paymentStatus==='paid'&&!linkedRepairIds.has(String(r.id))&&!r.linkedExpenseId&&inPeriod(r.paidDate||r.completedDate||r.date,bounds));
    return{paidExpenses,legacyRepairs}
  };

  window.advanceServiceRepair=function(id){
    const repair=(db.repairs||[]).find(r=>same(r.id,id));if(!repair)return toast('Задача не найдена');
    const previous=structuredClone(repair),next=serviceNextStatus(repair.status);if(!next)return editRepair(repair.id);
    if(next==='done'&&asNumber(repair.actual)<=0&&repair.paymentStatus!=='warranty'){
      editRepair(repair.id);setTimeout(()=>toast('Для завершения укажите фактическую сумму или гарантию'),80);return
    }
    repair.status=next;if(next==='done')repair.completedDate=repair.completedDate||today();
    window.syncServiceRelations(repair,previous);
    if(typeof logActivity==='function')logActivity('Изменён статус ремонта','Сервис',`${repair.title} → ${repairStatusText(next)}`,repair.carId);
    if(typeof syncCarServiceStatus==='function')syncCarServiceStatus(repair.carId);
    save();renderRepairs();renderExpenses();renderFleet();
    if(typeof selectedCarId!=='undefined'&&same(selectedCarId,repair.carId)&&$id('carPage')?.classList.contains('active'))renderCarProfile(repair.carId,'service');
    toast(repairStatusText(next))
  };

  window.deleteDocument=async function(id){
    if(typeof requireEnterprisePermission==='function'&&!requireEnterprisePermission('documents.delete'))return;
    if(!nativeConfirm('Переместить документ в архив? Он перестанет участвовать в сроках и уведомлениях. Уже оплаченные расходы останутся в финансовой истории.'))return;
    const d=(db.documents||[]).find(x=>same(x.id,id));if(!d)return;
    const linkedIds=new Set((d.installments||[]).map(x=>x.linkedExpenseId).filter(Boolean).map(String));
    db.expenses=(db.expenses||[]).filter(x=>!linkedIds.has(String(x.id))||x.status==='paid');
    const c=typeof car==='function'?car(d.carId):null;
    if(c?.insuranceDocumentId===id){c.insurance='';c.insuranceDocumentId=''}
    if(c?.inspectionDocumentId===id){c.inspection='';c.inspectionDocumentId=''}
    db.deletedDocumentsArchive=Array.isArray(db.deletedDocumentsArchive)?db.deletedDocumentsArchive:[];
    db.deletedDocumentsArchive=db.deletedDocumentsArchive.filter(x=>!same(x.id,id));
    db.deletedDocumentsArchive.unshift({...structuredClone(d),deletedAt:new Date().toISOString(),deletedBy:window.FleetPilotCloud?.profile?.email||'Администратор'});
    db.documents=db.documents.filter(x=>!same(x.id,id));
    if(typeof logActivity==='function')logActivity('Документ перемещён в архив','Документы',d.title||'');
    save();renderDocuments();renderDocumentArchive?.();renderExpenses();renderFleet();renderProfitability?.()
  };

  window.allEvents=function(){
    const result=[];
    const carLabel=carId=>{const c=typeof car==='function'?car(carId):null;if(!c)return null;const m=model(c);return{c,label:`${m.brand} ${m.model} · ${c.plate}`}};
    for(const c of cityFilteredCars()){
      const m=model(c),label=`${m.brand} ${m.model} · ${c.plate}`;
      if(c.insurance){const doc=(db.documents||[]).find(x=>same(x.carId,c.id)&&x.type==='insurance');result.push({date:c.insurance,carId:c.id,entityId:doc?.id||'',title:'Окончание страховки',type:'insurance',car:label})}
      if(c.inspection){const doc=(db.documents||[]).find(x=>same(x.carId,c.id)&&x.type==='inspection');result.push({date:c.inspection,carId:c.id,entityId:doc?.id||'',title:'Техосмотр',type:'inspection',car:label})}
    }
    for(const r of (db.repairs||[]).filter(x=>!['done','cancelled'].includes(String(x.status||'')))){const meta=carLabel(r.carId);if(meta)result.push({date:r.date,carId:r.carId,entityId:r.id,title:r.title,type:'repair',car:meta.label})}
    for(const x of (db.expenses||[]).filter(x=>x.status==='planned')){
      const meta=carLabel(x.carId);if(!meta)continue;
      const linked=x.linkedRepairId?(db.repairs||[]).find(r=>same(r.id,x.linkedRepairId)):null;
      if(linked&&!['done','cancelled'].includes(String(linked.status||'')))continue;
      result.push({date:x.date,carId:x.carId,entityId:x.id,title:x.title,type:'expense',car:meta.label,amount:x.amount})
    }
    for(const d of (db.documents||[])){
      const meta=carLabel(d.carId);if(!meta)continue;
      for(const i of d.installments||[])if(!i.paid)result.push({date:i.due,carId:d.carId,entityId:d.id,title:`${d.title}: рата ${i.number}`,type:'installment',car:meta.label,amount:i.amount});
      if(d.expiry)result.push({date:d.expiry,carId:d.carId,entityId:d.id,title:`Документ: ${d.title}`,type:d.type||'document',car:meta.label})
    }
    return result.filter(x=>x.date).map(x=>({...x,days:days(x.date)}))
  };

  if(typeof window.renderAnalytics==='function'){
    const originalRenderAnalytics=window.renderAnalytics;
    window.renderAnalytics=function(){
      const result=originalRenderAnalytics.apply(this,arguments);
      try{
        const period=typeof analyticsSelectedPeriod==='function'?analyticsSelectedPeriod():($id('profitPeriod')?.value||'month');
        const bounds=periodBounds(period);
        const rows=window.financialExpenseRows(bounds,null);
        const repairCandidates=[
          ...rows.paidExpenses.filter(x=>x.category==='repair').map(x=>({title:x.title||'Ремонт',carId:x.carId,amount:asNumber(x.amount)})),
          ...rows.legacyRepairs.map(r=>({title:r.title||'Ремонт',carId:r.carId,amount:asNumber(r.actual||r.planned)}))
        ].sort((a,b)=>b.amount-a.amount);
        const largestRepair=repairCandidates[0],repairBox=$id('largestRepair');
        if(repairBox)repairBox.innerHTML=largestRepair?`<strong class="big-stat">${largestRepair.title}</strong><p>${car(largestRepair.carId)?.plate||'—'} · ${money(largestRepair.amount)}</p>`:'Нет данных';
        const insurance=(rows.paidExpenses||[]).filter(x=>x.category==='insurance').sort((a,b)=>asNumber(b.amount)-asNumber(a.amount))[0];
        const insuranceBox=$id('largestInsurance');
        if(insuranceBox)insuranceBox.innerHTML=insurance?`<strong class="big-stat">${insurance.title||'Страховка'}</strong><p>${car(insurance.carId)?.plate||'—'} · ${money(insurance.amount)}</p>`:'Нет данных'
      }catch(error){console.warn('Analytics consistency hotfix',error)}
      return result
    }
  }

  console.info('FleetPilot critical consistency hotfix active');
})();
