# FleetPilot 20 — modular architecture

## Rule
Each business domain has one owner. UI renderers do not change routes, auth does not decide vehicle status, service history does not change mileage unless an accepted business event explicitly does so.

## New modules
- `modules/core/runtime.js` — shared namespace, DB access, events, safe helpers.
- `modules/core/boot.js` — boot coordination; render only, never navigate.
- `modules/router/router.js` — routes and refresh restoration.
- `modules/fleet/status.js` — authoritative vehicle status.
- `modules/fleet/board.js` — Fleet Board UI only.
- `modules/drivers/state.js` — driver state and assigned vehicle lookup.

## Vehicle status rules
- assigned driver => `active` / **На линии**
- no driver + explicit Fleet Board repair flag => `repair` / **В ремонте**
- no driver and no repair flag => `free` / **Свободен**
- service requests do not automatically move an assigned car off line

## Migration plan
1. Router / boot / Fleet Board / driver state — started in V20 alpha 1.
2. Driver assignment + handover + mileage — move out of hotfix files.
3. Service domain — requests, repairs, oil history, archive semantics.
4. Finance domain — payments, expenses, tax profile, paid/completed rules.
5. Documents domain — active/archive/delete lifecycle.
6. Analytics and calendar.
7. Remove compatibility hotfixes and legacy duplicate functions.

## Compatibility policy
Temporary `fp-*-hotfix.js` files may remain only while their logic is not yet migrated. Once migrated, the old override must be removed instead of left as a second implementation.
