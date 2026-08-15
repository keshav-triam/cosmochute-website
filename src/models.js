// ============================================================
// Procedural hardware, modelled on the LEAP datasheet renders:
//   EPOC     — 6-wheel rover, sensor mast, robotic arm, and a
//              belly chamber that accepts one 8U Cartridge
//   OASys    — payload reloading & storage trailer: an open-top
//              magazine of 8U Cartridges on wheels
//   Cartridge— black 8U box (400x200x100), top regolith hatch,
//              front horizon window, bottom surface window
//   Lander   — 4-legged lander with fold-down egress ramp
//   Orbiter  — relay satellite drifting across the sky
// Scale: 1 unit ≈ 1 m.
// ============================================================
import * as THREE from 'three';
import { T } from './textures.js';

export const ACCENT = 0xffb43c;
export const CYAN = 0x7fd8e8;

// ---------------- shared materials (baked PBR maps) ----------------
export const mats = {
  body: new THREE.MeshStandardMaterial({ map: T.paint, color: 0xffffff, metalness: 0.25, roughness: 0.55 }),
  alu: new THREE.MeshStandardMaterial({ map: T.alu, color: 0xffffff, metalness: 0.8, roughness: 0.35 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x33343a, metalness: 0.4, roughness: 0.65 }),
  black: new THREE.MeshStandardMaterial({ color: 0x141518, metalness: 0.3, roughness: 0.55 }),
  wheel: new THREE.MeshStandardMaterial({ map: T.alu, color: 0x9a9ca2, metalness: 0.85, roughness: 0.42 }),
  wheelWire: new THREE.MeshStandardMaterial({ color: 0x8b8e95, metalness: 0.9, roughness: 0.35, wireframe: true }),
  mli: new THREE.MeshStandardMaterial({
    map: T.mli, normalMap: T.mliN, normalScale: new THREE.Vector2(1.2, 1.2),
    roughnessMap: T.mliRough, roughness: 1,
    color: 0xffffff, metalness: 0.85,
  }),
  gold: new THREE.MeshStandardMaterial({ color: 0xcf9331, metalness: 0.8, roughness: 0.3 }),
  solar: new THREE.MeshStandardMaterial({ map: T.solar, color: 0xffffff, metalness: 0.55, roughness: 0.3 }),
  carbon: new THREE.MeshStandardMaterial({ map: T.alu, color: 0x23262b, metalness: 0.6, roughness: 0.5 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0b0e14, metalness: 0.9, roughness: 0.12 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.85, roughness: 0.35 }),
  pcb: new THREE.MeshStandardMaterial({ color: 0x1e3a2a, metalness: 0.2, roughness: 0.6 }),
  capSilver: new THREE.MeshStandardMaterial({ color: 0xc8cbd2, metalness: 0.9, roughness: 0.25 }),
};
const edgeMat = new THREE.LineBasicMaterial({ color: 0x3c3d42, transparent: true, opacity: 0.12 });

export function makeGlowMat(color, base = 0x111111) {
  return new THREE.MeshStandardMaterial({
    color: base, emissive: color, emissiveIntensity: 0.4,
    metalness: 0.1, roughness: 0.6,
  });
}

function edges(mesh, mat = edgeMat) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), mat);
  mesh.add(e);
  return e;
}
function box(w, h, d, mat = mats.body) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}
function cyl(rt, rb, h, seg, mat = mats.body) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
}
function markShadows(root) {
  root.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  return root;
}

// ---------------- mesh wheel (lunar-rover style) ----------------
function meshWheel(r = 0.36, w = 0.26, accent = false) {
  const g = new THREE.Group();
  if (accent) {
    const hubRing = new THREE.Mesh(new THREE.TorusGeometry(r * 0.34, 0.016, 8, 16), mats.gold);
    hubRing.position.z = 0;
    g.add(hubRing);
  }
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 20, 1, true), mats.wheel);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.01, r * 1.01, w * 1.02, 14, 2, true), mats.wheelWire);
  wire.rotation.x = Math.PI / 2;
  g.add(wire);
  for (const side of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 8, 22), mats.alu);
    ring.position.z = side * w * 0.5;
    g.add(ring);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, w * 1.15, 10), mats.dark);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  for (let i = 0; i < 6; i++) {
    const spoke = box(0.035, r * 1.9, 0.04, mats.alu);
    spoke.rotation.z = (i / 6) * Math.PI;
    g.add(spoke);
  }
  for (let i = 0; i < 12; i++) {
    const grouser = box(0.045, 0.02, w + 0.03, mats.alu);
    const a = (i / 12) * Math.PI * 2;
    grouser.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    grouser.rotation.z = a + Math.PI / 2;
    g.add(grouser);
  }
  return g;
}

// ---------------- parabolic dish (solid lathe, feed horn) ----------------
function makeDish(r = 0.2) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    pts.push(new THREE.Vector2(0.012 + t * r, t * t * r * 0.6));
  }
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 26), new THREE.MeshStandardMaterial({
    map: T.paint, color: 0xf2efe8, metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide,
  }));
  g.add(bowl);
  const hub = cyl(r * 0.16, r * 0.2, r * 0.16, 10, mats.dark);
  hub.position.y = -r * 0.05;
  g.add(hub);
  const feedArm = cyl(0.01, 0.01, r * 1.05, 6, mats.dark);
  feedArm.position.y = r * 0.5;
  g.add(feedArm);
  const feed = cyl(0.02, 0.035, r * 0.22, 8, mats.alu);
  feed.position.y = r * 1.02;
  feed.rotation.x = Math.PI;
  g.add(feed);
  return g;
}

// ---------------- electronics greebles ----------------
// scatters capacitors, chips, connectors, wire runs and heatsinks
// over a w x d patch (local XZ plane, +y up). Deterministic per seed.
function greebleCluster(seed, w, d) {
  const g = new THREE.Group();
  let s = seed * 16807 % 2147483647;
  const rnd = () => { s = (s * 48271) % 2147483647; return s / 2147483647; };
  const n = 9 + Math.floor(rnd() * 5);
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * w;
    const z = (rnd() - 0.5) * d;
    const kind = rnd();
    if (kind < 0.3) {
      // electrolytic capacitor: silver can + dark top groove
      const r = 0.018 + rnd() * 0.022;
      const hgt = 0.045 + rnd() * 0.05;
      const can = cyl(r, r, hgt, 10, mats.capSilver);
      can.position.set(x, hgt / 2, z);
      g.add(can);
      const top = cyl(r * 0.85, r * 0.85, 0.006, 10, mats.black);
      top.position.set(x, hgt + 0.003, z);
      g.add(top);
    } else if (kind < 0.55) {
      // module box / chip
      const bw = 0.05 + rnd() * 0.09;
      const bh = 0.02 + rnd() * 0.03;
      const chip = box(bw, bh, 0.04 + rnd() * 0.05, rnd() < 0.5 ? mats.pcb : mats.dark);
      chip.position.set(x, bh / 2, z);
      chip.rotation.y = rnd() * Math.PI;
      g.add(chip);
    } else if (kind < 0.72) {
      // gold connector ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022 + rnd() * 0.012, 0.007, 6, 12), mats.gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 0.012, z);
      g.add(ring);
      const pin = cyl(0.008, 0.008, 0.035, 6, mats.copper);
      pin.position.set(x, 0.028, z);
      g.add(pin);
    } else if (kind < 0.88) {
      // copper wire run: three chained segments
      let wx = x, wz = z, ang = rnd() * Math.PI * 2;
      for (let k = 0; k < 3; k++) {
        const len = 0.06 + rnd() * 0.08;
        const seg = box(len, 0.012, 0.012, mats.copper);
        seg.position.set(wx + Math.cos(ang) * len / 2, 0.012, wz + Math.sin(ang) * len / 2);
        seg.rotation.y = -ang;
        g.add(seg);
        wx += Math.cos(ang) * len; wz += Math.sin(ang) * len;
        ang += (rnd() - 0.5) * 1.6;
      }
    } else {
      // finned heatsink
      const base = box(0.07, 0.012, 0.06, mats.alu);
      base.position.set(x, 0.006, z);
      g.add(base);
      for (let k = 0; k < 4; k++) {
        const fin = box(0.07, 0.03, 0.006, mats.alu);
        fin.position.set(x, 0.026, z - 0.024 + k * 0.016);
        g.add(fin);
      }
    }
  }
  return g;
}

// ---------------- 8U CARTRIDGE ----------------
// black box with top regolith hatch, front horizon window,
// bottom surface window; slightly oversized for legibility
export const CART_W = 0.52, CART_H = 0.17, CART_D = 0.30;
export function buildCartridge(idx = 0) {
  const g = new THREE.Group();
  const bodyC = box(CART_W, CART_H, CART_D, new THREE.MeshStandardMaterial({
    color: 0x23262c, metalness: 0.35, roughness: 0.5,
  }));
  edges(bodyC, new THREE.LineBasicMaterial({ color: 0x55575c, transparent: true, opacity: 0.2 }));
  g.add(bodyC);
  // top regolith hatch
  const hatch = box(CART_W * 0.42, 0.012, CART_D * 0.6, mats.dark);
  hatch.position.set(-CART_W * 0.2, CART_H / 2 + 0.006, 0);
  g.add(hatch);
  // front horizon window
  const win = box(0.02, CART_H * 0.5, CART_D * 0.5, makeGlowMat(CYAN, 0x0a1418));
  win.position.set(CART_W / 2 + 0.005, 0, 0);
  g.add(win);
  // gold corner rails
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const rail = box(0.02, CART_H + 0.015, 0.02, mats.gold);
    rail.position.set(sx * (CART_W / 2 - 0.015), 0, sz * (CART_D / 2 - 0.015));
    g.add(rail);
  }
  // status LED
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), makeGlowMat(ACCENT));
  led.position.set(CART_W / 2 - 0.05, CART_H / 2 + 0.015, CART_D / 2 - 0.05);
  g.add(led);
  g.userData = { led: led.material, window: win.material, idx };
  return markShadows(g);
}

// ---------------- detail kit: engineering motifs shared by all hardware ----------------
function conduit(pts, r = 0.016, mat = mats.dark) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 20, r, 6), mat);
}
function boltRing(r, n = 8, mat = mats.capSilver) {
  const grp = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = cyl(0.013, 0.013, 0.022, 6, mat);
    b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    grp.add(b);
  }
  return grp;
}
function handrail(len, h = 0.1, mat = mats.gold) {
  const grp = new THREE.Group();
  const top = cyl(0.012, 0.012, len, 6, mat);
  top.rotation.z = Math.PI / 2;
  top.position.y = h;
  grp.add(top);
  for (const s of [-1, 1]) {
    const leg = cyl(0.012, 0.012, h, 6, mat);
    leg.position.set(s * (len / 2 - 0.02), h / 2, 0);
    grp.add(leg);
  }
  return grp;
}
function ventPanel(w, h, n = 5) {
  const grp = new THREE.Group();
  const back = box(w, h, 0.014, mats.black);
  grp.add(back);
  for (let i = 0; i < n; i++) {
    const slat = box(w * 0.86, h / (n * 1.9), 0.02, mats.dark);
    slat.position.set(0, -h / 2 + (i + 0.5) * (h / n), 0.012);
    slat.rotation.x = 0.5;
    grp.add(slat);
  }
  return grp;
}
function umbilicalPanel() {
  const grp = new THREE.Group();
  const plate = box(0.24, 0.16, 0.02, mats.alu);
  grp.add(plate);
  const colors = [0xcf9331, 0x7fd8e8, 0x33343a];
  for (let i = 0; i < 3; i++) {
    const port = cyl(0.028, 0.032, 0.035, 8, mats.dark);
    port.rotation.x = Math.PI / 2;
    port.position.set(-0.07 + i * 0.07, 0.02, 0.02);
    grp.add(port);
    const cap = cyl(0.02, 0.02, 0.012, 8, new THREE.MeshStandardMaterial({ color: colors[i], metalness: 0.6, roughness: 0.4 }));
    cap.rotation.x = Math.PI / 2;
    cap.position.set(-0.07 + i * 0.07, 0.02, 0.042);
    grp.add(cap);
  }
  return grp;
}
function chevronPlate(w = 0.3, h = 0.08) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 16;
  const x = c.getContext('2d');
  for (let i = -1; i < 5; i++) {
    x.fillStyle = i % 2 ? '#141414' : '#ffb43c';
    x.beginPath();
    x.moveTo(i * 16, 0); x.lineTo(i * 16 + 16, 0);
    x.lineTo(i * 16 + 24, 16); x.lineTo(i * 16 + 8, 16);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({
    map: t, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1,
  }));
}

// ---------------- EPOC — modular reusable rover ----------------
export function buildEpoc() {
  const g = new THREE.Group();
  const glows = [];

  // --- faceted hull: carbon underbody, chamfered skirts, white deck.
  // Same bounding envelope as the old chassis (top 1.19, +-1.02, +-0.65)
  // so every verified arm/cartridge clearance still holds.
  const hullLow = box(1.9, 0.3, 1.24, mats.carbon);
  hullLow.position.y = 0.9;
  g.add(hullLow);
  const deckP = box(2.05, 0.26, 1.26, mats.body);
  deckP.position.y = 1.06;
  edges(deckP);
  g.add(deckP);
  for (const side of [-1, 1]) {
    // chamfered side skirt
    const skirt = box(1.95, 0.34, 0.28, mats.carbon);
    skirt.position.set(0, 0.96, side * 0.62);
    skirt.rotation.x = side * 0.55;
    g.add(skirt);
    // amber running line along the skirt shoulder
    const runLine = box(1.65, 0.024, 0.024, makeGlowMat(ACCENT, 0x1a1206));
    runLine.position.set(0, 1.115, side * 0.665);
    glows.push(runLine.material);
    g.add(runLine);
  }
  // angled dark-glass visor nose with an integrated light bar
  const visor = box(0.34, 0.3, 1.04, mats.glass);
  visor.position.set(1.08, 1.0, 0);
  visor.rotation.z = -0.5;
  g.add(visor);
  const lightBar = box(0.03, 0.05, 0.82, makeGlowMat(0xfff3d0, 0x211d15));
  lightBar.position.set(1.2, 1.06, 0);
  lightBar.rotation.z = -0.5;
  glows.push(lightBar.material);
  g.add(lightBar);
  // carbon tail panel + angled radiator fins
  const tail = box(0.3, 0.28, 1.06, mats.carbon);
  tail.position.set(-1.06, 0.97, 0);
  tail.rotation.z = 0.45;
  g.add(tail);
  for (let i = 0; i < 5; i++) {
    const fin = box(0.15, 0.2, 0.018, mats.body);
    fin.position.set(-1.12, 1.14, -0.4 + i * 0.2);
    fin.rotation.z = 0.5;
    g.add(fin);
  }
  // mission decals: unit wordmark on both deck flanks + hazard plate
  const decalCanvas = document.createElement('canvas');
  decalCanvas.width = 256; decalCanvas.height = 64;
  const dctx2 = decalCanvas.getContext('2d');
  dctx2.fillStyle = '#ffb43c';
  dctx2.fillRect(6, 8, 10, 48);
  dctx2.fillStyle = '#e8e5df';
  dctx2.font = '700 40px Arial';
  dctx2.fillText('EPOC-1', 28, 48);
  dctx2.fillStyle = '#8e8b84';
  dctx2.font = '700 14px Arial';
  dctx2.fillText('COSMOCHUTE LEAP', 30, 60);
  const decalTex = new THREE.CanvasTexture(decalCanvas);
  decalTex.colorSpace = THREE.SRGBColorSpace;
  for (const side of [-1, 1]) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.13), new THREE.MeshStandardMaterial({
      map: decalTex, transparent: true, roughness: 0.6, metalness: 0.1,
      polygonOffset: true, polygonOffsetFactor: -1,
    }));
    decal.position.set(-0.25, 1.07, side * 0.633);
    decal.rotation.y = side > 0 ? 0 : Math.PI;
    g.add(decal);
  }
  const chevCanvas = document.createElement('canvas');
  chevCanvas.width = chevCanvas.height = 64;
  const cctx = chevCanvas.getContext('2d');
  for (let i = -2; i < 6; i++) {
    cctx.fillStyle = i % 2 ? '#141414' : '#ffb43c';
    cctx.beginPath();
    cctx.moveTo(i * 16, 0); cctx.lineTo(i * 16 + 16, 0);
    cctx.lineTo(i * 16 + 32, 64); cctx.lineTo(i * 16 + 16, 64);
    cctx.fill();
  }
  const chevTex = new THREE.CanvasTexture(chevCanvas);
  chevTex.colorSpace = THREE.SRGBColorSpace;
  const chevPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.08), new THREE.MeshStandardMaterial({
    map: chevTex, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1,
  }));
  chevPlate.position.set(0.25, 1.192, 0.42);
  chevPlate.rotation.x = -Math.PI / 2;
  g.add(chevPlate);

  // gold MLI-wrapped avionics module
  const avionics = box(0.85, 0.4, 1.0, mats.mli);
  avionics.position.set(-0.45, 1.4, 0);
  g.add(avionics);
  // white radiator top
  const radiator = box(0.8, 0.04, 0.95, mats.body);
  radiator.position.set(-0.45, 1.62, 0);
  g.add(radiator);
  // deck instrument boxes
  const ib1 = box(0.5, 0.28, 0.34, mats.dark);
  ib1.position.set(0.4, 1.33, -0.42);
  edges(ib1);
  g.add(ib1);
  const solarTop = box(0.5, 0.03, 0.3, mats.solar);
  solarTop.position.set(0.4, 1.5, -0.42);
  g.add(solarTop);
  // exposed avionics: capacitors, wire runs, connectors on the deck
  const deckElec = greebleCluster(11, 0.55, 0.3);
  deckElec.position.set(0.05, 1.19, 0.45);
  g.add(deckElec);
  const sideElec = greebleCluster(23, 0.7, 0.32);
  sideElec.rotation.x = Math.PI / 2;
  sideElec.position.set(-0.45, 1.4, 0.515);
  g.add(sideElec);

  // --- TOP-LOADING PAYLOAD BAY — front deck, lid opens skyward.
  // The arm lowers the cartridge straight in from above, holding it
  // the whole way — no free-flying payloads.
  const bayGrp = new THREE.Group();
  bayGrp.position.set(0.6, 0, 0.12);
  const bayOuter = box(0.68, 0.28, 0.46, mats.body);
  bayOuter.position.y = 1.33;
  edges(bayOuter);
  bayGrp.add(bayOuter);
  const bayCavity = box(0.6, 0.24, 0.38, mats.black);
  bayCavity.position.y = 1.36;
  bayGrp.add(bayCavity);
  const bayStrip = box(0.66, 0.025, 0.02, makeGlowMat(CYAN, 0x0a1418));
  bayStrip.position.set(0, 1.44, 0.235);
  glows.push(bayStrip.material);
  bayGrp.add(bayStrip);
  // hinged lid (rear edge), swings up and back
  const lidGrp = new THREE.Group();
  lidGrp.position.set(-0.34, 1.475, 0);
  const lidPanel = box(0.68, 0.025, 0.46, mats.body);
  lidPanel.position.x = 0.34;
  edges(lidPanel);
  lidGrp.add(lidPanel);
  const lidHandle = box(0.08, 0.03, 0.12, mats.gold);
  lidHandle.position.set(0.58, 0.025, 0);
  lidGrp.add(lidHandle);
  bayGrp.add(lidGrp);
  g.add(bayGrp);
  // seat anchor: where the docked cartridge's centre sits (inside the bay)
  const bellyAnchor = new THREE.Object3D();
  bellyAnchor.position.set(0.6, 1.37, 0.12);
  g.add(bellyAnchor);

  // --- suspension + 6 mesh wheels ---
  const wheels = [];
  const wheelR = 0.36;
  for (const side of [-1, 1]) {
    const z = side * 0.78;
    // rocker: deck to middle wheel + front strut
    const rocker = box(1.15, 0.07, 0.07, mats.alu);
    rocker.position.set(0.35, 0.82, z);
    rocker.rotation.z = 0.24;
    g.add(rocker);
    const bogie = box(1.15, 0.07, 0.07, mats.alu);
    bogie.position.set(-0.5, 0.75, z);
    bogie.rotation.z = -0.28;
    g.add(bogie);
    for (const x of [-0.95, 0.05, 0.95]) {
      const w = meshWheel(wheelR, 0.26, true);
      w.position.set(x, wheelR, z);
      g.add(w);
      wheels.push(w);
      // steering knuckle + drive motor canister travel WITH the wheel
      const knuckle = box(0.09, 0.14, 0.07, mats.dark);
      knuckle.position.set(0, 0.14, -side * 0.19);
      w.add(knuckle);
      const driveMotor = cyl(0.055, 0.055, 0.1, 8, mats.capSilver);
      driveMotor.rotation.x = Math.PI / 2;
      driveMotor.position.set(0, 0, -side * 0.2);
      w.add(driveMotor);
      const upright = cyl(0.026, 0.026, 0.34, 6, mats.alu);
      upright.position.set(0, 0.3, -side * 0.16);
      upright.rotation.x = side * 0.35;
      w.add(upright);
      // carbon fender arch riding over each wheel
      const fender = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 8, 14, Math.PI), mats.carbon);
      fender.position.set(x, 0.5, z);
      g.add(fender);
    }
  }

  // --- sensor mast (kept clear of the arm's swing plane) ---
  const mast = cyl(0.06, 0.08, 1.05, 10, mats.alu);
  mast.position.set(0.8, 1.7, -0.34);
  g.add(mast);
  // pan-tilt neck: yaw drum, clevis plates, tilt pivot under the head
  const panDrum = cyl(0.075, 0.075, 0.07, 10, mats.gold);
  panDrum.position.set(0.8, 2.14, -0.34);
  g.add(panDrum);
  for (const s of [-1, 1]) {
    const clevis = box(0.09, 0.1, 0.016, mats.dark);
    clevis.position.set(0.8, 2.2, -0.34 + s * 0.055);
    g.add(clevis);
  }
  const tiltPin = cyl(0.02, 0.02, 0.16, 8, mats.capSilver);
  tiltPin.rotation.x = Math.PI / 2;
  tiltPin.position.set(0.8, 2.21, -0.34);
  g.add(tiltPin);
  const mastRing = boltRing(0.075, 6);
  mastRing.position.set(0.8, 1.155 + 1.05, -0.34);
  g.add(mastRing);
  const head = box(0.4, 0.17, 0.2, mats.dark);
  head.position.set(0.8, 2.26, -0.34);
  edges(head);
  g.add(head);
  // stereo sunshade visor over the eyes
  const sunshade = box(0.42, 0.02, 0.24, mats.body);
  sunshade.position.set(0.82, 2.36, -0.34);
  sunshade.rotation.z = -0.12;
  g.add(sunshade);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), makeGlowMat(CYAN, 0x0a1418));
    eye.position.set(0.985, 2.26, -0.34 + side * 0.09);
    eye.rotation.y = Math.PI / 2;
    glows.push(eye.material);
    g.add(eye);
  }

  // --- high-gain dish (to relay orbiter) ---
  const dishArm = cyl(0.02, 0.02, 0.4, 6, mats.alu);
  dishArm.position.set(-0.95, 1.55, -0.4);
  g.add(dishArm);
  const dish = makeDish(0.21);
  dish.position.set(-0.95, 1.76, -0.4);
  dish.rotation.x = -0.7;
  dish.rotation.z = 0.25;
  g.add(dish);
  const dishTip = new THREE.Object3D();
  dishTip.position.set(-0.95, 1.85, -0.4);
  g.add(dishTip);

  // --- robotic arm on a rear-centre pedestal: clean air on every
  // side, clear of the avionics module (the old side-mount was embedded
  // against it, so most folds clipped straight through) ---
  // tall pedestal: the shoulder sits ABOVE the whole deck skyline
  // (avionics roof 1.6), so every reach arcs over the bodywork
  const pedestal = cyl(0.09, 0.12, 0.53, 12, mats.dark);
  pedestal.position.set(-0.95, 1.455, 0);
  g.add(pedestal);
  const pedRing = cyl(0.13, 0.13, 0.04, 12, mats.gold);
  pedRing.position.set(-0.95, 1.7, 0);
  g.add(pedRing);
  const armRoot = new THREE.Group();
  armRoot.position.set(-0.95, 1.72, 0);
  const shoulderHub = cyl(0.09, 0.09, 0.14, 12, mats.gold);
  armRoot.add(shoulderHub);
  // shoulder pitch motor drum across the joint + bolt ring on the yaw
  const shoulderDrum = cyl(0.06, 0.06, 0.22, 10, mats.capSilver);
  shoulderDrum.rotation.x = Math.PI / 2;
  shoulderDrum.position.y = 0.02;
  armRoot.add(shoulderDrum);
  const yawRing = boltRing(0.1, 8);
  yawRing.position.y = -0.08;
  armRoot.add(yawRing);
  const ARM_L1 = 1.05, ARM_L2 = 1.0;
  const upper = new THREE.Group();
  const upperSeg = box(0.065, ARM_L1, 0.065, mats.alu);
  upperSeg.position.y = ARM_L1 / 2;
  upper.add(upperSeg);
  // cable loom articulating WITH the upper arm
  const upperLoom = conduit([[0.05, 0.08, 0.03], [0.07, ARM_L1 * 0.5, 0.045], [0.05, ARM_L1 - 0.06, 0.03]], 0.013, mats.black);
  upper.add(upperLoom);
  // twin structural ribs
  for (const s of [-1, 1]) {
    const rib = box(0.02, ARM_L1 * 0.72, 0.09, mats.dark);
    rib.position.set(s * 0.042, ARM_L1 / 2, 0);
    upper.add(rib);
  }
  const elbowHub = cyl(0.07, 0.07, 0.12, 10, mats.gold);
  elbowHub.rotation.x = Math.PI / 2;
  elbowHub.position.y = ARM_L1;
  upper.add(elbowHub);
  const elbowDrum = cyl(0.05, 0.05, 0.18, 10, mats.capSilver);
  elbowDrum.rotation.x = Math.PI / 2;
  elbowDrum.position.set(0.04, ARM_L1, 0);
  upper.add(elbowDrum);
  const fore = new THREE.Group();
  fore.position.y = ARM_L1;
  const foreSeg = box(0.055, ARM_L2 - 0.18, 0.055, mats.alu);
  foreSeg.position.y = (ARM_L2 - 0.18) / 2;
  fore.add(foreSeg);
  const foreLoom = conduit([[0.04, 0.06, -0.03], [0.055, (ARM_L2 - 0.18) * 0.5, -0.04], [0.04, ARM_L2 - 0.22, -0.028]], 0.011, mats.black);
  fore.add(foreLoom);
  // wrist rotator disc + camera already on the elbow; rotator sells DOF
  const wristRotator = cyl(0.06, 0.06, 0.05, 12, mats.gold);
  wristRotator.position.y = ARM_L2 - 0.2;
  fore.add(wristRotator);
  const wrist = box(0.11, 0.1, 0.09, mats.dark);
  wrist.position.y = ARM_L2 - 0.14;
  fore.add(wrist);
  for (const s of [-1, 1]) {
    const finger = box(0.02, 0.14, 0.03, mats.alu);
    finger.position.set(s * 0.035, ARM_L2 - 0.05, 0);
    fore.add(finger);
  }
  // grapple pendant: the payload visibly hangs from this, separated
  // from the arm — reads as a held object even in silhouette
  const pendant = cyl(0.014, 0.014, 0.14, 6, mats.alu);
  pendant.position.y = ARM_L2 + 0.07;
  fore.add(pendant);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 12), mats.gold);
  hook.position.y = ARM_L2 + 0.15;
  fore.add(hook);
  const wristTip = new THREE.Object3D();
  wristTip.position.y = ARM_L2;
  fore.add(wristTip);
  upper.add(fore);
  armRoot.add(upper);
  g.add(armRoot);
  // stowed: upright crane-fold — upper arm near vertical, forearm
  // draped forward-down, everything above the avionics roofline
  armRoot.rotation.z = 0.15;
  fore.rotation.z = -2.4;

  // --- deck systems: conduits, power, umbilicals, hand fixtures ---
  // cable runs: avionics -> mast base, avionics -> arm pedestal,
  // battery -> bay (routed along the deck, below the arm's raised arcs)
  g.add(conduit([[-0.05, 1.6, -0.1], [0.4, 1.45, -0.28], [0.76, 1.28, -0.33]], 0.015, mats.black));
  g.add(conduit([[-0.85, 1.6, 0.08], [-0.92, 1.5, 0.05], [-0.95, 1.3, 0.02]], 0.015, mats.black));
  g.add(conduit([[-0.1, 1.2, 0.5], [0.25, 1.24, 0.42], [0.45, 1.3, 0.3]], 0.013, mats.dark));
  // RTG-style finned power canister tucked at the rear corner
  const rtg = cyl(0.11, 0.11, 0.42, 10, mats.dark);
  rtg.rotation.z = Math.PI / 2;
  rtg.position.set(-0.78, 1.3, 0.42);
  g.add(rtg);
  for (let i = 0; i < 6; i++) {
    const fin = box(0.4, 0.14, 0.012, mats.body);
    fin.position.set(-0.78, 1.3, 0.42);
    fin.rotation.x = (i / 6) * Math.PI;
    g.add(fin);
  }
  // umbilical service panel on the tail + louvered vents on the skirt
  const umb = umbilicalPanel();
  umb.position.set(-1.16, 1.02, -0.3);
  umb.rotation.y = -Math.PI / 2 - 0.45;
  g.add(umb);
  for (const s of [-1, 1]) {
    const vent = ventPanel(0.3, 0.16, 4);
    vent.position.set(0.85, 1.02, s * 0.68);
    vent.rotation.y = s > 0 ? 0 : Math.PI;
    vent.rotation.x = s * -0.5;
    g.add(vent);
  }
  // grab handles + tie-down cleats along the deck edges
  for (const [hx, hz] of [[0.15, 0.62], [-0.5, 0.62], [0.15, -0.6]]) {
    const rail = handrail(0.3, 0.08);
    rail.position.set(hx, 1.19, hz);
    g.add(rail);
  }
  for (const [cx, cz] of [[0.95, 0.55], [0.95, -0.55], [-0.85, 0.55], [-0.85, -0.55]]) {
    const cleat = box(0.05, 0.05, 0.09, mats.gold);
    cleat.position.set(cx, 1.2, cz);
    g.add(cleat);
  }
  // UHF whip on the rear deck, off the arm's working sectors
  const uhf = cyl(0.008, 0.012, 0.6, 6, mats.dark);
  uhf.position.set(-0.2, 1.5, -0.55);
  g.add(uhf);
  const uhfTip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), makeGlowMat(ACCENT));
  uhfTip.position.set(-0.2, 1.82, -0.55);
  glows.push(uhfTip.material);
  g.add(uhfTip);
  // front recovery hooks under the visor
  for (const s of [-1, 1]) {
    const hookF = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 6, 12), mats.gold);
    hookF.rotation.y = Math.PI / 2;
    hookF.position.set(1.16, 0.86, s * 0.34);
    g.add(hookF);
  }

  // --- cameras everywhere: hazcams, navcams, side & rear imagers ---
  const camPod = (mount = true) => {
    const pod = new THREE.Group();
    if (mount) {
      const bracket = box(0.05, 0.06, 0.05, mats.dark);
      pod.add(bracket);
    }
    const housing = cyl(0.035, 0.042, 0.09, 10, mats.dark);
    housing.rotation.z = Math.PI / 2;
    housing.position.x = 0.06;
    pod.add(housing);
    const bezel = cyl(0.045, 0.045, 0.015, 10, mats.alu);
    bezel.rotation.z = Math.PI / 2;
    bezel.position.x = 0.11;
    pod.add(bezel);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 12), makeGlowMat(0x64d8ff, 0x06131c));
    lens.position.x = 0.12;
    lens.rotation.y = Math.PI / 2;
    glows.push(lens.material);
    pod.add(lens);
    return pod;
  };
  // front hazcams (angled down at the terrain ahead)
  for (const side of [-1, 1]) {
    const hc = camPod();
    hc.position.set(1.04, 0.88, side * 0.34);
    hc.rotation.z = -0.35;
    g.add(hc);
  }
  // rear hazcams
  for (const side of [-1, 1]) {
    const hc = camPod();
    hc.position.set(-1.04, 0.88, side * 0.34);
    hc.rotation.y = Math.PI;
    hc.rotation.z = -0.35;
    g.add(hc);
  }
  // side nav imagers on the deck edges
  for (const side of [-1, 1]) {
    const sc = camPod();
    sc.position.set(0.1, 1.24, side * 0.68);
    sc.rotation.y = -side * Math.PI / 2;
    g.add(sc);
  }
  // payload-bay monitoring camera on a stalk, looking down into the bay
  const bayCamStalk = cyl(0.018, 0.018, 0.3, 6, mats.alu);
  bayCamStalk.position.set(1.0, 1.62, 0.12);
  g.add(bayCamStalk);
  const bayCam = camPod(false);
  bayCam.position.set(1.0, 1.78, 0.12);
  bayCam.rotation.z = -2.2;
  g.add(bayCam);
  // arm-elbow inspection camera
  const elbowCam = camPod(false);
  elbowCam.scale.setScalar(0.8);
  elbowCam.position.set(0, ARM_L1 - 0.08, 0.08);
  elbowCam.rotation.z = -1.2;
  upper.add(elbowCam);

  // --- dense electronics: extra boards, boxes and cabling ---
  const flankElecL = greebleCluster(133, 0.9, 0.3);
  flankElecL.rotation.x = Math.PI / 2;
  flankElecL.rotation.z = Math.PI;
  flankElecL.position.set(-0.1, 1.05, -0.66);
  g.add(flankElecL);
  const flankElecR = greebleCluster(157, 0.9, 0.3);
  flankElecR.rotation.x = -Math.PI / 2;
  flankElecR.position.set(0.15, 1.05, 0.66);
  g.add(flankElecR);
  const rearElec = greebleCluster(171, 0.85, 0.32);
  rearElec.rotation.z = Math.PI / 2;
  rearElec.rotation.x = Math.PI / 2;
  rearElec.position.set(-1.03, 1.0, 0);
  g.add(rearElec);
  const noseElec = greebleCluster(191, 0.5, 0.3);
  noseElec.rotation.z = -Math.PI / 2;
  noseElec.rotation.x = Math.PI / 2;
  noseElec.position.set(1.03, 1.02, -0.25);
  g.add(noseElec);
  // extra whip antennas + a small GPS-style patch dome
  for (const [ax, az, ah] of [[-0.75, 0.55, 0.7], [0.15, -0.6, 0.55]]) {
    const whipA = cyl(0.008, 0.008, ah, 6, mats.dark);
    whipA.position.set(ax, 1.19 + ah / 2, az);
    g.add(whipA);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), mats.gold);
    tip.position.set(ax, 1.19 + ah + 0.01, az);
    g.add(tip);
  }
  const patchDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.body);
  patchDome.position.set(-0.2, 1.63, 0.4);
  g.add(patchDome);

  // --- lights ---
  // beacon mast: the light sits ON something, not in mid-air
  const beaconPole = cyl(0.018, 0.022, 0.36, 8, mats.alu);
  beaconPole.position.set(-0.45, 1.82, -0.35);
  g.add(beaconPole);
  const beaconCap = cyl(0.05, 0.05, 0.025, 10, mats.dark);
  beaconCap.position.set(-0.45, 2.0, -0.35);
  g.add(beaconCap);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), makeGlowMat(ACCENT));
  beacon.position.set(-0.45, 2.04, -0.35);
  glows.push(beacon.material);
  g.add(beacon);
  for (const side of [-1, 1]) {
    const lampFace = new THREE.Mesh(new THREE.CircleGeometry(0.04, 10), makeGlowMat(0xfff2cf, 0x1a1815));
    lampFace.position.set(1.04, 1.05, side * 0.42);
    lampFace.rotation.y = Math.PI / 2;
    glows.push(lampFace.material);
    g.add(lampFace);
  }
  const lamp = new THREE.PointLight(ACCENT, 0, 8, 2);
  lamp.position.set(0.8, 1.8, 0);
  g.add(lamp);

  // hitch point at the rear
  const hitch = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), mats.gold);
  hitch.position.set(-1.12, 0.62, 0);
  g.add(hitch);

  markShadows(g);
  g.userData = {
    glows, lamp, wheels, wheelR,
    arm: { root: armRoot, upper, fore, wristTip, lengths: { l1: ARM_L1, l2: ARM_L2 } },
    payloadLid: lidGrp,
    bellyAnchor, dishTip, dish,
  };
  return g;
}

// ---------------- OASys — payload reloading & storage trailer ----------------
export const OASYS_SLOTS = 8; // 2 rows x 4
export function buildOasys() {
  const g = new THREE.Group();
  const glows = [];

  // --- layered chassis: exposed frame rails + cross-members under a
  // skirted two-tone deck, same design language as EPOC ---
  for (const rz of [-0.5, 0.5]) {
    const rail = box(2.42, 0.1, 0.09, mats.alu);
    rail.position.set(0, 0.42, rz);
    g.add(rail);
  }
  for (const rx of [-0.9, 0, 0.9]) {
    const xm = box(0.09, 0.08, 1.06, mats.dark);
    xm.position.set(rx, 0.42, 0);
    g.add(xm);
  }
  const skirt = box(2.56, 0.12, 1.46, mats.dark);
  skirt.position.y = 0.5;
  edges(skirt);
  g.add(skirt);
  const bed = box(2.5, 0.12, 1.4, mats.body);
  bed.position.y = 0.6;
  edges(bed);
  g.add(bed);
  // amber running lines along both deck flanks (EPOC's runLine idiom)
  for (const rz of [-1, 1]) {
    const run = box(2.3, 0.018, 0.018, makeGlowMat(ACCENT, 0x1a1206));
    run.position.set(0, 0.635, rz * 0.705);
    glows.push(run.material);
    g.add(run);
  }

  // open-top cartridge magazine
  const magW = 2.54, magH = 0.62, magD = 1.2, wall = 0.05;
  const magY = 0.64 + magH / 2;
  const walls = [
    { w: magW, h: magH, d: wall, x: 0, z: magD / 2 - wall / 2 },
    { w: magW, h: magH, d: wall, x: 0, z: -magD / 2 + wall / 2 },
    { w: wall, h: magH, d: magD, x: magW / 2 - wall / 2, z: 0 },
    { w: wall, h: magH, d: magD, x: -magW / 2 + wall / 2, z: 0 },
  ];
  for (const s of walls) {
    const m = box(s.w, s.h, s.d, mats.dark);
    m.position.set(s.x, magY, s.z);
    g.add(m);
  }
  const magFloor = box(magW, 0.04, magD, mats.black);
  magFloor.position.set(0, 0.66, 0);
  g.add(magFloor);
  // gold frame rim
  const rimGeo = [
    { w: magW + 0.06, d: 0.05, z: magD / 2 }, { w: magW + 0.06, d: 0.05, z: -magD / 2 },
  ];
  for (const r of rimGeo) {
    const m = box(r.w, 0.05, r.d, mats.gold);
    m.position.set(0, magY + magH / 2, r.z);
    g.add(m);
  }
  for (const sx of [-1, 1]) {
    const m = box(0.05, 0.05, magD + 0.06, mats.gold);
    m.position.set(sx * magW / 2, magY + magH / 2, 0);
    g.add(m);
  }
  // --- magazine superstructure (all OUTSIDE the mouth: the arm's pick
  // clearance over the walls is untouched) ---
  // gold-capped corner pillars
  for (const px of [-1, 1]) {
    for (const pz of [-1, 1]) {
      const pillar = box(0.07, magH + 0.12, 0.07, mats.alu);
      pillar.position.set(px * (magW / 2 + 0.02), magY + 0.02, pz * (magD / 2 + 0.02));
      g.add(pillar);
      const cap = box(0.09, 0.05, 0.09, mats.gold);
      cap.position.set(px * (magW / 2 + 0.02), magY + magH / 2 + 0.1, pz * (magD / 2 + 0.02));
      g.add(cap);
    }
  }
  // exterior truss on both long walls: X-braces between stiffener ribs
  for (const tz of [-1, 1]) {
    const zc = tz * (magD / 2 + 0.03);
    const rib = box(magW * 0.96, 0.04, 0.024, mats.alu);
    rib.position.set(0, magY - magH / 2 + 0.08, zc);
    g.add(rib);
    for (let i = 0; i < 4; i++) {
      const bx = -0.93 + i * 0.62;
      for (const dr of [-1, 1]) {
        const brace = box(0.56, 0.028, 0.02, mats.dark);
        brace.position.set(bx, magY + 0.02, zc);
        brace.rotation.z = dr * 0.72;
        g.add(brace);
      }
    }
    // slot-status LEDs above each column
    for (let i = 0; i < 4; i++) {
      const led = box(0.035, 0.02, 0.014, makeGlowMat(ACCENT, 0x1a1206));
      led.position.set(-0.83 + i * 0.555, magY + magH / 2 + 0.045, zc + 0.014 * tz);
      glows.push(led.material);
      g.add(led);
    }
  }
  // MLI thermal wrap on the front (hitch-side) end wall
  const mliWrap = box(0.035, magH * 0.82, magD * 0.86, mats.mli);
  mliWrap.position.set(magW / 2 + 0.035, magY, 0);
  g.add(mliWrap);
  // angled solar strip on the far-side wall, feeding the magazine bus
  const solarStrip = box(1.55, 0.022, 0.3, mats.solar);
  solarStrip.position.set(0.1, magY + magH / 2 + 0.12, -(magD / 2 + 0.16));
  solarStrip.rotation.x = 0.62;
  g.add(solarStrip);
  const solarArmL = box(0.02, 0.16, 0.02, mats.alu);
  solarArmL.position.set(-0.55, magY + magH / 2 + 0.05, -(magD / 2 + 0.1));
  g.add(solarArmL);
  const solarArmR = solarArmL.clone();
  solarArmR.position.x = 0.75;
  g.add(solarArmR);
  // articulated work light on the rear-right pillar (the visible source
  // of the send-off lampBoost glow)
  const wlPost = cyl(0.018, 0.018, 0.42, 6, mats.dark);
  wlPost.position.set(-(magW / 2 + 0.02), magY + magH / 2 + 0.3, magD / 2 + 0.02);
  g.add(wlPost);
  const wlHead = box(0.11, 0.055, 0.08, mats.alu);
  wlHead.position.set(-(magW / 2 + 0.02) + 0.04, magY + magH / 2 + 0.5, magD / 2 + 0.02);
  wlHead.rotation.z = -0.45;
  g.add(wlHead);
  const wlLens = box(0.07, 0.02, 0.055, makeGlowMat(ACCENT, 0x241a08));
  wlLens.position.set(-(magW / 2 + 0.02) + 0.065, magY + magH / 2 + 0.47, magD / 2 + 0.02);
  wlLens.rotation.z = -0.45;
  glows.push(wlLens.material);
  g.add(wlLens);

  // 8 slot anchors: 2 rows x 4, cartridge tops peeking above the rim
  const slots = [];
  for (let ix = 0; ix < 4; ix++) {
    for (let iz = 0; iz < 2; iz++) {
      const a = new THREE.Object3D();
      a.position.set(-0.83 + ix * 0.555, 0.98, -0.28 + iz * 0.56);
      g.add(a);
      slots.push(a);
    }
  }

  // 4 mesh wheels under fender arches, on visible rocker links
  const wheels = [];
  const wheelR = 0.3;
  for (const side of [-1, 1]) {
    for (const x of [-0.72, 0.72]) {
      const w = meshWheel(wheelR, 0.22);
      w.position.set(x, wheelR, side * 0.84);
      g.add(w);
      wheels.push(w);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.036, 8, 14, Math.PI), mats.dark);
      arch.position.set(x, wheelR + 0.04, side * 0.84);
      g.add(arch);
      const rocker = box(0.34, 0.045, 0.05, mats.alu);
      rocker.position.set(x * 0.72, 0.4, side * 0.68);
      rocker.rotation.y = side * x * 0.5;
      rocker.rotation.z = -0.28 * Math.sign(x);
      g.add(rocker);
    }
  }
  // rear fascia: bumper beam, amber tail lights, aft hazcam, mudflaps
  const bumper = box(0.08, 0.1, 1.3, mats.dark);
  bumper.position.set(-1.3, 0.5, 0);
  g.add(bumper);
  for (const tz of [-1, 1]) {
    const tail = box(0.02, 0.05, 0.09, makeGlowMat(ACCENT, 0x1a1206));
    tail.position.set(-1.345, 0.5, tz * 0.56);
    glows.push(tail.material);
    g.add(tail);
    const flap = box(0.02, 0.18, 0.2, mats.black);
    flap.position.set(-1.06, 0.32, tz * 0.84);
    g.add(flap);
  }
  const hazcam = box(0.09, 0.07, 0.07, mats.black);
  hazcam.position.set(-1.33, 0.62, 0.18);
  g.add(hazcam);
  const hazLens = box(0.02, 0.03, 0.03, makeGlowMat(CYAN, 0x061214));
  hazLens.position.set(-1.38, 0.62, 0.18);
  glows.push(hazLens.material);
  g.add(hazLens);

  // A-frame drawbar (pivots up when unhitched): twin angled struts with
  // a damper, converging on the same gold hitch eye as before
  const towRoot = new THREE.Group();
  towRoot.position.set(1.28, 0.55, 0);
  const bar = box(1.17, 0.055, 0.055, mats.gold);
  bar.position.x = 0.585;
  towRoot.add(bar);
  for (const az of [-1, 1]) {
    const strut = box(1.1, 0.05, 0.05, mats.alu);
    strut.position.set(0.5, -0.01, az * 0.16);
    strut.rotation.y = -az * 0.3;
    towRoot.add(strut);
  }
  const damper = cyl(0.028, 0.028, 0.4, 8, mats.dark);
  damper.rotation.z = Math.PI / 2 - 0.25;
  damper.position.set(0.32, 0.09, 0);
  towRoot.add(damper);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 8, 14), mats.gold);
  eye.rotation.x = Math.PI / 2;
  eye.position.x = 1.2;
  towRoot.add(eye);
  g.add(towRoot);

  // exposed electronics: front service bay + magazine wall box
  const bayElec = greebleCluster(37, 0.8, 0.4);
  bayElec.position.set(0.95, 0.65, 0);
  g.add(bayElec);
  const wallElec = greebleCluster(51, 0.9, 0.4);
  wallElec.rotation.x = Math.PI / 2;
  wallElec.position.set(0, 0.95, 0.625);
  g.add(wallElec);

  // comms + beacon
  const whip = cyl(0.012, 0.012, 0.85, 6, mats.dark);
  whip.position.set(-1.1, 1.4, -0.5);
  g.add(whip);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), makeGlowMat(ACCENT));
  beacon.position.set(-1.1, 1.85, -0.5);
  glows.push(beacon.material);
  g.add(beacon);
  const strip = box(magW * 0.95, 0.03, 0.02, makeGlowMat(CYAN, 0x0a1418));
  strip.position.set(0, 0.545, 0.735);
  glows.push(strip.material);
  g.add(strip);
  const strip2 = strip.clone();
  strip2.position.z = -0.735;
  g.add(strip2);

  // unit wordmark on both flanks (EPOC's decal idiom)
  const oCanvas = document.createElement('canvas');
  oCanvas.width = 256; oCanvas.height = 64;
  const octx = oCanvas.getContext('2d');
  octx.fillStyle = '#7fd8e8';
  octx.fillRect(6, 8, 10, 48);
  octx.fillStyle = '#e8e5df';
  octx.font = '700 40px Arial';
  octx.fillText('OASYS-1', 28, 48);
  octx.fillStyle = '#8e8b84';
  octx.font = '700 14px Arial';
  octx.fillText('COSMOCHUTE LEAP', 30, 60);
  const oTex = new THREE.CanvasTexture(oCanvas);
  oTex.colorSpace = THREE.SRGBColorSpace;
  for (const side of [-1, 1]) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.125), new THREE.MeshStandardMaterial({
      map: oTex, transparent: true, roughness: 0.6, metalness: 0.1,
      polygonOffset: true, polygonOffsetFactor: -1,
    }));
    decal.position.set(0.55, 0.5, side * 0.732);
    decal.rotation.y = side > 0 ? 0 : Math.PI;
    g.add(decal);
  }

  // slot divider grid inside the magazine (below the cartridge tops, so
  // the bays read as engineered cells rather than a loose bin)
  for (const dx of [-0.5525, 0.0025, 0.5575]) {
    const fin = box(0.016, 0.2, magD - 2 * wall - 0.02, mats.dark);
    fin.position.set(dx, 0.79, 0);
    g.add(fin);
  }
  const finZ = box(magW - 2 * wall - 0.02, 0.2, 0.016, mats.dark);
  finZ.position.set(0, 0.79, 0);
  g.add(finZ);
  // gooseneck plates carrying the chassis loads into the drawbar pivot
  for (const s of [-1, 1]) {
    const neck = box(0.46, 0.16, 0.028, mats.dark);
    neck.position.set(1.33, 0.52, s * 0.11);
    neck.rotation.z = -0.12;
    edges(neck);
    g.add(neck);
  }
  // battery pack under the bed + feed conduit down from the solar strip
  const battery = box(0.5, 0.18, 0.6, mats.black);
  battery.position.set(-0.6, 0.4, 0);
  g.add(battery);
  g.add(conduit([[0.05, magY + magH / 2 + 0.08, -(magD / 2 + 0.12)], [-0.25, magY, -(magD / 2 + 0.06)], [-0.5, 0.55, -(magD / 2 - 0.1)], [-0.6, 0.46, -0.2]], 0.014, mats.black));
  // spare wheel racked on the rear wall + service handles + chevrons
  const spare = meshWheel(0.21, 0.15);
  spare.rotation.y = Math.PI / 2;
  spare.position.set(-1.36, 0.9, -0.3);
  g.add(spare);
  const rail1 = handrail(0.4, 0.09);
  rail1.position.set(-1.32, 1.05, 0.3);
  rail1.rotation.y = Math.PI / 2;
  g.add(rail1);
  for (const s of [-1, 0, 1]) {
    const chev = chevronPlate(0.26, 0.07);
    chev.position.set(1.325, 0.85, s * 0.36);
    chev.rotation.y = Math.PI / 2;
    g.add(chev);
  }

  const lamp = new THREE.PointLight(CYAN, 0, 7, 2);
  lamp.position.set(0, 1.6, 0);
  g.add(lamp);

  markShadows(g);
  g.userData = { glows, lamp, wheels, wheelR, slots, towRoot };
  return g;
}

// ---------------- LANDER — CLPS-class descent stage ----------------
// Octagonal MLI-panelled bus on four tri-strut legs with outriggers,
// visible propellant tanks, gimballed main engine with descent plume,
// RCS quads, deck hold-downs and an egress ramp.
export function buildLander() {
  const g = new THREE.Group();
  const glows = [];

  const DECK_Y = 1.85;
  const BODY_R = 3.3;

  // --- octagonal bus: 8 flat MLI side panels + frame ---
  const core = new THREE.Mesh(new THREE.CylinderGeometry(BODY_R - 0.1, BODY_R - 0.02, 1.5, 8), mats.mli);
  core.position.y = DECK_Y - 0.78;
  g.add(core);
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    const panel = box(2.42, 1.34, 0.03, i % 2 ? mats.mli : mats.body);
    panel.position.set(Math.cos(a) * (BODY_R - 0.01), DECK_Y - 0.76, Math.sin(a) * (BODY_R - 0.01));
    panel.rotation.y = -a + Math.PI / 2;
    edges(panel, new THREE.LineBasicMaterial({ color: 0x5a5751, transparent: true, opacity: 0.2 }));
    g.add(panel);
  }
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(BODY_R, BODY_R, 0.09, 8), mats.body);
  deck.position.y = DECK_Y;
  g.add(deck);
  const deckRim = new THREE.Mesh(new THREE.TorusGeometry(BODY_R - 0.06, 0.035, 8, 8), mats.gold);
  deckRim.rotation.x = Math.PI / 2;
  deckRim.position.y = DECK_Y + 0.05;
  g.add(deckRim);
  // deck hold-down fixtures (where the convoy rides)
  for (const dx of [-2.7, -1.4, -0.1, 1.2]) {
    const hd = box(0.22, 0.09, 1.5, mats.dark);
    hd.position.set(dx, DECK_Y + 0.08, 0);
    g.add(hd);
  }
  // launch latches: hooked clamp arms that close over the stowed
  // vehicles' wheels for the ride down, and swing open for egress
  const clamps = [];
  for (const [cx, cz] of [[1.25, 0.95], [1.25, -0.95], [-1.85, 1.0], [-1.85, -1.0]]) {
    const clampGrp = new THREE.Group();
    clampGrp.position.set(cx, DECK_Y + 0.05, cz);
    const post = box(0.07, 0.34, 0.07, mats.alu);
    post.position.y = 0.17;
    clampGrp.add(post);
    const finger = box(0.07, 0.06, 0.3, mats.gold);
    finger.position.set(0, 0.36, -Math.sign(cz) * 0.16);
    clampGrp.add(finger);
    const openRot = Math.sign(cz) * 1.9;
    clampGrp.rotation.x = openRot; // built OPEN (pre-mission deck is empty)
    g.add(clampGrp);
    clamps.push({ grp: clampGrp, openRot });
  }

  // --- propellant tanks peeking between the legs ---
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.74, 20, 16), mats.alu);
    tank.position.set(Math.cos(a) * 2.45, 0.95, Math.sin(a) * 2.45);
    g.add(tank);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.028, 6, 20), mats.dark);
    strap.position.copy(tank.position);
    strap.rotation.x = Math.PI / 2;
    g.add(strap);
  }

  // --- main engine: throat + flared bell (lathe profile) ---
  const bellPts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    bellPts.push(new THREE.Vector2(0.2 + Math.pow(t, 1.7) * 0.68, -t * 0.95));
  }
  const bell = new THREE.Mesh(new THREE.LatheGeometry(bellPts, 22), mats.dark);
  bell.position.y = 1.1;
  g.add(bell);
  const bellLip = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.03, 8, 22), mats.alu);
  bellLip.rotation.x = Math.PI / 2;
  bellLip.position.y = 0.15;
  g.add(bellLip);

  // descent plume: layered vacuum plume — bright core, hot sheath, and a
  // wide faint expansion haze (vacuum plumes flare far wider than at sea
  // level). Apex anchored at the nozzle exit; scene.js drives opacity,
  // flicker, and clamps the length so it never stabs through the surface.
  const plumeGrp = new THREE.Group();
  plumeGrp.position.y = 0.16;
  const plumeMats = [];
  const plumeTexs = [];
  // streaming-exhaust texture: bright streaks born at the nozzle racing
  // down the cone — scrolled per-layer at different speeds in render()
  function makeFlameTexture(seed, streaks) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 64, 256);
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < streaks; i++) {
      const x = rnd() * 64;
      const wdt = 1 + rnd() * 2.5;
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      const a = 0.35 + rnd() * 0.5;
      grad.addColorStop(0, `rgba(255,255,255,${a})`);
      grad.addColorStop(0.5, `rgba(255,255,255,${a * 0.45})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, wdt, 256);
      if (x + wdt > 64) ctx.fillRect(x - 64, 0, wdt, 256); // wrap seam
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const plumeLayer = (r, len, baseOp, color, seed, streaks) => {
    const geo = new THREE.ConeGeometry(r, len, 18, 1, true);
    geo.translate(0, -len / 2, 0); // apex at origin, cone opens downward
    const tex = makeFlameTexture(seed, streaks);
    plumeTexs.push(tex);
    const m = new THREE.MeshBasicMaterial({
      color, map: tex, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide, fog: false,
    });
    m.userData.baseOp = baseOp;
    plumeMats.push(m);
    plumeGrp.add(new THREE.Mesh(geo, m));
  };
  plumeLayer(0.3, 2.6, 1.35, 0xfff4da, 11, 22);   // core
  plumeLayer(0.72, 3.2, 0.55, 0xffc27a, 47, 14);  // sheath
  plumeLayer(1.55, 3.0, 0.22, 0x8fa8ff, 83, 9);   // expansion haze
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  const gctx = glowCanvas.getContext('2d');
  const grad = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 64, 64);
  const nozzleGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowCanvas), color: 0xffe9c8,
    transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false,
  }));
  nozzleGlow.scale.setScalar(2.8);
  plumeGrp.add(nozzleGlow);
  g.add(plumeGrp);

  // --- 4 legs: primary strut + V secondaries + honeycomb pads ---
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const hip = dir.clone().multiplyScalar(3.05).setY(DECK_Y - 0.5);
    const foot = dir.clone().multiplyScalar(4.9).setY(0.12);
    // primary strut
    const primary = cyl(0.08, 0.1, hip.distanceTo(foot), 10, mats.alu);
    primary.position.copy(hip).lerp(foot, 0.5);
    primary.lookAt(foot);
    primary.rotateX(Math.PI / 2);
    g.add(primary);
    // two secondary struts from lower body to mid-primary
    const mid = hip.clone().lerp(foot, 0.55);
    for (const side of [-0.38, 0.38]) {
      const anchor = new THREE.Vector3(Math.cos(a + side) * 2.75, 0.6, Math.sin(a + side) * 2.75);
      const sec = cyl(0.045, 0.045, anchor.distanceTo(mid), 8, mats.alu);
      sec.position.copy(anchor).lerp(mid, 0.5);
      sec.lookAt(mid);
      sec.rotateX(Math.PI / 2);
      g.add(sec);
    }
    // crushable honeycomb footpad
    const pad = cyl(0.52, 0.66, 0.12, 14, mats.dark);
    pad.position.set(foot.x, 0.08, foot.z);
    g.add(pad);
    const padTop = cyl(0.18, 0.18, 0.14, 10, mats.alu);
    padTop.position.set(foot.x, 0.2, foot.z);
    g.add(padTop);
  }

  // --- RCS thruster quads on alternating panels ---
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const quad = new THREE.Group();
    const mount = box(0.16, 0.16, 0.1, mats.dark);
    quad.add(mount);
    for (const [ox, oy] of [[0.09, 0], [-0.09, 0], [0, 0.09], [0, -0.09]]) {
      const nozzle = cyl(0.02, 0.045, 0.09, 8, mats.alu);
      nozzle.position.set(ox, oy, 0.07);
      nozzle.rotation.x = Math.PI / 2;
      quad.add(nozzle);
    }
    quad.position.set(Math.cos(a) * (BODY_R + 0.06), DECK_Y - 0.32, Math.sin(a) * (BODY_R + 0.06));
    quad.rotation.y = -a + Math.PI / 2;
    g.add(quad);
  }

  // --- propellant system: 4 spherical tanks nested between the legs,
  // plumbed into the engine; gimbal ring + actuators on the nozzle ---
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const tx = Math.cos(a) * 2.45, tz = Math.sin(a) * 2.45;
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 14), i % 2 ? mats.mli : mats.gold);
    tank.position.set(tx, 0.92, tz);
    g.add(tank);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.022, 8, 22), mats.alu);
    band.rotation.x = Math.PI / 2;
    band.position.set(tx, 0.92, tz);
    g.add(band);
    for (const sa of [-0.5, 0.5]) {
      const strut = cyl(0.028, 0.028, 0.62, 6, mats.alu);
      strut.position.set(tx + Math.cos(a + sa) * 0.3, 1.28, tz + Math.sin(a + sa) * 0.3);
      strut.rotation.z = Math.cos(a + sa) * 0.45;
      strut.rotation.x = -Math.sin(a + sa) * 0.45;
      g.add(strut);
    }
    // feed line arcing from the tank to the engine mount
    g.add(conduit([[tx, 0.55, tz], [tx * 0.55, 0.42, tz * 0.55], [0.28 * Math.cos(a), 0.5, 0.28 * Math.sin(a)]], 0.022, mats.copper));
  }
  const gimbal = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.035, 8, 20), mats.dark);
  gimbal.rotation.x = Math.PI / 2;
  gimbal.position.y = 0.62;
  g.add(gimbal);
  for (const ga of [0.8, 2.4]) {
    const act = cyl(0.03, 0.03, 0.5, 8, mats.capSilver);
    act.position.set(Math.cos(ga) * 0.62, 0.44, Math.sin(ga) * 0.62);
    act.rotation.z = Math.cos(ga) * 0.7;
    act.rotation.x = -Math.sin(ga) * 0.7;
    g.add(act);
  }
  // nozzle stiffening ribs
  for (const [ry, rr] of [[0.05, 0.72], [-0.12, 0.55], [-0.28, 0.38]]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.016, 6, 20), mats.dark);
    rib.rotation.x = Math.PI / 2;
    rib.position.y = ry + 0.15;
    g.add(rib);
  }

  // --- comms: high-gain dish + antenna + beacon ---
  const dishArm = cyl(0.035, 0.035, 0.75, 8, mats.alu);
  dishArm.position.set(1.3, DECK_Y + 0.38, -2.2);
  g.add(dishArm);
  const dishL = makeDish(0.44);
  dishL.position.set(1.3, DECK_Y + 0.78, -2.2);
  dishL.rotation.x = -0.85;
  dishL.rotation.z = 0.35;
  g.add(dishL);
  // deck utility electronics
  const deckElecL = greebleCluster(67, 1.4, 0.8);
  deckElecL.position.set(-0.6, DECK_Y + 0.05, 1.9);
  g.add(deckElecL);

  // --- deck outfitting (all OUTSIDE the convoy's drive lane |z|<1.2) ---
  // floodlight mast lighting the deck ops
  const flPost = cyl(0.035, 0.045, 1.05, 8, mats.alu);
  flPost.position.set(-1.6, DECK_Y + 0.55, -2.1);
  g.add(flPost);
  const flHead = box(0.26, 0.1, 0.14, mats.dark);
  flHead.position.set(-1.55, DECK_Y + 1.1, -2.05);
  flHead.rotation.y = 0.5;
  flHead.rotation.z = -0.35;
  g.add(flHead);
  const flLens = box(0.2, 0.03, 0.1, makeGlowMat(0xfff3d0, 0x211d15));
  flLens.position.set(-1.53, DECK_Y + 1.06, -2.03);
  flLens.rotation.y = 0.5;
  flLens.rotation.z = -0.35;
  glows.push(flLens.material);
  g.add(flLens);
  // handrail runs along the aft deck rim
  for (const hz of [-1, 1]) {
    const hr = handrail(1.5, 0.14);
    hr.position.set(-2.35, DECK_Y + 0.05, hz * 1.9);
    hr.rotation.y = hz * 0.65;
    g.add(hr);
  }
  // star tracker pair + deck umbilical panel
  for (const sa of [-0.35, 0.35]) {
    const st = cyl(0.05, 0.07, 0.2, 8, mats.black);
    st.position.set(-2.45 + sa * 0.3, DECK_Y + 0.16, -1.55);
    st.rotation.x = sa;
    st.rotation.z = 0.4;
    g.add(st);
  }
  const landerUmb = umbilicalPanel();
  landerUmb.position.set(-2.0, DECK_Y + 0.14, 1.62);
  landerUmb.rotation.x = -Math.PI / 2;
  g.add(landerUmb);
  // landing beacons at the deck rim diagonals
  for (const [bx, bz] of [[2.1, 2.1], [2.1, -2.1], [-2.1, 2.1], [-2.1, -2.1]]) {
    const stud = cyl(0.045, 0.055, 0.05, 8, mats.dark);
    stud.position.set(bx, DECK_Y + 0.07, bz);
    g.add(stud);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), makeGlowMat(ACCENT));
    lens.position.set(bx, DECK_Y + 0.11, bz);
    glows.push(lens.material);
    g.add(lens);
  }
  // ramp winch: drum + fairlead beside the ramp root, off the lane
  const winch = cyl(0.09, 0.09, 0.3, 10, mats.dark);
  winch.rotation.x = Math.PI / 2;
  winch.position.set(2.55, DECK_Y + 0.14, -1.45);
  g.add(winch);
  const fairlead = box(0.08, 0.08, 0.1, mats.gold);
  fairlead.position.set(2.85, DECK_Y + 0.1, -1.45);
  g.add(fairlead);
  // LEAP-1 wordmark on two bus panels
  const lCanvas = document.createElement('canvas');
  lCanvas.width = 256; lCanvas.height = 64;
  const lctx = lCanvas.getContext('2d');
  lctx.fillStyle = '#ffb43c';
  lctx.fillRect(6, 8, 10, 48);
  lctx.fillStyle = '#e8e5df';
  lctx.font = '700 44px Arial';
  lctx.fillText('LEAP-1', 28, 50);
  const lTex = new THREE.CanvasTexture(lCanvas);
  lTex.colorSpace = THREE.SRGBColorSpace;
  for (const pa of [Math.PI * 0.75, Math.PI * 1.75]) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.24), new THREE.MeshStandardMaterial({
      map: lTex, transparent: true, roughness: 0.6, metalness: 0.1,
      polygonOffset: true, polygonOffsetFactor: -1,
    }));
    decal.position.set(Math.cos(pa) * (BODY_R + 0.045), DECK_Y - 0.55, Math.sin(pa) * (BODY_R + 0.045));
    decal.rotation.y = -pa + Math.PI / 2;
    g.add(decal);
  }
  // hoses + contact probes on two legs
  for (const li of [0, 2]) {
    const a = (li / 4) * Math.PI * 2 + Math.PI / 4;
    const hx = Math.cos(a), hz = Math.sin(a);
    g.add(conduit([
      [hx * 2.9, DECK_Y - 0.6, hz * 2.9],
      [hx * 3.6, 1.05, hz * 3.6],
      [hx * 4.5, 0.35, hz * 4.5],
    ], 0.02, mats.black));
    const probe = cyl(0.012, 0.012, 0.7, 6, mats.alu);
    probe.position.set(hx * 5.35, 0.36, hz * 5.35);
    probe.rotation.z = hx * 0.9;
    probe.rotation.x = -hz * 0.9;
    g.add(probe);
  }
  const deckElecL2 = greebleCluster(83, 1.2, 0.7);
  deckElecL2.position.set(1.8, DECK_Y + 0.05, 1.4);
  g.add(deckElecL2);

  const mastL = cyl(0.025, 0.025, 1.1, 6, mats.alu);
  mastL.position.set(-1.6, DECK_Y + 0.55, -1.6);
  g.add(mastL);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), makeGlowMat(ACCENT));
  beacon.position.set(-1.6, DECK_Y + 1.15, -1.6);
  glows.push(beacon.material);
  g.add(beacon);

  // egress ramp: hinged at deck edge (+x), folds down to the surface.
  // rotation.z = 0 → stowed vertical; ~ -1.94 rad → deployed.
  const rampRoot = new THREE.Group();
  rampRoot.position.set(BODY_R, DECK_Y, 0);
  const rampLen = 6.0;
  for (const side of [-1, 1]) {
    const rail = box(rampLen, 0.08, 0.1, mats.body);
    rail.position.set(rampLen / 2 - 0.05, 0, side * 0.85);
    rampRoot.add(rail);
  }
  const plate = box(rampLen, 0.04, 1.76, mats.dark);
  plate.position.set(rampLen / 2 - 0.05, -0.02, 0);
  rampRoot.add(plate);
  for (let i = 0; i < 8; i++) {
    const rung = box(0.06, 0.05, 1.7, mats.dark);
    rung.position.set(0.35 + i * 0.72, 0.02, 0);
    rampRoot.add(rung);
  }
  rampRoot.rotation.z = Math.PI / 2 - 0.12; // stowed, angled up
  g.add(rampRoot);

  // engine glow (descent)
  const engineGlow = new THREE.PointLight(0xffc87a, 0, 18, 2);
  engineGlow.position.y = 0.5;
  g.add(engineGlow);

  markShadows(g);
  plumeGrp.traverse((o) => { o.castShadow = o.receiveShadow = false; });
  g.userData = {
    glows, lamp: new THREE.PointLight(0, 0, 0), ramp: rampRoot, engineGlow,
    plume: { grp: plumeGrp, mats: plumeMats, texs: plumeTexs, glow: nozzleGlow, state: { on: 0 }, len: 3.2 },
    clamps,
    deckY: DECK_Y,
    dish: dishL,
  };
  g.userData.lamp.intensity = 0; // interface parity with other machines
  g.add(g.userData.lamp);
  return g;
}

// ---------------- RELAY ORBITER ----------------
export function buildOrbiter() {
  const g = new THREE.Group();
  const bus = box(1.4, 1.2, 1.2, mats.mli);
  g.add(bus);
  for (const s of [-1, 1]) {
    const panel = box(4.4, 0.06, 1.5, mats.solar);
    panel.position.x = s * 3.0;
    g.add(panel);
  }
  const dish = makeDish(0.85);
  dish.position.y = -0.75;
  dish.rotation.x = Math.PI;
  g.add(dish);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), makeGlowMat(CYAN));
  led.position.set(0, 0.75, 0);
  g.add(led);
  g.userData = { led: led.material };
  return g;
}
