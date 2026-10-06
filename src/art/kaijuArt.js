// Disegno 2D dettagliato dei Kaiju (vista laterale, rivolti a destra).
// Forme organiche con squame, venature bioluminescenti, aculei, artigli e denti.
import { makeSprite, tintSprite } from '../engine/sprite.js';
import { shade, rgba, rng } from '../engine/color.js';
import { bbox, glow } from '../engine/paint.js';

const BONE = '#d9cfb8';

/** Curva chiusa morbida (Catmull-Rom) che passa per i punti. [x, y, spigolo?] */
export function smoothPath(ctx, pts) {
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const k1 = p1[2] ? 0 : 1 / 6;
    const k2 = p2[2] ? 0 : 1 / 6;
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) * k1,
      p1[1] + (p2[1] - p0[1]) * k1,
      p2[0] - (p3[0] - p1[0]) * k2,
      p2[1] - (p3[1] - p1[1]) * k2,
      p2[0],
      p2[1],
    );
  }
  ctx.closePath();
}

function scales(ctx, bb, K, size = 0.2, alpha = 1) {
  const sx = size * 1.15;
  const sy = size * 0.8;
  let row = 0;
  for (let y = bb.y0 - sy; y < bb.y1 + sy; y += sy, row++) {
    for (let x = bb.x0 - sx + (row % 2) * sx * 0.5; x < bb.x1 + sx; x += sx) {
      ctx.beginPath();
      ctx.arc(x, y, size * 0.55, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.strokeStyle = `rgba(0,0,0,${0.32 * alpha})`;
      ctx.lineWidth = 0.035;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y - 0.03, size * 0.45, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.strokeStyle = `rgba(255,255,255,${0.07 * alpha})`;
      ctx.lineWidth = 0.025;
      ctx.stroke();
    }
  }
}

function veins(ctx, bb, K, rand, count, width = 0.05) {
  glow(ctx, K.glow, 0.22, () => {
    ctx.strokeStyle = K.glow;
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      let x = bb.x0 + rand() * bb.w;
      let y = bb.y0 + rand() * bb.h;
      ctx.lineWidth = width * (0.6 + rand() * 0.8);
      ctx.globalAlpha = 0.55 + rand() * 0.45;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 4 + Math.floor(rand() * 5);
      for (let k = 0; k < steps; k++) {
        const nx = x + (rand() - 0.5) * 0.6;
        const ny = y + (rand() - 0.35) * 0.45;
        ctx.quadraticCurveTo(x + (rand() - 0.5) * 0.3, y + (rand() - 0.5) * 0.3, nx, ny);
        x = nx;
        y = ny;
        if (rand() > 0.75) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + (rand() - 0.5) * 0.4, y + rand() * 0.3);
          ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

function spots(ctx, pts, K, r = 0.07) {
  glow(ctx, K.glow, 0.25, () => {
    ctx.fillStyle = K.glow;
    for (const [x, y, rr] of pts) {
      ctx.beginPath();
      ctx.arc(x, y, rr ?? r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Massa di carne/pelle con squame, venature e luce di contorno. */
function flesh(ctx, pts, K, o = {}) {
  const bb = bbox(pts);
  smoothPath(ctx, pts);
  let g;
  if (o.side) {
    g = ctx.createLinearGradient(bb.x0, 0, bb.x1, 0);
    g.addColorStop(0, shade(o.color || K.skin, -0.08));
    g.addColorStop(0.5, shade(o.color || K.skin, 0.05));
    g.addColorStop(1, shade(o.color || K.skin, -0.12));
  } else {
    g = ctx.createLinearGradient(0, bb.y0, 0, bb.y1);
    g.addColorStop(0, shade(o.color || K.skin, 0.02));
    g.addColorStop(o.bellyAt ?? 0.6, o.color || K.skin);
    g.addColorStop(1, o.belly === false ? shade(o.color || K.skin, -0.12) : K.belly);
  }
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const rand = rng(Math.round((bb.x0 * 73 + bb.y0 * 41 + bb.w * 17) * 997) + K.seed);
  // chiazze
  for (let i = 0; i < bb.w * bb.h * 1.2; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.08 + rand() * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(bb.x0 + rand() * bb.w, bb.y0 + rand() * bb.h, 0.15 + rand() * 0.4, 0.1 + rand() * 0.25, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (o.scales !== false) scales(ctx, bb, K, o.scaleSize ?? 0.2, o.scaleAlpha ?? 1);
  if (o.veins) veins(ctx, bb, K, rand, o.veins);
  // ombra interna in basso a destra e luce di contorno in alto
  ctx.lineWidth = 0.22;
  ctx.translate(0.07, 0.09);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  smoothPath(ctx, pts);
  ctx.stroke();
  ctx.translate(-0.14, -0.18);
  ctx.lineWidth = 0.1;
  ctx.strokeStyle = o.rim ?? 'rgba(170,200,230,0.28)';
  smoothPath(ctx, pts);
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = '#040506';
  smoothPath(ctx, pts);
  ctx.stroke();
  return bb;
}

/** Placca ossea/corazza (carapace, scudi). */
function shell(ctx, pts, K, o = {}) {
  const bb = bbox(pts);
  smoothPath(ctx, pts);
  const c = o.color || K.shell || shade(K.skin, 0.08);
  const g = ctx.createLinearGradient(bb.x0, bb.y0, bb.x0 + bb.w * 0.4, bb.y1);
  g.addColorStop(0, shade(c, 0.18));
  g.addColorStop(0.5, c);
  g.addColorStop(1, shade(c, -0.2));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const rand = rng(Math.round(bb.x0 * 997 + bb.y0 * 131) + K.seed);
  for (let i = 0; i < bb.w * bb.h * 6; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rand() * 0.15})`;
    ctx.beginPath();
    ctx.arc(bb.x0 + rand() * bb.w, bb.y0 + rand() * bb.h, 0.02 + rand() * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  const g2 = ctx.createLinearGradient(bb.x0, bb.y0, bb.x1, bb.y1);
  g2.addColorStop(0.25, 'rgba(255,255,255,0)');
  g2.addColorStop(0.33, 'rgba(255,255,255,0.22)');
  g2.addColorStop(0.4, 'rgba(255,255,255,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(bb.x0, bb.y0, bb.w, bb.h);
  if (o.veins) veins(ctx, bb, K, rand, o.veins, 0.04);
  ctx.lineWidth = 0.14;
  ctx.translate(0.05, 0.06);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  smoothPath(ctx, pts);
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = '#040506';
  smoothPath(ctx, pts);
  ctx.stroke();
  return bb;
}

function spike(ctx, x, y, len, ang, w, color = BONE, glowColor = null) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const draw = () => {
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.quadraticCurveTo(-w * 0.4, -len * 0.55, 0, -len);
    ctx.quadraticCurveTo(w * 0.3, -len * 0.5, w, 0);
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(-w, 0, w, 0);
  g.addColorStop(0, shade(color, 0.15));
  g.addColorStop(0.6, color);
  g.addColorStop(1, shade(color, -0.3));
  if (glowColor) {
    glow(ctx, glowColor, 0.3, () => {
      draw();
      ctx.fillStyle = g;
      ctx.fill();
    });
  } else {
    draw();
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.lineWidth = 0.035;
  ctx.strokeStyle = '#050607';
  ctx.stroke();
  ctx.restore();
}

function claw(ctx, x, y, len, ang, w = 0.12, color = '#1a1714') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.quadraticCurveTo(-w * 0.2, len * 0.6, len * 0.35, len);
  ctx.quadraticCurveTo(w * 0.6, len * 0.5, w, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, len * 0.3, len);
  g.addColorStop(0, BONE);
  g.addColorStop(0.5, shade(BONE, -0.25));
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 0.03;
  ctx.strokeStyle = '#050607';
  ctx.stroke();
  ctx.restore();
}

function teeth(ctx, x0, y0, x1, y1, n, size, dir = 1) {
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const s = size * (0.6 + 0.4 * Math.sin(t * Math.PI));
    ctx.beginPath();
    ctx.moveTo(x - s * 0.35, y);
    ctx.lineTo(x + s * 0.1, y + s * dir);
    ctx.lineTo(x + s * 0.35, y);
    ctx.closePath();
    ctx.fillStyle = BONE;
    ctx.fill();
    ctx.lineWidth = 0.02;
    ctx.strokeStyle = '#2a2520';
    ctx.stroke();
  }
}

function eye(ctx, x, y, r, K, slit = true) {
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.5, r * 1.1, -0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#050607';
  ctx.fill();
  glow(ctx, K.glow, 0.35, () => {
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.15, r * 0.75, -0.15, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(x, y, 0.01, x, y, r * 1.2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, K.glow);
    g.addColorStop(1, shade(K.glow, -0.3));
    ctx.fillStyle = g;
    ctx.fill();
  });
  if (slit) {
    ctx.fillStyle = '#050607';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.1, y, r * 0.18, r * 0.65, -0.15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function mouthGlow(ctx, pts, K) {
  glow(ctx, K.glow, 0.3, () => {
    smoothPath(ctx, pts);
    const bb = bbox(pts);
    const g = ctx.createLinearGradient(bb.x0, 0, bb.x1, 0);
    g.addColorStop(0, rgba(K.glow, 0.9));
    g.addColorStop(1, '#3a0f12');
    ctx.fillStyle = g;
    ctx.fill();
  });
}

// ===================================================================== PEZZI COMUNI
function thighPart(ctx, K, L, w) {
  flesh(ctx, [[-w * 0.9, -0.3], [w * 0.8, -0.45], [w * 1.0, L * 0.45], [w * 0.55, L + 0.15], [-w * 0.55, L + 0.15], [-w * 1.05, L * 0.4]], K, { belly: false, veins: 2, side: true });
}

function shinPart(ctx, K, L, w) {
  flesh(ctx, [[-w * 0.6, -0.25], [w * 0.65, -0.2], [w * 0.5, L * 0.6], [w * 0.4, L + 0.1], [-w * 0.45, L + 0.1], [-w * 0.75, L * 0.45]], K, { belly: false, veins: 1, side: true });
}

function footPart(ctx, K, w, talons = 3) {
  flesh(ctx, [[-w * 0.9, -0.3], [w * 0.5, -0.35], [w * 1.6, 0.15], [w * 1.7, 0.42], [-w * 1.1, 0.45]], K, { belly: false, side: true, scaleSize: 0.15 });
  for (let i = 0; i < talons; i++) claw(ctx, w * (1.0 + i * 0.25), 0.2 + i * 0.04, 0.55, -0.9, 0.09);
  claw(ctx, -w * 1.0, 0.25, 0.4, 0.9, 0.08);
}

function tailPart(ctx, K, len, r0, r1, o = {}) {
  flesh(ctx, [[0.15, -r0], [-len * 0.5, -(r0 + r1) * 0.55], [-len - 0.1, -r1], [-len - 0.15, r1 * 0.9], [-len * 0.5, (r0 + r1) * 0.5], [0.15, r0 * 0.95]], K, { veins: 1, bellyAt: 0.55, scaleSize: 0.17 });
  if (o.spike) spike(ctx, -len * 0.5, -(r0 + r1) * 0.5, o.spike, -0.5, o.spike * 0.3, BONE, o.spikeGlow);
  if (o.spots) spots(ctx, [[-len * 0.4, 0.0, 0.05], [-len * 0.75, 0.02, 0.04]], K);
}

// ===================================================================== DEFINIZIONI
function bipedArt(def, K, S) {
  const b = def.body;
  const sp = {};
  const L = { thigh: 2.3, shin: 2.3, upper: 2.0, fore: 1.9, footH: 0.5 };
  const big = b.head === 'abyss';
  const cobra = b.head === 'cobra';
  const armW = big ? 0.75 : cobra ? 0.48 : 0.62;

  // ---- corpo
  sp.body = makeSprite([-2.6, -5.6, 3.6, 1.4], S, (ctx) => {
    if (b.spikes) {
      for (let i = 0; i < b.spikes; i++) {
        const t = i / Math.max(1, b.spikes - 1);
        const x = -1.2 + t * 2.9;
        const y = -1.0 - Math.sin(t * Math.PI * 0.95 + 0.2) * 2.55 - t * 0.2;
        const len = (0.6 + Math.sin(t * Math.PI) * (big ? 1.4 : 0.8)) * (b.head === 'shark' ? 0.55 : 1);
        spike(ctx, x, y + 0.15, len, -0.55 + t * 0.4, len * 0.22, BONE);
      }
    }
    if (b.head === 'shark') {
      // pinna dorsale da squalo, piegata all'indietro
      flesh(ctx, [[1.0, -3.3], [0.45, -3.95], [-0.35, -4.75], [-1.45, -5.45, 1], [-0.95, -4.5], [-0.75, -3.6], [-0.55, -2.9]], K, { veins: 2, belly: false, scaleSize: 0.13, color: shade(K.skin, 0.04) });
      glow(ctx, K.glow, 0.25, () => {
        ctx.beginPath();
        ctx.moveTo(-1.32, -5.22);
        ctx.quadraticCurveTo(-0.95, -4.2, -0.7, -3.35);
        ctx.strokeStyle = rgba(K.glow, 0.8);
        ctx.lineWidth = 0.05;
        ctx.stroke();
      });
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 0.035;
      for (const [x0, y0, x1, y1] of [[0.1, -3.7, -0.3, -4.25], [-0.25, -3.5, -0.55, -3.95]]) {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }
    const bb = flesh(ctx, [[-1.6, 0.25], [-1.55, -1.4], [-0.5, -3.0], [0.7, -3.75], [1.9, -3.75], [2.7, -3.15], [2.65, -2.0], [2.1, -0.8], [1.4, 0.55], [0.2, 0.95], [-1.0, 0.75]], K, { veins: 6, bellyAt: 0.5 });
    // placche ventrali
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      const y = -2.4 + i * 0.5;
      ctx.beginPath();
      ctx.ellipse(2.1 - i * 0.18, y, 0.45, 0.12, 0.5, 0, Math.PI);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 0.04;
      ctx.stroke();
    }
    ctx.restore();
    spots(ctx, [[0.0, -1.6, 0.07], [0.5, -2.2, 0.06], [1.0, -2.7, 0.07], [1.5, -3.0, 0.05], [-0.5, -1.0, 0.05]], K);
    if (big) {
      for (let i = 0; i < 5; i++) {
        shell(ctx, [[0.0 + i * 0.4, -3.65 + i * 0.05], [0.6 + i * 0.4, -3.85], [0.75 + i * 0.4, -3.3], [0.15 + i * 0.4, -3.15]], K, { color: shade(K.skin, 0.1) });
      }
    }
    void bb;
  });

  // ---- testa e mascella
  const H = { shark: [2.9, 1.1], cobra: [2.1, 0.8], abyss: [3.2, 1.5] }[b.head] || [2.6, 1.0];
  sp.head = makeSprite([-2.4, -3.0, H[0] + 0.6, 1.2], S, (ctx) => {
    if (cobra) {
      // cappuccio
      flesh(ctx, [[0.75, -0.55], [0.35, -1.75], [-0.45, -2.55], [-1.25, -2.35], [-1.65, -1.2], [-1.55, 0.2], [-1.0, 1.15], [-0.1, 1.15], [0.6, 0.45]], K, { veins: 3, belly: false, scaleSize: 0.16 });
      // disegno a occhi sul cappuccio
      for (const [x, y, r] of [[-0.75, -1.45, 0.3], [-0.85, -0.25, 0.24]]) {
        ctx.beginPath();
        ctx.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fill();
        spots(ctx, [[x, y, r * 0.55]], K);
      }
    }
    if (b.crown) {
      for (let i = 0; i < 7; i++) spike(ctx, -0.2 + i * 0.32, -0.9 - Math.sin(i * 0.5) * 0.2, 1.0 + (i % 3) * 0.35, -0.9 + i * 0.12, 0.13, BONE, i % 2 ? null : K.glow);
    }
    if (b.head === 'shark') {
      // testa a lama (come una lama d'osso che sporge oltre il muso)
      const blade = [[-0.45, -0.7], [0.35, -1.25], [1.6, -1.42], [H[0] + 0.55, -1.12], [H[0] + 0.15, -0.82], [H[0] * 0.7, -0.62], [0.4, -0.55]];
      const bladeCol = shade(K.belly, -0.05);
      ctx.beginPath();
      ctx.moveTo(blade[0][0], blade[0][1]);
      ctx.quadraticCurveTo(-0.1, -1.15, blade[1][0], blade[1][1]);
      ctx.quadraticCurveTo(1.0, -1.45, blade[2][0], blade[2][1]);
      ctx.lineTo(blade[3][0], blade[3][1]);
      for (let i = 4; i < blade.length; i++) ctx.lineTo(blade[i][0], blade[i][1]);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -1.45, 0, -0.55);
      g.addColorStop(0, shade(bladeCol, 0.22));
      g.addColorStop(0.45, bladeCol);
      g.addColorStop(1, shade(bladeCol, -0.25));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 0.05;
      ctx.strokeStyle = '#050607';
      ctx.stroke();
      // filo della lama e scanalatura luminosa
      ctx.beginPath();
      ctx.moveTo(0.4, -1.27);
      ctx.quadraticCurveTo(1.0, -1.4, 1.6, -1.37);
      ctx.lineTo(H[0] + 0.45, -1.1);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 0.04;
      ctx.stroke();
      glow(ctx, K.glow, 0.2, () => {
        ctx.beginPath();
        ctx.moveTo(0.3, -0.95);
        ctx.lineTo(H[0] - 0.1, -0.98);
        ctx.strokeStyle = rgba(K.glow, 0.75);
        ctx.lineWidth = 0.035;
        ctx.stroke();
      });
      // seghettatura sul bordo inferiore
      ctx.fillStyle = shade(bladeCol, -0.35);
      for (let i = 0; i < 6; i++) {
        const x = 0.8 + i * 0.38;
        ctx.beginPath();
        ctx.moveTo(x, -0.62);
        ctx.lineTo(x + 0.12, -0.5);
        ctx.lineTo(x + 0.24, -0.63);
        ctx.fill();
      }
    }
    const top = b.head === 'shark' ? -0.95 : big ? -1.35 : -0.7;
    flesh(ctx, [[-0.3, -0.45], [0.6, top], [H[0] * 0.55, top * 0.85], [H[0], -0.25, 1], [H[0] * 0.75, 0.3], [0.5, 0.45], [-0.35, 0.4]], K, { veins: 2, bellyAt: 0.7, scaleSize: 0.15 });
    teeth(ctx, 0.6, 0.32, H[0] - 0.2, 0.05, big ? 12 : 9, big ? 0.32 : 0.24, 1);
    if (big) {
      for (let i = 0; i < 3; i++) eye(ctx, 1.1 + i * 0.5, -0.55 + i * 0.12, 0.09 - i * 0.012, K);
      eye(ctx, 0.9, -0.2, 0.06, K);
    } else eye(ctx, H[0] * 0.48, -0.35, cobra ? 0.09 : 0.1, K);
    if (b.head === 'shark') {
      spots(ctx, [[0.4, 0.0, 0.035], [0.55, -0.05, 0.035], [0.7, -0.1, 0.035]], K);
      for (let i = 0; i < 3; i++) {
        glow(ctx, K.glow, 0.15, () => {
          ctx.beginPath();
          ctx.moveTo(0.05 + i * 0.15, -0.3);
          ctx.quadraticCurveTo(0.12 + i * 0.15, 0.0, 0.05 + i * 0.15, 0.25);
          ctx.strokeStyle = K.glow;
          ctx.lineWidth = 0.035;
          ctx.stroke();
        });
      }
    }
    if (cobra) {
      claw(ctx, H[0] * 0.75, 0.2, 0.55, 0.15, 0.06, '#2a2520');
    }
  });
  sp.jaw = makeSprite([-0.6, -0.4, H[0] + 0.3, 1.2], S, (ctx) => {
    mouthGlow(ctx, [[0.0, -0.05], [H[0] * 0.85, -0.12], [H[0] * 0.7, 0.2], [0.1, 0.25]], K);
    flesh(ctx, [[-0.3, -0.1], [0.4, 0.05], [H[0] * 0.85, -0.05, 1], [H[0] * 0.6, 0.45], [0.3, 0.55], [-0.35, 0.25]], K, { bellyAt: 0.3, scaleSize: 0.13 });
    teeth(ctx, 0.5, 0.02, H[0] * 0.8, -0.05, big ? 11 : 8, big ? 0.28 : 0.2, -1);
  });

  // ---- braccia
  sp.upperF = makeSprite([-1.0, -0.8, 1.0, L.upper + 0.6], S, (ctx) => {
    flesh(ctx, [[-armW, -0.4], [armW * 0.9, -0.55], [armW * 1.1, L.upper * 0.5], [armW * 0.6, L.upper + 0.25], [-armW * 0.6, L.upper + 0.25], [-armW * 1.0, L.upper * 0.4]], K, { side: true, veins: 2 });
    if (big) spike(ctx, 0.0, -0.2, 0.9, -0.3, 0.18, BONE);
  });
  sp.foreF = makeSprite([-1.0, -0.5, 1.6, L.fore + 1.6], S, (ctx) => {
    const w = armW * 0.85;
    flesh(ctx, [[-w, -0.25], [w, -0.3], [w * 1.15, L.fore * 0.6], [w * 0.8, L.fore + 0.15], [-w * 0.7, L.fore + 0.2], [-w * 0.95, L.fore * 0.5]], K, { side: true, veins: 2 });
    if (!cobra) for (let i = 0; i < 3; i++) spike(ctx, -w * 0.8, 0.3 + i * 0.45, 0.45, -1.7, 0.1, BONE);
    const n = big ? 4 : 3;
    for (let i = 0; i < n; i++) claw(ctx, -w * 0.5 + i * (w * 1.1 / (n - 1)), L.fore + 0.05, cobra ? 1.1 : 0.9 + (big ? 0.3 : 0), -0.25 + i * 0.12, 0.12);
  });
  sp.upperB = tintSprite(sp.upperF, '#020304', 0.42);
  sp.foreB = tintSprite(sp.foreF, '#020304', 0.42);

  // ---- gambe
  const legW = big ? 0.95 : cobra ? 0.6 : 0.78;
  sp.thighF = makeSprite([-1.3, -0.8, 1.3, L.thigh + 0.6], S, (ctx) => thighPart(ctx, K, L.thigh, legW));
  sp.shinF = makeSprite([-1.0, -0.6, 1.0, L.shin + 0.5], S, (ctx) => shinPart(ctx, K, L.shin, legW * 0.75));
  sp.footF = makeSprite([-1.2, -0.7, 1.9, 0.9], S, (ctx) => footPart(ctx, K, legW * 0.7));
  sp.thighB = tintSprite(sp.thighF, '#020304', 0.42);
  sp.shinB = tintSprite(sp.shinF, '#020304', 0.42);
  sp.footB = tintSprite(sp.footF, '#020304', 0.42);

  // ---- coda
  const n = b.tail || 6;
  const tail = [];
  let r = big ? 0.95 : cobra ? 0.6 : 0.8;
  for (let i = 0; i < n; i++) {
    const len = (cobra ? 1.05 : 1.2) * (1 - i * 0.04);
    const r1 = r * 0.84;
    const last = i === n - 1;
    const segSp = makeSprite([-len - 0.6, -r - 1.2, 0.4, r + 0.4], S, (ctx) => {
      tailPart(ctx, K, len, r, last ? 0.08 : r1, { spike: i % 2 === 0 && !cobra ? 0.55 * r + 0.1 : 0, spots: i % 2 === 1 });
      if (last && b.head === 'shark') {
        // pinna caudale
        flesh(ctx, [[-len + 0.2, 0], [-len - 0.8, -1.0], [-len - 0.5, 0.0], [-len - 0.7, 0.6]], K, { belly: false, scales: false });
      }
    });
    tail.push({ sprite: segSp, len });
    r = r1;
  }
  sp.tail = tail;

  return {
    sprites: sp,
    form: 'biped',
    L,
    layout: {
      neck: [2.55, -3.05],
      jaw: [0.35, 0.3],
      shoulderF: [1.6, -2.55],
      shoulderB: [1.15, -2.75],
      hipF: [0.15, 0.25],
      hipB: [-0.35, 0.1],
      tail: [-1.4, -0.15],
      mouth: [H[0] * 0.8, 0.1],
      head: H,
    },
    rest: { hipF: 0.5, kneeF: 1.25, hipB: 0.25, kneeB: 1.2 },
  };
}

function quadArt(def, K, S) {
  const b = def.body;
  const sp = {};
  const crab = b.head === 'crab';
  const L = { thigh: crab ? 2.0 : 1.9, shin: crab ? 2.3 : 1.9, footH: 0.4, upper: 1.7, fore: 1.6 };

  sp.body = makeSprite([-3.8, -4.4, 3.8, 1.8], S, (ctx) => {
    if (crab) {
      // carapace
      flesh(ctx, [[-2.9, 0.4], [-2.6, -0.8], [2.6, -0.8], [3.0, 0.3], [2.2, 1.2], [-2.2, 1.2]], K, { veins: 3, bellyAt: 0.3 });
      shell(ctx, [[-3.3, 0.1], [-2.8, -1.6], [-1.2, -2.55], [1.0, -2.6], [2.8, -1.6], [3.4, 0.0], [2.6, 0.45], [-2.7, 0.5]], K, { veins: 4 });
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-2.5 + i * 1.5, -0.1);
        ctx.quadraticCurveTo(-2.2 + i * 1.5, -1.7, -1.6 + i * 1.4, -2.45);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 0.06;
        ctx.stroke();
      }
      for (let i = 0; i < 7; i++) spike(ctx, -2.9 + i * 0.95, -0.1 + Math.abs(i - 3) * -0.05 - (i > 0 && i < 6 ? 0 : 0), 0.45, i < 3 ? -1.3 : 1.3, 0.12, BONE);
      for (let i = 0; i < 5; i++) spike(ctx, -1.6 + i * 0.8, -2.4 - Math.sin((i / 4) * Math.PI) * 0.15, 0.5, -0.1 + i * 0.05, 0.13, BONE, K.glow);
    } else {
      // colosso quadrupede con cristalli
      for (let i = 0; i < (b.spikes || 0); i++) {
        const t = i / Math.max(1, b.spikes - 1);
        spike(ctx, -2.6 + t * 4.6, -1.9 - Math.sin(t * Math.PI) * 1.1, 0.9 + Math.sin(t * Math.PI) * 1.2, -0.25 + t * 0.4, 0.26, shade(K.glow, -0.15), K.glow);
      }
      flesh(ctx, [[-3.3, 0.2], [-3.0, -1.3], [-1.5, -2.4], [0.5, -3.0], [2.2, -2.6], [3.2, -1.4], [3.3, 0.2], [2.4, 1.3], [0.0, 1.55], [-2.4, 1.2]], K, { veins: 8, bellyAt: 0.58 });
      for (let i = 0; i < 4; i++) shell(ctx, [[1.3 + i * 0.35, -2.6 + i * 0.3], [2.1 + i * 0.3, -2.4 + i * 0.35], [2.0 + i * 0.3, -1.9 + i * 0.35], [1.3 + i * 0.3, -2.0 + i * 0.3]], K, { color: shade(K.skin, 0.12) });
      spots(ctx, [[-1.5, -0.8, 0.08], [-0.5, -1.3, 0.1], [0.6, -1.4, 0.08], [1.6, -1.0, 0.07], [-2.3, -0.3, 0.06]], K);
    }
  });

  // testa
  const HL = crab ? 1.6 : 2.5;
  sp.head = makeSprite([-1.0, -2.6, HL + 1.4, 1.2], S, (ctx) => {
    if (crab) {
      for (const [x, h] of [[0.45, 1.5], [0.85, 1.2]]) {
        ctx.beginPath();
        ctx.moveTo(x, -0.3);
        ctx.quadraticCurveTo(x - 0.25, -h * 0.6, x + 0.1, -h);
        ctx.strokeStyle = shade(K.skin, -0.05);
        ctx.lineWidth = 0.14;
        ctx.stroke();
        ctx.lineWidth = 0.04;
        ctx.strokeStyle = '#050607';
        ctx.stroke();
        eye(ctx, x + 0.1, -h - 0.05, 0.12, K, false);
      }
      shell(ctx, [[-0.4, -0.5], [0.8, -0.65], [1.6, -0.3], [1.5, 0.4], [0.2, 0.55], [-0.5, 0.3]], K, { veins: 1 });
      for (let i = 0; i < 2; i++) claw(ctx, 1.3 + i * 0.1, 0.25 + i * 0.12, 0.6, -0.8 - i * 0.3, 0.07, '#2a2520');
    } else {
      // corna
      ctx.save();
      for (const [x, y, s, a] of [[0.2, -0.75, 1, -0.6], [-0.1, -0.6, 0.8, -0.9]]) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 0.6 * s, y - 1.4 * s, x + 1.6 * s, y - 1.5 * s);
        ctx.quadraticCurveTo(x + 0.9 * s, y - 0.9 * s, x + 0.55 * s, y + 0.15);
        ctx.closePath();
        const g = ctx.createLinearGradient(x, y, x + 1.6 * s, y - 1.5 * s);
        g.addColorStop(0, shade(BONE, -0.3));
        g.addColorStop(1, BONE);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = 0.04;
        ctx.strokeStyle = '#050607';
        ctx.stroke();
        void a;
      }
      ctx.restore();
      flesh(ctx, [[-0.5, -0.55], [0.7, -0.95], [1.8, -0.75], [HL, -0.2, 1], [HL - 0.2, 0.35], [0.8, 0.5], [-0.4, 0.45]], K, { veins: 2, bellyAt: 0.7, scaleSize: 0.15 });
      spike(ctx, HL - 0.5, -0.55, 0.8, 0.6, 0.18, BONE, K.glow);
      eye(ctx, 1.1, -0.4, 0.1, K);
      teeth(ctx, 0.9, 0.38, HL - 0.25, 0.25, 7, 0.22, 1);
    }
  });
  sp.jaw = makeSprite([-0.6, -0.4, HL + 0.4, 1.0], S, (ctx) => {
    mouthGlow(ctx, [[0.0, -0.05], [HL * 0.85, -0.1], [HL * 0.7, 0.2], [0.1, 0.2]], K);
    flesh(ctx, [[-0.3, -0.05], [0.4, 0.05], [HL * 0.9, -0.05, 1], [HL * 0.6, 0.4], [0.2, 0.45]], K, { bellyAt: 0.3, scaleSize: 0.13 });
    if (!crab) teeth(ctx, 0.5, 0.02, HL * 0.85, -0.03, 6, 0.2, -1);
  });

  // zampe
  const legW = crab ? 0.38 : 0.85;
  if (crab) {
    sp.thighF = makeSprite([-0.8, -0.7, 0.8, L.thigh + 0.5], S, (ctx) => {
      shell(ctx, [[-legW, -0.3], [legW, -0.35], [legW * 0.7, L.thigh + 0.1], [-legW * 0.7, L.thigh + 0.1]], K, { veins: 1 });
      spike(ctx, legW * 0.6, L.thigh * 0.4, 0.35, 1.2, 0.08, BONE);
    });
    sp.shinF = makeSprite([-0.8, -0.5, 0.8, L.shin + 0.4], S, (ctx) => {
      shell(ctx, [[-legW * 0.8, -0.2], [legW * 0.8, -0.25], [0.05, L.shin + 0.25, 1]], K, { veins: 1 });
      spike(ctx, legW * 0.5, L.shin * 0.35, 0.3, 1.3, 0.07, BONE);
    });
    sp.footF = makeSprite([-0.3, -0.3, 0.3, 0.3], S, () => {});
  } else {
    sp.thighF = makeSprite([-1.4, -0.9, 1.4, L.thigh + 0.6], S, (ctx) => thighPart(ctx, K, L.thigh, legW));
    sp.shinF = makeSprite([-1.1, -0.6, 1.1, L.shin + 0.5], S, (ctx) => shinPart(ctx, K, L.shin, legW * 0.8));
    sp.footF = makeSprite([-1.3, -0.7, 2.0, 0.9], S, (ctx) => footPart(ctx, K, legW * 0.75, 3));
  }
  sp.thighB = tintSprite(sp.thighF, '#020304', 0.42);
  sp.shinB = tintSprite(sp.shinF, '#020304', 0.42);
  sp.footB = tintSprite(sp.footF, '#020304', 0.42);

  // chele (Krakos)
  if (b.arms === 'pincers') {
    sp.upperF = makeSprite([-0.9, -0.8, 0.9, L.upper + 0.5], S, (ctx) => shell(ctx, [[-0.55, -0.35], [0.55, -0.4], [0.45, L.upper + 0.2], [-0.45, L.upper + 0.2]], K, { veins: 1 }));
    sp.foreF = makeSprite([-1.2, -0.6, 1.3, L.fore + 2.6], S, (ctx) => {
      shell(ctx, [[-0.5, -0.3], [0.55, -0.35], [0.75, L.fore * 0.5], [0.5, L.fore + 0.2], [-0.5, L.fore + 0.2]], K, { veins: 1 });
      // chela fissa
      shell(ctx, [[-0.65, L.fore], [0.75, L.fore - 0.1], [1.0, L.fore + 1.0], [0.55, L.fore + 2.5, 1], [0.25, L.fore + 1.1], [-0.45, L.fore + 1.2]], K, { veins: 2 });
      teeth(ctx, 0.35, L.fore + 1.2, 0.5, L.fore + 2.2, 5, 0.18, 1);
    });
    sp.pinch = makeSprite([-1.0, -0.4, 0.6, 2.4], S, (ctx) => {
      shell(ctx, [[-0.35, -0.2], [0.3, -0.2], [0.1, 1.0], [-0.55, 2.1, 1], [-0.6, 0.9]], K, { color: shade(K.skin, 0.02) });
      teeth(ctx, 0.05, 0.4, -0.35, 1.7, 4, 0.15, 1);
    });
    sp.upperB = tintSprite(sp.upperF, '#020304', 0.42);
    sp.foreB = tintSprite(sp.foreF, '#020304', 0.42);
    sp.pinchB = tintSprite(sp.pinch, '#020304', 0.42);
  }

  // coda
  const n = b.tail || 4;
  const tail = [];
  let r = crab ? 0.6 : 0.85;
  for (let i = 0; i < n; i++) {
    const len = crab ? 0.8 : 1.15;
    const r1 = r * 0.8;
    const last = i === n - 1;
    tail.push({
      len,
      sprite: makeSprite([-len - 0.8, -r - 1.2, 0.4, r + 0.4], S, (ctx) => {
        if (crab) shell(ctx, [[0.15, -r], [-len, -r1], [-len - 0.1, r1], [0.15, r]], K, {});
        else tailPart(ctx, K, len, r, last ? 0.12 : r1, { spike: 0.5 + r * 0.4, spikeGlow: K.glow });
        if (last && !crab) for (let k = 0; k < 4; k++) spike(ctx, -len, 0, 0.7, -1.6 + k * 0.9, 0.12, BONE, K.glow);
      }),
    });
    r = r1;
  }
  sp.tail = tail;

  return {
    sprites: sp,
    form: 'quad',
    L,
    layout: {
      head: [HL, 1],
      neck: crab ? [2.9, -0.35] : [3.1, -1.0],
      jaw: [0.3, 0.32],
      hips: crab
        ? { fF: [2.0, 0.5], fB: [1.4, 0.35], bF: [-1.6, 0.5], bB: [-2.2, 0.35] }
        : { fF: [2.0, 0.7], fB: [1.5, 0.55], bF: [-1.8, 0.7], bB: [-2.3, 0.55] },
      shoulderF: [2.4, 0.2],
      shoulderB: [2.0, 0.0],
      tail: crab ? [-2.9, 0.1] : [-3.1, -0.3],
      mouth: [HL * 0.8, 0.1],
    },
    rest: crab ? { hip: 0.75, knee: 1.55 } : { hip: 0.15, knee: 0.35 },
  };
}

/** Costruisce tutti gli sprite del Kaiju. */
export function buildKaijuArt(def, S = 64) {
  const K = { skin: def.skin, belly: def.belly, glow: def.glow, seed: def.name.length * 131 };
  const res = Math.round(S * Math.min(1.25, def.size));
  const art = def.body.form === 'quad' ? quadArt(def, K, res) : bipedArt(def, K, res);
  art.size = def.size;
  art.glow = def.glow;
  return art;
}

