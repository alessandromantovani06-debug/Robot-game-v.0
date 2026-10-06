// Scene animate del menu principale e dell'hangar.
import { Stage } from '../engine/stage.js';
import { FX } from '../engine/fx.js';
import { Camera2D } from '../engine/camera.js';
import { makeCanvas, glowSprite } from '../engine/sprite.js';
import { shade, rgba, rng } from '../engine/color.js';
import { ENVIRONMENTS } from '../data/environments.js';
import { audio } from '../core/audio.js';
import { Robot } from './robot.js';
import { Kaiju } from './kaiju.js';
import { damp, clamp } from './anim.js';

/** Sfondo animato del menu principale. */
export class MenuView {
  constructor(app, robotCfg) {
    this.app = app;
    this.stage = new Stage(ENVIRONMENTS.menu, app.quality);
    this.stage.onThunder = (d) => audio.thunder(d);
    this.cam = new Camera2D();
    this.cam.groundFrac = 0.86;
    this.time = 0;
    this.kaiju = new Kaiju('leviathan', 1, { S: Math.round(app.quality.spriteRes * 0.6) });
    this.kaiju.state = 'idle';
    this.kaiju.facing = 1;
    this.setRobot(robotCfg);
  }

  setRobot(cfg) {
    this.robot = new Robot(cfg, { S: Math.round(this.app.quality.spriteRes * 1.5), relaxed: true });
    this.robot.facing = -1;
    this.robot.x = 4;
  }

  update(dt) {
    this.time += dt;
    this.robot.updateDisplay(dt);
    this.kaiju.time += dt;
    this.kaiju._animate(dt);
    this.stage.update(dt, 0);
    const { width: W, height: H } = this.app;
    const narrow = W / H < 1.3;
    const viewH = this.robot.top * (narrow ? 1.5 : 1.28);
    const k = H / viewH;
    // robot nella parte destra dello schermo
    this.cam.target.x = this.robot.x - (narrow ? 0.05 : 0.2) * (W / k) + Math.sin(this.time * 0.1) * 0.4;
    this.cam.target.viewH = viewH;
    this.cam.target.y = 0;
    this.cam.update(dt);
  }

  render(ctx, W, H) {
    const cam = this.cam;
    this.stage.drawBack(ctx, cam, W, H);
    // Kaiju lontano nella baia, avvolto dalla nebbia
    const hz = this.stage.horizonY(cam, H);
    const k = cam.ppu(H) * 0.42;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, hz + k * 2.2);
    ctx.clip();
    const kx = W * 0.32 + Math.sin(this.time * 0.15) * W * 0.01;
    this._drawFar(ctx, kx, hz + k * 2.4, k);
    ctx.restore();
    this.robot.draw(ctx, cam, W, H);
    this.stage.drawFront(ctx, cam, W, H, () => this.robot.draw(ctx, cam, W, H, { reflection: true }));
  }

  _drawFar(ctx, x, y, k) {
    const s = this.kaiju.size;
    this.kaiju.drawAt(ctx, [k * s, 0, 0, k * s, x, y], { alpha: 0.72, aura: 0.25 + Math.sin(this.time * 1.3) * 0.15 });
  }

  resize() {}
  dispose() {}
}

// ------------------------------------------------------------------ HANGAR
function buildHangar(W, H) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const rand = rng(7);
  const floorY = H * 0.78;
  // parete di fondo
  const wall = g.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, '#0a0e15');
  wall.addColorStop(1, '#1a212c');
  g.fillStyle = wall;
  g.fillRect(0, 0, W, floorY);
  // pannelli
  const pw = H * 0.16;
  for (let x = 0; x < W; x += pw) {
    for (let y = 0; y < floorY; y += pw * 0.6) {
      g.fillStyle = `rgba(255,255,255,${0.015 + rand() * 0.02})`;
      g.fillRect(x + 2, y + 2, pw - 4, pw * 0.6 - 4);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x, y, pw, 2);
      g.fillRect(x, y, 2, pw * 0.6);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      for (const [bx, by] of [[6, 6], [pw - 8, 6], [6, pw * 0.6 - 8], [pw - 8, pw * 0.6 - 8]]) g.fillRect(x + bx, y + by, 3, 3);
    }
  }
  // scritta del box
  g.save();
  g.font = `900 ${H * 0.2}px Orbitron, "Arial Black", sans-serif`;
  g.textAlign = 'center';
  g.fillStyle = 'rgba(255,176,48,0.08)';
  g.fillText('BAY 07', W * 0.62, H * 0.32);
  g.restore();
  // strisce luminose verticali
  g.save();
  g.shadowColor = '#3fd2ff';
  g.shadowBlur = H * 0.02;
  g.fillStyle = 'rgba(120,220,255,0.55)';
  for (let i = 0; i < 6; i++) g.fillRect(W * (0.08 + i * 0.17), H * 0.05, Math.max(2, H * 0.004), floorY * 0.85);
  g.restore();
  // carroponte
  g.fillStyle = '#1d232d';
  g.fillRect(0, H * 0.06, W, H * 0.035);
  g.fillStyle = '#e8b81a';
  for (let x = 0; x < W; x += H * 0.05) g.fillRect(x, H * 0.06, H * 0.025, H * 0.008);
  // impalcature laterali
  const tower = (x0, w) => {
    g.strokeStyle = '#2c3440';
    g.lineWidth = Math.max(2, H * 0.006);
    for (const x of [x0, x0 + w]) {
      g.beginPath();
      g.moveTo(x, H * 0.1);
      g.lineTo(x, floorY);
      g.stroke();
    }
    for (let y = H * 0.18; y < floorY; y += H * 0.12) {
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x0 + w, y + H * 0.12);
      g.moveTo(x0 + w, y);
      g.lineTo(x0, y + H * 0.12);
      g.stroke();
      g.fillStyle = '#232a35';
      g.fillRect(x0 - w * 0.3, y, w * 1.6, H * 0.014);
      g.fillStyle = '#e8b81a';
      g.save();
      g.shadowColor = '#ffb030';
      g.shadowBlur = 8;
      g.fillRect(x0 + w * 0.5, y - H * 0.008, H * 0.008, H * 0.008);
      g.restore();
    }
  };
  tower(W * 0.04, W * 0.06);
  tower(W * 0.9, W * 0.06);
  // pavimento
  const fl = g.createLinearGradient(0, floorY, 0, H);
  fl.addColorStop(0, '#20262f');
  fl.addColorStop(1, '#0a0d12');
  g.fillStyle = fl;
  g.fillRect(0, floorY, W, H - floorY);
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 2;
  for (let i = -10; i <= 10; i++) {
    g.beginPath();
    g.moveTo(W / 2 + i * W * 0.04, floorY);
    g.lineTo(W / 2 + i * W * 0.2, H);
    g.stroke();
  }
  for (let y = floorY; y < H; y += (y - floorY) * 0.3 + 6) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  // strisce di pericolo sul bordo
  g.save();
  g.beginPath();
  g.rect(0, floorY - H * 0.012, W, H * 0.012);
  g.clip();
  g.fillStyle = '#e8b81a';
  g.fillRect(0, floorY - H * 0.012, W, H * 0.012);
  g.fillStyle = '#15171a';
  for (let x = 0; x < W; x += H * 0.03) {
    g.beginPath();
    g.moveTo(x, floorY);
    g.lineTo(x + H * 0.015, floorY);
    g.lineTo(x + H * 0.027, floorY - H * 0.012);
    g.lineTo(x + H * 0.012, floorY - H * 0.012);
    g.fill();
  }
  g.restore();
  // vignettatura
  const vg = g.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, W * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
  return { canvas: c, floorFrac: 0.78 };
}

/** Hangar dove si costruisce e si personalizza il Titano. */
export class HangarView {
  constructor(app, robotCfg) {
    this.app = app;
    this.cam = new Camera2D();
    this.cam.groundFrac = 0.8;
    this.fx = new FX(app.quality);
    this.time = 0;
    this.sparkTimer = 1;
    this.category = 'frame';
    this.bg = null;
    this.setRobot(robotCfg);
    this.cur = { ...this.view };
  }

  setRobot(cfg) {
    const facing = this.robot?.facing ?? 1;
    this.robot = new Robot(cfg, { S: Math.round(this.app.quality.spriteRes * 1.6), relaxed: true });
    this.robot.facing = facing;
    this.accent = cfg.colors.accent;
    this.focus(this.category);
  }

  /** Inquadra la parte del robot che si sta modificando. */
  focus(category) {
    this.category = category;
    // inquadrature in proporzione all'altezza del Titano (cambia col telaio):
    // [centro, porzione verticale da mostrare] in frazioni dell'altezza
    const views = {
      head: [0.88, 0.32],
      torso: [0.68, 0.45],
      armL: [0.56, 0.62],
      armR: [0.56, 0.62],
      legs: [0.26, 0.5],
      shoulders: [0.72, 0.4],
    };
    const [fy, span] = views[category] || [0.5, 1.06];
    const h = this.robot.top;
    this.view = { focusY: h * fy, span: h * span };
  }

  /** Zona dello schermo non coperta dai pannelli dell'hangar (in pixel CSS). */
  _freeArea(W, H) {
    this.areaTimer = (this.areaTimer ?? 0) - 1;
    if (this.area && this.areaTimer > 0 && this.area.W === W && this.area.H === H) return this.area;
    this.areaTimer = 15;
    const rect = (sel) => document.querySelector(sel)?.getBoundingClientRect();
    const top = rect('#ui .topbar');
    const drawer = rect('#ui .drawer');
    const panel = rect('#ui .robot-panel');
    const a = { W, H, top: H * 0.08, bottom: H * 0.74, left: W * 0.25 };
    if (top && top.height) a.top = top.bottom + 6;
    if (drawer && drawer.height) a.bottom = drawer.top - 4;
    if (panel && panel.width && panel.right < W * 0.6) a.left = panel.right;
    if (a.bottom - a.top < H * 0.3) a.bottom = a.top + H * 0.3;
    this.area = a;
    return a;
  }

  update(dt) {
    this.time += dt;
    this.robot.updateDisplay(dt);
    for (const k of ['focusY', 'span']) this.cur[k] = damp(this.cur[k] ?? this.view[k], this.view[k], 4, dt);
    const { width: W, height: H } = this.app;
    const a = this._freeArea(W, H);
    const cam = this.cam;
    // la porzione scelta del robot riempie lo spazio libero tra barra in alto e cassetto in basso
    cam.viewH = (this.cur.span * H) / (a.bottom - a.top);
    const k = H / cam.viewH;
    const cy = (a.top + a.bottom) / 2;
    const cx = (a.left + W) / 2;
    cam.x = this.robot.x - (cx - W / 2) / k;
    cam.y = this.cur.focusY - (H * cam.groundFrac - cy) / k;
    cam.update(0);
    this.sparkTimer -= dt;
    if (this.sparkTimer <= 0) {
      this.sparkTimer = 0.8 + Math.random() * 2.5;
      const side = Math.random() < 0.5 ? -1 : 1;
      this.fx.sparks(this.robot.x + side * (3 + Math.random() * 3), 2 + Math.random() * 8, '#ffc070', 26, 8);
    }
    this.fx.update(dt);
  }

  render(ctx, W, H) {
    if (!this.bg || this.bg.canvas.width !== W || this.bg.canvas.height !== H) this.bg = buildHangar(W, H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(this.bg.canvas, 0, 0);
    const cam = this.cam;
    const k = cam.ppu(H);
    const [px, py] = cam.toScreen(this.robot.x, 0, W, H);
    // coni di luce dall'alto
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flick = 0.9 + Math.sin(this.time * 13) * 0.03 + (Math.random() < 0.01 ? -0.4 : 0);
    const grad = ctx.createLinearGradient(0, 0, 0, py);
    grad.addColorStop(0, `rgba(200,220,255,${0.22 * flick})`);
    grad.addColorStop(1, 'rgba(200,220,255,0.02)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px - k * 0.6, 0);
    ctx.lineTo(px + k * 0.6, 0);
    ctx.lineTo(px + k * 4.5, py);
    ctx.lineTo(px - k * 4.5, py);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // piattaforma
    ctx.save();
    const pr = k * 4.2;
    ctx.fillStyle = '#1a1f27';
    ctx.beginPath();
    ctx.ellipse(px, py + k * 0.15, pr, pr * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0d1015';
    ctx.fillRect(px - pr, py + k * 0.15, pr * 2, k * 0.35);
    ctx.beginPath();
    ctx.ellipse(px, py + k * 0.5, pr, pr * 0.18, 0, 0, Math.PI);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(this.accent, 0.55 + Math.sin(this.time * 2) * 0.2);
    ctx.lineWidth = Math.max(2, k * 0.06);
    ctx.shadowColor = this.accent;
    ctx.shadowBlur = k * 0.4;
    ctx.beginPath();
    ctx.ellipse(px, py + k * 0.15, pr * 0.92, pr * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(px, py + k * 0.15, pr * 0.6, pr * 0.1, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // ombra del robot
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(px, py + k * 0.1, k * 2.2, k * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    this.robot.draw(ctx, cam, W, H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.fx.draw(ctx, cam, W, H);
    // bagliore ambientale del colore delle luci
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.12;
    const g = glowSprite(this.accent);
    ctx.drawImage(g, px - k * 6, py - k * 9, k * 12, k * 12);
    ctx.restore();
    void shade;
    void clamp;
  }

  resize() {
    this.bg = null;
  }

  dispose() {}
}
