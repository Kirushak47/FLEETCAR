# FleetPilot V11.3.5 — Deep Links

Built on V11.3.4 Service Workflow.

Deep links:
- `#/dashboard`
- `#/fleet`
- `#/service`
- `#/rent`
- `#/expenses`
- `#/calendar`
- `#/documents`
- `#/analytics`
- `#/company`
- `#/data`
- `#/car/<car-id>`
- `#/car/<car-id>/finance`
- `#/car/<car-id>/history`
- `#/car/<car-id>/documents`
- `#/car/<car-id>/damages`

Behavior:
- Desktop URL changes as the user navigates.
- Browser Back/Forward reopens the matching FleetPilot screen.
- Refresh keeps the current deep-linked page/car.
- Mobile UI remains unchanged, but an SMS deep link opens the requested page/car.
- Car routes also accept an exact registration plate in place of the internal car id.
- Car profile has a "Скопировать ссылку" button.
- Hash routing requires no Cloudflare `_redirects` and does not change Supabase.
- No SQL required.
