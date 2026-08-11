/* FleetPilot assignment + Fleet Board domain separation v3.1 — 2026-08-11 */
(()=>{
  'use strict';

  const same=(a,b)=>String(a??'')===String(b??'');
  const now=()=>new Date().toISOString();
  const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
  const getCar=id=>typeof window.car==='function'?window.car(id):cars().find(c=>same(c.id,id));
  const validStatus=s=>['repair','free','active','on_line'].includes(String(s||''));

  function normalizeLegacyStatus(c){
    if(!c)return;
    if(!validStatus(c.status))c.status=c.driverUserId?'active':'free';
    if(c.status==='on_line')c.status='active';
  }

  function refresh(carId=''){
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

  function startFreshCycle(c,uid){
    if(!c||!uid)return;
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

  async function assignmentRpc(driverUserId,carId){
    const cloud=window.FleetPilotCloud;
    if(!cloud?.session?.access_token)throw new Error('Сессия Supabase не найдена');
    const cfg=window.FLEETPILOT_CLOUD_CONFIG||{};
    if(!cfg.url||!cfg.publishableKey)throw new Error('Supabase недоступен');
    const response=await fetch(`${cfg.url}/rest/v1/rpc/assign_driver_vehicle`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':cfg.publishableKey,
        'Authorization':`Bearer ${cloud.session.access_token}`
      },
      body:JSON.stringify({
        driver_user_id_value:String(driverUserId),
        car_id_value:carId?String(carId):null
      })
    });
    if(!response.ok){
      let detail='';try{detail=(await response.json())?.message||''}catch{}
      throw new Error(detail||`assign_driver_vehicle HTTP ${response.status}`)
    }
    try{return await response.json()}catch{return null}
  }

  function installCloudFix(){
    const cloud=window.FleetPilotCloud;
    if(!cloud?.assignDriverVehicle||cloud.assignDriverVehicle.__fpDomainV31)return false;

    const fixed=async function(driverUserId,carId){
      const uid=String(driverUserId||'').trim();
      const wanted=carId?String(carId):null;
      if(!uid)throw new Error('Водитель не выбран');

      const previous=cars().filter(c=>same(c.driverUserId,uid));
      const result=await assignmentRpc(uid,wanted);

      if(wanted){
        const target=getCar(wanted);
        for(const c of previous){
          if(c!==target){
            c.driverUserId='';c.driverEmail='';c.driverName='';c.driverPhone='';
            c.driverAcceptedAt='';c.driverAcceptedRevision='';c.driverAssignedAt='';
            if(c.driverAssignmentSource==='account'){c.tenant='';c.driverAssignmentSource=''}
            if(c.status!=='repair')c.status='free';
          }
        }
        if(target){
          const isSameActive=same(target.driverUserId,uid)&&Boolean(target.driverAssignmentRevision);
          target.driverUserId=uid;
          target.driverAssignmentSource='account';
          if(!isSameActive){
            startFreshCycle(target,uid);
            if(target.status!=='repair')target.status='active';
          }else normalizeLegacyStatus(target);
        }
      }else{
        for(const c of previous){
          c.driverUserId='';c.driverEmail='';c.driverName='';c.driverPhone='';
          c.driverAcceptedAt='';c.driverAcceptedRevision='';c.driverAssignedAt='';
          if(c.driverAssignmentSource==='account'){c.tenant='';c.driverAssignmentSource=''}
          if(c.status!=='repair')c.status='free';
        }
      }

      try{window.save?.()}catch{}
      refresh(wanted||previous[0]?.id||'');
      window.dispatchEvent(new CustomEvent('fleetpilot:driver-assignment-changed',{
        detail:{driverUserId:uid,carId:wanted||'',status:wanted?'pending':'unassigned'}
      }));
      return result
    };

    fixed.__fpDomainV31=true;
    cloud.assignDriverVehicle=fixed;
    return true
  }

  function installUnifiedAssign(){
    if(typeof window.assignVehicleDriverUnified!=='function'||window.assignVehicleDriverUnified.__fpDomainV31)return;
    const original=window.assignVehicleDriverUnified;
    const fixed=async function(driverUserId,carId,options={}){
      const uid=String(driverUserId||'').trim(),cid=String(carId||'').trim();
      if(!uid)throw new Error('Водитель не выбран');
      if(!cid)throw new Error('Автомобиль не выбран');
      const target=getCar(cid);if(!target)throw new Error('Автомобиль не найден');
      const result=await original.call(this,uid,cid,options);
      const actual=result||target;
      actual.driverUserId=uid;
      if(options.email)actual.driverEmail=options.email;
      if(options.name){actual.driverName=options.name;actual.tenant=options.name}
      if(options.phone)actual.driverPhone=options.phone;
      normalizeLegacyStatus(actual);
      try{window.save?.()}catch{}
      refresh(cid);
      return result
    };
    fixed.__fpDomainV31=true;fixed.__fpOriginal=original;
    window.assignVehicleDriverUnified=fixed;
  }

  function installUnifiedUnassign(){
    if(typeof window.unassignVehicleDriverUnified!=='function'||window.unassignVehicleDriverUnified.__fpDomainV31)return;
    const original=window.unassignVehicleDriverUnified;
    const fixed=async function(driverUserId,carId=''){
      const affected=cars().filter(c=>same(c.driverUserId,driverUserId)||(carId&&same(c.id,carId)));
      const result=await original.apply(this,arguments);
      for(const c of affected){if(!c.driverUserId&&c.status!=='repair')c.status='free'}
      try{window.save?.()}catch{}
      refresh(carId||affected[0]?.id||'');
      return result
    };
    fixed.__fpDomainV31=true;fixed.__fpOriginal=original;
    window.unassignVehicleDriverUnified=fixed;
  }

  function install(){
    for(const c of cars())normalizeLegacyStatus(c);
    try{window.save?.()}catch{}
    installCloudFix();installUnifiedAssign();installUnifiedUnassign();
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;installCloudFix();installUnifiedAssign();installUnifiedUnassign();
      if(window.FleetPilotCloud?.assignDriverVehicle?.__fpDomainV31||attempts>40)clearInterval(timer)
    },100);
  }

  install();
})();
