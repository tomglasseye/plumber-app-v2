# Security Hardening

> **Status:** This document covers production security considerations for a multi-tenant SaaS deployment. Most items are configuration or infrastructure changes, not code.

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
`netlify/functions/login-rate-limit.ts` uses an in-memory `Map` — resets on every cold start (Netlify Functions are stateless). This provides some protection but is not persistent.

### Production recommendation
For a small-scale app (< 50 clients), the in-memory approach is acceptable — cold starts are infrequent during active hours and Supabase Auth itself has server-side rate limiting.

For higher security:
- **Supabase Auth settings:** Configure rate limits in Supabase Dashboard → Authentication → Rate Limits. Set max sign-in attempts per IP.
- **Table-based rate limiting:** Replace the in-memory Map with a Supabase `rate_limits` table (IP + timestamp + attempt count). Query/update in the Netlify Function. Auto-expire old entries with a pg_cron job.
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
- Client-side idle timeout (configurable, warns before signing out)
- Brute-force protection on login (client-side lockout after 5 attempts)

### Recommendations
- Enable **MFA (multi-factor authentication)** for master users via Supabase Auth when available on the plan
- Set **JWT expiry** to a shorter duration (e.g., 1 hour instead of default) in Supabase Auth settings for higher-security deployments
- Consider **IP allowlisting** for superadmin access (enforce in the Netlify Function)

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
- [ ] Configure SMTP provider in Supabase Auth settings
- [ ] Review Supabase Auth rate limit settings
- [ ] Encrypt Xero tokens when integration is built
- [ ] Draft data processing agreement template
- [ ] Add "Delete customer" flow with data anonymisation
- [ ] Run formal RLS audit before multi-client launch
- [ ] Consider MFA for master users
