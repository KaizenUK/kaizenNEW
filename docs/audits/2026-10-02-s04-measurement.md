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

### Ad-page follow-up during P-11

The expanded six-route audit found a Bing UET loader on `/get-started/` with the literal ID `YOUR_UET_TAG_ID`; its graph has 15 local JavaScript files. A document-level submit listener labels attempts as conversions without checking a successful database save. Neither establishes a working account or reliable lead count. `/review/` has 21 local JavaScript files and no recognised tracker signature. The original four-route results remain unchanged; Microsoft UET and Clarity signatures were added to the expanded check.

P-11 removes the unconfigured loader and submit listener. Browser checks on both built ad pages observe no Bing/Clarity/Google tracking request. The actual contact and scanner components, saved-lead semantics and database integration remain unchanged. S-04 still needs the existing account identified, or an agreed reporting destination, before instrumentation can be completed.

The P-11 live browser check additionally observed Cloudflare edge requests to `/cdn-cgi/rum` and its challenge platform. These were absent from the earlier fetched HTML/script-graph evidence and do not establish enquiry conversion reporting. The live form smoke test blocks all writes, records these background attempts separately and confirms that walking the form without submitting generates no application write. Cloudflare account access, dashboards and any configured conversion goals remain unverified.

## Connected PostHog follow-up after S-05

The available PostHog connector was checked on 2 October 2026 after the final site audit. Read-only inventory finds one organisation named Kaizen and one Default project. Its configured website list contains three other domains; kaizenweb.co.uk is absent. The pageview event exists, and its verified hostname-property taxonomy returns one other hostname, not Kaizen's website.

This identifies an accessible analytics account, but it does not identify working reporting for this website. No visitor records, session replays, event-level data or conversion reports were read. No project, tracking setting, event or dashboard was changed. Tokens are not recorded in repository evidence.

[PostHog's authorised-URL documentation](https://posthog.com/docs/health-checks/authorized-urls) describes the URL setting's toolbar and filtering role; it is not treated as an exhaustive event-ingestion report. The returned taxonomy values also do not establish a 30-day zero count. The requirement remains a verified report for successful contact saves and scanner email-lead saves, with a known account and date range.

The connection cannot load project-specific skills or business-knowledge documents with its current scopes; the available general query skill and official documentation were checked. That limitation was not bypassed. The identity and taxonomy checks above succeeded with the available read access.

Sean was asked to identify the website's reporting tool/property, or confirm that no analytics is set up. Do not add Kaizen's website to the shared project or install new tracking merely because this connector is available. Private, token-free discovery evidence: .local/marketing-20261001/s04-posthog-discovery.json.

## Completed reminder

Created and read back the active thread reminder `export-kaizen-search-console-data`, **Export Kaizen Search Console data**, for the first day of each month at 09:00 local time (Europe/London). It reminds Sean to export the previous complete calendar month and the available 16-month history, retain dated exports and compare page/query results against the SEO log. The reminder points to Google Search Console. The first scheduled monthly date after this setup is 1 November 2026.

## Required before S-04 can close

1. Identify and access the reporting account, or agree where reporting will live if no account exists.
2. Verify successful contact saves and successful scanner email-lead saves as separate conversions. Exclude honeypot, invalid, failed and test submissions. Treat completed scans/report downloads as separate product actions if those are also measured.
3. Read aggregate totals for the last 30 days with authorised reporting access. If historical tracking was absent, state that limitation and establish the first reliable reporting date; do not invent or backfill analytics events.
4. Verify the live integration and record the actual account/property, event definitions, dates and totals in the site profile. Keep the task open until the board's evidence requirement is met.

The existing article links include internal `utm_source=chatgpt.com` parameters. Review those when implementing attribution so internal navigation does not distort acquisition reporting. S-03 preserved them; no attribution claim is made here.

## Resumed after Sean's PostHog installation, 2 October

Sean selected PostHog and explicitly deferred his Business Profile until after this goal. The earlier account-selection blocker is resolved. The installed public token matches project **203621**, **Default project**, organisation **Kaizen**, on EU Cloud. Existing other-site settings are preserved. Website reports must filter to kaizenweb.co.uk.

The production and staging release environment files now hold the two installed public PostHog settings. Exact-value read-back passed; protected before-change copies remain on the VPS. Tokens are not in repository evidence. Staging is excluded at runtime and has not yet been advanced.

### Verified implementation

- `contact_form_submitted`: only after the contact database insert returns without an error. Honeypot confirmations, invalid forms and failed saves do not count.
- `scanner_email_lead_saved`: only after the scanner email-lead insert succeeds. A report unlock or scan completion alone does not count.
- No name, email, phone, message or scanned URL is sent. The two existing boolean contact properties describe website ownership and marketing consent; scanner capture has only the marketing-consent boolean.
- Tracking waits for the existing cookie-consent choice. Decline, persistence, reopening choices and withdrawal are checked. The shared notice now has working controls, and cookie/privacy prose describes the actual collection. No replay, automatic clicks, exceptions or logs are enabled by this website integration.
- Events carry `site=kaizenweb.co.uk`, `measurement_version=1` and `is_test`. Browser automation is marked as test traffic. Stage, builder routes and framed previews are excluded.
- URL query strings/fragments and campaign properties are removed. Existing internal UTM links therefore cannot become attributed campaigns. Acquisition campaign reporting is deliberately not claimed.
- Analytics exceptions cannot turn a successful save into a form error. Declining analytics does not change either form.

### Local evidence before release

Types and the full production/Studio build pass. Vitest: before 1,561 / 1,078 passed / 439 inherited failures / 44 pending; after 1,565 / 1,082 passed / the same 439 failures / 44 pending. Four new tests pass; test-name comparison has no regressions or new failures. The Windows failures are not described as a green suite.

Thirty-four browser checks pass: twelve desktop/phone consent, accessibility and overflow views across all three marketing layouts and both updated policy pages, plus twenty-two contact/scanner journeys. Success, database failure, absent database, declined consent, throwing tracker and contact honeypot paths are covered. Database boundaries and scanner responses are mocked; no enquiry, scanner lead or alert is actually sent. All twelve changed-UI viewport captures were inspected in six review sheets. The final shared-script change additionally handles consent withdrawal in another tab.

All 53 built documents retain metadata and structured data. The 22-page sitemap and existing linking checks still pass. Marketing copy has zero hard-rule breaches; policy prose is reported separately from marketing reading-age targets. Private evidence is in `.local/marketing-20261001/s04-*`.

The install also left builder instrumentation and a package addition in the shared checkout. These are preserved as Sean's separate work and are excluded from this marketing release, as the board requires. The web snippet does not need the unused package addition.

### Reporting still to verify after deployment

The connector has saved-insight read/write access. Its separate marketing-goal and governed-metric scopes are unavailable, so use a clearly described saved event-count insight, not a claim of an approved catalogue metric. Existing matching insight search returns none. Neither new conversion name exists in the pre-release event schema. There is no verified 30-day historical collection to recover. Live ingestion, report filters and counts will be recorded after this release.

## Live verification and S-04 completion, 2 October

Released in **57324be6b949712d4038260b4cee979dfc47c9f9**, successful production deployment **37009100208**, release **gh-37009100208-1**. The marker records activation at **12:53:21 UTC on 2 October 2026**. Eight live home/contact/scanner/blog/ad/policy responses return 200 and preserve search metadata and structured data. Public PostHog configuration is present.

Both form paths were then exercised in the live browser with only their database boundary mocked. One `contact_form_submitted` and one `scanner_email_lead_saved` reached PostHog; live property schema and exact `site` / `is_test` values were read back. A separate one-day QA count returns **1 / 1**. No contact record, scanner lead, email or alert was created.

The current SDK deliberately rejects automation, including `navigator.webdriver`. The delivery probe uses its documented `opt_out_useragent_filter` setting **only in that test browser**. The website still emits `is_test=true`, and production retains default bot filtering. The SDK's obsolete `get_config` method and former capture return value are not used to assert success. Current SDK configuration and the event-processing callback were inspected; actual delivery is independently confirmed in PostHog.

### Saved report

[Kaizen website: saved enquiries (last 30 days)](https://eu.posthog.com/project/203621/insights/kyWwxRRM), insight **6290215**, short ID **kyWwxRRM**. Saved, favourited and read back with `insight-query`. Two total-count bars show contact enquiries and scanner email leads separately. Filters: `site=kaizenweb.co.uk`, `is_test is_not true`, plus project test-account exclusions. UTC, rolling `-30d`; the saved query resolves from **2 September 2026 00:00 UTC through 2 October 2026 23:59:59.999999 UTC** at verification. The summary formatter labels the last day's bucket at midnight; it is not an exclusion of 2 October.

At read-back, **0 contact / 0 scanner real conversions**. Both deliberate QA events are excluded. **Collection began on 2 October 2026. Earlier zeros are unmeasured history, not proof of no enquiries.** No backfill or synthetic real conversion was added. Consented browser save counts can undercount database leads because of rejected consent, blocking or delivery failure; these are not unique-person totals. This limitation is also in the saved report description.

### Final SDK corrections and exact release checks

The live SDK check found optional survey/conversation bundles inherited from the shared project. The final site configuration disables surveys, conversations and product tours without changing the other sites' project settings. It also uses `opt_out_persistence_by_default=true`: the current SDK ignores the old `clear_persistence` argument. The real-SDK consent probe verifies that withdrawal removes the browser-ID cookie, and that a declined reload does not load the SDK. Stage performs no PostHog requests and has no cookie-choice prompt.

An isolated managed checkout verifies the marketing commit without Sean's separate installer changes. Types and the complete site/Studio build pass. Full test comparison against the last S-05 release: **1,565 total, 1,082 passed, 439 inherited failures, 44 pending**, with no regression or new failure. The final browser checks cover the current SDK and optional-widget exclusions. Private reports: `s04-isolated-test-comparison.json`, `s04-final-test-comparison.json`, `s04-sdk-isolated.json`, `s04-browser-live.json`, `s04-report-evidence.json` and release-marker records.

The original monthly Search Console reminder remains active; no duplicate reminder is created. **S-04 is complete. S-02 is explicitly deferred by Sean until after the goal**, and its listing changes are not claimed complete. Production and staging are brought to the final closing commit only after these checks.
