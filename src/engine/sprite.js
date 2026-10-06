// Sprite pre-disegnati: ogni pezzo di robot o Kaiju viene disegnato una sola volta
// su una tela fuori schermo e poi riusato a ogni fotogramma (veloce anche sui telefoni).

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/**
 * Crea uno sprite. bounds = [x0, y0, x1, y1] in unita' di gioco attorno al perno (0,0).
 * S = pixel per unita'. draw(ctx) disegna in unita' con il perno nell'origine.
 */
export function makeSprite(bounds, S, draw, pad = 0.3) {
  const [x0, y0, x1, y1] = bounds;
  const ox = x0 - pad;
  const oy = y0 - pad;
  const w = x1 - x0 + pad * 2;
  const h = y1 - y0 + pad * 2;
  const canvas = makeCanvas(w * S, h * S);
  const ctx = canvas.getContext('2d');
  ctx.__S = S;
  ctx.scale(S, S);
  ctx.translate(-ox, -oy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  return { canvas, ox, oy, w: canvas.width / S, h: canvas.height / S, S };
}

/** Variante colorata (es. bianca per il lampo dei colpi, scura per gli arti lontani). */
export function tintSprite(sp, color, alpha = 1) {
  const canvas = makeCanvas(sp.canvas.width, sp.canvas.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sp.canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { ...sp, canvas };
}

export function drawSprite(ctx, sp) {
  if (sp) ctx.drawImage(sp.canvas, sp.ox, sp.oy, sp.w, sp.h);
}

export { makeCanvas };

const glowCache = new Map();

/** Alone luminoso radiale colorato (da disegnare in modalita' 'lighter'). */
export function glowSprite(color, size = 64) {
  const key = color + size;
  if (glowCache.has(key)) return glowCache.get(key);
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.18, color);
  grad.addColorStop(0.45, color + '66');
  grad.addColorStop(1, color + '00');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowCache.set(key, c);
  return c;
}
