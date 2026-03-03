-- Admin-only wallet credit controls.

-- 1) Allow admins to insert transactions for customer ledger entries.
drop policy if exists "Admins can create transactions" on public.transactions;
create policy "Admins can create transactions"
  on public.transactions for insert
  with check (public.get_user_role() = 'admin');

-- 2) Prevent non-admin users from increasing wallet balance directly.
create or replace function public.prevent_non_admin_wallet_credit()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.wallet_balance, 0) > coalesce(old.wallet_balance, 0)
     and public.get_user_role() <> 'admin' then
    raise exception 'Only admin can increase wallet balance';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_non_admin_wallet_credit on public.businesses;
create trigger trg_prevent_non_admin_wallet_credit
before update of wallet_balance on public.businesses
for each row
execute function public.prevent_non_admin_wallet_credit();
