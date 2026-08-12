/* FleetPilot 20 — Core Runtime
   Shared namespace, database access, events and safe helpers.
   New modules should depend on this file instead of reaching into unrelated UI files. */
(()=>{
 'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 if(FP.Core)return;
 const bus=new EventTarget();
 const db=()=>typeof window.db!=='undefined'?window.db:(typeof globalThis.db!=='undefined'?globalThis.db:null);
 const cars=()=>Array.isArray(db()?.cars)?db().cars:[];
 const activeCars=()=>cars().filter(c=>!c?.archived&&!c?.deletedAt);
 const same=(a,b)=>String(a??'')===String(b??'');
 const safe=(name,fn,fallback)=>{try{return fn()}catch(error){console.warn(`[FleetPilot:${name}]`,error);return fallback}};
 const emit=(name,detail={})=>{bus.dispatchEvent(new CustomEvent(name,{detail}));window.dispatchEvent(new CustomEvent(`fleetpilot:${name}`,{detail}))};
 const on=(name,handler)=>{bus.addEventListener(name,e=>handler(e.detail,e));return()=>bus.removeEventListener(name,handler)};
 FP.Core=Object.freeze({db,cars,activeCars,same,safe,emit,on,bus});
 window.FleetPilotCore=FP.Core;
 console.info('FleetPilot 20 core runtime ready');
})();