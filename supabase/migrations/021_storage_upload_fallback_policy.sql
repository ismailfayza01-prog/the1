-- Fallback insert policy to unblock authenticated rider PoD uploads.
do $$
begin
  execute $sql$
    drop policy if exists "Authenticated can upload PoD photo (fallback)" on storage.objects;
    create policy "Authenticated can upload PoD photo (fallback)"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'delivery-pod');
  $sql$;
exception
  when insufficient_privilege or undefined_table then
    raise notice 'Skipping fallback storage upload policy';
end $$;
