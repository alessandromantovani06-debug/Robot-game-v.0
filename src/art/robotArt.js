// Disegno 2D dettagliato dei Titani, pezzo per pezzo (vista laterale 3/4, rivolti a destra).
// Coordinate in unita' di gioco, asse y verso il basso, perno di ogni pezzo nell'origine.
import { makeSprite, tintSprite } from '../engine/sprite.js';
import { shade, rgba, luminance } from '../engine/color.js';
import {
  plate, seam, bolt, bolts, boltLine, vents, cylinder, joint, glow, light, glowShape, hose, hazard, stencil, liveryFn, path, rect,
} from '../engine/paint.js';
import { FINISHES, PARTS, getPart } from '../data/parts.js';

const FRAME = '#59616d';
const DARK = '#1c1f25';

// Dimensioni dello scheletro
export const BODY = {
  waist: [0, -0.45],
  neck: [0.2, -3.2],
  shoulderF: [-0.18, -2.62],
  shoulderB: [-0.62, -2.74],
  hipF: [0.18, 0.28],
  hipB: [-0.22, 0.22],
  upper: 1.9,
  fore: 2.0,
  footH: 0.48,
};

const LEGS = {
  lg_std: { thigh: 2.0, shin: 2.0, rest: { hipF: 0.22, kneeF: 0.32, hipB: -0.3, kneeB: 0.22 } },
  lg_heavy: { thigh: 2.0, shin: 1.95, rest: { hipF: 0.2, kneeF: 0.28, hipB: -0.28, kneeB: 0.2 } },
  lg_digi: { thigh: 2.15, shin: 2.35, rest: { hipF: 0.62, kneeF: 1.25, hipB: 0.3, kneeB: 1.15 } },
  lg_thrust: { thigh: 2.0, shin: 2.0, rest: { hipF: 0.22, kneeF: 0.32, hipB: -0.3, kneeB: 0.22 } },
};

function palette(cfg) {
  const fin = FINISHES.find((f) => f.id === cfg.finish) || FINISHES[0];
  const spec = fin.id === 'metal' ? 0.75 : fin.id === 'satin' ? 0.4 : 0.1;
  const { primary, secondary, accent } = cfg.colors;
  const liv = liveryFn(cfg.pattern, secondary, 7);
  return {
    P: primary,
    S2: secondary,
    A: accent,
    spec,
    wear: fin.id === 'matte' ? 0.8 : 0.6,
    // corazza principale con livrea
    p: (o = {}) => ({ spec, livery: liv ? (ctx, bb) => bb.w * bb.h > 0.55 && liv(ctx, bb) : null, ...o }),
    s: (o = {}) => ({ spec: spec * 0.8, ...o }),
    f: (o = {}) => ({ spec: spec * 0.5, wear: 0.4, light: 0.1, dark: 0.2, ...o }),
  };
}

// ---------------------------------------------------------------- BACINO
function drawPelvis(ctx, C) {
  plate(ctx, [[-1.25, -0.3], [-0.4, -0.25], [-0.55, 0.72], [-1.05, 0.62]], shade(C.P, -0.08), C.p());
  plate(ctx, [[-0.85, -0.55], [0.9, -0.55], [0.95, 0.45], [-0.8, 0.5]], FRAME, C.f({ r: 0.15 }));
  vents(ctx, -0.6, -0.15, 0.7, 0.45, 4);
  plate(ctx, [[-0.3, -0.1], [0.5, -0.1], [0.35, 0.88], [-0.15, 0.92]], C.S2, C.s());
  joint(ctx, 0.05, 0.18, 0.3, FRAME, { bolts: 6 });
  plate(ctx, [[0.32, -0.25], [1.28, -0.32], [1.12, 0.78], [0.55, 0.98]], C.P, C.p({ r: 0.12 }));
  seam(ctx, [[0.45, 0.25], [1.18, 0.2]]);
  bolts(ctx, [[0.55, -0.12], [1.08, -0.15], [0.68, 0.8], [1.0, 0.65]]);
  plate(ctx, [[-1.08, -0.65], [1.12, -0.62], [1.06, -0.22], [-1.02, -0.25]], C.S2, C.s({ r: 0.06 }));
  boltLine(ctx, -0.85, -0.43, 0.9, -0.42, 7, 0.035);
}

// ---------------------------------------------------------------- TORSI
function abdomen(ctx, C) {
  cylinder(ctx, 0.62, 0.05, 0.92, -1.2, 0.09, FRAME, { rod: 0.35 });
  cylinder(ctx, -0.62, 0.05, -0.9, -1.2, 0.09, FRAME, { rod: 0.35 });
  for (let i = 0; i < 3; i++) {
    const y = -i * 0.4;
    const w = 0.72 + i * 0.05;
    plate(ctx, [[-w, y + 0.08], [w + 0.05, y + 0.08], [w + 0.1, y - 0.36], [-w - 0.05, y - 0.36]], i % 2 ? DARK : FRAME, C.f({ r: 0.1 }));
    seam(ctx, [[-w + 0.1, y - 0.14], [w, y - 0.14]], 0.7);
  }
  hose(ctx, [[0.3, -0.1], [0.85, -0.5], [0.55, -1.15]], 0.09);
}

function collar(ctx, C, y = -3.15) {
  plate(ctx, [[-0.8, y], [0.98, y + 0.05], [0.78, y - 0.42], [-0.58, y - 0.46]], FRAME, C.f({ r: 0.1 }));
  hazard(ctx, [[-0.55, y - 0.12], [0.75, y - 0.1], [0.68, y - 0.26], [-0.5, y - 0.28]], 0.12);
}

function coreFission(ctx, C, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(0.62, 1);
  joint(ctx, 0, 0, 0.62, '#2b3038', { bolts: 10 });
  glow(ctx, C.A, 0.6, () => {
    const g = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 0.44);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, C.A);
    g.addColorStop(1, shade(C.A, -0.25));
    ctx.beginPath();
    ctx.arc(0, 0, 0.44, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  });
  // pale della turbina
  ctx.fillStyle = 'rgba(10,14,20,0.75)';
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((i / 6) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0.05, -0.03);
    ctx.quadraticCurveTo(0.25, -0.12, 0.42, -0.02);
    ctx.lineTo(0.4, 0.05);
    ctx.quadraticCurveTo(0.22, -0.02, 0.05, 0.04);
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 0.09, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

function backpackVents(ctx, C, pts) {
  const bb = plate(ctx, pts, C.S2, C.s({ r: 0.15 }));
  vents(ctx, bb.x0 + 0.2, bb.y0 + 0.35, bb.w * 0.45, bb.h * 0.55, 6, { vertical: false });
  for (let i = 0; i < 3; i++) {
    plate(ctx, rect(bb.x0 - 0.18, bb.y0 + 0.4 + i * 0.45, 0.35, 0.22), FRAME, C.f({ r: 0.05 }));
  }
  glowShape(ctx, rect(bb.x0 + bb.w * 0.62, bb.y0 + 0.4, 0.08, bb.h * 0.5), C.A, { blur: 0.2 });
  return bb;
}

function drawTorso(ctx, C, id) {
  abdomen(ctx, C);
  switch (id) {
    case 'tr_plasma': {
      // serbatoi di plasma sulla schiena
      for (const [x, h] of [[-1.75, 1.9], [-1.35, 1.7]]) {
        cylinder(ctx, x, -1.15, x, -1.15 - h, 0.26, C.S2, { rings: 3 });
        glowShape(ctx, rect(x - 0.08, -1.35 - h * 0.7, 0.16, h * 0.5), C.A, { blur: 0.3 });
      }
      plate(ctx, [[-1.3, -1.0], [1.1, -0.95], [1.55, -1.7], [1.35, -2.75], [0.85, -3.2], [-0.9, -3.25], [-1.4, -2.55]], C.P, C.p({ r: 0.16 }));
      plate(ctx, [[0.05, -1.1], [1.15, -1.0], [1.58, -1.72], [0.9, -2.0], [0.2, -1.8]], C.S2, C.s());
      plate(ctx, [[0.1, -2.15], [0.95, -2.2], [1.38, -2.75], [0.85, -3.15], [0.15, -3.0]], C.S2, C.s());
      // nucleo triangolare
      glowShape(ctx, [[0.78, -1.65], [1.35, -1.78], [1.12, -2.45]], C.A, { blur: 0.55, r: 0.05 });
      plate(ctx, [[0.62, -1.55], [1.5, -1.7], [1.55, -1.82], [0.7, -1.68]], FRAME, C.f({ r: 0.02 }));
      seam(ctx, [[-1.2, -2.0], [0.1, -2.05]]);
      seam(ctx, [[-0.9, -1.25], [-0.75, -3.05]]);
      bolts(ctx, [[-1.1, -1.25], [-1.15, -2.4], [0.0, -2.95], [-0.5, -1.25]]);
      collar(ctx, C);
      break;
    }
    case 'tr_tesla': {
      // bobine di Tesla
      for (const [x, h] of [[-1.55, 2.6], [-1.05, 2.3]]) {
        cylinder(ctx, x, -1.4, x, -1.4 - h, 0.17, FRAME, {});
        for (let i = 0; i < 4; i++) {
          const y = -1.7 - i * (h / 4.6);
          glow(ctx, C.A, 0.25, () => {
            ctx.beginPath();
            ctx.ellipse(x, y, 0.3, 0.09, 0, 0, Math.PI * 2);
            ctx.strokeStyle = C.A;
            ctx.lineWidth = 0.06;
            ctx.stroke();
          });
        }
        light(ctx, x, -1.45 - h, 0.13, C.A);
      }
      plate(ctx, [[-1.35, -1.0], [1.15, -0.95], [1.65, -1.6], [1.6, -2.55], [1.05, -3.2], [-0.95, -3.28], [-1.5, -2.6]], C.P, C.p({ r: 0.5 }));
      plate(ctx, [[0.2, -1.1], [1.25, -1.05], [1.62, -1.62], [1.55, -2.5], [1.0, -2.95], [0.35, -2.75]], C.S2, C.s({ r: 0.4 }));
      // nucleo sferico con anelli orbitanti
      glow(ctx, C.A, 0.7, () => {
        const g = ctx.createRadialGradient(1.05, -2.05, 0.03, 1.05, -2.0, 0.36);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.5, C.A);
        g.addColorStop(1, shade(C.A, -0.3));
        ctx.beginPath();
        ctx.ellipse(1.05, -2.0, 0.26, 0.36, 0, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
      });
      for (const a of [0.5, -0.5]) {
        ctx.beginPath();
        ctx.ellipse(1.05, -2.0, 0.22, 0.55, a, 0, Math.PI * 2);
        ctx.lineWidth = 0.05;
        ctx.strokeStyle = shade(C.S2, -0.1);
        ctx.stroke();
      }
      seam(ctx, [[-1.25, -2.0], [0.25, -2.05]]);
      bolts(ctx, [[-1.0, -1.3], [-1.2, -2.5], [-0.2, -3.0], [0.4, -1.3]]);
      collar(ctx, C);
      break;
    }
    case 'tr_berserk': {
      // camini di scarico
      for (let i = 0; i < 3; i++) {
        const x = -1.25 - i * 0.32;
        cylinder(ctx, x, -1.6, x - 0.55, -3.7 + i * 0.25, 0.15, DARK, { rings: 2 });
        glow(ctx, '#ff7a2a', 0.35, () => {
          ctx.beginPath();
          ctx.ellipse(x - 0.55, -3.7 + i * 0.25, 0.14, 0.07, -0.25, 0, Math.PI * 2);
          ctx.fillStyle = '#ffb060';
          ctx.fill();
        });
      }
      plate(ctx, [[-1.55, -0.95], [1.3, -0.9], [1.8, -1.55], [1.75, -2.8], [1.15, -3.45], [-1.1, -3.5], [-1.7, -2.75]], C.P, C.p({ r: 0.2 }));
      plate(ctx, [[0.0, -1.0], [1.35, -0.95], [1.82, -1.58], [1.78, -2.35], [0.3, -2.4]], C.S2, C.s());
      plate(ctx, [[-0.2, -2.45], [1.7, -2.45], [1.65, -2.85], [1.1, -3.38], [-0.3, -3.3]], C.S2, C.s());
      // griglia luminosa
      for (let i = 0; i < 3; i++) glowShape(ctx, rect(0.55, -1.35 - i * 0.28, 1.0, 0.11), C.A, { blur: 0.35 });
      seam(ctx, [[-1.4, -1.9], [-0.05, -1.95]]);
      boltLine(ctx, -1.3, -1.15, -1.35, -3.1, 6, 0.045);
      collar(ctx, C, -3.35);
      break;
    }
    default: {
      // tr_fission: zaino reattore
      backpackVents(ctx, C, [[-1.2, -1.1], [-2.15, -1.3], [-2.3, -2.95], [-1.3, -3.2]]);
      plate(ctx, [[-1.35, -1.0], [1.15, -0.95], [1.62, -1.55], [1.55, -2.65], [1.0, -3.25], [-0.95, -3.3], [-1.45, -2.65]], C.P, C.p({ r: 0.18 }));
      plate(ctx, [[0.22, -1.1], [1.2, -1.02], [1.6, -1.58], [1.5, -2.55], [0.95, -2.95], [0.4, -2.75]], C.S2, C.s());
      coreFission(ctx, C, 1.02, -2.0);
      seam(ctx, [[-1.25, -2.05], [0.2, -2.1]]);
      seam(ctx, [[-0.55, -1.05], [-0.5, -3.2]]);
      vents(ctx, -1.15, -1.3, 0.5, 0.55, 4);
      bolts(ctx, [[-1.2, -2.3], [-0.2, -3.05], [0.35, -1.25], [-0.15, -1.25]]);
      light(ctx, -1.25, -2.85, 0.05, '#ff3030');
      collar(ctx, C);
    }
  }
}

// ---------------------------------------------------------------- TESTE
function neck(ctx, C) {
  cylinder(ctx, 0, 0.15, 0, -0.42, 0.26, FRAME, { rings: 2 });
  hose(ctx, [[-0.25, 0.1], [-0.45, -0.15], [-0.2, -0.45]], 0.07);
}

function drawHead(ctx, C, id) {
  neck(ctx, C);
  switch (id) {
    case 'hd_dome': {
      plate(ctx, [[-0.6, -0.35], [0.65, -0.4], [0.75, -0.75], [-0.65, -0.72]], FRAME, C.f({ r: 0.1 }));
      // cupola di vetro con i due piloti
      glow(ctx, C.A, 0.3, () => {
        ctx.beginPath();
        ctx.ellipse(0.08, -1.05, 0.72, 0.6, 0, Math.PI, 0);
        ctx.closePath();
        const g = ctx.createRadialGradient(-0.1, -1.3, 0.05, 0.08, -1.0, 0.8);
        g.addColorStop(0, rgba('#ffffff', 0.75));
        g.addColorStop(0.3, rgba(C.A, 0.55));
        g.addColorStop(1, rgba(shade(C.A, -0.4), 0.85));
        ctx.fillStyle = g;
        ctx.fill();
      });
      ctx.fillStyle = 'rgba(5,10,18,0.75)';
      for (const x of [-0.2, 0.3]) {
        ctx.beginPath();
        ctx.arc(x, -1.08, 0.11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - 0.12, -0.97, 0.24, 0.24);
      }
      ctx.beginPath();
      ctx.ellipse(0.08, -1.05, 0.72, 0.6, 0, Math.PI, 0);
      ctx.lineWidth = 0.05;
      ctx.strokeStyle = '#06080b';
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-0.12, -1.3, 0.25, 0.1, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();
      plate(ctx, [[-0.75, -0.72], [0.82, -0.75], [0.8, -0.55], [-0.72, -0.52]], C.P, C.p({ r: 0.06 }));
      joint(ctx, -0.55, -0.68, 0.18, FRAME, { bolts: 4 });
      cylinder(ctx, 0.7, -0.62, 1.0, -0.66, 0.06, FRAME, {});
      break;
    }
    case 'hd_crest': {
      plate(ctx, [[-0.55, -0.32], [0.55, -0.38], [0.85, -0.68], [0.72, -1.2], [0.15, -1.38], [-0.5, -1.3], [-0.7, -0.8]], C.P, C.p({ r: 0.1 }));
      plate(ctx, [[0.3, -0.4], [0.88, -0.6], [0.9, -0.82], [0.4, -0.78]], FRAME, C.f({ r: 0.03 }));
      for (let i = 0; i < 3; i++) seam(ctx, [[0.45, -0.48 - i * 0.1], [0.85, -0.6 - i * 0.07]], 0.8);
      glowShape(ctx, [[0.42, -0.95], [0.86, -0.9], [0.82, -1.02], [0.42, -1.03]], C.A, { blur: 0.35 });
      // cresta a V
      plate(ctx, [[0.05, -1.25], [0.3, -1.32], [1.05, -2.25], [0.85, -2.3]], C.S2, C.s({ r: 0.03, light: 0.25 }));
      plate(ctx, [[-0.25, -1.2], [0.05, -1.3], [-0.2, -2.35], [-0.38, -2.25]], shade(C.S2, -0.12), C.s({ r: 0.03 }));
      plate(ctx, [[-0.1, -1.18], [0.3, -1.2], [0.25, -1.45], [-0.05, -1.48]], C.A, { spec: 0.3, wear: 0 });
      plate(ctx, [[-0.75, -0.95], [-0.3, -0.95], [-0.35, -0.3], [-0.85, -0.5]], C.S2, C.s({ r: 0.05 }));
      bolts(ctx, [[-0.55, -0.85], [-0.6, -0.45]]);
      break;
    }
    case 'hd_tri': {
      plate(ctx, [[-0.6, -0.3], [0.65, -0.32], [0.82, -0.55], [0.8, -1.22], [-0.55, -1.3], [-0.72, -1.0]], C.P, C.p({ r: 0.14 }));
      plate(ctx, [[-0.65, -1.15], [0.92, -1.2], [0.95, -1.42], [-0.6, -1.45]], C.S2, C.s({ r: 0.06 }));
      for (const [x, y, r] of [[0.62, -0.95, 0.15], [0.62, -0.6, 0.11], [0.3, -0.82, 0.1]]) {
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.75 + 0.05, r + 0.05, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#0d1015';
        ctx.fill();
        glow(ctx, C.A, 0.35, () => {
          ctx.beginPath();
          ctx.ellipse(x, y, r * 0.75, r, 0, 0, Math.PI * 2);
          const g = ctx.createRadialGradient(x - 0.03, y - 0.03, 0.01, x, y, r);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.5, C.A);
          g.addColorStop(1, shade(C.A, -0.3));
          ctx.fillStyle = g;
          ctx.fill();
        });
      }
      vents(ctx, -0.45, -0.95, 0.5, 0.4, 3);
      cylinder(ctx, -0.35, -1.42, -0.55, -1.9, 0.04, FRAME, {});
      light(ctx, -0.56, -1.92, 0.05, '#ff3030');
      break;
    }
    case 'hd_hunter': {
      plate(ctx, [[-0.6, -0.3], [0.5, -0.35], [1.35, -0.6], [1.25, -0.78], [0.55, -1.15], [-0.4, -1.25], [-0.75, -0.85]], C.P, C.p({ r: 0.1 }));
      plate(ctx, [[0.35, -0.38], [1.32, -0.6], [1.0, -0.42], [0.45, -0.25]], C.S2, C.s({ r: 0.04 }));
      glowShape(ctx, [[0.45, -0.82], [1.05, -0.72], [1.0, -0.8], [0.48, -0.92]], C.A, { blur: 0.35 });
      plate(ctx, [[-0.45, -1.15], [0.0, -1.2], [-0.6, -1.8], [-0.8, -1.65]], C.S2, C.s({ r: 0.03 }));
      plate(ctx, [[-0.7, -0.75], [-0.35, -0.8], [-1.0, -1.3], [-1.12, -1.15]], shade(C.S2, -0.1), C.s({ r: 0.03 }));
      seam(ctx, [[-0.2, -0.4], [0.1, -1.1]]);
      bolts(ctx, [[-0.4, -0.5], [-0.5, -0.95]]);
      break;
    }
    default: {
      // hd_visor
      plate(ctx, [[-0.55, -0.32], [0.48, -0.38], [0.78, -0.62], [0.74, -1.2], [0.22, -1.48], [-0.45, -1.42], [-0.72, -0.98]], C.P, C.p({ r: 0.15 }));
      plate(ctx, [[0.35, -0.42], [0.82, -0.58], [0.86, -0.92], [0.5, -0.92]], C.S2, C.s({ r: 0.05 }));
      for (let i = 0; i < 3; i++) seam(ctx, [[0.5, -0.55 - i * 0.11], [0.82, -0.62 - i * 0.1]], 0.7);
      plate(ctx, [[0.2, -0.97], [0.9, -0.95], [0.86, -1.18], [0.2, -1.22]], '#0b0e13', { spec: 0.9, wear: 0, r: 0.04 });
      glowShape(ctx, [[0.28, -1.03], [0.86, -1.01], [0.83, -1.12], [0.28, -1.15]], C.A, { blur: 0.4 });
      joint(ctx, -0.18, -0.85, 0.24, FRAME, { bolts: 5 });
      plate(ctx, [[-0.32, -1.38], [0.12, -1.48], [-0.42, -1.92], [-0.62, -1.68]], C.S2, C.s({ r: 0.04 }));
    }
  }
}

// ---------------------------------------------------------------- SPALLE
function drawShoulder(ctx, C, id, code, mirror = false) {
  const pad = (pts, color = C.P, o) => plate(ctx, pts, color, o || C.p({ r: 0.22 }));
  let decalAt = [0.0, 0.05, 0.38];
  switch (id) {
    case 'sh_plate': {
      pad([[-1.05, -0.75], [0.85, -0.85], [1.15, 0.0], [0.9, 0.65], [-0.95, 0.72], [-1.2, 0.0]]);
      plate(ctx, [[-1.0, 0.35], [0.95, 0.3], [0.85, 0.85], [-0.9, 0.9]], C.S2, C.s({ r: 0.12 }));
      plate(ctx, [[-0.9, 0.75], [0.8, 0.7], [0.7, 1.12], [-0.8, 1.15]], C.P, C.p({ r: 0.1 }));
      plate(ctx, [[-0.6, -0.8], [-0.2, -0.85], [-0.75, -1.5], [-0.95, -1.35]], C.S2, C.s({ r: 0.04 }));
      boltLine(ctx, -0.8, 0.5, 0.75, 0.47, 6, 0.04);
      decalAt = [0.0, -0.2, 0.42];
      break;
    }
    case 'sh_vents': {
      pad([[-0.9, -0.55], [0.7, -0.65], [0.95, 0.1], [0.75, 0.55], [-0.75, 0.6], [-0.95, 0.0]]);
      // turbina
      ctx.save();
      ctx.translate(-0.05, -0.75);
      ctx.scale(1, 0.45);
      joint(ctx, 0, 0, 0.6, FRAME, { bolts: 8 });
      glow(ctx, C.A, 0.4, () => {
        ctx.beginPath();
        ctx.arc(0, 0, 0.45, 0, Math.PI * 2);
        ctx.fillStyle = rgba(C.A, 0.85);
        ctx.fill();
      });
      ctx.fillStyle = 'rgba(8,10,14,0.85)';
      for (let i = 0; i < 7; i++) {
        ctx.save();
        ctx.rotate((i / 7) * Math.PI * 2);
        ctx.fillRect(0.06, -0.04, 0.38, 0.08);
        ctx.restore();
      }
      ctx.restore();
      plate(ctx, [[-0.8, 0.3], [0.8, 0.25], [0.72, 0.6], [-0.72, 0.62]], C.S2, C.s({ r: 0.08 }));
      break;
    }
    case 'sh_missile': {
      pad([[-0.9, -0.5], [0.7, -0.6], [0.95, 0.1], [0.75, 0.55], [-0.75, 0.6], [-0.95, 0.0]]);
      const bb = plate(ctx, [[-0.8, -1.55], [0.75, -1.6], [0.8, -0.55], [-0.78, -0.5]], C.S2, C.s({ r: 0.1 }));
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const x = -0.45 + c * 0.4;
          const y = bb.y0 + 0.3 + r * 0.42;
          ctx.beginPath();
          ctx.arc(x, y, 0.15, 0, Math.PI * 2);
          ctx.fillStyle = '#0c0e12';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x + 0.02, y + 0.02, 0.09, 0, Math.PI * 2);
          ctx.fillStyle = '#c8302a';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x - 0.01, y - 0.01, 0.035, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fill();
        }
      }
      hazard(ctx, [[-0.78, -0.72], [0.78, -0.75], [0.79, -0.6], [-0.78, -0.58]], 0.12);
      break;
    }
    case 'sh_antenna': {
      for (const [x, h] of [[-0.45, 1.9], [-0.15, 1.5]]) {
        cylinder(ctx, x, -0.4, x - 0.5, -0.4 - h, 0.05, FRAME, {});
        light(ctx, x - 0.5, -0.4 - h, 0.08, C.A);
      }
      pad([[-0.9, -0.55], [0.7, -0.65], [0.95, 0.1], [0.75, 0.55], [-0.75, 0.6], [-0.95, 0.0]]);
      plate(ctx, [[-0.82, 0.32], [0.82, 0.28], [0.72, 0.6], [-0.72, 0.62]], C.S2, C.s({ r: 0.08 }));
      break;
    }
    default: {
      pad([[-0.9, -0.55], [0.7, -0.65], [0.95, 0.1], [0.75, 0.55], [-0.75, 0.6], [-0.95, 0.0]]);
      plate(ctx, [[-0.85, 0.3], [0.85, 0.25], [0.75, 0.62], [-0.75, 0.65]], C.S2, C.s({ r: 0.08 }));
      boltLine(ctx, -0.6, 0.45, 0.6, 0.42, 5, 0.04);
    }
  }
  seam(ctx, [[-0.6, -0.35], [0.55, -0.42]], 0.6);
  if (code) stencil(ctx, code, decalAt[0], decalAt[1], decalAt[2], '#ffffff', -0.05, mirror);
}

// ---------------------------------------------------------------- BRACCIA
function drawUpperArm(ctx, C) {
  cylinder(ctx, -0.42, 0.3, -0.42, 1.35, 0.11, FRAME, { rod: 0.35 });
  plate(ctx, [[-0.38, 0.25], [0.45, 0.2], [0.5, 1.6], [-0.35, 1.65]], C.S2, C.s({ r: 0.12 }));
  plate(ctx, [[-0.12, 0.15], [0.58, 0.25], [0.62, 1.3], [0.0, 1.4]], C.P, C.p({ r: 0.14 }));
  seam(ctx, [[0.05, 0.8], [0.58, 0.82]], 0.7);
  bolts(ctx, [[0.1, 0.35], [0.45, 1.15]]);
  joint(ctx, 0, 0, 0.48, FRAME, { bolts: 6 });
  joint(ctx, 0, BODY.upper, 0.36, FRAME, { bolts: 5 });
}

function gauntlet(ctx, C, wide = 1) {
  const w = 0.5 * wide;
  plate(ctx, [[-w, 0.05], [w, 0.05], [w + 0.1, 1.75], [-w, 1.82]], C.P, C.p({ r: 0.14 }));
  plate(ctx, [[w - 0.25, 0.2], [w + 0.22, 0.32], [w + 0.28, 1.55], [w - 0.15, 1.7]], C.S2, C.s({ r: 0.1 }));
  vents(ctx, -w + 0.12, 0.45, 0.35, 0.6, 3);
  seam(ctx, [[-w + 0.05, 1.25], [w, 1.22]], 0.7);
  plate(ctx, rect(-w - 0.05, 1.75, w * 2 + 0.15, 0.26), FRAME, C.f({ r: 0.06 }));
}

function fist(ctx, C, y0 = 1.98, s = 1) {
  plate(ctx, [[-0.45 * s, y0], [0.45 * s, y0], [0.55 * s, y0 + 0.8 * s], [-0.4 * s, y0 + 0.88 * s]], FRAME, C.f({ r: 0.12 }));
  for (let i = 0; i < 4; i++) {
    const y = y0 + 0.2 * s + i * 0.17 * s;
    seam(ctx, [[-0.35 * s, y], [0.45 * s, y + 0.02]], 0.6);
  }
  plate(ctx, [[0.0, y0 + 0.35 * s], [0.62 * s, y0 + 0.3 * s], [0.64 * s, y0 + 0.9 * s], [0.05, y0 + 0.95 * s]], C.P, C.p({ r: 0.1 }));
  plate(ctx, [[-0.55 * s, y0 + 0.1], [-0.25 * s, y0 + 0.05], [-0.22 * s, y0 + 0.5 * s], [-0.5 * s, y0 + 0.55 * s]], C.S2, C.s({ r: 0.06 }));
  bolts(ctx, [[0.3 * s, y0 + 0.5 * s], [0.3 * s, y0 + 0.75 * s]], 0.035);
}

/** Avambraccio + arma. Restituisce informazioni utili (bocca di fuoco, lunghezza lama). */
function drawForearm(ctx, C, id) {
  const info = { muzzle: [0, 2.9], tip: 2.9, flame: null };
  switch (id) {
    case 'wp_rocket': {
      for (const x of [-0.32, 0.1]) {
        cylinder(ctx, x, 0.4, x - 0.25, -0.15, 0.17, DARK, { rings: 1 });
        glow(ctx, '#ff8a2a', 0.2, () => {
          ctx.beginPath();
          ctx.ellipse(x - 0.25, -0.15, 0.15, 0.07, 0.4, 0, Math.PI * 2);
          ctx.fillStyle = '#ff9a40';
          ctx.fill();
        });
      }
      gauntlet(ctx, C, 1.2);
      hose(ctx, [[-0.55, 0.3], [-0.75, 0.9], [-0.55, 1.5]], 0.08);
      fist(ctx, C, 1.98, 1.15);
      info.flame = [[-0.36, -0.2], [0.06, -0.2]];
      info.tip = 3.0;
      break;
    }
    case 'wp_chainsword': {
      plate(ctx, [[-0.5, 0.0], [0.5, 0.0], [0.58, 1.65], [-0.5, 1.7]], C.P, C.p({ r: 0.14 }));
      vents(ctx, -0.35, 0.3, 0.45, 0.7, 4);
      // lama segmentata
      plate(ctx, [[-0.28, 1.5], [0.12, 1.5], [0.12, 5.6], [-0.05, 6.2], [-0.28, 5.7]], FRAME, C.f({ r: 0.04, spec: 0.8 }));
      for (let i = 0; i < 12; i++) {
        const y = 1.65 + i * 0.34;
        plate(ctx, [[0.1, y], [0.34, y + 0.06], [0.36, y + 0.26], [0.1, y + 0.3]], i % 2 ? C.S2 : shade(FRAME, 0.1), { r: 0.02, spec: 0.6, wear: 0.2 });
      }
      glowShape(ctx, [[0.36, 1.65], [0.42, 1.65], [0.42, 5.75], [0.0, 6.25], [0.0, 6.1], [0.36, 5.7]], C.A, { blur: 0.35, r: 0.01 });
      plate(ctx, rect(-0.6, 1.4, 1.2, 0.3), C.S2, C.s({ r: 0.06 }));
      boltLine(ctx, -0.18, 1.9, -0.18, 5.4, 8, 0.035);
      info.tip = 6.2;
      info.muzzle = [0.1, 6.0];
      break;
    }
    case 'wp_hammer': {
      gauntlet(ctx, C, 1.05);
      plate(ctx, rect(-0.42, 1.95, 0.84, 0.4), FRAME, C.f({ r: 0.08 }));
      cylinder(ctx, 0, 2.3, 0, 3.15, 0.15, DARK, { rings: 3 });
      plate(ctx, [[-1.05, 3.05], [1.05, 3.05], [1.1, 4.0], [-1.1, 4.0]], C.P, C.p({ r: 0.14 }));
      plate(ctx, rect(-1.2, 2.95, 0.32, 1.15), C.S2, C.s({ r: 0.08 }));
      plate(ctx, rect(0.88, 2.95, 0.32, 1.15), C.S2, C.s({ r: 0.08 }));
      for (const x of [-0.55, 0.45]) glowShape(ctx, rect(x, 3.1, 0.1, 0.85), C.A, { blur: 0.3 });
      vents(ctx, -0.35, 3.25, 0.7, 0.5, 3);
      bolts(ctx, [[-0.75, 3.2], [-0.75, 3.85], [0.75, 3.2], [0.75, 3.85]]);
      info.tip = 4.0;
      info.muzzle = [0, 3.6];
      break;
    }
    case 'wp_plasma': {
      plate(ctx, [[-0.55, 0.05], [0.55, 0.05], [0.5, 1.2], [-0.5, 1.2]], C.P, C.p({ r: 0.14 }));
      plate(ctx, [[-0.45, 1.0], [0.45, 1.0], [0.38, 3.45], [-0.36, 3.45]], C.S2, C.s({ r: 0.1 }));
      for (let i = 0; i < 4; i++) {
        const y = 1.35 + i * 0.5;
        plate(ctx, rect(-0.5, y, 1.0, 0.18), FRAME, C.f({ r: 0.05 }));
        glowShape(ctx, rect(-0.42, y + 0.06, 0.84, 0.06), C.A, { blur: 0.25, r: 0.02 });
      }
      plate(ctx, [[0.42, 0.35], [0.85, 0.45], [0.85, 1.6], [0.42, 1.7]], C.P, C.p({ r: 0.08 }));
      light(ctx, 0.64, 0.7, 0.05, C.A);
      plate(ctx, rect(-0.45, 3.4, 0.9, 0.38), DARK, C.f({ r: 0.08 }));
      glow(ctx, C.A, 0.5, () => {
        ctx.beginPath();
        ctx.ellipse(0, 3.78, 0.28, 0.08, 0, 0, Math.PI * 2);
        ctx.fillStyle = C.A;
        ctx.fill();
      });
      hose(ctx, [[-0.5, 0.5], [-0.85, 1.4], [-0.45, 2.2]], 0.09);
      info.muzzle = [0, 3.85];
      info.tip = 3.8;
      break;
    }
    case 'wp_claws': {
      gauntlet(ctx, C, 1.0);
      plate(ctx, [[-0.45, 1.95], [0.45, 1.95], [0.5, 2.45], [-0.42, 2.5]], FRAME, C.f({ r: 0.1 }));
      for (let i = 0; i < 3; i++) {
        const x = -0.28 + i * 0.28;
        const a = (i - 1) * 0.12;
        ctx.save();
        ctx.translate(x, 2.35);
        ctx.rotate(-a);
        plate(ctx, [[-0.07, 0], [0.1, 0], [0.14, 1.6], [0.0, 2.25], [-0.09, 1.65]], C.S2, { r: 0.02, spec: 0.9, wear: 0.2 });
        glowShape(ctx, [[0.1, 0.1], [0.16, 0.1], [0.17, 1.6], [0.02, 2.2], [0.0, 2.1], [0.11, 1.6]], C.A, { blur: 0.25, r: 0.01 });
        ctx.restore();
      }
      info.tip = 4.5;
      info.muzzle = [0, 4.3];
      break;
    }
    default: {
      gauntlet(ctx, C, 1.0);
      fist(ctx, C);
    }
  }
  return info;
}

// ---------------------------------------------------------------- GAMBE
function drawThigh(ctx, C, legId, L) {
  const heavy = legId === 'lg_heavy';
  const k = heavy ? 1.25 : legId === 'lg_digi' ? 0.88 : 1;
  cylinder(ctx, -0.45 * k, 0.35, -0.45 * k, L - 0.4, 0.11, FRAME, { rod: 0.3 });
  plate(ctx, [[-0.42 * k, 0.2], [0.42 * k, 0.2], [0.36 * k, L - 0.05], [-0.36 * k, L - 0.05]], FRAME, C.f({ r: 0.1 }));
  plate(ctx, [[-0.5 * k, 0.08], [0.62 * k, 0.02], [0.58 * k, L * 0.72], [-0.45 * k, L * 0.78]], C.P, C.p({ r: 0.16 }));
  plate(ctx, [[0.15 * k, 0.15], [0.68 * k, 0.12], [0.66 * k, L * 0.62], [0.25 * k, L * 0.66]], C.S2, C.s({ r: 0.12 }));
  seam(ctx, [[-0.4 * k, L * 0.4], [0.15 * k, L * 0.42]], 0.6);
  bolts(ctx, [[-0.25 * k, 0.3], [-0.25 * k, L * 0.6]]);
  if (heavy) plate(ctx, [[-0.62, 0.0], [0.0, -0.05], [-0.05, 0.85], [-0.6, 0.95]], C.S2, C.s({ r: 0.1 }));
  joint(ctx, 0, 0, 0.5 * Math.min(1.15, k), FRAME, { bolts: 6 });
  joint(ctx, 0, L, 0.3 * Math.min(1.15, k), FRAME, { bolts: 5 });
}

function drawShin(ctx, C, legId, L) {
  const heavy = legId === 'lg_heavy';
  const digi = legId === 'lg_digi';
  const k = heavy ? 1.25 : digi ? 0.85 : 1;
  const front = digi ? -1 : 1;
  plate(ctx, [[-0.45 * k, 0.1], [0.38 * k, 0.1], [0.32 * k, L - 0.05], [-0.36 * k, L - 0.05]], FRAME, C.f({ r: 0.1 }));
  cylinder(ctx, -0.48 * k * front, 0.35, -0.42 * k * front, L - 0.4, 0.1, FRAME, { rod: 0.3 });
  plate(ctx, [[-0.6 * k * front, 0.3], [-0.12 * k * front, 0.18], [-0.08 * k * front, L * 0.75], [-0.5 * k * front, L * 0.82]], C.S2, C.s({ r: 0.12 }));
  // parastinchi
  plate(ctx, [[0.05 * front, 0.35], [0.62 * k * front, 0.42], [0.55 * k * front, L - 0.25], [0.02 * front, L - 0.15]], C.P, C.p({ r: 0.14 }));
  vents(ctx, Math.min(0.12 * front, 0.42 * k * front), L * 0.45, 0.28 * k, L * 0.3, 4);
  // ginocchiera
  plate(ctx, [[-0.05 * front, -0.42], [0.58 * k * front, -0.3], [0.65 * k * front, 0.38], [0.12 * front, 0.5]], C.P, C.p({ r: 0.2 }));
  bolt(ctx, 0.35 * k * front, 0.02, 0.05);
  if (legId === 'lg_thrust') {
    plate(ctx, [[-0.95, 0.6], [-0.4, 0.55], [-0.35, 1.55], [-0.9, 1.6]], DARK, C.f({ r: 0.1 }));
    cylinder(ctx, -0.65, 1.5, -0.8, 1.95, 0.18, FRAME, { rings: 1 });
    glow(ctx, C.A, 0.3, () => {
      ctx.beginPath();
      ctx.ellipse(-0.8, 1.97, 0.15, 0.06, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = C.A;
      ctx.fill();
    });
    light(ctx, -0.65, 0.8, 0.05, C.A);
  }
  if (heavy) plate(ctx, [[0.3, 0.3], [0.85, 0.35], [0.8, 1.4], [0.35, 1.45]], C.S2, C.s({ r: 0.1 }));
  joint(ctx, 0, L, 0.3 * Math.min(1.15, k), FRAME, { bolts: 4 });
}

function drawFoot(ctx, C, legId) {
  if (legId === 'lg_digi') {
    plate(ctx, [[-0.4, -0.15], [0.3, -0.2], [0.45, 0.3], [-0.45, 0.32]], FRAME, C.f({ r: 0.1 }));
    for (let i = 0; i < 3; i++) {
      const dy = 0.06 * i;
      plate(ctx, [[0.1, 0.0 + dy], [0.95 - i * 0.12, 0.12 + dy], [1.3 - i * 0.15, 0.46], [0.15, 0.46]], i === 1 ? C.S2 : C.P, C.p({ r: 0.08 }));
    }
    plate(ctx, [[-0.55, 0.05], [-0.15, 0.1], [-0.3, 0.46], [-0.85, 0.46]], C.S2, C.s({ r: 0.06 }));
    return;
  }
  const heavy = legId === 'lg_heavy';
  const k = heavy ? 1.2 : 1;
  plate(ctx, [[-0.6 * k, -0.12], [0.45 * k, -0.18], [1.25 * k, 0.18], [1.3 * k, 0.46], [-0.7 * k, 0.46]], FRAME, C.f({ r: 0.1 }));
  plate(ctx, [[0.45 * k, -0.08], [1.22 * k, 0.2], [1.32 * k, 0.46], [0.5 * k, 0.46]], C.P, C.p({ r: 0.1 }));
  plate(ctx, [[-0.72 * k, 0.0], [-0.35 * k, -0.02], [-0.38 * k, 0.46], [-0.8 * k, 0.46]], C.S2, C.s({ r: 0.06 }));
  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(-0.8 * k, 0.4, 2.12 * k, 0.08);
  plate(ctx, [[-0.35, -0.3], [0.32, -0.32], [0.4, 0.15], [-0.4, 0.15]], C.S2, C.s({ r: 0.1 }));
  boltLine(ctx, 0.6 * k, 0.32, 1.1 * k, 0.36, 3, 0.035);
}

// ---------------------------------------------------------------- FIAMME
function flameSprite(color, S, len = 2.2, w = 0.5) {
  return makeSprite([-w, 0, w, len], S, (ctx) => {
    for (const [ww, a, c] of [[w, 0.55, color], [w * 0.55, 0.9, '#fff3c0'], [w * 0.25, 1, '#ffffff']]) {
      const g = ctx.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, c);
      g.addColorStop(1, rgba('#000000', 0));
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.moveTo(-ww, 0);
      ctx.quadraticCurveTo(-ww * 0.8, len * 0.5, 0, len);
      ctx.quadraticCurveTo(ww * 0.8, len * 0.5, ww, 0);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    }
  });
}

// ---------------------------------------------------------------- COSTRUZIONE
/**
 * Disegna tutti i pezzi del Titano. S = pixel per unita' (risoluzione degli sprite).
 */
export function buildRobotArt(cfg, S = 64) {
  const C = palette(cfg);
  const chassis = getPart(cfg.chassis) || PARTS.chassis[0];
  const leg = LEGS[cfg.legs] || LEGS.lg_std;
  const sp = {};
  sp.pelvis = makeSprite([-1.35, -0.75, 1.4, 1.05], S, (ctx) => drawPelvis(ctx, C));
  sp.torso = makeSprite([-2.5, -4.0, 1.95, 0.3], S, (ctx) => drawTorso(ctx, C, cfg.torso));
  sp.head = makeSprite([-1.2, -2.45, 1.45, 0.2], S, (ctx) => drawHead(ctx, C, cfg.head));
  sp.padF = makeSprite([-1.3, -2.4, 1.25, 1.25], S, (ctx) => drawShoulder(ctx, C, cfg.shoulders, cfg.code));
  sp.padFm = cfg.code ? makeSprite([-1.3, -2.4, 1.25, 1.25], S, (ctx) => drawShoulder(ctx, C, cfg.shoulders, cfg.code, true)) : sp.padF;
  sp.padB = tintSprite(makeSprite([-1.3, -2.4, 1.25, 1.25], S, (ctx) => drawShoulder(ctx, C, cfg.shoulders, '')), '#05070c', 0.38);
  sp.upperF = makeSprite([-0.7, -0.6, 0.8, 2.35], S, (ctx) => drawUpperArm(ctx, C));
  sp.upperB = tintSprite(sp.upperF, '#05070c', 0.38);
  const info = {};
  const fore = (id) => makeSprite([-1.3, -0.6, 1.3, 6.4], S, (ctx) => Object.assign(info[id] = {}, drawForearm(ctx, C, id)));
  sp.foreF = fore(cfg.armR);
  sp.foreB = tintSprite(fore(cfg.armL), '#05070c', 0.38);
  sp.thighF = makeSprite([-0.9, -0.65, 0.95, leg.thigh + 0.5], S, (ctx) => drawThigh(ctx, C, cfg.legs, leg.thigh));
  sp.thighB = tintSprite(sp.thighF, '#05070c', 0.42);
  sp.shinF = makeSprite([-1.0, -0.55, 1.0, leg.shin + 0.45], S, (ctx) => drawShin(ctx, C, cfg.legs, leg.shin));
  sp.shinB = tintSprite(sp.shinF, '#05070c', 0.42);
  sp.footF = makeSprite([-1.0, -0.4, 1.65, 0.55], S, (ctx) => drawFoot(ctx, C, cfg.legs));
  sp.footB = tintSprite(sp.footF, '#05070c', 0.42);
  sp.flameArm = flameSprite('#ff9a3a', S, 2.0, 0.22);
  sp.flameLeg = flameSprite(cfg.colors.accent, S, 2.4, 0.2);

  const coreOffsets = { tr_fission: [1.02, -2.0], tr_plasma: [1.08, -1.95], tr_tesla: [1.05, -2.0], tr_berserk: [1.05, -1.6] };
  const glowScale = Math.max(0.55, Math.min(1.4, 0.55 / Math.max(0.05, luminance(cfg.colors.accent))));
  return {
    S,
    sprites: sp,
    flash: null,
    scale: [chassis.scale[0], chassis.scale[1]],
    leg,
    info: { R: info[cfg.armR], L: info[cfg.armL] },
    core: coreOffsets[cfg.torso] || [1.0, -2.0],
    visor: { hd_dome: [0.1, -1.05], hd_tri: [0.6, -0.9], hd_hunter: [0.8, -0.82], hd_crest: [0.65, -0.97] }[cfg.head] || [0.6, -1.08],
    accent: cfg.colors.accent,
    glowScale,
    flames: { arm: { R: cfg.armR === 'wp_rocket', L: cfg.armL === 'wp_rocket' }, leg: cfg.legs === 'lg_thrust' },
    height: 9.6 * chassis.scale[1],
  };
}

