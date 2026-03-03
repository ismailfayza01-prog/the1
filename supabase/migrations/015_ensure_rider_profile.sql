-- Ensure rider users can self-heal missing rider rows.
create or replace function public.ensure_rider_profile()
returns public.riders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_rider public.riders;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_profile.role <> 'rider' then
    raise exception 'Forbidden: rider role required';
  end if;

  v_name := coalesce(
    nullif(btrim(v_profile.name), ''),
    split_part(v_profile.email, '@', 1),
    'Rider'
  );

  insert into public.riders (user_id, name, phone, status)
  values (v_user_id, v_name, '', 'offline')
  on conflict (user_id) do update
  set name = coalesce(nullif(public.riders.name, ''), excluded.name)
  returning * into v_rider;

  return v_rider;
end;
$$;

grant execute on function public.ensure_rider_profile() to authenticated;
