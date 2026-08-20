/* FleetPilot vehicle report — original layout + total expenses + expense title + Russian labels */
(()=>{'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 const money=v=>`${Number(v||0).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})} zł`;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
 const cat=v=>({other:'Другое',insurance:'Страховка',repair:'Ремонт',service:'Сервис',inspection:'Техосмотр',fuel:'Топливо',tires:'Шины',wash:'Мойка',tax:'Налоги',parking:'Парковка',fine:'Штраф',parts:'Запчасти',maintenance:'Обслуживание',document:'Документы'}[String(v||'').toLowerCase()]||String(v||'Расход'));
 const date=v=>{if(!v)return'—';try{return new Date(v).toLocaleDateString('ru-RU')}catch{return String(v)}};
 function state(){try{return typeof db!=='undefined'?db:(window.db||{})}catch{return window.db||{}}}
 function totals(carId){
  const d=state();
  const expenses=(d.expenses||[]).filter(x=>String(x.carId)===String(carId));
  const repairs=(d.repairs||[]).filter(x=>String(x.carId)===String(carId)&&String(x.status||'')!=='cancelled'&&Number(x.actual||x.planned||0)>0);
  const expenseTotal=expenses.reduce((s,x)=>s+Number(x.amount||0),0);let extraRepairs=0;
  for(const r of repairs){const duplicate=expenses.some(e=>String(e.linkedRepairId||'')===String(r.id)&&String(e.linkedRepairId||''))||expenses.some(e=>String(r.linkedExpenseId||'')===String(e.id||'')&&String(r.linkedExpenseId||''));if(!duplicate)extraRepairs+=Number(r.actual||r.planned||0)}
  return {all:expenseTotal+extraRepairs}
 }
 function expenseTable(carId){
  const d=state();const rows=(d.expenses||[]).filter(x=>String(x.carId)===String(carId)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,30);
  const body=rows.length?rows.map(x=>`<tr><td>${date(x.date)}</td><td>${esc(x.title||cat(x.category))}</td><td>${esc(cat(x.category))}</td><td>${money(x.amount)}</td><td>${esc(x.note||'')}</td></tr>`).join(''):`<tr><td colspan="5" class="empty">Расходов нет</td></tr>`;
  return `<section class="section"><h2>Последние расходы</h2><table><thead><tr><th>Дата</th><th>Название</th><th>Категория</th><th>Сумма</th><th>Комментарий</th></tr></thead><tbody>${body}</tbody></table></section>`
 }
 function patchHtml(html,carId){
  if(!html)return html;const total=totals(carId).all;
  if(!/<span>Все расходы<\/span>/i.test(html)){
   const repairRow=/(<div class="info"><span>Ремонты<\/span><strong>[\s\S]*?<\/strong><\/div>)/i,expenseRow=/(<div class="info"><span>Расходы<\/span><strong>[\s\S]*?<\/strong><\/div>)/i;
   if(repairRow.test(html))html=html.replace(repairRow,`$1<div class="info"><span>Все расходы</span><strong>${money(total)}</strong></div>`);else if(expenseRow.test(html))html=html.replace(expenseRow,`$1<div class="info"><span>Все расходы</span><strong>${money(total)}</strong></div>`)
  }
  // Keep repair history unchanged; only enhance the native expense table with the missing title column.
  html=html.replace(/<section class="section">\s*<h2>Последние расходы<\/h2>[\s\S]*?<\/section>/i,expenseTable(carId));
  const exact={other:'Другое',insurance:'Страховка',repair:'Ремонт',service:'Сервис',inspection:'Техосмотр',done:'Выполнен',planned:'Запланирован',progress:'В работе',in_progress:'В работе',cancelled:'Отменён',paid:'Оплачен',unpaid:'Не оплачен',partial:'Частично оплачен'};
  for(const [from,to] of Object.entries(exact))html=html.replace(new RegExp(`>${from}<`,'gi'),`>${to}<`);
  return html
 }
 function install(){let current=window.buildVehicleReportHtml;if(typeof current!=='function')return false;while(current&&current.__native)current=current.__native;if(typeof current!=='function')return false;const native=current,wrapped=function(carId){return patchHtml(native.apply(this,arguments),carId)};wrapped.__fpOriginalLayoutTotal=true;wrapped.__native=native;window.buildVehicleReportHtml=wrapped;try{buildVehicleReportHtml=wrapped}catch{}return true}
 let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>40)clearInterval(timer)},100);['fleetpilot:modules-ready','fleetpilot:access-ready'].forEach(ev=>window.addEventListener(ev,()=>setTimeout(install,0)));document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});FP.VehicleReportV2={install,patchHtml,totals};
})();