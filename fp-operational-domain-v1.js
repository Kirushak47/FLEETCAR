/* FleetPilot operational domain v1.4 — Supabase authoritative assignment/status/handover */
(()=>{
  'use strict';

  let installing=false;
  let authoritativeAssignments=[];
  const normStatus=value=>String(value||'').toLowerCase()==='on_line'?'active':String(value||'').toLowerCase();
  const apiStatus=value=>normStatus(value)==='active'?'active':normStatus(value);
  const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
  const getCar=id=>typeof window.car==='function'?window.car(String(id||'')):cars().find(c=>String(c.id)===String(id));
  const isActiveAssignment=row=>row&&String(row.status||row.assignment_status||'').toLowerCase()==='active'&&!row.returned_at&&Boolean(row.car_id)&&Boolean(row.driver_user_id);
  const activeForCar=id=>authoritativeAssignments.find(r=>String(r.car_id)===String(id))||null;
  const activeForDriver=id=>authoritativeAssignments.find(r=>String(r.driver_user_id)===String(id))||null;

  window.FleetPilotAssignmentState={
    get rows(){return authoritativeAssignments.slice()},
    forCar:activeForCar,
    forDriver:activeForDriver,
    hasCar:id=>Boolean(activeForCar(id)),
    hasDriver:id=>Boolean(activeForDriver(id))
  };

  async function rpc(name,args={}){
    const cloud=window.FleetPilotCloud;
    const cfg=window.FLEETPILOT_CLOUD_CONFIG||{};
    const token=cloud?.session?.access_token;
    if(!token)throw new Error('Сессия Supabase не найдена');
    if(!cfg.url||!cfg.publishableKey)throw new Error('Supabase недоступен');
    const response=await fetch(`${cfg.url}/rest/v1/rpc/${name}`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':cfg.publishableKey,'Authorization':`Bearer ${token}`},
      body:JSON.stringify(args||{})
    });
    if(!response.ok){
      let detail='';try{const body=await response.json();detail=body?.message||body?.details||''}catch{}
      throw new Error(detail||`${name} HTTP ${response.status}`)
    }
    try{return await response.json()}catch{return null}
  }

  function refresh(){
    try{window.renderFleet?.()}catch{}
    try{window.renderStableFleetTable?.()}catch{}
    try{window.renderDriversRegistry?.()}catch{}
    try{window.renderDesktopCommand?.()}catch{}
    try{window.scheduleDesktopLiveRefresh?.({preserveMapViewport:true})}catch{}
    try{window.renderDriverPortal?.()}catch{}
    try{window.renderDriverProfile?.()}catch{}
    try{
      const id=String(window.selectedCarId||'');
      if(id&&document.querySelector('#carPage')?.classList.contains('active'))window.openCar?.(id)
    }catch{}
  }

  async function pullOperationalStatuses(){
    try{
      const rows=await rpc('get_vehicle_operational_statuses');
      let changed=false;
      for(const row of rows||[]){
        const c=getCar(row.car_id);if(!c)continue;
        const next=normStatus(row.status);
        if(['active','repair','free'].includes(next)&&c.status!==next){c.status=next;changed=true}
      }
      if(changed){try{window.save?.()}catch{};refresh()}
      return rows||[]
    }catch(error){console.warn('Operational status pull failed',error);return[]}
  }

  function clearAccountDriver(c){
    if(!c)return false;
    const had=Boolean(c.driverUserId||c.driverEmail||c.driverName||c.driverAcceptedAt||c.driverAssignedAt||c.driverAssignmentSource==='account');
    c.driverUserId='';c.driverEmail='';c.driverName='';c.driverPhone='';
    c.driverAcceptedAt='';c.driverAcceptedRevision='';c.driverAssignedAt='';c.driverAssignmentRevision='';
    if(c.driverAssignmentSource==='account'){c.tenant='';c.driverAssignmentSource=''}
    return had
  }

  function reconcileAssignments(rows){
    authoritativeAssignments=(rows||[]).filter(isActiveAssignment);
    const activeByCar=new Map(authoritativeAssignments.map(row=>[String(row.car_id),row]));
    let changed=false;

    for(const c of cars()){
      if(c.driverAssignmentSource==='manual'&&!c.driverUserId)continue;
      const row=activeByCar.get(String(c.id));
      if(!row){
        if(c.driverUserId||c.driverAssignmentSource==='account')changed=clearAccountDriver(c)||changed;
        continue;
      }
      const uid=String(row.driver_user_id||'');
      if(String(c.driverUserId||'')!==uid){c.driverUserId=uid;changed=true}
      if(c.driverAssignmentSource!=='account'){c.driverAssignmentSource='account';changed=true}
    }

    // Keep legacy registries in sync too. They are still used by older renderers.
    try{
      if(typeof workspaceDriverAssignments==='object'&&workspaceDriverAssignments){
        for(const key of Object.keys(workspaceDriverAssignments))delete workspaceDriverAssignments[key];
        for(const row of authoritativeAssignments)workspaceDriverAssignments[String(row.driver_user_id)]=String(row.car_id)
      }
      if(Array.isArray(workspaceDriverAssignmentRows)){
        workspaceDriverAssignmentRows.splice(0,workspaceDriverAssignmentRows.length,...authoritativeAssignments)
      }
    }catch{}

    if(changed){try{window.save?.()}catch{}}
    refresh();
    window.dispatchEvent(new CustomEvent('fleetpilot:authoritative-assignments',{detail:{rows:authoritativeAssignments.slice()}}));
    return authoritativeAssignments
  }

  async function pullAssignments(){
    try{
      const rows=await rpc('get_workspace_driver_assignments_v12')||[];
      return reconcileAssignments(rows)
    }catch(error){console.warn('Assignment feed pull failed',error);return[]}
  }

  async function pullAuthoritativeState(){
    await Promise.all([pullAssignments(),pullOperationalStatuses()]);
  }

  function installLegacyDriverGuards(){
    // Old UI used car.driverUserId directly. Make its helper consult Supabase-active assignments first.
    if(typeof window.workspaceDriverForCar==='function'&&!window.workspaceDriverForCar.__fpAuthoritativeV14){
      const original=window.workspaceDriverForCar;
      const wrapped=function(c){
        if(!c)return null;
        const row=activeForCar(c.id);
        if(!row){
          if(c.driverAssignmentSource==='manual'&&!c.driverUserId)return original(c);
          return null
        }
        const result=original(c)||{};
        return {...result,userId:String(row.driver_user_id||''),source:'account',accepted:Boolean(row.active_handover_id||row.accepted_at||String(row.handover_status||'').toLowerCase()==='active')}
      };
      wrapped.__fpAuthoritativeV14=true;wrapped.__fpOriginal=original;window.workspaceDriverForCar=wrapped;
    }
    if(typeof window.driverPickerStatus==='function'&&!window.driverPickerStatus.__fpAuthoritativeV14){
      const original=window.driverPickerStatus;
      const wrapped=function(member){
        const uid=String(member?.user_id||'');
        const row=activeForDriver(uid);
        if(!row)return{label:'Без автомобиля',cls:'free',vehicle:''};
        const c=getCar(row.car_id);
        if(!c)return original(member);
        const vehicle=`${typeof window.model==='function'?(window.model(c).brand+' '+window.model(c).model):c.plate||'Автомобиль'} · ${c.plate||'—'}`;
        const accepted=Boolean(row.active_handover_id||row.accepted_at||String(row.handover_status||'').toLowerCase()==='active');
        return{label:accepted?'Автомобиль принят':'Ожидает приёмки',cls:accepted?'accepted':'pending',vehicle}
      };
      wrapped.__fpAuthoritativeV14=true;wrapped.__fpOriginal=original;window.driverPickerStatus=wrapped;
    }
  }

  function installStatusWriter(){
    const current=window.setVehicleOperationalStatus;
    if(current?.__fpOperationalDomainV14)return;
    const wrapped=function(carId,status,options={}){
      const c=getCar(carId);if(!c)return false;
      const next=normStatus(status);
      if(!['active','repair','free'].includes(next))return false;
      const previous=c.status;
      c.status=next;
      try{window.save?.()}catch{}
      refresh();
      rpc('set_vehicle_operational_status',{car_id_value:String(c.id),status_value:apiStatus(next)})
        .then(()=>pullOperationalStatuses())
        .catch(error=>{
          console.error('Fleet Board status save failed',error);
          c.status=previous;
          try{window.save?.()}catch{}
          refresh();
          try{window.toast?.('Не удалось сохранить статус Fleet Board')}catch{}
        });
      return true;
    };
    wrapped.__fpOperationalDomainV14=true;wrapped.__fpOriginal=current;window.setVehicleOperationalStatus=wrapped;
  }

  function installFleetBoardBridge(){
    if(typeof window.updateCarStatusLive==='function'&&!window.updateCarStatusLive.__fpOperationalDomainV14){
      const wrapped=function(carId,status){return window.setVehicleOperationalStatus?.(carId,status,{source:'fleet-board'})};
      wrapped.__fpOperationalDomainV14=true;window.updateCarStatusLive=wrapped;
    }
  }

  function installCloudAssignmentFeed(){
    const cloud=window.FleetPilotCloud;
    if(!cloud||cloud.getDriverAssignments?.__fpOperationalDomainV14)return;
    const wrapped=async()=>pullAssignments();
    wrapped.__fpOperationalDomainV14=true;cloud.getDriverAssignments=wrapped;
  }

  function installCloudLifecycleRefresh(){
    const cloud=window.FleetPilotCloud;if(!cloud)return;
    if(typeof cloud.assignDriverVehicle==='function'&&!cloud.assignDriverVehicle.__fpOperationalRefreshV14){
      const original=cloud.assignDriverVehicle.bind(cloud);
      const wrapped=async function(){const result=await original(...arguments);await pullAuthoritativeState();return result};
      wrapped.__fpOperationalRefreshV14=true;wrapped.__fpOriginal=original;cloud.assignDriverVehicle=wrapped;
    }
    if(typeof cloud.submitVehicleHandover==='function'&&!cloud.submitVehicleHandover.__fpOperationalRefreshV14){
      const original=cloud.submitVehicleHandover.bind(cloud);
      const wrapped=async function(payload){const result=await original(payload);await pullAuthoritativeState();return result};
      wrapped.__fpOperationalRefreshV14=true;wrapped.__fpOriginal=original;cloud.submitVehicleHandover=wrapped;
    }
  }

  async function install(){
    if(installing)return;installing=true;
    installStatusWriter();installFleetBoardBridge();installCloudAssignmentFeed();installCloudLifecycleRefresh();installLegacyDriverGuards();
    await pullAuthoritativeState();
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;installStatusWriter();installFleetBoardBridge();installCloudAssignmentFeed();installCloudLifecycleRefresh();installLegacyDriverGuards();
      if(attempts>40)clearInterval(timer)
    },150);
    window.addEventListener('fleetpilot:driver-assignment-changed',()=>setTimeout(pullAuthoritativeState,50));
    window.addEventListener('fleetpilot:assignments-changed',()=>setTimeout(pullAuthoritativeState,50));
    window.addEventListener('focus',()=>pullAuthoritativeState());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)pullAuthoritativeState()});
  }

  if(document.readyState==='loading')window.addEventListener('load',install,{once:true});else install();
})();
