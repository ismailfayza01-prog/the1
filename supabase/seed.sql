-- ============================================
-- SEED DATA for The 1000 Platform
-- ============================================
-- NOTE: Run this AFTER creating auth users in the Supabase dashboard.
--
-- Create these users in Authentication > Users > Add User:
--   1. admin@the1000.ma     / Admin1234!
--   2. pharmacie@example.ma / Business1234!
--   3. cafe@example.ma      / Business1234!
--   4. rider1@the1000.ma    / Rider1234!
--   5. rider2@the1000.ma    / Rider1234!
--
-- After creating users, update the UUIDs below with the actual auth.users IDs.
-- Then run this script in the SQL Editor.
-- ============================================

-- Step 1: Get the user IDs (run this query first to find the UUIDs)
-- select id, email from auth.users order by email;

-- Step 2: Update profiles with correct roles and names
-- (The trigger already created profiles, we just need to update role/name)
update public.profiles set role = 'admin', name = 'Ismail (Admin)' where email = 'admin@the1000.ma';
update public.profiles set role = 'business', name = 'Pharmacie Centrale' where email = 'pharmacie@example.ma';
update public.profiles set role = 'business', name = 'Café des Arts' where email = 'cafe@example.ma';
update public.profiles set role = 'rider', name = 'Ahmed Benani' where email = 'rider1@the1000.ma';
update public.profiles set role = 'rider', name = 'Youssef Tazi' where email = 'rider2@the1000.ma';

-- Step 3: Create businesses
insert into public.businesses (user_id, name, subscription_tier, rides_used, rides_total, wallet_balance, renewal_date)
select id, 'Pharmacie Centrale', 'monthly', 3, 8, 0, now() + interval '25 days'
from public.profiles where email = 'pharmacie@example.ma';

insert into public.businesses (user_id, name, subscription_tier, rides_used, rides_total, wallet_balance, renewal_date)
select id, 'Café des Arts', 'annual', 12, 96, 180, now() + interval '340 days'
from public.profiles where email = 'cafe@example.ma';

-- Step 4: Create riders
insert into public.riders (user_id, name, phone, status, total_deliveries, free_rides_remaining, current_location, last_location_update, earnings_this_month)
select id, 'Ahmed Benani', '+212 6 12 34 56 78', 'available', 45, 0, '{"lat": 35.7595, "lng": -5.8340}'::jsonb, now(), 2450
from public.profiles where email = 'rider1@the1000.ma';

insert into public.riders (user_id, name, phone, status, total_deliveries, free_rides_remaining, current_location, last_location_update, earnings_this_month)
select id, 'Youssef Tazi', '+212 6 98 76 54 32', 'busy', 58, 0, '{"lat": 35.7650, "lng": -5.8250}'::jsonb, now(), 3180
from public.profiles where email = 'rider2@the1000.ma';

-- Step 5: Create sample deliveries
insert into public.deliveries (business_id, rider_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, estimated_duration, price, rider_commission, status, payment_method, created_at, accepted_at, picked_up_at)
select
  b.id, r.id,
  'Pharmacie Centrale, Avenue Mohammed V, Tangier', 35.7650, -5.8250,
  '45 Rue de Fès, Tangier', 35.7700, -5.8180,
  15, 0, 15, 'in_transit', 'subscription',
  now() - interval '10 minutes',
  now() - interval '8 minutes',
  now() - interval '3 minutes'
from public.businesses b, public.riders r
where b.name = 'Pharmacie Centrale' and r.name = 'Youssef Tazi';

insert into public.deliveries (business_id, rider_id, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, estimated_duration, actual_duration, price, rider_commission, status, payment_method, created_at, accepted_at, picked_up_at, completed_at)
select
  b.id, r.id,
  'Café des Arts, Boulevard Pasteur, Tangier', 35.7700, -5.8100,
  '12 Avenue des FAR, Tangier', 35.7750, -5.8050,
  20, 18, 18, 14, 'delivered', 'wallet',
  now() - interval '60 minutes',
  now() - interval '58 minutes',
  now() - interval '50 minutes',
  now() - interval '40 minutes'
from public.businesses b, public.riders r
where b.name = 'Café des Arts' and r.name = 'Ahmed Benani';
