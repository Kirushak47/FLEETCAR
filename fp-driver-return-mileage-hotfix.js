/* FleetPilot driver return mileage RPC fallback — 2026-08-12 */
(()=>{
  'use strict';

  const same=(a,b)=>String(a??'')===String(b??'');
  const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
  const currentDriverId=()=>String(window.FleetPilotCloud?.session?.user?.id||'');
  const assignedCar=()=>{
    try{
      if(typeof window.driverAssignedCar==='function'){
        const c=window.driverAssignedCar();
        if(c)return c;
      }
    }catch{}
    const uid=currentDriverId();
    return uid?cars().find(c=>same(c.driverUserId,uid))||null:null;
  };
  const validMileage=value=>{
    const n=Number(value);
    return Number.isFinite(n)&&n>=0?n:null;
  };
  function applyLocalMileage(car,value,source='driver_manual'){
    const n=validMileage(value);
    if(!car||n==null)return null;
    car.mileage=n;
    car.mileageUpdatedAt=new Date().toISOString();
    car.mileageUpdatedBy=source;
    try{window.save?.()}catch(error){console.warn('FleetPilot local mileage save',error)}
    return car;
  }

  function install(){
    const cloud=window.FleetPilotCloud;
    if(!cloud)return false;

    if(typeof cloud.updateDriverMileage==='function'&&!cloud.updateDriverMileage.__fpReturnMileageFixed){
      const original=cloud.updateDriverMileage.bind(cloud);
      const fixed=async function(mileage,source='driver_manual'){
        const n=validMileage(mileage);
        if(n==null)throw new Error('Некорректный пробег');

        // Return mileage is already sent as part of submitVehicleHandover().
        // Never call the obsolete update_assigned_vehicle_mileage RPC here.
        if(String(source)==='vehicle_return'){
          return {mileage:n,source,local_only:true};
        }

        try{
          return await original(n,source);
        }catch(error){
          const text=String(error?.message||error||'').toLowerCase();
          const missing=text.includes('update_assigned_vehicle_mileage')||text.includes('404')||text.includes('not found')||text.includes('could not find the function')||text.includes('schema cache');
          if(!missing)throw error;
          const c=assignedCar();
          applyLocalMileage(c,n,source);
          console.warn('FleetPilot: obsolete mileage RPC unavailable; shared fleet fallback used');
          return {mileage:n,source,local_only:true};
        }
      };
      fixed.__fpReturnMileageFixed=true;
      fixed.__fpOriginal=original;
      cloud.updateDriverMileage=fixed;
    }

    if(typeof cloud.submitVehicleHandover==='function'&&!cloud.submitVehicleHandover.__fpReturnMileageFixed){
      const original=cloud.submitVehicleHandover.bind(cloud);
      const fixed=async function(payload={}){
        const isReturn=String(payload?.type||'')==='return';
        const target=isReturn?assignedCar():null;
        const result=await original(payload);
        if(isReturn&&target){
          applyLocalMileage(target,payload?.mileage,'vehicle_return');
          // Do not navigate/reload here. Handover UI owns its own completion state.
          try{window.renderFleet?.()}catch{}
          try{window.renderDriversRegistry?.()}catch{}
        }
        return result;
      };
      fixed.__fpReturnMileageFixed=true;
      fixed.__fpOriginal=original;
      cloud.submitVehicleHandover=fixed;
    }

    return Boolean(cloud.updateDriverMileage?.__fpReturnMileageFixed&&cloud.submitVehicleHandover?.__fpReturnMileageFixed);
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(install()||attempts>50)clearInterval(timer);
  },100);
  install();
})();
