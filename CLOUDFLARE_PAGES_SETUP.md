# FleetPilot on Cloudflare Pages

## Recommended: Direct Upload

1. Sign in to Cloudflare.
2. Open **Workers & Pages**.
3. Select **Create application** → **Pages** → **Upload assets / Direct Upload**.
4. Create a project, for example `fleetpilot`.
5. Upload the CONTENTS of this folder (or this ZIP if the dashboard accepts ZIP upload).
6. Wait for the deployment to finish.
7. Open the generated address, for example:
   `https://fleetpilot.pages.dev`

## Supabase authentication

In Supabase open:

**Authentication → URL Configuration**

Set **Site URL** to your Cloudflare production URL.

Add to **Redirect URLs**:

- `https://fleetpilot.pages.dev/**`
- your custom domain, if added later

Do not delete existing localhost or GitHub URLs until the Cloudflare version is fully tested.

## Updating the site

Use Cloudflare Pages → your project → **Create deployment / Upload new version**.
Upload one version and wait for it to complete before uploading another.

## Important

No new SQL, tables, Edge Functions, or Storage buckets are required.
The existing `cloud.js` and `cloud-config.js` must remain in the deploy package.
