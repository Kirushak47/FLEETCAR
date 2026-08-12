/* FleetPilot 20 — Fleet Board UI
   Pure renderer over FleetStatus. Vehicle operational state and service-health are separate. */
(()=>{
 'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 const Core=FP.Core,Status=FP.FleetStatus;if(!Core||!Status)throw new Error('FleetPilot Core/Status must load before Fleet Board');
 if(FP.FleetBoard)return;
 const dayDiff=value=>{if(!value)return 99999;const d=new Date(String(value).slice(0,10)+'T12:00:00');return Number.isNaN(d.getTime())?99999:Math.ceil((d-new Date())/86400000)};
 const terminal=new Set(['done','cancelled','canceled','rejected','archived','closed']);
 function health(car){
  const db=Core.db()||{};
  const repairs=(db.repairs||[]).filter(r=>String(r.carId)===String(car.id)&&!terminal.has(String(r.status||'').toLowerCase()));
  let level='good';
  let oilLeft=999999;
  try{if(typeof window.oil==='function')oilLeft=Number(window.oil(car))}catch{}
  const insuranceDays=dayDiff(car.insurance),inspectionDays=dayDiff(car.inspection);
  const overdueRepair=repairs.some(r=>r.date&&dayDiff(r.date)<0);
  if(oilLeft<=0||insuranceDays<0||inspectionDays<0||overdueRepair)level='danger';
  else if(oilLeft<=1500||insuranceDays<=30||inspectionDays<=30||repairs.length)level='warning';
  return{level,repairs};
 }
 const card=car=>{
  const m=typeof window.model==='function'?window.model(car):{},h=health(car);
  const driver=Status.hasDriver(car)?(car.tenant||car.driverName||'Водитель'):'Без водителя';
  return `<article class="desktop-board-car fp20-board-car fp20-health-${h.level}" draggable="true" data-board-car="${car.id}" data-fleet-car-id="${car.id}"><div class="fp20-board-main"><strong>${m.brand||'Автомобиль'} ${m.model||''}</strong><small>${car.plate||'Без номера'}${car.city?` · ${car.city}`:''}</small></div><div class="fp20-board-side">${h.repairs.length?`<span class="fp20-wrench" title="Есть активные сервисные работы">🔧</span>`:''}<span>${driver}</span></div></article>`;
 };
 function render(){
  const root=document.querySelector('#desktopFleetBoard');if(!root)return;
  Status.syncAll();
  const groups={active:[],repair:[],free:[]};for(const car of Core.activeCars())groups[Status.state(car)].push(car);
  root.innerHTML=['active','repair','free'].map(state=>`<section class="desktop-board-column"><div class="desktop-board-column-head"><strong>${Status.label(state)}</strong><span>${groups[state].length}</span></div><div class="desktop-board-dropzone" data-board-drop="${state}">${groups[state].map(card).join('')||'<div class="desktop-board-empty">Нет автомобилей</div>'}</div></section>`).join('');
  root.querySelectorAll('[data-board-car]').forEach(el=>{el.onclick=()=>window.openCar?.(el.dataset.boardCar);el.ondragstart=e=>{e.stopPropagation();el.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',el.dataset.boardCar)};el.ondragend=()=>el.classList.remove('dragging')});
  root.querySelectorAll('[data-board-drop]').forEach(zone=>{zone.ondragover=e=>{e.preventDefault();zone.classList.add('drag-over')};zone.ondragleave=()=>zone.classList.remove('drag-over');zone.ondrop=e=>{e.preventDefault();zone.classList.remove('drag-over');Status.set(e.dataTransfer.getData('text/plain'),zone.dataset.boardDrop);render();try{window.renderFleet?.()}catch{}try{window.renderDesktopCommandKpis?.()}catch{}}});
 }
 const style=document.createElement('style');style.textContent=`
 .fp20-board-car{border-left:4px solid #22c55e!important}
 .fp20-board-car.fp20-health-warning{border-left-color:#f59e0b!important;background:#fffbeb}
 .fp20-board-car.fp20-health-danger{border-left-color:#ef4444!important;background:#fef2f2}
 .fp20-board-main{min-width:0}
 .fp20-board-side{display:flex;align-items:center;gap:10px;margin-left:auto}
 .fp20-wrench{display:inline-grid;place-items:center;width:25px;height:25px;border-radius:8px;background:#fff;border:1px solid #e2e8f0;font-size:13px;line-height:1}
 html[data-theme="dark"] .fp20-board-car.fp20-health-warning{background:rgba(245,158,11,.10)}
 html[data-theme="dark"] .fp20-board-car.fp20-health-danger{background:rgba(239,68,68,.10)}
 html[data-theme="dark"] .fp20-wrench{background:#111827;border-color:#334155}
 `;document.head.appendChild(style);
 FP.FleetBoard=Object.freeze({render,health});
 window.renderDesktopBoard=render;window.renderFleetBoardV2=render;
 ['driver-assignment-changed','assignments-changed','vehicle-status-changed','service-changed'].forEach(name=>window.addEventListener(`fleetpilot:${name}`,()=>setTimeout(render,0)));
 document.addEventListener('click',e=>{if(e.target.closest('[data-fleet-view="board"]'))setTimeout(render,0)});
 requestAnimationFrame(()=>render());window.addEventListener('pageshow',()=>requestAnimationFrame(render));
 console.info('FleetPilot 20 fleet board ready');
})();