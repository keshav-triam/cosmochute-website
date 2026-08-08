// ============================================================
// The end-to-end LEAP mission, choreographed on one scrubbed
// GSAP timeline (attached to the pinned #mission section):
//
//   S1 INTEGRATION & LAUNCH   streak leaves Earth
//   S2 LANDING                lander descends, dust at touchdown
//   S3 E1O1 — EGRESS          ramp down, convoy rolls to basecamp
//   S4 FIRST MISSION          cartridge to belly, solo traverse
//   S5 SWAP                   return, spent cartridge out, next in
//   S6 NEXT MISSIONS          fast-cycle montage
//   S7 TRAILER HEAVEN         tow OASys to the scenic rise
//   S8 E1O2                   EPOC drives to the horizon
//
// Everything is a deterministic function of scroll progress:
// vehicles are driven by {p} proxies along arc-length curves,
// cartridges by mode/arcT state, cameras by pose tweens.
// ============================================================
import * as THREE from 'three';

// stage boundary times (timeline seconds); END is total duration
export const T = {
  s1: 0, s2: 1.0, s3: 2.0, s4: 3.15, s5: 4.55,
  s6: 5.6, s7: 6.5, s8: 7.55, end: 8.6,
};
export const STAGE_STARTS = [T.s1, T.s2, T.s3, T.s4, T.s5, T.s6, T.s7, T.s8];

export function buildMission(world, gsap, tl) {
  const { actors, camState: cs, terrainHeight, SITES, scene } = world;
  const { epoc, oasys, cartridges, cartDisplay, plinth, lander, beam, streak, trail, streakCurve, trailPos, trailGeo, dust } = actors;

  const landerY = terrainHeight(SITES.lander.x, SITES.lander.z);
  const LANDER_HEADING = -0.53; // ramp faces basecamp
  const rot = (dx, dz, th = LANDER_HEADING) => new THREE.Vector3(
    SITES.lander.x + dx * Math.cos(th) + dz * Math.sin(th),
    0,
    SITES.lander.z - dx * Math.sin(th) + dz * Math.cos(th),
  );

  // ---------------- path curves (xz; y sampled from terrain) ----------------
  const v = (x, z, y = 0) => new THREE.Vector3(x, y, z);
  const deckTop = lander.userData.deckY + landerY;

  // egress: deck -> down the ramp -> basecamp. y baked into waypoints.
  const rampTip = rot(9.0, 0);
  const egressPts = [
    rot(-1.9, 0).setY(deckTop), rot(0.7, 0).setY(deckTop),
    rot(4.6, 0).setY(deckTop - 0.42), rampTip.clone().setY(terrainHeight(rampTip.x, rampTip.z)),
    v(-6.8, -2.8, terrainHeight(-6.8, -2.8)), v(SITES.basecamp.x, SITES.basecamp.z, terrainHeight(SITES.basecamp.x, SITES.basecamp.z)),
  ];
  const egress = new THREE.CatmullRomCurve3(egressPts);

  const B = SITES.basecamp, D1 = SITES.deploy1, D2 = SITES.deploy2, TH = SITES.heaven;
  const m1 = new THREE.CatmullRomCurve3([
    v(B.x, B.z), v(0.5, -3.5), v(4.5, -7), v(7.5, -8.5), v(9.5, -11), v(D1.x, D1.z),
  ]);
  const m1r = new THREE.CatmullRomCurve3([
    v(D1.x, D1.z), v(8, -13.5), v(5, -10.5), v(1.5, -6), v(-1.5, -3), v(B.x, B.z),
  ]);
  const m2 = new THREE.CatmullRomCurve3([
    v(B.x, B.z), v(1, 2.5), v(6, 4.5), v(10, 5.5), v(D2.x, D2.z),
  ]);
  const m2r = new THREE.CatmullRomCurve3([
    v(D2.x, D2.z), v(9, 8), v(4, 6.5), v(-1, 2.5), v(B.x, B.z),
  ]);
  // tow starts exactly where OASys parked after egress (hitch offset back)
  const oasysParkP = 1 - 3.15 / egress.getLength();
  const oasysPark = egress.getPointAt(oasysParkP);
  const towCurve = new THREE.CatmullRomCurve3([
    v(oasysPark.x, oasysPark.z), v(B.x, B.z), v(-6.5, 3.5), v(-9, 7.5), v(TH.x, TH.z),
  ]);
  const exitCurve = new THREE.CatmullRomCurve3([
    v(TH.x, TH.z), v(-4, 10), v(8, 4), v(24, -8), v(SITES.exit.x, SITES.exit.z),
  ]);

  // ---------------- wheel-track ribbons ----------------
  const trackMat = new THREE.MeshBasicMaterial({
    color: 0x55524b, transparent: true, opacity: 0.5,
    polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false,
  });
  function buildRibbon(curve, width = 0.95, yFromCurve = false) {
    const N = 130;
    const posArr = new Float32Array(N * 6 * 3);
    const pt = new THREE.Vector3(), tan = new THREE.Vector3();
    const side = new THREE.Vector3();
    const prevL = new THREE.Vector3(), prevR = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const p = i / N;
      curve.getPointAt(p, pt);
      curve.getTangentAt(p, tan);
      side.set(-tan.z, 0, tan.x).normalize().multiplyScalar(width / 2);
      const y = (yFromCurve ? pt.y : terrainHeight(pt.x, pt.z)) + 0.04;
      const L = new THREE.Vector3(pt.x - side.x, y, pt.z - side.z);
      const R = new THREE.Vector3(pt.x + side.x, y, pt.z + side.z);
      if (i > 0) {
        const o = (i - 1) * 18;
        posArr.set([prevL.x, prevL.y, prevL.z, prevR.x, prevR.y, prevR.z, L.x, L.y, L.z], o);
        posArr.set([prevR.x, prevR.y, prevR.z, R.x, R.y, R.z, L.x, L.y, L.z], o + 9);
      }
      prevL.copy(L); prevR.copy(R);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    const mesh = new THREE.Mesh(g, trackMat);
    mesh.frustumCulled = false;
    g.setDrawRange(0, 0);
    scene.add(mesh);
    return { mesh, N };
  }
  const ribbons = {
    egress: buildRibbon(egress, 1.0, true),
    m1: buildRibbon(m1), m1r: buildRibbon(m1r),
    m2: buildRibbon(m2), m2r: buildRibbon(m2r),
    tow: buildRibbon(towCurve), exit: buildRibbon(exitCurve),
  };

  // ---------------- vehicle placement ----------------
  const pt = new THREE.Vector3(), tan = new THREE.Vector3();
  function place(obj, curve, p, opts = {}) {
    curve.getPointAt(p, pt);
    curve.getTangentAt(p, tan);
    const y = opts.yFromCurve
      ? pt.y
      : terrainHeight(pt.x, pt.z);
    obj.position.set(pt.x, y, pt.z);
    obj.rotation.y = Math.atan2(-tan.z, tan.x);
    // pitch from slope along the tangent
    if (!opts.yFromCurve) {
      const e = 0.7;
      const hA = terrainHeight(pt.x + tan.x * e, pt.z + tan.z * e);
      const hB = terrainHeight(pt.x - tan.x * e, pt.z - tan.z * e);
      obj.rotation.z = Math.atan2(hA - hB, 2 * e) * 0.7;
    } else {
      obj.rotation.z = Math.atan2(-tan.y, Math.hypot(tan.x, tan.z)) * -0.9;
    }
  }
  function spinWheels(m, dist) {
    for (const w of m.userData.wheels) w.rotation.z = -dist / m.userData.wheelR;
  }

  // cumulative wheel distance baseline per segment, for continuous spin
  let epocDistBase = 0, oasysDistBase = 0;

  // drive segment: EPOC (optionally towing OASys) follows a curve.
  // pStart lets a towed segment begin with OASys exactly at curve start.
  function drive(at, dur, curve, ribbon, opts = {}) {
    const len = curve.getLength();
    const hitchFrac = (opts.tow || opts.oasysFollow) ? 3.15 / len : 0;
    const p0 = opts.fromHitch ? hitchFrac : 0;
    const dBase = epocDistBase, oBase = oasysDistBase;
    const proxy = { p: p0 };
    tl.to(proxy, {
      p: 1, duration: dur, ease: opts.ease || 'power1.inOut',
      onUpdate: () => {
        place(epoc, curve, proxy.p, opts);
        spinWheels(epoc, dBase + proxy.p * len);
        if (opts.tow || opts.oasysFollow) {
          const po = Math.max(0, proxy.p - hitchFrac);
          place(oasys, curve, po, opts);
          spinWheels(oasys, oBase + po * len);
        }
        if (ribbon) {
          ribbon.mesh.geometry.setDrawRange(0, Math.floor(proxy.p * ribbon.N) * 6);
        }
        if (opts.followTarget) {
          curve.getPointAt(Math.min(1, proxy.p + 0.04), pt);
          cs.tx = pt.x;
          cs.ty = (opts.yFromCurve ? pt.y : terrainHeight(pt.x, pt.z)) + 1.0;
          cs.tz = pt.z;
        }
      },
    }, at);
    epocDistBase += len * (1 - p0);
    if (opts.tow || opts.oasysFollow) oasysDistBase += len * (1 - p0);
  }

  // camera pose tween
  function cam(at, dur, pose) {
    tl.to(cs, { ...pose, duration: dur, ease: 'power1.inOut' }, at);
  }

  // heading of a curve at parameter p (vehicle forward = local +x)
  const hTan = new THREE.Vector3();
  function heading(curve, p) {
    curve.getTangentAt(p, hTan);
    return Math.atan2(-hTan.z, hTan.x);
  }
  // turn-in-place before a drive: tween yaw to the next curve's start
  // heading via the shortest arc from the previous segment's end heading
  let yawRef = 0;
  function turn(at, dur, curve, p = 0) {
    let target = heading(curve, p);
    target = yawRef + ((target - yawRef + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    tl.to(epoc.rotation, { y: target, duration: dur, ease: 'power1.inOut' }, at);
  }
  function noteArrival(curve) { yawRef = heading(curve, 1); }

  // arm poses: [root.z, fore.z]
  const POSE_STOW = [-2.5, 2.4];
  const POSE_MAG = [0.95, -0.5];   // reaching back over OASys' magazine
  const POSE_FRONT = [-0.35, 1.5]; // holding over the deck / belly
  function armPose(at, dur, pose) {
    tl.to(arm.root.rotation, { z: pose[0], duration: dur, ease: 'power2.inOut' }, at);
    tl.to(arm.fore.rotation, { z: pose[1], duration: dur, ease: 'power2.inOut' }, at + 0.02);
  }
  // cartridge transfer between anchors (slot / wrist / belly). While a
  // transfer targets 'wrist' the cartridge tracks the actual gripper
  // position every frame, so it genuinely rides the arm.
  function carry(cart, from, to, at, dur) {
    tl.set(cart.userData, { fromA: from, toA: to, immediateRender: false }, at);
    tl.fromTo(cart.userData, { blend: 0 }, { blend: 1, duration: dur, ease: 'power1.inOut', immediateRender: false }, at);
    tl.set(cart.userData, { fromA: to, toA: to, blend: 0, immediateRender: false }, at + dur + 0.01);
  }

  // stage card show/hide (DOM)
  const cards = Array.from(document.querySelectorAll('#mission .m-stage'));
  function card(i, from, to) {
    const el = cards[i];
    if (!el) return;
    tl.set(el, { visibility: 'visible', immediateRender: false }, from);
    tl.fromTo(el, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.16, ease: 'power2.out', immediateRender: false }, from);
    if (to != null) {
      tl.to(el, { opacity: 0, y: -20, duration: 0.12, ease: 'power2.in' }, to);
      tl.set(el, { visibility: 'hidden', immediateRender: false }, to + 0.12);
    }
  }

  const arm = epoc.userData.arm;
  const tow = oasys.userData.towRoot;
  oasys.userData.lampBoost = 0;
  epoc.userData.lampBoost = 0;

  // ============================================================
  // S1 — INTEGRATION & LAUNCH
  // ============================================================
  card(0, T.s1 + 0.08, T.s2 - 0.14);
  cam(T.s1, 0.4, { x: -2, y: 2.2, z: 16, tx: -120, ty: 150, tz: -320 });
  // while the camera is skyward, quietly stage the actors:
  tl.set(cartDisplay, { visible: false, immediateRender: false }, T.s1 + 0.06);
  tl.set(plinth, { visible: false, immediateRender: false }, T.s1 + 0.06);
  tl.set(lander.position, { x: SITES.lander.x, y: landerY + 55, z: SITES.lander.z, immediateRender: false }, T.s1 + 0.06);
  tl.set(lander.rotation, { y: LANDER_HEADING, immediateRender: false }, T.s1 + 0.06);
  // stow the convoy on the lander deck — IN THE SKY with the lander;
  // the descent tweens below fly the whole stack down together
  const STOW_ALT = 55;
  const stowE = egress.getPointAt(3.15 / egress.getLength());
  const stowO = egress.getPointAt(0);
  tl.set(epoc.position, { x: stowE.x, y: deckTop + STOW_ALT, z: stowE.z, immediateRender: false }, T.s1 + 0.06);
  tl.set(epoc.rotation, { y: LANDER_HEADING, z: 0, immediateRender: false }, T.s1 + 0.06);
  tl.set(oasys.position, { x: stowO.x, y: deckTop + STOW_ALT, z: stowO.z, immediateRender: false }, T.s1 + 0.06);
  tl.set(oasys.rotation, { y: LANDER_HEADING, z: 0, immediateRender: false }, T.s1 + 0.06);
  // launch streak from Earth
  const streakProxy = { p: 0 };
  tl.set(streak.material, { opacity: 0.95, immediateRender: false }, T.s1 + 0.12);
  tl.set(trail.material, { opacity: 0.7, immediateRender: false }, T.s1 + 0.12);
  tl.to(streakProxy, {
    p: 1, duration: 0.82, ease: 'power1.in',
    onUpdate: () => {
      streakCurve.getPoint(streakProxy.p, pt);
      streak.position.copy(pt);
      const N = trailPos.length / 3;
      for (let i = 0; i < N; i++) {
        const tp = Math.max(0, streakProxy.p - 0.22 * (1 - i / (N - 1)));
        streakCurve.getPoint(tp, tan);
        trailPos[i * 3] = tan.x; trailPos[i * 3 + 1] = tan.y; trailPos[i * 3 + 2] = tan.z;
      }
      trailGeo.attributes.position.needsUpdate = true;
    },
  }, T.s1 + 0.12);
  tl.to(streak.material, { opacity: 0, duration: 0.1 }, T.s2 - 0.06);
  tl.to(trail.material, { opacity: 0, duration: 0.1 }, T.s2 - 0.06);

  // ============================================================
  // S2 — LANDING
  // ============================================================
  card(1, T.s2 + 0.06, T.s3 - 0.14);
  cam(T.s2, 0.35, { x: -27, y: 2.8, z: 3, tx: SITES.lander.x, ty: 3, tz: SITES.lander.z });
  tl.to(cs, { shake: 0.9, duration: 0.3 }, T.s2 + 0.45);
  // the whole stack descends as one: lander + stowed EPOC + stowed OASys
  tl.to(lander.position, { y: landerY, duration: 0.78, ease: 'power2.in' }, T.s2 + 0.05);
  tl.to(epoc.position, { y: deckTop, duration: 0.78, ease: 'power2.in' }, T.s2 + 0.05);
  tl.to(oasys.position, { y: deckTop, duration: 0.78, ease: 'power2.in' }, T.s2 + 0.05);
  tl.fromTo(lander.userData.engineGlow, { intensity: 0 }, { intensity: 26, duration: 0.5, ease: 'power1.in', immediateRender: false }, T.s2 + 0.15);
  tl.to(lander.userData.engineGlow, { intensity: 0, duration: 0.18 }, T.s2 + 0.85);
  // visible descent plume, cut hard at touchdown
  tl.fromTo(lander.userData.plume, { opacity: 0 }, { opacity: 0.85, duration: 0.45, ease: 'power1.in', immediateRender: false }, T.s2 + 0.15);
  tl.to(lander.userData.plume, { opacity: 0, duration: 0.12 }, T.s2 + 0.83);
  // dust at touchdown
  tl.set(dust.material, { opacity: 0.55, immediateRender: false }, T.s2 + 0.8);
  tl.set(dust.scale, { x: 2, y: 0.7, immediateRender: false }, T.s2 + 0.8);
  tl.to(dust.scale, { x: 22, y: 5, duration: 0.5, ease: 'power2.out' }, T.s2 + 0.82);
  tl.to(dust.material, { opacity: 0, duration: 0.45, ease: 'power1.out' }, T.s2 + 0.86);
  tl.to(cs, { shake: 0, duration: 0.25 }, T.s2 + 0.9);

  // ============================================================
  // S3 — E1O1: EGRESS
  // ============================================================
  card(2, T.s3 + 0.06, T.s4 - 0.14);
  cam(T.s3, 0.3, { x: -25, y: 2.3, z: 4, tx: SITES.lander.x + 2, ty: 1.5, tz: SITES.lander.z + 2 });
  // ramp down
  tl.to(lander.userData.ramp.rotation, { z: -0.314, duration: 0.26, ease: 'power2.inOut' }, T.s3 + 0.02);
  // convoy rolls down and out
  drive(T.s3 + 0.32, 0.78, egress, ribbons.egress, {
    tow: true, fromHitch: true, yFromCurve: true, followTarget: true, ease: 'power1.inOut',
  });
  cam(T.s3 + 0.5, 0.5, { x: -14, y: 2.4, z: 6 });

  // ============================================================
  // S4 — FIRST MISSION
  // ============================================================
  card(3, T.s4 + 0.06, T.s5 - 0.14);
  cam(T.s4, 0.3, { x: -8.5, y: 1.9, z: 3.2, tx: B.x, ty: 1.0, tz: B.z });
  // the arm reaches back over OASys' magazine…
  armPose(T.s4 + 0.04, 0.18, POSE_MAG);
  // …grabs cartridge 01 — it hoists up to the gripper and stays attached…
  carry(cartridges[0], 'slot', 'wrist', T.s4 + 0.24, 0.12);
  // …the arm swings it forward over the deck…
  armPose(T.s4 + 0.38, 0.2, POSE_FRONT);
  // …and lowers it into the belly chamber
  carry(cartridges[0], 'wrist', 'belly', T.s4 + 0.6, 0.1);
  armPose(T.s4 + 0.72, 0.16, POSE_STOW);
  // unhitch: tow bar up
  tl.to(tow.rotation, { z: 0.85, duration: 0.12 }, T.s4 + 0.72);
  // solo traverse into the rough zone
  noteArrival(egress);
  turn(T.s4 + 0.74, 0.1, m1);
  cam(T.s4 + 0.84, 0.4, { x: 2.5, y: 3.4, z: -0.5 });
  drive(T.s4 + 0.86, 0.48, m1, ribbons.m1, { followTarget: true });
  // operate: belly payload live, downlink to the relay orbiter
  tl.to(cartridges[0].userData, { boost: 1, duration: 0.12 }, T.s5 - 0.18);
  tl.to(beam.material, { opacity: 0.65, duration: 0.12 }, T.s5 - 0.16);

  // ============================================================
  // S5 — END OF FIRST MISSION: THE SWAP
  // ============================================================
  card(4, T.s5 + 0.06, T.s6 - 0.14);
  tl.to(beam.material, { opacity: 0, duration: 0.1 }, T.s5 + 0.1);
  tl.to(cartridges[0].userData, { boost: 0, duration: 0.1 }, T.s5 + 0.1);
  noteArrival(m1);
  turn(T.s5 + 0.04, 0.12, m1r);
  cam(T.s5 + 0.05, 0.35, { x: 3, y: 2.5, z: 3.5 });
  drive(T.s5 + 0.16, 0.5, m1r, ribbons.m1r, { followTarget: true });
  // back at basecamp: the arm lifts the spent cartridge out of the belly…
  cam(T.s5 + 0.6, 0.22, { x: -8.5, y: 1.9, z: 3.2, tx: B.x, ty: 1.0, tz: B.z });
  armPose(T.s5 + 0.58, 0.12, POSE_FRONT);
  carry(cartridges[0], 'belly', 'wrist', T.s5 + 0.72, 0.09);
  // …swings it back over the magazine and sets it home, spent
  armPose(T.s5 + 0.82, 0.12, POSE_MAG);
  carry(cartridges[0], 'wrist', 'slot', T.s5 + 0.95, 0.08);
  tl.set(cartridges[0].userData, { dimmed: true, immediateRender: false }, T.s6 - 0.005);

  // ============================================================
  // S6 — NEXT MISSIONS (fast-cycle montage)
  // ============================================================
  card(5, T.s6 + 0.06, T.s7 - 0.14);
  cam(T.s6, 0.35, { x: 1, y: 9.5, z: 16, tx: 4, ty: 0, tz: 1 });
  // the arm grabs the next payload while the camera pulls wide…
  carry(cartridges[1], 'slot', 'wrist', T.s6 + 0.02, 0.08);
  armPose(T.s6 + 0.12, 0.12, POSE_FRONT);
  carry(cartridges[1], 'wrist', 'belly', T.s6 + 0.26, 0.07);
  armPose(T.s6 + 0.35, 0.1, POSE_STOW);
  // …then EPOC cycles the manifest
  noteArrival(m1r);
  turn(T.s6 + 0.38, 0.05, m2);
  drive(T.s6 + 0.44, 0.2, m2, ribbons.m2, { ease: 'power1.in' });
  tl.to(cartridges[1].userData, { boost: 1, duration: 0.05 }, T.s6 + 0.65);
  tl.to(beam.material, { opacity: 0.65, duration: 0.05 }, T.s6 + 0.66);
  tl.to(beam.material, { opacity: 0, duration: 0.05 }, T.s6 + 0.74);
  tl.to(cartridges[1].userData, { boost: 0, duration: 0.05 }, T.s6 + 0.75);
  noteArrival(m2);
  turn(T.s6 + 0.76, 0.04, m2r);
  drive(T.s6 + 0.81, 0.09, m2r, ribbons.m2r, { ease: 'power1.out' });
  tl.set(cartridges[1].userData, { fromA: 'slot', toA: 'slot', blend: 0, dimmed: true, immediateRender: false }, T.s7 - 0.02);

  // ============================================================
  // S7 — TRAILER HEAVEN
  // ============================================================
  card(6, T.s7 + 0.06, T.s8 - 0.14);
  // hitch up
  tl.to(tow.rotation, { z: 0, duration: 0.12 }, T.s7 + 0.02);
  cam(T.s7 + 0.05, 0.4, { x: -19, y: 3.0, z: 17 });
  noteArrival(m2r);
  turn(T.s7 + 0.05, 0.1, towCurve, 3.15 / towCurve.getLength());
  drive(T.s7 + 0.16, 0.72, towCurve, ribbons.tow, {
    tow: true, fromHitch: true, followTarget: true,
  });
  // parked: a warm send-off glow
  tl.to(oasys.userData, { lampBoost: 2.6, duration: 0.16 }, T.s8 - 0.14);

  // ============================================================
  // S8 — E1O2: THE NEXT ADVENTURE
  // ============================================================
  card(7, T.s8 + 0.06, null); // stays until the pin releases
  tl.to(tow.rotation, { z: 0.85, duration: 0.1 }, T.s8 + 0.02);
  cam(T.s8 + 0.02, 0.35, {
    x: TH.x - 4.5, y: 1.7, z: TH.z + 6.5,
    tx: TH.x + 8, ty: 1.2, tz: TH.z - 4,
  });
  noteArrival(towCurve);
  turn(T.s8 + 0.06, 0.1, exitCurve);
  drive(T.s8 + 0.18, 0.85, exitCurve, ribbons.exit, { ease: 'power1.in', followTarget: true });
  // final pull-up as EPOC fades into the fog
  cam(T.s8 + 0.7, 0.35, { x: TH.x - 5.5, y: 3.2, z: TH.z + 8 });
  tl.to({}, { duration: 0.001 }, T.end - 0.001); // pad to full duration

  return { T, STAGE_STARTS };
}
