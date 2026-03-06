-- Push subscription endpoints for rider offer notifications.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  created_at timestamptz default now() not null,
  constraint push_subscriptions_user_id_key unique (user_id)
);

alter table public.push_subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'push_subscriptions'
      and policyname = 'Users can manage own push subscription'
  ) then
    create policy "Users can manage own push subscription"
      on public.push_subscriptions
      for all
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end $$;

grant select, insert, update, delete on table public.push_subscriptions to authenticated;

comment on table public.push_subscriptions is 'Web Push subscription endpoints for rider notifications';
