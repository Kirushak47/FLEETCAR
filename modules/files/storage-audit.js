/* FleetPilot storage audit — creator-only diagnostic of cloud, legacy and local-only data */
(()=>{'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 const $=s=>document.querySelector(s);
 const dbx=()=>typeof db!=='undefined'?db:(window.db||{});
 const isData=v=>typeof v==='string'&&/^data:(image|application|text)\//i.test(v);
 const norm=v=>String(v||'').trim().toLowerCase();
 async function isCreator(){
  const ownerEmail=norm(window.FLEETPILOT_CLOUD_CONFIG?.ownerEmail);
  if(!ownerEmail)return false;
  try{
   const client=window.__FLEETPILOT_SUPABASE_CLIENT__;
   if(!client?.auth?.getUser)return false;
   const {data,error}=await client.auth.getUser();
   if(error)return false;
   return norm(data?.user?.email)===ownerEmail;
  }catch{return false}
 }
 function removeUi(){document.querySelector('#fpStorageAudit')?.remove()}
 async function ensureUi(){
  const page=$('#dataPage');
  if(!page)return false;
  if(!(await isCreator())){removeUi();return false}
  if($('#fpStorageAudit'))return true;
  const card=document.createElement('section');card.id='fpStorageAudit';card.className='professional-panel';card.innerHTML=`<div class="professional-panel-head"><div><span class="eyebrow">Диагностика хранения</span><h3>Аудит облака и локальных данных</h3><p>Показывает, остались ли бизнес-файлы, которые существуют только в этом браузере.</p></div><button id="fpRunStorageAudit" type="button" class="btn">Проверить</button></div><div id="fpStorageAuditBody" style="padding:16px"><div class="driver-empty-state">Нажмите «Проверить».</div></div>`;page.appendChild(card);$('#fpRunStorageAudit')?.addEventListener('click',run);return true
 }
 function countLegacyMedia(){const d=dbx();let service=0,damage=0,handover=0,car=0;for(const r of d.repairs||[]){service+=(r.photosBefore||[]).filter(isData).length+(r.photosAfter||[]).filter(isData).length}for(const x of d.damages||[])damage+=(x.photos||[]).filter(p=>isData(p?.data||p)).length;for(const c of d.cars||[]){if(isData(c.customPhoto))car++;for(const ev of c.vehicleHandoverAudit||[])handover+=(ev.photos||[]).filter(p=>isData(p?.data||p)).length}return{service,damage,handover,car,total:service+damage+handover+car}}
 function indexedDbCount(){return new Promise(resolve=>{try{const req=indexedDB.open('FleetPilotFiles');req.onerror=()=>resolve({count:0,error:true});req.onupgradeneeded=()=>{try{req.transaction.abort()}catch{}resolve({count:0,missing:true})};req.onsuccess=()=>{const idb=req.result;if(!idb.objectStoreNames.contains('files')){idb.close();return resolve({count:0,missing:true})}try{const tx=idb.transaction('files','readonly'),store=tx.objectStore('files'),c=store.count();c.onsuccess=()=>{const count=Number(c.result||0);idb.close();resolve({count})};c.onerror=()=>{idb.close();resolve({count:0,error:true})}}catch{try{idb.close()}catch{}resolve({count:0,error:true})}}}catch{resolve({count:0,error:true})}})}
 async function cloudCount(){try{const api=FP.Files||window.FleetPilotFiles;if(!api?.list)return{count:0,error:true};const rows=await api.list({limit:5000})||[];return{count:rows.length,rows}}catch(error){console.warn('Storage audit cloud',error);return{count:0,error:true}}}
 function render(result){const root=$('#fpStorageAuditBody');if(!root)return;const localOnly=result.legacyMedia.total+result.indexed.count;const ok=localOnly===0;root.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px"><div class="metric-card"><small>Файлов в облаке</small><strong>${result.cloud.count}</strong></div><div class="metric-card"><small>Legacy IndexedDB</small><strong>${result.indexed.count}</strong></div><div class="metric-card"><small>Base64-медиа в db</small><strong>${result.legacyMedia.total}</strong></div><div class="metric-card"><small>Локально-зависимых</small><strong>${localOnly}</strong></div></div><div class="info ${ok?'success':'warning'}"><strong>${ok?'Критичных локальных файлов не найдено':'Legacy-данные ещё есть'}</strong><p>${ok?'Новые файлы можно считать облачными. LocalStorage/IndexedDB остаются только для совместимости и настроек.':'Не удаляйте legacy-хранилище. Сначала выполните миграцию и повторите аудит.'}</p></div><div style="margin-top:12px;font-size:13px;color:#667085;line-height:1.7">Сервисные фото в base64: <b>${result.legacyMedia.service}</b><br>Повреждения: <b>${result.legacyMedia.damage}</b><br>Приём/возврат: <b>${result.legacyMedia.handover}</b><br>Фото автомобилей: <b>${result.legacyMedia.car}</b>${result.cloud.error?'<br><span style="color:#b42318">Не удалось проверить Supabase Storage.</span>':''}</div>`}
 async function run(){if(!(await isCreator())){removeUi();return null}if(!(await ensureUi()))return null;const root=$('#fpStorageAuditBody');if(root)root.innerHTML='<div class="driver-empty-state">Проверяю локальное и облачное хранение…</div>';const [indexed,cloud]=await Promise.all([indexedDbCount(),cloudCount()]);const result={indexed,cloud,legacyMedia:countLegacyMedia(),at:new Date().toISOString()};render(result);FP.StorageAudit.last=result;return result}
 async function apply(){await ensureUi()}
 document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>apply(),0),{once:true});window.addEventListener('fleetpilot:modules-ready',()=>setTimeout(()=>apply(),60));window.addEventListener('fleetpilot:access-ready',()=>setTimeout(()=>apply(),60));document.addEventListener('click',e=>{if(e.target?.closest?.('[data-page="dataPage"],[data-desktop-page="dataPage"]'))setTimeout(async()=>{if(await ensureUi())run()},120)},true);
 FP.StorageAudit={run,last:null,isCreator};
})();