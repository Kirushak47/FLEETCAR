/* FleetPilot vehicle report — original report, only add expense title column */
(()=>{'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
 const money=v=>`${Number(v||0).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})} zł`;
 const date=v=>{if(!v)return'—';try{return new Date(v).toLocaleDateString('ru-RU')}catch{return String(v)}};
 function state(){try{return typeof db!=='undefined'?db:(window.db||{})}catch{return window.db||{}}}
 function expenseTable(carId){
  const d=state();
  const rows=(d.expenses||[]).filter(x=>String(x.carId)===String(carId)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,30);
  const body=rows.length?rows.map(x=>`<tr><td>${date(x.date)}</td><td>${esc(x.title||x.category||'Расход')}</td><td>${esc(x.category||x.title||'Расход')}</td><td>${money(x.amount)}</td><td>${esc(x.note||'')}</td></tr>`).join(''):`<tr><td colspan="5" class="empty">Расходов нет</td></tr>`;
  return `<section class="section"><h2>Последние расходы</h2><table><thead><tr><th>Дата</th><th>Название</th><th>Категория</th><th>Сумма</th><th>Комментарий</th></tr></thead><tbody>${body}</tbody></table></section>`;
 }
 function patchHtml(html,carId){
  if(!html)return html;
  // Everything stays native/original. Replace only the expense table to add "Название" after "Дата".
  return html.replace(/<section class="section">\s*<h2>Последние расходы<\/h2>[\s\S]*?<\/section>/i,expenseTable(carId));
 }
 function install(){
  let current=window.buildVehicleReportHtml;if(typeof current!=='function')return false;
  while(current&&current.__native)current=current.__native;
  if(typeof current!=='function')return false;
  const native=current;
  const wrapped=function(carId){return patchHtml(native.apply(this,arguments),carId)};
  wrapped.__fpExpenseTitleOnly=true;wrapped.__native=native;
  window.buildVehicleReportHtml=wrapped;try{buildVehicleReportHtml=wrapped}catch{}
  return true;
 }
 let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>40)clearInterval(timer)},100);
 ['fleetpilot:modules-ready','fleetpilot:access-ready'].forEach(ev=>window.addEventListener(ev,()=>setTimeout(install,0)));
 document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
 FP.VehicleReportV2={install,patchHtml};
})();