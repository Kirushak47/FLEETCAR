/* FleetPilot operational domain v1.5 — authoritative state with mobile-safe rendering */
(()=>{
'use strict';
let installing=false,authoritativeAssignments=[],pullInFlight=null,renderQueued=false,lastRenderAt=0;
const normStatus=v=>String(v||'').toLowerCase()==='on_line'?'active':String(v||'').toLowerCase();
const apiStatus=v=>normStatus(v);
const cars=()=>Array.isArray(window.db?.cars)?window.db.cars:[];
const getCar=id=>typeof window.car==='function'?window.car(String(id||'')):cars().find(c=>String(c.id)===String(id));
const mobile=()=>matchMedia('(max-width: 900px)').matches||/iPhone|iPad|Android/i.test(navigator.userAgent||'');
const isActiveAssignment=row=>row&&String(row.status||row.assignment_status||'').toLowerCase()==='active'&&!row.returned_at&&Boolean(row.car_id)&&Boolean(row.driver_user_id);
const activeForCar=id=>authoritativeAssignments.find(r=>String(r.car_id)===String(id))||null;
const activeForDriver=id=>authoritativeAssignments.find(r=>String(r.driver_user_id)===String(id))||null;
window.FleetPilotAssignmentState={get rows(){return authoritativeAssignments.slice()},forCar:activeForCar,forDriver:activeForDriver,hasCar:id=>!!activeForCar(id),hasDriver:id=>!!activeForDriver(id)};

async function rpc(name,args={}){
 const cloud=window.FleetPilotCloud,cfg=window.FLEETPILOT_CLOUD_CONFIG||{},token=cloud?.session?.access_token;
 if(!token)throw new Error('Сессия Supabase не найдена');
 const r=await fetch(`${cfg.url}/rest/v1/rpc/${name}`,{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.publishableKey,'Authorization':`Bearer ${token}`},body:JSON.stringify(args)});
 if(!r.ok){let d='';try{const b=await r.json();d=b?.message||b?.details||''}catch{}throw new Error(d||`${name} HTTP ${r.status}`)}
 try{return await r.json()}catch{return null}
}

function scheduleRender({carId='',forceCar=false}={}){
 if(renderQueued)return;
 renderQueued=true;
 requestAnimationFrame(()=>{
  renderQueued=false;lastRenderAt=Date.now();
  try{window.renderFleet?.()}catch{}
  try{window.renderDriversRegistry?.()}catch{}
  try{window.renderDriverPortal?.()}catch{}
  try{window.renderDriverProfile?.()}catch{}
  if(!mobile()){
   try{window.renderStableFleetTable?.()}catch{}
   try{window.renderDesktopCommand?.()}catch{}
   try{window.scheduleDesktopLiveRefresh?.({preserveMapViewport:true})}catch{}
   if(forceCar&&carId&&document.querySelector('#carPage')?.classList.contains('active')){try{window.openCar?.(carId)}catch{}}
  }
 });
}

function clearAccountDriver(c){
 if(!c)return false;
 const had=!!(c.driverUserId||c.driverEmail||c.driverName||c.driverAcceptedAt||c.driverAssignedAt||c.driverAssignmentSource==='account');
 c.driverUserId='';c.driverEmail='';c.driverName='';c.driverPhone='';c.driverAcceptedAt='';c.driverAcceptedRevision='';c.driverAssignedAt='';c.driverAssignmentRevision='';
 if(c.driverAssignmentSource==='account'){c.tenant='';c.driverAssignmentSource=''}
 return had
}

function reconcileAssignments(rows){
 authoritativeAssignments=(rows||[]).filter(isActiveAssignment);
 const activeByCar=new Map(authoritativeAssignments.map(r=>[String(r.car_id),r]));
 let changed=false;
 for(const c of cars()){
  if(c.driverAssignmentSource==='manual'&&!c.driverUserId)continue;
  const row=activeByCar.get(String(c.id));
  if(!row){if(c.driverUserId||c.driverAssignmentSource==='account')changed=clearAccountDriver(c)||changed;continue}
  const uid=String(row.driver_user_id||'');
  if(String(c.driverUserId||'')!==uid){c.driverUserId=uid;changed=true}
  if(c.driverAssignmentSource!=='account'){c.driverAssignmentSource='account';changed=true}
 }
 try{
  if(typeof workspaceDriverAssignments==='object'&&workspaceDriverAssignments){for(const k of Object.keys(workspaceDriverAssignments))delete workspaceDriverAssignments[k];for(const r of authoritativeAssignments)workspaceDriverAssignments[String(r.driver_user_id)]=String(r.car_id)}
  if(Array.isArray(workspaceDriverAssignmentRows))workspaceDriverAssignmentRows.splice(0,workspaceDriverAssignmentRows.length,...authoritativeAssignments)
 }catch{}
 if(changed){try{window.save?.()}catch{}}
 window.dispatchEvent(new CustomEvent('fleetpilot:authoritative-assignments',{detail:{rows:authoritativeAssignments.slice()}}));
 return {rows:authoritativeAssignments,changed}
}

async function pullAssignments(){const rows=await rpc('get_workspace_driver_assignments_v12')||[];return reconcileAssignments(rows)}
async function pullOperationalStatuses(){
 const rows=await rpc('get_vehicle_operational_statuses')||[];let changed=false;
 for(const row of rows){const c=getCar(row.car_id);if(!c)continue;const next=normStatus(row.status);if(['active','repair','free'].includes(next)&&c.status!==next){c.status=next;changed=true}}
 if(changed){try{window.save?.()}catch{}}
 return {rows,changed}
}
async function pullAuthoritativeState(options={}){
 if(pullInFlight)return pullInFlight;
 pullInFlight=(async()=>{
  try{
   const [a,s]=await Promise.all([pullAssignments(),pullOperationalStatuses()]);
   if(a.changed||s.changed||options.forceRender)scheduleRender({carId:String(options.carId||window.selectedCarId||''),forceCar:!!options.forceCar});
   return {assignments:a.rows,statuses:s.rows}
  }catch(error){console.warn('Authoritative state pull failed',error);return null}
  finally{pullInFlight=null}
 })();
 return pullInFlight
}

function installStatusWriter(){
 const current=window.setVehicleOperationalStatus;if(current?.__fpOperationalDomainV15)return;
 const wrapped=function(carId,status){const c=getCar(carId);if(!c)return false;const next=normStatus(status);if(!['active','repair','free'].includes(next))return false;const previous=c.status;c.status=next;try{window.save?.()}catch{};scheduleRender();rpc('set_vehicle_operational_status',{car_id_value:String(c.id),status_value:apiStatus(next)}).then(()=>pullAuthoritativeState({forceRender:true})).catch(e=>{console.error('Fleet Board status save failed',e);c.status=previous;try{window.save?.()}catch{};scheduleRender();try{window.toast?.('Не удалось сохранить статус Fleet Board')}catch{}});return true};
 wrapped.__fpOperationalDomainV15=true;wrapped.__fpOriginal=current;window.setVehicleOperationalStatus=wrapped
}
function installFleetBoardBridge(){if(typeof window.updateCarStatusLive==='function'&&!window.updateCarStatusLive.__fpOperationalDomainV15){const w=(carId,status)=>window.setVehicleOperationalStatus?.(carId,status);w.__fpOperationalDomainV15=true;window.updateCarStatusLive=w}}
function installCloudAssignmentFeed(){const cloud=window.FleetPilotCloud;if(!cloud||cloud.getDriverAssignments?.__fpOperationalDomainV15)return;const w=async()=>{const r=await pullAssignments();scheduleRender();return r.rows};w.__fpOperationalDomainV15=true;cloud.getDriverAssignments=w}
function installCloudLifecycleRefresh(){
 const cloud=window.FleetPilotCloud;if(!cloud)return;
 if(typeof cloud.assignDriverVehicle==='function'&&!cloud.assignDriverVehicle.__fpOperationalRefreshV15){const o=cloud.assignDriverVehicle.bind(cloud);const w=async function(){const r=await o(...arguments);await pullAuthoritativeState({forceRender:true});return r};w.__fpOperationalRefreshV15=true;w.__fpOriginal=o;cloud.assignDriverVehicle=w}
 if(typeof cloud.submitVehicleHandover==='function'&&!cloud.submitVehicleHandover.__fpOperationalRefreshV15){const o=cloud.submitVehicleHandover.bind(cloud);const w=async function(payload){const r=await o(payload);await pullAuthoritativeState({forceRender:true});return r};w.__fpOperationalRefreshV15=true;w.__fpOriginal=o;cloud.submitVehicleHandover=w}
}
function installLegacyGuards(){
 if(typeof window.workspaceDriverForCar==='function'&&!window.workspaceDriverForCar.__fpAuthoritativeV15){const o=window.workspaceDriverForCar;const w=function(c){if(!c)return null;const row=activeForCar(c.id);if(!row){if(c.driverAssignmentSource==='manual'&&!c.driverUserId)return o(c);return null}const r=o(c)||{};return {...r,userId:String(row.driver_user_id||''),source:'account',accepted:!!(row.active_handover_id||row.accepted_at||String(row.handover_status||'').toLowerCase()==='active')}};w.__fpAuthoritativeV15=true;window.workspaceDriverForCar=w}
}
async function install(){
 if(installing)return;installing=true;installStatusWriter();installFleetBoardBridge();installCloudAssignmentFeed();installCloudLifecycleRefresh();installLegacyGuards();await pullAuthoritativeState({forceRender:true});
 let n=0;const t=setInterval(()=>{n++;installStatusWriter();installFleetBoardBridge();installCloudAssignmentFeed();installCloudLifecycleRefresh();installLegacyGuards();if(n>30)clearInterval(t)},200);
 const delayed=()=>setTimeout(()=>pullAuthoritativeState({forceRender:true}),120);
 window.addEventListener('fleetpilot:driver-assignment-changed',delayed);window.addEventListener('fleetpilot:assignments-changed',delayed);
 window.addEventListener('focus',()=>{if(Date.now()-lastRenderAt>1000)pullAuthoritativeState()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastRenderAt>1000)pullAuthoritativeState()});
}
if(document.readyState==='loading')window.addEventListener('load',install,{once:true});else install();
})();
