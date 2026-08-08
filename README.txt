FleetPilot V18.10 — Handover Lifecycle & Sync Fix

WHAT IS FIXED

1. ACCEPTANCE NO LONGER RETURNS TO PENDING
- Driver acceptance is now tied to the exact driverAssignmentRevision.
- A stale backend handover/old issue_at can no longer overwrite a completed current acceptance.
- Driver Portal stops showing “Принять автомобиль” after successful acceptance.
- Company → Drivers stops showing “Ожидает приёмки” after successful acceptance.

2. HANDOVER HISTORY / AUDIT
FleetPilot now keeps an immutable workspace-synced audit trail for:
- Назначен водителю
- Принят водителем
- Возвращён водителем
- Автомобиль отобран компанией
- Назначение отменено

Vehicle Handover history merges backend RPC history with this FleetPilot audit, so a forced detach can no longer disappear from history.

3. FORCED DETACH LOGIC
- If an accepted vehicle is detached by company, history records “Автомобиль отобран компанией”.
- If the driver had not accepted yet, history records “Назначение отменено”.
- Driver fields are cleared only after the audit event is written.

4. NEW ASSIGNMENT CYCLE
- Every new assignment retains its own revision.
- Confirmation from an older assignment cannot activate a new assignment.
- Reassigning the same car to the same driver still requires a new acceptance.

5. RETURN HISTORY
- Normal driver return writes a “Возвращён водителем” audit event with mileage/photos/notes.

FILES TO REPLACE
- index.html
- sw.js
- cloud.js
- fp-driver-portal.js

Important: hard refresh / service-worker refresh after upload.
