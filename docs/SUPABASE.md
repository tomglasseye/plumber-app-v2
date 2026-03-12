# Database & Authentication — Supabase

The app is fully connected to Supabase for database, authentication, and real-time notifications. This document covers how to set up a new Supabase instance and run the migrations.

---

## Why Supabase

- Hosted PostgreSQL with a generous free tier (500 MB, 50,000 monthly active users)
- Built-in authentication — email/password, magic links, OAuth providers
- Row-Level Security (RLS) — enforces per-business data isolation at the database level
- Realtime — WebSocket subscriptions for live job updates (see [NOTIFICATIONS.md](NOTIFICATIONS.md))
- Storage — file uploads (job photos) with access policies
- Works perfectly with Netlify and Vite/React

---

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project — give it a name, set a database password, pick the closest region
3. Once provisioned, go to **Project Settings → API** and copy:
    - `Project URL` → `VITE_SUPABASE_URL`
    - `anon public` key → `VITE_SUPABASE_ANON_KEY`
    - `service_role secret` key → for Netlify env vars only (see below)
4. Create a `.env.local` file in the project root:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The **service role key** is needed by the Netlify Function for admin operations (e.g. master resetting another user's password). Add it as a Netlify environment variable — **not** in `.env.local` and **not** prefixed with `VITE_`:

| Netlify env var             | Value                          |
| --------------------------- | ------------------------------ |
| `SUPABASE_URL`              | Same as VITE_SUPABASE_URL      |
| `SUPABASE_ANON_KEY`         | Same as VITE_SUPABASE_ANON_KEY |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret key        |

Add `.env.local` to `.gitignore` (it's likely already there).

---

## 2. Supabase client

Already installed and configured in `src/supabase.ts`. The client uses the **anon key** only — the service role key never touches the browser:

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

Admin operations (e.g. resetting another user's password) are handled by a Netlify Function at `netlify/functions/admin-update-password.ts`, which holds the service role key server-side.

---

## 3. Database schema

Run `1_schema.sql` then `2_seed.sql` in the Supabase **SQL Editor** (Dashboard → SQL Editor → New query), then run each migration file in order (`3_migration.sql` through `7_migration.sql`).

The full current schema (after all migrations) is described below.

### businesses

Supports multi-client — each business gets one row. All other tables reference `business_id`.

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

One row per user, linked to `auth.users` via `id`. Stores role, home address, and accent colour.

```sql
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  business_id  uuid references businesses(id) on delete cascade,
  name         text not null,
  phone        text,
  role         text check (role in ('master', 'engineer')) default 'engineer',
  avatar       text,        -- two-letter initials e.g. "TB"
  home_address text,
  accent_color text default '#f97316',   -- added in migration 3
  created_at   timestamptz default now()
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
  phone           text default '',         -- added in migration 7
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
  sort_order      integer default 0,       -- added in migration 4
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

### repeat_tasks (migration 6)

Recurring jobs (boiler services, annual checks) that generate reminders when due.

```sql
create table repeat_tasks (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid references businesses(id) on delete cascade not null,
  customer          text not null,
  address           text not null,
  type              text not null default 'Boiler Service',
  description       text default '',
  frequency         text check (frequency in ('annually', 'biannually', 'quarterly')) default 'annually',
  next_due_date     date not null,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
```

### job_photos

Photos stored in Supabase Storage, with a reference row here. (Upload not yet wired up — see section 5.)

```sql
create table job_photos (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid references jobs(id) on delete cascade not null,
  storage_path text not null,
  caption     text default '',
  uploaded_by uuid references profiles(id),
  created_at  timestamptz default now()
);
```

### notifications

```sql
create table notifications (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid references businesses(id) on delete cascade not null,
  for_user        uuid references profiles(id),
  for_role        text,
  icon            text default '🔔',
  message         text not null,
  read            boolean default false,
  job_id          uuid references jobs(id) on delete set null,          -- migration 3
  repeat_task_id  uuid references repeat_tasks(id) on delete set null,  -- migration 6
  created_at      timestamptz default now()
);
```

---

## 4. Row-Level Security (RLS)

RLS is enabled on all tables. It ensures users can only access their own business's data — even if someone guesses another record's UUID.

The base policies are in `1_schema.sql`. Migration 5 adds profile update policies and an `is_master()` helper.

### Helper functions

```sql
-- Get current user's business_id (defined in 1_schema.sql)
create function my_business_id()
returns uuid as $$
  select business_id from profiles where id = auth.uid()
$$ language sql stable security definer;

-- Returns true if the current user is a master (defined in 5_migration.sql)
create function is_master()
  returns boolean
  language sql stable security definer
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'master')
$$;
```

### Key policies (summary)

| Table         | Select                | Insert         | Update                          | Delete       |
| ------------- | --------------------- | -------------- | ------------------------------- | ------------ |
| businesses    | Own business          | —              | Masters only                    | —            |
| profiles      | Own business          | Auto (trigger) | Own profile OR masters for team | —            |
| jobs          | Own business          | Masters only   | Assigned engineer OR masters    | —            |
| job_photos    | Own business          | Own business   | —                               | —            |
| notifications | Own (by user or role) | —              | —                               | —            |
| repeat_tasks  | Masters only          | Masters only   | Masters only                    | Masters only |

Full SQL is in `1_schema.sql` (base), `5_migration.sql` (profile updates), and `6_migration.sql` (repeat_tasks).

---

## 5. Storage — job photos (not yet wired up)

The `job_photos` table exists but uploads are not yet connected to Supabase Storage. Currently photos use base64 strings in the UI.

**To set up when ready:**

1. In the Supabase dashboard → Storage, create a bucket called `job-photos` (set to **private**)
2. Add storage policies:

```sql
create policy "members upload job photos"
  on storage.objects for insert
  with check (bucket_id = 'job-photos' and auth.uid() is not null);

create policy "members read job photos"
  on storage.objects for select
  using (bucket_id = 'job-photos' and auth.uid() is not null);
```

3. Replace the base64 approach in `JobDetailPage.tsx` with:

```ts
// Upload
const file = e.target.files[0];
const path = `${businessId}/${jobId}/${Date.now()}-${file.name}`;
await supabase.storage.from("job-photos").upload(path, file);
await supabase.from("job_photos").insert({ job_id: jobId, storage_path: path });

// Display (get a signed URL valid for 1 hour)
const { data } = await supabase.storage
	.from("job-photos")
	.createSignedUrl(photo.storage_path, 3600);
```

---

## 6. Authentication

Supabase Auth is fully connected. `LoginPage.tsx` handles sign-in, `AppContext.tsx` manages the session.

**In the Supabase dashboard → Authentication → Providers:**

- Email: enabled (email confirmations optional — disable for internal tools)

### URL Configuration (required for password reset)

Go to **Supabase dashboard → Authentication → URL Configuration** and set:

| Field             | Value                                              |
| ----------------- | -------------------------------------------------- |
| **Site URL**      | `https://your-app.netlify.app` (your deployed URL) |
| **Redirect URLs** | `https://your-app.netlify.app`                     |

For local development, also add `http://localhost:5173` to the **Redirect URLs** list.

### Password reset flow

The "Forgot password?" link calls `supabase.auth.resetPasswordForEmail(email)`. Supabase then:

1. Sends a password reset email to the user
2. When they click the link, verifies the token and redirects to the **Site URL**
3. The app detects the `#access_token` hash in the URL and lets the user set a new password

> **Note:** Supabase's built-in email sender is rate-limited to ~4 emails/hour on the free tier. For production, configure a real SMTP provider under **Authentication → SMTP Settings** (SendGrid, Postmark, Mailgun, or any SMTP server).

### Login security

The app includes client-side brute-force protection:

- 5 failed attempts triggers a 15-minute lockout
- Lockout is persisted to `localStorage` (survives page refresh)
- Button shows countdown timer during lockout

---

## 7. Migration changelog

Run these in the Supabase SQL Editor **after** applying `1_schema.sql` and `2_seed.sql`.

| File              | What it does                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `3_migration.sql` | Adds `accent_color` column to `profiles`; adds `job_id` column to `notifications` for click-through navigation                     |
| `4_migration.sql` | Adds `sort_order` column to `jobs` for master-controlled daily scheduling order                                                    |
| `5_migration.sql` | Creates `is_master()` helper function; adds RLS policies for users to update their own profile and masters to update team profiles |
| `6_migration.sql` | Creates `repeat_tasks` table with frequency/due-date; adds `repeat_task_id` to `notifications`; RLS: masters-only CRUD             |
| `7_migration.sql` | Adds `phone` column to `jobs` for client phone numbers                                                                             |
