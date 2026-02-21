-- ============================================
-- Rider realtime tracking fields
-- ============================================

alter table public.riders
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision,
  add column if not exists last_seen_at timestamptz;

-- Optional backfill from current_location jsonb if present
update public.riders
set last_lat = (current_location->>'lat')::double precision,
    last_lng = (current_location->>'lng')::double precision,
    last_seen_at = coalesce(last_location_update, now())
where current_location is not null
  and (last_lat is null or last_lng is null);
