// ============================================================
// Texture set: baked tileable PBR maps (tools/bake_textures.py)
// plus real imagery — Earth day map and Milky Way panorama from
// Solar System Scope (CC BY 4.0, credited in README + footer).
// Textures load async; materials pop in as they arrive.
// ============================================================
import * as THREE from 'three';

const loader = new THREE.TextureLoader();

function tex(url, { srgb = true, repeat = 1 } = {}) {
  const t = loader.load(url);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat !== 1) t.repeat.set(repeat, repeat);
  return t;
}

export const T = {
  regolith: tex('/textures/regolith_albedo.jpg'),
  // separate instance for the rim mountains (different repeat; a .clone()
  // of a still-loading texture never gets its needsUpdate callback)
  regolithRim: tex('/textures/regolith_albedo.jpg'),
  regolithN: tex('/textures/regolith_normal.jpg', { srgb: false }),
  rock: tex('/textures/rock_albedo.jpg'),
  rockN: tex('/textures/rock_normal.jpg', { srgb: false }),
  mli: tex('/textures/mli_albedo.jpg'),
  mliN: tex('/textures/mli_normal.jpg', { srgb: false }),
  mliRough: tex('/textures/mli_rough.jpg', { srgb: false }),
  alu: tex('/textures/alu_albedo.jpg'),
  paint: tex('/textures/paint_albedo.jpg', { repeat: 2 }),
  solar: tex('/textures/solar_albedo.jpg'),
  earth: tex('/textures/earth_daymap.jpg'),
  milkyWay: tex('/textures/stars_milky_way.jpg'),
};
