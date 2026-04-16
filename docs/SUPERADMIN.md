# Superadmin & Client Onboarding

The superadmin system is fully implemented. A super admin can create new client companies, invite master users by email, and switch into any client's app without logging out.

---

## How it works

```
Super admin logs in → navigates to /admin
        ↓
Fills in company details + master's name/email
        ↓
App calls POST /.netlify/functions/create-business
        ↓
Function creates businesses row + calls supabase.auth.admin.inviteUserByEmail
        ↓
Master receives invite email, sets password, logs in
        ↓
Master adds engineers from Team page as normal
```

Super admins can also switch into any existing client's context directly from the `/admin` page — the business list shows all clients with a **Enter →** button.

---

## Database

### super_admins table (migration 21)

```sql
create table super_admins (
  id         uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
```

Super admins have no `business_id` — the existing `my_business_id()` RLS helper returns `null` for them, which automatically locks them out of all tenant data. Migration 22 adds explicit SELECT/INSERT/UPDATE/DELETE policies so they can read and write all businesses' data when needed (e.g. to switch into a client's context).

### Making someone a super admin

Insert manually in the Supabase SQL Editor — this is intentionally not self-assignable:

```sql
insert into super_admins (id)
values ((select id from auth.users where email = 'you@yourapp.com'));
```

---

## Netlify Function — `create-business`

`netlify/functions/create-business.ts` — requires a valid super admin session token in the `Authorization` header.

What it does:
1. Verifies the caller is in `super_admins`
2. Inserts a row into `businesses`
3. Calls `supabase.auth.admin.inviteUserByEmail(masterEmail)` — sends a magic-link invite
4. Creates the master's `profiles` row with `role: 'master'`

The master clicks the invite link, sets their password, and can log in immediately. They then add engineers from the Team page.

---

## Frontend — `src/pages/AdminPage.tsx`

Accessible at `/admin`. Route-guarded: non-super-admins are redirected to `/`.

The page has two sections:

**1. Client list** — all businesses from Supabase, showing name, contact details, and team member count. The currently active business is highlighted. Each other business has an **Enter →** button that calls `switchBusiness(id)` in `AppContext` and navigates to the dashboard.

**2. Create New Client form** — fields: company name, logo initials, brand colour (palette picker), phone, email, address, master's name, master's email. On submit calls `create-business`. Shows success/error inline.

---

## AppContext — detecting super admin

After loading the profile, `AppContext` checks `super_admins` for the current user's ID and exposes `isSuperAdmin: boolean`. A `switchBusiness(id)` function re-fetches all state for the target business without a full page reload.

---

## Manual onboarding (fallback)

If the Netlify Function is unavailable, you can onboard a client manually:

### Step 1 — Create auth users in Supabase Dashboard

Authentication → Users → Add user:

| Email                       | Password        | Role    |
| --------------------------- | --------------- | ------- |
| `master@newcompany.co.uk`   | strong password | master  |
| `engineer@newcompany.co.uk` | strong password | engineer |

### Step 2 — Run SQL

```sql
-- 1. Create the business row
insert into businesses (id, name, phone, email, address, accent_color, logo_initials)
values (
  gen_random_uuid(),
  'New Company Ltd',
  '01234 567890',
  'office@newcompany.co.uk',
  '1 Example Street, City AB1 2CD',
  '#3b82f6',
  'NCL'
)
returning id;  -- copy this id

-- 2. Create profiles (replace business_id and emails)
insert into profiles (id, business_id, name, phone, role, avatar)
values
  (
    (select id from auth.users where email = 'master@newcompany.co.uk'),
    '<paste-business-id-here>',
    'Jane Smith', '07700 900001',
    'master', 'JS'
  ),
  (
    (select id from auth.users where email = 'engineer@newcompany.co.uk'),
    '<paste-business-id-here>',
    'Bob Jones', '07700 900002',
    'engineer', 'BJ'
  );
```

---

## Things to watch out for

| Concern                        | Detail                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Invite expiry**              | Supabase invite links expire after 24 hours by default. Add a "resend invite" button to the admin page if needed.                     |
| **Super admin data access**    | Migration 22 gives super admins broad RLS bypass. Use with care — this is intentional to support `switchBusiness()`.                  |
| **Deleting a company**         | Cascade deletes handle all table data. Auth users must be deleted separately via the Supabase admin API (service role).               |
| **Master inviting engineers**  | Already works via the Team page. No changes needed.                                                                                    |
