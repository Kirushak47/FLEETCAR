/* FleetPilot 20 — Drivers State
   Driver state is intentionally simple: assigned vehicle => На линии; otherwise Без автомобиля. */
(()=>{
 'use strict';
 const FP=window.FleetPilot=window.FleetPilot||{};
 const Core=FP.Core;if(!Core)throw new Error('FleetPilot Core must load before Drivers State');
 if(FP.Drivers)return;
 const directory=()=>{try{return typeof workspaceDriverDirectory!=='undefined'&&Array.isArray(workspaceDriverDirectory)?workspaceDriverDirectory:[]}catch{return[]}};
 const userId=member=>String(member?.user_id||member?.id||'');
 const email=member=>{try{return typeof workspaceDriverEmail==='function'?workspaceDriverEmail(member):(member?.profiles?.email||member?.email||'')}catch{return member?.profiles?.email||member?.email||''}};
 const name=member=>{try{return typeof workspaceDriverName==='function'?workspaceDriverName(member):(member?.display_name||member?.name||email(member)||'Водитель')}catch{return member?.display_name||member?.name||email(member)||'Водитель'}};
 const phone=member=>{try{return typeof workspaceDriverPhone==='function'?workspaceDriverPhone(member):(member?.phone||member?.profiles?.phone||'')}catch{return member?.phone||member?.profiles?.phone||''}};
 const carFor=user=>Core.activeCars().find(c=>Core.same(c.driverUserId,user))||null;
 const stateFor=user=>{const car=carFor(user);return car?{code:'active',label:'На линии',car}:{code:'free',label:'Без автомобиля',car:null}};
 const members=()=>directory().filter(m=>String(m?.role||'')==='driver'&&m?.status!=='disabled');
 const rows=()=>members().map(member=>({member,userId:userId(member),name:name(member),email:email(member),phone:phone(member),state:stateFor(userId(member))}));
 FP.Drivers=Object.freeze({directory,members,rows,userId,email,name,phone,carFor,stateFor});
 console.info('FleetPilot 20 drivers state ready');
})();