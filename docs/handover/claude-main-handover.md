# Claude handover — consolidated main

Sean paused implementation and requested that all pending branch work be committed into `main` on 15 September 2026. This is the current handover and overrides older instructions to use a dirty launch worktree or defer the T4 commit. **Sean resumed implementation with Claude later on 15 September. D2d is complete and committed (`2ad9ccf`, `b13e69a` and the D2d.4 checkpoint).** This consolidation does not complete T4 or authorize treating L6 as deployed.

## Open this checkout

Use `/home/sean/Documents/GitHub/kaizenNEW`, branch `main`. Read `HANDOVER.md`, [the launch brief](codex-launch-brief.md), [the full task map](../builder-launch-plan.md), [the remaining T4 tasks](l6-t4-claude-tasks.md) and [the detailed D2 checkpoints](l6-t4-release-retirement-tasks.md).

Both previously separate sets of work are preserved:

- `e845385` records the original checkout's editor usability changes and launch notes: labels, tabs, canvas sizing, selection styling, notices, page ordering and review/commit presentation.
- `e73079d` records the unfinished quotas, uploads, native coordination, copy cancellation and release-retention implementation through D2d.1.
- The consolidation merges those commits and all earlier launch commits. At inventory, GitHub `main` and `stage` both pointed to `48823c6`, so stage had no additional unique changes. The newer feature branch included signup, billing and domains as well as the new T4 checkpoint.

Merge resolutions keep the newer hosted save/publish path, client/developer separation and validated before/after review, alongside the editor polish. Source history is preserved; branches are fast-forwarded, with no history rewrite or branch deletion. The old `kaizen-launch-rollout` checkout remains clean at the recorded live L5 revision as a reference.

## Resume point

**A–E are implemented and verified in fixtures.** Resume at **F — installation and complete T4 integration proof** in [the Claude checklist](l6-t4-claude-tasks.md), then G and H. The complete suite passes 1,534 cases. Nothing from T4 is installed or deployed.

L0–L5 are recorded as deployed. **L6 and all unfinished T4 work remain undeployed.** The recorded production revision is `48823c6f04d49073eb1eb20be7bacc92556032cb`. New migrations, runtimes, services/timers and the matching frontend require the coordinated rollout in F–G. In particular, install the fixed native deployment launcher before using its modified workflow. Do not deploy this checkpoint just because it is on main.

The latest narrow implementation proof is 257 affected cases with actual Nginx, six launcher cases, full types and the actual native-maintenance caller recovering through two forced service kills. The broader consolidation checks are recorded below. Fixture receipts are distinguished from production-provider proof in the guides.

## Ground rules retained

No time estimates, no subagents, no reopening the closed Sanity matter, and no per-subtask CI. Relevant local verification continues; milestone/end CI and full launch acceptance remain pending. Preserve original source and private data. When implementation is resumed, use recommended routine choices and collect human-only questions at the end. Sean's provisional beta acceptance remains accepted.

The private checkpoint and prior proof logs are in `/home/sean/.local/state/kaizen/`. The consolidation recovery archive path is recorded in `latest-consolidation-backup.txt` there. Private configuration and ignored local state were not added to Git. A fresh clone includes committed source and plans, but private credentials and local proof logs remain on this machine.

## Consolidation verification

- Dependencies restored with `pnpm install --frozen-lockfile`; package manifests and the lockfile were not changed by the install.
- `pnpm typecheck`: zero errors and warnings across 464 files (200 hints). The final dependency-restored check is recorded in `consolidation-types2.log`.
- `VITE_BUILDER_CLOUD=0 KAIZEN_NGINX_BINARY=/home/sean/.cache/kaizen-launch-tools/nginx pnpm test`: **1,498 passed across 121 files**, no skipped cases (`consolidation-tests2.log`). Use the explicit fixture mode so local hosted configuration cannot affect these tests.
- Relevant browser coverage: **all 14 distinct journeys covered successfully**, including the canvas journey in Chromium, Firefox and WebKit, page recovery, local commits and client/developer before/after review. The first corrected-environment run passed 13/14; the remaining assertion assumed the first file started collapsed. After aligning it with the preserved default-expanded file, all three review cases passed (`consolidation-browser2.log` and `consolidation-browser3.log`). The source changed only in the merge; the follow-up adjustment was to the test assertion. Desktop and mobile review screenshots were inspected.
- Use `pnpm test:builder:browser <specs>` for these journeys so the helper receives `npm_execpath`; the earlier direct `pnpm exec playwright` invocation did not supply it. Initial missing-dependency and local-environment failures are retained in the earlier private logs, followed by the passing runs above.

All logs are under `/home/sean/.local/state/kaizen/`. These checks verify consolidation; they do not replace the remaining complete T4/L6 rollout and acceptance proof. Commits use `[skip ci]` to avoid deployment during this handover. No production service or website is changed by this consolidation.
