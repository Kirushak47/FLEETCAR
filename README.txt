FleetPilot V18.11 — Handover Backend Lifecycle Fix

WHAT IS FIXED

1. REAL SERVER-SIDE DRIVER ACCEPTANCE
- Fixed the root cause of Driver Portal showing accepted while Company → Drivers remained pending.
- Some Supabase versions create an `issued` handover immediately when a car is assigned.
- When the driver confirms the vehicle, FleetPilot now closes that provisional technical issue and immediately creates the real issue with the driver's mileage, photos, equipment and notes.
- Acceptance therefore exists in Supabase, not only in the driver's local UI.

2. COMPANY → DRIVERS SYNC
- After confirmation, the driver status becomes “Автомобиль принят” instead of returning to “Ожидает приёмки”.
- Acceptance is additionally recoverable from the immutable assignment audit for the current assignment revision.

3. VEHICLE HANDOVER HISTORY
- The real confirmed issue is visible in Vehicle Handover history with mileage/photos.
- The internal technical close/reissue operation is hidden from the business history.
- Forced company detach remains recorded as “Автомобиль отобран компанией”.
- Cancellation before acceptance remains “Назначение отменено”.

4. RETURN FLOW
- Driver return now targets the real server-side active issue created after confirmation.
- This removes the lifecycle mismatch that previously caused return confirmation to fail or reopen the acceptance state.

5. ASSIGNMENT REVISION SAFETY
- Reassigning the same vehicle to the same driver is still a new cycle and requires new mileage + photos.
- Old acceptance cannot activate a new assignment.

FILES TO REPLACE
- index.html
- sw.js
- cloud.js
- fp-driver-portal.js

IMPORTANT
After uploading, hard refresh the page / clear the old Service Worker cache.
