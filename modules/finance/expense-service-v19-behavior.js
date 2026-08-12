/* FleetPilot modern UI + V19 expense/service behavior */
(()=>{
'use strict';
const $=s=>document.querySelector(s);
const same=(a,b)=>String(a??'')===String(b??'');
const getDb=()=>typeof db!=='undefined'?db:window.db;
function ensureEmptyStatus(){
 const select=$('#expenseRepairStatus');
 if(!select)return;
 if(!select.querySelector('option[value=""]')){
  const option=document.createElement('option');
  option.value='';option.textContent='Без статуса';
  select.prepend(option);
 }
}
function syncExpenseRepairFieldsV19(){
 ensureEmptyStatus();
 const root=$('#expenseRepairFields'),isRepair=$('#expenseCategory')?.value==='repair',checked=Boolean($('#expenseCreateRepair')?.checked);
 if(root)root.hidden=!isRepair;
 const grid=root?.querySelector('.grid2');
 if(grid){for(const el of grid.querySelectorAll('input,select'))el.disabled=!checked}
 // Finance status remains independent. Never auto-change it from service/payment status.
 const finance=$('#expenseStatus');if(finance){finance.disabled=false;finance.title=''}
}
function detachExisting(expense){
 const d=getDb();if(!d||!expense?.linkedRepairId)return;
 const repair=(d.repairs||[]).find(r=>same(r.id,expense.linkedRepairId));
 if(repair&&same(repair.linkedExpenseId,expense.id))repair.linkedExpenseId='';
 expense.linkedRepairId='';
}
function createOrUpdateRepairFromExpenseV19(expense){
 const d=getDb();if(!d||!expense)return null;
 const checked=Boolean($('#expenseCreateRepair')?.checked);
 const selectedStatus=String($('#expenseRepairStatus')?.value||'');
 if(expense.category!=='repair'||!checked||!selectedStatus){
  if(!checked)detachExisting(expense);
  return null;
 }
 let repair=expense.linkedRepairId?(d.repairs||[]).find(r=>same(r.id,expense.linkedRepairId)):null;
 if(!repair)repair=(d.repairs||[]).find(r=>same(r.linkedExpenseId,expense.id))||null;
 if(!repair){repair={id:typeof uid==='function'?uid():crypto.randomUUID(),linkedExpenseId:expense.id};d.repairs.push(repair)}
 const carRow=typeof car==='function'?car(expense.carId):(d.cars||[]).find(c=>same(c.id,expense.carId));
 const liveMileage=Number(carRow?.mileage||0),entered=Number($('#expenseRepairMileage')?.value||liveMileage);
 const mileage=Number.isFinite(entered)&&entered>=0?entered:liveMileage;
 const paymentStatus=$('#expensePaymentStatus')?.value||'unpaid';
 Object.assign(repair,{carId:expense.carId,title:expense.title,date:expense.date,mileage,planned:Number(expense.amount||0),actual:selectedStatus==='done'&&expense.status==='paid'?Number(expense.amount||0):Number(repair.actual||0),paidAmount:paymentStatus==='paid'?Number(expense.amount||0):Number(repair.paidAmount||0),paymentStatus,status:selectedStatus,service:$('#expenseRepairService')?.value.trim()||'',note:expense.note,linkedExpenseId:expense.id,linkedRequestId:repair.linkedRequestId||'',completedDate:selectedStatus==='done'?expense.date:'',warrantyUntil:repair.warrantyUntil||''});
 expense.linkedRepairId=repair.id;
 expense.financeSource=expense.financeSource||'expense';
 if(selectedStatus==='done'&&carRow&&Number.isFinite(mileage)&&mileage>=0){carRow.mileage=mileage;carRow.mileageSource='service_done';carRow.mileageUpdatedAt=new Date().toISOString()}
 return repair;
}
function openExpenseDialogV19(carId='',id=''){
 if(typeof requireEnterprisePermission==='function'&&!requireEnterprisePermission('finance.expenses'))return;
 if(typeof requireFleetCar==='function'&&!requireFleetCar())return;
 const d=getDb();if(!d)return;
 const x=id?(d.expenses||[]).find(v=>same(v.id,id)):null;
 const selected=x?.carId||carId||(typeof fleetCars==='function'?fleetCars()[0]?.id:d.cars?.[0]?.id)||'';
 $('#expenseId').value=x?.id||'';
 $('#expenseCarId').innerHTML=typeof opts==='function'?opts(selected):'';
 $('#expenseTitle').value=x?.title||'';
 $('#expenseCategory').value=x?.category||'repair';
 $('#expenseDate').value=x?.date||(typeof today==='function'?today():new Date().toISOString().slice(0,10));
 $('#expenseAmount').value=x?.amount||'';
 $('#expenseStatus').value=x?.status||'planned';
 $('#expenseNote').value=x?.note||'';
 const linked=x?.linkedRepairId?(d.repairs||[]).find(r=>same(r.id,x.linkedRepairId)):null;
 // New expense: checkbox OFF. Existing linked expense: checkbox ON.
 $('#expenseCreateRepair').checked=Boolean(linked);
 const c=typeof car==='function'?car(selected):(d.cars||[]).find(c=>same(c.id,selected));
 $('#expenseRepairMileage').value=linked?.mileage??Number(c?.mileage||0);
 $('#expenseRepairService').value=linked?.service||'';
 ensureEmptyStatus();
 $('#expenseRepairStatus').value=linked?.status||'';
 $('#expensePaymentStatus').value=linked?.paymentStatus||(x?.status==='paid'?'paid':'unpaid');
 syncExpenseRepairFieldsV19();
 $('#expenseDialog')?.showModal();
}
function install(){
 ensureEmptyStatus();
 window.syncExpenseRepairFields=syncExpenseRepairFieldsV19;
 window.createOrUpdateRepairFromExpense=createOrUpdateRepairFromExpenseV19;
 window.openExpenseDialog=openExpenseDialogV19;
 const ids=['expenseCreateRepair','expenseCategory','expensePaymentStatus'];
 for(const id of ids){const el=document.getElementById(id);if(el&&!el.dataset.v19Behavior){el.dataset.v19Behavior='1';el.addEventListener('change',syncExpenseRepairFieldsV19)}}
 syncExpenseRepairFieldsV19();
}
install();
window.addEventListener('fleetpilot:modules-ready',install);
console.info('FleetPilot V19 expense-service behavior active on modern build');
})();