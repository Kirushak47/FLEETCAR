/* FleetPilot driver assignment + Fleet Board consistency hotfix — 2026-08-11 */
(()=>{
  'use strict';

  const same=(a,b)=>String(a??'')===String(b??'');
  const now=()=>new Date().toISOString();
  const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
  const getCar=id=>typeof window.car==='function'?window.car(id):cars().find(c=>same(c.id,id));

  function normalizeOperationalStatus(c){
    if(!c)return;
    const value=String(c.status||'').toLowerCase();
    // Fleet Board owns vehicle operation state. Assignment/acceptance is a separate flow.
    // Only migrate old assignment-like pseudo statuses; never overwrite repair/free.
    if(['pending','assigned','accepted','awaiting_acceptance','waiting_acceptance','ожидает приёмки','ожидает приемки'].includes(value)){
      c.status='on_line';
    }
    if(!['repair','free','on_line'].includes(String(c.status||'')))c.status='on_line';
  }

  function refreshAssignmentUi(carId=''){
    try{window.renderFleet?.()}catch{}
    try{window.renderDriversRegistry?.()}catch{}
    try{window.renderDesktopCommand?.()}catch{}
    try{window.scheduleDesktopLiveRefresh?.({preserveMapViewport:true})}catch{}
    try{
      if(carId&&same(window.selectedCarId,carId)&&document.querySelector('#carPage')?.classList.contains('active')){
        window.openCar?.(carId)
      }
    }catch{}
  }

  function startFreshAssignmentCycle(c,uid){
    if(!c||!uid)return;
    normalizeOperationalStatus(c);
    c.driverAcceptedAt='';
    c.driverAcceptedRevision='';
    c.driverAssignedAt=now();
    c.driverAssignmentRevision=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    try{
      window.addVehicleHandoverAudit?.(c,'assigned',{
        key:`assigned:${c.driverAssignmentRevision}`,
        revision:c.driverAssignmentRevision,
        at:c.driverAssignedAt,
        driverUserId:uid,
        driverName:c.driverName||c.tenant||'',
        driverEmail:c.driverEmail||'',
        mileage:c.mileage
      })
    }catch{}
  }

  function installCloudAssignmentFix(){
    const cloud=window.FleetPilotCloud;
    if(!cloud?.assignDriverVehicle||cloud.assignDriverVehicle.__fpAssignmentFixed)return false;
    const original=cloud.assignDriverVehicle.bind(cloud);

    const fixed=async function(driverUserId,carId){
      const uid=String(driverUserId||'').trim();
      const wanted=carId?String(carId):null;
      if(!uid)return original(driverUserId,carId);

      const list=cars();
      const snapshots=list.map(c=>({c,driverUserId:c.driverUserId}));
      let sentinel=null;

      try{
        if(wanted){
          // The car form writes driverUserId into the shared fleet state before calling
          // assignDriverVehicle(). The old idempotency check then incorrectly thought the
          // backend was already assigned and skipped the Supabase RPC. Hide only the local
          // link while the original function performs its check so a real assignment RPC runs.
          for(const row of snapshots){
            if(same(row.c.driverUserId,uid))row.c.driverUserId='';
          }
        }else{
          // When the form already replaced the previous driver locally, the old driver is no
          // longer visible in getDriverAssignments(). Force the detach RPC instead of skipping it.
          const locallyAssigned=list.some(c=>same(c.driverUserId,uid));
          if(!locallyAssigned&&list.length){
            sentinel=list.find(c=>!c.deletedAt)||list[0];
            if(sentinel)sentinel.driverUserId=uid;
          }
        }

        return await original(uid,wanted)
      }finally{
        for(const row of snapshots)row.c.driverUserId=row.driverUserId;
        if(wanted){
          const target=getCar(wanted);
          if(target&&same(target.driverUserId,uid)){
            // Any real backend assignment begins one acceptance cycle. Ordinary vehicle edits
            // never call this function because the form checks previousDriverUserId first.
            startFreshAssignmentCycle(target,uid);
            try{window.save?.()}catch{}
            refreshAssignmentUi(wanted);
            window.dispatchEvent(new CustomEvent('fleetpilot:driver-assignment-changed',{
              detail:{driverUserId:uid,carId:wanted,status:'pending'}
            }))
          }
        }else{
          refreshAssignmentUi('')
        }
      }
    };
    fixed.__fpAssignmentFixed=true;
    fixed.__fpOriginal=original;
    cloud.assignDriverVehicle=fixed;
    return true
  }

  function installUnifiedAssignmentFix(){
    if(typeof window.assignVehicleDriverUnified!=='function'||window.assignVehicleDriverUnified.__fpAssignmentFixed)return;
    const original=window.assignVehicleDriverUnified;

    const fixed=async function(driverUserId,carId,options={}){
      const uid=String(driverUserId||'').trim();
      const cid=String(carId||'').trim();
      if(!uid)throw new Error('Водитель не выбран');
      if(!cid)throw new Error('Автомобиль не выбран');
      const target=getCar(cid);
      if(!target)throw new Error('Автомобиль не найден');

      // Re-saving/re-selecting the SAME driver is not a new assignment and must never
      // make the driver accept the vehicle again.
      if(same(target.driverUserId,uid)){
        normalizeOperationalStatus(target);
        if(options.email)target.driverEmail=options.email;
        if(options.name){target.driverName=options.name;target.tenant=options.name}
        if(options.phone)target.driverPhone=options.phone;
        try{window.save?.()}catch{}
        refreshAssignmentUi(cid);
        return target
      }

      // The original pipeline is kept for directory/name/audit handling. The cloud wrapper
      // above guarantees that its detach + assign calls really reach Supabase.
      const result=await original.call(this,uid,cid,options);
      normalizeOperationalStatus(result||target);
      try{window.save?.()}catch{}
      refreshAssignmentUi(cid);
      return result
    };
    fixed.__fpAssignmentFixed=true;
    fixed.__fpOriginal=original;
    window.assignVehicleDriverUnified=fixed;
  }

  function installFleetBoardGuards(){
    // Assignment events only refresh the operational board; they never derive status from
    // pending/accepted handover state.
    window.addEventListener('fleetpilot:driver-assignment-changed',event=>{
      const cid=event?.detail?.carId||'';
      const c=getCar(cid);
      if(c){normalizeOperationalStatus(c);try{window.save?.()}catch{}}
      refreshAssignmentUi(cid)
    });

    window.addEventListener('fleetpilot:assignments-changed',async()=>{
      try{await window.loadWorkspaceDriverAssignments?.()}catch{}
      for(const c of cars())normalizeOperationalStatus(c);
      refreshAssignmentUi('')
    });
  }

  function install(){
    if(window.__fpDriverAssignmentHotfixInstalled)return;
    window.__fpDriverAssignmentHotfixInstalled=true;
    installCloudAssignmentFix();
    installUnifiedAssignmentFix();
    installFleetBoardGuards();

    // FleetPilotCloud can finish initialization slightly after window load on slower devices.
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      const cloudReady=installCloudAssignmentFix();
      installUnifiedAssignmentFix();
      if(window.FleetPilotCloud?.assignDriverVehicle?.__fpAssignmentFixed||attempts>30)clearInterval(timer)
    },100);
  }

  install();
})();
