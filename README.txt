FleetPilot V18.4 — Unified Driver Assignment & Acceptance Flow

WHAT CHANGED
- One single driver-assignment pipeline is now used from:
  • Add vehicle
  • Edit vehicle / Vehicle Profile
  • Company → Drivers
  • Create Driver → assign vehicle
- Assigning a vehicle NEVER means that the driver accepted it.
- Account driver lifecycle is now:
  Assigned → Waiting for acceptance → Driver enters mileage + uploads photo → Accepted → On line.
- On every new/re-assignment, driverAcceptedAt is cleared and the vehicle returns to Waiting for acceptance.
- The Drivers Registry and Vehicle Profile use the same acceptance check.
- issue_at alone no longer marks a vehicle as accepted.
- Vehicle usage status now supports "Waiting for acceptance".
- Manual driver entries remain supported and do not require Driver Portal acceptance.
- Removing/replacing a driver uses the same shared unassignment logic.

FILES TO REPLACE
- index.html
- sw.js
- fp-core-data.js
- fp-driver-portal.js
- fp-roles-company.js
- fp-current-ui.css
