/* FleetPilot — live role permissions sync */
(()=>{'use strict';
let last='',busy=false,timer=null;
function stable(v){try{return JSON.stringify(v||{},Object.keys(v||{}).sort())}catch{return String(Date.now())}}
function activePage(){return document.querySelector('.page.active')?.id||''}
function firstAllowedPage(){const order=['fleetPage','driversPage','repairsPage','paymentsPage','expensesPage','documentsPage','calendarPage','analyticsPage','companyPage','dataPage','searchPage','driverPortalPage','driverProfilePage'];for(const id of order){try{if(document.getElementById(id)&&window.enterpriseCanOpen?.(id))return id}catch{}}return ''}
async function refresh({force=false}={}){
 if(busy||document.hidden)return false;
 const cloud=window.FleetPilotCloud;
 if(!cloud?.session||!cloud?.membership||typeof cloud.getRolePermissions!=='function')return false;
 busy=true;
 try{
  const next=await cloud.getRolePermissions();
  const sig=stable(next);
  if(!force&&sig===last)return false;
  last=sig;
  try{companyPermissions=next||{}}catch{window.companyPermissions=next||{}}
  try{fleetPilotPermissionsLoaded=true}catch{}
  window.applyEnterpriseAccess?.();
  const current=activePage();
  if(current&&window.enterpriseCanOpen&&!window.enterpriseCanOpen(current)){
   const target=firstAllowedPage();
   if(target)window.showPage?.(target)
  }
  window.FleetPilot?.DriverApp?.sync?.();
  window.dispatchEvent(new CustomEvent('fleetpilot:permissions-applied',{detail:{role:window.enterpriseCurrentRole?.(),permissions:next}}));
  return true
 }catch(error){console.warn('FleetPilot live permissions refresh failed',error);return false}
 finally{busy=false}
}
function start(){if(timer)return;refresh({force:true});timer=setInterval(()=>refresh(),8000)}
function stop(){if(timer)clearInterval(timer);timer=null}
window.addEventListener('fleetpilot:access-ready',()=>setTimeout(start,0));
window.addEventListener('focus',()=>refresh());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
window.addEventListener('online',()=>refresh({force:true}));
window.addEventListener('beforeunload',stop);
window.FleetPilot=window.FleetPilot||{};window.FleetPilot.LivePermissions={refresh,start,stop};
})();