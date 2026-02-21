-- ============================================
-- P0-7 COD + Unified Delivered Guard
-- ============================================

-- 1) Schema updates
alter table public.deliveries
  add column if not exists payment_method text not null default 'wallet'
    check (payment_method in ('wallet','cod')),
  add column if not exists cod_amount_mad numeric,
  add column if not exists cod_collected_at timestamptz,
  add column if not exists cod_collected_by_rider_id uuid,
  add column if not exists wallet_charged_at timestamptz;

-- 2) Unified delivered transition guard (replaces PoD-only guard)
create or replace function public.enforce_delivery_completion_rules()
returns trigger as $$
declare
  pod_flag text := current_setting('app.pod_rpc', true);
  cod_flag text := current_setting('app.cod_rpc', true);
  wallet_flag text := current_setting('app.wallet_rpc', true);
  pod_changed boolean;
  cod_changed boolean;
  delivered_transition boolean;
begin
  pod_changed :=
    (new.pod_method is distinct from old.pod_method)
    or (new.pod_photo_url is distinct from old.pod_photo_url)
    or (new.otp_code is distinct from old.otp_code)
    or (new.otp_verified is distinct from old.otp_verified)
    or (new.otp_expires_at is distinct from old.otp_expires_at)
    or (new.delivered_at is distinct from old.delivered_at);

  cod_changed :=
    (new.cod_amount_mad is distinct from old.cod_amount_mad)
    or (new.cod_collected_at is distinct from old.cod_collected_at)
    or (new.cod_collected_by_rider_id is distinct from old.cod_collected_by_rider_id);

  delivered_transition :=
    (new.status is distinct from old.status and new.status = 'delivered');

  -- Immutability after delivered
  if (old.status = 'delivered' or old.delivered_at is not null) then
    if pod_changed or cod_changed or delivered_transition then
      raise exception 'Delivery is immutable after delivered';
    end if;
    return new;
  end if;

  -- Guard PoD changes
  if pod_changed and pod_flag is distinct from '1' then
    raise exception 'PoD updates must be performed via RPC';
  end if;

  -- Guard COD changes
  if cod_changed and cod_flag is distinct from '1' then
    raise exception 'COD updates must be performed via RPC';
  end if;

  -- Guard delivered transition by payment method
  if delivered_transition then
    if pod_flag = '1' then
      return new;
    end if;

    if new.payment_method = 'cod' and cod_flag = '1' then
      return new;
    end if;

    if new.payment_method = 'wallet' and wallet_flag = '1' and new.wallet_charged_at is not null then
      return new;
    end if;

    raise exception 'Delivered transition not authorized';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_pod_update_rules on public.deliveries;
drop trigger if exists trg_enforce_delivery_completion_rules on public.deliveries;

create trigger trg_enforce_delivery_completion_rules
before update on public.deliveries
for each row execute function public.enforce_delivery_completion_rules();

-- 3) RPC: mark_cod_collected (assigned rider only)
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
