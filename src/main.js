import './styles.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { save } from './core/save.js';
import { audio } from './core/audio.js';
import { input, isTouchDevice } from './core/input.js';
import { MenuView, HangarView } from './render/showcase.js';
import { Battle } from './game/battle.js';
import { MISSIONS, survivalWave } from './data/missions.js';
import { Screens } from './ui/screens.js';
import { isElectron } from './core/platform.js';

const QUALITY = {
  low: { level: 'low', maxPixelRatio: 0.85, shadows: false, bloom: false, rain: 1200, particles: 0.5, antialias: false },
  medium: { level: 'medium', maxPixelRatio: 1.25, shadows: false, bloom: true, rain: 2600, particles: 0.8, antialias: true },
  high: { level: 'high', maxPixelRatio: 2, shadows: true, bloom: true, rain: 4500, particles: 1, antialias: true },
};

const isMobile = () => isTouchDevice() && Math.min(screen.width, screen.height) < 900;

export function resolveQuality(setting) {
  if (setting && QUALITY[setting]) return { ...QUALITY[setting] };
  return { ...(isMobile() ? QUALITY.medium : QUALITY.high), auto: true };
}

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ui = document.getElementById('ui');
    this.quality = resolveQuality(save.settings.quality);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.view = null;
    this.fps = 60;
    this.frameAvg = 16;
    this.adaptTimer = 0;
    this.deferredInstall = null;
    if (isTouchDevice()) document.body.classList.add('touch-device');

    this._createRenderer();
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

    this.clock = new THREE.Clock();
    this.setView(new MenuView(this, save.activeRobot));
    this.screens.title();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
    const boot = document.getElementById('boot');
    boot.style.opacity = '0';
    setTimeout(() => boot.remove(), 700);
  }

  _createRenderer() {
    const q = this.quality;
    const r = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: q.antialias,
      powerPreference: 'high-performance',
      stencil: false,
    });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = q.shadows;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, q.maxPixelRatio);
    r.setPixelRatio(this.pixelRatio);
    r.setSize(this.width, this.height);
    this.renderer = r;
    // sui telefoni il sistema puo' togliere la GPU al gioco (es. in background):
    // al ripristino si ricarica la pagina (i progressi sono gia' salvati)
    this.canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    this.canvas.addEventListener('webglcontextrestored', () => location.reload());

    if (q.bloom) {
      this.composer = new EffectComposer(r);
      this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
      this.bloom = new UnrealBloomPass(new THREE.Vector2(this.width / 2, this.height / 2), 0.7, 0.45, 0.92);
      this.composer.addPass(this.renderPass);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
      this.composer.setPixelRatio(this.pixelRatio);
      this.composer.setSize(this.width, this.height);
    }
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
    this.renderer.setSize(this.width, this.height);
    if (this.composer) {
      this.composer.setSize(this.width, this.height);
      this.bloom.resolution.set(this.width / 2, this.height / 2);
    }
    if (this.view) {
      this.view.camera.aspect = this.aspect;
      this.view.camera.updateProjectionMatrix();
      this.view.resize?.();
    }
  }

  setView(view) {
    if (this.view && this.view !== view) this.view.dispose();
    this.view = view;
    view.camera.aspect = this.aspect;
    view.camera.updateProjectionMatrix();
    view.resize?.();
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
    const battle = new Battle(this, {
      mission,
      robot: save.activeRobot,
      mode,
      onEnd: (result) => this.screens.results(result),
    });
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

  // ---------- ciclo di rendering ----------
  _loop() {
    requestAnimationFrame(this._loop);
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, 0.05);
    this.frameAvg = this.frameAvg * 0.95 + Math.min(raw, 0.1) * 1000 * 0.05;
    this.fps = 1000 / this.frameAvg;
    input.update();
    const view = this.view;
    if (!view) return;
    view.update(dt);
    if (this.composer) {
      this.renderPass.scene = view.scene;
      this.renderPass.camera = view.camera;
      this.composer.render(dt);
    } else this.renderer.render(view.scene, view.camera);
    this._adapt(raw);
  }

  // Risoluzione dinamica: abbassa la qualita' se il dispositivo fatica.
  _adapt(raw) {
    if (document.hidden) return;
    this.adaptTimer += raw;
    if (this.adaptTimer < 2) return;
    this.adaptTimer = 0;
    const max = Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio);
    let pr = this.pixelRatio;
    if (this.frameAvg > 26 && pr > 0.6) pr = Math.max(0.6, pr - 0.15);
    else if (this.frameAvg < 15 && pr < max) pr = Math.min(max, pr + 0.1);
    if (pr !== this.pixelRatio) {
      this.pixelRatio = pr;
      this.renderer.setPixelRatio(pr);
      if (this.composer) this.composer.setPixelRatio(pr);
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

function boot() {
  try {
    const app = new App();
    // riferimenti utili per il debug dalla console del browser
    window.__app = app;
    window.__save = save;
    window.__input = input;
    window.__missions = MISSIONS;
  } catch (e) {
    console.error(e);
    const boot = document.getElementById('boot');
    if (boot) boot.innerHTML = '<div style="max-width:420px;text-align:center;line-height:1.5">Impossibile avviare il gioco: il tuo dispositivo deve supportare WebGL.<br><br><small>' + String(e.message || e) + '</small></div>';
  }
}

registerServiceWorker();
boot();

export { MISSIONS };
