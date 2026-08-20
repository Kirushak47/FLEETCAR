/* FleetPilot vehicle report — keep original report layout, add only total expenses + Russian enum labels */
(()=>{'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 const money=v=>`${Number(v||0).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})} zł`;
 function state(){try{return typeof db!=='undefined'?db:(window.db||{})}catch{return window.db||{}}}
 function totals(carId){
  const d=state();
  const expenses=(d.expenses||[]).filter(x=>String(x.carId)===String(carId));
  const repairs=(d.repairs||[]).filter(x=>String(x.carId)===String(carId)&&String(x.status||'')!=='cancelled'&&Number(x.actual||x.planned||0)>0);
  const expenseTotal=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
  let extraRepairs=0;
  for(const r of repairs){
   const duplicate=expenses.some(e=>String(e.linkedRepairId||'')===String(r.id)&&String(e.linkedRepairId||''))||expenses.some(e=>String(r.linkedExpenseId||'')===String(e.id||'')&&String(r.linkedExpenseId||''));
   if(!duplicate)extraRepairs+=Number(r.actual||r.planned||0);
  }
  return {all:expenseTotal+extraRepairs}
 }
 function patchHtml(html,carId){
  if(!html)return html;
  const total=totals(carId).all;
  // Keep the native sections exactly as they were: "История ремонтов" and "Последние расходы".
  // Add one extra summary row only, without replacing the existing "Расходы" or "Ремонты" rows.
  if(!/<span>Все расходы<\/span>/i.test(html)){
   const repairRow=/(<div class="info"><span>Ремонты<\/span><strong>[\s\S]*?<\/strong><\/div>)/i;
   const expenseRow=/(<div class="info"><span>Расходы<\/span><strong>[\s\S]*?<\/strong><\/div>)/i;
   if(repairRow.test(html)) html=html.replace(repairRow,`$1<div class="info"><span>Все расходы</span><strong>${money(total)}</strong></div>`);
   else if(expenseRow.test(html)) html=html.replace(expenseRow,`$1<div class="info"><span>Все расходы</span><strong>${money(total)}</strong></div>`);
  }
  // Only translate technical enum values; do not change report structure.
  const exact={other:'Другое',insurance:'Страховка',repair:'Ремонт',service:'Сервис',inspection:'Техосмотр',fuel:'Топливо',tires:'Шины',wash:'Мойка',tax:'Налоги',parking:'Парковка',fine:'Штраф',parts:'Запчасти',maintenance:'Обслуживание',document:'Документы',done:'Выполнен',planned:'Запланирован',progress:'В работе',in_progress:'В работе',cancelled:'Отменён',paid:'Оплачен',unpaid:'Не оплачен',partial:'Частично оплачен'};
  for(const [from,to] of Object.entries(exact))html=html.replace(new RegExp(`>${from}<`,'gi'),`>${to}<`);
  return html
 }
 function install(){
  let current=window.buildVehicleReportHtml;
  if(typeof current!=='function')return false;
  // If our previous report wrapper is active, unwrap to the original native report first.
  while(current&&current.__native)current=current.__native;
  if(typeof current!=='function')return false;
  const native=current;
  const wrapped=function(carId){return patchHtml(native.apply(this,arguments),carId)};
  wrapped.__fpOriginalLayoutTotal=true;wrapped.__native=native;
  window.buildVehicleReportHtml=wrapped;
  try{buildVehicleReportHtml=wrapped}catch{}
  return true
 }
 let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>40)clearInterval(timer)},100);
 ['fleetpilot:modules-ready','fleetpilot:access-ready'].forEach(ev=>window.addEventListener(ev,()=>setTimeout(install,0)));
 document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
 FP.VehicleReportV2={install,patchHtml,totals};
})();