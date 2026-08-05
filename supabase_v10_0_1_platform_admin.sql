-- FleetPilot V10.0.1 — Multi-tenant platform admin separation
-- Run once in Supabase SQL Editor.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

drop policy if exists "Platform admins read own status" on public.platform_admins;
create policy "Platform admins read own status"
on public.platform_admins
for select
to authenticated
using (user_id = auth.uid());

-- Insert YOUR FleetPilot platform-admin account.
-- Replace the email below with your actual platform-admin email if needed.
insert into public.platform_admins (user_id)
select id
from auth.users
where lower(email) = 'balyshevy@gmail.com'
on conflict (user_id) do nothing;

-- Safety: workspace owners cannot change their own role or disable themselves through RPC.
create or replace function public.safe_update_workspace_member(
  target_user_id uuid,
  new_role text default null,
  new_city text default null,
  new_status text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ws uuid;
  caller_role text;
  owner_count integer;
begin
  ws := public.current_workspace_id();
  caller_role := public.current_workspace_role();

  if ws is null or caller_role <> 'owner' then
    raise exception 'Only workspace owner can manage members';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'You cannot change your own role or status';
  end if;

  if new_role is not null and new_role not in ('owner','coordinator','accountant','mechanic','driver') then
    raise exception 'Invalid role';
  end if;

  if new_status is not null and new_status not in ('active','disabled') then
    raise exception 'Invalid status';
  end if;

  if exists(
    select 1 from public.workspace_members
    where workspace_id = ws
      and user_id = target_user_id
      and role = 'owner'
      and status = 'active'
  ) and (
    coalesce(new_role,'owner') <> 'owner'
    or coalesce(new_status,'active') <> 'active'
  ) then
    select count(*) into owner_count
    from public.workspace_members
    where workspace_id = ws
      and role = 'owner'
      and status = 'active';

    if owner_count <= 1 then
      raise exception 'Workspace must have at least one active owner';
    end if;
  end if;

  update public.workspace_members
  set
    role = coalesce(new_role, role),
    city = case when new_city is null then city else nullif(trim(new_city),'') end,
    status = coalesce(new_status, status)
  where workspace_id = ws
    and user_id = target_user_id;
end;
$$;

grant execute on function public.safe_update_workspace_member(uuid,text,text,text) to authenticated;

notify pgrst, 'reload schema';
