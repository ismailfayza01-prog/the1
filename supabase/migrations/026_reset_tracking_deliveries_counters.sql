-- One-time operational reset:
-- - delete tracking history
-- - delete all delivery/offer records
-- - reset rider and business counters to 0

begin;

truncate table public.rider_locations restart identity;
truncate table public.delivery_offers, public.deliveries restart identity;

update public.riders
set total_deliveries = 0,
    free_rides_remaining = 0,
    earnings_this_month = 0,
    status = 'offline',
    current_location = null,
    last_location_update = null,
    last_lat = null,
    last_lng = null,
    last_seen_at = null;

update public.businesses
set rides_used = 0,
    rides_total = 0;

commit;
