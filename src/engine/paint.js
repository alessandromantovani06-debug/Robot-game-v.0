// Strumenti di disegno per corazze, giunti, pistoni e luci.
// Tutte le misure sono in unita' di gioco (lo sprite e' gia' scalato).
import { shade, rgba, rng } from './color.js';

/** Poligono chiuso con angoli arrotondati. pts = [[x, y, raggio?], ...] */
export function path(ctx, pts, r = 0) {
  const n = pts.length;
  ctx.beginPath();
  if (!r && pts.every((p) => !p[2])) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    return;
  }
  const a = pts[n - 1];
  const b = pts[0];
  ctx.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const rr = p[2] ?? r;
    ctx.arcTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, rr);
  }
  ctx.closePath();
}

export function bbox(pts) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** Rettangolo come lista di punti. */
export const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

function specular(ctx, bb, spec) {
  if (spec <= 0) return;
  const g = ctx.createLinearGradient(bb.x0, bb.y0, bb.x0 + bb.w * 0.8, bb.y0 + bb.h);
  const s = (a) => `rgba(255,255,255,${a * spec})`;
  g.addColorStop(0, s(0));
  g.addColorStop(0.22, s(0));
  g.addColorStop(0.3, s(0.42));
  g.addColorStop(0.36, s(0.08));
  g.addColorStop(0.4, s(0));
  g.addColorStop(0.58, s(0));
  g.addColorStop(0.62, s(0.18));
  g.addColorStop(0.66, s(0));
  g.addColorStop(1, s(0));
  ctx.fillStyle = g;
  ctx.fillRect(bb.x0 - 1, bb.y0 - 1, bb.w + 2, bb.h + 2);
}

function wear(ctx, bb, amount, seed) {
  if (amount <= 0) return;
  const g = ctx.createLinearGradient(0, bb.y0 + bb.h * 0.45, 0, bb.y1);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(10,8,6,${0.32 * amount})`);
  ctx.fillStyle = g;
  ctx.fillRect(bb.x0 - 1, bb.y0, bb.w + 2, bb.h + 1);
  const rand = rng(seed);
  ctx.lineWidth = 0.012;
  const n = Math.round(4 + bb.w * bb.h * 3 * amount);
  for (let i = 0; i < n; i++) {
    const x = bb.x0 + rand() * bb.w;
    const y = bb.y0 + rand() * bb.h;
    const l = 0.05 + rand() * 0.22;
    ctx.strokeStyle = rand() > 0.4 ? `rgba(255,255,255,${0.1 + rand() * 0.16})` : `rgba(0,0,0,${0.15 + rand() * 0.2})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + l * (rand() - 0.3), y + l * (rand() - 0.5) * 0.5);
    ctx.stroke();
  }
  // macchie di colatura della pioggia
  for (let i = 0; i < Math.round(bb.w * 2 * amount); i++) {
    const x = bb.x0 + rand() * bb.w;
    const y = bb.y0 + rand() * bb.h * 0.5;
    const h = 0.2 + rand() * bb.h * 0.5;
    const gg = ctx.createLinearGradient(0, y, 0, y + h);
    gg.addColorStop(0, 'rgba(0,0,0,0.16)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(x, y, 0.025 + rand() * 0.03, h);
  }
}

/**
 * Piastra di corazza: gradiente, riflesso metallico, smussatura, usura, contorno.
 * o: { r, spec, bevel, wear, livery(ctx, bb), line, outline, dark, light }
 */
export function plate(ctx, pts, color, o = {}) {
  const r = o.r ?? 0.1;
  const bb = bbox(pts);
  path(ctx, pts, r);
  const g = ctx.createLinearGradient(bb.x0, bb.y0, bb.x0 + bb.w * 0.35, bb.y1);
  g.addColorStop(0, shade(color, o.light ?? 0.13));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shade(color, -(o.dark ?? 0.17)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (o.livery) o.livery(ctx, bb);
  specular(ctx, bb, o.spec ?? 0.6);
  wear(ctx, bb, o.wear ?? 0.6, Math.round((bb.x0 * 37 + bb.y0 * 91 + bb.w * 13) * 1000));
  const bv = o.bevel ?? 0.07;
  ctx.lineWidth = bv * 2;
  ctx.translate(bv * 0.8, bv);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  path(ctx, pts, r);
  ctx.stroke();
  ctx.translate(-bv * 1.6, -bv * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.32)';
  path(ctx, pts, r);
  ctx.stroke();
  ctx.restore();
  ctx.lineWidth = o.line ?? 0.045;
  ctx.strokeStyle = o.outline ?? '#06080b';
  path(ctx, pts, r);
  ctx.stroke();
  return bb;
}

/** Linea di giunzione tra pannelli (scura con riflesso chiaro). */
export function seam(ctx, pts, alpha = 1) {
  ctx.lineWidth = 0.035;
  ctx.strokeStyle = `rgba(0,0,0,${0.55 * alpha})`;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.lineWidth = 0.015;
  ctx.strokeStyle = `rgba(255,255,255,${0.18 * alpha})`;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 0.03) : ctx.moveTo(x, y + 0.03)));
  ctx.stroke();
}

export function bolt(ctx, x, y, r = 0.045) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#16191e';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fill();
}

export function bolts(ctx, list, r) {
  for (const [x, y] of list) bolt(ctx, x, y, r);
}

/** Fila di bolts lungo un segmento. */
export function boltLine(ctx, x0, y0, x1, y1, n, r) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    bolt(ctx, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r);
  }
}

/** Prese d'aria (feritoie). */
export function vents(ctx, x, y, w, h, n, o = {}) {
  ctx.fillStyle = o.back ?? '#0c0e12';
  path(ctx, rect(x, y, w, h), Math.min(w, h) * 0.2);
  ctx.fill();
  const vertical = o.vertical;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    ctx.fillStyle = o.glow ? o.glow : '#3a4049';
    if (vertical) {
      const xx = x + w * t;
      ctx.fillRect(xx - w / n / 4, y + h * 0.12, w / n / 2.2, h * 0.76);
    } else {
      const yy = y + h * t;
      ctx.fillRect(x + w * 0.08, yy - h / n / 4, w * 0.84, h / n / 2.4);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + w * 0.08, yy - h / n / 4, w * 0.84, h / n / 10);
    }
  }
}

/** Cilindro/pistone tra due punti, con ombreggiatura cilindrica. */
export function cylinder(ctx, x0, y0, x1, y1, r, color, o = {}) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(ang);
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, shade(color, -0.12));
  g.addColorStop(0.25, shade(color, 0.28));
  g.addColorStop(0.45, shade(color, 0.08));
  g.addColorStop(1, shade(color, -0.3));
  ctx.fillStyle = g;
  path(ctx, rect(0, -r, len, r * 2), o.round ?? r * 0.6);
  ctx.fill();
  ctx.lineWidth = 0.035;
  ctx.strokeStyle = '#06080b';
  ctx.stroke();
  if (o.rings) {
    for (let i = 1; i <= o.rings; i++) {
      const xx = (len * i) / (o.rings + 1);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(xx - 0.025, -r, 0.05, r * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(xx + 0.025, -r, 0.02, r * 2);
    }
  }
  if (o.rod) {
    // asta cromata del pistone
    const rr = r * 0.45;
    const rg = ctx.createLinearGradient(0, -rr, 0, rr);
    rg.addColorStop(0, '#6b737d');
    rg.addColorStop(0.3, '#f2f6fa');
    rg.addColorStop(1, '#4a5058');
    ctx.fillStyle = rg;
    ctx.fillRect(len, -rr, o.rod, rr * 2);
    ctx.strokeStyle = '#06080b';
    ctx.lineWidth = 0.03;
    ctx.strokeRect(len, -rr, o.rod, rr * 2);
  }
  ctx.restore();
}

/** Giunto circolare (snodo) con anello e bulloni. */
export function joint(ctx, x, y, r, color = '#4a525e', o = {}) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, shade(color, 0.3));
  g.addColorStop(0.6, color);
  g.addColorStop(1, shade(color, -0.25));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 0.04;
  ctx.strokeStyle = '#06080b';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = r * 0.12;
  ctx.stroke();
  if (o.glow) {
    glow(ctx, o.glow, 0.25, () => {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = o.glow;
      ctx.fill();
    });
  } else {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = shade(color, -0.2);
    ctx.fill();
  }
  const nb = o.bolts ?? 6;
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2;
    bolt(ctx, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.08);
  }
}

/** Disegna con alone luminoso (shadowBlur e' in pixel: si converte dalle unita'). */
export function glow(ctx, color, blur, fn) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * (ctx.__S || 1);
  fn();
  ctx.restore();
}

/** Luce di segnalazione puntiforme. */
export function light(ctx, x, y, r, color) {
  glow(ctx, color, r * 6, () => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
}

/** Superficie luminosa (visore, nucleo, lama) con gradiente e alone. */
export function glowShape(ctx, pts, color, o = {}) {
  const bb = bbox(pts);
  glow(ctx, color, o.blur ?? 0.35, () => {
    path(ctx, pts, o.r ?? 0.04);
    const g = ctx.createLinearGradient(bb.x0, bb.y0, bb.x0, bb.y1);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, color);
    g.addColorStop(1, shade(color, -0.15));
    ctx.fillStyle = g;
    ctx.fill();
  });
}

/** Tubo idraulico flessibile. */
export function hose(ctx, pts, w = 0.12, color = '#1d2026') {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const draw = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 3) ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
    else if (pts.length === 4) ctx.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
    else pts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.stroke();
  };
  ctx.lineWidth = w + 0.05;
  ctx.strokeStyle = '#05070a';
  draw();
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  draw();
  ctx.lineWidth = w * 0.3;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.translate(-w * 0.15, -w * 0.15);
  draw();
  ctx.restore();
}

/** Fascia con strisce di pericolo giallo/nere. */
export function hazard(ctx, pts, stripe = 0.18) {
  const bb = bbox(pts);
  ctx.save();
  path(ctx, pts, 0.03);
  ctx.clip();
  ctx.fillStyle = '#e8b81a';
  ctx.fillRect(bb.x0, bb.y0, bb.w, bb.h);
  ctx.fillStyle = '#15171a';
  for (let x = bb.x0 - bb.h; x < bb.x1 + bb.h; x += stripe * 2) {
    ctx.beginPath();
    ctx.moveTo(x, bb.y1);
    ctx.lineTo(x + stripe, bb.y1);
    ctx.lineTo(x + stripe + bb.h, bb.y0);
    ctx.lineTo(x + bb.h, bb.y0);
    ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = 0.03;
  ctx.strokeStyle = '#06080b';
  path(ctx, pts, 0.03);
  ctx.stroke();
}

/** Testo dipinto (sigla del Titano). */
export function stencil(ctx, text, x, y, size, color = '#ffffff', angle = 0, mirror = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // sprite che verra' disegnato specchiato: la scritta va invertita per restare leggibile
  if (mirror) ctx.scale(-1, 1);
  ctx.font = `900 ${size}px Orbitron, "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Livree applicate alle corazze principali. */
export function liveryFn(pattern, secondary, seed = 1) {
  if (!pattern || pattern === 'none') return null;
  return (ctx, bb) => {
    const rand = rng(seed + Math.round(bb.x0 * 100 + bb.y0 * 1000));
    if (pattern === 'stripes') {
      ctx.fillStyle = secondary;
      const y = bb.y0 + bb.h * 0.25;
      const t = Math.min(0.14, bb.h * 0.09);
      ctx.beginPath();
      ctx.moveTo(bb.x0 - 1, y + 0.2);
      ctx.lineTo(bb.x1 + 1, y - 0.12);
      ctx.lineTo(bb.x1 + 1, y - 0.12 + t);
      ctx.lineTo(bb.x0 - 1, y + 0.2 + t);
      ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(bb.x0 - 1, y + 0.2 + t * 1.6);
      ctx.lineTo(bb.x1 + 1, y - 0.12 + t * 1.6);
      ctx.lineTo(bb.x1 + 1, y - 0.12 + t * 1.9);
      ctx.lineTo(bb.x0 - 1, y + 0.2 + t * 1.9);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (pattern === 'hazard') {
      const h = Math.min(0.28, bb.h * 0.18);
      ctx.save();
      ctx.beginPath();
      ctx.rect(bb.x0 - 1, bb.y1 - h, bb.w + 2, h);
      ctx.clip();
      ctx.fillStyle = '#e8b81a';
      ctx.fillRect(bb.x0 - 1, bb.y1 - h, bb.w + 2, h);
      ctx.fillStyle = '#15171a';
      for (let x = bb.x0 - 1; x < bb.x1 + 1; x += 0.3) {
        ctx.beginPath();
        ctx.moveTo(x, bb.y1);
        ctx.lineTo(x + 0.15, bb.y1);
        ctx.lineTo(x + 0.15 + h, bb.y1 - h);
        ctx.lineTo(x + h, bb.y1 - h);
        ctx.fill();
      }
      ctx.restore();
    } else if (pattern === 'camo') {
      const cols = [secondary, 'rgba(0,0,0,0.28)', 'rgba(255,255,255,0.12)'];
      for (let i = 0; i < 6 + bb.w * bb.h * 4; i++) {
        ctx.fillStyle = cols[i % 3];
        ctx.beginPath();
        const x = bb.x0 + rand() * bb.w;
        const y = bb.y0 + rand() * bb.h;
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          const rr = 0.12 + rand() * 0.25;
          ctx.lineTo(x + Math.cos(a) * rr * 1.5, y + Math.sin(a) * rr);
        }
        ctx.fill();
      }
    } else if (pattern === 'split') {
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.moveTo(bb.x0 - 1, bb.y0 - 1);
      ctx.lineTo(bb.cx - bb.w * 0.1, bb.y0 - 1);
      ctx.lineTo(bb.cx + bb.w * 0.1, bb.y1 + 1);
      ctx.lineTo(bb.x0 - 1, bb.y1 + 1);
      ctx.fill();
    }
  };
}
