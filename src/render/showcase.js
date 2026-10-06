import * as THREE from 'three';
import { Environment } from './environment.js';
import { Effects } from './effects.js';
import { frameTexture, hangarFloorTexture, decalTexture } from './textures.js';
import { nightEnvMap, studioEnvMap } from './envmap.js';
import { ENVIRONMENTS } from '../data/environments.js';
import { RobotFighter, WATER_DEPTH } from '../game/robotFighter.js';
import { KaijuFighter } from '../game/kaijuFighter.js';
import { damp, dampAngle, clamp } from '../game/anim.js';
import { audio } from '../core/audio.js';

/** Sfondo animato del menu principale. */
export class MenuView {
  constructor(app, robotCfg) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, app.aspect, 0.3, 2500);
    this.env = new Environment(this.scene, ENVIRONMENTS.menu, app.quality);
    this.scene.environment = nightEnvMap(app.renderer, ENVIRONMENTS.menu);
    this.scene.environmentIntensity = 0.6;
    this.env.onThunder = (d) => audio.thunder(0.5 + d * 2);
    this.time = 0;
    this.setRobot(robotCfg);
    this.kaiju = new KaijuFighter('leviathan', 1, this.scene, {});
    this.kaiju.state = 'idle';
    this.kaiju.pos.set(16, 0, 58);
    this.kaiju.yaw = Math.atan2(-16, -58);
    this.offsetX = 0.17;
    this._updateView();
  }

  setRobot(cfg) {
    if (this.robot) this.robot.dispose();
    this.robot = new RobotFighter(cfg, this.scene, { relaxed: true, shadows: this.app.quality.shadows });
    this.robot.yaw = Math.PI - 0.35;
  }

  _updateView() {
    const { width: W, height: H } = this.app;
    const narrow = W / H < 1.3;
    this.camera.setViewOffset(W, H, -W * (narrow ? 0.05 : this.offsetX), 0, W, H);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
  }

  resize() {
    this._updateView();
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    this.robot.updateDisplay(dt);
    this.kaiju.time += dt;
    this.kaiju._animate(dt, this.robot);
    this.kaiju.model.root.position.y -= 4.5;
    this.kaiju.model.materials.glow.emissiveIntensity = 2.4 + Math.sin(t * 1.3) * 0.6;
    const a = Math.sin(t * 0.07) * 0.45 + 0.15;
    const r = 21;
    // la camera guarda verso la citta' e il Kaiju che emerge dalla nebbia alle spalle del Titano
    this.camera.position.set(Math.sin(a) * r, 3.2 + Math.sin(t * 0.13) * 0.6, -Math.cos(a) * r);
    this.camera.lookAt(0, 6.2, 0);
    this.env.update(dt, this.camera, this.robot.pos);
  }

  dispose() {
    this.robot.dispose();
    this.kaiju.dispose();
    this.env.dispose();
  }
}

function hazardTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#e8b81a';
  g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#111';
  for (let x = -32; x < 300; x += 32) {
    g.beginPath();
    g.moveTo(x, 32);
    g.lineTo(x + 16, 32);
    g.lineTo(x + 32, 0);
    g.lineTo(x + 16, 0);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(10, 1);
  return t;
}

/** Hangar dove si costruisce e si personalizza il Titano. */
export class HangarView {
  constructor(app, robotCfg) {
    this.app = app;
    const q = app.quality;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#05080e');
    this.scene.fog = new THREE.FogExp2('#05080e', 0.016);
    this.scene.environment = studioEnvMap(app.renderer);
    this.scene.environmentIntensity = 0.35;
    this.camera = new THREE.PerspectiveCamera(40, app.aspect, 0.3, 500);
    this.fx = new Effects(this.scene, { particles: q.particles });
    this.fx.setViewport(app.height * app.renderer.getPixelRatio());
    this.time = 0;
    this.yaw = 0.5;
    this.pitch = 0.12;
    this.dist = 22;
    this.focusY = 5;
    this.target = { yaw: 0.5, pitch: 0.12, dist: 22, focusY: 5 };
    this.idle = 0;
    this.offset = { x: 0.1, y: 0.08 };
    this._build(q);
    this.setRobot(robotCfg);
    this._bindControls();
    this._updateView();
  }

  _build(q) {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#6d86b8', '#0a0a10', 0.9));
    const key = new THREE.SpotLight('#ffffff', 5, 0, 0.5, 0.45, 0);
    key.position.set(4, 30, 14);
    key.target.position.set(0, 4, 0);
    s.add(key, key.target);
    if (q.shadows) {
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.bias = -0.0004;
    }
    const rimL = new THREE.DirectionalLight('#3fd2ff', 1.8);
    rimL.position.set(-20, 12, -14);
    const rimR = new THREE.DirectionalLight('#ff9a50', 1.3);
    rimR.position.set(22, 8, -10);
    const front = new THREE.DirectionalLight('#9fb8ff', 0.6);
    front.position.set(0, 6, 30);
    s.add(rimL, rimR, front);

    // pavimento
    const floorTex = hangarFloorTexture().clone();
    floorTex.needsUpdate = true;
    floorTex.repeat.set(14, 14);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.45 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);

    // piattaforma rotante
    const metal = new THREE.MeshStandardMaterial({ color: '#2a2f38', roughness: 0.4, metalness: 0.8 });
    this.platform = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.6, 48), metal);
    top.position.y = 0.3;
    top.receiveShadow = true;
    const side = new THREE.Mesh(
      new THREE.CylinderGeometry(7.05, 7.05, 0.35, 48, 1, true),
      new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.6, metalness: 0.2 }),
    );
    side.position.y = 0.3;
    this.ringMat = new THREE.MeshStandardMaterial({ color: '#3fd2ff', emissive: '#3fd2ff', emissiveIntensity: 1.2 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.07, 6, 64), this.ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.62;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.04, 6, 64), this.ringMat);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = 0.62;
    this.platform.add(top, side, ring, ring2);
    s.add(this.platform);

    // impalcature ai lati
    const steel = new THREE.MeshStandardMaterial({ color: '#3a4250', map: frameTexture(), roughness: 0.5, metalness: 0.7 });
    const warn = new THREE.MeshStandardMaterial({ color: '#ffb030', emissive: '#ffb030', emissiveIntensity: 2 });
    this.gantryPoints = [];
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 20, 0.5), steel);
        post.position.set(x, 10, z);
        g.add(post);
      }
      for (const y of [4.5, 8.5, 12.5, 16.5]) {
        const deck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 4.2), steel);
        deck.position.y = y;
        g.add(deck);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.25, 1.2), steel);
        arm.position.set(-sx * 3.6, y, 0);
        g.add(arm);
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), warn);
        lamp.position.set(-sx * 5.3, y + 0.25, 0.5);
        g.add(lamp);
        this.gantryPoints.push(new THREE.Vector3(sx * 11 - sx * 5.3, y, 0.5));
      }
      g.position.set(sx * 11, 0, 0);
      g.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = q.shadows;
          o.receiveShadow = q.shadows;
        }
      });
      s.add(g);
    }

    // parete di fondo
    const wallTex = frameTexture().clone();
    wallTex.needsUpdate = true;
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(20, 10);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(120, 50, 1), new THREE.MeshStandardMaterial({ map: wallTex, color: '#565e6b', roughness: 0.7, metalness: 0.5 }));
    wall.position.set(0, 25, -20);
    s.add(wall);
    const strip = new THREE.MeshStandardMaterial({ color: '#3fd2ff', emissive: '#3fd2ff', emissiveIntensity: 1.8 });
    for (let i = -5; i <= 5; i++) {
      if (i === 0) continue;
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 26, 0.2), strip);
      l.position.set(i * 7, 13, -19.4);
      s.add(l);
    }
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 11),
      new THREE.MeshBasicMaterial({ map: decalTexture('BAY 07', '#ffb030'), transparent: true, opacity: 0.85, depthWrite: false }),
    );
    label.position.set(0, 26, -19.4);
    s.add(label);
    // portellone laterale con luci
    for (let i = 0; i < 8; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), warn);
      l.position.set(-30 + i * 8.5, 40, -19.3);
      s.add(l);
    }

    // coni di luce
    const coneMat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color('#bcd4ff') } },
      vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 color; varying float vY; void main(){ float a = pow(vY, 1.5) * 0.09; gl_FragColor = vec4(color * a, a); }',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const coneGeo = new THREE.CylinderGeometry(0.6, 8, 30, 24, 1, true);
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0, 15, 0);
    s.add(cone);
    this.sparkTimer = 1;
  }

  setRobot(cfg) {
    const prevYaw = this.robot?.yaw ?? 0;
    if (this.robot) this.robot.dispose();
    this.robot = new RobotFighter(cfg, this.scene, { relaxed: true, groundY: 0.6, shadows: this.app.quality.shadows });
    this.robot.yaw = prevYaw;
    this.ringMat.color.set(cfg.colors.accent);
    this.ringMat.emissive.set(cfg.colors.accent);
    this.ringScale = this.robot.glowScale;
  }

  /** Inquadra la parte del robot che si sta modificando. */
  focus(category) {
    const T = this.target;
    const views = {
      head: { focusY: 9.2, dist: 10, pitch: 0.08, yaw: 0.35 },
      torso: { focusY: 7.8, dist: 13, pitch: 0.1, yaw: 0.45 },
      armL: { focusY: 6.8, dist: 14, pitch: 0.1, yaw: 1.1 },
      armR: { focusY: 6.8, dist: 14, pitch: 0.1, yaw: -1.1 },
      legs: { focusY: 3.6, dist: 13, pitch: 0.12, yaw: 0.6 },
      shoulders: { focusY: 8.5, dist: 13, pitch: 0.2, yaw: 0.7 },
    };
    const v = views[category] || { focusY: 5.2, dist: 22, pitch: 0.12, yaw: T.yaw };
    Object.assign(T, v);
    this.idle = 0;
  }

  _bindControls() {
    const el = this.app.renderer.domElement;
    const pts = new Map();
    let pinch = 0;
    this._down = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    this._move = (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (pts.size === 1) {
        this.target.yaw -= dx * 0.008;
        this.target.pitch = clamp(this.target.pitch + dy * 0.004, -0.15, 0.7);
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.target.dist = clamp(this.target.dist * (pinch / d), 8, 32);
        pinch = d;
      }
      this.idle = 0;
    };
    this._up = (e) => {
      pts.delete(e.pointerId);
    };
    this._wheel = (e) => {
      this.target.dist = clamp(this.target.dist * (1 + Math.sign(e.deltaY) * 0.1), 8, 32);
      this.idle = 0;
    };
    el.addEventListener('pointerdown', this._down);
    el.addEventListener('pointermove', this._move);
    el.addEventListener('pointerup', this._up);
    el.addEventListener('pointercancel', this._up);
    el.addEventListener('wheel', this._wheel, { passive: true });
  }

  _updateView() {
    const { width: W, height: H } = this.app;
    const narrow = W / H < 1.2;
    this.camera.setViewOffset(W, H, -W * (narrow ? 0 : this.offset.x), H * this.offset.y, W, H);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
  }

  resize() {
    this._updateView();
    this.fx.setViewport(this.app.height * this.app.renderer.getPixelRatio());
  }

  update(dt) {
    this.time += dt;
    this.idle += dt;
    const T = this.target;
    if (this.idle > 5) T.yaw += dt * 0.18;
    this.yaw = damp(this.yaw, T.yaw, 5, dt);
    this.pitch = damp(this.pitch, T.pitch, 5, dt);
    this.dist = damp(this.dist, T.dist, 4, dt);
    this.focusY = damp(this.focusY, T.focusY, 4, dt);
    const r = this.dist;
    this.camera.position.set(Math.sin(this.yaw) * Math.cos(this.pitch) * r, this.focusY + Math.sin(this.pitch) * r, Math.cos(this.yaw) * Math.cos(this.pitch) * r);
    this.camera.lookAt(0, this.focusY, 0);
    this.robot.updateDisplay(dt);
    this.ringMat.emissiveIntensity = (1.1 + Math.sin(this.time * 2) * 0.3) * (this.ringScale || 1);

    // scintille di saldatura
    this.sparkTimer -= dt;
    if (this.sparkTimer <= 0) {
      this.sparkTimer = 0.8 + Math.random() * 2.5;
      const p = this.gantryPoints[Math.floor(Math.random() * this.gantryPoints.length)];
      this.fx.sparks(p, '#ffc070', 30, 7);
    }
    this.fx.update(dt);
  }

  dispose() {
    const el = this.app.renderer.domElement;
    el.removeEventListener('pointerdown', this._down);
    el.removeEventListener('pointermove', this._move);
    el.removeEventListener('pointerup', this._up);
    el.removeEventListener('pointercancel', this._up);
    el.removeEventListener('wheel', this._wheel);
    this.robot.dispose();
    this.fx.dispose();
    this.scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }
}

export { WATER_DEPTH, dampAngle };
