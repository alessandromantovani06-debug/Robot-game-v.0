// Kaiju in 2D: intelligenza artificiale, mosse d'attacco e animazione procedurale.
import { buildKaijuArt } from '../art/kaijuArt.js';
import { solveKaiju, drawKaiju, M } from '../art/rig.js';
import { KAIJU, MOVES } from '../data/kaiju.js';
import { audio } from '../core/audio.js';
import { damp, clamp, lerp, smooth, easeOut } from './anim.js';

const KEYS = ['crouch', 'lean', 'neck', 'jaw', 'armF', 'elbF', 'armB', 'elbB', 'hipF', 'kneeF', 'hipB', 'kneeB', 'pinch', 'lift', 'tailUp', 'tailWhip'];

// Pose chiave: W = carica, S = colpo
const MOVE_POSES = {
  swipe: {
    W: { armF: 2.7, elbF: 0.9, lean: -0.18, neck: -0.12, jaw: 0.3 },
    S: { armF: 0.45, elbF: 0.15, lean: 0.32, jaw: 0.5 },
  },
  pincer: {
    W: { armF: 2.3, elbF: 2.0, pinch: 0.9, lean: -0.08 },
    S: { armF: 1.25, elbF: 0.25, pinch: 0, lean: 0.12 },
  },
  bite: {
    W: { neck: -0.5, jaw: 0.65, lean: -0.22 },
    S: { neck: 0.35, jaw: 0.05, lean: 0.38 },
  },
  charge: {
    W: { crouch: 0.6, lean: 0.38, neck: 0.4, jaw: 0.35, armF: -0.4, armB: -0.4 },
    S: { crouch: 0.3, lean: 0.45, neck: 0.45, jaw: 0.65, armF: -0.5, armB: -0.5 },
  },
  tail: {
    W: { lean: 0.28, tailUp: 0.9, neck: 0.25, crouch: 0.3 },
    S: { lean: -0.05, tailUp: -0.4, tailWhip: 1 },
  },
  spit: {
    W: { neck: -0.75, jaw: 0.85, lean: -0.32 },
    S: { neck: 0.25, jaw: 1.05, lean: 0.28 },
  },
  emp: {
    W: { lean: -0.55, armF: 2.6, armB: 2.5, jaw: 0.95, neck: -0.5 },
    S: { lean: 0.5, armF: 0.3, armB: 0.3, jaw: 0.6, neck: 0.3, crouch: 0.6 },
  },
  slam: {
    W: { crouch: 1.0, lean: 0.4, armF: -0.6, armB: -0.6, tailUp: 0.5 },
    S: { crouch: -0.2, lean: -0.2, armF: 2.2, armB: 2.2, jaw: 0.8, tailUp: -0.5 },
  },
  roar: {
    W: { neck: -0.2, jaw: 0.3, lean: -0.1 },
    S: { neck: -0.8, jaw: 1.05, lean: -0.45, armF: 1.4, armB: 1.3, elbF: 1.2, elbB: 1.2, pinch: 0.9 },
  },
};

let uid = 0;

export class Kaiju {
  constructor(type, level, { S = 64 } = {}) {
    const def = KAIJU[type];
    this.id = ++uid;
    this.def = def;
    this.type = type;
    this.level = level;
    this.name = def.name;
    this.art = buildKaijuArt(def, S);
    this.quad = def.body.form === 'quad';
    this.maxHp = this.hp = Math.round(def.hp * (1 + 0.3 * (level - 1)));
    this.dmgMul = def.dmg * (1 + 0.15 * (level - 1));
    this.speed = def.speed * (1 + 0.04 * (level - 1));
    this.radius = def.radius;
    this.front = def.front ?? def.radius;
    this.size = def.size;
    this.height = (this.quad ? 7.2 : 9.2) * def.size;
    this.moves = def.moves.map((m) => ({ id: m, ...MOVES[m] }));
    this.cooldowns = {};
    this.moves.forEach((m) => (this.cooldowns[m.id] = m.kind === 'roar' ? 6 : 1 + Math.random() * 2));
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.facing = -1;
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
    this.pace = 0;
    this.retreat = 0;
    this.time = Math.random() * 10;
    this.phase = 0;
    this.hitFlash = 0;
    this.flinch = 0;
    this.deathTime = 0;
    this.spawnDepth = 14 * def.size;
    this.pose = {};
    this.T = {};
    KEYS.forEach((k) => (this.pose[k] = 0));
    this.marker = null;
    this.lastCos = 1;
    this.aggression = 0.55 + def.category * 0.1 + (level - 1) * 0.05;
    this.tailAngles = this.art.sprites.tail.map(() => 0);
    this.J = solveKaiju(this.art, { tail: this.tailAngles });
  }

  /** Ingombro del corpo verso il punto x: testa e braccia sporgono in avanti, dietro c'e' solo la coda. */
  extent(x) {
    return Math.sign(x - this.x) === this.facing ? this.front : this.radius;
  }

  get isAttacking() {
    return this.state === 'windup' || this.state === 'active';
  }

  // ---------- reazioni ----------
  takeHit(dmg, poiseDmg, dir, B) {
    if (!this.alive || this.state === 'spawn') return false;
    this.hp -= dmg;
    this.hitFlash = Math.max(this.hitFlash, clamp(dmg / 70, 0.3, 1));
    this.flinch = 1;
    this.x += dir * Math.min(1.0, poiseDmg * 0.02);
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
    audio.growl(1.3 / this.size);
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
    this.turned = false;
    B?.releaseToken(this);
  }

  die(B) {
    this._cancelMove(B);
    this.alive = false;
    this.state = 'dead';
    this.deathTime = 0;
    B?.onKaijuDeath(this);
  }

  // ---------- intelligenza artificiale ----------
  update(dt, B) {
    this.time += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 9);
    this.flinch = Math.max(0, this.flinch - dt * 4);
    this.poise = Math.max(0, this.poise - dt * 12);
    this.roarBuff = Math.max(0, this.roarBuff - dt);
    for (const k in this.cooldowns) this.cooldowns[k] -= dt;
    const player = B.player;
    const dx = player.x - this.x;
    const dist = Math.abs(dx);
    const speedMul = (this.enraged ? 1.18 : 1) * (this.roarBuff > 0 ? 1.12 : 1);
    let want = 0;

    switch (this.state) {
      case 'spawn':
        this.stateTime += dt;
        if (this.stateTime >= 2.6) {
          this.state = 'idle';
          this.aiTimer = 0.8;
        }
        break;
      case 'idle': {
        this.aiTimer -= dt;
        if (player.alive && B.fighting) {
          const prefer = this._preferredRange(player);
          this.pace -= dt;
          if (this.retreat > 0) {
            // arretra fronteggiando il Titano
            this.retreat -= dt;
            want = -0.85;
            if (dist > 14) {
              this.retreat = 0;
              this.aiTimer = 0;
            }
          } else if (dist > prefer + 1.5) want = dist > 22 ? 1.4 : 1;
          else if (dist < prefer - 2) want = -0.5;
          else if (this.pace < 0) {
            want = Math.sin(this.time * 1.3) * 0.35;
            if (this.pace < -1.5) this.pace = 0.8 + Math.random();
          }
          if (this.aiTimer <= 0) {
            this.aiTimer = 0.2 + Math.random() * 0.35;
            this._decide(dist, player, B);
          }
        }
        break;
      }
      case 'windup':
        this._updateWindup(dt, dist, player, B);
        break;
      case 'active':
        this._updateActive(dt, dist, player, B);
        break;
      case 'recovery':
        this.stateTime -= dt;
        if (this.stateTime <= 0) this._endMove(B);
        break;
      case 'stagger':
      case 'stun':
        this.stateTime -= dt;
        if (this.state === 'stun' && Math.random() < 0.5) {
          const [cx, cy] = this.point('center');
          B.fx.electric(cx, cy, '#7fe0ff', 4 * this.size, 1);
        }
        if (this.stateTime <= 0) {
          this.state = 'idle';
          this.aiTimer = 0.4;
        }
        break;
      case 'dead':
        this.deathTime += dt;
        break;
    }

    // si gira verso il Titano (non durante gli attacchi gia' lanciati)
    if (this.alive && !this.turned && (this.state === 'idle' || this.state === 'spawn' || this.state === 'recovery' || this.state === 'windup')) {
      if (dist > 1.5) this.facing = Math.sign(dx) || this.facing;
    }

    if (this.state === 'idle' || this.state === 'recovery' || this.state === 'windup') {
      const k = this.state === 'idle' ? 1 : 0.1;
      this.vx = damp(this.vx, this.facing * want * this.speed * speedMul * k, 3, dt);
    } else if (this.state !== 'active') this.vx = damp(this.vx, 0, 5, dt);
    if (this.state !== 'spawn') this.x += this.vx * dt;

    this._animate(dt);
    this._step(B);
  }

  _preferredRange(player) {
    const melee = this.moves.filter((m) => m.kind === 'melee');
    if (!melee.length) return 9;
    return Math.min(...melee.map((m) => m.range)) * this.size * 0.72 + player.radius;
  }

  _decide(dist, player, B) {
    const edge = dist - player.radius;
    const options = [];
    for (const m of this.moves) {
      if (this.cooldowns[m.id] > 0) continue;
      let ok = false;
      const r = m.range * (m.kind === 'melee' || m.kind === 'aoe' ? this.size : 1);
      if (m.kind === 'melee') ok = edge <= r * 0.9;
      else if (m.kind === 'aoe') ok = edge <= r * 0.85;
      else if (m.kind === 'roar') ok = this.forceRoar || (dist > 12 && Math.random() < 0.15);
      else ok = dist >= m.minRange && dist <= m.range;
      if (ok) options.push(m);
    }
    if (this.forceRoar) {
      const r = options.find((m) => m.kind === 'roar');
      if (r) return this._startMove(r, B);
    }
    if (!options.length || Math.random() > this.aggression || !B.requestToken(this)) return;
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
    this.moveTime = 0;
    this.windup = m.windup * (this.enraged ? 0.82 : 1);
    this.hitDone = false;
    this.leapTo = null;
    this.turned = false;
    const pitch = 1.15 / this.size;
    if (m.kind === 'aoe' && m.drain) {
      audio.empCharge(this.windup);
      B.message('IMPULSO EMP IN CARICA!', 'danger', this.windup);
      this.marker = B.fx.marker(this.x, m.range * this.size, this.def.glow);
    } else if (m.kind !== 'roar') audio.growl(m.kind === 'projectile' ? pitch * 1.2 : pitch);
  }

  _updateWindup(dt, dist, player, B) {
    const m = this.move;
    this.moveTime += dt;
    if (this.marker && m.drain) this.marker.x = this.x;
    if (m.drain && Math.random() < 0.6) {
      const [cx, cy] = this.point('center');
      B.fx.electric(cx, cy + 1, this.def.glow, 5 * this.size, 1);
    }
    if (m.kind === 'leap' && this.moveTime > this.windup * 0.5 && !this.marker) {
      this.leapTo = player.x + player.vx * 0.4;
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
    switch (m.kind) {
      case 'melee':
        audio.whoosh(true);
        this.vx = this.facing * 6;
        break;
      case 'charge':
        audio.roar(1.2 / this.size, 1, 0.8);
        break;
      case 'aoe':
        if (m.drain) {
          if (this.marker) {
            B.fx.removeMarker(this.marker);
            this.marker = null;
          }
          audio.zap();
          B.fx.shockwave(this.x, this.def.glow, m.range * this.size, 0.7);
          B.shake(0.7);
          B.flashScreen(this.def.glow, 0.35);
          if (dist - player.radius <= m.range * this.size) B.kaijuHitsPlayer(this, m, { drain: true });
          this.hitDone = true;
        } else {
          // colpo di coda: si gira di spalle e frusta
          audio.whoosh(true);
          this.facing = -this.facing;
          this.turned = true;
        }
        break;
      case 'projectile':
        audio.spit();
        B.spawnAcid(this);
        break;
      case 'leap':
        audio.whoosh(true);
        this.leapFrom = this.x;
        if (this.leapTo === null) this.leapTo = player.x;
        if (!this.marker) this.marker = B.fx.marker(this.leapTo, m.aoe, '#ff3030');
        break;
      case 'roar':
        audio.roar(0.95 / this.size, 1.6, 1.1);
        this.roarBuff = 7;
        B.shake(0.5);
        break;
    }
  }

  _updateActive(dt, dist, player, B) {
    const m = this.move;
    this.moveTime += dt;
    const k = clamp(this.moveTime / m.active, 0, 1);
    const front = Math.sign(player.x - this.x) === this.facing;
    switch (m.kind) {
      case 'melee': {
        if (!this.hitDone && k >= 0.35) {
          this.hitDone = true;
          if (front && dist - player.radius <= m.range * this.size + 0.5) B.kaijuHitsPlayer(this, m);
        }
        this.vx *= Math.exp(-6 * dt);
        break;
      }
      case 'charge': {
        this.vx = this.facing * m.speed * (this.enraged ? 1.1 : 1);
        if (Math.random() < 0.6) B.fx.splash(this.x + (Math.random() - 0.5) * 3, 1.3);
        if (!this.hitDone && dist <= this.front + player.radius + 1 && front) {
          if (player.invuln > 0) {
            if (!this.dodged) B.message('SCHIVATO!', 'good', 0.6);
            this.dodged = true;
          } else {
            this.hitDone = true;
            B.kaijuHitsPlayer(this, m);
            this.vx *= 0.2;
            this.moveTime = Math.max(this.moveTime, m.active * 0.85);
          }
        }
        if (Math.abs(this.x) > B.arenaHalf - 2 && Math.sign(this.x) === this.facing) this.moveTime = m.active;
        break;
      }
      case 'aoe': {
        if (!m.drain && !this.hitDone && k >= 0.4) {
          this.hitDone = true;
          if (dist - player.radius <= m.range * this.size) B.kaijuHitsPlayer(this, m);
          B.fx.splash(this.x - this.facing * 4 * this.size, 2.2);
        }
        break;
      }
      case 'leap': {
        this.x = lerp(this.leapFrom, this.leapTo, smooth(k));
        this.y = Math.sin(k * Math.PI) * 12 * Math.min(1.2, Math.abs(this.leapTo - this.leapFrom) / 20 + 0.4);
        this.vx = 0;
        if (k >= 1 && !this.hitDone) {
          this.hitDone = true;
          this.y = 0;
          if (this.marker) {
            B.fx.removeMarker(this.marker);
            this.marker = null;
          }
          audio.explosion(1.2);
          audio.impact(true, false);
          B.fx.shockwave(this.x, '#cfe8ff', m.aoe, 0.6);
          B.shake(1);
          const d = Math.abs(player.x - this.x);
          if (d <= m.aoe + player.radius) B.kaijuHitsPlayer(this, m);
          if (d < this.extent(player.x) + player.radius) player.knock += (Math.sign(player.x - this.x) || 1) * 14;
        }
        break;
      }
      case 'roar':
        if (Math.random() < 0.3) B.shake(0.15);
        break;
    }
    if (this.moveTime >= m.active) {
      this.state = 'recovery';
      this.stateTime = m.recovery * (this.enraged ? 0.8 : 1);
      if (m.kind === 'charge') this.vx *= 0.3;
      this.dodged = false;
      B.releaseToken(this);
    }
  }

  _endMove(B) {
    const m = this.move;
    if (m) this.cooldowns[m.id] = m.cooldown * (this.enraged ? 0.75 : 1) * (0.85 + Math.random() * 0.3);
    this.move = null;
    this.state = 'idle';
    this.turned = false;
    this.aiTimer = (1 - this.aggression) * 1.6 + Math.random() * 0.4;
    // a volte arretra per preparare un attacco a distanza (carica, balzo, sputo)
    const ranged = this.moves.some((mv) => mv.minRange && this.cooldowns[mv.id] <= 0.8);
    if (ranged && m?.kind !== 'charge' && m?.kind !== 'leap' && Math.random() < 0.38) this.retreat = 1.2 + Math.random() * 0.8;
    B.releaseToken(this);
  }

  // ---------- animazione ----------
  _animate(dt) {
    const T = this.T;
    const t = this.time;
    for (const k of KEYS) T[k] = 0;
    if (this.def.body.arms === 'pincers') {
      T.armF = 1.05;
      T.elbF = 1.6;
      T.armB = 0.85;
      T.elbB = 1.5;
      T.pinch = 0.15 + Math.sin(t * 1.3) * 0.12;
    } else {
      T.armF = 0.4;
      T.elbF = 0.7;
      T.armB = 0.3;
      T.elbB = 0.6;
    }
    T.lean = Math.sin(t * 1.4) * 0.03;
    T.crouch = Math.sin(t * 1.4) * 0.05;
    T.jaw = 0.12 + Math.sin(t * 0.8) * 0.06;
    T.neck = Math.sin(t * 0.7) * 0.05;

    const m = this.move;
    if (m && (this.state === 'windup' || this.state === 'active' || this.state === 'recovery')) {
      const P = MOVE_POSES[m.anim] || MOVE_POSES.swipe;
      const pose = {};
      if (this.state === 'windup') {
        const k = smooth(clamp(this.moveTime / this.windup, 0, 1));
        for (const key in P.W) pose[key] = lerp(T[key] ?? 0, P.W[key], k);
      } else if (this.state === 'active') {
        const k = easeOut(clamp(this.moveTime / Math.min(m.active, 0.35), 0, 1));
        const keys = new Set([...Object.keys(P.W), ...Object.keys(P.S)]);
        for (const key of keys) pose[key] = lerp(P.W[key] ?? T[key] ?? 0, P.S[key] ?? T[key] ?? 0, k);
        if (m.anim === 'bite' && this.moveTime > m.active * 0.5) pose.jaw = 0;
        if (m.anim === 'roar') pose.neck = (pose.neck || 0) + Math.sin(t * 40) * 0.05;
      } else {
        const k = smooth(clamp(1 - this.stateTime / (m.recovery || 0.5), 0, 1));
        for (const key in P.S) pose[key] = lerp(P.S[key], T[key] ?? 0, k);
      }
      Object.assign(T, pose);
    } else if (this.state === 'stagger') {
      Object.assign(T, { lean: -0.45, neck: -0.5, crouch: 0.3, jaw: 0.7, armF: -0.5, armB: -0.6 });
    } else if (this.state === 'stun') {
      Object.assign(T, { lean: 0.35, neck: 0.55, crouch: 0.6, jaw: 0.5, armF: 0.1, armB: 0.1 });
      T.neck += Math.sin(t * 25) * 0.08;
    } else if (this.state === 'spawn' && this.stateTime > 1.6) {
      Object.assign(T, { neck: -0.75, jaw: 1.0, lean: -0.4, armF: 1.3, armB: 1.2, elbF: 1.2 });
    } else if (this.state === 'dead') {
      Object.assign(T, { lean: 0.9, neck: 0.6, jaw: 0.8, crouch: 1.2, armF: 0.2, armB: 0.2 });
    }
    if (this.flinch > 0) {
      T.lean -= this.flinch * 0.12;
      T.neck -= this.flinch * 0.2;
    }

    // camminata
    const speed = Math.abs(this.vx);
    const moving = speed > 0.5 && this.alive && this.state !== 'stagger' && this.state !== 'spawn';
    if (moving) this.phase += dt * (2.0 + speed * 0.32) * (this.vx * this.facing >= 0 ? 1 : -1);
    const amp = moving ? clamp(speed / 8, 0, 1.2) : 0;
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const legs = {};
    if (this.quad) {
      const leg = (ph) => [Math.sin(ph) * 0.35 * amp, Math.max(0, Math.cos(ph)) * 0.6 * amp];
      legs.fF = leg(this.phase);
      legs.bB = leg(this.phase);
      legs.fB = leg(this.phase + Math.PI);
      legs.bF = leg(this.phase + Math.PI);
    } else {
      T.hipF = s * 0.4 * amp;
      T.hipB = -s * 0.4 * amp;
      T.kneeF = Math.max(0, c) * 0.6 * amp;
      T.kneeB = Math.max(0, -c) * 0.6 * amp;
    }
    if (moving && Math.sign(c) !== Math.sign(this.lastCos)) this.stepEvent = true;
    this.lastCos = c;

    for (const k of KEYS) this.pose[k] = damp(this.pose[k], T[k], this.state === 'active' ? 18 : 9, dt);
    const p = this.pose;
    const n = this.tailAngles.length;
    for (let i = 0; i < n; i++) {
      const f = (i + 1) / n;
      let a = Math.sin(t * 1.6 - i * 0.55) * 0.07 * (0.5 + f) - 0.02 + p.tailUp * 0.14;
      if (p.tailWhip > 0.01) a += Math.sin(this.moveTime * 14 - i * 0.6) * 0.18 * p.tailWhip;
      this.tailAngles[i] = a;
    }
    let lift = 0;
    if (this.state === 'spawn') lift = -lerp(this.spawnDepth, 0, easeOut(clamp(this.stateTime / 2.4, 0, 1)));
    this.J = solveKaiju(this.art, { ...p, legs, tail: this.tailAngles, lift });
  }

  _step(B) {
    if (this.stepEvent) {
      this.stepEvent = false;
      if (this.state !== 'spawn' && this.alive) {
        audio.step(0.8 * this.size);
        B.fx.splash(this.x + (Math.random() - 0.5) * 2, 1.1 * this.size);
        B.shake(0.06 * this.size);
      }
    }
  }

  point(name) {
    const J = this.J;
    const lay = this.art.layout;
    let p;
    if (name === 'mouth') p = M.p(J.head, lay.mouth[0], lay.mouth[1]);
    else if (name === 'head') p = M.p(J.head, lay.head[0] * 0.5, -0.3);
    else if (name === 'hand' && J.armF) p = M.p(J.armF.fore, 0, this.art.L.fore + 0.6);
    else p = M.p(J.body, this.quad ? 0.3 : 0.6, this.quad ? -0.5 : -1.9);
    const s = this.size;
    return [this.x + p[0] * this.facing * s, this.y - p[1] * s];
  }

  drawAt(ctx, base, fx) {
    drawKaiju(ctx, this.art, this.J, base, fx);
  }

  draw(ctx, cam, W, H, o = {}) {
    const s = this.size;
    let aura = 0;
    if (this.state === 'windup') aura = clamp(this.moveTime / this.windup, 0, 1) * (this.move.drain ? 1.6 : 0.8);
    if (this.enraged) aura += 0.25 + Math.sin(this.time * 9) * 0.1;
    if (this.state === 'stun') aura = Math.random() * 0.8;
    let alpha = 1;
    let sink = 0;
    let roll = 0;
    if (this.state === 'dead') {
      sink = Math.max(0, this.deathTime - 1.2) * 1.6;
      roll = easeOut(clamp(this.deathTime / 1.6, 0, 1)) * 0.5;
      alpha = clamp(1.6 - this.deathTime * 0.25, 0, 1);
    }
    if (o.reflection) {
      const k = cam.ppu(H);
      const [px, py] = cam.toScreen(this.x, 0, W, H);
      drawKaiju(ctx, this.art, this.J, [k * s * this.facing, 0, 0, -k * s * 0.75, px, py + k * 0.2], { alpha: 0.22 * alpha });
      return;
    }
    let base = cam.base(this.x, this.y - sink, W, H, this.facing * s, s);
    if (roll) base = M.r(base, roll);
    drawKaiju(ctx, this.art, this.J, base, { flash: this.hitFlash, aura, alpha });
  }
}
