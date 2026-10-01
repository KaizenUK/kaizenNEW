# Claude handover — consolidated main

## Latest continuation — 1 October 2026

Sean asked Codex to finish Claude's **dependency upgrade**, not resume the historical L6 implementation below. The working checkout is now `C:\Users\seanm\Documents\GitHub\kaizenNEW` on `main`. Claude's upgrade (`10b91b5`) is deployed with follow-up commits `d019a96` and `4b1b018` on both main and stage.

- **Production:** `gh-36878086686-1`, commit `4b1b01821e88a9af5b9941fbdfe592a40f445cbb`; [successful deployment](https://github.com/KaizenUK/kaizenNEW/actions/runs/36878086686).
- **Staging:** `gh-36877709620-1`, same commit; [successful deployment](https://github.com/KaizenUK/kaizenNEW/actions/runs/36877709620). The preceding staging deployment `36877051219` also passed.
- **Verified publicly:** exact release markers on both hosts; homepage, blog article and Studio login screen in the browser with no console errors. Studio is included at `/studio/`; separate Studio hosting is not configured. No authenticated Studio editing is claimed.
- **Deployment fixes:** cold dependency scans now get 60 seconds rather than 10. Claude's final production retry also exposed a real cgroup OOM at 2 GiB. Native builds now accept the private operator setting `BUILDER_NATIVE_BUILD_MEMORY_BYTES`, bounded to 64 MiB–8 GiB, defaulting to 2 GiB. Both installed environments set 6 GiB. Isolated client builds keep their 2 GiB maximum. The successful production build's sampled cgroup peak was 2,282,999,808 bytes, above the old limit. CPU/process/swap limits and descendant cleanup remain enforced.
- **Installed worker:** `/opt/kaizen-native-release/worker.mjs`, SHA-256 `bfdb5c44eedaeb80c93ac0a91469da917c5acad934a474631f345936d945dfdc`. Rebuilt from source and installed atomically while holding both deployment locks. The previous worker and private environment files are preserved in root-only `/root/kaizen-dependency-upgrade-20261001-p5kjrygw/`. Keep that directory private. Source pushes do not reinstall this worker.
- **Dependency audit:** Sanity's tooling still brought in vulnerable `adm-zip` and `undici` despite the direct upgrades. Both workspace overrides and lockfiles now use patched versions (resolved `adm-zip` 0.6.1 and `undici` 7.30.0). Both frozen installs and high/critical audits pass. TypeScript remains at 6.0.3 as Claude intended; its compiler API is used at runtime.
- **Focused proof:** full types pass; 74 affected Linux tests pass, including actual Nginx and two eleven-second storage scans; an actual delegated service verifies the 6 GiB native limit and unchanged isolated ceiling; all five controlled-build completion/failure/cancellation/timeout cases pass. Initial fixture failures were corrected by supplying `npm_execpath` and allowing 20 seconds for real Git recovery tests on the VPS. Logs are under `C:\Users\seanm\.local\state\kaizen\dependency-upgrade-20261001\`.
- **Broader CI is not a green acceptance:** the main `builder` job in the [final-revision run](https://github.com/KaizenUK/kaizenNEW/actions/runs/36877711408) passes: 1,549 application tests (four environment-gated skips), dependency audits, Edge checks, types, Studio credential checks, independent export/repository builds, actual Nginx activation/rollback, 17 real isolation checks and ten hosted browser journeys. Firefox passes all 62 journeys. WebKit passes 61/62; `editor.spec.ts:484` fails because the canvas rich-text input does not retain focus after clicking. The operations job fails in `test_billing_concurrency.py:126` at its storage-lock fixture; that Python test and all SQL migrations are unchanged from before the dependency upgrade. Chromium is still running at this checkpoint. The earlier run `36877075946` was superseded and cancelled after Firefox passed and WebKit reported rich-text drag/drop plus an internal reload failure. The final run's project reload case passes. Investigate the remaining rich-text interaction and billing fixture separately, and collect Chromium's result before claiming a completely green builder workflow.

Release retention, native cleanup and the historical human acceptance items remain as previously configured. The older Linux paths and September rollout state below are historical context.

## September consolidation

Sean paused implementation and requested that all pending branch work be committed into `main` on 15 September 2026. This is the current handover and overrides older instructions to use a dirty launch worktree or defer the T4 commit. **Sean resumed implementation with Claude later on 15 September. D2d is complete and committed (`2ad9ccf`, `b13e69a` and the D2d.4 checkpoint).** This consolidation does not complete T4 or authorize treating L6 as deployed.

## Open this checkout

Use `/home/sean/Documents/GitHub/kaizenNEW`, branch `main`. Read `HANDOVER.md`, [the launch brief](codex-launch-brief.md), [the full task map](../builder-launch-plan.md), [the remaining T4 tasks](l6-t4-claude-tasks.md) and [the detailed D2 checkpoints](l6-t4-release-retirement-tasks.md).

Both previously separate sets of work are preserved:

- `e845385` records the original checkout's editor usability changes and launch notes: labels, tabs, canvas sizing, selection styling, notices, page ordering and review/commit presentation.
- `e73079d` records the unfinished quotas, uploads, native coordination, copy cancellation and release-retention implementation through D2d.1.
- The consolidation merges those commits and all earlier launch commits. At inventory, GitHub `main` and `stage` both pointed to `48823c6`, so stage had no additional unique changes. The newer feature branch included signup, billing and domains as well as the new T4 checkpoint.

Merge resolutions keep the newer hosted save/publish path, client/developer separation and validated before/after review, alongside the editor polish. Source history is preserved; branches are fast-forwarded, with no history rewrite or branch deletion. The old `kaizen-launch-rollout` checkout remains clean at the recorded live L5 revision as a reference.

## Resume point

**L6 is installed and live (16 September).** Production serves release `l6-main-2` and staging `l6-stage-15`, both built from `615db73`; GitHub `main` and `stage` point at the same revision. All 21 L6 migrations are applied and verified, the nine `builder-*` Edge functions are deployed, and the upload service, native deployment runtime, shared storage admission, hosted helper and client worker all run the release revision. **Release retention and native cleanup are deliberately switched off** until someone uses the finished product once (sign in, edit, upload, publish, roll back). See [the installation plan](../builder-t4-installation.md) for step-by-step evidence, the five defects found during the rollout, and the remaining human-only items.

L0–L6 are deployed. The live application revision is `615db73276a4bb6219521d8e28060d2f0300d373`. Deployments run through the installed launcher `/usr/local/sbin/kaizen-public-deploy`, and rollback in both directions is verified on staging. Pushing from this machine needs the server's deploy key: use `/home/sean/.local/state/kaizen/push-via-vps.sh <branch>`.

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
