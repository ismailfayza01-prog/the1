-- ============================================
-- P0-6 Proof of Delivery (PoD) DB/RLS (v2)
-- ============================================

-- 0) Extensions
create extension if not exists pgcrypto;

-- 1) Schema: deliveries PoD fields
alter table public.deliveries
  add column if not exists delivered_at timestamptz,
  add column if not exists pod_method text check (pod_method in ('otp','photo')),
  add column if not exists pod_photo_url text,
  add column if not exists otp_code text,
  add column if not exists otp_verified boolean not null default false,
  add column if not exists otp_expires_at timestamptz;

-- 2) Trigger: enforce PoD updates via RPC + immutability after delivered
create or replace function public.enforce_pod_update_rules()
returns trigger as $$
declare
  pod_rpc_flag text := current_setting('app.pod_rpc', true);
  pod_changed boolean;
  delivered_transition boolean;
begin
  pod_changed :=
    (new.pod_method is distinct from old.pod_method)
    or (new.pod_photo_url is distinct from old.pod_photo_url)
    or (new.otp_code is distinct from old.otp_code)
    or (new.otp_verified is distinct from old.otp_verified)
    or (new.otp_expires_at is distinct from old.otp_expires_at)
    or (new.delivered_at is distinct from old.delivered_at);

  delivered_transition :=
    (new.status is distinct from old.status and new.status = 'delivered');

  -- Immutability after delivered
  if (old.status = 'delivered' or old.delivered_at is not null) then
    if pod_changed or delivered_transition then
      raise exception 'PoD is immutable after delivery';
    end if;
    return new;
  end if;

  -- Guard: PoD changes or status->delivered must come from RPC
  if (pod_changed or delivered_transition) then
    if pod_rpc_flag is distinct from '1' then
      raise exception 'PoD updates must be performed via RPC';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_pod_update_rules on public.deliveries;
create trigger trg_enforce_pod_update_rules
before update on public.deliveries
for each row execute function public.enforce_pod_update_rules();

-- 3) RPC: set_delivery_otp (business/admin only)
create or replace function public.set_delivery_otp(p_delivery_id uuid, p_otp text)
returns jsonb
language plpgsql
security definer
set search_path = public
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

  otp_hash := crypt(p_otp, gen_salt('bf'));
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

-- 4) RPC: verify_delivery_otp (assigned rider only)
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
      delivered_at = now(),
      status = 'delivered'
  where id = p_delivery_id
  returning * into delivery_row;

  return delivery_row;
end;
$$;

-- 5) RPC: submit_delivery_photo (assigned rider only)
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

-- 6) Storage policies for delivery-pod bucket (private)
-- Object name: "<delivery_id>/<uuid>.jpg"

alter table storage.objects enable row level security;

drop policy if exists "Rider can upload PoD photo" on storage.objects;
create policy "Rider can upload PoD photo"
on storage.objects for insert
with check (
  bucket_id = 'delivery-pod'
  and exists (
    select 1
    from public.deliveries d
    join public.riders r on r.id = d.rider_id
    where r.user_id = auth.uid()
      and d.status in ('accepted','picked_up','in_transit')
      and d.id = (split_part(name, '/', 1))::uuid
  )
);

-- If client uses upsert/update later, add update policy (optional):
-- create policy "Rider can update PoD photo"
-- on storage.objects for update
-- using (same predicate) with check (same predicate);

drop policy if exists "Rider can read own PoD photo" on storage.objects;
create policy "Rider can read own PoD photo"
on storage.objects for select
using (
  bucket_id = 'delivery-pod'
  and exists (
    select 1
    from public.deliveries d
    join public.riders r on r.id = d.rider_id
    where r.user_id = auth.uid()
      and d.status in ('accepted','picked_up','in_transit','delivered')
      and d.id = (split_part(name, '/', 1))::uuid
  )
);

drop policy if exists "Business/admin can read PoD photo" on storage.objects;
create policy "Business/admin can read PoD photo"
on storage.objects for select
using (
  bucket_id = 'delivery-pod'
  and (
    exists (
      select 1
      from public.deliveries d
      join public.businesses b on b.id = d.business_id
      where b.user_id = auth.uid()
        and d.id = (split_part(name, '/', 1))::uuid
    )
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
);
