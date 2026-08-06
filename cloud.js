(()=>{
"use strict";
const TABLE="fleet_states",PROFILE_TABLE="profiles";
const STATUS_KEY="fleetpilot.cloud.status.v3";
const PENDING_EMAIL_KEY="fleetpilot.cloud.pending_email.v1";
const DEMO_KEY="fleetpilot.demo.active.v1";
const PHOTO_KEY_BASE="fleetpilot.profile.photo.v2";
const NAME_KEY_BASE="fleetpilot.profile.name.v2";
const DEVICE_ID_KEY="fleetpilot.cloud.device_id.v1";
const PUSH_DELAY=1800;
const REALTIME_POLL_MS=45000;
let client=null,session=null,profile=null,workspace=null,membership=null,platformAdmin=false,pushTimer=null,realtimeChannel=null,realtimePollTimer=null,realtimeApplyTimer=null,syncing=false,remoteApplying=false,recoveryMode=false,started=false,authResolved=false,workspaceResolved=false;

const $=s=>document.querySelector(s);
const cfg=()=>window.FLEETPILOT_CLOUD_CONFIG||{};
const parse=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
const store=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const configured=()=>Boolean(cfg().url&&cfg().publishableKey&&!String(cfg().publishableKey).includes("PASTE_"));
const isDemo=()=>localStorage.getItem(DEMO_KEY)==="1";
const dateTime=v=>v?new Date(v).toLocaleString("ru-RU"):"—";
const owner=()=>enterpriseRole()==="owner";
const initial=email=>(String(email||"FleetPilot").trim()[0]||"F").toUpperCase();
const accountKey=(base)=>`${base}.${session?.user?.id||"guest"}`;
const deviceId=()=>{
 let id=localStorage.getItem(DEVICE_ID_KEY);
 if(!id){
  id=(crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`);
  localStorage.setItem(DEVICE_ID_KEY,id)
 }
 return id
};
const deviceName=()=>`${deviceId()}|${navigator.userAgent}`.slice(0,120);


function message(id,text,type=""){
 const el=$(id);if(!el)return;
 el.hidden=!text;el.textContent=text;el.className=`cloud-message ${type}`
}
function friendly(error){
 const t=String(error?.message||error||"Неизвестная ошибка");
 const l=t.toLowerCase();
 if(l.includes("email not confirmed"))return"Сначала подтвердите email через письмо.";
 if(l.includes("invalid login credentials"))return"Неверный email или пароль.";
 if(l.includes("workspace membership required"))return"Аккаунт не подключён к автопарку. Выйдите и войдите снова.";
 if(l.includes("workspace write permission denied"))return"У вашей роли нет права изменять общую базу автопарка.";
 if(l.includes("could not find the function")||l.includes("schema cache"))return"Обновите схему Supabase: выполните SQL-файл синхронизации и перезагрузите страницу.";
 if(l.includes("row-level security")||l.includes("permission denied"))return"Supabase заблокировал синхронизацию политикой доступа. Выполните SQL-файл исправления.";
 if(l.includes("duplicate key")||l.includes("unique constraint")||l.includes("on conflict"))return"Конфликт старой облачной записи. Выполните SQL-файл исправления синхронизации.";
 if(t.includes("fleet_states"))return"Облачная база ещё не настроена.";
 return t
}
function init(){
 if(!configured()||!window.supabase?.createClient)return null;
 client=window.supabase.createClient(cfg().url,cfg().publishableKey,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
 });
 return client
}
function showAuth(view="welcome"){
 const screens=["#authWelcomeView","#authLoginView","#authRegisterView","#authConfirmView","#authRecoveryView"];
 screens.forEach(selector=>{
  const el=$(selector);
  if(el){
   el.hidden=true;
   el.setAttribute("aria-hidden","true")
  }
 });

 const map={
  welcome:"#authWelcomeView",
  login:"#authLoginView",
  register:"#authRegisterView",
  confirm:"#authConfirmView",
  recovery:"#authRecoveryView"
 };

 const target=$(map[view]||map.welcome);
 if(target){
  target.hidden=false;
  target.setAttribute("aria-hidden","false")
 }
}
function setGate(){
 const gate=$("#authGate");
 if(!gate)return;

 const showGate=recoveryMode||(!session&&!isDemo());
 gate.hidden=!showGate;
 document.documentElement.classList.toggle("auth-locked",showGate);

 if(recoveryMode)showAuth("recovery");
 setWorkspaceGate()
}
async function loadProfile(){
 profile=null;if(!session||!client)return;
 const {data,error}=await client.from(PROFILE_TABLE).select("user_id,email,role,job_title,created_at").eq("user_id",session.user.id).maybeSingle();
 if(error)console.error("profile",error);
 profile=data||null
}
async function loadWorkspace(){
 workspace=null;
 membership=null;
 if(!session||!client)return null;

 const {data:member,error}=await client
  .from("workspace_members")
  .select("workspace_id,user_id,role,city,status,created_at,workspaces(id,name,slug,created_at)")
  .eq("user_id",session.user.id)
  .eq("status","active")
  .limit(1)
  .maybeSingle();

 if(error){
  console.error("workspace load",error);
  return null
 }

 membership=member||null;
 workspace=member?.workspaces||null;
 return membership
}
async function loadPlatformAdmin(){
 platformAdmin=false;
 if(!session||!client)return false;

 const {data,error}=await client
  .from("platform_admins")
  .select("user_id")
  .eq("user_id",session.user.id)
  .maybeSingle();

 if(error){
  console.error("platform admin load",error);
  return false
 }

 platformAdmin=Boolean(data);
 return platformAdmin
}
function isPlatformAdmin(){
 return platformAdmin===true
}


async function getPendingWorkspaceInvite(){
 if(!client||!session)return null;
 const {data,error}=await client.rpc("get_my_pending_workspace_invite");
 if(error){
  console.error("pending invite",error);
  return null
 }
 return Array.isArray(data)?data[0]||null:data||null
}
async function createWorkspace({name,city,jobTitle}){
 if(!client||!session)throw new Error("Сначала войдите");
 const {data,error}=await client.rpc("create_my_workspace",{
  company_name:String(name||"").trim(),
  company_city:String(city||"").trim()||null,
  job_title_value:String(jobTitle||"CEO").trim()||"CEO"
 });
 if(error)throw error;
 await loadProfile();
 await loadWorkspace();
 return data
}
async function acceptPendingInvite(){
 if(!client||!session)throw new Error("Сначала войдите");
 const {data,error}=await client.rpc("accept_my_workspace_invite");
 if(error)throw error;
 await loadProfile();
 await loadWorkspace();
 return data
}
async function platformOverview(){
 if(!client||!isPlatformAdmin())return[];
 const {data,error}=await client.rpc("platform_workspace_overview");
 if(error)throw error;
 return data||[]
}
function setWorkspaceGate(){
 const gate=$("#workspaceGate");
 if(!gate)return;

 // Do not show onboarding while the existing session and workspace
 // membership are still being restored from Supabase.
 const show=Boolean(
  authResolved &&
  workspaceResolved &&
  session &&
  !membership &&
  !isDemo()
 );

 gate.hidden=!show;
 document.documentElement.classList.toggle("workspace-locked",show)
}
async function renderWorkspaceOnboarding(){
 setWorkspaceGate();
 if(!authResolved||!workspaceResolved||!session||membership)return;

 const invite=await getPendingWorkspaceInvite();
 const box=$("#workspacePendingInvite");
 if(!box)return;

 box.hidden=!invite;
 box.dataset.inviteId=invite?.invite_id||"";

 if(invite){
  const roleLabels={owner:"Владелец",coordinator:"Координатор",accountant:"Бухгалтер",mechanic:"Механик",driver:"Водитель"};
  $("#workspacePendingInviteText").textContent=`${invite.workspace_name} · ${roleLabels[invite.role]||invite.role}${invite.city?` · ${invite.city}`:""}`
 }
}
function enterpriseRole(){
 return membership?.role||profile?.role||"user"
}
function hasEnterpriseRole(...roles){
 return roles.includes(enterpriseRole())
}
async function enterpriseList(){
 if(!client||!membership)return{members:[],invites:[]};

 const [{data:members,error:mError},{data:invites,error:iError}]=await Promise.all([
  client.from("workspace_members")
   .select("workspace_id,user_id,role,city,status,created_at,profiles(email)")
   .eq("workspace_id",membership.workspace_id)
   .order("created_at",{ascending:true}),
  client.from("workspace_invites")
   .select("id,email,role,city,status,created_at,expires_at")
   .eq("workspace_id",membership.workspace_id)
   .order("created_at",{ascending:false})
 ]);

 if(mError||iError)throw(mError||iError);
 return{members:members||[],invites:invites||[]}
}
async function enterpriseInvite({email,role,city}){
 if(!client||!membership)throw new Error("Рабочее пространство недоступно");
 if(!hasEnterpriseRole("owner"))throw new Error("Только владелец может приглашать сотрудников");

 const normalized=String(email||"").trim().toLowerCase();
 if(!normalized||!normalized.includes("@"))throw new Error("Введите правильный email");

 const {data,error}=await client.functions.invoke("invite-member",{
  body:{
   email:normalized,
   role,
   city:String(city||"").trim()||null
  }
 });

 if(error){
  let details="";
  try{
   const payload=await error.context?.json?.();
   details=payload?.error||payload?.message||""
  }catch{}
  throw new Error(details||error.message||"Не удалось отправить приглашение")
 }

 if(!data?.ok)throw new Error(data?.error||"Не удалось отправить приглашение");
 return data
}
async function enterpriseUpdateMember(userId,patch){
 if(!client||!membership)throw new Error("Рабочее пространство недоступно");
 if(!hasEnterpriseRole("owner"))throw new Error("Только владелец может менять роли");
 const {error}=await client.from("workspace_members")
  .update(patch)
  .eq("workspace_id",membership.workspace_id)
  .eq("user_id",userId);
 if(error)throw error
}
async function enterpriseCancelInvite(id){
 if(!client||!membership)throw new Error("Рабочее пространство недоступно");
 if(!hasEnterpriseRole("owner"))throw new Error("Только владелец может отменять приглашения");
 const {error}=await client.from("workspace_invites")
  .update({status:"cancelled"})
  .eq("workspace_id",membership.workspace_id)
  .eq("id",id);
 if(error)throw error
}

function avatarData(){
 const email=session?.user?.email||"";
 return{
  photo:session?localStorage.getItem(accountKey(PHOTO_KEY_BASE))||"": "",
  name:session?localStorage.getItem(accountKey(NAME_KEY_BASE))||email.split("@")[0]||"FleetPilot User":"FleetPilot",
  letter:initial(email)
 }
}
function renderAvatar(){
 const data=avatarData();
 ["#profileAvatarImage","#profileLargeAvatar"].forEach(sel=>{
  const el=$(sel);if(!el)return;
  if(data.photo){el.style.backgroundImage=`url("${data.photo}")`;el.textContent="";el.classList.add("has-photo")}
  else{el.style.backgroundImage="";el.textContent=data.letter;el.classList.remove("has-photo")}
 });
 if($("#profileDisplayName"))$("#profileDisplayName").textContent=data.name;
 if($("#profileOnlineDot"))$("#profileOnlineDot").classList.toggle("demo",isDemo())
}
function renderSummary(){
 const root=$("#cloudConnectionSummary");if(!root)return;
 if(session){
  const saved=parse(STATUS_KEY,{});
  root.innerHTML=`<span class="cloud-state-dot online"></span><div><strong>${session.user.email}</strong><small>${saved.lastSync?`Синхронизировано ${dateTime(saved.lastSync)}`:"Облако подключено"}</small></div><button type="button" class="btn" onclick="FleetPilotCloud.openProfile()">Профиль</button>`
 }else if(isDemo()){
  root.innerHTML=`<span class="cloud-state-dot demo"></span><div><strong>Демо-режим</strong><small>Тестовые данные не отправляются в облако</small></div><button type="button" class="btn" onclick="FleetPilotCloud.openProfile()">Открыть</button>`
 }else{
  root.innerHTML=`<span class="cloud-state-dot local"></span><div><strong>Вход не выполнен</strong><small>Войдите или откройте демо-режим</small></div><button type="button" class="btn primary" onclick="FleetPilotCloud.showLogin()">Войти</button>`
 }
}

function stopRealtimeSync(){
 clearTimeout(realtimeApplyTimer);
 clearInterval(realtimePollTimer);
 realtimeApplyTimer=null;
 realtimePollTimer=null;

 if(realtimeChannel&&client){
  try{client.removeChannel(realtimeChannel)}catch(error){console.warn("Realtime channel cleanup",error)}
 }
 realtimeChannel=null
}
function cloudTimestamp(){
 return parse(STATUS_KEY,{})?.lastSync||null
}
function isCloudNewer(remoteUpdatedAt){
 if(!remoteUpdatedAt)return false;
 const local=cloudTimestamp();
 return !local||new Date(remoteUpdatedAt).getTime()>new Date(local).getTime()+250
}
async function applyRemoteFleetState(row,{reload=true}={}){
 if(!row?.payload||remoteApplying)return false;
 if(String(row.device_name||"").startsWith(`${deviceId()}|`))return false;
 if(!isCloudNewer(row.updated_at))return false;

 remoteApplying=true;
 try{
  removeOldQuotaBackups();
  await backupCurrent();
  window.replaceFleetPilotDatabase(row.payload);
  setStatus("Обновлено с другого устройства",row.updated_at,"online");
  window.toast?.("Получены новые данные из облака");

  if(reload){
   clearTimeout(realtimeApplyTimer);
   realtimeApplyTimer=setTimeout(()=>location.reload(),500)
  }
  return true
 }catch(error){
  console.error("Realtime apply failed",error);
  setStatus("Ошибка автоматического обновления",null,"error");
  return false
 }finally{
  remoteApplying=false
 }
}
async function checkCloudForUpdates(){
 if(!client||!session||!membership?.workspace_id||syncing||remoteApplying||document.hidden)return false;
 try{
  const row=await fetchRow();
  return await applyRemoteFleetState(row)
 }catch(error){
  console.warn("Realtime fallback check failed",error);
  return false
 }
}
function scheduleRemoteApply(row){
 if(!row?.payload)return;
 if(String(row.device_name||"").startsWith(`${deviceId()}|`))return;

 clearTimeout(realtimeApplyTimer);
 realtimeApplyTimer=setTimeout(async()=>{
  // Let an active local save finish before reading the newest cloud version.
  if(syncing||pushTimer){
   scheduleRemoteApply(row);
   return
  }
  await applyRemoteFleetState(row)
 },350)
}
async function startRealtimeSync(){
 stopRealtimeSync();
 if(!client||!session||!membership?.workspace_id||isDemo())return;

 const workspaceId=membership.workspace_id;
 realtimeChannel=client
  .channel(`fleet-state-${workspaceId}`)
  .on("postgres_changes",{
   event:"*",
   schema:"public",
   table:TABLE,
   filter:`workspace_id=eq.${workspaceId}`
  },payload=>{
   const row=payload.new||null;
   if(row)scheduleRemoteApply(row)
  })
  .on("postgres_changes",{event:"*",schema:"public",table:"driver_vehicle_assignments",filter:`workspace_id=eq.${workspaceId}`},()=>{
   window.dispatchEvent(new CustomEvent("fleetpilot:assignments-changed"));
   checkCloudForUpdates()
  })
  .on("postgres_changes",{event:"*",schema:"public",table:"driver_repair_requests",filter:`workspace_id=eq.${workspaceId}`},()=>{
   window.dispatchEvent(new CustomEvent("fleetpilot:repair-requests-changed"))
  })
  .subscribe(status=>{
   if(status==="SUBSCRIBED")setStatus("Онлайн · автосинхронизация",cloudTimestamp(),"online");
   if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")setStatus("Переподключение к облаку…",cloudTimestamp(),"syncing")
  });

 realtimePollTimer=setInterval(checkCloudForUpdates,REALTIME_POLL_MS)
}
function bindRealtimeLifecycle(){
 document.addEventListener("visibilitychange",()=>{
  if(!document.hidden)checkCloudForUpdates()
 });
 window.addEventListener("focus",checkCloudForUpdates);
 window.addEventListener("online",()=>{
  startRealtimeSync();
  checkCloudForUpdates()
 })
}
async function loadSessionContext(nextSession){
 stopRealtimeSync();
 session=nextSession||null;
 profile=null;
 workspace=null;
 membership=null;
 platformAdmin=false;
 workspaceResolved=false;

 if(session){
  localStorage.removeItem(DEMO_KEY);
  await loadProfile();
  await loadWorkspace();
  await loadPlatformAdmin()
 }

 workspaceResolved=true;
 if(session&&membership?.workspace_id)await startRealtimeSync()
}
function render(){
 const logged=$("#profileLoggedInView"),guest=$("#profileGuestView"),demo=$("#profileDemoView"),admin=$("#cloudAdminSection");

 if(logged)logged.hidden=true;
 if(guest)guest.hidden=true;
 if(demo)demo.hidden=true;
 if(admin)admin.hidden=true;

 if(session){
  if(logged)logged.hidden=false;
  if(admin)admin.hidden=!isPlatformAdmin()
 }else if(isDemo()){
  if(demo)demo.hidden=false
 }else{
  if(guest)guest.hidden=false
 }
 if($("#cloudUserEmail"))$("#cloudUserEmail").textContent=session?.user?.email||"";
 if($("#cloudUserRole")){
  $("#cloudUserRole").textContent=owner()?(profile?.job_title||"Владелец"):({coordinator:"Координатор",accountant:"Бухгалтер",mechanic:"Механик",driver:"Водитель"}[enterpriseRole()]||"Пользователь");
  $("#cloudUserRole").classList.toggle("owner",owner())
 }
 const saved=parse(STATUS_KEY,{});
 if($("#cloudSyncStatus"))$("#cloudSyncStatus").textContent=saved.text||"Облако подключено";
 if($("#cloudLastSync"))$("#cloudLastSync").textContent=saved.lastSync?dateTime(saved.lastSync):"Ещё не синхронизировано";
 renderAvatar();renderSummary();setGate();
 if(workspaceResolved)renderWorkspaceOnboarding();
 window.dispatchEvent(new CustomEvent("fleetpilot:access-ready",{
  detail:{
   role:enterpriseRole(),
   membership,
   workspace,
   platformAdmin:isPlatformAdmin()
  }
 }))
}
function setStatus(text,lastSync=null,state="online"){
 store(STATUS_KEY,{text,lastSync,state});render()
}
async function refreshSession(){
 if(!client)init();
 authResolved=false;
 workspaceResolved=false;

 if(!client){
  await loadSessionContext(null);
  authResolved=true;
  render();
  return
 }

 const {data}=await client.auth.getSession();
 await loadSessionContext(data?.session||null);
 authResolved=true;
 render()
}
async function fetchRow(){
 if(!session)throw new Error("Сначала войдите");
 if(!membership?.workspace_id)throw new Error("Workspace membership required");

 const {data,error}=await client.rpc("load_workspace_fleet_state");
 if(error)throw error;

 const row=Array.isArray(data)?data[0]||null:data||null;
 return row
}
function stats(p){return{cars:p?.cars?.length||0,repairs:p?.repairs?.length||0,payments:p?.payments?.length||0,expenses:p?.expenses?.length||0}}
function openBackupDb(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open("fleetpilot.cloud.backups",1);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains("backups"))db.createObjectStore("backups",{keyPath:"id"})};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)
 })
}
async function backupCurrent(){
 const payload=window.getFleetPilotDatabase?.();if(!payload)return false;
 try{
  const db=await openBackupDb();
  await new Promise((resolve,reject)=>{
   const tx=db.transaction("backups","readwrite");
   tx.objectStore("backups").put({id:`prepull-${Date.now()}`,createdAt:new Date().toISOString(),payload});
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)
  });
  db.close();return true
 }catch(error){console.warn("IndexedDB backup failed",error);return false}
}
function removeOldQuotaBackups(){
 Object.keys(localStorage).filter(k=>k.startsWith("fleetpilot.cloud.prepull.")).forEach(k=>localStorage.removeItem(k))
}
async function pushNow({silent=false,force=false}={}){
 if(syncing||!session)return false;
 syncing=true;
 setStatus("Синхронизация…",null,"syncing");
 try{
  if(!membership?.workspace_id)throw new Error("Workspace membership required");
  if(!["owner","coordinator"].includes(enterpriseRole()))throw new Error("Workspace write permission denied");
  const payload=window.getFleetPilotDatabase?.();
  if(!payload||typeof payload!=="object")throw new Error("Локальная база недоступна");

  const localCars=Array.isArray(payload.cars)?payload.cars.length:0;
  const remoteRow=await fetchRow().catch(()=>null);
  const remoteCars=Array.isArray(remoteRow?.payload?.cars)?remoteRow.payload.cars.length:0;

  if(!force&&localCars===0&&remoteCars>0){
   await applyRemoteFleetState(remoteRow,{reload:true});
   throw new Error(`Пустая база заблокирована. В облаке найдено автомобилей: ${remoteCars}`)
  }

  if(!force&&remoteCars>localCars&&localCars>0){
   const approved=confirm(`В облаке ${remoteCars} автомобилей, а на устройстве ${localCars}.\n\nЗаменить облачную базу локальной?`);
   if(!approved){
    await applyRemoteFleetState(remoteRow,{reload:true});
    return false
   }
  }

  const now=new Date().toISOString();
  const {data,error}=await client.rpc("save_workspace_fleet_state",{
   state_payload:payload,
   state_device_name:deviceName()
  });
  if(error)throw error;
  const savedAt=(Array.isArray(data)?data[0]?.updated_at:data?.updated_at)||now;
  setStatus("Все изменения сохранены",savedAt,"online");
  message("#cloudAuthMessage","");
  if(!silent)window.toast?.("Облачная база обновлена");
  return true
 }catch(e){
  console.error("FleetPilot workspace sync failed",e);
  message("#cloudAuthMessage",friendly(e),"error");
  setStatus("Ошибка синхронизации",null,"error");
  if(!silent)window.toast?.(friendly(e));
  return false
 }finally{syncing=false}
}
async function pullNow({ask=true,row=null,reload=true}={}){
 if(syncing||!session)return false;
 syncing=true;
 setStatus("Загрузка из облака…",null,"syncing");

 try{
  const cloudRow=row||await fetchRow();
  if(!cloudRow?.payload)throw new Error("В облаке пока нет данных");

  const s=stats(cloudRow.payload);
  if(ask&&!confirm(`Скачать облачную базу?\n\nАвтомобили: ${s.cars}\nРемонты: ${s.repairs}\nОплаты: ${s.payments}`))return false;

  removeOldQuotaBackups();
  await backupCurrent();
  window.replaceFleetPilotDatabase(cloudRow.payload);
  setStatus("Загружено из облака",cloudRow.updated_at,"online");

  if(reload)location.reload();
  return true
 }catch(e){
  message("#cloudAuthMessage",friendly(e),"error");
  setStatus("Ошибка загрузки",null,"error");
  return false
 }finally{
  syncing=false
 }
}
function schedulePush(){
 clearTimeout(pushTimer);
 pushTimer=null;
 if(session&&!isDemo()&&["owner","coordinator"].includes(enterpriseRole())){
  pushTimer=setTimeout(async()=>{
   pushTimer=null;
   await pushNow({silent:true})
  },PUSH_DELAY)
 }
}
async function firstSync(){
 try{
  const row=await fetchRow();

  if(!row?.payload){
   const local=window.getFleetPilotDatabase?.();
   const s=stats(local);

   if(["owner","coordinator"].includes(enterpriseRole())&&s.cars){
    const upload=confirm(`В облаке пока нет базы. Загрузить текущий автопарк?\n\nАвтомобили: ${s.cars}`);
    if(upload)await pushNow();
   }else{
    setStatus("Облако готово",null,"online")
   }
   return
  }

  await pullNow({ask:false})
 }catch(error){
  console.error("FleetPilot first sync failed",error);
  message("#cloudAuthMessage",friendly(error),"error");
  setStatus("Ошибка синхронизации",null,"error")
 }
}
async function signIn(){
 if(!client)return message("#cloudAuthMessage","Облако не настроено владельцем","error");
 const email=$("#cloudEmail")?.value.trim(),password=$("#cloudPassword")?.value;
 if(!email||!password)return message("#cloudAuthMessage","Введите email и пароль","error");
 message("#cloudAuthMessage","Выполняется вход…");
 const {data,error}=await client.auth.signInWithPassword({email,password});
 if(error)return message("#cloudAuthMessage",friendly(error),"error");
 localStorage.removeItem(PENDING_EMAIL_KEY);
 authResolved=false;workspaceResolved=false;
 await loadSessionContext(data.session);
 authResolved=true;
 render();message("#cloudAuthMessage","");
 await firstSync()
}
async function signUp(){
 const email=$("#cloudRegisterEmail")?.value.trim(),password=$("#cloudRegisterPassword")?.value;
 if(!email||!password)return message("#cloudRegisterMessage","Введите email и пароль","error");
 const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:cfg().redirectUrl}});
 if(error)return message("#cloudRegisterMessage",friendly(error),"error");
 if(data.session){
  authResolved=false;workspaceResolved=false;
  await loadSessionContext(data.session);
  authResolved=true;
  render();
  await firstSync()
 }
 else{
  store(PENDING_EMAIL_KEY,email);
  if($("#cloudPendingEmail"))$("#cloudPendingEmail").textContent=email;
  showAuth("confirm")
 }
}
async function resend(){
 const email=parse(PENDING_EMAIL_KEY,"")||$("#cloudRegisterEmail")?.value.trim();
 const {error}=await client.auth.resend({type:"signup",email,options:{emailRedirectTo:cfg().redirectUrl}});
 if(error)return alert(friendly(error));alert("Письмо отправлено повторно")
}
async function resetPassword(){
 const email=session?.user?.email||$("#cloudEmail")?.value.trim();
 if(!email)return message("#cloudAuthMessage","Введите email","error");
 const recoveryUrl=new URL(cfg().redirectUrl||location.href);
 recoveryUrl.searchParams.set("password-recovery","1");
 recoveryUrl.searchParams.delete("email-confirmed");
 const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:recoveryUrl.toString()});
 if(error)return message("#cloudAuthMessage",friendly(error),"error");
 alert("Письмо для изменения пароля отправлено")
}
async function saveRecoveryPassword(){
 const password=$("#cloudRecoveryPassword")?.value||"";
 const repeat=$("#cloudRecoveryPasswordRepeat")?.value||"";

 if(password.length<8){
  return message("#cloudRecoveryMessage","Пароль должен содержать минимум 8 символов.","error")
 }
 if(password!==repeat){
  return message("#cloudRecoveryMessage","Пароли не совпадают.","error")
 }

 message("#cloudRecoveryMessage","Сохраняем новый пароль…");

 const {error}=await client.auth.updateUser({password});
 if(error)return message("#cloudRecoveryMessage",friendly(error),"error");

 recoveryMode=false;
 message("#cloudRecoveryMessage","Пароль успешно изменён.","success");

 // End temporary recovery session. User signs in normally with the new password.
 stopRealtimeSync();
 await client.auth.signOut();
 session=null;
 profile=null;
 workspace=null;
 membership=null;
 platformAdmin=false;
 authResolved=true;
 workspaceResolved=true;

 const cleanUrl=new URL(location.href);
 cleanUrl.searchParams.delete("password-recovery");
 cleanUrl.searchParams.delete("type");
 cleanUrl.hash="";
 history.replaceState({},document.title,cleanUrl.pathname+cleanUrl.search);

 showAuth("login");
 if($("#cloudPassword"))$("#cloudPassword").value="";
 render();
 setTimeout(()=>message("#cloudAuthMessage","Пароль изменён. Войдите с новым паролем.","success"),100)
}

async function signOut(){
 if(!confirm("Выйти из аккаунта? Данные этого пользователя будут удалены с устройства, но останутся в облаке."))return;
 clearTimeout(pushTimer);
 pushTimer=null;
 stopRealtimeSync();
 if(client)await client.auth.signOut();
 session=null;profile=null;
 localStorage.removeItem(DEMO_KEY);
 localStorage.removeItem(STATUS_KEY);
 window.clearFleetPilotLocalDatabase?.();
 location.reload()
}
function startDemo(reset=false){
 localStorage.setItem(DEMO_KEY,"1");
 if(reset||!localStorage.getItem("fleetpilot.demo.initialized.v1")){
  const demo=window.createFleetPilotDemoDatabase?.();
  if(demo)window.replaceFleetPilotDatabase(demo);
  localStorage.setItem("fleetpilot.demo.initialized.v1","1")
 }
 location.reload()
}
function exitDemo(){
 localStorage.removeItem(DEMO_KEY);
 window.clearFleetPilotLocalDatabase?.();
 location.reload()
}
function showLogin(){
 showAuth("login");const gate=$("#authGate");if(gate)gate.hidden=false
}
function showRegister(){showAuth("register");const gate=$("#authGate");if(gate)gate.hidden=false}
function openProfile(){render();$("#cloudDialog")?.showModal()}
function savePhoto(file){
 if(!file)return;
 const reader=new FileReader();
 reader.onload=()=>{
  const img=new Image();
  img.onload=()=>{
   const canvas=document.createElement("canvas"),size=240;
   canvas.width=size;canvas.height=size;
   const scale=Math.max(size/img.width,size/img.height),w=img.width*scale,h=img.height*scale;
   canvas.getContext("2d").drawImage(img,(size-w)/2,(size-h)/2,w,h);
   localStorage.setItem(accountKey(PHOTO_KEY_BASE),canvas.toDataURL("image/jpeg",.78));renderAvatar()
  };
  img.src=reader.result
 };
 reader.readAsDataURL(file)
}
async function refreshAdmin(){
 if(!isPlatformAdmin())return;
 message("#cloudAdminMessage","Загрузка…");
 try{
  const projects=await platformOverview();
  const today=new Date();today.setHours(0,0,0,0);
  $("#adminUsersCount").textContent=projects.length;
  $("#adminCarsCount").textContent=projects.reduce((sum,p)=>sum+Number(p.cars_count||0),0);
  $("#adminTodayCount").textContent=projects.filter(p=>new Date(p.last_activity||0)>=today).length;

  const root=$("#cloudAdminUsers");
  root.hidden=false;
  root.innerHTML=projects.map(project=>`
   <article class="cloud-admin-user platform-project-row">
    <div>
     <strong>${project.workspace_name||"Без названия"}</strong>
     <small>${project.owner_email||"Владелец не найден"} · ${project.members_count||0} участников</small>
    </div>
    <div>
     <small>Автомобилей</small>
     <strong>${project.cars_count||0}</strong>
    </div>
    <div>
     <small>Последняя активность</small>
     <strong>${dateTime(project.last_activity)}</strong>
    </div>
   </article>`).join("")||"<p>Проектов пока нет</p>";
  message("#cloudAdminMessage","")
 }catch(error){
  ["#adminUsersCount","#adminCarsCount","#adminTodayCount"].forEach(s=>{if($(s))$(s).textContent="!"});
  message("#cloudAdminMessage",friendly(error),"error")
 }
}
function bind(){
 $("#profileAvatarButton")?.addEventListener("click",openProfile);
 $("#openCloudDialog")?.addEventListener("click",openProfile);
 $("#closeCloudDialog")?.addEventListener("click",()=>$("#cloudDialog")?.close());
 $("#profileGoToLogin")?.addEventListener("click",()=>{$("#cloudDialog")?.close();showLogin()});
 $("#profileGoToRegister")?.addEventListener("click",()=>{$("#cloudDialog")?.close();showRegister()});
 $("#profileStartDemo")?.addEventListener("click",()=>startDemo());
 $("#authShowLogin")?.addEventListener("click",showLogin);
 $("#authShowRegister")?.addEventListener("click",showRegister);
 $("#authStartDemo")?.addEventListener("click",()=>startDemo());
 document.querySelectorAll("[data-auth-back]").forEach(b=>b.addEventListener("click",()=>showAuth("welcome")));
 $("#cloudSignIn")?.addEventListener("click",signIn);
 $("#cloudSignUp")?.addEventListener("click",signUp);
 $("#cloudResendEmail")?.addEventListener("click",resend);
 $("#cloudBackToLogin")?.addEventListener("click",()=>showAuth("login"));
 $("#cloudResetPasswordGuest")?.addEventListener("click",resetPassword);
 $("#cloudSaveRecoveryPassword")?.addEventListener("click",saveRecoveryPassword);
 $("#cloudResetPassword")?.addEventListener("click",()=>{
  $("#cloudDialog")?.close();
  $("#directPasswordMessage")?.setAttribute("hidden","");
  $("#changePasswordDialog")?.showModal()
 });
 $("#cloudPushNow")?.addEventListener("click",()=>pushNow());
 $("#cloudPullNow")?.addEventListener("click",()=>pullNow());
 $("#cloudSignOut")?.addEventListener("click",signOut);
 $("#profileOpenSettings")?.addEventListener("click",()=>{$("#cloudDialog")?.close();(()=>{
      const settingsButton=document.querySelector("#desktopSettingsButton");
      if(settingsButton)settingsButton.click();
      else if(window.showPage)window.showPage("morePage")
    })()});
 $("#profilePhotoInput")?.addEventListener("change",e=>savePhoto(e.target.files?.[0]));
 $("#demoGoToLogin")?.addEventListener("click",()=>{$("#cloudDialog")?.close();exitDemo()});
 $("#demoReset")?.addEventListener("click",()=>startDemo(true));
 $("#demoExit")?.addEventListener("click",exitDemo);
 $("#refreshCloudAdmin")?.addEventListener("click",refreshAdmin);
 $("#openSupabaseDashboard")?.addEventListener("click",()=>window.open(cfg().dashboardUrl,"_blank","noopener"))

 $("#createWorkspaceForm")?.addEventListener("submit",async event=>{
  event.preventDefault();
  message("#workspaceCreateMessage","Создаём автопарк…");
  try{
   await createWorkspace({
    name:$("#workspaceCreateName")?.value,
    city:$("#workspaceCreateCity")?.value,
    jobTitle:$("#workspaceCreateJobTitle")?.value
   });
   message("#workspaceCreateMessage","Автопарк создан.","success");
   setTimeout(()=>location.reload(),350)
  }catch(error){
   message("#workspaceCreateMessage",friendly(error),"error")
  }
 });
 $("#workspaceAcceptInvite")?.addEventListener("click",async()=>{
  message("#workspaceCreateMessage","Подключаем к автопарку…");
  try{
   await acceptPendingInvite();
   message("#workspaceCreateMessage","Готово.","success");
   setTimeout(()=>location.reload(),350)
  }catch(error){
   message("#workspaceCreateMessage",friendly(error),"error")
  }
 });
 $("#workspaceSignOut")?.addEventListener("click",signOut);

}

function hasRecoveryMarker(){
 const query=new URLSearchParams(location.search);
 const hash=new URLSearchParams(location.hash.replace(/^#/,""));
 return query.get("password-recovery")==="1"
  || query.get("type")==="recovery"
  || hash.get("type")==="recovery"
}
async function start(){
 if(started)return;
 started=true;
 authResolved=false;
 workspaceResolved=false;
 recoveryMode=hasRecoveryMarker();

 removeOldQuotaBackups();
 bind();
 bindRealtimeLifecycle();
 init();

 if(new URLSearchParams(location.search).get("email-confirmed")==="1"){
  localStorage.removeItem(PENDING_EMAIL_KEY);
  showAuth("login");
  setTimeout(()=>message("#cloudAuthMessage","Email подтверждён. Теперь войдите.","success"),100)
 }

 if(client){
  // Supabase exchanges the recovery token for a temporary session.
  const {data}=await client.auth.getSession();

  if(recoveryMode){
   session=data?.session||null;
   profile=null;
   workspace=null;
   membership=null;
   platformAdmin=false;
   workspaceResolved=true;
   authResolved=true;
   showAuth("recovery");
   render()
  }else{
   await loadSessionContext(data?.session||null);
   authResolved=true;
   render()
  }

  client.auth.onAuthStateChange(async(event,nextSession)=>{
   if(event==="PASSWORD_RECOVERY"){
    recoveryMode=true;
    stopRealtimeSync();
    session=nextSession||null;
    profile=null;
    workspace=null;
    membership=null;
    platformAdmin=false;
    workspaceResolved=true;
    authResolved=true;
    showAuth("recovery");
    render();
    return
   }

   if(recoveryMode)return;

   authResolved=false;
   workspaceResolved=false;
   await loadSessionContext(nextSession);
   authResolved=true;
   render()
  })
 }else{
  await loadSessionContext(null);
  authResolved=true;
  render()
 }

 const pending=parse(PENDING_EMAIL_KEY,"");
 if(!recoveryMode&&!session&&!isDemo()&&pending){
  if($("#cloudPendingEmail"))$("#cloudPendingEmail").textContent=pending;
  showAuth("confirm")
 }
}

async function getRolePermissions(){
 if(!client||!membership)return{};
 const {data,error}=await client.rpc("get_workspace_role_permissions");
 if(error)throw error;
 const result={};
 for(const row of data||[]){
  const roleName=row.permission_role||row.role;
  const permissionName=row.permission_name||row.permission;
  const allowedValue=row.permission_allowed??row.allowed;
  if(!roleName||!permissionName)continue;
  if(!result[roleName])result[roleName]={};
  result[roleName][permissionName]=Boolean(allowedValue)
 }
 return result
}
async function saveRolePermissions(role,permissions){
 if(!client||!membership)throw new Error("Workspace недоступен");
 if(!hasEnterpriseRole("owner"))throw new Error("Только владелец может менять права");
 const {error}=await client.rpc("save_workspace_role_permissions",{
  target_role:role,
  permission_values:permissions
 });
 if(error)throw error
}
async function resetRolePermissions(role){
 if(!client||!membership)throw new Error("Workspace недоступен");
 if(!hasEnterpriseRole("owner"))throw new Error("Только владелец может менять права");
 const {error}=await client.rpc("reset_workspace_role_permissions",{target_role:role});
 if(error)throw error
}
async function updateWorkspaceSettings(settings){
 if(!client||!membership)throw new Error("Workspace недоступен");
 if(!hasEnterpriseRole("owner"))throw new Error("Только владелец может менять настройки");
 const {data,error}=await client.rpc("update_workspace_settings",{
  workspace_name:String(settings.name||"").trim(),
  workspace_city:String(settings.city||"").trim()||null,
  workspace_currency:String(settings.currency||"PLN"),
  workspace_timezone:String(settings.timezone||"Europe/Warsaw")
 });
 if(error)throw error;
 await loadWorkspace();
 return data
}
async function getWorkspaceActivity(){
 if(!client||!membership)return[];
 const {data,error}=await client.rpc("get_workspace_activity_log");
 if(error)throw error;
 return data||[]
}
async function logWorkspaceActivity(action,entityType=null,entityId=null,details={}){
 if(!client||!membership)return;
 await client.rpc("log_workspace_activity",{
  action_name:action,
  entity_type_value:entityType,
  entity_id_value:entityId,
  details_value:details
 }).catch(()=>{})
}

async function getDriverPortalContext(){
 if(!client||!membership)throw new Error("Workspace недоступен");
 const {data,error}=await client.rpc("get_driver_portal_context");
 if(error)throw error;
 return Array.isArray(data)?data[0]||null:data||null
}
async function submitDriverRepairRequest(request){
 if(!client||!membership)throw new Error("Workspace недоступен");
 if(enterpriseRole()!=="driver")throw new Error("Заявку может отправить только водитель");

 const {data,error}=await client.rpc("submit_driver_repair_request",{
  request_category:String(request.category||"other"),
  request_urgency:String(request.urgency||"normal"),
  request_description:String(request.description||"").trim(),
  request_mileage:Number(request.mileage||0),
  dashboard_warning_value:Boolean(request.dashboardWarning)
 });
 if(error)throw error;
 return data
}
async function getMyDriverRepairRequests(){
 if(!client||!membership)return[];
 const {data,error}=await client.rpc("get_my_driver_repair_requests");
 if(error)throw error;
 return data||[]
}
async function getWorkspaceDriverRepairRequests(){
 if(!client||!membership)return[];
 const {data,error}=await client.rpc("get_workspace_driver_repair_requests");
 if(error)throw error;
 return data||[]
}
async function updateDriverRepairRequest(requestId,status,comment=""){
 if(!client||!membership)throw new Error("Workspace недоступен");
 const {error}=await client.rpc("update_driver_repair_request",{
  request_id_value:requestId,
  request_status_value:status,
  manager_comment_value:String(comment||"").trim()||null
 });
 if(error)throw error
}
async function getMyWorkspaceNotifications(){
 if(!client||!membership)return[];
 const {data,error}=await client.rpc("get_my_workspace_notifications");
 if(error)throw error;
 return data||[]
}
async function getDriverAssignments(){
 if(!client||!membership)return[];
 const {data,error}=await client.rpc("get_workspace_driver_assignments_v11");
 if(error)throw error;
 return data||[]
}
async function assignDriverVehicle(driverUserId,carId){
 if(!client||!membership)throw new Error("Workspace недоступен");
 const {error}=await client.rpc("assign_driver_vehicle",{
  driver_user_id_value:driverUserId,
  car_id_value:carId||null
 });
 if(error)throw error
}

async function getCloudFleetVersions(){
 if(!client||!membership)return[];
 if(!["owner","coordinator"].includes(enterpriseRole()))throw new Error("Недостаточно прав");
 const {data,error}=await client.rpc("get_workspace_fleet_versions");
 if(error)throw error;
 return data||[]
}
async function restoreCloudFleetVersion(versionId){
 if(!client||!membership)throw new Error("Workspace недоступен");
 if(!["owner","coordinator"].includes(enterpriseRole()))throw new Error("Недостаточно прав");
 const {data,error}=await client.rpc("restore_workspace_fleet_version",{version_id_value:versionId});
 if(error)throw error;
 const restored=Array.isArray(data)?data[0]||null:data||null;
 if(restored?.payload){
  window.replaceFleetPilotDatabase(restored.payload);
  setStatus("Восстановлена облачная версия",restored.updated_at||new Date().toISOString(),"online");
  location.reload()
 }
 return restored
}

async function changePasswordDirect(newPassword){
 if(!client||!session)throw new Error("Сначала войдите в аккаунт");
 if(String(newPassword||"").length<8)throw new Error("Пароль должен содержать минимум 8 символов");
 const {error}=await client.auth.updateUser({password:String(newPassword)});
 if(error)throw error;
 return true
}

async function getDriverHandoverState(){
 if(!client||!membership)return null;
 const {data,error}=await client.rpc("get_driver_handover_state");
 if(error)throw error;
 return Array.isArray(data)?data[0]||null:data||null
}
async function submitVehicleHandover(payload){
 if(!client||!membership)throw new Error("Workspace недоступен");
 if(enterpriseRole()!=="driver")throw new Error("Только водитель может подтвердить передачу");
 const {data,error}=await client.rpc("submit_vehicle_handover",{
  handover_type_value:String(payload.type),
  mileage_value:Number(payload.mileage||0),
  fuel_level_value:Number(payload.fuelLevel||0),
  equipment_value:payload.equipment||{},
  photos_value:payload.photos||[],
  notes_value:String(payload.notes||"").trim()||null
 });
 if(error)throw error;
 return Array.isArray(data)?data[0]||null:data||null
}
async function getVehicleHandoverHistory(carId){
 if(!client||!membership)return[];
 const {data,error}=await client.rpc("get_vehicle_handover_history",{car_id_value:String(carId)});
 if(error)throw error;
 return data||[]
}
async function linkDriverRequestRepair(requestId,repairId,status,comment=""){
 if(!client||!membership)throw new Error("Workspace недоступен");
 const {error}=await client.rpc("link_driver_request_repair",{request_id_value:requestId,linked_repair_id_value:String(repairId),request_status_value:String(status),manager_comment_value:String(comment||"").trim()||null});
 if(error)throw error
}
async function updateDriverMileage(mileage,source="driver_manual"){
 if(!client||!membership)throw new Error("Workspace недоступен");
 const {data,error}=await client.rpc("update_assigned_vehicle_mileage",{mileage_value:Number(mileage||0),source_value:String(source)});
 if(error)throw error;
 return Array.isArray(data)?data[0]||null:data||null
}
window.FleetPilotCloud={start,signOut,changePasswordDirect,schedulePush,pushNow,pullNow,checkCloudForUpdates,startRealtimeSync,saveRecoveryPassword,openProfile,showLogin,showRegister,refreshAdmin,enterpriseList,enterpriseInvite,enterpriseUpdateMember,enterpriseCancelInvite,getRolePermissions,saveRolePermissions,resetRolePermissions,updateWorkspaceSettings,getWorkspaceActivity,logWorkspaceActivity,getDriverPortalContext,submitDriverRepairRequest,getMyDriverRepairRequests,getWorkspaceDriverRepairRequests,updateDriverRepairRequest,linkDriverRequestRepair,getMyWorkspaceNotifications,getDriverAssignments,assignDriverVehicle,getCloudFleetVersions,restoreCloudFleetVersion,getDriverHandoverState,submitVehicleHandover,getVehicleHandoverHistory,updateDriverMileage,createWorkspace,acceptPendingInvite,getPendingWorkspaceInvite,platformOverview,get session(){return session},get profile(){return profile},get workspace(){return workspace},get membership(){return membership},get role(){return enterpriseRole()},get isWorkspaceOwner(){return owner()},get isPlatformAdmin(){return isPlatformAdmin()},get isOwner(){return owner()}};
document.addEventListener("DOMContentLoaded",start)
})();