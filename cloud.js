(()=>{
"use strict";
const CONFIG_KEY="fleetpilot.cloud.config.v1";
const STATUS_KEY="fleetpilot.cloud.status.v1";
const TABLE="fleet_states";
const PUSH_DELAY=1800;
let client=null;
let session=null;
let pushTimer=null;
let syncing=false;
let started=false;

const $=selector=>document.querySelector(selector);
const read=(key,fallback=null)=>{try{return JSON.parse(localStorage.getItem(key)||"null")??fallback}catch{return fallback}};
const write=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const config=()=>read(CONFIG_KEY,{});
const configured=()=>Boolean(config().url&&config().key);
const dateTime=value=>value?new Date(value).toLocaleString("ru-RU"):
"—";

function setMessage(text,type=""){
 const el=$("#cloudAuthMessage");if(!el)return;
 el.hidden=!text;el.textContent=text;el.className=`cloud-message ${type}`
}
function setSyncStatus(text,lastSync=null,state="online"){
 const status=$("#cloudSyncStatus"),last=$("#cloudLastSync");
 if(status)status.textContent=text;if(last&&lastSync)last.textContent=dateTime(lastSync);
 write(STATUS_KEY,{text,lastSync,state});renderSummary(state,text,lastSync)
}
function renderSummary(forcedState=null,forcedText=null,forcedLast=null){
 const root=$("#cloudConnectionSummary");if(!root)return;
 const saved=read(STATUS_KEY,{});
 let state=forcedState||saved.state||"local";
 let title=forcedText||saved.text||"Локальный режим";
 let detail="Данные хранятся только на этом устройстве";
 if(session){title=forcedText||"Облако подключено";detail=`${session.user.email} · ${forcedLast||saved.lastSync?`синхр. ${dateTime(forcedLast||saved.lastSync)}`:"готово к синхронизации"}`;state=forcedState||"online"}
 else if(configured()){title="Supabase настроен";detail="Войдите в аккаунт для синхронизации";state="local"}
 root.innerHTML=`<span class="cloud-state-dot ${state}"></span><div><strong>${title}</strong><small>${detail}</small></div>${session?`<button type="button" class="btn" onclick="FleetPilotCloud.pushNow()">Синхронизировать</button>`:""}`
}
function initClient(){
 if(!configured()||!window.supabase?.createClient){client=null;return null}
 const c=config();client=window.supabase.createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return client
}
async function refreshSession(){
 if(!client)initClient();if(!client){session=null;renderUi();return null}
 const {data,error}=await client.auth.getSession();if(error)console.error(error);session=data?.session||null;renderUi();return session
}
function renderUi(){
 const c=config();
 if($("#cloudSupabaseUrl"))$("#cloudSupabaseUrl").value=c.url||"";
 if($("#cloudSupabaseKey"))$("#cloudSupabaseKey").value=c.key||"";
 const account=$("#cloudAccountSection");if(account)account.hidden=!session;
 const auth=$(".cloud-auth-section");if(auth)auth.hidden=Boolean(session);
 if($("#cloudUserEmail"))$("#cloudUserEmail").textContent=session?.user?.email||"";
 const saved=read(STATUS_KEY,{});if($("#cloudSyncStatus"))$("#cloudSyncStatus").textContent=saved.text||"Ожидание";if($("#cloudLastSync"))$("#cloudLastSync").textContent=dateTime(saved.lastSync);
 renderSummary()
}
function localStats(payload){return{cars:payload?.cars?.length||0,repairs:payload?.repairs?.length||0,payments:payload?.payments?.length||0,expenses:payload?.expenses?.length||0}}
async function fetchCloudRow(){
 if(!session)throw new Error("Сначала войдите в аккаунт");
 const {data,error}=await client.from(TABLE).select("payload,updated_at,device_name").eq("user_id",session.user.id).maybeSingle();
 if(error)throw error;return data
}
async function pushNow({silent=false}={}){
 if(syncing||!session)return false;syncing=true;setSyncStatus("Синхронизация…",null,"syncing");
 try{
  const payload=window.getFleetPilotDatabase?.();if(!payload)throw new Error("Локальная база недоступна");
  const now=new Date().toISOString();
  const row={user_id:session.user.id,payload,updated_at:now,device_name:navigator.userAgent.slice(0,120)};
  const {error}=await client.from(TABLE).upsert(row,{onConflict:"user_id"});if(error)throw error;
  setSyncStatus("Синхронизировано",now,"online");if(!silent)window.toast?.("Данные загружены в облако");return true
 }catch(error){console.error(error);setSyncStatus("Ошибка синхронизации",null,"error");if(!silent)setMessage(error.message,"error");return false}finally{syncing=false}
}
async function pullNow({ask=true}={}){
 if(syncing||!session)return false;syncing=true;setSyncStatus("Загрузка из облака…",null,"syncing");
 try{
  const row=await fetchCloudRow();if(!row?.payload)throw new Error("В облаке пока нет данных");
  const stats=localStats(row.payload);
  if(ask&&!confirm(`Заменить локальную базу данными из облака?\n\nАвтомобили: ${stats.cars}\nРемонты: ${stats.repairs}\nОплаты: ${stats.payments}\nРасходы: ${stats.expenses}`))return false;
  const current=window.getFleetPilotDatabase?.();if(current)write(`fleetpilot.cloud.prepull.${Date.now()}`,current);
  window.replaceFleetPilotDatabase(row.payload);setSyncStatus("Загружено из облака",row.updated_at,"online");location.reload();return true
 }catch(error){console.error(error);setSyncStatus("Ошибка загрузки",null,"error");setMessage(error.message,"error");return false}finally{syncing=false}
}
function schedulePush(){clearTimeout(pushTimer);if(!session)return;pushTimer=setTimeout(()=>pushNow({silent:true}),PUSH_DELAY)}
async function firstSync(){
 if(!session)return;
 try{
  const row=await fetchCloudRow();
  if(!row){const s=localStats(window.getFleetPilotDatabase?.());if(confirm(`В облаке ещё нет базы. Загрузить текущий автопарк?\n\nАвтомобили: ${s.cars}\nРемонты: ${s.repairs}\nОплаты: ${s.payments}`))await pushNow();return}
  const cloudTime=new Date(row.updated_at||0).getTime();const localTime=new Date(window.getFleetPilotMeta?.().lastSaved||0).getTime();
  if(cloudTime>localTime&&confirm("В облаке есть более свежая база. Скачать её на это устройство?"))await pullNow({ask:false});else setSyncStatus("Облако подключено",row.updated_at,"online")
 }catch(error){console.error(error);setSyncStatus("Ошибка подключения",null,"error")}
}
async function saveConfig(){
 const url=$("#cloudSupabaseUrl")?.value.trim(),key=$("#cloudSupabaseKey")?.value.trim();if(!url||!key)return setMessage("Введите Project URL и публичный ключ","error");
 write(CONFIG_KEY,{url,key});initClient();await bindAuth();const state=$("#cloudConfigState");if(state)state.textContent="Подключение сохранено";setMessage("Supabase подключён. Теперь войдите или создайте аккаунт.","success");renderUi()
}
async function signIn(){
 if(!client)return setMessage("Сначала сохраните подключение Supabase","error");
 const email=$("#cloudEmail")?.value.trim(),password=$("#cloudPassword")?.value;if(!email||!password)return setMessage("Введите email и пароль","error");
 setMessage("Выполняется вход…");const {data,error}=await client.auth.signInWithPassword({email,password});if(error)return setMessage(error.message,"error");session=data.session;setMessage("");renderUi();await firstSync()
}
async function signUp(){
 if(!client)return setMessage("Сначала сохраните подключение Supabase","error");
 const email=$("#cloudEmail")?.value.trim(),password=$("#cloudPassword")?.value;if(!email||!password)return setMessage("Введите email и пароль","error");
 const {data,error}=await client.auth.signUp({email,password});if(error)return setMessage(error.message,"error");
 if(data.session){session=data.session;renderUi();await firstSync()}else setMessage("Аккаунт создан. Проверьте email и подтвердите регистрацию.","success")
}
async function signOut(){if(client)await client.auth.signOut();session=null;setSyncStatus("Локальный режим",null,"local");renderUi()}
async function bindAuth(){
 if(!client)return;await refreshSession();client.auth.onAuthStateChange((_event,newSession)=>{const changed=session?.user?.id!==newSession?.user?.id;session=newSession;renderUi();if(changed&&session)setTimeout(firstSync,0)})
}
function openDialog(){renderUi();$("#cloudDialog")?.showModal()}
function bindUi(){
 $("#openCloudDialog")?.addEventListener("click",openDialog);$("#closeCloudDialog")?.addEventListener("click",()=>$("#cloudDialog")?.close());$("#saveCloudConfig")?.addEventListener("click",saveConfig);$("#cloudSignIn")?.addEventListener("click",signIn);$("#cloudSignUp")?.addEventListener("click",signUp);$("#cloudSignOut")?.addEventListener("click",signOut);$("#cloudPushNow")?.addEventListener("click",()=>pushNow());$("#cloudPullNow")?.addEventListener("click",()=>pullNow())
}
async function start(){if(started)return;started=true;bindUi();initClient();await bindAuth();renderUi()}
window.FleetPilotCloud={start,schedulePush,pushNow,pullNow,renderSummary,get session(){return session}};
document.addEventListener("DOMContentLoaded",start)
})();
