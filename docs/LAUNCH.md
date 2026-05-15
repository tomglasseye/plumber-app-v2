# Launch Plan

> **Status:** Practical checklist for taking HiveQ from a Netlify preview URL to a production domain with real clients onboarded. Sequenced so each phase unblocks the next.

This doc is the single source of truth for going live. Other docs cover the *how* of individual systems — this one covers the *order of operations*.

---

## Phases at a glance

| Phase | What | When | Doc |
| ----- | ---- | ---- | --- |
| 1 | Internal staging on Netlify URL | Now | This doc |
| 2 | Client testing on Netlify URL | First 1–2 clients | This doc |
| 3 | Custom domain + production hardening | Before public launch | This doc |
| 4 | Accounting integration rollout (Xero + QuickBooks) | Per-client, after they're stable on the app | [ACCOUNTING.md](ACCOUNTING.md) |
| 5 | Stripe billing — recurring subscriptions for clients using the app | Before charging anyone | This doc |
| 6 | Scale-up — additional clients onboarded | Ongoing | [SUPERADMIN.md](SUPERADMIN.md) |

---

## Phase 1 — Internal staging (current state)

The app is deployed at `https://your-site.netlify.app`. Before inviting any real client, confirm:

- [ ] Production Supabase project exists (separate from any dev/local one) — see [SUPABASE.md](SUPABASE.md)
- [ ] All migrations 1–24 have been run in production Supabase
- [ ] At least one super admin row exists in `super_admins` (manually inserted via SQL)
- [ ] Netlify env vars set (see env var section below)
- [ ] Build passes (`npm run build`) — TypeScript strict mode catches a lot pre-deploy
- [ ] Service worker registers without errors (DevTools → Application → Service Workers)

---

## Phase 2 — Client testing on Netlify URL

You can run client trials on the `*.netlify.app` URL — no domain needed yet. Per client:

1. **Create the business** via the super admin page (`/admin`)
2. **Brand colour** — pick from the swatch picker (now all 18 options, see AdminPage)
3. **Master invite email** is sent automatically — Supabase's "Invite user" template (see Supabase dashboard → Authentication → Email Templates)
4. **Master accepts** — sets their own password via the magic link
5. **Master adds engineers** from the Team page

### Things that work on the Netlify URL but feel unpolished
- Push notification permissions look more trustworthy on a custom domain
- iOS install prompt shows the netlify URL — fine for testing, not for sales
- Outbound emails come from Supabase's default sender

### Things to watch during testing
- [ ] Push notifications fire on real iOS / Android home-screen installs (not just dev tools)
- [ ] Offline mutation queue actually replays when reconnecting (drop wifi, change a job, reconnect)
- [ ] Calendar drag-drop works on touch devices
- [ ] Photos upload and display via signed URLs

---

## Phase 3 — Custom domain + production hardening

This is the biggest jump. Do all of these before going public — most affect URLs that get baked into emails, tokens, and OAuth callbacks.

### 3a. Pick and register a domain

You don't have one yet. Options:
- `.com` — most trusted for B2B SaaS, ~£10/year via Namecheap, Cloudflare, Porkbun, etc.
- `.co.uk` — fine if UK-only, ~£8/year via 123-reg, Easyspace
- `.app` / `.io` — premium, more expensive

Considerations:
- Short and memorable — engineers will type it on phone keyboards
- Avoid hyphens — they're a typing tax
- Buy the matching `.co.uk` defensively if you go `.com` (or vice versa)

Once registered, **don't point DNS yet** — just hold it. The Netlify config below will tell you exactly what records to add.

### 3b. Connect domain to Netlify

In Netlify:

1. **Site Settings → Domain management → Add a domain**
2. Enter your domain (e.g. `pipeline.app`)
3. Netlify will give you DNS records to add at your registrar — typically:
   - `A` record → Netlify load balancer IP
   - `CNAME` for `www` → `<your-site>.netlify.app`
4. Add those records at your registrar; propagation takes 5 min – 24 hr
5. **Enable HTTPS** — Netlify provisions a Let's Encrypt cert automatically once DNS resolves
6. **Force HTTPS redirect** — toggle in Netlify Domain settings
7. **Set primary domain** — pick `pipeline.app` or `www.pipeline.app` (the other becomes a redirect)

### 3c. Update everywhere the URL is referenced

Once the domain is live, update these — **in order**:

1. **Netlify env vars**
   - `XERO_REDIRECT_URI` — change to `https://yourdomain.com/account` (when Xero is added)
   - `APP_URL` — change to `https://yourdomain.com`
   - Trigger a redeploy so functions pick up new values
2. **Supabase Auth → URL Configuration**
   - **Site URL** → `https://yourdomain.com`
   - **Redirect URLs** → add `https://yourdomain.com` (keep `localhost:5173` for dev)
   - This is what password reset emails will link to
3. **Supabase Auth → Email Templates**
   - Customise the "Invite user" template if you want it on-brand
   - `{{ .SiteURL }}` will now resolve to your custom domain
4. **PWA manifest** (`vite.config.ts`)
   - No URL is hardcoded so nothing to change, but verify install icon and name look right post-deploy

### 3d. Email — set up real SMTP

Supabase free-tier email is rate-limited to ~4/hour. With multiple clients onboarding, you'll hit this quickly.

**Set up a real SMTP provider** — Supabase Dashboard → Authentication → SMTP Settings.

Recommended:
- **Resend** — simplest API, generous free tier (100/day), sender domain verification via DNS
- **Postmark** — best deliverability for transactional, 100/month free
- **SendGrid** — 100/day free, more legacy

Setup checklist:
- [ ] Sign up with provider
- [ ] Add SPF and DKIM records at your registrar (provider gives you the values)
- [ ] Verify sending domain
- [ ] Configure SMTP in Supabase with provider's host/port/credentials
- [ ] Send a test password reset to confirm delivery from your domain (not `noreply@supabase.co`)

See [SECURITY.md](SECURITY.md) for the full SMTP rationale.

### 3e. VAPID for push notifications

Already configured but verify in Netlify env vars (see [NOTIFICATIONS.md](NOTIFICATIONS.md)):

| Variable                | Value                                       |
| ----------------------- | ------------------------------------------- |
| `VAPID_PUBLIC_KEY`      | From `npx web-push generate-vapid-keys`     |
| `VAPID_PRIVATE_KEY`     | From the same command (server-only)         |
| `VAPID_MAILTO`          | `mailto:you@yourdomain.com`                 |
| `VITE_VAPID_PUBLIC_KEY` | Same as `VAPID_PUBLIC_KEY` (browser-safe)   |

> **Note:** Netlify currently has a `VAPID_EMAIL` env var set, but the code reads `VAPID_MAILTO`. If push is reporting `mailto:admin@example.com` to push services, rename the Netlify env var to `VAPID_MAILTO`.

### 3f. Production security review

Run through [SECURITY.md](SECURITY.md) before going public:

- [ ] Service role key is **only** in Netlify env vars, not in the repo or `.env.local`
- [ ] `.env.local` is in `.gitignore`
- [ ] RLS policies tested — log in as engineer, confirm you can't see another business's data via direct SQL
- [ ] Rate limiting acceptable for current scale (in-memory is OK for < 50 clients)
- [ ] Audit log writes are working (`audit_log` table populates on actions)

---

## Phase 4 — Accounting integration rollout (Xero + QuickBooks Online)

**Don't do this until at least one client is stable on the app for a week or two.** Accounting integration adds OAuth complexity, token refresh edge cases, webhook handling, and per-client config. Trying to debug app stability and accounting integration at once is painful.

**Key concept:** You create ONE Xero developer app AND ONE Intuit (QuickBooks) developer app — one-time setup. Each client then independently picks Xero **or** QuickBooks and connects their own accounting organisation. The app uses a provider abstraction so dispatcher code is provider-agnostic. See [ACCOUNTING.md](ACCOUNTING.md) for the full architecture, interface contract, and per-provider quirks.

**Estimated effort:** ~16 focused dev days (~125 hours) to build both providers + all launch-readiness features (disconnect/de-auth, retry, audit logging, invoice void, payment status webhooks, AES-GCM token encryption, Stripe billing gate).

### ONE-TIME SETUP (before any client connects)

1. **Developer apps**
   - Create Xero developer app at [developer.xero.com](https://developer.xero.com)
   - Create Intuit developer app at [developer.intuit.com](https://developer.intuit.com)
   - Register webhook URLs in both dashboards (`https://yourdomain.com/.netlify/functions/accounting-webhook-{xero|qbo}`)
2. **Env vars** — see the Phase 4 table further down; includes `ACCOUNTING_ENCRYPTION_KEY` (generate with `openssl rand -hex 32`)
3. **Migration 25** — adds generic `accounting_*` columns to `businesses`, `customers.accounting_contact_id`, `jobs.accounting_invoice_id`/`_status`/`_last_error`, plus a `webhook_events` table. Drops the original Xero stub columns (no production data behind them).
4. **Build the integration** — follow [ACCOUNTING.md](ACCOUNTING.md) build order:
   1. Migration 25 schema
   2. `_accounting/types.ts` + `token-store.ts` (AES-GCM) + `audit.ts` + `billing-gate.ts`
   3. `XeroProvider` end-to-end + dispatcher functions + frontend Accounting tab
   4. **Pause: test Xero with one real client for 1–2 weeks** before adding QBO — validates the abstraction
   5. `QboProvider` + Item bootstrap + frontend QBO-specific fields
   6. Webhook ingestion (both providers) + paid status badges
   7. Disconnect flow + reconnect banner + de-auth detection
   8. Void flow on job revert
5. **Sandbox testing** — Xero demo company + QBO sandbox. Each end-to-end scenario in [ACCOUNTING.md](ACCOUNTING.md) section 11 must pass before any real client connects.

### PER-CLIENT ONBOARDING (repeat for each business)

1. **Client master goes to Account Settings → Accounting tab** and picks their provider (Xero or QuickBooks)
2. **Clicks "Connect to {Provider}"** — completes OAuth in their own accounting org
3. **VAT/tax onboarding prompt** — app asks "Are you VAT registered?" and sets `accounting_tax_code` accordingly. Defaulting to 20% VAT would be wrong for non-VAT-registered trades, so this is explicit.
4. **For QBO clients only:** the app auto-creates "Labour" and "Materials" Service Items in their QuickBooks. They can rename in QBO afterwards.
5. **Master sets hourly rate and due days** in the settings form
6. **Test invoice:** complete a small job → click "Send to {Provider}" → verify draft invoice appears in their accounting system
7. **Sign-off** — client confirms the draft looks correct before approving it in their accounting system

### Phase 4 env vars to add to Netlify

These are your developer app credentials — set once, not per-client. See [ACCOUNTING.md](ACCOUNTING.md) section 10 for the full list with descriptions.

```
# Xero (one-time, your developer app)
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=                       ← server-only, NEVER expose
XERO_REDIRECT_URI=https://yourdomain.com/account
XERO_WEBHOOK_KEY=
VITE_XERO_CLIENT_ID=
VITE_XERO_REDIRECT_URI=https://yourdomain.com/account

# QuickBooks (one-time, your Intuit developer app)
INTUIT_CLIENT_ID=
INTUIT_CLIENT_SECRET=                     ← server-only
INTUIT_REDIRECT_URI=https://yourdomain.com/account
INTUIT_ENVIRONMENT=production
INTUIT_WEBHOOK_VERIFIER=
VITE_INTUIT_CLIENT_ID=
VITE_INTUIT_REDIRECT_URI=https://yourdomain.com/account

# Shared
APP_URL=https://yourdomain.com
ACCOUNTING_ENCRYPTION_KEY=                ← 32-byte hex, generate once: openssl rand -hex 32
```

---

## Phase 5 — Stripe billing (recurring subscriptions)

**Don't start this until at least one client is happily using the app.** No point wiring up billing for a product nobody's on yet — but it has to land before you charge anyone.

The plans are already public on [AboutPage.tsx](../src/pages/AboutPage.tsx): Starter £120/mo, Pro £159/mo, both 6–8 users (Pro adds customer SMS). Stripe just needs to mirror them.

Full implementation guide is in [STRIPE.md](STRIPE.md). High-level checklist:

- [ ] **Decisions** — annual price for each plan, trial length + card-on-file or not, what happens when a Pro client crosses 8 users
- [ ] **Stripe account** — create account, complete business verification, set up test-mode Products + Prices for Starter and Pro (monthly + annual = 4 Prices total), enable Customer Portal, configure Stripe Tax for VAT
- [ ] **Schema** — migration 25 adds `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id`, `plan`, `subscription_status`, `current_period_end`, `trial_ends_at` to `businesses`; new `billing_events` table for webhook idempotency
- [ ] **Netlify Functions** — `stripe-create-checkout-session`, `stripe-create-portal-session`, `stripe-webhook` (signature-verified, idempotent)
- [ ] **Frontend** — Pricing/Subscribe page, Billing tab on Account, trial banner, access gate for `past_due`/`canceled` past `current_period_end`
- [ ] **Pro feature gating** — SMS UI + function check `business.plan === 'pro'`
- [ ] **Lifecycle smoke test** — subscribe → trial-end → upgrade → payment-fail → cancel → re-subscribe, all via Stripe CLI test events
- [ ] **Live-mode cutover** — recreate Products/Prices/webhook in live mode, swap the six Stripe env vars in Netlify, redeploy, verify with a real card

---

## Phase 6 — Scale-up

Once one or two clients are live and stable, additional onboarding follows the existing super admin flow — see [SUPERADMIN.md](SUPERADMIN.md).

Things that get harder with more clients:

- **SMTP volume** — track usage, upgrade plan if approaching limit
- **Supabase row count** — free tier is 500 MB; jobs accumulate fast with photos. Move to Pro ($25/mo) before hitting it
- **Netlify Functions** — free tier is 125k invocations/month and 100 hours of compute. Push notifications, accounting invoicing, and webhook handling add up
- **Audit log retention** — `audit_log` will grow indefinitely. Add a `pg_cron` job to archive/delete entries older than (say) 2 years

---

## Master env var reference (production Netlify)

Everything that should be set in Netlify before going live. Variables prefixed `VITE_` are baked into the client bundle (safe to expose); others are server-only.

### Currently required (already set)

| Variable                  | Where used                  | Source                          |
| ------------------------- | --------------------------- | ------------------------------- |
| `VITE_SUPABASE_URL`       | Browser                     | Supabase project settings       |
| `VITE_SUPABASE_ANON_KEY`  | Browser                     | Supabase project settings       |
| `SUPABASE_URL`            | Netlify Functions           | Same as above                   |
| `SUPABASE_ANON_KEY`       | Netlify Functions           | Same as above                   |
| `SUPABASE_SERVICE_ROLE_KEY` | Netlify Functions (admin)  | Supabase project settings — never expose |
| `VITE_VAPID_PUBLIC_KEY`   | Browser (push subscribe)    | `npx web-push generate-vapid-keys` |
| `VAPID_PUBLIC_KEY`        | Netlify Functions (send-push) | Same as above                  |
| `VAPID_PRIVATE_KEY`       | Netlify Functions (send-push) | Same command                   |
| `VAPID_MAILTO`            | Netlify Functions (send-push) | `mailto:you@yourdomain.com` (currently misnamed `VAPID_EMAIL` — needs renaming) |

### Required for Phase 3 (custom domain)

| Variable    | Value                          |
| ----------- | ------------------------------ |
| `APP_URL`   | `https://yourdomain.com`       |

### Required for Phase 5 (Stripe)

| Variable                      | Source                                |
| ----------------------------- | ------------------------------------- |
| `STRIPE_SECRET_KEY`           | Stripe API keys — server-only         |
| `STRIPE_WEBHOOK_SECRET`       | Stripe webhook endpoint — server-only |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe API keys (browser-safe)        |
| `STRIPE_PRICE_STARTER_MONTHLY` | Stripe Price (Starter £120/mo)       |
| `STRIPE_PRICE_STARTER_ANNUAL`  | Stripe Price (Starter annual)        |
| `STRIPE_PRICE_PRO_MONTHLY`     | Stripe Price (Pro £159/mo)           |
| `STRIPE_PRICE_PRO_ANNUAL`      | Stripe Price (Pro annual)            |

### Required for Phase 4 (Accounting — Xero + QuickBooks)

| Variable                      | Source                                                                 | Scope   |
| ----------------------------- | ---------------------------------------------------------------------- | ------- |
| `XERO_CLIENT_ID`              | Xero developer app                                                     | Server  |
| `XERO_CLIENT_SECRET`          | Xero developer app — **NEVER expose to browser**                       | Server  |
| `XERO_REDIRECT_URI`           | `https://yourdomain.com/account` (must match Xero app)                 | Server  |
| `XERO_WEBHOOK_KEY`            | Xero webhook signing key (HMAC verification)                           | Server  |
| `VITE_XERO_CLIENT_ID`         | Same as `XERO_CLIENT_ID` (browser uses for OAuth URL)                  | Browser |
| `VITE_XERO_REDIRECT_URI`      | Same as `XERO_REDIRECT_URI`                                            | Browser |
| `INTUIT_CLIENT_ID`            | Intuit developer app (QuickBooks)                                      | Server  |
| `INTUIT_CLIENT_SECRET`        | Intuit developer app — **NEVER expose to browser**                     | Server  |
| `INTUIT_REDIRECT_URI`         | `https://yourdomain.com/account` (must match Intuit app)               | Server  |
| `INTUIT_ENVIRONMENT`          | `sandbox` or `production`                                              | Server  |
| `INTUIT_WEBHOOK_VERIFIER`     | Intuit webhook verifier token (HMAC verification)                      | Server  |
| `VITE_INTUIT_CLIENT_ID`       | Same as `INTUIT_CLIENT_ID`                                             | Browser |
| `VITE_INTUIT_REDIRECT_URI`    | Same as `INTUIT_REDIRECT_URI`                                          | Browser |
| `APP_URL`                     | `https://yourdomain.com` (for invoice "view job" deep-links)           | Server  |
| `ACCOUNTING_ENCRYPTION_KEY`   | 32-byte hex — `openssl rand -hex 32`. **Losing this forces all clients to reconnect.** | Server  |

---

## Pre-launch sign-off checklist

A single page to print/screenshot before announcing the app:

**Infrastructure**
- [ ] Custom domain registered and pointing to Netlify with HTTPS
- [ ] Supabase Site URL + Redirect URLs updated to custom domain
- [ ] SMTP provider configured with verified sender domain (SPF + DKIM passing)
- [ ] All Netlify env vars set per the table above
- [ ] `VAPID_EMAIL` renamed to `VAPID_MAILTO` (see note in Phase 3e)

**Functional**
- [ ] One full client onboarded end-to-end (business + master + 1+ engineer)
- [ ] Password reset email arrives from custom domain, link works
- [ ] Push notification fires on a real iOS install
- [ ] Offline edit replays after reconnect
- [ ] Job photo upload works on a real phone

**Security**
- [ ] [SECURITY.md](SECURITY.md) checklist reviewed
- [ ] At least one super admin exists, no extras
- [ ] RLS smoke-tested with two businesses

**Accounting integration (one-time setup + per-client onboarding)**

One-time:
- [ ] Xero developer app created at developer.xero.com with custom-domain redirect + webhook URL
- [ ] Intuit developer app created at developer.intuit.com with custom-domain redirect + webhook URL
- [ ] `ACCOUNTING_ENCRYPTION_KEY` generated (`openssl rand -hex 32`) and set in Netlify (and BACKED UP securely — losing it forces all clients to reconnect)
- [ ] Migration 25 run in production Supabase
- [ ] Netlify Functions built: `_accounting/` shared module (types, factory, token-store, audit, billing-gate), `XeroProvider`, `QboProvider`, dispatchers (callback, create-invoice, create-contact, disconnect, void-invoice), webhooks (xero, qbo)
- [ ] Accounting tab UI added to Account Settings (provider picker + post-OAuth tax prompt + disconnect button)
- [ ] Send Invoice button on JobDetailPage handles billing gate, validation, retry, paid badge
- [ ] Reconnect banner on DashboardPage detects external de-auth
- [ ] DB inspection confirms tokens stored as encrypted ciphertext, not plaintext
- [ ] Tested end-to-end with Xero demo company (OAuth, send, void, paid webhook, disconnect)
- [ ] Tested end-to-end with QBO sandbox (OAuth, Item bootstrap, send, void, paid webhook, disconnect)
- [ ] Cross-leak test: Business A's session cannot read Business B's tokens

Per-client:
- [ ] Client picked their provider (Xero or QuickBooks)
- [ ] Client completed OAuth + tax-registration prompt
- [ ] Client confirmed hourly rate and due days
- [ ] Test invoice raised and verified in their accounting system
- [ ] Client signed off on the draft invoice format

---

## When something breaks post-launch

- **Build fails on Netlify** — check the build log for TS errors. Common cause: unused locals (TS6133)
- **Login fails on production but works locally** — almost always a Supabase URL Configuration issue, double-check Site URL and Redirect URLs
- **Push notifications stop working** — VAPID keys must match between Netlify env vars and client; if rotated, all subscriptions become invalid and need re-subscribing
- **Accounting token rejected (401)** — token expired and refresh failed. Check `accounting_token_expires_at` and that `accounting-create-invoice` is calling `getValidToken()` first. For QBO specifically: if the refresh token was used but the new one wasn't persisted (crash mid-refresh), the client must re-OAuth.
- **`ACCOUNTING_ENCRYPTION_KEY` missing or wrong** — `decryptToken()` throws and all invoice sends fail for all clients. Recover by restoring the env var from backup; if truly lost, all clients must re-OAuth.
- **Invoice posts to wrong account** — check that `accounting-create-invoice` is fetching the client's `accounting_revenue_account` and `accounting_tax_code` from the database instead of hardcoding. Each client has different setups.
- **QBO invoice fails with "Item not found"** — client deleted the Labour/Materials Service Item in QBO. Re-run `bootstrapDefaults()` to recreate; update `accounting_revenue_account`/`accounting_materials_account` with new IDs.
- **QBO invoice has wrong/no tax** — US Automated Sales Tax conflicts with explicit `TaxCodeRef`. Check `Preferences.TaxPreferences.UsingSalesTax`; if true, omit `TaxCodeRef` entirely.
- **Webhook signature mismatch** — `XERO_WEBHOOK_KEY` or `INTUIT_WEBHOOK_VERIFIER` doesn't match the dashboard. Re-copy from the provider's developer portal.
- **Invoice gated by billing** — `subscription_status` is `past_due` or `canceled` past `current_period_end`. Resolve via Stripe Customer Portal; see [STRIPE.md](STRIPE.md).
- **Client says "Reconnect to Xero/QuickBooks" banner appeared** — they (or someone in their org) revoked the app from inside their accounting system. Walk them through reconnecting; tokens are now invalid.
- **Client switches accounting orgs, invoices land on wrong contacts** — check that `accounting-callback` is detecting tenant/realm switch and clearing `accounting_contact_id` values for that business.
- **Client says "I added a customer in Xero/QBO, it's not in the app"** — current sync is one-way (app → provider). Reverse sync is out of scope for v1; see [ACCOUNTING.md](ACCOUNTING.md) section 12.
- **Stripe issues (webhooks not firing, stuck subscriptions, plan column not updating)** — see the troubleshooting section in [STRIPE.md](STRIPE.md)
