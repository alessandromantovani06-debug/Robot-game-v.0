import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { FINISHES, PARTS, getPart } from '../data/parts.js';
import { panelTexture, frameTexture, decalTexture } from './textures.js';
import { mergeStaticMeshes, disposeMerged } from './merge.js';

// ---------- geometrie in cache ----------
const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
const rbox = (w, h, d, r = 0.1) =>
  cached(`rb${w},${h},${d},${r}`, () => {
    const rr = Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01);
    return new RoundedBoxGeometry(w, h, d, 2, Math.max(0.005, rr));
  });
const cyl = (rt, rb, h, seg = 16, open = false, ts = 0, tl = Math.PI * 2) =>
  cached(`cy${rt},${rb},${h},${seg},${open},${ts},${tl}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl));
const sph = (r, ws = 16, hs = 12) => cached(`sp${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
const tor = (r, t, rs = 8, ts = 24) => cached(`to${r},${t},${rs},${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts));
const cone = (r, h, seg = 12) => cached(`co${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
const plane = (w, h) => cached(`pl${w},${h}`, () => new THREE.PlaneGeometry(w, h));

function add(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function pivot(parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

export const HIP_Y = 4.4;

// Posa di riposo delle gambe (rotazioni x di anca, ginocchio, caviglia).
const LEG_REST = {
  lg_std: { hip: -0.12, knee: 0.24, ankle: -0.12, thigh: 2.0, shin: 2.0 },
  lg_heavy: { hip: -0.1, knee: 0.2, ankle: -0.1, thigh: 2.0, shin: 2.0 },
  lg_digi: { hip: -0.45, knee: 1.0, ankle: -0.55, thigh: 2.25, shin: 2.25 },
  lg_thrust: { hip: -0.12, knee: 0.24, ankle: -0.12, thigh: 2.0, shin: 2.0 },
};

function makeMaterials(cfg) {
  const fin = FINISHES.find((f) => f.id === cfg.finish) || FINISHES[0];
  const { primary, secondary, accent } = cfg.colors;
  const std = (opts) =>
    new THREE.MeshStandardMaterial({ metalness: fin.metalness, roughness: fin.roughness, ...opts });
  const accentColor = new THREE.Color(accent);
  return {
    primary: std({ map: panelTexture(primary, secondary, cfg.pattern, 'a') }),
    secondary: std({ map: panelTexture(secondary, primary, 'none', 'b') }),
    frame: new THREE.MeshStandardMaterial({ color: '#7a828e', map: frameTexture(), metalness: 0.75, roughness: 0.42 }),
    dark: new THREE.MeshStandardMaterial({ color: '#1b1e23', metalness: 0.6, roughness: 0.5 }),
    glow: new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 2.4,
      metalness: 0,
      roughness: 0.3,
    }),
    glowDim: new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.7,
      metalness: 0,
      roughness: 0.4,
    }),
    visor: new THREE.MeshStandardMaterial({
      color: '#05080c',
      emissive: accentColor,
      emissiveIntensity: 1.6,
      metalness: 0.9,
      roughness: 0.15,
    }),
    flame: new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffb24a').multiplyScalar(2.2),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    flameAccent: new THREE.MeshBasicMaterial({
      color: accentColor.clone().multiplyScalar(2.2),
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  };
}

function flame(parent, mat, x, y, z, length = 1.6, radius = 0.28, dir = 1) {
  const g = pivot(parent, x, y, z);
  const m = add(g, cone(radius, length, 10), mat, 0, (dir * length) / 2, 0, dir > 0 ? Math.PI : 0, 0, 0);
  m.castShadow = false;
  m.receiveShadow = false;
  const inner = add(g, cone(radius * 0.5, length * 0.6, 8), mat, 0, (dir * length * 0.3), 0, dir > 0 ? Math.PI : 0, 0, 0);
  inner.castShadow = false;
  g.visible = false;
  return g;
}

// ---------- TESTE ----------
function buildHead(id, neck, M) {
  add(neck, cyl(0.38, 0.5, 0.55), M.frame, 0, 0.2, 0);
  const h = pivot(neck, 0, 0.35, 0);
  switch (id) {
    case 'hd_dome': {
      const d = add(h, sph(0.72, 20, 14), M.primary, 0, 0.5, 0);
      d.scale.set(1, 0.82, 1);
      add(h, cyl(0.74, 0.74, 0.3, 24, true, -1.25, 2.5), M.visor, 0, 0.5, 0);
      add(h, cyl(0.22, 0.22, 0.3, 12), M.secondary, 0.74, 0.45, 0, 0, 0, Math.PI / 2);
      add(h, cyl(0.22, 0.22, 0.3, 12), M.secondary, -0.74, 0.45, 0, 0, 0, Math.PI / 2);
      add(h, rbox(0.5, 0.12, 0.9, 0.05), M.secondary, 0, 1.08, -0.05);
      add(h, rbox(0.7, 0.3, 0.25, 0.06), M.frame, 0, 0.12, 0.55);
      break;
    }
    case 'hd_crest': {
      add(h, rbox(1.0, 0.85, 1.1, 0.14), M.primary, 0, 0.45, 0);
      add(h, rbox(0.75, 0.38, 0.25, 0.06), M.frame, 0, 0.18, 0.55);
      for (const s of [-1, 1]) {
        add(h, rbox(0.34, 0.09, 0.08, 0.03), M.glow, 0.22 * s, 0.6, 0.56, 0, 0, -0.25 * s);
        add(h, rbox(0.14, 1.25, 0.12, 0.05), M.secondary, 0.34 * s, 1.25, 0.42, 0.25, 0, -0.55 * s);
        add(h, rbox(0.18, 0.7, 0.9, 0.06), M.secondary, 0.58 * s, 0.4, -0.05);
      }
      add(h, rbox(0.2, 0.32, 0.25, 0.05), M.glow, 0, 0.95, 0.5);
      break;
    }
    case 'hd_tri': {
      add(h, rbox(1.2, 0.92, 1.1, 0.16), M.primary, 0, 0.45, 0);
      add(h, rbox(1.32, 0.22, 0.45, 0.08), M.secondary, 0, 0.85, 0.35);
      const eye = (x, y, r) => add(h, cyl(r, r, 0.12, 16), M.glow, x, y, 0.56, Math.PI / 2, 0, 0);
      eye(-0.3, 0.55, 0.13);
      eye(0.3, 0.55, 0.13);
      eye(0, 0.3, 0.1);
      add(h, rbox(0.15, 0.6, 0.15, 0.05), M.secondary, 0, 1.0, -0.35, -0.4, 0, 0);
      break;
    }
    case 'hd_hunter': {
      add(h, rbox(0.92, 0.72, 1.2, 0.12), M.primary, 0, 0.45, -0.05);
      const beak = add(h, cone(0.55, 1.2, 4), M.secondary, 0, 0.4, 0.85, Math.PI / 2, Math.PI / 4, 0);
      beak.scale.set(1, 1, 0.7);
      for (const s of [-1, 1]) {
        add(h, rbox(0.5, 0.08, 0.1, 0.03), M.glow, 0.36 * s, 0.6, 0.5, 0, 0.5 * s, -0.15 * s);
        add(h, rbox(0.1, 0.45, 0.9, 0.04), M.secondary, 0.45 * s, 0.95, -0.4, -0.5, 0, 0.35 * s);
      }
      break;
    }
    default: {
      // hd_visor
      add(h, rbox(1.1, 0.88, 1.15, 0.16), M.primary, 0, 0.45, 0);
      add(h, rbox(0.98, 0.2, 0.14, 0.06), M.visor, 0, 0.55, 0.56);
      for (const s of [-1, 1]) add(h, rbox(0.24, 0.62, 0.95, 0.06), M.secondary, 0.6 * s, 0.4, -0.02);
      add(h, rbox(0.14, 0.34, 0.75, 0.05), M.secondary, 0, 0.98, -0.05);
      add(h, rbox(0.6, 0.22, 0.2, 0.05), M.frame, 0, 0.12, 0.5);
    }
  }
  return h;
}

// ---------- TORSI ----------
function buildTorso(id, chest, M, refs) {
  // addome e vita comuni
  add(chest, rbox(1.6, 1.0, 1.3, 0.1), M.frame, 0, -0.35, 0);
  for (let i = 0; i < 3; i++) add(chest, rbox(1.75, 0.16, 1.4, 0.05), M.dark, 0, -0.65 + i * 0.3, 0);
  let neckY = 2.35;
  switch (id) {
    case 'tr_plasma': {
      add(chest, rbox(3.1, 1.9, 1.9, 0.2), M.primary, 0, 1.25, -0.05);
      for (const s of [-1, 1]) {
        add(chest, rbox(1.75, 1.35, 0.4, 0.1), M.secondary, 0.78 * s, 1.35, 0.9, 0, 0.12 * s, 0.38 * s);
      }
      const core = add(chest, cyl(0.62, 0.62, 0.18, 3), M.glow, 0, 1.0, 1.05, Math.PI / 2, 0, Math.PI);
      refs.core = core;
      core.userData.keep = true;
      add(chest, rbox(2.2, 0.5, 1.6, 0.12), M.frame, 0, 2.15, -0.1);
      add(chest, rbox(2.3, 1.5, 0.8, 0.15), M.secondary, 0, 1.3, -1.25);
      for (const s of [-1, 1]) add(chest, cyl(0.2, 0.2, 1.2, 10), M.glowDim, 0.6 * s, 1.3, -1.7, 0, 0, 0);
      break;
    }
    case 'tr_tesla': {
      const b = add(chest, sph(1.0, 24, 16), M.primary, 0, 1.25, 0);
      b.scale.set(1.65, 1.2, 1.05);
      add(chest, rbox(2.6, 0.9, 0.5, 0.15), M.secondary, 0, 1.75, 0.8);
      const core = add(chest, sph(0.42, 16, 12), M.glow, 0, 1.0, 0.95);
      refs.core = core;
      core.userData.keep = true;
      const r1 = add(chest, tor(0.6, 0.07), M.secondary, 0, 1.0, 0.95);
      const r2 = add(chest, tor(0.6, 0.05), M.glow, 0, 1.0, 0.95, 0, Math.PI / 2, 0);
      r1.userData.axis = 'y';
      r2.userData.axis = 'x';
      refs.spinners.push(r1, r2);
      for (const s of [-1, 1]) {
        add(chest, cyl(0.22, 0.28, 1.9, 10), M.frame, 0.8 * s, 2.0, -1.05);
        for (let i = 0; i < 3; i++) add(chest, tor(0.3, 0.07, 6, 16), M.glowDim, 0.8 * s, 1.4 + i * 0.5, -1.05, Math.PI / 2, 0, 0);
        add(chest, sph(0.18, 10, 8), M.glow, 0.8 * s, 3.0, -1.05);
      }
      add(chest, rbox(2.0, 0.45, 1.4, 0.12), M.frame, 0, 2.2, -0.05);
      neckY = 2.35;
      break;
    }
    case 'tr_berserk': {
      add(chest, rbox(3.7, 2.2, 2.2, 0.22), M.primary, 0, 1.3, -0.05);
      add(chest, rbox(3.0, 1.0, 0.45, 0.12), M.secondary, 0, 1.75, 1.05, -0.12, 0, 0);
      for (let i = 0; i < 2; i++) {
        const g = add(chest, rbox(1.5, 0.16, 0.12, 0.04), M.glow, 0, 0.95 + i * 0.3, 1.1);
        if (i === 0) {
          refs.core = g;
          g.userData.keep = true;
        }
      }
      add(chest, rbox(2.4, 0.5, 1.7, 0.12), M.frame, 0, 2.3, -0.15);
      for (let i = 0; i < 4; i++) {
        const x = -0.9 + i * 0.6;
        add(chest, cyl(0.2, 0.24, 1.7, 10), M.dark, x, 2.2, -1.3, -0.35, 0, 0);
        add(chest, cyl(0.16, 0.16, 0.08, 10), M.glowDim, x, 3.0, -1.6, -0.35, 0, 0);
      }
      neckY = 2.45;
      break;
    }
    default: {
      // tr_fission
      add(chest, rbox(3.3, 2.0, 1.95, 0.22), M.primary, 0, 1.3, -0.05);
      for (const s of [-1, 1]) add(chest, rbox(1.45, 0.95, 0.45, 0.12), M.secondary, 0.82 * s, 1.75, 0.9, -0.15, 0.1 * s, 0);
      add(chest, tor(0.55, 0.13, 10, 28), M.frame, 0, 0.98, 0.98);
      const core = add(chest, cyl(0.48, 0.48, 0.1, 24), M.glow, 0, 0.98, 0.98, Math.PI / 2, 0, 0);
      refs.core = core;
      core.userData.keep = true;
      const fan = pivot(chest, 0, 0.98, 1.06);
      for (let i = 0; i < 3; i++) add(fan, rbox(0.85, 0.12, 0.05, 0.02), M.dark, 0, 0, 0, 0, 0, (i * Math.PI) / 3);
      refs.spinners.push(fan);
      add(chest, rbox(2.2, 0.5, 1.6, 0.12), M.frame, 0, 2.2, -0.1);
      add(chest, rbox(2.4, 1.6, 0.9, 0.15), M.secondary, 0, 1.3, -1.2);
      for (let i = 0; i < 3; i++) add(chest, rbox(1.8, 0.1, 0.1, 0.02), M.glowDim, 0, 0.9 + i * 0.35, -1.66);
    }
  }
  add(chest, rbox(2.3, 0.6, 1.55, 0.12), M.secondary, 0, 0.12, 0.05);
  return neckY;
}

// ---------- SPALLE ----------
function buildShoulder(id, g, M, code, withDecal) {
  // faccia esterna dello spallaccio: [centroX, centroY, inclinazione, mezza larghezza]
  let face = [0.25, 0.35, -0.22, 0.775];
  switch (id) {
    case 'sh_plate': {
      add(g, rbox(1.95, 1.0, 2.05, 0.2), M.primary, 0.25, 0.45, 0, 0, 0, -0.28);
      add(g, rbox(1.8, 0.35, 1.95, 0.1), M.secondary, 0.55, -0.05, 0, 0, 0, -0.5);
      add(g, rbox(0.25, 0.8, 1.4, 0.06), M.secondary, 0.1, 1.0, -0.1, 0, 0, -0.2);
      face = [0.25, 0.45, -0.28, 0.975];
      break;
    }
    case 'sh_vents': {
      add(g, rbox(1.6, 0.85, 1.6, 0.18), M.primary, 0.25, 0.35, 0, 0, 0, -0.2);
      add(g, cyl(0.58, 0.62, 0.45, 18), M.secondary, 0.2, 0.95, -0.05);
      add(g, cyl(0.45, 0.45, 0.47, 18), M.glowDim, 0.2, 0.96, -0.05);
      const fan = pivot(g, 0.2, 1.21, -0.05);
      for (let i = 0; i < 3; i++) add(fan, rbox(0.85, 0.05, 0.14, 0.02), M.dark, 0, 0, 0, 0, (i * Math.PI) / 3, 0);
      fan.userData.axis = 'y';
      g.userData.spinner = fan;
      face = [0.25, 0.35, -0.2, 0.8];
      break;
    }
    case 'sh_missile': {
      add(g, rbox(1.5, 0.8, 1.6, 0.16), M.primary, 0.25, 0.3, 0, 0, 0, -0.18);
      const pod = pivot(g, 0.15, 1.1, -0.05);
      add(pod, rbox(1.25, 0.85, 1.4, 0.1), M.secondary, 0, 0, 0);
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < 3; c++) {
          add(pod, cyl(0.15, 0.15, 0.1, 10), M.dark, -0.38 + c * 0.38, -0.16 + r * 0.34, 0.71, Math.PI / 2, 0, 0);
          add(pod, cyl(0.08, 0.08, 0.11, 8), M.glow, -0.38 + c * 0.38, -0.16 + r * 0.34, 0.72, Math.PI / 2, 0, 0);
        }
      face = [0.25, 0.3, -0.18, 0.75];
      break;
    }
    case 'sh_antenna': {
      add(g, rbox(1.5, 0.8, 1.5, 0.18), M.primary, 0.25, 0.32, 0, 0, 0, -0.2);
      add(g, rbox(1.55, 0.14, 1.55, 0.05), M.secondary, 0.27, 0.05, 0, 0, 0, -0.2);
      for (let i = 0; i < 2; i++) {
        add(g, cyl(0.05, 0.09, 2.3, 6), M.frame, 0.1 + i * 0.35, 1.6, -0.5, -0.45, 0, -0.1);
        add(g, sph(0.12, 8, 6), M.glow, 0.1 + i * 0.35 - 0.11, 2.65, -1.0);
      }
      face = [0.25, 0.32, -0.2, 0.75];
      break;
    }
    default: {
      add(g, rbox(1.55, 0.9, 1.65, 0.2), M.primary, 0.25, 0.35, 0, 0, 0, -0.22);
      add(g, rbox(1.6, 0.16, 1.7, 0.06), M.secondary, 0.3, 0.02, 0, 0, 0, -0.22);
    }
  }
  if (withDecal && code) {
    const tex = decalTexture(code, '#ffffff');
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
    mat.userData.ownTexture = true;
    const holder = pivot(g, face[0], face[1], 0);
    holder.rotation.z = face[2];
    const d = add(holder, plane(1.2, 0.6), mat, face[3] + 0.015, 0, 0, 0, Math.PI / 2, 0);
    d.castShadow = false;
    d.receiveShadow = false;
  }
}

// ---------- ARMI / AVAMBRACCI ----------
function buildArm(weaponId, sh, M, refs, side) {
  add(sh, sph(0.58, 14, 10), M.frame, 0, 0, 0);
  add(sh, rbox(0.85, 1.7, 0.9, 0.12), M.secondary, 0, -0.95, 0);
  add(sh, rbox(1.0, 0.95, 1.05, 0.14), M.primary, 0, -0.7, 0);
  const elbow = pivot(sh, 0, -1.9, 0);
  add(elbow, cyl(0.42, 0.42, 0.95, 14), M.frame, 0, 0, 0, 0, 0, Math.PI / 2);
  const hand = pivot(elbow, 0, -2.0, 0);
  const thr = [];
  let muzzle = null;

  const forearm = (w = 1.05, d = 1.1) => {
    add(elbow, rbox(w, 1.85, d, 0.14), M.primary, 0, -1.0, 0);
    add(elbow, rbox(w + 0.12, 1.1, 0.42, 0.1), M.secondary, 0, -1.05, d / 2);
    add(elbow, rbox(w + 0.16, 0.18, d + 0.12, 0.05), M.dark, 0, -1.85, 0);
  };
  const fist = (s = 1) => {
    add(hand, rbox(0.95 * s, 0.9 * s, 1.0 * s, 0.14), M.frame, 0, -0.45 * s, 0);
    add(hand, rbox(1.02 * s, 0.32 * s, 1.06 * s, 0.1), M.primary, 0, -0.86 * s, 0);
    for (let i = 0; i < 4; i++) add(hand, rbox(0.2 * s, 0.14 * s, 1.02 * s, 0.04), M.dark, (-0.33 + i * 0.22) * s, -0.62 * s, 0);
    add(hand, rbox(0.3 * s, 0.55 * s, 0.35 * s, 0.08), M.secondary, -0.5 * s * side, -0.35 * s, 0.25 * s);
  };

  switch (weaponId) {
    case 'wp_rocket': {
      forearm(1.2, 1.2);
      fist(1.12);
      for (const s of [-1, 1]) {
        add(elbow, cyl(0.24, 0.3, 0.55, 12), M.dark, 0.32 * s, -0.25, -0.62);
        add(elbow, cyl(0.17, 0.17, 0.56, 12), M.glow, 0.32 * s, -0.24, -0.62);
        thr.push(flame(elbow, M.flame, 0.32 * s, 0.05, -0.62, 1.9, 0.26, 1));
      }
      break;
    }
    case 'wp_chainsword': {
      forearm(1.05, 1.1);
      add(hand, rbox(1.0, 0.9, 1.15, 0.12), M.secondary, 0, -0.3, 0);
      add(hand, rbox(0.34, 4.0, 0.95, 0.05), M.frame, 0, -2.7, 0);
      for (let i = 0; i < 7; i++) add(hand, rbox(0.42, 0.44, 1.08, 0.06), M.primary, 0, -1.0 - i * 0.52, 0.02);
      add(hand, rbox(0.12, 3.9, 0.1, 0.03), M.glow, 0, -2.75, 0.58);
      add(hand, rbox(0.12, 3.9, 0.1, 0.03), M.glow, 0, -2.75, -0.53);
      add(hand, cone(0.5, 0.9, 4), M.primary, 0, -5.05, 0, Math.PI, Math.PI / 4, 0).scale.set(0.5, 1, 1.2);
      refs.blade = hand;
      break;
    }
    case 'wp_hammer': {
      forearm(1.1, 1.15);
      add(hand, rbox(0.9, 0.7, 0.9, 0.12), M.frame, 0, -0.25, 0);
      add(hand, cyl(0.2, 0.2, 1.6, 10), M.dark, 0, -1.2, 0);
      const head = pivot(hand, 0, -2.25, 0);
      add(head, cyl(0.8, 0.8, 2.0, 18), M.primary, 0, 0, 0, Math.PI / 2, 0, 0);
      add(head, cyl(0.85, 0.85, 0.3, 18), M.secondary, 0, 0, 0.75, Math.PI / 2, 0, 0);
      add(head, cyl(0.85, 0.85, 0.3, 18), M.secondary, 0, 0, -0.75, Math.PI / 2, 0, 0);
      add(head, tor(0.82, 0.07, 6, 24), M.glow, 0, 0, 1.0);
      add(head, tor(0.82, 0.07, 6, 24), M.glow, 0, 0, -1.0);
      break;
    }
    case 'wp_plasma': {
      add(elbow, rbox(1.15, 1.2, 1.2, 0.14), M.primary, 0, -0.6, 0);
      add(elbow, cyl(0.5, 0.6, 2.8, 18), M.secondary, 0, -1.9, 0);
      for (let i = 0; i < 3; i++) add(elbow, tor(0.56, 0.07, 6, 20), M.glowDim, 0, -1.2 - i * 0.6, 0, Math.PI / 2, 0, 0);
      for (const s of [-1, 1]) add(elbow, rbox(0.3, 1.5, 0.6, 0.06), M.primary, 0.62 * s, -1.6, 0);
      add(elbow, cyl(0.36, 0.36, 0.1, 16), M.glow, 0, -3.32, 0);
      add(elbow, cyl(0.42, 0.42, 0.4, 16, true), M.dark, 0, -3.15, 0);
      muzzle = pivot(elbow, 0, -3.5, 0);
      break;
    }
    case 'wp_claws': {
      forearm(1.0, 1.05);
      add(hand, rbox(0.95, 0.7, 1.0, 0.12), M.frame, 0, -0.3, 0);
      for (let i = 0; i < 3; i++) {
        const x = -0.32 + i * 0.32;
        const b = pivot(hand, x, -0.55, 0.05);
        b.rotation.z = (i - 1) * -0.1;
        add(b, rbox(0.12, 2.3, 0.3, 0.03), M.secondary, 0, -1.15, 0);
        add(b, rbox(0.06, 2.1, 0.08, 0.02), M.glow, 0, -1.2, 0.17);
        add(b, cone(0.15, 0.5, 4), M.secondary, 0, -2.5, 0, Math.PI, Math.PI / 4, 0).scale.set(0.5, 1, 1);
      }
      break;
    }
    default: {
      forearm();
      fist();
    }
  }
  return { elbow, hand, thrusters: thr, muzzle: muzzle || pivot(hand, 0, -1.0, 0) };
}

// ---------- GAMBE ----------
function buildLeg(legId, hip, M, rest, refs) {
  const heavy = legId === 'lg_heavy';
  const digi = legId === 'lg_digi';
  const w = heavy ? 1.3 : digi ? 0.9 : 1.0;
  add(hip, sph(0.52, 12, 10), M.frame, 0, 0, 0);
  add(hip, rbox(w, rest.thigh * 0.95, w * 1.1, 0.12), M.secondary, 0, -rest.thigh / 2, 0);
  add(hip, rbox(w + 0.12, rest.thigh * 0.6, w * 1.1 + 0.12, 0.14), M.primary, 0, -rest.thigh * 0.38, 0.04);
  const knee = pivot(hip, 0, -rest.thigh, 0);
  add(knee, cyl(0.44, 0.44, w + 0.05, 14), M.frame, 0, 0, 0, 0, 0, Math.PI / 2);
  add(knee, rbox(w * 0.8, 0.8, 0.5, 0.12), M.primary, 0, 0.05, digi ? -0.55 : 0.55);
  add(knee, rbox(w + 0.05, rest.shin * 0.95, w * 1.15, 0.14), M.primary, 0, -rest.shin / 2, 0);
  add(knee, rbox(w * 0.85, rest.shin * 0.7, 0.4, 0.1), M.secondary, 0, -rest.shin * 0.45, digi ? -0.62 : 0.64);
  const ankle = pivot(knee, 0, -rest.shin, 0);
  add(ankle, sph(0.4, 12, 8), M.frame, 0, 0, 0);
  if (digi) {
    add(ankle, rbox(1.0, 0.38, 1.0, 0.1), M.secondary, 0, -0.22, 0.1);
    for (let i = 0; i < 3; i++) {
      const t = pivot(ankle, -0.32 + i * 0.32, -0.25, 0.5);
      t.rotation.y = (i - 1) * 0.25;
      add(t, rbox(0.26, 0.28, 1.1, 0.08), M.primary, 0, 0, 0.45);
    }
    add(ankle, rbox(0.3, 0.3, 0.8, 0.08), M.primary, 0, -0.25, -0.55);
  } else {
    const fw = heavy ? 1.45 : 1.2;
    add(ankle, rbox(fw, 0.45, 2.0, 0.12), M.secondary, 0, -0.18, 0.3);
    add(ankle, rbox(fw - 0.1, 0.3, 0.65, 0.1), M.primary, 0, -0.22, 1.28);
    add(ankle, rbox(fw - 0.2, 0.25, 0.5, 0.08), M.dark, 0, -0.25, -0.75);
  }
  if (legId === 'lg_thrust') {
    add(knee, rbox(0.8, 1.0, 0.5, 0.1), M.dark, 0, -0.9, -0.7);
    for (const s of [-1, 1]) {
      add(knee, cyl(0.18, 0.24, 0.35, 10), M.dark, 0.22 * s, -1.55, -0.72);
      add(knee, cyl(0.12, 0.12, 0.36, 10), M.glow, 0.22 * s, -1.55, -0.72);
      refs.legThrusters.push(flame(knee, M.flameAccent, 0.22 * s, -1.72, -0.72, 2.2, 0.22, -1));
    }
  }
  if (heavy) {
    add(hip, rbox(w + 0.3, 0.9, 0.5, 0.1), M.secondary, 0, -0.6, w * 0.65);
  }
  return { knee, ankle };
}

/**
 * Costruisce il modello 3D di un Titano a partire dalla sua configurazione.
 * Restituisce l'oggetto radice e i riferimenti ai giunti per le animazioni.
 */
export function buildRobot(cfg, { shadows = false } = {}) {
  const M = makeMaterials(cfg);
  const chassis = getPart(cfg.chassis) || PARTS.chassis[0];
  const rest = LEG_REST[cfg.legs] || LEG_REST.lg_std;
  const refs = { spinners: [], legThrusters: [], core: null, blade: null };

  const root = new THREE.Group();
  const body = pivot(root);
  body.scale.set(...chassis.scale);

  const hips = pivot(body, 0, HIP_Y, 0);
  add(hips, rbox(2.1, 0.95, 1.35, 0.15), M.secondary, 0, 0, 0);
  add(hips, rbox(1.0, 0.8, 0.5, 0.1), M.primary, 0, -0.15, 0.6);
  for (const s of [-1, 1]) add(hips, rbox(0.55, 1.0, 1.3, 0.1), M.primary, 1.15 * s, -0.25, 0, 0, 0, 0.15 * s);

  // Il robot guarda verso +Z: il suo lato sinistro e' +X, il destro -X.
  const hipL = pivot(hips, 0.95, -0.25, 0);
  const hipR = pivot(hips, -0.95, -0.25, 0);
  const legL = buildLeg(cfg.legs, hipL, M, rest, refs);
  const legR = buildLeg(cfg.legs, hipR, M, rest, refs);

  const spine = pivot(hips, 0, 0.55, 0);
  const chest = pivot(spine, 0, 0.8, 0);
  const neckY = buildTorso(cfg.torso, chest, M, refs);
  const neck = pivot(chest, 0, neckY, 0.05);
  const head = buildHead(cfg.head, neck, M);

  const shL = pivot(chest, 2.05, 1.85, 0);
  const shR = pivot(chest, -2.05, 1.85, 0);
  shL.rotation.order = 'YXZ';
  shR.rotation.order = 'YXZ';
  const armL = buildArm(cfg.armL, shL, M, refs, 1);
  const armR = buildArm(cfg.armR, shR, M, refs, -1);

  const padL = pivot(chest, 2.05, 1.85, 0);
  buildShoulder(cfg.shoulders, padL, M, cfg.code, true);
  const padR = pivot(chest, -2.05, 1.85, 0);
  padR.scale.x = -1;
  buildShoulder(cfg.shoulders, padR, M, cfg.code, false);
  if (padL.userData.spinner) refs.spinners.push(padL.userData.spinner);
  if (padR.userData.spinner) refs.spinners.push(padR.userData.spinner);

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = shadows && o.castShadow;
      o.receiveShadow = shadows;
    }
  });
  mergeStaticMeshes(root);

  const joints = {
    hips,
    spine,
    chest,
    neck,
    head,
    shL,
    elL: armL.elbow,
    handL: armL.hand,
    shR,
    elR: armR.elbow,
    handR: armR.hand,
    hipL,
    kneeL: legL.knee,
    ankleL: legL.ankle,
    hipR,
    kneeR: legR.knee,
    ankleR: legR.ankle,
  };

  const materials = Object.values(M);
  return {
    root,
    body,
    joints,
    rest,
    materials,
    bodyMaterials: [M.primary, M.secondary, M.frame, M.dark],
    glow: M.glow,
    visor: M.visor,
    core: refs.core,
    spinners: refs.spinners,
    muzzleL: armL.muzzle,
    muzzleR: armR.muzzle,
    thrustersL: armL.thrusters,
    thrustersR: armR.thrusters,
    legThrusters: refs.legThrusters,
    scale: chassis.scale[1],
    height: 9.4 * chassis.scale[1],
    dispose() {
      disposeMerged(root);
      root.traverse((o) => {
        if (o.isMesh && o.material?.userData?.ownTexture) o.material.map?.dispose();
      });
      materials.forEach((m) => m.dispose());
      root.traverse((o) => {
        if (o.isMesh && o.material?.userData?.ownTexture) o.material.dispose();
      });
    },
  };
}
