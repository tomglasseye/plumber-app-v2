# DPH Plumbing — Job Sheet App

A web-based job management system for a small plumbing team. Built for the field — engineers access it on their phones, HQ manages jobs from the office.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
```

Demo logins (prototype — no real authentication yet):

| Email                  | Role               |
| ---------------------- | ------------------ |
| dave@dphplumbing.co.uk | HQ / Administrator |
| tom@dphplumbing.co.uk  | Engineer           |
| sam@dphplumbing.co.uk  | Engineer           |
| lee@dphplumbing.co.uk  | Engineer           |

---

## What's built (prototype stage)

All data is **in-memory** — refreshing the page resets everything. The UI is fully functional for demonstration and stakeholder sign-off before the real backend is connected.

### Stack

| Layer              | Technology                                                       |
| ------------------ | ---------------------------------------------------------------- |
| Frontend framework | React 18 + TypeScript                                            |
| Build tool         | Vite 7                                                           |
| Styling            | Tailwind CSS v4                                                  |
| Routing            | React Router v6                                                  |
| Hosting            | Netlify                                                          |
| Database           | **Not yet — see [docs/SUPABASE.md](docs/SUPABASE.md)**           |
| Auth               | **Not yet — see [docs/SUPABASE.md](docs/SUPABASE.md)**           |
| Push notifications | **Not yet — see [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md)** |
| Offline / PWA      | **Not yet — see [docs/PWA.md](docs/PWA.md)**                     |
| Xero API           | **Not yet — see [docs/XERO.md](docs/XERO.md)**                   |

### Features

**HQ / Administrator**

- Dashboard with all jobs, live status stats, clickable status filters
- Job search — filter by customer, address, type, or job ref
- Create new job sheets — customer, address, type, date, assigned engineer, priority, description
- Assign jobs to engineers with priority levels (Emergency / High / Normal / Low)
- Update job status and priority from the job detail view
- Team overview — each engineer's workload at a glance, click through to any job
- **Final Complete approval workflow** — engineer marks done → HQ reviews → HQ clicks Final Complete → Xero button unlocks
- Xero stub — "Send to Xero" button present, ready to wire up
- Account Settings — company name, address, VAT, logo initials, accent colour (live preview), Xero tab, team tab
- Two-way in-app notifications with unread badge and push banner simulation

**Engineers**

- Dashboard showing only their own assigned jobs with search and status filter
- Today's jobs banner linking to My Day when jobs are scheduled
- **My Day** — today's jobs sorted by priority with a visual route strip
    - Individual Navigate buttons (opens Google Maps driving directions)
    - "Open full route in Google Maps" multi-stop link built from home address through all jobs
- Job detail — update status, add site notes, log materials used, log time spent
- **Photo upload** — add site photos directly from the phone camera, thumbnail grid with remove; stored as base64 in prototype, Supabase Storage in production

**Both roles**

- Calendar view — monthly grid, colour-coded by engineer, filter by engineer, month navigation
- Notification bell — unread count, message history, clear all
- Simulated push banner — drops in from top of screen on status/priority changes
- Responsive layout — desktop sidebar, mobile hamburger menu with slide-over
- Multi-client ready — business profile structure in place for per-tenant isolation

---

## Project structure

```
plumber-app-v2/
├── netlify.toml              # SPA redirect rule for React Router
├── vite.config.ts            # Tailwind CSS v4 Vite plugin
├── src/
│   ├── types.ts              # TypeScript interfaces (Job, User, Business, etc.)
│   ├── data.ts               # Seed data, constants, colour maps, helpers
│   ├── AppContext.tsx         # Global state and all business logic
│   ├── App.tsx               # Router shell, auth guards, layout wrapper
│   ├── index.css             # Tailwind import
│   ├── main.tsx              # Entry — BrowserRouter + AppProvider
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── JobCard.tsx
│   │   ├── NotificationBell.tsx
│   │   └── PushBanner.tsx
│   └── pages/
│       ├── LoginPage.tsx
│       ├── DashboardPage.tsx
│       ├── JobDetailPage.tsx
│       ├── NewJobPage.tsx
│       ├── MyDayPage.tsx
│       ├── CalendarPage.tsx
│       ├── TeamPage.tsx
│       └── AccountPage.tsx
└── docs/
    ├── SUPABASE.md            # Database schema + auth setup
    ├── PWA.md                 # Service worker + offline caching
    ├── NOTIFICATIONS.md       # Supabase Realtime + Web Push
    └── XERO.md                # Xero OAuth + invoice API
```

---

## Deployment — Netlify

The `netlify.toml` at the root handles the SPA redirect so React Router URLs work correctly on Netlify.

**Steps:**

1. Push this folder to a GitHub repository
2. Log in to [netlify.com](https://netlify.com) → Add new site → Import from Git
3. Connect your repo — build command: `npm run build`, publish directory: `dist`
4. Click Deploy

Once Supabase is connected, add your environment variables in Netlify → Site settings → Environment variables:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Still to build

| Priority | Feature                               | Detail                                         |
| -------- | ------------------------------------- | ---------------------------------------------- |
| 1        | Database + authentication             | [docs/SUPABASE.md](docs/SUPABASE.md)           |
| 2        | Progressive Web App (offline support) | [docs/PWA.md](docs/PWA.md)                     |
| 3        | Real-time notifications + Web Push    | [docs/NOTIFICATIONS.md](docs/NOTIFICATIONS.md) |
| 4        | Xero API integration                  | [docs/XERO.md](docs/XERO.md)                   |
