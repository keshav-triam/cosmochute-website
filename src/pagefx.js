// ============================================================
// Lightweight Three.js hero scenes for the company pages.
// Reuses the REAL fleet models on a studio turntable: no
// composer, no shadows — a plain DPR-correct renderer with a
// key/rim light rig stays crisp and cheap on every device.
// Each page picks a subject via <body data-fx="...">, and the
// version picker retunes the camera mood via setMood(v).
// ============================================================
import * as THREE from 'three';
import { buildEpoc, buildOasys, buildLander, buildOrbiter, buildCartridge } from './models.js';
import { T } from './textures.js';

const SUBJECTS = {
  epoc: {
    build: () => buildEpoc(),
    scale: 1, lift: 0, spin: 0.16,
    cam: { x: 3.3, y: 1.9, z: 5.4, ty: 1.0 },
  },
  lander: {
    build: () => {
      const l = buildLander();
      // deploy the ramp a touch so the silhouette reads "working base"
      if (l.userData.ramp) l.userData.ramp.rotation.z = -0.314;
      return l;
    },
    scale: 0.4, lift: 0, spin: 0.1,
    cam: { x: 4.0, y: 2.1, z: 6.0, ty: 1.05 },
  },
  orbiter: {
    build: () => buildOrbiter(),
    scale: 0.85, lift: 1.05, spin: 0.22, tumble: 0.06,
    cam: { x: 2.9, y: 1.6, z: 4.9, ty: 1.0 },
  },
  oasys: {
    build: () => {
      const o = buildOasys();
      // rack a few cartridges so the magazine reads loaded
      for (const i of [0, 3, 5, 6]) {
        const c = buildCartridge(i);
        c.position.copy(o.userData.slots[i].position);
        o.add(c);
      }
      return o;
    },
    scale: 1, lift: 0, spin: 0.14,
    cam: { x: 3.5, y: 2.0, z: 5.5, ty: 0.85 },
  },
};

// camera moods, retuned by the design-version picker: V1 editorial,
// V2 technical top-down-ish, V3 low dramatic hero angle
const MOODS = {
  1: { az: 0.55, el: 0.3, dist: 1.0, spinMul: 1.0, rim: 1.1 },
  2: { az: 0.95, el: 0.52, dist: 1.08, spinMul: 0.75, rim: 0.8 },
  3: { az: 0.25, el: 0.12, dist: 0.88, spinMul: 1.25, rim: 1.8 },
};

export function initPageFX(canvas, kind) {
  const cfg = SUBJECTS[kind];
  if (!cfg) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    canvas.style.display = 'none';
    return null;
  }
  const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(DPR());
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 300);

  // --- light rig: warm key, cool rim, gentle fill ---
  const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
  key.position.set(5, 7, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fd8e8, 1.1);
  rim.position.set(-6, 3.5, -5);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0x28303c, 0.9));
  const bounce = new THREE.HemisphereLight(0x101318, 0x35302a, 0.5);
  scene.add(bounce);

  // --- starfield (device-pixel sized points) ---
  const starN = 700;
  const sp = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const r = 120;
    sp[i * 3] = r * Math.sin(ph) * Math.cos(th);
    sp[i * 3 + 1] = Math.abs(r * Math.cos(ph)) * 0.7 - 18;
    sp[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xdfe6f0, size: 1.5 * DPR(), sizeAttenuation: false,
    transparent: true, opacity: 0.75, depthWrite: false,
  }));
  scene.add(stars);

  // --- Earth, small and far, home in the corner of every frame ---
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 32, 24),
    new THREE.MeshStandardMaterial({
      map: T.earth, emissive: 0xffffff, emissiveMap: T.earth, emissiveIntensity: 0.34,
      roughness: 0.9, metalness: 0,
    }),
  );
  earth.position.set(-16, 9, -42);
  scene.add(earth);

  // --- the stage: subject on a soft-lit gold service ring ---
  const stage = new THREE.Group();
  const subject = cfg.build();
  subject.scale.setScalar(cfg.scale);
  subject.position.y = cfg.lift;
  stage.add(subject);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.02, 8, 64), new THREE.MeshStandardMaterial({
    color: 0xcf9331, metalness: 0.8, roughness: 0.3,
    emissive: 0xcf9331, emissiveIntensity: 0.25,
  }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.01;
  stage.add(ring);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(2.55, 48), new THREE.MeshStandardMaterial({
    color: 0x191b20, metalness: 0.3, roughness: 0.85,
  }));
  pad.rotation.x = -Math.PI / 2;
  stage.add(pad);
  scene.add(stage);

  // --- camera state, eased toward the current mood every frame ---
  let mood = MOODS[1];
  const camCur = { az: mood.az, el: mood.el, dist: mood.dist };
  function setMood(v) { mood = MOODS[v] || MOODS[1]; }

  const clock = new THREE.Clock();
  const look = new THREE.Vector3();
  let scrollDrift = 0;
  window.addEventListener('scroll', () => {
    scrollDrift = Math.min(1.6, window.scrollY / 700);
  }, { passive: true });

  function frame() {
    const t = clock.getElapsedTime();
    stage.rotation.y = t * cfg.spin * mood.spinMul;
    subject.position.y = cfg.lift + Math.sin(t * 0.7) * 0.035;
    if (cfg.tumble) subject.rotation.z = Math.sin(t * 0.4) * cfg.tumble;
    rim.intensity = 1.1 * mood.rim;
    // ease camera toward the mood orbit
    camCur.az += (mood.az - camCur.az) * 0.04;
    camCur.el += (mood.el - camCur.el) * 0.04;
    camCur.dist += (mood.dist - camCur.dist) * 0.04;
    const R = Math.hypot(cfg.cam.x, cfg.cam.z) * camCur.dist;
    camera.position.set(
      Math.sin(camCur.az) * R,
      (cfg.cam.y + Math.sin(t * 0.31) * 0.06) * (0.6 + camCur.el) + scrollDrift * 0.9,
      Math.cos(camCur.az) * R,
    );
    look.set(0, cfg.cam.ty - scrollDrift * 0.35, 0);
    camera.lookAt(look);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(DPR());
    renderer.setSize(window.innerWidth, window.innerHeight);
    stars.material.size = 1.5 * DPR();
  }
  window.addEventListener('resize', resize);

  return { setMood };
}
