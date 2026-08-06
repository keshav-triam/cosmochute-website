// ============================================================
// Orchestration: boot sequence, scroll-driven day–night cycle,
// camera choreography, text reveals, HUD telemetry.
//
// NOTE ON ORDER: ScrollTrigger refreshes triggers in creation
// order, and pin spacers shift everything below them — so the
// stack pin MUST be created before any trigger for content that
// sits after #stack in the document.
// ============================================================
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { createWorld } from './scene.js';

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
  'EARTH DOWNLINK… LOCKED',
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
// safety: if load hangs (slow fonts), boot anyway
setTimeout(runBoot, 2200);

// ============================================================
// TRIGGER CREATION — strictly in document order
// ============================================================
const poses = {
  hero:        { x: 0,    y: 2.4, z: 11.0, tx: 0,    ty: 1.0,  tz: 0 },
  problem:     { x: -5.5, y: 1.7, z: 8.6,  tx: -0.5, ty: 0.8,  tz: 0 },
  thesis:      { x: 2.5,  y: 3.8, z: 12.5, tx: 0,    ty: 1.6,  tz: -6 },
  epoc:        { x: 2.7,  y: 1.5, z: 3.6,  tx: 0,    ty: 0.9,  tz: 0 },
  oasys:       { x: -1.0, y: 1.5, z: 4.6,  tx: -3.4, ty: 0.8,  tz: 0.9 },
  cartridge:   { x: 4.9,  y: 1.3, z: 1.4,  tx: 3.1,  ty: 0.85, tz: -1.4 },
  capabilities:{ x: 0,    y: 2.8, z: 9.5,  tx: 0,    ty: 1.0,  tz: 0 },
  cycle:       { x: -3.5, y: 2.0, z: 9.5,  tx: 1.5,  ty: 1.2,  tz: -3 },
  manifesto:   { x: 0,    y: 2.5, z: 11.5, tx: 0,    ty: 1.1,  tz: 0 },
};

const cs = world ? world.camState : {};
if (world) Object.assign(cs, poses.hero);

function camTween(sectionSel, pose) {
  if (!world) return;
  gsap.to(cs, {
    ...pose, ease: 'none', immediateRender: false,
    scrollTrigger: { trigger: sectionSel, start: 'top bottom', end: 'top top', scrub: 0.6 },
  });
}

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

// --- 2. PROBLEM ---
camTween('#problem', poses.problem);
revealsIn('#problem');

// --- 3. THESIS ---
camTween('#thesis', poses.thesis);
revealsIn('#thesis');

// --- 4. STACK: approach + pinned 3-system showcase ---
camTween('#stack', poses.epoc);

const panels = gsap.utils.toArray('.stack-panel');
const stps = gsap.utils.toArray('.stp');
gsap.set(panels[0], { opacity: 1, visibility: 'visible' });

const stackTl = gsap.timeline({
  scrollTrigger: {
    trigger: '#stack-pin',
    start: 'top top',
    end: '+=300%',
    pin: true,
    scrub: 0.6,
    onUpdate: (self) => {
      const i = Math.min(2, Math.floor(self.progress * 3));
      stps.forEach((s, k) => s.classList.toggle('active', k === i));
    },
  },
});

stackTl
  // hold EPOC
  .to({}, { duration: 0.6 })
  // EPOC → OASYS
  .to(panels[0], { opacity: 0, y: -24, duration: 0.25 })
  .set(panels[0], { visibility: 'hidden' })
  .set(panels[1], { visibility: 'visible', y: 24 })
  .to(panels[1], { opacity: 1, y: 0, duration: 0.3 }, '-=0.05')
  .to({}, { duration: 0.6 })
  // OASYS → CARTRIDGE
  .to(panels[1], { opacity: 0, y: -24, duration: 0.25 })
  .set(panels[1], { visibility: 'hidden' })
  .set(panels[2], { visibility: 'visible', y: 24 })
  .to(panels[2], { opacity: 1, y: 0, duration: 0.3 }, '-=0.05')
  .to({}, { duration: 0.7 });

if (world) {
  // camera moves inside the pin, aligned with the panel swaps
  stackTl.to(cs, { ...poses.oasys, duration: 0.55, ease: 'power1.inOut' }, 0.6);
  stackTl.to(cs, { ...poses.cartridge, duration: 0.55, ease: 'power1.inOut' }, 2.05);
}

// --- 5. CAPABILITIES ---
camTween('#capabilities', poses.capabilities);
revealsIn('#capabilities');

// --- 6. CYCLE ---
camTween('#cycle', poses.cycle);
revealsIn('#cycle');
gsap.set('#cycle-steps span, #cycle-steps i', { opacity: 0, y: 14 });
gsap.to('#cycle-steps span, #cycle-steps i', {
  opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out',
  scrollTrigger: { trigger: '#cycle-steps', start: 'top 85%' },
});

// --- 7. MANIFESTO ---
camTween('#manifesto', poses.manifesto);
revealsIn('#manifesto');

// ============================================================
// GLOBAL PHASE DRIVER — plain scroll listener, immune to
// ScrollTrigger measurement staleness
// ============================================================
const railFill = document.getElementById('rail-fill');
const railDot = document.getElementById('rail-dot');
const railLabels = document.querySelectorAll('#phase-rail .rail-labels span');
const tlPhase = document.getElementById('tl-phase');
const tlTemp = document.getElementById('tl-temp');
const tlSun = document.getElementById('tl-sun');

function phaseName(p) {
  if (p < 0.18) return ['LUNAR DAY', 'day'];
  if (p < 0.33) return ['SUNSET', 'dusk'];
  if (p < 0.74) return ['LUNAR NIGHT', 'night'];
  if (p < 0.91) return ['DAWN', 'dawn'];
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
  const temp = Math.round(-180 + daylight * 286); // −180 → +106
  tlTemp.textContent = `SURFACE ${temp > 0 ? '+' : ''}${temp}°C`;
  tlSun.textContent = el >= 0 ? `SUN EL ${Math.round(el)}°` : `SUN −${Math.abs(Math.round(el))}° BELOW HORIZON`;
}
window.addEventListener('scroll', updatePhase, { passive: true });
window.addEventListener('resize', updatePhase);
updatePhase();
if (import.meta.env.DEV) window.__updatePhase = updatePhase;

// re-measure once everything (fonts, layout) settles
window.addEventListener('load', () => ScrollTrigger.refresh());
