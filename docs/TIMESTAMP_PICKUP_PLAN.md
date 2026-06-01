Let me explore the unscheduled panel and calendar scheduling logic before asking questions.

Explore unscheduled panel and scheduling logic

Read [](file:///c%3A/Users/smkgl/Documents/LocalSites/plumber-app-v2/src/components/UnscheduledPanel.tsx)

Read [](file:///c%3A/Users/smkgl/Documents/LocalSites/plumber-app-v2/src/pages/CalendarPage.tsx#1-1), lines 1 to 200

Read [](file:///c%3A/Users/smkgl/Documents/LocalSites/plumber-app-v2/src/pages/MyDayPage.tsx#1-1), lines 1 to 150

Read [](file:///c%3A/Users/smkgl/Documents/LocalSites/plumber-app-v2/src/types.ts)

Read [](file:///c%3A/Users/smkgl/Documents/LocalSites/plumber-app-v2/src/data.ts#1-1), lines 1 to 150

Read [](file:///c%3A/Users/smkgl/Documents/LocalSites/plumber-app-v2/src/pages/CalendarPage.tsx#200-200), lines 200 to 500

Read [](file:///c%3A/Users/smkgl/Documents/LocalSites/plumber-app-v2/src/pages/MyDayPage.tsx#100-100), lines 100 to 400

Searched for regex `updateJob|rescheduleJob` (`**/src/AppContext.tsx`), 6 results

Read [](file:///c%3A/Users/smkgl/Documents/LocalSites/plumber-app-v2/src/pages/CalendarPage.tsx#500-500), lines 500 to 800

Read [](file:///c%3A/Users/smkgl/Documents/LocalSites/plumber-app-v2/src/AppContext.tsx#759-759), lines 759 to 850

Read [](file:///c%3A/Users/smkgl/Documents/LocalSites/plumber-app-v2/src/AppContext.tsx#1460-1460), lines 1460 to 1550

Searched for regex `onPointerDragStart|ptrDragJobId|handleDrag|rescheduleJob` (`**/src/pages/CalendarPage.tsx`), 11 results

Read [](file:///c%3A/Users/smkgl/Documents/LocalSites/plumber-app-v2/src/data.ts#1-1), lines 1 to 300

Searched for regex `onUnscheduledPtrDown|ptrGhost|dragOverSlot|handlePointerUp` (`**/src/pages/CalendarPage.tsx`), 20 results

Read [](file:///c%3A/Users/smkgl/Documents/LocalSites/plumber-app-v2/src/pages/CalendarPage.tsx#1790-1790), lines 1790 to 1800

Read [](file:///c%3A/Users/smkgl/Documents/LocalSites/plumber-app-v2/src/pages/CalendarPage.tsx#1500-1500), lines 1500 to 1770

Read [](file:///c%3A/Users/smkgl/Documents/LocalSites/plumber-app-v2/src/pages/CalendarPage.tsx#1200-1200), lines 1200 to 1420

Searched for regex `unscheduled|!j\.startTime|!j\.date` (`**/src/pages/CalendarPage.tsx`), 10 results

Read [](file:///c%3A/Users/smkgl/AppData/Roaming/Code/User/workspaceStorage/c63aeacddc443c10d45a88a4b9ddab2a/GitHub.copilot-chat/chat-session-resources/e1324372-22f8-44aa-82e9-692b76801e12/toolu_bdrk_014H2y7ENtQnuUWsL544BXek__vscode-1780262714530/content.txt#1-1), lines 1 to 200

Good research. A few design questions before I write this up — the answers significantly change scope:

Analyzing your answers...

Now I have the full picture. Let me update the plan to cover both the timestamp tracking and this new feature together.

Updated memory file [](file:///c%3A/Users/smkgl/AppData/Roaming/Code/User/workspaceStorage/c63aeacddc443c10d45a88a4b9ddab2a/GitHub.copilot-chat/memory-tool/memories/ZTEzMjQzNzItMjJmOC00NGFhLTgyZTktNjkyYjc2ODAxZTEy/plan.md)

Updated memory file [](file:///c%3A/Users/smkgl/AppData/Roaming/Code/User/workspaceStorage/c63aeacddc443c10d45a88a4b9ddab2a/GitHub.copilot-chat/memory-tool/memories/ZTEzMjQzNzItMjJmOC00NGFhLTgyZTktNjkyYjc2ODAxZTEy/plan.md)

Now let me write the full combined plan out for you:

---

## Plan: Job Timestamp Tracking + Engineer Day-Pickup

Two linked features. The timestamp work (Feature A) is a dependency for the best auto-slot calculation in Feature B, but both can ship independently.

---

### Feature A — Actual Timestamp Tracking

#### Phase 1 — Database _(run first, independent)_

1. Create `supabase/25_migration.sql`:
    - `alter table jobs add column if not exists en_route_at timestamptz`
    - `alter table jobs add column if not exists on_site_at timestamptz`
    - `alter table jobs add column if not exists completed_at timestamptz`

#### Phase 2 — Types + Data Layer _(depends on Phase 1)_

2. types.ts — add `enRouteAt?`, `onSiteAt?`, `completedAt?` (ISO strings) to `Job`.
3. AppContext.tsx — `mapJob()`: map the 3 new DB columns to camelCase.
4. AppContext.tsx — `changeStatus()`: capture `now = new Date().toISOString()` and write the matching column per transition. On **Completed**: if `timeSpent === 0` and `onSiteAt` exists, auto-calculate hours and include in the same DB update.

#### Phase 3 — Job Detail Actual Times _(parallel with Phase 4)_

5. JobDetailPage.tsx — below the scheduled time line, add an "Actual" row showing `En Route 09:15 · On Site 09:32 · Completed 11:47` plus an `On site for 2h 15m` badge. Visible to both master and engineer when any timestamp is set.

#### Phase 4 — Calendar Late/Overrun Indicators _(parallel with Phase 3)_

6. CalendarPage.tsx — on timed job cards in the grid: amber `⚠ Late` pill if `onSiteAt` HH:MM is ≥10 min after `startTime`; orange `⏱ Over` pill if `completedAt` HH:MM is ≥10 min after `endTime`. Add a helper `extractHHMM(iso: string)` for the comparison. Job block stays positioned at scheduled times.

#### Phase 5 — Timesheets _(verify only)_

7. TimesheetsPage.tsx — `jobHours()` already prefers `timeSpent`, so auto-filled values from Phase 2 flow through automatically. No code change needed; just test.

---

### Feature B — Engineer Day-Pickup Flow

#### Phase 6 — DB: Request State _(can run alongside Phase 1)_

8. `supabase/25_migration.sql` (same file) — add:
    - `pickup_requested_by uuid references profiles(id)` — set when engineer requests a job
    - `pickup_requested_at timestamptz` — timestamp of the request  
      These two columns are cleared on approval or decline.

#### Phase 7 — Types + Context _(depends on Phases 2 & 6)_

9. types.ts — add `pickupRequestedBy?: string` and `pickupRequestedAt?: string` to `Job`.
10. AppContext.tsx — `mapJob()`: map the 2 new columns.
11. AppContext.tsx — add a new `requestJobPickup(jobId: string)` function:
    - Sets `pickupRequestedBy = currentUser.id`, `pickupRequestedAt = now` on the job (DB + local state)
    - Sends a notification to master: `"${engineer.name} wants to pick up job ${job.ref} — ${job.customer} (${job.address})"`
    - Logs audit event `job.pickup_requested`
12. AppContext.tsx — add `approveJobPickup(jobId: string, engineerId: string)` (master-only):
    - Calculates auto-slot time: find engineer's latest job today (by `endTime` or `completedAt` if available), add 15-min travel buffer, snap to 30 min. Default duration 1 hour.
    - Calls existing `rescheduleJob(jobId, TODAY, startTime, endTime, engineerId)`
    - Clears `pickupRequestedBy` / `pickupRequestedAt` on the job
    - Sends confirmation notification to engineer: `"HQ approved your pickup of ${job.ref} — added to your day at ${startTime}"`
    - Logs audit event `job.pickup_approved`
13. AppContext.tsx — add `declineJobPickup(jobId: string)` (master-only):
    - Clears `pickupRequestedBy` / `pickupRequestedAt`
    - Sends notification to engineer: `"HQ declined your request for job ${job.ref}"`
    - Logs audit event `job.pickup_declined`

#### Phase 8 — Engineer UI: Request Button _(depends on Phase 7)_

14. MyDayPage.tsx — in the available jobs section, replace/augment the existing "flag" button with a `Request pickup` button that calls `requestJobPickup(jobId)`. Show a pending badge if `pickupRequestedBy === currentUser.id` so the engineer knows the request is awaiting approval.

#### Phase 9 — Master UI: Approve/Decline _(depends on Phase 7)_

15. UnscheduledPanel.tsx — when a job has `pickupRequestedBy` set, show a highlighted "Requested by [name]" banner on the card with **Approve** and **Decline** buttons. Clicking Approve opens a small inline time-picker pre-filled with the auto-calculated slot so master can tweak before confirming.
16. CalendarPage.tsx — the UnscheduledPanel is rendered here; no structural change needed since the card component handles the new UI.

---

**Relevant files**

- `supabase/25_migration.sql` — new (5 columns across both features)
- types.ts — 5 new fields on `Job`
- AppContext.tsx — `mapJob`, `changeStatus`, + 3 new functions
- JobDetailPage.tsx — actual time display
- CalendarPage.tsx — late/overrun indicators
- MyDayPage.tsx — request pickup button
- UnscheduledPanel.tsx — approve/decline UI

**Verification**

1. `npm run build` + `npm run lint` pass
2. Migration applied — 5 columns on `jobs` table in Supabase
3. Engineer advances job: DB row shows all 3 timestamps; `timeSpent` auto-filled
4. Job detail shows actual times; calendar shows Late/Over pills where appropriate
5. Engineer taps Request Pickup — master sees the job highlighted in Unscheduled panel with their name
6. Master approves with tweaked time — job appears on the calendar in the correct slot for both master and engineer in real time (Supabase Realtime fires the UPDATE)
7. Master declines — engineer gets notification; job returns to unscheduled with no request state

---

**Further considerations**

1. **Concurrent requests** — two engineers could request the same job simultaneously. The approve action should check `pickupRequestedBy` still matches before committing, and decline the other if needed.
2. **Feature A dependency for auto-slot** — if Feature A hasn't shipped yet, `approveJobPickup` falls back to using `endTime` instead of `completedAt`. Worth noting this in the implementation.
3. **Notification UX** — the master notification currently doesn't have inline actions (it navigates to the job). Consider whether the notification bell should show quick Approve/Decline buttons, or whether directing to the Unscheduled panel is sufficient.
