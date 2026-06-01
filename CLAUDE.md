# CLAUDE.md — Plumber App v2 (HiveQ)

Job-management PWA for small trade teams. Engineers work jobs on their phones; HQ manages everything from the office. Multi-client capable. **This is a live app with a real Supabase backend and RLS — not a prototype.**

## Stack

- **Frontend:** React 19 + TypeScript 5.9, Vite 7, Tailwind CSS v4, React Router v7
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Storage), row-level security on every table
- **Server-side:** Netlify Functions (service-role operations only)
- **Hosting:** Netlify · **PWA:** vite-plugin-pwa (Workbox + Web Push)

## Commands

```bash
npm run dev      # local dev → http://localhost:5173
npm run build    # tsc -b && vite build → dist/
npm run lint     # eslint
npm run preview  # preview production build
```

Requires `.env.local` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and (optional) `VITE_VAPID_PUBLIC_KEY`.

## Where things live

- `src/AppContext.tsx` — global state + ALL CRUD / Supabase operations. Most data logic lives here; check it first for anything touching jobs, users, businesses.
- `src/types.ts` — all TS interfaces (Job, User, Business, etc.)
- `src/data.ts` — seed data, constants, colour maps, helpers
- `src/App.tsx` — router shell, auth guards, layout
- `src/pages/` — 14 route pages (Dashboard, JobDetail, NewJob, MyDay, Calendar, Holidays, Team, Account, Admin, Login, About, How-To, Customers, Timesheets)
- `src/components/` — 11 reusable components (JobCard, JobPhotos, Sidebar, ActivityLog, NotificationBell, PushBanner, OfflineBanner, IosInstallPrompt, ErrorBoundary, ConfirmDeleteModal, UnscheduledPanel)
- `src/hooks/`, `src/utils/` — `useOnlineStatus`, `useCalendarShortcuts`; `push.ts`, `geo.ts`
- `netlify/functions/` — service-role-only ops: `create-business`, `admin-invite-user`, `admin-lock-user`, `admin-update-password`, `login-rate-limit`, `send-push`
- `supabase/` — `1_schema.sql`, `2_seed.sql`, then `3_migration.sql` → `24_migration.sql` (run in order)

## Feature docs — read the relevant one BEFORE touching a feature

| Area | Doc |
| --- | --- |
| Jobs / job sheet | `docs/JOBS.md` |
| Calendar / scheduling | `docs/CALENDAR.md` |
| Timesheets (hours + miles, master) | `docs/TIMESHEETS.md` |
| DB schema, Auth, RLS | `docs/SUPABASE.md` |
| Notifications + Web Push | `docs/NOTIFICATIONS.md` |
| PWA / offline / SW | `docs/PWA.md` |
| Security hardening | `docs/SECURITY.md` |
| Superadmin / client onboarding | `docs/SUPERADMIN.md` |
| Accounting (Xero/QuickBooks) | `docs/ACCOUNTING.md` |
| SMS to customers | `docs/SMS.md` |
| Stripe billing | `docs/STRIPE.md` |
| Launch plan | `docs/LAUNCH.md` |
| Live backend status / risks | `SUPABASE_STATUS.md` |

## Conventions & rules

- **Multi-tenant:** every table carries `business_id` and is isolated by RLS. Never write a query or migration that could leak across businesses. New tables after Oct 30 2026 need explicit `GRANT` statements (see `SUPABASE_STATUS.md`).
- **Service-role key is server-only.** Anything needing it goes in a Netlify Function — never the client bundle.
- **Final Complete → Xero unlock:** engineer marks a job done → HQ reviews → HQ clicks *Final Complete* → only then does the Xero/invoicing action unlock. Don't short-circuit this gate.
- **Migrations are append-only and numbered.** Add the next `N_migration.sql`; don't edit shipped ones.
- **Audit log is tamper-proof** — admin actions (status changes, lock/unlock, password resets, settings) must keep writing to it.

## Workflow for any change (the lean loop)

1. **Read** the relevant `docs/*.md` (and `AppContext.tsx` for data logic) before editing.
2. **Plan** multi-file changes before writing code.
3. **Verify** before declaring done: `npm run build` *and* `npm run lint` must pass.
4. **Update the doc** in the same change — editing a feature means editing its `docs/*.md`. Keep docs and code in sync.
