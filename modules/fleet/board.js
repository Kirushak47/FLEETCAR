/* FleetPilot 20 — Fleet Board UI
   Pure renderer over FleetStatus. It does not own driver assignments, router or Supabase. */
(()=>{
 'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 const Core=FP.Core,Status=FP.FleetStatus;if(!Core||!Status)throw new Error('FleetPilot Core/Status must load before Fleet Board');
 if(FP.FleetBoard)return;
 const card=car=>{const m=typeof window.model==='function'?window.model(car):{};return `<article class="desktop-board-car fp20-board-car" draggable="true" data-board-car="${car.id}" data-fleet-car-id="${car.id}"><div><strong>${m.brand||'Автомобиль'} ${m.model||''}</strong><small>${car.plate||'Без номера'}${car.city?` · ${car.city}`:''}</small></div><span>${Status.hasDriver(car)?(car.tenant||car.driverName||'Водитель'):'Без водителя'}</span></article>`};
 function render(){
  const root=document.querySelector('#desktopFleetBoard');if(!root)return;
  Status.syncAll();
  const groups={active:[],repair:[],free:[]};for(const car of Core.activeCars())groups[Status.state(car)].push(car);
  root.innerHTML=['active','repair','free'].map(state=>`<section class="desktop-board-column"><div class="desktop-board-column-head"><strong>${Status.label(state)}</strong><span>${groups[state].length}</span></div><div class="desktop-board-dropzone" data-board-drop="${state}">${groups[state].map(card).join('')||'<div class="desktop-board-empty">Нет автомобилей</div>'}</div></section>`).join('');
  root.querySelectorAll('[data-board-car]').forEach(el=>{el.onclick=()=>window.openCar?.(el.dataset.boardCar);el.ondragstart=e=>{e.stopPropagation();el.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',el.dataset.boardCar)};el.ondragend=()=>el.classList.remove('dragging')});
  root.querySelectorAll('[data-board-drop]').forEach(zone=>{zone.ondragover=e=>{e.preventDefault();zone.classList.add('drag-over')};zone.ondragleave=()=>zone.classList.remove('drag-over');zone.ondrop=e=>{e.preventDefault();zone.classList.remove('drag-over');Status.set(e.dataTransfer.getData('text/plain'),zone.dataset.boardDrop);render();try{window.renderFleet?.()}catch{}try{window.renderDesktopCommandKpis?.()}catch{}}});
 }
 FP.FleetBoard=Object.freeze({render});
 window.renderDesktopBoard=render;window.renderFleetBoardV2=render;
 ['driver-assignment-changed','assignments-changed','vehicle-status-changed'].forEach(name=>window.addEventListener(`fleetpilot:${name}`,()=>setTimeout(render,0)));
 document.addEventListener('click',e=>{if(e.target.closest('[data-fleet-view="board"]'))setTimeout(render,0)});
 // The module is loaded after legacy boot. If Board was already the saved view,
 // no click event occurs, so render once immediately after installing the override.
 requestAnimationFrame(()=>render());
 window.addEventListener('pageshow',()=>requestAnimationFrame(render));
 console.info('FleetPilot 20 fleet board ready');
})();