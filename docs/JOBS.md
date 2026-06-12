# Jobs

This document covers the job data model, lifecycle, recurring jobs, and multi-day spans.

---

## Data model

```ts
interface Job {
  id: string;
  ref: string;               // e.g. "DPH-007" — auto-generated
  customer: string;
  phone: string;
  address: string;
  description: string;
  assignedTo: string;        // profile UUID
  status: Status;
  priority: Priority;
  date: string;              // ISO "YYYY-MM-DD" — start date
  endDate?: string;          // ISO "YYYY-MM-DD" — inclusive end, for multi-day
  startTime?: string;        // "HH:MM" e.g. "09:00"
  endTime?: string;          // "HH:MM" e.g. "10:30"
  categoryId?: string;
  materials: string;         // free-text list of materials used
  materialsCost: number;     // cost of materials (migration 19)
  notes: string;
  timeSpent: number;
  readyToInvoice: boolean;
  sortOrder?: number;
  customerId?: string;       // linked contact UUID
  repeatFrequency?: RepeatFrequency;
}
```

---

## Statuses

Jobs move through a linear workflow:

```
Scheduled → En Route → On Site → Completed → Invoiced
```

| Status        | Who sets it                          | Triggers notification?         |
| ------------- | ------------------------------------ | ------------------------------ |
| **Scheduled** | Created automatically on job create  | Engineer notified on creation  |
| **En Route**  | Engineer (job detail or calendar popover) | Yes — master notified     |
| **On Site**   | Engineer                             | Yes — master notified          |
| **Completed** | Engineer                             | Yes — master notified          |
| **Invoiced**  | Master (after pushing to Xero)       | No                             |

Status can also be changed directly from the **calendar job popover** via quick-tap status pills, without navigating to the job detail page.

---

## Priorities

| Priority      | Colour indicator | Extra notification?                     |
| ------------- | ---------------- | --------------------------------------- |
| Emergency     | Red              | Yes — engineer notified on creation     |
| High          | Orange           | No                                      |
| Normal        | Default          | No                                      |
| Low           | Muted            | No                                      |

---

## Creating a job

Jobs can be created from two places:

### 1. New Job page (`/new-job`)

Full-page form at `src/pages/NewJobPage.tsx`. Accessible from the main navigation. Navigates back to the dashboard on submit.

### 2. Calendar panel

The `AddJobPanel` inside `CalendarPage.tsx`. Opens as a fixed right sidebar (desktop) or bottom-sheet modal (mobile) when clicking any calendar cell or the + New Job button. In Day view, clicking an engineer's column pre-fills the assigned engineer.

Both forms call `createJob(form)` from `AppContext.tsx`, which:

1. Generates a sequential `ref` (e.g. `DPH-001`)
2. Inserts the job row into Supabase
3. Sends a notification to the assigned engineer
4. If `priority === "Emergency"`, also sends a notification to all masters

---

## Multi-day jobs

Set an **End Date** on a job to span multiple days:

- End Date must be after Start Date — equal or earlier values are stripped on submit
- The job appears on every calendar date from Start Date through End Date (inclusive)
- The `end_date` column is stored on the `jobs` table (added in migration 9)
- Applies to both the calendar views and the team page daily list

---

## Recurring jobs

A job can have a `repeatFrequency` of `annually`, `biannually` (every 6 months), or `quarterly`.

Recurring frequency is stored directly on the job row (`repeat_frequency` column, added in migration 12). It is a label only — the app does **not** auto-generate future jobs. When a recurring job is marked complete, the master reviews it and creates the next occurrence manually.

> **Migration 12 note:** The old `repeat_tasks` table was dropped in migration 12. Recurring frequency is now part of the standard `jobs` table.

---

## Job detail page

`src/pages/JobDetailPage.tsx` — accessible by clicking any job from the dashboard, calendar, team page, or customer detail.

### Layout

The page is full-width and uses a two-column layout on desktop:

| Left column | Right column |
| ----------- | ------------ |
| Job Details card (customer, address, phone, description, dates, times, category, recurring, assigned engineer) | Site Notes card (grows to fill height) |
| Priority + Status card | Materials Used card (with Time Spent field) |

Below both columns, full-width:
- Save Changes bar (appears when there are unsaved changes)
- Awaiting HQ Approval banner (master only, when status = Completed and not yet final-complete)
- Ready to Invoice banner (master only, when `readyToInvoice = true`)

### Actual timestamps (engineer progress)

As an engineer advances a job's status, `changeStatus` stamps the moment onto the job (migration 26 columns / `Job` fields):

| Status entered | Column / field |
| --- | --- |
| En Route | `en_route_at` / `enRouteAt` |
| On Site | `on_site_at` / `onSiteAt` |
| Completed | `completed_at` / `completedAt` |

Two durations come out of these, used in different places:

- **On-site (billable)** = `completed_at − on_site_at` → **what's charged to the client**. On Completed, this auto-fills `timeSpent` (if still 0), which is the field the accounting invoice reads (`time_spent × hourly_rate`).
- **Worked incl. travel** = `completed_at − en_route_at` → the **engineer's** time for pay (shown on Timesheets only).

Scheduled `startTime`/`endTime` are **left untouched** — they stay as the plan. The detail page shows an "Actual" row with the three times plus both duration badges. See [CALENDAR.md](CALENDAR.md) for how the calendar block reflects the actual on-site window, and [TIMESHEETS.md](TIMESHEETS.md) for the two hour figures.

### Deleting a job

Masters get a **Delete job** button in the detail-page header (top-right, below the status). It opens a `ConfirmDeleteModal`; confirming calls `deleteJob(id)` in `AppContext`, which optimistically removes the job, deletes the row (`job_photos` cascade-delete, `notifications.job_id` is set null per the schema), writes a `job.deleted` audit event, and navigates back. Engineers don't see the button.

Deletion is also enforced in the database: only masters (and super admins) hold a DELETE policy on `jobs` (migration 30). Before that migration **no** delete policy existed, so client deletes were silently blocked — the job vanished from the UI but reappeared on reload.

### Fields editable on this page

- Customer, address, phone, description, dates, times, category, recurring, assigned engineer (master only)
- Status (engineer and master)
- Priority (master only)
- Site notes, materials used, time spent (engineer and master)

---

## Xero integration

Jobs with `readyToInvoice: true` can be pushed to Xero from the job detail page. This creates a draft invoice in Xero and sets the job status to `Invoiced` (via `changeStatus` only — it persists the status itself). See [ACCOUNTING.md](ACCOUNTING.md) for setup.

The Final Complete gate is enforced in the database, not just the UI: the `guard_job_invoice_gate` trigger (migration 30) rejects any change to `ready_to_invoice`, or any transition to status `Invoiced`, unless the caller is a master or super admin. Engineers calling the API directly cannot short-circuit HQ approval.

---

## Categories

Jobs can be tagged with a category (e.g. "Boiler Service", "Leak Repair"). Categories have a name, a Lucide icon, and a colour. They are managed in Account Settings (master only) and displayed as coloured chips throughout the app.

Categories were added in migration 9. If no categories are configured the category selector is hidden. When categories **do** exist, choosing one is **required** to create or save a job — both the New Job page and the calendar Add-Job panel disable submit until a category is selected, and there is no "None" option.

> Empty optional values are normalised to `NULL` before hitting Postgres in `createJob` / `updateJob` (uuid/date/time columns reject `""` with `invalid input syntax for type uuid: ""`).

---

## Job photos

Up to 2 photos can be attached to a job via `src/components/JobPhotos.tsx`, which is rendered in the job detail page. The picker lets engineers **take a new photo with the camera or choose an existing one** from their library (the input is `accept="image/*"` with no forced `capture`).

### How it works

- Photos are uploaded to Supabase Storage in the `job-photos` bucket (private)
- Each photo is stored at `{jobId}/{uuid}.jpg`
- **Every** image is downscaled to fit within 1600 px on its longest side and re-encoded as JPEG (~80%) client-side before upload — always, regardless of the source's size or format — so a full-res phone photo (3–5 MB) becomes a few hundred KB. Re-encoding via canvas also strips EXIF. See `compressImage` in `JobPhotos.tsx`.
- Signed URLs (1-hour expiry) are fetched on component mount for display
- A database trigger (`enforce_job_photo_limit`) prevents a third photo being inserted server-side
- Masters and the uploader can delete photos; other engineers can only view

### Database

```ts
interface JobPhoto {
  id: string;
  jobId: string;
  storagePath: string;   // e.g. "{jobId}/{uuid}.jpg"
  caption: string;
  uploadedBy: string;    // profile UUID
  createdAt: string;
}
```

The `job_photos` table was created in the initial schema. Migration 19 adds the Storage bucket policies and the photo-limit trigger.

---

## Audit log

Every significant action on a job is recorded in the `audit_log` table (master-visible only). Recorded job events:

| Action                  | Triggered by                       |
| ----------------------- | ---------------------------------- |
| `job.created`           | Any job creation                   |
| `job.status_changed`    | Status update (any role)           |
| `job.priority_changed`  | Priority update (master)           |
| `job.field_updated`     | Field edits saved (customer, address, etc.) |
| `job.rescheduled`       | Drag-and-drop or date change       |
| `job.final_completed`   | Master clicks Final Complete       |
| `job.deleted`           | Master deletes a job (detail page) |

The `ActivityLog` component can be rendered with a `jobId` prop to show a per-job history, or without to show the full business log with filter tabs (All / Jobs / Users / Settings).
