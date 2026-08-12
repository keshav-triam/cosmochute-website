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
import { T as TEX } from './textures.js';

// stage boundary times (timeline seconds); END is total duration
export const T = {
  s1: 0, s2: 1.0, s3: 2.0, s4: 3.15, s5: 4.55,
  s6: 5.9, s7: 7.4, s8: 8.9, end: 10.0,
};
export const STAGE_STARTS = [T.s1, T.s2, T.s3, T.s4, T.s5, T.s6, T.s7, T.s8];

export function buildMission(world, gsap, tl) {
  const { actors, camState: cs, terrainHeight, SITES, scene } = world;
  const { epoc, oasys, cartridges, cartDisplay, plinth, lander, beam, streak, trail, streakCurve, trailPos, trailGeo, dust, scorch } = actors;

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
  // CONVOY MODE: OASys is towed on every sortie — the trailer goes
  // everywhere the rover goes, except the final departure. Each curve
  // starts at OASys' park point from the PREVIOUS leg, so a fromHitch
  // drive puts EPOC exactly at its last stop and OASys exactly where
  // it was parked — zero teleports.
  const parkOf = (curve) => {
    const p = curve.getPointAt(1 - HITCH / curve.getLength());
    return v(p.x, p.z);
  };
  const m1 = new THREE.CatmullRomCurve3([
    parkOf(egress), v(B.x, B.z), v(0.5, -3.5), v(4.5, -7), v(7.5, -8.5), v(9.5, -11), v(D1.x, D1.z),
  ]);
  // LINEAR CAMPAIGN: crater to crater, always onward — the convoy
  // never doubles back to the lander
  const leg2 = new THREE.CatmullRomCurve3([
    parkOf(m1), v(D1.x, D1.z), v(13.5, -8), v(15.5, -1.5), v(14.5, 3), v(D2.x, D2.z),
  ]);
  const towCurve = new THREE.CatmullRomCurve3([
    parkOf(leg2), v(D2.x, D2.z), v(17.5, 7.5), v(22, 7), v(26.5, 5.5), v(TH.x, TH.z),
  ]);
  const exitCurve = new THREE.CatmullRomCurve3([
    v(TH.x, TH.z), v(38, 1), v(50, -3), v(64, -8), v(SITES.exit.x, SITES.exit.z),
  ]);

  // ---------------- wheel ruts — carved soil geometry ----------------
  // Actual depressions, not decals: each wheel lane is a lit 3D trench —
  // pushed-up berms flanking a sunken floor corrugated by transverse
  // grouser bites. UV-mapped to the same regolith texture as the ground
  // so the soil reads continuous; the geometry does the depressing.
  const rutMat = new THREE.MeshStandardMaterial({
    map: TEX.regolithRim, color: 0x877f72, roughness: 1, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2,
  });
  const TRACK_GAUGE = 0.78;
  const UVS = 58 / 460; // identical world->uv scale as the terrain map
  // cross-section template: [lateral offset, height offset] — floor is as
  // wide as the wheel itself (0.30 vs 0.26 wheel + squish); heights get
  // per-ring randomisation below, because real churned soil is never neat
  const RUT_PROF = [
    [-0.30, 0.0], [-0.225, 0.055], [-0.15, 0.012],
    [0.15, 0.012], [0.225, 0.055], [0.30, 0.0],
  ];
  const rh = (aa, bb) => {
    const s = Math.sin(aa * 127.1 + bb * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  function buildRibbon(curve, widthIgnored = 0.95, surfaceFn = null, maskFn = null) {
    const N = 130;
    const meshes = [];
    const pt = new THREE.Vector3(), tan = new THREE.Vector3();
    const side = new THREE.Vector3();
    for (const lane of [-TRACK_GAUGE, TRACK_GAUGE]) {
      const posArr = new Float32Array(N * 30 * 3);
      const uvArr = new Float32Array(N * 30 * 2);
      let prevRing = null, dist = 0;
      const prevPt = new THREE.Vector3();
      for (let i = 0; i <= N; i++) {
        const p = i / N;
        curve.getPointAt(p, pt);
        curve.getTangentAt(p, tan);
        side.set(-tan.z, 0, tan.x).normalize();
        if (i > 0) dist += pt.distanceTo(prevPt);
        prevPt.copy(pt);
        const masked = maskFn && !maskFn(pt.x, pt.z);
        const y0 = (surfaceFn || terrainHeight)(pt.x, pt.z);
        // irregular grouser bites: depth, spacing and duty all vary
        const cell = Math.floor(dist / 0.45);
        const duty = 0.4 + rh(cell, lane * 3) * 0.3;
        const biteOn = (dist / 0.45) % 1 < duty;
        const bite = biteOn ? 0.008 + rh(cell, lane) * 0.034 : 0;
        // churned-soil jitter: berms slump unevenly, the floor undulates,
        // and the whole rut wanders a little off its line
        const wander = Math.sin(dist * 0.85 + lane * 2.7) * 0.035
                     + (rh(cell, lane * 17) - 0.5) * 0.02;
        const bermL = 0.05 + (rh(i, lane * 13) - 0.5) * 0.038;
        const bermR = 0.05 + (rh(i + 991, lane * 13) - 0.5) * 0.038;
        const floorJ = (rh(i, lane * 7) - 0.5) * 0.014;
        const ring = RUT_PROF.map(([off, hh], k) => {
          // lane IS the wheel centre offset (EPOC wheels run at z = ±0.78)
          const lat = masked ? lane : lane + off + wander;
          const isFloor = k === 2 || k === 3;
          let h;
          if (masked) h = 0.01;
          else if (isFloor) h = 0.012 + floorJ + bite;
          else if (k === 1) h = bermL;
          else if (k === 4) h = bermR;
          else h = hh + (rh(i + k * 31, lane) - 0.5) * 0.012;
          return [pt.x + side.x * lat, y0 + 0.015 + h, pt.z + side.z * lat];
        });
        if (i > 0 && prevRing) {
          const o = (i - 1) * 90, ou = (i - 1) * 60;
          let w = 0, wu = 0;
          for (let q = 0; q < 5; q++) {
            const a = prevRing[q], b2 = prevRing[q + 1], c2 = ring[q], d2 = ring[q + 1];
            posArr.set([...a, ...b2, ...c2, ...b2, ...d2, ...c2], o + w);
            w += 18;
            for (const vtx of [a, b2, c2, b2, d2, c2]) {
              uvArr[ou + wu] = vtx[0] * UVS;
              uvArr[ou + wu + 1] = vtx[2] * UVS;
              wu += 2;
            }
          }
        }
        prevRing = ring;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, rutMat);
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      g.setDrawRange(0, 0);
      scene.add(mesh);
      meshes.push(mesh);
    }
    return { meshes, N };
  }
  const egressOnSoil = (x, z) => {
    const u = (x - SITES.lander.x) * Math.cos(LANDER_HEADING)
            - (z - SITES.lander.z) * Math.sin(LANDER_HEADING);
    return u > RAMP_END_U - 0.1;
  };
  const ribbons = {
    egress: buildRibbon(egress, 1.0, egressSurfaceY, egressOnSoil),
    m1: buildRibbon(m1), leg2: buildRibbon(leg2),
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
    suspend(obj, sf);
  }
  function spinWheels(m, dist) {
    for (const w of m.userData.wheels) w.rotation.z = -dist / m.userData.wheelR;
  }

  // independent suspension: each wheel drops/rises to touch the surface
  // under its own contact point, decoupled from the body attitude
  const suspE = new THREE.Euler();
  const suspM = new THREE.Matrix4();
  const suspV = new THREE.Vector3();
  function suspend(m, sf) {
    const ud = m.userData;
    if (!ud.wheels) return;
    suspE.set(m.rotation.x, m.rotation.y, m.rotation.z, 'XYZ');
    suspM.makeRotationFromEuler(suspE);
    const bY = suspV.set(0, 1, 0).applyMatrix4(suspM).y || 1;
    for (const wgrp of ud.wheels) {
      suspV.set(wgrp.position.x, 0, wgrp.position.z).applyMatrix4(suspM);
      const wx = m.position.x + suspV.x;
      const wz = m.position.z + suspV.z;
      const aY = suspV.y;
      let yl = (sf(wx, wz) + ud.wheelR - m.position.y - aY) / bY;
      yl = THREE.MathUtils.clamp(yl, ud.wheelR - 0.22, ud.wheelR + 0.22);
      wgrp.position.y = yl;
    }
  }

  // cumulative wheel distance baseline per segment, for continuous spin
  let epocDistBase = 0, oasysDistBase = 0;
  const hitchBall = new THREE.Vector3();

  // wheel dust: a string of puffs hanging behind the vehicle, a pure
  // function of drive progress (scrub-safe), rising and fading with age
  const dustCanvas = document.createElement('canvas');
  dustCanvas.width = dustCanvas.height = 64;
  {
    const dctx = dustCanvas.getContext('2d');
    const dg = dctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    dg.addColorStop(0, 'rgba(255,255,255,0.85)');
    dg.addColorStop(0.45, 'rgba(255,255,255,0.3)');
    dg.addColorStop(1, 'rgba(255,255,255,0)');
    dctx.fillStyle = dg;
    dctx.fillRect(0, 0, 64, 64);
  }
  const dustSprites = [];
  for (let i = 0; i < 9; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(dustCanvas), color: 0x8f887b,
      transparent: true, opacity: 0, depthWrite: false,
    }));
    const sc = 0.5 + i * 0.32;
    sp.scale.set(sc, sc * 0.7, 1);
    scene.add(sp);
    dustSprites.push(sp);
  }
  const dustPt = new THREE.Vector3();
  function updateDustTrail(curve, p, p0, len, sf) {
    const act = Math.sin(Math.PI * THREE.MathUtils.clamp((p - p0) / Math.max(0.001, 1 - p0), 0, 1));
    for (let i = 0; i < dustSprites.length; i++) {
      const sp = dustSprites[i];
      const pi = p - ((i + 1) * 0.55) / len;
      if (pi <= 0) { sp.material.opacity = 0; continue; }
      curve.getPointAt(pi, dustPt);
      const wob = Math.sin(pi * 53 + i * 2.1) * 0.16;
      sp.position.set(
        dustPt.x + wob,
        sf(dustPt.x, dustPt.z) + 0.16 + i * 0.055,
        dustPt.z - wob,
      );
      sp.material.opacity = act * (0.15 - i * 0.012);
    }
  }
  // aim the tow bar at EPOC's hitch ball; blend 0 = raised, 1 = latched
  function aimTowBar(blend) {
    epoc.updateMatrixWorld();
    oasys.updateMatrixWorld();
    hitchBall.set(-1.12, 0.62, 0);
    epoc.localToWorld(hitchBall);
    oasys.worldToLocal(hitchBall);
    const hdx = hitchBall.x - 1.28, hdy = hitchBall.y - 0.55, hdz = hitchBall.z;
    const tr = oasys.userData.towRoot;
    const aimY = Math.atan2(-hdz, hdx);
    const aimZ = Math.atan2(hdy, Math.hypot(hdx, hdz));
    tr.rotation.y = aimY * blend;
    tr.rotation.z = 0.85 * (1 - blend) + aimZ * blend;
  }

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
          // keep the coupling latched through bends and slopes
          aimTowBar(1);
        }
        if (ribbon) {
          const dr = Math.floor(proxy.p * ribbon.N) * 30;
          for (const mm of ribbon.meshes) mm.geometry.setDrawRange(0, dr);
        }
        if (opts.dust !== false) {
          const pBack = proxy.p - ((opts.tow || opts.oasysFollow) ? hitchFrac : 0);
          updateDustTrail(curve, pBack, 0, len, opts.surfaceY || terrainHeight);
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
  const ARM_ROOT_LOCAL = new THREE.Vector3(-0.95, 1.72, 0);
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
  const POSE_STOW = [0, 0.15, -2.4];
  // big yaw changes route through a raised elbow-up posture so the arm
  // sweeps OVER the rover instead of slicing through mast and deck
  let armLastYaw = 0;
  let armLastPose = POSE_STOW;
  function armPose(at, dur, pose) {
    // route through the raised posture whenever the shoulder or elbow
    // swings substantially — mid-interpolation dips are what clip
    const dyaw = Math.abs(pose[0] - armLastYaw);
    const dJoints = Math.abs(pose[1] - armLastPose[1]) + Math.abs(pose[2] - armLastPose[2]);
    armLastPose = pose;
    if (dyaw > 0.45 || dJoints > 1.6) {
      tl.to(arm.root.rotation, { z: -0.3, duration: dur * 0.35, ease: 'power2.inOut' }, at);
      tl.to(arm.fore.rotation, { z: 0.4, duration: dur * 0.35, ease: 'power2.inOut' }, at);
      tl.to(arm.root.rotation, { y: pose[0], duration: dur * 0.4, ease: 'power1.inOut' }, at + dur * 0.3);
      tl.to(arm.root.rotation, { z: pose[1], duration: dur * 0.42, ease: 'power2.inOut' }, at + dur * 0.56);
      tl.to(arm.fore.rotation, { z: pose[2], duration: dur * 0.42, ease: 'power2.inOut' }, at + dur * 0.58);
    } else {
      tl.to(arm.root.rotation, { y: pose[0], z: pose[1], duration: dur, ease: 'power2.inOut' }, at);
      tl.to(arm.fore.rotation, { z: pose[2], duration: dur, ease: 'power2.inOut' }, at + 0.02);
    }
    armLastYaw = pose[0];
  }

  // exact pick geometry PER STOP: with the convoy hitched everywhere,
  // the EPOC<->OASys relative pose depends on each arrival curve's end
  // curvature — so slot targets are solved from the actual arrival
  // frames, and no turn-in-place realignment is ever needed
  const UP = new THREE.Vector3(0, 1, 0);
  function stopFrame(curve) {
    const hf = HITCH / curve.getLength();
    const eP = curve.getPointAt(1);
    eP.y = terrainHeight(eP.x, eP.z) + 0.04;
    const oP = curve.getPointAt(1 - hf);
    oP.y = terrainHeight(oP.x, oP.z) + 0.04;
    return { eH: heading(curve, 1), eP, oH: heading(curve, 1 - hf), oP };
  }
  function slotInEpocAt(frame, slotIdx) {
    const sl = oasys.userData.slots[slotIdx].position.clone();
    sl.applyAxisAngle(UP, frame.oH).add(frame.oP);   // -> world
    sl.sub(frame.eP).applyAxisAngle(UP, -frame.eH);   // -> EPOC local
    return sl;
  }
  // front-row slots nearest the arm — the only ones physically in reach.
  // HOVER is high enough that the HANGING cartridge clears the magazine
  // walls before any lateral swing.
  const CART_A = 7, CART_B = 6;
  const mkTargets = (frame, idx) => {
    const sl = slotInEpocAt(frame, idx);
    return {
      hover: solveArm(sl.clone().add(new THREE.Vector3(0, 0.85, 0))),
      grab: solveArm(sl.clone().add(new THREE.Vector3(0, 0.2, 0))),
    };
  };
  const TA_EGRESS = mkTargets(stopFrame(egress), CART_A); // first pick, by the lander
  const TA_S1 = mkTargets(stopFrame(m1), CART_A);         // swap at crater site one
  const TB_S1 = mkTargets(stopFrame(m1), CART_B);         // next payload, same stop
  const TB_S2 = mkTargets(stopFrame(leg2), CART_B);       // final rack at crater site two
  const POSE_CARRY = solveArm(new THREE.Vector3(0.5, 2.35, 0.05));
  // top-loading bay: hover above the open lid, then lower the payload
  // straight in — the gripper holds it until it is seated
  const BOX_HOVER = solveArm(new THREE.Vector3(0.6, 2.0, 0.12));
  const BOX_SEAT = solveArm(new THREE.Vector3(0.6, 1.65, 0.12));
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
  const lid = epoc.userData.payloadLid;
  const tow = oasys.userData.towRoot;
  function lidOpen(at, dur = 0.1) {
    tl.to(lid.rotation, { z: 2.05, duration: dur, ease: 'power2.inOut' }, at);
  }
  function lidClose(at, dur = 0.1) {
    tl.to(lid.rotation, { z: 0, duration: dur, ease: 'power2.inOut' }, at);
  }
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
  // launch latches close over the wheels for the ride down
  for (const cl of lander.userData.clamps) {
    tl.set(cl.grp.rotation, { x: 0, immediateRender: false }, T.s1 + 0.06);
  }
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
  cam(T.s2, 0.35, { x: -29, y: 3.2, z: 4, tx: SITES.lander.x, ty: 42, tz: SITES.lander.z });
  tl.to(cs, { shake: 0.9, duration: 0.3 }, T.s2 + 0.45);
  // the whole stack descends as one: lander + stowed EPOC + stowed OASys —
  // and the camera pans down WITH it, keeping the burn in frame
  tl.to(cs, { ty: 3, duration: 0.78, ease: 'power2.in' }, T.s2 + 0.05);
  tl.to(lander.position, { y: landerY, duration: 0.78, ease: 'power2.in' }, T.s2 + 0.05);
  tl.to(epoc.position, { y: deckTop, duration: 0.78, ease: 'power2.in' }, T.s2 + 0.05);
  tl.to(oasys.position, { y: deckTop, duration: 0.78, ease: 'power2.in' }, T.s2 + 0.05);
  tl.fromTo(lander.userData.engineGlow, { intensity: 0 }, { intensity: 14, duration: 0.5, ease: 'power1.in', immediateRender: false }, T.s2 + 0.15);
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
  // the engine leaves a scorched patch on the pad, permanently
  tl.to(scorch.material, { opacity: 0.5, duration: 0.3 }, T.s2 + 0.82);
  tl.to(cs, { shake: 0, duration: 0.25 }, T.s2 + 0.9);

  // ============================================================
  // S3 — E1O1: EGRESS
  // ============================================================
  card(2, T.s3 + 0.06, T.s4 - 0.14);
  cam(T.s3, 0.3, { x: -25, y: 2.3, z: 4, tx: SITES.lander.x + 2, ty: 1.5, tz: SITES.lander.z + 2 });
  // launch latches swing open, releasing the convoy…
  lander.userData.clamps.forEach((cl, i) => {
    tl.to(cl.grp.rotation, { x: cl.openRot, duration: 0.14, ease: 'back.out(1.6)' }, T.s3 + 0.02 + i * 0.05);
  });
  // …then the ramp comes down
  tl.to(lander.userData.ramp.rotation, { z: -0.314, duration: 0.26, ease: 'power2.inOut' }, T.s3 + 0.06);
  // convoy rolls down and out
  drive(T.s3 + 0.32, 0.78, egress, ribbons.egress, {
    tow: true, fromHitch: true, surfaceY: egressSurfaceY, followTarget: true,
    ease: 'power1.inOut', dust: false,
  });
  cam(T.s3 + 0.5, 0.5, { x: -14, y: 2.4, z: 6 });

  // ============================================================
  // S4 — FIRST MISSION
  // ============================================================
  card(3, T.s4 + 0.06, T.s5 - 0.14);
  cam(T.s4, 0.3, { x: -8.5, y: 1.9, z: 3.2, tx: B.x, ty: 1.0, tz: B.z });
  // work lights on: the pick area is deliberately lit
  tl.to(epoc.userData, { lampBoost: 2.4, duration: 0.1 }, T.s4 + 0.02);
  tl.to(epoc.userData, { lampBoost: 0, duration: 0.12 }, T.s4 + 0.94);
  // the arm swings over the magazine and hovers above the cartridge…
  armPose(T.s4 + 0.04, 0.16, TA_EGRESS.hover);
  // …lowers straight onto it…
  armPose(T.s4 + 0.22, 0.08, TA_EGRESS.grab);
  // …latches — the cartridge is now attached to the gripper…
  carry(cartridges[CART_A], 'slot', 'wrist', T.s4 + 0.31, 0.06);
  // …lifts it high clear of the magazine walls…
  armPose(T.s4 + 0.39, 0.09, TA_EGRESS.hover);
  // …carries it over the deck while the bay lid opens…
  lidOpen(T.s4 + 0.5, 0.12);
  armPose(T.s4 + 0.5, 0.16, POSE_CARRY);
  // …hovers over the open bay, lowers the payload straight in…
  armPose(T.s4 + 0.66, 0.09, BOX_HOVER);
  armPose(T.s4 + 0.76, 0.07, BOX_SEAT);
  carry(cartridges[CART_A], 'wrist', 'belly', T.s4 + 0.84, 0.04);
  // …lifts clear, and the lid shuts over the payload
  armPose(T.s4 + 0.89, 0.09, BOX_HOVER);
  lidClose(T.s4 + 0.99, 0.09);
  armPose(T.s4 + 0.99, 0.12, POSE_STOW);
  // the whole train advances into the rough zone — trailer and all
  noteArrival(egress);
  turn(T.s4 + 0.9, 0.08, m1, HITCH / m1.getLength());
  cam(T.s4 + 0.97, 0.3, { x: 2.5, y: 3.4, z: -0.5 });
  drive(T.s4 + 1.0, 0.36, m1, ribbons.m1, { tow: true, fromHitch: true, followTarget: true });
  // operate: belly payload live, downlink to the relay orbiter
  lidOpen(T.s5 - 0.16, 0.08);
  tl.to(cartridges[CART_A].userData, { boost: 1, duration: 0.1 }, T.s5 - 0.12);
  tl.to(beam.material, { opacity: 0.65, duration: 0.1 }, T.s5 - 0.1);

  // ============================================================
  // S5 — END OF FIRST MISSION: THE SWAP
  // ============================================================
  card(4, T.s5 + 0.06, T.s6 - 0.14);
  tl.to(beam.material, { opacity: 0, duration: 0.08 }, T.s5 + 0.06);
  tl.to(cartridges[CART_A].userData, { boost: 0, duration: 0.08 }, T.s5 + 0.06);
  lidClose(T.s5 + 0.08, 0.08);
  // the swap happens RIGHT HERE at crater site one — the magazine is
  // on the hook behind; nobody drives anywhere
  noteArrival(m1);
  tl.to(epoc.userData, { lampBoost: 2.4, duration: 0.1 }, T.s5 + 0.14);
  cam(T.s5 + 0.12, 0.3, { x: 5, y: 2.4, z: -7, tx: D1.x, ty: 1.0, tz: D1.z });
  // lid opens; the arm lifts the spent cartridge out — attached all the way…
  lidOpen(T.s5 + 0.16, 0.1);
  armPose(T.s5 + 0.2, 0.1, BOX_HOVER);
  armPose(T.s5 + 0.32, 0.06, BOX_SEAT);
  carry(cartridges[CART_A], 'belly', 'wrist', T.s5 + 0.39, 0.04);
  armPose(T.s5 + 0.44, 0.08, BOX_HOVER);
  lidClose(T.s5 + 0.53, 0.08);
  // …racks it home in the magazine…
  armPose(T.s5 + 0.53, 0.15, TA_S1.hover);
  armPose(T.s5 + 0.7, 0.06, TA_S1.grab);
  carry(cartridges[CART_A], 'wrist', 'slot', T.s5 + 0.77, 0.05);
  tl.set(cartridges[CART_A].userData, { dimmed: true, immediateRender: false }, T.s5 + 0.83);
  armPose(T.s5 + 0.84, 0.07, TA_S1.hover);
  // …and takes the next payload straight off the shelf
  armPose(T.s5 + 0.93, 0.08, TB_S1.hover);
  armPose(T.s5 + 1.02, 0.06, TB_S1.grab);
  carry(cartridges[CART_B], 'slot', 'wrist', T.s5 + 1.09, 0.05);
  armPose(T.s5 + 1.16, 0.08, TB_S1.hover);

  // ============================================================
  // S6 — NEXT MISSIONS (fast-cycle montage)
  // ============================================================
  card(5, T.s6 + 0.06, T.s7 - 0.14);
  // payload two goes into the bay…
  tl.to(epoc.userData, { lampBoost: 0, duration: 0.12 }, T.s6 + 0.5);
  lidOpen(T.s6 + 0.04, 0.1);
  armPose(T.s6 + 0.02, 0.14, POSE_CARRY);
  armPose(T.s6 + 0.18, 0.08, BOX_HOVER);
  armPose(T.s6 + 0.28, 0.06, BOX_SEAT);
  carry(cartridges[CART_B], 'wrist', 'belly', T.s6 + 0.35, 0.04);
  armPose(T.s6 + 0.4, 0.07, BOX_HOVER);
  lidClose(T.s6 + 0.48, 0.08);
  armPose(T.s6 + 0.48, 0.1, POSE_STOW);
  // …and the convoy rolls ONWARD — never back — to crater site two
  cam(T.s6 + 0.56, 0.3, { x: 9, y: 8.5, z: 9, tx: 13, ty: 0, tz: -3 });
  noteArrival(m1);
  turn(T.s6 + 0.6, 0.06, leg2, HITCH / leg2.getLength());
  drive(T.s6 + 0.68, 0.54, leg2, ribbons.leg2, { tow: true, fromHitch: true, followTarget: true });
  // operate at site two, on the crater floor
  lidOpen(T.s6 + 1.25, 0.06);
  tl.to(cartridges[CART_B].userData, { boost: 1, duration: 0.05 }, T.s6 + 1.28);
  tl.to(beam.material, { opacity: 0.65, duration: 0.05 }, T.s6 + 1.29);
  tl.to(beam.material, { opacity: 0, duration: 0.05 }, T.s6 + 1.41);
  tl.to(cartridges[CART_B].userData, { boost: 0, duration: 0.05 }, T.s6 + 1.42);
  lidClose(T.s6 + 1.45, 0.05);

  // ============================================================
  // S7 — TRAILER HEAVEN
  // ============================================================
  card(6, T.s7 + 0.06, T.s8 - 0.14);
  // manifest served — rack the last cartridge right here at site two
  noteArrival(leg2);
  tl.to(epoc.userData, { lampBoost: 2.4, duration: 0.1 }, T.s7 + 0.04);
  tl.to(epoc.userData, { lampBoost: 0, duration: 0.12 }, T.s7 + 0.82);
  cam(T.s7 + 0.02, 0.25, { x: 7.5, y: 2.4, z: 11, tx: D2.x, ty: 1.0, tz: D2.z });
  // the last cartridge comes out of the bay and is racked home
  lidOpen(T.s7 + 0.06, 0.1);
  armPose(T.s7 + 0.1, 0.1, BOX_HOVER);
  armPose(T.s7 + 0.21, 0.06, BOX_SEAT);
  carry(cartridges[CART_B], 'belly', 'wrist', T.s7 + 0.28, 0.04);
  armPose(T.s7 + 0.33, 0.07, BOX_HOVER);
  lidClose(T.s7 + 0.41, 0.08);
  armPose(T.s7 + 0.41, 0.13, TB_S2.hover);
  armPose(T.s7 + 0.56, 0.06, TB_S2.grab);
  carry(cartridges[CART_B], 'wrist', 'slot', T.s7 + 0.63, 0.05);
  tl.set(cartridges[CART_B].userData, { dimmed: true, immediateRender: false }, T.s7 + 0.69);
  armPose(T.s7 + 0.7, 0.07, TB_S2.hover);
  armPose(T.s7 + 0.79, 0.1, POSE_STOW);
  // still hitched — onward again, the final tow to Trailer Heaven
  cam(T.s7 + 0.9, 0.4, { x: 16, y: 3.4, z: 16 });
  turn(T.s7 + 0.9, 0.08, towCurve, HITCH / towCurve.getLength());
  drive(T.s7 + 1.02, 0.44, towCurve, ribbons.tow, {
    tow: true, fromHitch: true, followTarget: true,
  });
  // parked: a warm send-off glow
  tl.to(oasys.userData, { lampBoost: 2.6, duration: 0.16 }, T.s8 - 0.14);

  // ============================================================
  // S8 — E1O2: THE NEXT ADVENTURE
  // ============================================================
  card(7, T.s8 + 0.06, null); // stays until the pin releases
  tl.to(tow.rotation, { z: 0.85, y: 0, duration: 0.1 }, T.s8 + 0.02);
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
