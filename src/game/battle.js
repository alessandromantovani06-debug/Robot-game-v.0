// Battaglia 2D tra il Titano e i Kaiju.
import { Stage } from '../engine/stage.js';
import { FX } from '../engine/fx.js';
import { Camera2D } from '../engine/camera.js';
import { glowSprite } from '../engine/sprite.js';
import { ENVIRONMENTS } from '../data/environments.js';
import { survivalWave } from '../data/missions.js';
import { audio } from '../core/audio.js';
import { input } from '../core/input.js';
import { Robot } from './robot.js';
import { Kaiju } from './kaiju.js';
import { clamp } from './anim.js';
import { Hud } from '../ui/hud.js';

const NUMBERS_IT = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque'];
const NO_INPUT = { move: { x: 0, y: 0 }, take: () => false, held: {} };

export class Battle {
  constructor(app, { mission, robot, mode = 'campaign', onEnd }) {
    this.app = app;
    this.mission = mission;
    this.mode = mode;
    this.onEnd = onEnd;
    const q = app.quality;
    this.quality = q;
    this.S = q.spriteRes;
    const preset = ENVIRONMENTS[mission.env] || ENVIRONMENTS.tokyo;
    this.stage = new Stage(preset, q);
    this.stage.onThunder = (d) => audio.thunder(d);
    this.fx = new FX(q);
    this.cam = new Camera2D();

    this.player = new Robot(robot, { S: this.S });
    this.player.x = -8;
    this.player.facing = 1;
    this.player.stepCallback = (foot, amp) => this._footstep(amp);

    this.arenaHalf = 48;
    this.enemies = [];
    this.projectiles = [];
    this.wave = 1;
    this._spawnWave(mission.enemies);

    this.state = 'intro';
    this.stateTime = 0;
    this.hitstop = 0;
    this.slowmo = 0;
    this.slowFactor = 0.3;
    this.token = null;
    this.tokenGap = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this._target = null;
    this.paused = false;
    this.ended = false;
    this.stats = { dmgDealt: 0, dmgTaken: 0, maxCombo: 0, perfect: 0, time: 0, kills: 0, waves: 0 };
    this.lowHpTimer = 0;
    this.beam = null;
    this.missileQueue = 0;
    this.focus = null;

    const k = this.enemies[0];
    this.cam.set(k.x, 3, 16 + k.size * 4);
    this.camMode = 'intro';

    this.hud = new Hud(app.ui, this);
    const boss = mission.boss || this.enemies.some((e) => e.def.category >= 5);
    audio.playMusic(boss ? 'boss' : 'battle');
    audio.startAmbience({ rain: preset.rain ?? 0.8, snow: preset.snow });
    audio.alarm();
    const cat = Math.max(...this.enemies.map((e) => e.def.category));
    this.hud.introCard(mission, this.enemies);
    setTimeout(() => {
      if (!this.ended) audio.announce(`Allerta Kaiju. Categoria ${NUMBERS_IT[cat]}. ${mission.place}.`);
    }, 600);
    input.clearPresses();
  }

  get fighting() {
    return this.state === 'fight';
  }

  get aliveEnemies() {
    return this.enemies.filter((e) => e.alive);
  }

  get target() {
    const alive = this.aliveEnemies;
    if (!alive.length) return null;
    let cur = this._target && this._target.alive ? this._target : null;
    // un bersaglio scelto a mano resta per qualche secondo, poi si torna al Kaiju piu' vicino
    if (cur && this.manualTarget > 0) return cur;
    const px = this.player.x;
    const gap = (e) => Math.abs(e.x - px) - e.extent(px);
    let best = alive[0];
    for (const e of alive) if (gap(e) < gap(best)) best = e;
    if (!cur || (best !== cur && gap(best) < gap(cur) - 3)) cur = best;
    this._target = cur;
    return cur;
  }

  /** Il Kaiju che sta portando un attacco in questo momento (chi ha il turno d'attacco). */
  get threat() {
    const k = this.token;
    return k && k.alive && (k.state === 'windup' || k.state === 'active') ? k : null;
  }

  cycleTarget() {
    const alive = this.aliveEnemies;
    if (alive.length < 2) return;
    const i = alive.indexOf(this.target);
    this._target = alive[(i + 1) % alive.length];
    this.manualTarget = 6;
    audio.ui('click');
  }

  _spawnWave(list) {
    list.forEach((e, i) => {
      const k = new Kaiju(e.type, e.level, { S: this.S });
      const side = i % 2 === 0 ? 1 : -1;
      k.x = clamp(this.player.x + side * (26 + i * 4), -this.arenaHalf + 6, this.arenaHalf - 6);
      k.facing = -side;
      k.stateTime = -i * 0.8;
      this.enemies.push(k);
    });
  }

  // ---------- servizi per i combattenti ----------
  message(text, type = 'info', dur = 1.2) {
    this.hud.message(text, type, dur);
  }

  shake(a) {
    this.cam.shake(a);
  }

  flashScreen(color, dur = 0.3) {
    this.hud.flash(color, dur);
  }

  requestToken(k) {
    if (this.tokenGap > 0) return false;
    if (!this.token || this.token === k || !this.token.alive) {
      this.token = k;
      return true;
    }
    return false;
  }

  releaseToken(k) {
    if (this.token === k) {
      this.token = null;
      this.tokenGap = this.aliveEnemies.length > 1 ? 0.6 + Math.random() * 0.6 : 0.15;
    }
  }

  _footstep(amp) {
    this.fx.splash(this.player.x + this.player.facing * 0.6, 0.6 + amp * 0.4);
    audio.step(0.5 + amp * 0.5);
    this.shake(0.03 * amp);
  }

  /** Posizione sullo schermo (pixel CSS) di un punto del mondo: usata dall'HUD. */
  screenPos(x, y) {
    const { width: W, height: H, dpr } = this.app;
    const [sx, sy] = this.cam.toScreen(x, y, W * dpr, H * dpr);
    return [sx / dpr, sy / dpr];
  }

  // ---------- attacchi del Titano ----------
  onPlayerStrike(player, arm, w, hitIndex) {
    const side = arm === 'R' ? 'F' : 'B';
    if (w.type === 'ranged') {
      const [mx, my] = player.point(side === 'F' ? 'muzzleF' : 'muzzleB');
      const tgt = this.target;
      let dx = player.facing;
      let dy = 0;
      if (tgt) {
        const [tx, ty] = tgt.point('center');
        const len = Math.hypot(tx - mx, ty - my) || 1;
        dx = (tx - mx) / len;
        dy = (ty - my) / len;
      }
      this._projectile({ owner: 'player', kind: 'plasma', x: mx, y: my, vx: dx * w.speed, vy: dy * w.speed, dmg: w.dmg * player.powerMul, poise: w.poise, color: player.cfg.colors.accent, radius: 1.2, life: 1.4 });
      audio.plasma();
      this.fx.flash(mx, my, player.cfg.colors.accent, 4);
      this.shake(0.08);
      return;
    }
    const [hx, hy] = player.point(side === 'F' ? 'handF' : 'handB');
    let hitAny = false;
    const struck = new Set();
    for (const e of this.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      const dx = e.x - player.x;
      const edge = Math.abs(dx) - e.extent(player.x);
      if (Math.sign(dx) === player.facing && edge <= w.range * player.art.scale[0]) {
        hitAny = true;
        struck.add(e);
        const crit = Math.random() < 0.08;
        const dmg = w.dmg * player.powerMul * (0.92 + Math.random() * 0.16) * (crit ? 1.6 : 1);
        const [cx, cy] = e.point('center');
        const px = e.x - Math.sign(dx) * e.extent(player.x) * 0.8;
        const py = clamp(hy, 1.5, cy + 2);
        this._damageKaiju(e, dmg, w.poise, player.facing, px, py, crit);
        if (w.slash) this.fx.sparks(px, py, player.cfg.colors.accent, 16, 20, -player.facing);
        void cx;
      }
    }
    if (w.shockwave) {
      this.fx.shockwave(hx, player.cfg.colors.accent, w.shockwave, 0.5);
      audio.explosion(0.7);
      this.shake(0.35);
      for (const e of this.enemies) {
        if (!e.alive || e.state === 'spawn' || struck.has(e)) continue;
        if (Math.abs(e.x - hx) - e.extent(hx) <= w.shockwave) {
          const [cx, cy] = e.point('center');
          this._damageKaiju(e, w.dmg * 0.4 * player.powerMul, w.poise * 0.5, Math.sign(e.x - hx) || 1, cx, cy, false);
        }
      }
    }
    if (hitAny) {
      const heavy = w.dmg >= 80;
      audio.impact(heavy, false);
      audio.impact(heavy, true);
      this.hitstop = heavy ? 0.1 : 0.05;
      this.shake(heavy ? 0.45 : 0.22);
      audio.vibrate(heavy ? 45 : 20);
      this.combo++;
      this.comboTimer = 1.8;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      player.addSync((w.dmg * 0.11 + this.combo * 0.4) * (1 + (w.syncBonus || 0)));
    }
    void hitIndex;
  }

  _damageKaiju(e, dmg, poise, dir, x, y, crit = false) {
    dmg = Math.round(dmg);
    const before = e.hp;
    if (!e.takeHit(dmg, poise, dir, this)) return;
    this.stats.dmgDealt += Math.min(before, dmg);
    this.fx.blood(x, y, e.def.glow, crit ? 40 : 22, dir);
    this.fx.sparks(x, y, '#ffcf7a', crit ? 26 : 14, 16, -dir);
    this.hud.damageNumber(x, y, dmg, crit);
  }

  // ---------- attacchi dei Kaiju ----------
  kaijuHitsPlayer(k, move, opts = {}) {
    const p = this.player;
    const dmg = Math.round(move.dmg * k.dmgMul * (k.roarBuff > 0 ? 1.15 : 1) * (0.9 + Math.random() * 0.2));
    const res = p.takeHit(dmg, k.x, move.knock || 3, this);
    const [cx, cy] = p.point('chest');
    switch (res.result) {
      case 'dodge':
        this.message('SCHIVATO!', 'good', 0.6);
        p.addSync(5);
        break;
      case 'perfect':
        this.stats.perfect++;
        k.stagger(1.4, this);
        audio.block(true);
        this.fx.flash(cx + p.facing, cy, '#ffffff', 10);
        this.fx.sparks(cx + p.facing, cy, p.cfg.colors.accent, 36, 24);
        this.slowmo = 0.35;
        this.hitstop = 0.08;
        this.shake(0.3);
        this.message('PARATA PERFETTA!', 'perfect', 1);
        audio.vibrate(30);
        break;
      case 'block':
        audio.block(false);
        this.fx.sparks(cx + p.facing * 1.5, cy, '#ffd27a', 22, 18, -p.facing);
        this.shake(0.25);
        this.stats.dmgTaken += res.dmg;
        if (res.dmg > 0) this.hud.damageNumber(cx, cy + 1, res.dmg, false, true);
        audio.vibrate(25);
        break;
      case 'hit':
        audio.impact(true, true);
        this.fx.sparks(cx, cy, '#ffb347', 30, 20, -p.facing);
        this.fx.debris(cx, cy, 6);
        this.fx.smoke(cx, cy, 3, '#25272c', 1);
        this.shake(clamp(dmg / 90, 0.3, 0.9));
        this.hitstop = 0.06;
        this.stats.dmgTaken += res.dmg;
        this.hud.flash('#ff2020', 0.25);
        this.hud.damageNumber(cx, cy + 1, res.dmg, false, true);
        audio.vibrate([60, 30, 40]);
        this.combo = 0;
        break;
    }
    if (opts.drain && (res.result === 'hit' || res.result === 'block')) {
      p.drainEnergy();
      this.message('REATTORE IN AVARIA!', 'danger', 1.4);
    }
    return res;
  }

  spawnAcid(k) {
    const [mx, my] = k.point('mouth');
    const p = this.player;
    const tx = p.x + p.vx * 0.5;
    const t = Math.max(0.4, Math.abs(tx - mx) / k.move.speed);
    const vx = (tx - mx) / t;
    const vy = (5 - my) / t + 9 * t * 0.5;
    this._projectile({ owner: 'kaiju', kind: 'acid', x: mx, y: my, vx, vy, dmg: k.move.dmg * k.dmgMul, color: k.def.glow, radius: 1.5, life: 2.4, source: k, move: k.move });
  }

  _projectile(o) {
    this.projectiles.push({ ...o, age: 0 });
  }

  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.age += dt;
      if (pr.kind === 'missile') {
        const tgt = pr.target && pr.target.alive ? pr.target : this.target;
        if (tgt && pr.age > 0.25) {
          const [tx, ty] = tgt.point('center');
          const len = Math.hypot(tx - pr.x, ty - pr.y) || 1;
          const s = 46;
          pr.vx += ((tx - pr.x) / len * s - pr.vx) * Math.min(1, dt * 5);
          pr.vy += ((ty - pr.y) / len * s - pr.vy) * Math.min(1, dt * 5);
        }
        if (Math.random() < 0.9) this.fx.emit('smoke', pr.x, pr.y, 0, 0.5, 0.6, 0.25, '#5a5e66', { size1: 0.7, drag: 1 });
      } else if (pr.kind === 'acid') pr.vy -= 9 * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      this.fx.trail(pr.x, pr.y, pr.color, pr.kind === 'acid' ? 0.8 : 0.5, 0.3);
      let hit = false;
      if (pr.owner === 'kaiju') {
        const p = this.player;
        if (p.alive && Math.abs(pr.x - p.x) < p.radius + pr.radius * 0.5 && pr.y < p.height + 1) {
          hit = true;
          const res = this.kaijuHitsPlayer(pr.source, pr.move);
          if (res.result === 'hit') this.fx.blood(pr.x, pr.y, pr.color, 20);
        }
      } else {
        for (const e of this.enemies) {
          if (!e.alive || e.state === 'spawn') continue;
          if (Math.abs(pr.x - e.x) < e.extent(pr.x) + pr.radius * 0.5 && pr.y < e.height + 2) {
            hit = true;
            this._damageKaiju(e, pr.dmg * (0.92 + Math.random() * 0.16), pr.poise || 8, Math.sign(pr.vx) || 1, pr.x, pr.y, false);
            this.fx.explosion(pr.x, pr.y, pr.kind === 'missile' ? 0.55 : 0.45, pr.color);
            audio.explosion(0.5);
            audio.impact(false, false);
            this.shake(0.15);
            this.combo++;
            this.comboTimer = 1.8;
            this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
            if (pr.kind === 'plasma') this.player.addSync(pr.dmg * 0.1);
            break;
          }
        }
      }
      if (!hit && pr.y <= 0.2) {
        hit = true;
        this.fx.splash(pr.x, 1.4);
        if (pr.kind !== 'acid') this.fx.explosion(pr.x, 0.5, 0.4, pr.color);
      }
      if (hit || pr.age > pr.life) this.projectiles.splice(i, 1);
    }
  }

  // ---------- mosse speciali ----------
  onSpecialStart(type) {
    const names = { beam: 'RAGGIO NUCLEARE', missiles: 'SALVA DI MISSILI', emp: 'IMPULSO TESLA', overdrive: 'FURIA OVERDRIVE' };
    this.message(names[type] + '!', 'special', 1.6);
    this.shake(0.3);
    this.hud.flash(this.player.cfg.colors.accent, 0.4);
    this.focus = { x: this.player.x, t: 1.2 };
    audio.announce(names[type].toLowerCase());
    audio.vibrate([40, 40, 80]);
  }

  onSpecialFire(player, type) {
    const mult = player.stats.special;
    const accent = player.cfg.colors.accent;
    if (type === 'beam') {
      this.beam = { tick: 0, mult, t: 0, len: 0 };
      audio.beam(1.35);
      this.shake(0.4);
    } else if (type === 'missiles') {
      this.missileQueue = Math.round(16 * (0.9 + mult * 0.1));
      this.missileTimer = 0;
    } else if (type === 'emp') {
      const x = player.x;
      this.fx.shockwave(x, accent, 22, 0.9);
      this.fx.shockwave(x, '#ffffff', 14, 0.6);
      for (let i = 0; i < 10; i++) this.fx.electric(x, 4, accent, 10, 1, 0.3);
      audio.zap();
      audio.explosion(1.4);
      this.shake(1);
      this.hud.flash(accent, 0.5);
      for (const e of this.enemies) {
        if (!e.alive || e.state === 'spawn') continue;
        if (Math.abs(e.x - x) - e.extent(x) <= 22) {
          const [cx, cy] = e.point('center');
          this._damageKaiju(e, 240 * mult * player.stats.power, 0, Math.sign(e.x - x) || 1, cx, cy, false);
          e.stunFor(3.4, this);
        }
      }
    } else if (type === 'overdrive') {
      player.overdrive = 9;
      player.energy = player.maxEnergy;
      this.fx.shockwave(player.x, accent, 9, 0.6);
      const [cx, cy] = player.point('chest');
      for (let i = 0; i < 6; i++) this.fx.electric(cx, cy, accent, 5, 1, 0.3);
      audio.roar(2.2, 1, 0.5);
    }
  }

  onSpecialTick(player, type, t, dt) {
    if (type === 'beam' && this.beam) {
      const [ox, oy] = player.point('core');
      const tgt = this.target;
      let dx = player.facing;
      let dy = 0;
      if (tgt) {
        const [tx, ty] = tgt.point('center');
        const l = Math.hypot(tx - ox, ty - oy) || 1;
        dx = (tx - ox) / l;
        dy = (ty - oy) / l;
      }
      let len = 70;
      let hitE = null;
      for (const e of this.enemies) {
        if (!e.alive || e.state === 'spawn') continue;
        const along = (e.x - ox) * dx;
        if (along > 0 && Math.sign(e.x - ox) === Math.sign(dx) && along - e.extent(ox) < len) {
          len = Math.max(2, Math.abs(e.x - ox) - e.extent(ox) * 0.6);
          hitE = e;
        }
      }
      Object.assign(this.beam, { x: ox, y: oy, dx, dy, len, t });
      const ex = ox + dx * len;
      const ey = oy + dy * len;
      this.fx.trail(ex, ey, player.cfg.colors.accent, 2, 0.3);
      if (Math.random() < 0.5) this.fx.sparks(ex, ey, '#ffffff', 5, 18);
      this.shake(0.06);
      this.beam.tick += dt;
      if (hitE && this.beam.tick >= 0.1) {
        this.beam.tick = 0;
        this._damageKaiju(hitE, 31 * this.beam.mult * player.stats.power, 6, Math.sign(dx) || 1, ex, ey, false);
        audio.impact(false, false);
      }
    } else if (type === 'missiles' && this.missileQueue > 0) {
      this.missileTimer -= dt;
      while (this.missileTimer <= 0 && this.missileQueue > 0) {
        this.missileTimer += 0.065;
        this.missileQueue--;
        const [sx, sy] = player.point('chest');
        this._projectile({
          owner: 'player', kind: 'missile', x: sx - player.facing * 0.8, y: sy + 2,
          vx: player.facing * (6 + Math.random() * 6) - player.facing * 4, vy: 18 + Math.random() * 10,
          dmg: 30 * player.stats.special * player.stats.power, poise: 6, color: '#ffb347', radius: 1.3, life: 3, target: this.target,
        });
        audio.missile();
      }
    }
  }

  onSpecialEnd(player, type) {
    if (type === 'beam') this.beam = null;
  }

  // ---------- eventi di fine scontro ----------
  onKaijuDeath(k) {
    this.stats.kills++;
    const [cx, cy] = k.point('center');
    this.fx.blood(cx, cy, k.def.glow, 80);
    this.fx.explosion(cx, cy, 1.2, k.def.glow);
    audio.roar(0.7 / k.size, 2.4, 1.2);
    audio.explosion(1.5);
    this.shake(0.9);
    this.stage.lightning();
    this.player.addSync(25);
    if (this._target === k) this._target = null;
    if (this.aliveEnemies.length > 0) {
      this.message('KAIJU ABBATTUTO!', 'good', 1.6);
      audio.announce('Kaiju abbattuto');
      return;
    }
    if (this.mode === 'survival') {
      this.stats.waves = this.wave;
      this.message(`ONDATA ${this.wave} SUPERATA!`, 'good', 2.2);
      audio.announce(`Ondata ${this.wave} superata`);
      this.state = 'between';
      this.stateTime = 0;
      this.slowmo = 0.6;
      return;
    }
    this.state = 'outro';
    this.stateTime = 0;
    this.won = true;
    this.slowmo = 1.6;
    this.slowFactor = 0.25;
    this.camMode = 'finisher';
    this.finisher = k;
    this.message('KAIJU ABBATTUTO!', 'victory', 2.5);
    setTimeout(() => {
      if (!this.ended) audio.announce('Kaiju abbattuto. Missione compiuta.');
    }, 900);
  }

  onPlayerDeath() {
    if (this.state === 'outro') return;
    this.state = 'outro';
    this.stateTime = 0;
    this.won = false;
    this.slowmo = 1.2;
    this.slowFactor = 0.3;
    this.camMode = 'defeat';
    audio.explosion(1.6);
    audio.alarm();
    const [cx, cy] = this.player.point('chest');
    this.fx.explosion(cx, cy, 1.3);
    this.message('TITANO ABBATTUTO', 'danger', 3);
    setTimeout(() => {
      if (!this.ended) audio.announce('Titano abbattuto. Pilota, rispondi.');
    }, 700);
  }

  _nextWave() {
    this.wave++;
    this.enemies = [];
    const p = this.player;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35);
    p.energy = p.maxEnergy;
    this._spawnWave(survivalWave(this.wave));
    this.hud.rebuildEnemies();
    this.message(`ONDATA ${this.wave}`, 'warn', 2);
    audio.alarm();
    audio.announce(`Ondata ${this.wave}. Kaiju in avvicinamento.`);
    this.state = 'fight';
  }

  _finish() {
    if (this.ended) return;
    this.ended = true;
    this.stats.time = Math.round(this.stats.time);
    audio.sting(this.won);
    this.onEnd?.({ won: !!this.won, mode: this.mode, mission: this.mission, stats: { ...this.stats, hpLeft: this.player.hp / this.player.maxHp } });
  }

  // ---------- ciclo principale ----------
  pause() {
    if (this.ended || this.paused) return;
    this.paused = true;
    input.releaseAll();
    this.hud.showPause();
  }

  resume() {
    this.paused = false;
    input.clearPresses();
    this.hud.hidePause();
  }

  update(realDt) {
    if (this.paused) {
      if (input.take('pause', 0.3)) this.resume();
      return;
    }
    if (input.take('pause', 0.3)) {
      this.pause();
      return;
    }
    let dt = realDt;
    if (this.hitstop > 0) {
      this.hitstop -= realDt;
      dt *= 0.08;
    } else if (this.slowmo > 0) {
      this.slowmo -= realDt;
      dt *= this.slowFactor;
    } else this.slowFactor = 0.3;

    this.stateTime += realDt;
    this.tokenGap = Math.max(0, this.tokenGap - dt);
    this.manualTarget = Math.max(0, (this.manualTarget || 0) - dt);

    if (this.state === 'intro') {
      const ready = this.enemies.every((e) => e.state !== 'spawn' || e.stateTime > 2.4);
      if ((this.stateTime > 4.2 && ready) || (this.stateTime > 1.2 && (input.take('left') || input.take('right') || input.take('dash')))) {
        this.state = 'fight';
        this.stateTime = 0;
        this.camMode = 'follow';
        this.hud.hideIntro();
        this.message('COMBATTI!', 'big', 1.2);
        audio.roar(1 / this.enemies[0].size, 1.8, 1);
        input.clearPresses();
        this.enemies.forEach((e) => {
          if (e.state === 'spawn') e.stateTime = Math.max(e.stateTime, 2.2);
        });
        if (this.mission.tutorial) this.hud.startTutorial();
      }
    } else if (this.state === 'fight') {
      this.stats.time += dt;
      if (input.take('target', 0.3)) this.cycleTarget();
    } else if (this.state === 'between') {
      if (this.stateTime > 3.5) this._nextWave();
    } else if (this.state === 'outro') {
      if (this.won && this.stateTime > 1.8 && this.player.state !== 'victory') {
        this.player.victory();
        this.camMode = 'victory';
      }
      if (this.stateTime > (this.won ? 5.5 : 4.5)) this._finish();
    }

    if (this.player.state !== 'special') {
      this.beam = null;
      this.missileQueue = 0;
    }
    this.player.update(dt, this.state === 'fight' ? input : NO_INPUT, this);
    for (const e of this.enemies) e.update(dt, this);
    this._resolveCollisions(dt);
    this._updateProjectiles(dt);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.player.alive && this.player.hp / this.player.maxHp < 0.25 && this.state === 'fight') {
      this.lowHpTimer -= realDt;
      if (this.lowHpTimer <= 0) {
        this.lowHpTimer = 3;
        audio.alarm();
        this.message('CORAZZA CRITICA!', 'danger', 1);
      }
    }
    this.fx.update(dt);
    this.stage.update(dt, this.player.x);
    this._updateCamera(realDt * (this.hitstop > 0 ? 0.3 : 1));
    this.hud.update(realDt);
  }

  _updateCamera(dt) {
    const cam = this.cam;
    const p = this.player;
    const { width, height } = this.app;
    const aspect = width / height;
    const T = cam.target;
    cam.lambda = 3;
    if (this.camMode === 'intro') {
      const k = this.enemies[0];
      T.x = k.x;
      T.y = 2;
      T.viewH = 14 + k.size * 5 + this.stateTime * 0.8;
    } else if (this.camMode === 'finisher' && this.finisher) {
      const k = this.finisher;
      T.x = k.x * 0.6 + p.x * 0.4;
      T.y = 0;
      T.viewH = Math.max(p.top * 1.3 + 2, Math.abs(k.x - p.x) * 0.7 / aspect + 14);
      cam.lambda = 2;
    } else if (this.camMode === 'victory') {
      T.x = p.x;
      T.y = 0;
      T.viewH = Math.max(16, p.top * 1.55 + 2);
      cam.lambda = 1.5;
    } else if (this.camMode === 'defeat') {
      T.x = p.x;
      T.y = 0;
      T.viewH = Math.max(16, p.top * 1.4 + 2);
      cam.lambda = 1.5;
    } else {
      const tgt = this.target;
      const tx = tgt ? tgt.x : p.x + p.facing * 10;
      const sep = Math.abs(tx - p.x);
      const tallest = Math.max(p.height, ...this.aliveEnemies.map((e) => e.height + Math.max(0, e.y)));
      T.x = (p.x + tx) / 2;
      T.viewH = clamp(Math.max(tallest * 1.55 + 3, (sep + 20) / aspect), 18, 40);
      T.y = 0;
      if (this.focus && this.focus.t > 0) {
        this.focus.t -= dt;
        T.viewH *= 0.82;
        T.x = T.x * 0.6 + this.focus.x * 0.4;
      }
    }
    // tieni la camera dentro l'arena
    const halfW = (cam.viewH * aspect) / 2;
    T.x = clamp(T.x, -this.arenaHalf - 6 + halfW, this.arenaHalf + 6 - halfW);
    cam.update(dt);
  }

  _resolveCollisions(dt) {
    const p = this.player;
    const all = [p, ...this.enemies.filter((e) => e.alive && !(e.state === 'active' && e.move?.kind === 'leap'))];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        // lo scatto (invulnerabile) e la carica permettono di attraversarsi
        if (a === p && (p.invuln > 0 && p.state === 'dash')) continue;
        if (a === p && b.state === 'active' && b.move?.kind === 'charge' && p.invuln > 0) continue;
        const dx = b.x - a.x;
        const min = (a.extent ? a.extent(b.x) : a.radius) + (b.extent ? b.extent(a.x) : b.radius);
        if (Math.abs(dx) < min) {
          // spinta graduale: quando un Kaiju si gira l'ingombro cambia lato senza scatti
          const push = Math.min(min - Math.abs(dx), 34 * dt + 0.04);
          const dir = Math.sign(dx) || (a === p ? -p.facing : 1);
          const wa = a === p ? 0.7 : 0.5;
          a.x -= dir * push * wa;
          b.x += dir * push * (1 - wa);
        }
      }
    }
    for (const f of [p, ...this.enemies]) f.x = clamp(f.x, -this.arenaHalf, this.arenaHalf);
  }

  // ---------- disegno ----------
  render(ctx, W, H) {
    const cam = this.cam;
    this.stage.drawBack(ctx, cam, W, H);
    this.fx.drawGround(ctx, cam, W, H);
    const order = [...this.enemies].sort((a, b) => (a.alive === b.alive ? 0 : a.alive ? 1 : -1));
    for (const e of order) e.draw(ctx, cam, W, H);
    this.player.draw(ctx, cam, W, H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this._drawProjectiles(ctx, W, H);
    this._drawBeam(ctx, W, H);
    this.fx.draw(ctx, cam, W, H);
    // l'acqua davanti copre i piedi; i riflessi si vedono sulla sua superficie
    const reflect = this.quality.reflections
      ? () => {
          for (const e of this.enemies) e.draw(ctx, cam, W, H, { reflection: true });
          this.player.draw(ctx, cam, W, H, { reflection: true });
        }
      : null;
    this.stage.drawFront(ctx, cam, W, H, reflect);
  }

  _drawProjectiles(ctx, W, H) {
    const k = this.cam.ppu(H);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pr of this.projectiles) {
      const [sx, sy] = this.cam.toScreen(pr.x, pr.y, W, H);
      const s = (pr.kind === 'acid' ? 2.4 : pr.kind === 'missile' ? 1.2 : 2.2) * k;
      ctx.drawImage(glowSprite(pr.color), sx - s / 2, sy - s / 2, s, s);
      ctx.drawImage(glowSprite('#ffffff'), sx - s / 6, sy - s / 6, s / 3, s / 3);
      if (pr.kind === 'missile') {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.atan2(-pr.vy, pr.vx));
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#3a3f48';
        ctx.fillRect(-k * 0.5, -k * 0.09, k * 0.7, k * 0.18);
        ctx.fillStyle = '#c8302a';
        ctx.fillRect(k * 0.2, -k * 0.09, k * 0.15, k * 0.18);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  _drawBeam(ctx, W, H) {
    const b = this.beam;
    if (!b || b.x === undefined) return;
    const cam = this.cam;
    const k = cam.ppu(H);
    const [x0, y0] = cam.toScreen(b.x, b.y, W, H);
    const [x1, y1] = cam.toScreen(b.x + b.dx * b.len, b.y + b.dy * b.len, W, H);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const len = Math.hypot(x1 - x0, y1 - y0);
    const wdt = Math.min(1, b.t * 5) * k * 1.1 * (1 + Math.sin(b.t * 40) * 0.12);
    const accent = this.player.cfg.colors.accent;
    ctx.save();
    ctx.translate(x0, y0);
    ctx.rotate(ang);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, -wdt, 0, wdt);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.3, accent);
    g.addColorStop(0.5, '#ffffff');
    g.addColorStop(0.7, accent);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(0, -wdt, len, wdt * 2);
    ctx.drawImage(glowSprite(accent), -wdt * 2, -wdt * 2, wdt * 4, wdt * 4);
    ctx.drawImage(glowSprite(accent), len - wdt * 2.5, -wdt * 2.5, wdt * 5, wdt * 5);
    ctx.restore();
  }

  resize() {}

  dispose() {
    this.ended = true;
    this.hud.dispose();
    audio.stopAmbience();
  }
}
