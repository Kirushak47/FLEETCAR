/* FleetPilot 20 — UI Completion
   Non-domain UI helpers: pagination, completed work decoration, request visibility filters. */
(()=>{
'use strict';
const FP=window.FleetPilot=window.FleetPilot||{};if(FP.UICompletion)return;
const getDb=()=>{try{return typeof db!=='undefined'?db:window.db}catch{return window.db}};
const hidden=()=>{const d=getDb();if(!d)return{};d.driverRequestHidden=d.driverRequestHidden||{};return d.driverRequestHidden};
const deleted=()=>{const d=getDb();if(!d)return[];d.driverDeletedRequestIds=Array.isArray(d.driverDeletedRequestIds)?d.driverDeletedRequestIds:[];return d.driverDeletedRequestIds};
function patchRequests(){const cloud=window.FleetPilotCloud;if(!cloud||cloud.__fp20UiRequests)return false;cloud.__fp20UiRequests=true;const filter=rows=>{const h=hidden(),x=new Set(deleted().map(String));return(Array.isArray(rows)?rows:[]).filter(r=>!x.has(String(r.id||r.request_id||''))&&!h[String(r.id||r.request_id||'')])};if(typeof cloud.getMyDriverRepairRequests==='function'){const orig=cloud.getMyDriverRepairRequests.bind(cloud);cloud.getMyDriverRepairRequests=async(...args)=>filter(await orig(...args))}if(typeof cloud.getWorkspaceDriverRepairRequests==='function'){const orig=cloud.getWorkspaceDriverRepairRequests.bind(cloud);cloud.getWorkspaceDriverRepairRequests=async(...args)=>{const rows=await orig(...args),x=new Set(deleted().map(String));return(Array.isArray(rows)?rows:[]).filter(r=>!x.has(String(r.id||r.request_id||'')))}}return true}

function keepCalendarOpen(){
 const grid=document.querySelector('#calendarMonthGrid');
 if(!grid)return;
 grid.querySelectorAll(':scope > .fp-list-more').forEach(x=>x.remove());
 delete grid.dataset.fpPaged;
 [...grid.children].forEach(x=>{if(!x.classList.contains('fp-list-more'))x.hidden=false});
}
function paginate(){
 keepCalendarOpen();
 const selectors=['main tbody','main [id$="List"]','main [id$="Grid"]','main [id$="Rows"]','main .list','main .cards','main .card-list','main .timeline','#cloudAdminUsers'];
 const boxes=[...new Set(selectors.flatMap(s=>[...document.querySelectorAll(s)]))];
 for(const box of boxes){
  if(box.id==='calendarMonthGrid'||box.closest('#calendarMonthGrid'))continue;
  if(box.dataset.fpPaged==='1'||box.closest('[id*=service i],[class*=service i]'))continue;
  const kids=[...box.children].filter(x=>!x.classList.contains('fp-list-more'));
  if(kids.length<=10||kids.some(x=>['SCRIPT','STYLE','OPTION'].includes(x.tagName)))continue;
  box.dataset.fpPaged='1';let shown=10;
  const btn=document.createElement('button');btn.type='button';btn.className='fp-list-more';
  const apply=()=>{kids.forEach((x,i)=>x.hidden=i>=shown);btn.textContent=shown>=kids.length?'Свернуть':`Показать ещё (${kids.length-shown})`};
  btn.onclick=()=>{shown=shown>=kids.length?10:Math.min(kids.length,shown+10);apply()};
  box.appendChild(btn);apply()
 }
}
function markCompleted(){for(const el of document.querySelectorAll('[class*=driver i] .card,[id*=driver i] .card')){const text=(el.textContent||'').toLowerCase();el.classList.toggle('fp-completed-work',text.includes('выполнено')||text.includes('готово'))}}
function patchServiceFeed(){const cloud=window.FleetPilotCloud;if(!cloud?.getDriverServiceFeed||cloud.getDriverServiceFeed.__fp20)return;const orig=cloud.getDriverServiceFeed.bind(cloud);const safe=async(...args)=>{const rows=await orig(...args);return(Array.isArray(rows)?rows:[]).map(r=>{const s=String(r.status||r.repair_status||r.service_status||'').toLowerCase();return['done','completed','finished'].includes(s)?{...r,status:'done',status_label:'Выполнено'}:r})};safe.__fp20=true;cloud.getDriverServiceFeed=safe}
function tick(){try{patchRequests();patchServiceFeed();keepCalendarOpen();paginate();markCompleted()}catch(e){console.warn('FleetPilot UI completion',e)}}
const style=document.createElement('style');style.textContent=`
.fp-list-more{display:block;width:min(100%,360px);margin:12px auto 4px;padding:10px 14px;border:1px solid #dbe3ee;border-radius:12px;background:#fff;color:#334155;font-weight:800;cursor:pointer}
.fp-list-more:hover{background:#f8fafc}
.fp-completed-work{border-color:#86efac!important;background:#f0fdf4!important}
#calendarMonthGrid>.fp-list-more{display:none!important}
#calendarMonthGrid>[hidden]{display:initial!important}
@media(max-width:620px){
 .profile-dialog-shell{overflow-x:hidden!important}
 .profile-admin-card,.cloud-admin-users,.cloud-admin-user,.platform-project-row{min-width:0!important;max-width:100%!important}
 .profile-admin-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important}
 .profile-admin-kpis>div,.cloud-admin-user>*{min-width:0!important}
 .cloud-admin-user{grid-template-columns:minmax(0,1fr)!important;width:100%!important;box-sizing:border-box!important}
 .cloud-admin-user-stats{grid-template-columns:repeat(3,minmax(0,1fr))!important;min-width:0!important;width:100%!important}
 .cloud-admin-user-stats span{min-width:0!important;overflow-wrap:anywhere}
 .platform-project-row strong,.platform-project-row small{overflow-wrap:anywhere;word-break:break-word}
}
`;
document.head.appendChild(style);tick();let timer=0;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(tick,120)}).observe(document.documentElement,{subtree:true,childList:true});setInterval(()=>{patchRequests();patchServiceFeed();keepCalendarOpen()},1500);FP.UICompletion=Object.freeze({tick,paginate,keepCalendarOpen});console.info('FleetPilot 20 UI completion ready');
})();