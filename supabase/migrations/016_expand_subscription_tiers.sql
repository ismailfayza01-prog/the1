-- ============================================
-- Expand business subscription tiers for packs
-- ============================================

alter table public.businesses
  drop constraint if exists businesses_subscription_tier_check;

alter table public.businesses
  add constraint businesses_subscription_tier_check
  check (subscription_tier in ('monthly', 'trimestrial', 'semestrial', 'annual', 'none'));

