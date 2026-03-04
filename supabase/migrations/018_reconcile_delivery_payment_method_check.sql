-- Ensure COD is a valid delivery payment method while preserving legacy values.
alter table public.deliveries
  drop constraint if exists deliveries_payment_method_check;

alter table public.deliveries
  add constraint deliveries_payment_method_check
  check (payment_method in ('subscription', 'wallet', 'pack', 'payg', 'cod'));
