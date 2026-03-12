# Xero Integration

> **Status:** Entirely future work. The "Send to Xero" button exists on the job detail page but is a stub — it doesn't call any API. The `netlify/functions/` directory has not been created yet. Requires a Xero developer account and Netlify Functions to implement.

This document covers connecting the app to Xero so completed, HQ-approved jobs can be pushed as draft invoices with a single click.

This is the **final phase** of the build — the app should be stable with Supabase auth, real job data, and PWA support before tackling Xero.

---

## How it works end to end

```
Engineer completes job
        ↓
Engineer fills in materials + time spent
        ↓
HQ reviews job sheet
        ↓
HQ clicks "Mark as Final Complete"
        ↓
"Send to Xero" button unlocks on job sheet
        ↓
HQ clicks "Send to Xero"
        ↓
Netlify Function calls Xero API
        ↓
Draft invoice created in Xero with line items:
  - Labour (time spent × hourly rate)
  - Materials (from materials field)
        ↓
Job status updated to "Invoiced"
        ↓
Xero invoice ID saved to job record
```

---

## 1. Xero developer account setup

1. Go to [developer.xero.com](https://developer.xero.com) and sign in with your Xero account
2. Create a new app:
    - App name: e.g. `DPH Plumbing Jobs`
    - Company or application URL: your Netlify URL
    - Redirect URI: `https://your-netlify-site.netlify.app/account` (the Account Settings page)
    - OAuth 2.0 scopes needed: `openid profile email accounting.transactions accounting.contacts`
3. Copy the **Client ID** and **Client Secret**

Add to Netlify environment variables (not `VITE_` prefixed — never expose the secret to the browser):

```
XERO_CLIENT_ID=your-client-id
XERO_CLIENT_SECRET=your-client-secret
XERO_REDIRECT_URI=https://your-site.netlify.app/account
```

---

## 2. OAuth flow — connect Xero

Xero uses OAuth 2.0 with PKCE. The connection flow is:

1. Dave clicks "Connect to Xero" in Account Settings
2. App redirects to Xero's authorisation URL
3. Dave logs in to Xero and approves
4. Xero redirects back to `/account?code=xxx`
5. App sends `code` to a Netlify Function
6. Netlify Function exchanges code for `access_token` and `refresh_token`
7. Tokens are saved to the `businesses` table (encrypted at rest by Supabase)

### Step 2 — build the authorisation URL (client-side)

```ts
// src/pages/AccountPage.tsx
function connectXero() {
	const state = crypto.randomUUID(); // CSRF protection
	sessionStorage.setItem("xero-state", state);

	const params = new URLSearchParams({
		response_type: "code",
		client_id: import.meta.env.VITE_XERO_CLIENT_ID,
		redirect_uri: import.meta.env.VITE_XERO_REDIRECT_URI,
		scope: "openid profile email accounting.transactions accounting.contacts offline_access",
		state,
	});

	window.location.href = `https://login.xero.com/identity/connect/authorize?${params}`;
}
```

Add to `.env.local` (safe — client ID is not a secret):

```
VITE_XERO_CLIENT_ID=your-client-id
VITE_XERO_REDIRECT_URI=https://your-site.netlify.app/account
```

### Step 5–7 — token exchange (Netlify Function)

Create `netlify/functions/xero-callback.ts`:

```ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
	process.env.SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role — server only
);

export const handler: Handler = async (event) => {
	const { code, business_id } = JSON.parse(event.body ?? "{}");

	const response = await fetch("https://identity.xero.com/connect/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "authorization_code",
			code,
			redirect_uri: process.env.XERO_REDIRECT_URI!,
			client_id: process.env.XERO_CLIENT_ID!,
			client_secret: process.env.XERO_CLIENT_SECRET!,
		}),
	});

	const tokens = await response.json();

	// Fetch the Xero tenant ID (which Xero org to use)
	const tenantsRes = await fetch("https://api.xero.com/connections", {
		headers: { Authorization: `Bearer ${tokens.access_token}` },
	});
	const [tenant] = await tenantsRes.json();

	// Save tokens to business record
	await supabase
		.from("businesses")
		.update({
			xero_connected: true,
			xero_access_token: tokens.access_token,
			xero_refresh_token: tokens.refresh_token,
			xero_token_expires_at: new Date(
				Date.now() + tokens.expires_in * 1000,
			).toISOString(),
			xero_tenant_id: tenant.tenantId,
		})
		.eq("id", business_id);

	return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
```

Add these columns to the `businesses` table:

```sql
alter table businesses
  add column xero_access_token  text,
  add column xero_refresh_token text,
  add column xero_token_expires_at timestamptz,
  add column xero_tenant_id     text;
```

---

## 3. Send to Xero — create a draft invoice

Create `netlify/functions/xero-create-invoice.ts`:

```ts
import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
	process.env.SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getValidToken(businessId: string) {
	const { data: biz } = await supabase
		.from("businesses")
		.select(
			"xero_access_token, xero_refresh_token, xero_token_expires_at, xero_tenant_id, xero_client_id",
		)
		.eq("id", businessId)
		.single();

	const expiresAt = new Date(biz.xero_token_expires_at).getTime();
	const now = Date.now();

	if (now < expiresAt - 60_000) {
		return { token: biz.xero_access_token, tenantId: biz.xero_tenant_id };
	}

	// Token expired — refresh it
	const res = await fetch("https://identity.xero.com/connect/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: biz.xero_refresh_token,
			client_id: process.env.XERO_CLIENT_ID!,
			client_secret: process.env.XERO_CLIENT_SECRET!,
		}),
	});

	const newTokens = await res.json();

	await supabase
		.from("businesses")
		.update({
			xero_access_token: newTokens.access_token,
			xero_refresh_token: newTokens.refresh_token,
			xero_token_expires_at: new Date(
				Date.now() + newTokens.expires_in * 1000,
			).toISOString(),
		})
		.eq("id", businessId);

	return { token: newTokens.access_token, tenantId: biz.xero_tenant_id };
}

export const handler: Handler = async (event) => {
	const { jobId, businessId } = JSON.parse(event.body ?? "{}");

	// Fetch job details
	const { data: job } = await supabase
		.from("jobs")
		.select("*, profiles(name, email)")
		.eq("id", jobId)
		.single();

	const { token, tenantId } = await getValidToken(businessId);

	// Build Xero invoice payload
	const invoice = {
		Type: "ACCREC", // Accounts receivable (money owed to you)
		Contact: {
			Name: job.customer,
		},
		LineItems: [
			{
				Description: `Labour — ${job.type} at ${job.address}`,
				Quantity: job.time_spent,
				UnitAmount: 65.0, // hourly rate — make this configurable per business
				AccountCode: "200", // your Xero revenue account code
				TaxType: "OUTPUT2", // 20% VAT — adjust for your Xero setup
			},
			...(job.materials
				? [
						{
							Description: `Materials: ${job.materials}`,
							Quantity: 1,
							UnitAmount: 0, // HQ to fill in Xero or add materials cost field to app
							AccountCode: "200",
							TaxType: "OUTPUT2",
						},
					]
				: []),
		],
		Reference: job.ref,
		DueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
			.toISOString()
			.split("T")[0], // 30 days
		Status: "DRAFT",
		Url: `${process.env.APP_URL}/job/${job.id}`, // link back to job sheet
	};

	const xeroRes = await fetch("https://api.xero.com/api.xro/2.0/Invoices", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Xero-Tenant-Id": tenantId,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ Invoices: [invoice] }),
	});

	const result = await xeroRes.json();
	const xeroInvoiceId = result.Invoices?.[0]?.InvoiceID;

	if (xeroInvoiceId) {
		await supabase
			.from("jobs")
			.update({
				status: "Invoiced",
				xero_invoice_id: xeroInvoiceId,
			})
			.eq("id", jobId);
	}

	return {
		statusCode: 200,
		body: JSON.stringify({ xeroInvoiceId }),
	};
};
```

---

## 4. Calling the function from the app

In `JobDetailPage.tsx`, replace the "Send to Xero" button handler:

```ts
async function sendToXero() {
	const res = await fetch("/.netlify/functions/xero-create-invoice", {
		method: "POST",
		body: JSON.stringify({ jobId: job.id, businessId: business.id }),
	});
	const { xeroInvoiceId } = await res.json();
	if (xeroInvoiceId) {
		updateJob(job.id, "status", "Invoiced");
		updateJob(job.id, "xero_invoice_id", xeroInvoiceId);
	}
}
```

---

## 5. Install Netlify Functions locally

```bash
npm install -D @netlify/functions
npm install -D netlify-cli
```

Run locally with:

```bash
npx netlify dev
```

This starts Vite and the Netlify Functions server together at `http://localhost:8888`.

---

## 6. Xero considerations

### Contacts — must exist before invoicing

Xero will auto-create a Contact if you pass `Contact: { Name: "..." }` and no match exists. However this causes **duplicates** if the name doesn't match exactly (e.g. "John Smith" vs "J. Smith" vs "john smith").

The invoice function should:

1. Search first: `GET /Contacts?where=Name=="${customer}"`
2. If found, use the returned `ContactID` in the invoice payload
3. If not found, create the contact explicitly with `POST /Contacts` then use the new ID

This avoids orphan contacts building up in the client's Xero org.

### Name mismatch when a `xero_contact_id` is already stored

When a customer already has a `xero_contact_id` saved in PipeLine, the push flow should **not blindly use it**. If the name in the app differs from the name on that contact in Xero (e.g. due to a rename in Xero, a manual typo in the stored ID, or a tenant switch), the invoice will silently land against the wrong person — Xero resolves by ID only and ignores the name you supply.

**Validate before pushing:**

```ts
// In xero-create-invoice.ts — before building the invoice payload
const contactRes = await xero.GET(`/Contacts/${customer.xeroContactId}`);
const xeroContact = contactRes?.Contacts?.[0];

if (!xeroContact) {
	// ID is stale or belongs to a different tenant — fall through to name search
} else {
	const xeroName = xeroContact.Name.toLowerCase().trim();
	const appName = customer.name.toLowerCase().trim();
	if (xeroName !== appName) {
		// Return a warning payload — let the UI ask the master to confirm
		return {
			warning: `Name mismatch: PipeLine has "${customer.name}", Xero contact is "${xeroContact.Name}". Proceed or update the contact?`,
			xeroName: xeroContact.Name,
		};
	}
}
```

The front-end should surface this as a blocking confirmation before the invoice is raised. This also covers the case where someone typed a wrong `xero_contact_id` manually.

**Additional risk — tenant switch:** If a business disconnects and reconnects Xero to a _different organisation_, all stored `xero_contact_id` values become invalid or point to different people. This should trigger a bulk-clear of `xero_contact_id` on all customers for that business when the OAuth callback detects a changed `xero_tenant_id`.

### Account codes — must match the client's chart of accounts

The code currently hardcodes `AccountCode: "200"` (revenue) and `TaxType: "OUTPUT2"` (20% VAT). These **will be different per Xero org** — "200" is the Xero demo company default but real businesses may use different codes.

Add these configurable fields to `businesses` (and the Account Settings page):

| Field                | DB column           | Default   | Notes                                            |
| -------------------- | ------------------- | --------- | ------------------------------------------------ |
| Revenue account code | `xero_account_code` | `200`     | Must match client's Xero chart of accounts       |
| Tax type             | `xero_tax_type`     | `OUTPUT2` | `OUTPUT2` = 20% VAT, `NONE` = not VAT registered |
| Hourly labour rate   | `xero_hourly_rate`  | `65.00`   | Used for the labour line item calculation        |
| Invoice due days     | `xero_due_days`     | `30`      | Days from invoice date to due date               |

The SQL migration to add these would be:

```sql
alter table businesses
  add column xero_account_code text default '200',
  add column xero_tax_type     text default 'OUTPUT2',
  add column xero_hourly_rate  numeric(8,2) default 65.00,
  add column xero_due_days     integer default 30;
```

### Token refresh — 30-minute expiry

Xero access tokens expire after 30 minutes. The `getValidToken()` function in `xero-create-invoice.ts` handles this automatically — it checks `xero_token_expires_at` before every call and refreshes if needed. The refresh token itself is long-lived but can be revoked if the user disconnects from the Xero app.

### tenantId — unique per Xero organisation

Every API request must include the `Xero-Tenant-Id` header. This is captured during the OAuth callback and stored per business in `businesses.xero_tenant_id`. Since each PipeLine client connects their own Xero org, each business row holds its own tenantId.

### Materials cost

The materials field is currently free text. To invoice materials properly, either:

- Add a `materials_cost` numeric field to `jobs` so the HQ can enter a £ amount, or
- Let it go through as a £0 line item and have the client fill in the cost in Xero before approving the draft

### Other notes

| Topic              | Detail                                                                                |
| ------------------ | ------------------------------------------------------------------------------------- |
| Invoices vs Quotes | Create as `DRAFT` — user reviews in Xero before approving. Safest approach.           |
| Xero sandbox       | Xero provides a demo company for testing — no real Xero account needed until go-live. |
| `offline_access`   | Include this scope in the OAuth request to get a refresh token (already in the code). |

---

## 7. Required Netlify environment variables (production)

```
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=
XERO_REDIRECT_URI=https://your-site.netlify.app/account
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=   ← never expose this in the frontend
APP_URL=https://your-site.netlify.app
```

---

## Checklist

- [ ] Create Xero developer app at developer.xero.com
- [ ] Add Xero env vars to Netlify
- [ ] Add `netlify/functions/` directory
- [ ] Build `xero-callback` function — token exchange
- [ ] Build `xero-create-invoice` function — invoice creation + token refresh
- [ ] Add Xero token columns to `businesses` table in Supabase
- [ ] Add configurable hourly rate and materials cost fields to the app
- [ ] Test with Xero demo company
- [ ] Go-live sign-off with real Xero organisation
