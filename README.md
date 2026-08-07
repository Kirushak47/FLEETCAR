# FleetPilot V11.3.4 — Service Workflow

Based on stable V11.3.3.1 Cars Restore.

Workflow:
- Service inbox shows only New and Accepted driver requests.
- Request status menu contains New / Accepted / Rejected only.
- Separate “Передать в сервис” action opens the existing repair form with request/car/mileage prefilled.
- After the linked repair is saved, the existing cloud link operation changes the request to a service/repair state.
- That request therefore disappears from the upper inbox and remains as the linked repair below.
- Fleet request summary counts only unresolved New/Accepted requests.
- No changes to Fleet rendering, theme, maps, Supabase schema or finance logic.
- No SQL required.
