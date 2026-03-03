-- ============================================
-- Admin user provisioning, role mapping, and audit logs
-- ============================================

-- Optional profile metadata support for business/rider provisioning
alter table public.businesses
  add column if not exists address text;

alter table public.riders
  add column if not exists cin text,
  add column if not exists vehicle_type text;

-- Enforce one business row per auth user
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_user_id_unique'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_user_id_unique unique (user_id);
  end if;
end $$;

-- Canonical user -> role mapping
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'business', 'rider')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_roles_role on public.user_roles(role);

-- Admin audit trail
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

-- Keep user_roles as source of truth while remaining backward compatible.
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

-- Keep signup trigger behavior and ensure profile remains present.
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

  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill canonical role map from profiles.
insert into public.user_roles (user_id, role, created_at, updated_at)
select p.id, p.role, coalesce(p.created_at, now()), now()
from public.profiles p
on conflict (user_id) do update
set role = excluded.role,
    updated_at = now();

-- Sync profiles.role -> user_roles on insert/update.
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

-- RLS for new tables
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

-- Atomic provisioning for admin-created users
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

    insert into public.businesses (user_id, name, address)
    values (p_user_id, v_business_name, v_address)
    on conflict (user_id) do update
    set name = excluded.name,
        address = coalesce(excluded.address, public.businesses.address);
  elsif p_role = 'rider' then
    v_rider_name := coalesce(
      nullif(btrim(coalesce(p_rider->>'rider_name', p_profile->>'rider_name')), ''),
      v_full_name
    );
    v_cin := nullif(btrim(coalesce(p_rider->>'cin', p_profile->>'cin')), '');
    v_vehicle_type := nullif(
      btrim(coalesce(p_rider->>'vehicle_type', p_profile->>'vehicle_type')),
      ''
    );

    insert into public.riders (user_id, name, phone, cin, vehicle_type, status)
    values (p_user_id, v_rider_name, coalesce(v_phone, ''), v_cin, v_vehicle_type, 'offline')
    on conflict (user_id) do update
    set name = excluded.name,
        phone = coalesce(nullif(excluded.phone, ''), public.riders.phone),
        cin = coalesce(excluded.cin, public.riders.cin),
        vehicle_type = coalesce(excluded.vehicle_type, public.riders.vehicle_type);
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_user_id, payload)
  values (
    v_actor,
    'admin_provision_user',
    p_user_id,
    jsonb_build_object(
      'role', p_role,
      'profile', coalesce(p_profile, '{}'::jsonb),
      'business', coalesce(p_business, 'null'::jsonb),
      'rider', coalesce(p_rider, 'null'::jsonb)
    )
  );

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'role', p_role
  );
end;
$$;
