/* FleetPilot 20 — Fleet Status Domain
   Only this module decides vehicle operational status.
   Rule: assigned driver => active; no driver + explicit heavy repair => repair; otherwise free. */
(()=>{
 'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 const Core=FP.Core;if(!Core)throw new Error('FleetPilot Core must load before Fleet Status');
 if(FP.FleetStatus)return;
 const hasDriver=car=>Boolean(car&&(car.driverUserId||car.driverName||String(car.tenant||'').trim()));
 const isRepairFlag=car=>Boolean(car?.fleetBoardRepair===true||car?.fleetBoardRepair==='true');
 const state=car=>hasDriver(car)?'active':isRepairFlag(car)?'repair':'free';
 const label=value=>({active:'На линии',on_line:'На линии',repair:'В ремонте',free:'Свободен'}[String(value||'')]||'Свободен');
 const sync=car=>{if(!car)return'free';const next=state(car);car.status=next;return next};
 const syncAll=()=>{let changed=false;for(const car of Core.activeCars()){const before=car.status;sync(car);if(before!==car.status)changed=true}if(changed)Core.safe('fleet-status-save',()=>window.save?.());return changed};
 const set=(carId,next)=>{
  const car=Core.activeCars().find(c=>Core.same(c.id,carId));if(!car)return false;
  next=next==='on_line'?'active':String(next||'');
  if(hasDriver(car)){
   car.fleetBoardRepair=false;car.status='active';Core.safe('fleet-status-save',()=>window.save?.());
   Core.emit('vehicle-status-changed',{carId:car.id,status:'active',source:'fleet-status'});
   if(next!=='active')window.toast?.('У автомобиля есть водитель — он остаётся «На линии»');
   return next==='active';
  }
  if(next==='repair')car.fleetBoardRepair=true;
  else if(next==='free')car.fleetBoardRepair=false;
  else if(next==='active'){window.toast?.('«На линии» включается автоматически после назначения водителя');return false}
  else return false;
  sync(car);Core.safe('fleet-status-save',()=>window.save?.());Core.emit('vehicle-status-changed',{carId:car.id,status:car.status,source:'fleet-status'});return true;
 };
 FP.FleetStatus=Object.freeze({hasDriver,isRepairFlag,state,label,sync,syncAll,set});
 window.vehicleEffectiveStatus=sync;window.statusText=label;window.setVehicleOperationalStatus=set;window.updateCarStatusLive=set;
 syncAll();
 console.info('FleetPilot 20 fleet status ready');
})();