// Il Titano del giocatore in 2D: movimento, attacchi, parate, scatti e mosse speciali.
import { buildRobotArt } from '../art/robotArt.js';
import { solveRobot, drawRobot, M } from '../art/rig.js';
import { computeStats, getPart } from '../data/parts.js';
import { audio } from '../core/audio.js';
import {
  GUARD, RELAXED, ATTACKS, BLOCK, HIT, DASH, SPECIALS, VICTORY, DEFEAT, POSE_KEYS,
  toBackArm, blendInto, damp, clamp, lerp, smooth, easeOut,
} from './anim.js';

const ANIM_FOR_WEAPON = {
  wp_fist: 'punch',
  wp_rocket: 'heavy',
  wp_chainsword: 'slash',
  wp_hammer: 'smash',
  wp_plasma: 'shoot',
  wp_claws: 'slash',
};

const LONG_WEAPONS = new Set(['wp_chainsword', 'wp_hammer', 'wp_claws', 'wp_plasma']);

const SPECIAL_TIMING = {
  beam: { windup: 0.55, active: 1.35, recovery: 0.5 },
  missiles: { windup: 0.45, active: 1.15, recovery: 0.45 },
  emp: { windup: 0.65, active: 0.3, recovery: 0.8 },
  overdrive: { windup: 0.4, active: 0.9, recovery: 0.3 },
};

const POSES = { F: ATTACKS, B: {} };
for (const [k, v] of Object.entries(ATTACKS)) POSES.B[k] = { W: toBackArm(v.W), S: toBackArm(v.S) };

export class Robot {
  constructor(cfg, { S = 64, relaxed = false } = {}) {
    this.cfg = cfg;
    this.art = buildRobotArt(cfg, S);
    this.stats = computeStats(cfg);
    this.weapons = { L: getPart(cfg.armL).weapon, R: getPart(cfg.armR).weapon };
    this.weaponIds = { L: cfg.armL, R: cfg.armR };
    this.torso = getPart(cfg.torso);
    this.special = this.torso.special;
    this.maxHp = this.hp = this.stats.hp;
    this.maxEnergy = this.energy = this.stats.energy;
    this.sync = 0;
    this.radius = 1.9 * this.art.scale[0];
    this.height = this.art.height;
    // cima visibile del Titano (testa con creste e antenne), per inquadrarlo
    this.top = this.height * 1.16;
    this.relaxed = relaxed;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.knock = 0;
    this.facing = 1;
    this.state = 'idle';
    this.action = null;
    this.phase = 0;
    this.time = Math.random() * 10;
    this.pose = {};
    this.T = {};
    POSE_KEYS.forEach((k) => (this.pose[k] = 0));
    Object.assign(this.pose, art0(this.art), relaxed ? RELAXED : GUARD);
    this.invuln = 0;
    this.energyDelay = 0;
    this.blockStart = -10;
    this.blocking = false;
    this.overdrive = 0;
    this.stateTimer = 0;
    this.hitFlash = 0;
    this.alive = true;
    this.lastCos = 1;
    this.stepCallback = null;
    this.deathTime = 0;
    this.thrust = { F: false, B: false, leg: false };
    this.J = solveRobot(this.art, this.pose);
  }

  get powerMul() {
    return this.stats.power * (this.overdrive > 0 ? 1.6 : 1);
  }

  get speedMul() {
    return this.stats.speed * (this.overdrive > 0 ? 1.3 : 1);
  }

  get attackSpeed() {
    return this.overdrive > 0 ? 1.4 : 1;
  }

  // ---------- azioni ----------
  tryAttack(arm, B, chained = false) {
    const w = this.weapons[arm];
    if (this.overdrive <= 0 && this.energy < w.energy) {
      B.message('ENERGIA INSUFFICIENTE', 'warn', 0.8);
      audio.ui('error');
      return false;
    }
    if (this.overdrive <= 0 && w.energy > 0) {
      this.energy -= w.energy;
      this.energyDelay = 0.8;
    }
    const k = chained ? 0.6 : 1;
    this.state = 'attack';
    this.blocking = false;
    this.action = {
      arm,
      w,
      side: arm === 'R' ? 'F' : 'B',
      anim: ANIM_FOR_WEAPON[this.weaponIds[arm]] || 'punch',
      t: 0,
      windup: w.windup * k,
      active: w.active,
      recovery: w.recovery,
      hits: w.hits || 1,
      hitsDone: 0,
      queued: null,
    };
    audio.servo();
    return true;
  }

  tryDash(dir, B) {
    if (this.overdrive <= 0 && this.energy < 20) {
      B.message('ENERGIA INSUFFICIENTE', 'warn', 0.8);
      return false;
    }
    if (this.overdrive <= 0) {
      this.energy -= 20;
      this.energyDelay = 0.6;
    }
    this.state = 'dash';
    this.blocking = false;
    this.action = { kind: 'dash', t: 0, dur: 0.32, dir };
    this.invuln = 0.38;
    audio.whoosh(true);
    audio.thruster();
    return true;
  }

  trySpecial(B) {
    if (this.sync < 100) return false;
    this.sync = 0;
    const tm = SPECIAL_TIMING[this.special];
    this.state = 'special';
    this.blocking = false;
    this.invuln = tm.windup + tm.active + tm.recovery;
    this.action = { kind: 'special', type: this.special, t: 0, ...tm };
    audio.special();
    B.onSpecialStart(this.special);
    return true;
  }

  takeHit(dmg, sourceX, knock, B) {
    if (!this.alive) return { result: 'none', dmg: 0 };
    if (this.invuln > 0) return { result: 'dodge', dmg: 0 };
    const away = Math.sign(this.x - sourceX) || -this.facing;
    const facingSource = Math.sign(sourceX - this.x) === this.facing;
    if (this.blocking && facingSource) {
      if (this.time - this.blockStart < 0.22) {
        this.sync = Math.min(100, this.sync + 12 * this.stats.sync);
        return { result: 'perfect', dmg: 0 };
      }
      const blocked = Math.round(dmg * 0.25);
      this.energy = Math.max(0, this.energy - dmg * 0.18);
      this.energyDelay = 0.6;
      this.hp -= blocked;
      this.knock = away * knock * 1.4;
      if (this.energy <= 0) {
        this._stagger(0.7);
        B.message('GUARDIA ROTTA!', 'warn', 1);
      }
      this._checkDeath(B);
      return { result: 'block', dmg: blocked };
    }
    this.hp -= dmg;
    this.sync = Math.min(100, this.sync + dmg * 0.07 * this.stats.sync);
    this.hitFlash = 1;
    this.knock = away * knock * 3;
    if (this.state !== 'special') this._stagger(knock >= 6 ? 0.65 : 0.35);
    this._checkDeath(B);
    return { result: 'hit', dmg };
  }

  _stagger(t) {
    this.state = 'hit';
    this.stateTimer = t;
    this.action = null;
    this.blocking = false;
  }

  _checkDeath(B) {
    if (this.hp <= 0 && this.alive) {
      this.hp = 0;
      this.alive = false;
      this.state = 'dead';
      this.action = null;
      this.deathTime = 0;
      B?.onPlayerDeath();
    }
  }

  drainEnergy() {
    this.energy = 0;
    this.energyDelay = 3;
  }

  addSync(v) {
    this.sync = Math.min(100, this.sync + v * this.stats.sync);
  }

  victory() {
    this.state = 'victory';
    this.action = null;
    this.blocking = false;
  }

  // ---------- aggiornamento ----------
  update(dt, ctl, B) {
    this.time += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 8);
    if (this.overdrive > 0) {
      this.overdrive -= dt;
      if (this.overdrive <= 0) B?.message('OVERDRIVE TERMINATO', 'info', 1);
    }
    this.energyDelay -= dt;
    if (this.energyDelay <= 0 && this.alive) this.energy = Math.min(this.maxEnergy, this.energy + 16 * this.stats.regen * dt);

    const target = B?.target;
    const mx = ctl ? ctl.move.x : 0;
    if (this.alive && this.state !== 'victory' && this.state !== 'dash' && this.state !== 'hit') {
      // in parata si gira verso il Kaiju che sta attaccando, anche se non e' il bersaglio
      const threat = ctl?.held.block && (this.state === 'idle' || this.state === 'block') ? B?.threat : null;
      const look = threat || target;
      if (look) this.facing = Math.sign(look.x - this.x) || this.facing;
      else if (Math.abs(mx) > 0.2 && this.state === 'idle') this.facing = Math.sign(mx);
    }

    if (ctl && this.alive && B?.fighting) {
      const a = this.action;
      if (this.state === 'attack' && ctl.held.block && a && a.t > a.windup + a.active * 0.5) {
        this.state = 'idle';
        this.action = null;
      }
      if (this.state === 'idle' || this.state === 'block') {
        if (this.sync >= 100 && ctl.take('special')) this.trySpecial(B);
        else if (ctl.take('dash', 0.15)) this.tryDash(Math.abs(mx) > 0.2 ? Math.sign(mx) : -this.facing, B);
        else if (ctl.take('left', 0.25)) this.tryAttack('L', B);
        else if (ctl.take('right', 0.25)) this.tryAttack('R', B);
        else if (ctl.take('special')) {
          B.message('SINCRONIA INSUFFICIENTE', 'warn', 0.8);
          audio.ui('error');
        }
      }
      if (this.state === 'idle' && ctl.held.block) {
        this.state = 'block';
        this.blocking = true;
        this.blockStart = this.time;
        audio.servo();
      } else if (this.state === 'block' && !ctl.held.block) {
        this.state = 'idle';
        this.blocking = false;
      }
    }

    // movimento
    let speed = 7.6 * this.speedMul;
    if (mx * this.facing < 0) speed *= 0.72;
    if (this.state === 'block') speed *= 0.35;
    if (this.state === 'attack') speed *= 0.2;
    if (['special', 'hit', 'dead', 'victory'].includes(this.state) || !B?.fighting) speed = 0;
    if (this.state === 'dash') {
      const a = this.action;
      a.t += dt;
      const k = a.t / a.dur;
      this.vx = a.dir * (1 - k * 0.65) * 36 * (0.65 + this.stats.dash * 0.35);
      if (B && Math.random() < 0.7) B.fx.splash(this.x, 0.5);
      this.thrust.leg = true;
      if (a.t >= a.dur) {
        this.state = 'idle';
        this.action = null;
        this.thrust.leg = false;
      }
    } else {
      this.vx = damp(this.vx, mx * speed, 9, dt);
      this.thrust.leg = false;
    }
    this.knock *= Math.exp(-6 * dt);
    this.x += (this.vx + this.knock) * dt;

    if (this.state === 'hit') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.state = 'idle';
    }
    if (this.state === 'attack') this._updateAttack(dt * this.attackSpeed, ctl, B);
    else this.thrust.F = this.thrust.B = false;
    if (this.state === 'special') this._updateSpecial(dt, B);
    if (this.state === 'dead') this.deathTime += dt;

    this._animate(dt);
    if (B && this.overdrive > 0 && Math.random() < 0.5) {
      const [hx, hy] = this.point(Math.random() < 0.5 ? 'handF' : 'handB');
      B.fx.trail(hx, hy, this.cfg.colors.accent, 0.5, 0.3);
    }
    if (B && !this.alive && Math.random() < 0.3) {
      const [cx, cy] = this.point('chest');
      B.fx.sparks(cx + (Math.random() - 0.5) * 2, cy + (Math.random() - 0.5) * 2, '#ffb347', 5, 8);
      if (Math.random() < 0.3) B.fx.smoke(cx, cy, 2, '#202227', 1.2);
    }
  }

  _updateAttack(dt, ctl, B) {
    const a = this.action;
    const prevT = a.t;
    a.t += dt;
    const w = a.w;
    if (w.thruster) {
      const on = a.t > a.windup * 0.55 && a.t < a.windup + a.active + 0.08;
      this.thrust[a.side] = on;
      if (on && prevT <= a.windup * 0.55) audio.thruster();
    }
    for (let h = a.hitsDone; h < a.hits; h++) {
      const at = a.windup + (a.active * h) / a.hits;
      if (prevT < at + 1e-6 && a.t >= at) {
        a.hitsDone++;
        if (h === 0) {
          audio.whoosh(w.dmg > 80);
          this.vx += this.facing * (w.type === 'ranged' ? -3 : 7);
        }
        B?.onPlayerStrike(this, a.arm, w, h);
      }
    }
    // scia luminosa delle armi da taglio
    const tip = this.art.info[a.arm]?.tip;
    if (B && LONG_WEAPONS.has(this.weaponIds[a.arm]) && w.type !== 'ranged' && a.t > a.windup * 0.7 && a.t < a.windup + a.active + 0.06) {
      for (let k = 1; k <= 3; k++) {
        const [px, py] = this.point(a.side === 'F' ? 'foreF' : 'foreB', 0, (tip * k) / 3);
        B.fx.trail(px, py, this.cfg.colors.accent, 0.35 + k * 0.1, 0.22);
      }
    }
    const end = a.windup + a.active + a.recovery;
    if (ctl && a.t > a.windup && !a.queued) {
      if (ctl.take('left', 0.3)) a.queued = 'L';
      else if (ctl.take('right', 0.3)) a.queued = 'R';
      else if (ctl.take('dash', 0.2)) a.queued = 'dash';
      else if (this.sync >= 100 && ctl.take('special', 0.2)) a.queued = 'special';
    }
    if (a.queued && a.t >= a.windup + a.active + a.recovery * 0.35) {
      const q = a.queued;
      this.state = 'idle';
      this.action = null;
      this.thrust.F = this.thrust.B = false;
      if (q === 'L' || q === 'R') this.tryAttack(q, B, true);
      else if (q === 'special') this.trySpecial(B);
      else if (q === 'dash') this.tryDash(Math.abs(ctl.move.x) > 0.2 ? Math.sign(ctl.move.x) : -this.facing, B);
      return;
    }
    if (a.t >= end) {
      this.state = 'idle';
      this.action = null;
      this.thrust.F = this.thrust.B = false;
    }
  }

  _updateSpecial(dt, B) {
    const a = this.action;
    const prev = a.t;
    a.t += dt;
    const s = a.windup;
    const e = a.windup + a.active;
    if (prev < s && a.t >= s) B?.onSpecialFire(this, a.type);
    if (a.t >= s && a.t < e) B?.onSpecialTick(this, a.type, a.t - s, dt);
    if (prev < e && a.t >= e) B?.onSpecialEnd(this, a.type);
    if (a.t >= e + a.recovery) {
      this.state = 'idle';
      this.action = null;
    }
  }

  // ---------- animazione ----------
  _animate(dt) {
    const T = this.T;
    const t = this.time;
    for (const k of POSE_KEYS) T[k] = 0;
    Object.assign(T, this.art.leg.rest);
    Object.assign(T, this.relaxed ? RELAXED : GUARD);
    if (this.relaxed) {
      if (LONG_WEAPONS.has(this.weaponIds.R)) T.elbF = 1.1;
      if (LONG_WEAPONS.has(this.weaponIds.L)) T.elbB = 1.0;
    }
    T.bob = Math.sin(t * 1.7) * 0.04;
    T.lean += Math.sin(t * 1.7) * 0.012;
    T.head += Math.sin(t * 0.6) * 0.03;

    const vf = this.vx * this.facing;
    const speed = Math.abs(this.vx);
    if (speed > 0.6 && this.state !== 'dash' && this.alive) {
      const dir = vf >= 0 ? 1 : -1;
      this.phase += dt * (2.4 + speed * 0.42) * dir;
      const amp = clamp(speed / 7, 0, 1.15);
      const s = Math.sin(this.phase);
      const c = Math.cos(this.phase);
      T.hipF += s * 0.42 * amp;
      T.hipB -= s * 0.42 * amp;
      T.kneeF += Math.max(0, c) * 0.75 * amp;
      T.kneeB += Math.max(0, -c) * 0.75 * amp;
      T.footF = -Math.max(0, c) * 0.25 * amp;
      T.footB = -Math.max(0, -c) * 0.25 * amp;
      T.bob += -Math.abs(c) * 0.12 * amp;
      T.armF -= s * 0.12 * amp;
      T.armB += s * 0.12 * amp;
      T.lean += 0.05 * amp * dir;
      if (Math.sign(c) !== Math.sign(this.lastCos)) this.stepCallback?.(c < 0 ? 'F' : 'B', amp);
      this.lastCos = c;
    }

    const a = this.action;
    if (this.state === 'attack' && a) {
      const P = POSES[a.side][a.anim];
      const base = this.relaxed ? RELAXED : GUARD;
      const pose = {};
      if (a.t < a.windup) {
        blendInto(pose, base, 1);
        blendInto(pose, P.W, smooth(a.t / a.windup));
      } else if (a.t < a.windup + a.active) {
        const k = (a.t - a.windup) / a.active;
        if (a.hits > 1) {
          if (k < 0.5) {
            blendInto(pose, P.W, 1);
            blendInto(pose, P.S, easeOut(k * 2));
          } else {
            blendInto(pose, P.S, 1);
            blendInto(pose, P.W, easeOut((k - 0.5) * 2) * 0.7);
          }
        } else {
          blendInto(pose, P.W, 1);
          blendInto(pose, P.S, easeOut(k));
        }
      } else {
        const k = clamp(((a.t - a.windup - a.active) / a.recovery) * 1.25 - 0.25, 0, 1);
        blendInto(pose, P.S, 1);
        blendInto(pose, base, smooth(k));
      }
      blendInto(T, pose, 1);
    } else if (this.state === 'block') blendInto(T, BLOCK, 1);
    else if (this.state === 'hit') blendInto(T, HIT, clamp(this.stateTimer * 3, 0, 1));
    else if (this.state === 'dash') {
      const d = { ...DASH };
      if (a && a.dir !== this.facing) d.lean = -0.25;
      blendInto(T, d, 1);
    } else if (this.state === 'special' && a) {
      const P = SPECIALS[a.type];
      const pose = {};
      if (a.t < a.windup) {
        blendInto(pose, GUARD, 1);
        blendInto(pose, P.W, smooth(a.t / a.windup));
      } else if (a.t < a.windup + a.active) {
        blendInto(pose, P.W, 1);
        blendInto(pose, P.S, easeOut(clamp((a.t - a.windup) / Math.min(0.3, a.active), 0, 1)));
      } else {
        blendInto(pose, P.S, 1);
        blendInto(pose, GUARD, smooth(clamp((a.t - a.windup - a.active) / a.recovery, 0, 1)));
      }
      blendInto(T, pose, 1);
    } else if (this.state === 'victory') {
      blendInto(T, VICTORY, 1);
      T.armF += Math.sin(t * 3) * 0.05;
    } else if (this.state === 'dead') {
      blendInto(T, DEFEAT, smooth(clamp(this.deathTime / 1.4, 0, 1)));
    }

    const lambda = this.state === 'attack' || this.state === 'dash' ? 28 : this.state === 'dead' ? 4 : 14;
    for (const k of POSE_KEYS) this.pose[k] = damp(this.pose[k], T[k], lambda, dt);
    this.J = solveRobot(this.art, this.pose);
  }

  /** Animazione per menu e hangar (senza combattimento). */
  updateDisplay(dt) {
    this.time += dt;
    this._animate(dt);
  }

  /** Punto di un pezzo nel mondo. */
  point(name, lx, ly) {
    const J = this.J;
    let m;
    let x = lx ?? 0;
    let y = ly ?? 0;
    switch (name) {
      case 'core':
        m = J.torso;
        x = this.art.core[0];
        y = this.art.core[1];
        break;
      case 'chest':
        m = J.torso;
        x = 0.2;
        y = -2.0;
        break;
      case 'head':
        m = J.head;
        y = -0.8;
        break;
      case 'handF':
        m = J.foreF;
        y = ly ?? 2.6;
        break;
      case 'handB':
        m = J.foreB;
        y = ly ?? 2.6;
        break;
      case 'muzzleF':
        m = J.foreF;
        [x, y] = this.art.info.R?.muzzle || [0, 2.9];
        break;
      case 'muzzleB':
        m = J.foreB;
        [x, y] = this.art.info.L?.muzzle || [0, 2.9];
        break;
      default:
        m = J[name] || J.torso;
    }
    const [px, py] = M.p(m, x, y);
    return [this.x + px * this.facing * this.art.scale[0], this.y - py * this.art.scale[1]];
  }

  draw(ctx, cam, W, H, o = {}) {
    const sx = this.facing * this.art.scale[0];
    const sy = this.art.scale[1];
    let glow = 1.1 + Math.sin(this.time * 4) * 0.2;
    if (this.sync >= 100) glow += 0.8 + Math.abs(Math.sin(this.time * 7)) * 0.8;
    if (this.overdrive > 0) glow += 1.5;
    if (this.state === 'special') glow += 1.5;
    if (!this.alive) glow = Math.max(0, 1 - this.deathTime * 0.6) * (Math.random() > 0.2 ? 1 : 0.1);
    const sink = this.state === 'dead' ? Math.min(1.0, this.deathTime * 0.3) : 0;
    if (o.reflection) {
      const k = cam.ppu(H);
      const [px, py] = cam.toScreen(this.x, 0, W, H);
      drawRobot(ctx, this.art, this.J, [k * sx, 0, 0, -k * sy * 0.75, px, py + k * 0.2], { alpha: 0.24 });
      return;
    }
    const base = cam.base(this.x, this.y - sink, W, H, sx, sy);
    drawRobot(ctx, this.art, this.J, base, {
      flash: this.hitFlash,
      glow,
      thrustF: this.thrust.F,
      thrustB: this.thrust.B,
      thrustLeg: this.thrust.leg,
      alpha: o.alpha,
    });
  }
}

function art0(art) {
  return { ...art.leg.rest };
}

export { lerp };
