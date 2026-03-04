-- Rider commission ladder:
-- starts at 12.5 MAD, +0.5 MAD every 20 monthly completed deliveries, capped at 17 MAD.

create or replace function public.get_rider_commission_for_deliveries(p_deliveries integer)
returns numeric
language sql
immutable
as $$
  select least(17::numeric, 12.5::numeric + floor(greatest(p_deliveries, 0)::numeric / 20::numeric) * 0.5::numeric);
$$;

create or replace function public.get_rider_monthly_commission(
  p_rider_id uuid,
  p_reference timestamptz default now()
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start timestamptz := date_trunc('month', p_reference);
  v_month_end timestamptz := date_trunc('month', p_reference) + interval '1 month';
  v_completed_count integer := 0;
begin
  if p_rider_id is null then
    return public.get_rider_commission_for_deliveries(0);
  end if;

  select count(*)::integer into v_completed_count
  from public.deliveries d
  where d.rider_id = p_rider_id
    and d.status = 'delivered'
    and coalesce(d.completed_at, d.delivered_at, d.created_at) >= v_month_start
    and coalesce(d.completed_at, d.delivered_at, d.created_at) < v_month_end;

  return public.get_rider_commission_for_deliveries(v_completed_count);
end;
$$;

create or replace function public.apply_rider_commission_ladder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rider_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.rider_commission := public.get_rider_monthly_commission(new.rider_id, coalesce(new.accepted_at, now()));
    return new;
  end if;

  if new.rider_id is distinct from old.rider_id then
    new.rider_commission := public.get_rider_monthly_commission(new.rider_id, coalesce(new.accepted_at, now()));
    return new;
  end if;

  if old.status is distinct from new.status and new.status = 'accepted' then
    new.rider_commission := public.get_rider_monthly_commission(new.rider_id, coalesce(new.accepted_at, now()));
    return new;
  end if;

  if coalesce(old.rider_commission, 0) = 0 and coalesce(new.rider_commission, 0) = 0 then
    new.rider_commission := public.get_rider_monthly_commission(new.rider_id, coalesce(new.accepted_at, now()));
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_rider_commission_ladder on public.deliveries;
create trigger trg_apply_rider_commission_ladder
  before insert or update on public.deliveries
  for each row
  execute function public.apply_rider_commission_ladder();

alter table public.deliveries
  alter column rider_commission set default 12.5;

