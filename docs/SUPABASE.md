# Database & Authentication — Supabase

The app is fully connected to Supabase for database, authentication, and real-time notifications. This document covers how to set up a new Supabase instance and run the migrations.

> **Production note:** For the end-to-end production rollout (custom domain, SMTP, env vars, sign-off checklist), see [LAUNCH.md](LAUNCH.md). The Site URL section below in particular needs updating when the custom domain goes live.

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
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  phone          text,
  email          text,
  address        text,
  vat_number     text,
  accent_color   text default '#f97316',
  logo_initials  text default 'BIZ',
  xero_connected boolean default false,
  xero_email     text,
  work_day_start smallint default 7,   -- migration 13: calendar grid start hour (0–23)
  work_day_end   smallint default 17,  -- migration 13: calendar grid end hour (1–24)
  created_at     timestamptz default now()
);
```

### profiles

One row per user, linked to `auth.users` via `id`. Stores role, home address, and accent colour.

```sql
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  business_id       uuid references businesses(id) on delete cascade,
  name              text not null,
  phone             text,
  role              text check (role in ('master', 'engineer')) default 'engineer',
  avatar            text,        -- two-letter initials e.g. "TB"
  home_address      text,
  accent_color      text default '#f97316',   -- added in migration 3
  locked            boolean not null default false,  -- migration 14: master can lock engineer accounts
  holiday_allowance integer default 28,              -- migration 17: annual leave days (UK default 28)
  created_at        timestamptz default now()
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
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid references businesses(id) on delete cascade not null,
  ref              text not null,           -- e.g. DPH-007
  customer         text not null,
  phone            text default '',         -- migration 7
  address          text not null,
  description      text default '',
  assigned_to      uuid references profiles(id),
  status           text check (status in (
                     'Scheduled', 'En Route', 'On Site', 'Completed', 'Invoiced'
                   )) default 'Scheduled',
  priority         text check (priority in (
                     'Emergency', 'High', 'Normal', 'Low'
                   )) default 'Normal',
  date             date not null,
  end_date         date,                    -- migration 9: inclusive end for multi-day
  start_time       text,                    -- migration 9: 'HH:MM'
  end_time         text,                    -- migration 9: 'HH:MM'
  category_id      uuid references categories(id) on delete set null,  -- migration 9
  customer_id      uuid references customers(id) on delete set null,   -- migration 8
  repeat_frequency text check (repeat_frequency in (
                     'annually', 'biannually', 'quarterly'
                   )),                      -- migration 12
  materials        text default '',
  materials_cost   numeric(8,2) default 0, -- migration 19: cost of materials used
  notes            text default '',
  time_spent       numeric(5,2) default 0,
  sort_order       integer default 0,       -- migration 4
  ready_to_invoice boolean default false,
  xero_invoice_id  text,                    -- set once pushed to Xero
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
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

### customers (migration 8)

Contact/customer records that can be linked to jobs.

```sql
create table customers (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid references businesses(id) on delete cascade not null,
  name            text not null,
  email           text not null,
  phone           text default '',
  address         text default '',
  notes           text default '',
  xero_contact_id text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
```

### categories (migration 9)

Job categories with icon and colour, used to tag jobs.

```sql
create table categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  name        text not null,
  icon        text not null default 'Wrench',  -- Lucide icon name
  color       text not null default '#f97316',
  sort_order  integer default 0,
  created_at  timestamptz default now()
);
```

### team_holidays (migration 9)

Leave/absence records for engineers. Shown on the calendar alongside jobs.

```sql
create table team_holidays (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  profile_id  uuid references profiles(id) on delete cascade not null,
  date        date not null,                   -- start date
  end_date    date,                            -- migration 11: inclusive end for multi-day
  half_day    boolean default false,
  label       text default 'Holiday',
  type        text default 'holiday'           -- migration 10
              check (type in ('holiday', 'sick', 'training', 'other')),
  status      text default 'approved'          -- migration 17: approval workflow
              check (status in ('pending', 'approved', 'declined')),
  created_at  timestamptz default now()
);
```

Engineers submit leave requests as `pending`. Masters approve or decline. The default is `'approved'` for backward compatibility with entries created before migration 17.

> **repeat_tasks (dropped in migration 12):** The `repeat_tasks` table previously held recurring job reminders as a separate concept. In migration 12 this was unified — `repeat_frequency` is now a column on the `jobs` table directly, and `repeat_tasks` was dropped.

### audit_log (migration 16)

Tamper-proof record of admin actions. Client code can only write via the `log_audit_event()` security-definer function — direct inserts are blocked by RLS.

```sql
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,   -- e.g. 'job.status_changed', 'profile.locked'
  target_type text,            -- 'job', 'profile', 'business'
  target_id   text,            -- UUID of affected record
  details     jsonb,           -- structured data (old/new values, ref, etc.)
  created_at  timestamptz default now()
);
```

Recorded actions: `job.created`, `job.status_changed`, `job.priority_changed`, `job.field_updated`, `job.rescheduled`, `job.final_completed`, `business.settings_updated`, `profile.locked`, `profile.unlocked`, `profile.deleted`, `auth.password_change_self`, `auth.password_changed_by_master`.

### push_subscriptions (migration 20)

Stores Web Push subscriptions so the server can target specific users.

```sql
create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);
```

### super_admins (migration 21)

Separate from the `business_id` / `role` system. Super admins have no `business_id` and are locked out of all tenant data by the existing RLS policies.

```sql
create table super_admins (
  id         uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
```

To grant super admin access, insert manually:

```sql
insert into super_admins (id)
values ((select id from auth.users where email = 'you@yourapp.com'));
```

### job_photos

Photos stored in Supabase Storage, with a reference row here. Fully wired up via `src/components/JobPhotos.tsx` — see section 5.

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
  id          uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  for_user    uuid references profiles(id),
  for_role    text,
  icon        text default '🔔',
  message     text not null,
  read        boolean default false,
  job_id      uuid references jobs(id) on delete set null,  -- migration 3
  created_at  timestamptz default now()
);
```

> **Note:** `repeat_task_id` was present in earlier versions but was removed when the `repeat_tasks` table was dropped in migration 12.

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

| Table               | Select                      | Insert                              | Update                          | Delete                       |
| ------------------- | --------------------------- | ----------------------------------- | ------------------------------- | ---------------------------- |
| businesses          | Own business                | —                                   | Masters only                    | —                            |
| profiles            | Own business                | Auto (trigger)                      | Own profile OR masters for team | Masters (not self)           |
| jobs                | Own business                | Masters only                        | Assigned engineer OR masters    | —                            |
| job_photos          | Own business                | Own business                        | —                               | Own upload OR masters        |
| notifications       | Own (by user or role)       | —                                   | —                               | —                            |
| customers           | Own business                | Masters only                        | Masters only                    | Masters only                 |
| categories          | Own business                | Masters only                        | Masters only                    | Masters only                 |
| team_holidays       | Own business                | Masters OR engineers (own, pending) | Masters OR engineers (own, pending) | Masters OR engineers (own, pending) |
| audit_log           | Masters (own business only) | Via `log_audit_event()` only        | —                               | —                            |
| push_subscriptions  | Own row only                | Own row only                        | Own row only                    | Own row only                 |
| super_admins        | Own row only                | Manual SQL only                     | —                               | —                            |

Super admins have additional SELECT/INSERT/UPDATE/DELETE policies on all tenant tables (migration 22).

Full SQL is in `1_schema.sql` (base), `5_migration.sql` (profile updates), `8_migration.sql` (customers), `9_migration.sql` (categories, team_holidays), `15_migration.sql` (profile delete), `16_migration.sql` (audit_log), `17_migration.sql` (holiday requests), and `22_migration.sql` (super admin bypass).

---

## 5. Storage — job photos

Job photos are stored in Supabase Storage and fully wired up via `src/components/JobPhotos.tsx`.

**One-time setup** (already done for the main instance):

1. In the Supabase dashboard → Storage, create a private bucket called `job-photos`
2. Run `19_migration.sql` — adds `materials_cost` to `jobs`, creates storage policies, and adds a trigger to enforce the 2-photo-per-job limit server-side

**How it works:**

- Images are resized to max 1200 px wide client-side before upload (JPEG, 85% quality)
- Each photo is stored at path `{jobId}/{uuid}.{ext}`
- Signed URLs (1-hour expiry) are fetched on component mount for display
- Masters and the uploader can delete photos; others can only view
- A database trigger (`enforce_job_photo_limit`) raises an exception if a third photo is attempted

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

| File               | What it does                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `3_migration.sql`  | Adds `accent_color` column to `profiles`; adds `job_id` column to `notifications` for click-through navigation                     |
| `4_migration.sql`  | Adds `sort_order` column to `jobs` for master-controlled daily scheduling order                                                    |
| `5_migration.sql`  | Creates `is_master()` helper function; adds RLS policies for users to update their own profile and masters to update team profiles |
| `6_migration.sql`  | Creates `repeat_tasks` table with frequency/due-date; adds `repeat_task_id` to `notifications`; RLS: masters-only CRUD             |
| `7_migration.sql`  | Adds `phone` column to `jobs` for client phone numbers                                                                             |
| `8_migration.sql`  | Creates `customers` table (contacts); adds `customer_id` FK to `jobs` and `repeat_tasks`; RLS: members read, masters write         |
| `9_migration.sql`  | Creates `categories` table; creates `team_holidays` table; adds `category_id`, `start_time`, `end_time`, `end_date` to `jobs`      |
| `10_migration.sql` | Adds `type` column to `team_holidays` (`holiday`, `sick`, `training`, `other`)                                                     |
| `11_migration.sql` | Adds `end_date` column to `team_holidays` for multi-day leave entries                                                              |
| `12_migration.sql` | Drops legacy `jobs.type` column; adds `repeat_frequency` to `jobs`; drops `repeat_tasks` table (recurring moved into jobs)         |
| `13_migration.sql` | Adds `work_day_start` (default 7) and `work_day_end` (default 17) to `businesses` — controls calendar time grid and working hours shading |
| `14_migration.sql` | Adds `locked boolean not null default false` to `profiles` — masters can lock engineer accounts to prevent login                    |
| `15_migration.sql` | Adds RLS DELETE policy for masters to remove team profiles; adds CHECK constraints for field lengths on `businesses`, `profiles`, `jobs`, `customers` |
| `16_migration.sql` | Creates `audit_log` table and `log_audit_event()` security-definer function — tamper-proof record of admin actions, writable only via the function |
| `17_migration.sql` | Adds `status` column to `team_holidays` (`pending`/`approved`/`declined`); adds `holiday_allowance` to `profiles`; adds RLS policies allowing engineers to submit and cancel their own pending requests |
| `18_migration.sql` | Enables Supabase Realtime on `jobs` and `team_holidays`; sets `REPLICA IDENTITY FULL` so UPDATE payloads include the complete row |
| `19_migration.sql` | Adds `materials_cost numeric(8,2)` to `jobs`; creates `job-photos` Storage bucket policies; adds `enforce_job_photo_limit` trigger (max 2 photos per job) |
| `20_migration.sql` | Creates `push_subscriptions` table for Web Push; RLS: users manage own subscriptions |
| `21_migration.sql` | Creates `super_admins` table and `is_super_admin()` helper function |
| `22_migration.sql` | Adds RLS policies granting super admins read/write access to all tenant tables (`businesses`, `profiles`, `jobs`, `job_photos`, `customers`, `categories`, `notifications`, `team_holidays`) |
| `23_migration.sql` | Replaces overly-broad `job-photos` Storage bucket policies with business-scoped versions — SELECT/DELETE check via `job_photos → jobs → business_id`, INSERT checks that `jobId` path segment belongs to the user's business |
| `24_migration.sql` | Adds `guard_profile_sensitive_columns` trigger preventing engineers from changing `role`, `business_id`, or `locked` on their own profile; replaces `log_audit_event()` with version that validates action names and restricts admin-only actions to masters |
