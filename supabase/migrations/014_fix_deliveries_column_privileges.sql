-- Restore deliveries column visibility for anon/authenticated roles.
-- Required because business/rider clients hit PostgREST with these roles,
-- and missing column grants surface as "column does not exist" errors.

begin;

grant usage on schema public to anon, authenticated;

-- Base table privileges used by app workflows (create/update/read deliveries).
grant select on table public.deliveries to anon;
grant select, insert, update on table public.deliveries to authenticated;

-- Explicitly grant newer delivery metadata columns that can be missing from role cache.
do $$
declare
  v_cols text;
begin
  select string_agg(format('%I', c.column_name), ', ')
    into v_cols
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'deliveries'
    and c.column_name = any (array[
      'business_name',
      'rider_name',
      'dropoff_phone',
      'note',
      'updated_at',
      'otp_verified_at',
      'pod_verified_at',
      'pod_notes',
      'cod_amount',
      'cod_collected',
      'cod_amount_mad',
      'cod_collected_at',
      'cod_collected_by_rider_id',
      'delivered_by_rider_id',
      'failure_reason'
    ]);

  if v_cols is not null then
    execute format('grant select (%s) on table public.deliveries to anon', v_cols);
    execute format('grant select, insert, update (%s) on table public.deliveries to authenticated', v_cols);
  end if;
end;
$$;

commit;
