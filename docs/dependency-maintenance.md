# Dependency maintenance

Verified 11 September 2026. Major upgrades were explicitly authorised for this work.

The application now uses Astro 7.3.2, @astrojs/react 6.0.5, Vite 8.3.0 and Tailwind 4.3.3 with its Vite plugin. Studio uses Vite 8.3.0 and @vitejs/plugin-react 6.1.1. New standalone exports use Vite 8.3.0; independently built Astro acceptance fixtures use Astro 7.3.2. Existing customer repositories keep their own package versions during integration. The source parser retains @astrojs/compiler 4.0.0, and unit fixtures still cover older Astro repository metadata.

Astro keeps static output and React islands. Explicit `compressHTML: true` preserves the previous whitespace semantics. Tailwind's Vite plugin handles CSS imports before Vite processes them; the obsolete Tailwind 3 PostCSS configuration was removed. The working PostCSS configuration remains for other CSS consumers. Playwright starts Astro through its public API so the CLI's agent-environment background mode cannot escape test lifecycle management. All Windows browser scenarios use isolated retained profiles to avoid a verified cleanup stall; no personal browser profile is used.

## Audit results

| Installation | Before: low / moderate / high / critical | After |
| --- | --- | --- |
| Main repository | 8 / 70 / 68 / 1 | 0 / 1 / 0 / 0 |
| Studio | 9 / 57 / 46 / 0 | 0 / 0 / 0 / 0 |
| Fresh Astro integration fixture | Previously affected Astro 6 fixture | No findings |
| Fresh standalone React export | Previously verified separately | No findings |

These are full `pnpm audit --json` results, including development dependencies. They are a dated registry snapshot, not a promise about future advisories. Root and Studio have independent lockfiles and must both be checked. Compatible security floors are recorded in their scoped pnpm overrides; UUID 8/10 consumers move to the patched CommonJS-compatible UUID 11 branch. The unused `vite-plugin-node-polyfills` package was removed, eliminating its unpatched elliptic dependency. The existing Puck patch remains intact.

### Remaining exception

`adm-zip@0.6.0` is brought into the root installation by `sanity@5.13.0 → @sanity/cli@5.13.0 → @sanity/runtime-cli@14.2.0`. [GHSA-vwc7-r8mq-g2x9](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9) has no published fixed version. It concerns extraction with overwrite enabled into a directory containing attacker-created symbolic links. The installed runtime CLI imports AdmZip in `dist/actions/blueprints/assets.js` to create function asset archives (`addLocalFolder`, `addLocalFile`, `toBuffer`); no extraction call was found in that installed CLI package. The latest runtime CLI metadata still depends on the affected 0.6 branch.

Kaizen's website exports, editable imports and native backups use fflate and their own path, size, checksum, ownership and destination checks. The builder does not invoke this CLI's archive extraction. The exception remains visible in the audit; it is not suppressed or described as a fixed library. Recheck this assessment when upgrading Sanity's CLI, adding CLI commands, or when upstream publishes a fix.

## Verification

- Full unit suite: 199 passed, one optional Nginx case skipped.
- `pnpm typecheck`: 302 files, zero errors/warnings; 171 hints. TypeScript passed again after the UI fixes.
- Full site and Studio production build passed. Main homepage and About page passed actual built-output desktop/mobile heading, overflow and JavaScript checks; screenshots inspected.
- Full Unity browser suite: 30 passed, two optional cases skipped (external real asset packs and local Nginx publication); clean process exit in 4.6 minutes. Native editing, restored native builds, registered nested content, autosave, recovery, projects, exports and repository round trips are included. Existing hosted publication evidence is recorded separately in builder-project-progress.md.
- Fresh Astro and standalone repositories installed and built outside Kaizen. Standalone TypeScript and both desktop/mobile navigation, keyboard, link, console and private-source checks passed. Both dependency audits reported zero findings.
- The standalone client-worker Vite loader produced four static files and an editable backup.

The suite exposed and fixed nested forms in the rich-text link editor; Enter-key link application and absence of that markup error are now checked. Canvas sizing defers React updates outside ResizeObserver delivery. Other ResizeObserver loop warnings still occur in the editor and require follow-up; this is not a clean-editor-console claim. Private-file denial messages in the access tests are expected. Optional Nginx/asset-pack skips are not presented as new verification of those integrations.

Migration references: [Astro 7](https://docs.astro.build/en/guides/upgrade-to/v7/), [Vite 8](https://vite.dev/guide/migration), [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite), [Astro AVIF advisory and patched release](https://github.com/withastro/astro/security/advisories/GHSA-26w7-cxv4-gfx2).
