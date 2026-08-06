-- FleetPilot V10.3.1 — Role ambiguity and startup data fix
-- Run once in Supabase SQL Editor.

drop function if exists public.get_workspace_role_permissions();

create function public.get_workspace_role_permissions()
returns table(
  permission_role text,
  permission_name text,
  permission_allowed boolean
)
language plpgsql
security definer
set search_path=public
as $$
declare
  current_ws uuid;
  role_row record;
  permission_row record;
begin
  current_ws:=public.current_workspace_id();

  if current_ws is null then
    raise exception 'Workspace membership required';
  end if;

  for role_row in
    select role_name
    from (values
      ('coordinator'::text),
      ('accountant'::text),
      ('mechanic'::text),
      ('driver'::text)
    ) as available_roles(role_name)
  loop
    for permission_row in
      select permission_key,permission_value
      from jsonb_each(public.default_role_permissions(role_row.role_name))
           as defaults(permission_key,permission_value)
    loop
      insert into public.workspace_role_permissions(
        workspace_id,
        role,
        permission,
        allowed
      )
      values(
        current_ws,
        role_row.role_name,
        permission_row.permission_key,
        (permission_row.permission_value)::boolean
      )
      on conflict(workspace_id,role,permission) do nothing;
    end loop;
  end loop;

  return query
  select
    wrp.role as permission_role,
    wrp.permission as permission_name,
    wrp.allowed as permission_allowed
  from public.workspace_role_permissions as wrp
  where wrp.workspace_id=current_ws
  order by wrp.role,wrp.permission;
end;
$$;

grant execute on function public.get_workspace_role_permissions() to authenticated;

notify pgrst,'reload schema';
