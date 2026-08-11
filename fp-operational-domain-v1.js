/* FleetPilot operational domain v1 — Supabase authoritative assignment/status/handover */
(()=>{
  'use strict';

  let client=null;
  let installing=false;
  const normStatus=value=>String(value||'').toLowerCase()==='on_line'?'active':String(value||'').toLowerCase();
  const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
  const getCar=id=>typeof window.car==='function'?window.car(String(id||'')):cars().find(c=>String(c.id)===String(id));

  function getClient(){
    if(client)return client;
    const cfg=window.FLEETPILOT_CLOUD_CONFIG||{};
    if(!window.supabase?.createClient||!cfg.url||!cfg.publishableKey)return null;
    client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    return client;
  }

  async function rpc(name,args={}){
    const c=getClient();
    if(!c)throw new Error('Supabase недоступен');
    const {data:{session}={}}=await c.auth.getSession();
    if(!session)throw new Error('Сессия Supabase не найдена');
    const {data,error}=await c.rpc(name,args);
    if(error)throw error;
    return data;
  }

  function refresh(){
    try{window.renderFleet?.()}catch{}
    try{window.renderStableFleetTable?.()}catch{}
    try{window.renderDriversRegistry?.()}catch{}
    try{window.renderDesktopCommand?.()}catch{}
    try{window.scheduleDesktopLiveRefresh?.({preserveMapViewport:true})}catch{}
    try{window.renderDriverPortal?.()}catch{}
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
      return rows||[];
    }catch(error){console.warn('Operational status pull failed',error);return[]}
  }

  async function pullAssignments(){
    try{return await rpc('get_workspace_driver_assignments_v12')||[]}
    catch(error){console.warn('Assignment feed pull failed',error);return[]}
  }

  function installStatusWriter(){
    const current=window.setVehicleOperationalStatus;
    if(current?.__fpOperationalDomainV1)return;
    const wrapped=function(carId,status,options={}){
      const c=getCar(carId);if(!c)return false;
      const next=normStatus(status);
      if(!['active','repair','free'].includes(next))return false;
      const previous=c.status;
      c.status=next;
      try{window.save?.()}catch{}
      refresh();
      window.dispatchEvent(new CustomEvent('fleetpilot:vehicle-status-changed',{detail:{carId:c.id,status:next,source:options.source||'fleet-board'}}));
      rpc('set_vehicle_operational_status',{car_id_value:String(c.id),status_value:next})
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
    wrapped.__fpOperationalDomainV1=true;
    wrapped.__fpOriginal=current;
    window.setVehicleOperationalStatus=wrapped;
  }

  function installCloudAssignmentFeed(){
    const cloud=window.FleetPilotCloud;
    if(!cloud||cloud.getDriverAssignments?.__fpOperationalDomainV1)return;
    const wrapped=async()=>pullAssignments();
    wrapped.__fpOperationalDomainV1=true;
    cloud.getDriverAssignments=wrapped;
  }

  function installCloudLifecycleRefresh(){
    const cloud=window.FleetPilotCloud;if(!cloud)return;
    if(typeof cloud.assignDriverVehicle==='function'&&!cloud.assignDriverVehicle.__fpOperationalRefreshV1){
      const original=cloud.assignDriverVehicle.bind(cloud);
      const wrapped=async function(){const result=await original(...arguments);await pullOperationalStatuses();return result};
      wrapped.__fpOperationalRefreshV1=true;wrapped.__fpOriginal=original;cloud.assignDriverVehicle=wrapped;
    }
    if(typeof cloud.submitVehicleHandover==='function'&&!cloud.submitVehicleHandover.__fpOperationalRefreshV1){
      const original=cloud.submitVehicleHandover.bind(cloud);
      const wrapped=async function(payload){const result=await original(payload);await pullOperationalStatuses();return result};
      wrapped.__fpOperationalRefreshV1=true;wrapped.__fpOriginal=original;cloud.submitVehicleHandover=wrapped;
    }
  }

  async function install(){
    if(installing)return;installing=true;
    installStatusWriter();installCloudAssignmentFeed();installCloudLifecycleRefresh();
    await pullOperationalStatuses();
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      installStatusWriter();installCloudAssignmentFeed();installCloudLifecycleRefresh();
      if(attempts>40)clearInterval(timer)
    },150);
    window.addEventListener('fleetpilot:driver-assignment-changed',()=>setTimeout(pullOperationalStatuses,80));
    window.addEventListener('focus',()=>pullOperationalStatuses());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)pullOperationalStatuses()});
  }

  if(document.readyState==='loading')window.addEventListener('load',install,{once:true});else install();
})();
