-- Run once in Supabase SQL Editor.
update public.profiles
set role = 'owner', email = 'balyshevy@gmail.com'
where lower(email) = 'balyshevy@gmail.com';

insert into public.profiles(user_id,email,role)
select id,email,'owner'
from auth.users
where lower(email)='balyshevy@gmail.com'
on conflict (user_id) do update
set email=excluded.email, role='owner';

notify pgrst, 'reload schema';
