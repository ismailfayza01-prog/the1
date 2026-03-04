-- Ensure pgcrypto functions resolve inside SECURITY DEFINER PoD RPCs.
create extension if not exists pgcrypto;

create or replace function public.set_delivery_otp(p_delivery_id uuid, p_otp text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  delivery_row public.deliveries;
  is_admin boolean := false;
  otp_hash text;
  expires_at timestamptz;
begin
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) into is_admin;

  select d.* into delivery_row
  from public.deliveries d
  join public.businesses b on b.id = d.business_id
  where d.id = p_delivery_id
    and (b.user_id = auth.uid() or is_admin);

  if not found then
    raise exception 'Not authorized or delivery not found';
  end if;

  otp_hash := extensions.crypt(p_otp, extensions.gen_salt('bf'));
  expires_at := now() + interval '15 minutes';

  perform set_config('app.pod_rpc','1',true);

  update public.deliveries
  set otp_code = otp_hash,
      otp_expires_at = expires_at,
      otp_verified = false
  where id = p_delivery_id;

  return jsonb_build_object(
    'delivery_id', p_delivery_id,
    'expires_at', expires_at
  );
end;
$$;

create or replace function public.verify_delivery_otp(p_delivery_id uuid, p_otp text)
returns public.deliveries
language plpgsql
security definer
set search_path = public, extensions
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

  if delivery_row.otp_expires_at is null or delivery_row.otp_expires_at < now() then
    raise exception 'OTP expired';
  end if;

  if delivery_row.otp_code is null or delivery_row.otp_code <> extensions.crypt(p_otp, delivery_row.otp_code) then
    raise exception 'Invalid OTP';
  end if;

  perform set_config('app.pod_rpc','1',true);

  update public.deliveries
  set otp_verified = true,
      pod_method = 'otp',
      delivered_at = now(),
      status = 'delivered'
  where id = p_delivery_id
  returning * into delivery_row;

  return delivery_row;
end;
$$;
