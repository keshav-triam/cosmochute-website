# CosmoChute — Website 2.0

**Lunar Infrastructure Systems.** The public marketing site for CosmoChute — a
cinematic, scroll-driven single-page experience that explains what CosmoChute
builds, why it matters, and plays the company's entire LEAP mission end to end
as the visitor scrolls.

**Live:** _(point this at whichever deployment is canonical for this repo once
it's connected to hosting — see [Deployment](#deployment) below)_
Reference deployment: https://cosmochute-website.vercel.app

---

## Table of contents

- [What this project is](#what-this-project-is)
- [Company & mission background](#company--mission-background)
- [Design concept](#design-concept)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Local development setup](#local-development-setup)
- [Regenerating textures](#regenerating-textures)
- [Building for production](#building-for-production)
- [Deployment](#deployment)
- [Content & copy sources](#content--copy-sources)
- [Architecture notes](#architecture-notes)
- [Known gotchas](#known-gotchas--hard-won-lessons)
- [Performance](#performance)
- [Accessibility](#accessibility)
- [Browser support](#browser-support)
- [Asset credits & licensing](#asset-credits--licensing)
- [Contributing](#contributing)

---

## What this project is

A single-page, no-framework website built around one central device: **the
entire page is one lunar day–night cycle**, rendered in real time with
Three.js and driven by scroll position. As the visitor scrolls through the
company's pitch — the problem with expendable lunar hardware, the CosmoChute
thesis, the LEAP hardware stack, and finally a fully-animated, end-to-end
playback of a real LEAP mission — the sun sets, the surface drops to −180 °C
and CosmoChute's hardware is the only thing still lit, then the sun rises
again for the mission playback and the closing manifesto.

It is not a template or a CMS-driven site. Every visual — terrain, hardware,
lighting, camera moves, vehicle animation — is generated or choreographed in
code specifically for this narrative.

## Company & mission background

CosmoChute is a lunar infrastructure company building **LEAP**: a reusable
robotic system for sustained operations on the Moon, consisting of three
integrated systems (all modelled and animated in this site):

- **EPOC** — a modular, reusable six-wheel rover with a robotic arm and a
  belly chamber that docks a single 8U payload Cartridge at a time. Designed
  as a persistent asset that improves with every deployment cycle, not a
  single-mission vehicle.
- **OASys** — a towable payload reloading & storage trailer: a magazine of up
  to eight 8U Cartridges, kept safe from integration through deployment and
  reloaded onto EPOC one mission at a time.
- **Cartridge** — a protected 8U payload enclosure (400 × 200 × 100 mm) with a
  top hatch for regolith access, a front window for horizon imagers, and a
  wide bottom window for spectrometers — power, data, and thermal control
  included.

CosmoChute's thesis, verbatim from company materials: *"Extra-terrestrial
exploration is the next frontier of human progress. We build the reusable,
interoperable robotics needed to sustainably unlock the Moon's vast mineral,
fuel, and scientific potential."* Vision: *"To be the biggest off-earth
robotics company."*

The site's **Mission** section (`src/mission.js`) plays a full LEAP campaign
beat for beat, based on the company's own concept-of-operations diagram:
integration & launch → landing → E1O1 (leaving the lander footprint) → first
mission (EPOC carries a payload alone into difficult terrain while OASys
waits at a safe distance) → end of first mission (swap to the next payload) →
next missions (repeat) → Trailer Heaven (OASys parked once the manifest is
served) → E1O2 (EPOC departs for the next landing site and the next OASys).

## Design concept

Visually in the spirit of dark, high-contrast, manifesto-style sites (e.g.
armory.in) — big type, sparse copy, one big idea per screen — but built around
a live 3D backdrop instead of static imagery or video:

| Section (scroll order)     | Lighting state                                    |
| --------------------------- | -------------------------------------------------- |
| Hero                        | Lunar day, sun at ~42°                              |
| The Problem                 | Sunset — long shadows, falling temperature          |
| The Thesis                  | Nightfall, −180 °C, stars at full brightness        |
| The Stack (pinned showcase) | Deep night — the hardware glows in the dark         |
| The Cycle ("sun rises")     | Sunrise — segue into the mission                    |
| The Mission (pinned, ~8.5 viewports) | Full daylight — the entire LEAP campaign plays out with real-time shadows |
| Capabilities                | Full day                                            |
| Manifesto / CTA             | Full day                                            |

The lighting is the argument: everything else historically died at lunar
sunset; CosmoChute hardware is what's still operating when the sun comes back.

## Tech stack

- **[Vite](https://vitejs.dev/)** — dev server & build tool. No UI framework;
  plain ES modules.
- **[Three.js](https://threejs.org/)** (`three`) — WebGL scene: procedural
  terrain, all hardware models, lighting, shadows, sky.
- **[GSAP](https://gsap.com/)** (`gsap`) + **ScrollTrigger** +
  **ScrollToPlugin** — scroll-scrubbed timelines, pinned sections, camera
  choreography, text reveals, smooth anchor navigation.
- **Fonts**: Space Grotesk (display type) + Chakra Petch (HUD/telemetry type),
  loaded from Google Fonts.
- **Python** (`numpy` + `pillow`), offline only — bakes the PBR texture set.
  Not a runtime dependency; the site itself ships static JPGs.
- Deploys as a fully static site (`dist/`) — no server-side runtime required.

## Project structure

```
cosmochute-website/
├── index.html              # all page markup/sections; single entry point
├── vite.config.js          # dev/build config (see gotchas below)
├── package.json
├── src/
│   ├── main.js             # orchestration: boot sequence, ScrollTrigger
│   │                       #   wiring, day–night phase driver, HUD
│   ├── scene.js             # Three.js world: terrain, lighting, sky,
│   │                       #   Earth, orbiter, camera/render loop
│   ├── models.js            # procedural hardware: EPOC, OASys, Cartridge,
│   │                       #   Lander, Orbiter, electronics greebles
│   ├── mission.js           # the pinned end-to-end LEAP mission timeline
│   ├── textures.js          # central texture loader
│   └── styles.css           # all site styling
├── public/
│   └── textures/            # baked PBR maps + real Earth/Milky Way imagery
│                            #   (served as-is, not processed by Vite)
├── tools/
│   ├── bake_textures.py     # regenerates public/textures/*.jpg
│   └── requirements.txt     # Python deps for the texture tool
└── dist/                    # production build output (git-ignored)
```

## Prerequisites

- **Node.js 18+** (developed/tested on Node 22) and npm
- **Python 3.9+** — only needed if you want to *regenerate* textures; not
  required to run or build the site, since the baked images are committed
- A modern browser with WebGL2 support to view the site

## Local development setup

```bash
git clone https://github.com/Cosmochute/Website_2.0.git
cd Website_2.0
npm install
npm run dev
```

The dev server runs at **http://localhost:5188** (fixed port, see
`package.json`).

Available scripts:

| Command           | Purpose                                                  |
| ------------------ | --------------------------------------------------------- |
| `npm run dev`       | Start the Vite dev server with HMR on port 5188            |
| `npm run build`     | Production build to `dist/`                                |
| `npm run preview`   | Serve the production build locally on port 5189 for a final check |

> **Windows note:** if your username/home path contains a space (e.g.
> `C:\Users\Jane Doe\...`) and you launch the dev server through a tool that
> resolves the working directory to its 8.3 short path (`JANEDO~1`), Vite's
> module transform can break. `vite.config.js` already works around this by
> resolving its own real path via `realpathSync` — you shouldn't need to do
> anything, but if you ever see raw/untransformed JS served from `/src/*`,
> that's the symptom to look for.

## Regenerating textures

All PBR maps in `public/textures/` (regolith, rock, MLI gold foil, brushed
aluminium, spacecraft paint, solar cells — albedo + normal where applicable)
are baked offline from FFT-periodic spectral noise, so they tile perfectly
with no visible seams. To regenerate them (e.g. to change the look of the
lunar surface or the hardware finish):

```bash
cd tools
pip install -r requirements.txt
cd ..
python tools/bake_textures.py
```

This overwrites the relevant files in `public/textures/`. The two
photographic textures — `earth_daymap.jpg` and `stars_milky_way.jpg` — are
**not** generated by this script; they're real imagery (see
[Asset credits](#asset-credits--licensing)) and should be replaced by hand if
ever swapped.

## Building for production

```bash
npm run build
npm run preview   # optional: sanity-check the built output locally
```

Output is a fully static `dist/` folder — HTML, one bundled JS file, one CSS
file, and `textures/` — deployable to any static host (Vercel, Netlify,
Cloudflare Pages, S3+CloudFront, GitHub Pages, etc.) with **no server-side
runtime, environment variables, or database** required.

Current build footprint is roughly: ~660 KB JS (~190 KB gzipped), ~14 KB CSS,
~5 MB of texture assets. The texture payload is the main cost of the
photoreal look; see [Regenerating textures](#regenerating-textures) if that
needs to shrink.

## Deployment

### Vercel (recommended — used for the reference deployment)

**Option A — Git integration (recommended for this repo):**
1. In the Vercel dashboard, "Add New Project" → import
   `Cosmochute/Website_2.0`.
2. Framework preset: **Vite**. Build command `npm run build`, output
   directory `dist` (Vercel auto-detects both from `package.json` /
   `vite.config.js` — no changes needed).
3. Every push to the default branch (`main`) auto-deploys to production;
   every PR gets a preview deployment.

**Option B — Vercel CLI (manual/one-off deploys):**
```bash
npm install -g vercel
vercel login
vercel --prod
```

### Any other static host

```bash
npm run build
# upload the contents of dist/ as-is
```
No rewrites/redirects are required — this is a single HTML page with no
client-side routing.

## Content & copy sources

Copy on the site (mission statement, LEAP system descriptions, specs, the
mission playback beats) is sourced from CosmoChute's own materials —
primarily the **LEAP User Payload Guide / product datasheet**. If specs or
messaging change upstream, the sections to update are:

- `index.html` — all visible copy, stats, and spec strips
- `src/mission.js` — the eight mission-stage titles/descriptions live in
  `index.html` under `#mission .m-stage`; the *choreography* (camera moves,
  vehicle paths, timing) lives in `src/mission.js`

## Architecture notes

- **`src/scene.js`** owns the Three.js world: procedural terrain (with a
  single `terrainHeight(x, z)` function used both for the displaced geometry
  *and* to place every vehicle/path — one source of truth), sun/shadow setup,
  starfield, Earth, the sky dome, and the render/camera loop. It exposes
  `applyPhase(progress)` to drive the whole day–night cycle from a single
  0–1 scroll value, and `SITES` — the named mission locations (lander pad,
  basecamp, deploy zones, Trailer Heaven).
- **`src/models.js`** builds every piece of hardware procedurally out of
  primitives (no external 3D model files) — this keeps the repo small and
  the hardware trivially re-textured/re-proportioned by editing code, and
  includes a seeded "greeble" generator that scatters capacitors, connectors,
  wire runs, and heatsinks over the vehicles for surface detail.
- **`src/mission.js`** is one big scrubbed GSAP timeline: vehicles follow
  arc-length-parameterised Catmull-Rom curves sampled against
  `terrainHeight()`, wheel tracks reveal via geometry `drawRange`, and
  payload cartridges are "glued" per-frame to whichever anchor they currently
  belong to (a magazine slot, the robotic arm's gripper, or EPOC's belly
  chamber) so the pick-and-place animation is physically continuous rather
  than a fake parallel tween.
- **`src/main.js`** is the glue: boot sequence, all `ScrollTrigger` wiring
  (in strict document order — see gotchas), the pinned-section timelines, and
  a plain-`scroll`-event-driven day–night phase calculation that stays
  correct even if ScrollTrigger's own measurements go stale.

## Known gotchas / hard-won lessons

If you're modifying the scroll choreography, read this first:

- **`gsap.set()` / `gsap.fromTo()` inside a scrubbed timeline default to
  `immediateRender: true`.** Without `immediateRender: false`, build-time
  state leaks into the very first paint — before the timeline has ever been
  scrubbed — e.g. a lander floating mid-air on page load, or cartridges
  showing as "spent" before launch. Every timeline `set`/`fromTo` in this
  project passes `immediateRender: false` explicitly.
- **Never give a pin a `%`-based `end`** (e.g. `end: '+=850%'`). On
  `ScrollTrigger.refresh()` the percentage re-measures against the pin's own
  spacer and compounds without bound — we once produced a 320,000 px-tall
  page this way. Always use a function returning a **pixel** value:
  `end: () => '+=' + window.innerHeight * 8.5`.
- **ScrollTrigger triggers must be *created* in document order.** Triggers
  refresh in creation order, and a pinned section's spacer shifts the
  measured position of every section below it. If a section is moved in the
  HTML, its trigger-creation call in `main.js` must move with it, or
  everything after it will be measured against a stale (spacerless) layout
  and fire early.
- The global day–night phase is **not** read from ScrollTrigger progress —
  it's computed directly from a plain `scroll` listener
  (`scrollY / (scrollHeight − innerHeight)`), which is immune to any
  ScrollTrigger measurement staleness.
- **No CSS `scroll-behavior: smooth`** anywhere — it corrupts ScrollTrigger's
  scroll measurements. Anchor-link smooth scrolling is done explicitly via
  GSAP's `ScrollToPlugin`.
- `vite.config.js` resolves its `root` via `realpathSync(fileURLToPath(...))`
  rather than a hardcoded path — this keeps local dev working if launched via
  a Windows short path *and* keeps CI/hosted builds (which have no such
  path[es]) working identically. Don't replace this with a hardcoded absolute
  path; it will break portability.
- Any object meant to render at extreme distance (sun disc, Earth, starfield,
  the sky dome) needs `fog: false` on its material, or the scene's `FogExp2`
  will swallow it.
- Reduced-motion users (`prefers-reduced-motion: reduce`) get all content
  immediately visible with no animation. No-JS users get a fully visible,
  static (non-3D) page — every "hidden until animated" state is scoped
  behind a `body.js` class added by `main.js`, so nothing is invisible by
  default.

## Performance

- Real-time shadow mapping is enabled (`PCFSoftShadowMap`) with a single
  directional light (the sun) — this is the single biggest GPU cost in the
  scene; if targeting lower-end devices, consider reducing
  `sun.shadow.mapSize` in `scene.js`.
- Pixel ratio is capped at `1.75` (`renderer.setPixelRatio`) to bound cost on
  high-DPI displays.
- Textures total ~5 MB; they're static JPGs served directly (no runtime
  processing), so this is a one-time network cost, not a rendering cost.

## Accessibility

- Respects `prefers-reduced-motion`: disables scroll-triggered reveals, the
  boot sequence animation, and smooth-scroll easing.
- Falls back to a fully static, fully visible page if WebGL is unavailable or
  JavaScript fails to load (see `main.js`'s try/catch around scene creation).

## Browser support

Requires WebGL2 for the 3D experience (all evergreen desktop and mobile
browsers from the last several years). No IE11 support. The no-WebGL fallback
degrades to a static page rather than a broken one.

## Asset credits & licensing

- `public/textures/earth_daymap.jpg` and `public/textures/stars_milky_way.jpg`
  are from the [Solar System Scope texture library](https://www.solarsystemscope.com/textures/),
  licensed **CC BY 4.0** — attribution is included in the site footer. Do not
  remove that credit if these files remain in use.
- All other textures in `public/textures/` are procedurally generated by
  `tools/bake_textures.py` and are original to this project.
- All 3D hardware models are built from primitives in `src/models.js` —
  original to this project, not licensed assets.
- This repository is licensed under the terms in [`LICENSE`](./LICENSE)
  (Apache 2.0).

## Contributing

This is a shared repository between CosmoChute and web developers working on
the site. When contributing:

- Keep changes to the scroll/animation system consistent with the
  [gotchas](#known-gotchas--hard-won-lessons) above — most regressions in
  this codebase come from timeline `immediateRender` defaults or trigger
  creation order.
- If you change hardware specs, mission steps, or company messaging, update
  `index.html` copy to match the source-of-truth company materials (see
  [Content & copy sources](#content--copy-sources)).
- Run `npm run build` locally before opening a PR to make sure the production
  bundle still compiles clean.
