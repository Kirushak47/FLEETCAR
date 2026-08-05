-- FleetPilot V10.7 — Vehicle issue, return and history
create table if not exists public.vehicle_handovers(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  car_id text not null,
  driver_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  issue_at timestamptz not null default now(),
  issue_mileage integer not null,
  issue_fuel_level integer not null default 0 check(issue_fuel_level between 0 and 100),
  issue_equipment jsonb not null default '{}'::jsonb,
  issue_photos jsonb not null default '[]'::jsonb,
  issue_notes text,
  return_at timestamptz,
  return_mileage integer,
  return_fuel_level integer check(return_fuel_level between 0 and 100),
  return_equipment jsonb,
  return_photos jsonb,
  return_notes text,
  returned_by uuid references auth.users(id) on delete set null,
  status text not null default 'active' check(status in ('active','returned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists vehicle_handovers_one_active_driver_idx
on public.vehicle_handovers(workspace_id,driver_user_id)
where status='active';
create index if not exists vehicle_handovers_car_history_idx
on public.vehicle_handovers(workspace_id,car_id,issue_at desc);
alter table public.vehicle_handovers enable row level security;

drop policy if exists "Workspace members read handovers" on public.vehicle_handovers;
create policy "Workspace members read handovers"
on public.vehicle_handovers for select to authenticated
using(workspace_id=public.current_workspace_id());

create or replace function public.get_driver_handover_state()
returns table(active_handover_id uuid,car_id text,issue_at timestamptz,issue_mileage integer)
language sql security definer set search_path=public
as $$
 select h.id,h.car_id,h.issue_at,h.issue_mileage
 from public.vehicle_handovers h
 where h.workspace_id=public.current_workspace_id()
   and h.driver_user_id=auth.uid()
   and h.status='active'
 limit 1
$$;

create or replace function public.submit_vehicle_handover(
 handover_type_value text,
 mileage_value integer,
 fuel_level_value integer,
 equipment_value jsonb,
 photos_value jsonb,
 notes_value text default null
)
returns table(handover_id uuid,mileage integer,requires_attention boolean,event_at timestamptz)
language plpgsql security definer set search_path=public
as $$
declare
 ws uuid; assigned_car text; active_id uuid; server_now timestamptz:=now();
 issue_mileage_value integer; attention boolean:=false;
begin
 ws:=public.current_workspace_id();
 if public.current_workspace_role()<>'driver' then raise exception 'Driver role required'; end if;
 if handover_type_value not in ('issue','return') then raise exception 'Invalid handover type'; end if;
 if coalesce(mileage_value,-1)<0 then raise exception 'Invalid mileage'; end if;
 if fuel_level_value not between 0 and 100 then raise exception 'Invalid fuel level'; end if;
 if jsonb_array_length(coalesce(photos_value,'[]'::jsonb))<1 then raise exception 'At least one photo is required'; end if;

 select a.car_id into assigned_car
 from public.driver_vehicle_assignments a
 where a.workspace_id=ws and a.driver_user_id=auth.uid()
 and a.status='active' and a.car_id is not null limit 1;
 if assigned_car is null then raise exception 'No vehicle assigned'; end if;

 select h.id,h.issue_mileage into active_id,issue_mileage_value
 from public.vehicle_handovers h
 where h.workspace_id=ws and h.driver_user_id=auth.uid() and h.status='active'
 limit 1;

 if handover_type_value='issue' then
  if active_id is not null then raise exception 'Vehicle is already issued'; end if;
  insert into public.vehicle_handovers(
   workspace_id,car_id,driver_user_id,assigned_by,issue_at,issue_mileage,
   issue_fuel_level,issue_equipment,issue_photos,issue_notes,status
  )
  select ws,assigned_car,auth.uid(),a.assigned_by,server_now,mileage_value,
   fuel_level_value,coalesce(equipment_value,'{}'::jsonb),photos_value,notes_value,'active'
  from public.driver_vehicle_assignments a
  where a.workspace_id=ws and a.driver_user_id=auth.uid()
  returning id into active_id;

  insert into public.workspace_notifications(workspace_id,recipient_role,type,title,message,entity_type,entity_id)
  select ws,r.role_name,'handover','Автомобиль принят водителем',
   'Водитель подтвердил выдачу. Пробег: '||mileage_value,
   'vehicle_handover',active_id::text
  from (values('owner'),('coordinator')) r(role_name);
 else
  if active_id is null then raise exception 'No active handover'; end if;
  if mileage_value<issue_mileage_value then raise exception 'Return mileage cannot be lower than issue mileage'; end if;
  attention:=coalesce(length(trim(notes_value)),0)>0;

  update public.vehicle_handovers h
  set return_at=server_now,return_mileage=mileage_value,return_fuel_level=fuel_level_value,
      return_equipment=coalesce(equipment_value,'{}'::jsonb),return_photos=photos_value,
      return_notes=notes_value,returned_by=auth.uid(),status='returned',updated_at=server_now
  where h.id=active_id and h.workspace_id=ws;

  update public.driver_vehicle_assignments a
  set returned_at=server_now,status='returned'
  where a.workspace_id=ws and a.driver_user_id=auth.uid();

  insert into public.workspace_notifications(workspace_id,recipient_role,type,title,message,entity_type,entity_id)
  select ws,r.role_name,'handover',
   case when attention then 'Автомобиль возвращён с замечаниями' else 'Автомобиль возвращён' end,
   'Пробег: '||mileage_value||'. Пройдено: '||(mileage_value-issue_mileage_value)||' км',
   'vehicle_handover',active_id::text
  from (values('owner'),('coordinator'),('mechanic')) r(role_name);
 end if;

 return query select active_id,mileage_value,attention,server_now;
end;
$$;

create or replace function public.get_vehicle_handover_history(car_id_value text)
returns table(
 id uuid,driver_user_id uuid,driver_email text,driver_name text,
 issue_at timestamptz,issue_mileage integer,issue_fuel_level integer,
 issue_equipment jsonb,issue_photos jsonb,issue_photos_count integer,issue_notes text,
 return_at timestamptz,return_mileage integer,return_fuel_level integer,
 return_equipment jsonb,return_photos jsonb,return_photos_count integer,return_notes text,status text
)
language sql security definer set search_path=public
as $$
 select h.id,h.driver_user_id,p.email,coalesce(p.full_name,p.name,p.email),
 h.issue_at,h.issue_mileage,h.issue_fuel_level,h.issue_equipment,h.issue_photos,
 jsonb_array_length(coalesce(h.issue_photos,'[]'::jsonb)),h.issue_notes,
 h.return_at,h.return_mileage,h.return_fuel_level,h.return_equipment,h.return_photos,
 jsonb_array_length(coalesce(h.return_photos,'[]'::jsonb)),h.return_notes,h.status
 from public.vehicle_handovers h
 left join public.profiles p on p.user_id=h.driver_user_id
 where h.workspace_id=public.current_workspace_id() and h.car_id=car_id_value
 order by h.issue_at desc
$$;

grant execute on function public.get_driver_handover_state() to authenticated;
grant execute on function public.submit_vehicle_handover(text,integer,integer,jsonb,jsonb,text) to authenticated;
grant execute on function public.get_vehicle_handover_history(text) to authenticated;
notify pgrst,'reload schema';
