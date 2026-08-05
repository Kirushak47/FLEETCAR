-- FleetPilot V10.5.1 — Realtime Sync
-- Run once in Supabase SQL Editor.

alter table public.fleet_states replica identity full;

do $$
begin
  if not exists(
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='fleet_states'
  ) then
    alter publication supabase_realtime add table public.fleet_states;
  end if;
end;
$$;

-- Recreate the save function so device_name always identifies the source device.
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
    workspace_id,user_id,payload,device_name,updated_at
  )
  values(
    ws,auth.uid(),state_payload,left(coalesce(state_device_name,''),120),saved_at
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

grant execute on function public.save_workspace_fleet_state(jsonb,text) to authenticated;

notify pgrst,'reload schema';
