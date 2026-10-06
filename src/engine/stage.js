// Scenario 2D a strati (parallasse): cielo, nuvole, skyline, riflettori, mare, pioggia, fulmini.
import { makeCanvas, glowSprite } from './sprite.js';
import { shade, mix, rgba, rng } from './color.js';

const TAU = Math.PI * 2;

function setBlur(ctx, px) {
  if ('filter' in ctx) ctx.filter = px > 0 ? `blur(${px}px)` : 'none';
}

export class Stage {
  constructor(preset, quality) {
    this.p = preset;
    this.q = quality;
    this.time = 0;
    this.flash = 0;
    this.nextLightning = 3 + Math.random() * 6;
    this.onThunder = null;
    this.W = 0;
    this.H = 0;
    this.drops = [];
    this.bolt = null;
    this.helis = [];
    this.focusX = 0;
  }

  // ------------------------------------------------------------ costruzione dei livelli
  build(W, H) {
    if (Math.abs(W - this.W) < 4 && Math.abs(H - this.H) < 4 && this.sky) return;
    this.W = W;
    this.H = H;
    const p = this.p;
    const rand = rng(Math.round(p.fogDensity * 1e6) + 17);
    this.horizonFrac = 0.5;

    // cielo
    this.sky = makeCanvas(W, H);
    {
      const g = this.sky.getContext('2d');
      const hz = H * this.horizonFrac;
      const grad = g.createLinearGradient(0, 0, 0, hz);
      grad.addColorStop(0, p.skyTop);
      grad.addColorStop(0.65, p.skyBottom);
      grad.addColorStop(1, mix(p.skyBottom, p.horizon, 0.85));
      g.fillStyle = grad;
      g.fillRect(0, 0, W, hz + 2);
      if (p.moon > 0.55) {
        const mx = W * 0.78;
        const my = H * 0.16;
        const r = H * 0.045;
        const halo = g.createRadialGradient(mx, my, r * 0.5, mx, my, r * 7);
        halo.addColorStop(0, 'rgba(200,215,255,0.35)');
        halo.addColorStop(1, 'rgba(200,215,255,0)');
        g.fillStyle = halo;
        g.fillRect(0, 0, W, hz);
        g.beginPath();
        g.arc(mx, my, r, 0, TAU);
        g.fillStyle = '#e8eefc';
        g.fill();
        g.globalAlpha = 0.25;
        g.fillStyle = '#9aa6c0';
        for (let i = 0; i < 6; i++) {
          g.beginPath();
          g.arc(mx + (rand() - 0.5) * r, my + (rand() - 0.5) * r, r * (0.1 + rand() * 0.2), 0, TAU);
          g.fill();
        }
        g.globalAlpha = 1;
      }
    }

    // nuvole (larghe il doppio dello schermo, scorrono lentamente).
    // Si disegnano nitide e si sfocano una volta sola: il filtro per ogni forma e' lentissimo.
    {
      const cw = W * 2;
      const ch = H * 0.6;
      const raw = makeCanvas(cw, ch);
      const g = raw.getContext('2d');
      for (let i = 0; i < 70; i++) {
        const x = rand() * cw;
        const y = ch * (0.1 + rand() * 0.75);
        const rx = W * (0.05 + rand() * 0.18);
        const ry = rx * (0.18 + rand() * 0.2);
        const dark = shade(p.skyBottom, -0.03 - rand() * 0.05);
        const a = 0.55 + rand() * 0.35;
        for (const ox of [0, -cw, cw]) {
          if (x + ox + rx < 0 || x + ox - rx > cw) continue;
          g.fillStyle = rgba(dark, a);
          g.beginPath();
          g.ellipse(x + ox, y, rx, ry, 0, 0, TAU);
          g.fill();
          g.fillStyle = rgba(mix(p.horizon, '#ffffff', 0.15), 0.12);
          g.beginPath();
          g.ellipse(x + ox, y + ry * 0.4, rx * 0.8, ry * 0.4, 0, 0, TAU);
          g.fill();
        }
      }
      this.clouds = makeCanvas(cw, ch);
      const gc = this.clouds.getContext('2d');
      setBlur(gc, Math.max(4, H * 0.012));
      gc.drawImage(raw, 0, 0);
      setBlur(gc, 0);
    }

    const hzY = H * this.horizonFrac;
    const fog = p.fog;
    // skyline lontano
    const TW = Math.ceil(Math.max(1600, W * 1.4));
    this.far = makeCanvas(TW, H * 0.26);
    this.farTW = TW;
    if (p.city > 0) this._skyline(this.far, rand, { count: Math.round(70 * p.city), minW: 0.012, maxW: 0.035, minH: 0.2, maxH: 1, color: mix(fog, '#0a0d14', 0.55), windows: 0.12, neon: false });
    if (p.bridge) this._bridge(this.far);
    if (p.rift) this._rigs(this.far, rand);
    // skyline vicino
    this.mid = makeCanvas(TW, H * 0.4);
    if (p.city > 0) this._skyline(this.mid, rand, { count: Math.round(34 * p.city), minW: 0.03, maxW: 0.075, minH: 0.25, maxH: 1, color: '#0a0c12', windows: 0.42, neon: true });
    if (p.wall) this._wall(this.mid);
    // riflessi della citta' sull'acqua
    this.refl = makeCanvas(TW, H * 0.4 * 0.55);
    {
      const g = this.refl.getContext('2d');
      setBlur(g, Math.max(2, H * 0.004));
      g.save();
      g.translate(0, this.refl.height);
      g.scale(1, -0.55);
      g.globalAlpha = 0.7;
      g.drawImage(this.mid, 0, 0);
      g.restore();
      setBlur(g, 0);
      const grad = g.createLinearGradient(0, 0, 0, this.refl.height);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = grad;
      g.fillRect(0, 0, TW, this.refl.height);
    }
    // vignettatura
    this.vig = makeCanvas(W, H);
    {
      const g = this.vig.getContext('2d');
      const grad = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    }
    // pioggia e neve
    const n = Math.round((p.snow ? 260 : 420) * (this.q.rain ?? 1) * (p.snow ? 1 : p.rain));
    this.drops = [];
    for (let i = 0; i < n; i++) this.drops.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random(), s: Math.random() });
    // riflettori ed elicotteri
    this.beams = [];
    for (let i = 0; i < (p.searchlights || 0); i++) this.beams.push({ x: 0.1 + (i / Math.max(1, p.searchlights - 1)) * 0.8 + (rand() - 0.5) * 0.08, ph: rand() * 10, sp: 0.15 + rand() * 0.2 });
    this.helis = [];
    if (p.city > 0 && this.q.level !== 'low') {
      for (let i = 0; i < 2; i++) this.helis.push({ x: (i ? 1 : -1) * (12 + rand() * 10), y: 17 + rand() * 4, ph: rand() * 10, dir: i ? -1 : 1 });
    }
    void hzY;
  }

  _skyline(canvas, rand, o) {
    const g = canvas.getContext('2d');
    const TW = canvas.width;
    const CH = canvas.height;
    const p = this.p;
    let x = 0;
    while (x < TW) {
      const w = TW * (o.minW + rand() * (o.maxW - o.minW));
      const h = CH * (o.minH + Math.pow(rand(), 1.6) * (o.maxH - o.minH));
      const draw = (bx) => this._building(g, bx, CH - h, w, h, rand, o);
      draw(x);
      if (x + w > TW) draw(x - TW);
      x += w * (0.55 + rand() * 0.6);
    }
    // nebbia che sale dal basso
    const grad = g.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0, rgba(p.fog, 0));
    grad.addColorStop(1, rgba(p.fog, o.neon ? 0.35 : 0.6));
    g.fillStyle = grad;
    g.fillRect(0, 0, TW, CH);
  }

  _building(g, x, y, w, h, rand, o) {
    const p = this.p;
    const base = shade(o.color, (rand() - 0.5) * 0.04);
    const grad = g.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, shade(base, 0.03));
    grad.addColorStop(1, shade(base, -0.02));
    g.fillStyle = grad;
    g.fillRect(x, y, w, h + 2);
    // tetto
    const roof = rand();
    if (roof > 0.7) {
      g.fillRect(x + w * 0.3, y - h * 0.05, w * 0.4, h * 0.05);
      g.fillRect(x + w * 0.48, y - h * 0.14, Math.max(1, w * 0.04), h * 0.1);
    } else if (roof > 0.5) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w / 2, y - w * 0.4);
      g.lineTo(x + w, y);
      g.fill();
    }
    // finestre
    const cell = Math.max(3, this.H * (o.neon ? 0.009 : 0.005));
    const tint = p.windows;
    for (let wy = y + cell; wy < y + h - cell; wy += cell * 1.6) {
      const lit = rand() > 0.25;
      for (let wx = x + cell * 0.6; wx < x + w - cell; wx += cell * 1.3) {
        if (!lit || rand() > o.windows) continue;
        const k = 0.45 + rand() * 0.55;
        g.fillStyle = rgba(shade(tint, (rand() - 0.6) * 0.25), k);
        g.fillRect(wx, wy, cell * 0.75, cell * 0.85);
      }
    }
    // insegne al neon
    if (o.neon && rand() > 0.6 && h > this.H * 0.08) {
      const c = p.neon[Math.floor(rand() * p.neon.length)];
      const vertical = rand() > 0.5;
      const sw = vertical ? Math.max(3, w * 0.12) : w * 0.7;
      const sh = vertical ? h * (0.25 + rand() * 0.3) : Math.max(3, this.H * 0.012);
      const sx = x + (vertical ? w * (0.1 + rand() * 0.7) : w * 0.15);
      const sy = y + h * (0.1 + rand() * 0.4);
      g.save();
      g.shadowColor = c;
      g.shadowBlur = this.H * 0.02;
      g.fillStyle = c;
      g.fillRect(sx, sy, sw, sh);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(sx + sw * 0.3, sy + sh * 0.2, sw * 0.4, sh * 0.6);
      g.restore();
    }
    // luce rossa di segnalazione
    if (h > canvasHeightFrac(g, 0.6) && rand() > 0.3) {
      g.save();
      g.shadowColor = '#ff2020';
      g.shadowBlur = 6;
      g.fillStyle = '#ff4040';
      g.fillRect(x + w / 2 - 1.5, y - 3, 3, 3);
      g.restore();
    }
  }

  _wall(canvas) {
    const g = canvas.getContext('2d');
    const TW = canvas.width;
    const CH = canvas.height;
    const top = CH * 0.6;
    const grad = g.createLinearGradient(0, top, 0, CH);
    grad.addColorStop(0, '#3a3f48');
    grad.addColorStop(1, '#14171c');
    g.fillStyle = grad;
    g.fillRect(0, top, TW, CH - top);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    for (let x = 0; x < TW; x += CH * 0.25) g.fillRect(x, top, 3, CH - top);
    g.save();
    g.shadowColor = '#ffd27a';
    g.shadowBlur = 8;
    g.fillStyle = '#ffd27a';
    for (let x = CH * 0.12; x < TW; x += CH * 0.25) g.fillRect(x, top - 2, 4, 3);
    g.restore();
  }

  _bridge(canvas) {
    const g = canvas.getContext('2d');
    const CH = canvas.height;
    const x0 = canvas.width * 0.15;
    const span = canvas.width * 0.35;
    g.strokeStyle = '#7a2a1c';
    g.fillStyle = '#7a2a1c';
    for (const tx of [x0, x0 + span]) g.fillRect(tx - 4, CH * 0.15, 8, CH * 0.85);
    g.fillRect(x0 - span * 0.3, CH * 0.7, span * 1.6, 5);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0 - span * 0.3, CH * 0.7);
    g.lineTo(x0, CH * 0.15);
    g.quadraticCurveTo(x0 + span / 2, CH * 0.75, x0 + span, CH * 0.15);
    g.lineTo(x0 + span * 1.3, CH * 0.7);
    g.stroke();
    g.save();
    g.shadowColor = '#ffb070';
    g.shadowBlur = 6;
    g.fillStyle = '#ffcf9a';
    for (let i = 0; i < 24; i++) g.fillRect(x0 - span * 0.3 + (i / 23) * span * 1.6, CH * 0.69, 2, 2);
    g.restore();
  }

  _rigs(canvas, rand) {
    const g = canvas.getContext('2d');
    const CH = canvas.height;
    for (let i = 0; i < 3; i++) {
      const x = canvas.width * (0.15 + i * 0.3 + rand() * 0.1);
      const w = CH * 0.35;
      g.fillStyle = '#10161d';
      g.fillRect(x, CH * 0.55, w, CH * 0.08);
      for (let k = 0; k < 4; k++) g.fillRect(x + (k / 3) * w - 2, CH * 0.6, 4, CH * 0.4);
      g.fillRect(x + w * 0.6, CH * 0.2, 5, CH * 0.36);
      g.save();
      g.shadowColor = '#ff3030';
      g.shadowBlur = 6;
      g.fillStyle = '#ff5050';
      g.fillRect(x + w * 0.6, CH * 0.19, 4, 4);
      g.restore();
    }
  }

  // ------------------------------------------------------------ aggiornamento
  lightning() {
    this.flash = 1;
    const W = this.W;
    const H = this.H;
    let x = W * (0.1 + Math.random() * 0.8);
    let y = 0;
    const pts = [[x, y]];
    while (y < H * this.horizonFrac * 0.95) {
      x += (Math.random() - 0.5) * W * 0.04;
      y += H * (0.02 + Math.random() * 0.04);
      pts.push([x, y]);
    }
    this.bolt = { pts, life: 0.2 };
    this.onThunder?.(0.3 + Math.random() * 0.8);
  }

  update(dt, focusX = 0) {
    this.time += dt;
    this.focusX = focusX;
    if (this.p.lightning > 0) {
      this.nextLightning -= dt;
      if (this.nextLightning <= 0) {
        this.lightning();
        this.nextLightning = (3 + Math.random() * 9) / this.p.lightning;
      }
    }
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.bolt) {
      this.bolt.life -= dt;
      if (this.bolt.life <= 0) this.bolt = null;
    }
    const W = this.W;
    const H = this.H;
    const snow = this.p.snow;
    for (const d of this.drops) {
      if (snow) {
        d.y += (30 + d.z * 60) * dt * (H / 900);
        d.x += Math.sin(this.time * 0.8 + d.s * 10) * 20 * dt;
      } else {
        d.y += (900 + d.z * 900) * dt * (H / 900);
        d.x += (120 + d.z * 120) * dt * (H / 900);
      }
      if (d.y > H) {
        d.y -= H + 40;
        d.x = Math.random() * W;
      }
      if (d.x > W) d.x -= W;
      if (d.x < 0) d.x += W;
    }
  }

  horizonY(cam, H) {
    return H * this.horizonFrac + cam.y * cam.ppu(H) * 0.25 + cam.sy * 0.3;
  }

  // ------------------------------------------------------------ disegno
  drawBack(ctx, cam, W, H) {
    this.build(W, H);
    const p = this.p;
    const k = cam.ppu(H);
    const hz = this.horizonY(cam, H);
    const dy = hz - H * this.horizonFrac;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.sky, 0, dy);
    if (dy > 0) {
      ctx.fillStyle = p.skyTop;
      ctx.fillRect(0, 0, W, dy + 1);
    }
    // nuvole
    const cw = this.clouds.width;
    const cx = -((((this.time * 6 + cam.x * k * 0.02) % cw) + cw) % cw);
    ctx.globalAlpha = 0.95;
    ctx.drawImage(this.clouds, cx, dy);
    ctx.drawImage(this.clouds, cx + cw, dy);
    ctx.globalAlpha = 1;
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.flash * 0.55;
      ctx.drawImage(this.clouds, cx, dy);
      ctx.drawImage(this.clouds, cx + cw, dy);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (this.bolt) {
      ctx.save();
      ctx.strokeStyle = '#e8f0ff';
      ctx.shadowColor = '#9fb8ff';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = Math.min(1, this.bolt.life * 8);
      ctx.beginPath();
      this.bolt.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + dy) : ctx.moveTo(x, y + dy)));
      ctx.stroke();
      ctx.restore();
    }
    // riflettori
    if (this.beams.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const b of this.beams) {
        const bx = W * b.x - ((cam.x * k * 0.12) % W);
        const ang = Math.sin(this.time * b.sp + b.ph) * 0.5 - Math.PI / 2;
        const len = H * 0.9;
        const spread = 0.07;
        const x1 = bx + Math.cos(ang - spread) * len;
        const y1 = hz + Math.sin(ang - spread) * len;
        const x2 = bx + Math.cos(ang + spread) * len;
        const y2 = hz + Math.sin(ang + spread) * len;
        const grad = ctx.createLinearGradient(bx, hz, (x1 + x2) / 2, (y1 + y2) / 2);
        grad.addColorStop(0, 'rgba(200,220,255,0.22)');
        grad.addColorStop(1, 'rgba(200,220,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(bx, hz);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // skyline
    const tile = (img, par, scale) => {
      const w = img.width * scale;
      const h = img.height * scale;
      let x = -((cam.x * k * par + W * 0.3) % w);
      if (x > 0) x -= w;
      for (; x < W; x += w) ctx.drawImage(img, x, hz - h + 1, w, h);
    };
    const zs = Math.pow(k / (H / 24), 0.15);
    tile(this.far, 0.06, zs);
    if (this.p.rift) this._drawRift(ctx, W, H, hz);
    tile(this.mid, 0.16, zs);
    // elicotteri con fari puntati sullo scontro
    for (const h of this.helis) this._heli(ctx, cam, W, H, h);
    // nebbia all'orizzonte
    const fg = ctx.createLinearGradient(0, hz - H * 0.12, 0, hz + H * 0.05);
    fg.addColorStop(0, rgba(p.fog, 0));
    fg.addColorStop(1, rgba(p.fog, 0.55));
    ctx.fillStyle = fg;
    ctx.fillRect(0, hz - H * 0.12, W, H * 0.17);
    // mare
    const sea = ctx.createLinearGradient(0, hz, 0, H);
    sea.addColorStop(0, mix(p.horizon, p.water, 0.55));
    sea.addColorStop(0.25, p.water);
    sea.addColorStop(1, shade(p.water, -0.03));
    ctx.fillStyle = sea;
    ctx.fillRect(0, hz, W, H - hz);
    // riflessi ondulati della citta'
    if (this.p.city > 0) {
      const rh = this.refl.height * zs;
      const strips = this.q.level === 'low' ? 8 : 18;
      const sh = rh / strips;
      const rw = this.refl.width * zs;
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < strips; i++) {
        const off = Math.sin(this.time * 1.6 + i * 0.9) * (2 + i * 0.6);
        let x = -((cam.x * k * 0.16 + W * 0.3) % rw) + off;
        if (x > 0) x -= rw;
        for (; x < W; x += rw) ctx.drawImage(this.refl, 0, (i * sh) / zs, this.refl.width, sh / zs, x, hz + i * sh, rw, sh + 1);
      }
      ctx.globalAlpha = 1;
    }
    // creste delle onde
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rand = rng(99);
    for (let i = 0; i < 70; i++) {
      const depth = rand();
      const y = hz + Math.pow(depth, 1.6) * (H - hz);
      const x = ((rand() * W * 2 - cam.x * k * (0.2 + depth * 0.8) + this.time * (10 + depth * 30)) % (W * 1.2)) - W * 0.1;
      const len = (10 + rand() * 40) * (0.3 + depth);
      ctx.globalAlpha = (0.05 + depth * 0.12) * (0.6 + 0.4 * Math.sin(this.time * 2 + i));
      ctx.fillStyle = mix(p.horizon, '#b0c8e8', 0.5);
      ctx.fillRect(x, y, len, Math.max(1, depth * 2.5));
    }
    ctx.restore();
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(190,210,255,${this.flash * 0.12})`;
      ctx.fillRect(0, hz, W, H - hz);
    }
  }

  _drawRift(ctx, W, H, hz) {
    const t = this.time;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = glowSprite('#2ee6ff');
    const s = 1 + Math.sin(t * 2) * 0.05;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(g, W * 0.5 - W * 0.45 * s, hz - H * 0.07, W * 0.9 * s, H * 0.16);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      const x = W * (0.3 + i * 0.1) + Math.sin(t + i) * 10;
      const grad = ctx.createLinearGradient(0, hz, 0, hz - H * 0.4);
      grad.addColorStop(0, 'rgba(46,230,255,0.35)');
      grad.addColorStop(1, 'rgba(46,230,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, hz - H * 0.4, W * 0.01, H * 0.4);
    }
    ctx.restore();
  }

  _heli(ctx, cam, W, H, h) {
    const t = this.time;
    const wx = this.focusX + h.x + Math.sin(t * 0.2 + h.ph) * 6;
    const wy = h.y + Math.sin(t * 0.7 + h.ph) * 0.8;
    const [sx, sy] = cam.toScreen(wx, wy, W, H);
    const k = cam.ppu(H) * 0.6;
    // fascio del faro verso il basso
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const [tx, ty] = cam.toScreen(this.focusX + Math.sin(t * 0.5 + h.ph) * 4, 0, W, H);
    const grad = ctx.createLinearGradient(sx, sy, tx, ty);
    grad.addColorStop(0, 'rgba(255,250,220,0.32)');
    grad.addColorStop(1, 'rgba(255,250,220,0.02)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tx - k * 3, ty);
    ctx.lineTo(tx + k * 3, ty);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // sagoma
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(h.dir * k * 0.25, k * 0.25);
    ctx.fillStyle = '#0b0e14';
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.2, 0.9, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(-5.5, -0.35, 4, 0.6);
    ctx.fillRect(-6, -1.1, 0.5, 1.4);
    ctx.fillRect(-0.3, -1.4, 0.6, 0.6);
    ctx.fillRect(-1.2, 1.1, 3, 0.25);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(-4 - Math.sin(t * 60) * 1.5, -1.6, 8 + Math.sin(t * 60) * 3, 0.15);
    ctx.globalAlpha = 1;
    ctx.fillStyle = Math.sin(t * 6 + h.ph) > 0.4 ? '#ff3030' : '#3a0a0a';
    ctx.fillRect(-6, -1.3, 0.6, 0.5);
    ctx.restore();
  }

  /** Acqua in primo piano che copre i piedi, pioggia/neve e vignettatura. */
  drawFront(ctx, cam, W, H, reflect = null) {
    const p = this.p;
    const k = cam.ppu(H);
    const [, gy] = cam.toScreen(0, 0.55, W, H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    const grad = ctx.createLinearGradient(0, gy, 0, H);
    grad.addColorStop(0, rgba(mix(p.water, p.horizon, 0.2), 0.72));
    grad.addColorStop(0.3, rgba(p.water, 0.88));
    grad.addColorStop(1, rgba(shade(p.water, -0.04), 0.96));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 16) {
      const wx = cam.x + (x - W / 2) / k;
      ctx.lineTo(x, gy + Math.sin(wx * 0.9 + this.time * 2.2) * k * 0.08 + Math.sin(wx * 2.3 - this.time * 3.1) * k * 0.04);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    if (reflect) {
      ctx.save();
      ctx.clip();
      reflect();
      ctx.restore();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // linea di schiuma
    ctx.strokeStyle = 'rgba(200,220,240,0.35)';
    ctx.lineWidth = Math.max(1.5, k * 0.06);
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) {
      const wx = cam.x + (x - W / 2) / k;
      const y = gy + Math.sin(wx * 0.9 + this.time * 2.2) * k * 0.08 + Math.sin(wx * 2.3 - this.time * 3.1) * k * 0.04;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // pioggia / neve
    if (this.drops.length) {
      if (p.snow) {
        ctx.fillStyle = 'rgba(235,242,255,0.8)';
        for (const d of this.drops) {
          const r = 1 + d.z * 2.2 * (H / 900);
          ctx.globalAlpha = 0.4 + d.z * 0.5;
          ctx.fillRect(d.x, d.y, r, r);
        }
        ctx.globalAlpha = 1;
      } else {
        const sc = H / 900;
        for (const layer of [0, 1]) {
          ctx.strokeStyle = layer ? 'rgba(190,210,235,0.42)' : 'rgba(170,190,220,0.22)';
          ctx.lineWidth = layer ? 1.6 : 1;
          ctx.beginPath();
          for (const d of this.drops) {
            if ((d.z > 0.6) !== !!layer) continue;
            const len = (14 + d.z * 26) * sc;
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - len * 0.13, d.y - len);
          }
          ctx.stroke();
        }
      }
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(200,215,255,${this.flash * 0.18})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.drawImage(this.vig, 0, 0, W, H);
  }
}

function canvasHeightFrac(g, f) {
  return g.canvas.height * f;
}
