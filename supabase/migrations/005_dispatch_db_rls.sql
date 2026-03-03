-- ============================================
-- Dispatch DB/RLS (offers + RPCs)
-- ============================================

-- 1) Ensure riders.user_id is canonical mapping
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'riders_user_id_unique'
      and conrelid = 'public.riders'::regclass
  ) then
    alter table public.riders
      add constraint riders_user_id_unique unique (user_id);
  end if;
end $$;

-- 2) Expand delivery status taxonomy (single source of truth)
alter table public.deliveries
  drop constraint if exists deliveries_status_check;

alter table public.deliveries
  add constraint deliveries_status_check check (
    status in ('pending', 'offered', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'expired')
  );

-- 3) Delivery offers table (rider_user_id is canonical)
create table if not exists public.delivery_offers (
  id uuid default gen_random_uuid() primary key,
  delivery_id uuid references public.deliveries(id) on delete cascade not null,
  rider_user_id uuid references auth.users(id) on delete cascade not null,
  status text not null check (status in ('offered', 'accepted', 'rejected', 'expired')),
  offered_at timestamptz default now() not null,
  responded_at timestamptz
);

create index if not exists idx_delivery_offers_delivery_id on public.delivery_offers(delivery_id);
create index if not exists idx_delivery_offers_rider_user_id on public.delivery_offers(rider_user_id);

alter table public.delivery_offers enable row level security;

-- 4) Update delivery status transition trigger to include offered/expired
create or replace function public.validate_delivery_status_transition()
returns trigger as $$
begin
  if tg_op <> 'UPDATE' then
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

-- 5) RLS policies for delivery_offers

drop policy if exists "Riders can read own offers" on public.delivery_offers;
drop policy if exists "Riders can update own offers" on public.delivery_offers;
drop policy if exists "Businesses can read offers for own deliveries" on public.delivery_offers;
drop policy if exists "Admins can read all offers" on public.delivery_offers;

create policy "Riders can read own offers"
  on public.delivery_offers for select
  using (rider_user_id = auth.uid());

create policy "Riders can update own offers"
  on public.delivery_offers for update
  using (rider_user_id = auth.uid())
  with check (rider_user_id = auth.uid());

create policy "Businesses can read offers for own deliveries"
  on public.delivery_offers for select
  using (
    delivery_id in (
      select d.id
      from public.deliveries d
      join public.businesses b on b.id = d.business_id
      where b.user_id = auth.uid()
    )
  );

create policy "Admins can read all offers"
  on public.delivery_offers for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 6) Tighten deliveries update policy (non-admin only own/assigned)

drop policy if exists "Riders can update assigned deliveries" on public.deliveries;
create policy "Riders can update assigned deliveries"
  on public.deliveries for update
  using (
    rider_id in (select id from public.riders where user_id = auth.uid())
  );

-- 7) RPCs: dispatch_delivery, rider_accept_offer, rider_refuse_offer, expire_offers

-- dispatch_delivery: idempotent
create or replace function public.dispatch_delivery(p_delivery_id uuid, p_preferred_rider_user_id uuid default null)
returns setof public.delivery_offers as $$
declare
  delivery_row public.deliveries;
  candidate_user_ids uuid[];
  created_count int;
  offer_row public.delivery_offers;
  cutoff timestamptz := now() - interval '90 seconds';
  fresh_cutoff timestamptz := now() - interval '60 seconds';
  offer_ttl interval := interval '20 seconds';
begin
  select * into delivery_row
  from public.deliveries
  where id = p_delivery_id
  for update;

  if not found then
    raise exception 'Delivery not found';
  end if;

  if delivery_row.status not in ('pending', 'offered') then
    return;
  end if;

  -- Idempotency: if active offers exist, return them
  if exists (
    select 1 from public.delivery_offers
    where delivery_id = p_delivery_id
      and status = 'offered'
      and offered_at >= now() - offer_ttl
  ) then
    return query
      select * from public.delivery_offers
      where delivery_id = p_delivery_id
        and status = 'offered'
        and offered_at >= now() - offer_ttl;
    return;
  end if;

  -- If dispatch window exceeded, expire
  if delivery_row.created_at < cutoff then
    update public.deliveries set status = 'expired' where id = p_delivery_id;
    return;
  end if;

  -- Candidate selection: preferred first
  candidate_user_ids := array(
    select r.user_id
    from public.riders r
    where r.status = 'available'
      and (r.last_seen_at is null or r.last_seen_at >= fresh_cutoff)
      and (
        (r.last_lat between 35.74 and 35.79 and r.last_lng between -5.86 and -5.80)
        or r.last_lat is null or r.last_lng is null
      )
    order by
      (case when r.user_id = p_preferred_rider_user_id then 0 else 1 end),
      r.last_seen_at desc nulls last,
      r.total_deliveries asc
    limit 3
  );

  if candidate_user_ids is null or array_length(candidate_user_ids, 1) is null then
    return;
  end if;

  -- Create offers (avoid duplicates)
  created_count := 0;
  foreach offer_row in array (
    select row(o.*)::public.delivery_offers from (
      select
        gen_random_uuid() as id,
        p_delivery_id as delivery_id,
        candidate_user_ids[i] as rider_user_id,
        'offered'::text as status,
        now() as offered_at,
        null::timestamptz as responded_at
      from generate_subscripts(candidate_user_ids, 1) as i
    ) o
  )
  loop
    insert into public.delivery_offers (id, delivery_id, rider_user_id, status, offered_at, responded_at)
    select offer_row.id, offer_row.delivery_id, offer_row.rider_user_id, offer_row.status, offer_row.offered_at, offer_row.responded_at
    where not exists (
      select 1 from public.delivery_offers
      where delivery_id = p_delivery_id
        and rider_user_id = offer_row.rider_user_id
        and status in ('offered', 'accepted')
    );
    created_count := created_count + 1;
  end loop;

  if created_count > 0 then
    update public.deliveries set status = 'offered' where id = p_delivery_id;
  end if;

  return query
    select * from public.delivery_offers
    where delivery_id = p_delivery_id
      and status = 'offered'
      and offered_at >= now() - offer_ttl;
end;
$$ language plpgsql security definer;

-- rider_accept_offer: derives rider from auth.uid()
create or replace function public.rider_accept_offer(p_offer_id uuid)
returns public.deliveries as $$
declare
  offer_row public.delivery_offers;
  delivery_row public.deliveries;
  rider_row public.riders;
begin
  select * into offer_row
  from public.delivery_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found';
  end if;

  if offer_row.rider_user_id <> auth.uid() then
    raise exception 'Forbidden';
  end if;

  if offer_row.status <> 'offered' then
    raise exception 'Offer not available';
  end if;

  select * into delivery_row
  from public.deliveries
  where id = offer_row.delivery_id
  for update;

  if delivery_row.status <> 'offered' then
    raise exception 'Delivery not available';
  end if;

  select * into rider_row
  from public.riders
  where user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Rider not found';
  end if;

  update public.delivery_offers
  set status = 'accepted', responded_at = now()
  where id = p_offer_id;

  update public.delivery_offers
  set status = 'expired', responded_at = now()
  where delivery_id = offer_row.delivery_id
    and id <> p_offer_id
    and status = 'offered';

  update public.deliveries
  set rider_id = rider_row.id,
      status = 'accepted',
      accepted_at = now()
  where id = offer_row.delivery_id
  returning * into delivery_row;

  update public.riders
  set status = 'busy'
  where id = rider_row.id;

  return delivery_row;
end;
$$ language plpgsql security definer;

-- rider_refuse_offer: derives rider from auth.uid()
create or replace function public.rider_refuse_offer(p_offer_id uuid)
returns void as $$
declare
  offer_row public.delivery_offers;
  remaining int;
begin
  select * into offer_row
  from public.delivery_offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'Offer not found';
  end if;

  if offer_row.rider_user_id <> auth.uid() then
    raise exception 'Forbidden';
  end if;

  if offer_row.status <> 'offered' then
    return;
  end if;

  update public.delivery_offers
  set status = 'rejected', responded_at = now()
  where id = p_offer_id;

  select count(*) into remaining
  from public.delivery_offers
  where delivery_id = offer_row.delivery_id
    and status = 'offered'
    and offered_at >= now() - interval '20 seconds';

  if remaining = 0 then
    update public.deliveries set status = 'pending' where id = offer_row.delivery_id;
  end if;
end;
$$ language plpgsql security definer;

-- expire_offers: expire offers after TTL and apply global timeout
create or replace function public.expire_offers(p_delivery_id uuid)
returns void as $$
declare
  delivery_row public.deliveries;
  remaining int;
begin
  select * into delivery_row
  from public.deliveries
  where id = p_delivery_id
  for update;

  if not found then
    return;
  end if;

  update public.delivery_offers
  set status = 'expired', responded_at = now()
  where delivery_id = p_delivery_id
    and status = 'offered'
    and offered_at < now() - interval '20 seconds';

  select count(*) into remaining
  from public.delivery_offers
  where delivery_id = p_delivery_id
    and status = 'offered'
    and offered_at >= now() - interval '20 seconds';

  if remaining = 0 then
    if delivery_row.created_at < now() - interval '90 seconds' then
      update public.deliveries set status = 'expired' where id = p_delivery_id;
    else
      update public.deliveries set status = 'pending' where id = p_delivery_id;
    end if;
  end if;
end;
$$ language plpgsql security definer;
