# Supabase Project Status & Operational Notes

**Last Updated:** June 3, 2026
**Status:** ✅ Live & healthy — production project is active and serving [hiveq.co.uk](https://hiveq.co.uk).

> The earlier free-tier "project pause after 7 days inactivity" risk no longer applies while the app is in active client use. If the project is still on the free tier, keep an eye on it during quiet periods, or upgrade to Supabase Pro to remove auto-pausing entirely.

---

## Data API exposure — explicit grants on new tables (still relevant)

Supabase changed its Data API exposure policy: as of **October 30, 2026**, **new tables created in existing projects are no longer exposed by default**. Existing tables are unaffected.

**What this means for us:** any table added from that date needs explicit `GRANT` statements in its migration, on top of RLS:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_name TO authenticated;
-- (anon only if the table must be readable without a session — usually not, for tenant data)
```

RLS still scopes every row per business; the grant just makes the table reachable through the Data API at all.

- This is referenced by `CLAUDE.md` (conventions) and the schema docs in `docs/SUPABASE.md`.
- Migration 28 (`reminders`) already follows this — see its `grant … to authenticated` line.
- Use the **Security Advisor** in the Supabase dashboard to review table exposure before launch.
