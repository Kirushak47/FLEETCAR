/* FleetPilot driver status cleanup — 2026-08-24 */
(()=>{
  'use strict';
  if(window.__fpDriverStatusV1)return;
  window.__fpDriverStatusV1=true;

  const same=(a,b)=>String(a??'')===String(b??'');
  const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
  const assignedCarForUser=userId=>cars().find(c=>same(c.driverUserId,userId))||null;

  function acceptanceState(c){
    if(!c)return false;
    try{
      const resolved=typeof window.workspaceDriverForCar==='function'?window.workspaceDriverForCar(c):null;
      if(resolved&&typeof resolved.accepted==='boolean')return resolved.accepted;
    }catch{}
    try{
      if(typeof window.currentAssignmentAcceptedLocally==='function'&&window.currentAssignmentAcceptedLocally(c))return true;
    }catch{}
    return Boolean(c.driverAcceptedAt);
  }

  // Keep meaningful handover states. Only the stale/annoying "Ожидает приёмки" badge is hidden.
  window.driverPickerStatus=function(member){
    const c=assignedCarForUser(member?.user_id);
    if(!c)return{label:'Без автомобиля',cls:'free',vehicle:''};
    let vehicle='';
    try{
      const m=typeof window.model==='function'?window.model(c):{};
      vehicle=`${m?.brand||c.brand||''} ${m?.model||c.model||''} · ${c.plate||'—'}`.trim();
    }catch{vehicle=c.plate||''}
    const accepted=acceptanceState(c);
    return{label:accepted?'Автомобиль принят':'',cls:accepted?'accepted':'',vehicle};
  };

  window.fleetDriverMeta=function(c){
    if(!c)return'Не назначен';
    const hasDriver=Boolean(String(c.driverUserId||'').trim()||String(c.tenant||'').trim());
    if(!hasDriver)return'Не назначен';
    if(!String(c.driverUserId||'').trim())return'Введён вручную';
    return acceptanceState(c)?'Автомобиль принят':'Ожидает подтверждения';
  };

  function cleanupDriverCards(){
    const roots=[
      document.getElementById('driversRegistryList'),
      document.getElementById('carDriverPickerResults'),
      document.getElementById('adminDriverProfileDialog'),
      document.getElementById('driversPage')
    ].filter(Boolean);

    for(const root of roots){
      for(const el of root.querySelectorAll('*')){
        if(el.children.length)continue;
        const text=(el.textContent||'').trim();
        if(!['Ожидает приёмки','Ожидает приемки'].includes(text))continue;
        const card=el.closest('[data-pick-driver],[data-open-driver-profile],.driver-registry-card,.driver-picker-card');
        if(card)el.remove();
      }
    }
  }

  function cleanupDriverPortalHeader(){
    const page=document.getElementById('driverPortalPage');
    if(!page)return;
    const head=page.querySelector('.driver-portal-head');
    if(!head)return;

    // Remove only decorative/stray labels from the Driver Portal header.
    for(const el of head.querySelectorAll('*')){
      if(el.children.length)continue;
      const text=(el.textContent||'').trim();
      if(['Driver Portal','DRIVER PORTAL','В ремонте'].includes(text))el.remove();
    }
  }

  // Completed service work in the driver portal must reflect the real service status.
  function patchServiceFeed(){
    const cloud=window.FleetPilotCloud;
    if(!cloud?.getDriverServiceFeed||cloud.getDriverServiceFeed.__fpDriverStatusV1)return false;
    const original=cloud.getDriverServiceFeed.bind(cloud);
    const fixed=async(...args)=>{
      const rows=await original(...args);
      return (Array.isArray(rows)?rows:[]).map(row=>{
        const status=String(row.status||row.repair_status||row.service_status||'').toLowerCase();
        if(['done','completed','finished','closed'].includes(status))return {...row,status:'done',status_label:'Выполнено'};
        return row;
      });
    };
    fixed.__fpDriverStatusV1=true;
    cloud.getDriverServiceFeed=fixed;
    return true;
  }

  const cleanup=()=>{
    cleanupDriverCards();
    cleanupDriverPortalHeader();
  };

  const refresh=()=>{
    patchServiceFeed();
    try{window.renderDriversRegistry?.()}catch{}
    try{window.renderDriverPickerCards?.(document.getElementById('carDriverPickerSearch')?.value||'')}catch{}
    setTimeout(cleanup,0);
  };

  let timer=0;
  new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(cleanup,60);
  }).observe(document.documentElement,{subtree:true,childList:true,characterData:true});

  window.addEventListener('fleetpilot:driver-assignment-changed',()=>setTimeout(refresh,0));
  window.addEventListener('fleetpilot:assignments-changed',()=>setTimeout(refresh,0));
  window.addEventListener('fleetpilot:cloud-ready',()=>setTimeout(refresh,0));
  setTimeout(refresh,0);
  setInterval(()=>{patchServiceFeed();cleanup()},1500);
  console.info('FleetPilot driver status cleanup v1.3 active');
})();
