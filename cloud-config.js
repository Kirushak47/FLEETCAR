window.FLEETPILOT_CLOUD_CONFIG = Object.freeze({
  url: "https://tbpfasumklpdqwnlfncd.supabase.co",
  publishableKey: "sb_publishable_Y8lMZQN7Fc7V2HAixaZZrA_w-7STzMh",
  ownerEmail: "balyshevy@gmail.com",
  redirectUrl: "https://kirushak47.github.io/FLEETCAR/?email-confirmed=1",
  dashboardUrl: "https://supabase.com/dashboard/project/tbpfasumklpdqwnlfncd"
});

(()=>{
  const supabase=window.supabase;
  if(!supabase?.createClient||supabase.createClient.__fleetPilotSingleton)return;
  const nativeCreate=supabase.createClient.bind(supabase);
  let sharedClient=null,sharedUrl='',sharedKey='';
  const create=function(url,key,options){
    const u=String(url||''),k=String(key||'');
    if(sharedClient&&u===sharedUrl&&k===sharedKey)return sharedClient;
    if(sharedClient&&u!==sharedUrl){console.warn('FleetPilot blocked a second Supabase project client in the same page',u);return sharedClient}
    sharedClient=nativeCreate(url,key,options);sharedUrl=u;sharedKey=k;window.__FLEETPILOT_SUPABASE_CLIENT__=sharedClient;return sharedClient
  };
  create.__fleetPilotSingleton=true;create.__nativeCreateClient=nativeCreate;supabase.createClient=create;
})();

window.addEventListener("load",()=>{
  const load=(attr,src)=>{if(document.querySelector(`script[${attr}]`))return;const s=document.createElement('script');s.src=src;s.setAttribute(attr,'1');s.async=false;document.body.appendChild(s)};
  load('data-fp-critical-consistency','fp-critical-consistency-hotfix.js?v=20260811');
  load('data-fp-driver-assignment-v3','fp-driver-assignment-v3.js?v=20260811d');
  // Old operational status domain intentionally removed. Fleet Board V2 owns vehicle status now.
  load('data-fp-driver-return-mileage','fp-driver-return-mileage-hotfix.js?v=20260812');
  load('data-fp-ui-completion-v1','fp-ui-completion-v1.js?v=20260812');
  load('data-fp-driver-domain-v2','fp-driver-domain-v2.js?v=20260812a');
  load('data-fp-fleet-board-v2','fp-fleet-board-v2.js?v=20260812a');
},{once:true});
