-- Helper: returns true if the current user is a master (security definer bypasses RLS)
create or replace function is_master()
  returns boolean
  language sql stable security definer
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'master')
$$;

-- Allow users to update their own profile
drop policy if exists "users update own profile"     on profiles;
drop policy if exists "masters update team profiles" on profiles;

create policy "users update own profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Allow masters to update any profile in their business (e.g. colour, role, name)
create policy "masters update team profiles"
  on profiles for update
  using  (business_id = my_business_id() and is_master())
  with check (business_id = my_business_id() and is_master());
