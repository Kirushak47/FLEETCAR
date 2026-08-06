-- FleetPilot V11.2 — Vehicle alerts and driver service plan
-- Execute after V11.1.

create or replace function public.get_driver_service_feed()
returns table(
 id text,
 car_id text,
 title text,
 date date,
 status text,
 note text,
 mileage integer,
 planned numeric,
 actual numeric,
 updated_at timestamptz
)
language sql
security definer
set search_path=public
as $$
 with assigned as (
  select a.car_id
  from public.driver_vehicle_assignments a
  where a.workspace_id=public.current_workspace_id()
    and a.driver_user_id=auth.uid()
    and a.status='active'
    and a.car_id is not null
  limit 1
 ),
 repairs as (
  select jsonb_array_elements(coalesce(fs.payload->'repairs','[]'::jsonb)) item,
         fs.updated_at
  from public.fleet_states fs
  where fs.workspace_id=public.current_workspace_id()
 )
 select
  r.item->>'id',
  r.item->>'carId',
  coalesce(r.item->>'title','Сервис'),
  nullif(r.item->>'date','')::date,
  coalesce(r.item->>'status','planned'),
  r.item->>'note',
  coalesce(nullif(r.item->>'mileage','')::integer,0),
  coalesce(nullif(r.item->>'planned','')::numeric,0),
  coalesce(nullif(r.item->>'actual','')::numeric,0),
  r.updated_at
 from repairs r,assigned a
 where r.item->>'carId'=a.car_id
   and coalesce(r.item->>'status','planned')<>'cancelled'
 order by
  case when coalesce(r.item->>'status','planned')='done' then 1 else 0 end,
  nullif(r.item->>'date','')::date nulls last,
  r.updated_at desc
 limit 50
$$;

create or replace function public.notify_assigned_driver_service(
 car_id_value text,
 repair_id_value text,
 repair_title_value text,
 repair_date_value date,
 repair_status_value text,
 repair_note_value text default null,
 repair_mileage_value integer default 0
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
 ws uuid:=public.current_workspace_id();
 driver_id uuid;
 notification_id uuid;
 existing_id uuid;
 status_title text;
begin
 if public.current_workspace_role() not in ('owner','coordinator','mechanic') then
  raise exception 'Permission denied';
 end if;

 select a.driver_user_id into driver_id
 from public.driver_vehicle_assignments a
 where a.workspace_id=ws
   and a.car_id=car_id_value
   and a.status='active'
 limit 1;

 if driver_id is null then return null; end if;

 status_title:=case repair_status_value
  when 'planned' then 'Запланирован сервис'
  when 'service' then 'Автомобиль записан в сервис'
  when 'parts' then 'Ожидаются запчасти'
  when 'repair' then 'Автомобиль в ремонте'
  when 'done' then 'Сервис завершён'
  else 'Обновление сервиса'
 end;

 select n.id into existing_id
 from public.workspace_notifications n
 where n.workspace_id=ws
   and n.recipient_user_id=driver_id
   and n.entity_type='repair'
   and n.entity_id=repair_id_value
 order by n.created_at desc
 limit 1;

 if existing_id is not null then
  update public.workspace_notifications
  set title=status_title,
      message=concat_ws(' · ',
        repair_title_value,
        case when repair_date_value is not null then to_char(repair_date_value,'DD.MM.YYYY') end,
        case when repair_mileage_value>0 then repair_mileage_value||' км' end,
        repair_note_value
      ),
      read_at=null,
      created_at=now()
  where id=existing_id
  returning id into notification_id;
 else
  insert into public.workspace_notifications(
   workspace_id,recipient_user_id,type,title,message,entity_type,entity_id
  ) values(
   ws,driver_id,'repair',status_title,
   concat_ws(' · ',
    repair_title_value,
    case when repair_date_value is not null then to_char(repair_date_value,'DD.MM.YYYY') end,
    case when repair_mileage_value>0 then repair_mileage_value||' км' end,
    repair_note_value
   ),
   'repair',repair_id_value
  ) returning id into notification_id;
 end if;

 return notification_id;
end;
$$;

grant execute on function public.get_driver_service_feed() to authenticated;
grant execute on function public.notify_assigned_driver_service(text,text,text,date,text,text,integer) to authenticated;
notify pgrst,'reload schema';
