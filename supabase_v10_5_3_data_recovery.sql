-- FleetPilot V10.5.3 — Data Recovery & Protection
create table if not exists public.fleet_state_versions(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null,
  device_name text,
  cars_count integer not null default 0,
  records_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists fleet_state_versions_workspace_created_idx
on public.fleet_state_versions(workspace_id,created_at desc);
alter table public.fleet_state_versions enable row level security;
drop policy if exists "Workspace members read fleet versions" on public.fleet_state_versions;
create policy "Workspace members read fleet versions"
on public.fleet_state_versions for select to authenticated
using(workspace_id=public.current_workspace_id());

create or replace function public.save_workspace_fleet_state(state_payload jsonb,state_device_name text default null)
returns table(updated_at timestamptz)
language plpgsql security definer set search_path=public
as $$
declare ws uuid; member_role text; saved_at timestamptz:=now(); current_payload jsonb;
current_cars integer:=0; incoming_cars integer:=0;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 ws:=public.current_workspace_id(); member_role:=public.current_workspace_role();
 if ws is null then raise exception 'Workspace membership required'; end if;
 if member_role not in ('owner','coordinator') then raise exception 'Workspace write permission denied'; end if;
 if state_payload is null or jsonb_typeof(state_payload)<>'object' then raise exception 'Invalid fleet payload'; end if;

 select fs.payload into current_payload from public.fleet_states fs where fs.workspace_id=ws limit 1;
 current_cars:=coalesce(jsonb_array_length(coalesce(current_payload->'cars','[]'::jsonb)),0);
 incoming_cars:=coalesce(jsonb_array_length(coalesce(state_payload->'cars','[]'::jsonb)),0);
 if incoming_cars=0 and current_cars>0 then raise exception 'Empty fleet overwrite blocked'; end if;

 if current_payload is not null then
  insert into public.fleet_state_versions(workspace_id,actor_user_id,payload,device_name,cars_count,records_count)
  values(ws,auth.uid(),current_payload,left(coalesce(state_device_name,''),120),current_cars,
   current_cars+
   coalesce(jsonb_array_length(coalesce(current_payload->'repairs','[]'::jsonb)),0)+
   coalesce(jsonb_array_length(coalesce(current_payload->'payments','[]'::jsonb)),0)+
   coalesce(jsonb_array_length(coalesce(current_payload->'expenses','[]'::jsonb)),0)+
   coalesce(jsonb_array_length(coalesce(current_payload->'documents','[]'::jsonb)),0));
 end if;

 insert into public.fleet_states(workspace_id,user_id,payload,device_name,updated_at)
 values(ws,auth.uid(),state_payload,left(coalesce(state_device_name,''),120),saved_at)
 on conflict(workspace_id) do update set payload=excluded.payload,user_id=auth.uid(),device_name=excluded.device_name,updated_at=saved_at;

 delete from public.fleet_state_versions v
 where v.workspace_id=ws and v.id not in(
  select k.id from public.fleet_state_versions k where k.workspace_id=ws order by k.created_at desc limit 50
 );
 return query select saved_at;
end;
$$;

create or replace function public.get_workspace_fleet_versions()
returns table(id uuid,actor_email text,device_name text,cars_count integer,records_count integer,created_at timestamptz)
language sql security definer set search_path=public
as $$
 select v.id,p.email,v.device_name,v.cars_count,v.records_count,v.created_at
 from public.fleet_state_versions v left join public.profiles p on p.user_id=v.actor_user_id
 where v.workspace_id=public.current_workspace_id()
 and public.current_workspace_role() in ('owner','coordinator')
 order by v.created_at desc limit 50
$$;

create or replace function public.restore_workspace_fleet_version(version_id_value uuid)
returns table(payload jsonb,updated_at timestamptz)
language plpgsql security definer set search_path=public
as $$
declare ws uuid; selected_payload jsonb; current_payload jsonb; restored_at timestamptz:=now();
begin
 ws:=public.current_workspace_id();
 if public.current_workspace_role() not in ('owner','coordinator') then raise exception 'Permission denied'; end if;
 select v.payload into selected_payload from public.fleet_state_versions v where v.id=version_id_value and v.workspace_id=ws;
 if selected_payload is null then raise exception 'Version not found'; end if;
 select fs.payload into current_payload from public.fleet_states fs where fs.workspace_id=ws limit 1;
 if current_payload is not null then
  insert into public.fleet_state_versions(workspace_id,actor_user_id,payload,device_name,cars_count,records_count)
  values(ws,auth.uid(),current_payload,'before-version-restore',
   coalesce(jsonb_array_length(coalesce(current_payload->'cars','[]'::jsonb)),0),
   coalesce(jsonb_array_length(coalesce(current_payload->'cars','[]'::jsonb)),0)+
   coalesce(jsonb_array_length(coalesce(current_payload->'repairs','[]'::jsonb)),0)+
   coalesce(jsonb_array_length(coalesce(current_payload->'payments','[]'::jsonb)),0)+
   coalesce(jsonb_array_length(coalesce(current_payload->'expenses','[]'::jsonb)),0)+
   coalesce(jsonb_array_length(coalesce(current_payload->'documents','[]'::jsonb)),0));
 end if;
 update public.fleet_states fs set payload=selected_payload,user_id=auth.uid(),device_name='cloud-version-restore',updated_at=restored_at where fs.workspace_id=ws;
 return query select selected_payload,restored_at;
end;
$$;

grant execute on function public.save_workspace_fleet_state(jsonb,text) to authenticated;
grant execute on function public.get_workspace_fleet_versions() to authenticated;
grant execute on function public.restore_workspace_fleet_version(uuid) to authenticated;
notify pgrst,'reload schema';
