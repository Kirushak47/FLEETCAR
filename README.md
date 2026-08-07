# FleetPilot V11.3.9.3 — Route / Photo Badge / Service Collapse Fix

Fixes:
- Deep link/hash route is restored after the complete UI boot, so F5 no longer leaves the wrong page visible under another active menu item.
- Browser Back/Forward and refresh continue to use the hash route as the final navigation authority.
- Desktop service task indicator is physically inside the vehicle photo wrapper at top-left.
- Mobile indicator remains attached to the image hero.
- The indicator no longer floats at the bottom-left of the desktop vehicle row.
- Service CRM vehicle task lists can be collapsed/expanded with an arrow.
- Collapsing hides only the task rows; the vehicle header stays visible.
- Collapse state is remembered locally.
- Existing car-save fix, Service CRM, planned service expenses, Supabase schema and finance logic are unchanged.
- No SQL required.
