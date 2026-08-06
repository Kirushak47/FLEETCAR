-- FleetPilot V11.3 — Core Repair and unified mileage
-- Execute after V11.2.

create or replace function public.update_vehicle_mileage_by_staff(
 car_id_value text,
 mileage_value integer,
 source_value text default 'service'
)
returns table(
 car_id text,
 old_mileage integer,
 new_mileage integer,
 event_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
declare
 ws uuid:=public.current_workspace_id();
 current_mileage integer:=0;
 server_now timestamptz:=now();
begin
 if public.current_workspace_role() not in ('owner','coordinator','mechanic') then
  raise exception 'Permission denied';
 end if;

 select coalesce((item->>'mileage')::integer,0)
 into current_mileage
 from public.fleet_states fs
 cross join lateral jsonb_array_elements(coalesce(fs.payload->'cars','[]'::jsonb)) item
 where fs.workspace_id=ws and item->>'id'=car_id_value
 limit 1;

 if not found then raise exception 'Vehicle not found'; end if;
 if mileage_value<current_mileage then
  raise exception 'Mileage cannot be lower than current mileage (%)',current_mileage;
 end if;

 if mileage_value>current_mileage then
  perform public.patch_workspace_car_state(ws,car_id_value,mileage_value,null,null,false);

  -- patch_workspace_car_state already writes server history in V11.1.
  update public.vehicle_mileage_history
  set source=coalesce(nullif(source_value,''),'service')
  where id=(
   select id from public.vehicle_mileage_history
   where workspace_id=ws and car_id=car_id_value
     and new_mileage=mileage_value and changed_by=auth.uid()
   order by created_at desc limit 1
  );
 end if;

 return query select car_id_value,current_mileage,mileage_value,server_now;
end;
$$;

grant execute on function public.update_vehicle_mileage_by_staff(text,integer,text) to authenticated;
notify pgrst,'reload schema';
