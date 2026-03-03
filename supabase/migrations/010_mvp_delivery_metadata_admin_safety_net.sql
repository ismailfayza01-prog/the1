-- ============================================
-- MVP Tangier: delivery metadata + admin safety net
-- ============================================

-- 1) Delivery metadata for business input
alter table public.deliveries
  add column if not exists dropoff_phone text,
  add column if not exists note text;

-- 2) Allow admin-only override flag in status transition trigger
create or replace function public.validate_delivery_status_transition()
returns trigger as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- Admin override path (set only inside admin RPCs)
  if current_setting('app.admin_override', true) = '1' then
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('offered', 'cancelled', 'expired') then
    return new;
  end if;
  if old.status = 'offered' and new.status in ('accepted', 'pending', 'cancelled', 'expired') then
    return new;
  end if;
  if old.status = 'accepted' and new.status in ('picked_up', 'cancelled') then
    return new;
  end if;
  if old.status = 'picked_up' and new.status in ('in_transit', 'cancelled') then
    return new;
  end if;
  if old.status = 'in_transit' and new.status in ('delivered', 'cancelled') then
    return new;
  end if;

  raise exception 'Invalid delivery status transition from % to %', old.status, new.status;
end;
$$ language plpgsql;

-- 3) Allow admin-only override flag in completion guard
create or replace function public.enforce_delivery_completion_rules()
returns trigger as $$
declare
  pod_flag text := current_setting('app.pod_rpc', true);
  cod_flag text := current_setting('app.cod_rpc', true);
  wallet_flag text := current_setting('app.wallet_rpc', true);
  admin_flag text := current_setting('app.admin_override', true);
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

  -- Immutability after delivered, except explicit admin override.
  if (old.status = 'delivered' or old.delivered_at is not null) then
    if (pod_changed or cod_changed or delivered_transition) and admin_flag is distinct from '1' then
      raise exception 'Delivery is immutable after delivered';
    end if;
    return new;
  end if;

  -- Admin override path (set only inside admin RPCs)
  if admin_flag = '1' then
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

-- 4) Admin manual assignment safety net
create or replace function public.admin_assign_delivery(
  p_delivery_id uuid,
  p_rider_id uuid,
  p_create_offer boolean default false
)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.deliveries;
  v_rider public.riders;
  v_prev_rider_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden: admin role required';
  end if;

  select * into v_delivery
  from public.deliveries
  where id = p_delivery_id
  for update;

  if not found then
    raise exception 'Delivery not found';
  end if;

  if v_delivery.status in ('delivered', 'cancelled', 'expired') then
    raise exception 'Cannot assign a completed/cancelled/expired delivery';
  end if;

  select * into v_rider
  from public.riders
  where id = p_rider_id
  for update;

  if not found then
    raise exception 'Rider not found';
  end if;

  v_prev_rider_id := v_delivery.rider_id;

  if p_create_offer then
    insert into public.delivery_offers (delivery_id, rider_user_id, status, offered_at)
    select p_delivery_id, v_rider.user_id, 'offered', now()
    where not exists (
      select 1
      from public.delivery_offers o
      where o.delivery_id = p_delivery_id
        and o.rider_user_id = v_rider.user_id
        and o.status in ('offered', 'accepted')
    );

    perform set_config('app.admin_override', '1', true);
    update public.deliveries
    set status = 'offered',
        rider_id = null
    where id = p_delivery_id
    returning * into v_delivery;

    if v_prev_rider_id is not null then
      update public.riders
      set status = 'available'
      where id = v_prev_rider_id;
    end if;

    return v_delivery;
  end if;

  -- Expire pending offers and force direct assignment
  update public.delivery_offers
  set status = 'expired',
      responded_at = now()
  where delivery_id = p_delivery_id
    and status = 'offered';

  perform set_config('app.admin_override', '1', true);
  update public.deliveries
  set rider_id = p_rider_id,
      status = 'accepted',
      accepted_at = coalesce(accepted_at, now())
  where id = p_delivery_id
  returning * into v_delivery;

  if v_prev_rider_id is not null and v_prev_rider_id <> p_rider_id then
    update public.riders
    set status = 'available'
    where id = v_prev_rider_id;
  end if;

  update public.riders
  set status = 'busy',
      last_seen_at = coalesce(last_seen_at, now())
  where id = p_rider_id;

  return v_delivery;
end;
$$;

-- 5) Admin status override safety net
create or replace function public.admin_override_delivery_status(
  p_delivery_id uuid,
  p_status text
)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.deliveries;
  v_prev_rider_id uuid;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Forbidden: admin role required';
  end if;

  if p_status not in ('pending', 'offered', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'expired') then
    raise exception 'Invalid status: %', p_status;
  end if;

  select * into v_delivery
  from public.deliveries
  where id = p_delivery_id
  for update;

  if not found then
    raise exception 'Delivery not found';
  end if;

  if v_delivery.status = 'delivered' and p_status <> 'delivered' then
    raise exception 'Delivered deliveries cannot be reopened';
  end if;

  v_prev_rider_id := v_delivery.rider_id;

  perform set_config('app.admin_override', '1', true);

  update public.deliveries
  set status = p_status,
      rider_id = case
        when p_status in ('pending', 'offered', 'expired', 'cancelled') then null
        else rider_id
      end,
      accepted_at = case
        when p_status in ('accepted', 'picked_up', 'in_transit', 'delivered') then coalesce(accepted_at, now())
        else accepted_at
      end,
      picked_up_at = case
        when p_status in ('picked_up', 'in_transit', 'delivered') then coalesce(picked_up_at, now())
        else picked_up_at
      end,
      delivered_at = case
        when p_status = 'delivered' then coalesce(delivered_at, now())
        else delivered_at
      end,
      completed_at = case
        when p_status = 'delivered' then coalesce(completed_at, now())
        else completed_at
      end,
      pod_method = case
        when p_status = 'delivered' and pod_method is null then 'photo'
        else pod_method
      end,
      pod_photo_url = case
        when p_status = 'delivered' and pod_photo_url is null then 'admin-override'
        else pod_photo_url
      end
  where id = p_delivery_id
  returning * into v_delivery;

  if v_prev_rider_id is not null and v_delivery.rider_id is null then
    update public.riders
    set status = 'available'
    where id = v_prev_rider_id;
  end if;

  if v_delivery.rider_id is not null then
    if p_status in ('accepted', 'picked_up', 'in_transit') then
      update public.riders
      set status = 'busy'
      where id = v_delivery.rider_id;
    elsif p_status in ('delivered', 'cancelled', 'expired', 'pending') then
      update public.riders
      set status = 'available'
      where id = v_delivery.rider_id;
    end if;
  end if;

  return v_delivery;
end;
$$;
