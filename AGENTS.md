# Kaizen

A production-ready Astro static application with React islands, Sanity CMS, TypeScript, Vitest, and modern tooling.

API endpoints should only be created when strictly necessary, for example to encapsulate logic that must live on the server, such as private key handling or certain DB operations.

## Tech Stack

- **PNPM**: Prefer pnpm
- **Framework**: Astro 6 static output
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
