# Database & Authentication — Supabase

This document covers everything needed to replace the in-memory prototype data with a real Supabase backend.

---

## Why Supabase

- Hosted PostgreSQL database with a generous free tier (500 MB, 50,000 monthly active users)
- Built-in authentication — email/password, magic links, OAuth providers
- Row-Level Security (RLS) — enforces per-business data isolation at the database level, not the app level
- Realtime — built-in WebSocket subscriptions for live job updates (see [NOTIFICATIONS.md](NOTIFICATIONS.md))
- Storage — file uploads (job photos) with access policies
- Works perfectly with Netlify and Vite/React

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project — give it a name (e.g. `dph-plumbing`), set a database password, pick the closest region (e.g. EU West)
3. Once provisioned, go to **Project Settings → API** and copy:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
4. Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Add `.env.local` to `.gitignore` (it's likely already there).

---

## 2. Install the Supabase client

```bash
npm install @supabase/supabase-js
```

Create `src/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

---

## 3. Database schema

Run the following SQL in the Supabase **SQL Editor** (Dashboard → SQL Editor → New query).

### businesses

Supports multi-client — each business that signs up gets one row. All other tables reference `business_id`.

```sql
create table businesses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text,
  address     text,
  vat_number  text,
  accent_color text default '#f97316',
  logo_initials text default 'BIZ',
  xero_connected boolean default false,
  xero_email  text,
  created_at  timestamptz default now()
);
```

### profiles

One row per user, linked to `auth.users` via `id`. Stores role and home address.

```sql
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  business_id uuid references businesses(id) on delete cascade,
  name        text not null,
  phone       text,
  role        text check (role in ('master', 'engineer')) default 'engineer',
  avatar      text,   -- two-letter initials e.g. "TB"
  home_address text,
  created_at  timestamptz default now()
);

-- Automatically create a profile stub when a new auth user signs up
create function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

### jobs

```sql
create table jobs (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid references businesses(id) on delete cascade not null,
  ref             text not null,           -- e.g. DPH-007
  customer        text not null,
  address         text not null,
  type            text not null,
  description     text default '',
  assigned_to     uuid references profiles(id),
  status          text check (status in (
                    'Scheduled', 'En Route', 'On Site', 'Completed', 'Invoiced'
                  )) default 'Scheduled',
  priority        text check (priority in (
                    'Emergency', 'High', 'Normal', 'Low'
                  )) default 'Normal',
  date            date not null,
  materials       text default '',
  notes           text default '',
  time_spent      numeric(5,2) default 0,
  ready_to_invoice boolean default false,
  xero_invoice_id text,                    -- set once pushed to Xero
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Auto-update updated_at
create function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger jobs_updated_at
  before update on jobs
  for each row execute function update_updated_at();
```

### job_photos

Photos stored in Supabase Storage, with a reference row here.

```sql
create table job_photos (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid references jobs(id) on delete cascade not null,
  storage_path text not null,   -- path in the "job-photos" storage bucket
  caption     text default '',
  uploaded_by uuid references profiles(id),
  created_at  timestamptz default now()
);
```

### notifications

```sql
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  for_user    uuid references profiles(id), -- null means "for all masters"
  for_role    text,                          -- 'master' or null
  icon        text default '🔔',
  message     text not null,
  read        boolean default false,
  created_at  timestamptz default now()
);
```

---

## 4. Row-Level Security (RLS)

RLS ensures engineers can only see their own business's data — even if someone guesses another job's UUID.

```sql
-- Enable RLS on all tables
alter table businesses      enable row level security;
alter table profiles        enable row level security;
alter table jobs            enable row level security;
alter table job_photos      enable row level security;
alter table notifications   enable row level security;

-- Helper function: get current user's business_id
create function my_business_id()
returns uuid as $$
  select business_id from profiles where id = auth.uid()
$$ language sql stable security definer;

-- businesses: members can read their own, masters can update
create policy "members read own business"
  on businesses for select
  using (id = my_business_id());

create policy "masters update own business"
  on businesses for update
  using (id = my_business_id() and exists (
    select 1 from profiles where id = auth.uid() and role = 'master'
  ));

-- profiles: members read profiles in their business
create policy "members read own business profiles"
  on profiles for select
  using (business_id = my_business_id());

-- jobs: members read all jobs in their business
create policy "members read business jobs"
  on jobs for select
  using (business_id = my_business_id());

-- jobs: engineers can only update jobs assigned to them
create policy "engineers update own jobs"
  on jobs for update
  using (
    business_id = my_business_id() and (
      assigned_to = auth.uid() or
      exists (select 1 from profiles where id = auth.uid() and role = 'master')
    )
  );

-- jobs: only masters can insert
create policy "masters insert jobs"
  on jobs for insert
  with check (
    business_id = my_business_id() and
    exists (select 1 from profiles where id = auth.uid() and role = 'master')
  );

-- job_photos: members of same business can read; assigned engineer or master can insert
create policy "members read job photos"
  on job_photos for select
  using (exists (
    select 1 from jobs j where j.id = job_id and j.business_id = my_business_id()
  ));

create policy "members insert job photos"
  on job_photos for insert
  with check (exists (
    select 1 from jobs j where j.id = job_id and j.business_id = my_business_id()
  ));

-- notifications: users can read their own
create policy "users read own notifications"
  on notifications for select
  using (
    business_id = my_business_id() and (
      for_user = auth.uid() or
      (for_role = 'master' and exists (
        select 1 from profiles where id = auth.uid() and role = 'master'
      ))
    )
  );
```

---

## 5. Storage — job photos

In the Supabase dashboard → Storage, create a new bucket called `job-photos`. Set it to **private**.

Add a storage policy so authenticated members of a business can upload:

```sql
create policy "members upload job photos"
  on storage.objects for insert
  with check (
    bucket_id = 'job-photos' and
    auth.uid() is not null
  );

create policy "members read job photos"
  on storage.objects for select
  using (
    bucket_id = 'job-photos' and
    auth.uid() is not null
  );
```

In the app, replace the base64 photo approach in `JobDetailPage.tsx` with:

```ts
// Upload
const file = e.target.files[0];
const path = `${businessId}/${jobId}/${Date.now()}-${file.name}`;
await supabase.storage.from('job-photos').upload(path, file);
await supabase.from('job_photos').insert({ job_id: jobId, storage_path: path });

// Display (get a signed URL valid for 1 hour)
const { data } = await supabase.storage
  .from('job-photos')
  .createSignedUrl(photo.storage_path, 3600);
```

---

## 6. Authentication setup

Supabase Auth handles email/password sign-in out of the box.

**In the Supabase dashboard → Authentication → Providers:**
- Email: enabled (email confirmations optional — disable for internal tools)

**In the app**, replace the mock `login` function in `AppContext.tsx`:

```ts
import { supabase } from './supabase';

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

// Sign out
await supabase.auth.signOut();

// Get current session on app load
const { data: { session } } = await supabase.auth.getSession();

// Listen for auth changes
supabase.auth.onAuthStateChange((_event, session) => {
  setCurrentUser(session?.user ?? null);
});
```

After sign-in, fetch the user's profile to get their role and business:

```ts
const { data: profile } = await supabase
  .from('profiles')
  .select('*, businesses(*)')
  .eq('id', session.user.id)
  .single();
```

---

## 7. Replacing mock data queries

| Current (prototype) | Replace with |
|---|---|
| `useState(INITIAL_JOBS)` | `supabase.from('jobs').select('*, profiles(*)').eq('business_id', businessId)` |
| `setJobs(...)` on status change | `supabase.from('jobs').update({ status }).eq('id', jobId)` |
| `setJobs(...)` on new job | `supabase.from('jobs').insert({...}).select().single()` |
| `setBusiness(...)` | `supabase.from('businesses').update({...}).eq('id', businessId)` |

Use React Query or SWR to manage loading/error states when data comes from Supabase.

---

## 8. Recommended next package

```bash
npm install @tanstack/react-query
```

React Query handles caching, refetching, loading states, and optimistic updates — pairs very well with Supabase.
