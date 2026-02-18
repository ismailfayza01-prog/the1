-- ============================================
-- The 1000 Platform - Initial Schema
-- ============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  role text not null check (role in ('admin', 'business', 'rider')),
  name text not null,
  created_at timestamptz default now() not null
);

-- Businesses
create table public.businesses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  subscription_tier text default 'none' check (subscription_tier in ('monthly', 'annual', 'none')),
  rides_used integer default 0,
  rides_total integer default 0,
  wallet_balance numeric(10,2) default 0,
  renewal_date timestamptz,
  created_at timestamptz default now() not null
);

-- Riders
create table public.riders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  phone text not null default '',
  status text default 'offline' check (status in ('available', 'busy', 'offline')),
  total_deliveries integer default 0,
  free_rides_remaining integer default 0,
  current_location jsonb,
  last_location_update timestamptz,
  earnings_this_month numeric(10,2) default 0,
  created_at timestamptz default now() not null
);

-- Deliveries
create table public.deliveries (
  id uuid default uuid_generate_v4() primary key,
  business_id uuid references public.businesses(id) on delete cascade not null,
  rider_id uuid references public.riders(id) on delete set null,
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  dropoff_address text not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  estimated_duration integer not null default 0,
  actual_duration integer,
  price numeric(10,2) default 0,
  rider_commission numeric(10,2) default 0,
  status text default 'pending' check (status in ('pending', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
  payment_method text default 'payg' check (payment_method in ('subscription', 'wallet', 'pack', 'payg')),
  created_at timestamptz default now() not null,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz
);

-- Transactions
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('subscription', 'top_up', 'commission', 'payout', 'delivery_charge')),
  amount numeric(10,2) not null,
  payment_method text not null default '',
  status text default 'pending' check (status in ('pending', 'completed', 'failed')),
  description text not null default '',
  created_at timestamptz default now() not null
);

-- Rider locations (tracking history)
create table public.rider_locations (
  id uuid default uuid_generate_v4() primary key,
  rider_id uuid references public.riders(id) on delete cascade not null,
  location jsonb not null,
  heading double precision default 0,
  speed double precision default 0,
  accuracy double precision default 0,
  timestamp timestamptz default now() not null
);

-- ============================================
-- INDEXES
-- ============================================

create index idx_businesses_user_id on public.businesses(user_id);
create index idx_riders_user_id on public.riders(user_id);
create index idx_riders_status on public.riders(status);
create index idx_deliveries_business_id on public.deliveries(business_id);
create index idx_deliveries_rider_id on public.deliveries(rider_id);
create index idx_deliveries_status on public.deliveries(status);
create index idx_transactions_user_id on public.transactions(user_id);
create index idx_rider_locations_rider_id on public.rider_locations(rider_id);

-- ============================================
-- AUTO-CREATE PROFILE ON AUTH SIGNUP
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'business'),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.riders enable row level security;
alter table public.deliveries enable row level security;
alter table public.transactions enable row level security;
alter table public.rider_locations enable row level security;

-- Helper: get current user's role
create or replace function public.get_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- PROFILES policies
create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.get_user_role() = 'admin');

-- BUSINESSES policies
create policy "Business owners can read own business"
  on public.businesses for select
  using (user_id = auth.uid());

create policy "Business owners can update own business"
  on public.businesses for update
  using (user_id = auth.uid());

create policy "Admins can read all businesses"
  on public.businesses for select
  using (public.get_user_role() = 'admin');

create policy "Riders can read businesses for delivery info"
  on public.businesses for select
  using (public.get_user_role() = 'rider');

-- RIDERS policies
create policy "Riders can read own profile"
  on public.riders for select
  using (user_id = auth.uid());

create policy "Riders can update own profile"
  on public.riders for update
  using (user_id = auth.uid());

create policy "Admins can read all riders"
  on public.riders for select
  using (public.get_user_role() = 'admin');

create policy "Businesses can read available riders"
  on public.riders for select
  using (public.get_user_role() = 'business');

-- DELIVERIES policies
create policy "Businesses can read own deliveries"
  on public.deliveries for select
  using (
    business_id in (select id from public.businesses where user_id = auth.uid())
  );

create policy "Businesses can create deliveries"
  on public.deliveries for insert
  with check (
    business_id in (select id from public.businesses where user_id = auth.uid())
  );

create policy "Riders can read assigned and pending deliveries"
  on public.deliveries for select
  using (
    rider_id in (select id from public.riders where user_id = auth.uid())
    or (status = 'pending' and rider_id is null)
  );

create policy "Riders can update assigned deliveries"
  on public.deliveries for update
  using (
    rider_id in (select id from public.riders where user_id = auth.uid())
    or (status = 'pending' and rider_id is null)
  );

create policy "Admins can read all deliveries"
  on public.deliveries for select
  using (public.get_user_role() = 'admin');

-- TRANSACTIONS policies
create policy "Users can read own transactions"
  on public.transactions for select
  using (user_id = auth.uid());

create policy "Users can create own transactions"
  on public.transactions for insert
  with check (user_id = auth.uid());

create policy "Admins can read all transactions"
  on public.transactions for select
  using (public.get_user_role() = 'admin');

-- RIDER_LOCATIONS policies
create policy "Riders can insert own locations"
  on public.rider_locations for insert
  with check (
    rider_id in (select id from public.riders where user_id = auth.uid())
  );

create policy "Admins can read all locations"
  on public.rider_locations for select
  using (public.get_user_role() = 'admin');

create policy "Businesses can read rider locations for their deliveries"
  on public.rider_locations for select
  using (public.get_user_role() = 'business');

-- ============================================
-- ENABLE REALTIME
-- ============================================

alter publication supabase_realtime add table public.deliveries;
alter publication supabase_realtime add table public.riders;
alter publication supabase_realtime add table public.businesses;
