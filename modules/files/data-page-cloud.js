/* FleetPilot Data page — cloud persistence status */
(()=>{'use strict';
 const $=s=>document.querySelector(s);
 const humanSize=bytes=>{const n=Number(bytes||0);if(!n)return'0 Б';const u=['Б','КБ','МБ','ГБ'];const i=Math.min(u.length-1,Math.floor(Math.log(n)/Math.log(1024)));return`${(n/1024**i).toFixed(i?1:0)} ${u[i]}`};
 const cloudReady=()=>Boolean(
  (window.__FLEETPILOT_SUPABASE_CLIENT__||window.FleetPilotCloud?.client)&&
  (window.FleetPilotCloud?.membership?.workspace_id||window.FleetPilotCloud?.workspace?.id)
 );
 function loadDocumentCloudBridge(){if(window.FleetPilot?.DocumentFiles||document.querySelector('script[data-fp-document-cloud-bridge]'))return;const s=document.createElement('script');s.src='modules/files/document-cloud-bridge.js?v=210018';s.async=false;s.setAttribute('data-fp-document-cloud-bridge','1');s.onerror=()=>console.error('FleetPilot document cloud bridge failed to load');document.body.appendChild(s)}
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
  if(note)note.innerHTML=`<h3>Как сохраняются данные FleetPilot</h3><p><strong>Основные данные автопарка синхронизируются с Workspace в Supabase.</strong> После входа тот же автопарк можно открыть на другом компьютере или телефоне.</p><p><strong>Документы и вложения хранятся отдельно в Supabase Storage.</strong> Они не зависят от IndexedDB конкретного браузера и доступны пользователям с соответствующими правами.</p><p>Браузер всё ещё хранит локальный кэш и аварийные автокопии для скорости и восстановления. Очистка данных браузера может удалить только эти локальные копии, но не должна удалять данные Workspace или облачные файлы.</p><p>Рабочий адрес приложения: <code>fleetpilot.balyshevy.workers.dev</code>. Для нормальной синхронизации всегда входите в свой аккаунт и Workspace.</p><p><strong>Резервная копия JSON остаётся дополнительной страховкой.</strong> Она сохраняет структуру базы, но сами облачные PDF, DOCX, XLSX и фотографии продолжают храниться в Storage.</p>`;
 }
 async function refreshCloudFiles(){
  const el=$('#fileStorageStats');if(!el)return;
  // During initial boot the Data module can load before membership/workspace resolution.
  // This is normal: wait silently for fleetpilot:access-ready instead of throwing a warning.
  if(!cloudReady()){
   el.textContent=window.FleetPilotCloud?.session?'Ожидание Workspace…':'Войдите в Workspace';
   return
  }
  const api=window.FleetPilot?.Files;
  if(!api?.list){el.textContent='Storage ещё подключается…';return}
  try{
   const files=await api.list({limit:1000});
   if(!Array.isArray(files)){el.textContent='Storage ещё не подключён';return}
   const size=files.reduce((s,x)=>s+Number(x.size_bytes||0),0);
   el.innerHTML=`<strong>${files.length}</strong> файлов · <strong>${humanSize(size)}</strong><br><small>Доступны из Workspace</small>`
  }catch(error){
   // A logout/workspace switch can race an in-flight request. Do not treat that as an app error.
   const message=String(error?.message||error||'');
   if(/Workspace недоступен|Supabase недоступен/i.test(message)){
    el.textContent='Ожидание Workspace…';
    return
   }
   el.textContent='Не удалось проверить облачные файлы';
   console.warn('FleetPilot cloud file stats',error)
  }
 }
 function apply(){loadDocumentCloudBridge();rewriteCopy();refreshCloudFiles()}
 loadDocumentCloudBridge();
 document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{rewriteCopy();if(cloudReady())refreshCloudFiles()},0),{once:true});
 ['fleetpilot:access-ready','fleetpilot:files-changed'].forEach(ev=>window.addEventListener(ev,()=>setTimeout(apply,50)));
 // modules-ready may fire before Workspace is resolved; only refresh if cloud is actually ready.
 window.addEventListener('fleetpilot:modules-ready',()=>setTimeout(()=>{rewriteCopy();if(cloudReady())refreshCloudFiles()},50));
 document.addEventListener('click',e=>{if(e.target?.closest?.('[data-page="dataPage"],[data-desktop-page="dataPage"]'))setTimeout(apply,100)},true);
 window.FleetPilot=window.FleetPilot||{};window.FleetPilot.DataPageCloud={apply,refreshCloudFiles};
})();