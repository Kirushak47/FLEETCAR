-- FleetPilot Cloud V1 — run in Supabase SQL Editor
-- IMPORTANT: replace PASTE_OWNER_EMAIL_HERE with your confirmed FleetPilot email.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user','owner')),
  created_at timestamptz not null default now()
);

create table if not exists public.fleet_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  device_name text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function public.is_fleetpilot_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role = 'owner'
  );
$$;

create or replace function public.handle_fleetpilot_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(user_id,email,role)
  values (
    new.id,
    new.email,
    case
      when lower(coalesce(new.email,'')) = lower('PASTE_OWNER_EMAIL_HERE')
      then 'owner'
      else 'user'
    end
  )
  on conflict (user_id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_fleetpilot_user_created on auth.users;
create trigger on_fleetpilot_user_created
after insert or update of email on auth.users
for each row execute procedure public.handle_fleetpilot_new_user();

-- Backfill profiles for users who registered before this SQL was run.
insert into public.profiles(user_id,email,role)
select
  id,
  email,
  case
    when lower(coalesce(email,'')) = lower('PASTE_OWNER_EMAIL_HERE')
    then 'owner'
    else 'user'
  end
from auth.users
on conflict (user_id) do update
set
  email = excluded.email,
  role = case
    when lower(coalesce(excluded.email,'')) = lower('PASTE_OWNER_EMAIL_HERE')
    then 'owner'
    else public.profiles.role
  end;

alter table public.profiles enable row level security;
alter table public.fleet_states enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
on public.profiles for select
to authenticated
using (auth.uid() = user_id or public.is_fleetpilot_owner());

drop policy if exists "Owner reads all profiles" on public.profiles;
create policy "Owner reads all profiles"
on public.profiles for select
to authenticated
using (public.is_fleetpilot_owner());

drop policy if exists "Users read own fleet" on public.fleet_states;
create policy "Users read own fleet"
on public.fleet_states for select
to authenticated
using (auth.uid() = user_id or public.is_fleetpilot_owner());

drop policy if exists "Users insert own fleet" on public.fleet_states;
create policy "Users insert own fleet"
on public.fleet_states for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users update own fleet" on public.fleet_states;
create policy "Users update own fleet"
on public.fleet_states for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users delete own fleet" on public.fleet_states;
create policy "Users delete own fleet"
on public.fleet_states for delete
to authenticated
using (auth.uid() = user_id);

grant execute on function public.is_fleetpilot_owner() to authenticated;

notify pgrst, 'reload schema';
