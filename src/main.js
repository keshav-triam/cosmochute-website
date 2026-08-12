// ============================================================
// Orchestration: boot sequence, scroll-driven day–night cycle,
// camera choreography, the end-to-end mission, text reveals,
// HUD telemetry.
//
// NOTE ON ORDER: ScrollTrigger refreshes triggers in creation
// order, and pin spacers shift everything below them — so the
// stack pin and mission pin MUST be created before any trigger
// for content that sits after them in the document.
// ============================================================
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { createWorld } from './scene.js';
import { buildMission, T as MT, STAGE_STARTS } from './mission.js';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

document.body.classList.add('js');

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------- WebGL world (with graceful fallback) ----------------
let world = null;
try {
  world = createWorld(document.getElementById('scene'));
} catch (err) {
  console.warn('WebGL unavailable — falling back to static backdrop.', err);
  document.getElementById('scene').style.display = 'none';
  document.body.style.background =
    'radial-gradient(ellipse at 50% 120%, #1a1712 0%, #05060a 55%)';
}

if (world) gsap.ticker.add(() => world.render());
if (import.meta.env.DEV) {
  window.__world = world; // debug handles, dev server only
  window.__gsap = gsap;
  window.__ST = ScrollTrigger;
}

// ---------------- text splitting helpers ----------------
document.querySelectorAll('.reveal-lines span').forEach((line) => {
  const inner = document.createElement('span');
  inner.className = 'rl-inner';
  inner.innerHTML = line.innerHTML;
  line.innerHTML = '';
  line.appendChild(inner);
  if (!reduceMotion) gsap.set(inner, { yPercent: 115 });
});
document.querySelectorAll('.ht-line').forEach((line) => {
  const inner = document.createElement('span');
  inner.className = 'ht-inner';
  inner.innerHTML = line.innerHTML;
  line.innerHTML = '';
  line.appendChild(inner);
  if (!reduceMotion) gsap.set(inner, { yPercent: 115 });
});

// ---------------- smooth anchor scrolling ----------------
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    gsap.to(window, { scrollTo: { y: target, autoKill: true }, duration: 1.1, ease: 'power2.inOut' });
  });
});

// ---------------- boot sequence ----------------
const bootEl = document.getElementById('boot');
const bootFill = document.getElementById('boot-fill');
const bootLine = document.getElementById('boot-line');
const bootMsgs = [
  'INITIALIZING LUNAR SYSTEMS…',
  'THERMAL CORE… NOMINAL',
  'NAV STACK… NOMINAL',
  'RELAY ORBITER… LOCKED',
];

let bootStarted = false;
function runBoot() {
  if (bootStarted) return;
  bootStarted = true;
  if (reduceMotion) {
    bootEl.classList.add('done');
    startHero(true);
    return;
  }
  const tl = gsap.timeline({
    onComplete: () => {
      bootEl.classList.add('done');
      startHero(false);
    },
  });
  bootMsgs.forEach((msg, i) => {
    tl.call(() => {
      bootLine.textContent = msg;
      bootFill.style.width = `${((i + 1) / bootMsgs.length) * 100}%`;
    }, null, i * 0.34);
  });
  tl.to({}, { duration: bootMsgs.length * 0.34 + 0.25 });
}

function startHero(instant) {
  const ticks = gsap.utils.toArray('#hero-ticks .tick');
  const heroReveals = gsap.utils.toArray('#hero .reveal');
  if (instant) {
    gsap.set(ticks, { opacity: 1, x: 0 });
    gsap.set('#hero .ht-inner', { yPercent: 0 });
    gsap.set(heroReveals, { opacity: 1, y: 0 });
    return;
  }
  const tl = gsap.timeline();
  tl.to('#hero .hero-eyebrow', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' })
    .to(ticks, { opacity: 1, x: 0, duration: 0.45, stagger: 0.28, ease: 'power2.out' }, 0.15)
    .to('#hero .ht-inner', { yPercent: 0, duration: 0.9, stagger: 0.12, ease: 'power4.out' }, '-=0.3')
    .to('#hero .hero-sub', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.4')
    .to('#hero .hero-ctas', { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, '-=0.4');
}

window.addEventListener('load', runBoot);
setTimeout(runBoot, 2200);

// ============================================================
// TRIGGER CREATION — strictly in document order
// ============================================================
const poses = {
  hero:        { x: 0,    y: 2.4, z: 11.0, tx: 0,    ty: 1.0,  tz: 0 },
  problem:     { x: -5.5, y: 1.7, z: 8.6,  tx: -0.5, ty: 0.8,  tz: 0 },
  thesis:      { x: 2.5,  y: 3.8, z: 12.5, tx: 0,    ty: 1.6,  tz: -6 },
  cycle:       { x: -3.5, y: 2.0, z: 9.5,  tx: 1.5,  ty: 1.2,  tz: -3 },
  // last pre-mission leg: the gaze starts lifting toward the dawn sky,
  // pre-motivating the mission's pan up to Earth
  presky:      { x: -2.8, y: 2.15, z: 10.2, tx: 1.2, ty: 5,    tz: -3.5 },
  // the journey home from Trailer Heaven: pull back and rise with the
  // gaze still on the departing rover, then a long drift that turns
  // homeward across the worked field, then a low settle by the lander
  capabilities:{ x: 15.5, y: 5.2, z: 13,   tx: 28,   ty: 0.4,  tz: -3 },
  fieldDrift:  { x: 7.5,  y: 3.6, z: 12.8, tx: 0,    ty: 0.7,  tz: -0.5 },
  manifesto:   { x: 3,    y: 2.8, z: 11.5, tx: -1,   ty: 0.9,  tz: -1.5 },
};

const cs = world ? world.camState : {};
if (world) Object.assign(cs, poses.hero);

// One continuous scrubbed flight across several sections — each leg's
// scroll length equals the real layout distance it covers, so poses
// arrive exactly as their section tops reach the viewport top, but the
// camera NEVER freezes between sections and no move is squeezed into a
// single viewport (per-section tweens produced a fly-freeze-fly rhythm
// that read as random pans and cuts)
function camJourney(triggerOpts, legs) {
  if (!world) return null;
  const tl = gsap.timeline({ scrollTrigger: { scrub: 0.6, ...triggerOpts } });
  let at = 0;
  for (const leg of legs) {
    tl.to(cs, { ...leg.pose, duration: leg.px, ease: 'power1.inOut' }, at);
    at += leg.px;
  }
  return tl;
}
const topOf = (sel) => document.querySelector(sel).offsetTop;

function revealsIn(scopeSel) {
  gsap.utils.toArray(`${scopeSel} .reveal`).forEach((el) => {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 0.8, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });
  gsap.utils.toArray(`${scopeSel} .reveal-lines`).forEach((block) => {
    gsap.to(block.querySelectorAll('.rl-inner'), {
      yPercent: 0, duration: 0.9, stagger: 0.1, ease: 'power4.out',
      scrollTrigger: { trigger: block, start: 'top 82%' },
    });
  });
  gsap.utils.toArray(`${scopeSel} [data-count]`).forEach((el) => {
    const target = parseInt(el.dataset.count, 10);
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target, duration: 1.6, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%' },
      onUpdate: () => { el.textContent = Math.round(obj.v); },
    });
  });
}

// --- 2-4. PROBLEM / THESIS / CYCLE: one unbroken camera journey from
// the hero all the way to the mission pin ---
const journeyA = camJourney(
  { trigger: '#hero', start: 'top top', endTrigger: '#mission-pin', end: 'top top' },
  [
    { pose: poses.problem, px: topOf('#problem') },
    { pose: poses.thesis, px: topOf('#thesis') - topOf('#problem') },
    { pose: poses.cycle, px: topOf('#cycle') - topOf('#thesis') },
    { pose: poses.presky, px: topOf('#mission') - topOf('#cycle') },
  ],
);
revealsIn('#problem');
revealsIn('#thesis');
revealsIn('#cycle');

// --- 6. THE MISSION: pinned end-to-end campaign ---
const missionTicks = gsap.utils.toArray('#mission-rail .mt');
const missionTel = document.getElementById('mission-tel');
const STAGE_TAGS = [
  'E1O1 // INTEGRATION', 'E1O1 // LANDING', 'E1O1 // EGRESS',
  'E1O1 // PAYLOAD 01', 'E1O1 // SWAP', 'E1O1 // PAYLOADS 02–08',
  'E1O1 // TRAILER HEAVEN', 'E1O2 // OUTBOUND',
];

let missionST = null;
let journeyB = null;
if (world) {
  // HANDOFF DISCIPLINE at the pin edges: with scrub smoothing, an
  // outgoing scrubbed timeline keeps easing (and writing the camera)
  // for up to ~0.6s after the scroll has moved on — and the moment the
  // incoming system's tween coverage has a gap, that late tail wins and
  // SNAPS the camera back (speed-dependent, reads as a random cut).
  // Each edge crossing therefore jumps the OUTGOING writer's playhead
  // straight to the endpoint its scrub was already heading to.
  const missionTl = gsap.timeline({
    scrollTrigger: {
      trigger: '#mission-pin',
      start: 'top top',
      // function-based pixel end — see stack pin note
      end: () => `+=${Math.round(window.innerHeight * 10)}`,
      pin: true,
      scrub: 0.6,
      // "finish your ease NOW": progress(1) on the ST's internal scrub
      // tween jumps it to the endpoint it was already heading to.
      // (Calling progress() on the TIMELINE instead is wrong — the live
      // scrub tween keeps playing and rewinds the timeline mid-ease.)
      // All four edges: the OUTGOING writer's scrub is collapsed the
      // moment the edge is crossed. Letting it ease out naturally seems
      // gentler but is worse: it keeps overwriting the camera long past
      // the edge, then hands back with an unbounded mismatch (huge at
      // fast scroll). The collapse costs at most one bounded step at
      // the crossing itself, buried in the scroll motion.
      onEnter: () => { journeyA?.scrollTrigger.getTween()?.progress(1); },
      onLeaveBack: () => { missionTl.scrollTrigger.getTween()?.progress(1); },
      onLeave: () => { missionTl.scrollTrigger.getTween()?.progress(1); },
      onEnterBack: () => { journeyB?.scrollTrigger.getTween()?.progress(1); },
      onUpdate: (self) => {
        const t = self.progress * MT.end;
        let idx = 0;
        for (let i = 0; i < STAGE_STARTS.length; i++) if (t >= STAGE_STARTS[i]) idx = i;
        missionTicks.forEach((s, k) => s.classList.toggle('active', k === idx));
        if (missionTel) missionTel.textContent = STAGE_TAGS[idx];
      },
    },
  });
  buildMission(world, gsap, missionTl);
  missionST = missionTl.scrollTrigger;
} else {
  // no WebGL: let the stage cards read as a plain vertical list
  document.getElementById('mission').classList.add('no-webgl');
}

// --- 7-8. CAPABILITIES / MANIFESTO: the unbroken journey home, picking
// up the camera exactly where the mission pin releases it ---
journeyB = camJourney(
  { trigger: '#capabilities', start: 'top bottom', endTrigger: '#manifesto', end: 'top top' },
  [
    { pose: poses.capabilities, px: window.innerHeight },
    { pose: poses.fieldDrift, px: topOf('#manifesto') - topOf('#capabilities') - window.innerHeight },
    { pose: poses.manifesto, px: window.innerHeight },
  ],
);
revealsIn('#capabilities');
revealsIn('#manifesto');

// ============================================================
// GLOBAL PHASE DRIVER — plain scroll listener + phase keyframes
// derived from the real section layout, so the story beats land:
// sunset in THE PROBLEM, night across THE STACK, sunrise at THE
// CYCLE, full daylight for the whole MISSION.
// ============================================================
const railFill = document.getElementById('rail-fill');
const railDot = document.getElementById('rail-dot');
const railLabels = document.querySelectorAll('#phase-rail .rail-labels span');
const tlPhase = document.getElementById('tl-phase');
const tlTemp = document.getElementById('tl-temp');
const tlSun = document.getElementById('tl-sun');

let bands = { duskFrom: 0.1, nightFrom: 0.2, dawnFrom: 0.42, dayFrom: 0.52 };

function recomputePhaseKeys() {
  if (!world) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return;
  const fr = (px) => Math.min(1, Math.max(0, px / max));
  const top = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.getBoundingClientRect().top + window.scrollY : 0;
  };
  const problemTop = fr(top('#problem'));
  const thesisTop = fr(top('#thesis'));
  const cycleTop = fr(top('#cycle'));
  const missionStart = fr(missionST ? missionST.start : top('#mission'));
  const cycleMid = (cycleTop + missionStart) / 2;
  world.setPhaseKeys([
    [0, 42],
    [problemTop * 0.9, 30],
    [(problemTop + thesisTop) / 2, 10],
    [thesisTop, 2],
    [thesisTop + (cycleTop - thesisTop) * 0.55, -14],
    [cycleTop, -13],
    [cycleMid, -5],
    [missionStart, 12],
    [Math.min(1, missionStart + 0.07), 34],
    [1, 52],
  ]);
  bands = {
    duskFrom: (problemTop + thesisTop) / 2,
    nightFrom: thesisTop + (cycleTop - thesisTop) * 0.55,
    dawnFrom: cycleMid,
    dayFrom: missionStart + 0.01,
  };
  updatePhase();
}

function phaseName(p) {
  if (p < bands.duskFrom) return ['LUNAR DAY', 'day'];
  if (p < bands.nightFrom) return ['SUNSET', 'dusk'];
  if (p < bands.dawnFrom) return ['LUNAR NIGHT', 'night'];
  if (p < bands.dayFrom) return ['DAWN', 'dawn'];
  return ['LUNAR DAY', 'day'];
}

function updatePhase() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, max)));
  let el = 0, daylight = 1;
  if (world) {
    const r = world.applyPhase(p);
    el = r.el; daylight = r.daylight;
  }
  const pct = p * 100;
  railFill.style.height = `${pct}%`;
  railDot.style.top = `${pct}%`;
  const [name, key] = phaseName(p);
  railLabels.forEach((s) => s.classList.toggle('active', s.dataset.phase === key));
  tlPhase.textContent = name;
  const temp = Math.round(-180 + daylight * 286);
  tlTemp.textContent = `SURFACE ${temp > 0 ? '+' : ''}${temp}°C`;
  tlSun.textContent = el >= 0 ? `SUN EL ${Math.round(el)}°` : `SUN −${Math.abs(Math.round(el))}° BELOW HORIZON`;
}
window.addEventListener('scroll', updatePhase, { passive: true });
window.addEventListener('resize', updatePhase);
updatePhase();
if (import.meta.env.DEV) window.__updatePhase = updatePhase;

ScrollTrigger.addEventListener('refresh', recomputePhaseKeys);
recomputePhaseKeys();

// re-measure once everything (fonts, layout) settles
window.addEventListener('load', () => ScrollTrigger.refresh());
