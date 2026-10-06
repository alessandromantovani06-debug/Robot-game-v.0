// Motore audio procedurale: tutta la musica e gli effetti sono sintetizzati
// in tempo reale con la Web Audio API (nessun file audio da scaricare).

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeNoise(ctx, seconds, brown = false) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

function makeImpulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function distortionCurve(amount) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

// Progressione in Re minore: i - VI - III - VII
const CHORDS = [
  [50, 53, 57],
  [46, 50, 53],
  [53, 57, 60],
  [48, 52, 55],
];
const BATTLE_CHORDS = [
  [50, 53, 57],
  [50, 53, 57],
  [46, 50, 53],
  [48, 52, 55],
];
const BASS_RIFF = [0, null, 0, 0, null, 0, 12, null, 0, null, 0, 0, 10, null, 7, null];

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicVolume = 0.6;
    this.sfxVolume = 0.85;
    this.musicMode = null;
    this.rainNodes = null;
    this.voiceEnabled = true;
    this.vibrationEnabled = true;
    this._lastPlay = {};
  }

  /** Va chiamato dopo un gesto dell'utente (tocco/click), come richiesto dai browser. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.pendingMusic) {
      const m = this.pendingMusic;
      this.pendingMusic = null;
      this.playMusic(m);
    }
    if (this.pendingAmbience) {
      const a = this.pendingAmbience;
      this.pendingAmbience = null;
      this.startAmbience(a);
    }
  }

  _build() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume * 0.55;
    this.musicBus.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(this.master);

    this.ambBus = ctx.createGain();
    this.ambBus.gain.value = this.sfxVolume;
    this.ambBus.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeImpulse(ctx, 2.6, 2.4);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.32;
    this.reverbSend.connect(this.reverb).connect(this.master);

    this.noise = makeNoise(ctx, 2);
    this.brown = makeNoise(ctx, 4, true);
    this.distCurve = distortionCurve(40);
    this.heavyCurve = distortionCurve(120);
  }

  setVolumes(music, sfx) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(sfx, t, 0.05);
    this.ambBus.gain.setTargetAtTime(sfx, t, 0.05);
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  // Evita di sovrapporre troppe volte lo stesso suono nello stesso istante.
  _throttle(key, ms) {
    const now = performance.now();
    if (this._lastPlay[key] && now - this._lastPlay[key] < ms) return false;
    this._lastPlay[key] = now;
    return true;
  }

  // ---------- mattoni base ----------
  _gain(dest, value = 1) {
    const g = this.ctx.createGain();
    g.gain.value = value;
    g.connect(dest);
    return g;
  }

  _env(g, t, attack, peak, decay, sustain = 0) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + attack + decay);
  }

  _osc(type, freq, t, dur, dest) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  _noiseSrc(t, dur, dest, brown = false, offset = Math.random()) {
    const s = this.ctx.createBufferSource();
    s.buffer = brown ? this.brown : this.noise;
    s.loop = true;
    s.connect(dest);
    s.start(t, offset * (s.buffer.duration - 0.1));
    s.stop(t + dur + 0.05);
    return s;
  }

  _filter(type, freq, q = 1, dest) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    if (dest) f.connect(dest);
    return f;
  }

  _out(reverb = 0.3) {
    const g = this.ctx.createGain();
    g.connect(this.sfxBus);
    if (reverb > 0) {
      const s = this.ctx.createGain();
      s.gain.value = reverb;
      g.connect(s).connect(this.reverbSend);
    }
    return g;
  }

  // ---------- effetti sonori ----------
  ui(kind = 'click') {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.1);
    if (kind === 'click') {
      const g = this._gain(out, 0);
      this._env(g, t, 0.003, 0.12, 0.08);
      this._osc('square', 1200, t, 0.1, this._filter('lowpass', 3000, 1, g));
    } else if (kind === 'confirm') {
      [880, 1320].forEach((f, i) => {
        const g = this._gain(out, 0);
        this._env(g, t + i * 0.07, 0.004, 0.13, 0.18);
        this._osc('triangle', f, t + i * 0.07, 0.25, g);
      });
    } else if (kind === 'error') {
      const g = this._gain(out, 0);
      this._env(g, t, 0.005, 0.16, 0.25);
      this._osc('sawtooth', 140, t, 0.3, this._filter('lowpass', 900, 1, g));
    } else if (kind === 'equip') {
      const g = this._gain(out, 0);
      this._env(g, t, 0.003, 0.25, 0.3);
      const f = this._filter('bandpass', 2200, 4, g);
      this._noiseSrc(t, 0.25, f);
      const g2 = this._gain(out, 0);
      this._env(g2, t, 0.002, 0.25, 0.2);
      const o = this._osc('sine', 220, t, 0.25, g2);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.2);
    } else if (kind === 'buy') {
      [660, 880, 1320, 1760].forEach((f, i) => {
        const g = this._gain(out, 0);
        this._env(g, t + i * 0.06, 0.004, 0.1, 0.25);
        this._osc('square', f, t + i * 0.06, 0.3, this._filter('lowpass', 4000, 1, g));
      });
    }
  }

  impact(heavy = false, metal = true) {
    if (!this.ready || !this._throttle('impact', 35)) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.35);
    // tonfo
    const g = this._gain(out, 0);
    this._env(g, t, 0.002, heavy ? 1.1 : 0.8, heavy ? 0.35 : 0.22);
    const o = this._osc('sine', heavy ? 140 : 180, t, 0.4, g);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.3);
    // rumore d'impatto
    const gn = this._gain(out, 0);
    this._env(gn, t, 0.001, heavy ? 0.9 : 0.6, heavy ? 0.3 : 0.16);
    const lp = this._filter('lowpass', heavy ? 1400 : 2600, 0.8, gn);
    this._noiseSrc(t, 0.4, lp);
    if (metal) {
      const base = 260 + Math.random() * 120;
      [1, 1.59, 2.27, 3.1].forEach((r, i) => {
        const gm = this._gain(out, 0);
        this._env(gm, t, 0.001, 0.08 / (i + 1), 0.5 + Math.random() * 0.3);
        this._osc(i % 2 ? 'triangle' : 'square', base * r, t, 0.9, this._filter('bandpass', base * r, 6, gm));
      });
    } else {
      const gs = this._gain(out, 0);
      this._env(gs, t, 0.005, 0.5, 0.25);
      const bp = this._filter('bandpass', 700, 2, gs);
      bp.frequency.exponentialRampToValueAtTime(180, t + 0.25);
      this._noiseSrc(t, 0.3, bp);
    }
  }

  block(perfect = false) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.45);
    const base = perfect ? 880 : 520;
    [1, 1.5, 2.01, 2.76].forEach((r, i) => {
      const g = this._gain(out, 0);
      this._env(g, t, 0.001, (perfect ? 0.22 : 0.14) / (i + 1), perfect ? 1.2 : 0.6);
      this._osc('triangle', base * r, t, 1.3, g);
    });
    const gn = this._gain(out, 0);
    this._env(gn, t, 0.001, 0.4, 0.1);
    this._noiseSrc(t, 0.15, this._filter('highpass', 2500, 1, gn));
  }

  step(power = 1) {
    if (!this.ready || !this._throttle('step', 90)) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.25);
    const g = this._gain(out, 0);
    this._env(g, t, 0.004, 0.55 * power, 0.35);
    const o = this._osc('sine', 75, t, 0.45, g);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.35);
    const gn = this._gain(out, 0);
    this._env(gn, t, 0.01, 0.35 * power, 0.4);
    this._noiseSrc(t, 0.45, this._filter('lowpass', 500, 0.7, gn));
    // sciabordio d'acqua
    const gw = this._gain(out, 0);
    this._env(gw, t + 0.03, 0.02, 0.12 * power, 0.35);
    const bp = this._filter('bandpass', 1400, 1.2, gw);
    this._noiseSrc(t + 0.03, 0.4, bp);
    // idraulica
    const gh = this._gain(out, 0);
    this._env(gh, t + 0.05, 0.02, 0.04 * power, 0.18);
    this._noiseSrc(t + 0.05, 0.25, this._filter('highpass', 5000, 1, gh));
  }

  whoosh(big = false) {
    if (!this.ready || !this._throttle('whoosh', 60)) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.15);
    const g = this._gain(out, 0);
    const d = big ? 0.45 : 0.28;
    this._env(g, t, d * 0.4, big ? 0.5 : 0.32, d * 0.6);
    const bp = this._filter('bandpass', 400, 1.5, g);
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(big ? 1200 : 1800, t + d * 0.45);
    bp.frequency.exponentialRampToValueAtTime(250, t + d);
    this._noiseSrc(t, d + 0.1, bp);
  }

  servo() {
    if (!this.ready || !this._throttle('servo', 120)) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.1);
    const g = this._gain(out, 0);
    this._env(g, t, 0.03, 0.07, 0.25);
    const o = this._osc('sawtooth', 160, t, 0.3, this._filter('lowpass', 1200, 4, g));
    o.frequency.linearRampToValueAtTime(320, t + 0.25);
  }

  thruster() {
    if (!this.ready || !this._throttle('thruster', 100)) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.2);
    const g = this._gain(out, 0);
    this._env(g, t, 0.02, 0.45, 0.45);
    const bp = this._filter('lowpass', 2500, 1, g);
    bp.frequency.exponentialRampToValueAtTime(400, t + 0.45);
    this._noiseSrc(t, 0.5, bp);
  }

  plasma() {
    if (!this.ready || !this._throttle('plasma', 60)) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.3);
    const g = this._gain(out, 0);
    this._env(g, t, 0.003, 0.35, 0.4);
    const o = this._osc('sawtooth', 1400, t, 0.45, this._filter('lowpass', 3000, 3, g));
    o.frequency.exponentialRampToValueAtTime(90, t + 0.4);
    const g2 = this._gain(out, 0);
    this._env(g2, t, 0.002, 0.25, 0.3);
    const o2 = this._osc('sine', 2400, t, 0.35, g2);
    o2.frequency.exponentialRampToValueAtTime(200, t + 0.3);
  }

  spit() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.3);
    const g = this._gain(out, 0);
    this._env(g, t, 0.02, 0.5, 0.45);
    const bp = this._filter('bandpass', 500, 3, g);
    bp.frequency.exponentialRampToValueAtTime(1600, t + 0.15);
    bp.frequency.exponentialRampToValueAtTime(300, t + 0.45);
    this._noiseSrc(t, 0.5, bp);
  }

  explosion(size = 1) {
    if (!this.ready || !this._throttle('explosion', 50)) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.5);
    const d = 0.8 + size * 0.8;
    const g = this._gain(out, 0);
    this._env(g, t, 0.005, 0.9 * Math.min(1.3, size), d);
    const lp = this._filter('lowpass', 2400, 0.7, g);
    lp.frequency.exponentialRampToValueAtTime(90, t + d);
    this._noiseSrc(t, d + 0.1, lp, true);
    const gb = this._gain(out, 0);
    this._env(gb, t, 0.004, 1, d * 0.7);
    const o = this._osc('sine', 90, t, d, gb);
    o.frequency.exponentialRampToValueAtTime(25, t + d * 0.8);
  }

  roar(pitch = 1, dur = 1.6, intensity = 1) {
    if (!this.ready || !this._throttle('roar', 400)) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.6);
    const master = this._gain(out, 0);
    master.gain.setValueAtTime(0.0001, t);
    master.gain.linearRampToValueAtTime(0.55 * intensity, t + 0.18);
    master.gain.setValueAtTime(0.55 * intensity, t + dur * 0.7);
    master.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.heavyCurve;
    const f1 = this._filter('bandpass', 420 * pitch, 2.5, master);
    const f2 = this._filter('bandpass', 950 * pitch, 3, master);
    const lp = this._filter('lowpass', 2200, 0.7, master);
    shaper.connect(f1);
    shaper.connect(f2);
    shaper.connect(lp);
    f1.frequency.linearRampToValueAtTime(650 * pitch, t + dur * 0.5);
    f1.frequency.linearRampToValueAtTime(300 * pitch, t + dur);

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 7 + Math.random() * 4;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 9 * pitch;
    lfo.connect(lfoGain);
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
    [68, 71.5, 103, 137].forEach((f) => {
      const g = this.ctx.createGain();
      g.gain.value = 0.3;
      g.connect(shaper);
      const o = this._osc('sawtooth', f * pitch, t, dur, g);
      lfoGain.connect(o.frequency);
      o.frequency.setValueAtTime(f * pitch * 0.85, t);
      o.frequency.linearRampToValueAtTime(f * pitch * 1.08, t + dur * 0.3);
      o.frequency.linearRampToValueAtTime(f * pitch * 0.7, t + dur);
    });
    const gn = this.ctx.createGain();
    gn.gain.value = 0.5;
    gn.connect(shaper);
    this._noiseSrc(t, dur, this._filter('bandpass', 700 * pitch, 1, gn));
  }

  growl(pitch = 1) {
    if (!this.ready || !this._throttle('growl', 250)) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.4);
    const g = this._gain(out, 0);
    this._env(g, t, 0.05, 0.3, 0.6);
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.distCurve;
    shaper.connect(this._filter('lowpass', 900 * pitch, 1, g));
    const o = this._osc('sawtooth', 55 * pitch, t, 0.7, shaper);
    o.frequency.linearRampToValueAtTime(42 * pitch, t + 0.6);
  }

  thunder(delay = 0) {
    if (!this.ready) return;
    const t = this.ctx.currentTime + delay;
    const out = this._gain(this.ambBus, 1);
    const g = this._gain(out, 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.7, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
    const lp = this._filter('lowpass', 900, 0.6, g);
    lp.frequency.exponentialRampToValueAtTime(70, t + 3.2);
    this._noiseSrc(t, 3.6, lp, true);
    const gc = this._gain(out, 0);
    this._env(gc, t, 0.002, 0.35, 0.25);
    this._noiseSrc(t, 0.3, this._filter('highpass', 1500, 0.7, gc));
  }

  empCharge(dur = 1.5) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.3);
    const g = this._gain(out, 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.25, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
    const o = this._osc('sawtooth', 80, t, dur, this._filter('lowpass', 2000, 6, g));
    o.frequency.exponentialRampToValueAtTime(900, t + dur);
    const trem = this.ctx.createOscillator();
    trem.frequency.value = 24;
    const tg = this.ctx.createGain();
    tg.gain.value = 0.12;
    trem.connect(tg).connect(g.gain);
    trem.start(t);
    trem.stop(t + dur);
  }

  zap() {
    if (!this.ready || !this._throttle('zap', 80)) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.4);
    const g = this._gain(out, 0);
    this._env(g, t, 0.002, 0.6, 0.6);
    this._osc('square', 60, t, 0.6, this._filter('bandpass', 1800, 0.8, g));
    const gn = this._gain(out, 0);
    this._env(gn, t, 0.002, 0.5, 0.5);
    this._noiseSrc(t, 0.6, this._filter('highpass', 3000, 0.5, gn));
  }

  beam(dur = 1.4) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.4);
    const g = this._gain(out, 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.15);
    g.gain.setValueAtTime(0.5, t + dur - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    const lp = this._filter('lowpass', 2500, 2, g);
    [110, 111.5, 220.7, 330].forEach((f) => this._osc('sawtooth', f, t, dur + 0.2, lp));
    const gn = this._gain(out, 0);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(0.3, t + 0.1);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    this._noiseSrc(t, dur + 0.2, this._filter('highpass', 4000, 0.7, gn));
  }

  missile() {
    if (!this.ready || !this._throttle('missile', 40)) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.2);
    const g = this._gain(out, 0);
    this._env(g, t, 0.01, 0.18, 0.5);
    this._noiseSrc(t, 0.55, this._filter('bandpass', 1800, 1.5, g));
    const g2 = this._gain(out, 0);
    this._env(g2, t, 0.01, 0.05, 0.5);
    const o = this._osc('sine', 1500, t, 0.55, g2);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.5);
  }

  special() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.5);
    const g = this._gain(out, 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    const o = this._osc('sawtooth', 120, t, 1.1, this._filter('lowpass', 3000, 4, g));
    o.frequency.exponentialRampToValueAtTime(1100, t + 0.65);
    setTimeout(() => this.explosion(0.8), 600);
  }

  alarm() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.4);
    for (let i = 0; i < 4; i++) {
      const g = this._gain(out, 0);
      this._env(g, t + i * 0.35, 0.02, 0.12, 0.3);
      this._osc('sawtooth', i % 2 ? 560 : 740, t + i * 0.35, 0.35, this._filter('lowpass', 2000, 1, g));
    }
  }

  sting(win = true) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const out = this._out(0.5);
    const notes = win ? [62, 65, 69, 74, 77] : [62, 61, 58, 55, 50];
    notes.forEach((n, i) => {
      const g = this._gain(out, 0);
      this._env(g, t + i * 0.13, 0.01, 0.16, win && i === notes.length - 1 ? 1.8 : 0.5);
      this._osc('sawtooth', midi(n), t + i * 0.13, 2, this._filter('lowpass', 2400, 1, g));
      this._osc('square', midi(n - 12), t + i * 0.13, 2, this._filter('lowpass', 900, 1, g));
    });
  }

  // ---------- ambiente ----------
  startAmbience({ rain = 0.8, snow = false } = {}) {
    if (!this.ctx) {
      this.pendingAmbience = { rain, snow };
      return;
    }
    this.stopAmbience();
    const t = this.ctx.currentTime;
    const nodes = [];
    const g = this._gain(this.ambBus, 0);
    g.gain.linearRampToValueAtTime(1, t + 1.5);
    if (rain > 0) {
      const rg = this._gain(g, 0.09 * rain);
      const hp = this._filter('highpass', 700, 0.5, rg);
      const lp = this._filter('lowpass', 7000, 0.5);
      lp.connect(hp);
      nodes.push(this._loop(this.noise, lp));
    }
    if (snow) {
      const wg = this._gain(g, 0.12);
      const bp = this._filter('bandpass', 500, 0.8, wg);
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.12;
      const lg = this.ctx.createGain();
      lg.gain.value = 300;
      lfo.connect(lg).connect(bp.frequency);
      lfo.start();
      nodes.push(lfo, this._loop(this.brown, bp));
    }
    // oceano / rombo di fondo
    const og = this._gain(g, 0.16);
    const olp = this._filter('lowpass', 260, 0.6, og);
    nodes.push(this._loop(this.brown, olp));
    this.rainNodes = { gain: g, nodes };
  }

  _loop(buffer, dest) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.connect(dest);
    s.start();
    return s;
  }

  stopAmbience() {
    if (!this.rainNodes || !this.ctx) return;
    const { gain, nodes } = this.rainNodes;
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.6);
    nodes.forEach((n) => n.stop(t + 0.7));
    this.rainNodes = null;
  }

  // ---------- musica ----------
  playMusic(mode) {
    if (!this.ctx) {
      this.pendingMusic = mode;
      return;
    }
    if (this.musicMode === mode) return;
    this.stopMusic();
    this.musicMode = mode;
    this.bpm = mode === 'menu' ? 84 : mode === 'boss' ? 140 : 128;
    this.seqStep = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.musicGain = this._gain(this.musicBus, 0);
    this.musicGain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 1.2);
    this.timer = setInterval(() => this._schedule(), 25);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.musicGain && this.ctx) {
      const g = this.musicGain;
      const t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.5);
      setTimeout(() => g.disconnect(), 800);
    }
    this.musicMode = null;
  }

  _schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const stepDur = 60 / this.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this._playStep(this.seqStep, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.seqStep++;
    }
  }

  _playStep(step, t, sd) {
    const mode = this.musicMode;
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    const out = this.musicGain;
    if (mode === 'menu') {
      const chord = CHORDS[Math.floor(bar / 2) % 4];
      if (s16 === 0 && bar % 2 === 0) this._pad(t, chord, sd * 32, out, 0.09);
      if (s16 === 0) this._taiko(t, out, bar % 2 === 0 ? 0.5 : 0.3);
      if (s16 === 10 && bar % 2 === 1) this._taiko(t, out, 0.25);
      if (s16 % 2 === 0) {
        const arp = [0, 1, 2, 1, 2, 0, 1, 2];
        const n = chord[arp[(s16 / 2) % 8]] + 12;
        this._pluck(t, midi(n), out, 0.045);
      }
      if (s16 === 0) this._bass(t, midi(chord[0] - 24), sd * 14, out, 0.16, false);
      return;
    }
    // battaglia / boss
    const chords = BATTLE_CHORDS;
    const chord = chords[bar % 4];
    const root = chord[0] - 24;
    const boss = mode === 'boss';
    if ([0, 6, 8, 11].includes(s16) || (boss && s16 === 14)) this._kick(t, out, 0.8);
    if (s16 === 4 || s16 === 12) this._snare(t, out, 0.4);
    if (s16 % 2 === 0) this._hat(t, out, s16 % 4 === 2 ? 0.08 : 0.05);
    const r = BASS_RIFF[s16];
    if (r !== null) this._bass(t, midi(root + r), sd * 0.9, out, 0.22, true);
    if (s16 === 0 && bar % 2 === 0) this._pad(t, chord.map((n) => n + 12), sd * 32, out, boss ? 0.07 : 0.05);
    if (bar % 4 === 3 && (s16 === 0 || s16 === 3 || s16 === 6)) this._stab(t, chord, out, 0.07);
    if (boss && s16 % 4 === 0) this._pluck(t, midi(chord[(s16 / 4) % 3] + 24), out, 0.03);
  }

  _kick(t, out, v) {
    const g = this._gain(out, 0);
    this._env(g, t, 0.002, v, 0.3);
    const o = this._osc('sine', 150, t, 0.35, g);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  }

  _snare(t, out, v) {
    const g = this._gain(out, 0);
    this._env(g, t, 0.002, v, 0.2);
    this._noiseSrc(t, 0.25, this._filter('bandpass', 1800, 0.8, g));
    const g2 = this._gain(out, 0);
    this._env(g2, t, 0.002, v * 0.5, 0.1);
    this._osc('triangle', 190, t, 0.15, g2);
  }

  _hat(t, out, v) {
    const g = this._gain(out, 0);
    this._env(g, t, 0.001, v, 0.04);
    this._noiseSrc(t, 0.06, this._filter('highpass', 7000, 0.7, g));
  }

  _taiko(t, out, v) {
    const g = this._gain(out, 0);
    this._env(g, t, 0.004, v, 0.9);
    const o = this._osc('sine', 90, t, 1, g);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.5);
    const gn = this._gain(out, 0);
    this._env(gn, t, 0.002, v * 0.4, 0.15);
    this._noiseSrc(t, 0.2, this._filter('lowpass', 800, 1, gn));
  }

  _bass(t, f, dur, out, v, dist) {
    const g = this._gain(out, 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.01);
    g.gain.setValueAtTime(v, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = this._filter('lowpass', dist ? 1100 : 400, dist ? 3 : 1, g);
    lp.frequency.setValueAtTime(dist ? 1600 : 400, t);
    lp.frequency.exponentialRampToValueAtTime(dist ? 300 : 300, t + dur);
    let dest = lp;
    if (dist) {
      const sh = this.ctx.createWaveShaper();
      sh.curve = this.distCurve;
      sh.connect(lp);
      dest = sh;
    }
    this._osc('sawtooth', f, t, dur, dest);
    this._osc('square', f * 0.5, t, dur, dest);
  }

  _pad(t, notes, dur, out, v) {
    const g = this._gain(out, 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + dur * 0.25);
    g.gain.setValueAtTime(v, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const lp = this._filter('lowpass', 1100, 0.7, g);
    notes.forEach((n) => {
      this._osc('sawtooth', midi(n) * 0.997, t, dur, lp);
      this._osc('sawtooth', midi(n) * 1.004, t, dur, lp);
    });
  }

  _pluck(t, f, out, v) {
    const g = this._gain(out, 0);
    this._env(g, t, 0.003, v, 0.35);
    const lp = this._filter('lowpass', 2500, 2, g);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.3);
    this._osc('triangle', f, t, 0.4, lp);
    this._osc('square', f * 2, t, 0.2, this._gain(lp, 0.2));
  }

  _stab(t, notes, out, v) {
    const g = this._gain(out, 0);
    this._env(g, t, 0.005, v, 0.3);
    const lp = this._filter('lowpass', 2200, 1.5, g);
    notes.forEach((n) => {
      this._osc('sawtooth', midi(n), t, 0.35, lp);
      this._osc('sawtooth', midi(n + 12) * 1.003, t, 0.35, lp);
    });
  }

  // ---------- voce e vibrazione ----------
  announce(text) {
    if (!this.voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'it-IT';
      u.rate = 1.02;
      u.pitch = 0.7;
      u.volume = Math.min(1, this.sfxVolume + 0.1);
      const voices = window.speechSynthesis.getVoices();
      const it = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('it'));
      if (it) u.voice = it;
      window.speechSynthesis.speak(u);
    } catch {
      /* sintesi vocale non disponibile */
    }
  }

  vibrate(pattern) {
    if (!this.vibrationEnabled || !navigator.vibrate) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      /* non supportato */
    }
  }
}

export const audio = new AudioEngine();
