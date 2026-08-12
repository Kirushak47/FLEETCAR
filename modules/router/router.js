/* FleetPilot 20 — Router
   Navigation owns URL state. Renderers must never choose a page during boot. */
(()=>{
 'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 if(FP.Router)return;
 const ROUTES={fleetPage:'fleet',driversPage:'drivers',repairsPage:'service',paymentsPage:'rent',expensesPage:'expenses',documentsPage:'documents',calendarPage:'calendar',analyticsPage:'analytics',companyPage:'company',dataPage:'data',attentionPage:'attention',searchPage:'search',driverPortalPage:'driver',driverProfilePage:'driver/profile'};
 const PAGES=Object.fromEntries(Object.entries(ROUTES).map(([page,route])=>[route,page]));
 const clean=route=>decodeURIComponent(String(route||'').replace(/^#\/?/,'').trim());
 const current=()=>clean(location.hash);
 const hash=route=>`#/${clean(route)||'fleet'}`;
 const routeForPage=page=>ROUTES[page]||'fleet';
 const accessible=page=>{try{return typeof window.enterpriseCanOpen==='function'?window.enterpriseCanOpen(page):true}catch{return true}};
 const defaultPage=()=>{try{if(window.enterpriseCurrentRole?.()==='driver')return'driverPortalPage'}catch{}return['fleetPage','driversPage','paymentsPage','expensesPage','repairsPage','documentsPage','analyticsPage','calendarPage'].find(accessible)||'fleetPage'};
 const remember=route=>{try{sessionStorage.setItem('fleetpilot.lastRoute.v2',clean(route))}catch{}};
 const remembered=()=>{try{return clean(sessionStorage.getItem('fleetpilot.lastRoute.v2')||'')}catch{return''}};
 const pageForRoute=route=>{const parts=clean(route).split('/').filter(Boolean),root=parts[0];if(root==='car')return{page:'carPage',parts};return{page:PAGES[root]||null,parts}};
 function apply(route=current()||remembered(),{replace=false}={}){
  route=clean(route);if(!route){const page=defaultPage();route=routeForPage(page)}
  const parsed=pageForRoute(route);
  if(parsed.page==='carPage'){
   const id=parsed.parts[1],tab=parsed.parts[2]||'info',target=typeof window.fleetPilotFindCar==='function'?window.fleetPilotFindCar(id):null;
   if(target){window.openCar?.(target.id,tab);remember(route);return true}route='fleet';
  }
  let page=pageForRoute(route).page;if(!page||!document.getElementById(page)||!accessible(page)){page=defaultPage();route=routeForPage(page)}
  remember(route);const wanted=hash(route);
  if(location.hash!==wanted){const url=`${location.pathname}${location.search}${wanted}`;history[replace?'replaceState':'pushState']({fleetpilot:true},'',url)}
  if(document.querySelector('.page.active')?.id!==page)window.showPage?.(page);
  return true;
 }
 const navigatePage=(page,options={})=>apply(routeForPage(page),options);
 function installLegacyBridge(){
  try{if(typeof FLEETPILOT_ROUTES==='object')Object.assign(FLEETPILOT_ROUTES,ROUTES)}catch{}
  try{if(typeof FLEETPILOT_ROUTE_PAGES==='object')Object.assign(FLEETPILOT_ROUTE_PAGES,PAGES)}catch{}
  window.fleetPilotRouteForPage=routeForPage;
 }
 FP.Router=Object.freeze({ROUTES,PAGES,current,hash,routeForPage,pageForRoute,apply,navigatePage,remember,remembered,installLegacyBridge});
 const install=()=>{installLegacyBridge();const route=current();if(route)remember(route)};
 install();
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
 window.addEventListener('popstate',()=>apply(current(),{replace:true}));
 window.addEventListener('hashchange',()=>{const route=current();if(route)remember(route)});
 window.addEventListener('fleetpilot:access-ready',()=>{installLegacyBridge();requestAnimationFrame(()=>apply(current()||remembered(),{replace:true}))});
 console.info('FleetPilot 20 router ready');
})();