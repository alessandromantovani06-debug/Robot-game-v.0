// Funzioni di supporto e pose per le animazioni 2D a pezzi articolati.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
/** Smorzamento esponenziale indipendente dal framerate. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export function blendInto(target, pose, w = 1) {
  for (const k in pose) target[k] = lerp(target[k] ?? 0, pose[k], w);
}

/** Converte una posa del braccio anteriore (F) in quella del braccio posteriore (B). */
export function toBackArm(p) {
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === 'armF') out.armB = v;
    else if (k === 'elbF') out.elbB = v;
    else if (k === 'armB') out.armF = v;
    else if (k === 'elbB') out.elbF = v;
    else out[k] = v;
  }
  return out;
}

// Chiavi della posa del Titano (angoli in radianti):
// arm = spalla (positivo = braccio in avanti), elb = gomito (positivo = avambraccio piegato in avanti),
// hip = anca (positivo = gamba in avanti), knee = ginocchio, lean = busto in avanti, crouch = piegamento.
export const POSE_KEYS = ['crouch', 'lean', 'head', 'armF', 'elbF', 'armB', 'elbB', 'hipF', 'kneeF', 'hipB', 'kneeB', 'footF', 'footB', 'bob'];

export const GUARD = { armF: 0.55, elbF: 1.65, armB: 0.35, elbB: 1.55, lean: 0.08, head: 0.02 };
export const RELAXED = { armF: 0.08, elbF: 0.35, armB: 0.04, elbB: 0.3, lean: 0.02, head: 0 };

// Attacchi definiti per il braccio anteriore (F): W = carica, S = colpo
export const ATTACKS = {
  punch: {
    W: { armF: -0.35, elbF: 2.1, lean: -0.12, crouch: 0.15 },
    S: { armF: 1.55, elbF: 0.05, lean: 0.24, crouch: 0.25 },
  },
  heavy: {
    W: { armF: -0.75, elbF: 2.25, lean: -0.28, crouch: 0.3, head: -0.1 },
    S: { armF: 1.6, elbF: 0.0, lean: 0.34, crouch: 0.38 },
  },
  slash: {
    W: { armF: 2.85, elbF: 0.45, lean: -0.18, crouch: 0.1 },
    S: { armF: 0.45, elbF: 0.12, lean: 0.32, crouch: 0.32 },
  },
  smash: {
    W: { armF: 3.15, elbF: 0.7, lean: -0.32, crouch: 0.05 },
    S: { armF: 1.05, elbF: 0.05, lean: 0.48, crouch: 0.6 },
  },
  shoot: {
    W: { armF: 1.57, elbF: 0.02, lean: -0.04 },
    S: { armF: 1.42, elbF: 0.2, lean: -0.14 },
  },
};

export const BLOCK = { armF: 1.25, elbF: 2.1, armB: 1.05, elbB: 2.2, lean: 0.16, crouch: 0.32, head: 0.22 };
export const HIT = { armF: -0.35, elbF: 0.8, armB: -0.45, elbB: 0.7, lean: -0.38, head: -0.3, crouch: 0.22 };
export const DASH = { lean: 0.3, crouch: 0.35, armF: -0.4, elbF: 1.2, armB: -0.5, elbB: 1.1 };

export const SPECIALS = {
  beam: {
    W: { armF: -0.65, elbF: 0.4, armB: -0.75, elbB: 0.4, lean: -0.25, head: -0.2, crouch: 0.2 },
    S: { armF: -0.85, elbF: 0.3, armB: -0.95, elbB: 0.3, lean: -0.38, head: -0.25, crouch: 0.35 },
  },
  missiles: {
    W: { armF: 0.8, elbF: 1.5, armB: 0.7, elbB: 1.5, lean: 0.15, crouch: 0.35 },
    S: { armF: 0.25, elbF: 1.8, armB: 0.15, elbB: 1.8, lean: -0.12, crouch: 0.45, head: -0.15 },
  },
  emp: {
    W: { armF: 2.95, elbF: 0.3, armB: 2.85, elbB: 0.3, lean: -0.25 },
    S: { armF: 0.95, elbF: 0.1, armB: 0.85, elbB: 0.1, lean: 0.75, crouch: 1.4, head: 0.3 },
  },
  overdrive: {
    W: { armF: -0.5, elbF: 2.1, armB: -0.6, elbB: 2.1, lean: -0.3, head: -0.4, crouch: 0.2 },
    S: { armF: -0.7, elbF: 2.3, armB: -0.8, elbB: 2.3, lean: -0.4, head: -0.5, crouch: 0.35 },
  },
};

export const VICTORY = { armF: 2.95, elbF: 0.3, armB: 0.2, elbB: 1.3, lean: -0.08, head: -0.25, crouch: 0 };
export const DEFEAT = { crouch: 1.9, lean: 0.85, head: 0.55, armF: 0.15, elbF: 0.3, armB: 0.05, elbB: 0.2 };
