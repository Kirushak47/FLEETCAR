window.FLEETPILOT_CLOUD_CONFIG = Object.freeze({
  url: "https://tbpfasumklpdqwnlfncd.supabase.co",
  publishableKey: "sb_publishable_Y8lMZQN7Fc7V2HAixaZZrA_w-7STzMh",
  ownerEmail: "balyshevy@gmail.com",
  redirectUrl: "https://kirushak47.github.io/FLEETCAR/?email-confirmed=1",
  dashboardUrl: "https://supabase.com/dashboard/project/tbpfasumklpdqwnlfncd"
});

// Load post-boot consistency fixes only after the legacy modules have defined their globals.
window.addEventListener("load",()=>{
  if(!document.querySelector('script[data-fp-critical-consistency]')){
    const script=document.createElement("script");
    script.src="fp-critical-consistency-hotfix.js?v=20260811";
    script.dataset.fpCriticalConsistency="1";
    script.async=false;
    document.body.appendChild(script)
  }
  if(!document.querySelector('script[data-fp-driver-assignment]')){
    const script=document.createElement("script");
    script.src="fp-driver-assignment-hotfix.js?v=20260811d";
    script.dataset.fpDriverAssignment="1";
    script.async=false;
    document.body.appendChild(script)
  }
},{once:true});
