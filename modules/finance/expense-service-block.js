/* FleetPilot 20 — Expense -> Service linked block */
(()=>{
'use strict';
const FP=window.FleetPilot=window.FleetPilot||{},Core=FP.Core;
if(!Core||FP.ExpenseServiceBlock)return;
const $=id=>document.getElementById(id);
const same=(a,b)=>String(a??'')===String(b??'');
const validRepairStatuses=new Set(['planned','service','parts','repair','done','cancelled']);
const normalizeStatus=v=>validRepairStatuses.has(String(v||''))?String(v):'planned';
const db=()=>Core.db();
function linkedRepair(expense){const d=db();if(!d||!expense)return null;return expense.linkedRepairId?(d.repairs||[]).find(r=>same(r.id,expense.linkedRepairId))||null:(d.repairs||[]).find(r=>same(r.linkedExpenseId,expense.id))||null}
function syncVisibility(){const isRepair=$('expenseCategory')?.value==='repair',checked=Boolean($('expenseCreateRepair')?.checked),root=$('expenseRepairFields');if(root)root.hidden=!isRepair;const fields=root?.querySelector('.grid2');if(fields)fields.style.opacity=checked?'1':'.5';for(const el of fields?.querySelectorAll('input,select')||[])el.disabled=!checked;const financial=$('expenseStatus'),payment=$('expensePaymentStatus');if(financial){if(isRepair&&checked){const pay=payment?.value||'unpaid';financial.value=pay==='paid'?'paid':(['warranty','insurance'].includes(pay)?'cancelled':'planned');financial.disabled=true;financial.title='Финансовый статус определяется оплатой связанного ремонта'}else{financial.disabled=false;financial.title=''}}}
function open(carId='',id=''){
 if(typeof requireEnterprisePermission==='function'&&!requireEnterprisePermission('finance.expenses'))return;
 if(typeof requireFleetCar==='function'&&!requireFleetCar())return;
 const d=db();if(!d)return;
 const x=id?(d.expenses||[]).find(v=>same(v.id,id)):null;
 const selected=x?.carId||carId||(typeof fleetCars==='function'?fleetCars()[0]?.id:d.cars?.[0]?.id)||'';
 $('expenseId').value=x?.id||'';
 $('expenseCarId').innerHTML=typeof opts==='function'?opts(selected):'';
 $('expenseTitle').value=x?.title||'';
 $('expenseCategory').value=x?.category||'repair';
 $('expenseDate').value=x?.date||((typeof today==='function')?today():new Date().toISOString().slice(0,10));
 $('expenseAmount').value=x?.amount||'';
 $('expenseStatus').value=x?.status||'planned';
 $('expenseNote').value=x?.note||'';
 const repair=linkedRepair(x);
 $('expenseCreateRepair').checked=x?Boolean(repair||x.category==='repair'):true;
 const liveMileage=typeof currentConfirmedMileage==='function'?currentConfirmedMileage(selected):Number(Core.car(selected)?.mileage||0);
 $('expenseRepairMileage').value=repair?.mileage??liveMileage;
 $('expenseRepairService').value=repair?.service||'';
 // Important: a NEW planned expense creates a PLANNED service task. Never default to Done.
 $('expenseRepairStatus').value=normalizeStatus(repair?.status||'planned');
 $('expensePaymentStatus').value=repair?.paymentStatus||(x?.status==='paid'?'paid':'unpaid');
 syncVisibility();
 $('expenseDialog')?.showModal();
}
function install(){
 window.openExpenseDialog=open;
 window.syncExpenseRepairFields=syncVisibility;
 const category=$('expenseCategory'),checkbox=$('expenseCreateRepair'),payment=$('expensePaymentStatus'),repairStatus=$('expenseRepairStatus');
 if(category&&!category.dataset.fp20ExpenseBlock){category.dataset.fp20ExpenseBlock='1';category.addEventListener('change',()=>{if(category.value==='repair'&&repairStatus&&!repairStatus.value)repairStatus.value='planned';syncVisibility()})}
 if(checkbox&&!checkbox.dataset.fp20ExpenseBlock){checkbox.dataset.fp20ExpenseBlock='1';checkbox.addEventListener('change',syncVisibility)}
 if(payment&&!payment.dataset.fp20ExpenseBlock){payment.dataset.fp20ExpenseBlock='1';payment.addEventListener('change',syncVisibility)}
 if(repairStatus&&!repairStatus.dataset.fp20ExpenseBlock){repairStatus.dataset.fp20ExpenseBlock='1';repairStatus.addEventListener('change',()=>{repairStatus.value=normalizeStatus(repairStatus.value);repairStatus.dataset.userSelected=repairStatus.value})}
 return true;
}
FP.ExpenseServiceBlock=Object.freeze({open,syncVisibility,linkedRepair,install});
install();
window.addEventListener('fleetpilot:modules-ready',install);
console.info('FleetPilot 20 expense service block ready');
})();