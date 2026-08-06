# FleetPilot V11.3.1 — Stable Rollback

This is the clean rollback package based on the last stable Finance & Service Fix build.

Production:
https://fleetpilot.balyshevy.workers.dev/

Important:
- Existing Supabase project and data are preserved.
- No SQL must be executed.
- `_redirects` is removed.
- `.assetsignore` is included for Cloudflare Workers Static Assets.
- No V12 redesign or experimental patches are included.

Deploy:
1. Delete the current repository files except `.git`.
2. Upload the contents of this package.
3. Commit once.
4. Wait for Cloudflare deployment.
5. Open the site with `?v=113110` and hard-refresh.
