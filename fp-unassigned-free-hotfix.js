/* FleetPilot unassigned vehicle status guard — 2026-08-11 */
(()=>{
  'use strict';
  const same=(a,b)=>String(a??'')===String(b??'');
  const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
  const normalize=()=>{
    let changed=false;
    for(const c of cars()){
      if(!c||c.archived||c.deletedAt)continue;
      const hasDriver=Boolean(String(c.driverUserId||'').trim()||String(c.tenant||'').trim());
      if(String(c.status||'')==='repair')continue;
      if(!hasDriver&&String(c.status||'')!=='free'){
        c.status='free';
        changed=true;
      }
    }
    if(changed){try{window.save?.()}catch{}}
    try{window.renderFleet?.()}catch{}
    try{window.renderDesktopCommand?.()}catch{}
    try{window.scheduleDesktopLiveRefresh?.({preserveMapViewport:true})}catch{}
  };
  window.addEventListener('fleetpilot:driver-assignment-changed',normalize);
  window.addEventListener('fleetpilot:assignments-changed',normalize);
  window.addEventListener('fleetpilot:access-ready',()=>setTimeout(normalize,50));
  window.addEventListener('load',()=>setTimeout(normalize,100),{once:true});
  setTimeout(normalize,300);
})();
