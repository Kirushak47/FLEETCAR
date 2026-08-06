# FleetPilot V12.6.3 — Leaflet Runtime Fix

- Fixed the repeated `invalidateSize is not a function` runtime error.
- All Fleet and mobile map resize calls now verify the method before calling it.
- The repeated console error loop no longer freezes the interface.
- No Supabase SQL is required.
