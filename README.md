# Plumber App v2 — Job Sheet System

A web-based job management system for small trade teams. Engineers access it on their phones, HQ manages jobs from the office. Built with React, Supabase, and Tailwind — deployed to Netlify.

**Live backend** — Supabase PostgreSQL with real-time notifications, email/password auth, and row-level security. Not a prototype.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
```

Requires a `.env.local` file with Supabase credentials:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

See [docs/SUPABASE.md](docs/SUPABASE.md) for full setup instructions.

---

## Stack

| Layer           | Technology                                   |
| --------------- | -------------------------------------------- |
| Frontend        | React 19 + TypeScript 5.9                    |
| Build tool      | Vite 7                                       |
| Styling         | Tailwind CSS v4                              |
| Routing         | React Router v7                              |
| Database + Auth | Supabase (PostgreSQL + Auth + Realtime)      |
| Hosting         | Netlify                                      |
| PWA             | vite-plugin-pwa (basic manifest, no offline) |

---

## Features

### HQ / Administrator

- **Dashboard** — all jobs with live stats, search, status/engineer filters, period toggle (Today/Week/Month/Year/All), pagination (25/page)
- **Create job** — customer, phone, address, type, date, engineer, priority, description
- **Job detail** — edit all fields, change status/priority, notes, materials, time spent
- **Final Complete workflow** — engineer marks done → HQ reviews → HQ clicks Final Complete → Xero button unlocks
- **Team management** — view workloads, edit profiles (name, phone, home address, avatar, accent colour, role), change passwords
- **Repeat tasks** — recurring jobs (annually/biannually/quarterly) with due dates and one-click scheduling
- **Calendar** — month + week views, colour-coded by engineer, filter by engineer, capped at 3-per-day with "+N more" overflow
- **Account settings** — company name, address, VAT, logo initials, accent colour, dark/light theme
- **Data export** — Excel XML download with Jobs + Reminders sheets, filterable by date range
- **Real-time notifications** — Supabase Realtime subscription, unread badge, push banner

### Engineers

- **My Day** — today's jobs sorted by priority, GPS location for route start, Google Maps navigation (individual + full multi-stop route)
- **Completed jobs** stay on the list but are excluded from the route, shown with ✓ badge and reduced opacity
- **Job detail** — update status, add notes, log materials, log time spent, clickable phone number to call client
- **Calendar** — same month/week view scoped to own jobs

### Both roles

- Password reset via email (Supabase Auth)
- Login lockout after 5 failed attempts (15 min, persisted to localStorage)
- Dark/light theme toggle
- Responsive layout — desktop sidebar, mobile hamburger menu
- Error boundary with recovery

---

## Project structure

```
plumber-app-v2/
├── netlify.toml              # SPA redirect rule for React Router
├── vite.config.ts            # Vite + Tailwind + PWA plugin config
├── src/
│   ├── supabase.ts           # Supabase client initialisation
│   ├── types.ts              # TypeScript interfaces (Job, User, Business, etc.)
│   ├── data.ts               # Seed data, constants, colour maps, helpers
│   ├── AppContext.tsx         # Global state, all CRUD, Supabase operations
│   ├── App.tsx               # Router shell, auth guards, layout wrapper
│   ├── index.css             # Tailwind import
│   ├── main.tsx              # Entry — BrowserRouter + AppProvider
│   ├── components/
│   │   ├── Sidebar.tsx       # Desktop sidebar + mobile hamburger
│   │   ├── JobCard.tsx       # Reusable job card component
│   │   ├── NotificationBell.tsx
│   │   ├── PushBanner.tsx
│   │   └── ErrorBoundary.tsx
│   └── pages/
│       ├── LoginPage.tsx     # Auth + password reset + lockout
│       ├── DashboardPage.tsx # Job list, stats, filters, pagination
│       ├── JobDetailPage.tsx # View/edit single job
│       ├── NewJobPage.tsx    # Create job form
│       ├── MyDayPage.tsx     # Engineer daily route view
│       ├── CalendarPage.tsx  # Month/week calendar
│       ├── TeamPage.tsx      # Team overview + profile editing
│       ├── AccountPage.tsx   # Business settings + export
│       └── RepeatTasksPage.tsx # Recurring job management
├── supabase/
│   ├── 1_schema.sql          # Initial schema + RLS + triggers
│   ├── 2_seed.sql            # Seed data (1 business, 4 users, 6 jobs)
│   ├── 3_migration.sql       # accent_color on profiles, job_id on notifications
│   ├── 4_migration.sql       # sort_order on jobs
│   ├── 5_migration.sql       # is_master() helper + profile update RLS
│   ├── 6_migration.sql       # repeat_tasks table + repeat_task_id on notifications
│   └── 7_migration.sql       # phone column on jobs
└── docs/
    ├── SUPABASE.md            # Database, auth, URL config, SMTP
    ├── PWA.md                 # Service worker + offline caching
    ├── NOTIFICATIONS.md       # Supabase Realtime + Web Push
    └── XERO.md                # Xero OAuth + invoice API
├── netlify/
│   └── functions/
│       └── admin-update-password.ts  # Server-side admin ops (service role key)
```

---

## Database migrations

Run these in order in the Supabase SQL Editor when setting up a new instance:

1. `1_schema.sql` — tables, RLS policies, triggers, helper functions
2. `2_seed.sql` — demo business + users (password: `Plumber1!`)
3. `3_migration.sql` → `7_migration.sql` — incremental schema changes

See full details in [docs/SUPABASE.md](docs/SUPABASE.md).

---

## Deployment — Netlify

1. Push to GitHub
2. [netlify.com](https://netlify.com) → Add new site → Import from Git
3. Build command: `npm run build`, publish directory: `dist`
4. Add environment variables in Netlify → Site settings → Environment variables:
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`
    - `SUPABASE_URL` (same URL, without VITE\_ prefix — for Netlify Functions)
    - `SUPABASE_ANON_KEY` (same anon key — for Netlify Functions)
    - `SUPABASE_SERVICE_ROLE_KEY` (service role key — server-side only, never in client bundle)
5. Configure Supabase → Authentication → URL Configuration:
    - **Site URL**: `https://your-app.netlify.app`
    - **Redirect URLs**: `https://your-app.netlify.app`, `http://localhost:5173`

See [docs/SUPABASE.md](docs/SUPABASE.md#6-authentication-setup) for details on password reset redirect setup.

---

## Multi-client deployment

The database schema supports **multi-client** via `business_id` on every table with RLS isolation. Two deployment models:

- **Shared instance** — one Supabase + one Netlify, multiple businesses. Add rows to `businesses` and create user accounts per client.
- **Separate instances** — one Supabase + one Netlify per client. Clone the repo, configure new env vars, run migrations.

---

## Still to build

| Priority | Feature                       | Detail                                         |
| -------- | ----------------------------- | ---------------------------------------------- |
| 1        | PWA offline support           | [docs/PWA.md](docs/PWA.md)                     |
| 2        | Web Push notifications        | [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md) |
| 3        | Xero API integration          | [docs/XERO.md](docs/XERO.md)                   |
| 4        | Job photos (Supabase Storage) | Replace base64 with Storage bucket uploads     |
