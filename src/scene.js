// ============================================================
// The lunar world: terrain, starfield, Earth, and a sun that
// travels one full day–night cycle as the page scrolls.
// ============================================================
import * as THREE from 'three';
import { buildEpoc, buildOasys, buildCartridge } from './models.js';

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

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030408);
  scene.fog = new THREE.FogExp2(0x05060a, 0.0065);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 900);

  // ---------------- lights ----------------
  const sun = new THREE.DirectionalLight(0xfff3e0, 3.2);
  sun.position.set(40, 50, 20);
  scene.add(sun);
  scene.add(sun.target);

  const fillSky = new THREE.HemisphereLight(0x223044, 0x0a0a0c, 0.35);
  scene.add(fillSky);

  // earthshine — faint cool fill so night isn't pitch black
  const earthshine = new THREE.DirectionalLight(0x5a7aa8, 0.12);
  earthshine.position.set(-18, 30, -50);
  scene.add(earthshine);

  // ---------------- terrain ----------------
  const T_SIZE = 420, T_SEG = 150;
  const terrainGeo = new THREE.PlaneGeometry(T_SIZE, T_SIZE, T_SEG, T_SEG);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  const craters = [
    { x: -38, z: -55, r: 26, d: 5.5 }, { x: 55, z: -80, r: 34, d: 7 },
    { x: -95, z: 30, r: 40, d: 8 }, { x: 30, z: 60, r: 22, d: 4.5 },
    { x: 110, z: -20, r: 30, d: 6 }, { x: -60, z: -130, r: 45, d: 9 },
  ];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    let h = fbm(x * 0.02, z * 0.02) * 7 - 2.2;
    h += fbm(x * 0.09, z * 0.09) * 1.1;
    // crater bowls with raised rims
    for (const c of craters) {
      const dist = Math.hypot(x - c.x, z - c.z);
      if (dist < c.r) {
        const t = dist / c.r;
        h -= Math.cos(t * Math.PI * 0.5) * c.d;      // bowl
        h += Math.exp(-Math.pow((t - 0.92) * 9, 2)) * c.d * 0.35; // rim
      }
    }
    // flatten a working apron around the convoy at origin
    const dOrigin = Math.hypot(x, z);
    const flat = THREE.MathUtils.smoothstep(dOrigin, 6, 30);
    pos.setY(i, h * flat);
  }
  terrainGeo.computeVertexNormals();
  const terrainMat = new THREE.MeshStandardMaterial({
    color: 0x9a958c, roughness: 1, metalness: 0, flatShading: true,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  scene.add(terrain);

  // scattered boulders
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7d786f, roughness: 1, flatShading: true });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 90);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 90; i++) {
    const a = hash(i, 7) * Math.PI * 2;
    const r = 14 + hash(i, 13) * 150;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const s = 0.25 + hash(i, 29) * 1.6;
    m4.compose(
      new THREE.Vector3(x, s * 0.3, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(hash(i, 3) * 3, hash(i, 5) * 3, 0)),
      new THREE.Vector3(s, s * 0.8, s),
    );
    rocks.setMatrixAt(i, m4);
  }
  scene.add(rocks);

  // ---------------- starfield ----------------
  const starCount = 2200;
  const starPos = new Float32Array(starCount * 3);
  const starSize = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    // dome distribution
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.95);
    const r = 700;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi) * 0.9 + 20;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    starSize[i] = Math.random();
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xdfe6f0, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.7, depthWrite: false, fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // ---------------- Earth in the sky ----------------
  const earthGrp = new THREE.Group();
  const earthTex = makeEarthTexture();
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(11, 32, 32),
    new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.9, emissive: 0x1a2c4a, emissiveIntensity: 0.55, fog: false }),
  );
  earthGrp.add(earth);
  const glowTex = makeGlowTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0x6fa8ff, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  glow.scale.setScalar(48);
  earthGrp.add(glow);
  earthGrp.position.set(-160, 190, -420);
  scene.add(earthGrp);

  // sun disc sprite (visible when above horizon)
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffdca0, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sunSprite.scale.setScalar(120);
  scene.add(sunSprite);

  // ---------------- the machines ----------------
  const epoc = buildEpoc();
  epoc.position.set(0, 0, 0);
  epoc.rotation.y = -0.25;
  scene.add(epoc);

  const oasys = buildOasys();
  oasys.position.set(-3.4, 0, 0.9);
  oasys.rotation.y = -0.18;
  scene.add(oasys);

  const cartridge = buildCartridge();
  cartridge.position.set(3.1, 0, -1.4);
  cartridge.rotation.y = 0.5;
  scene.add(cartridge);

  const machines = [epoc, oasys, cartridge];

  // ---------------- day-night cycle ----------------
  // phase p ∈ [0,1] across the whole page scroll.
  // Sun elevation in degrees — long night in the middle of the story.
  // tuned to the section layout: sunset through THE PROBLEM, nightfall at
  // THE THESIS, deep night across the whole STACK showcase, dawn breaking
  // in CAPABILITIES, sunrise on THE CYCLE, full day for the MANIFESTO
  const elKeys = [
    [0.0, 42], [0.14, 14], [0.24, 2], [0.32, -14],
    [0.68, -16], [0.76, -4], [0.82, 4], [0.90, 16], [1.0, 40],
  ];
  function sunElevation(p) {
    for (let i = 0; i < elKeys.length - 1; i++) {
      const [p0, e0] = elKeys[i], [p1, e1] = elKeys[i + 1];
      if (p >= p0 && p <= p1) {
        const t = THREE.MathUtils.smoothstep((p - p0) / (p1 - p0), 0, 1);
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
    // azimuth swings front-left (sunset) to front-right (sunrise) so the
    // sun stays in view of the default camera, which faces -z
    const az = THREE.MathUtils.degToRad(205 - p * 60);
    const R = 300;
    sun.position.set(
      Math.cos(elRad) * Math.sin(az) * R,
      Math.sin(elRad) * R,
      Math.cos(elRad) * Math.cos(az) * R,
    );
    sunSprite.position.copy(sun.position).multiplyScalar(1.6);

    // horizon proximity 0..1 (1 = at horizon)
    const horizon = 1 - THREE.MathUtils.clamp(Math.abs(el) / 18, 0, 1);
    // daylight factor 0..1
    const daylight = THREE.MathUtils.clamp((el + 4) / 14, 0, 1);
    const night = 1 - daylight;
    state.night = night;

    // sun colour: white high, deep orange at the horizon; second half warms gold (dawn)
    const horizonCol = p < 0.5 ? sunsetColor : dawnColor;
    tmpColor.copy(dayColor).lerp(horizonCol, horizon * 0.9);
    sun.color.copy(tmpColor);
    sun.intensity = 3.4 * daylight + 0.0;
    sunSprite.material.opacity = daylight * (0.55 + horizon * 0.45);
    sunSprite.material.color.copy(tmpColor);

    fillSky.intensity = 0.06 + daylight * 0.32;
    earthshine.intensity = 0.06 + night * 0.22;

    // stars wash out in daylight
    starMat.opacity = 0.25 + night * 0.75;

    // machine glow ramps up at night
    const glowI = 0.35 + night * 2.4;
    const lampI = night * 4.5;
    for (const m of machines) {
      for (const g of m.userData.glows) g.emissiveIntensity = glowI;
      m.userData.lamp.intensity = lampI;
    }

    // fog subtly denser at night for depth
    scene.fog.density = 0.0055 + night * 0.002;
    renderer.toneMappingExposure = 1.0 + daylight * 0.1;

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
  function makeEarthTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1c4d8f';
    ctx.fillRect(0, 0, 256, 128);
    // continents — rough noise blobs
    ctx.fillStyle = '#2f7a4f';
    for (let i = 0; i < 26; i++) {
      const x = hash(i, 41) * 256, y = hash(i, 43) * 128;
      const r = 8 + hash(i, 47) * 22;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.4 + hash(i, 53) * 0.5), hash(i, 59) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // cloud swirls
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 40; i++) {
      const x = hash(i, 61) * 256, y = hash(i, 67) * 128;
      const r = 4 + hash(i, 71) * 14;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.3, hash(i, 73) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ---------------- camera state + render loop ----------------
  const camState = {
    x: 0, y: 2.3, z: 10.2,
    tx: 0, ty: 1.0, tz: 0,
  };
  const lookTarget = new THREE.Vector3();
  const clock = new THREE.Clock();

  function render() {
    const t = clock.getElapsedTime();
    // gentle handheld float for life
    const fx = Math.sin(t * 0.32) * 0.12;
    const fy = Math.sin(t * 0.21) * 0.07;
    camera.position.set(camState.x + fx, camState.y + fy, camState.z);
    lookTarget.set(camState.tx, camState.ty, camState.tz);
    camera.lookAt(lookTarget);

    earth.rotation.y = t * 0.02;
    stars.rotation.y = t * 0.004;

    // beacon breathing at night
    const pulse = 0.75 + Math.sin(t * 2.2) * 0.25;
    for (const m of machines) {
      m.userData.lamp.intensity = state.night * 4.5 * pulse;
    }

    renderer.render(scene, camera);
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  return {
    renderer, scene, camera, camState, applyPhase, render, state,
    positions: {
      epoc: epoc.position.clone(), oasys: oasys.position.clone(), cartridge: cartridge.position.clone(),
    },
  };
}
