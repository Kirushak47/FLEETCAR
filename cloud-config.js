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
  if(!document.querySelector('script[data-fp-critical-consistency]')){
    const script=document.createElement("script");script.src="fp-critical-consistency-hotfix.js?v=20260811";script.dataset.fpCriticalConsistency="1";script.async=false;document.body.appendChild(script)
  }
  if(!document.querySelector('script[data-fp-driver-assignment-v3]')){
    const script=document.createElement("script");script.src="fp-driver-assignment-v3.js?v=20260811d";script.dataset.fpDriverAssignmentV3="1";script.async=false;document.body.appendChild(script)
  }
  if(!document.querySelector('script[data-fp-operational-domain-v1]')){
    const script=document.createElement("script");script.src="fp-operational-domain-v1.js?v=20260812a";script.dataset.fpOperationalDomainV1="1";script.async=false;document.body.appendChild(script)
  }
},{once:true});
