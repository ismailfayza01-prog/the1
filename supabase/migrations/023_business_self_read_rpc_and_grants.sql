-- Ensure business users can reliably read their own pinned location on client side.

begin;

grant usage on schema public to anon, authenticated;

-- Keep base table permissions explicit for app roles.
grant select on table public.businesses to anon;
grant select, update on table public.businesses to authenticated;

-- Explicit grants for location and billing columns in case role cache is stale.
do $$
declare
  v_cols text;
begin
  select string_agg(format('%I', c.column_name), ', ')
    into v_cols
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'businesses'
    and c.column_name = any (array[
      'user_id',
      'name',
      'address',
      'location_lat',
      'location_lng',
      'location_pinned_at',
      'subscription_tier',
      'rides_used',
      'rides_total',
      'wallet_balance',
      'renewal_date',
      'created_at'
    ]);

  if v_cols is not null then
    execute format('grant select (%s) on table public.businesses to anon', v_cols);
    execute format('grant select, update (%s) on table public.businesses to authenticated', v_cols);
  end if;
end;
$$;

create or replace function public.get_my_business()
returns public.businesses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_business public.businesses;
begin
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  select *
  into v_business
  from public.businesses
  where user_id = v_uid
  limit 1;

  return v_business;
end;
$$;

grant execute on function public.get_my_business() to authenticated;

commit;
