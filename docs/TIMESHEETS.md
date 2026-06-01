# Timesheets (WIP)

A **master-only** reporting page ([src/pages/TimesheetsPage.tsx](../src/pages/TimesheetsPage.tsx)) showing, per engineer over a **Day / Week / Month** period:

- **Hours worked**
- **Miles travelled** between jobs (straight-line estimate)
- Job count

A view toggle switches Day / Week / Month; the ‹ › buttons step by that unit and **Today** jumps back. Week is Monday-based; Month is the calendar month. The period range is computed in `computeRange(view, anchor)`.

> **Status: work-in-progress.** Built to validate usefulness with a testing client. The UI carries a "WIP" badge and a method note. Several productionisation steps are deliberately deferred (see below).

## Access & routing

- Route `/timesheets`, gated by `RequireAuth > RequireMaster` in [src/App.tsx](../src/App.tsx) (mirrors `/team`). Engineers are redirected to `/`.
- Sidebar entry is added only in the `isMaster` spread in [src/components/Sidebar.tsx](../src/components/Sidebar.tsx).

## How figures are derived

**Hours** — two figures per engineer, summed over every job in the period (`assignedTo === engineer` and `date ∈ range`):

- **Worked (incl. travel)** = `completed_at − en_route_at` (`workedHoursOf`) — the engineer's time for **pay**.
- **On-site (billable)** = `completed_at − on_site_at` (`billableHoursOf`) — **what's charged to the client**.

Both fall back to `scheduledHours` (logged `timeSpent`, else scheduled `endTime − startTime`) when the actual timestamps from [JOBS.md → Actual timestamps](JOBS.md) are missing.

**Miles (estimate)** — computed **per day, then summed** across the period: within each day the engineer's jobs are sorted by `startTime`, each job `address` is geocoded, and the straight-line (`haversine`) distances between consecutive located stops are summed and converted km→miles (`× 0.621371`). Distance resets each day (engineers go home — no overnight leg). **Job-to-job only** — home→first / last→home legs are not counted. Rows show `N/M located` when some addresses fail to geocode.

Reuses [src/utils/geo.ts](../src/utils/geo.ts): `geocodeAddress(address, cache)` (free OpenStreetMap **Nominatim**, GB only, no API key) and `haversine(...)`. `geocodeAddress` falls back to the address's **UK postcode** when the full street string can't be resolved (flats/units/business parks often don't match at street level but their postcode does). An address with a fake/missing/typo'd postcode still won't locate — the row shows `N/M located` to make that visible.

### Geocoding behaviour
- Runs client-side in an effect keyed on `[day, engineers, jobsByEng]`.
- A session-lived `Map` cache (`cacheRef`) avoids re-geocoding; re-visiting a day is instant.
- Cache-miss network calls are throttled ~1.1 s apart to respect Nominatim's ~1 req/s policy, so the **first** load of a busy day takes a few seconds (rows show "calculating…").

## Deliberately out of scope (next steps)
- **Road/driving miles** — would need a paid Distance Matrix/Directions API (Google or Mapbox). This page is straight-line only.
- **Persisted coordinates** — add `lat`/`lng` columns to `jobs` (new numbered migration) and geocode on job save, so this page reads stored coords instead of geocoding live (removes the throttle/rate-limit entirely).
- Home→first / last→home legs; multi-day (`endDate`) expansion; week/range totals and CSV export; a firmer "actual vs scheduled" hours definition.
