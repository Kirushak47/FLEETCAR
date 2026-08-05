-- FleetPilot Cloud Beta — run once in Supabase SQL Editor

create table if not exists public.fleet_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  device_name text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.fleet_states enable row level security;

drop policy if exists "Users read own fleet" on public.fleet_states;
create policy "Users read own fleet"
on public.fleet_states for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users insert own fleet" on public.fleet_states;
create policy "Users insert own fleet"
on public.fleet_states for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own fleet" on public.fleet_states;
create policy "Users update own fleet"
on public.fleet_states for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users delete own fleet" on public.fleet_states;
create policy "Users delete own fleet"
on public.fleet_states for delete
to authenticated
using ((select auth.uid()) = user_id);
