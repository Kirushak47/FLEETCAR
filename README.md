# FleetPilot Cloud V1 — Owner Admin

## Before uploading to GitHub

### 1. Edit `cloud-config.js`

Replace:

- `PASTE_SB_PUBLISHABLE_KEY_HERE` with the Supabase Publishable Key (`sb_publishable_...`)
- `PASTE_OWNER_EMAIL_HERE` with your FleetPilot login email

Do not insert a Secret Key or service_role key.

### 2. Run SQL

If Cloud Beta was already configured, use:

`supabase_migration_cloud_v1.sql`

Open Supabase → SQL Editor → New query, paste the complete file, replace
`PASTE_OWNER_EMAIL_HERE`, and press Run.

For a completely new project use:

`supabase_setup_cloud_v1.sql`

### 3. Authentication URL

Supabase → Authentication → URL Configuration:

Site URL:

`https://kirushak47.github.io/FLEETCAR/`

Redirect URLs:

`https://kirushak47.github.io/FLEETCAR/**`

### 4. Upload all files to GitHub

Open:

`https://kirushak47.github.io/FLEETCAR/?v=9000`

## User experience

Ordinary users see only:

- Email
- Password
- Sign in
- Create account
- Password recovery
- Email confirmation

They never see Supabase URL or API keys.

## Owner access

When you sign in with the email configured as owner:

- FleetPilot Admin appears
- all registered profiles are listed
- vehicle counts and last cloud sync are shown
- a user's cloud backup can be downloaded
- the real Supabase Dashboard can be opened

The actual Secret Key is not stored in FleetPilot.
