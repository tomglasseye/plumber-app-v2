# Security Hardening

> **Status:** This document covers production security considerations for a multi-tenant SaaS deployment. Most items are configuration or infrastructure changes, not code.

> **See also:** [LAUNCH.md](LAUNCH.md) for the sequenced production rollout — domain setup, env vars, SMTP, sign-off checklist. This doc is the deeper rationale for why those steps matter.

---

## SMTP Provider

Supabase's built-in email sender is rate-limited to ~4 emails/hour on the free tier. For production with multiple clients, configure a real SMTP provider.

**Setup:** Supabase Dashboard → Authentication → SMTP Settings

Recommended providers:
- **Resend** — simple API, good free tier (100 emails/day)
- **Postmark** — excellent deliverability, 100 free emails/month
- **SendGrid** — 100 emails/day free, widely used

Configure sender domain (SPF, DKIM) to avoid spam filters.

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

## Xero Token Encryption

When the Xero integration is built, OAuth tokens (`xero_access_token`, `xero_refresh_token`) will be stored in the `businesses` table. These grant full access to each client's Xero accounting data.

### Recommendation
- **Supabase Vault** (paid plan): Use `vault.create_secret()` to store tokens encrypted at rest with application-layer encryption keys. Decrypt in Netlify Functions only.
- **Application-layer encryption** (free plan): Encrypt tokens in the Netlify Function before storing, decrypt before use. Use a `XERO_ENCRYPTION_KEY` Netlify env var with AES-256-GCM.
- **Never expose tokens to the browser** — all Xero API calls go through Netlify Functions using the service role key.

---

## GDPR & Data Retention

### Customer data
- Customer records (names, addresses, phones, emails) are personal data under GDPR
- Each business is the **data controller**; the app platform is the **data processor**
- A data processing agreement (DPA) template should be provided to each client on signup

### Right to erasure
- When a customer requests deletion, the master should be able to delete their contact and all associated job data
- `customers` table has `ON DELETE CASCADE` to clean up linked jobs' `customer_id` (set null), but job records themselves are retained for business records
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
- Client-side idle timeout (29-min warning, 30-min auto sign-out)
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
- [x] `send-push` Netlify Function requires auth + same-business check
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
