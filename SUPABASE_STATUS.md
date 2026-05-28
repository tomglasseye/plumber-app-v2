# Supabase Project Status - Plumber App

**Last Updated:** May 28, 2026

## Critical Issues

### 1. Project Pause Risk (URGENT)
- **Status:** Plumber App project (ID: `azutrfdjataealpmkwvb`) scheduled to be paused
- **Reason:** No activity for 7+ days
- **Impact:** App will stop working if paused
- **Action Required:** 
  - Use the app/access Supabase dashboard to trigger activity, OR
  - Upgrade to Pro plan to prevent automatic pausing
- **Recovery:** Can unpause from dashboard within 90 days of pause date

**Email:** From ant.wilson@supabase.com (May 20, 2026)

---

## Upcoming Changes

### 2. Data API Exposure Policy Change
- **Announcement:** Final reminder sent May 27, 2026
- **Timeline:**
  - **May 30, 2026:** New projects won't expose tables by default
  - **October 30, 2026:** New tables in existing projects also won't expose by default
  
- **Impact on Plumber App (existing project):**
  - **No change until October 30, 2026**
  - Existing tables continue to work as-is
  - Only affects NEW tables created after October 30
  
- **Action Required (if creating new tables after Oct 30):**
  - Add explicit SQL GRANT statements:
    ```sql
    GRANT SELECT ON public.table_name TO anon;
    GRANT SELECT ON public.table_name TO authenticated;
    ```
  - Use Security Advisor in Supabase dashboard to review current table exposure

**Email:** From noreply@supabase.com (May 27, 2026)

---

## Recommendations

1. **Immediate (Next few days):**
   - Access the Plumber App or Supabase dashboard to prevent project pause
   - Or upgrade to Pro plan

2. **Before October 30, 2026:**
   - Review current table exposure using Security Advisor
   - Plan for explicit grants if adding new tables

3. **Development:**
   - No code changes needed for existing tables
   - Future table migrations should include grant statements
