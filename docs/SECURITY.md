# Security Hardening

> **Status:** This document covers production security considerations for a multi-tenant SaaS deployment. Most items are configuration or infrastructure changes, not code.

> **See also:** [LAUNCH.md](LAUNCH.md) for the sequenced production rollout — domain setup, env vars, SMTP, sign-off checklist. This doc is the deeper rationale for why those steps matter.

---

## Email — invite-only policy

HiveQ deliberately keeps email to a **single touchpoint**: the new-business **master invite** (`create-business` → Supabase `inviteUserByEmail`, which sends a set-password magic link). Everything else is emailless by design:

- **Engineer onboarding** — `admin-invite-user` creates the account with a password the master sets (`email_confirm: true`), so no email is sent (despite the function name).
- **Password recovery** — admin-driven, not self-service: the login page shows "Forgotten your password? Contact your administrator," and masters/super-admins reset via `admin-update-password`.

Don't add email-dependent features (email notifications, self-service password reset, emailed reports/invoices) without revisiting this decision.

### SMTP

Because email is invite-only, there's no transactional volume — Supabase's built-in sender (~4 emails/hour on the free tier) is rarely stressed, and you do **not** need Resend/Postmark/SendGrid for throughput. The only reason to configure custom SMTP (Supabase Dashboard → Authentication → SMTP Settings) is **branding**: sending the invite from `hiveq.co.uk` rather than `noreply@supabase.co`. If you do, set SPF + DKIM on the domain to avoid spam filtering.

> Edge case: `admin-update-email` (changing a user's login email) may still trigger a Supabase confirmation email.

---

## Rate Limiting

### Current state
`netlify/functions/login-rate-limit.ts` is a two-phase IP + email limiter using in-memory `Map`s. The login page calls `phase: "check"` before attempting auth (gates access) and `phase: "record-failure"` only when Supabase rejects the credentials — successful logins never count toward the lockout. IP comes only from `context.ip`; the `x-forwarded-for` header is ignored because it's client-controllable on Netlify Functions. Limits: 10 failures per IP and 5 per email per 15-minute window.

The Maps reset on cold start and are per-instance, so this is a first line of defence — Supabase Auth's own server-side rate limits sit behind it.

### Production recommendation
For a small-scale app (< 50 clients), the in-memory approach is acceptable — cold starts are infrequent during active hours and Supabase Auth itself has server-side rate limiting.

For higher security:
- **Supabase Auth settings:** Configure rate limits in Supabase Dashboard → Authentication → Rate Limits. Set max sign-in attempts per IP.
- **Table-based rate limiting:** Replace the in-memory Maps with a Supabase `rate_limits` table (IP/email + timestamp + attempt count). Query/update in the Netlify Function. Auto-expire old entries with a pg_cron job.
- **Cloudflare:** If deployed behind Cloudflare, use their rate limiting rules (free tier includes 1 rule).

---

## Accounting Token Encryption & Multi-Client Isolation

When the accounting integration is built ([ACCOUNTING.md](ACCOUNTING.md)), OAuth tokens for Xero and QuickBooks (`accounting_access_token`, `accounting_refresh_token`) are stored in the `businesses` table. These grant full access to each client's accounting data — invoice creation, contact records, chart of accounts. In a multi-client environment, strict isolation is critical: Dave's token must never be accessible to Sarah's app session, and a database breach must not yield plaintext OAuth tokens.

### Multi-client isolation
- Each business stores its own `accounting_tenant_id` (Xero tenant ID or QBO realm ID, indexed unique per provider so the same Xero org can't be claimed by two businesses)
- **Tokens live in a dedicated `accounting_tokens` table** (RLS enabled, zero policies, zero grants — service-role only; see ACCOUNTING.md §14). They must NOT sit on `businesses`: the app does `select("*")` on that table, which would ship the ciphertext to every member's browser. With the separate table, tokens genuinely never touch the browser.
- RLS policies on the `businesses` table ensure a user can only access their own business's row (non-secret accounting config only)
- Netlify Functions fetch tokens via the Supabase **service role key**, server-only
- Each `accounting-create-invoice` call validates the caller is a **master** of the business, and that the job's `ready_to_invoice` is true **in the DB** — the Final Complete gate must hold at this layer too
- The OAuth callback verifies a **`state` nonce** and derives the business from the caller's JWT, never from redirect parameters — otherwise a spliced authorization code binds the victim's business to an attacker's accounting org (see ACCOUNTING.md §1)

### Token encryption — AES-256-GCM at the application layer

Tokens are encrypted before being written to the database, using an `ACCOUNTING_ENCRYPTION_KEY` Netlify env var (32-byte hex, generated once via `openssl rand -hex 32`). This means even a full database leak does not yield usable tokens.

Implemented in `netlify/functions/_accounting/token-store.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
const KEY = Buffer.from(process.env.ACCOUNTING_ENCRYPTION_KEY!, "hex");

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");  // iv || authTag || ciphertext
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

### Key management
- **`ACCOUNTING_ENCRYPTION_KEY` must be backed up securely** — losing it means every client must re-OAuth (acceptable but disruptive failure mode)
- **Key rotation:** to rotate, run a one-off migration in a maintenance window that decrypts all tokens with the old key and re-encrypts with the new key. Keep both keys live during the window.
- **Never expose the key to the browser** — server-only Netlify env var, never `VITE_` prefixed
- **Never log decrypted tokens** — no `console.log(accessToken)` anywhere in functions

### QBO refresh token rotation safety
QuickBooks rotates the refresh token on every refresh — the old one is invalidated immediately on success. `getValidToken()` must **persist the new refresh token before using the new access token** so a crash mid-refresh doesn't leave the client with no valid refresh token. See [ACCOUNTING.md](ACCOUNTING.md) section 4b for the implementation.

### Webhook signature verification
Inbound webhooks from Xero and Intuit must be verified before any DB mutation:
- Xero: HMAC-SHA256 of the raw body with `XERO_WEBHOOK_KEY`, compared to the `x-xero-signature` header
- Intuit: HMAC-SHA256 of the raw body with `INTUIT_WEBHOOK_VERIFIER`, compared to the `intuit-signature` header
- Replay protection via a `webhook_events(provider, event_id)` unique-keyed table — duplicates are ignored

Without signature verification, anyone could POST to the webhook URL and mark arbitrary invoices as paid.

---

## GDPR & Data Retention

### Customer data
- Customer records (names, addresses, phones, emails) are personal data under GDPR
- Each business is the **data controller**; the app platform is the **data processor**
- A data processing agreement (DPA) template should be provided to each client on signup

### Right to erasure
- When a customer requests deletion, the master should be able to delete their contact and all associated job data
- Deleting a customer sets linked jobs' `customer_id` to null (`ON DELETE SET NULL`); job records themselves are retained for business records
- Consider adding a "Delete customer and anonymise job records" flow that replaces customer name/address/phone with "[Deleted]"

### Data retention policy
| Data type | Recommended retention | Notes |
|---|---|---|
| Active jobs | Indefinite | Business needs ongoing access |
| Completed/Invoiced jobs | 7 years | UK tax record requirements |
| Audit log | 2 years | Compliance and dispute resolution |
| Push subscriptions | Until unsubscribed | Auto-cleaned when expired |
| Customer contacts | Until deleted by master | GDPR — delete on request |

### Account deletion
- When a business is deleted (by superadmin), cascade deletes handle all data cleanup
- Auth users must be deleted separately via the Supabase admin API (service role)
- Add a "Delete client" confirmation flow to the admin page with a 30-day grace period

---

## Audit Log

An `audit_log` table (migration 16) records admin actions in a tamper-proof way. Clients cannot write to it directly — all writes go through the `log_audit_event()` security-definer function, so a compromised client cannot forge or suppress records.

### Recorded events

| Action                          | When                                  |
| ------------------------------- | ------------------------------------- |
| `job.created`                   | Job created                           |
| `job.status_changed`            | Status updated                        |
| `job.priority_changed`          | Priority updated                      |
| `job.field_updated`             | Job fields saved                      |
| `job.rescheduled`               | Date/time changed                     |
| `job.final_completed`           | Master marks job Final Complete       |
| `business.settings_updated`     | Account Settings saved                |
| `profile.locked`                | Engineer account locked               |
| `profile.unlocked`              | Engineer account unlocked             |
| `profile.deleted`               | Engineer account deleted              |
| `auth.password_change_self`     | User changes own password             |
| `auth.password_changed_by_master` | Master resets another user's password |

Masters view the log from the Account Settings page (full business log with filter tabs) or the Job Detail page (per-job history). Engineers cannot see the audit log.

---

## Session Security

### Current state
- Supabase Auth manages JWT tokens with automatic refresh
- Engineers can only read their own (or unassigned) jobs at the RLS layer (`members read business jobs`, tightened in migration 25); masters read all jobs in their business, super admins read all (migration 22). The calendar's `myJobs` filter mirrors this in the UI
- Client-side idle timeout for **master accounts only** (29-min warning, 30-min auto sign-out). Engineers are exempt — they stay signed in on their own device (re-login is trivial with saved credentials), so the idle logout applies only to the more privileged master/HQ role
- Brute-force protection on login: server-side IP + email limiter (`login-rate-limit`) gates the sign-in call; a small client-side lockout after 5 attempts is UX only (it lives in `localStorage` and a determined attacker can clear it — the server limiter is the real defence)
- Locked accounts are enforced at the auth layer: `admin-lock-user` calls `auth.admin.updateUserById(..., { ban_duration })` so banned users can't sign in *or* refresh existing sessions, in addition to setting `profiles.locked` for RLS / UI use

### JWT storage and XSS
Supabase stores the access token in `localStorage` by default. An XSS bug — in our code or in any third-party dependency — could exfiltrate it. Mitigations:
- Strict CSP is the most impactful next step (see HTTP security headers below)
- Avoid logging emails / tokens / Supabase error objects to `console` (auth-path logging has been removed from `AppContext.login`)
- For higher-security deployments, configure the Supabase client with `auth: { storage: sessionStorage }` so the token is dropped when the tab closes — note this signs users out on browser restart

### Recommendations
- Enable **MFA (multi-factor authentication)** for master users via Supabase Auth when available on the plan
- Set **JWT expiry** to a shorter duration (e.g., 1 hour instead of default) in Supabase Auth settings for higher-security deployments
- Consider **IP allowlisting** for superadmin access (enforce in the Netlify Function)

---

## HTTP security headers

Set in `netlify.toml` and applied to every response:

| Header                      | Value                                                    | Why |
| --------------------------- | -------------------------------------------------------- | --- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`                    | Force HTTPS for one year. Only sent over HTTPS, so safe on Netlify previews. |
| `X-Content-Type-Options`    | `nosniff`                                                | Browser must trust declared MIME types; prevents some script-injection vectors. |
| `X-Frame-Options`           | `DENY`                                                   | App is never embedded in an iframe — denying clickjacking surface. |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                        | Don't leak job URLs / customer IDs to third-party domains via the Referer header. |
| `Permissions-Policy`        | `geolocation=(self), camera=(self), microphone=(), payment=(self), usb=(), interest-cohort=()` | Allow only what we use (geolocation for distance sort, camera for photo capture). Disable FLoC opt-in. |
| `Content-Security-Policy`   | (see below)                                              | Limits where scripts, styles, images, fonts, and network connections can come from. With `script-src 'self'` (no `'unsafe-inline'` / `'unsafe-eval'`), an XSS bug can't load attacker-controlled JavaScript or exfiltrate the Supabase JWT to an external host. |

### CSP

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://*.supabase.co;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co;
worker-src 'self';
manifest-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
object-src 'none'
```

Why each directive:
- `script-src 'self'` — the load-bearing one. No inline scripts, no `eval`, no third-party JS. Without this, the rest is decorative.
- `style-src 'self' 'unsafe-inline'` — Tailwind ships a stylesheet (covered by `'self'`), but a few third-party libs and React's runtime expect inline styles to work. Style XSS is much lower impact than script XSS, so this concession is acceptable.
- `connect-src` — Supabase REST is `https://*.supabase.co`; Realtime is `wss://*.supabase.co`. Both required.
- `img-src ... blob: ...` — `blob:` is needed for the camera-capture flow (job photos before upload). Supabase storage signed URLs are on `*.supabase.co`.
- `worker-src 'self'` — covers `sw-push.js` (push notification service worker).
- `frame-ancestors 'none'` — duplicates `X-Frame-Options: DENY` for browsers that prefer CSP.
- `base-uri 'self'` / `form-action 'self'` / `object-src 'none'` — close common XSS pivots.

When Stripe lands: add `https://js.stripe.com` to `script-src` and `frame-src`, and `https://api.stripe.com` to `connect-src`.

---

## RLS Audit

Before going multi-client, run a formal RLS audit:

1. Log in as engineer A of business X
2. Attempt to query data from business Y via the Supabase client (modify the `.eq("business_id", ...)` filter)
3. Verify RLS blocks all cross-tenant access
4. Test edge cases: null business_id, deleted users, locked accounts

Use Supabase's `pgTAP` testing framework to automate these checks as part of CI.

---

## Checklist

- [x] Audit log with tamper-proof `log_audit_event()` function (migration 16)
- [x] Audit log action validation — only known action names accepted, admin-only actions gated (migration 24)
- [x] Profile delete RLS policy (masters cannot delete themselves — migration 15)
- [x] Field-length CHECK constraints on key tables (migration 15)
- [x] Privilege escalation guard — engineers cannot change `role`, `business_id`, or `locked` on their own profile (migration 24)
- [x] Storage bucket policies scoped to business — photo access requires job ownership (migration 23)
- [x] `send-push` Netlify Function requires auth + **master-only sender** + same-business target + relative-URL deep links (June 2026 hardening; `sw-push.js` also refuses non-relative URLs)
- [x] HTTP security headers (HSTS, nosniff, frame-deny, referrer, permissions) in `netlify.toml`
- [x] Content-Security-Policy with strict `script-src 'self'` (defends against XSS-driven JWT theft)
- [ ] Configure SMTP provider in Supabase Auth settings *(near-launch — needs prod domain)*
- [ ] Review Supabase Auth rate limit settings *(near-launch — Supabase Dashboard config)*
- [ ] Encrypt Xero tokens when integration is built *(blocked on Phase 4)*
- [ ] Draft data processing agreement template *(legal — needs a lawyer's eyes, not just code)*
- [ ] Add "Delete customer" flow with data anonymisation *(GDPR right-to-erasure — needs a focused build session)*
- [ ] Run formal RLS audit before multi-client launch *(pgTAP test suite — defer until second client onboards)*
- [ ] Consider MFA for master users *(needs Supabase plan that supports it)*
- [ ] Update CSP when Stripe lands — add `https://js.stripe.com` to `script-src`/`frame-src` and `https://api.stripe.com` to `connect-src`
- [ ] OAuth `state` verification in the accounting callback *(Phase 4 — see ACCOUNTING.md §1)*
- [x] `businesses.plan` guarded from client writes — service role + super admins only (migration 31)
- [ ] Extend `guard_business_plan` to `subscription_status` / `stripe_*` / `current_period_end` when Stripe's migration adds them *(Phase 5 — see STRIPE.md §2)*
- [x] `send-push` tightened: master-only sender, relative-URL allowlist, length caps (June 2026)
