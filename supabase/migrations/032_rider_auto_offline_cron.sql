-- Server-side stale rider auto-offline safeguard.
-- Riders stay online until inactivity threshold passes and they have no in-progress delivery.

create or replace function public.cron_mark_stale_riders_offline(
  p_stale_after interval default interval '30 minutes'
)
returns table (updated_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_count integer := 0;
begin
  update public.riders r
  set
    status = 'offline',
    last_seen_at = coalesce(r.last_seen_at, now())
  where r.status in ('available', 'busy')
    and coalesce(r.last_seen_at, r.last_location_update, r.created_at) < now() - p_stale_after
    and not exists (
      select 1
      from public.deliveries d
      where d.rider_id = r.id
        and d.status in ('accepted', 'picked_up', 'in_transit')
    );

  get diagnostics v_updated_count = row_count;
  return query select v_updated_count;
end;
$$;

grant execute on function public.cron_mark_stale_riders_offline(interval) to authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron')
     and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'cron' and p.proname = 'schedule')
  then
    begin
      perform cron.unschedule(jobid)
      from cron.job
      where jobname = 'cron_mark_stale_riders_offline_5m';
    exception
      when undefined_table then
        null;
    end;

    begin
      perform cron.schedule(
        'cron_mark_stale_riders_offline_5m',
        '*/5 * * * *',
        'select public.cron_mark_stale_riders_offline(interval ''30 minutes'');'
      );
    exception
      when others then
        raise notice 'pg_cron schedule skipped: %', sqlerrm;
    end;
  end if;
end $$;

comment on function public.cron_mark_stale_riders_offline(interval)
is 'Marks riders offline after inactivity window, excluding riders with active in-progress deliveries.';
