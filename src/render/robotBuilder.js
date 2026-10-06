// Modelli 3D dei Titani in stile robot degli anime (corazze a piastre su telaio interno,
// antenne a V, prese d'aria, gonne corazzate, zaini con propulsori e sciabole laser).
import * as THREE from 'three';
import { FINISHES, PARTS, getPart } from '../data/parts.js';
import { loft, cbox, plate, symPlate, cyl, sph, cone, torus, taperTube } from './geo.js';
import { toonMaterial, outlineMaterial, finalizeModel, disposeFinalized, addOutline } from './toon.js';
import { decalAtlas, decalGeo } from './decals.js';

export const HIP_Y = 4.8;

// Posa di riposo delle gambe (rotazioni x di anca, ginocchio, caviglia).
const LEG_REST = {
  lg_std: { hip: -0.12, knee: 0.24, ankle: -0.12, thigh: 2.2, shin: 2.2 },
  lg_heavy: { hip: -0.1, knee: 0.2, ankle: -0.1, thigh: 2.2, shin: 2.2 },
  lg_digi: { hip: -0.45, knee: 1.0, ankle: -0.55, thigh: 2.45, shin: 2.45 },
  lg_thrust: { hip: -0.12, knee: 0.24, ankle: -0.12, thigh: 2.2, shin: 2.2 },
};

const PI = Math.PI;
const FIXED = {
  T: '#efbd25', // giallo (antenne, prese d'aria)
  R: '#c8262f', // rosso (mento, dettagli)
  F: '#5f6673', // telaio interno
  D: '#2e323a', // grigio scuro
  K: '#14161b', // quasi nero (fessure)
  M: '#a3acb7', // metallo chiaro (pistoni)
  W: '#eef1f4', // bianco
};

// ------------------------------------------------------------------ utilita'
const DUMMY = new THREE.MeshBasicMaterial();
let SIDE = 0; // lato del pezzo in costruzione: +1 sinistra (x > 0), -1 destra
let MATS = null;

function A(parent, geo, paint, p = [0, 0, 0], r = [0, 0, 0], s = null) {
  const m = new THREE.Mesh(geo, DUMMY);
  m.position.set(p[0], p[1], p[2]);
  m.rotation.set(r[0], r[1], r[2]);
  if (s) m.scale.set(s[0], s[1], s[2]);
  m.userData.paint = paint;
  m.userData.side = SIDE;
  parent.add(m);
  return m;
}

function piv(parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

/** Gruppo decorativo: alla fine i suoi pezzi vengono "appiattiti" nel giunto padre. */
function grp(parent, p = [0, 0, 0], r = [0, 0, 0]) {
  const o = new THREE.Object3D();
  o.position.set(p[0], p[1], p[2]);
  o.rotation.set(r[0], r[1], r[2]);
  o.userData.flatten = true;
  parent.add(o);
  return o;
}

function flattenGroups(root) {
  const groups = [];
  root.traverse((o) => {
    if (o.userData.flatten) groups.push(o);
  });
  // dal piu' profondo al piu' esterno
  groups.reverse();
  for (const g of groups) {
    g.updateMatrix();
    const parent = g.parent;
    for (const c of [...g.children]) {
      c.applyMatrix4(g.matrix);
      parent.add(c);
    }
    parent.remove(g);
  }
}

const decal = (parent, region, w, h, p, r = [0, 0, 0]) => A(parent, decalGeo(region, w, h), 'decal', p, r);

/** Pezzo che si anima da solo (non viene unito): colori per vertice gia' applicati. */
function solo(parent, geo, paint, p = [0, 0, 0], r = [0, 0, 0], outline = true) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const col = new THREE.Color(MATS.paints[paint] || '#ffffff');
  const c = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < c.length; i += 3) {
    c[i] = col.r;
    c[i + 1] = col.g;
    c[i + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const m = new THREE.Mesh(g, MATS.armor);
  m.position.set(p[0], p[1], p[2]);
  m.rotation.set(r[0], r[1], r[2]);
  m.userData.keep = true;
  m.userData.ownGeo = true;
  parent.add(m);
  if (outline) addOutline(m, MATS.outline);
  return m;
}

function glowSolo(parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(p[0], p[1], p[2]);
  m.rotation.set(r[0], r[1], r[2]);
  m.userData.keep = true;
  parent.add(m);
  return m;
}

function flame(parent, mat, x, y, z, length = 1.6, radius = 0.28, dir = 1, tilt = 0) {
  const g = piv(parent, x, y, z);
  g.rotation.x = tilt;
  const m = new THREE.Mesh(cone(radius, length, 10), mat);
  m.position.y = (dir * length) / 2;
  m.rotation.x = dir > 0 ? PI : 0;
  const inner = new THREE.Mesh(cone(radius * 0.5, length * 0.6, 8), mat);
  inner.position.y = dir * length * 0.3;
  inner.rotation.x = dir > 0 ? PI : 0;
  for (const o of [m, inner]) {
    o.userData.keep = true;
    o.castShadow = false;
    g.add(o);
  }
  g.visible = false;
  return g;
}

/** Ugello di un propulsore con interno luminoso, rivolto verso -Y del gruppo. */
function nozzle(parent, p, r, rad = 0.26, len = 0.45, paint = 'F') {
  const g = grp(parent, p, r);
  A(g, cyl(rad * 0.75, rad, len, 14), paint, [0, -len / 2, 0]);
  A(g, torus(rad * 0.98, rad * 0.12, 5, 14), 'D', [0, -len, 0], [PI / 2, 0, 0]);
  A(g, cyl(rad * 0.82, rad * 0.82, 0.04, 14), 'glowDim', [0, -len + 0.03, 0]);
  return g;
}

/** Feritoie: telaio scuro con lamelle. */
function vents(parent, p, r, w, h, n, paint = 'T', back = 'K') {
  const g = grp(parent, p, r);
  A(g, cbox(w, h, 0.12, 0.03), back, [0, 0, 0]);
  const step = h / n;
  for (let i = 0; i < n; i++) A(g, cbox(w * 0.92, step * 0.45, 0.08, 0.015), paint, [0, -h / 2 + step * (i + 0.5), 0.05], [0.4, 0, 0]);
  return g;
}

const mir = (pts, s) => pts.map(([x, y]) => [x * s, y]);

// ------------------------------------------------------------------ TESTE
function headCommon(h) {
  // collo e attacco
  A(h, cyl(0.26, 0.32, 0.36, 12), 'F', [0, -0.05, 0]);
  for (const s of [-1, 1]) A(h, cyl(0.05, 0.05, 0.4, 6), 'M', [s * 0.18, 0, -0.12], [0.3, 0, 0]);
}

function headV(h, { crest = false } = {}) {
  // calotta
  A(h, loft([
    { y: 0.1, w: 0.78, d: 0.84, c: 0.16, z: -0.06 },
    { y: 0.5, w: 0.96, d: 0.98, c: 0.22, z: -0.04 },
    { y: 0.86, w: 0.9, d: 0.94, c: 0.26, z: -0.05 },
    { y: 1.04, w: 0.56, d: 0.7, c: 0.18, z: -0.1 },
  ]), 'P');
  A(h, cbox(0.13, 0.16, 0.86, 0.04), 'P', [0, 1.07, -0.08]);
  // fronte sporgente e sensore centrale
  A(h, cbox(0.98, 0.17, 0.32, 0.06, { cf: 0.12 }), 'P', [0, 0.83, 0.37], [0.16, 0, 0]);
  A(h, cbox(0.22, 0.2, 0.16, 0.04), 'R', [0, 0.88, 0.52]);
  A(h, cbox(0.12, 0.07, 0.04, 0.01), 'K', [0, 0.88, 0.6]);
  // antenna a V
  const blade = [[0.03, 0.0], [0.17, 0.02], [0.98, 0.64], [0.92, 0.72], [0.1, 0.18], [0.02, 0.13]];
  const k = crest ? 1.35 : 1;
  for (const s of [-1, 1]) {
    A(h, plate(mir(blade.map(([x, y]) => [x * k, y * k]), s), 0.05, 0.012), 'T', [0, 0.9, 0.57], [-0.42, 0, 0]);
  }
  A(h, cbox(0.18, 0.14, 0.1, 0.03), 'T', [0, 0.91, 0.6]);
  if (crest) {
    // cresta da samurai: lama centrale, mezzaluna e paraorecchie
    A(h, symPlate([[0.06, 0.95], [0.1, 0.1], [0.14, 0]], 0.05, 0.012), 'T', [0, 0.95, 0.56], [-0.25, 0, 0]);
    A(h, plate([[-0.42, 0.0], [-0.3, 0.16], [0, 0.22], [0.3, 0.16], [0.42, 0.0], [0.24, 0.1], [0, 0.13], [-0.24, 0.1]], 0.06, 0.015), 'T', [0, 0.98, 0.6], [-0.2, 0, 0]);
    for (const s of [-1, 1]) {
      SIDE = s;
      A(h, plate(mir([[0, 0.3], [0.42, 0.42], [0.55, 0.0], [0.3, -0.28], [0, -0.22]], s), 0.07, 0.02), 'S', [s * 0.52, 0.62, 0.08], [0, s * 0.55, s * 0.18]);
      A(h, plate(mir([[0, 0.12], [0.26, 0.17], [0.32, 0.0], [0, -0.06]], s), 0.04, 0.01), 'T', [s * 0.6, 0.66, 0.24], [0, s * 0.55, s * 0.18]);
    }
    SIDE = 0;
  }
  // volto: fascia scura degli occhi, occhi, guance, maschera e mento
  A(h, cbox(0.64, 0.2, 0.1, 0.03), 'K', [0, 0.62, 0.42]);
  const eye = [[0.05, 0.035], [0.27, 0.085], [0.29, 0.0], [0.08, -0.045]];
  for (const s of [-1, 1]) {
    A(h, plate(mir(eye, s), 0.04, 0.008), 'glow', [0, 0.62, 0.47]);
    SIDE = s;
    A(h, plate(mir([[0, 0.12], [0.15, 0.12], [0.2, -0.2], [0.03, -0.3]], s), 0.1, 0.025), 'P', [s * 0.27, 0.5, 0.43], [0, s * 0.42, 0]);
    // mitragliatrici sulla fronte
    A(h, cyl(0.075, 0.075, 0.14, 10), 'F', [s * 0.32, 0.81, 0.5], [PI / 2, 0, 0]);
    A(h, cyl(0.04, 0.04, 0.02, 8), 'K', [s * 0.32, 0.81, 0.575], [PI / 2, 0, 0]);
    // sensori laterali ("orecchie")
    A(h, cyl(0.2, 0.22, 0.14, 14), 'S', [s * 0.5, 0.5, -0.04], [0, 0, PI / 2]);
    A(h, cyl(0.1, 0.1, 0.04, 12), 'T', [s * 0.58, 0.5, -0.04], [0, 0, PI / 2]);
  }
  SIDE = 0;
  A(h, cbox(0.5, 0.3, 0.16, 0.05, { cf: 0.09 }), 'P', [0, 0.38, 0.45]);
  for (const s of [-1, 1]) A(h, cbox(0.03, 0.1, 0.03, 0.008), 'K', [s * 0.06, 0.36, 0.535]);
  A(h, symPlate([[0.14, 0.04], [0.1, -0.05], [0.0, -0.1]], 0.14, 0.03), 'R', [0, 0.215, 0.47]);
  // sensore posteriore
  A(h, cbox(0.32, 0.24, 0.22, 0.05), 'F', [0, 0.62, -0.52]);
  A(h, cbox(0.18, 0.08, 0.04, 0.01), 'glowDim', [0, 0.62, -0.64]);
}

function headMono(h, refs) {
  // testa a cupola con monocolo su binario
  A(h, sph(0.6, 20, 14), 'P', [0, 0.56, -0.02], [0, 0, 0], [1, 0.9, 1.08]);
  A(h, loft([
    { y: 0.05, w: 0.92, d: 1.0, c: 0.32 },
    { y: 0.3, w: 1.14, d: 1.22, c: 0.4 },
    { y: 0.42, w: 1.12, d: 1.2, c: 0.4 },
  ]), 'S');
  for (let i = -2; i <= 2; i++) {
    const a = i * 0.3;
    A(h, cbox(0.3, 0.16, 0.08, 0.02), 'K', [Math.sin(a) * 0.6, 0.6, Math.cos(a) * 0.6 - 0.02], [0, a, 0]);
  }
  const rail = piv(h, 0, 0.6, -0.02);
  refs.sweepers.push(rail);
  const eye = glowSolo(rail, sph(0.085, 12, 10), MATS.glow, [0, 0, 0.61]);
  eye.scale.set(1, 1, 0.6);
  // cresta da comandante e tubi della "bocca"
  A(h, plate([[0, 0], [0.75, 0.05], [0.9, 0.24], [0.15, 0.14]], 0.06, 0.015), 'S', [0, 1.04, 0.3], [0, PI / 2, 0]);
  A(h, cyl(0.17, 0.21, 0.22, 12), 'F', [0, 0.3, 0.52], [PI / 2, 0, 0]);
  A(h, cyl(0.12, 0.12, 0.04, 12), 'K', [0, 0.3, 0.64], [PI / 2, 0, 0]);
  for (const s of [-1, 1]) {
    A(h, taperTube([[s * 0.14, 0.28, 0.56], [s * 0.42, 0.18, 0.46], [s * 0.56, 0.2, 0.12], [s * 0.46, 0.3, -0.26]], [0.065, 0.07, 0.07, 0.065], 7), 'D');
    for (let k = 0; k < 4; k++) {
      const t = 0.15 + k * 0.22;
      A(h, torus(0.075, 0.025, 4, 10), 'F', [s * (0.2 + t * 0.4), 0.24 - t * 0.04, 0.52 - t * 0.5], [0, s * (0.6 + t), 0]);
    }
  }
  A(h, cbox(0.3, 0.2, 0.2, 0.04), 'F', [0, 0.7, -0.6]);
}

function headTri(h) {
  A(h, loft([
    { y: 0.08, w: 0.84, d: 0.86, c: 0.14, cf: 0.3, z: -0.04 },
    { y: 0.55, w: 1.02, d: 1.0, c: 0.18, cf: 0.36, z: -0.02 },
    { y: 0.9, w: 0.92, d: 0.94, c: 0.2, cf: 0.34, z: -0.04 },
    { y: 1.02, w: 0.6, d: 0.7, c: 0.16, z: -0.08 },
  ]), 'P');
  // visore scuro con tre ottiche
  A(h, cbox(0.76, 0.3, 0.12, 0.05, { cf: 0.08 }), 'K', [0, 0.6, 0.44]);
  for (const [x, y, r] of [[-0.18, 0.66, 0.08], [0.18, 0.66, 0.08], [0, 0.53, 0.065]]) {
    A(h, cyl(r, r, 0.04, 14), 'glow', [x, y, 0.5], [PI / 2, 0, 0]);
    A(h, torus(r + 0.015, 0.012, 4, 14), 'F', [x, y, 0.505]);
  }
  // cresta inclinata all'indietro
  A(h, plate([[0, 0], [0.18, 0.05], [1.0, 0.42], [0.95, 0.5], [0.1, 0.2]], 0.07, 0.02), 'S', [0, 0.98, 0.35], [0, -PI / 2, 0]);
  for (const s of [-1, 1]) {
    SIDE = s;
    A(h, plate(mir([[0, 0.26], [0.2, 0.3], [0.26, -0.1], [0, -0.2]], s), 0.12, 0.03), 'S', [s * 0.5, 0.52, 0.02], [0, s * 0.2, 0]);
    A(h, cbox(0.06, 0.4, 0.06, 0.015), 'M', [s * 0.5, 0.95, -0.25], [-0.45, 0, s * -0.2]);
  }
  SIDE = 0;
  A(h, cbox(0.4, 0.22, 0.16, 0.05), 'P', [0, 0.3, 0.42]);
  for (let i = 0; i < 3; i++) A(h, cbox(0.3, 0.025, 0.02, 0.005), 'K', [0, 0.26 + i * 0.05, 0.505]);
  A(h, symPlate([[0.14, 0.04], [0.1, -0.06], [0, -0.12]], 0.14, 0.03), 'R', [0, 0.18, 0.43]);
}

function headHorn(h) {
  A(h, loft([
    { y: 0.1, w: 0.76, d: 0.84, c: 0.14, z: -0.06 },
    { y: 0.52, w: 0.92, d: 0.98, c: 0.2, cf: 0.3, z: -0.04 },
    { y: 0.86, w: 0.86, d: 0.92, c: 0.24, cf: 0.3, z: -0.06 },
    { y: 1.0, w: 0.5, d: 0.66, c: 0.16, z: -0.12 },
  ]), 'P');
  // corno singolo
  A(h, symPlate([[0.02, 1.55], [0.07, 0.6], [0.13, 0.1], [0.16, 0]], 0.08, 0.02), 'T', [0, 0.84, 0.5], [-0.3, 0, 0]);
  A(h, cbox(0.24, 0.18, 0.18, 0.04), 'T', [0, 0.86, 0.52]);
  // visore a fascia
  A(h, cbox(0.8, 0.22, 0.1, 0.04), 'K', [0, 0.62, 0.42]);
  A(h, plate([[-0.34, 0.03], [0.34, 0.03], [0.3, -0.05], [-0.3, -0.05]], 0.04, 0.01), 'glow', [0, 0.63, 0.47]);
  // maschera con prese d'aria
  A(h, cbox(0.5, 0.3, 0.14, 0.05, { cf: 0.1 }), 'P', [0, 0.36, 0.44]);
  for (let i = 0; i < 4; i++) A(h, cbox(0.03, 0.16, 0.02, 0.006), 'K', [-0.09 + i * 0.06, 0.34, 0.515]);
  A(h, symPlate([[0.15, 0.05], [0.1, -0.08], [0, -0.15]], 0.14, 0.03), 'R', [0, 0.2, 0.44]);
  for (const s of [-1, 1]) {
    SIDE = s;
    A(h, plate(mir([[0, 0.2], [0.24, 0.32], [0.3, 0.0], [0.08, -0.22]], s), 0.1, 0.025), 'S', [s * 0.48, 0.55, 0.0], [0, s * 0.3, 0]);
    A(h, cyl(0.07, 0.07, 0.12, 10), 'F', [s * 0.3, 0.8, 0.48], [PI / 2, 0, 0]);
  }
  SIDE = 0;
  A(h, cbox(0.3, 0.2, 0.22, 0.05), 'F', [0, 0.62, -0.52]);
}

function buildHead(id, neck, refs) {
  const h = piv(neck, 0, 0.3, 0);
  h.scale.setScalar(1.18);
  headCommon(h);
  switch (id) {
    case 'hd_dome':
      headMono(h, refs);
      break;
    case 'hd_crest':
      headV(h, { crest: true });
      break;
    case 'hd_tri':
      headTri(h);
      break;
    case 'hd_hunter':
      headHorn(h);
      break;
    default:
      headV(h);
  }
  return h;
}

// ------------------------------------------------------------------ TORSO
function chestCommon(chest) {
  // attacchi delle spalle e colletto
  for (const s of [-1, 1]) {
    SIDE = s;
    A(chest, cyl(0.42, 0.42, 0.55, 14), 'F', [s * 1.6, 1.85, 0], [0, 0, PI / 2]);
    A(chest, cyl(0.3, 0.3, 0.62, 10), 'D', [s * 1.6, 1.85, 0], [0, 0, PI / 2]);
  }
  SIDE = 0;
  A(chest, loft([
    { y: 2.12, w: 1.6, d: 1.2, c: 0.3 },
    { y: 2.42, w: 1.42, d: 1.06, c: 0.26 },
    { y: 2.5, w: 1.1, d: 0.84, c: 0.2 },
  ]), 'P');
}

function backpack(chest, refs, { wide = 1, saber = true } = {}) {
  A(chest, cbox(1.75 * wide, 1.55, 0.72, 0.16), 'P', [0, 1.35, -1.2]);
  A(chest, cbox(1.4 * wide, 0.4, 0.5, 0.1), 'F', [0, 2.05, -1.25]);
  // piastre posteriori a V e prese d'aria laterali
  for (const s of [-1, 1]) {
    SIDE = s;
    A(chest, plate(mir([[0, 0.55], [0.72, 0.42], [0.66, -0.5], [0, -0.62]], s).map(([x, y]) => [x * wide, y]), 0.14, 0.04), 'S', [0, 1.4, -1.6]);
    vents(chest, [s * 0.98 * wide, 1.35, -1.22], [0, s * PI / 2, 0], 0.5, 0.6, 3, 'F');
  }
  SIDE = 0;
  A(chest, cbox(0.22, 1.1, 0.12, 0.04), 'T', [0, 1.4, -1.68]);
  decal(chest, 'emblem', 0.42, 0.42, [0.42 * wide, 1.62, -1.675], [0, PI, 0]);
  for (const s of [-1, 1]) {
    SIDE = s;
    nozzle(chest, [s * 0.45 * wide, 0.62, -1.28], [0, 0, 0], 0.3, 0.5);
    refs.boosters.push(flame(chest, MATS.flameAccent, s * 0.45 * wide, 0.1, -1.28, 2.4, 0.3, -1, -0.15));
    if (saber) {
      const g = grp(chest, [s * 0.58 * wide, 2.15, -1.42], [-0.42, 0, -s * 0.28]);
      A(g, cyl(0.1, 0.1, 0.8, 10), 'W', [0, 0.32, 0]);
      A(g, cyl(0.125, 0.125, 0.12, 10), 'F', [0, -0.02, 0]);
      A(g, cyl(0.125, 0.125, 0.1, 10), 'F', [0, 0.62, 0]);
      A(g, cyl(0.07, 0.09, 0.08, 10), 'D', [0, 0.76, 0]);
    }
  }
  SIDE = 0;
}

function torsoGundam(chest, refs) {
  A(chest, loft([
    { y: -0.15, w: 2.1, d: 1.5, c: 0.28 },
    { y: 0.6, w: 2.6, d: 1.75, c: 0.32 },
    { y: 1.55, w: 2.86, d: 1.95, c: 0.36, cf: 0.42 },
    { y: 2.15, w: 2.78, d: 1.85, c: 0.4 },
    { y: 2.36, w: 2.2, d: 1.45, c: 0.32 },
  ]), 'S');
  // prese d'aria gialle sul petto
  for (const s of [-1, 1]) {
    SIDE = s;
    vents(chest, [s * 0.68, 1.56, 0.93], [0, s * 0.12, 0], 0.8, 0.52, 4);
    A(chest, cbox(0.2, 1.05, 1.35, 0.06), 'P', [s * 1.39, 1.15, -0.05]);
    decal(chest, 'lines', 0.6, 0.07, [s * 0.68, 1.95, 0.955], [0, s * 0.12, 0]);
  }
  SIDE = 0;
  A(chest, symPlate([[0.15, 0.55], [0.22, 0.05], [0.1, -0.42]], 0.14, 0.03), 'P', [0, 1.25, 0.97]);
  A(chest, cbox(0.5, 0.12, 0.12, 0.03), 'T', [0, 1.88, 0.92]);
  // nucleo del reattore
  A(chest, torus(0.29, 0.06, 6, 20), 'F', [0, 0.62, 0.88]);
  refs.core = glowSolo(chest, cyl(0.25, 0.25, 0.1, 20), MATS.glow, [0, 0.62, 0.88], [PI / 2, 0, 0]);
  A(chest, cbox(2.2, 0.28, 1.5, 0.08), 'D', [0, -0.05, 0.02]);
  A(chest, symPlate([[0.3, 0.12], [0.24, -0.1], [0, -0.16]], 0.14, 0.03), 'R', [0, 0.05, 0.78]);
  decal(chest, 'label2', 0.8, 0.1, [0, 0.25, 0.86]);
  backpack(chest, refs);
  return 2.35;
}

function torsoMissile(chest, refs) {
  A(chest, loft([
    { y: -0.15, w: 2.4, d: 1.55, c: 0.22 },
    { y: 0.7, w: 3.0, d: 1.85, c: 0.26 },
    { y: 1.6, w: 3.25, d: 2.0, c: 0.3, cf: 0.4 },
    { y: 2.15, w: 3.1, d: 1.9, c: 0.32 },
    { y: 2.4, w: 2.35, d: 1.45, c: 0.28 },
  ]), 'S');
  for (const s of [-1, 1]) {
    SIDE = s;
    const g = grp(chest, [s * 0.74, 1.55, 0.98], [0, s * 0.1, 0]);
    A(g, cbox(0.92, 0.66, 0.14, 0.04), 'K', [0, 0, 0]);
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 3; c++) {
        A(g, cyl(0.085, 0.085, 0.1, 10), 'D', [(c - 1) * 0.27, -0.14 + r * 0.28, 0.05], [PI / 2, 0, 0]);
        A(g, cone(0.07, 0.16, 8), 'R', [(c - 1) * 0.27, -0.14 + r * 0.28, 0.14], [PI / 2, 0, 0]);
      }
    A(g, cbox(1.0, 0.1, 0.2, 0.03), 'P', [0, 0.38, 0.04]);
    A(g, cbox(1.0, 0.1, 0.2, 0.03), 'P', [0, -0.38, 0.04]);
    A(chest, cbox(0.22, 1.1, 1.4, 0.06), 'P', [s * 1.56, 1.15, -0.05]);
    decal(chest, 'caution', 0.5, 0.08, [s * 0.74, 2.02, 0.99], [0, s * 0.1, 0]);
  }
  SIDE = 0;
  refs.core = glowSolo(chest, cyl(0.22, 0.22, 0.1, 6), MATS.glow, [0, 0.65, 0.92], [PI / 2, 0, 0]);
  A(chest, cyl(0.29, 0.29, 0.08, 6), 'F', [0, 0.65, 0.88], [PI / 2, 0, 0]);
  A(chest, cbox(2.3, 0.28, 1.55, 0.08), 'D', [0, -0.05, 0.02]);
  backpack(chest, refs, { wide: 1.1, saber: false });
  // pod lanciamissili sullo zaino
  for (const s of [-1, 1]) {
    SIDE = s;
    A(chest, cbox(0.6, 1.3, 0.62, 0.08), 'S', [s * 0.7, 1.75, -1.62]);
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 2; c++) A(chest, cone(0.08, 0.2, 8), 'R', [s * 0.7 + (c - 0.5) * 0.24, 2.48, -1.62 + (r - 0.5) * 0.24]);
    decal(chest, 'hazard', 0.55, 0.1, [s * 0.7, 1.2, -1.935], [0, PI, 0]);
  }
  SIDE = 0;
  return 2.4;
}

function torsoTesla(chest, refs) {
  A(chest, loft([
    { y: -0.1, w: 2.2, d: 1.55, c: 0.5 },
    { y: 0.6, w: 2.9, d: 1.9, c: 0.72 },
    { y: 1.5, w: 3.1, d: 2.0, c: 0.78 },
    { y: 2.15, w: 2.8, d: 1.85, c: 0.7 },
    { y: 2.4, w: 2.0, d: 1.4, c: 0.5 },
  ]), 'S');
  // grandi piastre pettorali attorno al nucleo
  for (const s of [-1, 1]) {
    SIDE = s;
    A(chest, plate(mir([[0.22, 0.55], [0.95, 0.42], [1.1, -0.1], [0.75, -0.55], [0.3, -0.35]], s), 0.22, 0.05), 'P', [0, 1.45, 0.86], [0.1, 0, 0]);
    vents(chest, [s * 1.05, 0.55, 0.72], [0, s * 0.45, 0], 0.4, 0.4, 3, 'F');
  }
  SIDE = 0;
  A(chest, torus(0.48, 0.09, 8, 28), 'F', [0, 1.0, 0.95]);
  refs.core = glowSolo(chest, sph(0.36, 18, 14), MATS.glow, [0, 1.0, 0.95]);
  const r1 = solo(chest, torus(0.62, 0.06, 6, 28), 'T', [0, 1.0, 0.95]);
  r1.userData.axis = 'y';
  const r2 = glowSolo(chest, torus(0.62, 0.035, 6, 28), MATS.glowDim, [0, 1.0, 0.95], [0, PI / 2, 0]);
  r2.userData.axis = 'x';
  refs.spinners.push(r1, r2);
  A(chest, cbox(2.2, 0.28, 1.5, 0.1), 'D', [0, -0.03, 0.02]);
  backpack(chest, refs, { saber: false });
  // bobine Tesla
  for (const s of [-1, 1]) {
    SIDE = s;
    A(chest, cyl(0.2, 0.26, 1.9, 10), 'F', [s * 0.82, 2.1, -1.3]);
    for (let i = 0; i < 4; i++) A(chest, torus(0.3, 0.06, 6, 16), 'glowDim', [s * 0.82, 1.45 + i * 0.42, -1.3], [PI / 2, 0, 0]);
    A(chest, sph(0.17, 10, 8), 'glow', [s * 0.82, 3.1, -1.3]);
  }
  SIDE = 0;
  return 2.4;
}

function torsoWing(chest, refs) {
  A(chest, loft([
    { y: -0.15, w: 2.2, d: 1.5, c: 0.2 },
    { y: 0.7, w: 2.9, d: 1.8, c: 0.25 },
    { y: 1.6, w: 3.4, d: 2.05, c: 0.28, cf: 0.55 },
    { y: 2.2, w: 3.2, d: 1.9, c: 0.3 },
    { y: 2.45, w: 2.3, d: 1.4, c: 0.25 },
  ]), 'S');
  for (const s of [-1, 1]) {
    SIDE = s;
    // prese d'aria rosse incandescenti
    const g = grp(chest, [s * 0.72, 1.45, 1.0], [0, s * 0.16, s * 0.12]);
    A(g, cbox(0.86, 0.5, 0.14, 0.05), 'R', [0, 0, 0]);
    for (let i = 0; i < 3; i++) A(g, cbox(0.7, 0.05, 0.05, 0.01), 'glow', [0, -0.14 + i * 0.14, 0.07]);
    // corna sul colletto
    A(chest, cone(0.12, 0.7, 6), 'T', [s * 0.82, 2.45, 0.55], [0.35, 0, -s * 0.5]);
    A(chest, cbox(0.22, 1.05, 1.4, 0.06), 'P', [s * 1.6, 1.15, -0.05]);
  }
  SIDE = 0;
  A(chest, symPlate([[0.12, 0.6], [0.26, 0.0], [0.08, -0.5]], 0.16, 0.03), 'P', [0, 1.2, 1.0]);
  refs.core = glowSolo(chest, cbox(0.32, 0.18, 0.06, 0.02), MATS.glow, [0, 0.62, 0.92]);
  A(chest, cbox(0.5, 0.36, 0.1, 0.04), 'K', [0, 0.62, 0.86]);
  A(chest, cbox(2.2, 0.28, 1.5, 0.08), 'D', [0, -0.05, 0.02]);
  backpack(chest, refs, { saber: true });
  // ali meccaniche
  for (const s of [-1, 1]) {
    SIDE = s;
    const w = grp(chest, [s * 0.55, 1.9, -1.45], [0.35, s * 0.25, -s * 0.55]);
    A(w, cbox(0.3, 0.3, 0.3, 0.06), 'F', [0, 0, 0]);
    for (let i = 0; i < 4; i++) {
      const len = 2.6 - i * 0.35;
      const f = grp(w, [s * 0.1, 0.1, -i * 0.1], [0, 0, -s * (0.25 + i * 0.32)]);
      A(f, plate(mir([[0, 0.12], [len * 0.85, 0.16], [len, 0.0], [len * 0.82, -0.14], [0, -0.12]], s), 0.08, 0.02), i % 2 ? 'S' : 'P', [s * 0.12, 0, 0]);
      A(f, cbox(len * 0.6, 0.04, 0.1, 0.01), 'T', [s * (0.2 + len * 0.3), -0.06, 0.03]);
    }
  }
  SIDE = 0;
  return 2.45;
}

function buildTorso(id, chest, refs) {
  chestCommon(chest);
  switch (id) {
    case 'tr_plasma':
      return torsoMissile(chest, refs);
    case 'tr_tesla':
      return torsoTesla(chest, refs);
    case 'tr_berserk':
      return torsoWing(chest, refs);
    default:
      return torsoGundam(chest, refs);
  }
}

// ------------------------------------------------------------------ ADDOME E BACINO
function buildAbdomen(spine) {
  A(spine, loft([
    { y: -0.3, w: 1.35, d: 1.05, c: 0.2 },
    { y: 0.75, w: 1.6, d: 1.2, c: 0.24 },
  ]), 'F');
  for (let i = 0; i < 3; i++) A(spine, cbox(1.15 - i * 0.04, 0.26, 0.32, 0.06, { cf: 0.1 }), 'P', [0, 0.02 + i * 0.25, 0.48 - i * 0.02], [-0.08, 0, 0]);
  for (const s of [-1, 1]) A(spine, cbox(0.24, 0.7, 0.9, 0.05), 'D', [s * 0.75, 0.25, -0.05]);
}

function buildPelvis(hips, joints) {
  A(hips, loft([
    { y: -0.5, w: 1.3, d: 1.0, c: 0.2 },
    { y: 0.05, w: 1.7, d: 1.2, c: 0.24 },
    { y: 0.42, w: 2.05, d: 1.38, c: 0.26 },
  ]), 'F');
  A(hips, cbox(2.15, 0.36, 1.46, 0.12), 'P', [0, 0.28, 0]);
  // conchiglia frontale a V con dettaglio giallo
  A(hips, symPlate([[0.34, 0.24], [0.38, -0.08], [0.14, -0.55], [0, -0.62]], 0.26, 0.05), 'R', [0, -0.08, 0.6], [-0.08, 0, 0]);
  A(hips, cbox(0.22, 0.14, 0.1, 0.03), 'T', [0, 0.04, 0.75]);
  for (const s of [-1, 1]) {
    SIDE = s;
    // gonne frontali (seguono le cosce)
    const sk = piv(hips, s * 0.6, 0.2, 0.7);
    sk.rotation.set(-0.16, 0, s * 0.06);
    A(sk, plate(mir([[-0.4, 0.0], [0.42, 0.0], [0.48, -0.95], [0.3, -1.18], [-0.38, -1.05]], s), 0.17, 0.04), 'P', [0, 0, 0.06]);
    A(sk, cbox(0.7, 0.14, 0.12, 0.03), 'S', [s * 0.03, -0.18, 0.15]);
    A(sk, cyl(0.1, 0.1, 0.5, 8), 'F', [0, 0, -0.02], [0, 0, PI / 2]);
    decal(sk, 'lines', 0.5, 0.06, [s * 0.04, -0.75, 0.15]);
    joints[s > 0 ? 'skirtL' : 'skirtR'] = sk;
    // gonne laterali
    const side = grp(hips, [s * 1.18, 0.18, 0.02], [0, 0, s * 0.18]);
    A(side, plate([[-0.42, 0.0], [0.42, 0.0], [0.36, -0.9], [-0.36, -0.9]], 0.15, 0.04), 'P', [0, 0, 0], [0, PI / 2, 0]);
    A(side, cbox(0.1, 0.5, 0.4, 0.03), 'S', [s * 0.09, -0.4, 0]);
  }
  SIDE = 0;
  // gonna posteriore
  const back = grp(hips, [0, 0.18, -0.72], [0.22, 0, 0]);
  A(back, plate([[-0.62, 0.0], [0.62, 0.0], [0.52, -0.95], [-0.52, -0.95]], 0.16, 0.04), 'P', [0, 0, 0]);
  A(back, cbox(0.9, 0.16, 0.1, 0.03), 'S', [0, -0.3, -0.1]);
}

// ------------------------------------------------------------------ SPALLE
function buildShoulder(id, g, s, code) {
  SIDE = s;
  const X = (x) => x * s;
  switch (id) {
    case 'sh_plate': {
      // spallacci a lamelle sovrapposte
      A(g, cbox(1.3, 1.0, 1.6, 0.18), 'P', [X(0.3), 0.32, 0], [0, 0, -s * 0.16]);
      for (let i = 0; i < 3; i++) {
        A(g, cbox(1.45 - i * 0.06, 0.34, 1.72 - i * 0.05, 0.08), i % 2 ? 'S' : 'P', [X(0.45 + i * 0.06), -0.18 - i * 0.26, 0], [0, 0, -s * (0.32 + i * 0.1)]);
      }
      A(g, cone(0.14, 0.5, 6), 'T', [X(0.42), 0.95, 0.35], [-0.3, 0, 0]);
      if (code) decal(g, 'code', 0.95, 0.24, [X(1.0), 0.28, 0], [0, s * PI / 2, -s * 0.16]);
      else decal(g, 'emblem', 0.5, 0.5, [X(1.0), 0.28, 0], [0, s * PI / 2, -s * 0.16]);
      break;
    }
    case 'sh_vents': {
      A(g, cbox(1.2, 1.05, 1.5, 0.2), 'P', [X(0.28), 0.22, 0], [0, 0, -s * 0.1]);
      A(g, cbox(1.24, 0.16, 1.54, 0.05), 'S', [X(0.3), -0.36, 0], [0, 0, -s * 0.1]);
      // propulsori sulle spalle
      nozzle(g, [X(0.3), 0.6, -0.55], [-PI / 2 - 0.5, 0, 0], 0.24, 0.5);
      vents(g, [X(0.3), 0.5, 0.72], [0, 0, 0], 0.7, 0.4, 3, 'T');
      if (code) decal(g, 'code', 0.95, 0.24, [X(0.88), 0.22, 0], [0, s * PI / 2, -s * 0.1]);
      else decal(g, 'emblem', 0.5, 0.5, [X(0.88), 0.22, 0], [0, s * PI / 2, -s * 0.1]);
      break;
    }
    case 'sh_missile': {
      A(g, cbox(1.15, 0.85, 1.45, 0.16), 'P', [X(0.26), 0.12, 0], [0, 0, -s * 0.1]);
      const pod = grp(g, [X(0.22), 0.86, -0.05], [0, 0, 0]);
      A(pod, cbox(1.15, 0.72, 1.36, 0.1), 'S', [0, 0, 0]);
      A(pod, cbox(1.0, 0.56, 0.08, 0.03), 'K', [0, 0, 0.66]);
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < 3; c++) A(pod, cone(0.09, 0.2, 8), 'R', [(c - 1) * 0.3, -0.13 + r * 0.26, 0.72], [PI / 2, 0, 0]);
      decal(pod, 'hazard', 0.9, 0.12, [0, 0.29, 0.685]);
      if (code) decal(g, 'code', 0.9, 0.22, [X(0.86), 0.1, 0], [0, s * PI / 2, -s * 0.1]);
      break;
    }
    case 'sh_antenna': {
      // spallaccio arrotondato con chiodi
      A(g, sph(0.82, 16, 12), 'P', [X(0.3), 0.2, 0], [0, 0, -s * 0.25], [1, 0.8, 1.05]);
      A(g, cbox(1.5, 0.18, 1.6, 0.06), 'S', [X(0.32), -0.35, 0], [0, 0, -s * 0.2]);
      for (const [y, z, a] of [[0.85, 0, 0], [0.6, 0.55, 0.6], [0.6, -0.55, -0.6], [0.35, 0.7, 1.0], [0.35, -0.7, -1.0]]) {
        A(g, cone(0.12, 0.62, 8), 'M', [X(0.45), y, z], [a * 0.9, 0, -s * 0.35]);
        A(g, cyl(0.14, 0.14, 0.08, 8), 'F', [X(0.42), y - 0.22, z * 0.9], [a * 0.9, 0, -s * 0.35]);
      }
      if (code) decal(g, 'number', 0.45, 0.45, [X(1.02), 0.15, 0], [0, s * PI / 2, -s * 0.25]);
      break;
    }
    default: {
      // spallaccio classico
      A(g, cbox(1.2, 1.12, 1.52, 0.2), 'P', [X(0.28), 0.18, 0], [0, 0, -s * 0.1]);
      A(g, cbox(0.14, 0.78, 1.18, 0.05), 'P', [X(0.9), 0.14, 0], [0, 0, -s * 0.1]);
      A(g, cbox(1.25, 0.16, 1.56, 0.05), 'S', [X(0.3), -0.38, 0], [0, 0, -s * 0.1]);
      A(g, cbox(0.26, 0.08, 0.05, 0.02), 'T', [X(0.3), 0.45, 0.77]);
      decal(g, 'line', 0.9, 0.05, [X(0.34), 0.0, 0.775]);
      if (code) decal(g, 'code', 0.95, 0.24, [X(0.985), 0.2, 0], [0, s * PI / 2, -s * 0.1]);
      else decal(g, 'emblem', 0.55, 0.55, [X(0.985), 0.2, 0], [0, s * PI / 2, -s * 0.1]);
    }
  }
  SIDE = 0;
}

// ------------------------------------------------------------------ BRACCIA
function upperArm(sh, s) {
  A(sh, sph(0.46, 14, 10), 'F', [0, 0, 0]);
  A(sh, cbox(0.72, 0.5, 0.82, 0.1), 'D', [0, -0.25, 0]);
  A(sh, cyl(0.3, 0.3, 1.6, 10), 'F', [0, -1.05, 0]);
  A(sh, loft([
    { y: -1.62, w: 0.74, d: 0.78, c: 0.16 },
    { y: -1.12, w: 0.84, d: 0.88, c: 0.18 },
    { y: -0.48, w: 0.78, d: 0.82, c: 0.16 },
  ]), 'P');
  A(sh, cbox(0.1, 0.7, 0.5, 0.03), 'S', [s * 0.43, -1.05, 0]);
}

function forearm(elbow, s, { w = 1, d = 1 } = {}) {
  A(elbow, cyl(0.34, 0.34, 0.8, 12), 'F', [0, 0, 0], [0, 0, PI / 2]);
  A(elbow, cbox(0.5, 0.36, 0.42, 0.08, { cb: 0.18 }), 'P', [0, 0.02, -0.36]);
  A(elbow, loft([
    { y: -1.84, w: 0.88 * w, d: 0.92 * d, c: 0.18 },
    { y: -1.6, w: 1.0 * w, d: 1.04 * d, c: 0.22 },
    { y: -0.78, w: 1.08 * w, d: 1.12 * d, c: 0.24 },
    { y: -0.18, w: 0.9 * w, d: 0.95 * d, c: 0.2 },
  ]), 'P');
  A(elbow, cbox(0.1, 1.05, 0.72 * d, 0.03), 'S', [s * 0.56 * w, -0.9, 0]);
  A(elbow, cbox(0.32, 0.5, 0.08, 0.02), 'S', [0, -0.95, 0.58 * d]);
  decal(elbow, 'lines', 0.5, 0.07, [0, -1.35, 0.585 * d]);
  A(elbow, cyl(0.42 * w, 0.42 * w, 0.14, 12), 'D', [0, -1.9, 0]);
}

function fist(hand, s, k = 1) {
  A(hand, cbox(0.66 * k, 0.5 * k, 0.56 * k, 0.06), 'F', [0, -0.3 * k, -0.02 * k]);
  A(hand, cbox(0.7 * k, 0.44 * k, 0.18 * k, 0.06, { cf: 0.08 }), 'P', [0, -0.28 * k, 0.28 * k]);
  for (let i = 0; i < 4; i++) {
    const x = (-0.24 + i * 0.16) * k;
    A(hand, cbox(0.14 * k, 0.24 * k, 0.32 * k, 0.03), 'F', [x, -0.62 * k, 0.1 * k]);
    A(hand, cbox(0.14 * k, 0.2 * k, 0.24 * k, 0.03), 'F', [x, -0.66 * k, -0.18 * k], [0.3, 0, 0]);
    A(hand, cbox(0.15 * k, 0.1 * k, 0.12 * k, 0.02), 'P', [x, -0.54 * k, 0.3 * k]);
  }
  A(hand, cbox(0.16 * k, 0.36 * k, 0.2 * k, 0.04), 'F', [-s * 0.38 * k, -0.42 * k, -0.08 * k], [0, 0, s * 0.4]);
}

function buildArm(weaponId, sh, s, refs) {
  SIDE = s;
  upperArm(sh, s);
  const elbow = piv(sh, 0, -1.9, 0);
  const hand = piv(elbow, 0, -2.0, 0);
  const thr = [];
  let muzzle = null;
  switch (weaponId) {
    case 'wp_rocket': {
      // pugno a razzo: avambraccio massiccio con ugelli
      forearm(elbow, s, { w: 1.12, d: 1.1 });
      for (let i = 0; i < 3; i++) A(elbow, cbox(1.24, 0.08, 1.26, 0.03), i === 1 ? 'T' : 'R', [0, -1.5 + i * 0.12, 0]);
      A(elbow, plate(mir([[0, 0.3], [0.5, 0.0], [0.42, -0.6], [0, -0.4]], s), 0.08, 0.02), 'R', [s * 0.62, -0.7, 0], [0, s * PI / 2, 0]);
      for (const k of [-1, 1]) {
        nozzle(elbow, [k * 0.3, -0.18, -0.64], [PI, 0, 0], 0.2, 0.42);
        thr.push(flame(elbow, MATS.flame, k * 0.3, 0.2, -0.64, 1.9, 0.26, 1));
      }
      fist(hand, s, 1.14);
      break;
    }
    case 'wp_chainsword': {
      // sciabola laser
      forearm(elbow, s);
      fist(hand, s);
      A(hand, cyl(0.12, 0.12, 1.0, 10), 'W', [0, -0.75, 0.02]);
      A(hand, cyl(0.15, 0.15, 0.14, 10), 'F', [0, -0.28, 0.02]);
      A(hand, cyl(0.16, 0.13, 0.18, 10), 'D', [0, -1.28, 0.02]);
      const blade = glowSolo(hand, cyl(0.2, 0.08, 3.9, 10, false), MATS.beam, [0, -3.3, 0.02]);
      glowSolo(hand, cyl(0.075, 0.04, 3.85, 8, false), MATS.beamCore, [0, -3.28, 0.02]);
      blade.renderOrder = 2;
      refs.blade = hand;
      break;
    }
    case 'wp_hammer': {
      forearm(elbow, s, { w: 1.05, d: 1.05 });
      fist(hand, s);
      A(hand, cyl(0.13, 0.13, 1.7, 10), 'M', [0, -1.1, 0.02]);
      for (let i = 0; i < 3; i++) A(hand, cyl(0.16, 0.16, 0.08, 10), 'D', [0, -0.75 - i * 0.35, 0.02]);
      const head = grp(hand, [0, -2.25, 0.02], [0, 0, 0]);
      A(head, cyl(0.75, 0.75, 1.9, 8), 'S', [0, 0, 0], [PI / 2, PI / 8, 0]);
      for (const z of [-0.8, 0.8]) A(head, cyl(0.82, 0.82, 0.28, 8), 'P', [0, 0, z], [PI / 2, PI / 8, 0]);
      for (const z of [-1.0, 1.0]) A(head, cyl(0.55, 0.65, 0.16, 8), 'D', [0, 0, z], [PI / 2, PI / 8, 0]);
      A(head, torus(0.8, 0.06, 6, 24), 'glow', [0, 0, 0.98]);
      A(head, torus(0.8, 0.06, 6, 24), 'glow', [0, 0, -0.98]);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * PI * 2 + PI / 4;
        A(head, cone(0.16, 0.45, 6), 'T', [Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0], [0, 0, a - PI / 2]);
      }
      break;
    }
    case 'wp_plasma': {
      // fucile a raggi tenuto in mano
      forearm(elbow, s);
      fist(hand, s);
      const gun = grp(hand, [0, 0, -0.42], [0, 0, 0]);
      A(gun, cbox(0.34, 1.8, 0.5, 0.06), 'D', [0, -0.75, 0]);
      A(gun, cbox(0.36, 0.9, 0.36, 0.06), 'F', [0, 0.35, -0.04]);
      A(gun, cbox(0.3, 0.55, 0.22, 0.05), 'D', [0, 0.95, -0.06]);
      A(gun, cyl(0.12, 0.12, 1.1, 10), 'F', [0, -2.15, 0.06]);
      A(gun, cyl(0.17, 0.17, 0.3, 10), 'D', [0, -2.62, 0.06]);
      A(gun, cbox(0.18, 0.5, 0.24, 0.04), 'T', [0, -0.95, -0.36]);
      A(gun, cyl(0.1, 0.1, 0.6, 10), 'D', [s * 0.24, -0.5, 0.06]);
      A(gun, cyl(0.07, 0.07, 0.02, 10), 'glow', [s * 0.24, -0.81, 0.06]);
      A(gun, cbox(0.04, 1.2, 0.04, 0.01), 'glowDim', [0, -0.8, 0.26]);
      decal(gun, 'caution', 0.32, 0.07, [s * 0.175, -0.4, 0], [0, s * PI / 2, PI / 2]);
      muzzle = piv(hand, 0, -2.85, -0.36);
      break;
    }
    case 'wp_claws': {
      forearm(elbow, s);
      fist(hand, s);
      for (let i = 0; i < 3; i++) {
        const x = -0.24 + i * 0.24;
        const b = grp(hand, [x, -0.62, 0.22], [0, 0, (i - 1) * -0.08]);
        A(b, plate([[-0.08, 0], [0.08, 0], [0.06, -1.9], [0, -2.35], [-0.06, -1.9]], 0.1, 0.02), 'M', [0, 0, 0]);
        A(b, cbox(0.03, 1.7, 0.03, 0.005), 'glow', [0, -1.05, 0.06]);
        A(b, cbox(0.2, 0.2, 0.2, 0.04), 'D', [0, 0, 0]);
      }
      A(elbow, cbox(0.5, 0.18, 0.3, 0.04), 'T', [0, -1.72, 0.5]);
      break;
    }
    default: {
      forearm(elbow, s);
      fist(hand, s);
    }
  }
  SIDE = 0;
  return { elbow, hand, thrusters: thr, muzzle: muzzle || piv(hand, 0, -1.0, 0) };
}

// ------------------------------------------------------------------ GAMBE
function footStd(ankle, k = 1) {
  A(ankle, sph(0.3, 12, 8), 'F', [0, 0, 0]);
  A(ankle, plate([[-0.42, 0.25], [0.42, 0.25], [0.36, -0.12], [-0.36, -0.12]], 0.14, 0.04), 'P', [0, -0.02, 0.48], [0.45, 0, 0]);
  A(ankle, loft([
    { y: -0.44, w: 1.08 * k, d: 2.1, c: 0.12, z: 0.3 },
    { y: -0.14, w: 1.02 * k, d: 1.98, c: 0.2, cf: 0.36, z: 0.28 },
    { y: 0.06, w: 0.84 * k, d: 1.2, c: 0.22, z: 0.06 },
  ]), 'S');
  A(ankle, cbox(0.9 * k, 0.3, 0.55, 0.1, { cf: 0.2 }), 'S', [0, -0.26, 1.18]);
  A(ankle, cbox(1.12 * k, 0.12, 2.16, 0.04), 'R', [0, -0.46, 0.3]);
  A(ankle, cbox(0.8 * k, 0.32, 0.42, 0.08), 'F', [0, -0.26, -0.72]);
  for (const s of [-1, 1]) A(ankle, cbox(0.06, 0.24, 0.6, 0.02), 'D', [s * 0.5 * k, -0.22, 0.75]);
}

function legStd(hip, s, rest, refs, { heavy = false, thrust = false } = {}) {
  const k = heavy ? 1.28 : 1;
  const T = rest.thigh / 2;
  const G = rest.shin / 2;
  A(hip, sph(0.42, 12, 10), 'F', [0, 0, 0]);
  A(hip, cyl(0.36, 0.32, 1.9 * T, 10), 'F', [0, -0.95 * T, 0]);
  A(hip, loft([
    { y: -1.76 * T, w: 0.98 * k, d: 1.0 * k, c: 0.2 },
    { y: -1.0 * T, w: 1.08 * k, d: 1.14 * k, c: 0.24 },
    { y: -0.28 * T, w: 0.96 * k, d: 1.02 * k, c: 0.2 },
  ]), 'P');
  A(hip, cbox(0.1, 0.9 * T, 0.6, 0.03), 'D', [-s * 0.53 * k, -1.0 * T, 0]);
  decal(hip, 'line', 0.05, 0.9 * T, [s * 0.18, -1.0 * T, 0.575 * k]);
  if (heavy) {
    A(hip, cbox(1.2 * k, 0.5, 1.25 * k, 0.12), 'S', [0, -0.55 * T, 0]);
    decal(hip, 'number', 0.5, 0.5, [s * 0.66 * k + s * 0.02, -1.15 * T, 0], [0, s * PI / 2, 0]);
  }
  const knee = piv(hip, 0, -rest.thigh, 0);
  A(knee, cyl(0.36, 0.36, 0.9 * k, 12), 'F', [0, 0, 0], [0, 0, PI / 2]);
  A(knee, symPlate([[0.42, 0.36], [0.44, -0.12], [0.2, -0.52], [0, -0.6]], 0.3, 0.06), 'S', [0, 0.02, 0.56 * k], [-0.12, 0, 0]);
  A(knee, cbox(0.2, 0.12, 0.08, 0.02), 'T', [0, 0.12, 0.74 * k]);
  // stinco
  A(knee, loft([
    { y: -1.9 * G, w: 1.0 * k, d: 1.04 * k, c: 0.2 },
    { y: -1.6 * G, w: 1.12 * k, d: 1.18 * k, c: 0.24 },
    { y: -0.82 * G, w: 1.16 * k, d: 1.28 * k, c: 0.26, z: -0.06 },
    { y: -0.2 * G, w: 1.0 * k, d: 1.06 * k, c: 0.2, z: -0.02 },
  ]), 'P');
  A(knee, symPlate([[0.42, 0.0], [0.46, -0.85 * G], [0.3, -1.22 * G], [0, -1.3 * G]], 0.18, 0.04), 'P', [0, -0.42 * G, 0.62 * k], [-0.03, 0, 0]);
  decal(knee, 'chevron', 0.4, 0.2, [0, -0.62 * G, 0.715 * k]);
  // prese d'aria sul polpaccio
  vents(knee, [0, -1.0 * G, -0.62 * k], [0, PI, 0], 0.6 * k, 0.62, 3, 'F');
  if (thrust) {
    // razzi nei polpacci
    A(knee, cbox(0.95 * k, 1.1 * G, 0.5, 0.1), 'S', [0, -1.05 * G, -0.78 * k]);
    for (const x of [-0.24, 0.24]) {
      nozzle(knee, [x, -1.65 * G, -0.8 * k], [0, 0, 0], 0.2, 0.35);
      refs.legThrusters.push(flame(knee, MATS.flameAccent, x, -2.0 * G, -0.8 * k, 2.2, 0.22, -1));
    }
  }
  if (heavy) {
    for (const x of [-0.3, 0.3]) nozzle(knee, [x * k, -1.85 * G, -0.5 * k], [0.3, 0, 0], 0.18, 0.3);
    A(knee, cbox(1.3 * k, 0.4, 1.4 * k, 0.12), 'S', [0, -1.7 * G, 0]);
  }
  const ankle = piv(knee, 0, -rest.shin, 0);
  footStd(ankle, heavy ? 1.18 : 1);
  return { knee, ankle };
}

function legDigi(hip, s, rest) {
  const T = rest.thigh / 2.25;
  const G = rest.shin / 2.25;
  A(hip, sph(0.42, 12, 10), 'F', [0, 0, 0]);
  A(hip, cyl(0.32, 0.3, 2.1 * T, 10), 'F', [0, -1.05 * T, 0]);
  A(hip, loft([
    { y: -1.95 * T, w: 0.86, d: 0.9, c: 0.18 },
    { y: -1.1 * T, w: 0.98, d: 1.12, c: 0.24, z: 0.08 },
    { y: -0.3 * T, w: 0.9, d: 0.98, c: 0.2 },
  ]), 'P');
  A(hip, symPlate([[0.36, 0.2], [0.4, -0.6], [0, -0.9]], 0.16, 0.04), 'S', [0, -0.9 * T, 0.6], [0.08, 0, 0]);
  const knee = piv(hip, 0, -rest.thigh, 0);
  A(knee, cyl(0.34, 0.34, 0.82, 12), 'F', [0, 0, 0], [0, 0, PI / 2]);
  A(knee, cbox(0.6, 0.6, 0.5, 0.1, { cb: 0.24 }), 'S', [0, -0.05, -0.45]);
  A(knee, cone(0.14, 0.6, 6), 'T', [0, 0.05, -0.85], [-PI / 2 - 0.3, 0, 0]);
  A(knee, loft([
    { y: -2.15 * G, w: 0.78, d: 0.82, c: 0.16 },
    { y: -1.2 * G, w: 0.98, d: 1.1, c: 0.24, z: -0.06 },
    { y: -0.25 * G, w: 0.88, d: 0.92, c: 0.18 },
  ]), 'P');
  A(knee, cyl(0.07, 0.07, 1.6 * G, 6), 'M', [s * 0.3, -1.1 * G, 0.45], [0.05, 0, 0]);
  A(knee, cyl(0.1, 0.1, 0.9 * G, 6), 'F', [s * 0.3, -0.5 * G, 0.42], [0.05, 0, 0]);
  vents(knee, [0, -1.15 * G, 0.55], [0, 0, 0], 0.5, 0.6, 3, 'F');
  const ankle = piv(knee, 0, -rest.shin, 0);
  A(ankle, sph(0.3, 12, 8), 'F', [0, 0, 0]);
  A(ankle, cbox(0.95, 0.4, 0.95, 0.12), 'S', [0, -0.22, 0.12]);
  for (let i = 0; i < 3; i++) {
    const t = grp(ankle, [-0.32 + i * 0.32, -0.26, 0.5], [0, (i - 1) * 0.28, 0]);
    A(t, cbox(0.26, 0.28, 1.0, 0.08, { cf: 0.14 }), 'P', [0, 0, 0.42]);
    A(t, cone(0.1, 0.32, 6), 'D', [0, -0.05, 1.0], [PI / 2, 0, 0]);
  }
  A(ankle, cbox(0.3, 0.3, 0.7, 0.08), 'P', [0, -0.25, -0.5]);
  A(ankle, cbox(1.0, 0.1, 0.9, 0.03), 'R', [0, -0.42, 0.1]);
  return { knee, ankle };
}

function buildLeg(legId, hip, s, rest, refs) {
  SIDE = s;
  let r;
  if (legId === 'lg_digi') r = legDigi(hip, s, rest);
  else r = legStd(hip, s, rest, refs, { heavy: legId === 'lg_heavy', thrust: legId === 'lg_thrust' });
  SIDE = 0;
  return r;
}

// ------------------------------------------------------------------ MATERIALI
const FINISH_TOON = {
  metal: { spec: 0.95, rim: 0.34 },
  satin: { spec: 0.55, rim: 0.26 },
  matte: { spec: 0.12, rim: 0.18 },
};

function shadeHex(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}

function makeMaterials(cfg) {
  const fin = FINISH_TOON[cfg.finish] || FINISH_TOON.metal;
  const { primary, secondary, accent } = cfg.colors;
  const accentColor = new THREE.Color(accent);
  const atlas = decalAtlas(cfg.code, accent);
  const paints = { P: primary, S: secondary, ...FIXED };
  const decalMat = toonMaterial({ map: atlas, transparent: true, spec: 0, rim: 0 });
  decalMat.alphaTest = 0.35;
  decalMat.depthWrite = false;
  decalMat.polygonOffset = true;
  decalMat.polygonOffsetFactor = -2;
  decalMat.polygonOffsetUnits = -4;
  return {
    paints,
    armor: toonMaterial({ vertexColors: true, spec: fin.spec, rim: fin.rim }),
    outline: outlineMaterial({ thickness: 0.05, minPx: 1.0, maxPx: 3.2 }),
    decal: decalMat,
    glow: new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 2.4, metalness: 0, roughness: 0.3 }),
    glowDim: new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.8, metalness: 0, roughness: 0.4 }),
    visor: new THREE.MeshStandardMaterial({ color: '#05080c', emissive: accentColor, emissiveIntensity: 1.6, metalness: 0.9, roughness: 0.15 }),
    beam: new THREE.MeshBasicMaterial({ color: accentColor.clone().multiplyScalar(2.4), transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    beamCore: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2.2), toneMapped: false }),
    flame: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb24a').multiplyScalar(2.2), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    flameAccent: new THREE.MeshBasicMaterial({ color: accentColor.clone().multiplyScalar(2.2), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  };
}

/** Colore finale di ogni pezzo, secondo la livrea scelta. */
function colorFor(cfg, paints) {
  const camo = [paints.P, shadeHex(paints.P, -0.12), paints.S, shadeHex(paints.P, 0.08)];
  let n = 0;
  return (mesh) => {
    let key = mesh.userData.paint;
    if (cfg.pattern === 'split' && mesh.userData.side > 0) {
      if (key === 'P') key = 'S';
      else if (key === 'S') key = 'P';
    }
    if (cfg.pattern === 'camo' && key === 'P') return camo[(n++ * 7 + 3) % camo.length];
    return paints[key];
  };
}

/** Strisce e segnali di pericolo della livrea. */
function liveryExtras(cfg, J) {
  if (cfg.pattern === 'stripes') {
    A(J.chest, cbox(0.16, 1.9, 0.06, 0.02), 'S', [0.35, 1.05, 0.985], [0, 0.04, 0]);
    for (const [hip, s] of [[J.hipL, 1], [J.hipR, -1]]) {
      SIDE = s;
      A(J[s > 0 ? 'kneeL' : 'kneeR'], cbox(0.12, 1.0, 0.04, 0.01), 'S', [s * 0.18, -0.95, 0.7]);
      A(hip, cbox(0.14, 1.1, 0.04, 0.01), 'S', [-s * 0.22, -1.0, 0.57]);
    }
    SIDE = 0;
  } else if (cfg.pattern === 'hazard') {
    for (const [knee, s] of [[J.kneeL, 1], [J.kneeR, -1]]) {
      SIDE = s;
      decal(knee, 'hazard', 0.9, 0.14, [0, -1.55, 0.66], [-0.03, 0, 0]);
    }
    for (const s of [-1, 1]) decal(J.chest, 'hazard', 0.6, 0.1, [s * 0.68, 1.2, 0.99], [0, s * 0.12, 0]);
    SIDE = 0;
  }
}

/**
 * Costruisce il modello 3D di un Titano a partire dalla sua configurazione.
 * Restituisce l'oggetto radice e i riferimenti ai giunti per le animazioni.
 */
export function buildRobot(cfg, { shadows = false } = {}) {
  const M = makeMaterials(cfg);
  MATS = M;
  const chassis = getPart(cfg.chassis) || PARTS.chassis[0];
  const rest = LEG_REST[cfg.legs] || LEG_REST.lg_std;
  const refs = { spinners: [], sweepers: [], legThrusters: [], boosters: [], core: null, blade: null };
  const joints = {};

  const root = new THREE.Group();
  const body = piv(root);
  body.scale.set(...chassis.scale);

  const hips = piv(body, 0, HIP_Y, 0);
  buildPelvis(hips, joints);

  // Il robot guarda verso +Z: il suo lato sinistro e' +X, il destro -X.
  const hipL = piv(hips, 0.95, -0.25, 0);
  const hipR = piv(hips, -0.95, -0.25, 0);
  const legL = buildLeg(cfg.legs, hipL, 1, rest, refs);
  const legR = buildLeg(cfg.legs, hipR, -1, rest, refs);

  const spine = piv(hips, 0, 0.55, 0);
  buildAbdomen(spine);
  const chest = piv(spine, 0, 0.8, 0);
  const neckY = buildTorso(cfg.torso, chest, refs);
  const neck = piv(chest, 0, neckY, 0.05);
  const head = buildHead(cfg.head, neck, refs);

  const shL = piv(chest, 2.05, 1.85, 0);
  const shR = piv(chest, -2.05, 1.85, 0);
  shL.rotation.order = 'YXZ';
  shR.rotation.order = 'YXZ';
  const armL = buildArm(cfg.armL, shL, 1, refs);
  const armR = buildArm(cfg.armR, shR, -1, refs);

  const padL = piv(chest, 2.05, 1.85, 0);
  buildShoulder(cfg.shoulders, padL, 1, cfg.code);
  const padR = piv(chest, -2.05, 1.85, 0);
  buildShoulder(cfg.shoulders, padR, -1, '');

  Object.assign(joints, {
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
  });
  liveryExtras(cfg, joints);

  flattenGroups(root);
  finalizeModel(root, { paints: M.paints, mats: M, shadows, colorOf: colorFor(cfg, M.paints) });
  root.traverse((o) => {
    if (o.isMesh && !o.userData.outline && o.material !== M.decal) {
      o.castShadow = shadows && o.castShadow !== false && !(o.material.blending === THREE.AdditiveBlending);
      o.receiveShadow = shadows && o.material === M.armor;
    }
  });

  const materials = [M.armor, M.outline, M.decal, M.glow, M.glowDim, M.visor, M.beam, M.beamCore, M.flame, M.flameAccent];
  return {
    root,
    body,
    joints,
    rest,
    materials,
    bodyMaterials: [M.armor],
    glow: M.glow,
    visor: M.visor,
    core: refs.core,
    spinners: refs.spinners,
    sweepers: refs.sweepers,
    muzzleL: armL.muzzle,
    muzzleR: armR.muzzle,
    thrustersL: armL.thrusters,
    thrustersR: armR.thrusters,
    // propulsori dello scatto: zaino + polpacci
    legThrusters: [...refs.boosters, ...refs.legThrusters],
    scale: chassis.scale[1],
    height: 10.0 * chassis.scale[1],
    dispose() {
      disposeFinalized(root);
      root.traverse((o) => {
        if (o.isMesh && o.userData.ownGeo) o.geometry.dispose();
      });
      materials.forEach((m) => m.dispose());
    },
  };
}
