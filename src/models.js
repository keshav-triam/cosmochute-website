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
    color: 0xffffff, metalness: 0.85, roughness: 0.32,
  }),
  gold: new THREE.MeshStandardMaterial({ color: 0xcf9331, metalness: 0.8, roughness: 0.3 }),
  solar: new THREE.MeshStandardMaterial({ map: T.solar, color: 0xffffff, metalness: 0.55, roughness: 0.3 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.85, roughness: 0.35 }),
  pcb: new THREE.MeshStandardMaterial({ color: 0x1e3a2a, metalness: 0.2, roughness: 0.6 }),
  capSilver: new THREE.MeshStandardMaterial({ color: 0xc8cbd2, metalness: 0.9, roughness: 0.25 }),
};
const edgeMat = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.4 });

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
function meshWheel(r = 0.36, w = 0.26) {
  const g = new THREE.Group();
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
  const bodyC = box(CART_W, CART_H, CART_D, mats.black);
  edges(bodyC, new THREE.LineBasicMaterial({ color: 0x777a80, transparent: true, opacity: 0.55 }));
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
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), makeGlowMat(ACCENT));
  led.position.set(CART_W / 2 - 0.05, CART_H / 2 + 0.015, CART_D / 2 - 0.05);
  g.add(led);
  g.userData = { led: led.material, window: win.material, idx };
  return markShadows(g);
}

// ---------------- EPOC — modular reusable rover ----------------
export function buildEpoc() {
  const g = new THREE.Group();
  const glows = [];

  // --- chassis deck ---
  const chassis = box(2.05, 0.42, 1.3, mats.body);
  chassis.position.y = 0.98;
  edges(chassis);
  g.add(chassis);

  // gold MLI-wrapped avionics module
  const avionics = box(0.85, 0.4, 1.0, mats.mli);
  avionics.position.set(-0.45, 1.4, 0);
  g.add(avionics);
  // white radiator top
  const radiator = box(0.8, 0.04, 0.95, mats.body);
  radiator.position.set(-0.45, 1.62, 0);
  g.add(radiator);
  // deck instrument boxes
  const ib1 = box(0.5, 0.28, 0.5, mats.dark);
  ib1.position.set(0.45, 1.33, -0.3);
  edges(ib1);
  g.add(ib1);
  const solarTop = box(0.6, 0.03, 0.55, mats.solar);
  solarTop.position.set(0.45, 1.5, -0.28);
  g.add(solarTop);
  // exposed avionics: capacitors, wire runs, connectors on the deck
  const deckElec = greebleCluster(11, 0.7, 0.45);
  deckElec.position.set(0.45, 1.19, 0.32);
  g.add(deckElec);
  const sideElec = greebleCluster(23, 0.7, 0.32);
  sideElec.rotation.x = Math.PI / 2;
  sideElec.position.set(-0.45, 1.4, 0.515);
  g.add(sideElec);

  // --- BELLY CHAMBER — the 8U cartridge dock ---
  const chamberFrame = new THREE.Group();
  const cf = box(CART_W + 0.1, CART_H + 0.08, CART_D + 0.1, mats.dark);
  const cavity = box(CART_W + 0.02, CART_H + 0.02, CART_D + 0.02, mats.black);
  cavity.position.y = -0.015;
  chamberFrame.add(cf, cavity);
  const slitL = box(CART_W + 0.12, 0.02, 0.02, makeGlowMat(CYAN, 0x0a1418));
  slitL.position.set(0, -CART_H / 2 - 0.03, CART_D / 2 + 0.04);
  glows.push(slitL.material);
  chamberFrame.add(slitL);
  chamberFrame.position.set(0.3, 0.64, 0);
  g.add(chamberFrame);
  // belly anchor: where a docked cartridge's centre sits
  const bellyAnchor = new THREE.Object3D();
  bellyAnchor.position.set(0.3, 0.62, 0);
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
      const w = meshWheel(wheelR, 0.26);
      w.position.set(x, wheelR, z);
      g.add(w);
      wheels.push(w);
    }
  }

  // --- sensor mast ---
  const mast = cyl(0.04, 0.055, 1.05, 10, mats.alu);
  mast.position.set(0.8, 1.7, 0.34);
  g.add(mast);
  const head = box(0.4, 0.17, 0.2, mats.dark);
  head.position.set(0.8, 2.26, 0.34);
  edges(head);
  g.add(head);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), makeGlowMat(CYAN, 0x0a1418));
    eye.position.set(0.985, 2.26, 0.34 + side * 0.09);
    eye.rotation.y = Math.PI / 2;
    glows.push(eye.material);
    g.add(eye);
  }

  // --- high-gain dish (to relay orbiter) ---
  const dishArm = cyl(0.02, 0.02, 0.4, 6, mats.alu);
  dishArm.position.set(-0.95, 1.55, -0.4);
  g.add(dishArm);
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), mats.body);
  dish.position.set(-0.95, 1.78, -0.4);
  dish.rotation.x = -Math.PI / 3;
  g.add(dish);
  const dishTip = new THREE.Object3D();
  dishTip.position.set(-0.95, 1.85, -0.4);
  g.add(dishTip);

  // --- robotic arm (shoulder / elbow / wrist), rear-left ---
  const armRoot = new THREE.Group();
  armRoot.position.set(-0.85, 1.22, 0.45);
  const shoulderHub = cyl(0.09, 0.09, 0.14, 12, mats.gold);
  armRoot.add(shoulderHub);
  const upper = new THREE.Group();
  const upperSeg = box(0.06, 0.72, 0.06, mats.alu);
  upperSeg.position.y = 0.36;
  upper.add(upperSeg);
  const elbowHub = cyl(0.07, 0.07, 0.12, 10, mats.gold);
  elbowHub.rotation.x = Math.PI / 2;
  elbowHub.position.y = 0.72;
  upper.add(elbowHub);
  const fore = new THREE.Group();
  fore.position.y = 0.72;
  const foreSeg = box(0.05, 0.62, 0.05, mats.alu);
  foreSeg.position.y = 0.31;
  fore.add(foreSeg);
  const wrist = box(0.11, 0.1, 0.09, mats.dark);
  wrist.position.y = 0.64;
  fore.add(wrist);
  for (const s of [-1, 1]) {
    const finger = box(0.02, 0.12, 0.03, mats.alu);
    finger.position.set(s * 0.035, 0.74, 0);
    fore.add(finger);
  }
  const wristTip = new THREE.Object3D();
  wristTip.position.y = 0.8;
  fore.add(wristTip);
  upper.add(fore);
  armRoot.add(upper);
  g.add(armRoot);
  // stowed: folded back over the deck
  armRoot.rotation.z = -2.5;
  fore.rotation.z = 2.4;

  // --- lights ---
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), makeGlowMat(ACCENT));
  beacon.position.set(-1.0, 1.68, 0.45);
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
    arm: { root: armRoot, upper, fore, wristTip },
    bellyAnchor, dishTip,
  };
  return g;
}

// ---------------- OASys — payload reloading & storage trailer ----------------
export const OASYS_SLOTS = 8; // 2 rows x 4
export function buildOasys() {
  const g = new THREE.Group();
  const glows = [];

  // flatbed
  const bed = box(2.5, 0.16, 1.4, mats.body);
  bed.position.y = 0.56;
  edges(bed);
  g.add(bed);

  // open-top cartridge magazine
  const magW = 2.3, magH = 0.62, magD = 1.2, wall = 0.05;
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

  // 4 mesh wheels
  const wheels = [];
  const wheelR = 0.3;
  for (const side of [-1, 1]) {
    for (const x of [-0.72, 0.72]) {
      const w = meshWheel(wheelR, 0.22);
      w.position.set(x, wheelR, side * 0.84);
      g.add(w);
      wheels.push(w);
    }
    const skirt = box(1.9, 0.06, 0.06, mats.alu);
    skirt.position.set(0, 0.48, side * 0.84);
    g.add(skirt);
  }

  // tow bar (pivots up when unhitched)
  const towRoot = new THREE.Group();
  towRoot.position.set(1.28, 0.55, 0);
  const bar = box(0.95, 0.06, 0.06, mats.gold);
  bar.position.x = 0.48;
  towRoot.add(bar);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 14), mats.gold);
  eye.position.x = 0.98;
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
  strip.position.set(0, 0.62, 0.71);
  glows.push(strip.material);
  g.add(strip);

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
    edges(panel, new THREE.LineBasicMaterial({ color: 0x86837c, transparent: true, opacity: 0.5 }));
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

  // descent plume: additive cone, lit only while the engine burns
  const plumeMat = new THREE.MeshBasicMaterial({
    color: 0xffd9a0, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.72, 3.8, 16, 1, true), plumeMat);
  plume.rotation.x = Math.PI;
  plume.position.y = -1.75;
  g.add(plume);

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

  // --- comms: high-gain dish + antenna + beacon ---
  const dishArm = cyl(0.035, 0.035, 0.75, 8, mats.alu);
  dishArm.position.set(1.3, DECK_Y + 0.38, -2.2);
  g.add(dishArm);
  const dishL = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.5), mats.body);
  dishL.position.set(1.3, DECK_Y + 0.78, -2.2);
  dishL.rotation.x = -Math.PI / 2.6;
  dishL.rotation.z = 0.4;
  g.add(dishL);
  // deck utility electronics
  const deckElecL = greebleCluster(67, 1.4, 0.8);
  deckElecL.position.set(-0.6, DECK_Y + 0.05, 1.9);
  g.add(deckElecL);
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
    const rail = box(rampLen, 0.08, 0.1, mats.alu);
    rail.position.set(rampLen / 2 - 0.05, 0, side * 0.85);
    rampRoot.add(rail);
  }
  const plate = box(rampLen, 0.04, 1.76, mats.dark);
  plate.position.set(rampLen / 2 - 0.05, -0.02, 0);
  rampRoot.add(plate);
  for (let i = 0; i < 8; i++) {
    const rung = box(0.06, 0.05, 1.7, mats.alu);
    rung.position.set(0.35 + i * 0.72, 0.02, 0);
    rampRoot.add(rung);
  }
  rampRoot.rotation.z = Math.PI / 2 - 0.12; // stowed, angled up
  g.add(rampRoot);

  // engine glow (descent)
  const engineGlow = new THREE.PointLight(0xffc87a, 0, 22, 2);
  engineGlow.position.y = 0.5;
  g.add(engineGlow);

  markShadows(g);
  plume.castShadow = plume.receiveShadow = false; // additive gas, no shadow
  g.userData = { glows, lamp: new THREE.PointLight(0, 0, 0), ramp: rampRoot, engineGlow, plume: plumeMat, deckY: DECK_Y };
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
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), mats.body);
  dish.position.y = -0.9;
  dish.rotation.x = Math.PI;
  g.add(dish);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), makeGlowMat(CYAN));
  led.position.set(0, 0.75, 0);
  g.add(led);
  g.userData = { led: led.material };
  return g;
}
