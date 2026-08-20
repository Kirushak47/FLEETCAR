/* FleetPilot vehicle report v2 — unified expenses and Russian labels */
(()=>{'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cat=v=>({other:'Другое',insurance:'Страховка',repair:'Ремонт',service:'Сервис',inspection:'Техосмотр',fuel:'Топливо',tires:'Шины',wash:'Мойка',tax:'Налоги',parking:'Парковка',fine:'Штраф',parts:'Запчасти',maintenance:'Обслуживание',document:'Документы'}[String(v||'').toLowerCase()]||String(v||'Расход'));
 const status=v=>({done:'Выполнен',planned:'Запланирован',progress:'В работе',in_progress:'В работе',cancelled:'Отменён',paid:'Оплачен',unpaid:'Не оплачен',partial:'Частично оплачен'}[String(v||'').toLowerCase()]||String(v||''));
 const money=v=>`${Number(v||0).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})} zł`;
 const date=v=>{if(!v)return'—';try{return new Date(String(v).length<=10?`${v}T12:00:00`:v).toLocaleDateString('ru-RU')}catch{return String(v)}};
 function state(){try{return typeof db!=='undefined'?db:(window.db||{})}catch{return window.db||{}}}
 function rowsForCar(carId){
  const d=state();
  const expenses=(d.expenses||[]).filter(x=>String(x.carId)===String(carId)).map(x=>({
   kind:'expense',date:x.date||'',title:x.title||cat(x.category),category:cat(x.category),amount:Number(x.amount||0),note:x.note||'',id:String(x.id||''),linkedRepairId:String(x.linkedRepairId||'')
  }));
  const repairs=(d.repairs||[]).filter(x=>String(x.carId)===String(carId)&&String(x.status||'')!=='cancelled'&&Number(x.actual||x.planned||0)>0);
  for(const r of repairs){
   const duplicate=expenses.some(e=>e.linkedRepairId&&e.linkedRepairId===String(r.id))||expenses.some(e=>String(r.linkedExpenseId||'')&&e.id===String(r.linkedExpenseId));
   if(duplicate)continue;
   expenses.push({kind:'repair',date:r.completedDate||r.paidDate||r.date||'',title:r.title||'Ремонт',category:'Ремонт',amount:Number(r.actual||r.planned||0),note:[r.service,r.note,status(r.status)].filter(Boolean).join(' · ')})
  }
  return expenses.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))
 }
 function tableRows(carId){const rows=rowsForCar(carId);return rows.length?rows.slice(0,100).map(x=>`<tr><td>${date(x.date)}</td><td>${esc(x.title||'Расход')}</td><td>${esc(x.category)}</td><td>${money(x.amount)}</td><td>${esc(x.note||'')}</td></tr>`).join(''):`<tr><td colspan="5" class="empty">Расходов нет</td></tr>`}
 function patchHtml(html,carId){
  if(!html)return html;
  const rows=rowsForCar(carId),total=rows.reduce((s,x)=>s+Number(x.amount||0),0);
  // Separate repair history is redundant now: repairs are part of the unified expense ledger.
  html=html.replace(/<section class="section">\s*<h2>История ремонтов<\/h2>[\s\S]*?<\/section>\s*/i,'');
  html=html.replace(/<section class="section">\s*<h2>Последние расходы<\/h2>[\s\S]*?<\/section>/i,`<section class="section"><h2>Все расходы по автомобилю</h2><table><thead><tr><th>Дата</th><th>Название</th><th>Категория</th><th>Сумма</th><th>Комментарий</th></tr></thead><tbody>${tableRows(carId)}</tbody></table></section>`);
  // The summary must show one real total, including service/repair costs.
  html=html.replace(/<div class="info"><span>Расходы<\/span><strong>[\s\S]*?<\/strong><\/div>/i,`<div class="info"><span>Все расходы</span><strong>${money(total)}</strong></div>`);
  html=html.replace(/\s*<div class="info"><span>Ремонты<\/span><strong>[\s\S]*?<\/strong><\/div>/i,'');
  // Localize legacy enum values if they appear elsewhere in the printable report.
  const exact={other:'Другое',insurance:'Страховка',repair:'Ремонт',service:'Сервис',inspection:'Техосмотр',done:'Выполнен',planned:'Запланирован',cancelled:'Отменён',paid:'Оплачен',unpaid:'Не оплачен'};
  for(const [from,to] of Object.entries(exact))html=html.replace(new RegExp(`>${from}<`,'gi'),`>${to}<`);
  return html
 }
 function install(){
  const current=window.buildVehicleReportHtml;
  if(typeof current!=='function'||current.__fpUnifiedExpenses)return false;
  const native=current;
  const wrapped=function(carId){return patchHtml(native.apply(this,arguments),carId)};
  wrapped.__fpUnifiedExpenses=true;wrapped.__native=native;
  window.buildVehicleReportHtml=wrapped;
  try{buildVehicleReportHtml=wrapped}catch{}
  return true
 }
 let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>40)clearInterval(timer)},100);
 ['fleetpilot:modules-ready','fleetpilot:access-ready'].forEach(ev=>window.addEventListener(ev,()=>setTimeout(install,0)));
 document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
 FP.VehicleReportV2={install,patchHtml,rowsForCar};
})();