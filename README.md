# FleetPilot V12.6.2 — White Screen Fix

Critical emergency fix:
- removed unsafe early showPage() call;
- safe startup always opens the Dashboard;
- background Fleet initialization no longer changes the active page;
- optional removed buttons no longer crash initialization;
- light theme remains permanent;
- request panel remains hidden until a real active request exists;
- core files use network-first service-worker loading to avoid stale broken JavaScript;
- no SQL required.
