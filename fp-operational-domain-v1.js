/* FleetPilot operational domain v1.2 — Supabase authoritative assignment/status/handover */
(()=>{
  'use strict';

  let installing=false;
  const normStatus=value=>String(value||'').toLowerCase()==='on_line'?'active':String(value||'').toLowerCase();
  const apiStatus=value=>normStatus(value)==='active'?'on_line':normStatus(value);
  const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
  const getCar=id=>typeof window.car==='function'?window.car(String(id||'')):cars().find(c=>String(c.id)===String(id));

  async function rpc(name,args={}){
    const cloud=window.FleetPilotCloud;
    const cfg=window.FLEETPILOT_CLOUD_CONFIG||{};
    const token=cloud?.session?.access_token;
    if(!token)throw new Error('Сессия Supabase не найдена');
    if(!cfg.url||!cfg.publishableKey)throw new Error('Supabase недоступен');
    const response=await fetch(`${cfg.url}/rest/v1/rpc/${name}`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':cfg.publishableKey,
        'Authorization':`Bearer ${token}`
      },
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

  async function pullAssignments(){
    try{return await rpc('get_workspace_driver_assignments_v12')||[]}
    catch(error){console.warn('Assignment feed pull failed',error);return[]}
  }

  function installStatusWriter(){
    const current=window.setVehicleOperationalStatus;
    if(current?.__fpOperationalDomainV12)return;
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
    wrapped.__fpOperationalDomainV12=true;
    wrapped.__fpOriginal=current;
    window.setVehicleOperationalStatus=wrapped;
  }

  // The legacy Fleet Board was writing c.status locally and calling save().
  // That bypassed Supabase entirely, so a pull/reload restored the old status.
  // Route every board drag/drop through the authoritative writer instead.
  function installFleetBoardBridge(){
    const current=window.updateCarStatusLive;
    if(current?.__fpOperationalDomainV12)return;
    const wrapped=function(carId,status){
      const next=normStatus(status);
      if(!['active','repair','free'].includes(next))return false;
      return window.setVehicleOperationalStatus?.(carId,next,{source:'fleet-board'})??false
    };
    wrapped.__fpOperationalDomainV12=true;
    wrapped.__fpOriginal=current;
    window.updateCarStatusLive=wrapped;
  }

  // Bulk status changes used the same legacy local-only path. Keep the existing UI
  // behavior, then persist every actually changed vehicle to Supabase.
  function installBulkStatusBridge(){
    const current=window.applyDesktopBulkStatus;
    if(typeof current!=='function'||current.__fpOperationalDomainV12)return;
    const wrapped=function(){
      const before=new Map(cars().map(c=>[String(c.id),normStatus(c.status)]));
      const result=current.apply(this,arguments);
      queueMicrotask(()=>{
        for(const c of cars()){
          const prior=before.get(String(c.id));
          const next=normStatus(c.status);
          if(prior!==next&&['active','repair','free'].includes(next)){
            window.setVehicleOperationalStatus?.(c.id,next,{source:'bulk-status'})
          }
        }
      });
      return result
    };
    wrapped.__fpOperationalDomainV12=true;
    wrapped.__fpOriginal=current;
    window.applyDesktopBulkStatus=wrapped;
  }

  // Saving a vehicle profile used to change the visible status only inside fleet_states.
  // After the normal form handler finishes, persist the explicitly selected status
  // through the same operational-status RPC.
  function installCarFormStatusBridge(){
    const form=document.querySelector('#carForm');
    if(!form||form.dataset.fpOperationalDomainV12)return;
    form.dataset.fpOperationalDomainV12='1';
    form.addEventListener('submit',()=>{
      const idBefore=String(document.querySelector('#carId')?.value||'');
      const plateBefore=String(document.querySelector('#carPlate')?.value||'').trim();
      const wanted=normStatus(document.querySelector('#carStatus')?.value||'');
      if(!['active','repair','free'].includes(wanted))return;
      setTimeout(()=>{
        const target=(idBefore&&getCar(idBefore))||cars().find(c=>String(c.plate||'').trim()===plateBefore);
        if(!target)return;
        window.setVehicleOperationalStatus?.(target.id,wanted,{source:'vehicle-profile'})
      },350)
    },true)
  }

  function installCloudAssignmentFeed(){
    const cloud=window.FleetPilotCloud;
    if(!cloud||cloud.getDriverAssignments?.__fpOperationalDomainV12)return;
    const wrapped=async()=>pullAssignments();
    wrapped.__fpOperationalDomainV12=true;
    cloud.getDriverAssignments=wrapped;
  }

  function installCloudLifecycleRefresh(){
    const cloud=window.FleetPilotCloud;if(!cloud)return;
    if(typeof cloud.assignDriverVehicle==='function'&&!cloud.assignDriverVehicle.__fpOperationalRefreshV12){
      const original=cloud.assignDriverVehicle.bind(cloud);
      const wrapped=async function(){const result=await original(...arguments);await pullOperationalStatuses();return result};
      wrapped.__fpOperationalRefreshV12=true;wrapped.__fpOriginal=original;cloud.assignDriverVehicle=wrapped;
    }
    if(typeof cloud.submitVehicleHandover==='function'&&!cloud.submitVehicleHandover.__fpOperationalRefreshV12){
      const original=cloud.submitVehicleHandover.bind(cloud);
      const wrapped=async function(payload){const result=await original(payload);await pullOperationalStatuses();return result};
      wrapped.__fpOperationalRefreshV12=true;wrapped.__fpOriginal=original;cloud.submitVehicleHandover=wrapped;
    }
  }

  async function install(){
    if(installing)return;installing=true;
    installStatusWriter();
    installFleetBoardBridge();
    installBulkStatusBridge();
    installCarFormStatusBridge();
    installCloudAssignmentFeed();
    installCloudLifecycleRefresh();
    await pullOperationalStatuses();
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      installStatusWriter();
      installFleetBoardBridge();
      installBulkStatusBridge();
      installCarFormStatusBridge();
      installCloudAssignmentFeed();
      installCloudLifecycleRefresh();
      if(attempts>40)clearInterval(timer)
    },150);
    window.addEventListener('fleetpilot:driver-assignment-changed',()=>setTimeout(pullOperationalStatuses,80));
    window.addEventListener('fleetpilot:vehicle-status-changed',()=>setTimeout(pullOperationalStatuses,120));
    window.addEventListener('focus',()=>pullOperationalStatuses());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)pullOperationalStatuses()});
  }

  if(document.readyState==='loading')window.addEventListener('load',install,{once:true});else install();
})();
