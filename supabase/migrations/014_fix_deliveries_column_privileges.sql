-- Restore deliveries column visibility for anon/authenticated roles.
-- Required because business/rider clients hit PostgREST with these roles,
-- and missing column grants surface as "column does not exist" errors.

begin;

grant usage on schema public to anon, authenticated;

-- Base table privileges used by app workflows (create/update/read deliveries).
grant select on table public.deliveries to anon;
grant select, insert, update on table public.deliveries to authenticated;

-- Explicitly grant newer delivery metadata columns that can be missing from role cache.
grant select (business_name, rider_name, dropoff_phone, note, updated_at, otp_verified_at, pod_verified_at, pod_notes, cod_amount, cod_collected, delivered_by_rider_id, failure_reason)
  on table public.deliveries
  to anon;

grant select, insert, update (business_name, rider_name, dropoff_phone, note, updated_at, otp_verified_at, pod_verified_at, pod_notes, cod_amount, cod_collected, delivered_by_rider_id, failure_reason)
  on table public.deliveries
  to authenticated;

commit;
