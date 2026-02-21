-- ============================================
-- Profiles roles source-of-truth + minimal RLS
-- ============================================

-- Ensure profiles table exists with role constraint
alter table public.profiles
  alter column role set not null;

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'business', 'rider'));

-- Ensure RLS is enabled
alter table public.profiles enable row level security;

-- Helper: get current user's role
create or replace function public.get_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- Recreate signup trigger to set role from signup context (default: business)
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

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Policies

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;

create policy "Users can read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.get_user_role() = 'admin');

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid())
  );

create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.get_user_role() = 'admin')
  with check (public.get_user_role() = 'admin');
