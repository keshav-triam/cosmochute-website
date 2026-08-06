# CosmoChute — Lunar Infrastructure Systems

A cinematic, scroll-driven single-page site for CosmoChute, in the spirit of armory.in:
dark manifesto storytelling with massive typography — built around one central device:

**The entire page is one lunar day–night cycle.**

A live Three.js scene (procedural lunar terrain, craters, boulders, 2,200-star dome,
Earth in the sky, and stylized 3D models of the EPOC rover, OASYS trailer and
CARTRIDGE survival capsule) sits behind the content. As you scroll:

| Scroll story           | Sun state                                   |
| ---------------------- | ------------------------------------------- |
| Hero                   | Lunar day, sun at 42°                       |
| The Problem            | Sunset — long shadows, temperature falling  |
| The Thesis             | Nightfall, −180°C, stars at full brightness |
| The Stack (pinned)     | Deep night — the machines glow in the dark  |
| Capabilities           | Pre-dawn                                    |
| "Then the sun rises"   | Sunrise gold floods the terrain             |
| Manifesto              | Full day again — the cycle repeats          |

The lighting *is* the argument: everything else dies at sunset; CosmoChute hardware
is what's still lit when the sun comes back.

## Stack

- Vite + vanilla ES modules (no framework)
- Three.js — scene, procedural models, day–night lighting (`src/scene.js`, `src/models.js`)
- GSAP + ScrollTrigger + ScrollToPlugin — camera choreography, pinned showcase,
  reveals, HUD telemetry (`src/main.js`)
- Fonts: Space Grotesk (display) + Chakra Petch (HUD)

## Commands

```bash
npm install
npm run dev        # http://localhost:5188
npm run build      # outputs dist/ (fully static — deploy anywhere)
npm run preview    # serve the production build on :5189
```

## Implementation notes (hard-won)

- **ScrollTrigger creation order matters**: triggers refresh in creation order, and
  the stack pin's 300 vh spacer shifts everything below it. All triggers are created
  strictly in document order (pin before anything after `#stack`), or they measure a
  spacerless layout and fire early.
- The global day–night phase is driven by a plain `scroll` listener computing
  `scrollY / (scrollHeight − innerHeight)` directly — immune to trigger staleness.
- No CSS `scroll-behavior: smooth` — it corrupts ScrollTrigger measurements; anchor
  smoothing is done with GSAP ScrollToPlugin.
- `vite.config.js` pins `root` to the real long path: launching npm via the 8.3
  short path (spaces in the Windows user dir) otherwise breaks Vite's transform
  pipeline and modules get served raw.
- Distant objects (sun disc, Earth, stars) set `fog: false` or the exp2 scene fog
  swallows them.
- Reduced-motion users get instant content (no reveals); no-JS users get a fully
  visible static page (hidden states are gated behind `body.js`).
