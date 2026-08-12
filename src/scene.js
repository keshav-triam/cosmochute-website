// ============================================================
// The lunar world: terrain (with a sampleable height function),
// real-time sun shadows, starfield, Earth, relay orbiter, and a
// sun that travels one full day–night cycle as the page scrolls.
//
// Mission geography (1 unit ≈ 1 m):
//   LANDER SITE  (-16, -8)   flattened pad
//   BASECAMP     (-4, -1)    OASys parking, inside the main apron
//   ROUGH ZONE   x 4..17, z -20..-5  extra bumps + boulders
//   DEPLOY D1    (11, -13)   inside the rough zone
//   MONTAGE D2   (13, 6)
//   TRAILER HEAVEN (-11, 12) gentle rise
// ============================================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  buildEpoc, buildOasys, buildCartridge, buildLander, buildOrbiter,
  ACCENT, CYAN, OASYS_SLOTS,
} from './models.js';
import { T as TEX } from './textures.js';

// ---------------- tiny value-noise / fbm ----------------
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) {
  let f = 0, amp = 0.5, fr = 1;
  for (let i = 0; i < 4; i++) { f += amp * vnoise(x * fr, y * fr); amp *= 0.5; fr *= 2.1; }
  return f;
}
const smoothstep = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);

// ---------------- mission geography ----------------
export const SITES = {
  lander: new THREE.Vector3(-16, 0, -8),
  basecamp: new THREE.Vector3(-4, 0, -1),
  deploy1: new THREE.Vector3(11, 0, -13),
  deploy2: new THREE.Vector3(13, 0, 6),
  heaven: new THREE.Vector3(30, 0, 3),
  exit: new THREE.Vector3(80, 0, -12),
};

const craters = [
  { x: -42, z: -58, r: 26, d: 5.5 }, { x: 55, z: -84, r: 34, d: 7 },
  { x: -95, z: 30, r: 40, d: 8 }, { x: 34, z: 62, r: 22, d: 4.5 },
  { x: 110, z: -20, r: 30, d: 6 }, { x: -60, z: -130, r: 45, d: 9 },
  { x: 8, z: -42, r: 14, d: 3 }, { x: -30, z: 46, r: 16, d: 3.2 },
  { x: 16, z: 9, r: 7, d: 1.7 }, // crater site two — payload 2 deploys on its floor
];

// terrain height — the single source of truth, used for geometry
// displacement AND for placing vehicles / sampling paths
export function terrainHeight(x, z) {
  let h = fbm(x * 0.02, z * 0.02) * 7 - 2.2;
  h += fbm(x * 0.09, z * 0.09) * 1.1;
  for (const c of craters) {
    const dist = Math.hypot(x - c.x, z - c.z);
    if (dist < c.r) {
      const t = dist / c.r;
      h -= Math.cos(t * Math.PI * 0.5) * c.d;
      h += Math.exp(-Math.pow((t - 0.92) * 9, 2)) * c.d * 0.35;
    }
  }
  // main operations apron: flatten around the origin
  const dOrigin = Math.hypot(x, z);
  let flat = smoothstep(dOrigin, 8, 34);
  // lander pad: flatten around the landing site
  const dLander = Math.hypot(x - SITES.lander.x, z - SITES.lander.z);
  flat = Math.min(flat, smoothstep(dLander, 5, 14));
  h *= flat;
  // rough zone: choppy terrain EPOC crosses alone (kept out of the apron mask)
  const rx = smoothstep(x, 3, 6) * (1 - smoothstep(x, 15, 19));
  const rz = smoothstep(z, -21, -17) * (1 - smoothstep(z, -8, -4));
  const rough = rx * rz;
  h += rough * (fbm(x * 0.35, z * 0.35) * 1.7 - 0.5);
  // deploy pocket: calm spot inside the rough zone
  const dD1 = Math.hypot(x - SITES.deploy1.x, z - SITES.deploy1.z);
  h *= THREE.MathUtils.lerp(1, smoothstep(dD1, 1.2, 4), rough);
  // Trailer Heaven: a gentle scenic rise
  const dTH = Math.hypot(x - SITES.heaven.x, z - SITES.heaven.z);
  h += Math.exp(-Math.pow(dTH / 9, 2)) * 1.5;
  return h;
}

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030408);
  scene.fog = new THREE.FogExp2(0x05060a, 0.003);

  // subtle environment reflections for the metals, generated from the
  // real sky panorama (mostly dark, with the galactic band as a streak)
  const pmrem = new THREE.PMREMGenerator(renderer);
  new THREE.TextureLoader().load('/textures/stars_milky_way.jpg', (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.environment = pmrem.fromEquirectangular(t).texture;
    scene.environmentIntensity = 0.5;
    t.dispose();
    pmrem.dispose();
  });

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1200);

  // cinematic pipeline: multisampled HDR buffer -> subtle bloom -> ACES
  // output. Bloom lifts the sun, the plume, and the night-time glows into
  // photographic territory without washing out the day scenes.
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(
    window.innerWidth, window.innerHeight,
    { samples: 4, type: THREE.HalfFloatType },
  ));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.26, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------------- lights ----------------
  const sun = new THREE.DirectionalLight(0xfff3e0, 3.2);
  sun.position.set(40, 50, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(window.innerWidth > 900 ? 4096 : 2048, window.innerWidth > 900 ? 4096 : 2048);
  sun.shadow.camera.near = 180;
  sun.shadow.camera.far = 460;
  sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  sun.target.position.set(0, 0, 0);
  scene.add(sun.target);

  const fillSky = new THREE.HemisphereLight(0x223044, 0x0a0a0c, 0.35);
  scene.add(fillSky);

  const earthshine = new THREE.DirectionalLight(0x5a7aa8, 0.12);
  earthshine.position.set(-18, 30, -50);
  scene.add(earthshine);

  // ---------------- terrain ----------------
  const T_SIZE = 460, T_SEG = 264;
  const terrainGeo = new THREE.PlaneGeometry(T_SIZE, T_SIZE, T_SEG, T_SEG);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  // near-white multipliers over the regolith albedo map (macro patchiness)
  const colors = new Float32Array(pos.count * 3);
  const cBase = new THREE.Color(0xffffff);
  const cDark = new THREE.Color(0xc8c4bc);
  const cLight = new THREE.Color(0xfffdf6);
  const tmpC = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
    // subtle albedo variation
    const n = fbm(x * 0.13 + 40, z * 0.13 - 40);
    tmpC.copy(cBase).lerp(n > 0.55 ? cLight : cDark, Math.abs(n - 0.55) * 1.6);
    colors[i * 3] = tmpC.r; colors[i * 3 + 1] = tmpC.g; colors[i * 3 + 2] = tmpC.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();
  // photoreal regolith: tiled baked albedo + normal detail over the
  // displaced geometry; vertex colors carry the macro patchiness
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const TERRAIN_REPEAT = 58;
  for (const t of [TEX.regolith, TEX.regolithN]) {
    t.repeat.set(TERRAIN_REPEAT, TERRAIN_REPEAT);
    t.anisotropy = Math.min(8, maxAniso);
  }
  const terrainMat = new THREE.MeshStandardMaterial({
    map: TEX.regolith, normalMap: TEX.regolithN,
    normalScale: new THREE.Vector2(1.05, 1.05),
    vertexColors: true, roughness: 1, metalness: 0,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  scene.add(terrain);

  // distant rim mountains — a ring of low peaks on the horizon
  const rimGeo = new THREE.PlaneGeometry(1, 1); // placeholder, replaced below
  const rimPts = [];
  const RIM_R = 210, RIM_N = 90;
  for (let i = 0; i <= RIM_N; i++) {
    const a = (i / RIM_N) * Math.PI * 2;
    const r = RIM_R + hash(i, 3) * 26;
    const hpk = 6 + fbm(i * 0.35, 7) * 20;
    rimPts.push({ a, r, h: hpk });
  }
  const rimPositions = [];
  for (let i = 0; i < RIM_N; i++) {
    const p0 = rimPts[i], p1 = rimPts[i + 1];
    const x0 = Math.cos(p0.a) * p0.r, z0 = Math.sin(p0.a) * p0.r;
    const x1 = Math.cos(p1.a) * p1.r, z1 = Math.sin(p1.a) * p1.r;
    rimPositions.push(x0, -4, z0, x1, -4, z1, x0, p0.h, z0);
    rimPositions.push(x1, -4, z1, x1, p1.h, z1, x0, p0.h, z0);
  }
  const rimBufGeo = new THREE.BufferGeometry();
  rimBufGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rimPositions), 3));
  rimBufGeo.computeVertexNormals();
  // rough planar UVs so the rim picks up the regolith texture
  const rimPosAttr = rimBufGeo.attributes.position;
  const rimUV = new Float32Array(rimPosAttr.count * 2);
  for (let i = 0; i < rimPosAttr.count; i++) {
    rimUV[i * 2] = (rimPosAttr.getX(i) + rimPosAttr.getZ(i)) / 60;
    rimUV[i * 2 + 1] = rimPosAttr.getY(i) / 30;
  }
  rimBufGeo.setAttribute('uv', new THREE.BufferAttribute(rimUV, 2));
  const rim = new THREE.Mesh(rimBufGeo, new THREE.MeshStandardMaterial({
    map: TEX.regolithRim, color: 0x8d897f, roughness: 1, flatShading: true,
  }));
  scene.add(rim);

  // ---------------- rocks ----------------
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({
    map: TEX.rock, normalMap: TEX.rockN, normalScale: new THREE.Vector2(0.9, 0.9),
    color: 0xb5b0a6, roughness: 1, flatShading: true,
  });
  const ROCKS = 240;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, ROCKS);
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  const m4 = new THREE.Matrix4();
  let placed = 0, tries = 0;
  while (placed < ROCKS && tries < 4000) {
    tries++;
    const i = tries;
    const a = hash(i, 7) * Math.PI * 2;
    const r = 10 + Math.pow(hash(i, 13), 0.7) * 170;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    // keep sites AND every driving corridor clear (approximated by the
    // straight lanes between mission waypoints, wide enough to cover the
    // actual curved paths)
    const nearSite = [SITES.lander, SITES.basecamp, SITES.deploy1, SITES.deploy2, SITES.heaven]
      .some((s) => Math.hypot(x - s.x, z - s.z) < 4.5);
    if (nearSite) continue;
    const lanes = [
      [SITES.lander, SITES.basecamp], [SITES.basecamp, SITES.deploy1],
      [SITES.deploy1, SITES.deploy2], [SITES.deploy2, SITES.heaven],
      [SITES.heaven, SITES.exit],
    ];
    let onLane = false;
    for (const [la, lb] of lanes) {
      const abx = lb.x - la.x, abz = lb.z - la.z;
      const tt = Math.max(0, Math.min(1, ((x - la.x) * abx + (z - la.z) * abz) / (abx * abx + abz * abz)));
      const ddx = x - (la.x + abx * tt), ddz = z - (la.z + abz * tt);
      if (ddx * ddx + ddz * ddz < 3.4 * 3.4) { onLane = true; break; }
    }
    if (onLane) continue;
    let s = 0.14 + Math.pow(hash(i, 29), 2.2) * 2.0;
    // extra boulders in the rough zone
    const inRough = x > 4 && x < 17 && z > -20 && z < -5;
    if (inRough && hash(i, 31) > 0.5) s *= 1.5;
    m4.compose(
      new THREE.Vector3(x, terrainHeight(x, z) + s * 0.25, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(hash(i, 3) * 3, hash(i, 5) * 3, 0)),
      new THREE.Vector3(s, s * 0.75, s),
    );
    rocks.setMatrixAt(placed, m4);
    placed++;
  }
  rocks.count = placed;
  scene.add(rocks);

  // pebble field: small stones scattered thick through the play area —
  // ground clutter is half of what makes regolith read as real
  const PEBBLES = 1700;
  const pebbleGeo = new THREE.DodecahedronGeometry(1, 0);
  const pebbleMat = new THREE.MeshStandardMaterial({
    map: TEX.rock, normalMap: TEX.rockN, color: 0xaaa499, roughness: 1, flatShading: true,
  });
  const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, PEBBLES);
  pebbles.castShadow = true;
  pebbles.receiveShadow = true;
  let pplaced = 0, ptries = 0;
  while (pplaced < PEBBLES && ptries < 12000) {
    ptries++;
    const i = ptries + 9000;
    const aa = hash(i, 17) * Math.PI * 2;
    const rr = 3 + Math.pow(hash(i, 23), 0.6) * 52;
    const x = Math.cos(aa) * rr, z = Math.sin(aa) * rr;
    // keep the pads where hardware parks visually clean
    if (Math.hypot(x - SITES.lander.x, z - SITES.lander.z) < 5.6) continue;
    if (Math.hypot(x - SITES.basecamp.x, z - SITES.basecamp.z) < 2.2) continue;
    if (Math.hypot(x - SITES.heaven.x, z - SITES.heaven.z) < 2.2) continue;
    const s = 0.03 + Math.pow(hash(i, 37), 1.8) * 0.13;
    m4.compose(
      new THREE.Vector3(x, terrainHeight(x, z) + s * 0.3, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(hash(i, 41) * 3, hash(i, 43) * 3, hash(i, 47) * 3)),
      new THREE.Vector3(s, s * 0.7, s),
    );
    pebbles.setMatrixAt(pplaced, m4);
    pplaced++;
  }
  pebbles.count = pplaced;
  scene.add(pebbles);

  // ---------------- starfield ----------------
  const starCount = 2400;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.95);
    const r = 900;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi) * 0.9 + 20;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xdfe6f0, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.7, depthWrite: false, fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ---------------- Milky Way sky dome ----------------
  // real panorama; washed out in daylight, blazing at night
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(1000, 40, 24),
    new THREE.MeshBasicMaterial({
      map: TEX.milkyWay, side: THREE.BackSide, fog: false,
      transparent: true, opacity: 0.9, depthWrite: false,
    }),
  );
  skyDome.rotation.z = 0.5;
  skyDome.rotation.y = 1.9;
  skyDome.renderOrder = -1;
  scene.add(skyDome);

  // ---------------- Earth (real day-map imagery) ----------------
  const earthGrp = new THREE.Group();
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(13, 48, 48),
    new THREE.MeshStandardMaterial({
      map: TEX.earth, roughness: 0.85, metalness: 0,
      emissive: 0xffffff, emissiveMap: TEX.earth, emissiveIntensity: 0.32,
      fog: false,
    }),
  );
  earthGrp.add(earth);
  const glowTex = makeGlowTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0x6fa8ff, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  glow.scale.setScalar(56);
  earthGrp.add(glow);
  earthGrp.position.set(-170, 200, -430);
  scene.add(earthGrp);

  // sun disc sprite
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffdca0, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sunSprite.scale.setScalar(130);
  scene.add(sunSprite);

  // ---------------- the machines ----------------
  // showcase display positions (used by the night-time stack section);
  // the mission timeline moves them from here
  const epoc = buildEpoc();
  epoc.position.set(0, 0, 0);
  epoc.rotation.y = -0.25;
  scene.add(epoc);

  const oasys = buildOasys();
  oasys.position.set(-3.4, 0, 0.9);
  oasys.rotation.y = -0.18;
  scene.add(oasys);

  // display cartridge for the stack showcase (scaled up on a plinth)
  const cartDisplay = buildCartridge(99);
  cartDisplay.scale.setScalar(2.6);
  cartDisplay.position.set(3.1, 0.9, -1.4);
  cartDisplay.rotation.y = 0.5;
  scene.add(cartDisplay);
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.75, 0.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x3a3b40, roughness: 0.8 }),
  );
  plinth.position.set(3.1, 0.25, -1.4);
  plinth.castShadow = plinth.receiveShadow = true;
  scene.add(plinth);

  // magazine cartridges. Scene-level (world space) so they can transfer
  // between OASys slots and EPOC's belly: every frame each cartridge is
  // glued to its current anchor ('slot' | 'belly'), or interpolated
  // between the two while the arm swings it across ('arc', arcT 0..1).
  // All state is set by the scrubbed mission timeline => deterministic.
  const cartridges = [];
  for (let i = 0; i < OASYS_SLOTS; i++) {
    const c = buildCartridge(i);
    c.userData.fromA = 'slot';
    c.userData.toA = 'slot';
    c.userData.blend = 0;
    c.userData.dimmed = false;
    c.userData.boost = 0;
    scene.add(c);
    cartridges.push(c);
  }
  const anchorA = new THREE.Vector3();
  const anchorB = new THREE.Vector3();
  const corridorV = new THREE.Vector3();
  function anchorPos(c, name, out) {
    if (name === 'slot') {
      oasys.userData.slots[c.userData.idx].getWorldPosition(out);
    } else if (name === 'belly') {
      epoc.userData.bellyAnchor.getWorldPosition(out);
    } else { // 'wrist' — hang just below the gripper fingers
      epoc.userData.arm.wristTip.getWorldPosition(out);
      out.y -= 0.2;
    }
    return out;
  }
  function anchorYaw(name) {
    return name === 'slot' ? oasys.rotation.y : epoc.rotation.y;
  }
  function glueCartridges() {
    for (const c of cartridges) {
      const { fromA, toA } = c.userData;
      if (fromA === toA) {
        anchorPos(c, fromA, c.position);
        c.rotation.y = anchorYaw(fromA);
      } else {
        const b = THREE.MathUtils.smoothstep(c.userData.blend, 0, 1);
        anchorPos(c, fromA, anchorA);
        anchorPos(c, toA, anchorB);
        c.position.lerpVectors(anchorA, anchorB, b);
        // small arc: over the magazine rim on slot transfers, a gentle
        // settle into the top-loading bay on seat transfers
        const lift = (fromA === 'slot' || toA === 'slot') ? 0.35 : 0.05;
        c.position.y += Math.sin(b * Math.PI) * lift;
        c.rotation.y = THREE.MathUtils.lerp(anchorYaw(fromA), anchorYaw(toA), b);
      }
    }
  }

  // the lander, parked out at the landing site (visible from afar in
  // early sections; the mission timeline flies it in from the sky)
  const lander = buildLander();
  lander.position.copy(SITES.lander);
  lander.position.y = terrainHeight(SITES.lander.x, SITES.lander.z);
  lander.rotation.y = 0.3;
  scene.add(lander);

  // relay orbiter, drifting across the sky
  const orbiter = buildOrbiter();
  orbiter.scale.setScalar(1.7);
  scene.add(orbiter);

  // downlink beam (EPOC dish -> orbiter), shown during operations
  const beamGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(), new THREE.Vector3(0, 1, 0),
  ]);
  const beam = new THREE.Line(beamGeo, new THREE.LineDashedMaterial({
    color: CYAN, transparent: true, opacity: 0, dashSize: 1.2, gapSize: 0.8, fog: false,
  }));
  beam.frustumCulled = false;
  scene.add(beam);

  // launch streak: bright sprite + trail, from Earth toward the Moon
  const streak = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffe9c0, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  streak.scale.setScalar(9);
  scene.add(streak);
  const TRAIL_N = 60;
  const trailPos = new Float32Array(TRAIL_N * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
    color: 0xffc87a, transparent: true, opacity: 0, fog: false,
  }));
  trail.frustumCulled = false;
  scene.add(trail);
  const streakCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-170, 196, -428),
    new THREE.Vector3(-90, 170, -320),
    new THREE.Vector3(-10, 120, -240),
    new THREE.Vector3(70, 60, -190),
  ]);

  // landing dust: expanding ring sprite at touchdown
  const splash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0xd8c49e, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  splash.scale.set(4, 1.2, 1);
  scene.add(splash);

  // permanent scorched patch under the engine after touchdown
  const scorch = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0x0b0a08, transparent: true, opacity: 0,
    depthWrite: false,
  }));
  scorch.scale.set(7.5, 7.5, 1);
  scorch.position.set(SITES.lander.x, terrainHeight(SITES.lander.x, SITES.lander.z) + 0.3, SITES.lander.z);
  scene.add(scorch);

  const dust = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xa89f8e, transparent: true, opacity: 0,
    depthWrite: false,
  }));
  dust.scale.set(1, 0.35, 1);
  dust.position.set(SITES.lander.x, terrainHeight(SITES.lander.x, SITES.lander.z) + 0.6, SITES.lander.z);
  scene.add(dust);

  const machines = [epoc, oasys, lander];

  // ---------------- day–night cycle ----------------
  // elevation keyframes over page progress; rebuilt at runtime by
  // setPhaseKeys() so the story beats track the real section layout
  let elKeys = [
    [0.0, 42], [0.1, 14], [0.16, 2], [0.22, -14],
    [0.42, -16], [0.47, -4], [0.5, 6], [0.56, 18], [1.0, 45],
  ];
  function setPhaseKeys(keys) { elKeys = keys; }
  function sunElevation(p) {
    for (let i = 0; i < elKeys.length - 1; i++) {
      const [p0, e0] = elKeys[i], [p1, e1] = elKeys[i + 1];
      if (p >= p0 && p <= p1) {
        const t = smoothstep((p - p0) / (p1 - p0), 0, 1);
        return e0 + (e1 - e0) * t;
      }
    }
    return elKeys[elKeys.length - 1][1];
  }

  const dayColor = new THREE.Color(0xfff3e0);
  const sunsetColor = new THREE.Color(0xff7a2e);
  const dawnColor = new THREE.Color(0xffb43c);
  const tmpColor = new THREE.Color();

  const state = { phase: 0, night: 0 };

  function applyPhase(p) {
    state.phase = p;
    const el = sunElevation(p);
    const elRad = THREE.MathUtils.degToRad(el);
    const az = THREE.MathUtils.degToRad(205 - p * 60);
    const R = 300;
    sun.position.set(
      Math.cos(elRad) * Math.sin(az) * R,
      Math.sin(elRad) * R,
      Math.cos(elRad) * Math.cos(az) * R,
    );
    sunSprite.position.copy(sun.position).multiplyScalar(1.9);

    const horizon = 1 - THREE.MathUtils.clamp(Math.abs(el) / 18, 0, 1);
    const daylight = THREE.MathUtils.clamp((el + 4) / 14, 0, 1);
    const night = 1 - daylight;
    state.night = night;

    const horizonCol = p < 0.5 ? sunsetColor : dawnColor;
    tmpColor.copy(dayColor).lerp(horizonCol, horizon * 0.9);
    sun.color.copy(tmpColor);
    sun.intensity = 4.1 * daylight;
    sunSprite.material.opacity = daylight * (0.55 + horizon * 0.45);
    sunSprite.material.color.copy(tmpColor);

    fillSky.intensity = 0.06 + daylight * 0.32;
    earthshine.intensity = 0.08 + night * 0.3;
    starMat.opacity = 0.25 + night * 0.75;
    skyDome.material.opacity = 0.14 + night * 0.86;

    const glowI = 0.35 + night * 2.4;
    for (const m of machines) {
      for (const g of m.userData.glows) g.emissiveIntensity = glowI;
    }
    for (const c of cartridges) {
      // dimmed = spent payload; boost = operating; held = in the gripper
      const dim = c.userData.dimmed ? 0.15 : 1;
      const boost = c.userData.boost || 0;
      const held = (c.userData.fromA === 'wrist' || c.userData.toA === 'wrist') ? 2.6 : 0;
      c.userData.led.emissiveIntensity = glowI * dim + boost * 3 + held;
      c.userData.window.emissiveIntensity = glowI * 0.7 * dim + boost * 2 + held * 0.8;
    }
    cartDisplay.userData.led.emissiveIntensity = glowI;
    cartDisplay.userData.window.emissiveIntensity = glowI;

    scene.fog.density = 0.0026 + night * 0.0013;
    renderer.toneMappingExposure = 1.02 + daylight * 0.16;

    return { el, daylight, night };
  }

  applyPhase(0);

  // ---------------- helper textures ----------------
  function makeGlowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  // ---------------- camera state + render loop ----------------
  const camState = {
    x: 0, y: 2.3, z: 10.2,
    tx: 0, ty: 1.0, tz: 0,
    shake: 0, // handheld float amplitude multiplier
  };
  const lookTarget = new THREE.Vector3();
  const clock = new THREE.Clock();
  const dishWorld = new THREE.Vector3();

  function render() {
    const t = clock.getElapsedTime();
    const dt = Math.min(0.1, t - (render._lt ?? t));
    render._lt = t;
    const fx = Math.sin(t * 0.32) * 0.12 * (1 + camState.shake);
    const fy = Math.sin(t * 0.21) * 0.07 * (1 + camState.shake);
    camera.position.set(camState.x + fx, camState.y + fy, camState.z);
    lookTarget.set(camState.tx, camState.ty, camState.tz);
    camera.lookAt(lookTarget);

    earth.rotation.y = t * 0.02;
    stars.rotation.y = t * 0.004;

    // relay orbiter: distant satellite arc — far enough to read as a
    // glint crossing the sky, never a floating billboard
    const oa = t * 0.04;
    orbiter.position.set(Math.cos(oa) * 520, 300 + Math.sin(oa * 0.7) * 30, Math.sin(oa) * 520 - 80);
    orbiter.rotation.y = oa + Math.PI / 2;

    // downlink beam follows EPOC dish and the orbiter
    if (beam.material.opacity > 0.01) {
      epoc.userData.dishTip.getWorldPosition(dishWorld);
      const bp = beam.geometry.attributes.position;
      bp.setXYZ(0, dishWorld.x, dishWorld.y, dishWorld.z);
      bp.setXYZ(1, orbiter.position.x, orbiter.position.y, orbiter.position.z);
      bp.needsUpdate = true;
      beam.computeLineDistances();
    }

    // descent plume: throttle comes from the mission timeline; flicker,
    // length clamping (never pierce the surface) and the ground splash
    // are cosmetic and derived live from the lander's height
    const pl = lander.userData.plume;
    if (pl.state.on > 0.001) {
      const on = pl.state.on;
      const flick = 1 + Math.sin(t * 41) * 0.05 + Math.sin(t * 97) * 0.03;
      const nozzleY = lander.position.y + 0.16;
      const clearance = Math.max(0.25, nozzleY - 0.04);
      pl.grp.scale.set(flick, Math.min(1, clearance / pl.len), flick);
      const throttle = 0.82 + Math.sin(t * 53) * 0.1 + Math.sin(t * 131) * 0.08;
      for (const m of pl.mats) m.opacity = Math.min(1, m.userData.baseOp * on * throttle);
      // exhaust streams away from the nozzle at layer-specific speeds
      pl.texs[0].offset.y += dt * 3.2;
      pl.texs[1].offset.y += dt * 2.1;
      pl.texs[2].offset.y += dt * 1.3;
      pl.glow.material.opacity = 0.95 * on * throttle;
      const near = THREE.MathUtils.clamp(1 - (nozzleY - 0.3) / 7, 0, 1);
      splash.material.opacity = 0.55 * on * near;
      splash.scale.set(3 + near * 10, 0.8 + near * 2.4, 1);
      splash.position.set(lander.position.x, 0.3, lander.position.z);
    } else if (pl.mats[0].opacity > 0) {
      for (const m of pl.mats) m.opacity = 0;
      pl.glow.material.opacity = 0;
      splash.material.opacity = 0;
    }

    // beacon breathing at night; lampBoost is a mission-timeline channel
    // (e.g. OASys' warm send-off glow in Trailer Heaven)
    const pulse = 0.75 + Math.sin(t * 2.2) * 0.25;
    epoc.userData.lamp.intensity = state.night * 4.5 * pulse + (epoc.userData.lampBoost || 0);
    oasys.userData.lamp.intensity = state.night * 4.0 * pulse + (oasys.userData.lampBoost || 0);

    glueCartridges();
    composer.render();
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  return {
    renderer, scene, camera, camState, applyPhase, setPhaseKeys, render, state,
    terrainHeight, SITES,
    actors: {
      epoc, oasys, cartridges, cartDisplay, plinth, lander, orbiter,
      beam, streak, trail, streakCurve, trailPos, trailGeo, dust, scorch,
    },
  };
}
