// Geometrie per corazze meccaniche: blocchi smussati, sezioni rastremate, piastre estruse.
import * as THREE from 'three';

const cache = new Map();
function cached(key, make) {
  let g = cache.get(key);
  if (!g) {
    g = make();
    cache.set(key, g);
  }
  return g;
}

function ring(s) {
  const hw = s.w / 2;
  const hd = s.d / 2;
  const c = s.c ?? 0;
  const cf = Math.min(s.cf ?? c, hw * 0.95, hd * 0.95);
  const cb = Math.min(s.cb ?? c, hw * 0.95, hd * 0.95);
  const x = s.x || 0;
  const z = s.z || 0;
  return [
    [x + hw, z + hd - cf],
    [x + hw - cf, z + hd],
    [x - hw + cf, z + hd],
    [x - hw, z + hd - cf],
    [x - hw, z - hd + cb],
    [x - hw + cb, z - hd],
    [x + hw - cb, z - hd],
    [x + hw, z - hd + cb],
  ];
}

/**
 * Solido "loft" tra sezioni ottagonali (rettangoli smussati) disposte lungo Y.
 * sezione: { y, w, d, c (smusso), cf / cb (smusso davanti / dietro), x, z (spostamento) }
 */
export function loft(sections, { capTop = true, capBottom = true } = {}) {
  const key = 'L' + JSON.stringify(sections) + capTop + capBottom;
  return cached(key, () => {
    const pos = [];
    const uv = [];
    const rings = sections.map((s) => ring(s).map(([x, z]) => [x, s.y, z]));
    const n = rings.length;
    const tri = (a, b, c, ua, ub, uc) => {
      pos.push(...a, ...b, ...c);
      uv.push(...ua, ...ub, ...uc);
    };
    for (let j = 0; j < n - 1; j++) {
      const A = rings[j];
      const B = rings[j + 1];
      const v0 = j / (n - 1);
      const v1 = (j + 1) / (n - 1);
      for (let i = 0; i < 8; i++) {
        const k = (i + 1) % 8;
        const u0 = i / 8;
        const u1 = (i + 1) / 8;
        tri(A[i], B[k], A[k], [u0, v0], [u1, v1], [u1, v0]);
        tri(A[i], B[i], B[k], [u0, v0], [u0, v1], [u1, v1]);
      }
    }
    const cap = (R, up) => {
      const cx = R.reduce((s, p) => s + p[0], 0) / 8;
      const cy = R[0][1];
      const cz = R.reduce((s, p) => s + p[2], 0) / 8;
      const C = [cx, cy, cz];
      for (let i = 0; i < 8; i++) {
        const k = (i + 1) % 8;
        if (up) tri(C, R[k], R[i], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]);
        else tri(C, R[i], R[k], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]);
      }
    };
    if (capBottom) cap(rings[0], false);
    if (capTop) cap(rings[n - 1], true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  });
}

/** Blocco con tutti gli spigoli smussati, centrato nell'origine. */
export function cbox(w, h, d, c = 0.08, { taper = 0, cf, cb } = {}) {
  c = Math.min(c, w * 0.45, h * 0.45, d * 0.45);
  const t = 1 - taper;
  return loft([
    { y: -h / 2, w: w - 2 * c, d: d - 2 * c, c: c * 0.6, cf: cf != null ? cf * 0.6 : undefined, cb: cb != null ? cb * 0.6 : undefined },
    { y: -h / 2 + c, w, d, c, cf, cb },
    { y: h / 2 - c, w: w * t, d: d * t, c, cf, cb },
    { y: h / 2, w: w * t - 2 * c, d: d * t - 2 * c, c: c * 0.6, cf: cf != null ? cf * 0.6 : undefined, cb: cb != null ? cb * 0.6 : undefined },
  ]);
}

/**
 * Piastra estrusa da un profilo 2D (x, y), spessa `depth` lungo Z e centrata.
 * bevel = smusso dei bordi.
 */
export function plate(points, depth = 0.15, bevel = 0.03) {
  const key = 'P' + JSON.stringify(points) + depth + bevel;
  return cached(key, () => {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const b = Math.min(bevel, depth * 0.45);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.001, depth - 2 * b),
      bevelEnabled: b > 0,
      bevelThickness: b,
      bevelSize: b,
      bevelOffset: -b,
      bevelSegments: 1,
      curveSegments: 4,
    });
    g.translate(0, 0, -(depth - 2 * b) / 2);
    g.computeVertexNormals();
    return g;
  });
}

/** Profilo simmetrico: si danno solo i punti del lato destro (x >= 0), dall'alto in basso. */
export function symPlate(half, depth = 0.15, bevel = 0.03) {
  const right = half.map(([x, y]) => [x, y]);
  const left = half
    .slice()
    .reverse()
    .map(([x, y]) => [-x, y]);
  return plate([...right, ...left], depth, bevel);
}

export function cyl(rt, rb, h, seg = 14, open = false) {
  return cached(`C${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
}

export function sph(r, ws = 14, hs = 10) {
  return cached(`S${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
}

export function cone(r, h, seg = 8) {
  return cached(`K${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
}

export function torus(r, t, rs = 6, ts = 18, arc = Math.PI * 2) {
  return cached(`T${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
}

export function box(w, h, d) {
  return cached(`B${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
}

export function quad(w, h) {
  return cached(`Q${w},${h}`, () => new THREE.PlaneGeometry(w, h));
}

/** Tubo che segue una curva con raggio variabile (per tubi idraulici e code). */
export function taperTube(points, radii, radial = 8, closed = false) {
  const key = 'U' + JSON.stringify(points) + JSON.stringify(radii) + radial;
  return cached(key, () => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed);
    const segs = Math.max(4, points.length * 4);
    const frames = curve.computeFrenetFrames(segs, closed);
    const pos = [];
    const uv = [];
    const ringAt = (i) => {
      const t = i / segs;
      const p = curve.getPointAt(t);
      const ri = t * (radii.length - 1);
      const i0 = Math.floor(ri);
      const r = radii[Math.min(i0, radii.length - 1)] * (1 - (ri - i0)) + radii[Math.min(i0 + 1, radii.length - 1)] * (ri - i0);
      const N = frames.normals[i];
      const B = frames.binormals[i];
      const pts = [];
      for (let k = 0; k <= radial; k++) {
        const a = (k / radial) * Math.PI * 2;
        pts.push([p.x + r * (Math.cos(a) * N.x + Math.sin(a) * B.x), p.y + r * (Math.cos(a) * N.y + Math.sin(a) * B.y), p.z + r * (Math.cos(a) * N.z + Math.sin(a) * B.z)]);
      }
      return pts;
    };
    let prev = ringAt(0);
    for (let i = 1; i <= segs; i++) {
      const cur = ringAt(i);
      for (let k = 0; k < radial; k++) {
        pos.push(...prev[k], ...prev[k + 1], ...cur[k + 1], ...prev[k], ...cur[k + 1], ...cur[k]);
        uv.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
      }
      prev = cur;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  });
}

// ------------------------------------------------------------------ forme organiche (Kaiju)

/** Media le normali dei vertici coincidenti (toglie le cuciture delle sfere). */
export function smoothSeams(geo) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const map = new Map();
  const keys = [];
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1e3)},${Math.round(pos.getY(i) * 1e3)},${Math.round(pos.getZ(i) * 1e3)}`;
    keys.push(k);
    let a = map.get(k);
    if (!a) map.set(k, (a = [0, 0, 0]));
    a[0] += nor.getX(i);
    a[1] += nor.getY(i);
    a[2] += nor.getZ(i);
  }
  for (let i = 0; i < pos.count; i++) {
    const a = map.get(keys[i]);
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    nor.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
  }
  nor.needsUpdate = true;
  return geo;
}

function hash3(x, y, z) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

function vnoise(x, y, z) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const f = (t) => t * t * (3 - 2 * t);
  const u = f(xf);
  const v = f(yf);
  const w = f(zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return L(
    L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v),
    L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

/**
 * Massa muscolosa: ellissoide deformato da un rumore (gobbe e fasci muscolari).
 * bump = ampiezza, freq = numero di gobbe.
 */
export function blob(rx, ry, rz, { seed = 1, bump = 0.12, freq = 2.2, ws = 22, hs = 16, flatBottom = 0 } = {}) {
  const key = `O${rx},${ry},${rz},${seed},${bump},${freq},${ws},${hs},${flatBottom}`;
  return cached(key, () => {
    const g = new THREE.SphereGeometry(1, ws, hs);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const n = vnoise(x * freq + seed * 7.1, y * freq + seed * 3.3, z * freq - seed * 5.7) * 0.7 + vnoise(x * freq * 2.3 + seed, y * freq * 2.3, z * freq * 2.3) * 0.3;
      let k = 1 + (n - 0.5) * 2 * bump;
      if (flatBottom && y < 0) k *= 1 - flatBottom * (-y) * 0.5;
      p.setXYZ(i, x * rx * k, y * ry * k, z * rz * k);
    }
    g.computeVertexNormals();
    return smoothSeams(g);
  });
}

/** Arto muscoloso lungo -Y: profilo [raggio, y] ruotato attorno all'asse. */
export function limb(profile, seg = 12) {
  const key = 'M' + JSON.stringify(profile) + seg;
  return cached(key, () => {
    // il tornio vuole i punti dal basso verso l'alto (altrimenti le facce guardano dentro)
    const prof = profile[0][1] > profile[profile.length - 1][1] ? [...profile].reverse() : profile;
    const pts = prof.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y));
    const g = new THREE.LatheGeometry(pts, seg);
    g.computeVertexNormals();
    return smoothSeams(g);
  });
}

/** Artiglio / dente ricurvo: cono piegato ad arco nel piano YZ (punta verso -Y, curva verso +Z). */
export function claw(len, r, bend = 0.6, seg = 6) {
  const key = `W${len},${r},${bend},${seg}`;
  return cached(key, () => {
    const n = 6;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = t * bend;
      pts.push([0, -Math.sin(a) / (bend || 1e-3) * len * (bend ? 1 : 0) - (bend ? 0 : t * len), (1 - Math.cos(a)) / (bend || 1) * len]);
    }
    const radii = pts.map((_, i) => r * (1 - i / n) + 0.004);
    return smoothTube(pts, radii, seg);
  });
}

/** Tubo morbido (normali continue) con raggio variabile lungo una curva. */
export function smoothTube(points, radii, radial = 10, { capStart = true } = {}) {
  const key = 'V' + JSON.stringify(points) + JSON.stringify(radii) + radial + capStart;
  return cached(key, () => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const segs = Math.max(6, points.length * 3);
    const frames = curve.computeFrenetFrames(segs, false);
    const pos = [];
    const uv = [];
    const idx = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = curve.getPointAt(t);
      const ri = t * (radii.length - 1);
      const i0 = Math.min(Math.floor(ri), radii.length - 2);
      const f = ri - i0;
      const r = radii[i0] * (1 - f) + radii[i0 + 1] * f;
      const N = frames.normals[i];
      const B = frames.binormals[i];
      for (let k = 0; k <= radial; k++) {
        const a = (k / radial) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        pos.push(p.x + r * (c * N.x + s * B.x), p.y + r * (c * N.y + s * B.y), p.z + r * (c * N.z + s * B.z));
        uv.push(k / radial, t);
      }
    }
    const row = radial + 1;
    for (let i = 0; i < segs; i++)
      for (let k = 0; k < radial; k++) {
        const a = i * row + k;
        const b = a + row;
        idx.push(a, a + 1, b + 1, a, b + 1, b);
      }
    if (capStart) {
      const p0 = curve.getPointAt(0);
      const c = pos.length / 3;
      pos.push(p0.x, p0.y, p0.z);
      uv.push(0.5, 0);
      for (let k = 0; k < radial; k++) idx.push(c, k + 1, k);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return smoothSeams(g);
  });
}
