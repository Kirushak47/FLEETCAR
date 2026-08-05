# FleetPilot V10.0.1 — Multi-Tenant Security

1. Supabase → SQL Editor → New query.
2. Run `supabase_v10_0_1_platform_admin.sql`.
3. Upload all files to GitHub.
4. Open:
   https://kirushak47.github.io/FLEETCAR/?v=100010

Fixed:
- workspace owner no longer sees platform administration;
- Supabase button is visible only to platform admin;
- workspace owner sees only their own fleet and team;
- platform-admin status is stored separately in `platform_admins`;
- ordinary owners cannot see other projects;
- own role/status fields are disabled in the team screen;
- added SQL safety against changing your own role/status;
- terminology updated from generic company/CRM wording to fleet/workspace wording.
