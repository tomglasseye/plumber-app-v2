# Superadmin & Client Onboarding

> **Status:** Future work. Currently, adding a new client company requires manual SQL execution in the Supabase dashboard. This document describes the planned self-service onboarding flow for when the app has multiple clients.

---

## The problem

The app is fully multi-tenant — every table has a `business_id` column and RLS ensures each company's data is completely isolated. However there is **no self-service way to create a new company**. Right now, adding a client requires:

1. Manually creating auth users in the Supabase dashboard
2. Running raw SQL to insert a `businesses` row and `profiles` rows

This is fine for one or two clients. It does not scale.

---

## Manual process (current, no code changes needed)

Until this feature is built, onboard new clients as follows:

### Step 1 — Create auth users in Supabase Dashboard

Go to **Authentication → Users → Add user** for each person:

| Email                       | Password        | Who          |
| --------------------------- | --------------- | ------------ |
| `master@newcompany.co.uk`   | strong password | Master/admin |
| `engineer@newcompany.co.uk` | strong password | Engineer     |

### Step 2 — Run this SQL in the SQL Editor

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
returning id;  -- copy this id for step 2

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

The master can then add further engineers themselves via the **Team** page in the app.

---

## Planned implementation

### Overview

A super-admin role that sits outside any single business. A superadmin can create new client companies and invite masters via email — no SQL required.

```
Superadmin logs in at /admin
        ↓
Fills in company details (name, initials, colour, email)
        ↓
App creates businesses row + calls Supabase inviteUserByEmail
        ↓
Master receives invite email, sets password, logs in
        ↓
Master adds engineers from Team page as normal
```

---

## 1. Database changes (Migration 9)

```sql
-- Super-admin flag — separate from the business/role system
create table if not exists super_admins (
  id         uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table super_admins enable row level security;

-- Only super admins can read this table (used by is_super_admin() function)
create policy "super_admins read own row"
  on super_admins for select
  using (id = auth.uid());

-- Helper function used by RLS policies and Netlify Functions
create or replace function is_super_admin()
  returns boolean
  language sql stable security definer
as $$
  select exists (select 1 from super_admins where id = auth.uid())
$$;
```

To make someone a super admin, insert their `auth.users` UUID directly into `super_admins`. This is intentionally manual — you don't want this self-assignable.

```sql
insert into super_admins (id)
values ((select id from auth.users where email = 'you@yourapp.com'));
```

---

## 2. Netlify Function — `create-business`

`netlify/functions/create-business.ts`

Validates that the caller is a super admin, creates the business row, and sends an invite email to the master.

```ts
import { createClient } from "@supabase/supabase-js";

export const handler = async (event) => {
	if (event.httpMethod !== "POST") return { statusCode: 405 };

	const adminClient = createClient(
		process.env.SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
	);

	// Verify caller is a super admin
	const token = event.headers.authorization?.replace("Bearer ", "");
	const {
		data: { user },
		error: authErr,
	} = await adminClient.auth.getUser(token);
	if (authErr || !user)
		return {
			statusCode: 401,
			body: JSON.stringify({ error: "Unauthorized" }),
		};

	const { data: isAdmin } = await adminClient
		.from("super_admins")
		.select("id")
		.eq("id", user.id)
		.single();
	if (!isAdmin)
		return {
			statusCode: 403,
			body: JSON.stringify({ error: "Forbidden" }),
		};

	const {
		name,
		phone,
		email,
		address,
		accentColor,
		logoInitials,
		masterEmail,
		masterName,
	} = JSON.parse(event.body);

	// Create business row
	const { data: biz, error: bizErr } = await adminClient
		.from("businesses")
		.insert({
			name,
			phone,
			email,
			address,
			accent_color: accentColor,
			logo_initials: logoInitials,
		})
		.select()
		.single();
	if (bizErr)
		return {
			statusCode: 500,
			body: JSON.stringify({ error: bizErr.message }),
		};

	// Invite the master user — they get an email to set their password
	const { data: invite, error: inviteErr } =
		await adminClient.auth.admin.inviteUserByEmail(masterEmail, {
			data: {
				business_id: biz.id,
				role: "master",
				name: masterName,
			},
		});
	if (inviteErr)
		return {
			statusCode: 500,
			body: JSON.stringify({ error: inviteErr.message }),
		};

	// Pre-create their profile row (avatar = initials from name)
	const avatar = masterName
		.split(" ")
		.map((n: string) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
	await adminClient.from("profiles").insert({
		id: invite.user.id,
		business_id: biz.id,
		name: masterName,
		role: "master",
		avatar,
	});

	return {
		statusCode: 200,
		body: JSON.stringify({ businessId: biz.id }),
	};
};
```

> **Note:** `inviteUserByEmail` sends a magic link. The master clicks it to set their password, then logs in normally.

---

## 3. Supabase Auth hook — auto-create profile on invite accept

When the invited master clicks their email link and sets a password, their profile row already exists (created above). No hook needed.

However, if you later allow masters to invite engineers directly (rather than creating them via the Team page), you could use a Supabase **Auth webhook** (`auth.users` INSERT trigger) to auto-create a profile row. This is optional — the Team page currently handles this.

---

## 4. Frontend — `/admin` route

A new page, only accessible to super admins. The app needs to detect the super admin role on login.

### Detect super admin in `AppContext`

```ts
// After loading the profile, check if user is a super admin
const { data: saRow } = await supabase
	.from("super_admins")
	.select("id")
	.eq("id", userId)
	.maybeSingle();
const isSuperAdmin = !!saRow;
```

Add `isSuperAdmin: boolean` to `AppCtx` and expose it via the Provider.

### Route guard

```tsx
function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
	const { isSuperAdmin } = useApp();
	if (!isSuperAdmin) return <Navigate to="/" replace />;
	return <>{children}</>;
}
```

### `/admin` page — `src/pages/AdminPage.tsx`

A simple form:

| Field                   | Notes                       |
| ----------------------- | --------------------------- |
| Company name            | Required                    |
| Logo initials           | 2–4 chars, e.g. "NCL"       |
| Brand colour            | Colour picker               |
| Phone / email / address | Optional at setup           |
| Master's name           | Required                    |
| Master's email          | Required — invite sent here |

On submit, calls `POST /.netlify/functions/create-business`. On success, shows a confirmation: _"Invite sent to master@newcompany.co.uk"_.

---

## 5. Client list page — `/admin/clients`

A table of all businesses with columns: name, master email, created date, job count, Xero connected. Allows the super admin to see all clients at a glance and click through to manage them.

This requires a Netlify Function that queries across all businesses (using the service role key to bypass RLS).

---

## 6. Things to watch out for

| Concern                                 | Detail                                                                                                                                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Invite expiry**                       | Supabase invite links expire after 24 hours by default. Configurable in Auth settings. Add a "resend invite" button to the admin page.                                                                                                  |
| **Master inviting engineers**           | Already works via the Team page. No changes needed.                                                                                                                                                                                     |
| **Super admin access to business data** | The super admin's `business_id` will be null — they should not see any business's jobs/customers. The existing RLS policies use `my_business_id()` which returns null for them, so they're automatically locked out of all tenant data. |
| **Deleting a company**                  | Cascade deletes handle data cleanup (all tables reference `business_id` with `on delete cascade`). Auth users need to be deleted separately via the service role. Add a "Delete client" confirmation flow to the admin page.            |
| **Per-client Netlify env vars**         | Not needed — each client's Xero credentials are stored in their `businesses` row.                                                                                                                                                       |

---

## Implementation order

1. Run migration 9 (super_admins table)
2. Create `create-business` Netlify Function
3. Add `isSuperAdmin` check to `AppContext`
4. Add `RequireSuperAdmin` guard and `/admin` route
5. Build `AdminPage` form
6. Build `/admin/clients` list (optional, can come later)
