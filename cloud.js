(()=>{
"use strict";
const TABLE="fleet_states",PROFILE_TABLE="profiles";
const STATUS_KEY="fleetpilot.cloud.status.v3";
const PENDING_EMAIL_KEY="fleetpilot.cloud.pending_email.v1";
const DEMO_KEY="fleetpilot.demo.active.v1";
const PHOTO_KEY_BASE="fleetpilot.profile.photo.v2";
const NAME_KEY_BASE="fleetpilot.profile.name.v2";
const PUSH_DELAY=1800;
let client=null,session=null,profile=null,workspace=null,membership=null,pushTimer=null,syncing=false,started=false;

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

function message(id,text,type=""){
 const el=$(id);if(!el)return;
 el.hidden=!text;el.textContent=text;el.className=`cloud-message ${type}`
}
function friendly(error){
 const t=String(error?.message||error||"Неизвестная ошибка");
 if(t.toLowerCase().includes("email not confirmed"))return"Сначала подтвердите email через письмо.";
 if(t.toLowerCase().includes("invalid login credentials"))return"Неверный email или пароль.";
 if(t.includes("fleet_states"))return"Облачная база ещё не настроена владельцем.";
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
 const screens=["#authWelcomeView","#authLoginView","#authRegisterView","#authConfirmView"];
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
  confirm:"#authConfirmView"
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
 gate.hidden=Boolean(session)||isDemo();
 document.documentElement.classList.toggle("auth-locked",!gate.hidden)
}
async function loadProfile(){
 profile=null;if(!session||!client)return;
 const {data,error}=await client.from(PROFILE_TABLE).select("user_id,email,role,created_at").eq("user_id",session.user.id).maybeSingle();
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
 const {data,error}=await client.from("workspace_invites").insert({
  workspace_id:membership.workspace_id,
  email:normalized,
  role,
  city:String(city||"").trim()||null,
  invited_by:session.user.id
 }).select().single();

 if(error)throw error;
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
function render(){
 const logged=$("#profileLoggedInView"),guest=$("#profileGuestView"),demo=$("#profileDemoView"),admin=$("#cloudAdminSection");

 if(logged)logged.hidden=true;
 if(guest)guest.hidden=true;
 if(demo)demo.hidden=true;
 if(admin)admin.hidden=true;

 if(session){
  if(logged)logged.hidden=false;
  if(admin)admin.hidden=!owner()
 }else if(isDemo()){
  if(demo)demo.hidden=false
 }else{
  if(guest)guest.hidden=false
 }
 if($("#cloudUserEmail"))$("#cloudUserEmail").textContent=session?.user?.email||"";
 if($("#cloudUserRole")){
  $("#cloudUserRole").textContent=owner()?"Владелец":"Пользователь";
  $("#cloudUserRole").classList.toggle("owner",owner())
 }
 const saved=parse(STATUS_KEY,{});
 if($("#cloudSyncStatus"))$("#cloudSyncStatus").textContent=saved.text||"Облако подключено";
 if($("#cloudLastSync"))$("#cloudLastSync").textContent=saved.lastSync?dateTime(saved.lastSync):"Ещё не синхронизировано";
 renderAvatar();renderSummary();setGate()
}
function setStatus(text,lastSync=null,state="online"){
 store(STATUS_KEY,{text,lastSync,state});render()
}
async function refreshSession(){
 if(!client)init();
 if(!client){session=null;profile=null;workspace=null;membership=null;render();return}
 const {data}=await client.auth.getSession();
 session=data?.session||null;
 if(session){localStorage.removeItem(DEMO_KEY);await loadProfile();await loadWorkspace()}
 render()
}
async function fetchRow(){
 if(!session)throw new Error("Сначала войдите");
 const {data,error}=await client.from(TABLE).select("payload,updated_at,device_name").eq("user_id",session.user.id).maybeSingle();
 if(error)throw error;return data
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
async function pushNow({silent=false}={}){
 if(syncing||!session)return false;syncing=true;setStatus("Синхронизация…",null,"syncing");
 try{
  const payload=window.getFleetPilotDatabase?.();
  const now=new Date().toISOString();
  const {error}=await client.from(TABLE).upsert({user_id:session.user.id,payload,updated_at:now,device_name:navigator.userAgent.slice(0,120)},{onConflict:"user_id"});
  if(error)throw error;setStatus("Синхронизировано",now,"online");
  if(!silent)window.toast?.("Синхронизировано");return true
 }catch(e){message("#cloudAuthMessage",friendly(e),"error");setStatus("Ошибка синхронизации",null,"error");return false}
 finally{syncing=false}
}
async function pullNow({ask=true}={}){
 if(syncing||!session)return false;syncing=true;setStatus("Загрузка из облака…",null,"syncing");
 try{
  const row=await fetchRow();if(!row?.payload)throw new Error("В облаке пока нет данных");
  const s=stats(row.payload);
  if(ask&&!confirm(`Скачать облачную базу?\n\nАвтомобили: ${s.cars}\nРемонты: ${s.repairs}\nОплаты: ${s.payments}`))return false;
  removeOldQuotaBackups();
  await backupCurrent(); // failure no longer blocks pull
  window.replaceFleetPilotDatabase(row.payload);
  setStatus("Загружено из облака",row.updated_at,"online");
  location.reload();return true
 }catch(e){message("#cloudAuthMessage",friendly(e),"error");setStatus("Ошибка загрузки",null,"error");return false}
 finally{syncing=false}
}
function schedulePush(){clearTimeout(pushTimer);if(session&&!isDemo())pushTimer=setTimeout(()=>pushNow({silent:true}),PUSH_DELAY)}
async function firstSync(){
 const row=await fetchRow();
 if(!row){
  const s=stats(window.getFleetPilotDatabase?.());
  if(s.cars&&confirm(`Загрузить текущий автопарк в облако?\n\nАвтомобили: ${s.cars}`))await pushNow();
  else await pullNow({ask:false}).catch(()=>{});
  return
 }
 await pullNow({ask:false})
}
async function signIn(){
 if(!client)return message("#cloudAuthMessage","Облако не настроено владельцем","error");
 const email=$("#cloudEmail")?.value.trim(),password=$("#cloudPassword")?.value;
 if(!email||!password)return message("#cloudAuthMessage","Введите email и пароль","error");
 message("#cloudAuthMessage","Выполняется вход…");
 const {data,error}=await client.auth.signInWithPassword({email,password});
 if(error)return message("#cloudAuthMessage",friendly(error),"error");
 session=data.session;localStorage.removeItem(DEMO_KEY);localStorage.removeItem(PENDING_EMAIL_KEY);
 await loadProfile();await loadWorkspace();render();message("#cloudAuthMessage","");
 await firstSync()
}
async function signUp(){
 const email=$("#cloudRegisterEmail")?.value.trim(),password=$("#cloudRegisterPassword")?.value;
 if(!email||!password)return message("#cloudRegisterMessage","Введите email и пароль","error");
 const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:cfg().redirectUrl}});
 if(error)return message("#cloudRegisterMessage",friendly(error),"error");
 if(data.session){session=data.session;await loadProfile();await loadWorkspace();render();await firstSync()}
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
 const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:cfg().redirectUrl});
 if(error)return message("#cloudAuthMessage",friendly(error),"error");
 alert("Письмо для изменения пароля отправлено")
}
async function signOut(){
 if(!confirm("Выйти из аккаунта? Данные этого пользователя будут удалены с устройства, но останутся в облаке."))return;
 clearTimeout(pushTimer);
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
 if(!owner())return;
 message("#cloudAdminMessage","Загрузка…");
 const [{data:profiles,error:pErr},{data:states,error:sErr}]=await Promise.all([
  client.from(PROFILE_TABLE).select("user_id,email,role,created_at").order("created_at",{ascending:false}),
  client.from(TABLE).select("user_id,payload,updated_at,device_name")
 ]);
 if(pErr||sErr){
  ["#adminUsersCount","#adminCarsCount","#adminTodayCount"].forEach(s=>{if($(s))$(s).textContent="!"});
  return message("#cloudAdminMessage",friendly(pErr||sErr),"error")
 }
 const map=new Map((states||[]).map(x=>[x.user_id,x]));
 const users=(profiles||[]).map(x=>({...x,state:map.get(x.user_id)}));
 const today=new Date();today.setHours(0,0,0,0);
 $("#adminUsersCount").textContent=users.length;
 $("#adminCarsCount").textContent=users.reduce((n,u)=>n+(u.state?.payload?.cars?.length||0),0);
 $("#adminTodayCount").textContent=users.filter(u=>new Date(u.state?.updated_at||0)>=today).length;
 const root=$("#cloudAdminUsers");root.hidden=false;
 root.innerHTML=users.map(u=>`<article class="cloud-admin-user"><div><strong>${u.email||"—"}</strong><small>${u.role==="owner"?"Владелец":"Пользователь"} · ${u.state?.payload?.cars?.length||0} авто</small></div><div><small>Последняя синхронизация</small><strong>${dateTime(u.state?.updated_at)}</strong></div></article>`).join("")||"<p>Пользователей пока нет</p>";
 message("#cloudAdminMessage","")
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
 $("#cloudResetPassword")?.addEventListener("click",resetPassword);
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
}
async function start(){
 if(started)return;started=true;removeOldQuotaBackups();bind();init();
 if(new URLSearchParams(location.search).get("email-confirmed")==="1"){
  localStorage.removeItem(PENDING_EMAIL_KEY);showAuth("login");
  setTimeout(()=>message("#cloudAuthMessage","Email подтверждён. Теперь войдите.","success"),100)
 }
 if(client){
  const {data}=await client.auth.getSession();session=data?.session||null;
  if(session){localStorage.removeItem(DEMO_KEY);await loadProfile()}
  client.auth.onAuthStateChange(async(_,s)=>{session=s;if(s){localStorage.removeItem(DEMO_KEY);await loadProfile();await loadWorkspace()}else{profile=null;workspace=null;membership=null}render()})
 }
 const pending=parse(PENDING_EMAIL_KEY,"");
 if(!session&&!isDemo()&&pending){if($("#cloudPendingEmail"))$("#cloudPendingEmail").textContent=pending;showAuth("confirm")}
 render()
}
window.FleetPilotCloud={start,schedulePush,pushNow,pullNow,openProfile,showLogin,showRegister,refreshAdmin,enterpriseList,enterpriseInvite,enterpriseUpdateMember,enterpriseCancelInvite,get session(){return session},get profile(){return profile},get workspace(){return workspace},get membership(){return membership},get role(){return enterpriseRole()},get isOwner(){return owner()}};
document.addEventListener("DOMContentLoaded",start)
})();