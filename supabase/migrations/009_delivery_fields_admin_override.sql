-- ============================================
-- MVP: delivery fields + admin overrides
-- ============================================

-- Add dropoff contact fields
alter table public.deliveries
  add column if not exists dropoff_phone text default '',
  add column if not exists note text;

-- Allow nullable coordinates for safer inserts
alter table public.deliveries
  alter column pickup_lat drop not null,
  alter column pickup_lng drop not null,
  alter column dropoff_lat drop not null,
  alter column dropoff_lng drop not null;

-- Admin can update deliveries and riders
drop policy if exists "Admins can update all deliveries" on public.deliveries;
create policy "Admins can update all deliveries"
  on public.deliveries for update
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

drop policy if exists "Admins can update all riders" on public.riders;
create policy "Admins can update all riders"
  on public.riders for update
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');

-- Allow admin status overrides in transition validation
create or replace function public.validate_delivery_status_transition()
returns trigger as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if public.get_user_role() = 'admin' then
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

-- Admin manual offer (safety net)
create or replace function public.admin_create_offer(p_delivery_id uuid, p_rider_user_id uuid)
returns public.delivery_offers as $$
declare
  offer_row public.delivery_offers;
  delivery_row public.deliveries;
begin
  if public.get_user_role() <> 'admin' then
    raise exception 'Forbidden';
  end if;

  select * into delivery_row
  from public.deliveries
  where id = p_delivery_id
  for update;

  if not found then
    raise exception 'Delivery not found';
  end if;

  if delivery_row.status not in ('pending', 'offered') then
    raise exception 'Delivery not assignable';
  end if;

  select * into offer_row
  from public.delivery_offers
  where delivery_id = p_delivery_id
    and rider_user_id = p_rider_user_id
    and status in ('offered', 'accepted')
  limit 1;

  if offer_row.id is null then
    insert into public.delivery_offers (id, delivery_id, rider_user_id, status, offered_at, responded_at)
    values (gen_random_uuid(), p_delivery_id, p_rider_user_id, 'offered', now(), null)
    returning * into offer_row;
  end if;

  update public.deliveries set status = 'offered' where id = p_delivery_id;

  return offer_row;
end;
$$ language plpgsql security definer;
