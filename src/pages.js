// ============================================================
// Shared engine for the company pages (careers / about / news /
// partners): the design-version picker, scroll reveals, and the
// Three.js hero scene. Each page declares its subject and its
// three design variants; visitors compare them live and the
// choice is remembered per page (and shareable via ?v=).
// ============================================================
import './styles.css';
import './pages.css';
import { initPageFX } from './pagefx.js';

const body = document.body;
const PAGE = body.dataset.page || 'page';
const STORE_KEY = `cc-version-${PAGE}`;

// ---------------- version metadata (embedded per page) ----------------
let META = [];
try {
  META = JSON.parse(document.getElementById('version-meta')?.textContent || '[]');
} catch (e) { META = []; }

// ---------------- three.js hero ----------------
let fx = null;
const canvas = document.getElementById('pagefx');
if (canvas && body.dataset.fx) {
  try { fx = initPageFX(canvas, body.dataset.fx); } catch (e) {
    console.warn('pagefx unavailable', e);
    canvas.style.display = 'none';
  }
}

// ---------------- version switching ----------------
function currentDefault() {
  const url = new URL(window.location.href);
  const q = parseInt(url.searchParams.get('v'), 10);
  if (q >= 1 && q <= 3) return q;
  const stored = parseInt(localStorage.getItem(STORE_KEY), 10);
  if (stored >= 1 && stored <= 3) return stored;
  return 1;
}

function setVersion(v, push = true) {
  body.dataset.v = String(v);
  localStorage.setItem(STORE_KEY, String(v));
  if (push) {
    const url = new URL(window.location.href);
    url.searchParams.set('v', String(v));
    history.replaceState(null, '', url);
  }
  document.querySelectorAll('.vp-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.v === String(v));
  });
  document.querySelectorAll('.vp-card').forEach((c) => {
    c.classList.toggle('active', c.dataset.v === String(v));
  });
  if (fx) fx.setMood(v);
  // re-run reveals for the newly shown version
  requestAnimationFrame(() => observeReveals());
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

// ---------------- picker UI (markup built from META) ----------------
function buildPicker() {
  const host = document.createElement('div');
  host.id = 'vpicker';
  host.innerHTML = `
    <div class="vp-panel" id="vp-panel" hidden>
      <div class="vp-panel-head">
        <span class="vp-tag">DESIGN REVIEW</span>
        <span class="vp-title">Three directions — pick the one that feels right</span>
      </div>
      <div class="vp-cards">
        ${META.map((m, i) => `
          <button class="vp-card" data-v="${i + 1}">
            <span class="vp-card-num">V${i + 1}</span>
            <span class="vp-card-name">${m.name}</span>
            <span class="vp-card-desc">${m.desc}</span>
            <span class="vp-card-best">BEST FOR — ${m.best}</span>
          </button>`).join('')}
      </div>
    </div>
    <div class="vp-bar">
      <span class="vp-label">VERSION</span>
      ${META.map((m, i) => `<button class="vp-btn" data-v="${i + 1}" title="${m.name}">V${i + 1}</button>`).join('')}
      <button class="vp-info" id="vp-info" aria-expanded="false">DETAILS</button>
    </div>`;
  document.body.appendChild(host);
  host.querySelectorAll('.vp-btn, .vp-card').forEach((b) => {
    b.addEventListener('click', () => setVersion(parseInt(b.dataset.v, 10)));
  });
  const panel = host.querySelector('#vp-panel');
  const info = host.querySelector('#vp-info');
  info.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    info.setAttribute('aria-expanded', String(open));
    info.classList.toggle('open', open);
  });
}

// ---------------- scroll reveals ----------------
let io = null;
function observeReveals() {
  if (io) io.disconnect();
  io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }
  }, { threshold: 0.12 });
  document.querySelectorAll(`.pv[data-v="${body.dataset.v}"] .rv`).forEach((el) => {
    if (!el.classList.contains('in')) io.observe(el);
  });
}

// ---------------- HUD chrome (serials, rails, telemetry, hero lines) ----------------
const PAGE_CODES = { careers: 'CRW', about: 'DOS', news: 'TLM', partners: 'MFT' };
function decorateChrome() {
  // module serials + hover sweep layer on every instrument pane
  document.querySelectorAll('.pane').forEach((p, i) => {
    const tag = document.createElement('span');
    tag.className = 'pane-tag';
    tag.textContent = `${PAGE_CODES[PAGE] || 'MOD'}-${String(i + 1).padStart(2, '0')}`;
    p.appendChild(tag);
    const sweep = document.createElement('span');
    sweep.className = 'pane-sweep';
    p.appendChild(sweep);
  });
  // vertical side rails
  const rails = document.createElement('div');
  rails.innerHTML = `
    <div class="hrail hrail-l"><span>${PAGE.toUpperCase()} // COSMOCHUTE LEAP</span></div>
    <div class="hrail hrail-r"><span>REGOLITH NOMINAL · LINK 98.6%</span></div>`;
  while (rails.firstElementChild) body.appendChild(rails.firstElementChild);
  // live telemetry strip (reuses the homepage #telemetry styling)
  const tl = document.createElement('div');
  tl.id = 'telemetry';
  tl.innerHTML = `
    <span><span class="tl-dot"></span>CHANNEL ${(PAGE_CODES[PAGE] || PAGE).toUpperCase()}</span>
    <span id="tl-rev">DESIGN REV —</span>
    <span id="tl-clock">—</span>`;
  body.appendChild(tl);
  const clockEl = tl.querySelector('#tl-clock');
  const tick = () => {
    const d = new Date();
    clockEl.textContent = `UTC ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
  };
  tick();
  setInterval(tick, 1000);
  // hero HUD status line inside every version's hero
  document.querySelectorAll('.page-hero .content-block').forEach((cb) => {
    const d = document.createElement('div');
    d.className = 'hero-hud rv';
    d.innerHTML = `<span class="hh-dot"></span><span>PAGE ${(PAGE_CODES[PAGE] || 'SYS')}</span><span class="hh-rev">DESIGN REV —</span><span>UPLINK ACTIVE</span>`;
    cb.appendChild(d);
  });
}

function stampRev(v) {
  const name = META[v - 1] ? META[v - 1].name.toUpperCase() : `V${v}`;
  const rev = document.getElementById('tl-rev');
  if (rev) rev.textContent = `DESIGN REV V${v} · ${name}`;
  document.querySelectorAll('.hh-rev').forEach((el) => { el.textContent = `REV V${v} — ${name}`; });
}

const _setVersion = setVersion;
setVersion = function (v, push = true) {
  _setVersion(v, push);
  stampRev(v);
};

decorateChrome();
buildPicker();
setVersion(currentDefault(), false);
