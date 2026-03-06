-- Enforce PoD method by delivery context:
-- if OTP is set for a delivery, rider must complete with OTP (photo completion blocked).

create or replace function public.submit_delivery_photo(p_delivery_id uuid, p_photo_url text)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  delivery_row public.deliveries;
  rider_row public.riders;
begin
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
    and status in ('accepted','picked_up','in_transit');

  if not found then
    raise exception 'Not authorized or invalid delivery status';
  end if;

  if delivery_row.otp_code is not null and coalesce(delivery_row.otp_verified, false) = false then
    raise exception 'OTP verification required for this delivery';
  end if;

  perform set_config('app.pod_rpc','1',true);

  update public.deliveries
  set pod_method = 'photo',
      pod_photo_url = p_photo_url,
      delivered_at = now(),
      status = 'delivered'
  where id = p_delivery_id
  returning * into delivery_row;

  return delivery_row;
end;
$$;
