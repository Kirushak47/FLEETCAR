/* FleetPilot driver status consistency — 2026-08-12 */
(()=>{
  'use strict';
  if(window.__fpDriverStatusV1)return;
  window.__fpDriverStatusV1=true;

  const same=(a,b)=>String(a??'')===String(b??'');
  const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
  const assignedCarForUser=userId=>cars().find(c=>same(c.driverUserId,userId))||null;

  // Driver status has only two values. Vehicle operation status is a separate domain.
  window.driverPickerStatus=function(member){
    const c=assignedCarForUser(member?.user_id);
    if(!c)return{label:'Без автомобиля',cls:'free',vehicle:''};
    let vehicle='';
    try{
      const m=typeof window.model==='function'?window.model(c):{};
      vehicle=`${m?.brand||c.brand||''} ${m?.model||c.model||''} · ${c.plate||'—'}`.trim();
    }catch{vehicle=c.plate||''}
    return{label:'На линии',cls:'accepted',vehicle};
  };

  window.fleetDriverMeta=function(c){
    if(!c)return'Не назначен';
    const hasDriver=Boolean(String(c.driverUserId||'').trim()||String(c.tenant||'').trim());
    return hasDriver?'На линии':'Не назначен';
  };

  function sanitizeDriverStatusUi(){
    // Old status labels can still be produced by legacy markup/functions. Normalize only
    // driver-related UI; vehicle Fleet Board keeps repair/free/on_line independently.
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
        if(['Ожидает приёмки','Ожидает приемки','Ожидает подтверждения','Автомобиль принят','В ремонте','Свободен'].includes(text)){
          const card=el.closest('[data-pick-driver],[data-open-driver-profile],.driver-registry-card,.driver-picker-card');
          if(card){
            const uid=card.dataset.pickDriver||card.dataset.openDriverProfile||'';
            const hasCar=uid?Boolean(assignedCarForUser(uid)):Boolean(card.querySelector('[data-open-driver-car],.driver-vehicle-link'));
            el.textContent=hasCar?'На линии':'Без автомобиля';
            el.classList.remove('pending','repair','free');
            el.classList.add(hasCar?'accepted':'free');
          }
        }
      }
    }

    const filter=document.getElementById('driversRegistryFilter');
    if(filter){
      for(const opt of [...filter.options]){
        const v=String(opt.value||'');
        if(['pending','accepted','repair'].includes(v))opt.remove();
        if(v==='active')opt.textContent='На линии';
        if(v==='free')opt.textContent='Без автомобиля';
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
    sanitizeDriverStatusUi();
    try{window.renderDriversRegistry?.()}catch{}
    try{window.renderDriverPickerCards?.(document.getElementById('carDriverPickerSearch')?.value||'')}catch{}
  };

  let timer=0;
  new MutationObserver(()=>{
    clearTimeout(timer);
    timer=setTimeout(sanitizeDriverStatusUi,80);
  }).observe(document.documentElement,{subtree:true,childList:true});

  window.addEventListener('fleetpilot:driver-assignment-changed',()=>setTimeout(refresh,0));
  window.addEventListener('fleetpilot:assignments-changed',()=>setTimeout(refresh,0));
  setTimeout(refresh,0);
  setInterval(patchServiceFeed,1500);
  console.info('FleetPilot driver status v1 active');
})();
