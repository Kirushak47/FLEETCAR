(()=>{
"use strict";

const TABLE="fleet_states";
const PROFILE_TABLE="profiles";
const PUSH_DELAY=1800;
const STATUS_KEY="fleetpilot.cloud.status.v2";
const PENDING_EMAIL_KEY="fleetpilot.cloud.pending_email.v1";

let client=null;
let session=null;
let profile=null;
let pushTimer=null;
let syncing=false;
let started=false;

const $=selector=>document.querySelector(selector);
const read=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const dateTime=value=>value?new Date(value).toLocaleString("ru-RU"):"—";
const cfg=()=>window.FLEETPILOT_CLOUD_CONFIG||{};
const configReady=()=>{
 const c=cfg();
 return Boolean(
  c.url &&
  c.publishableKey &&
  !String(c.publishableKey).includes("PASTE_")
 )
};

function setMessage(text,type=""){
 const el=$("#cloudAuthMessage");if(!el)return;
 el.hidden=!text;
 el.textContent=text;
 el.className=`cloud-message ${type}`
}
function setAdminMessage(text,type=""){
 const el=$("#cloudAdminMessage");if(!el)return;
 el.hidden=!text;
 el.textContent=text;
 el.className=`cloud-message ${type}`
}
function setSyncStatus(text,lastSync=null,state="online"){
 const status=$("#cloudSyncStatus"),last=$("#cloudLastSync");
 if(status)status.textContent=text;
 if(last&&lastSync)last.textContent=dateTime(lastSync);
 write(STATUS_KEY,{text,lastSync,state});
 renderSummary(state,text,lastSync)
}
function renderSummary(forcedState=null,forcedText=null,forcedLast=null){
 const root=$("#cloudConnectionSummary");if(!root)return;
 const saved=read(STATUS_KEY,{});
 let state=forcedState||saved.state||"local";
 let title=forcedText||saved.text||"Облако готово";
 let detail=configReady()
  ?"Войдите, чтобы синхронизировать устройства"
  :"Владелец ещё не завершил настройку облака";

 if(session){
  title=forcedText||"Облако подключено";
  detail=`${session.user.email} · ${forcedLast||saved.lastSync?`синхр. ${dateTime(forcedLast||saved.lastSync)}`:"готово к синхронизации"}`;
  state=forcedState||"online"
 }

 root.innerHTML=`<span class="cloud-state-dot ${state}"></span>
  <div><strong>${title}</strong><small>${detail}</small></div>
  ${session?`<button type="button" class="btn" onclick="FleetPilotCloud.pushNow()">Синхронизировать</button>`:""}`
}
function initClient(){
 if(!configReady()||!window.supabase?.createClient){
  client=null;
  return null
 }
 const c=cfg();
 client=window.supabase.createClient(c.url,c.publishableKey,{
  auth:{
   persistSession:true,
   autoRefreshToken:true,
   detectSessionInUrl:true
  }
 });
 return client
}
async function loadProfile(){
 profile=null;
 if(!session||!client)return null;
 const {data,error}=await client
  .from(PROFILE_TABLE)
  .select("user_id,email,role,created_at")
  .eq("user_id",session.user.id)
  .maybeSingle();
 if(error){
  console.error("Profile load failed",error);
  return null
 }
 profile=data||null;
 return profile
}
function isOwner(){
 return profile?.role==="owner"
}
async function refreshSession(){
 if(!client)initClient();
 if(!client){
  session=null;
  profile=null;
  renderUi();
  return null
 }
 const {data,error}=await client.auth.getSession();
 if(error)console.error(error);
 session=data?.session||null;
 if(session)await loadProfile();
 renderUi();
 return session
}
function showConfirmation(email){
 write(PENDING_EMAIL_KEY,email);
 const section=$("#cloudEmailConfirmSection");
 const auth=$(".cloud-auth-section");
 if(section)section.hidden=false;
 if(auth)auth.hidden=true;
 if($("#cloudPendingEmail"))$("#cloudPendingEmail").textContent=email||"ваш email";
}
function hideConfirmation(){
 const section=$("#cloudEmailConfirmSection");
 if(section)section.hidden=true;
}
function renderUi(){
 const account=$("#cloudAccountSection");
 const auth=$(".cloud-auth-section");
 const admin=$("#cloudAdminSection");
 const pending=read(PENDING_EMAIL_KEY,"");

 if(account)account.hidden=!session;
 if(auth)auth.hidden=Boolean(session)||Boolean(!session&&pending);
 if(session)hideConfirmation();
 else if(pending)showConfirmation(pending);

 if($("#cloudUserEmail"))$("#cloudUserEmail").textContent=session?.user?.email||"";
 if($("#cloudUserRole")){
  $("#cloudUserRole").textContent=isOwner()?"Владелец":"Пользователь";
  $("#cloudUserRole").classList.toggle("owner",isOwner())
 }
 if(admin)admin.hidden=!isOwner();

 const saved=read(STATUS_KEY,{});
 if($("#cloudSyncStatus"))$("#cloudSyncStatus").textContent=saved.text||"Ожидание";
 if($("#cloudLastSync"))$("#cloudLastSync").textContent=dateTime(saved.lastSync);

 renderSummary();

 if(isOwner())setTimeout(refreshAdmin,0)
}
function localStats(payload){
 return{
  cars:payload?.cars?.length||0,
  repairs:payload?.repairs?.length||0,
  payments:payload?.payments?.length||0,
  expenses:payload?.expenses?.length||0
 }
}
async function fetchCloudRow(){
 if(!session)throw new Error("Сначала войдите в аккаунт");
 const {data,error}=await client
  .from(TABLE)
  .select("payload,updated_at,device_name")
  .eq("user_id",session.user.id)
  .maybeSingle();
 if(error)throw error;
 return data
}
async function pushNow({silent=false}={}){
 if(syncing||!session)return false;
 syncing=true;
 setSyncStatus("Синхронизация…",null,"syncing");
 try{
  const payload=window.getFleetPilotDatabase?.();
  if(!payload)throw new Error("Локальная база недоступна");
  const now=new Date().toISOString();
  const row={
   user_id:session.user.id,
   payload,
   updated_at:now,
   device_name:navigator.userAgent.slice(0,120)
  };
  const {error}=await client.from(TABLE).upsert(row,{onConflict:"user_id"});
  if(error)throw error;
  setSyncStatus("Синхронизировано",now,"online");
  if(!silent)window.toast?.("Данные загружены в облако");
  if(isOwner())setTimeout(refreshAdmin,0);
  return true
 }catch(error){
  console.error(error);
  setSyncStatus("Ошибка синхронизации",null,"error");
  if(!silent)setMessage(friendlyError(error),"error");
  return false
 }finally{
  syncing=false
 }
}
async function pullNow({ask=true}={}){
 if(syncing||!session)return false;
 syncing=true;
 setSyncStatus("Загрузка из облака…",null,"syncing");
 try{
  const row=await fetchCloudRow();
  if(!row?.payload)throw new Error("В облаке пока нет данных");
  const stats=localStats(row.payload);
  if(ask&&!confirm(`Заменить локальную базу данными из облака?\n\nАвтомобили: ${stats.cars}\nРемонты: ${stats.repairs}\nОплаты: ${stats.payments}\nРасходы: ${stats.expenses}`))return false;
  const current=window.getFleetPilotDatabase?.();
  if(current)write(`fleetpilot.cloud.prepull.${Date.now()}`,current);
  window.replaceFleetPilotDatabase(row.payload);
  setSyncStatus("Загружено из облака",row.updated_at,"online");
  location.reload();
  return true
 }catch(error){
  console.error(error);
  setSyncStatus("Ошибка загрузки",null,"error");
  setMessage(friendlyError(error),"error");
  return false
 }finally{
  syncing=false
 }
}
function schedulePush(){
 clearTimeout(pushTimer);
 if(!session)return;
 pushTimer=setTimeout(()=>pushNow({silent:true}),PUSH_DELAY)
}
async function firstSync(){
 if(!session)return;
 try{
  const row=await fetchCloudRow();
  if(!row){
   const s=localStats(window.getFleetPilotDatabase?.());
   if(confirm(`В облаке ещё нет базы. Загрузить текущий автопарк?\n\nАвтомобили: ${s.cars}\nРемонты: ${s.repairs}\nОплаты: ${s.payments}`))await pushNow();
   return
  }
  const cloudTime=new Date(row.updated_at||0).getTime();
  const localTime=new Date(window.getFleetPilotMeta?.().lastSaved||0).getTime();
  if(cloudTime>localTime&&confirm("В облаке есть более свежая база. Скачать её на это устройство?")){
   await pullNow({ask:false})
  }else{
   setSyncStatus("Облако подключено",row.updated_at,"online")
  }
 }catch(error){
  console.error(error);
  setSyncStatus("Ошибка подключения",null,"error");
  setMessage(friendlyError(error),"error")
 }
}
function friendlyError(error){
 const text=String(error?.message||error||"Неизвестная ошибка");
 if(text.includes("fleet_states"))return"Облачная таблица не настроена. Владелец должен выполнить SQL-файл из архива.";
 if(text.toLowerCase().includes("email not confirmed"))return"Email ещё не подтверждён. Откройте письмо от FleetPilot.";
 if(text.toLowerCase().includes("invalid login credentials"))return"Неверный email или пароль.";
 return text
}
async function signIn(){
 if(!client)return setMessage("Облако ещё не настроено владельцем приложения","error");
 const email=$("#cloudEmail")?.value.trim();
 const password=$("#cloudPassword")?.value;
 if(!email||!password)return setMessage("Введите email и пароль","error");

 setMessage("Выполняется вход…");
 const {data,error}=await client.auth.signInWithPassword({email,password});
 if(error)return setMessage(friendlyError(error),"error");

 localStorage.removeItem(PENDING_EMAIL_KEY);
 session=data.session;
 await loadProfile();
 setMessage("");
 renderUi();
 await firstSync()
}
async function signUp(){
 if(!client)return setMessage("Облако ещё не настроено владельцем приложения","error");
 const email=$("#cloudEmail")?.value.trim();
 const password=$("#cloudPassword")?.value;
 if(!email||!password)return setMessage("Введите email и пароль","error");

 const redirect=cfg().redirectUrl||location.origin+location.pathname;
 setMessage("Создаём аккаунт…");

 const {data,error}=await client.auth.signUp({
  email,
  password,
  options:{emailRedirectTo:redirect}
 });
 if(error)return setMessage(friendlyError(error),"error");

 if(data.session){
  localStorage.removeItem(PENDING_EMAIL_KEY);
  session=data.session;
  await loadProfile();
  renderUi();
  await firstSync()
 }else{
  setMessage("");
  showConfirmation(email)
 }
}
async function resendConfirmation(){
 if(!client)return;
 const email=read(PENDING_EMAIL_KEY,"")||$("#cloudEmail")?.value.trim();
 if(!email)return setMessage("Введите email","error");
 const redirect=cfg().redirectUrl||location.origin+location.pathname;
 const {error}=await client.auth.resend({
  type:"signup",
  email,
  options:{emailRedirectTo:redirect}
 });
 if(error)return setMessage(friendlyError(error),"error");
 const section=$("#cloudEmailConfirmSection");
 if(section){
  const p=section.querySelector("p");
  if(p)p.innerHTML=`Письмо повторно отправлено на <strong>${email}</strong>. Проверьте также папку «Спам».`
 }
}
async function resetPassword(){
 if(!client)return setMessage("Облако ещё не настроено владельцем приложения","error");
 const email=$("#cloudEmail")?.value.trim();
 if(!email)return setMessage("Введите email для восстановления пароля","error");
 const redirect=cfg().redirectUrl||location.origin+location.pathname;
 const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:redirect});
 if(error)return setMessage(friendlyError(error),"error");
 setMessage("Письмо для восстановления пароля отправлено.","success")
}
async function signOut(){
 if(client)await client.auth.signOut();
 session=null;
 profile=null;
 setSyncStatus("Облако готово",null,"local");
 renderUi()
}
function backToLogin(){
 localStorage.removeItem(PENDING_EMAIL_KEY);
 hideConfirmation();
 const auth=$(".cloud-auth-section");
 if(auth)auth.hidden=false
}
function openDialog(){
 renderUi();
 $("#cloudDialog")?.showModal()
}
function downloadJson(filename,data){
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");
 a.href=url;
 a.download=filename;
 a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000)
}
async function downloadAdminFleet(userId,email){
 if(!isOwner())return;
 const {data,error}=await client
  .from(TABLE)
  .select("payload,updated_at")
  .eq("user_id",userId)
  .maybeSingle();
 if(error)return setAdminMessage(friendlyError(error),"error");
 if(!data?.payload)return setAdminMessage("У пользователя пока нет облачной базы","error");
 downloadJson(`fleetpilot-${String(email||userId).replace(/[^a-z0-9._-]/gi,"_")}.json`,{
  exportedAt:new Date().toISOString(),
  userId,
  email,
  updatedAt:data.updated_at,
  payload:data.payload
 })
}
async function refreshAdmin(){
 if(!isOwner()||!client)return;
 setAdminMessage("Загрузка…");
 const [{data:profiles,error:pError},{data:states,error:sError}]=await Promise.all([
  client.from(PROFILE_TABLE).select("user_id,email,role,created_at").order("created_at",{ascending:false}),
  client.from(TABLE).select("user_id,payload,updated_at,device_name")
 ]);
 if(pError||sError){
  console.error(pError||sError);
  return setAdminMessage(friendlyError(pError||sError),"error")
 }
 const stateMap=new Map((states||[]).map(row=>[row.user_id,row]));
 const users=(profiles||[]).map(item=>({...item,state:stateMap.get(item.user_id)||null}));
 const todayStart=new Date();todayStart.setHours(0,0,0,0);
 const cars=users.reduce((sum,user)=>sum+(user.state?.payload?.cars?.length||0),0);
 const today=users.filter(user=>new Date(user.state?.updated_at||0)>=todayStart).length;

 if($("#adminUsersCount"))$("#adminUsersCount").textContent=users.length;
 if($("#adminCarsCount"))$("#adminCarsCount").textContent=cars;
 if($("#adminTodayCount"))$("#adminTodayCount").textContent=today;

 const root=$("#cloudAdminUsers");
 if(root){
  root.innerHTML=users.map(user=>{
   const stats=localStats(user.state?.payload);
   return`<article class="cloud-admin-user">
    <div class="cloud-admin-user-main">
     <strong>${user.email||"Email не указан"}</strong>
     <small>${user.role==="owner"?"Владелец":"Пользователь"} · регистрация ${dateTime(user.created_at)}</small>
    </div>
    <div class="cloud-admin-user-stats">
     <span><small>Авто</small><strong>${stats.cars}</strong></span>
     <span><small>Ремонты</small><strong>${stats.repairs}</strong></span>
     <span><small>Последняя синхр.</small><strong>${dateTime(user.state?.updated_at)}</strong></span>
    </div>
    <button type="button" class="btn" onclick="FleetPilotCloud.downloadAdminFleet('${user.user_id}','${String(user.email||"").replace(/'/g,"\\'")}')">Скачать копию</button>
   </article>`
  }).join("")||`<div class="cloud-admin-empty">Пользователей пока нет</div>`
 }
 setAdminMessage("")
}
function openDashboard(){
 const url=cfg().dashboardUrl;
 if(url)window.open(url,"_blank","noopener")
}
async function bindAuth(){
 if(!client)return;
 await refreshSession();
 client.auth.onAuthStateChange(async(event,newSession)=>{
  const changed=session?.user?.id!==newSession?.user?.id;
  session=newSession;
  if(session){
   localStorage.removeItem(PENDING_EMAIL_KEY);
   await loadProfile()
  }else{
   profile=null
  }
  renderUi();
  if(changed&&session)setTimeout(firstSync,0)
 })
}
function bindUi(){
 $("#openCloudDialog")?.addEventListener("click",openDialog);
 $("#closeCloudDialog")?.addEventListener("click",()=>$("#cloudDialog")?.close());
 $("#cloudSignIn")?.addEventListener("click",signIn);
 $("#cloudSignUp")?.addEventListener("click",signUp);
 $("#cloudSignOut")?.addEventListener("click",signOut);
 $("#cloudPushNow")?.addEventListener("click",()=>pushNow());
 $("#cloudPullNow")?.addEventListener("click",()=>pullNow());
 $("#cloudResendEmail")?.addEventListener("click",resendConfirmation);
 $("#cloudBackToLogin")?.addEventListener("click",backToLogin);
 $("#cloudResetPassword")?.addEventListener("click",resetPassword);
 $("#refreshCloudAdmin")?.addEventListener("click",refreshAdmin);
 $("#openSupabaseDashboard")?.addEventListener("click",openDashboard)
}
async function start(){
 if(started)return;
 started=true;
 bindUi();
 initClient();

 if(new URLSearchParams(location.search).get("email-confirmed")==="1"){
  localStorage.removeItem(PENDING_EMAIL_KEY);
  setTimeout(()=>setMessage("Email подтверждён. Теперь можно войти.","success"),100)
 }

 await bindAuth();
 renderUi()
}

window.FleetPilotCloud={
 start,
 schedulePush,
 pushNow,
 pullNow,
 renderSummary,
 refreshAdmin,
 downloadAdminFleet,
 get session(){return session},
 get profile(){return profile}
};
document.addEventListener("DOMContentLoaded",start)
})();
