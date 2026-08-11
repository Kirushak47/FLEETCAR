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
    // Business rule: no assigned driver = free, except a vehicle explicitly in repair.
    if(!c.driverUserId&&c.status!=='repair')c.status='free';
    // An assigned vehicle is on line unless Fleet Board explicitly puts it in repair.
    if(c.driverUserId&&c.status==='free')c.status='on_line';
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
    if(!cloud?.assignDriverVehicle||cloud.assignDriverVehicle.__fpDirectAssignmentFixed)return false;
    const legacy=cloud.assignDriverVehicle.bind(cloud);

    const fixed=async function(driverUserId,carId){
      const uid=String(driverUserId||'').trim();
      const wanted=carId?String(carId):null;
      if(!uid)return legacy(driverUserId,carId);

      const before=cars().filter(c=>same(c.driverUserId,uid));
      // IMPORTANT: exactly one backend write. No technical pre-detach with null before an assignment.
      const result=await directAssignmentRpc(uid,wanted);

      if(wanted){
        const target=getCar(wanted);
        for(const c of cars()){
          if(c!==target&&same(c.driverUserId,uid)){
            c.driverUserId='';c.driverEmail='';c.driverName='';c.driverPhone='';c.driverAcceptedAt='';c.driverAcceptedRevision='';
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
    fixed.__fpOriginal=legacy;
    cloud.assignDriverVehicle=fixed;
    return true
  }

  function installUnifiedAssignmentFix(){
    if(typeof window.assignVehicleDriverUnified!=='function'||window.assignVehicleDriverUnified.__fpAssignmentFixedV2)return;
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
        normalizeOperationalStatus(target);
        try{window.save?.()}catch{}
        refreshAssignmentUi(cid);
        return target
      }

      // Legacy helper still prepares driver metadata/audit. Its backend calls are now safe:
      // null is used only for the explicit detach call, and the following assignment is one direct RPC.
      const result=await original.call(this,uid,cid,options);
      const actual=result||target;
      actual.driverUserId=uid;
      normalizeOperationalStatus(actual);
      try{window.save?.()}catch{}
      refreshAssignmentUi(cid);
      return result
    };
    fixed.__fpAssignmentFixedV2=true;
    fixed.__fpOriginal=original;
    window.assignVehicleDriverUnified=fixed;
  }

  function installUnassignGuard(){
    if(typeof window.unassignVehicleDriverUnified!=='function'||window.unassignVehicleDriverUnified.__fpFreeStatusFixed)return;
    const original=window.unassignVehicleDriverUnified;
    const fixed=async function(driverUserId,carId=''){
      const affected=cars().filter(c=>same(c.driverUserId,driverUserId)||(carId&&same(c.id,carId)));
      const result=await original.apply(this,arguments);
      for(const c of affected){
        if(!c.driverUserId&&c.status!=='repair')c.status='free';
      }
      try{window.save?.()}catch{}
      refreshAssignmentUi(carId||affected[0]?.id||'');
      return result
    };
    fixed.__fpFreeStatusFixed=true;
    window.unassignVehicleDriverUnified=fixed;
  }

  function installFleetBoardGuards(){
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
    if(window.__fpDriverAssignmentHotfixInstalledV2)return;
    window.__fpDriverAssignmentHotfixInstalledV2=true;
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
      if(window.FleetPilotCloud?.assignDriverVehicle?.__fpDirectAssignmentFixed||attempts>30)clearInterval(timer)
    },100);
  }

  install();
})();
