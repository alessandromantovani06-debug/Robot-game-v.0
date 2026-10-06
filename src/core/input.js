// Gestione unificata di tastiera, mouse, touch e gamepad.

const KEYMAP = {
  KeyJ: 'left',
  KeyK: 'right',
  KeyL: 'block',
  ShiftLeft: 'block',
  ShiftRight: 'block',
  Space: 'dash',
  KeyI: 'special',
  KeyE: 'special',
  KeyQ: 'target',
  Tab: 'target',
  Escape: 'pause',
  KeyP: 'pause',
};

const MOVEKEYS = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

const PAD_BUTTONS = {
  2: 'left',
  3: 'right',
  7: 'right',
  0: 'dash',
  1: 'special',
  4: 'block',
  6: 'block',
  5: 'target',
  9: 'pause',
};

const ACTIONS = ['left', 'right', 'block', 'dash', 'special', 'target', 'pause'];

class Input {
  constructor() {
    this.keys = new Set();
    this.held = {};
    this.pressTime = {};
    this.sources = {}; // azione -> set di sorgenti che la tengono premuta
    for (const a of ACTIONS) {
      this.held[a] = false;
      this.pressTime[a] = -1;
      this.sources[a] = new Set();
    }
    this.touchMove = { x: 0, y: 0 };
    this.padMove = { x: 0, y: 0 };
    this.move = { x: 0, y: 0 };
    this.enabled = false;
    this.padPrev = {};
    this.lastDevice = 'keyboard';
    this.gamepadConnected = false;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      this.lastDevice = 'keyboard';
      if (MOVEKEYS[e.code]) {
        this.keys.add(e.code);
        if (this.enabled) e.preventDefault();
      }
      const action = KEYMAP[e.code];
      if (action) {
        if (this.enabled || action === 'pause') e.preventDefault();
        if (!e.repeat) this.down(action, 'kb:' + e.code);
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const action = KEYMAP[e.code];
      if (action) this.up(action, 'kb:' + e.code);
    });
    window.addEventListener('blur', () => this.releaseAll());
    window.addEventListener('gamepadconnected', () => {
      this.gamepadConnected = true;
      this.lastDevice = 'gamepad';
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gamepadConnected = Array.from(navigator.getGamepads?.() || []).some(Boolean);
    });
  }

  /** Collega i click del mouse sul canvas di gioco agli attacchi. */
  bindMouse(el) {
    el.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.lastDevice = 'keyboard';
      if (e.button === 0) this.down('left', 'mouse0');
      if (e.button === 2) this.down('right', 'mouse2');
      if (e.button === 1) this.down('special', 'mouse1');
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.up('left', 'mouse0');
      if (e.button === 2) this.up('right', 'mouse2');
      if (e.button === 1) this.up('special', 'mouse1');
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(action, source = 'virtual') {
    const set = this.sources[action];
    if (!set) return;
    if (!set.has(source)) {
      set.add(source);
      this.pressTime[action] = performance.now();
    }
    this.held[action] = true;
  }

  up(action, source = 'virtual') {
    const set = this.sources[action];
    if (!set) return;
    set.delete(source);
    this.held[action] = set.size > 0;
  }

  releaseAll() {
    this.keys.clear();
    for (const a of ACTIONS) {
      this.sources[a].clear();
      this.held[a] = false;
    }
    this.touchMove.x = this.touchMove.y = 0;
  }

  /** Restituisce true se l'azione e' stata premuta negli ultimi `buffer` secondi (e la consuma). */
  take(action, buffer = 0.2) {
    const t = this.pressTime[action];
    if (t < 0) return false;
    if (performance.now() - t <= buffer * 1000) {
      this.pressTime[action] = -1;
      return true;
    }
    return false;
  }

  clearPresses() {
    for (const a of ACTIONS) this.pressTime[a] = -1;
  }

  setTouchMove(x, y) {
    this.touchMove.x = x;
    this.touchMove.y = y;
    this.lastDevice = 'touch';
  }

  update() {
    // gamepad
    this.padMove.x = this.padMove.y = 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad) continue;
      this.gamepadConnected = true;
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      const dead = 0.18;
      if (Math.hypot(ax, ay) > dead) {
        this.padMove.x = ax;
        this.padMove.y = -ay;
        this.lastDevice = 'gamepad';
      }
      if (pad.buttons[12]?.pressed) this.padMove.y = 1;
      if (pad.buttons[13]?.pressed) this.padMove.y = -1;
      if (pad.buttons[14]?.pressed) this.padMove.x = -1;
      if (pad.buttons[15]?.pressed) this.padMove.x = 1;
      for (const [idx, action] of Object.entries(PAD_BUTTONS)) {
        const b = pad.buttons[idx];
        const pressed = !!b && (b.pressed || b.value > 0.5);
        const key = pad.index + ':' + idx;
        if (pressed && !this.padPrev[key]) {
          this.down(action, 'pad' + key);
          this.lastDevice = 'gamepad';
        } else if (!pressed && this.padPrev[key]) this.up(action, 'pad' + key);
        this.padPrev[key] = pressed;
      }
    }

    // tastiera
    let kx = 0;
    let ky = 0;
    for (const code of this.keys) {
      const v = MOVEKEYS[code];
      if (v) {
        kx += v[0];
        ky += v[1];
      }
    }
    let x = kx + this.touchMove.x + this.padMove.x;
    let y = ky + this.touchMove.y + this.padMove.y;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.move.x = x;
    this.move.y = y;
  }
}

export const input = new Input();

export const isTouchDevice = () =>
  'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.matchMedia?.('(pointer: coarse)').matches;
