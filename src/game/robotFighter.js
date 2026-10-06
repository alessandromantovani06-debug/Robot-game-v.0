import * as THREE from 'three';
import { buildRobot, HIP_Y } from '../render/robotBuilder.js';
import { computeStats, getPart } from '../data/parts.js';
import { audio } from '../core/audio.js';
import {
  GUARD, ATTACK_POSES, BLOCK_POSE, HIT_POSE, SPECIAL_POSES, VICTORY_POSE, DEFEAT_POSE, POSE_KEYS,
  mirrorPose, damp, dampAngle, clamp, lerp, smooth, easeOut,
} from './anim.js';

export const WATER_DEPTH = 1.15;

const RELAXED = {
  shLx: -0.08, shLy: 0, shLz: 0.22, elLx: -0.4,
  shRx: -0.08, shRy: 0, shRz: -0.22, elRx: -0.4,
  spineX: 0, spineY: 0, neckX: 0, neckY: 0,
};

const LONG_WEAPONS = new Set(['wp_chainsword', 'wp_hammer', 'wp_claws', 'wp_plasma']);

const ANIM_FOR_WEAPON = {
  wp_fist: 'punch',
  wp_rocket: 'heavy',
  wp_chainsword: 'slash',
  wp_hammer: 'smash',
  wp_plasma: 'shoot',
  wp_claws: 'slash',
};

// Pose d'attacco pre-specchiate per il braccio sinistro.
const POSES = { R: ATTACK_POSES, L: {} };
for (const [k, v] of Object.entries(ATTACK_POSES)) {
  POSES.L[k] = { windup: mirrorPose(v.windup), strike: mirrorPose(v.strike) };
}

const SPECIAL_TIMING = {
  beam: { windup: 0.55, active: 1.35, recovery: 0.5 },
  missiles: { windup: 0.45, active: 1.15, recovery: 0.45 },
  emp: { windup: 0.65, active: 0.3, recovery: 0.8 },
  overdrive: { windup: 0.4, active: 0.9, recovery: 0.3 },
};

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();

const TRAIL_LENGTH = { wp_chainsword: 4.8, wp_claws: 2.6, wp_hammer: 2.4 };

function blendInto(target, pose, w) {
  for (const k in pose) target[k] = lerp(target[k] ?? 0, pose[k], w);
}

export class RobotFighter {
  constructor(cfg, parent, { shadows = false, groundY = -WATER_DEPTH, relaxed = false } = {}) {
    this.cfg = cfg;
    this.model = buildRobot(cfg, { shadows });
    parent.add(this.model.root);
    this.parent = parent;
    this.stats = computeStats(cfg);
    this.weapons = { L: getPart(cfg.armL).weapon, R: getPart(cfg.armR).weapon };
    this.weaponIds = { L: cfg.armL, R: cfg.armR };
    this.torso = getPart(cfg.torso);
    this.special = this.torso.special;
    this.maxHp = this.hp = this.stats.hp;
    this.maxEnergy = this.energy = this.stats.energy;
    this.sync = 0;
    this.radius = 2.3 * this.model.body.scale.x;
    this.height = this.model.height;
    this.groundY = groundY;
    this.relaxed = relaxed;

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.knock = new THREE.Vector3();
    this.yaw = 0;
    this.state = 'idle';
    this.action = null;
    this.phase = 0;
    this.time = Math.random() * 10;
    this.pose = {};
    this.target = {};
    POSE_KEYS.forEach((k) => (this.pose[k] = 0));
    this.invuln = 0;
    this.energyDelay = 0;
    this.blockStart = -10;
    this.blocking = false;
    this.overdrive = 0;
    this.stateTimer = 0;
    this.hitFlash = 0;
    this.alive = true;
    this.lastCos = 1;
    this.moveInput = new THREE.Vector2();
    this.stepCallback = null;
    this.deathTime = 0;
    this._applyPose();
  }

  get attackSpeed() {
    return this.overdrive > 0 ? 1.4 : 1;
  }

  get powerMul() {
    return this.stats.power * (this.overdrive > 0 ? 1.6 : 1);
  }

  get speedMul() {
    return this.stats.speed * (this.overdrive > 0 ? 1.3 : 1);
  }

  forward(out = _v) {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  canAct() {
    return this.alive && (this.state === 'idle' || this.state === 'block');
  }

  // ---------- azioni ----------
  tryAttack(arm, B, chained = false) {
    const w = this.weapons[arm];
    if (this.overdrive <= 0 && this.energy < w.energy) {
      B.message('ENERGIA INSUFFICIENTE', 'warn', 0.8);
      audio.ui('error');
      return false;
    }
    if (this.overdrive <= 0) {
      this.energy -= w.energy;
      if (w.energy > 0) this.energyDelay = 0.8;
    }
    const k = chained ? 0.6 : 1;
    this.state = 'attack';
    this.blocking = false;
    this.action = {
      kind: 'attack',
      arm,
      w,
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
    const cost = 20;
    if (this.overdrive <= 0 && this.energy < cost) {
      B.message('ENERGIA INSUFFICIENTE', 'warn', 0.8);
      return false;
    }
    if (this.overdrive <= 0) {
      this.energy -= cost;
      this.energyDelay = 0.6;
    }
    this.state = 'dash';
    this.blocking = false;
    const dur = 0.32;
    this.action = { kind: 'dash', t: 0, dur, dir: dir.clone() };
    this.invuln = 0.36;
    const speed = (22 * (0.75 + this.stats.dash * 0.25)) / dur * 0.3;
    this.vel.copy(dir).multiplyScalar(speed);
    audio.whoosh(true);
    audio.thruster();
    this.model.legThrusters.forEach((f) => (f.visible = true));
    return true;
  }

  trySpecial(B) {
    if (this.sync < 100) return false;
    this.sync = 0;
    const tm = SPECIAL_TIMING[this.special];
    this.state = 'special';
    this.blocking = false;
    this.invuln = tm.windup + tm.active + tm.recovery;
    this.action = { kind: 'special', type: this.special, t: 0, ...tm, fired: 0, tick: 0 };
    audio.special();
    B.onSpecialStart(this.special);
    return true;
  }

  takeHit(dmg, sourcePos, knock, B) {
    // restituisce { result: 'dodge' | 'perfect' | 'block' | 'hit', dmg }
    if (!this.alive) return { result: 'none', dmg: 0 };
    if (this.invuln > 0) return { result: 'dodge', dmg: 0 };
    _w.copy(sourcePos).sub(this.pos).setY(0).normalize();
    const facing = this.forward(_v).dot(_w) > 0.25;
    if (this.blocking && facing) {
      if (this.time - this.blockStart < 0.22) {
        this.sync = Math.min(100, this.sync + 12 * this.stats.sync);
        return { result: 'perfect', dmg: 0 };
      }
      const blocked = Math.round(dmg * 0.25);
      this.energy = Math.max(0, this.energy - dmg * 0.18);
      this.energyDelay = 0.6;
      this.hp -= blocked;
      this.knock.copy(_w).multiplyScalar(-knock * 1.2);
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
    this.knock.copy(_w).multiplyScalar(-knock * 3);
    if (this.state !== 'special') this._stagger(knock >= 6 ? 0.65 : 0.35);
    this._checkDeath(B);
    return { result: 'hit', dmg };
  }

  _stagger(t) {
    this.state = 'hit';
    this.stateTimer = t;
    this.action = null;
    this.blocking = false;
    this.model.thrustersL.forEach((f) => (f.visible = false));
    this.model.thrustersR.forEach((f) => (f.visible = false));
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
    this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
    if (this.overdrive > 0) {
      this.overdrive -= dt;
      if (this.overdrive <= 0) B?.message('OVERDRIVE TERMINATO', 'info', 1);
    }
    this.energyDelay -= dt;
    if (this.energyDelay <= 0 && this.alive) {
      this.energy = Math.min(this.maxEnergy, this.energy + 16 * this.stats.regen * dt);
    }

    const target = B?.target;
    let desiredYaw = this.yaw;
    if (target && this.alive && this.state !== 'victory') {
      desiredYaw = Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
    }

    // direzione di movimento relativa al bersaglio (o alla camera)
    const basisYaw = target ? desiredYaw : B ? B.cameraYaw : this.yaw;
    const fx = Math.sin(basisYaw);
    const fz = Math.cos(basisYaw);
    const mx = ctl ? ctl.move.x : 0;
    const my = ctl ? ctl.move.y : 0;
    // destra = forward ruotato di -90 gradi attorno a Y (il robot guarda +Z, la sua destra e' -X)
    const wish = _w.set(fx * my - fz * mx, 0, fz * my + fx * mx);
    if (!target && wish.lengthSq() > 0.01) desiredYaw = Math.atan2(wish.x, wish.z);

    // input
    if (ctl && this.alive && B?.fighting) {
      if (this.state === 'idle' || this.state === 'block') {
        if (ctl.take('special') && this.sync >= 100) this.trySpecial(B);
        else if (ctl.take('dash', 0.15)) {
          const d = wish.lengthSq() > 0.01 ? wish.clone().normalize() : this.forward(new THREE.Vector3()).multiplyScalar(-1);
          this.tryDash(d, B);
        } else if (ctl.take('left', 0.25)) this.tryAttack('L', B);
        else if (ctl.take('right', 0.25)) this.tryAttack('R', B);
        else if (ctl.take('special') && this.sync < 100) {
          B.message('SINCRONIA INSUFFICIENTE', 'warn', 0.8);
        }
      }
      // la parata puo' interrompere il recupero di un attacco
      const a = this.action;
      if (this.state === 'attack' && ctl.held.block && a && a.t > a.windup + a.active * 0.5) {
        this.state = 'idle';
        this.action = null;
        this._hideArmThrusters();
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
    let accel = 9;
    if (this.state === 'block') speed *= 0.35;
    if (this.state === 'attack') speed *= 0.2;
    if (this.state === 'special' || this.state === 'hit' || this.state === 'dead' || this.state === 'victory') speed = 0;
    if (!B?.fighting && ctl) speed = 0;

    if (this.state === 'dash') {
      const a = this.action;
      a.t += dt;
      const k = a.t / a.dur;
      this.vel.copy(a.dir).multiplyScalar((1 - k * 0.7) * 34 * (0.7 + this.stats.dash * 0.3));
      if (B && Math.random() < 0.8) {
        _v.set(this.pos.x, 0.5, this.pos.z);
        B.fx.splash(_v, 0.6);
      }
      if (a.t >= a.dur) {
        this.state = 'idle';
        this.action = null;
        this.model.legThrusters.forEach((f) => (f.visible = false));
      }
    } else {
      const tvx = wish.x * speed;
      const tvz = wish.z * speed;
      this.vel.x = damp(this.vel.x, tvx, accel, dt);
      this.vel.z = damp(this.vel.z, tvz, accel, dt);
    }

    // spinta all'indietro dei colpi
    this.knock.multiplyScalar(Math.exp(-6 * dt));
    this.pos.x += (this.vel.x + this.knock.x) * dt;
    this.pos.z += (this.vel.z + this.knock.z) * dt;

    const turnRate = this.state === 'attack' ? 6 : this.state === 'special' ? 3 : 10;
    if (this.alive && this.state !== 'hit') this.yaw = dampAngle(this.yaw, desiredYaw, turnRate, dt);

    // avanzamento azioni
    if (this.state === 'hit') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.state = 'idle';
    }
    if (this.state === 'attack') this._updateAttack(dt * this.attackSpeed, ctl, B);
    if (this.state === 'special') this._updateSpecial(dt, B);
    if (this.state === 'dead') this.deathTime += dt;

    this._animate(dt);
    this._visuals(dt, B);
  }

  _updateAttack(dt, ctl, B) {
    const a = this.action;
    const prevT = a.t;
    a.t += dt;
    const w = a.w;
    const strikeStart = a.windup;
    // propulsori del pugno a razzo
    if (w.thruster) {
      const on = a.t > a.windup * 0.55 && a.t < a.windup + a.active + 0.08;
      const list = a.arm === 'L' ? this.model.thrustersL : this.model.thrustersR;
      list.forEach((f) => (f.visible = on));
      if (on && prevT <= a.windup * 0.55) audio.thruster();
    }
    // momenti d'impatto
    for (let h = a.hitsDone; h < a.hits; h++) {
      const at = strikeStart + (a.active * h) / a.hits;
      if (prevT < at + 1e-6 && a.t >= at) {
        a.hitsDone++;
        if (h === 0) {
          audio.whoosh(w.dmg > 80);
          // piccolo affondo in avanti
          this.forward(_v);
          this.vel.addScaledVector(_v, w.type === 'ranged' ? -3 : 7);
        }
        B?.onPlayerStrike(this, a.arm, w, h);
      }
    }
    // scia luminosa delle armi da taglio
    const trailLen = TRAIL_LENGTH[this.weaponIds[a.arm]];
    if (B && trailLen && a.t > a.windup * 0.7 && a.t < a.windup + a.active + 0.06) {
      const j = this.model.joints;
      const hand = a.arm === 'L' ? j.handL : j.handR;
      const elbow = a.arm === 'L' ? j.elL : j.elR;
      hand.getWorldPosition(_v);
      elbow.getWorldPosition(_tmp);
      _tmp.subVectors(_v, _tmp).normalize();
      for (let k = 1; k <= 4; k++) {
        _tmp2.copy(_v).addScaledVector(_tmp, (trailLen * k) / 4);
        B.fx.trail(_tmp2, this.cfg.colors.accent, 0.5 + k * 0.15, 0.22);
      }
    }
    // combo: prenota l'attacco successivo durante il recupero
    const end = a.windup + a.active + a.recovery;
    if (ctl && a.t > a.windup && !a.queued) {
      if (ctl.take('left', 0.3)) a.queued = 'L';
      else if (ctl.take('right', 0.3)) a.queued = 'R';
      else if (ctl.take('dash', 0.2)) a.queued = 'dash';
      else if (ctl.take('special', 0.2) && this.sync >= 100) a.queued = 'special';
    }
    const cancelAt = a.windup + a.active + a.recovery * 0.35;
    if (a.queued && a.t >= cancelAt) {
      const q = a.queued;
      this.state = 'idle';
      this.action = null;
      this._hideArmThrusters();
      if (q === 'L' || q === 'R') this.tryAttack(q, B, true);
      else if (q === 'special') this.trySpecial(B);
      else if (q === 'dash') {
        const d = _w.set(ctl.move.x, 0, ctl.move.y);
        if (d.lengthSq() < 0.01) this.forward(d).multiplyScalar(-1);
        else {
          const yaw = this.yaw;
          d.set(Math.sin(yaw) * ctl.move.y - Math.cos(yaw) * ctl.move.x, 0, Math.cos(yaw) * ctl.move.y + Math.sin(yaw) * ctl.move.x).normalize();
        }
        this.tryDash(d.clone(), B);
      }
      return;
    }
    if (a.t >= end) {
      this.state = 'idle';
      this.action = null;
      this._hideArmThrusters();
    }
  }

  _hideArmThrusters() {
    this.model.thrustersL.forEach((f) => (f.visible = false));
    this.model.thrustersR.forEach((f) => (f.visible = false));
  }

  _updateSpecial(dt, B) {
    const a = this.action;
    const prev = a.t;
    a.t += dt;
    const activeStart = a.windup;
    const activeEnd = a.windup + a.active;
    if (prev < activeStart && a.t >= activeStart) B?.onSpecialFire(this, a.type);
    if (a.t >= activeStart && a.t < activeEnd) {
      a.tick += dt;
      B?.onSpecialTick(this, a.type, a.t - activeStart, dt);
    }
    if (prev < activeEnd && a.t >= activeEnd) B?.onSpecialEnd(this, a.type);
    if (a.t >= activeEnd + a.recovery) {
      this.state = 'idle';
      this.action = null;
    }
  }

  // ---------- animazione ----------
  _animate(dt) {
    const T = this.target;
    const rest = this.model.rest;
    const t = this.time;
    for (const k of POSE_KEYS) T[k] = 0;
    T.hipLx = T.hipRx = rest.hip;
    T.kneeLx = T.kneeRx = rest.knee;
    T.ankleLx = T.ankleRx = rest.ankle;
    Object.assign(T, this.relaxed ? RELAXED : GUARD);
    if (this.relaxed) {
      // le armi lunghe a riposo puntano in avanti invece che nel pavimento
      if (LONG_WEAPONS.has(this.weaponIds.L)) T.elLx = -1.1;
      if (LONG_WEAPONS.has(this.weaponIds.R)) T.elRx = -1.1;
    }
    T.hipsY = Math.sin(t * 1.7) * 0.04;
    T.spineX += Math.sin(t * 1.7) * 0.015;
    T.neckY += Math.sin(t * 0.5) * 0.05;

    // locomozione
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    const lvz = this.vel.x * sin + this.vel.z * cos;
    const lvx = this.vel.x * cos - this.vel.z * sin;
    const speed = Math.hypot(lvx, lvz);
    if (speed > 0.6 && this.state !== 'dash' && this.alive) {
      this.phase += dt * (2.2 + speed * 0.42);
      const amp = clamp(speed / 7, 0, 1.15);
      const fz = lvz / speed;
      const fx = lvx / speed;
      const sL = Math.sin(this.phase);
      const sR = -sL;
      const c = Math.cos(this.phase);
      const liftL = Math.max(0, c);
      const liftR = Math.max(0, -c);
      T.hipLx += -sL * 0.5 * amp * fz;
      T.hipRx += -sR * 0.5 * amp * fz;
      T.hipLz += sL * 0.28 * amp * fx;
      T.hipRz += sR * 0.28 * amp * fx;
      T.kneeLx += liftL * 0.85 * amp;
      T.kneeRx += liftR * 0.85 * amp;
      T.ankleLx -= liftL * 0.25 * amp;
      T.ankleRx -= liftR * 0.25 * amp;
      T.hipsY += -0.1 * amp + Math.abs(c) * 0.14 * amp;
      T.spineY += sL * 0.07 * amp;
      T.spineZ += c * 0.03 * amp;
      T.shLx += sR * 0.15 * amp;
      T.shRx += sL * 0.15 * amp;
      T.spineX += 0.06 * amp * fz;
      if (Math.sign(c) !== Math.sign(this.lastCos)) {
        if (this.stepCallback) this.stepCallback(c < 0 ? 'L' : 'R', amp);
      }
      this.lastCos = c;
    }

    // sovrapposizione delle azioni
    const a = this.action;
    if (this.state === 'attack' && a) {
      const P = POSES[a.arm][a.anim];
      const base = { ...(this.relaxed ? RELAXED : GUARD) };
      const pose = {};
      if (a.t < a.windup) {
        blendInto(pose, base, 1);
        blendInto(pose, P.windup, smooth(a.t / a.windup));
      } else if (a.t < a.windup + a.active) {
        const k = (a.t - a.windup) / a.active;
        if (a.hits > 1) {
          // doppio colpo: andata e ritorno
          if (k < 0.5) {
            blendInto(pose, P.windup, 1);
            blendInto(pose, P.strike, easeOut(k * 2));
          } else {
            blendInto(pose, P.strike, 1);
            blendInto(pose, P.windup, easeOut((k - 0.5) * 2));
          }
        } else {
          blendInto(pose, P.windup, 1);
          blendInto(pose, P.strike, easeOut(k));
        }
      } else {
        const k = clamp(((a.t - a.windup - a.active) / a.recovery) * 1.25 - 0.25, 0, 1);
        blendInto(pose, a.hits > 1 ? P.windup : P.strike, 1);
        blendInto(pose, base, smooth(k));
      }
      blendInto(T, pose, 1);
    } else if (this.state === 'block') {
      blendInto(T, BLOCK_POSE, 1);
    } else if (this.state === 'hit') {
      blendInto(T, HIT_POSE, clamp(this.stateTimer * 3, 0, 1));
    } else if (this.state === 'dash' && a) {
      const lean = { spineX: 0.25, hipsY: -0.35, shLx: 0.3, shRx: 0.3, elLx: -0.8, elRx: -0.8 };
      blendInto(T, lean, 1);
    } else if (this.state === 'special' && a) {
      const P = SPECIAL_POSES[a.type];
      const pose = {};
      if (a.t < a.windup) {
        blendInto(pose, GUARD, 1);
        blendInto(pose, P.windup, smooth(a.t / a.windup));
      } else if (a.t < a.windup + a.active) {
        blendInto(pose, P.windup, 1);
        blendInto(pose, P.strike, easeOut(clamp((a.t - a.windup) / Math.min(0.3, a.active), 0, 1)));
      } else {
        blendInto(pose, P.strike, 1);
        blendInto(pose, GUARD, smooth(clamp((a.t - a.windup - a.active) / a.recovery, 0, 1)));
      }
      blendInto(T, pose, 1);
    } else if (this.state === 'victory') {
      blendInto(T, VICTORY_POSE, 1);
      T.shRx += Math.sin(t * 3) * 0.05;
    } else if (this.state === 'dead') {
      blendInto(T, DEFEAT_POSE, smooth(clamp(this.deathTime / 1.4, 0, 1)));
      T.spineZ = Math.sin(this.deathTime * 0.7) * 0.05;
    }

    // accovacciarsi piega le ginocchia (IK semplificata)
    const crouch = Math.max(0, -T.hipsY);
    if (this.state !== 'dead') {
      T.hipLx -= crouch * 0.35;
      T.hipRx -= crouch * 0.35;
      T.kneeLx += crouch * 0.7;
      T.kneeRx += crouch * 0.7;
      T.ankleLx -= crouch * 0.35;
      T.ankleRx -= crouch * 0.35;
    }

    const lambda = this.state === 'attack' || this.state === 'dash' ? 30 : this.state === 'dead' ? 4 : 14;
    for (const k of POSE_KEYS) this.pose[k] = damp(this.pose[k], T[k], lambda, dt);
    this._applyPose();
  }

  _applyPose() {
    const p = this.pose;
    const j = this.model.joints;
    j.hips.position.y = HIP_Y + p.hipsY;
    j.hips.rotation.x = p.hipsX;
    j.spine.rotation.set(p.spineX, p.spineY, p.spineZ);
    j.neck.rotation.set(p.neckX, p.neckY, 0);
    j.shL.rotation.set(p.shLx, p.shLy, p.shLz);
    j.elL.rotation.x = p.elLx;
    j.shR.rotation.set(p.shRx, p.shRy, p.shRz);
    j.elR.rotation.x = p.elRx;
    j.hipL.rotation.set(p.hipLx, 0, p.hipLz);
    j.kneeL.rotation.x = p.kneeLx;
    j.ankleL.rotation.x = p.ankleLx;
    j.hipR.rotation.set(p.hipRx, 0, p.hipRz);
    j.kneeR.rotation.x = p.kneeRx;
    j.ankleR.rotation.x = p.ankleRx;
    const root = this.model.root;
    root.position.set(this.pos.x, this.groundY - (this.state === 'dead' ? Math.min(1.2, this.deathTime * 0.3) : 0), this.pos.z);
    root.rotation.y = this.yaw;
  }

  _visuals(dt, B) {
    const m = this.model;
    const t = this.time;
    let glow = 1.6 + Math.sin(t * 4) * 0.2;
    if (this.sync >= 100) glow += 0.8 + Math.abs(Math.sin(t * 7)) * 0.9;
    if (this.overdrive > 0) glow += 1.8 + Math.sin(t * 20) * 0.5;
    if (this.state === 'special' && this.action && this.action.t < this.action.windup + this.action.active) glow += 2.2;
    if (!this.alive) glow = Math.max(0.1, 1.6 - this.deathTime * 0.8) * (Math.random() > 0.15 ? 1 : 0.2);
    m.glow.emissiveIntensity = glow;
    m.visor.emissiveIntensity = this.alive ? 1.6 + Math.sin(t * 2.5) * 0.15 : glow * 0.5;
    for (const s of m.spinners) {
      const ax = s.userData.axis || 'z';
      s.rotation[ax] += dt * (this.overdrive > 0 ? 18 : 7);
    }
    const f = this.hitFlash;
    for (const mat of m.bodyMaterials) {
      mat.emissive.setRGB(0.5 * f, 0.12 * f, 0.04 * f);
    }
    // fiammelle dei propulsori
    const flick = 0.85 + Math.random() * 0.3;
    for (const list of [m.thrustersL, m.thrustersR, m.legThrusters]) {
      for (const fl of list) if (fl.visible) fl.scale.set(1, flick, 1);
    }
    if (B && this.overdrive > 0 && Math.random() < 0.5) {
      const hand = Math.random() < 0.5 ? m.joints.handL : m.joints.handR;
      hand.getWorldPosition(_v);
      B.fx.trail(_v, this.cfg.colors.accent, 0.8, 0.3);
    }
    if (B && !this.alive && Math.random() < 0.3) {
      m.joints.chest.getWorldPosition(_v);
      _v.x += (Math.random() - 0.5) * 3;
      _v.y += (Math.random() - 0.5) * 3;
      B.fx.sparks(_v, '#ffb347', 6, 8);
      if (Math.random() < 0.3) B.fx.smokePuff(_v, 2, '#202227', 2.5);
    }
  }

  /** Animazione per l'hangar / menu, senza combattimento. */
  updateDisplay(dt) {
    this.time += dt;
    this._animate(dt);
    this._visuals(dt, null);
  }

  worldPoint(name, out = new THREE.Vector3()) {
    const j = this.model.joints;
    switch (name) {
      case 'core':
        return (this.model.core || j.chest).getWorldPosition(out);
      case 'muzzleL':
        return this.model.muzzleL.getWorldPosition(out);
      case 'muzzleR':
        return this.model.muzzleR.getWorldPosition(out);
      case 'handL':
        return j.handL.getWorldPosition(out);
      case 'handR':
        return j.handR.getWorldPosition(out);
      case 'head':
        return j.head.getWorldPosition(out);
      default:
        return j.chest.getWorldPosition(out);
    }
  }

  dispose() {
    this.parent.remove(this.model.root);
    this.model.dispose();
  }
}
