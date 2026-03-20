# Calendar

The Calendar page (`src/pages/CalendarPage.tsx`) is the primary scheduling interface. It provides three views, drag-and-drop job scheduling, a new-job panel, and team leave visibility.

---

## Views

| View      | What it shows                                                                                 |
| --------- | --------------------------------------------------------------------------------------------- |
| **Month** | Grid of days. Each cell shows job chips per engineer and leave indicators.                    |
| **Week**  | 7-column time grid from 07:00–20:00. Jobs with time slots render as positioned blocks. All-day and untimed jobs appear in the header strip above the grid. |
| **Day**   | Single-day time grid. Same layout as week but one column wide.                                |

Switch views with the Month / Week / Day buttons in the top toolbar.

---

## Filters

The toolbar contains two filters that work together:

- **Engineer filter** — pill buttons, one per engineer plus "All". Selecting a specific engineer hides all other engineers' jobs. Defaults to "All".
- **Status filter** — select box. Options: All, Scheduled, En Route, On Site, Completed, Invoiced. Applies on top of the engineer filter.

---

## Creating jobs from the calendar

Click any empty cell (month view) or any empty time slot (week/day view) to open the **New Job panel**, pre-filled with the clicked date and time where applicable.

You can also click the **+ New Job** button in the toolbar to open the panel without a date pre-fill.

### Desktop — fixed right sidebar

On screens `md` and wider the panel renders as a fixed-position column on the right side of the viewport (`w-[392px]`, `position: fixed; right: 0; top: 0; bottom: 0`). The calendar grid does **not** reflow — the panel overlays it.

### Mobile — bottom-sheet modal

On smaller screens the panel slides up from the bottom as a full-width bottom sheet with a dark backdrop. Tapping outside the sheet dismisses it.

### New Job panel fields (in order)

1. Customer Name (with contact autocomplete and "Save as new contact" option)
2. Phone Number
3. Address
4. Category (pill buttons — only shown when categories exist)
5. Start Date / End Date (side by side)
6. Time Slot (start → end selects, 30-min increments 07:00–20:00)
7. Assign To / Priority (side by side)
8. Recurring (One-off / Annually / Every 6 months / Quarterly)
9. Job Description (textarea)
10. Create Job Sheet button

---

## Drag-and-drop scheduling

Engineers' jobs can be rescheduled by dragging:

- **Month view** — drag a job chip from one day cell to another to change its date.
- **Week/Day view** — drag a timed block up or down within the time grid to change start/end time. Drag a job from the all-day strip to the time grid to assign a time slot.

Changes are saved immediately to Supabase via `rescheduleJob` and `resizeJobTime` in `AppContext.tsx`. **No notifications are sent** on drag — only on explicit status/priority changes.

### Resize handles (week/day view)

Timed job blocks have a drag handle at the bottom edge. Dragging it extends or shortens the end time in 30-minute increments.

---

## Multi-day jobs

A job can span multiple consecutive days using the **End Date** field (available in both the calendar's new-job panel and in `NewJobPage.tsx`).

- If End Date is set and is after Start Date the job appears on **every day** in the range.
- The `byDate` map in `CalendarPage.tsx` expands multi-day jobs across all spanned dates so they show up correctly in every view.
- If End Date equals or precedes Start Date it is stripped and treated as a single-day job.
- The `end_date` column on the `jobs` table has existed since migration 9 — no additional migration is needed.

---

## Team leave / holidays

Leave entries (holiday, sick, training, other) are shown in the calendar alongside jobs:

- **Month view** — small coloured indicator below the engineer's job chips.
- **Week/Day view** — translucent banner spanning the engineer's column.
- Multi-day leave entries (via `end_date` on `team_holidays`) span the full date range.

Leave is managed from the Team page, not the calendar.

---

## Navigation

The toolbar's `<` and `>` buttons step backward/forward one period (month, week, or day). The **Today** button jumps to the current date.

---

## Component structure

```
CalendarPage
  ├─ Toolbar (view switcher, engineer filter, status filter, navigation, + New Job)
  ├─ MonthView   — uses byDate map
  ├─ WeekView    — uses byDate + time grid
  ├─ DayView     — uses byDate + time grid
  ├─ AddJobPanel (desktop, fixed right sidebar)
  └─ AddJobPanel (mobile, bottom-sheet modal)
```

`AddJobPanel` is a pure presentational component — it receives `prefill`, `onClose`, and `onSubmit` props. The parent `CalendarPage` holds the `panelOpen` and `panelPrefill` state.
