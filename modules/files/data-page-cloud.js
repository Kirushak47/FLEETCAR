/* FleetPilot Data page — cloud persistence status */
(()=>{'use strict';
 const $=s=>document.querySelector(s);
 const humanSize=bytes=>{const n=Number(bytes||0);if(!n)return'0 Б';const u=['Б','КБ','МБ','ГБ'];const i=Math.min(u.length-1,Math.floor(Math.log(n)/Math.log(1024)));return`${(n/1024**i).toFixed(i?1:0)} ${u[i]}`};
 function rewriteCopy(){
  const page=$('#dataPage');if(!page)return;
  const storage=page.querySelector('.storage-status-card');
  if(storage){storage.innerHTML='<div><span class="eyebrow">Облачные файлы</span><h3>Supabase Storage</h3><p>Документы и вложения хранятся в Workspace и доступны с любого разрешённого устройства.</p></div><div id="fileStorageStats">Проверяется…</div>'}
  const cards=[...page.querySelectorAll('.backup-card')];
  for(const card of cards){const h=card.querySelector('h3')?.textContent?.trim();const p=card.querySelector('p');if(!p)continue;
   if(h==='Скачать резервную копию')p.textContent='Скачивает структурированные данные FleetPilot в JSON: автомобили, пробеги, ремонты, оплаты, документы и настройки. Облачные файлы из Supabase Storage в JSON не встраиваются и остаются в облаке.';
   if(h==='Последняя автокопия')p.textContent='Локальная аварийная копия текущей базы на этом устройстве. Основная рабочая версия Workspace синхронизируется с облаком.';
   if(h==='Удалить все данные')p.textContent='Удаляет локальные данные приложения на этом устройстве. Облачные файлы Storage этим действием не удаляются.';
  }
  const note=page.querySelector('.persistence-note');
  if(note)note.innerHTML=`<h3>Как сохраняются данные FleetPilot</h3>
   <p><strong>Основные данные автопарка синхронизируются с Workspace в Supabase.</strong> После входа тот же автопарк можно открыть на другом компьютере или телефоне.</p>
   <p><strong>Документы и вложения хранятся отдельно в Supabase Storage.</strong> Они не зависят от IndexedDB конкретного браузера и доступны пользователям с соответствующими правами.</p>
   <p>Браузер всё ещё хранит локальный кэш и аварийные автокопии для скорости и восстановления. Очистка данных браузера может удалить только эти локальные копии, но не должна удалять данные Workspace или облачные файлы.</p>
   <p>Рабочий адрес приложения: <code>fleetpilot.balyshevy.workers.dev</code>. Для нормальной синхронизации всегда входите в свой аккаунт и Workspace.</p>
   <p><strong>Резервная копия JSON остаётся дополнительной страховкой.</strong> Она сохраняет структуру базы, но сами облачные PDF, DOCX, XLSX и фотографии продолжают храниться в Storage.</p>`;
 }
 async function refreshCloudFiles(){
  const el=$('#fileStorageStats');if(!el)return;
  try{
   const files=await window.FleetPilot?.Files?.list?.({limit:1000});
   if(!Array.isArray(files)){el.textContent='Storage ещё не подключён';return}
   const size=files.reduce((s,x)=>s+Number(x.size_bytes||0),0);
   el.innerHTML=`<strong>${files.length}</strong> файлов · <strong>${humanSize(size)}</strong><br><small>Доступны из Workspace</small>`
  }catch(error){el.textContent='Не удалось проверить облачные файлы';console.warn('FleetPilot cloud file stats',error)}
 }
 function apply(){rewriteCopy();refreshCloudFiles()}
 document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0),{once:true});
 ['fleetpilot:access-ready','fleetpilot:files-changed','fleetpilot:modules-ready'].forEach(ev=>window.addEventListener(ev,()=>setTimeout(apply,50)));
 document.addEventListener('click',e=>{if(e.target?.closest?.('[data-page="dataPage"],[data-desktop-page="dataPage"]'))setTimeout(apply,100)},true);
 window.FleetPilot=window.FleetPilot||{};window.FleetPilot.DataPageCloud={apply,refreshCloudFiles};
})();