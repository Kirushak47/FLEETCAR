/* FleetPilot 20 — Expense -> Service linked block
   Keep the proven legacy dialog lifecycle; patch only the linked service fields. */
(()=>{
'use strict';
const FP=window.FleetPilot=window.FleetPilot||{},Core=FP.Core;
if(!Core||FP.ExpenseServiceBlock)return;
const $=id=>document.getElementById(id);
const same=(a,b)=>String(a??'')===String(b??'');
const valid=new Set(['planned','service','parts','repair','done','cancelled']);
const normalize=v=>valid.has(String(v||''))?String(v):'planned';
const db=()=>Core.db();
let legacyOpen=null;
function linkedRepair(expense){const d=db();if(!d||!expense)return null;if(expense.linkedRepairId){const r=(d.repairs||[]).find(x=>same(x.id,expense.linkedRepairId));if(r)return r}return(d.repairs||[]).find(r=>same(r.linkedExpenseId,expense.id))||null}
function applyBlockState(expense=null){
 const category=$('expenseCategory'),check=$('expenseCreateRepair'),status=$('expenseRepairStatus'),payment=$('expensePaymentStatus'),financial=$('expenseStatus');
 if(!category||!check||!status||!payment)return;
 const isRepair=category.value==='repair',repair=linkedRepair(expense);
 const root=$('expenseRepairFields');if(root)root.hidden=!isRepair;
 // New repair expenses behave like before, except they start as PLANNED instead of DONE.
 if(!expense&&isRepair){check.checked=true;status.value='planned';payment.value='unpaid'}
 // Existing linked rows always show their actually stored service state.
 if(expense&&repair){check.checked=true;status.value=normalize(repair.status);payment.value=repair.paymentStatus||'unpaid'}
 status.disabled=!check.checked;
 const service=$('expenseRepairService'),mileage=$('expenseRepairMileage');
 if(service)service.disabled=!check.checked;if(mileage)mileage.disabled=!check.checked;if(payment)payment.disabled=!check.checked;
 if(financial&&isRepair&&check.checked){const pay=payment.value||'unpaid';financial.value=pay==='paid'?'paid':(['warranty','insurance'].includes(pay)?'cancelled':'planned');financial.disabled=true}else if(financial){financial.disabled=false}
}
function open(carId='',id=''){
 // Do NOT recreate the whole dialog here. The legacy opener owns all page/modal wiring.
 if(typeof legacyOpen!=='function')return;
 legacyOpen(carId,id);
 const d=db(),expense=id?(d?.expenses||[]).find(x=>same(x.id,id))||null:null;
 // Run after legacy fields are populated so our defaults are final.
 requestAnimationFrame(()=>applyBlockState(expense));
}
function install(){
 if(!legacyOpen&&typeof window.openExpenseDialog==='function'&&window.openExpenseDialog!==open)legacyOpen=window.openExpenseDialog;
 if(!legacyOpen)return false;
 window.openExpenseDialog=open;
 const ids=['expenseCategory','expenseCreateRepair','expensePaymentStatus'];
 for(const id of ids){const el=$(id);if(el&&!el.dataset.fp20ExpenseBlock){el.dataset.fp20ExpenseBlock='1';el.addEventListener('change',()=>{const d=db(),eid=$('expenseId')?.value||'',x=eid?(d?.expenses||[]).find(v=>same(v.id,eid))||null:null;applyBlockState(x)})}}
 const status=$('expenseRepairStatus');if(status&&!status.dataset.fp20ExpenseBlock){status.dataset.fp20ExpenseBlock='1';status.addEventListener('change',()=>{status.value=normalize(status.value)})}
 return true;
}
FP.ExpenseServiceBlock=Object.freeze({open,applyBlockState,linkedRepair,install});
install();window.addEventListener('fleetpilot:modules-ready',install);
console.info('FleetPilot 20 expense-service block ready');
})();