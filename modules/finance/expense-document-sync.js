/* FleetPilot — insurance/inspection expense -> vehicle date sync */
(()=>{'use strict';
 const $=s=>document.querySelector(s);
 const same=(a,b)=>String(a??'')===String(b??'');
 const getDb=()=>{try{return typeof db!=='undefined'?db:window.db}catch{return window.db}};
 const todayIso=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);
 function ensureUi(){
  const form=$('#expenseForm');if(!form)return false;
  let box=$('#expenseDocumentFields');
  if(!box){
   box=document.createElement('div');box.id='expenseDocumentFields';box.className='expense-document-fields';box.hidden=true;
   box.innerHTML=`<div class="grid2"><label><span id="expenseDocumentValidUntilLabel">Действует до</span><input id="expenseDocumentValidUntil" type="date"></label><div class="expense-document-sync-note"><strong id="expenseDocumentSyncTitle">Срок документа</strong><small id="expenseDocumentSyncText">После оплаты дата обновится в автомобиле, календаре и уведомлениях.</small></div></div>`;
   const repair=$('#expenseRepairFields');
   if(repair)repair.before(box);else form.querySelector('.grid2')?.after(box)
  }
  return true
 }
 function currentCategory(){return String($('#expenseCategory')?.value||'')}
 function isDocumentCategory(v=currentCategory()){return v==='insurance'||v==='inspection'}
 function updateUi(){
  if(!ensureUi())return;
  const category=currentCategory(),box=$('#expenseDocumentFields');
  box.hidden=!isDocumentCategory(category);
  if(box.hidden)return;
  const insurance=category==='insurance';
  $('#expenseDocumentValidUntilLabel').textContent=insurance?'Страховка действует до':'Техосмотр действует до';
  $('#expenseDocumentSyncTitle').textContent=insurance?'Срок страховки':'Срок техосмотра';
  $('#expenseDocumentSyncText').textContent='Плановая дата выше — когда ожидается расход. После статуса «Оплачен» срок автоматически обновится в автомобиле, календаре и уведомлениях.';
 }
 function populateForExpense(id=''){
  updateUi();if(!isDocumentCategory())return;
  const d=getDb(),row=id?(d?.expenses||[]).find(x=>same(x.id,id)):null;
  const input=$('#expenseDocumentValidUntil');if(input)input.value=row?.documentValidUntil||row?.validUntil||''
 }
 function wrapOpen(){
  const current=window.openExpenseDialog;
  if(typeof current!=='function'||current.__fpDocumentDateSync)return false;
  const native=current;
  const wrapped=function(carId='',id=''){
   const result=native.apply(this,arguments);
   queueMicrotask(()=>populateForExpense(id));
   return result
  };
  wrapped.__fpDocumentDateSync=true;wrapped.__native=native;
  window.openExpenseDialog=wrapped;
  try{openExpenseDialog=wrapped}catch{}
  return true
 }
 function beforeSubmit(event){
  if(event.target?.id!=='expenseForm')return;
  ensureUi();
  const category=currentCategory();if(!isDocumentCategory(category))return;
  const idInput=$('#expenseId');if(idInput&&!idInput.value)idInput.value=typeof uid==='function'?uid():crypto.randomUUID();
  const validUntil=$('#expenseDocumentValidUntil')?.value||'';
  const financialStatus=$('#expenseStatus')?.value||'planned';
  if(financialStatus==='paid'&&!validUntil){
   event.preventDefault();event.stopImmediatePropagation();
   if(typeof toast==='function')toast(category==='insurance'?'Укажите, до какой даты действует страховка':'Укажите, до какой даты действует техосмотр');
   $('#expenseDocumentValidUntil')?.focus();return
  }
  const expenseId=idInput?.value||'';
  setTimeout(()=>{
   const d=getDb();if(!d)return;
   const row=(d.expenses||[]).find(x=>same(x.id,expenseId));if(!row)return;
   row.documentValidUntil=validUntil;
   row.documentType=category;
   const c=typeof car==='function'?car(row.carId):(d.cars||[]).find(x=>same(x.id,row.carId));
   if(row.status==='paid'&&validUntil&&c){
    if(category==='insurance'){c.insurance=validUntil;c.insuranceUpdatedAt=new Date().toISOString();c.insuranceSource='paid_expense'}
    else {c.inspection=validUntil;c.inspectionUpdatedAt=new Date().toISOString();c.inspectionSource='paid_expense'}
    if(typeof addTimeline==='function')addTimeline(row.carId,'document',category==='insurance'?'Страховка обновлена':'Техосмотр обновлён',0,row.date||todayIso(),`Действует до ${validUntil}`);
    if(typeof logActivity==='function')logActivity(category==='insurance'?'Обновлён срок страховки':'Обновлён срок техосмотра',category==='insurance'?'Страховка':'Техосмотр',validUntil,row.carId)
   }
   if(typeof save==='function')save();
   try{renderFleet?.()}catch{}try{renderExpenses?.()}catch{}try{renderDesktopCommandKpis?.()}catch{}
   try{if(typeof selectedCarId!=='undefined'&&same(selectedCarId,row.carId)&&$('#carPage')?.classList.contains('active'))openCar(row.carId)}catch{}
  },0)
 }
 function install(){
  ensureUi();updateUi();wrapOpen();
  const category=$('#expenseCategory');if(category&&!category.dataset.documentSync){category.dataset.documentSync='1';category.addEventListener('change',()=>{updateUi();const input=$('#expenseDocumentValidUntil');if(input)input.value=''})}
  const form=$('#expenseForm');if(form&&!form.dataset.documentSync){form.dataset.documentSync='1';form.addEventListener('submit',beforeSubmit,true)}
 }
 install();
 document.addEventListener('DOMContentLoaded',install,{once:true});
 window.addEventListener('fleetpilot:modules-ready',()=>setTimeout(install,0));
 window.addEventListener('fleetpilot:access-ready',()=>setTimeout(install,0));
 let tries=0;const timer=setInterval(()=>{tries++;install();if(tries>40)clearInterval(timer)},150);
 window.FleetPilot=window.FleetPilot||{};window.FleetPilot.ExpenseDocumentSync={install,updateUi};
})();