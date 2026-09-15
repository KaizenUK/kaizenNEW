# Kaizen

**Current main handover — 15 September:** Sean paused implementation and authorized committing all pending work into `main`. Read [the consolidated Claude handover](docs/handover/claude-main-handover.md) first. Use `/home/sean/Documents/GitHub/kaizenNEW` on `main`; source from the earlier launch worktree is now committed here. Implementation resumed with Claude on 15 September; A–D are complete and committed, and E is next. Older instructions about uncommitted T4 or a required launch-worktree-only continuation are superseded.

## Paused builder work / Linux handover

For continuation of the multi-project visual builder, read `HANDOVER.md` first. It records the 11 September 2026 user-requested pause for a Windows wipe, production state, private-data restoration, and Claude's visual/UX brief. The critical unfinished requirement is genuine WYSIWYG editing of existing sites; source-content fields and a separate selector are not completion. Resume implementation when Sean asks after migrating. The ordered task map for that work is `docs/existing-site-visual-editing-plan.md`. The next ordered task map is `docs/builder-launch-plan.md`, with its goal brief in `docs/handover/codex-launch-brief.md`. Sean has provisionally accepted the private beta gate and authorized continuation through L0–L6. Follow the later autonomy instructions in the brief; diagnose and fix failed tests without stalling. `KAIZEN-PRIVATE-MIGRATION*` files are private and must never be committed or published.

For the current unfinished L6-T4 work and a Claude takeover, read `docs/handover/l6-t4-claude-tasks.md` after `HANDOVER.md`. It identifies the latest proof and ordered continuation tasks; older next-step paragraphs are historical.

The current D2 implementation is broken into six checkpoints in `docs/handover/l6-t4-release-retirement-tasks.md`. D2a–c are verified in fixtures, including actual release removal and recovery after two service kills. D2d (native and client callers, direct-call guards, history availability and the combined caller checkpoint) is also verified; D2e generated-state retention and D2f integrated proof are verified; D3 generated directories, D4 shared admission and the D5 checkpoint are verified; continue E. Native integration is prepared but uninstalled; preserve its generation cancellation, last-executor ownership, store/native locks and serving/rollback checks.

A production-ready Astro static application with React islands, Sanity CMS, TypeScript, Vitest, and modern tooling.

API endpoints should only be created when strictly necessary, for example to encapsulate logic that must live on the server, such as private key handling or certain DB operations.

## Tech Stack

- **PNPM**: Prefer pnpm
- **Framework**: Astro 7 static output
- **Frontend**: React 19 + TypeScript + TailwindCSS 4
- **CMS**: Sanity Studio (separate app under `apps/studio`)
- **Testing**: Vitest
- **UI**: Radix UI + TailwindCSS 4 + Lucide React icons

## Project Structure

```
src/                      # Astro source
├── pages/                # Astro pages and file-based routing
│   └── [...slug].astro   # Build-time managed-page catch-all
├── layouts/              # Astro layout components
└── styles/               # Global stylesheets

client/                   # React components and client-side code
├── pages/                # React page components
├── components/ui/        # Pre-built UI component library
├── hooks/                # Custom React hooks
├── context/              # React context providers
├── animations/           # Animation configs (GSAP, Remotion, particles)
├── static/               # Astro-mounted React page entry components
└── global.css            # TailwindCSS theming and global styles

shared/                   # Types shared between API routes and client
└── api.ts                # Shared API interfaces

sanity/                   # Sanity CMS schema and configuration
```

## Routing

Astro handles public route rendering via `src/pages/`. React is mounted per-route using Astro islands, and interactive links use anchor/document navigation.

## Styling System

- **Primary**: TailwindCSS 4 utility classes
- **Theme and design tokens**: Configure in `client/global.css`
- **Tailwind config**: `tailwind.config.ts` (referenced via `@config` in CSS files)
- **UI components**: Pre-built library in `client/components/ui/`
- **Utility**: `cn()` function combines `clsx` + `tailwind-merge` for conditional classes

```typescript
className={cn(
  "base-classes",
  { "conditional-class": condition },
  props.className
)}
```

## API Routes

API routes use Astro's file-based API routing in `src/pages/api/`:

```typescript
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ url }) => {
  return new Response(JSON.stringify({ message: "Hello" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
```

Path aliases:
- `@/*` - Client folder
- `@shared/*` - Shared folder

## Development Commands

```bash
pnpm dev        # Start Astro dev server
pnpm build      # Production build
pnpm start      # Preview production build
pnpm typecheck  # TypeScript validation
pnpm test       # Run Vitest tests
```

## Production Deployment

- Static `dist/` deployed to VPS web root
- Optional separate Studio static deploy (`apps/studio/dist`)
- GitHub Actions CI/CD pipeline (`.github/workflows/deploy.yml`)
- On the VPS, observe Git as the checkout's service account or with `GIT_OPTIONAL_LOCKS=0` / `git --no-optional-locks`. Root-run `git status` can otherwise refresh `.git/index` as root and break deployment or editing. Mutate the managed checkout as `kaizen-helper` and deployment checkouts as `kaizen-deploy`; preserve Sean's pending source and drafts.
