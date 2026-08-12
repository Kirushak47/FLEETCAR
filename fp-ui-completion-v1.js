/* FleetPilot UI completion hotfix — 2026-08-12 */
(()=>{
'use strict';
if(window.__fpUiCompletionV1)return;window.__fpUiCompletionV1=true;
const same=(a,b)=>String(a??'')===String(b??'');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
const requestsHidden=()=>{window.db.driverRequestHidden=window.db.driverRequestHidden||{};return window.db.driverRequestHidden};
const deletedIds=()=>{window.db.driverDeletedRequestIds=Array.isArray(window.db.driverDeletedRequestIds)?window.db.driverDeletedRequestIds:[];return window.db.driverDeletedRequestIds};
const role=()=>String(window.FleetPilotCloud?.role||'');
const canAdmin=()=>['owner','admin'].includes(role())||window.FleetPilotCloud?.isPlatformAdmin===true;
const saveDb=()=>{try{window.save?.()}catch{}try{window.FleetPilotCloud?.schedulePush?.()}catch{}};

function patchRequestApis(){
 const cloud=window.FleetPilotCloud;if(!cloud||cloud.__fpUiCompletionRequests)return false;
 cloud.__fpUiCompletionRequests=true;
 const filter=rows=>{const hidden=requestsHidden(),deleted=new Set(deletedIds().map(String));return (Array.isArray(rows)?rows:[]).filter(r=>!deleted.has(String(r.id||r.request_id||''))&&!hidden[String(r.id||r.request_id||'')])};
 if(typeof cloud.getMyDriverRepairRequests==='function'){
  const orig=cloud.getMyDriverRepairRequests.bind(cloud);
  cloud.getMyDriverRepairRequests=async(...args)=>filter(await orig(...args));
 }
 if(typeof cloud.getWorkspaceDriverRepairRequests==='function'){
  const orig=cloud.getWorkspaceDriverRepairRequests.bind(cloud);
  cloud.getWorkspaceDriverRepairRequests=async(...args)=>{
   const rows=await orig(...args),deleted=new Set(deletedIds().map(String));
   return (Array.isArray(rows)?rows:[]).filter(r=>!deleted.has(String(r.id||r.request_id||'')))
  }
 }
}

function ensureStyle(){if(document.getElementById('fpUiCompletionStyle'))return;const s=document.createElement('style');s.id='fpUiCompletionStyle';s.textContent=`
.fp-driver-profile-modal{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:20px}.fp-driver-profile-card{width:min(820px,96vw);max-height:88vh;overflow:auto;background:#fff;border-radius:20px;padding:22px;box-shadow:0 24px 80px rgba(15,23,42,.25)}.fp-driver-profile-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.fp-driver-profile-head h2{margin:0 0 4px}.fp-driver-profile-meta{color:#64748b;font-size:13px}.fp-driver-profile-car{margin:18px 0;padding:14px 16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc}.fp-driver-request-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:12px 0;border-top:1px solid #edf2f7}.fp-driver-request-row:first-child{border-top:0}.fp-driver-request-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.fp-mini-btn{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:7px 9px;font:inherit;cursor:pointer}.fp-mini-btn.danger{border-color:#fecaca;color:#b91c1c;background:#fff7f7}.fp-mini-btn.muted{color:#475569}.fp-list-more{display:block;margin:12px auto 4px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 13px;cursor:pointer}.fp-completed-work{border-color:#86efac!important;background:#f0fdf4!important}.fp-completed-work .status,.fp-completed-work [class*=status]{color:#15803d!important}.fp-hidden-driver-request{opacity:.62}.fp-driver-profile-trigger{cursor:pointer!important}
`;document.head.appendChild(s)}

async function openDriverProfile(userId){
 if(!canAdmin())return;
 const cloud=window.FleetPilotCloud;let members=[];try{members=(await cloud.enterpriseList())?.members||[]}catch{}
 const m=members.find(x=>same(x.user_id,userId))||{};const email=m?.profiles?.email||m.email||'';const name=m.display_name||m.name||m.full_name||[m.first_name,m.last_name].filter(Boolean).join(' ')||email||'Водитель';
 const c=cars().find(x=>same(x.driverUserId,userId));let rows=[];try{rows=await cloud.getWorkspaceDriverRepairRequests()}catch{}
 rows=(rows||[]).filter(r=>same(r.driver_user_id||r.user_id||r.driverUserId,userId)||(!r.driver_user_id&&email&&String(r.driver_email||'').toLowerCase()===String(email).toLowerCase())).sort((a,b)=>Date.parse(b.created_at||b.updated_at||0)-Date.parse(a.created_at||a.updated_at||0));
 const hidden=requestsHidden();
 const modal=document.createElement('div');modal.className='fp-driver-profile-modal';modal.innerHTML=`<div class="fp-driver-profile-card"><div class="fp-driver-profile-head"><div><h2>${esc(name)}</h2><div class="fp-driver-profile-meta">${esc(email)}${m.phone?` · ${esc(m.phone)}`:''}</div></div><button class="fp-mini-btn" data-close>Закрыть</button></div><div class="fp-driver-profile-car"><strong>${c?'На линии':'Без автомобиля'}</strong><div>${c?esc(`${c.plate||'—'} · ${c.brand||c.make||''} ${c.model||''}`):'Автомобиль не назначен'}</div></div><h3>Заявки водителя</h3><div data-requests>${rows.length?rows.map(r=>{const id=String(r.id||r.request_id||'');const isHidden=!!hidden[id];const title=r.title||r.category||r.problem||'Заявка';const mileage=r.mileage??r.reported_mileage??r.vehicle_mileage;return `<div class="fp-driver-request-row ${isHidden?'fp-hidden-driver-request':''}"><div><strong>${esc(title)}</strong><div class="fp-driver-profile-meta">${esc(r.status||'')} ${mileage!=null?`· ${Number(mileage).toLocaleString('ru-RU')} км`:''}</div></div><div class="fp-driver-request-actions"><button class="fp-mini-btn muted" data-hide="${esc(id)}">${isHidden?'Показать водителю':'Убрать из кабинета'}</button><button class="fp-mini-btn danger" data-delete="${esc(id)}">Удалить навсегда</button></div></div>`}).join(''):'<div class="fp-driver-profile-meta">Заявок нет</div>'}</div></div>`;
 document.body.appendChild(modal);modal.querySelector('[data-close]').onclick=()=>modal.remove();modal.onclick=e=>{if(e.target===modal)modal.remove()};
 modal.querySelectorAll('[data-hide]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.hide;if(hidden[id])delete hidden[id];else hidden[id]={at:new Date().toISOString()};saveDb();modal.remove();openDriverProfile(userId)});
 modal.querySelectorAll('[data-delete]').forEach(btn=>btn.onclick=async()=>{const id=btn.dataset.delete;if(!confirm('Удалить эту заявку навсегда? Она больше не должна возвращаться после синхронизации.'))return;try{await cloud.deleteDriverRepairRequest?.(id)}catch(e){console.warn('Permanent driver request delete',e)}if(!deletedIds().map(String).includes(id))window.db.driverDeletedRequestIds.push(id);delete hidden[id];saveDb();modal.remove();openDriverProfile(userId)});
}
window.openFleetPilotDriverProfile=openDriverProfile;

async function enhanceDriverRegistry(){if(!canAdmin())return;let members=[];try{members=(await window.FleetPilotCloud?.enterpriseList?.())?.members||[]}catch{return}const driverMembers=members.filter(x=>String(x.role||'')==='driver');if(!driverMembers.length)return;const roots=[...document.querySelectorAll('main, .page, [id*=driver i], [class*=driver i]')];for(const m of driverMembers){const email=String(m?.profiles?.email||m.email||'').trim();const name=String(m.display_name||m.name||m.full_name||[m.first_name,m.last_name].filter(Boolean).join(' ')||'').trim();for(const root of roots){for(const el of root.querySelectorAll('tr,.card,.list-item,[class*=card],[class*=row]')){if(el.dataset.fpDriverProfileBound)return;const t=(el.textContent||'').toLowerCase();if((email&&t.includes(email.toLowerCase()))||(name&&name.length>2&&t.includes(name.toLowerCase()))){el.dataset.fpDriverProfileBound='1';el.classList.add('fp-driver-profile-trigger');el.addEventListener('click',e=>{if(e.target.closest('button,a,input,select,textarea'))return;openDriverProfile(m.user_id)})}}}}
}

function paginateLists(){
 const selectors=['main tbody','main [id$="List"]','main [id$="Grid"]','main [id$="Rows"]','main .list','main .cards','main .card-list'];
 const containers=[...new Set(selectors.flatMap(s=>[...document.querySelectorAll(s)]))];
 for(const box of containers){if(box.dataset.fpPaged==='1')continue;if(box.closest('[id*=service i],[class*=service i]'))continue;const kids=[...box.children].filter(x=>!x.classList.contains('fp-list-more'));if(kids.length<=10)continue;if(kids.some(x=>['SCRIPT','STYLE','OPTION'].includes(x.tagName)))continue;box.dataset.fpPaged='1';let shown=10;const apply=()=>{kids.forEach((x,i)=>x.hidden=i>=shown);btn.textContent=shown>=kids.length?'Свернуть':`Показать ещё (${kids.length-shown})`};const btn=document.createElement('button');btn.type='button';btn.className='fp-list-more';btn.onclick=()=>{shown=shown>=kids.length?10:Math.min(kids.length,shown+10);apply()};box.appendChild(btn);apply()}
}

function markCompletedDriverWorks(){
 for(const el of document.querySelectorAll('[class*=driver i] .card,[id*=driver i] .card,[class*=driver i] [class*=work i],[id*=driver i] [class*=work i]')){const t=(el.textContent||'').toLowerCase();if(t.includes('выполнено')||t.includes('готово'))el.classList.add('fp-completed-work')}
}

function installServiceFeedPatch(){const cloud=window.FleetPilotCloud;if(!cloud?.getDriverServiceFeed||cloud.getDriverServiceFeed.__fpCompletion)return;const orig=cloud.getDriverServiceFeed.bind(cloud);const fn=async(...args)=>{const rows=await orig(...args);return (Array.isArray(rows)?rows:[]).map(r=>{const status=String(r.status||r.repair_status||r.service_status||'').toLowerCase();if(['done','completed','finished'].includes(status))return {...r,status:'done',status_label:'Выполнено'};return r})};fn.__fpCompletion=true;cloud.getDriverServiceFeed=fn}

function tick(){try{patchRequestApis();installServiceFeedPatch();enhanceDriverRegistry();paginateLists();markCompletedDriverWorks()}catch(e){console.warn('UI completion tick',e)}}
ensureStyle();tick();let scheduled=0;new MutationObserver(()=>{clearTimeout(scheduled);scheduled=setTimeout(tick,120)}).observe(document.documentElement,{subtree:true,childList:true});setInterval(()=>{patchRequestApis();installServiceFeedPatch()},1500);
console.info('FleetPilot UI completion v1 active');
})();
