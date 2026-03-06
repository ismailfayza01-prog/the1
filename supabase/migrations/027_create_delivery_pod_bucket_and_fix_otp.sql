-- Create delivery-pod storage bucket (if not exists) and add missing pod_otp_verified_at column

-- 1) Create delivery-pod bucket via storage API
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'delivery-pod',
  'delivery-pod',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- 2) Add pod_otp_verified_at column if missing
alter table public.deliveries
  add column if not exists pod_otp_verified_at timestamptz;

-- 3) Update verify_delivery_otp to also set pod_otp_verified_at
create or replace function public.verify_delivery_otp(p_delivery_id uuid, p_otp text)
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

  if delivery_row.otp_expires_at is null or delivery_row.otp_expires_at < now() then
    raise exception 'OTP expired';
  end if;

  if delivery_row.otp_code is null or delivery_row.otp_code <> crypt(p_otp, delivery_row.otp_code) then
    raise exception 'Invalid OTP';
  end if;

  perform set_config('app.pod_rpc','1',true);

  update public.deliveries
  set otp_verified = true,
      pod_method = 'otp',
      pod_otp_verified_at = now(),
      delivered_at = now(),
      completed_at = now(),
      status = 'delivered'
  where id = p_delivery_id
  returning * into delivery_row;

  return delivery_row;
end;
$$;

-- Grant execute permission
grant execute on function public.verify_delivery_otp(uuid, text) to authenticated;
grant execute on function public.set_delivery_otp(uuid, text) to authenticated;
grant execute on function public.submit_delivery_photo(uuid, text) to authenticated;
