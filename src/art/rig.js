// Scheletro 2D: calcola le trasformazioni dei pezzi dalla posa e li disegna.
import { drawSprite, glowSprite } from '../engine/sprite.js';
import { BODY } from './robotArt.js';

// Matrici 2D [a, b, c, d, e, f] (stesso formato di ctx.setTransform)
export const M = {
  id: () => [1, 0, 0, 1, 0, 0],
  mul(m, n) {
    return [
      m[0] * n[0] + m[2] * n[1],
      m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3],
      m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4],
      m[1] * n[4] + m[3] * n[5] + m[5],
    ];
  },
  t(m, x, y) {
    return [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  },
  r(m, a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [m[0] * c + m[2] * s, m[1] * c + m[3] * s, -m[0] * s + m[2] * c, -m[1] * s + m[3] * c, m[4], m[5]];
  },
  s(m, sx, sy) {
    return [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]];
  },
  p(m, x, y) {
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  },
};

function put(ctx, base, m, sprite, alpha = 1) {
  const w = M.mul(base, m);
  ctx.setTransform(w[0], w[1], w[2], w[3], w[4], w[5]);
  if (alpha !== 1) {
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * alpha;
    drawSprite(ctx, sprite);
    ctx.globalAlpha = a;
  } else drawSprite(ctx, sprite);
}

/** Altezza del bacino data dalla gamba piu' distesa (cosi' i piedi toccano terra). */
function legHeight(leg, hip, knee) {
  return leg.thigh * Math.cos(hip) + leg.shin * Math.cos(knee - hip) + BODY.footH;
}

/**
 * Calcola le matrici locali (unita' del robot, y verso il basso, origine ai piedi).
 * pose: { crouch, lean, head, armF, elbF, armB, elbB, hipF, kneeF, hipB, kneeB, footF, footB, bob, lift }
 */
export function solveRobot(art, p) {
  const leg = art.leg;
  const c = p.crouch || 0;
  const hipF = p.hipF + c * 0.55;
  const kneeF = p.kneeF + c * 1.05;
  const hipB = p.hipB + c * 0.4;
  const kneeB = p.kneeB + c * 0.95;
  const h = Math.max(legHeight(leg, hipF, kneeF), legHeight(leg, hipB, kneeB)) + 0.26;
  const tilt = (p.lean || 0) * 0.18;
  const J = {};
  const root = M.t(M.id(), 0, -(p.lift || 0));
  J.pelvis = M.r(M.t(root, 0, -h + (p.bob || 0)), tilt);
  // busto massiccio, come gli Jaeger
  J.torso = M.s(M.r(M.t(J.pelvis, BODY.waist[0], BODY.waist[1]), p.lean || 0), 1.12, 1.1);
  J.head = M.r(M.t(J.torso, BODY.neck[0], BODY.neck[1]), p.head || 0);
  const arm = (sh, a, e) => {
    const s = M.t(J.torso, sh[0], sh[1]);
    const upper = M.r(s, -a);
    const fore = M.r(M.t(upper, 0, BODY.upper), -e);
    const pad = M.r(s, -a * 0.18 - 0.05);
    return { upper, fore, pad };
  };
  const F = arm(BODY.shoulderF, p.armF, p.elbF);
  const B = arm(BODY.shoulderB, p.armB, p.elbB);
  const legs = (hp, hip, knee, footTilt) => {
    const thigh = M.r(M.t(J.pelvis, hp[0], hp[1]), -hip);
    const shin = M.r(M.t(thigh, 0, leg.thigh), knee);
    const foot = M.r(M.t(shin, 0, leg.shin), -(tilt - hip + knee) + (footTilt || 0));
    return { thigh, shin, foot };
  };
  const LF = legs(BODY.hipF, hipF, kneeF, p.footF);
  const LB = legs(BODY.hipB, hipB, kneeB, p.footB);
  J.upperF = F.upper;
  J.foreF = F.fore;
  J.padF = F.pad;
  J.upperB = B.upper;
  J.foreB = B.fore;
  J.padB = B.pad;
  J.thighF = LF.thigh;
  J.shinF = LF.shin;
  J.footF = LF.foot;
  J.thighB = LB.thigh;
  J.shinB = LB.shin;
  J.footB = LB.foot;
  return J;
}

const ORDER = ['foreB', 'upperB', 'padB', 'thighB', 'footB', 'shinB', 'pelvis', 'torso', 'head', 'thighF', 'footF', 'shinF', 'foreF', 'upperF', 'padF'];

// Lampo quando si viene colpiti: la sagoma intera viene schiarita una volta sola su un
// livello a parte (pezzi bianchi semitrasparenti sovrapposti accumulerebbero il bianco).
let tintLayer = null;
function withTint(ctx, amount, color, draw) {
  if (!(amount > 0.02) || typeof document === 'undefined') {
    draw(ctx);
    return;
  }
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  if (!tintLayer) tintLayer = document.createElement('canvas');
  if (tintLayer.width !== cw || tintLayer.height !== ch) {
    tintLayer.width = cw;
    tintLayer.height = ch;
  }
  const t = tintLayer.getContext('2d');
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalAlpha = 1;
  t.globalCompositeOperation = 'source-over';
  t.clearRect(0, 0, cw, ch);
  draw(t);
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.globalCompositeOperation = 'source-atop';
  t.globalAlpha = Math.min(1, amount);
  t.fillStyle = color;
  t.fillRect(0, 0, cw, ch);
  t.globalCompositeOperation = 'source-over';
  t.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(tintLayer, 0, 0);
}

/**
 * Disegna il robot. base = matrice dal sistema del robot allo schermo.
 * fx: { flash, glow, thrustF, thrustB, thrustLeg, alpha }
 */
export function drawRobot(ctx, art, J, base, fx = {}) {
  const sp = art.sprites;
  const alpha = fx.alpha ?? 1;
  const mirrored = base[0] < 0;
  withTint(ctx, (fx.flash || 0) * 0.45, '#ffe6d0', (c) => {
    c.globalAlpha = alpha;
    const flame = (m, pts, sprite, len, ang) => {
      c.globalCompositeOperation = 'lighter';
      for (const [x, y] of pts) {
        const fm = M.r(M.t(m, x, y), ang);
        put(c, base, M.s(fm, 1, len), sprite, 0.9);
      }
      c.globalCompositeOperation = 'source-over';
    };
    c.globalCompositeOperation = 'source-over';
    for (const k of ORDER) {
      put(c, base, J[k], k === 'padF' && mirrored ? sp.padFm : sp[k]);
      if (k === 'foreB' && fx.thrustB && art.info.L?.flame) flame(J.foreB, art.info.L.flame, sp.flameArm, 0.8 + Math.random() * 0.4, Math.PI + 0.4);
      if (k === 'foreF' && fx.thrustF && art.info.R?.flame) flame(J.foreF, art.info.R.flame, sp.flameArm, 0.8 + Math.random() * 0.4, Math.PI + 0.4);
      if ((k === 'shinF' || k === 'shinB') && fx.thrustLeg && art.flames.leg) flame(J[k], [[-0.8, 1.97]], sp.flameLeg, 0.8 + Math.random() * 0.4, 0.5);
    }
  });
  ctx.globalAlpha = alpha;
  // bagliore del nucleo e del visore
  if (fx.glow > 0) {
    ctx.globalCompositeOperation = 'lighter';
    const g = glowSprite(art.accent);
    const core = M.t(J.torso, art.core[0], art.core[1]);
    const s = 1.4 + fx.glow * 0.5;
    put(ctx, base, M.s(core, s, s), { canvas: g, ox: -0.5, oy: -0.5, w: 1, h: 1 }, Math.min(1, fx.glow * 0.45 * art.glowScale));
    const visor = M.t(J.head, art.visor[0], art.visor[1]);
    put(ctx, base, M.s(visor, 0.9, 0.6), { canvas: g, ox: -0.5, oy: -0.5, w: 1, h: 1 }, Math.min(1, 0.35 * art.glowScale));
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

/** Punto nel sistema locale di un pezzo → coordinate del robot. */
export function jointPoint(J, part, x = 0, y = 0) {
  return M.p(J[part], x, y);
}

// ===================================================================== KAIJU

function kLegH(L, hip, knee) {
  return L.thigh * Math.cos(hip) + L.shin * Math.cos(knee - hip) + L.footH;
}

/**
 * Pose del Kaiju: { crouch, lean, neck, jaw, armF, elbF, armB, elbB, legs: {fF:[h,k], ...} o hipF/kneeF..., tail: [angoli], lift, pinch }
 */
export function solveKaiju(art, p) {
  const L = art.L;
  const lay = art.layout;
  const J = {};
  const c = p.crouch || 0;
  const root = M.t(M.id(), 0, -(p.lift || 0));
  const tailAngles = p.tail || [];
  const chainTail = (parent) => {
    const segs = art.sprites.tail;
    let m = M.r(M.t(parent, lay.tail[0], lay.tail[1]), tailAngles[0] || 0);
    const out = [m];
    for (let i = 1; i < segs.length; i++) {
      m = M.r(M.t(m, -segs[i - 1].len, 0), tailAngles[i] || 0);
      out.push(m);
    }
    return out;
  };
  const leg = (parent, pos, hip, knee) => {
    const thigh = M.r(M.t(parent, pos[0], pos[1]), -hip);
    const shin = M.r(M.t(thigh, 0, L.thigh), knee);
    const foot = M.r(M.t(shin, 0, L.shin), -(knee - hip));
    return { thigh, shin, foot };
  };
  if (art.form === 'biped') {
    const r = art.rest;
    const hipF = r.hipF + (p.hipF || 0) + c * 0.35;
    const kneeF = r.kneeF + (p.kneeF || 0) + c * 0.8;
    const hipB = r.hipB + (p.hipB || 0) + c * 0.35;
    const kneeB = r.kneeB + (p.kneeB || 0) + c * 0.8;
    const h = Math.max(kLegH(L, hipF, kneeF), kLegH(L, hipB, kneeB)) + 0.2;
    J.hips = M.t(root, 0, -h);
    J.body = M.r(J.hips, p.lean || 0);
    J.legF = leg(J.hips, lay.hipF, hipF, kneeF);
    J.legB = leg(J.hips, lay.hipB, hipB, kneeB);
    J.tail = chainTail(J.hips);
  } else {
    const r = art.rest;
    const lg = p.legs || {};
    const get = (k) => [r.hip + (lg[k]?.[0] || 0) + c * 0.3, r.knee + (lg[k]?.[1] || 0) + c * 0.7];
    const fF = get('fF');
    const fB = get('fB');
    const bF = get('bF');
    const bB = get('bB');
    const hips = lay.hips;
    const hFront = Math.max(kLegH(L, ...fF), kLegH(L, ...fB)) + hips.fF[1];
    const hBack = Math.max(kLegH(L, ...bF), kLegH(L, ...bB)) + hips.bF[1];
    const span = hips.fF[0] - hips.bF[0];
    const pitch = -Math.atan2(hFront - hBack, span);
    J.body = M.r(M.t(root, 0, -(hFront + hBack) / 2), pitch + (p.lean || 0));
    J.hips = J.body;
    J.legs = {
      fF: leg(J.body, hips.fF, ...fF),
      fB: leg(J.body, hips.fB, ...fB),
      bF: leg(J.body, hips.bF, ...bF),
      bB: leg(J.body, hips.bB, ...bB),
    };
    J.tail = chainTail(J.body);
  }
  J.head = M.r(M.t(J.body, lay.neck[0], lay.neck[1]), p.neck || 0);
  J.jaw = M.r(M.t(J.head, lay.jaw[0], lay.jaw[1]), p.jaw || 0);
  const arm = (sh, a, e) => {
    const upper = M.r(M.t(J.body, sh[0], sh[1]), -a);
    const fore = M.r(M.t(upper, 0, L.upper), -e);
    const pinch = M.r(M.t(fore, -0.35, L.fore + 0.15), p.pinch || 0);
    return { upper, fore, pinch };
  };
  if (art.sprites.upperF) {
    J.armF = arm(lay.shoulderF, p.armF || 0, p.elbF || 0);
    J.armB = arm(lay.shoulderB, p.armB || 0, p.elbB || 0);
  }
  return J;
}

/** Disegna il Kaiju. fx: { flash, aura, alpha } */
export function drawKaiju(ctx, art, J, base, fx = {}) {
  const sp = art.sprites;
  const pass = (c, S, alpha = 1) => {
    const legDraw = (lg, back) => {
      put(c, base, lg.thigh, back ? S.thighB : S.thighF, alpha);
      put(c, base, lg.foot, back ? S.footB : S.footF, alpha);
      put(c, base, lg.shin, back ? S.shinB : S.shinF, alpha);
    };
    const armDraw = (a, back) => {
      put(c, base, a.fore, back ? S.foreB : S.foreF, alpha);
      if (S.pinch) put(c, base, a.pinch, back ? S.pinchB || S.pinch : S.pinch, alpha);
      put(c, base, a.upper, back ? S.upperB : S.upperF, alpha);
    };
    if (art.form === 'biped') {
      if (J.armB) armDraw(J.armB, true);
      legDraw(J.legB, true);
    } else {
      legDraw(J.legs.fB, true);
      legDraw(J.legs.bB, true);
      if (J.armB) armDraw(J.armB, true);
    }
    for (let i = J.tail.length - 1; i >= 0; i--) put(c, base, J.tail[i], S.tail[i].sprite, alpha);
    put(c, base, J.body, S.body, alpha);
    if (art.form === 'biped') legDraw(J.legF, false);
    else {
      legDraw(J.legs.bF, false);
      legDraw(J.legs.fF, false);
    }
    put(c, base, J.jaw, S.jaw, alpha);
    put(c, base, J.head, S.head, alpha);
    if (J.armF) armDraw(J.armF, false);
  };
  const a0 = fx.alpha ?? 1;
  withTint(ctx, (fx.flash || 0) * 0.6, '#ffffff', (c) => {
    c.globalAlpha = a0;
    pass(c, sp, 1);
  });
  ctx.globalAlpha = a0;
  if (fx.aura > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    const g = glowSprite(art.glow);
    const s = 7;
    put(ctx, base, M.s(M.t(J.body, 0.8, -1.4), s, s * 0.8), { canvas: g, ox: -0.5, oy: -0.5, w: 1, h: 1 }, Math.min(1, fx.aura * 0.55));
    const eye = M.t(J.head, art.layout.head[0] * 0.48, -0.35);
    put(ctx, base, M.s(eye, 1.4, 1.0), { canvas: g, ox: -0.5, oy: -0.5, w: 1, h: 1 }, Math.min(1, 0.3 + fx.aura * 0.6));
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}
