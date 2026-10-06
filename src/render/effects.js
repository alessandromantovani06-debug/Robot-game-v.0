import * as THREE from 'three';
import { glowTexture, ringTexture } from './textures.js';

/** Sistema di particelle su GPU con un unico draw call. */
export class Particles {
  constructor(parent, max = 1500, additive = true) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    this.size = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);

    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('color', this.aCol);
    g.setAttribute('aAlpha', this.aAlpha);
    g.setAttribute('aSize', this.aSize);
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTexture() }, scale: { value: 400 }, opacity: { value: additive ? 1 : 0.6 } },
      vertexShader: /* glsl */ `
        attribute float aAlpha; attribute float aSize; attribute vec3 color;
        uniform float scale;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vColor = color; vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = min(300.0, aSize * scale / max(0.1, -mv.z));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; uniform float opacity; varying vec3 vColor; varying float vAlpha;
        void main(){
          float a = texture2D(map, gl_PointCoord).a * vAlpha * opacity;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    parent.add(this.points);
  }

  setScale(h) {
    this.mat.uniforms.scale.value = h * 0.5;
  }

  emit(x, y, z, vx, vy, vz, r, g, b, size, life, gravity = 0, drag = 0, sizeEnd = size) {
    let i = this.count;
    if (i >= this.max) i = Math.floor(Math.random() * this.max);
    else this.count++;
    const i3 = i * 3;
    this.pos[i3] = x;
    this.pos[i3 + 1] = y;
    this.pos[i3 + 2] = z;
    this.vel[i3] = vx;
    this.vel[i3 + 1] = vy;
    this.vel[i3 + 2] = vz;
    this.col[i3] = r;
    this.col[i3 + 1] = g;
    this.col[i3 + 2] = b;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.s0[i] = size;
    this.s1[i] = sizeEnd;
    this.size[i] = size;
    this.alpha[i] = 1;
    this.grav[i] = gravity;
    this.drag[i] = drag;
  }

  update(dt) {
    let n = this.count;
    for (let i = 0; i < n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        n--;
        if (i !== n) this._move(n, i);
        i--;
        continue;
      }
      const i3 = i * 3;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= d;
      this.vel[i3 + 1] = this.vel[i3 + 1] * d - this.grav[i] * dt;
      this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const k = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, k * 1.6);
      this.size[i] = this.s1[i] + (this.s0[i] - this.s1[i]) * k;
    }
    this.count = n;
    this.geo.setDrawRange(0, n);
    this.aPos.needsUpdate = true;
    this.aCol.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aSize.needsUpdate = true;
  }

  _move(from, to) {
    const f3 = from * 3;
    const t3 = to * 3;
    for (let k = 0; k < 3; k++) {
      this.pos[t3 + k] = this.pos[f3 + k];
      this.vel[t3 + k] = this.vel[f3 + k];
      this.col[t3 + k] = this.col[f3 + k];
    }
    this.life[to] = this.life[from];
    this.maxLife[to] = this.maxLife[from];
    this.s0[to] = this.s0[from];
    this.s1[to] = this.s1[from];
    this.size[to] = this.size[from];
    this.alpha[to] = this.alpha[from];
    this.grav[to] = this.grav[from];
    this.drag[to] = this.drag[from];
  }

  clear() {
    this.count = 0;
    this.geo.setDrawRange(0, 0);
  }

  dispose() {
    this.points.parent?.remove(this.points);
    this.geo.dispose();
    this.mat.dispose();
  }
}

const _c = new THREE.Color();

/** Effetti visivi del combattimento. */
export class Effects {
  constructor(parent, quality) {
    this.parent = parent;
    this.q = quality.particles;
    this.glow = new Particles(parent, Math.round(1800 * this.q), true);
    this.smoke = new Particles(parent, Math.round(700 * this.q), false);
    this.rings = [];
    this.flashes = [];
    this.ringGeo = new THREE.PlaneGeometry(1, 1);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.markers = new Set();
  }

  setViewport(h) {
    this.glow.setScale(h);
    this.smoke.setScale(h);
  }

  _n(n) {
    return Math.max(1, Math.round(n * this.q));
  }

  sparks(pos, color = '#ffb347', count = 26, speed = 18) {
    _c.set(color);
    for (let i = 0; i < this._n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const s = speed * (0.3 + Math.random());
      const r = Math.sqrt(1 - u * u);
      this.glow.emit(pos.x, pos.y, pos.z, Math.cos(a) * r * s, u * s + 4, Math.sin(a) * r * s, _c.r * 2.2, _c.g * 2.2, _c.b * 2.2, 0.35 + Math.random() * 0.35, 0.35 + Math.random() * 0.5, 25, 1.5, 0.05);
    }
    this.flash(pos, color, 5);
  }

  blood(pos, color, count = 30) {
    _c.set(color);
    for (let i = 0; i < this._n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 4 + Math.random() * 12;
      this.glow.emit(pos.x, pos.y, pos.z, Math.cos(a) * s, 3 + Math.random() * 10, Math.sin(a) * s, _c.r * 1.6, _c.g * 1.6, _c.b * 1.6, 0.6 + Math.random() * 0.9, 0.6 + Math.random() * 0.7, 22, 0.6, 0.3);
    }
  }

  splash(pos, size = 1) {
    for (let i = 0; i < this._n(14 * size); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (2 + Math.random() * 5) * size;
      this.smoke.emit(pos.x + Math.cos(a) * size, 0.2, pos.z + Math.sin(a) * size, Math.cos(a) * s, 4 + Math.random() * 7 * size, Math.sin(a) * s, 0.62, 0.72, 0.82, 0.45 * size, 0.45 + Math.random() * 0.4, 20, 0.5, 1.1 * size);
    }
    this.ring(pos, '#a8c4e0', 0.5 * size, 7 * size, 1.1, 0.5);
  }

  smokePuff(pos, count = 10, color = '#2a2d33', size = 3) {
    _c.set(color);
    for (let i = 0; i < this._n(count); i++) {
      this.smoke.emit(pos.x + (Math.random() - 0.5) * 2, pos.y + (Math.random() - 0.5) * 2, pos.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3, _c.r, _c.g, _c.b, size, 1.5 + Math.random(), -1, 0.8, size * 2.5);
    }
  }

  explosion(pos, size = 1, color = '#ff8a2a') {
    _c.set(color);
    for (let i = 0; i < this._n(40 * size); i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - u * u);
      const s = (6 + Math.random() * 14) * size;
      this.glow.emit(pos.x, pos.y, pos.z, Math.cos(a) * r * s, u * s, Math.sin(a) * r * s, _c.r * 2, _c.g * 1.6, _c.b * 1.2, (1.5 + Math.random() * 1.5) * size, 0.4 + Math.random() * 0.5, 2, 2.5, 0.2);
    }
    this.smokePuff(pos, 12 * size, '#1d1f24', 3 * size);
    this.flash(pos, color, 14 * size);
    this.ring(pos, color, 1, 16 * size, 0.7, 0.8);
  }

  shockwave(pos, color = '#9fe8ff', radius = 12, life = 0.6) {
    this.ring({ x: pos.x, y: 0.25, z: pos.z }, color, 1, radius * 2, life, 1);
    this.ring({ x: pos.x, y: 0.3, z: pos.z }, '#ffffff', 0.5, radius * 1.4, life * 0.7, 0.6);
    _c.set(color);
    for (let i = 0; i < this._n(40); i++) {
      const a = (i / 40) * Math.PI * 2;
      const s = radius * 2.2;
      this.glow.emit(pos.x, 0.8, pos.z, Math.cos(a) * s, 2 + Math.random() * 3, Math.sin(a) * s, _c.r * 2, _c.g * 2, _c.b * 2, 1.2, life, 2, 2, 0.4);
    }
  }

  electric(pos, color = '#8a7dff', radius = 4, count = 12) {
    _c.set(color);
    for (let i = 0; i < this._n(count); i++) {
      this.glow.emit(pos.x + (Math.random() - 0.5) * radius, pos.y + (Math.random() - 0.5) * radius, pos.z + (Math.random() - 0.5) * radius, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, _c.r * 3, _c.g * 3, _c.b * 3, 0.5 + Math.random() * 0.6, 0.15 + Math.random() * 0.2, 0, 0);
    }
  }

  trail(pos, color, size = 0.8, life = 0.35) {
    _c.set(color);
    this.glow.emit(pos.x, pos.y, pos.z, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, _c.r * 2, _c.g * 2, _c.b * 2, size, life, 0, 0, size * 0.2);
  }

  thrust(pos, dir, color = '#ffb24a') {
    _c.set(color);
    this.glow.emit(pos.x, pos.y, pos.z, dir.x * 12 + (Math.random() - 0.5) * 2, dir.y * 12, dir.z * 12 + (Math.random() - 0.5) * 2, _c.r * 2, _c.g * 1.8, _c.b * 1.5, 0.9, 0.25, 0, 1, 0.1);
  }

  flash(pos, color = '#ffffff', size = 6) {
    let f = this.flashes.find((s) => !s.visible);
    if (!f) {
      const mat = new THREE.SpriteMaterial({
        map: glowTexture(),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        toneMapped: false,
      });
      f = new THREE.Sprite(mat);
      this.parent.add(f);
      this.flashes.push(f);
    }
    f.visible = true;
    f.position.set(pos.x, pos.y, pos.z);
    f.material.color.set(color).multiplyScalar(3);
    f.userData = { life: 0.18, max: 0.18, size };
    f.scale.setScalar(size);
  }

  ring(pos, color, s0, s1, life, opacity = 1) {
    let r = this.rings.find((m) => !m.visible && !m.userData.marker);
    if (!r) {
      const mat = new THREE.MeshBasicMaterial({
        map: ringTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      r = new THREE.Mesh(this.ringGeo, mat);
      r.renderOrder = 4;
      this.parent.add(r);
      this.rings.push(r);
    }
    r.visible = true;
    r.position.set(pos.x, Math.max(0.15, pos.y ?? 0.2), pos.z);
    r.material.color.set(color).multiplyScalar(1.6);
    r.material.opacity = opacity;
    r.userData = { life, max: life, s0, s1, opacity, marker: false };
    r.scale.setScalar(s0);
  }

  /** Cerchio di avviso a terra per gli attacchi ad area dei Kaiju. */
  marker(pos, radius, color = '#ff3030') {
    const mat = new THREE.MeshBasicMaterial({
      map: ringTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      color: new THREE.Color(color).multiplyScalar(1.5),
    });
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.position.set(pos.x, 0.3, pos.z);
    m.scale.setScalar(radius * 2);
    m.renderOrder = 4;
    m.userData = { marker: true, t: 0 };
    this.parent.add(m);
    this.markers.add(m);
    return m;
  }

  removeMarker(m) {
    if (!m) return;
    this.markers.delete(m);
    this.parent.remove(m);
    m.material.dispose();
  }

  update(dt) {
    this.glow.update(dt);
    this.smoke.update(dt);
    for (const r of this.rings) {
      if (!r.visible) continue;
      const u = r.userData;
      u.life -= dt;
      if (u.life <= 0) {
        r.visible = false;
        continue;
      }
      const k = 1 - u.life / u.max;
      r.scale.setScalar(u.s0 + (u.s1 - u.s0) * (1 - Math.pow(1 - k, 2)));
      r.material.opacity = u.opacity * (1 - k);
    }
    for (const f of this.flashes) {
      if (!f.visible) continue;
      const u = f.userData;
      u.life -= dt;
      if (u.life <= 0) {
        f.visible = false;
        continue;
      }
      const k = u.life / u.max;
      f.material.opacity = k;
      f.scale.setScalar(u.size * (1.4 - k * 0.4));
    }
    for (const m of this.markers) {
      m.userData.t += dt;
      m.material.opacity = 0.5 + 0.5 * Math.sin(m.userData.t * 18);
    }
  }

  clear() {
    this.glow.clear();
    this.smoke.clear();
    this.rings.forEach((r) => (r.visible = false));
    this.flashes.forEach((f) => (f.visible = false));
    for (const m of [...this.markers]) this.removeMarker(m);
  }

  dispose() {
    this.clear();
    this.glow.dispose();
    this.smoke.dispose();
    this.rings.forEach((r) => {
      this.parent.remove(r);
      r.material.dispose();
    });
    this.flashes.forEach((f) => {
      this.parent.remove(f);
      f.material.dispose();
    });
    this.ringGeo.dispose();
  }
}
