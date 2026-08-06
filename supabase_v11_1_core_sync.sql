-- FleetPilot V11.1 Core Sync
-- Execute after previous migrations.

create table if not exists public.vehicle_mileage_history(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 car_id text not null,
 old_mileage integer not null default 0,
 new_mileage integer not null,
 source text not null,
 changed_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.vehicle_mileage_history enable row level security;
drop policy if exists "Workspace members read mileage history" on public.vehicle_mileage_history;
create policy "Workspace members read mileage history" on public.vehicle_mileage_history for select to authenticated
using(workspace_id=public.current_workspace_id());

create or replace function public.patch_workspace_car_state(
 ws uuid,car_id_value text,mileage_value integer default null,tenant_value text default null,status_value text default null,clear_driver boolean default false
) returns void language plpgsql security definer set search_path=public as $$
declare state_row public.fleet_states%rowtype; cars jsonb; old_mileage integer:=0; patched jsonb;
begin
 select * into state_row from public.fleet_states where workspace_id=ws for update;
 if not found then return; end if;
 cars:=coalesce(state_row.payload->'cars','[]'::jsonb);
 select coalesce((item->>'mileage')::integer,0) into old_mileage from jsonb_array_elements(cars) item where item->>'id'=car_id_value limit 1;
 if mileage_value is not null and mileage_value<old_mileage then raise exception 'Mileage cannot be lower than current mileage (%)',old_mileage; end if;
 select coalesce(jsonb_agg(
  case when item->>'id'=car_id_value then
   item || (case when mileage_value is null then '{}'::jsonb else jsonb_build_object('mileage',mileage_value) end)
        || (case when tenant_value is null then '{}'::jsonb else jsonb_build_object('tenant',tenant_value) end)
        || (case when status_value is null then '{}'::jsonb else jsonb_build_object('status',status_value) end)
        || (case when clear_driver then jsonb_build_object('driverUserId','') else '{}'::jsonb end)
  else item end
 ),'[]'::jsonb) into patched from jsonb_array_elements(cars) item;
 update public.fleet_states set payload=jsonb_set(state_row.payload,'{cars}',patched,true),updated_at=now(),device_name='server|core-sync' where workspace_id=ws;
 if mileage_value is not null and mileage_value>old_mileage then
  insert into public.vehicle_mileage_history(workspace_id,car_id,old_mileage,new_mileage,source,changed_by)
  values(ws,car_id_value,old_mileage,mileage_value,'server_sync',auth.uid());
 end if;
end;$$;

create or replace function public.update_assigned_vehicle_mileage(mileage_value integer,source_value text default 'driver_manual')
returns table(car_id text,old_mileage integer,new_mileage integer,event_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare ws uuid; assigned_car text; current_mileage integer:=0; now_value timestamptz:=now();
begin
 ws:=public.current_workspace_id();
 if public.current_workspace_role()<>'driver' then raise exception 'Driver role required'; end if;
 select a.car_id into assigned_car from public.driver_vehicle_assignments a where a.workspace_id=ws and a.driver_user_id=auth.uid() and a.status='active' and a.car_id is not null;
 if assigned_car is null then raise exception 'No active assigned vehicle'; end if;
 select coalesce((item->>'mileage')::integer,0) into current_mileage from public.fleet_states fs,cross join lateral jsonb_array_elements(coalesce(fs.payload->'cars','[]'::jsonb)) item where fs.workspace_id=ws and item->>'id'=assigned_car limit 1;
 if mileage_value<current_mileage then raise exception 'Mileage cannot be lower than current mileage (%)',current_mileage; end if;
 perform public.patch_workspace_car_state(ws,assigned_car,mileage_value,null,null,false);
 insert into public.vehicle_mileage_history(workspace_id,car_id,old_mileage,new_mileage,source,changed_by)
 select ws,assigned_car,current_mileage,mileage_value,source_value,auth.uid() where mileage_value>current_mileage;
 return query select assigned_car,current_mileage,mileage_value,now_value;
end;$$;

create or replace function public.get_workspace_driver_assignments_v11()
returns table(driver_user_id uuid,car_id text,assigned_at timestamptz,returned_at timestamptz,status text,driver_email text)
language sql security definer set search_path=public as $$
 select a.driver_user_id,a.car_id,a.assigned_at,a.returned_at,a.status,p.email
 from public.driver_vehicle_assignments a left join public.profiles p on p.user_id=a.driver_user_id
 where a.workspace_id=public.current_workspace_id() and public.current_workspace_role() in ('owner','coordinator','mechanic')
$$;

create or replace function public.submit_vehicle_handover(
 handover_type_value text,mileage_value integer,fuel_level_value integer,equipment_value jsonb,photos_value jsonb,notes_value text default null
) returns table(handover_id uuid,mileage integer,requires_attention boolean,event_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare ws uuid;assigned_car text;active_id uuid;server_now timestamptz:=now();issue_mileage_value integer;attention boolean:=false;driver_label text;
begin
 ws:=public.current_workspace_id();
 if public.current_workspace_role()<>'driver' then raise exception 'Driver role required'; end if;
 if handover_type_value not in ('issue','return') then raise exception 'Invalid handover type'; end if;
 select a.car_id into assigned_car from public.driver_vehicle_assignments a where a.workspace_id=ws and a.driver_user_id=auth.uid() and a.status='active' and a.car_id is not null limit 1;
 if assigned_car is null then raise exception 'No vehicle assigned'; end if;
 select h.id,h.issue_mileage into active_id,issue_mileage_value from public.vehicle_handovers h where h.workspace_id=ws and h.driver_user_id=auth.uid() and h.status='active' limit 1;
 select coalesce(p.email,'Водитель') into driver_label from public.profiles p where p.user_id=auth.uid();
 if handover_type_value='issue' then
  if active_id is not null then raise exception 'Vehicle is already issued'; end if;
  insert into public.vehicle_handovers(workspace_id,car_id,driver_user_id,assigned_by,issue_at,issue_mileage,issue_fuel_level,issue_equipment,issue_photos,issue_notes,status)
  select ws,assigned_car,auth.uid(),a.assigned_by,server_now,mileage_value,fuel_level_value,coalesce(equipment_value,'{}'),photos_value,notes_value,'active' from public.driver_vehicle_assignments a where a.workspace_id=ws and a.driver_user_id=auth.uid() returning id into active_id;
  perform public.patch_workspace_car_state(ws,assigned_car,mileage_value,driver_label,'active',false);
 else
  if active_id is null then raise exception 'No active handover'; end if;
  if mileage_value<issue_mileage_value then raise exception 'Return mileage cannot be lower than issue mileage'; end if;
  attention:=coalesce(length(trim(notes_value)),0)>0;
  update public.vehicle_handovers set return_at=server_now,return_mileage=mileage_value,return_fuel_level=fuel_level_value,return_equipment=coalesce(equipment_value,'{}'),return_photos=photos_value,return_notes=notes_value,returned_by=auth.uid(),status='returned',updated_at=server_now where id=active_id and workspace_id=ws;
  update public.driver_vehicle_assignments set returned_at=server_now,status='returned',car_id=null where workspace_id=ws and driver_user_id=auth.uid();
  perform public.patch_workspace_car_state(ws,assigned_car,mileage_value,'',case when attention then 'attention' else 'free' end,true);
 end if;
 insert into public.workspace_notifications(workspace_id,recipient_role,type,title,message,entity_type,entity_id)
 select ws,r.role_name,'handover',case when handover_type_value='return' then case when attention then 'Автомобиль возвращён с замечаниями' else 'Автомобиль возвращён' end else 'Автомобиль принят водителем' end,'Пробег: '||mileage_value||' км','vehicle_handover',active_id::text from (values('owner'),('coordinator'),('mechanic')) r(role_name);
 return query select active_id,mileage_value,attention,server_now;
end;$$;

grant execute on function public.update_assigned_vehicle_mileage(integer,text) to authenticated;
grant execute on function public.get_workspace_driver_assignments_v11() to authenticated;
grant execute on function public.patch_workspace_car_state(uuid,text,integer,text,text,boolean) to authenticated;
notify pgrst,'reload schema';
