-- Dispatch reliability patch: widen candidate selection and return explicit no-rider signal.
create or replace function public.dispatch_delivery(
  p_delivery_id uuid,
  p_preferred_rider_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_delivery public.deliveries;
  v_rider public.riders;
begin
  if v_actor is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_delivery
  from public.deliveries
  where id = p_delivery_id
  for update;

  if not found then
    raise exception 'Delivery not found';
  end if;

  if not (
    public.is_admin(v_actor)
    or exists (
      select 1
      from public.businesses b
      where b.id = v_delivery.business_id
        and b.user_id = v_actor
    )
  ) then
    raise exception 'Forbidden';
  end if;

  if v_delivery.status not in ('pending', 'offered') then
    return jsonb_build_object(
      'ok', false,
      'reason', 'invalid_status',
      'status', v_delivery.status
    );
  end if;

  if p_preferred_rider_user_id is not null then
    select * into v_rider
    from public.riders r
    where r.user_id = p_preferred_rider_user_id
      and r.status = 'available'
    order by coalesce(r.last_seen_at, r.created_at) desc
    limit 1;
  end if;

  if not found then
    select * into v_rider
    from public.riders r
    where r.status = 'available'
      and (r.last_seen_at is null or r.last_seen_at >= now() - interval '10 minutes')
    order by coalesce(r.last_seen_at, r.created_at) desc, r.total_deliveries asc
    limit 1;
  end if;

  if not found then
    select * into v_rider
    from public.riders r
    where r.status = 'available'
    order by coalesce(r.last_seen_at, r.created_at) desc, r.total_deliveries asc
    limit 1;
  end if;

  if not found then
    update public.deliveries
    set status = 'pending'
    where id = p_delivery_id
      and status = 'offered';

    return jsonb_build_object(
      'ok', false,
      'reason', 'no_rider_available'
    );
  end if;

  perform set_config('app.admin_override', '1', true);

  update public.deliveries
  set rider_id = v_rider.id,
      status = 'pending'
  where id = p_delivery_id;

  update public.riders
  set status = 'busy',
      last_seen_at = now()
  where id = v_rider.id;

  return jsonb_build_object(
    'ok', true,
    'delivery_id', p_delivery_id,
    'rider_id', v_rider.id,
    'rider_user_id', v_rider.user_id,
    'status', 'assigned'
  );
end;
$$;

grant execute on function public.dispatch_delivery(uuid, uuid) to authenticated;
