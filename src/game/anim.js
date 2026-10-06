// Funzioni di supporto per animazioni procedurali.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
export const easeIn = (t) => t * t;
/** Smorzamento esponenziale indipendente dal framerate. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function dampAngle(a, b, lambda, dt) {
  return a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));
}

export function turnTowards(a, b, maxStep) {
  const d = wrapAngle(b - a);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}

/**
 * Interpola tra pose chiave. keys = [[t, posa], ...] con t crescente in 0..1.
 * Ogni posa e' un oggetto { nomeGiunto: valore }.
 */
export function sampleKeys(keys, t, out = {}) {
  if (t <= keys[0][0]) return Object.assign(out, keys[0][1]);
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, p0] = keys[i];
    const [t1, p1] = keys[i + 1];
    if (t <= t1) {
      const k = smooth((t - t0) / Math.max(1e-5, t1 - t0));
      const names = new Set([...Object.keys(p0), ...Object.keys(p1)]);
      for (const n of names) out[n] = lerp(p0[n] ?? 0, p1[n] ?? 0, k);
      return out;
    }
  }
  return Object.assign(out, keys[keys.length - 1][1]);
}

/** Scambia i lati sinistro/destro di una posa (per usare le stesse animazioni con l'altro braccio). */
export function mirrorPose(p) {
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    let name = k;
    if (k.includes('R')) name = k.replace('R', 'L');
    else if (k.includes('L')) name = k.replace('L', 'R');
    const axis = name[name.length - 1].toLowerCase();
    const flip = (axis === 'y' || axis === 'z') && name !== 'hipsY';
    out[name] = flip ? -v : v;
  }
  return out;
}

// Posa di guardia: braccia alzate come un pugile.
export const GUARD = {
  shLx: -0.45, shLy: 0.15, shLz: 0.18, elLx: -1.35,
  shRx: -0.35, shRy: -0.1, shRz: -0.18, elRx: -1.15,
  spineX: 0.06, spineY: 0.12, neckX: 0, neckY: -0.08,
};

// Pose d'attacco definite per il braccio DESTRO; per il sinistro vengono specchiate.
// Ogni attacco ha chiavi per windup (0..1), colpo attivo (0..1) e recupero (0..1).
export const ATTACK_POSES = {
  punch: {
    windup: { shRx: -0.25, shRy: 0.35, shRz: -0.35, elRx: -2.1, spineY: -0.42, spineX: -0.05, hipsY: -0.15 },
    strike: { shRx: -1.58, shRy: 0.1, shRz: 0.0, elRx: -0.08, spineY: 0.48, spineX: 0.18, hipsY: -0.25 },
  },
  heavy: {
    windup: { shRx: -0.1, shRy: 0.5, shRz: -0.5, elRx: -2.3, spineY: -0.65, spineX: -0.15, hipsY: -0.35 },
    strike: { shRx: -1.62, shRy: 0.15, shRz: 0.05, elRx: -0.02, spineY: 0.62, spineX: 0.28, hipsY: -0.4 },
  },
  slash: {
    windup: { shRx: -1.45, shRy: -1.25, shRz: -0.15, elRx: -0.55, spineY: -0.55, spineX: 0.0, hipsY: -0.15 },
    strike: { shRx: -1.35, shRy: 1.0, shRz: 0.0, elRx: -0.2, spineY: 0.6, spineX: 0.15, hipsY: -0.3 },
  },
  smash: {
    windup: { shRx: -2.95, shRy: 0.0, shRz: -0.1, elRx: -0.7, spineY: -0.2, spineX: -0.3, hipsY: 0.1 },
    strike: { shRx: -1.25, shRy: 0.1, shRz: 0.0, elRx: -0.12, spineY: 0.25, spineX: 0.42, hipsY: -0.6 },
  },
  shoot: {
    windup: { shRx: -1.57, shRy: 0.12, shRz: 0, elRx: -0.02, spineY: -0.25, spineX: 0.0, hipsY: -0.1 },
    strike: { shRx: -1.4, shRy: 0.12, shRz: 0, elRx: -0.2, spineY: -0.3, spineX: -0.08, hipsY: -0.12 },
  },
};

export const BLOCK_POSE = {
  shLx: -1.25, shLy: -0.55, shLz: 0.1, elLx: -1.75,
  shRx: -1.35, shRy: 0.55, shRz: -0.1, elRx: -1.65,
  spineX: 0.18, spineY: 0, hipsY: -0.35, neckX: 0.15,
};

export const HIT_POSE = {
  shLx: 0.2, shLz: 0.5, elLx: -0.6, shRx: 0.2, shRz: -0.5, elRx: -0.6,
  spineX: -0.35, spineY: 0.2, neckX: -0.3, hipsY: -0.3,
};

export const SPECIAL_POSES = {
  beam: {
    windup: { shLx: 0.35, shLz: 0.7, elLx: -0.3, shRx: 0.35, shRz: -0.7, elRx: -0.3, spineX: -0.25, neckX: -0.15, hipsY: -0.3 },
    strike: { shLx: 0.5, shLz: 0.85, elLx: -0.2, shRx: 0.5, shRz: -0.85, elRx: -0.2, spineX: -0.35, neckX: -0.2, hipsY: -0.45 },
  },
  missiles: {
    windup: { shLx: -0.9, shLz: 0.5, elLx: -1.4, shRx: -0.9, shRz: -0.5, elRx: -1.4, spineX: 0.15, hipsY: -0.4 },
    strike: { shLx: -0.5, shLz: 0.8, elLx: -1.6, shRx: -0.5, shRz: -0.8, elRx: -1.6, spineX: -0.1, neckX: -0.1, hipsY: -0.5 },
  },
  emp: {
    windup: { shLx: -2.8, shLz: 0.3, elLx: -0.4, shRx: -2.8, shRz: -0.3, elRx: -0.4, spineX: -0.25, hipsY: 0.2 },
    strike: { shLx: -0.9, shLz: 0.2, elLx: -0.1, shRx: -0.9, shRz: -0.2, elRx: -0.1, spineX: 0.7, hipsY: -1.5, hipLx: -1.2, kneeLx: 1.9, ankleLx: -0.6, hipRx: 0.5, kneeRx: 1.4, ankleRx: -0.4 },
  },
  overdrive: {
    windup: { shLx: -0.4, shLz: 0.9, elLx: -1.8, shRx: -0.4, shRz: -0.9, elRx: -1.8, spineX: -0.3, neckX: -0.4, hipsY: -0.2 },
    strike: { shLx: -0.2, shLz: 1.1, elLx: -2.0, shRx: -0.2, shRz: -1.1, elRx: -2.0, spineX: -0.4, neckX: -0.5, hipsY: -0.35 },
  },
};

export const VICTORY_POSE = {
  shRx: -2.95, shRz: -0.2, elRx: -0.35, shLx: -0.2, shLz: 0.5, elLx: -1.6,
  spineX: -0.1, spineY: -0.2, neckX: -0.25, hipsY: 0,
};

export const DEFEAT_POSE = {
  hipsY: -2.6, spineX: 0.9, neckX: 0.6,
  hipLx: -1.5, kneeLx: 2.5, ankleLx: -1.0, hipRx: 0.3, kneeRx: 2.2, ankleRx: 0.3,
  shLx: 0.1, shLz: 0.3, elLx: -0.3, shRx: -0.6, shRz: -0.2, elRx: -0.4,
};

export const POSE_KEYS = [
  'hipsY', 'hipsX', 'spineX', 'spineY', 'spineZ', 'neckX', 'neckY',
  'shLx', 'shLy', 'shLz', 'elLx', 'shRx', 'shRy', 'shRz', 'elRx',
  'hipLx', 'hipLz', 'kneeLx', 'ankleLx', 'hipRx', 'hipRz', 'kneeRx', 'ankleRx',
];
