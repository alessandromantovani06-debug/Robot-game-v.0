// Modelli 3D dei Kaiju in stile anime: masse muscolose, placche corazzate, file di aculei,
// denti e artigli, vene bioluminescenti e contorni neri.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { blob, limb, claw, smoothTube, cbox, cone, cyl, sph, plate, symPlate } from './geo.js';
import { toonMaterial, outlineMaterial, addOutline } from './toon.js';

const PI = Math.PI;

// ------------------------------------------------------------------ texture (atlante 2x2)
// A = squame (pelle), B = placche ventrali, C = corazza, D = bianco (osso, dettagli)
const REGION = { skin: [0, 0], belly: [0.5, 0], armor: [0, 0.5], plain: [0.5, 0.5] };
const texCache = new Map();

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function atlas(seed) {
  if (texCache.has(seed)) return texCache.get(seed);
  const S = 1024;
  const H = S / 2;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    return [c, c.getContext('2d')];
  };
  const [c1, g] = make();
  const [c2, e] = make();
  const rand = rng(seed * 7919 + 13);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, S, S);
  e.fillStyle = '#000000';
  e.fillRect(0, 0, S, S);
  // canvas: y verso il basso, la texture ha v verso l'alto -> regione A (u 0-0.5, v 0-0.5) = in basso a sinistra
  const box = (r) => ({ x: r[0] * S, y: S - (r[1] + 0.5) * S });
  // A: squame disegnate a mano
  {
    const { x, y } = box(REGION.skin);
    g.save();
    g.beginPath();
    g.rect(x, y, H, H);
    g.clip();
    g.strokeStyle = 'rgba(20,24,30,0.32)';
    g.lineWidth = 2;
    const step = 26;
    for (let row = 0; row < H / (step * 0.6) + 2; row++) {
      for (let col = 0; col < H / step + 2; col++) {
        const cx = x + col * step + (row % 2 ? step / 2 : 0) + (rand() - 0.5) * 4;
        const cy = y + row * step * 0.6;
        g.beginPath();
        g.arc(cx, cy, step * 0.55, 0.15 * PI, 0.85 * PI);
        g.stroke();
      }
    }
    // pieghe della pelle
    g.strokeStyle = 'rgba(10,12,16,0.35)';
    g.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      let px = x + rand() * H;
      let py = y + rand() * H;
      g.beginPath();
      g.moveTo(px, py);
      for (let k = 0; k < 5; k++) {
        px += (rand() - 0.5) * 60;
        py += rand() * 40;
        g.lineTo(px, py);
      }
      g.stroke();
    }
    g.restore();
    // vene luminose
    e.save();
    e.beginPath();
    e.rect(x, y, H, H);
    e.clip();
    e.strokeStyle = '#ffffff';
    e.lineCap = 'round';
    e.shadowColor = '#ffffff';
    e.shadowBlur = 8;
    e.shadowBlur = 4;
    for (let i = 0; i < 6; i++) {
      let px = x + rand() * H;
      let py = y + rand() * H;
      e.lineWidth = 1.5 + rand() * 2;
      e.beginPath();
      e.moveTo(px, py);
      for (let k = 0; k < 7; k++) {
        px += (rand() - 0.5) * 70;
        py += (rand() - 0.3) * 60;
        e.lineTo(px, py);
        if (rand() < 0.3) {
          e.moveTo(px, py);
          e.lineTo(px + (rand() - 0.5) * 50, py + (rand() - 0.5) * 50);
          e.moveTo(px, py);
        }
      }
      e.stroke();
    }
    e.fillStyle = '#ffffff';
    for (let i = 0; i < 12; i++) {
      e.globalAlpha = 0.5 + rand() * 0.5;
      e.beginPath();
      e.arc(x + rand() * H, y + rand() * H, 2 + rand() * 3, 0, PI * 2);
      e.fill();
    }
    e.restore();
  }
  // B: placche ventrali (bande orizzontali)
  {
    const { x, y } = box(REGION.belly);
    g.save();
    g.beginPath();
    g.rect(x, y, H, H);
    g.clip();
    g.strokeStyle = 'rgba(20,20,24,0.35)';
    g.lineWidth = 4;
    for (let yy = y + 14; yy < y + H; yy += 34) {
      g.beginPath();
      g.moveTo(x, yy);
      g.quadraticCurveTo(x + H / 2, yy + 10, x + H, yy);
      g.stroke();
    }
    g.strokeStyle = 'rgba(20,20,24,0.18)';
    g.lineWidth = 2;
    for (let xx = x + 40; xx < x + H; xx += 80) {
      g.beginPath();
      g.moveTo(xx, y);
      g.lineTo(xx, y + H);
      g.stroke();
    }
    g.restore();
  }
  // C: corazza (crepe e bordi)
  {
    const { x, y } = box(REGION.armor);
    g.save();
    g.beginPath();
    g.rect(x, y, H, H);
    g.clip();
    g.strokeStyle = 'rgba(10,10,14,0.4)';
    g.lineWidth = 3;
    for (let i = 0; i < 18; i++) {
      let px = x + rand() * H;
      let py = y + rand() * H;
      g.beginPath();
      g.moveTo(px, py);
      for (let k = 0; k < 4; k++) {
        px += (rand() - 0.5) * 50;
        py += (rand() - 0.5) * 50;
        g.lineTo(px, py);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = 0; i < 40; i++) g.fillRect(x + rand() * H, y + rand() * H, 6 + rand() * 18, 2);
    g.restore();
    e.save();
    e.beginPath();
    e.rect(x, y, H, H);
    e.clip();
    e.strokeStyle = '#ffffff';
    e.shadowColor = '#ffffff';
    e.shadowBlur = 6;
    e.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      let px = x + rand() * H;
      let py = y + rand() * H;
      e.beginPath();
      e.moveTo(px, py);
      for (let k = 0; k < 4; k++) {
        px += (rand() - 0.5) * 60;
        py += (rand() - 0.5) * 60;
        e.lineTo(px, py);
      }
      e.stroke();
    }
    e.restore();
  }
  const map = new THREE.CanvasTexture(c1);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(c2);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, emissiveMap]) {
    t.anisotropy = 4;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  }
  const res = { map, emissiveMap };
  texCache.set(seed, res);
  return res;
}

// ------------------------------------------------------------------ costruzione
const DUMMY = new THREE.MeshBasicMaterial();

function A(parent, geo, paint, p = [0, 0, 0], r = [0, 0, 0], s = null) {
  const m = new THREE.Mesh(geo, DUMMY);
  m.position.set(p[0], p[1], p[2]);
  m.rotation.set(r[0], r[1], r[2]);
  if (s) m.scale.set(s[0], s[1], s[2]);
  m.userData.paint = paint;
  parent.add(m);
  return m;
}

function piv(parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

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

const UV_REGION = { skin: 'skin', belly: 'belly', armor: 'armor', ridge: 'armor' };
const _col = new THREE.Color();

function prepare(mesh, colors) {
  mesh.updateMatrix();
  const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  g.applyMatrix4(mesh.matrix);
  if (mesh.matrix.determinant() < 0) {
    for (const a of [g.attributes.position, g.attributes.normal, g.attributes.uv]) {
      const s = a.itemSize;
      for (let i = 0; i < n; i += 3)
        for (let k = 0; k < s; k++) {
          const t = a.array[(i + 1) * s + k];
          a.array[(i + 1) * s + k] = a.array[(i + 2) * s + k];
          a.array[(i + 2) * s + k] = t;
        }
    }
  }
  const key = mesh.userData.paint;
  _col.set(colors[key] || '#ffffff');
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = _col.r;
    c[i * 3 + 1] = _col.g;
    c[i * 3 + 2] = _col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  // coordinate di texture nella regione dell'atlante
  const uv = g.attributes.uv;
  const reg = REGION[UV_REGION[key] || 'plain'];
  const plain = !UV_REGION[key];
  const rep = mesh.userData.uvRepeat || 1;
  for (let i = 0; i < n; i++) {
    if (plain) uv.setXY(i, reg[0] + 0.25, reg[1] + 0.25);
    else {
      const u = (uv.getX(i) * rep) % 1;
      const v = (uv.getY(i) * rep) % 1;
      uv.setXY(i, reg[0] + 0.01 + u * 0.48, reg[1] + 0.01 + v * 0.48);
    }
  }
  return g;
}

function finalize(root, colors, M, shadows) {
  const nodes = [];
  root.traverse((o) => nodes.push(o));
  for (const node of nodes) {
    const groups = new Map();
    for (const child of [...node.children]) {
      if (!child.isMesh || child.userData.keep || child.children.length || !child.userData.paint) continue;
      const k = child.userData.paint;
      const gk = k === 'glow' || k === 'mouth' || k === 'eye' ? k : '__body';
      if (!groups.has(gk)) groups.set(gk, []);
      groups.get(gk).push(child);
    }
    for (const [gk, meshes] of groups) {
      const body = gk === '__body';
      const geos = meshes.map((m) => {
        if (body) return prepare(m, colors);
        m.updateMatrix();
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal'].includes(name)) g.deleteAttribute(name);
        g.applyMatrix4(m.matrix);
        return g;
      });
      const geo = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      for (const m of meshes) node.remove(m);
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, body ? M.body : gk === 'mouth' ? M.mouth : M.glow);
      mesh.userData.merged = true;
      mesh.castShadow = shadows && body;
      mesh.receiveShadow = shadows && body;
      node.add(mesh);
      if (body) addOutline(mesh, M.outline);
    }
  }
}

// ------------------------------------------------------------------ dettagli
/** Fila di denti lungo un arco (in basso se down). */
function teeth(parent, { n = 7, len = 1.6, w = 0.5, z0 = 0.2, y = 0, size = 0.3, down = true, paint = 'bone' }) {
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const z = z0 + t * len;
    const ww = w * (1 - t * 0.55);
    const s = size * (1 - Math.abs(t - 0.35) * 0.7);
    for (const side of [-1, 1]) A(parent, cone(0.075 * s / 0.3, s, 6), paint, [ww * side, y, z], [down ? PI : 0, 0, side * (down ? -0.15 : 0.15)]);
  }
}

/** Fila di aculei/placche lungo una curva sul dorso. */
function dorsal(parent, pts, { size = 1, paint = 'bone', glowEvery = 0, plates = true, lean = -0.4 } = {}) {
  pts.forEach(([x, y, z, k], i) => {
    const h = size * (k ?? 1);
    if (plates) A(parent, cbox(0.55 * h, 0.35 * h, 0.9 * h, 0.12 * h), 'armor', [x, y, z], [lean * 0.5, 0, 0]);
    A(parent, symPlate([[0.02, 1.2 * h], [0.16 * h, 0.35 * h], [0.26 * h, 0]], 0.14 * h, 0.04 * h), paint, [x, y + 0.08 * h, z], [lean, PI / 2, 0]);
    if (glowEvery && i % glowEvery === 0) A(parent, sph(0.09 * h, 8, 6), 'glow', [x, y + 0.2 * h, z + 0.25 * h]);
  });
}

function eyes(parent, list) {
  for (const [x, y, z, r, ry = 0] of list) {
    A(parent, sph(r, 10, 8), 'eye', [x, y, z], [0, ry, 0], [1.6, 0.55, 0.7]);
    A(parent, cbox(r * 3.6, r * 0.5, r * 1.4, r * 0.2), 'dark', [x, y + r * 0.62, z - r * 0.1], [0, ry, x > 0 ? -0.25 : 0.25]);
  }
}

// ------------------------------------------------------------------ TESTE
function buildHead(type, neck, size) {
  const head = piv(neck, 0, 0, 0);
  let jaw;
  switch (type) {
    case 'crab': {
      A(head, blob(1.25, 0.55, 0.95, { seed: 4, bump: 0.08 }), 'armor', [0, 0.05, 0.55]);
      A(head, blob(0.9, 0.42, 0.7, { seed: 5 }), 'skin', [0, -0.2, 0.75]);
      for (const s of [-1, 1]) {
        const st = grp(head, [0.5 * s, 0.4, 0.9], [-0.35, 0, -0.25 * s]);
        A(st, smoothTube([[0, 0, 0], [0, 0.5, 0.05], [0, 0.95, 0.15]], [0.11, 0.09, 0.07], 8), 'skin');
        A(st, sph(0.17, 10, 8), 'eye', [0, 1.0, 0.18]);
        // mandibole
        A(head, claw(0.95, 0.15, 1.2), 'bone', [0.42 * s, -0.25, 1.25], [0.9, 0, -0.5 * s]);
        A(head, claw(0.6, 0.1, 1.0), 'bone', [0.22 * s, -0.35, 1.35], [1.1, 0, -0.3 * s]);
      }
      jaw = piv(head, 0, -0.35, 0.6);
      A(jaw, blob(0.8, 0.26, 0.7, { seed: 6 }), 'belly', [0, 0, 0.35]);
      A(head, blob(0.45, 0.22, 0.4, { seed: 1, bump: 0.02 }), 'mouth', [0, -0.28, 1.05]);
      for (let i = 0; i < 5; i++) A(head, cone(0.09, 0.4, 5), 'ridge', [-0.8 + i * 0.4, 0.55 - Math.abs(i - 2) * 0.06, 0.25], [-0.3, 0, 0]);
      break;
    }
    case 'cobra': {
      A(head, blob(0.72, 0.5, 1.25, { seed: 7, bump: 0.08 }), 'skin', [0, 0.1, 0.85]);
      A(head, blob(0.6, 0.18, 0.9, { seed: 8 }), 'armor', [0, 0.45, 0.85]);
      // cappuccio: ventaglio con disegni a occhio luminosi
      const hood = grp(head, [0, 0.3, -0.35], [0.12, 0, 0]);
      A(hood, blob(2.3, 2.05, 0.2, { seed: 9, bump: 0.06, freq: 1.4 }), 'skin', [0, -0.1, 0]);
      A(hood, blob(1.6, 1.6, 0.16, { seed: 10, bump: 0.05 }), 'belly', [0, -0.2, 0.08]);
      for (const s of [-1, 1]) {
        A(hood, sph(0.2, 12, 10), 'glow', [1.25 * s, 0.4, 0.16], [0, 0, 0], [1, 1.5, 0.25]);
        A(hood, sph(0.4, 12, 10), 'dark', [1.25 * s, 0.4, 0.1], [0, 0, 0], [1, 1.35, 0.2]);
        A(hood, sph(0.12, 10, 8), 'glow', [1.6 * s, -0.7, 0.13], [0, 0, 0], [1, 1.2, 0.25]);
        A(hood, sph(0.24, 10, 8), 'dark', [1.6 * s, -0.7, 0.1], [0, 0, 0], [1, 1.2, 0.2]);
        for (let i = 0; i < 4; i++) A(hood, smoothTube([[0.3 * s, -1.1, 0], [1.2 * s, 0.2 - i * 0.4, 0.05], [2.1 * s, 0.6 - i * 0.5, 0]], [0.06, 0.05, 0.02], 6), 'ridge');
      }
      eyes(head, [[0.42, 0.32, 1.32, 0.11, 0.3], [-0.42, 0.32, 1.32, 0.11, -0.3]]);
      jaw = piv(head, 0, -0.18, 0.3);
      A(jaw, blob(0.6, 0.2, 1.0, { seed: 11 }), 'belly', [0, -0.08, 0.55]);
      for (const s of [-1, 1]) A(head, claw(0.7, 0.08, 0.6), 'bone', [0.24 * s, -0.25, 1.75], [PI, 0, 0]);
      teeth(jaw, { n: 6, len: 1.2, w: 0.42, z0: 0.3, y: 0.05, size: 0.18, down: false });
      A(head, blob(0.42, 0.18, 0.75, { seed: 2, bump: 0.02 }), 'mouth', [0, -0.12, 1.0]);
      break;
    }
    case 'horned': {
      A(head, blob(1.05, 0.85, 1.3, { seed: 12, bump: 0.1 }), 'skin', [0, 0, 0.8]);
      A(head, blob(1.15, 0.45, 1.0, { seed: 13, bump: 0.08 }), 'armor', [0, 0.45, 0.35]);
      for (const s of [-1, 1]) {
        A(head, claw(2.6, 0.34, 1.3, 8), 'bone', [0.8 * s, 0.55, 0.4], [-2.6, 0, -0.8 * s]);
        A(head, sph(0.12, 8, 6), 'glow', [1.55 * s, 2.0, 1.1]);
      }
      A(head, claw(1.2, 0.26, 0.9), 'bone', [0, 0.6, 1.75], [-2.4, 0, 0]);
      eyes(head, [[0.55, 0.25, 1.62, 0.12, 0.4], [-0.55, 0.25, 1.62, 0.12, -0.4]]);
      jaw = piv(head, 0, -0.35, 0.4);
      A(jaw, blob(0.85, 0.3, 1.05, { seed: 14 }), 'belly', [0, -0.1, 0.7]);
      teeth(jaw, { n: 7, len: 1.2, w: 0.55, z0: 0.3, y: 0.05, size: 0.26, down: false });
      teeth(head, { n: 7, len: 1.2, w: 0.6, z0: 0.5, y: -0.38, size: 0.26, down: true });
      A(head, blob(0.5, 0.25, 0.75, { seed: 3, bump: 0.02 }), 'mouth', [0, -0.3, 1.0]);
      break;
    }
    case 'abyss': {
      A(head, blob(1.4, 0.95, 1.8, { seed: 15, bump: 0.12 }), 'skin', [0, 0.1, 0.9]);
      A(head, blob(1.3, 0.4, 1.4, { seed: 16, bump: 0.1 }), 'armor', [0, 0.65, 0.5]);
      eyes(head, [
        [0.85, 0.42, 1.72, 0.13, 0.5], [-0.85, 0.42, 1.72, 0.13, -0.5],
        [0.78, 0.38, 1.28, 0.11, 0.6], [-0.78, 0.38, 1.28, 0.11, -0.6],
        [0.7, 0.34, 0.86, 0.09, 0.7], [-0.7, 0.34, 0.86, 0.09, -0.7],
      ]);
      // corona di aculei
      for (let i = 0; i < 9; i++) {
        const a = (i / 8 - 0.5) * 2.6;
        const sp = grp(head, [Math.sin(a) * 1.05, 0.7, 0.15 + Math.cos(a) * 0.25], [-1.15, 0, -a * 0.6]);
        A(sp, claw(1.6 + (1 - Math.abs(a) / 1.3) * 0.8, 0.2, 0.5), 'bone', [0, 0, 0], [PI, 0, 0]);
        A(sp, sph(0.08, 6, 4), 'glow', [0, 1.95 + (1 - Math.abs(a) / 1.3) * 0.7, 0.4]);
      }
      jaw = piv(head, 0, -0.4, 0.3);
      A(jaw, blob(1.25, 0.38, 1.55, { seed: 17 }), 'belly', [0, -0.1, 0.9]);
      teeth(jaw, { n: 9, len: 2.0, w: 0.95, z0: 0.3, y: 0.08, size: 0.34, down: false });
      teeth(head, { n: 9, len: 2.0, w: 1.0, z0: 0.5, y: -0.4, size: 0.34, down: true });
      teeth(head, { n: 7, len: 1.4, w: 0.7, z0: 0.6, y: -0.35, size: 0.24, down: true });
      A(head, blob(0.75, 0.3, 1.5, { seed: 4, bump: 0.02 }), 'mouth', [0, -0.35, 1.3]);
      break;
    }
    default: {
      // squalo con testa a lama
      A(head, blob(0.82, 0.6, 1.55, { seed: 18, bump: 0.08 }), 'skin', [0, 0.05, 0.9]);
      const blade = grp(head, [0, 0.55, 0.6], [0, -PI / 2, 0]);
      A(blade, plate([[1.4, -0.2], [0.6, 0.45], [-0.6, 1.05], [-2.4, 0.7], [-2.9, 0.1], [-1.2, -0.15]], 0.2, 0.05), 'ridge', [0, 0, 0]);
      A(blade, plate([[0.9, 0.12], [-0.5, 0.8], [-2.3, 0.55], [-2.6, 0.25]], 0.26, 0.04), 'bone', [0, 0.06, 0]);
      for (let i = 0; i < 4; i++) A(head, cbox(0.08, 0.04, 0.5, 0.01), 'glow', [0.42, 0.35 - i * 0.02, 0.65 + i * 0.18], [0, 0.2, 0.3]);
      for (let i = 0; i < 4; i++) A(head, cbox(0.08, 0.04, 0.5, 0.01), 'glow', [-0.42, 0.35 - i * 0.02, 0.65 + i * 0.18], [0, -0.2, -0.3]);
      eyes(head, [[0.58, 0.22, 1.25, 0.11, 0.35], [-0.58, 0.22, 1.25, 0.11, -0.35]]);
      // branchie
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) A(head, cbox(0.04, 0.42, 0.06, 0.01), 'dark', [0.72 * s, 0.0, 0.2 - i * 0.18], [0, 0, 0.1 * s]);
      jaw = piv(head, 0, -0.28, 0.2);
      A(jaw, blob(0.7, 0.26, 1.35, { seed: 19 }), 'belly', [0, -0.05, 0.85]);
      teeth(jaw, { n: 8, len: 1.8, w: 0.55, z0: 0.2, y: 0.05, size: 0.24, down: false });
      teeth(head, { n: 8, len: 1.8, w: 0.6, z0: 0.3, y: -0.33, size: 0.26, down: true });
      A(head, blob(0.45, 0.22, 1.1, { seed: 5, bump: 0.02 }), 'mouth', [0, -0.2, 1.0]);
    }
  }
  return { head, jaw };
}

// ------------------------------------------------------------------ ARTI
function buildClawArm(parent, x, y, z, side, size = 1, pincer = false) {
  const k = size;
  const sh = piv(parent, x, y, z);
  A(sh, blob(0.85 * k, 0.75 * k, 0.8 * k, { seed: 20 + side, bump: 0.1 }), 'skin', [0, 0, 0]);
  A(sh, cbox(1.0 * k, 0.4 * k, 1.1 * k, 0.15 * k), 'armor', [side * 0.2 * k, 0.45 * k, 0], [0, 0, -side * 0.4]);
  A(sh, limb([[0.05, 0.1], [0.62 * k, -0.2 * k], [0.66 * k, -0.9 * k], [0.5 * k, -1.7 * k], [0.3 * k, -2.05 * k]], 12), 'skin', [0, 0, 0]);
  A(sh, cone(0.14 * k, 0.6 * k, 6), 'bone', [side * 0.35 * k, -0.9 * k, -0.45 * k], [-1.0, 0, side * 0.4]);
  const el = piv(sh, 0, -2.0 * k, 0);
  A(el, blob(0.5 * k, 0.5 * k, 0.5 * k, { seed: 22 }), 'skin', [0, 0, 0]);
  A(el, limb([[0.42 * k, 0.1], [0.55 * k, -0.5 * k], [0.46 * k, -1.3 * k], [0.36 * k, -1.85 * k]], 12), 'skin', [0, 0, 0]);
  A(el, cbox(0.5 * k, 1.2 * k, 0.32 * k, 0.1 * k), 'armor', [0, -0.85 * k, -0.42 * k], [0.08, 0, 0]);
  for (let i = 0; i < 3; i++) A(el, cone(0.1 * k, 0.45 * k, 5), 'bone', [0, -0.4 * k - i * 0.42 * k, -0.6 * k], [-1.2, 0, 0]);
  const hand = piv(el, 0, -1.9 * k, 0);
  let pinch = null;
  if (pincer) {
    A(hand, blob(0.75 * k, 1.1 * k, 0.6 * k, { seed: 23, bump: 0.06 }), 'armor', [0, -0.6 * k, 0]);
    const top = grp(hand, [0, -1.2 * k, 0.2 * k], [0, 0, 0]);
    A(top, claw(2.0 * k, 0.4 * k, 0.6, 8), 'armor', [0, 0, 0], [0, 0, 0], [1, 1, 0.7]);
    for (let i = 0; i < 4; i++) A(top, cone(0.08 * k, 0.3 * k, 5), 'bone', [0, -0.4 * k - i * 0.35 * k, -0.18 * k], [-PI / 2 - 0.3, 0, 0]);
    A(top, sph(0.1 * k, 6, 4), 'glow', [0, -1.0 * k, 0.32 * k]);
    pinch = piv(hand, 0, -1.2 * k, -0.25 * k);
    A(pinch, claw(1.6 * k, 0.32 * k, -0.6, 8), 'armor', [0, 0, 0], [0, 0, 0], [1, 1, 0.7]);
    for (let i = 0; i < 3; i++) A(pinch, cone(0.07 * k, 0.26 * k, 5), 'bone', [0, -0.35 * k - i * 0.35 * k, 0.12 * k], [PI / 2 + 0.3, 0, 0]);
  } else {
    A(hand, blob(0.48 * k, 0.4 * k, 0.55 * k, { seed: 24 }), 'skin', [0, -0.2 * k, 0]);
    for (let i = 0; i < 4; i++) {
      const c = grp(hand, [(i - 1.5) * 0.22 * k, -0.4 * k, 0.12 * k + (i === 0 || i === 3 ? -0.05 : 0)], [0.25, 0, (i - 1.5) * 0.18]);
      A(c, smoothTube([[0, 0, 0], [0, -0.35 * k, 0.05 * k]], [0.12 * k, 0.1 * k], 7), 'skin');
      A(c, claw(1.1 * k, 0.11 * k, 0.9), 'bone', [0, -0.32 * k, 0.05 * k]);
    }
  }
  return { sh, el, hand, pinch, side };
}

function buildLeg(parent, x, y, z, cfg, quad) {
  const r = cfg.r;
  const hip = piv(parent, x, y, z);
  A(hip, blob(r * 1.3, r * 1.25, r * 1.3, { seed: 30, bump: 0.1 }), 'skin', [0, 0, 0]);
  A(hip, limb([[0.05, r * 0.4], [r * 1.25, -r * 0.2], [r * 1.3, -cfg.thigh * 0.45], [r * 0.95, -cfg.thigh * 0.9], [r * 0.7, -cfg.thigh - 0.1]], 12), 'skin', [0, 0, 0]);
  A(hip, cbox(r * 1.5, cfg.thigh * 0.55, r * 0.5, r * 0.2), 'armor', [Math.sign(x || 1) * r * 0.55, -cfg.thigh * 0.4, 0], [0, Math.sign(x || 1) * 0.6, 0]);
  const knee = piv(hip, 0, -cfg.thigh, 0);
  A(knee, blob(r * 0.85, r * 0.8, r * 0.85, { seed: 31 }), 'skin', [0, 0, 0]);
  A(knee, cbox(r * 1.2, r * 1.0, r * 0.7, r * 0.2), 'armor', [0, 0.05, r * 0.65]);
  A(knee, limb([[r * 0.8, 0.1], [r * 0.95, -cfg.shin * 0.3], [r * 0.7, -cfg.shin * 0.8], [r * 0.55, -cfg.shin - 0.05]], 12), 'skin', [0, 0, 0]);
  if (!quad) A(knee, cone(r * 0.25, r * 1.2, 6), 'bone', [0, -cfg.shin * 0.35, -r * 0.8], [-2.1, 0, 0]);
  const ankle = piv(knee, 0, -cfg.shin, 0);
  A(ankle, blob(r * 1.05, r * 0.5, r * 1.55, { seed: 32, bump: 0.08, flatBottom: 0.6 }), 'skin', [0, -0.12, r * 0.45]);
  for (let i = 0; i < 3; i++) {
    const t = grp(ankle, [(i - 1) * r * 0.62, -0.2, r * 1.5], [0, (i - 1) * 0.3, 0]);
    A(t, claw(r * 1.15, r * 0.24, 0.9), 'bone', [0, 0.05, 0], [PI / 2 + 0.2, 0, 0]);
  }
  A(ankle, claw(r * 0.8, r * 0.2, 0.6), 'bone', [0, -0.05, -r * 0.6], [-PI / 2 + 0.2, 0, 0]);
  return { hip, knee, ankle };
}

function buildTail(parent, x, y, z, segs, baseR, def, tipFin = false) {
  const pivots = [];
  let p = piv(parent, x, y, z);
  let r = baseR;
  const segLen = baseR * 1.45;
  for (let i = 0; i < segs; i++) {
    A(p, smoothTube([[0, 0, 0.15], [0, 0, -segLen * 0.5], [0, 0, -segLen - 0.15]], [r, r * 0.96, r * 0.86], 12), 'skin');
    // placca dorsale + aculeo
    A(p, cbox(r * 1.2, r * 0.42, segLen * 0.85, r * 0.2), 'armor', [0, r * 0.72, -segLen * 0.5], [0.04, 0, 0]);
    if (i % 2 === 0 || def.body.head === 'horned') {
      const k = r * (def.body.head === 'horned' ? 1.6 : 1.25);
      A(p, symPlate([[0.02, 1.0 * k], [0.14 * k, 0.3 * k], [0.24 * k, 0]], 0.12 * k, 0.03), def.body.head === 'horned' ? 'glow' : 'bone', [0, r * 0.85, -segLen * 0.5], [-0.5, PI / 2, 0]);
    }
    A(p, blob(r * 0.85, r * 0.5, segLen * 0.42, { seed: 40 + i }), 'belly', [0, -r * 0.45, -segLen * 0.5]);
    if (i % 3 === 1) A(p, sph(r * 0.17, 8, 6), 'glow', [r * 0.8, 0.1, -segLen * 0.5]);
    if (i % 3 === 1) A(p, sph(r * 0.17, 8, 6), 'glow', [-r * 0.8, 0.1, -segLen * 0.5]);
    pivots.push(p);
    p = piv(p, 0, 0, -segLen);
    r *= 0.84;
  }
  if (tipFin) {
    A(p, plate([[0, 0.1], [-1.4, 1.5], [-1.2, 0.2], [-1.6, -1.1], [0, -0.1]], 0.12, 0.04), 'armor', [0, 0, 0.1], [0, PI / 2, 0], [r * 2.2, r * 2.2, 1]);
  } else {
    A(p, claw(r * 3.2, r * 0.9, 0.5, 8), 'bone', [0, 0, 0.1], [-PI / 2, 0, 0]);
  }
  return pivots;
}

// ------------------------------------------------------------------ MODELLO
function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * 1.05), Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}

let seedCounter = 1;

function materials(def) {
  const tex = atlas((def.name.length * 31 + (seedCounter++ % 3)) | 0);
  const glow = new THREE.Color(def.glow);
  const body = toonMaterial({ vertexColors: true, map: tex.map, emissive: def.glow, spec: 0.06, rim: 0.32, rimColor: '#b8c8ff', dark: 0.4, mid: 0.72 });
  body.emissiveMap = tex.emissiveMap;
  body.emissiveIntensity = 0.9;
  return {
    body,
    // nomi usati dal combattimento
    skin: body,
    shell: body,
    belly: body,
    glow: new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 2.6, roughness: 0.4 }),
    mouth: new THREE.MeshStandardMaterial({ color: '#200a0a', emissive: glow, emissiveIntensity: 1.2, roughness: 0.8 }),
    outline: outlineMaterial({ color: '#05060a', thickness: 0.06, minPx: 1.0, maxPx: 3.2 }),
  };
}

/** Costruisce il modello 3D di un Kaiju. */
export function buildKaiju(def, { shadows = false } = {}) {
  const M = materials(def);
  const b = def.body;
  // colori un po' piu' chiari: con i toni netti la pelle scura diventerebbe tutta nera
  const skin = shade(def.skin, 0.1);
  const colors = {
    skin,
    belly: shade(def.belly, 0.08),
    armor: shade(skin, -0.05),
    ridge: shade(skin, 0.16),
    bone: '#d9d0bc',
    dark: '#0b0d10',
  };
  const root = new THREE.Group();
  const body = piv(root);
  body.scale.setScalar(def.size);
  const rig = { form: b.form, legs: [], arms: [], tail: [], spikes: [] };

  if (b.form === 'quad') {
    const legCfg = { thigh: 2.1, shin: 2.1, r: 0.62, restHip: -0.25, restKnee: 0.55, restAnkle: -0.3 };
    const legH = legCfg.thigh * Math.cos(legCfg.restHip) + legCfg.shin * Math.cos(legCfg.restHip + legCfg.restKnee) + 0.35;
    const torso = piv(body, 0, legH + 0.5, 0);
    rig.hips = torso;
    rig.hipY = legH + 0.5;
    A(torso, blob(2.55, 1.9, 3.7, { seed: 50, bump: 0.1 }), 'skin', [0, 0.3, 0]);
    A(torso, blob(2.1, 1.25, 3.2, { seed: 51, bump: 0.06 }), 'belly', [0, -0.4, 0.2]);
    // spalle e fianchi muscolosi
    for (const s of [-1, 1]) {
      A(torso, blob(1.2, 1.1, 1.3, { seed: 52 + s }), 'skin', [1.6 * s, 0.1, 2.0]);
      A(torso, blob(1.15, 1.05, 1.3, { seed: 54 + s }), 'skin', [1.55 * s, 0.1, -2.0]);
    }
    const spine = piv(torso, 0, 0, 0);
    rig.spine = spine;
    if (b.shell) {
      // carapace da granchio
      A(spine, blob(3.0, 1.15, 3.6, { seed: 56, bump: 0.06, freq: 1.5 }), 'armor', [0, 1.2, -0.1]);
      for (let i = 0; i < 6; i++) A(spine, cbox(4.6 - Math.abs(i - 2.5) * 0.7, 0.3, 0.45, 0.12), 'ridge', [0, 2.15 - Math.abs(i - 2.5) * 0.18, -2.4 + i * 0.95], [0.05, 0, 0]);
      for (let i = 0; i < 9; i++) {
        const a = (i / 8) * PI - PI / 2;
        for (const s of [-1, 1]) A(spine, cone(0.18, 0.75, 6), 'bone', [Math.cos(a) * 2.95 * s, 1.0, Math.sin(a) * 3.3], [0, 0, -s * 1.3]);
      }
      for (let i = 0; i < 4; i++) A(spine, sph(0.16, 8, 6), 'glow', [(i - 1.5) * 1.0, 2.1, 1.7 - Math.abs(i - 1.5) * 0.3]);
    } else {
      const n = b.spikes || 0;
      for (let i = 0; i < n; i++) {
        const t = i / Math.max(1, n - 1);
        const z = 2.6 - t * 5.0;
        const h = 1.1 + Math.sin(t * PI) * 1.5;
        A(spine, cbox(1.4, 0.45, 0.95, 0.15), 'armor', [0, 1.85 + Math.sin(t * PI) * 0.25, z], [0.1, 0, 0]);
        // cristalli elettrici
        const cr = grp(spine, [0, 1.95 + Math.sin(t * PI) * 0.25, z], [-0.35, 0, 0]);
        A(cr, cyl(0.06, 0.32, h, 6), b.head === 'horned' ? 'glow' : 'bone', [0, h / 2, 0]);
        A(cr, cyl(0.04, 0.2, h * 0.6, 6), b.head === 'horned' ? 'glow' : 'bone', [0.45, h * 0.3, 0.1], [0, 0, -0.5]);
        A(cr, cyl(0.04, 0.2, h * 0.6, 6), b.head === 'horned' ? 'glow' : 'bone', [-0.45, h * 0.3, 0.1], [0, 0, 0.5]);
      }
    }
    const neck = piv(spine, 0, 0.6, 3.4);
    A(neck, smoothTube([[0, -0.1, -0.6], [0, 0.15, 0.4], [0, 0.25, 1.2]], [1.05, 0.95, 0.85], 14), 'skin');
    A(neck, cbox(1.2, 0.4, 1.4, 0.15), 'armor', [0, 0.95, 0.3], [0.15, 0, 0]);
    const headPivot = piv(neck, 0, 0.2, 1.3);
    rig.neck = neck;
    const h = buildHead(b.head, headPivot, def.size);
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
      const leg = buildLeg(torso, x, -0.4, z, legCfg, true);
      leg.side = Math.sign(x);
      leg.front = front_;
      leg.rest = { hip: legCfg.restHip, knee: legCfg.restKnee, ankle: legCfg.restAnkle };
      rig.legs.push(leg);
    }
    if (b.arms === 'pincers') {
      rig.arms.push(buildClawArm(spine, -1.7, 0.2, 3.0, -1, 0.9, true));
      rig.arms.push(buildClawArm(spine, 1.7, 0.2, 3.0, 1, 0.9, true));
    }
    rig.tail = buildTail(torso, 0, 0.3, -3.5, b.tail || 4, 0.95, def);
    rig.height = (legH + 3) * def.size;
  } else {
    // bipede
    const legCfg = { thigh: 2.3, shin: 2.3, r: 0.72, restHip: -0.55, restKnee: 1.15, restAnkle: -0.6 };
    const legH = legCfg.thigh * Math.cos(legCfg.restHip) + legCfg.shin * Math.cos(legCfg.restHip + legCfg.restKnee) + 0.35;
    const hips = piv(body, 0, legH, 0);
    rig.hips = hips;
    rig.hipY = legH;
    A(hips, blob(1.75, 1.35, 1.75, { seed: 60, bump: 0.1 }), 'skin', [0, 0, -0.1]);
    A(hips, cbox(2.4, 0.55, 1.2, 0.2), 'armor', [0, 0.45, -0.85], [0.3, 0, 0]);
    for (const s of [-1, 1]) {
      const leg = buildLeg(hips, 1.15 * s, -0.25, 0, legCfg, false);
      leg.side = s;
      leg.front = true;
      leg.rest = { hip: legCfg.restHip, knee: legCfg.restKnee, ankle: legCfg.restAnkle };
      rig.legs.push(leg);
    }
    rig.tail = buildTail(hips, 0, 0.1, -1.3, b.tail || 5, 1.05, def, b.head === 'shark');
    const spine = piv(hips, 0, 0.5, 0);
    spine.rotation.x = 0.45;
    rig.spine = spine;
    rig.spineRest = 0.45;
    // torace: massa principale, ventre, petto e gobba delle spalle
    A(spine, blob(2.3, 2.55, 1.95, { seed: 61, bump: 0.1 }), 'skin', [0, 1.7, 0]);
    const bellyMesh = A(spine, blob(1.6, 1.95, 1.05, { seed: 62, bump: 0.05 }), 'belly', [0, 1.4, 0.75]);
    bellyMesh.userData.uvRepeat = 1;
    A(spine, blob(2.1, 1.25, 1.45, { seed: 63, bump: 0.1 }), 'skin', [0, 3.0, 0.2]);
    for (const s of [-1, 1]) {
      A(spine, blob(0.95, 0.85, 0.7, { seed: 64 + s, bump: 0.08 }), 'skin', [0.85 * s, 2.55, 0.95]);
      // costole corazzate sui fianchi
      for (let i = 0; i < 3; i++) A(spine, cbox(0.25, 1.2 - i * 0.2, 1.5, 0.08), 'armor', [2.0 * s, 1.9 - i * 0.55, -0.2], [0, 0, s * (0.25 + i * 0.1)]);
    }
    // placche sul dorso e aculei
    const nSpikes = b.spikes || 0;
    const pts = [];
    for (let i = 0; i < nSpikes; i++) {
      const t = i / Math.max(1, nSpikes - 1);
      pts.push([0, 3.7 - t * 3.4, -1.6 - Math.sin(t * PI) * 0.45, 0.8 + Math.sin(t * PI) * (b.crown ? 1.3 : 0.75)]);
    }
    dorsal(spine, pts, { size: 1, paint: 'bone', glowEvery: 2, lean: -1.2 });
    if (b.crown) {
      for (const s of [-1, 1])
        for (let i = 0; i < 4; i++) A(spine, claw(1.6 - i * 0.2, 0.26, 0.5), 'bone', [1.2 * s, 3.4 - i * 0.6, -1.0], [-2.6, 0, 0.6 * s]);
    }
    // venature luminose sul petto
    for (let i = 0; i < 3; i++) A(spine, smoothTube([[(i - 1) * 0.45, 2.3, 1.7], [(i - 1) * 0.6, 1.6, 1.82], [(i - 1) * 0.5, 0.9, 1.65]], [0.06, 0.05, 0.03], 6), 'glow');
    const neck = piv(spine, 0, 3.4, 1.0);
    neck.rotation.x = -0.45;
    rig.neckRest = -0.45;
    A(neck, smoothTube([[0, -0.5, -0.4], [0, 0.2, 0.3], [0, 0.55, 0.9]], [1.05, 0.92, 0.8], 14), 'skin');
    A(neck, cbox(1.0, 0.35, 1.2, 0.12), 'armor', [0, 0.85, 0.1], [0.4, 0, 0]);
    const headPivot = piv(neck, 0, 0.5, 0.9);
    rig.neck = neck;
    const h = buildHead(b.head, headPivot, def.size);
    rig.head = h.head;
    rig.jaw = h.jaw;
    rig.headPivot = headPivot;
    rig.arms.push(buildClawArm(spine, -2.05, 2.6, 0.5, -1, b.head === 'abyss' ? 1.15 : 1));
    rig.arms.push(buildClawArm(spine, 2.05, 2.6, 0.5, 1, b.head === 'abyss' ? 1.15 : 1));
    rig.height = (legH + 5.5) * def.size;
  }

  flattenGroups(root);
  finalize(root, colors, M, shadows);

  const mats = [M.body, M.glow, M.mouth, M.outline];
  return {
    root,
    body,
    rig,
    materials: M,
    allMaterials: mats,
    dispose() {
      root.traverse((o) => {
        if (o.isMesh && o.userData.merged) o.geometry.dispose();
      });
      mats.forEach((m) => m.dispose());
    },
  };
}
