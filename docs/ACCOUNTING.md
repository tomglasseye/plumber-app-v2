# Accounting Integration — Xero & QuickBooks Online

> **Status:** Entirely future work. The "Send to Xero" stub button exists on [AccountPage.tsx](../src/pages/AccountPage.tsx) and [JobDetailPage.tsx](../src/pages/JobDetailPage.tsx) but neither is wired up. The `netlify/functions/_accounting/` directory has not been created yet. Requires Xero + Intuit developer accounts and Netlify Functions to implement.

This document covers connecting the app to **Xero** and/or **QuickBooks Online** so completed, HQ-approved jobs can be pushed as draft invoices with a single click. Each client business independently picks one provider; the underlying integration uses a provider abstraction so the app stays clean as more accounting systems are added later.

This is the **final phase** of the build. The app should be stable with Supabase auth, real job data, custom domain, and PWA support before tackling accounting. See [LAUNCH.md](LAUNCH.md) for where this fits in the overall rollout sequence (Phase 4) and the per-client onboarding checklist.

---

## 1. Multi-Provider Architecture

### One app, many accounting organisations

- **You (app owner)** create one Xero developer app and one Intuit (QuickBooks) developer app. Credentials live in Netlify env vars.
- Each **business/client** (Dave's Plumbing, Sarah's Services, etc.) independently picks **either** Xero **or** QuickBooks at setup, then connects their own organisation via OAuth.
- Each business stores their own tokens, tenant/realm ID, and provider-specific configuration (account code, hourly rate, tax code).
- All tokens are **AES-GCM encrypted at rest** in the database — they grant full access to the client's books and must never be readable in plaintext.

**Key point:** Your setup is one-time per provider (developer apps + env vars). Client onboarding is per-business (pick a provider → OAuth → configure tax code).

### OAuth callback security (state + PKCE)

The callback (`accounting-callback.ts`) must implement two rules:

1. **The business is bound from the caller's Supabase JWT — never from redirect parameters.** The frontend receives `?code=...` on `/account` and POSTs it to the callback function with the user's `Authorization` header; the function derives `businessId` from that verified JWT.
2. **A random `state` nonce is generated at connect time, held client-side (sessionStorage), sent on the authorize URL, and verified on return before the code is exchanged.** Without it, an attacker can splice their *own* authorization code into the redirect — the victim's business silently binds to the attacker's accounting org, and every subsequent invoice exports the victim's customer data into books the attacker controls.

PKCE is optional for a confidential client (the secret stays in Netlify) but cheap — add it if the provider SDK makes it easy.

### Provider abstraction

Rather than duplicating Xero-specific code for QBO, both providers implement a common interface (`IAccountingProvider`) so the dispatcher functions don't care which provider a business uses. Adding a third provider (Sage, FreshBooks, Wave) later costs ~1.5 days — just a new file implementing the same interface.

```
netlify/functions/
  accounting-callback.ts            ?provider=xero|qbo dispatcher
  accounting-create-invoice.ts      generic send-to-provider
  accounting-create-contact.ts      auto-create contact when customer added
  accounting-disconnect.ts          revoke tokens + clear config
  accounting-void-invoice.ts        called when job reverts from Invoiced
  accounting-webhook-xero.ts        inbound: payment status, de-auth
  accounting-webhook-qbo.ts         inbound: payment status, de-auth

  _accounting/
    types.ts          IAccountingProvider + normalized types
    factory.ts        getProvider(business) → instance
    xero.ts           XeroProvider implements IAccountingProvider
    qbo.ts            QboProvider  implements IAccountingProvider
    token-store.ts    AES-GCM encrypt/decrypt + getValidToken()
    audit.ts          log accounting.* events to audit_log
    billing-gate.ts   block invoice send if Stripe past_due/canceled
```

### End-to-end flow

```
Engineer completes job + logs time/materials
        ↓
HQ reviews + marks Final Complete
        ↓
"Send Invoice" button unlocks (label adapts: Send to Xero / Send to QuickBooks)
        ↓
Pre-send checks (ALL server-side, in accounting-create-invoice):
  caller is a MASTER of this business; job.ready_to_invoice = true read from
  the DB (the Final Complete gate must hold here too, not just in the UI);
  billing-gate (Stripe); validation (time > 0 OR materials > 0)
        ↓
accounting-create-invoice → factory.getProvider() → provider.createInvoice()
        ↓
Draft invoice created in client's Xero/QBO with line items:
  - Labour (time_spent × hourly_rate)
  - Materials (materials_cost, if > 0)
        ↓
jobs.accounting_invoice_id, accounting_invoice_status='sent', status='Invoiced'
audit_log: accounting.invoice_sent
        ↓
Later: client marks invoice paid in their accounting system
        ↓
Provider fires webhook → accounting-webhook-* → accounting_invoice_status='paid'
audit_log: accounting.invoice_paid
        ↓
Job shows "✓ Paid in {Provider}" badge instead of Send button
```

---

## 2. Provider Interface Contract

`netlify/functions/_accounting/types.ts`:

```ts
export type AccountingProvider = "none" | "xero" | "qbo";

export interface ProviderContext {
  businessId: string;
  business: BusinessRow;       // includes accounting_* columns
  accessToken: string;
  tenantId: string;
}

export interface NormalizedInvoice {
  customer: { name: string; email?: string; accountingContactId?: string };
  reference: string;           // job.ref
  jobUrl: string;              // deep-link back to job sheet
  dueDays: number;
  taxCode: string;
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    accountCode?: string;      // Xero: 200; QBO: not used (uses itemId)
    itemId?: string;           // QBO: required; Xero: not used
  }>;
}

export interface NormalizedContact {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface WebhookPaidEvent {
  providerInvoiceId: string;
  status: "paid" | "voided" | "deauthorized";
}

export interface IAccountingProvider {
  // OAuth
  connect(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    refreshExpiresIn?: number;  // QBO only
    tenantId: string;
    email: string;
  }>;
  refreshTokens(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;       // BOTH providers rotate — always persist the new one
    expiresIn: number;
    refreshExpiresIn?: number;
  }>;

  // Provisioning (first connect)
  bootstrapDefaults(ctx: ProviderContext): Promise<{
    revenueAccount?: string;    // QBO: labour Service Item ID
    materialsAccount?: string;  // QBO: materials Service Item ID
  }>;

  // Contacts
  findContactByName(name: string, ctx: ProviderContext): Promise<{ id: string; name: string } | null>;
  createContact(contact: NormalizedContact, ctx: ProviderContext): Promise<{ id: string }>;
  importContacts(ctx: ProviderContext): Promise<Array<{ id: string; name: string }>>;

  // Invoices
  createInvoice(invoice: NormalizedInvoice, ctx: ProviderContext): Promise<{ invoiceId: string }>;
  voidInvoice(invoiceId: string, ctx: ProviderContext): Promise<void>;

  // Webhooks
  verifyWebhook(rawBody: string, headers: Record<string, string>): boolean;
  parseWebhookEvents(body: any): WebhookPaidEvent[];
}
```

---

## 3. Provider Implementations

### 3a. Xero

**OAuth endpoints:**
- Authorize: `https://login.xero.com/identity/connect/authorize`
- Token: `https://identity.xero.com/connect/token`
- Scopes: `openid profile email accounting.transactions accounting.contacts accounting.settings.read offline_access`
  (`accounting.settings.read` lets the app fetch `GET /Accounts` and `GET /TaxRates` so onboarding can show **dropdowns** of the client's real revenue accounts and tax rates instead of asking the master to free-type a code like `200` — the most error-prone step otherwise)

**API:**
- Base: `https://api.xero.com/api.xro/2.0`
- Auth: `Authorization: Bearer {token}`, `Xero-Tenant-Id: {tenantId}`
- Access token: 30-min expiry
- Refresh token: **rotates on every refresh** — the old token stays usable only for a ~30-minute grace window (intended for retrying a refresh whose response was lost). Persist the new refresh token immediately, exactly as for QBO. Unused refresh tokens expire after 60 days.

**Tenant ID:** captured from `GET https://api.xero.com/connections` immediately after token exchange. Stored in `businesses.accounting_tenant_id`.

**Account codes & tax types are configured per-business** — defaults are wrong for most clients:
- `accounting_revenue_account` — Xero "Account Code" (e.g. `200` for the demo company, but every real org differs)
- `accounting_tax_code` — Xero TaxType: `NONE`, `OUTPUT2` (20% VAT), `OUTPUT` (legacy 17.5%), etc. **Prompted during onboarding.**

**Connection cap (uncertified apps):** Xero limits uncertified apps to **25 connected organisations**, and users may install at most 2 uncertified apps. For a multi-client SaaS this is a hard ceiling — apply for **Xero App Partner certification** well before client #26 (it has review lead time). Track this in [LAUNCH.md](LAUNCH.md) Phase 4 one-time setup.

**Webhooks:** Xero supports webhooks for `INVOICE` and `CONTACT` events. Signature is HMAC-SHA256 of the raw body with the webhook signing key (`XERO_WEBHOOK_KEY`) — verify on every incoming request.

**Void:** `POST /Invoices/{InvoiceID}` with `Status: VOIDED`. Only allowed while the invoice is DRAFT or SUBMITTED.

### 3b. QuickBooks Online

**OAuth endpoints:**
- Authorize: `https://appcenter.intuit.com/connect/oauth2`
- Token: `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`
- Scope: `com.intuit.quickbooks.accounting` (plus `openid email profile` if OpenID needed)

**API:**
- Base (production): `https://quickbooks.api.intuit.com/v3/company/{realmId}`
- Base (sandbox): `https://sandbox-quickbooks.api.intuit.com/v3/company/{realmId}`
- Pin `?minorversion=75` on every request — Intuit deprecated minor versions 1–74 in August 2025; values below 75 are ignored and served as 75, so code must be compatible with the v75 schema
- Access token: 60-min expiry
- Refresh token: **100-day expiry AND rotates on every refresh** — the old one is invalidated. Must persist the new refresh token BEFORE using the new access token.

**Production keys require Intuit's app assessment:** Intuit gates production credentials behind a legal/tech/security questionnaire plus "Production Settings" details (hosting country, IP addresses, host domain, launch URL, disconnect URL) — this applies even to private, unlisted apps. Like Stripe's business verification, it has lead time: submit it during the build, not at launch.

**Realm ID:** equivalent to Xero's tenant ID — captured from the OAuth callback. Stored in `businesses.accounting_tenant_id`. Also store `accounting_environment` (`sandbox` | `production`) and `accounting_region` (`US`, `UK`, `CA`, `AU`, `GLOBAL`).

**Item dependency (QBO-specific):** Every invoice line must reference an existing Service Item by `Item.Id`. The app handles this by calling `bootstrapDefaults()` on first connect:

1. Fetch `Account?where=AccountType='Income'` to find an income account to attach items to
2. Create two Service Items via `POST /item`:
   - Name: "Labour - {AppName}" → store ID in `accounting_revenue_account`
   - Name: "Materials - {AppName}" → store ID in `accounting_materials_account`

**If the client later deletes one of these items in QBO,** the invoice push will 404. The provider handles this by detecting the 404 and recreating the item.

**US sales tax (Automated Sales Tax):** QBO US uses AST — when `Preferences.TaxPreferences.UsingSalesTax === true`, the app must **omit** explicit `TaxCodeRef` and let QBO compute. UK/AU QBO uses line-level `TaxCodeRef` like Xero's TaxType.

**Webhooks:** Intuit fires events to a single endpoint per app. Signature is HMAC-SHA256 of the body with the verifier token (`INTUIT_WEBHOOK_VERIFIER`). Events arrive as `EventNotifications[].DataChangeEvent.Entities[]` — filter for `Invoice` updates where `Balance === 0` (paid).

**Void:** `POST /invoice?operation=void` with the invoice payload.

---

## 4. Common Concerns

### 4a. Token encryption (AES-256-GCM)

Tokens are encrypted before being written to `businesses.accounting_access_token` and `accounting_refresh_token`. The encryption key (`ACCOUNTING_ENCRYPTION_KEY`, 32-byte hex, set in Netlify env vars) is never exposed to the browser.

```ts
// netlify/functions/_accounting/token-store.ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY = Buffer.from(process.env.ACCOUNTING_ENCRYPTION_KEY!, "hex");

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // store as base64(iv || tag || ciphertext)
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptToken(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
```

**Key rotation:** if `ACCOUNTING_ENCRYPTION_KEY` is ever lost or compromised, all stored tokens become unusable — clients will need to reconnect. Plan a maintenance window to re-encrypt with a new key if rotating. See [SECURITY.md](SECURITY.md) for the full key management approach.

**Where tokens live — a dedicated table, NOT `businesses` columns.** The app client does `select("*")` on `businesses` (AppContext), so any column there ships to every member's browser — encrypted or not, ciphertext in browser memory is unnecessary exposure and contradicts "tokens never touch the browser". Store tokens in an `accounting_tokens` table that is **service-role only**: RLS enabled with zero policies and zero grants (under the post-Oct-2026 Data API policy, an ungranted new table isn't exposed at all — exactly what we want). Non-secret config (`accounting_provider`, `accounting_connected`, tax code, hourly rate, due days) stays on `businesses` for the UI. Schema in section 14.

### 4b. Token refresh with rotation safety (both providers)

> The sketch below reads token columns off `businesses` for brevity — in the real build, token columns live in `accounting_tokens` (section 14) and config stays on `businesses`. Same logic, two reads/writes.

```ts
// netlify/functions/_accounting/token-store.ts (continued)
export async function getValidToken(businessId: string): Promise<ProviderContext> {
  const { data: business } = await supabase
    .from("businesses").select("*").eq("id", businessId).single();

  const expiresAt = new Date(business.accounting_token_expires_at).getTime();
  const now = Date.now();

  if (now < expiresAt - 60_000) {
    // Still valid
    return {
      businessId,
      business,
      accessToken: decryptToken(business.accounting_access_token),
      tenantId: business.accounting_tenant_id,
    };
  }

  // Expired — refresh
  const provider = getProvider(business);
  const refreshToken = decryptToken(business.accounting_refresh_token);
  const newTokens = await provider.refreshTokens(refreshToken);

  // CRITICAL: persist the new refresh token BEFORE using the new access token.
  // BOTH providers rotate refresh tokens on every refresh: QBO invalidates the
  // old one immediately; Xero leaves only a ~30-min grace window for retrying a
  // lost response. If we crash between using the access token and saving the
  // new refresh token, the client must re-OAuth.
  await supabase.from("businesses").update({
    accounting_access_token: encryptToken(newTokens.accessToken),
    accounting_refresh_token: encryptToken(newTokens.refreshToken),
    accounting_token_expires_at: new Date(Date.now() + newTokens.expiresIn * 1000).toISOString(),
    ...(newTokens.refreshExpiresIn && {
      accounting_refresh_expires_at: new Date(Date.now() + newTokens.refreshExpiresIn * 1000).toISOString(),
    }),
  }).eq("id", businessId);

  return {
    businessId,
    business: { ...business, accounting_access_token: encryptToken(newTokens.accessToken) },
    accessToken: newTokens.accessToken,
    tenantId: business.accounting_tenant_id,
  };
}
```

### 4c. Contact sync

Customers are linked to provider contacts via `customers.accounting_contact_id`. Three sync points:

1. **On first connect (import)** — `provider.importContacts()` pulls all existing contacts; matches by name (lowercased + trimmed); stamps `accounting_contact_id` on matched app customers.
2. **When HQ adds a customer in the app** — `accounting-create-contact` creates the contact in the provider and stamps the returned ID.
3. **On every invoice send** — pre-flight check:
   - If customer has `accounting_contact_id`, verify it still exists and the name matches (catches manual typos, renames in provider). If mismatch, surface a warning in the UI: *"Name mismatch: app has 'John Smith', Xero contact is 'J. Smith'. Proceed or update?"*
   - If no `accounting_contact_id`, search by name. If not found, create the contact explicitly.

### 4d. Tenant/realm switch cleanup

If a business disconnects and reconnects to a **different** Xero org or QBO company, all stored `accounting_contact_id` values point to contacts that don't exist (or belong to different people) in the new org.

The `accounting-callback.ts` function detects this:

```ts
const { data: oldBusiness } = await supabase
  .from("businesses").select("accounting_tenant_id").eq("id", businessId).single();

if (oldBusiness?.accounting_tenant_id && oldBusiness.accounting_tenant_id !== newTenantId) {
  await supabase
    .from("customers")
    .update({ accounting_contact_id: null })
    .eq("business_id", businessId);
}
```

Historical `accounting_invoice_id` values on jobs are **not** cleared — they remain as references to whatever invoice was raised at the time.

### 4e. Billing gate (Stripe interaction)

Before any invoice is sent, the app checks the business's Stripe subscription status. If `subscription_status` is `past_due` or `canceled` past `current_period_end`, the send is blocked:

```ts
// netlify/functions/_accounting/billing-gate.ts
export async function assertBillingActive(businessId: string) {
  const { data: b } = await supabase
    .from("businesses")
    .select("subscription_status, current_period_end")
    .eq("id", businessId)
    .single();

  // Phase 4 ships before Stripe (Phase 5), so every business has
  // subscription_status = null until then. The gate is therefore flag-disabled:
  // set BILLING_ENFORCED=true at Stripe cutover (and/or backfill statuses).
  // AFTER cutover, null means "never subscribed" and blocks — matching the
  // contract in STRIPE.md §4.
  if (process.env.BILLING_ENFORCED !== "true") return;

  if (b.subscription_status === "active" || b.subscription_status === "trialing") return;
  // past_due mid-retry and canceled-but-paid-up keep invoicing until the period
  // actually ends — same logic as the app-wide access gate (STRIPE.md §4).
  if (b.current_period_end && new Date(b.current_period_end) > new Date()) return;

  throw new Error("BILLING_GATED: Resolve billing to enable invoicing.");
}
```

The frontend reads the same fields to disable the Send Invoice button with a tooltip. See [STRIPE.md](STRIPE.md) for the subscription status contract.

---

## 5. Disconnect & De-authorization

### 5a. User clicks Disconnect

`accounting-disconnect.ts`:

1. Decrypt current access token
2. Call provider's revoke endpoint:
   - Xero: `DELETE https://api.xero.com/connections/{tenantId}`
   - QBO: `POST https://developer.api.intuit.com/v2/oauth2/tokens/revoke` with the refresh token
3. Clear `accounting_*` columns on `businesses` (set `accounting_connected = false`, `accounting_provider = 'none'`, NULL the tenant/config) and **delete the business's `accounting_tokens` row**
4. **Preserve** `customers.accounting_contact_id` (historical reference; will be cleared on next reconnect if tenant differs)
5. **Preserve** `jobs.accounting_invoice_id` and `accounting_invoice_status` (historical records of invoices that were raised)
6. Log `accounting.disconnected` with reason='user_initiated'

### 5b. Client revokes the app from inside Xero/QBO (external de-auth)

The app doesn't know until the next API call returns 401. The dispatcher functions detect this:

```ts
catch (err) {
  if (err.status === 401 || err.code === 'invalid_grant') {
    await supabase.from("businesses")
      .update({ accounting_connected: false })
      .eq("id", businessId);
    await logAudit("accounting.disconnected", businessId, { reason: 'revoked_externally' });
    throw new Error("DISCONNECTED: Reconnect required.");
  }
}
```

The frontend reads `accounting_connected === false` (with `accounting_provider !== 'none'`) and shows a banner: *"Your {Xero|QuickBooks} connection has been revoked. [Reconnect]"*.

### 5c. Refresh token expiry (inactive clients)

Refresh tokens expire after 60 days (Xero) / 100 days (QBO). Inactive clients lose their connection silently.

Mitigation:
- Store `accounting_refresh_expires_at` so the UI can show a warning at ~80% of expiry: *"Your accounting connection will expire in 12 days unless you use it. [Refresh now]"*
- The "Refresh now" action makes a no-op API call to trigger token refresh.

---

## 6. Invoice Lifecycle

Tracked on `jobs.accounting_invoice_status`: `null` → `sent` → `paid` | `voided`.

| State | Set when | UI |
|---|---|---|
| `null` | Job not yet invoiced | "Send to {Provider}" button visible |
| `sent` | `accounting-create-invoice` succeeded | Button replaced with "Invoiced — view in {Provider}" link |
| `paid` | Webhook from provider (Balance === 0 / Status === PAID) | "✓ Paid in {Provider}" badge |
| `voided` | Job status reverted from `Invoiced` → `accounting-void-invoice` called | "Invoice voided" annotation; Send button re-appears so a new invoice can be raised |
| `null` + `accounting_last_error` set | Last send attempt failed | "Send to {Provider}" with "Last attempt failed: {error}" toast + retry button |

### Void on job revert

When master changes job status from `Invoiced` back to anything else, the app:
1. Prompts: *"This will void the draft invoice in {Provider}. Continue?"*
2. On confirm, calls `accounting-void-invoice` with the stored `accounting_invoice_id`
3. Provider voids the invoice (only works if still DRAFT — if the client has already sent it to their customer, the void may fail; surface error but still allow the job revert)
4. Sets `accounting_invoice_status = 'voided'`, logs `accounting.invoice_voided`

---

## 7. Webhook Setup

### Xero

1. In your Xero developer app → "Webhooks" → add subscription:
   - URL: `https://yourdomain.com/.netlify/functions/accounting-webhook-xero`
   - Subscribe to: `INVOICE` events (for paid status)
2. Copy the webhook signing key into Netlify env var `XERO_WEBHOOK_KEY`
3. **Pass "Intent to Receive" validation** — when you save the webhook, Xero immediately fires validation requests, some intentionally mis-signed. Your endpoint must respond **within 5 seconds** with an **empty body and no cookies**: HTTP `200` for a valid signature, `401` for an invalid one. Any body content, wrong status, or slow response and Xero never enables delivery. Practical consequence: **respond first, process after** — verify the signature, return the response, and do DB work afterwards (the 5-second rule applies to live events too; a Netlify cold start plus Supabase writes can exceed it).
4. Verify on every request:
   ```ts
   const signature = headers['x-xero-signature'];
   const expected = crypto.createHmac('sha256', process.env.XERO_WEBHOOK_KEY!).update(rawBody).digest('base64');
   if (signature !== expected) return { statusCode: 401 };
   ```

### QuickBooks Online (Intuit)

1. In your Intuit developer app → "Webhooks" → set URL: `https://yourdomain.com/.netlify/functions/accounting-webhook-qbo`
2. Subscribe to `Invoice` entity, `Update` operation
3. Copy the verifier token into Netlify env var `INTUIT_WEBHOOK_VERIFIER`
4. Verify signature with HMAC-SHA256 (Intuit uses `intuit-signature` header)

### Replay protection

Both providers can retry webhooks. Store seen event IDs in a `webhook_events` table (keyed on provider + event_id) and skip duplicates:

```sql
create table webhook_events (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null check (provider in ('xero','qbo')),
  event_id    text not null,
  business_id uuid references businesses(id) on delete cascade,
  received_at timestamptz default now(),
  unique(provider, event_id)
);

-- Service-role only: RLS on, NO policies, NO grants. Under the Oct 30 2026
-- Data API policy an ungranted new table isn't exposed at all — correct here.
alter table webhook_events enable row level security;
```

Add a `pg_cron` cleanup (e.g. delete rows older than 90 days) — the table only exists for replay dedupe and grows forever otherwise. For webhook → job/business lookups, index `jobs(accounting_invoice_id)` and `businesses(accounting_tenant_id)` (see section 14).

---

## 8. Audit Events Emitted

All accounting actions write to `audit_log` (see [SECURITY.md](SECURITY.md#audit-log)). The frontend filters these as a "Billing & Accounting" tab on the audit log viewer.

| Action | When | `details` |
|---|---|---|
| `accounting.connected` | After successful OAuth + bootstrap | `{ provider, tenantId, email }` |
| `accounting.disconnected` | User Disconnect OR 401 detection | `{ provider, reason: 'user_initiated' \| 'revoked_externally' }` |
| `accounting.settings_updated` | Tax code, hourly rate, etc. changed | `{ field, old, new }` |
| `accounting.invoice_sent` | Draft invoice created in provider | `{ jobId, ref, invoiceId, totalGross }` |
| `accounting.invoice_failed` | Send attempt failed | `{ jobId, ref, error, providerErrorCode }` |
| `accounting.invoice_voided` | Job reverted from Invoiced | `{ jobId, ref, invoiceId }` |
| `accounting.invoice_paid` | Webhook received from provider | `{ jobId, ref, invoiceId, paidAt }` |

---

## 9. Adding a New Provider (HOWTO)

To add Sage / FreshBooks / Wave / etc.:

1. Add the provider code to the `accounting_provider` CHECK constraint:
   ```sql
   alter table businesses drop constraint businesses_accounting_provider_check;
   alter table businesses add constraint businesses_accounting_provider_check
     check (accounting_provider in ('none','xero','qbo','sage'));
   ```
2. Create `netlify/functions/_accounting/sage.ts` implementing `IAccountingProvider`
3. Add the case to `factory.ts`:
   ```ts
   case 'sage': return new SageProvider();
   ```
4. Add a developer app at the provider's portal; add credentials to Netlify env vars
5. Add a radio option to the provider picker in [AccountPage.tsx](../src/pages/AccountPage.tsx)
6. Register the webhook URL `https://yourdomain.com/.netlify/functions/accounting-webhook-sage`
7. Document provider-specific quirks in this file (new section 3c)

No changes to dispatchers, schema (except the check constraint), encryption, audit, or billing gate. Estimated effort: 12-15 hours per provider.

---

## 10. Environment Variables (Combined)

Set in Netlify → Site Settings → Environment Variables. **One-time** — these are your developer app credentials, not per-client.

```env
# Xero (one-time)
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=                       # server-only, NEVER expose to browser
XERO_REDIRECT_URI=https://yourdomain.com/account
XERO_WEBHOOK_KEY=                         # for HMAC signature verification
VITE_XERO_CLIENT_ID=                      # browser uses to build OAuth URL
VITE_XERO_REDIRECT_URI=https://yourdomain.com/account

# QuickBooks / Intuit (one-time)
INTUIT_CLIENT_ID=
INTUIT_CLIENT_SECRET=                     # server-only
INTUIT_REDIRECT_URI=https://yourdomain.com/account
INTUIT_ENVIRONMENT=production             # sandbox | production
INTUIT_WEBHOOK_VERIFIER=                  # for webhook signature
VITE_INTUIT_CLIENT_ID=
VITE_INTUIT_REDIRECT_URI=https://yourdomain.com/account

# Shared
APP_URL=https://yourdomain.com            # used in invoice "view job sheet" deep-links
ACCOUNTING_ENCRYPTION_KEY=                # 32-byte hex — generate with: openssl rand -hex 32
```

Generate the encryption key once:
```bash
openssl rand -hex 32
```

Then set it in Netlify and **never lose it** — losing it means all clients must reconnect.

---

## 11. Per-Client Onboarding Checklist

### One-time (before any client connects)

- [ ] Create Xero developer app at [developer.xero.com](https://developer.xero.com)
- [ ] **Apply for Xero App Partner certification** — uncertified apps cap at 25 connected orgs and users can install at most 2 uncertified apps; certification has review lead time
- [ ] Create Intuit developer app at [developer.intuit.com](https://developer.intuit.com)
- [ ] **Complete Intuit's app assessment questionnaire + Production Settings** (hosting country/IPs, domain, launch + disconnect URLs) — production keys are gated on it
- [ ] Register webhook URLs in both developer dashboards (Xero requires passing Intent to Receive — section 7)
- [ ] Add all env vars from section 10 to Netlify
- [ ] Run migration 32 (section 14 — `accounting_*` columns, `accounting_tokens`, `webhook_events`)
- [ ] Build the integration (see [LAUNCH.md](LAUNCH.md) Phase 4 build order), including OAuth `state` verification (section 1)
- [ ] Test with Xero demo company AND QBO sandbox before any real client connects

### Per-client

- [ ] Client master goes to Account Settings → Accounting tab
- [ ] Picks their provider (Xero or QuickBooks)
- [ ] Clicks "Connect to {Provider}" → completes OAuth in their accounting org
- [ ] **VAT/tax onboarding prompt** appears: "Are you VAT registered?" → sets `accounting_tax_code`
  - Xero: `NONE` (not registered) or `OUTPUT2` (20% VAT)
  - QBO UK: similar; QBO US: detected from `Preferences.TaxPreferences.UsingSalesTax`
- [ ] For QBO: app auto-creates "Labour" and "Materials" Service Items in their QuickBooks. They can rename these in QBO afterwards.
- [ ] Client confirms hourly rate, due days in the settings form
- [ ] **Test invoice:** complete a small job, click Send, verify draft invoice appears in their accounting system
- [ ] Client sign-off — confirms the draft looks correct before approving in their accounting system

---

## 12. Out of Scope for v1

Documented to prevent scope creep. These can be added later without architectural changes:

| Feature | Why deferred |
|---|---|
| Multi-currency | Both providers require paid plans; small UK/US trades rarely need this |
| Recurring invoices | Providers handle recurring natively; clients can set up there directly. App pushes per-occurrence |
| Invoice PDF generation | Provider renders PDFs; app links out |
| Customer self-service portal | Out of scope; clients can use provider's own portal |
| Bidirectional contact sync (polling) | One-way only (app → provider) for v1. Polling for new provider contacts is Phase 4b |
| Bank reconciliation / payment matching | Provider handles natively; app stays out of payment flows beyond status display |
| Per-line-item discounts / surcharges / callout fees | v1 supports labour + materials only |

---

## 13. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Refresh token rotation (BOTH providers) lost on crash → re-OAuth required | Save NEW refresh BEFORE using new access in `token-store.ts`; Xero allows a ~30-min grace retry |
| Xero uncertified-app cap (25 orgs) blocks onboarding | Apply for App Partner certification before client #26 |
| OAuth callback CSRF / code splicing → victim business bound to attacker's org | `state` nonce verified on return; business derived from caller's JWT, never from redirect params (section 1) |
| QBO Item deleted by client → invoice fails | Pre-flight check; on 404, recreate item + update `accounting_revenue_account` |
| US sales tax (AST) conflicts with explicit TaxCodeRef | Detect during connect + tax onboarding; omit `TaxCodeRef` if AST on |
| Refresh token expired (inactive client) | Warn UI at 80% of expiry; force re-OAuth on failure |
| Webhook replay attacks | HMAC verification + dedupe via `webhook_events` table |
| Encryption key lost or rotated | Document; tokens become useless → forces client re-OAuth. Plan maintenance window for key rotation |
| Provider downtime → invoice send fails | Surface to UI with retry button. No silent failures |
| Race: two masters connect simultaneously | Last-write-wins is acceptable; both end up working with the new tokens |
| Voiding fails (invoice already approved/sent by client) | Surface error; allow job revert anyway; log void failure |
| Webhook URL changes (custom domain switch) | Re-register URLs at both dashboards — part of [LAUNCH.md](LAUNCH.md) Phase 3 checklist |

---

## 14. Schema — migration 32 (sketch)

> **Numbering:** the repo is currently at migration 31 (plan guard). "32" assumes accounting ships before Stripe (which takes 33) — use the next free number at build time. Earlier drafts of this plan said "migration 25"; 25 shipped long ago (jobs SELECT tightening), so never reuse it.

```sql
-- Non-secret config lives on businesses (the UI reads these via select *)
alter table businesses
  add column accounting_provider text not null default 'none'
    check (accounting_provider in ('none','xero','qbo')),
  add column accounting_connected boolean not null default false,
  add column accounting_tenant_id text,          -- Xero tenant ID / QBO realm ID
  add column accounting_environment text,        -- QBO: 'sandbox' | 'production'
  add column accounting_region text,             -- QBO: 'US','UK','CA','AU','GLOBAL'
  add column accounting_email text,              -- org email shown in settings UI
  add column accounting_tax_code text,           -- Xero TaxType / QBO TaxCodeRef
  add column accounting_revenue_account text,    -- Xero account code / QBO labour Item ID
  add column accounting_materials_account text,  -- QBO materials Item ID
  add column accounting_hourly_rate numeric(8,2),
  add column accounting_due_days integer default 14;

-- Same Xero org / QBO company can't be claimed by two businesses
create unique index businesses_accounting_tenant_uniq
  on businesses (accounting_provider, accounting_tenant_id)
  where accounting_tenant_id is not null;

-- TOKENS: separate, service-role-only table. RLS on, NO policies, NO grants —
-- ciphertext must never reach the browser (AppContext selects * on businesses).
create table accounting_tokens (
  business_id  uuid primary key references businesses(id) on delete cascade,
  access_token  text not null,                   -- AES-256-GCM ciphertext
  refresh_token text not null,                   -- AES-256-GCM ciphertext
  token_expires_at timestamptz not null,
  refresh_expires_at timestamptz,                -- QBO 100-day sliding window
  updated_at timestamptz default now()
);
alter table accounting_tokens enable row level security;

alter table customers add column accounting_contact_id text;

alter table jobs
  add column accounting_invoice_id text,
  add column accounting_invoice_status text
    check (accounting_invoice_status in ('sent','paid','voided')),
  add column accounting_last_error text;

-- Webhook lookups
create index jobs_accounting_invoice_id_idx on jobs (accounting_invoice_id)
  where accounting_invoice_id is not null;

-- webhook_events table: see section 7 (RLS on, no policies, no grants, pg_cron cleanup)

-- Guard trigger (same pattern as migrations 24/30): masters hold a row-level
-- UPDATE policy on businesses, so without this they could write accounting_*
-- state columns directly. Allow service-role (auth.uid() is null); allow
-- masters to change ONLY the settings columns (tax code, rate, due days);
-- reject client changes to provider/connected/tenant columns.

-- Drop the original Xero stub columns LAST, and ONLY in the same deploy as the
-- client code that stops using them — the live client still reads
-- businesses.xero_connected/xero_email and INSERTS customers.xero_contact_id
-- (createCustomer), so dropping early breaks customer creation:
--   alter table businesses drop column xero_connected, drop column xero_email;
--   alter table customers drop column xero_contact_id;
--   alter table jobs drop column xero_invoice_id;
```
