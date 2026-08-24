/* FleetPilot driver status consistency — 2026-08-24 */
(()=>{
  'use strict';
  if(window.__fpDriverStatusV1)return;
  window.__fpDriverStatusV1=true;

  const same=(a,b)=>String(a??'')===String(b??'');
  const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
  const assignedCarForUser=userId=>cars().find(c=>same(c.driverUserId,userId))||null;

  function acceptanceState(c){
    if(!c)return false;

    // Single source of truth: use the same resolver as Driver Portal / assignment pipeline.
    // workspaceDriverForCar() checks the current backend handover row and protects against
    // stale handovers from a previous assignment cycle.
    try{
      const resolved=typeof window.workspaceDriverForCar==='function'?window.workspaceDriverForCar(c):null;
      if(resolved&&typeof resolved.accepted==='boolean')return resolved.accepted;
    }catch(error){console.warn('Driver acceptance resolver',error)}

    // Fallback for the short moment before cloud assignments are loaded.
    try{
      if(typeof window.currentAssignmentAcceptedLocally==='function'&&window.currentAssignmentAcceptedLocally(c))return true;
    }catch{}
    return Boolean(c.driverAcceptedAt);
  }

  // Driver assignment status must describe the handover state, not the vehicle operation status.
  window.driverPickerStatus=function(member){
    const c=assignedCarForUser(member?.user_id);
    if(!c)return{label:'Без автомобиля',cls:'free',vehicle:''};
    let vehicle='';
    try{
      const m=typeof window.model==='function'?window.model(c):{};
      vehicle=`${m?.brand||c.brand||''} ${m?.model||c.model||''} · ${c.plate||'—'}`.trim();
    }catch{vehicle=c.plate||''}
    const accepted=acceptanceState(c);
    return{label:accepted?'Автомобиль принят':'Ожидает приёмки',cls:accepted?'accepted':'pending',vehicle};
  };

  window.fleetDriverMeta=function(c){
    if(!c)return'Не назначен';
    const hasDriver=Boolean(String(c.driverUserId||'').trim()||String(c.tenant||'').trim());
    if(!hasDriver)return'Не назначен';
    if(!String(c.driverUserId||'').trim())return'Введён вручную';
    return acceptanceState(c)?'Автомобиль принят':'Ожидает подтверждения';
  };

  function sanitizeDriverStatusUi(){
    const roots=[
      document.getElementById('driversRegistryList'),
      document.getElementById('carDriverPickerResults'),
      document.getElementById('adminDriverProfileDialog'),
      document.getElementById('driversPage')
    ].filter(Boolean);

    for(const root of roots){
      for(const card of root.querySelectorAll('[data-pick-driver],[data-open-driver-profile],.driver-registry-card,.driver-picker-card')){
        const uid=card.dataset.pickDriver||card.dataset.openDriverProfile||'';
        const c=uid?assignedCarForUser(uid):null;
        if(!c)continue;
        const accepted=acceptanceState(c);
        const labels=[...card.querySelectorAll('*')].filter(el=>{
          if(el.children.length)return false;
          const text=(el.textContent||'').trim();
          return ['Ожидает приёмки','Ожидает приемки','Ожидает подтверждения','Автомобиль принят','На линии'].includes(text);
        });
        for(const el of labels){
          el.textContent=accepted?'Автомобиль принят':'Ожидает приёмки';
          el.classList.remove('pending','accepted','repair','free');
          el.classList.add(accepted?'accepted':'pending');
        }
      }
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

  const refresh=()=>{
    patchServiceFeed();
    try{window.renderDriversRegistry?.()}catch{}
    try{window.renderDriverPickerCards?.(document.getElementById('carDriverPickerSearch')?.value||'')}catch{}
    setTimeout(sanitizeDriverStatusUi,0);
  };

  let timer=0;
  new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(sanitizeDriverStatusUi,80);
  }).observe(document.documentElement,{subtree:true,childList:true});

  window.addEventListener('fleetpilot:driver-assignment-changed',()=>setTimeout(refresh,0));
  window.addEventListener('fleetpilot:assignments-changed',()=>setTimeout(refresh,0));
  window.addEventListener('fleetpilot:cloud-ready',()=>setTimeout(refresh,0));
  setTimeout(refresh,0);
  setInterval(()=>{patchServiceFeed();sanitizeDriverStatusUi()},1500);
  console.info('FleetPilot driver status v1.1 active');
})();
