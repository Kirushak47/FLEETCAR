/* FleetPilot 20 — Core Runtime
   Shared namespace, database access, events and safe helpers. */
(()=>{
 'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 if(FP.Core)return;
 const bus=new EventTarget();
 // Legacy FleetPilot keeps `db` in the global lexical scope, so it is not guaranteed
 // to exist as window.db. During migration use the legacy fleetCars() bridge first.
 const legacyCars=()=>{try{return typeof window.fleetCars==='function'?window.fleetCars():null}catch{return null}};
 const db=()=>window.db||window.__FLEETPILOT_DB__||null;
 const cars=()=>{
  const direct=db();
  if(Array.isArray(direct?.cars))return direct.cars;
  const legacy=legacyCars();
  return Array.isArray(legacy)?legacy:[];
 };
 const activeCars=()=>cars().filter(c=>!c?.archived&&!c?.deletedAt);
 const same=(a,b)=>String(a??'')===String(b??'');
 const safe=(name,fn,fallback)=>{try{return fn()}catch(error){console.warn(`[FleetPilot:${name}]`,error);return fallback}};
 const emit=(name,detail={})=>{bus.dispatchEvent(new CustomEvent(name,{detail}));window.dispatchEvent(new CustomEvent(`fleetpilot:${name}`,{detail}))};
 const on=(name,handler)=>{const wrapped=e=>handler(e.detail,e);bus.addEventListener(name,wrapped);return()=>bus.removeEventListener(name,wrapped)};
 FP.Core=Object.freeze({db,cars,activeCars,same,safe,emit,on,bus});
 window.FleetPilotCore=FP.Core;
 console.info('FleetPilot 20 core runtime ready',activeCars().length,'cars');
})();