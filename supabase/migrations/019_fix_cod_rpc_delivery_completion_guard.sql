-- Allow COD RPC to pass unified completion guard that also checks pod flag.
create or replace function public.mark_cod_collected(p_delivery_id uuid, p_amount_mad numeric)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  delivery_row public.deliveries;
  rider_row public.riders;
begin
  if p_amount_mad is null or p_amount_mad <= 0 then
    raise exception 'COD amount must be greater than 0';
  end if;

  select * into rider_row
  from public.riders
  where user_id = auth.uid();

  if not found then
    raise exception 'Not a rider';
  end if;

  select * into delivery_row
  from public.deliveries
  where id = p_delivery_id
    and rider_id = rider_row.id
    and payment_method = 'cod'
    and status in ('accepted','picked_up','in_transit');

  if not found then
    raise exception 'Not authorized or invalid delivery';
  end if;

  if delivery_row.price is not null and p_amount_mad > delivery_row.price then
    raise exception 'COD amount exceeds delivery price';
  end if;

  perform set_config('app.cod_rpc','1',true);
  perform set_config('app.pod_rpc','1',true);

  update public.deliveries
  set cod_amount_mad = p_amount_mad,
      cod_collected_at = now(),
      cod_collected_by_rider_id = rider_row.id,
      delivered_at = now(),
      status = 'delivered'
  where id = p_delivery_id
  returning * into delivery_row;

  return delivery_row;
end;
$$;
