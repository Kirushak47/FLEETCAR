/* FleetPilot driver assignment + Fleet Board consistency hotfix — 2026-08-11 */
(()=>{
  'use strict';

  const same=(a,b)=>String(a??'')===String(b??'');
  const now=()=>new Date().toISOString();
  const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
  const getCar=id=>typeof window.car==='function'?window.car(id):cars().find(c=>same(c.id,id));
  let directClient=null;

  function normalizeOperationalStatus(c){
    if(!c)return;
    const value=String(c.status||'').toLowerCase();
    if(['pending','assigned','accepted','awaiting_acceptance','waiting_acceptance','ожидает приёмки','ожидает приемки','active'].includes(value)){
      c.status=c.driverUserId?'on_line':'free';
    }
    if(!['repair','free','on_line'].includes(String(c.status||''))){
      c.status=c.driverUserId?'on_line':'free';
    }
    // Hard business rule: a vehicle without an assigned driver is always free.
    if(!c.driverUserId)c.status='free';
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
    c.driverAcceptedAt='';
    c.driverAcceptedRevision='';
    c.driverAssignedAt=now();
    c.driverAssignmentRevision=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    // A newly assigned vehicle starts on line. Fleet Board may later explicitly
    // change it to repair/free/on_line without assignment code overriding that choice.
    if(c.status!=='repair')c.status='on_line';
    normalizeOperationalStatus(c);
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

  function installCloudAssignmentFix(){
    const cloud=window.FleetPilotCloud;
    if(!cloud?.assignDriverVehicle||cloud.assignDriverVehicle.__fpDirectAssignmentFixedV3)return false;
    const legacy=cloud.assignDriverVehicle.bind(cloud);

    const fixed=async function(driverUserId,carId){
      const uid=String(driverUserId||'').trim();
      const wanted=carId?String(carId):null;
      if(!uid)return legacy(driverUserId,carId);

      const before=cars().filter(c=>same(c.driverUserId,uid));
      const result=await directAssignmentRpc(uid,wanted);

      if(wanted){
        const target=getCar(wanted);
        for(const c of cars()){
          if(c!==target&&same(c.driverUserId,uid)){
            try{
              const accepted=window.currentAssignmentAcceptedLocally?.(c);
              window.addVehicleHandoverAudit?.(c,accepted?'forced_return':'assignment_cancelled',{
                key:`${accepted?'forced_return':'assignment_cancelled'}:${c.driverAssignmentRevision||Date.now()}`,
                revision:c.driverAssignmentRevision||'',driverUserId:c.driverUserId,
                driverName:c.driverName,driverEmail:c.driverEmail,mileage:c.mileage,
                notes:accepted?'Забран партнёром':'Назначение отменено компанией'
              })
            }catch{}
            c.driverUserId='';c.driverEmail='';c.driverName='';c.driverPhone='';c.driverAcceptedAt='';c.driverAcceptedRevision='';c.driverAssignedAt='';
            if(c.driverAssignmentSource==='account'){c.tenant='';c.driverAssignmentSource=''}
            normalizeOperationalStatus(c)
          }
        }
        if(target){
          const wasSame=same(target.driverUserId,uid)&&Boolean(target.driverAssignmentRevision);
          target.driverUserId=uid;
          target.driverAssignmentSource='account';
          if(!wasSame)startFreshAssignmentCycle(target,uid);
          else normalizeOperationalStatus(target)
        }
      }else{
        for(const c of before){
          try{
            const accepted=window.currentAssignmentAcceptedLocally?.(c);
            window.addVehicleHandoverAudit?.(c,accepted?'forced_return':'assignment_cancelled',{
              key:`${accepted?'forced_return':'assignment_cancelled'}:${c.driverAssignmentRevision||Date.now()}`,
              revision:c.driverAssignmentRevision||'',driverUserId:c.driverUserId,
              driverName:c.driverName,driverEmail:c.driverEmail,mileage:c.mileage,
              notes:accepted?'Забран партнёром':'Назначение отменено компанией'
            })
          }catch{}
          c.driverUserId='';c.driverEmail='';c.driverName='';c.driverPhone='';c.driverAcceptedAt='';c.driverAcceptedRevision='';c.driverAssignedAt='';
          if(c.driverAssignmentSource==='account'){c.tenant='';c.driverAssignmentSource=''}
          normalizeOperationalStatus(c)
        }
      }

      try{window.save?.()}catch{}
      refreshAssignmentUi(wanted||before[0]?.id||'');
      window.dispatchEvent(new CustomEvent('fleetpilot:driver-assignment-changed',{
        detail:{driverUserId:uid,carId:wanted||'',status:wanted?'pending':'unassigned'}
      }));
      return result
    };

    fixed.__fpDirectAssignmentFixed=true;
    fixed.__fpDirectAssignmentFixedV3=true;
    fixed.__fpOriginal=legacy;
    cloud.assignDriverVehicle=fixed;
    return true
  }

  function installUnifiedAssignmentFix(){
    if(typeof window.assignVehicleDriverUnified!=='function'||window.assignVehicleDriverUnified.__fpAssignmentFixedV3)return;
    const original=window.assignVehicleDriverUnified;

    const fixed=async function(driverUserId,carId,options={}){
      const uid=String(driverUserId||'').trim();
      const cid=String(carId||'').trim();
      if(!uid)throw new Error('Водитель не выбран');
      if(!cid)throw new Error('Автомобиль не выбран');
      const target=getCar(cid);
      if(!target)throw new Error('Автомобиль не найден');

      // Editing the same already-active assignment is idempotent: do not force
      // another acceptance merely because the vehicle profile was saved.
      if(same(target.driverUserId,uid)&&target.driverAssignmentRevision){
        if(options.email)target.driverEmail=options.email;
        if(options.name){target.driverName=options.name;target.tenant=options.name}
        if(options.phone)target.driverPhone=options.phone;
        normalizeOperationalStatus(target);
        try{window.save?.()}catch{}
        refreshAssignmentUi(cid);
        return target
      }

      // A real new/re-assignment first closes the old vehicle with the backend
      // ("Забран партнёром" when it had been accepted), then creates a fresh
      // assignment that requires mileage + photos again.
      const result=await original.call(this,uid,cid,options);
      const actual=result||target;
      actual.driverUserId=uid;
      if(!actual.driverAssignmentRevision)startFreshAssignmentCycle(actual,uid);
      normalizeOperationalStatus(actual);
      try{window.save?.()}catch{}
      refreshAssignmentUi(cid);
      return result
    };
    fixed.__fpAssignmentFixedV3=true;
    fixed.__fpOriginal=original;
    window.assignVehicleDriverUnified=fixed;
  }

  function installUnassignGuard(){
    if(typeof window.unassignVehicleDriverUnified!=='function'||window.unassignVehicleDriverUnified.__fpFreeStatusFixedV3)return;
    const original=window.unassignVehicleDriverUnified;
    const fixed=async function(driverUserId,carId=''){
      const affected=cars().filter(c=>same(c.driverUserId,driverUserId)||(carId&&same(c.id,carId)));
      const result=await original.apply(this,arguments);
      for(const c of affected){
        c.status='free';
        normalizeOperationalStatus(c);
      }
      try{window.save?.()}catch{}
      refreshAssignmentUi(carId||affected[0]?.id||'');
      return result
    };
    fixed.__fpFreeStatusFixedV3=true;
    window.unassignVehicleDriverUnified=fixed;
  }

  function installFleetBoardGuards(){
    if(window.__fpFleetBoardAssignmentGuardsV3)return;
    window.__fpFleetBoardAssignmentGuardsV3=true;

    window.addEventListener('fleetpilot:driver-assignment-changed',event=>{
      const cid=event?.detail?.carId||'';
      if(cid){const c=getCar(cid);if(c)normalizeOperationalStatus(c)}
      for(const c of cars())normalizeOperationalStatus(c);
      try{window.save?.()}catch{}
      refreshAssignmentUi(cid)
    });

    window.addEventListener('fleetpilot:assignments-changed',async()=>{
      try{await window.loadWorkspaceDriverAssignments?.()}catch{}
      for(const c of cars())normalizeOperationalStatus(c);
      try{window.save?.()}catch{}
      refreshAssignmentUi('')
    });
  }

  function install(){
    if(window.__fpDriverAssignmentHotfixInstalledV3)return;
    window.__fpDriverAssignmentHotfixInstalledV3=true;
    installCloudAssignmentFix();
    installUnifiedAssignmentFix();
    installUnassignGuard();
    installFleetBoardGuards();
    for(const c of cars())normalizeOperationalStatus(c);
    try{window.save?.()}catch{}

    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      installCloudAssignmentFix();
      installUnifiedAssignmentFix();
      installUnassignGuard();
      if(window.FleetPilotCloud?.assignDriverVehicle?.__fpDirectAssignmentFixedV3||attempts>30)clearInterval(timer)
    },100);
  }

  install();
})();
