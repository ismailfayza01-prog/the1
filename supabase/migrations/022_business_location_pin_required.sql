-- Require pinned map coordinates when provisioning business accounts via admin flow.
alter table public.businesses
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_pinned_at timestamptz;

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
  v_location_lat double precision;
  v_location_lng double precision;
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

    begin
      v_location_lat := nullif(btrim(coalesce(p_business->>'location_lat', '')), '')::double precision;
    exception
      when invalid_text_representation then
        raise exception 'Invalid business location_lat';
    end;

    begin
      v_location_lng := nullif(btrim(coalesce(p_business->>'location_lng', '')), '')::double precision;
    exception
      when invalid_text_representation then
        raise exception 'Invalid business location_lng';
    end;

    if v_location_lat is null or v_location_lng is null then
      raise exception 'Business location pin is required';
    end if;

    if v_location_lat < -90 or v_location_lat > 90 then
      raise exception 'Invalid business location_lat';
    end if;

    if v_location_lng < -180 or v_location_lng > 180 then
      raise exception 'Invalid business location_lng';
    end if;

    if exists (select 1 from public.businesses b where b.user_id = p_user_id) then
      update public.businesses
      set name = v_business_name,
          address = coalesce(v_address, address),
          location_lat = v_location_lat,
          location_lng = v_location_lng,
          location_pinned_at = now()
      where user_id = p_user_id;
    else
      insert into public.businesses (user_id, name, address, location_lat, location_lng, location_pinned_at)
      values (p_user_id, v_business_name, v_address, v_location_lat, v_location_lng, now());
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
