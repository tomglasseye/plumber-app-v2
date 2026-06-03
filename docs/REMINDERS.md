# Dashboard Reminders & Upcoming Events

The master dashboard's **Upcoming Events** section (under *Today at a Glance*) is a single feed of things HQ needs to keep an eye on that aren't standard jobs. It combines two kinds of item:

1. **Auto-surfaced events** — computed live, not stored anywhere new:
   - **Engineers off** — approved `team_holidays` that cover today or start within the next 14 days ("Jim is off today").
   - **Recurring services due** — jobs with a `repeat_frequency` and status `Scheduled`, due within 30 days ("Tom Glass — Annual Boiler Service · due 12 Jul").
2. **Manual reminders** — free-form notes HQ types in, stored in the `reminders` table ("Chase supplier invoice").

Everything is sorted **today first, then soonest first**; undated manual reminders sort to the end.

Lives in [DashboardPage.tsx](../src/pages/DashboardPage.tsx) (`MasterDashboard`). All reminder data logic is in [AppContext.tsx](../src/AppContext.tsx).

---

## Data model — `reminders` table (migration 28)

| Column        | Type      | Notes                                                        |
| ------------- | --------- | ------------------------------------------------------------ |
| `id`          | uuid pk   | `gen_random_uuid()`                                          |
| `business_id` | uuid      | FK → `businesses`, `on delete cascade`, **not null**         |
| `title`       | text      | required                                                     |
| `body`        | text      | optional note                                                |
| `due_date`    | date      | **nullable** — undated reminders are allowed                 |
| `customer_id` | uuid      | optional FK → `customers` (`on delete set null`); used by the future SMS "Send reminder" to know who to text |
| `status`      | text      | `'open' \| 'done' \| 'dismissed'`, default `'open'`          |
| `created_by`  | uuid      | FK → `profiles`                                              |
| `created_at`  | timestamptz | default `now()`                                            |
| `updated_at`  | timestamptz | maintained by the shared `update_updated_at()` trigger     |

**RLS mirrors `customers`:** everyone in the business can read (`business_id = my_business_id()`); only masters can insert/update/delete (`… and is_master()`). Explicit `GRANT … TO authenticated` is included (per the Oct 30 2026 Data API policy — see [SUPABASE_STATUS.md](../SUPABASE_STATUS.md)). The table is added to the `supabase_realtime` publication for live sync across HQ devices.

Only `status = 'open'` reminders appear in the feed. **Done** sets `status='done'`, **Dismiss** sets `status='dismissed'` — both via `setReminderStatus()`, so the change is recorded in the DB and shared across every HQ user/device.

---

## AppContext API

- `reminders: Reminder[]` — loaded for masters only (alongside customers), kept live by the `app-reminders` realtime channel.
- `createReminder({ title, body, dueDate?, customerId? })`
- `updateReminder(id, changes)` — partial edit (snake_cased before the DB write).
- `setReminderStatus(id, 'open' | 'done' | 'dismissed')` — thin wrapper over `updateReminder`.
- `deleteReminder(id)` — hard delete (not currently surfaced in the UI; Done/Dismiss are preferred so nothing is lost).

All follow the standard optimistic-update + `dbSave` + `pendingMutations` pattern (identical to holidays).

---

## Auto-event dismissal (localStorage)

Auto-surfaced events (holidays, recurring services) are derivative — they already live in `team_holidays` / `jobs`. Their **Dismiss** is stored per-browser in `localStorage` (`dashboard_dismissed_reminders`, keys prefixed `hol:` / `job:`, auto-expiring after 30 days), **not** in the DB. So dismissing an auto event clears it on that browser only. Manual reminders, by contrast, are DB-backed and shared. If shared auto-event dismissal is ever needed, persist the dismissed keys server-side.

---

## Tier gate — the "Send reminder" (SMS) button

The Pro-only SMS action is gated on `business.plan === 'pro'` (see [STRIPE.md](STRIPE.md) for the tier model — `'starter'` = Tier 1, `'pro'` = Tier 2). **Every client is Starter for now**, so `canSendSms` is false everywhere and the button never renders.

The button also only attaches to events with a customer recipient (`canRemind`): recurring services (the job carries a customer) and manual reminders linked to a customer.

SMS itself is **not built yet** — see [SMS.md](SMS.md). The current `handleSendReminder` is a scaffold that just shows an info notice; when the `send-sms` Netlify Function lands, POST the recipient + message from there. Because the button is Pro-gated and unreachable today, no dead action ships.
