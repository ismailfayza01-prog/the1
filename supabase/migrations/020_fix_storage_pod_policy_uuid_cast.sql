-- Prevent UUID cast errors in storage policies by using regex + text compare.
do $$
begin
  execute $sql$
    drop policy if exists "Rider can upload PoD photo" on storage.objects;
    create policy "Rider can upload PoD photo"
    on storage.objects for insert
    with check (
      bucket_id = 'delivery-pod'
      and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and exists (
        select 1
        from public.deliveries d
        join public.riders r on r.id = d.rider_id
        where r.user_id = auth.uid()
          and d.status in ('accepted','picked_up','in_transit')
          and d.id::text = split_part(name, '/', 1)
      )
    );
  $sql$;
exception
  when insufficient_privilege or undefined_table then
    raise notice 'Skipping storage policy patch: Rider can upload PoD photo';
end $$;

do $$
begin
  execute $sql$
    drop policy if exists "Rider can read own PoD photo" on storage.objects;
    create policy "Rider can read own PoD photo"
    on storage.objects for select
    using (
      bucket_id = 'delivery-pod'
      and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and exists (
        select 1
        from public.deliveries d
        join public.riders r on r.id = d.rider_id
        where r.user_id = auth.uid()
          and d.status in ('accepted','picked_up','in_transit','delivered')
          and d.id::text = split_part(name, '/', 1)
      )
    );
  $sql$;
exception
  when insufficient_privilege or undefined_table then
    raise notice 'Skipping storage policy patch: Rider can read own PoD photo';
end $$;

do $$
begin
  execute $sql$
    drop policy if exists "Business/admin can read PoD photo" on storage.objects;
    create policy "Business/admin can read PoD photo"
    on storage.objects for select
    using (
      bucket_id = 'delivery-pod'
      and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and (
        exists (
          select 1
          from public.deliveries d
          join public.businesses b on b.id = d.business_id
          where b.user_id = auth.uid()
            and d.id::text = split_part(name, '/', 1)
        )
        or exists (
          select 1
          from public.profiles p
          where p.id = auth.uid() and p.role = 'admin'
        )
      )
    );
  $sql$;
exception
  when insufficient_privilege or undefined_table then
    raise notice 'Skipping storage policy patch: Business/admin can read PoD photo';
end $$;
