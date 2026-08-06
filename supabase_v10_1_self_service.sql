-- FleetPilot V10.1 — Self-Service Workspace and shared fleet state
-- Run once in Supabase SQL Editor.

alter table public.profiles
add column if not exists job_title text;

alter table public.workspaces
add column if not exists city text,
add column if not exists currency text not null default 'PLN',
add column if not exists timezone text not null default 'Europe/Warsaw';

alter table public.fleet_states
add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

-- Attach existing personal fleet rows to their current workspace.
update public.fleet_states fs
set workspace_id=wm.workspace_id
from public.workspace_members wm
where wm.user_id=fs.user_id
  and wm.status='active'
  and fs.workspace_id is null;

create unique index if not exists fleet_states_workspace_unique
on public.fleet_states(workspace_id)
where workspace_id is not null;

create or replace function public.create_my_workspace(
  company_name text,
  company_city text default null,
  job_title_value text default 'CEO'
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  new_workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if exists(
    select 1 from public.workspace_members
    where user_id=auth.uid() and status='active'
  ) then
    raise exception 'User already belongs to a workspace';
  end if;

  if length(trim(coalesce(company_name,''))) < 2 then
    raise exception 'Fleet name is required';
  end if;

  insert into public.workspaces(name,slug,created_by,city)
  values(
    trim(company_name),
    'fleet-' || substr(replace(gen_random_uuid()::text,'-',''),1,16),
    auth.uid(),
    nullif(trim(company_city),'')
  )
  returning id into new_workspace_id;

  insert into public.workspace_members(workspace_id,user_id,role,city,status)
  values(new_workspace_id,auth.uid(),'owner',nullif(trim(company_city),''),'active');

  update public.profiles
  set role='owner',job_title=nullif(trim(job_title_value),'')
  where user_id=auth.uid();

  return new_workspace_id;
end;
$$;

create or replace function public.get_my_pending_workspace_invite()
returns table(
  invite_id uuid,
  workspace_id uuid,
  workspace_name text,
  role text,
  city text,
  expires_at timestamptz
)
language sql
security definer
set search_path=public
as $$
 select i.id,i.workspace_id,w.name,i.role,i.city,i.expires_at
 from public.workspace_invites i
 join public.workspaces w on w.id=i.workspace_id
 join auth.users u on u.id=auth.uid()
 where lower(i.email)=lower(u.email)
   and i.status='pending'
   and i.expires_at>now()
 order by i.created_at desc
 limit 1
$$;

create or replace function public.accept_my_workspace_invite()
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  inv public.workspace_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if exists(
    select 1 from public.workspace_members
    where user_id=auth.uid() and status='active'
  ) then
    raise exception 'User already belongs to a workspace';
  end if;

  select i.* into inv
  from public.workspace_invites i
  join auth.users u on u.id=auth.uid()
  where lower(i.email)=lower(u.email)
    and i.status='pending'
    and i.expires_at>now()
  order by i.created_at desc
  limit 1;

  if inv.id is null then
    raise exception 'No active invitation found';
  end if;

  insert into public.workspace_members(workspace_id,user_id,role,city,status)
  values(inv.workspace_id,auth.uid(),inv.role,inv.city,'active');

  update public.workspace_invites set status='accepted' where id=inv.id;
  update public.profiles set role=inv.role where user_id=auth.uid();

  return inv.workspace_id;
end;
$$;

create or replace function public.platform_workspace_overview()
returns table(
  workspace_id uuid,
  workspace_name text,
  owner_email text,
  members_count bigint,
  cars_count integer,
  last_activity timestamptz,
  created_at timestamptz
)
language sql
security definer
set search_path=public
as $$
 select
  w.id,
  w.name,
  (
   select p.email
   from public.workspace_members wm
   join public.profiles p on p.user_id=wm.user_id
   where wm.workspace_id=w.id and wm.role='owner' and wm.status='active'
   order by wm.created_at
   limit 1
  ),
  (
   select count(*)
   from public.workspace_members wm
   where wm.workspace_id=w.id and wm.status='active'
  ),
  coalesce(jsonb_array_length(coalesce(fs.payload->'cars','[]'::jsonb)),0),
  fs.updated_at,
  w.created_at
 from public.workspaces w
 left join public.fleet_states fs on fs.workspace_id=w.id
 where exists(
  select 1 from public.platform_admins pa where pa.user_id=auth.uid()
 )
 order by w.created_at desc
$$;

drop policy if exists "Users read own fleet" on public.fleet_states;
drop policy if exists "Users insert own fleet" on public.fleet_states;
drop policy if exists "Users update own fleet" on public.fleet_states;
drop policy if exists "Users delete own fleet" on public.fleet_states;
drop policy if exists "Workspace members read fleet" on public.fleet_states;
drop policy if exists "Workspace managers insert fleet" on public.fleet_states;
drop policy if exists "Workspace managers update fleet" on public.fleet_states;

create policy "Workspace members read fleet"
on public.fleet_states for select to authenticated
using(
 workspace_id=public.current_workspace_id()
);

create policy "Workspace managers insert fleet"
on public.fleet_states for insert to authenticated
with check(
 workspace_id=public.current_workspace_id()
 and public.current_workspace_role() in ('owner','coordinator')
);

create policy "Workspace managers update fleet"
on public.fleet_states for update to authenticated
using(
 workspace_id=public.current_workspace_id()
 and public.current_workspace_role() in ('owner','coordinator')
)
with check(
 workspace_id=public.current_workspace_id()
 and public.current_workspace_role() in ('owner','coordinator')
);

grant execute on function public.create_my_workspace(text,text,text) to authenticated;
grant execute on function public.get_my_pending_workspace_invite() to authenticated;
grant execute on function public.accept_my_workspace_invite() to authenticated;
grant execute on function public.platform_workspace_overview() to authenticated;

notify pgrst,'reload schema';
