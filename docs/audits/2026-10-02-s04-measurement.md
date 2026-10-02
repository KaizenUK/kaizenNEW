# S-04: measurement status

Checked 2 October 2026 at production release `0d0a5e0`. This is an incomplete task, not a claim that conversion tracking works.

## Evidence

- The live homepage, contact page, performance scanner and blog index return 200. Their HTML scripts and linked local JavaScript dependency graphs contain no recognised Google Analytics/Tag Manager, PostHog, Plausible, Umami, Fathom, HubSpot tracking or Cloudflare Insights signature. No external script URL is present on those pages. The four graphs contain 9, 17, 18 and 7 JavaScript files respectively. This does not establish whether a separate account or server-side reporting exists.
- `client/components/CookieBanner.tsx` has a placeholder where analytics would load. It is not imported by a current page/layout. No live analytics integration is configured in the examined marketing source.
- `ContactFormBox.tsx` inserts into `contact_form_submissions`, including source page and query string. A successful database response produces the confirmation. The honeypot can also show a confirmation without saving, so a confirmation view alone must not count as a real lead.
- `SpeedScanner.tsx` inserts into `speed_scanner_results` when a visitor supplies an email to unlock a report. It intentionally unlocks even if saving fails. A scan attempt, visible report and successfully saved email lead are different events; they must not be conflated.
- The existing contact/scanner alert functions contain HubSpot contact-write integrations. Presence in source does not prove that live database triggers, credentials, delivery or reports are working.
- Google Analytics in the available browser opens at sign-in. No authenticated property or last-30-day report is available in this session. No customer records were retrieved and no real form submission or alert was sent. Sean has been asked which analytics account/tool already exists.

Local evidence: ignored `.local/marketing-20261001/s04-instrumentation.json` records live script roots, asset counts and pattern results. Source files provide the submission semantics above. A missing tracker is not a zero-conversion report.

## Completed reminder

Created and read back the active thread reminder `export-kaizen-search-console-data`, **Export Kaizen Search Console data**, for the first day of each month at 09:00 local time (Europe/London). It reminds Sean to export the previous complete calendar month and the available 16-month history, retain dated exports and compare page/query results against the SEO log. The reminder points to Google Search Console. The first scheduled monthly date after this setup is 1 November 2026.

## Required before S-04 can close

1. Identify and access the reporting account, or agree where reporting will live if no account exists.
2. Verify successful contact saves and successful scanner email-lead saves as separate conversions. Exclude honeypot, invalid, failed and test submissions. Treat completed scans/report downloads as separate product actions if those are also measured.
3. Read aggregate totals for the last 30 days with authorised reporting access. If historical tracking was absent, state that limitation and establish the first reliable reporting date; do not invent or backfill analytics events.
4. Verify the live integration and record the actual account/property, event definitions, dates and totals in the site profile. Keep the task open until the board's evidence requirement is met.

The existing article links include internal `utm_source=chatgpt.com` parameters. Review those when implementing attribution so internal navigation does not distort acquisition reporting. S-03 preserved them; no attribution claim is made here.
