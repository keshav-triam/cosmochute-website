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
  s6: 5.9, s7: 7.4, s8: 8.9, end: 10.0,
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
  const HITCH = 3.5; // EPOC centre to OASys centre when coupled
  const deckTop = lander.userData.deckY + landerY;

  // egress: deck -> down the ramp -> basecamp. y baked into waypoints.
  const rampTip = rot(9.0, 0);
  const egressPts = [
    rot(-1.9, 0).setY(deckTop), rot(0.7, 0).setY(deckTop),
    rot(4.6, 0).setY(deckTop - 0.42), rampTip.clone().setY(terrainHeight(rampTip.x, rampTip.z)),
    v(-6.8, -2.8, terrainHeight(-6.8, -2.8)), v(SITES.basecamp.x, SITES.basecamp.z, terrainHeight(SITES.basecamp.x, SITES.basecamp.z)),
  ];
  const egress = new THREE.CatmullRomCurve3(egressPts);

  // exact rolling surface for the egress: flat deck, then the true ramp
  // plane, then terrain — wheels follow this instead of a spline guess,
  // so nothing sinks through the ramp plate
  const RAMP_ROOT_U = 3.3, RAMP_END_U = 9.0;
  const rampTipY = terrainHeight(rampTip.x, rampTip.z);
  function egressSurfaceY(x, z) {
    const u = (x - SITES.lander.x) * Math.cos(LANDER_HEADING)
            - (z - SITES.lander.z) * Math.sin(LANDER_HEADING);
    if (u <= RAMP_ROOT_U) return deckTop;
    if (u <= RAMP_END_U) {
      const tt = (u - RAMP_ROOT_U) / (RAMP_END_U - RAMP_ROOT_U);
      return Math.max(deckTop - tt * (deckTop - rampTipY), terrainHeight(x, z));
    }
    return terrainHeight(x, z);
  }

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
  const oasysParkP = 1 - HITCH / egress.getLength();
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
  function buildRibbon(curve, width = 0.95, surfaceFn = null) {
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
      const y = (surfaceFn || terrainHeight)(pt.x, pt.z) + 0.04;
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
    egress: buildRibbon(egress, 1.0, egressSurfaceY),
    m1: buildRibbon(m1), m1r: buildRibbon(m1r),
    m2: buildRibbon(m2), m2r: buildRibbon(m2r),
    tow: buildRibbon(towCurve), exit: buildRibbon(exitCurve),
  };

  // ---------------- vehicle placement ----------------
  const pt = new THREE.Vector3(), tan = new THREE.Vector3();
  function place(obj, curve, p, opts = {}) {
    curve.getPointAt(p, pt);
    curve.getTangentAt(p, tan);
    const sf = opts.surfaceY || terrainHeight;
    // small clearance lift keeps wheel rims out of the surface detail
    obj.position.set(pt.x, sf(pt.x, pt.z) + 0.04, pt.z);
    obj.rotation.y = Math.atan2(-tan.z, tan.x);
    const e = 0.7;
    // pitch from the slope along the tangent
    const hA = sf(pt.x + tan.x * e, pt.z + tan.z * e);
    const hB = sf(pt.x - tan.x * e, pt.z - tan.z * e);
    obj.rotation.z = Math.atan2(hA - hB, 2 * e) * 0.75;
    // roll from the side slope, so wheels sit on cross-slopes too
    const sx = -tan.z, sz = tan.x;
    const hL = sf(pt.x + sx * e, pt.z + sz * e);
    const hR = sf(pt.x - sx * e, pt.z - sz * e);
    obj.rotation.x = Math.atan2(hR - hL, 2 * e) * 0.55;
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
    const hitchFrac = (opts.tow || opts.oasysFollow) ? HITCH / len : 0;
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
          cs.ty = (opts.surfaceY || terrainHeight)(pt.x, pt.z) + 1.0;
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
  function turnTo(at, dur, targetYaw) {
    const target = yawRef + ((targetYaw - yawRef + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    tl.to(epoc.rotation, { y: target, duration: dur, ease: 'power1.inOut' }, at);
    yawRef = targetYaw;
  }

  // ---------------- arm inverse kinematics ----------------
  // 3 DOF: root yaw (rotation.y), shoulder (root rotation.z, applied
  // first thanks to XYZ euler order), elbow (fore rotation.z). Solved
  // against real target points so the gripper actually arrives where
  // the cartridge is — no more pantomime.
  const ARM_L1 = epoc.userData.arm.lengths.l1, ARM_L2 = epoc.userData.arm.lengths.l2;
  const ARM_ROOT_LOCAL = new THREE.Vector3(-0.85, 1.22, 0.45);
  function solveArm(targetLocal) {
    const d = targetLocal.clone().sub(ARM_ROOT_LOCAL);
    const yaw = Math.atan2(-d.z, d.x);
    const rho = Math.hypot(d.x, d.z);
    let D = Math.hypot(rho, d.y);
    D = Math.min(D, ARM_L1 + ARM_L2 - 0.02);
    const cosE = (D * D - ARM_L1 * ARM_L1 - ARM_L2 * ARM_L2) / (2 * ARM_L1 * ARM_L2);
    const eMag = Math.acos(THREE.MathUtils.clamp(cosE, -1, 1));
    const alpha = Math.atan2(-rho, d.y);
    const branches = [eMag, -eMag].map((e) => {
      const s = alpha - Math.atan2(ARM_L2 * Math.sin(e), ARM_L1 + ARM_L2 * Math.cos(e));
      return { s, e, elbowY: ARM_L1 * Math.cos(s) };
    });
    branches.sort((a, b) => b.elbowY - a.elbowY); // elbow-up branch
    return [yaw, branches[0].s, branches[0].e];
  }
  // poses: [root yaw, shoulder, elbow]
  const POSE_STOW = [0, -2.5, 2.4];
  function armPose(at, dur, pose) {
    tl.to(arm.root.rotation, { y: pose[0], z: pose[1], duration: dur, ease: 'power2.inOut' }, at);
    tl.to(arm.fore.rotation, { z: pose[2], duration: dur, ease: 'power2.inOut' }, at + 0.02);
  }

  // exact pick geometry at basecamp, computed from the parked poses
  const UP = new THREE.Vector3(0, 1, 0);
  const epocPickHeading = heading(egress, 1);
  const epocPickPos = egress.getPointAt(1);
  epocPickPos.y = terrainHeight(epocPickPos.x, epocPickPos.z) + 0.04;
  const oasysPickHeading = heading(egress, oasysParkP);
  const oasysPickPos = egress.getPointAt(oasysParkP);
  oasysPickPos.y = terrainHeight(oasysPickPos.x, oasysPickPos.z) + 0.04;
  function slotInEpocFrame(slotIdx) {
    const sl = oasys.userData.slots[slotIdx].position.clone();
    sl.applyAxisAngle(UP, oasysPickHeading).add(oasysPickPos);   // -> world
    sl.sub(epocPickPos).applyAxisAngle(UP, -epocPickHeading);     // -> EPOC local
    return sl;
  }
  // front-row slots nearest the arm — the only ones physically in reach
  const CART_A = 7, CART_B = 6;
  const slotA = slotInEpocFrame(CART_A);
  const slotB = slotInEpocFrame(CART_B);
  const HOVER_A = solveArm(slotA.clone().add(new THREE.Vector3(0, 0.5, 0)));
  const GRAB_A = solveArm(slotA.clone().add(new THREE.Vector3(0, 0.16, 0)));
  const HOVER_B = solveArm(slotB.clone().add(new THREE.Vector3(0, 0.5, 0)));
  const GRAB_B = solveArm(slotB.clone().add(new THREE.Vector3(0, 0.16, 0)));
  const POSE_CARRY = solveArm(new THREE.Vector3(0.3, 2.0, 0.25));
  const POSE_BELLY = solveArm(new THREE.Vector3(0.62, 0.92, 0.15));
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
  const stowE = egress.getPointAt(HITCH / egress.getLength());
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
  // descent plume throttles up, cuts hard at touchdown (scene.js renders
  // the layered cones, flicker, ground clamping and the surface splash)
  tl.fromTo(lander.userData.plume.state, { on: 0 }, { on: 1, duration: 0.45, ease: 'power1.in', immediateRender: false }, T.s2 + 0.15);
  tl.to(lander.userData.plume.state, { on: 0, duration: 0.08 }, T.s2 + 0.84);
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
    tow: true, fromHitch: true, surfaceY: egressSurfaceY, followTarget: true, ease: 'power1.inOut',
  });
  cam(T.s3 + 0.5, 0.5, { x: -14, y: 2.4, z: 6 });

  // ============================================================
  // S4 — FIRST MISSION
  // ============================================================
  card(3, T.s4 + 0.06, T.s5 - 0.14);
  cam(T.s4, 0.3, { x: -8.5, y: 1.9, z: 3.2, tx: B.x, ty: 1.0, tz: B.z });
  // the arm swings over the magazine and hovers above the cartridge…
  armPose(T.s4 + 0.04, 0.16, HOVER_A);
  // …lowers straight onto it…
  armPose(T.s4 + 0.22, 0.08, GRAB_A);
  // …latches — the cartridge is now attached to the gripper…
  carry(cartridges[CART_A], 'slot', 'wrist', T.s4 + 0.31, 0.06);
  // …lifts it clear of the magazine…
  armPose(T.s4 + 0.39, 0.09, HOVER_A);
  // …carries it over the deck…
  armPose(T.s4 + 0.5, 0.16, POSE_CARRY);
  // …presents it at the belly chamber mouth, which pulls it in
  armPose(T.s4 + 0.68, 0.1, POSE_BELLY);
  carry(cartridges[CART_A], 'wrist', 'belly', T.s4 + 0.79, 0.07);
  armPose(T.s4 + 0.87, 0.12, POSE_STOW);
  // unhitch: tow bar up
  tl.to(tow.rotation, { z: 0.85, duration: 0.1 }, T.s4 + 0.88);
  // solo traverse into the rough zone
  noteArrival(egress);
  turn(T.s4 + 0.9, 0.08, m1);
  cam(T.s4 + 0.97, 0.3, { x: 2.5, y: 3.4, z: -0.5 });
  drive(T.s4 + 1.0, 0.36, m1, ribbons.m1, { followTarget: true });
  // operate: belly payload live, downlink to the relay orbiter
  tl.to(cartridges[CART_A].userData, { boost: 1, duration: 0.1 }, T.s5 - 0.12);
  tl.to(beam.material, { opacity: 0.65, duration: 0.1 }, T.s5 - 0.1);

  // ============================================================
  // S5 — END OF FIRST MISSION: THE SWAP
  // ============================================================
  card(4, T.s5 + 0.06, T.s6 - 0.14);
  tl.to(beam.material, { opacity: 0, duration: 0.08 }, T.s5 + 0.06);
  tl.to(cartridges[CART_A].userData, { boost: 0, duration: 0.08 }, T.s5 + 0.06);
  noteArrival(m1);
  turn(T.s5 + 0.04, 0.12, m1r);
  cam(T.s5 + 0.05, 0.35, { x: 3, y: 2.5, z: 3.5 });
  drive(T.s5 + 0.14, 0.42, m1r, ribbons.m1r, { followTarget: true });
  // back at basecamp: EPOC turns to its exact loading orientation —
  // the IK poses only line up with the magazine from this heading
  noteArrival(m1r);
  turnTo(T.s5 + 0.56, 0.1, epocPickHeading);
  cam(T.s5 + 0.56, 0.2, { x: -8.5, y: 1.9, z: 3.2, tx: B.x, ty: 1.0, tz: B.z });
  // the arm collects the spent cartridge at the chamber…
  armPose(T.s5 + 0.68, 0.12, POSE_BELLY);
  carry(cartridges[CART_A], 'belly', 'wrist', T.s5 + 0.82, 0.06);
  // …carries it back over its slot, hovers, lowers, releases — and
  // lifts clear, exactly like the first pick in reverse
  armPose(T.s5 + 0.9, 0.16, HOVER_A);
  armPose(T.s5 + 1.08, 0.07, GRAB_A);
  carry(cartridges[CART_A], 'wrist', 'slot', T.s5 + 1.16, 0.06);
  armPose(T.s5 + 1.24, 0.08, HOVER_A);
  tl.set(cartridges[CART_A].userData, { dimmed: true, immediateRender: false }, T.s5 + 1.22);

  // ============================================================
  // S6 — NEXT MISSIONS (fast-cycle montage)
  // ============================================================
  card(5, T.s6 + 0.06, T.s7 - 0.14);
  // the second pick gets the same full, deliberate treatment as the
  // first — and the camera stays close to watch it
  armPose(T.s6 + 0.02, 0.1, HOVER_B);
  armPose(T.s6 + 0.14, 0.07, GRAB_B);
  carry(cartridges[CART_B], 'slot', 'wrist', T.s6 + 0.22, 0.06);
  armPose(T.s6 + 0.3, 0.08, HOVER_B);
  armPose(T.s6 + 0.4, 0.14, POSE_CARRY);
  armPose(T.s6 + 0.56, 0.1, POSE_BELLY);
  carry(cartridges[CART_B], 'wrist', 'belly', T.s6 + 0.68, 0.06);
  armPose(T.s6 + 0.76, 0.12, POSE_STOW);
  // now the camera pulls wide for the fast-cycle montage
  cam(T.s6 + 0.88, 0.3, { x: 1, y: 9.5, z: 16, tx: 4, ty: 0, tz: 1 });
  turn(T.s6 + 0.92, 0.05, m2);
  drive(T.s6 + 0.98, 0.2, m2, ribbons.m2, { ease: 'power1.in' });
  tl.to(cartridges[CART_B].userData, { boost: 1, duration: 0.05 }, T.s6 + 1.19);
  tl.to(beam.material, { opacity: 0.65, duration: 0.05 }, T.s6 + 1.2);
  tl.to(beam.material, { opacity: 0, duration: 0.05 }, T.s6 + 1.27);
  tl.to(cartridges[CART_B].userData, { boost: 0, duration: 0.05 }, T.s6 + 1.28);
  noteArrival(m2);
  turn(T.s6 + 1.29, 0.04, m2r);
  drive(T.s6 + 1.34, 0.14, m2r, ribbons.m2r, { ease: 'power1.out' });

  // ============================================================
  // S7 — TRAILER HEAVEN
  // ============================================================
  card(6, T.s7 + 0.06, T.s8 - 0.14);
  // back from the last sortie: line up with the magazine one final time
  noteArrival(m2r);
  turnTo(T.s7 + 0.02, 0.1, epocPickHeading);
  cam(T.s7 + 0.02, 0.2, { x: -8.5, y: 1.9, z: 3.2, tx: B.x, ty: 1.0, tz: B.z });
  // the last cartridge is lifted out of the belly and racked home
  armPose(T.s7 + 0.14, 0.12, POSE_BELLY);
  carry(cartridges[CART_B], 'belly', 'wrist', T.s7 + 0.28, 0.06);
  armPose(T.s7 + 0.36, 0.14, HOVER_B);
  armPose(T.s7 + 0.52, 0.06, GRAB_B);
  carry(cartridges[CART_B], 'wrist', 'slot', T.s7 + 0.59, 0.06);
  tl.set(cartridges[CART_B].userData, { dimmed: true, immediateRender: false }, T.s7 + 0.66);
  armPose(T.s7 + 0.67, 0.08, HOVER_B);
  armPose(T.s7 + 0.77, 0.1, POSE_STOW);
  // hitch up and take OASys to its rest
  tl.to(tow.rotation, { z: 0, duration: 0.1 }, T.s7 + 0.88);
  cam(T.s7 + 0.98, 0.4, { x: -19, y: 3.0, z: 17 });
  turn(T.s7 + 1.0, 0.08, towCurve, HITCH / towCurve.getLength());
  drive(T.s7 + 1.1, 0.38, towCurve, ribbons.tow, {
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
