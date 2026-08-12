/* FleetPilot Fleet Board V2.1 — one simple source of truth */
(()=>{
'use strict';
if(window.__fpFleetBoardV21)return;window.__fpFleetBoardV21=true;
const getDb=()=>typeof db!=='undefined'?db:window.db;
const cars=()=>Array.isArray(getDb()?.cars)?getDb().cars.filter(c=>!c.archived&&!c.deletedAt):[];
const carById=id=>cars().find(c=>String(c.id)===String(id));
const hasDriver=c=>Boolean(c&&(c.driverUserId||c.driverName||String(c.tenant||'').trim()));
const manualRepair=c=>Boolean(c?.fleetBoardRepair===true||c?.fleetBoardRepair==='true');
const state=c=>hasDriver(c)?'active':manualRepair(c)?'repair':'free';
const label=s=>s==='active'||s==='on_line'?'На линии':s==='repair'?'В ремонте':'Свободен';
function sync(c){if(!c)return'free';const s=state(c);c.status=s;return s}
function syncAll(){let changed=false;for(const c of cars()){const before=c.status;sync(c);if(before!==c.status)changed=true}if(changed){try{window.save?.()}catch{}}return changed}
function card(c){const m=typeof window.model==='function'?window.model(c):{};return `<article class="desktop-board-car fp-board2-card" draggable="true" data-board-car="${c.id}" data-fb2-car="${c.id}" data-fleet-car-id="${c.id}"><div><strong>${m.brand||'Автомобиль'} ${m.model||''}</strong><small>${c.plate||'Без номера'}${c.city?` · ${c.city}`:''}</small></div><span>${hasDriver(c)?(c.tenant||c.driverName||'Водитель'):'Без водителя'}</span></article>`}
function render(){const root=document.querySelector('#desktopFleetBoard');if(!root)return;syncAll();const groups={active:[],repair:[],free:[]};for(const c of cars())groups[state(c)].push(c);root.innerHTML=['active','repair','free'].map(s=>`<section class="desktop-board-column fp-board2-column"><div class="desktop-board-column-head"><strong>${label(s)}</strong><span>${groups[s].length}</span></div><div class="desktop-board-dropzone fp-board2-list" data-board-drop="${s}" data-fb2-drop="${s}">${groups[s].map(card).join('')||'<div class="desktop-board-empty">Нет автомобилей</div>'}</div></section>`).join('');root.querySelectorAll('[data-fb2-car]').forEach(el=>{el.onclick=()=>window.openCar?.(el.dataset.fb2Car);el.ondragstart=e=>{e.stopPropagation();e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',el.dataset.fb2Car);el.classList.add('dragging')};el.ondragend=()=>el.classList.remove('dragging')});root.querySelectorAll('[data-fb2-drop]').forEach(zone=>{zone.ondragover=e=>{e.preventDefault();zone.classList.add('drag-over')};zone.ondragleave=()=>zone.classList.remove('drag-over');zone.ondrop=e=>{e.preventDefault();zone.classList.remove('drag-over');window.setVehicleOperationalStatus(e.dataTransfer.getData('text/plain'),zone.dataset.fb2Drop)}})}
function refresh(){syncAll();render();try{window.renderStableFleetTable?.()}catch{};try{window.renderDesktopCommandKpis?.()}catch{}}
window.FleetPilotFleetBoard=Object.freeze({state,label,hasDriver,manualRepair,sync,syncAll,render});
window.vehicleEffectiveStatus=c=>sync(c);
window.statusText=label;
window.renderDesktopBoard=render;
window.renderFleetBoardV2=render;
window.setVehicleOperationalStatus=function(carId,next){const c=carById(carId);if(!c)return false;next=next==='on_line'?'active':String(next||'');if(hasDriver(c)){c.fleetBoardRepair=false;c.status='active';try{window.save?.()}catch{};refresh();if(next!=='active')window.toast?.('У автомобиля есть водитель — он остаётся «На линии»');return next==='active'}if(next==='repair')c.fleetBoardRepair=true;else if(next==='free')c.fleetBoardRepair=false;else if(next==='active'){window.toast?.('«На линии» включается автоматически после назначения водителя');return false}else return false;sync(c);try{window.save?.()}catch{};refresh();return true};
window.updateCarStatusLive=(id,s)=>window.setVehicleOperationalStatus(id,s);
const style=document.createElement('style');style.textContent=`#desktopFleetBoard{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.fp-board2-card>span{font-size:11px;color:#64748b}.fp-board2-card{cursor:grab}@media(max-width:900px){#desktopFleetBoard{grid-template-columns:1fr}}`;document.head.appendChild(style);
let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(refresh,60)};['fleetpilot:driver-assignment-changed','fleetpilot:assignments-changed','fleetpilot:authoritative-assignments','fleetpilot:access-ready'].forEach(n=>window.addEventListener(n,schedule));document.addEventListener('click',e=>{if(e.target.closest('[data-fleet-view="board"]'))setTimeout(render,20)});setInterval(()=>{const panel=document.querySelector('#desktopBoardView');if(panel&&!panel.hidden)render()},1200);setTimeout(refresh,0);
console.info('FleetPilot Fleet Board V2.1 active');
})();