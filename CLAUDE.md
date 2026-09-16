# Kaizen Web — Project Guidelines

**L6 is live — 16 September:** the coordinated rollout is complete except release retention and native cleanup, which stay off until the finished product has been used once. Production serves `l6-main-2` and staging `l6-stage-14`, both from `615db73`. Read [the installation plan](docs/builder-t4-installation.md), then [the consolidated Claude handover](docs/handover/claude-main-handover.md). Use `/home/sean/Documents/GitHub/kaizenNEW` on `main`. Pushing from this machine needs `/home/sean/.local/state/kaizen/push-via-vps.sh`. Older instructions about an undeployed L6 or a blocked launcher are superseded.


## Current launch implementation handover

Read `HANDOVER.md`, then [the Claude continuation tasks](docs/handover/l6-t4-claude-tasks.md) before changing builder code. The current resume point is **H — acceptance and the human-only items** in [the installation plan](docs/builder-t4-installation.md#human-only-items-collected-so-far). Keep the handover current after each verified checkpoint.

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
