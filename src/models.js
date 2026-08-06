// ============================================================
// Procedural stylized-engineering models: EPOC / OASYS / CARTRIDGE
// Built from primitives — grey metal bodies, gold edge accents,
// emissive elements that come alive during the lunar night.
// ============================================================
import * as THREE from 'three';

const ACCENT = 0xffb43c;
const CYAN = 0x7fd8e8;

const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb8b6b0, metalness: 0.55, roughness: 0.45 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x3c3d42, metalness: 0.4, roughness: 0.7 });
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x26272c, metalness: 0.2, roughness: 0.9 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xcf9331, metalness: 0.7, roughness: 0.35 });
const edgeMat = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.55 });

// Emissive materials — intensity is driven per-frame by night factor.
export function makeGlowMat(color) {
  return new THREE.MeshStandardMaterial({
    color: 0x111111, emissive: color, emissiveIntensity: 0.4,
    metalness: 0.1, roughness: 0.6,
  });
}

function edges(mesh, mat = edgeMat) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 24), mat);
  mesh.add(e);
  return e;
}

function box(w, h, d, mat = bodyMat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function cyl(rt, rb, h, seg, mat = bodyMat) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
}

function wheel(r = 0.34, w = 0.22) {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18), wheelMat);
  tire.rotation.x = Math.PI / 2;
  g.add(tire);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.04, 12), darkMat);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  // grouser ridges
  for (let i = 0; i < 8; i++) {
    const ridge = box(0.05, r * 2.02, w + 0.02, darkMat);
    ridge.rotation.z = (i / 8) * Math.PI;
    g.add(ridge);
  }
  return g;
}

// ---------------- EPOC — modular reusable rover ----------------
export function buildEpoc() {
  const g = new THREE.Group();
  const glows = [];

  // chassis
  const chassis = box(2.3, 0.5, 1.45);
  chassis.position.y = 0.78;
  edges(chassis);
  g.add(chassis);

  // belly plate
  const belly = box(1.9, 0.14, 1.1, darkMat);
  belly.position.y = 0.5;
  g.add(belly);

  // payload bay modules on deck (gold-edged, cyan glow slits)
  for (let i = 0; i < 2; i++) {
    const bay = box(0.72, 0.42, 1.1, darkMat);
    bay.position.set(-0.5 + i * 0.95, 1.24, 0);
    edges(bay);
    g.add(bay);
    const slit = box(0.74, 0.05, 0.06, makeGlowMat(CYAN));
    slit.position.set(-0.5 + i * 0.95, 1.3, 0.56);
    glows.push(slit.material);
    g.add(slit);
  }

  // wheels + rocker bogies — 6 wheels
  const wheelXs = [-0.85, 0, 0.85];
  for (const side of [-1, 1]) {
    for (const x of wheelXs) {
      const w = wheel();
      w.position.set(x, 0.34, side * 0.86);
      g.add(w);
    }
    const rocker = box(1.9, 0.09, 0.09, bodyMat);
    rocker.position.set(0, 0.62, side * 0.86);
    g.add(rocker);
  }

  // sensor mast
  const mast = cyl(0.045, 0.06, 0.95, 10, bodyMat);
  mast.position.set(0.85, 1.5, -0.3);
  g.add(mast);
  const head = box(0.42, 0.2, 0.24, darkMat);
  head.position.set(0.85, 2.0, -0.3);
  edges(head);
  g.add(head);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.055, 12), makeGlowMat(CYAN));
    eye.position.set(0.96 + 0.0, 2.0, -0.3 + side * 0.09);
    eye.rotation.y = Math.PI / 2;
    eye.position.x = 1.062;
    glows.push(eye.material);
    g.add(eye);
  }

  // robotic arm (3 segments + gripper), folded forward
  const armMatG = goldMat;
  const shoulder = cyl(0.09, 0.09, 0.16, 10, armMatG);
  shoulder.position.set(1.05, 1.1, 0.45);
  g.add(shoulder);
  const seg1 = box(0.62, 0.08, 0.08, bodyMat);
  seg1.position.set(1.32, 1.28, 0.45);
  seg1.rotation.z = 0.6;
  g.add(seg1);
  const seg2 = box(0.55, 0.07, 0.07, bodyMat);
  seg2.position.set(1.68, 1.34, 0.45);
  seg2.rotation.z = -0.85;
  g.add(seg2);
  const grip = box(0.14, 0.12, 0.1, darkMat);
  grip.position.set(1.85, 1.08, 0.45);
  g.add(grip);

  // nav beacon
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), makeGlowMat(ACCENT));
  beacon.position.set(-1.05, 1.12, 0);
  glows.push(beacon.material);
  g.add(beacon);

  // antenna
  const ant = cyl(0.012, 0.012, 0.7, 6, darkMat);
  ant.position.set(-0.95, 1.6, -0.5);
  g.add(ant);

  // work light (night)
  const lamp = new THREE.PointLight(ACCENT, 0, 7, 2);
  lamp.position.set(0.6, 1.6, 0.6);
  g.add(lamp);

  g.userData = { glows, lamp };
  return g;
}

// ---------------- OASYS — payload carrier trailer ----------------
export function buildOasys() {
  const g = new THREE.Group();
  const glows = [];

  // flatbed
  const bed = box(2.1, 0.22, 1.35);
  bed.position.y = 0.62;
  edges(bed);
  g.add(bed);

  // 8U payload bay grid — 2 x 4 modules
  for (let ix = 0; ix < 4; ix++) {
    for (let iz = 0; iz < 2; iz++) {
      const bay = box(0.42, 0.4, 0.52, darkMat);
      bay.position.set(-0.75 + ix * 0.5, 0.94, -0.3 + iz * 0.6);
      edges(bay);
      g.add(bay);
      const strip = box(0.44, 0.045, 0.045, makeGlowMat(CYAN));
      strip.position.set(-0.75 + ix * 0.5, 1.1, -0.3 + iz * 0.6 + 0.27);
      glows.push(strip.material);
      g.add(strip);
    }
  }

  // wheels — 4
  for (const side of [-1, 1]) {
    for (const x of [-0.6, 0.6]) {
      const w = wheel(0.3, 0.2);
      w.position.set(x, 0.3, side * 0.8);
      g.add(w);
    }
  }

  // tow bar (points toward rover, +x)
  const bar = box(0.85, 0.07, 0.07, goldMat);
  bar.position.set(1.35, 0.55, 0);
  bar.rotation.z = 0.12;
  g.add(bar);
  const hitch = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), goldMat);
  hitch.position.set(1.78, 0.6, 0);
  g.add(hitch);

  // marker beacon
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), makeGlowMat(ACCENT));
  beacon.position.set(-1.0, 0.85, 0.62);
  glows.push(beacon.material);
  g.add(beacon);

  const lamp = new THREE.PointLight(CYAN, 0, 6, 2);
  lamp.position.set(0, 1.5, 0);
  g.add(lamp);

  g.userData = { glows, lamp };
  return g;
}

// ---------------- CARTRIDGE — payload survival system ----------------
export function buildCartridge() {
  const g = new THREE.Group();
  const glows = [];

  // main capsule
  const bodyC = cyl(0.46, 0.52, 0.95, 14, bodyMat);
  bodyC.position.y = 0.62;
  edges(bodyC);
  g.add(bodyC);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.46, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat);
  dome.position.y = 1.1;
  g.add(dome);

  // base skirt
  const skirt = cyl(0.6, 0.68, 0.2, 14, darkMat);
  skirt.position.y = 0.1;
  g.add(skirt);

  // radiator fins — 4 radial
  for (let i = 0; i < 4; i++) {
    const fin = box(0.06, 0.75, 0.5, darkMat);
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    fin.position.set(Math.cos(a) * 0.62, 0.62, Math.sin(a) * 0.62);
    fin.rotation.y = -a;
    edges(fin);
    g.add(fin);
  }

  // survival core ring — the "heartbeat" glow
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.035, 10, 28), makeGlowMat(ACCENT));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.34;
  glows.push(ring.material);
  g.add(ring);

  // status window
  const win = box(0.2, 0.12, 0.03, makeGlowMat(CYAN));
  win.position.set(0, 0.85, 0.5);
  glows.push(win.material);
  g.add(win);

  // downlink dish
  const dishArm = cyl(0.02, 0.02, 0.42, 6, darkMat);
  dishArm.position.set(0.2, 1.4, -0.15);
  dishArm.rotation.z = -0.4;
  g.add(dishArm);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), bodyMat);
  dish.position.set(0.32, 1.58, -0.15);
  dish.rotation.x = -Math.PI / 2.4;
  dish.rotation.z = 0.5;
  g.add(dish);

  const lamp = new THREE.PointLight(ACCENT, 0, 6, 2);
  lamp.position.set(0, 1.3, 0.6);
  g.add(lamp);

  g.userData = { glows, lamp };
  return g;
}
