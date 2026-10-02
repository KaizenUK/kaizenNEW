# PostHog Data Warehouse Source Setup

Created 0 of 2 detected sources in PostHog. Supabase credential entry was cancelled, and Google Analytics requires browser-based OAuth, so both sources need browser setup.

## Changes made

- Inspected PostHog's required connection fields for the detected `Supabase` source.
- Checked for related Supabase database environment keys; none were configured in the project's environment files.
- Did not create the Supabase source because the credential prompt was cancelled.
- Prepared pre-filled PostHog setup links for Supabase and Google Analytics.
- No application code or environment configuration was changed.

## Files created

- `posthog-warehouse-report.md` — this setup report.

## Manual steps

1. Connect Supabase in PostHog: https://eu.i.posthog.com/project/203621/data-warehouse/new-source?kind=Supabase&utm_source=wizard&utm_campaign=warehouse-source
   - For a standard sync, use the Session pooler connection shown under Supabase **Connect → Direct**.
   - Supply the Supabase database password, not an anon/service-role key or account password.
2. Connect Google Analytics and complete OAuth in PostHog: https://eu.i.posthog.com/project/203621/data-warehouse/new-source?kind=GoogleAnalytics&utm_source=wizard&utm_campaign=warehouse-source
