alter table public.driver_repair_requests
add column if not exists linked_repair_id text,
add column if not exists repair_started_at timestamptz,
add column if not exists repair_completed_at timestamptz;

create or replace function public.link_driver_request_repair(request_id_value uuid,linked_repair_id_value text,request_status_value text,manager_comment_value text default null)
returns void language plpgsql security definer set search_path=public as $$
declare ws uuid;driver_id uuid;
begin
 ws:=public.current_workspace_id();
 if public.current_workspace_role() not in ('owner','coordinator','mechanic') then raise exception 'Permission denied'; end if;
 update public.driver_repair_requests r set linked_repair_id=linked_repair_id_value,status=request_status_value,manager_comment=coalesce(manager_comment_value,r.manager_comment),repair_started_at=case when request_status_value='repair' then coalesce(r.repair_started_at,now()) else r.repair_started_at end,repair_completed_at=case when request_status_value='done' then now() else r.repair_completed_at end,updated_at=now()
 where r.id=request_id_value and r.workspace_id=ws returning r.driver_user_id into driver_id;
 if driver_id is null then raise exception 'Request not found'; end if;
 insert into public.workspace_notifications(workspace_id,recipient_user_id,type,title,message,entity_type,entity_id)
 values(ws,driver_id,'repair',case when request_status_value='done' then 'Ремонт завершён' else 'Автомобиль передан в ремонт' end,coalesce(manager_comment_value,'Статус заявки обновлён'),'repair_request',request_id_value::text);
end;$$;
grant execute on function public.link_driver_request_repair(uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';
