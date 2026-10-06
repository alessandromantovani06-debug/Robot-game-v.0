import * as THREE from 'three';
import { h, button } from './dom.js';
import { input, isTouchDevice } from '../core/input.js';
import { audio } from '../core/audio.js';
import { save } from '../core/save.js';
import { CATEGORY_LABEL } from '../data/kaiju.js';
import { getPart } from '../data/parts.js';

const _p = new THREE.Vector3();

const SHORT = {
  wp_fist: 'PUGNO',
  wp_rocket: 'RAZZO',
  wp_chainsword: 'SPADA',
  wp_hammer: 'MARTELLO',
  wp_plasma: 'PLASMA',
  wp_claws: 'ARTIGLI',
};

export class Hud {
  constructor(root, battle) {
    this.root = root;
    this.b = battle;
    this.messages = [];
    this.numbers = [];
    this.flashT = 0;
    this.comboShown = 0;
    this.tutorial = null;

    const p = battle.player;
    this.el = h('div', { class: 'hud' });
    // barre del Titano
    this.hpFill = h('div', { class: 'fill' });
    this.hpLag = h('div', { class: 'lag' });
    this.hpBox = h('div', { class: 'hp' }, this.hpLag, this.hpFill);
    this.enFill = h('div', { class: 'fill' });
    this.enBox = h('div', { class: 'energy' }, this.enFill);
    this.syncFill = h('div', { class: 'fill' });
    this.syncLabel = h('span', {}, 'SINCRONIA');
    this.syncBox = h('div', { class: 'sync' }, this.syncLabel, h('div', { class: 'track' }, this.syncFill));
    this.hpText = h('small', {}, '');
    this.el.append(
      h('div', { class: 'bars' }, h('div', { class: 'who' }, h('span', {}, p.cfg.name), this.hpText), this.hpBox, this.enBox, this.syncBox),
    );
    this.enemyBox = h('div', { class: 'enemy-bars' });
    this.el.append(this.enemyBox);
    this.rebuildEnemies();

    this.center = h('div', { class: 'center-msg' });
    this.combo = h('div', { class: 'combo' });
    this.reticle = h('div', { class: 'reticle' });
    this.flashEl = h('div', { class: 'screen-flash' });
    this.vignette = h('div', { class: 'vignette' });
    this.numLayer = h('div', { style: { position: 'absolute', inset: '0' } });
    this.el.append(this.vignette, this.flashEl, this.numLayer, this.reticle, this.center, this.combo);

    this.pauseBtn = button('❚❚', () => battle.pause(), 'icon pause-btn small');
    this.el.append(this.pauseBtn);
    if (save.settings.showFps) {
      this.fps = h('div', { class: 'fps' });
      this.el.append(this.fps);
    }

    if (isTouchDevice()) this._buildTouch();
    root.append(this.el);
  }

  rebuildEnemies() {
    this.enemyBox.innerHTML = '';
    this.enemyBars = this.b.enemies.map((e) => {
      const fill = h('div', { class: 'fill' });
      const lag = h('div', { class: 'lag' });
      const box = h('div', { class: 'hp kaiju' }, lag, fill);
      const row = h(
        'div',
        { style: { width: '100%' } },
        h('div', { class: 'who' }, h('small', {}, `CAT. ${CATEGORY_LABEL[e.def.category]}${e.level > 1 ? ' · LV ' + e.level : ''}`), h('span', {}, e.name)),
        box,
      );
      this.enemyBox.append(row);
      return { e, fill, lag, box, row };
    });
  }

  _buildTouch() {
    const t = h('div', { class: 'touch' });
    const zone = h('div', { class: 'stick-zone' });
    const knob = h('div', { class: 'knob' });
    const stick = h('div', { class: 'stick' }, knob);
    t.append(zone, stick);
    const home = () => {
      const r = this.el.getBoundingClientRect();
      const s = Math.min(r.width, r.height);
      return { x: s * 0.2 + 20, y: r.height - s * 0.22 - 10 };
    };
    const place = (x, y) => {
      stick.style.left = x + 'px';
      stick.style.top = y + 'px';
    };
    const reset = () => {
      const p = home();
      place(p.x, p.y);
      knob.style.transform = '';
      stick.style.opacity = '0.45';
      input.setTouchMove(0, 0);
    };
    requestAnimationFrame(reset);
    let active = null;
    let origin = { x: 0, y: 0 };
    zone.addEventListener('pointerdown', (e) => {
      if (active !== null) return;
      active = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      origin = { x: e.clientX, y: e.clientY };
      place(origin.x, origin.y);
      stick.style.opacity = '1';
      audio.unlock();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== active) return;
      const R = stick.offsetWidth * 0.4;
      let dx = e.clientX - origin.x;
      let dy = e.clientY - origin.y;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const nx = dx / R;
      const ny = -dy / R;
      const m = Math.hypot(nx, ny);
      input.setTouchMove(m < 0.15 ? 0 : nx, m < 0.15 ? 0 : ny);
    });
    const end = (e) => {
      if (e.pointerId !== active) return;
      active = null;
      reset();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    const p = this.b.player;
    const mk = (label, action, cls, pos) => {
      const b = h('div', { class: 'tbtn ' + cls, style: pos, html: label });
      const ids = new Set();
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        ids.add(e.pointerId);
        b.classList.add('down');
        input.down(action, 'touch' + e.pointerId);
        input.lastDevice = 'touch';
        audio.unlock();
      });
      const up = (e) => {
        if (!ids.has(e.pointerId)) return;
        ids.delete(e.pointerId);
        input.up(action, 'touch' + e.pointerId);
        if (!ids.size) b.classList.remove('down');
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      t.append(b);
      return b;
    };
    const v = (n) => `calc(${n}vmin + var(--safe-r))`;
    const vb = (n) => `calc(${n}vmin + var(--safe-b))`;
    mk(`DX<small>${SHORT[p.cfg.armR] || ''}</small>`, 'right', 'atk', { right: v(3), bottom: vb(7) });
    mk(`SX<small>${SHORT[p.cfg.armL] || ''}</small>`, 'left', 'atk', { right: v(20), bottom: vb(3) });
    mk('PARA', 'block', 'mid block', { right: v(36), bottom: vb(15) });
    mk('SCATTO', 'dash', 'mid dash', { right: v(4), bottom: vb(25) });
    this.specialBtn = mk('SPEC.', 'special', 'mid special', { right: v(19), bottom: vb(22) });
    this.targetBtn = mk('⌖', 'target', 'sm', { right: v(5), bottom: vb(39) });
    this.touchEl = t;
    this.el.append(t);
  }

  // ---------- messaggi ----------
  message(text, type = 'info', dur = 1.2) {
    const existing = this.messages.find((m) => m.text === text);
    if (existing) {
      existing.t = dur;
      return;
    }
    while (this.messages.length >= 3) {
      const old = this.messages.shift();
      old.el.remove();
    }
    const el = h('div', { class: 'msg ' + type }, text);
    this.center.append(el);
    this.messages.push({ el, t: dur, text });
  }

  flash(color, dur = 0.3) {
    this.flashEl.style.background = `radial-gradient(ellipse at center, transparent 20%, ${color} 100%)`;
    this.flashT = dur;
    this.flashDur = dur;
  }

  damageNumber(pos, value, crit = false, taken = false) {
    if (this.numbers.length > 24) {
      const old = this.numbers.shift();
      old.el.remove();
    }
    const el = h('div', { class: 'dmg-num' + (crit ? ' crit' : '') + (taken ? ' taken' : '') }, (taken ? '-' : '') + value + (crit ? '!' : ''));
    this.numLayer.append(el);
    this.numbers.push({
      el,
      pos: pos.clone(),
      t: 0,
      life: 0.9,
      dx: (Math.random() - 0.5) * 40,
    });
  }

  introCard(mission, enemies) {
    const names = enemies.map((e) => e.name).join(' + ');
    const cat = Math.max(...enemies.map((e) => e.def.category));
    this.intro = h(
      'div',
      { class: 'intro-card' },
      h('div', { class: 'stripe' }, '⚠ ALLERTA KAIJU ⚠'),
      h('div', { class: 'kname' }, names),
      h('div', { class: 'sub' }, `CATEGORIA ${CATEGORY_LABEL[cat]} · ${mission.place.toUpperCase()}`),
      h('div', { class: 'skip' }, 'attacca per saltare'),
    );
    this.el.append(this.intro);
    this.el.querySelector('.bars').style.opacity = '0';
    this.enemyBox.style.opacity = '0';
  }

  hideIntro() {
    this.intro?.remove();
    this.intro = null;
    this.el.querySelector('.bars').style.opacity = '1';
    this.enemyBox.style.opacity = '1';
  }

  // ---------- tutorial ----------
  startTutorial() {
    const dev = () => (isTouchDevice() && input.lastDevice !== 'keyboard' ? 'touch' : input.lastDevice);
    const txt = {
      move: { keyboard: 'Muoviti con <b>W A S D</b> o le <b>frecce</b>', touch: 'Muoviti trascinando il <b>joystick</b> a sinistra', gamepad: 'Muoviti con lo <b>stick sinistro</b>' },
      attack: { keyboard: 'Attacca con <b>J</b> (braccio sinistro) e <b>K</b> (destro) — o click sinistro/destro', touch: 'Attacca con i pulsanti <b>SX</b> e <b>DX</b>. Alternali per le combo!', gamepad: 'Attacca con <b>X</b> e <b>Y</b> (□ e △)' },
      block: { keyboard: 'Tieni premuto <b>L</b> o <b>Shift</b> per parare. Quando il mirino diventa <b>bianco</b> para per una <b>PARATA PERFETTA</b>', touch: 'Tieni premuto <b>PARA</b>. Mirino <b>bianco</b> = momento della <b>PARATA PERFETTA</b>', gamepad: 'Tieni premuto <b>LB</b> per parare. Mirino <b>bianco</b> = <b>PARATA PERFETTA</b>' },
      dash: { keyboard: 'Premi <b>Spazio</b> per scattare e schivare', touch: 'Premi <b>SCATTO</b> per schivare gli attacchi', gamepad: 'Premi <b>A</b> (✕) per scattare' },
      special: { keyboard: 'Sincronia al 100%: premi <b>E</b> per la mossa <b>SPECIALE</b>!', touch: 'Sincronia al 100%: premi <b>SPEC.</b> per la mossa speciale!', gamepad: 'Sincronia al 100%: premi <b>B</b> (○) per la mossa speciale!' },
    };
    const steps = [
      { id: 'move', done: (s) => s.moved > 8 },
      { id: 'attack', done: (s) => s.hits >= 3 },
      { id: 'block', done: (s) => s.blocked },
      { id: 'dash', done: (s) => s.dashed },
      { id: 'special', done: (s) => s.special, waitSync: true },
    ];
    this.tutorial = { steps, i: 0, txt, dev, s: { moved: 0, hits: 0, blocked: false, dashed: false, special: false }, el: null, lastPos: this.b.player.pos.clone(), lastDealt: 0 };
    this._showTutorialStep();
  }

  _showTutorialStep() {
    const T = this.tutorial;
    T.el?.remove();
    const step = T.steps[T.i];
    if (!step) {
      this.tutorial = null;
      return;
    }
    const d = T.dev();
    T.el = h('div', { class: 'tutorial panel', html: T.txt[step.id][d] || T.txt[step.id].keyboard });
    this.el.append(T.el);
  }

  _updateTutorial() {
    const T = this.tutorial;
    if (!T) return;
    const p = this.b.player;
    T.s.moved += p.pos.distanceTo(T.lastPos);
    T.lastPos.copy(p.pos);
    if (this.b.stats.dmgDealt > T.lastDealt) {
      T.s.hits++;
      T.lastDealt = this.b.stats.dmgDealt;
    }
    if (p.state === 'block') T.s.blocked = true;
    if (p.state === 'dash') T.s.dashed = true;
    if (p.state === 'special') T.s.special = true;
    const step = T.steps[T.i];
    if (step.waitSync && p.sync < 100 && !T.s.special) {
      T.el.style.display = 'none';
      return;
    }
    T.el.style.display = '';
    if (step.done(T.s)) {
      T.i++;
      audio.ui('confirm');
      this._showTutorialStep();
    }
  }

  // ---------- pausa ----------
  showPause() {
    const app = this.b.app;
    this.pauseEl = h(
      'div',
      { class: 'modal-back' },
      h(
        'div',
        { class: 'modal panel', style: { width: 'min(380px, 100%)', alignItems: 'stretch' } },
        h('h2', { style: { textAlign: 'center' } }, 'PAUSA'),
        button('Riprendi', () => this.b.resume(), 'primary'),
        button('Ricomincia', () => app.restartBattle()),
        button('Impostazioni', () => app.openSettings()),
        button('Come si gioca', () => app.openHelp()),
        button('Abbandona missione', () => app.quitBattle(), 'danger'),
      ),
    );
    this.el.append(this.pauseEl);
    this.el.style.pointerEvents = 'auto';
  }

  hidePause() {
    this.pauseEl?.remove();
    this.pauseEl = null;
    this.el.style.pointerEvents = '';
  }

  // ---------- aggiornamento ----------
  update(dt) {
    const b = this.b;
    const p = b.player;
    const hpK = Math.max(0, p.hp / p.maxHp);
    this.hpFill.style.width = hpK * 100 + '%';
    this.hpLag.style.width = hpK * 100 + '%';
    this.hpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    this.hpBox.classList.toggle('low', hpK < 0.25);
    this.vignette.classList.toggle('on', hpK < 0.25 && p.alive);
    this.enFill.style.width = (p.energy / p.maxEnergy) * 100 + '%';
    this.enBox.classList.toggle('out', p.energyDelay > 1);
    this.syncFill.style.width = p.sync + '%';
    const ready = p.sync >= 100;
    this.syncBox.classList.toggle('ready', ready);
    this.syncLabel.textContent = ready ? `${p.torso.specialName.toUpperCase()} PRONTO!` : `SINCRONIA ${Math.floor(p.sync)}%`;
    if (this.specialBtn) this.specialBtn.classList.toggle('ready', ready);
    if (this.targetBtn) this.targetBtn.style.display = b.aliveEnemies.length > 1 ? '' : 'none';

    for (const eb of this.enemyBars) {
      const k = Math.max(0, eb.e.hp / eb.e.maxHp);
      eb.fill.style.width = k * 100 + '%';
      eb.lag.style.width = k * 100 + '%';
      eb.box.classList.toggle('enraged', eb.e.enraged && eb.e.alive);
      eb.row.style.opacity = eb.e.alive ? (eb.e === b.target ? '1' : '0.6') : '0.25';
    }

    // combo
    if (b.combo >= 2) {
      if (b.combo !== this.comboShown) {
        this.combo.innerHTML = `${b.combo} <small>COMBO</small>`;
        this.combo.classList.remove('pop');
        void this.combo.offsetWidth;
        this.combo.classList.add('pop');
        this.comboShown = b.combo;
      }
      this.combo.classList.add('on');
    } else {
      this.combo.classList.remove('on');
      this.comboShown = 0;
    }

    // messaggi
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const m = this.messages[i];
      m.t -= dt;
      if (m.t <= 0 && !m.out) {
        m.out = true;
        m.el.classList.add('out');
      }
      if (m.t <= -0.4) {
        m.el.remove();
        this.messages.splice(i, 1);
      }
    }

    // lampo dello schermo
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flashEl.style.opacity = Math.max(0, this.flashT / this.flashDur) * 0.8;
    } else this.flashEl.style.opacity = 0;

    // numeri del danno e mirino
    const cam = b.camera;
    const W = this.el.clientWidth;
    const H = this.el.clientHeight;
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      n.t += dt;
      if (n.t >= n.life) {
        n.el.remove();
        this.numbers.splice(i, 1);
        continue;
      }
      _p.copy(n.pos);
      _p.y += n.t * 4;
      _p.project(cam);
      if (_p.z > 1) {
        n.el.style.opacity = 0;
        continue;
      }
      const x = (_p.x * 0.5 + 0.5) * W + n.dx * n.t;
      const y = (-_p.y * 0.5 + 0.5) * H;
      const k = n.t / n.life;
      n.el.style.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      n.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${1 + Math.max(0, 0.3 - n.t) * 2})`;
    }

    // segnale per la parata: rosso = attacco in carica, bianco = para adesso
    let cue = '';
    for (const e of b.enemies) {
      if (!e.alive || e.state !== 'windup' || !e.move || e.move.kind === 'roar' || e.move.kind === 'projectile') continue;
      const left = e.windup - e.moveTime;
      const lead = e.move.kind === 'melee' ? 0.22 : 0.3;
      cue = left < lead ? 'now' : cue || 'danger';
    }
    this.reticle.classList.toggle('danger', cue === 'danger');
    this.reticle.classList.toggle('now', cue === 'now');

    const tgt = b.fighting ? b.target : null;
    if (tgt) {
      tgt.centerPosition(_p);
      _p.project(cam);
      if (_p.z < 1) {
        this.reticle.style.opacity = '1';
        this.reticle.style.left = (_p.x * 0.5 + 0.5) * W + 'px';
        this.reticle.style.top = (-_p.y * 0.5 + 0.5) * H + 'px';
      } else this.reticle.style.opacity = '0';
    } else this.reticle.style.opacity = '0';

    if (this.fps) this.fps.textContent = `${Math.round(b.app.fps)} FPS · ${b.app.renderer.getPixelRatio().toFixed(2)}x`;
    if (this.tutorial && b.fighting) this._updateTutorial();
    else if (this.tutorial && b.state === 'outro') {
      this.tutorial.el?.remove();
      this.tutorial = null;
    }
    const hideUi = !b.fighting && b.state !== 'between';
    if (this.touchEl) this.touchEl.style.display = hideUi ? 'none' : '';
  }

  dispose() {
    this.el.remove();
  }
}

export { getPart };
