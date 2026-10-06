import * as THREE from 'three';
import { Environment } from '../render/environment.js';
import { Effects } from '../render/effects.js';
import { glowTexture } from '../render/textures.js';
import { nightEnvMap } from '../render/envmap.js';
import { ENVIRONMENTS } from '../data/environments.js';
import { CATEGORY_LABEL } from '../data/kaiju.js';
import { survivalWave } from '../data/missions.js';
import { audio } from '../core/audio.js';
import { input } from '../core/input.js';
import { RobotFighter } from './robotFighter.js';
import { KaijuFighter } from './kaijuFighter.js';
import { CameraRig } from './camera.js';
import { wrapAngle, clamp } from './anim.js';
import { Hud } from '../ui/hud.js';

const _v = new THREE.Vector3();
const _u = new THREE.Vector3();
const _w = new THREE.Vector3();

const NUMBERS_IT = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque'];

export class Battle {
  constructor(app, { mission, robot, mode = 'campaign', onEnd }) {
    this.app = app;
    this.mission = mission;
    this.mode = mode;
    this.onEnd = onEnd;
    const q = app.quality;
    this.quality = q;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, app.aspect, 0.3, 2500);
    const preset = ENVIRONMENTS[mission.env] || ENVIRONMENTS.tokyo;
    this.env = new Environment(this.scene, preset, q);
    this.scene.environment = nightEnvMap(app.renderer, preset);
    this.scene.environmentIntensity = 0.6;
    this.env.onThunder = (d) => audio.thunder(0.4 + d * 2);
    this.fx = new Effects(this.scene, q);
    this.fx.setViewport(app.height * app.renderer.getPixelRatio());

    this.player = new RobotFighter(robot, this.scene, { shadows: q.shadows });
    this.player.pos.set(0, 0, -16);
    this.player.yaw = 0;
    this.player.stepCallback = (foot, amp) => this._footstep(foot, amp);

    this.arenaRadius = 58;
    this.enemies = [];
    this.projectiles = [];
    this.wave = 1;
    this._spawnWave(mission.enemies);

    this.camRig = new CameraRig(this.camera);
    this.state = 'intro';
    this.stateTime = 0;
    this.hitstop = 0;
    this.slowmo = 0;
    this.slowFactor = 1;
    this.token = null;
    this.tokenGap = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.lockIndex = 0;
    this._target = null;
    this.paused = false;
    this.ended = false;
    this.stats = { dmgDealt: 0, dmgTaken: 0, maxCombo: 0, perfect: 0, time: 0, kills: 0, waves: 0 };
    this.lowHpTimer = 0;
    this.beam = null;
    this.missileQueue = 0;

    this.hud = new Hud(app.ui, this);
    const k = this.enemies[0];
    this.camRig.setMode('intro', { kaiju: k, angle: Math.PI * 0.85 });
    this.camRig.pos.set(k.pos.x + 20, 3, k.pos.z - 30);
    this.camRig.look.set(k.pos.x, 2, k.pos.z);
    this.camRig.snap();

    const boss = mission.boss || this.enemies.some((e) => e.def.category >= 5);
    audio.playMusic(boss ? 'boss' : 'battle');
    audio.startAmbience({ rain: (ENVIRONMENTS[mission.env] || {}).rain ?? 0.8, snow: (ENVIRONMENTS[mission.env] || {}).snow });
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

  get cameraYaw() {
    return this.camRig.yaw;
  }

  get aliveEnemies() {
    return this.enemies.filter((e) => e.alive);
  }

  get target() {
    if (this._target && this._target.alive) return this._target;
    const alive = this.aliveEnemies;
    if (!alive.length) return null;
    let best = alive[0];
    let bd = Infinity;
    for (const e of alive) {
      const d = e.pos.distanceToSquared(this.player.pos);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    this._target = best;
    return best;
  }

  cycleTarget() {
    const alive = this.aliveEnemies;
    if (alive.length < 2) return;
    const i = alive.indexOf(this.target);
    this._target = alive[(i + 1) % alive.length];
    audio.ui('click');
  }

  _spawnWave(list) {
    const q = this.quality;
    list.forEach((e, i) => {
      const k = new KaijuFighter(e.type, e.level, this.scene, { shadows: q.shadows });
      const side = i === 0 ? 0 : i % 2 ? -1 : 1;
      const base = this.player.pos;
      k.pos.set(base.x + side * 16, 0, base.z + 36 + (i > 0 ? 6 : 0));
      if (Math.hypot(k.pos.x, k.pos.z) > this.arenaRadius - 6) {
        k.pos.setLength(this.arenaRadius - 10);
      }
      k.yaw = Math.atan2(base.x - k.pos.x, base.z - k.pos.z);
      k.stateTime = -i * 0.8;
      this.enemies.push(k);
    });
  }

  // ---------- servizi per i combattenti ----------
  message(text, type = 'info', dur = 1.2) {
    this.hud.message(text, type, dur);
  }

  shake(a) {
    this.camRig.shake(a);
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

  _footstep(foot, amp) {
    const p = this.player;
    const j = foot === 'L' ? p.model.joints.ankleL : p.model.joints.ankleR;
    j.getWorldPosition(_v);
    _v.y = 0.3;
    this.fx.splash(_v, 0.7 + amp * 0.4);
    audio.step(0.5 + amp * 0.5);
    this.shake(0.035 * amp);
  }

  // ---------- attacchi del Titano ----------
  onPlayerStrike(player, arm, w, hitIndex) {
    if (w.type === 'ranged') {
      const from = player.worldPoint(arm === 'L' ? 'muzzleL' : 'muzzleR', new THREE.Vector3());
      const tgt = this.target;
      const dir = new THREE.Vector3();
      if (tgt) {
        tgt.centerPosition(_v);
        dir.copy(_v).sub(from).normalize();
      } else player.forward(dir);
      this._projectile({
        owner: 'player',
        kind: 'plasma',
        pos: from,
        vel: dir.multiplyScalar(w.speed),
        dmg: w.dmg * player.powerMul,
        poise: w.poise,
        color: player.cfg.colors.accent,
        radius: 1.2,
        life: 1.4,
      });
      audio.plasma();
      this.fx.flash(from, player.cfg.colors.accent, 5);
      this.shake(0.08);
      return;
    }

    const handPos = player.worldPoint(arm === 'L' ? 'handL' : 'handR', new THREE.Vector3());
    let hitAny = false;
    const struck = new Set();
    const fwd = player.forward(_u).clone();
    for (const e of this.enemies) {
      if (!e.alive || e.state === 'spawn') continue;
      const dx = e.pos.x - player.pos.x;
      const dz = e.pos.z - player.pos.z;
      const dist = Math.hypot(dx, dz);
      const edge = dist - e.radius;
      const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - player.yaw));
      if (edge <= w.range && ang <= (w.arc * Math.PI) / 180) {
        hitAny = true;
        struck.add(e);
        const crit = Math.random() < 0.08;
        const dmg = w.dmg * player.powerMul * (0.92 + Math.random() * 0.16) * (crit ? 1.6 : 1);
        e.centerPosition(_v);
        // punto d'impatto: superficie del Kaiju verso il Titano
        _w.set(-dx / dist, 0, -dz / dist);
        const hitPos = _v.clone().addScaledVector(_w, e.radius * 0.8);
        hitPos.y = clamp(handPos.y, 2, e.height * 0.8);
        this._damageKaiju(e, dmg, w.poise, fwd, hitPos, crit);
        if (w.slash) this.fx.sparks(hitPos, player.cfg.colors.accent, 18, 22);
      }
    }
    if (w.shockwave) {
      const p = handPos.clone();
      p.y = 0.3;
      this.fx.shockwave(p, player.cfg.colors.accent, w.shockwave, 0.5);
      this.fx.splash(p, 2.5);
      audio.explosion(0.7);
      this.shake(0.35);
      for (const e of this.enemies) {
        if (!e.alive || e.state === 'spawn') continue;
        const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z) - e.radius;
        if (d <= w.shockwave && !struck.has(e)) {
          e.centerPosition(_v);
          this._damageKaiju(e, w.dmg * 0.4 * player.powerMul, w.poise * 0.5, fwd, _v.clone(), false);
        }
      }
    }
    if (hitAny) {
      const heavy = w.dmg >= 80;
      audio.impact(heavy, false);
      audio.impact(heavy, true);
      this.hitstop = heavy ? 0.1 : 0.05;
      this.shake(heavy ? 0.45 : 0.22);
      if (heavy) this.camRig.kick(4);
      audio.vibrate(heavy ? 45 : 20);
      this.combo++;
      this.comboTimer = 1.8;
      this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
      player.addSync((w.dmg * 0.11 + this.combo * 0.4) * (1 + (w.syncBonus || 0)));
    }
  }

  _damageKaiju(e, dmg, poise, dir, pos, crit = false) {
    dmg = Math.round(dmg);
    const before = e.hp;
    if (!e.takeHit(dmg, poise, dir, this)) return;
    this.stats.dmgDealt += Math.min(before, dmg);
    this.fx.blood(pos, e.def.glow, crit ? 40 : 22);
    this.fx.sparks(pos, '#ffcf7a', crit ? 30 : 16, 16);
    this.hud.damageNumber(pos, dmg, crit);
  }

  // ---------- attacchi dei Kaiju ----------
  kaijuHitsPlayer(k, move, opts = {}) {
    const p = this.player;
    const dmg = Math.round(move.dmg * k.dmgMul * (k.roarBuff > 0 ? 1.15 : 1) * (0.9 + Math.random() * 0.2));
    const res = p.takeHit(dmg, k.pos, move.knock || 3, this);
    p.worldPoint('chest', _v);
    switch (res.result) {
      case 'dodge':
        this.message('SCHIVATO!', 'good', 0.6);
        p.addSync(5);
        break;
      case 'perfect':
        this.stats.perfect++;
        k.stagger(1.4, this);
        audio.block(true);
        this.fx.flash(_v, '#ffffff', 16);
        this.fx.sparks(_v, p.cfg.colors.accent, 40, 26);
        this.slowmo = 0.35;
        this.hitstop = 0.08;
        this.shake(0.3);
        this.message('PARATA PERFETTA!', 'perfect', 1);
        audio.vibrate(30);
        break;
      case 'block':
        audio.block(false);
        this.fx.sparks(_v.addScaledVector(p.forward(_u), 2), '#ffd27a', 24, 18);
        this.shake(0.25);
        this.stats.dmgTaken += res.dmg;
        if (res.dmg > 0) this.hud.damageNumber(_v, res.dmg, false, true);
        audio.vibrate(25);
        break;
      case 'hit':
        audio.impact(true, true);
        this.fx.sparks(_v, '#ffb347', 34, 20);
        this.fx.smokePuff(_v, 4, '#25272c', 2.5);
        this.shake(clamp(dmg / 90, 0.3, 0.9));
        this.hitstop = 0.06;
        this.stats.dmgTaken += res.dmg;
        this.hud.flash('#ff2020', 0.25);
        this.hud.damageNumber(_v, res.dmg, false, true);
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
    const from = k.mouthPosition(new THREE.Vector3());
    const p = this.player;
    const aim = _v.set(p.pos.x, 5, p.pos.z).addScaledVector(p.vel, 0.6);
    const vel = aim.sub(from).normalize().multiplyScalar(k.move.speed);
    this._projectile({
      owner: 'kaiju',
      kind: 'acid',
      pos: from,
      vel: vel.clone(),
      dmg: k.move.dmg * k.dmgMul,
      color: k.def.glow,
      radius: 1.6,
      life: 2.2,
      source: k,
      move: k.move,
    });
  }

  _projectile(opts) {
    const mat = new THREE.SpriteMaterial({
      map: glowTexture(),
      color: new THREE.Color(opts.color).multiplyScalar(opts.kind === 'missile' ? 2 : 3),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    const size = opts.kind === 'acid' ? 3.2 : opts.kind === 'missile' ? 1.6 : 3;
    sprite.scale.setScalar(size);
    sprite.position.copy(opts.pos);
    this.scene.add(sprite);
    this.projectiles.push({ ...opts, pos: opts.pos.clone(), vel: opts.vel.clone(), sprite, age: 0 });
  }

  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.age += dt;
      if (pr.kind === 'missile') {
        const tgt = pr.target && pr.target.alive ? pr.target : this.target;
        if (tgt && pr.age > 0.25) {
          tgt.centerPosition(_v);
          const desired = _v.sub(pr.pos).normalize().multiplyScalar(48);
          pr.vel.lerp(desired, Math.min(1, dt * 5));
        }
        if (Math.random() < 0.9) this.fx.smoke.emit(pr.pos.x, pr.pos.y, pr.pos.z, 0, 0.5, 0, 0.35, 0.37, 0.4, 1.2, 0.6, -0.5, 1, 2.5);
      } else if (pr.kind === 'acid') {
        pr.vel.y -= 9 * dt;
      }
      pr.pos.addScaledVector(pr.vel, dt);
      pr.sprite.position.copy(pr.pos);
      this.fx.trail(pr.pos, pr.color, pr.kind === 'acid' ? 1.4 : 0.9, 0.3);

      let hit = false;
      if (pr.owner === 'kaiju') {
        const p = this.player;
        const d = Math.hypot(pr.pos.x - p.pos.x, pr.pos.z - p.pos.z);
        if (p.alive && d < p.radius + pr.radius && pr.pos.y < p.height + 1) {
          hit = true;
          const res = this.kaijuHitsPlayer(pr.source, pr.move);
          if (res.result === 'hit') this.fx.blood(pr.pos, pr.color, 25);
        }
      } else {
        for (const e of this.enemies) {
          if (!e.alive || e.state === 'spawn') continue;
          const d = Math.hypot(pr.pos.x - e.pos.x, pr.pos.z - e.pos.z);
          if (d < e.radius + pr.radius && pr.pos.y < e.height + 2) {
            hit = true;
            const dir = _u.copy(pr.vel).setY(0).normalize();
            this._damageKaiju(e, pr.dmg * (0.92 + Math.random() * 0.16), pr.poise || 8, dir.clone(), pr.pos.clone(), false);
            this.fx.explosion(pr.pos, pr.kind === 'missile' ? 0.6 : 0.5, pr.color);
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
      if (!hit && pr.pos.y <= 0.2) {
        hit = true;
        this.fx.splash(pr.pos, 1.5);
        if (pr.kind !== 'acid') this.fx.explosion(pr.pos, 0.4, pr.color);
      }
      if (hit || pr.age > pr.life) {
        this.scene.remove(pr.sprite);
        pr.sprite.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  // ---------- mosse speciali ----------
  onSpecialStart(type) {
    const names = { beam: 'RAGGIO NUCLEARE', missiles: 'SALVA DI MISSILI', emp: 'IMPULSO TESLA', overdrive: 'FURIA OVERDRIVE' };
    this.message(names[type] + '!', 'special', 1.6);
    this.camRig.kick(8);
    this.shake(0.3);
    this.hud.flash(this.player.cfg.colors.accent, 0.4);
    audio.announce(names[type].toLowerCase());
    audio.vibrate([40, 40, 80]);
  }

  onSpecialFire(player, type) {
    const mult = player.stats.special;
    const accent = player.cfg.colors.accent;
    if (type === 'beam') {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(accent).multiplyScalar(1.4),
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      });
      const geo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
      geo.translate(0, 0.5, 0);
      geo.rotateX(Math.PI / 2);
      const outer = new THREE.Mesh(geo, mat);
      const inner = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.6), toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      inner.scale.set(0.35, 0.35, 1);
      outer.add(inner);
      this.scene.add(outer);
      this.beam = { mesh: outer, tick: 0, mult };
      audio.beam(1.35);
      this.shake(0.4);
    } else if (type === 'missiles') {
      this.missileQueue = Math.round(16 * (0.9 + mult * 0.1));
      this.missileTimer = 0;
      this.missileSide = 1;
    } else if (type === 'emp') {
      const p = player.pos;
      this.fx.shockwave(p, accent, 24, 0.9);
      this.fx.shockwave(p, '#ffffff', 16, 0.6);
      this.fx.electric(_v.set(p.x, 3, p.z), accent, 12, 60);
      this.fx.splash(p, 4);
      audio.zap();
      audio.explosion(1.4);
      this.shake(1);
      this.hud.flash(accent, 0.5);
      for (const e of this.enemies) {
        if (!e.alive || e.state === 'spawn') continue;
        const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z) - e.radius;
        if (d <= 24) {
          e.centerPosition(_v);
          _u.set(e.pos.x - p.x, 0, e.pos.z - p.z).normalize();
          this._damageKaiju(e, 240 * mult * player.stats.power, 0, _u.clone(), _v.clone(), false);
          e.stunFor(3.4, this);
        }
      }
    } else if (type === 'overdrive') {
      player.overdrive = 9;
      player.energy = player.maxEnergy;
      this.fx.shockwave(player.pos, accent, 10, 0.6);
      this.fx.electric(_v.set(player.pos.x, 6, player.pos.z), accent, 6, 40);
      audio.roar(2.2, 1, 0.5);
      this.message('OVERDRIVE ATTIVO!', 'special', 1.4);
    }
  }

  onSpecialTick(player, type, t, dt) {
    if (type === 'beam' && this.beam) {
      const from = player.worldPoint('core', _v).clone();
      const dir = player.forward(_u).clone();
      const tgt = this.target;
      if (tgt) {
        tgt.centerPosition(_w);
        dir.copy(_w).sub(from).normalize();
      }
      // lunghezza: fino al primo Kaiju colpito
      let len = 80;
      let hitE = null;
      for (const e of this.enemies) {
        if (!e.alive || e.state === 'spawn') continue;
        e.centerPosition(_w);
        const rel = _w.sub(from);
        const along = rel.dot(dir);
        if (along < 0) continue;
        const perp = rel.addScaledVector(dir, -along).length();
        if (perp < e.radius + 1.5 && along < len) {
          len = Math.max(2, along - e.radius * 0.6);
          hitE = e;
        }
      }
      const m = this.beam.mesh;
      m.position.copy(from);
      m.lookAt(_w.copy(from).add(dir));
      const pulse = 1 + Math.sin(t * 40) * 0.15;
      const width = Math.min(1, t * 5) * 0.95 * pulse;
      m.scale.set(width, width, len);
      const end = from.clone().addScaledVector(dir, len);
      this.fx.trail(end, player.cfg.colors.accent, 4, 0.3);
      if (Math.random() < 0.5) this.fx.sparks(end, '#ffffff', 6, 20);
      this.shake(0.06);
      this.beam.tick += dt;
      if (hitE && this.beam.tick >= 0.1) {
        this.beam.tick = 0;
        this._damageKaiju(hitE, 31 * this.beam.mult * player.stats.power, 6, dir.clone().setY(0).normalize(), end, false);
        this.fx.blood(end, hitE.def.glow, 12);
        audio.impact(false, false);
      }
    } else if (type === 'missiles' && this.missileQueue > 0) {
      this.missileTimer -= dt;
      while (this.missileTimer <= 0 && this.missileQueue > 0) {
        this.missileTimer += 0.065;
        this.missileQueue--;
        this.missileSide *= -1;
        const from = player.worldPoint('chest', new THREE.Vector3());
        const right = _u.set(-Math.cos(player.yaw), 0, Math.sin(player.yaw));
        from.addScaledVector(right, this.missileSide * 2.2 * player.model.body.scale.x);
        from.y += 2.6;
        const fwd = player.forward(_w);
        const vel = new THREE.Vector3(
          fwd.x * 10 + right.x * this.missileSide * 8 + (Math.random() - 0.5) * 6,
          18 + Math.random() * 8,
          fwd.z * 10 + right.z * this.missileSide * 8 + (Math.random() - 0.5) * 6,
        );
        this._projectile({
          owner: 'player',
          kind: 'missile',
          pos: from,
          vel,
          dmg: 30 * player.stats.special * player.stats.power,
          poise: 6,
          color: '#ffb347',
          radius: 1.5,
          life: 3,
          target: this.target,
        });
        audio.missile();
      }
    }
  }

  onSpecialEnd(player, type) {
    if (type === 'beam' && this.beam) {
      this.scene.remove(this.beam.mesh);
      this.beam.mesh.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      this.beam = null;
    }
  }

  // ---------- eventi di fine scontro ----------
  onKaijuDeath(k) {
    this.stats.kills++;
    k.centerPosition(_v);
    this.fx.blood(_v, k.def.glow, 90);
    this.fx.explosion(_v, 1.2, k.def.glow);
    audio.roar(0.7 / k.def.size, 2.4, 1.2);
    audio.explosion(1.5);
    this.shake(0.9);
    this.env.lightning();
    this.player.addSync(25);
    if (this._target === k) this._target = null;
    const left = this.aliveEnemies.length;
    if (left > 0) {
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
    // vittoria
    this.state = 'outro';
    this.stateTime = 0;
    this.won = true;
    this.slowmo = 1.6;
    this.slowFactor = 0.25;
    this.camRig.setMode('finisher', { kaiju: k });
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
    this.camRig.setMode('defeat');
    audio.explosion(1.6);
    audio.alarm();
    this.player.worldPoint('chest', _v);
    this.fx.explosion(_v, 1.3);
    this.message('TITANO ABBATTUTO', 'danger', 3);
    setTimeout(() => {
      if (!this.ended) audio.announce('Titano abbattuto. Pilota, rispondi.');
    }, 700);
  }

  _nextWave() {
    this.wave++;
    // rimuovi i Kaiju sconfitti
    for (const e of this.enemies) e.dispose();
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
    this.onEnd?.({
      won: !!this.won,
      mode: this.mode,
      mission: this.mission,
      stats: { ...this.stats, hpLeft: this.player.hp / this.player.maxHp },
    });
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

    if (this.state === 'intro') {
      const spawned = this.enemies.every((e) => e.state !== 'spawn' || e.stateTime > 2.4);
      if ((this.stateTime > 4.2 && spawned) || (this.stateTime > 1.2 && (input.take('left') || input.take('right') || input.take('dash')))) {
        this.state = 'fight';
        this.stateTime = 0;
        this.camRig.setMode('follow');
        this.hud.hideIntro();
        this.message('COMBATTI!', 'big', 1.2);
        audio.roar(1 / this.enemies[0].def.size, 1.8, 1);
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
        this.camRig.setMode('victory');
      }
      if (this.stateTime > (this.won ? 5.5 : 4.5)) this._finish();
    }

    const ctl = this.state === 'fight' ? input : null;
    this.player.update(dt, ctl || { move: { x: 0, y: 0 }, take: () => false, held: {} }, this);
    for (const e of this.enemies) e.update(dt, this);
    this._resolveCollisions();
    this._updateProjectiles(dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // allarme a bassa energia vitale
    if (this.player.alive && this.player.hp / this.player.maxHp < 0.25 && this.state === 'fight') {
      this.lowHpTimer -= realDt;
      if (this.lowHpTimer <= 0) {
        this.lowHpTimer = 3;
        audio.alarm();
        this.message('CORAZZA CRITICA!', 'danger', 1);
      }
    }

    this.fx.update(dt);
    this.env.update(dt, this.camera, this.player.pos);
    this.camRig.update(realDt * (this.hitstop > 0 ? 0.3 : 1), this.player, this.state === 'outro' && !this.won ? null : this.target);
    this.hud.update(realDt);
  }

  _resolveCollisions() {
    const all = [this.player, ...this.enemies.filter((e) => e.alive && !(e.state === 'active' && e.move?.kind === 'leap'))];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = a.radius + b.radius;
        if (d < min && d > 0.001) {
          const push = (min - d) / d;
          const wa = a === this.player ? 0.7 : 0.5;
          const wb = 1 - wa;
          a.pos.x -= dx * push * wa;
          a.pos.z -= dz * push * wa;
          b.pos.x += dx * push * wb;
          b.pos.z += dz * push * wb;
        }
      }
    }
    for (const f of [this.player, ...this.enemies]) {
      const r = Math.hypot(f.pos.x, f.pos.z);
      if (r > this.arenaRadius) {
        f.pos.x *= this.arenaRadius / r;
        f.pos.z *= this.arenaRadius / r;
      }
    }
  }

  resize() {
    this.camera.aspect = this.app.aspect;
    this.camera.updateProjectionMatrix();
    this.fx.setViewport(this.app.height * this.app.renderer.getPixelRatio());
  }

  dispose() {
    this.ended = true;
    this.hud.dispose();
    this.player.dispose();
    this.enemies.forEach((e) => e.dispose());
    this.projectiles.forEach((p) => {
      this.scene.remove(p.sprite);
      p.sprite.material.dispose();
    });
    if (this.beam) this.onSpecialEnd(this.player, 'beam');
    this.fx.dispose();
    this.env.dispose();
    audio.stopAmbience();
  }
}

export { CATEGORY_LABEL };
