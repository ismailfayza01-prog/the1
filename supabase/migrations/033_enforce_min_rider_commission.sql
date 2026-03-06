-- Ensure rider commission never falls below base tier (12.5 MAD).

update public.deliveries
set rider_commission = 12.5
where rider_commission is null
   or rider_commission < 12.5;

alter table public.deliveries
  alter column rider_commission set default 12.5;

alter table public.deliveries
  drop constraint if exists deliveries_rider_commission_min_check;

alter table public.deliveries
  add constraint deliveries_rider_commission_min_check
  check (rider_commission >= 12.5);

create or replace function public.enforce_min_rider_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rider_commission is null or new.rider_commission < 12.5 then
    new.rider_commission := 12.5;
  end if;
  return new;
end;
$$;

drop trigger if exists zzz_enforce_min_rider_commission on public.deliveries;
create trigger zzz_enforce_min_rider_commission
  before insert or update on public.deliveries
  for each row
  execute function public.enforce_min_rider_commission();

comment on function public.enforce_min_rider_commission()
is 'Clamps deliveries.rider_commission to at least 12.5 MAD.';
