-- FleetPilot V10.1.2 — Workspace Sync Fix
-- Run once in Supabase SQL Editor → New query.

alter table public.fleet_states
add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

-- Connect old personal rows to the user's active workspace.
update public.fleet_states fs
set workspace_id=wm.workspace_id
from public.workspace_members wm
where wm.user_id=fs.user_id
  and wm.status='active'
  and fs.workspace_id is null;

-- Keep only the newest cloud row if old migrations produced duplicates.
with ranked as (
  select
    ctid,
    row_number() over (
      partition by workspace_id
      order by updated_at desc nulls last, created_at desc nulls last
    ) as rn
  from public.fleet_states
  where workspace_id is not null
)
delete from public.fleet_states fs
using ranked r
where fs.ctid=r.ctid and r.rn>1;

drop index if exists public.fleet_states_workspace_unique;

alter table public.fleet_states
drop constraint if exists fleet_states_workspace_id_key;

alter table public.fleet_states
add constraint fleet_states_workspace_id_key unique(workspace_id);

create or replace function public.load_workspace_fleet_state()
returns table(
  payload jsonb,
  updated_at timestamptz,
  device_name text
)
language plpgsql
security definer
set search_path=public
as $$
declare
  ws uuid;
begin
  ws:=public.current_workspace_id();

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if ws is null then
    raise exception 'Workspace membership required';
  end if;

  return query
  select fs.payload,fs.updated_at,fs.device_name
  from public.fleet_states fs
  where fs.workspace_id=ws
  limit 1;
end;
$$;

create or replace function public.save_workspace_fleet_state(
  state_payload jsonb,
  state_device_name text default null
)
returns table(updated_at timestamptz)
language plpgsql
security definer
set search_path=public
as $$
declare
  ws uuid;
  member_role text;
  saved_at timestamptz:=now();
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  ws:=public.current_workspace_id();
  member_role:=public.current_workspace_role();

  if ws is null then
    raise exception 'Workspace membership required';
  end if;

  if member_role not in ('owner','coordinator') then
    raise exception 'Workspace write permission denied';
  end if;

  if state_payload is null or jsonb_typeof(state_payload)<>'object' then
    raise exception 'Invalid fleet payload';
  end if;

  insert into public.fleet_states(
    workspace_id,
    user_id,
    payload,
    device_name,
    updated_at
  )
  values(
    ws,
    auth.uid(),
    state_payload,
    left(coalesce(state_device_name,''),120),
    saved_at
  )
  on conflict(workspace_id)
  do update set
    payload=excluded.payload,
    user_id=auth.uid(),
    device_name=excluded.device_name,
    updated_at=saved_at;

  return query select saved_at;
end;
$$;

grant execute on function public.load_workspace_fleet_state() to authenticated;
grant execute on function public.save_workspace_fleet_state(jsonb,text) to authenticated;

-- Direct table policies remain restrictive; normal synchronization uses RPC.
alter table public.fleet_states enable row level security;

drop policy if exists "Workspace members read fleet" on public.fleet_states;
drop policy if exists "Workspace managers insert fleet" on public.fleet_states;
drop policy if exists "Workspace managers update fleet" on public.fleet_states;
drop policy if exists "Workspace members select fleet state" on public.fleet_states;
drop policy if exists "Workspace managers insert fleet state" on public.fleet_states;
drop policy if exists "Workspace managers update fleet state" on public.fleet_states;

create policy "Workspace members select fleet state"
on public.fleet_states
for select to authenticated
using(workspace_id=public.current_workspace_id());

create policy "Workspace managers insert fleet state"
on public.fleet_states
for insert to authenticated
with check(
  workspace_id=public.current_workspace_id()
  and public.current_workspace_role() in ('owner','coordinator')
);

create policy "Workspace managers update fleet state"
on public.fleet_states
for update to authenticated
using(
  workspace_id=public.current_workspace_id()
  and public.current_workspace_role() in ('owner','coordinator')
)
with check(
  workspace_id=public.current_workspace_id()
  and public.current_workspace_role() in ('owner','coordinator')
);

notify pgrst,'reload schema';
