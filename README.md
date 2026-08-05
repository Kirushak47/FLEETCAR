# FleetPilot Cloud V2

## What changed
- full-screen login / registration / email-confirmation gate
- profile avatar in the header
- separate logged-in profile screen
- demo mode
- logout removes the current user's local CRM from the device
- cloud data remains in Supabase
- automatic cloud download after login
- pre-pull backup moved from localStorage to IndexedDB
- old quota-causing `fleetpilot.cloud.prepull.*` records are removed
- admin statistics show loading/error instead of misleading zeros
- owner tools are shown only for the owner role

## Supabase owner access
Run `supabase_owner_fix.sql` once in SQL Editor.

## Deploy
Upload every file to GitHub and open:

https://kirushak47.github.io/FLEETCAR/?v=9200

Then press Ctrl+F5 once.
