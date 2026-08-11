/* FleetPilot operational domain v1.3 — Supabase authoritative assignment/status/handover */
(()=>{
  'use strict';

  let installing=false;
  const normStatus=value=>String(value||'').toLowerCase()==='on_line'?'active':String(value||'').toLowerCase();
  const apiStatus=value=>normStatus(value)==='active'?'active':normStatus(value);
  const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
  const getCar=id=>typeof window.car==='function'?window.car(String(id||'')):cars().find(c=>String(c.id)===String(id));
  const isActiveAssignment=row=>row&&String(row.status||row.assignment_status||'').toLowerCase()!=='returned'&&!row.returned_at&&Boolean(row.car_id)&&Boolean(row.driver_user_id);

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
    const had=Boolean(c.driverUserId||c.driverEmail||c.driverName||c.driverAcceptedAt||c.driverAssignedAt);
    c.driverUserId='';c.driverEmail='';c.driverName='';c.driverPhone='';
    c.driverAcceptedAt='';c.driverAcceptedRevision='';c.driverAssignedAt='';c.driverAssignmentRevision='';
    if(c.driverAssignmentSource==='account'){c.tenant='';c.driverAssignmentSource=''}
    return had
  }

  function reconcileAssignments(rows){
    const active=(rows||[]).filter(isActiveAssignment);
    const activeByCar=new Map(active.map(row=>[String(row.car_id),row]));
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
      const email=String(row.driver_email||'');
      const name=String(row.driver_name||'');
      if(email&&c.driverEmail!==email){c.driverEmail=email;changed=true}
      if(name&&c.driverName!==name){c.driverName=name;changed=true}
      if((name||email)&&c.tenant!==(name||email)){c.tenant=name||email;changed=true}
      if(c.driverAssignmentSource!=='account'){c.driverAssignmentSource='account';changed=true}
    }

    if(typeof window.workspaceDriverAssignments==='object'&&window.workspaceDriverAssignments){
      for(const key of Object.keys(window.workspaceDriverAssignments))delete window.workspaceDriverAssignments[key];
      for(const row of active)window.workspaceDriverAssignments[String(row.driver_user_id)]=String(row.car_id)
    }
    if(changed){try{window.save?.()}catch{};refresh()}
    return active
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

  function installStatusWriter(){
    const current=window.setVehicleOperationalStatus;
    if(current?.__fpOperationalDomainV13)return;
    const wrapped=function(carId,status,options={}){
      const c=getCar(carId);if(!c)return false;
      const next=normStatus(status);
      if(!['active','repair','free'].includes(next))return false;
      const previous=c.status;
      c.status=next;
      try{window.save?.()}catch{}
      refresh();
      window.dispatchEvent(new CustomEvent('fleetpilot:vehicle-status-changed',{detail:{carId:c.id,status:next,source:options.source||'fleet-board'}}));
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
    wrapped.__fpOperationalDomainV13=true;
    wrapped.__fpOriginal=current;
    window.setVehicleOperationalStatus=wrapped;
  }

  function installFleetBoardBridge(){
    if(typeof window.updateCarStatusLive==='function'&&!window.updateCarStatusLive.__fpOperationalDomainV13){
      const wrapped=function(carId,status){return window.setVehicleOperationalStatus?.(carId,status,{source:'fleet-board'})};
      wrapped.__fpOperationalDomainV13=true;
      window.updateCarStatusLive=wrapped;
    }
    if(typeof window.bulkSetStatus==='function'&&!window.bulkSetStatus.__fpOperationalDomainV13){
      const original=window.bulkSetStatus;
      const wrapped=function(status){
        const ids=Array.isArray(window.desktopSelectedCarIds)?window.desktopSelectedCarIds:[];
        if(!ids.length)return original.apply(this,arguments);
        ids.forEach(id=>window.setVehicleOperationalStatus?.(id,status,{source:'bulk'}));
      };
      wrapped.__fpOperationalDomainV13=true;wrapped.__fpOriginal=original;window.bulkSetStatus=wrapped;
    }
  }

  function installCloudAssignmentFeed(){
    const cloud=window.FleetPilotCloud;
    if(!cloud||cloud.getDriverAssignments?.__fpOperationalDomainV13)return;
    const wrapped=async()=>pullAssignments();
    wrapped.__fpOperationalDomainV13=true;
    cloud.getDriverAssignments=wrapped;
  }

  function installCloudLifecycleRefresh(){
    const cloud=window.FleetPilotCloud;if(!cloud)return;
    if(typeof cloud.assignDriverVehicle==='function'&&!cloud.assignDriverVehicle.__fpOperationalRefreshV13){
      const original=cloud.assignDriverVehicle.bind(cloud);
      const wrapped=async function(){const result=await original(...arguments);await pullAuthoritativeState();return result};
      wrapped.__fpOperationalRefreshV13=true;wrapped.__fpOriginal=original;cloud.assignDriverVehicle=wrapped;
    }
    if(typeof cloud.submitVehicleHandover==='function'&&!cloud.submitVehicleHandover.__fpOperationalRefreshV13){
      const original=cloud.submitVehicleHandover.bind(cloud);
      const wrapped=async function(payload){const result=await original(payload);await pullAuthoritativeState();return result};
      wrapped.__fpOperationalRefreshV13=true;wrapped.__fpOriginal=original;cloud.submitVehicleHandover=wrapped;
    }
  }

  async function install(){
    if(installing)return;installing=true;
    installStatusWriter();installFleetBoardBridge();installCloudAssignmentFeed();installCloudLifecycleRefresh();
    await pullAuthoritativeState();
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;installStatusWriter();installFleetBoardBridge();installCloudAssignmentFeed();installCloudLifecycleRefresh();
      if(attempts>40)clearInterval(timer)
    },150);
    window.addEventListener('fleetpilot:driver-assignment-changed',()=>setTimeout(pullAuthoritativeState,80));
    window.addEventListener('fleetpilot:assignments-changed',()=>setTimeout(pullAuthoritativeState,80));
    window.addEventListener('focus',()=>pullAuthoritativeState());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)pullAuthoritativeState()});
  }

  if(document.readyState==='loading')window.addEventListener('load',install,{once:true});else install();
})();
