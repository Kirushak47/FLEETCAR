/* FleetPilot 20 — Fleet Board renderer using the proven V19 UI/health presentation.
   IMPORTANT: only the Fleet Board presentation is V19. Operational status ownership stays in FleetStatus. */
(()=>{
 'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 const Core=FP.Core,Status=FP.FleetStatus;
 if(!Core||!Status)throw new Error('FleetPilot Core/Status must load before Fleet Board');
 if(FP.FleetBoard)return;

 function boardCars(){
  Status.syncAll();
  return Core.activeCars()
 }

 function health(car){
  try{
   if(typeof window.healthDetails==='function')return window.healthDetails(car)||{level:'good',items:[]};
  }catch(error){console.warn('Fleet Board V19 health fallback',error)}
  return{level:'good',items:[]}
 }

 function serviceBadge(carId){
  try{return typeof window.fleetServiceBadgeMarkup==='function'?window.fleetServiceBadgeMarkup(carId,true):''}
  catch(error){console.warn('Fleet Board V19 service badge fallback',error);return''}
 }

 function render(){
  const root=document.querySelector('#desktopFleetBoard');
  if(!root)return;
  const cars=boardCars();
  const statuses=['active','repair','free'];

  root.innerHTML=statuses.map(status=>{
   const rows=cars.filter(car=>Status.state(car)===status);
   return `<section class="desktop-board-column">
    <div class="desktop-board-column-head"><strong>${Status.label(status)}</strong><span>${rows.length}</span></div>
    <div class="desktop-board-dropzone" data-board-drop="${status}">
     ${rows.map(car=>{
      const m=typeof window.model==='function'?window.model(car):{brand:'Автомобиль',model:''};
      const h=health(car);
      return `<article class="desktop-board-car health-${h.level||'good'}" draggable="true" data-board-car="${car.id}" data-fleet-car-id="${car.id}" onclick="openCar('${car.id}')">
       ${serviceBadge(car.id)}
       <div><strong>${m.brand||'Автомобиль'} ${m.model||''}</strong><small>${car.plate||'Без номера'}${car.city?` · ${car.city}`:''}</small></div>
       <span>${Array.isArray(h.items)&&h.items.length?h.items[0].value:'OK'}</span>
      </article>`
     }).join('')||'<div class="desktop-board-empty">Нет автомобилей</div>'}
    </div>
   </section>`
  }).join('');

  root.querySelectorAll('[data-board-car]').forEach(card=>{
   card.ondragstart=e=>{
    e.stopPropagation();
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed='move';
    e.dataTransfer.setData('text/plain',card.dataset.boardCar)
   };
   card.ondragend=()=>card.classList.remove('dragging')
  });

  root.querySelectorAll('[data-board-drop]').forEach(zone=>{
   zone.ondragover=e=>{e.preventDefault();zone.classList.add('drag-over')};
   zone.ondragleave=()=>zone.classList.remove('drag-over');
   zone.ondrop=e=>{
    e.preventDefault();
    zone.classList.remove('drag-over');
    Status.set(e.dataTransfer.getData('text/plain'),zone.dataset.boardDrop);
    render();
    try{window.renderFleet?.()}catch{}
    try{window.renderDesktopCommandKpis?.()}catch{}
   }
  })
 }

 FP.FleetBoard=Object.freeze({render});
 window.renderDesktopBoard=render;
 window.renderFleetBoardV2=render;
 ['driver-assignment-changed','assignments-changed','vehicle-status-changed','service-changed'].forEach(name=>window.addEventListener(`fleetpilot:${name}`,()=>setTimeout(render,0)));
 document.addEventListener('click',e=>{if(e.target.closest('[data-fleet-view="board"]'))setTimeout(render,0)});
 requestAnimationFrame(render);
 window.addEventListener('pageshow',()=>requestAnimationFrame(render));
 console.info('FleetPilot Fleet Board: V19 presentation active');
})();