/* FleetPilot assignment + Fleet Board domain separation v3 — 2026-08-11 */
(()=>{
  'use strict';

  const same=(a,b)=>String(a??'')===String(b??'');
  const now=()=>new Date().toISOString();
  const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
  const getCar=id=>typeof window.car==='function'?window.car(id):cars().find(c=>same(c.id,id));
  const validStatus=s=>['repair','free','on_line'].includes(String(s||''));
  let directClient=null;

  function normalizeLegacyStatus(c){
    if(!c)return;
    if(!validStatus(c.status)){
      c.status=c.driverUserId?'on_line':'free';
    }
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

  function getDirectClient(){
    if(directClient)return directClient;
    const cfg=window.FLEETPILOT_CLOUD_CONFIG||{};
    if(!window.supabase?.createClient||!cfg.url||!cfg.publishableKey)return null;
    directClient=window.supabase.createClient(cfg.url,cfg.publishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
    });
    return directClient
  }

  async function directAssignmentRpc(driverUserId,carId){
    const client=getDirectClient();
    if(!client)throw new Error('Supabase недоступен');
    const {data:{session}={}}=await client.auth.getSession();
    if(!session)throw new Error('Сессия Supabase не найдена');
    const {data,error}=await client.rpc('assign_driver_vehicle',{
      driver_user_id_value:String(driverUserId),
      car_id_value:carId?String(carId):null
    });
    if(error)throw error;
    return data
  }

  function installCloudFix(){
    const cloud=window.FleetPilotCloud;
    if(!cloud?.assignDriverVehicle||cloud.assignDriverVehicle.__fpDomainV3)return false;
    const legacy=cloud.assignDriverVehicle.bind(cloud);

    const fixed=async function(driverUserId,carId){
      const uid=String(driverUserId||'').trim();
      const wanted=carId?String(carId):null;
      if(!uid)return legacy(driverUserId,carId);

      const previous=cars().filter(c=>same(c.driverUserId,uid));
      const result=await directAssignmentRpc(uid,wanted);

      if(wanted){
        const target=getCar(wanted);
        for(const c of previous){
          if(c!==target){
            c.driverUserId='';c.driverEmail='';c.driverName='';c.driverPhone='';
            c.driverAcceptedAt='';c.driverAcceptedRevision='';c.driverAssignedAt='';
            if(c.driverAssignmentSource==='account'){c.tenant='';c.driverAssignmentSource=''}
            c.status='free';
          }
        }
        if(target){
          const isSameActive=same(target.driverUserId,uid)&&Boolean(target.driverAssignmentRevision);
          target.driverUserId=uid;
          target.driverAssignmentSource='account';
          if(!isSameActive){
            startFreshCycle(target,uid);
            if(target.status!=='repair')target.status='on_line';
          }else{
            normalizeLegacyStatus(target);
          }
        }
      }else{
        for(const c of previous){
          c.driverUserId='';c.driverEmail='';c.driverName='';c.driverPhone='';
          c.driverAcceptedAt='';c.driverAcceptedRevision='';c.driverAssignedAt='';
          if(c.driverAssignmentSource==='account'){c.tenant='';c.driverAssignmentSource=''}
          // Explicit business rule: company unassigns vehicle => vehicle becomes free.
          c.status='free';
        }
      }

      try{window.save?.()}catch{}
      refresh(wanted||previous[0]?.id||'');
      window.dispatchEvent(new CustomEvent('fleetpilot:driver-assignment-changed',{
        detail:{driverUserId:uid,carId:wanted||'',status:wanted?'pending':'unassigned'}
      }));
      return result
    };

    fixed.__fpDomainV3=true;
    fixed.__fpOriginal=legacy;
    cloud.assignDriverVehicle=fixed;
    return true
  }

  function installUnifiedAssign(){
    if(typeof window.assignVehicleDriverUnified!=='function'||window.assignVehicleDriverUnified.__fpDomainV3)return;
    const original=window.assignVehicleDriverUnified;
    const fixed=async function(driverUserId,carId,options={}){
      const uid=String(driverUserId||'').trim();
      const cid=String(carId||'').trim();
      if(!uid)throw new Error('Водитель не выбран');
      if(!cid)throw new Error('Автомобиль не выбран');
      const target=getCar(cid);
      if(!target)throw new Error('Автомобиль не найден');

      if(same(target.driverUserId,uid)&&target.driverAssignmentRevision){
        if(options.email)target.driverEmail=options.email;
        if(options.name){target.driverName=options.name;target.tenant=options.name}
        if(options.phone)target.driverPhone=options.phone;
        normalizeLegacyStatus(target);
        try{window.save?.()}catch{}
        refresh(cid);
        return target
      }

      const result=await original.call(this,uid,cid,options);
      const actual=result||target;
      actual.driverUserId=uid;
      normalizeLegacyStatus(actual);
      try{window.save?.()}catch{}
      refresh(cid);
      return result
    };
    fixed.__fpDomainV3=true;
    fixed.__fpOriginal=original;
    window.assignVehicleDriverUnified=fixed;
  }

  function installUnifiedUnassign(){
    if(typeof window.unassignVehicleDriverUnified!=='function'||window.unassignVehicleDriverUnified.__fpDomainV3)return;
    const original=window.unassignVehicleDriverUnified;
    const fixed=async function(driverUserId,carId=''){
      const affected=cars().filter(c=>same(c.driverUserId,driverUserId)||(carId&&same(c.id,carId)));
      const result=await original.apply(this,arguments);
      for(const c of affected){
        if(!c.driverUserId)c.status='free';
      }
      try{window.save?.()}catch{}
      refresh(carId||affected[0]?.id||'');
      return result
    };
    fixed.__fpDomainV3=true;
    fixed.__fpOriginal=original;
    window.unassignVehicleDriverUnified=fixed;
  }

  function install(){
    if(window.__fpDriverAssignmentDomainV3)return;
    window.__fpDriverAssignmentDomainV3=true;
    for(const c of cars())normalizeLegacyStatus(c);
    try{window.save?.()}catch{}
    installCloudFix();
    installUnifiedAssign();
    installUnifiedUnassign();
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      installCloudFix();
      installUnifiedAssign();
      installUnifiedUnassign();
      if(window.FleetPilotCloud?.assignDriverVehicle?.__fpDomainV3||attempts>40)clearInterval(timer)
    },100);
  }

  install();
})();
