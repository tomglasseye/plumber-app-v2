# Plumber App v2 — Job Sheet System

A web-based job management system for small trade teams. Engineers access it on their phones, HQ manages jobs from the office. Built with React, Supabase, and Tailwind — deployed to Netlify. Branded as **PipeLine** in the PWA manifest.

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
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key   # optional — for Web Push
```

See [docs/SUPABASE.md](docs/SUPABASE.md) for full setup instructions.

---

## Stack

| Layer           | Technology                                        |
| --------------- | ------------------------------------------------- |
| Frontend        | React 19 + TypeScript 5.9                         |
| Build tool      | Vite 7                                            |
| Styling         | Tailwind CSS v4                                   |
| Routing         | React Router v7                                   |
| Database + Auth | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Hosting         | Netlify                                           |
| PWA             | vite-plugin-pwa — Workbox caching + push SW       |

---

## Features

### HQ / Administrator

- **Dashboard** — all jobs with live stats, search, status/engineer filters, period toggle (Today/Week/Month/Year/All), pagination (25/page)
- **Create job** — customer, phone, address, type, date, engineer, priority, description, recurring frequency
- **Job detail** — edit all fields, change status/priority, notes, materials + cost, time spent, photos
- **Job photos** — up to 2 photos per job via Supabase Storage, client-side image resize, signed-URL display
- **Final Complete workflow** — engineer marks done → HQ reviews → HQ clicks Final Complete → Xero button unlocks
- **Team management** — view workloads, edit profiles (name, phone, home address, avatar, accent colour, role, holiday allowance), change passwords, lock/unlock accounts, delete engineers
- **Holiday management** — approve/decline engineer leave requests, view allowance usage per person per year
- **Calendar** — month/week/day views, colour-coded by engineer, drag-and-drop scheduling, cross-engineer reassignment, unscheduled panel, working-hours shading, team leave visibility
- **Account settings** — company name, address, VAT, logo initials, accent colour, dark/light theme, working hours, category management
- **Data export** — Excel XML download with Jobs + Reminders sheets, filterable by date range
- **Real-time notifications** — Supabase Realtime subscription, unread badge, push banner; jobs and holidays also update live
- **Web Push notifications** — native OS alerts (even when app is closed); VAPID-based via Netlify Function
- **Audit log** — tamper-proof record of admin actions (status changes, lock/unlock, password resets, settings updates) visible from Account Settings
- **Superadmin panel** — create new client businesses, send master invite emails, switch between clients without logging out

### Engineers

- **My Day** — today's jobs sorted by priority, GPS location for route start, Google Maps navigation (individual + full multi-stop route)
- **Completed jobs** — stay on the list but excluded from the route, shown with ✓ badge and reduced opacity
- **Job detail** — update status, add notes, log materials + cost, log time spent, upload photos, clickable phone number
- **Calendar** — month/week/day view scoped to own jobs
- **Holiday requests** — submit leave requests (holiday/sick/training/other), view approval status, cancel pending requests

### Both roles

- Password reset via email (Supabase Auth)
- Login lockout after 5 failed attempts (15 min, persisted to localStorage)
- Dark/light theme toggle
- Responsive layout — desktop sidebar, mobile hamburger menu
- Offline banner — detects loss of connectivity; mutation queue replays changes on reconnect
- iOS install prompt — nudges iPhone users to "Add to Home Screen" for push notifications and standalone mode
- Error boundary with recovery

---

## Project structure

```
plumber-app-v2/
├── netlify.toml              # SPA redirect rule + build config
├── vite.config.ts            # Vite + Tailwind + PWA (Workbox) config
├── src/
│   ├── supabase.ts           # Supabase client initialisation
│   ├── types.ts              # TypeScript interfaces (Job, User, Business, etc.)
│   ├── data.ts               # Seed data, constants, colour maps, helpers
│   ├── AppContext.tsx         # Global state, all CRUD, Supabase operations
│   ├── App.tsx               # Router shell, auth guards, layout wrapper
│   ├── index.css             # Tailwind import
│   ├── main.tsx              # Entry — BrowserRouter + AppProvider
│   ├── hooks/
│   │   └── useOnlineStatus.ts  # navigator.onLine + window events
│   ├── utils/
│   │   ├── offlineQueue.ts   # localStorage mutation queue (flush on reconnect)
│   │   └── push.ts           # subscribeToPush(), firePush() — Web Push helpers
│   ├── components/
│   │   ├── Sidebar.tsx       # Desktop sidebar + mobile hamburger
│   │   ├── JobCard.tsx       # Reusable job card component
│   │   ├── JobPhotos.tsx     # Supabase Storage photo upload/display (2 per job)
│   │   ├── ActivityLog.tsx   # Audit log viewer (masters only)
│   │   ├── OfflineBanner.tsx # Fixed bottom banner when offline
│   │   ├── IosInstallPrompt.tsx  # "Add to Home Screen" nudge for iOS Safari
│   │   ├── NotificationBell.tsx
│   │   ├── PushBanner.tsx
│   │   └── ErrorBoundary.tsx
│   └── pages/
│       ├── LoginPage.tsx     # Auth + password reset + lockout
│       ├── DashboardPage.tsx # Job list, stats, filters, pagination
│       ├── JobDetailPage.tsx # View/edit single job (photos, audit log)
│       ├── NewJobPage.tsx    # Create job form
│       ├── MyDayPage.tsx     # Engineer daily route view
│       ├── CalendarPage.tsx  # Month/week/day calendar
│       ├── HolidaysPage.tsx  # Holiday requests + approval
│       ├── TeamPage.tsx      # Team overview + profile editing
│       ├── AccountPage.tsx   # Business settings + export + audit log
│       ├── AboutPage.tsx     # App info
│       └── AdminPage.tsx     # Superadmin: create businesses, switch clients
├── netlify/
│   └── functions/
│       ├── admin-update-password.ts  # Service-role password reset
│       ├── create-business.ts        # Superadmin: create business + invite master
│       └── send-push.ts              # Web Push sender (VAPID, web-push library)
├── public/
│   ├── icon.svg              # PWA icon (SVG, any size, maskable)
│   └── sw-push.js            # Push event handler injected into Workbox SW
└── supabase/
    ├── 1_schema.sql          # Initial schema + RLS + triggers
    ├── 2_seed.sql            # Seed data (1 business, 4 users, 6 jobs)
    └── 3_migration.sql → 22_migration.sql  — incremental schema changes
```

---

## Database migrations

Run these in order in the Supabase SQL Editor when setting up a new instance:

1. `1_schema.sql` — tables, RLS policies, triggers, helper functions
2. `2_seed.sql` — demo business + users (password: `Plumber1!`)
3. `3_migration.sql` → `22_migration.sql` — incremental schema changes

See full details in [docs/SUPABASE.md](docs/SUPABASE.md).

---

## Deployment — Netlify

1. Push to GitHub
2. [netlify.com](https://netlify.com) → Add new site → Import from Git
3. Build command: `npm run build`, publish directory: `dist`
4. Add environment variables in Netlify → Site settings → Environment variables:
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`
    - `SUPABASE_URL` (same URL, without `VITE_` prefix — for Netlify Functions)
    - `SUPABASE_ANON_KEY` (same anon key — for Netlify Functions)
    - `SUPABASE_SERVICE_ROLE_KEY` (service role key — server-side only, never in client bundle)
    - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_MAILTO` — for Web Push (see [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md))
    - `VITE_VAPID_PUBLIC_KEY` — public key also needed in the browser bundle
5. Configure Supabase → Authentication → URL Configuration:
    - **Site URL**: `https://your-app.netlify.app`
    - **Redirect URLs**: `https://your-app.netlify.app`, `http://localhost:5173`

See [docs/SUPABASE.md](docs/SUPABASE.md#6-authentication-setup) for details on password reset redirect setup.

---

## Multi-client deployment

The database schema supports **multi-client** via `business_id` on every table with RLS isolation. Two deployment models:

- **Shared instance** — one Supabase + one Netlify, multiple businesses. Use the Superadmin panel (`/admin`) to create clients and send invite emails.
- **Separate instances** — one Supabase + one Netlify per client. Clone the repo, configure new env vars, run migrations.

---

## Still to build

| Priority | Feature                          | Detail                                    |
| -------- | -------------------------------- | ----------------------------------------- |
| 1        | Xero API integration             | [docs/XERO.md](docs/XERO.md)             |
| 2        | SMS notifications to customers   | [docs/SMS.md](docs/SMS.md)               |
| 3        | PWA background sync              | Workbox BackgroundSync for offline writes |
