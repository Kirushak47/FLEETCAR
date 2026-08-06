-- FleetPilot V10.5 — Driver Portal Stage 1
-- Run once in Supabase SQL Editor.

create table if not exists public.driver_vehicle_assignments(
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  driver_user_id uuid not null references auth.users(id) on delete cascade,
  car_id text,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  returned_at timestamptz,
  status text not null default 'active' check(status in ('active','returned')),
  primary key(workspace_id,driver_user_id)
);

create table if not exists public.driver_repair_requests(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  driver_user_id uuid not null references auth.users(id) on delete cascade,
  car_id text not null,
  category text not null,
  urgency text not null check(urgency in ('normal','service','critical')),
  description text not null,
  mileage integer not null default 0,
  dashboard_warning boolean not null default false,
  status text not null default 'new'
    check(status in ('new','accepted','scheduled','repair','done','rejected')),
  manager_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_notifications(
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete cascade,
  recipient_role text,
  type text not null default 'info',
  title text not null,
  message text,
  entity_type text,
  entity_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.driver_vehicle_assignments enable row level security;
alter table public.driver_repair_requests enable row level security;
alter table public.workspace_notifications enable row level security;

create or replace function public.assign_driver_vehicle(
  driver_user_id_value uuid,
  car_id_value text
)
returns void
language plpgsql security definer set search_path=public
as $$
declare ws uuid;
begin
 ws:=public.current_workspace_id();
 if public.current_workspace_role() not in ('owner','coordinator') then
  raise exception 'Only owner or coordinator can assign vehicles';
 end if;

 if not exists(
  select 1 from public.workspace_members wm
  where wm.workspace_id=ws and wm.user_id=driver_user_id_value
    and wm.role='driver' and wm.status='active'
 ) then raise exception 'Driver is not an active workspace member'; end if;

 insert into public.driver_vehicle_assignments(
  workspace_id,driver_user_id,car_id,assigned_by,assigned_at,status,returned_at
 )
 values(ws,driver_user_id_value,nullif(car_id_value,''),auth.uid(),now(),'active',null)
 on conflict(workspace_id,driver_user_id)
 do update set
  car_id=excluded.car_id,
  assigned_by=auth.uid(),
  assigned_at=now(),
  returned_at=null,
  status='active';

 insert into public.workspace_notifications(
  workspace_id,recipient_user_id,type,title,message,entity_type,entity_id
 )
 values(
  ws,driver_user_id_value,'vehicle',
  case when nullif(car_id_value,'') is null then 'Назначение автомобиля снято' else 'Вам назначен автомобиль' end,
  case when nullif(car_id_value,'') is null then 'Обратитесь к координатору для нового назначения.' else 'Откройте Driver Portal, чтобы увидеть данные автомобиля.' end,
  'vehicle',car_id_value
 );
end;
$$;

create or replace function public.get_workspace_driver_assignments()
returns table(driver_user_id uuid,car_id text,assigned_at timestamptz)
language sql security definer set search_path=public
as $$
 select a.driver_user_id,a.car_id,a.assigned_at
 from public.driver_vehicle_assignments a
 where a.workspace_id=public.current_workspace_id()
   and public.current_workspace_role() in ('owner','coordinator','mechanic')
$$;

create or replace function public.get_driver_portal_context()
returns table(
 car_id text,
 assigned_at timestamptz,
 mileage integer,
 vehicle_snapshot jsonb
)
language plpgsql security definer set search_path=public
as $$
declare ws uuid; assigned_car text; fleet_payload jsonb; car_json jsonb;
begin
 ws:=public.current_workspace_id();
 if public.current_workspace_role()<>'driver' then raise exception 'Driver role required'; end if;

 select a.car_id,a.assigned_at into assigned_car,assigned_at
 from public.driver_vehicle_assignments a
 where a.workspace_id=ws and a.driver_user_id=auth.uid() and a.status='active'
 limit 1;

 if assigned_car is null then
  car_id:=null;mileage:=0;vehicle_snapshot:=null;
  return next;return;
 end if;

 select fs.payload into fleet_payload from public.fleet_states fs where fs.workspace_id=ws limit 1;
 select item into car_json
 from jsonb_array_elements(coalesce(fleet_payload->'cars','[]'::jsonb)) item
 where item->>'id'=assigned_car limit 1;

 car_id:=assigned_car;
 mileage:=coalesce((car_json->>'mileage')::integer,0);
 vehicle_snapshot:=car_json;
 return next;
end;
$$;

create or replace function public.submit_driver_repair_request(
 request_category text,
 request_urgency text,
 request_description text,
 request_mileage integer,
 dashboard_warning_value boolean
)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare ws uuid; assigned_car text; new_id uuid; driver_email text;
begin
 ws:=public.current_workspace_id();
 if public.current_workspace_role()<>'driver' then raise exception 'Driver role required'; end if;

 select a.car_id into assigned_car
 from public.driver_vehicle_assignments a
 where a.workspace_id=ws and a.driver_user_id=auth.uid()
   and a.status='active' and a.car_id is not null limit 1;

 if assigned_car is null then raise exception 'No vehicle assigned'; end if;
 if length(trim(coalesce(request_description,'')))<3 then raise exception 'Description is required'; end if;

 insert into public.driver_repair_requests(
  workspace_id,driver_user_id,car_id,category,urgency,description,mileage,dashboard_warning
 )
 values(
  ws,auth.uid(),assigned_car,request_category,request_urgency,
  trim(request_description),greatest(coalesce(request_mileage,0),0),
  coalesce(dashboard_warning_value,false)
 )
 returning id into new_id;

 select p.email into driver_email from public.profiles p where p.user_id=auth.uid();

 insert into public.workspace_notifications(
  workspace_id,recipient_role,type,title,message,entity_type,entity_id
 )
 select ws,role_name,'repair',
  case when request_urgency='critical' then '🔴 Срочная заявка на ремонт' else 'Новая заявка на ремонт' end,
  coalesce(driver_email,'Водитель')||': '||trim(request_description),
  'repair_request',new_id::text
 from (values('owner'),('coordinator'),('mechanic')) roles(role_name);

 return new_id;
end;
$$;

create or replace function public.get_my_driver_repair_requests()
returns table(
 id uuid,car_id text,category text,urgency text,description text,mileage integer,
 dashboard_warning boolean,status text,manager_comment text,created_at timestamptz,updated_at timestamptz
)
language sql security definer set search_path=public
as $$
 select r.id,r.car_id,r.category,r.urgency,r.description,r.mileage,
  r.dashboard_warning,r.status,r.manager_comment,r.created_at,r.updated_at
 from public.driver_repair_requests r
 where r.workspace_id=public.current_workspace_id()
   and r.driver_user_id=auth.uid()
 order by r.created_at desc
$$;

create or replace function public.get_workspace_driver_repair_requests()
returns table(
 id uuid,driver_user_id uuid,driver_email text,car_id text,category text,urgency text,
 description text,mileage integer,dashboard_warning boolean,status text,
 manager_comment text,created_at timestamptz,updated_at timestamptz
)
language sql security definer set search_path=public
as $$
 select r.id,r.driver_user_id,p.email,r.car_id,r.category,r.urgency,
  r.description,r.mileage,r.dashboard_warning,r.status,r.manager_comment,
  r.created_at,r.updated_at
 from public.driver_repair_requests r
 left join public.profiles p on p.user_id=r.driver_user_id
 where r.workspace_id=public.current_workspace_id()
   and public.current_workspace_role() in ('owner','coordinator','mechanic')
 order by
  case r.urgency when 'critical' then 0 when 'service' then 1 else 2 end,
  r.created_at desc
$$;

create or replace function public.update_driver_repair_request(
 request_id_value uuid,
 request_status_value text,
 manager_comment_value text default null
)
returns void
language plpgsql security definer set search_path=public
as $$
declare ws uuid; driver_id uuid; request_car text;
begin
 ws:=public.current_workspace_id();
 if public.current_workspace_role() not in ('owner','coordinator','mechanic') then
  raise exception 'Permission denied';
 end if;

 update public.driver_repair_requests r
 set status=request_status_value,
     manager_comment=coalesce(manager_comment_value,r.manager_comment),
     updated_at=now()
 where r.id=request_id_value and r.workspace_id=ws
 returning r.driver_user_id,r.car_id into driver_id,request_car;

 if driver_id is null then raise exception 'Request not found'; end if;

 insert into public.workspace_notifications(
  workspace_id,recipient_user_id,type,title,message,entity_type,entity_id
 )
 values(
  ws,driver_id,'repair','Статус заявки изменён',
  'Новый статус: '||request_status_value,
  'repair_request',request_id_value::text
 );
end;
$$;

create or replace function public.get_my_workspace_notifications()
returns table(
 id uuid,type text,title text,message text,entity_type text,entity_id text,
 read_at timestamptz,created_at timestamptz
)
language sql security definer set search_path=public
as $$
 select n.id,n.type,n.title,n.message,n.entity_type,n.entity_id,n.read_at,n.created_at
 from public.workspace_notifications n
 where n.workspace_id=public.current_workspace_id()
   and (
    n.recipient_user_id=auth.uid()
    or n.recipient_role=public.current_workspace_role()
   )
 order by n.created_at desc
 limit 50
$$;

grant execute on function public.assign_driver_vehicle(uuid,text) to authenticated;
grant execute on function public.get_workspace_driver_assignments() to authenticated;
grant execute on function public.get_driver_portal_context() to authenticated;
grant execute on function public.submit_driver_repair_request(text,text,text,integer,boolean) to authenticated;
grant execute on function public.get_my_driver_repair_requests() to authenticated;
grant execute on function public.get_workspace_driver_repair_requests() to authenticated;
grant execute on function public.update_driver_repair_request(uuid,text,text) to authenticated;
grant execute on function public.get_my_workspace_notifications() to authenticated;

notify pgrst,'reload schema';
