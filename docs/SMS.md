# SMS Notifications to Customers

> **Status:** Future work. Not yet implemented. This document covers the planned SMS integration for sending automated text messages to customers at key points in the job lifecycle.

---

## Why SMS

Customers want to know when their plumber is coming. The #1 inbound call to a trades HQ is "where's my plumber?" Automated SMS at key moments eliminates most of these calls and makes the company look professional.

---

## Provider recommendation

**Twilio** — ~3.85p per SMS (UK), no free tier but pay-as-you-go, excellent API docs, UK sender numbers available.

| Alternative   | Cost/msg (UK) | Notes                              |
| ------------- | ------------- | ---------------------------------- |
| Vonage (Nexmo)| ~3.5p         | €2 free credit on signup           |
| Amazon SNS    | ~4p           | Good if already in AWS             |
| TextMagic     | ~4.9p         | Simple API, UK-focused             |

### Estimated cost per client

A company with 3–4 engineers doing 6–8 jobs/day:

| Triggers enabled              | Messages/day | Monthly cost (~22 days) |
| ----------------------------- | ------------ | ----------------------- |
| En Route only                 | 6–8          | ~£5–7                   |
| En Route + Completed + reminder | 18–24      | ~£15–20                 |
| All triggers                  | 25–30        | ~£20–25                 |

Roll into the subscription price — negligible per client.

---

## Message triggers

| Trigger                        | Template                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Engineer marks **En Route**    | "Hi, your plumber {name} from {company} is on the way. Expected arrival ~20 mins. Job ref: {ref}"           |
| Engineer marks **Completed**   | "Your job ({description}) has been completed by {name}. If you have any questions call {company phone}."     |
| **Day-before reminder**        | "Reminder: {company} has a job booked at your property tomorrow between {time}. Your engineer will be {name}." |
| **Job rescheduled**            | "Your appointment with {company} has been moved to {new date}. Call us on {phone} if this doesn't work."    |

---

## Architecture

```
Engineer taps "En Route" in My Day
  → changeStatus() fires in AppContext
  → POST /.netlify/functions/send-sms
  → Netlify Function calls Twilio API
  → Customer receives SMS within seconds
```

The Twilio auth token stays server-side in the Netlify Function — never in the browser.

---

## Database changes

```sql
-- Per-business SMS configuration
alter table businesses
  add column sms_enabled       boolean default false,
  add column sms_en_route      boolean default true,
  add column sms_completed     boolean default true,
  add column sms_day_before    boolean default true,
  add column sms_rescheduled   boolean default true,
  add column twilio_account_sid text,
  add column twilio_auth_token  text,   -- encrypt at rest
  add column twilio_from_number text;
```

---

## Netlify Function — `send-sms`

```ts
// netlify/functions/send-sms.ts
import type { Handler } from "@netlify/functions";
import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export const handler: Handler = async (event) => {
  const { businessId, to, message } = JSON.parse(event.body ?? "{}");

  // Fetch business SMS config
  const { data: biz } = await supabase
    .from("businesses")
    .select("sms_enabled, twilio_account_sid, twilio_auth_token, twilio_from_number")
    .eq("id", businessId)
    .single();

  if (!biz?.sms_enabled) {
    return { statusCode: 200, body: JSON.stringify({ skipped: true }) };
  }

  const client = twilio(biz.twilio_account_sid, biz.twilio_auth_token);

  await client.messages.create({
    body: message,
    from: biz.twilio_from_number,
    to,
  });

  return { statusCode: 200, body: JSON.stringify({ sent: true }) };
};
```

---

## Configuration UX

In Account Settings, add an "SMS Notifications" section:

- Master toggle: SMS enabled / disabled
- Per-trigger toggles (En Route, Completed, Day Before, Rescheduled)
- Twilio credentials (Account SID, Auth Token, From Number)
- "Send test SMS" button

---

## Per-job opt-out

Add a `sms_opt_out` boolean to `jobs` (default false). Shown as a checkbox on the job detail page: "Don't text this customer." Useful for commercial properties, repeat same-day visits, or customers who've asked not to be contacted.

---

## Day-before reminder implementation

Requires a scheduled job (cron). Options:

1. **Supabase pg_cron** — run a database function nightly that inserts SMS tasks
2. **Netlify Scheduled Function** — runs at e.g. 6pm, queries tomorrow's jobs, sends reminders
3. **External cron** (GitHub Actions, EasyCron) — hits a Netlify Function endpoint

Netlify Scheduled Functions are the simplest:

```ts
// netlify/functions/daily-reminders.ts
import { schedule } from "@netlify/functions";

export const handler = schedule("0 18 * * *", async () => {
  // Query tomorrow's jobs with phone numbers
  // Send reminder SMS for each
});
```

---

## Checklist

- [ ] Create Twilio account and get UK sender number
- [ ] Add SMS config columns to `businesses` table
- [ ] Build `send-sms` Netlify Function
- [ ] Wire En Route trigger in `changeStatus()`
- [ ] Wire Completed trigger in `changeStatus()`
- [ ] Wire Rescheduled trigger in `rescheduleJob()`
- [ ] Build daily reminder Netlify Scheduled Function
- [ ] Add SMS settings section to Account Settings page
- [ ] Add per-job opt-out checkbox
- [ ] Test with real UK mobile numbers
