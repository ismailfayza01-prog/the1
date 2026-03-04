-- ============================================
-- Live MVP reconcile (remote-safe patch)
-- ============================================

-- 1) Missing MVP columns
alter table public.deliveries
  add column if not exists dropoff_phone text,
  add column if not exists note text;

alter table public.riders
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision;

alter table public.businesses
  add column if not exists address text;

alter table public.riders
  add column if not exists cin text,
  add column if not exists vehicle_type text;

-- 2) Expand delivery statuses for offered/expired admin flows
alter table public.deliveries
  drop constraint if exists deliveries_status_check;

alter table public.deliveries
  add constraint deliveries_status_check
  check (status in ('pending', 'offered', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'expired'));

-- 3) Canonical role map + admin audit tables
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'business', 'rider')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_roles_role on public.user_roles(role);

create table if not exists public.admin_audit_logs (
  id bigserial primary key,
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_created_at
  on public.admin_audit_logs(created_at desc);

create index if not exists idx_admin_audit_logs_target_user_id
  on public.admin_audit_logs(target_user_id);

create index if not exists idx_admin_audit_logs_admin_user_id
  on public.admin_audit_logs(admin_user_id);

-- 4) Role helpers
create or replace function public.get_user_role()
returns text as $$
  select coalesce(
    (select ur.role from public.user_roles ur where ur.user_id = auth.uid()),
    (select p.role from public.profiles p where p.id = auth.uid())
  );
$$ language sql security definer stable;

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean as $$
  with resolved as (
    select coalesce(p_user_id, auth.uid()) as uid
  )
  select exists (
           select 1
           from public.user_roles ur, resolved r
           where ur.user_id = r.uid
             and ur.role = 'admin'
         )
         or exists (
           select 1
           from public.profiles p, resolved r
           where p.id = r.uid
             and p.role = 'admin'
         );
$$ language sql security definer stable;

-- 5) Keep profiles and user_roles in sync
insert into public.user_roles (user_id, role, created_at, updated_at)
select p.id, p.role, coalesce(p.created_at, now()), now()
from public.profiles p
on conflict (user_id) do update
set role = excluded.role,
    updated_at = now();

create or replace function public.sync_profile_role_to_user_roles()
returns trigger as $$
begin
  insert into public.user_roles (user_id, role, created_at, updated_at)
  values (new.id, new.role, coalesce(new.created_at, now()), now())
  on conflict (user_id) do update
  set role = excluded.role,
      updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_profile_role_to_user_roles on public.profiles;
create trigger trg_sync_profile_role_to_user_roles
after insert or update of role on public.profiles
for each row execute function public.sync_profile_role_to_user_roles();

-- 6) Recreate signup trigger with upsert safety
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'business'),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email,
      role = excluded.role,
      name = excluded.name;

  insert into public.user_roles (user_id, role, created_at, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'business'),
    now(),
    now()
  )
  on conflict (user_id) do update
  set role = excluded.role,
      updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 7) RLS for role map and audit logs
alter table public.user_roles enable row level security;
alter table public.admin_audit_logs enable row level security;

drop policy if exists "Users can read own role map" on public.user_roles;
drop policy if exists "Admins can read all role maps" on public.user_roles;
drop policy if exists "Admins can insert role maps" on public.user_roles;
drop policy if exists "Admins can update role maps" on public.user_roles;
drop policy if exists "Admins can delete role maps" on public.user_roles;

create policy "Users can read own role map"
  on public.user_roles for select
  using (user_id = auth.uid());

create policy "Admins can read all role maps"
  on public.user_roles for select
  using (public.is_admin(auth.uid()));

create policy "Admins can insert role maps"
  on public.user_roles for insert
  with check (public.is_admin(auth.uid()));

create policy "Admins can update role maps"
  on public.user_roles for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Admins can delete role maps"
  on public.user_roles for delete
  using (public.is_admin(auth.uid()));

drop policy if exists "Admins can read audit logs" on public.admin_audit_logs;
drop policy if exists "Admins can insert audit logs" on public.admin_audit_logs;

create policy "Admins can read audit logs"
  on public.admin_audit_logs for select
  using (public.is_admin(auth.uid()));

create policy "Admins can insert audit logs"
  on public.admin_audit_logs for insert
  with check (
    public.is_admin(auth.uid())
    and admin_user_id = auth.uid()
  );

-- 8) Atomic admin provisioning for auth users
create or replace function public.admin_provision_user(
  p_user_id uuid,
  p_role text,
  p_profile jsonb,
  p_business jsonb default null,
  p_rider jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_full_name text;
  v_phone text;
  v_business_name text;
  v_address text;
  v_rider_name text;
  v_cin text;
  v_vehicle_type text;
begin
  if v_actor is null then
    raise exception 'Unauthorized';
  end if;

  if not public.is_admin(v_actor) then
    raise exception 'Forbidden: admin role required';
  end if;

  if p_role not in ('admin', 'business', 'rider') then
    raise exception 'Invalid role: %', p_role;
  end if;

  select u.email
  into v_email
  from auth.users u
  where u.id = p_user_id;

  if v_email is null then
    raise exception 'Target auth user not found';
  end if;

  v_full_name := coalesce(
    nullif(btrim(p_profile->>'full_name'), ''),
    nullif(btrim(p_profile->>'name'), ''),
    split_part(v_email, '@', 1)
  );

  v_phone := nullif(
    btrim(coalesce(p_profile->>'phone', p_rider->>'phone')),
    ''
  );

  insert into public.profiles (id, email, role, name, created_at)
  values (p_user_id, v_email, p_role, v_full_name, now())
  on conflict (id) do update
  set email = excluded.email,
      role = excluded.role,
      name = excluded.name;

  insert into public.user_roles (user_id, role, created_at, updated_at)
  values (p_user_id, p_role, now(), now())
  on conflict (user_id) do update
  set role = excluded.role,
      updated_at = now();

  if p_role = 'business' then
    v_business_name := coalesce(
      nullif(btrim(coalesce(p_business->>'business_name', p_profile->>'business_name')), ''),
      v_full_name || ' Business'
    );
    v_address := nullif(
      btrim(coalesce(p_business->>'address', p_profile->>'address')),
      ''
    );

    if exists (select 1 from public.businesses b where b.user_id = p_user_id) then
      update public.businesses
      set name = v_business_name,
          address = coalesce(v_address, address)
      where user_id = p_user_id;
    else
      insert into public.businesses (user_id, name, address)
      values (p_user_id, v_business_name, v_address);
    end if;
  end if;

  if p_role = 'rider' then
    v_rider_name := coalesce(
      nullif(btrim(coalesce(p_rider->>'rider_name', p_profile->>'rider_name')), ''),
      v_full_name
    );
    v_cin := nullif(
      btrim(coalesce(p_rider->>'cin', p_profile->>'cin')),
      ''
    );
    v_vehicle_type := nullif(
      btrim(coalesce(p_rider->>'vehicle_type', p_profile->>'vehicle_type')),
      ''
    );

    if exists (select 1 from public.riders r where r.user_id = p_user_id) then
      update public.riders
      set name = v_rider_name,
          phone = coalesce(v_phone, phone),
          cin = coalesce(v_cin, cin),
          vehicle_type = coalesce(v_vehicle_type, vehicle_type),
          status = coalesce(status, 'offline')
      where user_id = p_user_id;
    else
      insert into public.riders (user_id, name, phone, status, cin, vehicle_type, last_seen_at)
      values (p_user_id, v_rider_name, coalesce(v_phone, ''), 'offline', v_cin, v_vehicle_type, now());
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'role', p_role
  );
end;
$$;

-- 9) Status transition with admin override flag
create or replace function public.validate_delivery_status_transition()
returns trigger as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if current_setting('app.admin_override', true) = '1' then
    return new;
  end if;

  if old.status = new.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('offered', 'accepted', 'cancelled', 'expired') then
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

drop trigger if exists validate_delivery_status_transition on public.deliveries;
create trigger validate_delivery_status_transition
  before update on public.deliveries
  for each row execute procedure public.validate_delivery_status_transition();

-- 10) Business dispatch (minimal deterministic assignment)
drop function if exists public.dispatch_delivery(uuid);
drop function if exists public.dispatch_delivery(uuid, uuid);
create or replace function public.dispatch_delivery(
  p_delivery_id uuid,
  p_preferred_rider_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_delivery public.deliveries;
  v_rider public.riders;
begin
  if v_actor is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_delivery
  from public.deliveries
  where id = p_delivery_id
  for update;

  if not found then
    raise exception 'Delivery not found';
  end if;

  if not (
    public.is_admin(v_actor)
    or exists (
      select 1
      from public.businesses b
      where b.id = v_delivery.business_id
        and b.user_id = v_actor
    )
  ) then
    raise exception 'Forbidden';
  end if;

  if p_preferred_rider_user_id is not null then
    select * into v_rider
    from public.riders r
    where r.user_id = p_preferred_rider_user_id
    limit 1;
  else
    select * into v_rider
    from public.riders r
    where r.status = 'available'
    order by coalesce(r.last_seen_at, r.created_at) desc
    limit 1;
  end if;

  if not found then
    raise exception 'No rider available';
  end if;

  perform set_config('app.admin_override', '1', true);
  update public.deliveries
  set rider_id = v_rider.id,
      status = 'pending'
  where id = p_delivery_id;

  update public.riders
  set status = 'busy',
      last_seen_at = now()
  where id = v_rider.id;

  return jsonb_build_object(
    'ok', true,
    'delivery_id', p_delivery_id,
    'rider_id', v_rider.id,
    'rider_user_id', v_rider.user_id,
    'status', 'assigned'
  );
end;
$$;

-- 11) Admin safety-net assignment
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

  if not exists (select 1 from public.riders r where r.id = p_rider_id) then
    raise exception 'Rider not found';
  end if;

  v_prev_rider_id := v_delivery.rider_id;

  perform set_config('app.admin_override', '1', true);
  update public.deliveries
  set rider_id = p_rider_id,
      status = 'pending'
  where id = p_delivery_id
  returning * into v_delivery;

  if v_prev_rider_id is not null and v_prev_rider_id <> p_rider_id then
    update public.riders
    set status = 'available'
    where id = v_prev_rider_id;
  end if;

  update public.riders
  set status = 'busy',
      last_seen_at = now()
  where id = p_rider_id;

  return v_delivery;
end;
$$;

-- 12) Admin safety-net status override
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
        when p_status in ('pending', 'offered', 'cancelled', 'expired') then null
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
    elsif p_status in ('delivered', 'cancelled', 'expired', 'pending', 'offered') then
      update public.riders
      set status = 'available'
      where id = v_delivery.rider_id;
    end if;
  end if;

  return v_delivery;
end;
$$;

grant execute on function public.admin_provision_user(uuid, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.dispatch_delivery(uuid, uuid) to authenticated;
grant execute on function public.admin_assign_delivery(uuid, uuid, boolean) to authenticated;
grant execute on function public.admin_override_delivery_status(uuid, text) to authenticated;
