# Builder documents and personal-data requests

L5-T6 adds proposed private-beta Terms of Service and Privacy Policy pages, explicit acceptance at first sign-in, and private copy/erasure requests. Sean authorised recommended wording during implementation. The visible draft status is intentional: Sean or legal counsel must review the words, provider inventory and transfer arrangements before public subscriptions open. This is wiring and draft wording, not a claim of legal approval. L6 must register a reviewed public version before paid/public activation.

## Documents and acceptance

The public pages are `/builder/legal/2026-09-14/terms/` and `/builder/legal/2026-09-14/privacy/`. Their source lives in `src/pages/builder/legal/2026-09-14/`; `BuilderLegalLayout.astro` renders standalone pages without marketing scripts. The existing marketing terms, privacy page and contract remain separate.

`shared/builderLegal.ts` contains the current version, URLs and SHA-256 hashes of the exact Markdown source files. Migration `202609140004_builder_legal_privacy.sql` registers those same values. The database test recomputes both source hashes. Once used for acceptance, keep each version's source intact; wording corrections require another dated version, retained pages, shared metadata and a migration. Register immutable hashes and switch the one active version transactionally. Stage the new static documents before activation and coordinate the function/frontend rollout; a frontend with different hashes cannot accept a newer server version and prompts Reload Builder.

The hosted sign-in gate opens only after `builder-account` returns the verified user's acceptance of the exact compiled documents. New accounts and existing beta accounts without a record must make the choice. Password/invitation setup completes first. The checkbox starts empty; client metadata never counts as acceptance. An acceptance is idempotent by account/version and preserves its first timestamp. Unconfirmed, malformed and stale versions fail closed. Signing out remains available during a pending read; responses for a changed account are discarded. An unknown acceptance outcome can be resolved with Refresh documents. The local developer helper has no hosted account gate.

The checkbox agrees to the terms and acknowledges the privacy notice. It does not opt the person into marketing or optional tracking. A privacy enquiry can be emailed without accepting terms or signing in.

## Requests and current owners

Account contains **My personal data**, separate from the existing login-deletion flow. The person chooses their account or a website, copy or erasure, and up to 1000 characters locating the information. Repeating an unchanged request after an unknown response reuses its request ID in the open form; the database rejects conflicting reuse and limits creation to 20 requests per account per day. After reloading, inspect the recorded history before submitting again.

A requester can see their own history, including after website membership ends, and cancel an open request. Only the current website owner can see and respond to the website queue; publishing permission alone is insufficient. An owner who loses membership loses access immediately. Account requests and website requests with no current active owner enter the private operator queue. Lists use bounded 50-item cursor pages, including older closed history. Account changes discard earlier request responses in the UI.

Owners can mark a request Being reviewed, Completed or Declined with a reason. An update checks the current request version; concurrent changes require refresh. Completed/declined responses require explicit acknowledgement of identity verification and secure delivery. This control records a response; it performs no data export, website erasure, account deletion or email delivery. Verify identity proportionately, establish the responsible controller, locate the relevant information, handle lawful exceptions, and deliver any copy through a suitable private channel before recording completion. Keep credentials, identity documents, sensitive data and private download links out of the notes/response.

Requests remain available in Account for their requester. If the account has been deleted, use the retained contact address and an independently verified delivery route. An owner can still handle a pending request after the requester leaves. A privacy request must not be considered handled merely because the UI or operator command successfully records a status.

## Operator queue

The operator uses existing private `SUPABASE_URL` and `BUILDER_ACCOUNT_SERVICE_ROLE_KEY` environment configuration. Keep that environment and response files outside the checkout and web root, with private permissions. Do not put credential values or requester data in commands, CI output or project logs.

From the installed checkout, with the private environment already loaded:

```sh
pnpm exec tsx scripts/builder-privacy-requests.ts --list
pnpm exec tsx scripts/builder-privacy-requests.ts --list --before REQUEST_UUID
pnpm exec tsx scripts/builder-privacy-requests.ts --respond REQUEST_UUID --version CURRENT_VERSION --status in_review --response-file /private/response.txt --confirm REQUEST_UUID
```

The list output contains private contacts and notes; run it only in a private operator terminal. The response command accepts `in_review`, `fulfilled` or `declined`; the latter two are for an already verified and securely delivered outcome. It requires the same request UUID in `--confirm`, the current numeric version, and a non-symlink regular response file without group/other permissions. The response is bounded to 2000 characters and is not echoed on success. Private provider errors are replaced with a bounded recovery message. No command exports data or deletes the account. Requests for a website with a current owner cannot be answered through the operator fallback.

`builder-account` verifies the JWT and supplies the actor. Caller-supplied actors cannot select the operator queue. Only direct service-role RPC calls can use the operator's null actor, and then only for account/orphan requests. All three tables have RLS and no direct browser/service-role table grants. RPC grants and database functions are covered by the complete access matrix, including temporary-schema search-path protection. Streamed bodies stop at 8 KiB so a 2000-character UTF-8 privacy response fits; existing account-deletion actions retain their 4 KiB limit. Character and action-specific limits still apply.

## Retention and restoration

Closed privacy requests are pruned after two years, unless an operator has set a documented retention hold. Open requests remain until handled. Acceptance records remain while the account exists and expire up to two years after Auth soft deletion; an acceptance hold can preserve them. Direct Auth hard deletion cascades acceptance records, so review any applicable hold before a provider-level hard deletion. Both hold flags are operator database controls, unavailable to requesters and owners; record the lawful reason and review date privately and release the hold when it no longer applies.

Migration `202609140005_builder_privacy_retention.sql` schedules `builder_prune_privacy_records()` daily at 03:43 UTC. Verify that cron registration at rollout. Request contacts are retained independently of Auth so that deletion does not make an outstanding request impossible to answer. A removed website leaves its name snapshot and routes its requests to the operator.

Erasure handling must include source, release history, assets, live providers and the recovery process where relevant. Restricted backups can retain erased information until rotation; keep it beyond ordinary use and reapply valid erasure decisions before returning a restored system to service. See [backups and restoration](builder-backups.md). Maintain the necessary erasure record privately and review its own retention; the request status is not an automated erasure manifest.

The drafting references were the ICO's guidance on [privacy information](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/how-should-we-draft-our-privacy-information/), [erasure and backups](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/) and [responding to access requests](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/right-of-access/what-should-we-consider-when-responding-to-a-request/). Final applicability and wording remain a human review item.

## Verification and rollout

Database tests execute the actual migrations in PGlite: source hashes, version changes, retained acceptance, permission denials, current ownership, operator routing, idempotency, conflicts, cursor scope, limits and retention holds. HTTP tests run the actual account handler across verified actors, hostile origins, missing authentication, body limits and privacy input/status failures. Gate tests cover Strict Mode, explicit confirmation, account switching, delayed results, malformed responses and recovery. Operator tests use temporary private files and fake RPCs.

`tests/builder/legal-privacy.spec.ts` exercises real Supabase SDK calls through a fake provider boundary into the actual database functions, in Chromium, Firefox and WebKit. It covers first acceptance, persisted timestamps, switching to an unaccepted account, sign-out, owner/requester history, cancellation, secure-completion confirmation and public documents at desktop/phone widths. Existing Account and sign-in browser journeys run alongside it. These synthetic checks send no real emails or invitations and modify no live account, website or personal workspace.

The legal/privacy and retention migrations, account function v2 and matching frontend are live at `48823c6` on 15 September. The active `2026-09-14` document version, exact hashes and both retention schedules were verified. Production and staging each pass all 283 release checks, including both public document routes. Read-only browser inspection confirms that the public documents render and the signed-in Builder requests explicit acceptance; the checkbox remains unchecked and no acceptance was submitted for Sean. Live/manual acceptance, privacy-address delivery, operator queue review cadence and legal/provider review remain goal-end actions.
