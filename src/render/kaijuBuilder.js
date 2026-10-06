import * as THREE from 'three';
import { kaijuTextures } from './textures.js';
import { mergeStaticMeshes, disposeMerged } from './merge.js';

const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
const sph = (r, ws = 18, hs = 14) => cached(`s${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
const cap = (r, l, seg = 10) => cached(`c${r},${l},${seg}`, () => new THREE.CapsuleGeometry(r, l, 4, seg));
const cone = (r, h, seg = 10) => cached(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
const cyl = (rt, rb, h, seg = 10) => cached(`y${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const box = (w, h, d) => cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));

function add(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  parent.add(m);
  return m;
}
function pivot(parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

let seedCounter = 1;

function materials(def) {
  const tex = kaijuTextures(def.skin, def.glow, def.name.length + seedCounter++ % 3);
  const glow = new THREE.Color(def.glow);
  return {
    skin: new THREE.MeshStandardMaterial({
      map: tex.map,
      emissiveMap: tex.emissive,
      emissive: glow,
      emissiveIntensity: 0.9,
      roughness: 0.62,
      metalness: 0.12,
    }),
    belly: new THREE.MeshStandardMaterial({ color: def.belly, roughness: 0.75, metalness: 0.05 }),
    bone: new THREE.MeshStandardMaterial({ color: '#cfc6b0', roughness: 0.45, metalness: 0.1 }),
    shell: new THREE.MeshStandardMaterial({
      map: tex.map,
      color: '#bbbbbb',
      roughness: 0.35,
      metalness: 0.35,
      emissiveMap: tex.emissive,
      emissive: glow,
      emissiveIntensity: 0.5,
    }),
    glow: new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 2.6, roughness: 0.4 }),
    mouth: new THREE.MeshStandardMaterial({ color: '#200a0a', emissive: glow, emissiveIntensity: 1.2, roughness: 0.8 }),
  };
}

// ---------- TESTE ----------
function buildHead(type, neck, M) {
  const head = pivot(neck, 0, 0, 0);
  let jaw;
  const teeth = (parent, len, rows = 1, z0 = 0.2, w = 0.45, down = true) => {
    for (let i = 0; i < 7; i++) {
      const z = z0 + (i / 6) * len;
      const ww = w * (1 - (i / 7) * 0.6);
      for (const s of [-1, 1]) add(parent, cone(0.07, 0.3, 5), M.bone, ww * s, down ? -0.12 : 0.12, z, down ? Math.PI : 0, 0, 0);
    }
  };
  switch (type) {
    case 'crab': {
      add(head, sph(1), M.shell, 0, 0, 0.6, 0, 0, 0, 1.45, 0.6, 1.05);
      for (const s of [-1, 1]) {
        add(head, cyl(0.08, 0.12, 1.0, 6), M.skin, 0.55 * s, 0.75, 0.9, 0.3, 0, 0.2 * s);
        add(head, sph(0.2, 10, 8), M.glow, 0.65 * s, 1.25, 1.05);
        const m = pivot(head, 0.45 * s, -0.25, 1.4);
        m.rotation.y = 0.4 * s;
        add(m, cone(0.16, 0.9, 6), M.bone, 0, 0, 0.35, Math.PI / 2, 0, 0);
      }
      jaw = pivot(head, 0, -0.35, 0.6);
      add(jaw, sph(0.8), M.belly, 0, 0, 0.4, 0, 0, 0, 1.1, 0.3, 0.9);
      add(head, sph(0.45), M.mouth, 0, -0.25, 1.1, 0, 0, 0, 1.2, 0.6, 0.8);
      break;
    }
    case 'cobra': {
      add(head, sph(1), M.skin, 0, 0.1, 0.85, 0, 0, 0, 0.72, 0.5, 1.3);
      const hood = add(head, sph(1), M.skin, 0, 0.2, -0.35, 0.15, 0, 0, 2.3, 2.0, 0.22);
      hood.castShadow = true;
      add(head, sph(1), M.glow, 0, 0.3, -0.25, 0.15, 0, 0, 0.5, 1.2, 0.05);
      for (const s of [-1, 1]) {
        add(head, sph(0.13, 10, 8), M.glow, 0.42 * s, 0.32, 1.3);
        add(head, sph(0.32, 10, 8), M.glow, 1.3 * s, 0.6, -0.2, 0, 0, 0, 1, 1.4, 0.2);
      }
      jaw = pivot(head, 0, -0.18, 0.3);
      add(jaw, sph(1), M.belly, 0, -0.08, 0.55, 0, 0, 0, 0.6, 0.22, 1.0);
      for (const s of [-1, 1]) add(head, cone(0.08, 0.6, 6), M.bone, 0.25 * s, -0.3, 1.65, Math.PI, 0, 0);
      add(head, sph(0.4), M.mouth, 0, -0.1, 1.0, 0, 0, 0, 1, 0.4, 1.6);
      break;
    }
    case 'horned': {
      add(head, sph(1), M.skin, 0, 0, 0.8, 0, 0, 0, 1.05, 0.85, 1.3);
      add(head, sph(1), M.shell, 0, 0.45, 0.3, 0, 0, 0, 1.2, 0.5, 1.0);
      for (const s of [-1, 1]) {
        const h = pivot(head, 0.8 * s, 0.5, 0.4);
        h.rotation.set(-0.5, 0, -0.9 * s);
        add(h, cone(0.32, 2.4, 8), M.bone, 0, 1.2, 0);
        add(h, sph(0.12, 8, 6), M.glow, 0, 2.4, 0);
        add(head, sph(0.15, 10, 8), M.glow, 0.55 * s, 0.25, 1.65);
      }
      add(head, cone(0.25, 1.1, 8), M.bone, 0, 0.65, 1.7, 0.9, 0, 0);
      jaw = pivot(head, 0, -0.35, 0.4);
      add(jaw, sph(1), M.belly, 0, -0.1, 0.7, 0, 0, 0, 0.85, 0.35, 1.1);
      teeth(jaw, 1.2, 1, 0.3, 0.55, false);
      add(head, sph(0.5), M.mouth, 0, -0.3, 1.0, 0, 0, 0, 1.2, 0.5, 1.5);
      break;
    }
    case 'abyss': {
      add(head, sph(1), M.skin, 0, 0.1, 0.9, 0, 0, 0, 1.4, 0.95, 1.8);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) add(head, sph(0.14 - i * 0.02, 10, 8), M.glow, (0.85 - i * 0.12) * s, 0.4 - i * 0.05, 1.75 - i * 0.45);
      }
      for (let i = 0; i < 7; i++) {
        const a = (i / 6 - 0.5) * 2.4;
        const sp = pivot(head, Math.sin(a) * 1.0, 0.75, 0.2 + Math.cos(a) * 0.2);
        sp.rotation.set(-1.1, 0, -a * 0.7);
        add(sp, cone(0.22, 1.8, 6), M.bone, 0, 0.9, 0);
        add(sp, sph(0.08, 6, 4), M.glow, 0, 1.8, 0);
      }
      jaw = pivot(head, 0, -0.4, 0.3);
      add(jaw, sph(1), M.belly, 0, -0.1, 0.9, 0, 0, 0, 1.25, 0.4, 1.55);
      teeth(jaw, 2.0, 1, 0.3, 0.95, false);
      teeth(head, 2.0, 1, 0.5, 1.0, true);
      add(head, sph(0.7), M.mouth, 0, -0.35, 1.3, 0, 0, 0, 1.3, 0.5, 1.6);
      break;
    }
    default: {
      // shark
      add(head, sph(1), M.skin, 0, 0.05, 0.9, 0, 0, 0, 0.82, 0.62, 1.55);
      const blade = add(head, box(0.14, 1.0, 2.6), M.bone, 0, 0.6, 0.6, -0.15, 0, 0);
      blade.scale.set(1, 1, 1);
      add(head, cone(0.5, 1.4, 4), M.bone, 0, 0.55, 2.2, Math.PI / 2 + 0.2, 0, 0, 0.3, 1, 1);
      for (const s of [-1, 1]) add(head, sph(0.13, 10, 8), M.glow, 0.58 * s, 0.2, 1.25);
      jaw = pivot(head, 0, -0.28, 0.2);
      add(jaw, sph(1), M.belly, 0, -0.05, 0.85, 0, 0, 0, 0.7, 0.28, 1.35);
      teeth(jaw, 1.8, 1, 0.2, 0.55, false);
      teeth(head, 1.8, 1, 0.3, 0.6, true);
      add(head, sph(0.45), M.mouth, 0, -0.2, 1.0, 0, 0, 0, 1.1, 0.5, 2);
    }
  }
  return { head, jaw };
}

function buildClawArm(parent, x, y, z, side, M, size = 1, pincer = false) {
  const sh = pivot(parent, x, y, z);
  add(sh, sph(0.7 * size), M.skin, 0, 0, 0);
  add(sh, cap(0.55 * size, 1.6 * size), M.skin, 0, -1.1 * size, 0);
  const el = pivot(sh, 0, -2.0 * size, 0);
  add(el, sph(0.5 * size), M.skin, 0, 0, 0);
  add(el, cap(0.45 * size, 1.5 * size), M.skin, 0, -1.0 * size, 0);
  const hand = pivot(el, 0, -1.9 * size, 0);
  let pinch = null;
  if (pincer) {
    add(hand, sph(1), M.shell, 0, -0.6 * size, 0, 0, 0, 0, 0.75 * size, 1.1 * size, 0.6 * size);
    const top = pivot(hand, 0, -1.2 * size, 0.2 * size);
    add(top, cone(0.4 * size, 2.0 * size, 8), M.shell, 0, -0.9 * size, 0.1, Math.PI, 0, 0, 1, 1, 0.7);
    pinch = pivot(hand, 0, -1.2 * size, -0.25 * size);
    add(pinch, cone(0.3 * size, 1.6 * size, 8), M.shell, 0, -0.75 * size, -0.1, Math.PI, 0, 0, 1, 1, 0.7);
    add(top, sph(0.1, 6, 4), M.glow, 0, -1.8 * size, 0.2);
  } else {
    add(hand, sph(0.45 * size), M.skin, 0, -0.2 * size, 0, 0, 0, 0, 1, 0.8, 1.2);
    for (let i = 0; i < 3; i++) {
      const c = pivot(hand, (i - 1) * 0.25 * size, -0.4 * size, 0.15 * size);
      c.rotation.set(0.35, 0, (i - 1) * 0.25);
      add(c, cone(0.12 * size, 1.4 * size, 6), M.bone, 0, -0.7 * size, 0, Math.PI, 0, 0);
    }
  }
  return { sh, el, hand, pinch, side };
}

function buildLeg(parent, x, y, z, M, cfg) {
  const hip = pivot(parent, x, y, z);
  add(hip, sph(cfg.r * 1.2), M.skin, 0, 0, 0);
  add(hip, cap(cfg.r, cfg.thigh - cfg.r), M.skin, 0, -cfg.thigh / 2, 0);
  const knee = pivot(hip, 0, -cfg.thigh, 0);
  add(knee, sph(cfg.r * 0.85), M.skin, 0, 0, 0);
  add(knee, cap(cfg.r * 0.7, cfg.shin - cfg.r), M.skin, 0, -cfg.shin / 2, 0);
  const ankle = pivot(knee, 0, -cfg.shin, 0);
  add(ankle, sph(cfg.r), M.skin, 0, -0.1, 0.3, 0, 0, 0, 1.1, 0.5, 1.6);
  for (let i = 0; i < 3; i++) {
    const t = pivot(ankle, (i - 1) * cfg.r * 0.6, -0.2, cfg.r * 1.3);
    t.rotation.set(Math.PI / 2 + 0.3, 0, 0);
    add(t, cone(0.13, 0.7, 5), M.bone, 0, 0.3, 0);
  }
  return { hip, knee, ankle };
}

function buildTail(parent, x, y, z, segs, M, baseR, dir = -1) {
  const pivots = [];
  let p = pivot(parent, x, y, z);
  let r = baseR;
  const segLen = baseR * 1.35;
  for (let i = 0; i < segs; i++) {
    add(p, sph(1, 12, 10), M.skin, 0, 0, (dir * segLen) / 2, 0, 0, 0, r, r * 0.85, segLen * 0.75);
    if (i % 2 === 0) add(p, cone(r * 0.35, r * 1.1, 5), M.bone, 0, r * 0.85, (dir * segLen) / 2, -0.5, 0, 0);
    if (i % 3 === 1) add(p, sph(r * 0.18, 6, 4), M.glow, r * 0.75, 0, (dir * segLen) / 2);
    pivots.push(p);
    p = pivot(p, 0, 0, dir * segLen);
    r *= 0.84;
  }
  add(p, cone(r * 1.1, r * 3, 6), M.bone, 0, 0, dir * r * 1.4, (dir * Math.PI) / 2, 0, 0);
  return pivots;
}

/** Costruisce il modello 3D di un Kaiju. */
export function buildKaiju(def, { shadows = false } = {}) {
  const M = materials(def);
  const b = def.body;
  const root = new THREE.Group();
  const body = pivot(root);
  body.scale.setScalar(def.size);
  const rig = { form: b.form, legs: [], arms: [], tail: [], spikes: [] };

  if (b.form === 'quad') {
    const legCfg = { thigh: 2.1, shin: 2.1, r: 0.62, restHip: -0.25, restKnee: 0.55, restAnkle: -0.3 };
    const legH = legCfg.thigh * Math.cos(legCfg.restHip) + legCfg.shin * Math.cos(legCfg.restHip + legCfg.restKnee) + 0.35;
    const torso = pivot(body, 0, legH + 0.5, 0);
    rig.hips = torso;
    rig.hipY = legH + 0.5;
    add(torso, sph(2), M.skin, 0, 0.3, 0, 0, 0, 0, 1.25, 0.95, 1.85);
    add(torso, sph(2), M.belly, 0, -0.35, 0.2, 0, 0, 0, 1.05, 0.65, 1.6);
    if (b.shell) {
      add(torso, sph(2.3, 20, 10), M.shell, 0, 0.75, -0.1, 0, 0, 0, 1.25, 0.6, 1.6);
      for (let i = 0; i < 5; i++) add(torso, box(3.6 - Math.abs(i - 2) * 0.5, 0.25, 0.35), M.shell, 0, 2.05 - Math.abs(i - 2) * 0.12, -2 + i);
    }
    const spine = pivot(torso, 0, 0, 0);
    rig.spine = spine;
    const nSpikes = b.spikes || 0;
    for (let i = 0; i < nSpikes; i++) {
      const t = i / Math.max(1, nSpikes - 1);
      const z = 2.2 - t * 4.4;
      const h = 1.4 + Math.sin(t * Math.PI) * 1.4;
      const sp = add(spine, cone(0.35, h, 6), b.head === 'horned' ? M.glow : M.bone, 0, 1.9 + Math.sin(t * Math.PI) * 0.2, z, -0.35, 0, 0);
      if (b.head === 'horned') sp.material = M.glow;
      rig.spikes.push(sp);
    }
    const neck = pivot(spine, 0, 0.6, 3.4);
    add(neck, cap(0.95, 1.0), M.skin, 0, 0.1, 0.6, Math.PI / 2 - 0.3, 0, 0);
    const headPivot = pivot(neck, 0, 0.2, 1.3);
    rig.neck = neck;
    const h = buildHead(b.head, headPivot, M);
    rig.head = h.head;
    rig.jaw = h.jaw;
    rig.headPivot = headPivot;
    const front = 2.3;
    const back = -2.2;
    const lx = 1.85;
    for (const [x, z, front_] of [
      [-lx, front, true],
      [lx, front, true],
      [-lx, back, false],
      [lx, back, false],
    ]) {
      const leg = buildLeg(torso, x, -0.4, z, M, legCfg);
      leg.side = Math.sign(x);
      leg.front = front_;
      leg.rest = { hip: legCfg.restHip, knee: legCfg.restKnee, ankle: legCfg.restAnkle };
      rig.legs.push(leg);
    }
    if (b.arms === 'pincers') {
      rig.arms.push(buildClawArm(spine, -1.7, 0.2, 3.0, -1, M, 0.9, true));
      rig.arms.push(buildClawArm(spine, 1.7, 0.2, 3.0, 1, M, 0.9, true));
    }
    rig.tail = buildTail(torso, 0, 0.3, -3.5, b.tail || 4, M, 0.95);
    rig.height = (legH + 3) * def.size;
  } else {
    // bipede
    const legCfg = { thigh: 2.3, shin: 2.3, r: 0.72, restHip: -0.55, restKnee: 1.15, restAnkle: -0.6 };
    const legH = legCfg.thigh * Math.cos(legCfg.restHip) + legCfg.shin * Math.cos(legCfg.restHip + legCfg.restKnee) + 0.35;
    const hips = pivot(body, 0, legH, 0);
    rig.hips = hips;
    rig.hipY = legH;
    add(hips, sph(1.35), M.skin, 0, 0, -0.1, 0, 0, 0, 1.25, 1.0, 1.35);
    for (const s of [-1, 1]) {
      const leg = buildLeg(hips, 1.15 * s, -0.25, 0, M, legCfg);
      leg.side = s;
      leg.front = true;
      leg.rest = { hip: legCfg.restHip, knee: legCfg.restKnee, ankle: legCfg.restAnkle };
      rig.legs.push(leg);
    }
    rig.tail = buildTail(hips, 0, 0.1, -1.3, b.tail || 5, M, 1.0);
    const spine = pivot(hips, 0, 0.5, 0);
    spine.rotation.x = 0.45;
    rig.spine = spine;
    rig.spineRest = 0.45;
    add(spine, sph(1.8), M.skin, 0, 1.7, 0, 0, 0, 0, 1.3, 1.45, 1.08);
    add(spine, sph(1.6), M.belly, 0, 1.4, 0.55, 0, 0, 0, 1.05, 1.25, 0.75);
    add(spine, sph(1.4), M.skin, 0, 3.0, 0.3, 0, 0, 0, 1.45, 0.9, 1.0);
    const nSpikes = b.spikes || 0;
    for (let i = 0; i < nSpikes; i++) {
      const t = i / Math.max(1, nSpikes - 1);
      const y = 3.6 - t * 3.4;
      const z = -1.35 - Math.sin(t * Math.PI) * 0.4;
      const h = 0.9 + Math.sin(t * Math.PI) * (b.crown ? 1.8 : 1.1);
      const sp = add(spine, cone(0.28, h, 6), M.bone, 0, y, z, -1.9, 0, 0);
      rig.spikes.push(sp);
      if (i % 2 === 0) add(spine, sph(0.12, 6, 4), M.glow, 0, y + 0.05, z + 0.25);
    }
    if (b.crown) {
      for (const s of [-1, 1])
        for (let i = 0; i < 4; i++) add(spine, cone(0.3, 1.6 - i * 0.2, 6), M.bone, 1.2 * s, 3.4 - i * 0.6, -1.0, -1.6, 0, 0.6 * s);
    }
    // venature luminose sul petto
    for (let i = 0; i < 3; i++) add(spine, box(0.12, 1.4 - i * 0.3, 0.12), M.glow, (i - 1) * 0.5, 1.5, 1.7 - Math.abs(i - 1) * 0.12, 0.1, 0, 0);
    const neck = pivot(spine, 0, 3.4, 1.0);
    neck.rotation.x = -0.45;
    rig.neckRest = -0.45;
    add(neck, cap(0.85, 0.8), M.skin, 0, 0.3, 0.3, Math.PI / 2 - 0.5, 0, 0);
    const headPivot = pivot(neck, 0, 0.5, 0.9);
    rig.neck = neck;
    const h = buildHead(b.head, headPivot, M);
    rig.head = h.head;
    rig.jaw = h.jaw;
    rig.headPivot = headPivot;
    rig.arms.push(buildClawArm(spine, -2.0, 2.6, 0.5, -1, M, b.head === 'abyss' ? 1.15 : 1));
    rig.arms.push(buildClawArm(spine, 2.0, 2.6, 0.5, 1, M, b.head === 'abyss' ? 1.15 : 1));
    rig.height = (legH + 5.5) * def.size;
  }

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = shadows;
      o.receiveShadow = shadows;
    }
  });
  mergeStaticMeshes(root);

  const mats = Object.values(M);
  return {
    root,
    body,
    rig,
    materials: M,
    allMaterials: mats,
    dispose() {
      disposeMerged(root);
      mats.forEach((m) => m.dispose());
    },
  };
}
