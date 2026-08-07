# FleetPilot V11.3.9.4 — Auth Route Boot Fix

Fixes the remaining refresh/deep-link race:
- access checks no longer reject pages while Supabase membership/role is still loading;
- logged-in deep links wait for `fleetpilot:access-ready`;
- once role/membership is resolved, the URL hash is the final navigation authority;
- removes the false “У вашей роли нет доступа к этому разделу” toast during F5 startup;
- performs a second route restore after late desktop initialization;
- real role restrictions still work after access is ready;
- previous photo service badge and collapsible Service queue remain unchanged.
No SQL required.
