# Launch Plan

> **Status:** Practical checklist for taking PipeLine from a Netlify preview URL to a production domain with real clients onboarded. Sequenced so each phase unblocks the next.

This doc is the single source of truth for going live. Other docs cover the *how* of individual systems — this one covers the *order of operations*.

---

## Phases at a glance

| Phase | What | When | Doc |
| ----- | ---- | ---- | --- |
| 1 | Internal staging on Netlify URL | Now | This doc |
| 2 | Client testing on Netlify URL | First 1–2 clients | This doc |
| 3 | Custom domain + production hardening | Before public launch | This doc |
| 4 | Xero integration rollout | Per-client, after they're stable on the app | [XERO.md](XERO.md) |
| 5 | Scale-up — additional clients onboarded | Ongoing | [SUPERADMIN.md](SUPERADMIN.md) |

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

## Phase 4 — Xero integration rollout

**Don't do this until at least one client is stable on the app for a week or two.** Xero adds OAuth complexity, token refresh edge cases, and per-client config. Trying to debug both at once is painful.

Order of operations once a client is ready:

1. **Build the integration** — follow [XERO.md](XERO.md) sections 1–3 (developer app, OAuth callback, invoice function) and section 7 (contact sync)
2. **Test in the Xero demo company** — Xero provides a sandbox org you can connect to before going live
3. **Verify the schema additions are migrated** in production Supabase:
   - `xero_access_token`, `xero_refresh_token`, `xero_token_expires_at`, `xero_tenant_id` on `businesses`
   - `xero_account_code`, `xero_tax_type`, `xero_hourly_rate`, `xero_due_days` on `businesses`
   - `xero_contact_id` on `customers`
4. **Per-client onboarding flow:**
   - Master clicks "Connect to Xero" in Account Settings
   - Goes through OAuth — first connect runs the contact import (section 7a in XERO.md)
   - Master sets their `xero_account_code`, `xero_tax_type`, `xero_hourly_rate` to match their chart of accounts
   - Test by completing one job and clicking "Send to Xero" — verify draft invoice appears in their Xero org
5. **Sign-off** — get the client to confirm the draft invoice looks correct before they approve it in Xero

### Xero env vars to add to Netlify

```
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=
XERO_REDIRECT_URI=https://yourdomain.com/account
APP_URL=https://yourdomain.com
```

---

## Phase 5 — Scale-up

Once one or two clients are live and stable, additional onboarding follows the existing super admin flow — see [SUPERADMIN.md](SUPERADMIN.md).

Things that get harder with more clients:

- **SMTP volume** — track usage, upgrade plan if approaching limit
- **Supabase row count** — free tier is 500 MB; jobs accumulate fast with photos. Move to Pro ($25/mo) before hitting it
- **Netlify Functions** — free tier is 125k invocations/month and 100 hours of compute. Push notifications and Xero invoicing add up
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

### Required for Phase 4 (Xero)

| Variable             | Source                              |
| -------------------- | ----------------------------------- |
| `XERO_CLIENT_ID`     | Xero developer app                  |
| `XERO_CLIENT_SECRET` | Xero developer app — server-only    |
| `XERO_REDIRECT_URI`  | `https://yourdomain.com/account`    |
| `VITE_XERO_CLIENT_ID` | Same as `XERO_CLIENT_ID` (browser uses this to build the auth URL) |
| `VITE_XERO_REDIRECT_URI` | Same as `XERO_REDIRECT_URI`     |

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

**Xero (if applicable for the client)**
- [ ] Xero developer app created and configured with custom-domain redirect
- [ ] Tested with Xero demo company
- [ ] Client's `xero_account_code`, `xero_tax_type`, `xero_hourly_rate` set
- [ ] Test invoice raised and verified in their Xero org

---

## When something breaks post-launch

- **Build fails on Netlify** — check the build log for TS errors. Common cause: unused locals (TS6133)
- **Login fails on production but works locally** — almost always a Supabase URL Configuration issue, double-check Site URL and Redirect URLs
- **Push notifications stop working** — VAPID keys must match between Netlify env vars and client; if rotated, all subscriptions become invalid and need re-subscribing
- **Xero token rejected** — likely token expired and refresh failed. Check `xero_token_expires_at` and that `xero-create-invoice` is calling `getValidToken()` first
- **Client says "I added a customer in Xero, it's not in the app"** — current sync is one-way (app → Xero). See section 7c of XERO.md for the polling option
