# Codex brief — take the Kaizen builder from private beta to public

## The goal

Sean will run the builder on the Kaizen website alone first, as a private beta with one user. When he is happy with it, the same product opens to Kaizen's clients and then to the public. Your job is the implementation work in [the launch task map](../builder-launch-plan.md), stage by stage, in order. Claude reviews each stage for usability, wording and safety. Sean accepts.

## What "good" looks like

A person who does not write code opens the builder in a browser, sees their pages, clicks the words on a real page and changes them, saves, sees the result on staging, and publishes when ready. They never run a helper, never see a file path, a branch or a commit unless they choose to, and never wonder what a button will do. Owners and developers get the detail when they want it.

## Order of work

1. **L0** — beta switches and a clean baseline (Kaizen shortcuts become settings, origins from configuration, problem reports, error visibility).
2. **L1** — the hosted helper, so existing pages can be edited with nothing running on the editor's own computer, ending in "Save to website".
3. **L2** — invitations, roles that mean something, an account page, honest sign-in states.
4. **L3** — client mode that hides Git, one status language, explain once.
5. **L4** — first-run checklist, page templates, a starter site.
6. **L5** — public-launch hardening: browsers, accessibility, performance, security, backups, legal.
7. **L6** — self-serve: sign-up, billing, custom domains, quotas.

Stop at the private beta gate in the task map and wait for Sean's acceptance before going further. Do not reorder stages without asking.

## Ground rules

- Plain English in every screen and message. Use the product's existing words: helper, website folder, edit text and links, review my changes, apply changes to the folder, preview the website, save to website, publish. Do not rename common web design terms.
- No time estimates in plans, logs or messages. Report scope, order and what is proven.
- Original source stays authoritative. Nothing is pushed or published without an explicit user action.
- Never commit private credentials, `KAIZEN-PRIVATE-MIGRATION*` files, deploy keys or `.env` values. Server-only secrets never get a `VITE_` prefix.
- Never test against Sean's personal `.kaizen-builder` or overwrite his checkout. Fixtures create their own temporary repositories.
- Build on what exists. The repository, runner, source, Git, release worker, projects and auth modules are listed in the task map. Reuse them; do not rewrite them.
- New server endpoints only where the logic must live on the server.
- Keep the local helper working as the developer path.

## How to work

- One task at a time, one commit per task, on a branch off `main`. Commit messages say what changed for the user, then how.
- Every task ships with the tests that prove it and a short update to the matching guide under `docs/`. Run `pnpm typecheck`, `pnpm test` and the relevant `tests/builder/*.spec.ts` before you call a task done; run the full `pnpm test:builder:browser` at the end of each stage.
- Append an implementation log for each stage to the end of `docs/builder-launch-plan.md`: what shipped, what was proven and how, what was left out and why. Keep evidence honest; a passing test is not a manual acceptance.
- When a decision needs Sean (isolation of server builds, error sink, domain approach, legal wording), write the options with a recommendation in the log and carry on with the parts that do not depend on it.
- Screenshots of new or changed screens at desktop and phone widths go with each stage log.

## Verification standard

- Unit and database tests for logic and access rules; browser scenarios for journeys; integration tests against temporary repositories and fake remotes for Git and builds.
- CI in `.github/workflows/builder-checks.yml` must stay green.
- Security work (auth, membership, path safety, locks, CSP) gets its own negative tests, not just happy paths.

## Roles

- **Codex:** the implementation work above.
- **Claude:** reviews each stage in the running product, polishes wording and layout, sanity-checks the architecture and security, and flags anything that would embarrass the product in front of a client.
- **Sean:** accepts each gate by using the product on Kaizen.
