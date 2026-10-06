// Effetti 2D: scintille, sangue luminoso dei Kaiju, schizzi d'acqua, fumo, onde d'urto, scariche elettriche.
import { glowSprite } from './sprite.js';
import { hexToRgb } from './color.js';

const TAU = Math.PI * 2;

export class FX {
  constructor(quality) {
    this.q = quality.particles ?? 1;
    this.max = Math.round(900 * this.q);
    this.parts = [];
    this.rings = [];
    this.flashes = [];
    this.arcs = [];
    this.markers = new Set();
    this.time = 0;
  }

  _n(n) {
    return Math.max(1, Math.round(n * this.q));
  }

  _add(p) {
    if (this.parts.length >= this.max) this.parts[Math.floor(Math.random() * this.parts.length)] = p;
    else this.parts.push(p);
  }

  /** Particella generica. type: spark | glow | drop | smoke | debris */
  emit(type, x, y, vx, vy, life, size, color = '#ffffff', o = {}) {
    this._add({ type, x, y, vx, vy, life, max: life, size, size1: o.size1 ?? size, color, g: o.g ?? 0, drag: o.drag ?? 0, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10 });
  }

  sparks(x, y, color = '#ffb347', n = 24, speed = 16, dir = 0) {
    for (let i = 0; i < this._n(n); i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.35 + Math.random());
      const vx = Math.cos(a) * s + dir * speed * 0.6;
      this.emit('spark', x, y, vx, Math.sin(a) * s + 4, 0.25 + Math.random() * 0.4, 0.06 + Math.random() * 0.06, color, { g: -28, drag: 1.5 });
    }
    this.flash(x, y, color, 3.2);
  }

  blood(x, y, color, n = 26, dir = 0) {
    for (let i = 0; i < this._n(n); i++) {
      const a = Math.random() * TAU;
      const s = 3 + Math.random() * 11;
      this.emit('glow', x, y, Math.cos(a) * s + dir * 6, Math.sin(a) * s + 5, 0.5 + Math.random() * 0.6, 0.35 + Math.random() * 0.5, color, { g: -22, drag: 0.6, size1: 0.12 });
    }
  }

  splash(x, size = 1, y = 0) {
    for (let i = 0; i < this._n(16 * size); i++) {
      const vx = (Math.random() - 0.5) * 9 * size;
      this.emit('drop', x + (Math.random() - 0.5) * 1.5 * size, y + 0.1, vx, 4 + Math.random() * 9 * size, 0.5 + Math.random() * 0.45, 0.05 + Math.random() * 0.06 * Math.sqrt(size), '#cfe2f2', { g: -26 });
    }
    this.ring(x, y, 0.3 * size, 3.5 * size, 0.9, '#9fc0dd', 0.5);
  }

  smoke(x, y, n = 8, color = '#262a31', size = 1.5) {
    for (let i = 0; i < this._n(n); i++) {
      this.emit('smoke', x + (Math.random() - 0.5) * 1.5, y + (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 2.5, 1.5 + Math.random() * 2.5, 1.2 + Math.random(), size, color, { g: 0.5, drag: 0.8, size1: size * 2.6 });
    }
  }

  debris(x, y, n = 8, color = '#3a4049') {
    for (let i = 0; i < this._n(n); i++) {
      const a = Math.random() * TAU;
      const s = 4 + Math.random() * 10;
      this.emit('debris', x, y, Math.cos(a) * s, Math.abs(Math.sin(a)) * s + 4, 0.8 + Math.random() * 0.6, 0.1 + Math.random() * 0.14, color, { g: -25 });
    }
  }

  explosion(x, y, size = 1, color = '#ff8a2a') {
    for (let i = 0; i < this._n(30 * size); i++) {
      const a = Math.random() * TAU;
      const s = (5 + Math.random() * 12) * size;
      this.emit('glow', x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.4, (0.6 + Math.random() * 0.9) * size, color, { drag: 2.5, size1: 0.1 });
    }
    this.sparks(x, y, '#ffd27a', 18 * size, 18 * size);
    this.smoke(x, y, 8 * size, '#1d1f24', 1.4 * size);
    this.flash(x, y, color, 9 * size);
    this.ring(x, Math.max(0, y), 0.5, 7 * size, 0.6, color, 0.9);
  }

  shockwave(x, color, radius = 10, life = 0.6, y = 0) {
    this.ring(x, y, 0.5, radius, life, color, 1, 0.22);
    this.ring(x, y, 0.3, radius * 0.7, life * 0.7, '#ffffff', 0.7, 0.22);
    for (let i = 0; i < this._n(30); i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.emit('glow', x, y + 0.3, dir * radius * (1.5 + Math.random()), 1 + Math.random() * 4, life, 0.45, color, { drag: 2, size1: 0.1 });
    }
    this.splash(x, radius / 4, y);
  }

  electric(x, y, color, radius = 3, n = 3, life = 0.15) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      this.arcs.push({ x0: x, y0: y, x1: x + Math.cos(a) * radius, y1: y + Math.sin(a) * radius, life, max: life, color });
    }
  }

  bolt(x0, y0, x1, y1, color, life = 0.12) {
    this.arcs.push({ x0, y0, x1, y1, life, max: life, color });
  }

  trail(x, y, color, size = 0.5, life = 0.3) {
    this.emit('glow', x, y, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, life, size, color, { size1: size * 0.2 });
  }

  flash(x, y, color = '#ffffff', size = 4) {
    this.flashes.push({ x, y, color, size, life: 0.16, max: 0.16 });
  }

  ring(x, y, r0, r1, life, color, alpha = 1, squash = 0.2) {
    this.rings.push({ x, y, r0, r1, life, max: life, color, alpha, squash });
  }

  /** Cerchio di avviso sull'acqua per gli attacchi ad area. */
  marker(x, radius, color = '#ff3030') {
    const m = { x, radius, color, t: 0 };
    this.markers.add(m);
    return m;
  }

  removeMarker(m) {
    if (m) this.markers.delete(m);
  }

  update(dt) {
    this.time += dt;
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) {
        P[i] = P[P.length - 1];
        P.pop();
        continue;
      }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.type === 'drop' && p.y < 0 && p.vy < 0) p.life = Math.min(p.life, 0.05);
    }
    for (const list of [this.rings, this.flashes, this.arcs]) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].life -= dt;
        if (list[i].life <= 0) list.splice(i, 1);
      }
    }
    for (const m of this.markers) m.t += dt;
  }

  /** Effetti sulla superficie dell'acqua (anelli e marcatori): vanno disegnati prima dei combattenti. */
  drawGround(ctx, cam, W, H) {
    const k = cam.ppu(H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.markers) {
      const [sx, sy] = cam.toScreen(m.x, 0, W, H);
      const a = 0.45 + 0.4 * Math.sin(m.t * 16);
      ctx.strokeStyle = m.color;
      ctx.globalAlpha = a;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(sx, sy, m.radius * k, m.radius * k * 0.16, 0, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = a * 0.25;
      ctx.fillStyle = m.color;
      ctx.fill();
    }
    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      const rad = (r.r0 + (r.r1 - r.r0) * (1 - (1 - t) * (1 - t))) * k;
      const [sx, sy] = cam.toScreen(r.x, r.y, W, H);
      ctx.globalAlpha = r.alpha * (1 - t);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(1.5, (1 - t) * 0.25 * k);
      ctx.beginPath();
      ctx.ellipse(sx, sy, rad, rad * r.squash, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  draw(ctx, cam, W, H) {
    const k = cam.ppu(H);
    ctx.save();
    // fumo e gocce (fusione normale)
    for (const p of this.parts) {
      if (p.type !== 'smoke' && p.type !== 'drop' && p.type !== 'debris') continue;
      const t = p.life / p.max;
      const [sx, sy] = cam.toScreen(p.x, p.y, W, H);
      const s = (p.size1 + (p.size - p.size1) * t) * k;
      if (p.type === 'smoke') {
        ctx.globalAlpha = Math.min(1, t * 1.5) * 0.45;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, s, 0, TAU);
        ctx.fill();
      } else if (p.type === 'drop') {
        // goccia come breve scia nella direzione del moto
        ctx.globalAlpha = Math.min(1, t * 2) * 0.6;
        ctx.strokeStyle = p.color;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1, Math.min(p.size * k, k * 0.14));
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - p.vx * 0.03 * k, sy + p.vy * 0.03 * k);
        ctx.stroke();
      } else {
        ctx.globalAlpha = Math.min(1, t * 2);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.rot);
        ctx.fillRect(-s, -s * 0.6, s * 2, s * 1.2);
        ctx.restore();
      }
    }
    // luci (fusione additiva)
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      if (p.type !== 'glow' && p.type !== 'spark') continue;
      const t = p.life / p.max;
      const [sx, sy] = cam.toScreen(p.x, p.y, W, H);
      if (p.type === 'spark') {
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.size * k);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - p.vx * k * 0.035, sy + p.vy * k * 0.035);
        ctx.stroke();
      } else {
        const s = (p.size1 + (p.size - p.size1) * t) * k * 2;
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.drawImage(glowSprite(p.color), sx - s / 2, sy - s / 2, s, s);
      }
    }
    for (const f of this.flashes) {
      const t = f.life / f.max;
      const [sx, sy] = cam.toScreen(f.x, f.y, W, H);
      const s = f.size * k * (1.4 - t * 0.4);
      ctx.globalAlpha = t;
      ctx.drawImage(glowSprite(f.color), sx - s / 2, sy - s / 2, s, s);
    }
    for (const a of this.arcs) {
      const [x0, y0] = cam.toScreen(a.x0, a.y0, W, H);
      const [x1, y1] = cam.toScreen(a.x1, a.y1, W, H);
      ctx.globalAlpha = a.life / a.max;
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = a.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      const n = 7;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        ctx.lineTo(x0 + (x1 - x0) * t + (Math.random() - 0.5) * 0.6 * k, y0 + (y1 - y0) * t + (Math.random() - 0.5) * 0.6 * k);
      }
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  clear() {
    this.parts.length = 0;
    this.rings.length = 0;
    this.flashes.length = 0;
    this.arcs.length = 0;
    this.markers.clear();
  }
}

export { hexToRgb };
