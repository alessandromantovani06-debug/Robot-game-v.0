import * as THREE from 'three';
import { buildKaiju } from '../render/kaijuBuilder.js';
import { KAIJU, MOVES } from '../data/kaiju.js';
import { audio } from '../core/audio.js';
import { damp, dampAngle, clamp, lerp, smooth, easeOut, wrapAngle } from './anim.js';
import { WATER_DEPTH } from './robotFighter.js';

const KEYS = [
  'hipsY', 'hipsX', 'spineX', 'spineY', 'neckX', 'neckY', 'jaw', 'pinch',
  'armLx', 'armLy', 'armLz', 'elL', 'armRx', 'armRy', 'armRz', 'elR', 'tailX', 'tailY',
];

// Pose chiave per le mosse (W = fine caricamento, S = colpo). Definite per il braccio destro.
const MOVE_POSES = {
  swipe: {
    W: { armRx: -2.5, armRy: -0.3, armRz: -0.7, elR: -1.3, spineY: -0.45, neckX: -0.1, jaw: 0.3 },
    S: { armRx: -0.7, armRy: 1.0, armRz: 0, elR: -0.2, spineY: 0.55, spineX: 0.25, jaw: 0.5 },
  },
  bite: {
    W: { neckX: -0.45, jaw: 0.55, spineX: -0.2, armRx: -0.2, armLx: -0.2 },
    S: { neckX: 0.4, jaw: 0.05, spineX: 0.4, hipsY: -0.3 },
  },
  charge: {
    W: { hipsY: -0.8, spineX: 0.35, neckX: 0.45, jaw: 0.35, armRx: 0.5, armLx: 0.5, tailX: 1 },
    S: { hipsY: -0.4, spineX: 0.45, neckX: 0.5, jaw: 0.6, armRx: 0.4, armLx: 0.4, tailX: 1 },
  },
  tail: {
    W: { spineY: 0.8, tailY: -1.3, hipsY: -0.3, neckY: -0.4 },
    S: { spineY: -0.3, tailY: 0.6, hipsY: -0.2, tailX: -0.5 },
  },
  spit: {
    W: { neckX: -0.7, jaw: 0.8, spineX: -0.3, hipsY: 0.1 },
    S: { neckX: 0.3, jaw: 1.0, spineX: 0.25, hipsY: -0.2 },
  },
  emp: {
    W: { spineX: -0.6, hipsX: -0.35, armRx: -2.6, armLx: -2.6, armRz: -0.4, armLz: 0.4, jaw: 0.9, neckX: -0.5, hipsY: 0.4 },
    S: { spineX: 0.5, hipsX: 0.15, armRx: -0.3, armLx: -0.3, jaw: 0.6, neckX: 0.3, hipsY: -0.6 },
  },
  slam: {
    W: { hipsY: -1.1, spineX: 0.4, armRx: 0.6, armLx: 0.6, tailX: 1, neckX: 0.2 },
    S: { hipsY: 0.2, spineX: -0.2, armRx: -2.2, armLx: -2.2, armRz: -0.5, armLz: 0.5, jaw: 0.8, tailX: -1 },
  },
  roar: {
    W: { neckX: -0.2, jaw: 0.3, spineX: -0.1 },
    S: { neckX: -0.75, jaw: 1.05, spineX: -0.45, armRz: -0.9, armLz: 0.9, armRx: -0.9, armLx: -0.9, hipsY: 0.1 },
  },
};

function mirrorArms(p) {
  const out = { ...p };
  const map = [['armRx', 'armLx', 1], ['armRy', 'armLy', -1], ['armRz', 'armLz', -1], ['elR', 'elL', 1]];
  for (const [r, l, s] of map) {
    const rv = p[r];
    const lv = p[l];
    delete out[r];
    delete out[l];
    if (rv !== undefined) out[l] = rv * s;
    if (lv !== undefined) out[r] = lv * s;
  }
  if (p.spineY !== undefined) out.spineY = -p.spineY;
  return out;
}

const _v = new THREE.Vector3();
const _u = new THREE.Vector3();

let uid = 0;

export class KaijuFighter {
  constructor(type, level, parent, { shadows = false } = {}) {
    const def = KAIJU[type];
    this.id = ++uid;
    this.def = def;
    this.type = type;
    this.level = level;
    this.name = def.name;
    this.model = buildKaiju(def, { shadows });
    parent.add(this.model.root);
    this.parent = parent;
    this.rig = this.model.rig;
    for (const a of this.rig.arms) a.sh.rotation.order = 'YXZ';
    this.maxHp = this.hp = Math.round(def.hp * (1 + 0.3 * (level - 1)));
    this.dmgMul = def.dmg * (1 + 0.15 * (level - 1));
    this.speed = def.speed * (1 + 0.04 * (level - 1));
    this.radius = def.radius;
    this.height = this.rig.height;
    this.moves = def.moves.map((m) => ({ id: m, ...MOVES[m] }));
    this.cooldowns = {};
    this.retreat = 0;
    this.moves.forEach((m) => (this.cooldowns[m.id] = m.kind === 'roar' ? 6 : 1 + Math.random() * 2));

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;
    this.state = 'spawn';
    this.stateTime = 0;
    this.move = null;
    this.poise = 0;
    this.poiseMax = 80 + def.category * 30;
    this.enraged = false;
    this.forceRoar = false;
    this.roarBuff = 0;
    this.alive = true;
    this.aiTimer = 1;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeTimer = 2;
    this.time = Math.random() * 10;
    this.phase = 0;
    this.hitFlash = 0;
    this.flinch = 0;
    this.armSide = 'R';
    this.deathTime = 0;
    this.spawnDepth = 16 * def.size;
    this.pose = {};
    this.target = {};
    KEYS.forEach((k) => (this.pose[k] = 0));
    this.marker = null;
    this.lastCos = 1;
    this.aggression = 0.55 + def.category * 0.1 + (level - 1) * 0.05;
  }

  get isAttacking() {
    return this.state === 'windup' || this.state === 'active';
  }

  // ---------- reazioni ----------
  takeHit(dmg, poiseDmg, dir, B) {
    if (!this.alive || this.state === 'spawn') return false;
    this.hp -= dmg;
    this.hitFlash = 1;
    this.flinch = 1;
    this.pos.addScaledVector(dir, Math.min(1.2, poiseDmg * 0.02));
    if (this.state !== 'stun') {
      this.poise += poiseDmg;
      if (this.poise >= this.poiseMax) {
        this.poise = 0;
        this.stagger(1.1, B);
        B?.message('KAIJU SBILANCIATO!', 'good', 0.9);
      }
    }
    if (!this.enraged && this.hp < this.maxHp * 0.35 && this.hp > 0) {
      this.enraged = true;
      this.forceRoar = true;
      B?.message(`${this.name} È INFURIATO!`, 'warn', 1.4);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(B);
    }
    return true;
  }

  stagger(t, B) {
    if (!this.alive) return;
    this._cancelMove(B);
    this.state = 'stagger';
    this.stateTime = t;
    audio.growl(1.3 / this.def.size);
  }

  stunFor(t, B) {
    if (!this.alive) return;
    this._cancelMove(B);
    this.state = 'stun';
    this.stateTime = t;
  }

  _cancelMove(B) {
    if (this.marker) {
      B?.fx.removeMarker(this.marker);
      this.marker = null;
    }
    if (this.move) {
      this.cooldowns[this.move.id] = this.move.cooldown * 0.5;
      this.move = null;
    }
    B?.releaseToken(this);
  }

  die(B) {
    this._cancelMove(B);
    this.alive = false;
    this.state = 'dead';
    this.deathTime = 0;
    this.deathDir = Math.random() < 0.5 ? -1 : 1;
    B?.onKaijuDeath(this);
  }

  // ---------- IA ----------
  update(dt, B) {
    this.time += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 5);
    this.flinch = Math.max(0, this.flinch - dt * 4);
    this.poise = Math.max(0, this.poise - dt * 12);
    this.roarBuff = Math.max(0, this.roarBuff - dt);
    for (const k in this.cooldowns) this.cooldowns[k] -= dt;

    const player = B.player;
    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const toPlayerYaw = Math.atan2(dx, dz);
    const speedMul = (this.enraged ? 1.18 : 1) * (this.roarBuff > 0 ? 1.12 : 1);
    let wantVel = 0;
    let strafe = 0;
    let turnRate = 2.6;

    switch (this.state) {
      case 'spawn': {
        this.stateTime += dt;
        if (this.stateTime >= 2.6) {
          this.state = 'idle';
          this.aiTimer = 0.8;
        }
        turnRate = 2;
        break;
      }
      case 'idle': {
        this.aiTimer -= dt;
        const prefer = this._preferredRange(player);
        if (player.alive && B.fighting) {
          if (this.retreat > 0) {
            // arretra fronteggiando il Titano per preparare carica, balzo o sputo
            this.retreat -= dt;
            wantVel = -0.85;
            if (dist > 16) {
              this.retreat = 0;
              this.aiTimer = 0;
            }
          } else if (dist > prefer + 1.5) wantVel = dist > 26 ? 1.45 : 1;
          else if (dist < prefer - 2.5) wantVel = -0.5;
          else {
            this.strafeTimer -= dt;
            if (this.strafeTimer <= 0) {
              this.strafeDir *= -1;
              this.strafeTimer = 1.5 + Math.random() * 2.5;
            }
            strafe = this.strafeDir * 0.45;
          }
          if (this.aiTimer <= 0) {
            this.aiTimer = 0.2 + Math.random() * 0.35;
            this._decide(dist, player, B);
          }
        }
        break;
      }
      case 'windup': {
        turnRate = this.move.kind === 'charge' ? 2.8 : 1.8;
        this._updateWindup(dt, dist, player, B);
        break;
      }
      case 'active': {
        turnRate = this.move.kind === 'charge' ? 0.5 : 0.25;
        this._updateActive(dt, dist, player, B);
        break;
      }
      case 'recovery': {
        turnRate = 0.9;
        this.stateTime -= dt;
        if (this.stateTime <= 0) this._endMove(B);
        break;
      }
      case 'stagger':
      case 'stun': {
        turnRate = 0;
        this.stateTime -= dt;
        if (this.state === 'stun' && Math.random() < 0.5) {
          this.model.rig.hips.getWorldPosition(_v);
          _v.y += 2;
          B.fx.electric(_v, '#7fe0ff', 6 * this.def.size, 3);
        }
        if (this.stateTime <= 0) {
          this.state = 'idle';
          this.aiTimer = 0.4;
        }
        break;
      }
      case 'dead': {
        this.deathTime += dt;
        turnRate = 0;
        break;
      }
    }

    // rotazione verso il Titano
    const spinning = this.state === 'active' && this.move?.anim === 'tail';
    if (this.alive && turnRate > 0 && !spinning) {
      const d = wrapAngle(toPlayerYaw - this.yaw);
      this.yaw += clamp(d, -turnRate * dt, turnRate * dt);
    }

    // locomozione
    if (this.state === 'idle' || this.state === 'recovery' || this.state === 'windup') {
      const fwd = _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      const right = _u.set(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
      const s = this.speed * speedMul;
      const k = this.state === 'idle' ? 1 : 0.15;
      const tvx = (fwd.x * wantVel + right.x * strafe) * s * k;
      const tvz = (fwd.z * wantVel + right.z * strafe) * s * k;
      this.vel.x = damp(this.vel.x, tvx, 3, dt);
      this.vel.z = damp(this.vel.z, tvz, 3, dt);
    } else if (this.state !== 'active') {
      this.vel.x = damp(this.vel.x, 0, 5, dt);
      this.vel.z = damp(this.vel.z, 0, 5, dt);
    }
    if (this.state !== 'spawn') {
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
    }

    this._animate(dt, player);
    this._visuals(dt, B);
  }

  _preferredRange(player) {
    const melee = this.moves.filter((m) => m.kind === 'melee');
    if (!melee.length) return 9;
    return Math.min(...melee.map((m) => m.range)) * 0.75 + player.radius;
  }

  _decide(dist, player, B) {
    const edge = dist - player.radius;
    const options = [];
    for (const m of this.moves) {
      if (this.cooldowns[m.id] > 0) continue;
      let ok = false;
      switch (m.kind) {
        case 'melee':
          ok = edge <= m.range * 0.9;
          break;
        case 'aoe':
          ok = edge <= m.range * 0.85;
          break;
        case 'charge':
        case 'leap':
        case 'projectile':
          ok = dist >= m.minRange && dist <= m.range;
          break;
        case 'roar':
          ok = this.forceRoar || (dist > 12 && Math.random() < 0.15);
          break;
      }
      if (ok) options.push(m);
    }
    if (this.forceRoar) {
      const r = options.find((m) => m.kind === 'roar');
      if (r) return this._startMove(r, B);
    }
    if (!options.length) return;
    if (Math.random() > this.aggression) return;
    if (!B.requestToken(this)) return;
    const total = options.reduce((s, m) => s + m.weight, 0);
    let r = Math.random() * total;
    for (const m of options) {
      r -= m.weight;
      if (r <= 0) return this._startMove(m, B);
    }
    this._startMove(options[0], B);
  }

  _startMove(m, B) {
    if (m.kind === 'roar') this.forceRoar = false;
    this.move = m;
    this.state = 'windup';
    const speedUp = this.enraged ? 0.82 : 1;
    this.moveTime = 0;
    this.windup = m.windup * speedUp;
    this.armSide = this.armSide === 'R' ? 'L' : 'R';
    this.hitDone = false;
    this.leapFrom = null;
    const pitch = 1.15 / this.def.size;
    switch (m.kind) {
      case 'melee':
      case 'charge':
        audio.growl(pitch);
        break;
      case 'aoe':
        if (m.drain) {
          audio.empCharge(this.windup);
          B.message('IMPULSO EMP IN CARICA!', 'danger', this.windup);
        } else audio.growl(pitch);
        break;
      case 'leap':
        audio.growl(pitch * 0.9);
        break;
      case 'projectile':
        audio.growl(pitch * 1.2);
        break;
      case 'roar':
        break;
    }
    if (m.kind === 'aoe' && m.drain) {
      this.marker = B.fx.marker(this.pos, m.range, this.def.glow);
    }
  }

  _updateWindup(dt, dist, player, B) {
    const m = this.move;
    this.moveTime += dt;
    if (this.marker && m.drain) this.marker.position.set(this.pos.x, 0.3, this.pos.z);
    if (m.kind === 'aoe' && m.drain && Math.random() < 0.6) {
      this.rig.hips.getWorldPosition(_v);
      _v.y += 3;
      B.fx.electric(_v, this.def.glow, 7 * this.def.size, 4);
    }
    if (m.kind === 'leap' && this.moveTime > this.windup * 0.5 && !this.marker) {
      this.leapTo = player.pos.clone().addScaledVector(player.vel, 0.4);
      this.marker = B.fx.marker(this.leapTo, m.aoe, '#ff3030');
    }
    if (this.moveTime >= this.windup) {
      this.state = 'active';
      this.moveTime = 0;
      this._onActiveStart(dist, player, B);
    }
  }

  _onActiveStart(dist, player, B) {
    const m = this.move;
    const fwd = _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    switch (m.kind) {
      case 'melee':
        audio.whoosh(true);
        this.vel.copy(fwd).multiplyScalar(6);
        break;
      case 'charge':
        audio.roar(1.2 / this.def.size, 1, 0.8);
        this.chargeDir = fwd.clone();
        break;
      case 'aoe':
        if (m.drain) {
          if (this.marker) {
            B.fx.removeMarker(this.marker);
            this.marker = null;
          }
          audio.zap();
          B.fx.shockwave(this.pos, this.def.glow, m.range, 0.7);
          B.shake(0.7);
          B.flashScreen(this.def.glow, 0.35);
          if (dist - player.radius <= m.range) B.kaijuHitsPlayer(this, m, { drain: true });
          this.hitDone = true;
        } else {
          audio.whoosh(true);
          this.spinFrom = this.yaw;
        }
        break;
      case 'projectile':
        audio.spit();
        B.spawnAcid(this);
        break;
      case 'leap':
        audio.whoosh(true);
        this.leapFrom = this.pos.clone();
        if (!this.leapTo) this.leapTo = player.pos.clone();
        if (!this.marker) this.marker = B.fx.marker(this.leapTo, m.aoe, '#ff3030');
        // non atterrare dentro il Titano
        _u.copy(this.leapTo).sub(this.leapFrom);
        break;
      case 'roar':
        audio.roar(0.95 / this.def.size, 1.6, 1.1);
        this.roarBuff = 7;
        B.shake(0.5);
        break;
    }
  }

  _updateActive(dt, dist, player, B) {
    const m = this.move;
    this.moveTime += dt;
    const k = clamp(this.moveTime / m.active, 0, 1);
    const reach = dist - player.radius;
    switch (m.kind) {
      case 'melee': {
        if (!this.hitDone && k >= 0.35) {
          this.hitDone = true;
          const ang = Math.abs(wrapAngle(Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z) - this.yaw));
          if (reach <= m.range + 0.5 && ang <= (m.arc * Math.PI) / 180) B.kaijuHitsPlayer(this, m);
        }
        this.vel.multiplyScalar(Math.exp(-6 * dt));
        break;
      }
      case 'charge': {
        const fwd = this.chargeDir;
        const yawDir = _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        fwd.lerp(yawDir, 0.04).normalize();
        this.vel.copy(fwd).multiplyScalar(m.speed * (this.enraged ? 1.1 : 1));
        if (Math.random() < 0.6) {
          _u.set(this.pos.x + (Math.random() - 0.5) * 4, 0.5, this.pos.z + (Math.random() - 0.5) * 4);
          B.fx.splash(_u, 1.4);
        }
        if (!this.hitDone && dist <= this.radius + player.radius + 1.2) {
          this.hitDone = true;
          B.kaijuHitsPlayer(this, m);
          this.vel.multiplyScalar(0.2);
          this.moveTime = Math.max(this.moveTime, m.active * 0.85);
        }
        if (Math.hypot(this.pos.x, this.pos.z) > B.arenaRadius - 2) this.moveTime = m.active;
        break;
      }
      case 'aoe': {
        if (!m.drain) {
          // colpo di coda: rotazione completa
          this.yaw = this.spinFrom + easeOut(k) * Math.PI * 2;
          if (!this.hitDone && k >= 0.45) {
            this.hitDone = true;
            if (reach <= m.range) B.kaijuHitsPlayer(this, m);
            B.fx.splash(this.pos, 2.5);
          }
        }
        break;
      }
      case 'leap': {
        const from = this.leapFrom;
        const to = this.leapTo;
        this.pos.x = lerp(from.x, to.x, smooth(k));
        this.pos.z = lerp(from.z, to.z, smooth(k));
        this.leapHeight = Math.sin(k * Math.PI) * 14 * Math.min(1.2, from.distanceTo(to) / 20 + 0.4);
        this.vel.set(0, 0, 0);
        if (k >= 1 && !this.hitDone) {
          this.hitDone = true;
          this.leapHeight = 0;
          if (this.marker) {
            B.fx.removeMarker(this.marker);
            this.marker = null;
          }
          audio.explosion(1.2);
          audio.impact(true, false);
          B.fx.shockwave(this.pos, '#cfe8ff', m.aoe, 0.6);
          B.fx.splash(this.pos, 3.5);
          B.shake(1);
          const d = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
          if (d <= m.aoe + player.radius) B.kaijuHitsPlayer(this, m);
          // spingi via il robot se ci si atterra sopra
          if (d < this.radius + player.radius) {
            _u.set(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z).normalize();
            player.knock.addScaledVector(_u, 12);
          }
        }
        break;
      }
      case 'roar': {
        if (Math.random() < 0.3) B.shake(0.15);
        break;
      }
    }
    if (this.moveTime >= m.active) {
      this.state = 'recovery';
      this.stateTime = m.recovery * (this.enraged ? 0.8 : 1);
      if (m.kind === 'charge') this.vel.multiplyScalar(0.3);
      B.releaseToken(this);
    }
  }

  _endMove(B) {
    const m = this.move;
    if (m) this.cooldowns[m.id] = m.cooldown * (this.enraged ? 0.75 : 1) * (0.85 + Math.random() * 0.3);
    this.move = null;
    this.state = 'idle';
    this.aiTimer = (1 - this.aggression) * 1.6 + Math.random() * 0.4;
    // a volte si allontana per usare un attacco a distanza
    const ranged = this.moves.some((mv) => mv.minRange && !(this.cooldowns[mv.id] > 0.8));
    if (ranged && m?.kind !== 'charge' && m?.kind !== 'leap' && Math.random() < 0.3) this.retreat = 1.2 + Math.random() * 0.8;
    B.releaseToken(this);
  }

  // ---------- animazione ----------
  _animate(dt, player) {
    const T = this.target;
    const rig = this.rig;
    const t = this.time;
    for (const k of KEYS) T[k] = 0;
    const quad = rig.form === 'quad';
    // posa base
    if (quad) {
      T.armRx = -1.0;
      T.armRz = -0.35;
      T.elR = -1.3;
      T.armLx = -1.0;
      T.armLz = 0.35;
      T.elL = -1.3;
      T.pinch = 0.15 + Math.sin(t * 1.3) * 0.12;
    } else {
      T.armRx = -0.55;
      T.armRz = -0.3;
      T.elR = -0.9;
      T.armLx = -0.55;
      T.armLz = 0.3;
      T.elL = -0.9;
    }
    T.spineX = Math.sin(t * 1.4) * 0.04;
    T.hipsY = Math.sin(t * 1.4) * 0.08;
    T.jaw = 0.12 + Math.sin(t * 0.8) * 0.06;
    if (player && this.alive) {
      const look = wrapAngle(Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z) - this.yaw);
      T.neckY = clamp(look, -0.7, 0.7);
    }

    // mosse
    const m = this.move;
    if (m && (this.state === 'windup' || this.state === 'active' || this.state === 'recovery')) {
      let P = MOVE_POSES[m.anim] || MOVE_POSES.swipe;
      if (this.armSide === 'L') P = { W: mirrorArms(P.W), S: mirrorArms(P.S) };
      const pose = {};
      if (this.state === 'windup') {
        const k = smooth(clamp(this.moveTime / this.windup, 0, 1));
        for (const key in P.W) pose[key] = lerp(T[key] ?? 0, P.W[key], k);
      } else if (this.state === 'active') {
        const k = easeOut(clamp(this.moveTime / Math.min(m.active, 0.35), 0, 1));
        const keys = new Set([...Object.keys(P.W), ...Object.keys(P.S)]);
        for (const key of keys) pose[key] = lerp(P.W[key] ?? T[key] ?? 0, P.S[key] ?? T[key] ?? 0, k);
        if (m.anim === 'bite' && this.moveTime > m.active * 0.5) pose.jaw = 0.0;
        if (m.anim === 'roar') pose.neckY = Math.sin(t * 40) * 0.06;
      } else {
        const k = smooth(clamp(1 - this.stateTime / (m.recovery || 0.5), 0, 1));
        for (const key in P.S) pose[key] = lerp(P.S[key], T[key] ?? 0, k);
      }
      Object.assign(T, pose);
    } else if (this.state === 'stagger') {
      Object.assign(T, { spineX: -0.45, neckX: -0.5, hipsY: -0.4, jaw: 0.7, armRz: -0.9, armLz: 0.9, armRx: -0.2, armLx: -0.2 });
    } else if (this.state === 'stun') {
      Object.assign(T, { spineX: 0.35, neckX: 0.55, hipsY: -0.6, jaw: 0.5, armRx: 0.1, armLx: 0.1 });
      T.neckY = Math.sin(t * 25) * 0.08;
    } else if (this.state === 'spawn') {
      const k = clamp(this.stateTime / 2.6, 0, 1);
      if (k > 0.6) Object.assign(T, { neckX: -0.7, jaw: 1.0, spineX: -0.4, armRz: -0.9, armLz: 0.9 });
    }
    if (this.flinch > 0) {
      T.spineX -= this.flinch * 0.12;
      T.neckX -= this.flinch * 0.2;
    }

    // camminata
    const fwdSpeed = this.vel.x * Math.sin(this.yaw) + this.vel.z * Math.cos(this.yaw);
    const sideSpeed = this.vel.x * Math.cos(this.yaw) - this.vel.z * Math.sin(this.yaw);
    const speed = Math.hypot(fwdSpeed, sideSpeed);
    const moving = speed > 0.5 && this.alive && this.state !== 'stagger';
    if (moving) this.phase += dt * (2.0 + speed * 0.32);
    const amp = moving ? clamp(speed / 8, 0, 1.2) : 0;
    const dirSign = fwdSpeed >= -0.2 ? 1 : -1;

    // applicazione
    const hipsY = (rig.hipY || 0) + this.pose.hipsY;
    rig.hips.position.y = hipsY + (moving ? Math.abs(Math.cos(this.phase)) * 0.15 * amp : 0);
    for (const k of KEYS) this.pose[k] = damp(this.pose[k], T[k], this.state === 'active' ? 18 : 9, dt);
    const p = this.pose;
    rig.hips.rotation.x = p.hipsX;
    rig.spine.rotation.set((rig.spineRest || 0) + p.spineX, p.spineY, 0);
    rig.neck.rotation.set((rig.neckRest || 0) + p.neckX, p.neckY * 0.6, 0);
    if (rig.headPivot) rig.headPivot.rotation.y = p.neckY * 0.4;
    if (rig.jaw) rig.jaw.rotation.x = p.jaw;
    const [armR, armL] = rig.arms;
    if (armR) {
      armR.sh.rotation.set(p.armRx, p.armRy, p.armRz);
      armR.el.rotation.x = p.elR;
      if (armR.pinch) armR.pinch.rotation.x = -p.pinch - (this.state === 'windup' ? 0.5 : 0);
    }
    if (armL) {
      armL.sh.rotation.set(p.armLx, p.armLy, p.armLz);
      armL.el.rotation.x = p.elL;
      if (armL.pinch) armL.pinch.rotation.x = -p.pinch - (this.state === 'windup' ? 0.5 : 0);
    }
    const c = Math.cos(this.phase);
    rig.legs.forEach((leg, i) => {
      let ph = this.phase;
      if (quad) ph += (i === 0 || i === 3 ? 0 : Math.PI);
      else ph += i === 0 ? 0 : Math.PI;
      const s = Math.sin(ph);
      const lift = Math.max(0, Math.cos(ph));
      const crouch = Math.max(0, -p.hipsY);
      leg.hip.rotation.x = leg.rest.hip - s * 0.45 * amp * dirSign - crouch * 0.3;
      leg.hip.rotation.z = Math.sin(ph) * 0.12 * amp * Math.sign(sideSpeed || 0);
      leg.knee.rotation.x = leg.rest.knee + lift * 0.7 * amp + crouch * 0.6;
      leg.ankle.rotation.x = leg.rest.ankle - lift * 0.3 * amp - crouch * 0.3;
    });
    if (moving && Math.sign(c) !== Math.sign(this.lastCos)) {
      this.stepEvent = true;
    }
    this.lastCos = c;
    const n = rig.tail.length;
    rig.tail.forEach((seg, i) => {
      const f = (i + 1) / n;
      seg.rotation.y = Math.sin(t * 1.6 - i * 0.55) * 0.12 * (0.4 + f) + p.tailY * 0.3;
      seg.rotation.x = -0.04 + p.tailX * 0.06 + Math.sin(t * 1.1 - i * 0.4) * 0.03;
    });

    // posizione/rotazione nel mondo
    let y = -WATER_DEPTH;
    if (this.state === 'spawn') {
      const k = clamp(this.stateTime / 2.4, 0, 1);
      y = lerp(-this.spawnDepth, -WATER_DEPTH, easeOut(k));
    }
    if (this.move?.kind === 'leap' && this.state === 'active') y += this.leapHeight || 0;
    const root = this.model.root;
    root.position.set(this.pos.x, y, this.pos.z);
    root.rotation.set(0, this.yaw, 0);
    if (this.state === 'dead') {
      const k = clamp(this.deathTime / 1.6, 0, 1);
      root.rotation.z = this.deathDir * easeOut(k) * 1.45;
      root.position.y = y - easeOut(k) * 2.2 - Math.max(0, this.deathTime - 3) * 1.5;
    }
  }

  _visuals(dt, B) {
    const M = this.model.materials;
    const t = this.time;
    let tele = 0;
    if (this.state === 'windup') tele = clamp(this.moveTime / this.windup, 0, 1) * (this.move.drain ? 3.5 : 1.4);
    let base = 0.85 + Math.sin(t * 2.2) * 0.25 + tele + (this.enraged ? 0.6 + Math.sin(t * 9) * 0.3 : 0) + this.hitFlash * 2.5;
    if (this.state === 'stun') base = 0.3 + Math.random() * 1.5;
    if (!this.alive) base = Math.max(0, 0.9 - this.deathTime * 0.4);
    // vene luminose che pulsano (piu' forti quando carica un attacco o e' infuriato)
    M.body.emissiveIntensity = base;
    M.glow.emissiveIntensity = this.alive ? 2.2 + tele * 2 + (this.enraged ? 1.2 : 0) : Math.max(0, 2.2 - this.deathTime);
    M.mouth.emissiveIntensity = 0.8 + (this.move?.kind === 'projectile' && this.state === 'windup' ? tele * 3 : 0);
    const u = M.body.userData.toon;
    if (u) u.uFlash.value = this.hitFlash * 0.28;
    if (this.stepEvent) {
      this.stepEvent = false;
      if (B && this.state !== 'spawn' && this.alive) {
        audio.step(0.8 * this.def.size);
        _v.set(this.pos.x + (Math.random() - 0.5) * 3, 0.4, this.pos.z + (Math.random() - 0.5) * 3);
        B.fx.splash(_v, 1.1 * this.def.size);
        B.shake(0.06 * this.def.size);
      }
    }
  }

  mouthPosition(out = new THREE.Vector3()) {
    const h = this.rig.head;
    h.getWorldPosition(out);
    out.x += Math.sin(this.yaw) * 2 * this.def.size;
    out.z += Math.cos(this.yaw) * 2 * this.def.size;
    return out;
  }

  centerPosition(out = new THREE.Vector3()) {
    this.rig.hips.getWorldPosition(out);
    out.y += (this.rig.form === 'quad' ? 0.5 : 2.5) * this.def.size;
    return out;
  }

  dispose() {
    this.parent.remove(this.model.root);
    this.model.dispose();
  }
}
