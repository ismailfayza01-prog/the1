-- ============================================
-- Subscription Functions & Admin RLS Policy
-- ============================================

-- ATOMIC use_ride() function
-- Prevents race conditions by doing the increment as a single atomic operation
create or replace function public.use_ride(p_business_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  updated_rows integer;
begin
  update public.businesses
  set rides_used = rides_used + 1
  where id = p_business_id
    and (
      user_id = auth.uid()
      or exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
      )
    )
    and subscription_tier != 'none'
    and rides_used < rides_total;
  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

-- ATOMIC charge_wallet() function
-- Deducts from wallet balance only if sufficient balance exists
create or replace function public.charge_wallet(p_business_id uuid, p_amount numeric)
returns boolean
language plpgsql
security definer
as $$
declare
  updated_rows integer;
begin
  update public.businesses
  set wallet_balance = wallet_balance - p_amount
  where id = p_business_id
    and (
      user_id = auth.uid()
      or exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
      )
    )
    and wallet_balance >= p_amount;
  get diagnostics updated_rows = row_count;
  return updated_rows > 0;
end;
$$;

-- Admin UPDATE RLS policy on businesses
-- Allows admins to manually adjust ride quotas, wallet balances, and subscription tiers
create policy "admins can update businesses"
  on public.businesses for update
  using (exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  ));
