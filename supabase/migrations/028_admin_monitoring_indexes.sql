-- Admin monitoring dashboard performance indexes

create index if not exists idx_deliveries_created_at_desc
  on public.deliveries(created_at desc);

create index if not exists idx_deliveries_status_created_at_desc
  on public.deliveries(status, created_at desc);

create index if not exists idx_delivery_offers_status_offered_at_desc
  on public.delivery_offers(status, offered_at desc);

create index if not exists idx_riders_last_seen_at_desc
  on public.riders(last_seen_at desc);

create index if not exists idx_transactions_created_at_desc
  on public.transactions(created_at desc);
