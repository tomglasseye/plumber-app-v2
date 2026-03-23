# Calendar

The Calendar page (`src/pages/CalendarPage.tsx`) is the primary scheduling interface. It provides three views, drag-and-drop job scheduling, a new-job panel, and team leave visibility.

---

## Views

| View      | What it shows                                                                                 |
| --------- | --------------------------------------------------------------------------------------------- |
| **Month** | Grid of days. Each cell shows a summary (job count · engineer count) and a chip per job. Clicking a day navigates to the Day view for that date. |
| **Week**  | 7-column time grid. Jobs with time slots render as positioned blocks. All-day/untimed jobs appear in the header strip (capped at 3 chips + overflow link). Clicking a day header navigates to Day view. |
| **Day**   | Per-engineer column layout. Each engineer in the current filter gets their own vertical column. Supports cross-engineer drag, unscheduled panel drops, and working hours shading. |

Switch views with the Month / Week / Day buttons in the top toolbar. The selected view is persisted to `localStorage`.

---

## Filters

The toolbar contains two filters that work together:

- **Engineer filter** — pill buttons, one per engineer plus "All". Selecting a specific engineer hides all other engineers' jobs and columns. Defaults to "All".
- **Status filter** — select box. Options: All, Scheduled, En Route, On Site, Completed, Invoiced. Applies on top of the engineer filter.

---

## Day view — per-engineer columns

The Day view renders one vertical column per engineer (filtered set). Each column:

- Shows the engineer's name, colour indicator, and a utilisation bar (scheduled hours vs work day length)
- Displays timed job blocks positioned by start/end time
- Has a current-time indicator line (today only)
- Shows greyed-out overlays outside `business.workDayStart` / `business.workDayEnd` (working hours shading)
- Shows holiday/absence banners when the engineer is on leave
- Accepts pointer drag from any job block — drop onto a different engineer's column to **reassign** the job
- Accepts HTML5 drag from the Unscheduled Panel — drop to schedule with a time and assign to that engineer
- Click any empty area to open the New Job panel pre-filled with the date, time, and engineer

The Day view uses the same `gridScrollRef` and `gridBodyRef` refs as the Week view, so the existing drag system works without modification.

---

## Working hours shading

Both the Week view (inside `DayColumn`) and the Day view shade the time grid outside business working hours with a dark overlay (`bg-neutral-950/50`). Working hours are configured via `business.workDayStart` and `business.workDayEnd` (integers 0–24, set in Account Settings). The display grid always shows `HOUR_START` (05:00) to `HOUR_END` (22:00) regardless of working hours.

---

## Creating jobs from the calendar

Click any empty cell (month view) or any empty time slot (week/day view) to open the **New Job panel**, pre-filled with the clicked date, time, and engineer (day view only).

You can also click the **+ New Job** button in the toolbar to open the panel without a pre-fill.

Scroll position is preserved when opening and closing the panel. Because the inner view components (`DayView`, `WeekView`, `MonthView`) are defined as inner functions, any state change causes a remount — `openAddPanel` and `closePanel` save and restore `gridScrollRef.current.scrollTop` via `requestAnimationFrame`.

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

Jobs can be rescheduled by dragging:

- **Month view** — drag a job chip from one day cell to another to change its date.
- **Week view** — drag a timed block up or down within the time grid to change start/end time. Drag from the all-day strip to the time grid to assign a time.
- **Day view** — drag a timed block up/down to change time, or drag to a different engineer's column to **reassign** it. The new engineer is detected from the `data-engineer-id` attribute on each column element.

Changes are saved immediately to Supabase via `rescheduleJob` in `AppContext.tsx`.

### Cross-engineer drag (Day view)

`onJobPtrDown` reads `data-engineer-id` from each `[data-ds]` column into `colRects`. On drop, `onJobPtrUp` checks whether `targetCol.engineerId` differs from `job.assignedTo` — if so, passes it to `rescheduleJob` as the optional fifth argument.

### Resize handles (week view)

Timed job blocks in the Week view have a drag handle at the bottom edge. Dragging it extends or shortens the end time in 30-minute increments.

### Unscheduled panel → calendar drop

The Unscheduled Panel uses HTML5 drag (`draggable`, `dataTransfer.setData("unscheduledJobId", ...)`). Both the Week view columns and Day view engineer columns have `onDragOver`/`onDrop` handlers. On drop, `rescheduleJob` is called with the inferred time from cursor position and (in Day view) the engineer's ID.

---

## Job popover

Clicking any job block opens a floating popover showing:

- Job ref, customer, address, description, category, engineer, time
- **Quick status pills** — tap any status to update it immediately without navigating to the job detail page. The current status has a ring highlight; others are at 60% opacity.
- **View Full Details →** button — navigates to `JobDetailPage`

---

## Multi-day jobs

A job can span multiple consecutive days using the **End Date** field.

- If End Date is set and is after Start Date the job appears on **every day** in the range.
- The `byDate` map in `CalendarPage.tsx` expands multi-day jobs across all spanned dates.
- The `end_date` column on the `jobs` table has existed since migration 9.

---

## Team leave / holidays

Leave entries (holiday, sick, training, other) are shown in the calendar alongside jobs:

- **Month view** — small coloured indicator below the job chips.
- **Week/Day view** — translucent banner spanning the engineer's column.
- Multi-day leave entries span the full date range.

Leave is managed from the Team page, not the calendar.

---

## Navigation

The toolbar's `<` and `>` buttons step backward/forward one period (month, week, or day). The **Today** button jumps to the current date.

---

## Component structure

```
CalendarPage
  ├─ Toolbar (view switcher, engineer filter, status filter, navigation, + New Job)
  ├─ UnscheduledPanel (collapsible, drag source for HTML5 drop)
  ├─ MonthView   — uses byDate map; cell click → Day view
  ├─ TimeGridView (week) — DayColumn × 7; drag/resize; working hours shading
  ├─ DayView     — per-engineer columns; cross-engineer drag; working hours shading
  ├─ JobPopover  — floating; quick status pills + navigate to detail
  ├─ AddJobPanel (desktop, fixed right sidebar)
  └─ AddJobPanel (mobile, bottom-sheet modal)
```

`AddJobPanel` is a pure presentational component — it receives `prefill`, `onClose`, and `onSubmit` props. The parent `CalendarPage` holds the `panelOpen` and `panelPrefill` state.

### Shared refs

| Ref             | Attached to                              | Used by                                    |
| --------------- | ---------------------------------------- | ------------------------------------------ |
| `gridScrollRef` | Scroll container (week or day view)      | Drag system (scroll offset), scroll restore |
| `gridBodyRef`   | Flex body container (week or day view)   | `onJobPtrDown` — queries `[data-ds]` cols  |
| `hdrRef` / `hdrRef2` | Sticky header row                   | Sync horizontal scroll with body           |

Only one view renders at a time, so both `TimeGridView` and `DayView` attach to the same refs safely.
