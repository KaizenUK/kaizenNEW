# Kaizen Web — Project Guidelines

**Current main handover — 15 September:** Sean paused implementation and authorized committing all pending work into `main`. Read [the consolidated Claude handover](docs/handover/claude-main-handover.md) first. Use `/home/sean/Documents/GitHub/kaizenNEW` on `main`; source from the earlier launch worktree is now committed here. Implementation resumed with Claude on 15 September; D2d.2 is verified (uncommitted) and D2d.3 is next. Older instructions about uncommitted T4 or a required launch-worktree-only continuation are superseded.


## Current launch implementation handover

Read `HANDOVER.md`, then [the Claude continuation tasks](docs/handover/l6-t4-claude-tasks.md) before changing builder code. Use the consolidated `main` checkout identified above; preserve private local state. The current resume point is **D2d.3 — history availability and user actions** in [the detailed release-retirement checkpoints](docs/handover/l6-t4-release-retirement-tasks.md). The launch brief and task map linked there govern this work; older pause/next-step notes are historical. Keep the handover current after each verified checkpoint.

## Content Principles (from guidance/Viral_Content_Guide.pdf)

All website copy should follow the SUCCESS model:

1. **Simple** — One core idea per section (max 1–3 points). Use strong analogies. Create curiosity gaps. Ask: "If someone remembers one thing, what is it?"
2. **Unexpected** — Break patterns to capture attention. Surprise grabs attention; mystery sustains it.
3. **Concrete** — Show, don't tell. Use vivid sensory detail people can visualise. Replace abstract terms with tangible imagery. Ask: "Can I see it?"
4. **Credible** — Anchor numbers to physical equivalents. Use demonstrations or testable claims (e.g. "run your own audit").
5. **Emotional** — Turn abstract ideas into human impact. Anchor to basic needs: safety, belonging, progress, identity, hope. High-arousal emotions (awe, excitement) drive action.
6. **Stories** — Embed messages inside narrative. Make people feel smart or like insiders. Share useful, actionable advice.

## Design Direction

- **Aesthetic**: Clean, spacious, bright. Inspired by Aramco sponsorships site.
- **Fonts**: Manifa V2 Bold (headings), DM Sans (body)
- **Tone**: Confident but approachable. No jargon. Plain English.
- **Layout**: Generous whitespace. Let content breathe. Easy to scan.

## Tech Stack

- Astro 6 + React integration
- Tailwind CSS v4
- Sanity CMS (studio in /apps/studio)
- GSAP, Framer Motion, Remotion available for animations
- Deployed with Vite
