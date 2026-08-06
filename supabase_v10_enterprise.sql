-- FleetPilot V10 Enterprise Foundation
-- Run once in Supabase SQL Editor after previous Cloud migrations.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'driver'
    check (role in ('owner','coordinator','accountant','mechanic','driver')),
  city text,
  status text not null default 'active'
    check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  primary key(workspace_id,user_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null
    check (role in ('owner','coordinator','accountant','mechanic','driver')),
  city text,
  status text not null default 'pending'
    check (status in ('pending','accepted','cancelled','expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create unique index if not exists workspace_invites_pending_email_idx
on public.workspace_invites(workspace_id,lower(email))
where status='pending';

create or replace function public.current_workspace_id()
returns uuid
language sql stable security definer set search_path=public
as $$
 select workspace_id
 from public.workspace_members
 where user_id=auth.uid() and status='active'
 order by created_at limit 1
$$;

create or replace function public.current_workspace_role()
returns text
language sql stable security definer set search_path=public
as $$
 select role
 from public.workspace_members
 where user_id=auth.uid() and status='active'
 order by created_at limit 1
$$;

create or replace function public.is_workspace_owner(target_workspace uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
 select exists(
  select 1 from public.workspace_members
  where workspace_id=target_workspace
    and user_id=auth.uid()
    and role='owner'
    and status='active'
 )
$$;

-- Create one workspace for every existing standalone user.
insert into public.workspaces(id,name,slug,created_by)
select
 gen_random_uuid(),
 coalesce(nullif(split_part(u.email,'@',1),''),'Fleet') || ' Workspace',
 'fleet-' || substr(replace(u.id::text,'-',''),1,12),
 u.id
from auth.users u
where not exists(
 select 1 from public.workspace_members wm where wm.user_id=u.id
);

insert into public.workspace_members(workspace_id,user_id,role,status)
select w.id,w.created_by,'owner','active'
from public.workspaces w
where not exists(
 select 1 from public.workspace_members wm
 where wm.workspace_id=w.id and wm.user_id=w.created_by
);

-- Keep profile role compatible.
update public.profiles p
set role='owner'
where exists(
 select 1 from public.workspace_members wm
 where wm.user_id=p.user_id and wm.role='owner'
);

create or replace function public.accept_workspace_invite()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare inv public.workspace_invites%rowtype;
begin
 select * into inv
 from public.workspace_invites
 where lower(email)=lower(new.email)
   and status='pending'
   and expires_at>now()
 order by created_at desc
 limit 1;

 if inv.id is not null then
  insert into public.workspace_members(workspace_id,user_id,role,city,status)
  values(inv.workspace_id,new.id,inv.role,inv.city,'active')
  on conflict(workspace_id,user_id) do update
  set role=excluded.role,city=excluded.city,status='active';

  update public.workspace_invites
  set status='accepted'
  where id=inv.id;
 end if;

 return new;
end;
$$;

drop trigger if exists on_fleetpilot_workspace_invite_accept on auth.users;
create trigger on_fleetpilot_workspace_invite_accept
after insert or update of email on auth.users
for each row execute procedure public.accept_workspace_invite();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

drop policy if exists "Members read workspace" on public.workspaces;
create policy "Members read workspace"
on public.workspaces for select to authenticated
using(exists(
 select 1 from public.workspace_members wm
 where wm.workspace_id=id and wm.user_id=auth.uid() and wm.status='active'
));

drop policy if exists "Owners update workspace" on public.workspaces;
create policy "Owners update workspace"
on public.workspaces for update to authenticated
using(public.is_workspace_owner(id))
with check(public.is_workspace_owner(id));

drop policy if exists "Members read members" on public.workspace_members;
create policy "Members read members"
on public.workspace_members for select to authenticated
using(workspace_id=public.current_workspace_id());

drop policy if exists "Owners manage members" on public.workspace_members;
create policy "Owners manage members"
on public.workspace_members for update to authenticated
using(public.is_workspace_owner(workspace_id))
with check(public.is_workspace_owner(workspace_id));

drop policy if exists "Members read profiles" on public.profiles;
create policy "Members read profiles"
on public.profiles for select to authenticated
using(
 user_id=auth.uid()
 or exists(
  select 1
  from public.workspace_members mine
  join public.workspace_members theirs on theirs.workspace_id=mine.workspace_id
  where mine.user_id=auth.uid()
    and theirs.user_id=profiles.user_id
    and mine.status='active'
 )
);

drop policy if exists "Owners read invites" on public.workspace_invites;
create policy "Owners read invites"
on public.workspace_invites for select to authenticated
using(public.is_workspace_owner(workspace_id));

drop policy if exists "Owners create invites" on public.workspace_invites;
create policy "Owners create invites"
on public.workspace_invites for insert to authenticated
with check(public.is_workspace_owner(workspace_id) and invited_by=auth.uid());

drop policy if exists "Owners update invites" on public.workspace_invites;
create policy "Owners update invites"
on public.workspace_invites for update to authenticated
using(public.is_workspace_owner(workspace_id))
with check(public.is_workspace_owner(workspace_id));

grant execute on function public.current_workspace_id() to authenticated;
grant execute on function public.current_workspace_role() to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

notify pgrst,'reload schema';
