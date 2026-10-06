import './styles.css';
import { save } from './core/save.js';
import { audio } from './core/audio.js';
import { input, isTouchDevice } from './core/input.js';
import { MenuView, HangarView } from './game/views.js';
import { Battle } from './game/battle.js';
import { MISSIONS, survivalWave } from './data/missions.js';
import { Screens } from './ui/screens.js';
import { isElectron } from './core/platform.js';

// Qualita' grafica: densita' di pixel, risoluzione dei disegni, particelle, pioggia, riflessi.
const QUALITY = {
  low: { level: 'low', dprCap: 1, spriteRes: 44, particles: 0.5, rain: 0.45, reflections: false },
  medium: { level: 'medium', dprCap: 1.5, spriteRes: 60, particles: 0.8, rain: 0.75, reflections: true },
  high: { level: 'high', dprCap: 2, spriteRes: 76, particles: 1, rain: 1, reflections: true },
};

const isMobile = () => isTouchDevice() && Math.min(screen.width, screen.height) < 900;

export function resolveQuality(setting) {
  if (setting && QUALITY[setting]) return { ...QUALITY[setting] };
  return { ...(isMobile() ? QUALITY.medium : QUALITY.high), auto: true };
}

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.ui = document.getElementById('ui');
    this.quality = resolveQuality(save.settings.quality);
    this.view = null;
    this.fps = 60;
    this.frameAvg = 16;
    this.adaptTimer = 0;
    this.deferredInstall = null;
    this.dprScale = 1;
    if (isTouchDevice()) document.body.classList.add('touch-device');
    this.resize();
    this.applySettings();
    input.bindMouse(this.canvas);
    this.screens = new Screens(this);

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.view instanceof Battle) this.view.pause();
        audio.ctx?.suspend();
      } else if (audio.ctx) audio.ctx.resume();
    });
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstall = e;
      this.screens.refreshInstall?.();
    });

    this.setView(new MenuView(this, save.activeRobot));
    this.screens.title();
    this.last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
    const boot = document.getElementById('boot');
    boot.style.opacity = '0';
    setTimeout(() => boot.remove(), 700);
  }

  get aspect() {
    return this.width / this.height;
  }

  applySettings() {
    const s = save.settings;
    audio.setVolumes(s.music, s.sfx);
    audio.voiceEnabled = s.voice;
    audio.vibrationEnabled = s.vibration;
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.quality.dprCap) * this.dprScale;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.view?.resize?.();
  }

  setView(view) {
    if (this.view && this.view !== view) this.view.dispose?.();
    this.view = view;
  }

  // ---------- navigazione ----------
  showMenu() {
    if (!(this.view instanceof MenuView)) this.setView(new MenuView(this, save.activeRobot));
    else this.view.setRobot(save.activeRobot);
    audio.playMusic('menu');
    audio.startAmbience({ rain: 0.8 });
    this.screens.menu();
  }

  showHangar() {
    this.setView(new HangarView(this, save.activeRobot));
    audio.stopAmbience();
    audio.playMusic('menu');
    this.screens.hangar();
  }

  showMissions() {
    if (!(this.view instanceof MenuView)) this.setView(new MenuView(this, save.activeRobot));
    this.screens.missions();
  }

  startMission(mission) {
    this.lastLaunch = { mission, mode: 'campaign' };
    this._launch();
  }

  startSurvival() {
    const mission = {
      id: 'survival',
      name: 'Sopravvivenza',
      place: 'Baia di Tokyo',
      env: ['tokyo', 'hongkong', 'sydney', 'sanfrancisco'][Math.floor(Math.random() * 4)],
      enemies: survivalWave(1),
    };
    this.lastLaunch = { mission, mode: 'survival' };
    this._launch();
  }

  _launch() {
    const { mission, mode } = this.lastLaunch;
    this.screens.clear();
    audio.stopAmbience();
    const battle = new Battle(this, { mission, robot: save.activeRobot, mode, onEnd: (result) => this.screens.results(result) });
    this.setView(battle);
    window.__battle = battle;
  }

  restartBattle() {
    if (this.lastLaunch?.mode === 'survival') this.startSurvival();
    else this._launch();
  }

  quitBattle() {
    this.showMenu();
    if (this.lastLaunch?.mode === 'campaign') this.screens.missions();
  }

  openSettings() {
    this.screens.settings();
  }

  openHelp() {
    this.screens.help();
  }

  // ---------- ciclo principale ----------
  _loop(now) {
    requestAnimationFrame(this._loop);
    const raw = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    const dt = Math.min(raw, 0.05);
    this.frameAvg = this.frameAvg * 0.95 + Math.min(raw, 0.1) * 1000 * 0.05;
    this.fps = 1000 / this.frameAvg;
    input.update();
    const view = this.view;
    if (!view) return;
    view.update(dt);
    // prima del disegno: ridimensionare il canvas lo svuota
    this._adapt(raw);
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    view.render(ctx, this.canvas.width, this.canvas.height);
  }

  // Risoluzione dinamica: abbassa la nitidezza se il dispositivo fatica.
  _adapt(raw) {
    if (document.hidden) return;
    this.adaptTimer += raw;
    if (this.adaptTimer < 2) return;
    this.adaptTimer = 0;
    let s = this.dprScale;
    if (this.frameAvg > 26 && s > 0.55) s = Math.max(0.55, s - 0.12);
    else if (this.frameAvg < 15 && s < 1) s = Math.min(1, s + 0.08);
    if (s !== this.dprScale) {
      this.dprScale = s;
      this.resize();
    }
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!location.protocol.startsWith('http')) return;
  if (window.Capacitor || isElectron()) return;
  if (!import.meta.env.PROD) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW non registrato', e));
  });
}

async function boot() {
  try {
    // il font serve per la sigla dipinta sulle spalle dei Titani
    await Promise.race([document.fonts?.load('900 32px Orbitron'), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});
    const app = new App();
    // riferimenti utili per il debug dalla console del browser
    window.__app = app;
    window.__save = save;
    window.__input = input;
    window.__missions = MISSIONS;
  } catch (e) {
    console.error(e);
    const el = document.getElementById('boot');
    if (el) el.innerHTML = '<div style="max-width:420px;text-align:center;line-height:1.5">Impossibile avviare il gioco.<br><br><small>' + String(e.message || e) + '</small></div>';
  }
}

registerServiceWorker();
boot();
