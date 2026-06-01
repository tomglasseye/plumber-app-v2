# Plan: Engineer Day-Pickup Flow (not yet built)

> The **timestamp-tracking** half of the original plan is **done** — see
> [JOBS.md → Actual timestamps](JOBS.md), [CALENDAR.md](CALENDAR.md),
> [TIMESHEETS.md](TIMESHEETS.md). This file is what's left: a real
> request → approve → schedule flow for picking up unassigned jobs.

## Context

Today an engineer can **flag** availability for an unscheduled job in
[MyDayPage.tsx](../src/pages/MyDayPage.tsx) (`flagJob`): it saves a flag in
`localStorage` and notifies the master (*"{engineer} is near {customer} ({ref})
and available to take it on"*). It's a **soft signal** — the master still has to
manually assign the job; there's no formal accept/decline and nothing is
recorded in the DB.

This plan replaces that with a proper two-way flow: engineer **requests** a
pickup → master **approves** (auto-slots it onto the day) or **declines**, with
notifications both ways and an audit trail.

## Phase 1 — DB (next migration, e.g. `27_migration.sql`)

```sql
alter table jobs add column if not exists pickup_requested_by uuid references profiles(id);
alter table jobs add column if not exists pickup_requested_at timestamptz;
```

Both columns are **cleared on approve or decline**.

## Phase 2 — Types + mapping

- `types.ts` — `pickupRequestedBy?: string`, `pickupRequestedAt?: string` on `Job`.
- `AppContext.mapJob` — map the two columns.

## Phase 3 — AppContext functions

- **`requestJobPickup(jobId)`** (engineer): set `pickup_requested_by = currentUser.id` + `pickup_requested_at = now` (DB + local), notify master (`for: "master"`), audit `job.pickup_requested`.
- **`approveJobPickup(jobId, engineerId)`** (master): compute an auto-slot — the engineer's latest job **today** (`completedAt` now available, else `endTime`) + a ~15-min travel buffer, snapped to 30 min, default 1h duration; call the existing `rescheduleJob(jobId, TODAY, start, end, engineerId)`; clear the request columns; notify the engineer; audit `job.pickup_approved`.
- **`declineJobPickup(jobId)`** (master): clear the request columns; notify the engineer; audit `job.pickup_declined`.

## Phase 4 — Engineer UI ([MyDayPage.tsx](../src/pages/MyDayPage.tsx))

In the **available jobs** section, replace/augment the `flagJob` button with
**Request pickup** → `requestJobPickup`. Show a **pending** badge when
`pickupRequestedBy === currentUser.id`.

## Phase 5 — Master UI ([UnscheduledPanel.tsx](../src/components/UnscheduledPanel.tsx))

When a job has `pickupRequestedBy` set, show a highlighted **"Requested by
{name}"** banner with **Approve** / **Decline**. Approve opens a small inline
time-picker **pre-filled with the auto-slot** so the master can tweak before
confirming. (The panel is rendered by CalendarPage; no structural change there.)

## Verification

1. Engineer taps **Request pickup** → master sees the job highlighted in the Unscheduled panel with the engineer's name.
2. Master **approves** (tweaks time) → job appears on the calendar in the right slot for **both** master and engineer live (realtime UPDATE).
3. Master **declines** → engineer gets a notification; job returns to unscheduled with the request state cleared.

## Notes

- **Concurrent requests** — two engineers could request the same job. `approveJobPickup` should re-check `pickupRequestedBy` still matches before committing (and decline the other).
- **Auto-slot quality** — now that actual timestamps ship, prefer `completedAt` over `endTime` for "engineer's last job today".
- **Notification actions** — the master notification currently just deep-links to the job; the richer approve/decline lives in the Unscheduled panel.

## Files

`next migration` (2 columns) · `types.ts` · `AppContext.tsx` (mapJob + 3 functions) · `MyDayPage.tsx` · `UnscheduledPanel.tsx`
