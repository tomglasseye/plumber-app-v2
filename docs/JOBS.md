# Jobs

This document covers the job data model, lifecycle, recurring jobs, and multi-day spans.

---

## Data model

```ts
interface Job {
  id: string;
  ref: string;           // e.g. "DPH-007" — auto-generated
  customer: string;
  phone: string;
  address: string;
  description: string;
  assignedTo: string;    // profile UUID
  status: Status;
  priority: Priority;
  date: string;          // ISO "YYYY-MM-DD" — start date
  endDate?: string;      // ISO "YYYY-MM-DD" — inclusive end, for multi-day
  startTime?: string;    // "HH:MM" e.g. "09:00"
  endTime?: string;      // "HH:MM" e.g. "10:30"
  categoryId?: string;
  materials: string;
  notes: string;
  timeSpent: number;
  readyToInvoice: boolean;
  sortOrder?: number;
  customerId?: string;   // linked contact UUID
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

### Fields editable on this page

- Customer, address, phone, description, dates, times, category, recurring, assigned engineer (master only)
- Status (engineer and master)
- Priority (master only)
- Site notes, materials used, time spent (engineer and master)

---

## Xero integration

Jobs with `readyToInvoice: true` can be pushed to Xero from the job detail page. This creates a draft invoice in Xero and sets the job status to `Invoiced`. See [XERO.md](XERO.md) for setup.

---

## Categories

Jobs can be tagged with a category (e.g. "Boiler Service", "Leak Repair"). Categories have a name, a Lucide icon, and a colour. They are managed in Account Settings (master only) and displayed as coloured chips throughout the app.

Categories were added in migration 9. If no categories are configured the category selector is hidden.
