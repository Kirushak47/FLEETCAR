-- FleetPilot V10.3 — Company Management
-- Run once in Supabase SQL Editor.

alter table public.workspaces
add column if not exists city text,
add column if not exists currency text not null default 'PLN',
add column if not exists timezone text not null default 'Europe/Warsaw';

create table if not exists public.workspace_role_permissions(
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null check(role in ('coordinator','accountant','mechanic','driver')),
  permission text not null,
  allowed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(workspace_id,role,permission)
);

create table if not exists public.workspace_activity_log(
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.workspace_role_permissions enable row level security;
alter table public.workspace_activity_log enable row level security;

create or replace function public.default_role_permissions(target_role text)
returns jsonb
language plpgsql immutable
as $$
begin
 return case target_role
  when 'coordinator' then '{
   "cars.view":true,"cars.create":true,"cars.edit":true,"cars.delete":false,
   "cars.assign":true,"cars.mileage":true,"finance.view":false,
   "finance.expenses":false,"finance.payments":false,"finance.analytics":false,
   "service.view":true,"service.create":true,"service.edit":true,"service.photos":true,
   "documents.view":true,"documents.create":true,"documents.delete":false,
   "documents.contracts":true,"company.team":true,"company.invite":false,
   "company.roles":false,"company.permissions":false,"driver.portal":false,
   "driver.tasks":false,"driver.photos":false,"driver.protocols":false}'::jsonb
  when 'accountant' then '{
   "cars.view":true,"cars.create":false,"cars.edit":false,"cars.delete":false,
   "cars.assign":false,"cars.mileage":false,"finance.view":true,
   "finance.expenses":true,"finance.payments":true,"finance.analytics":true,
   "service.view":false,"service.create":false,"service.edit":false,"service.photos":false,
   "documents.view":true,"documents.create":true,"documents.delete":false,
   "documents.contracts":true,"company.team":false,"company.invite":false,
   "company.roles":false,"company.permissions":false,"driver.portal":false,
   "driver.tasks":false,"driver.photos":false,"driver.protocols":false}'::jsonb
  when 'mechanic' then '{
   "cars.view":true,"cars.create":false,"cars.edit":false,"cars.delete":false,
   "cars.assign":false,"cars.mileage":true,"finance.view":false,
   "finance.expenses":false,"finance.payments":false,"finance.analytics":false,
   "service.view":true,"service.create":true,"service.edit":true,"service.photos":true,
   "documents.view":true,"documents.create":true,"documents.delete":false,
   "documents.contracts":false,"company.team":false,"company.invite":false,
   "company.roles":false,"company.permissions":false,"driver.portal":false,
   "driver.tasks":false,"driver.photos":false,"driver.protocols":false}'::jsonb
  else '{
   "cars.view":false,"cars.create":false,"cars.edit":false,"cars.delete":false,
   "cars.assign":false,"cars.mileage":false,"finance.view":false,
   "finance.expenses":false,"finance.payments":false,"finance.analytics":false,
   "service.view":false,"service.create":false,"service.edit":false,"service.photos":false,
   "documents.view":true,"documents.create":false,"documents.delete":false,
   "documents.contracts":true,"company.team":false,"company.invite":false,
   "company.roles":false,"company.permissions":false,"driver.portal":true,
   "driver.tasks":true,"driver.photos":true,"driver.protocols":true}'::jsonb
 end;
end;
$$;

create or replace function public.get_workspace_role_permissions()
returns table(role text,permission text,allowed boolean)
language plpgsql security definer set search_path=public
as $$
declare ws uuid;
begin
 ws:=public.current_workspace_id();
 if ws is null then raise exception 'Workspace membership required'; end if;

 insert into public.workspace_role_permissions(workspace_id,role,permission,allowed)
 select ws,r.role,p.key,(p.value)::boolean
 from (values('coordinator'),('accountant'),('mechanic'),('driver')) r(role)
 cross join lateral jsonb_each(public.default_role_permissions(r.role)) p
 on conflict(workspace_id,role,permission) do nothing;

 return query
 select wrp.role,wrp.permission,wrp.allowed
 from public.workspace_role_permissions wrp
 where wrp.workspace_id=ws
 order by wrp.role,wrp.permission;
end;
$$;

create or replace function public.save_workspace_role_permissions(
 target_role text,
 permission_values jsonb
)
returns void
language plpgsql security definer set search_path=public
as $$
declare ws uuid; item record;
begin
 ws:=public.current_workspace_id();
 if public.current_workspace_role()<>'owner' then raise exception 'Only owner can manage permissions'; end if;
 if target_role not in ('coordinator','accountant','mechanic','driver') then raise exception 'Invalid role'; end if;

 for item in select key,value from jsonb_each(permission_values)
 loop
  insert into public.workspace_role_permissions(workspace_id,role,permission,allowed,updated_at)
  values(ws,target_role,item.key,(item.value)::boolean,now())
  on conflict(workspace_id,role,permission)
  do update set allowed=excluded.allowed,updated_at=now();
 end loop;

 insert into public.workspace_activity_log(workspace_id,actor_user_id,action,entity_type,entity_id,details)
 values(ws,auth.uid(),'Изменены права роли','role',target_role,permission_values);
end;
$$;

create or replace function public.reset_workspace_role_permissions(target_role text)
returns void
language plpgsql security definer set search_path=public
as $$
declare ws uuid;
begin
 ws:=public.current_workspace_id();
 if public.current_workspace_role()<>'owner' then raise exception 'Only owner can manage permissions'; end if;
 delete from public.workspace_role_permissions where workspace_id=ws and role=target_role;
 perform public.get_workspace_role_permissions();
end;
$$;

create or replace function public.update_workspace_settings(
 workspace_name text,
 workspace_city text,
 workspace_currency text,
 workspace_timezone text
)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare ws uuid;
begin
 ws:=public.current_workspace_id();
 if public.current_workspace_role()<>'owner' then raise exception 'Only owner can update workspace'; end if;
 if length(trim(coalesce(workspace_name,'')))<2 then raise exception 'Workspace name is required'; end if;

 update public.workspaces
 set name=trim(workspace_name),
     city=nullif(trim(workspace_city),''),
     currency=coalesce(nullif(trim(workspace_currency),''),'PLN'),
     timezone=coalesce(nullif(trim(workspace_timezone),''),'Europe/Warsaw')
 where id=ws;

 insert into public.workspace_activity_log(workspace_id,actor_user_id,action,entity_type,entity_id)
 values(ws,auth.uid(),'Изменены настройки компании','workspace',ws::text);
 return ws;
end;
$$;

create or replace function public.log_workspace_activity(
 action_name text,
 entity_type_value text default null,
 entity_id_value text default null,
 details_value jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path=public
as $$
declare ws uuid;
begin
 ws:=public.current_workspace_id();
 if ws is null then return; end if;
 insert into public.workspace_activity_log(workspace_id,actor_user_id,action,entity_type,entity_id,details)
 values(ws,auth.uid(),action_name,entity_type_value,entity_id_value,coalesce(details_value,'{}'::jsonb));
end;
$$;

create or replace function public.get_workspace_activity_log()
returns table(
 id bigint,actor_email text,action text,entity_type text,entity_id text,details jsonb,created_at timestamptz
)
language sql security definer set search_path=public
as $$
 select l.id,p.email,l.action,l.entity_type,l.entity_id,l.details,l.created_at
 from public.workspace_activity_log l
 left join public.profiles p on p.user_id=l.actor_user_id
 where l.workspace_id=public.current_workspace_id()
 order by l.created_at desc
 limit 200
$$;

drop policy if exists "Members read permissions" on public.workspace_role_permissions;
create policy "Members read permissions"
on public.workspace_role_permissions for select to authenticated
using(workspace_id=public.current_workspace_id());

drop policy if exists "Owners manage permissions" on public.workspace_role_permissions;
create policy "Owners manage permissions"
on public.workspace_role_permissions for all to authenticated
using(workspace_id=public.current_workspace_id() and public.current_workspace_role()='owner')
with check(workspace_id=public.current_workspace_id() and public.current_workspace_role()='owner');

drop policy if exists "Members read activity" on public.workspace_activity_log;
create policy "Members read activity"
on public.workspace_activity_log for select to authenticated
using(workspace_id=public.current_workspace_id());

grant execute on function public.get_workspace_role_permissions() to authenticated;
grant execute on function public.save_workspace_role_permissions(text,jsonb) to authenticated;
grant execute on function public.reset_workspace_role_permissions(text) to authenticated;
grant execute on function public.update_workspace_settings(text,text,text,text) to authenticated;
grant execute on function public.log_workspace_activity(text,text,text,jsonb) to authenticated;
grant execute on function public.get_workspace_activity_log() to authenticated;

notify pgrst,'reload schema';
