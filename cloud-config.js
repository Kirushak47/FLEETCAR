/*
 FleetPilot Cloud public configuration.

 1. Paste your Supabase Publishable Key below.
 2. Paste the email that must receive the owner role.
 3. Upload this file to GitHub together with the rest of FleetPilot.

 Publishable Key is designed for browser use.
 NEVER put sb_secret_ or service_role keys here.
*/
window.FLEETPILOT_CLOUD_CONFIG = Object.freeze({
  url: "https://tbpfasumklpdqwnlfncd.supabase.co",
  publishableKey: "PASTE_SB_PUBLISHABLE_KEY_HERE",
  ownerEmail: "PASTE_OWNER_EMAIL_HERE",
  redirectUrl: "https://kirushak47.github.io/FLEETCAR/?email-confirmed=1",
  dashboardUrl: "https://supabase.com/dashboard/project/tbpfasumklpdqwnlfncd"
});
