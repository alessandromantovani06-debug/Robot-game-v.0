import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cityTextures, glowTexture } from './textures.js';

const NOISE_GLSL = /* glsl */ `
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i), b = hash(i+vec2(1.0,0.0)), c = hash(i+vec2(0.0,1.0)), d = hash(i+vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}
float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
`;

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export class Environment {
  constructor(scene, preset, quality) {
    this.scene = scene;
    this.preset = preset;
    this.quality = quality;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.time = 0;
    this.flash = 0;
    this.nextLightning = 4 + Math.random() * 6;
    this.onThunder = null;

    const fogColor = new THREE.Color(preset.fog);
    scene.fog = new THREE.FogExp2(fogColor, preset.fogDensity);
    scene.background = fogColor.clone();

    this._lights();
    this._sky();
    this._ocean();
    if (preset.city > 0) this._city();
    if (preset.wall) this._wall();
    if (preset.bridge) this._bridge();
    if (preset.rift) this._rift();
    if (preset.searchlights > 0 && quality.level !== 'low') this._searchlights();
    if (preset.rain > 0) this._rain();
    if (preset.snow) this._snow();
    this._bolt();
  }

  _lights() {
    const p = this.preset;
    this.hemi = new THREE.HemisphereLight('#8aa0d8', '#0a0c12', p.ambient * 1.6);
    this.group.add(this.hemi);
    this.hemiBase = p.ambient * 1.6;

    const moon = new THREE.DirectionalLight('#a8bcff', p.moon * 2.2);
    moon.position.set(-40, 90, -50);
    moon.target.position.set(0, 0, 0);
    this.group.add(moon, moon.target);
    this.moon = moon;
    if (this.quality.shadows) {
      moon.castShadow = true;
      moon.shadow.mapSize.set(2048, 2048);
      const c = moon.shadow.camera;
      c.left = -30;
      c.right = 30;
      c.top = 30;
      c.bottom = -30;
      c.near = 10;
      c.far = 250;
      moon.shadow.bias = -0.0005;
      moon.shadow.normalBias = 0.04;
    }

    // luce calda della citta' che crea un contorno sui robot
    const rim = new THREE.DirectionalLight(p.city > 0 ? '#ffc49a' : '#46e8ff', 0.9);
    rim.position.set(30, 25, 80);
    this.group.add(rim);
    const fill = new THREE.DirectionalLight('#5d7bd6', 0.6);
    fill.position.set(60, 20, -40);
    this.group.add(fill);
  }

  _sky() {
    const p = this.preset;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        top: { value: new THREE.Color(p.skyTop) },
        bottom: { value: new THREE.Color(p.skyBottom) },
        horizon: { value: new THREE.Color(p.horizon) },
        fogColor: { value: new THREE.Color(p.fog) },
        time: { value: 0 },
        flash: { value: 0 },
        clouds: { value: p.snow ? 0.6 : 0.9 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = pos.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 bottom; uniform vec3 horizon; uniform vec3 fogColor;
        uniform float time; uniform float flash; uniform float clouds;
        varying vec3 vDir;
        ${NOISE_GLSL}
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(bottom, top, smoothstep(0.0, 0.55, h));
          col = mix(col, horizon, exp(-max(h,0.0)*9.0)*0.75);
          vec2 uv = d.xz / (max(h,0.0) + 0.12) * 1.2;
          float c = fbm(uv + vec2(time*0.012, time*0.004));
          float c2 = fbm(uv*2.3 - vec2(time*0.02, 0.0));
          float cloud = smoothstep(0.35, 0.85, c*0.7 + c2*0.4) * clouds;
          vec3 cloudCol = mix(bottom*1.4, horizon*0.9, 0.35) + vec3(0.015,0.018,0.03);
          col = mix(col, cloudCol, cloud*smoothstep(-0.02, 0.2, h));
          col += flash * vec3(0.55,0.6,0.8) * (0.25 + cloud*1.4) * smoothstep(-0.05, 0.25, h);
          col = mix(col, fogColor, exp(-max(h,0.0)*14.0)*0.85);
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    this.group.add(sky);
  }

  _ocean() {
    const p = this.preset;
    const seg = this.quality.level === 'low' ? 60 : 140;
    const geo = new THREE.PlaneGeometry(1600, 1600, seg, seg);
    geo.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        waterColor: { value: new THREE.Color(p.water) },
        skyColor: { value: new THREE.Color(p.skyBottom) },
        horizonColor: { value: new THREE.Color(p.horizon) },
        fogColor: { value: new THREE.Color(p.fog) },
        fogDensity: { value: p.fogDensity },
        moonDir: { value: new THREE.Vector3(-0.4, 0.5, -0.6).normalize() },
        moon: { value: p.moon },
        flash: { value: 0 },
        rain: { value: p.rain },
        riftPos: { value: new THREE.Vector3(0, 0, 140) },
        riftStrength: { value: p.rift ? 1 : 0 },
        riftColor: { value: new THREE.Color('#2ee6ff') },
        cityGlow: { value: new THREE.Color(p.city > 0 ? p.horizon : '#000000') },
      },
      vertexShader: /* glsl */ `
        uniform float time;
        varying vec3 vWorld;
        float waves(vec2 p, float t){
          float h = 0.0;
          h += sin(dot(p, vec2(0.08, 0.05)) + t*0.9) * 0.22;
          h += sin(dot(p, vec2(-0.06, 0.11)) + t*1.3) * 0.16;
          h += sin(dot(p, vec2(0.17, -0.13)) + t*2.1) * 0.06;
          return h;
        }
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float dist = length(wp.xz - cameraPosition.xz);
          wp.y += waves(wp.xz, time) * clamp(1.2 - dist/400.0, 0.0, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        uniform float time; uniform vec3 waterColor; uniform vec3 skyColor; uniform vec3 horizonColor;
        uniform vec3 fogColor; uniform float fogDensity; uniform vec3 moonDir; uniform float moon;
        uniform float flash; uniform float rain; uniform vec3 riftPos; uniform float riftStrength; uniform vec3 riftColor;
        uniform vec3 cityGlow;
        varying vec3 vWorld;
        ${NOISE_GLSL}
        vec2 grad(vec2 p, float t){
          vec2 g = vec2(0.0);
          g += cos(dot(p, vec2(0.08, 0.05)) + t*0.9) * 0.22 * vec2(0.08, 0.05);
          g += cos(dot(p, vec2(-0.06, 0.11)) + t*1.3) * 0.16 * vec2(-0.06, 0.11);
          g += cos(dot(p, vec2(0.17, -0.13)) + t*2.1) * 0.06 * vec2(0.17, -0.13);
          return g;
        }
        void main(){
          vec2 g = grad(vWorld.xz, time);
          float n1 = noise(vWorld.xz*0.35 + vec2(time*0.4, time*0.25));
          float n2 = noise(vWorld.xz*1.3 - vec2(time*0.7, -time*0.5));
          float rr = noise(vWorld.xz*3.5 + time*3.0);
          vec2 detail = vec2(n1 - 0.5, n2 - 0.5) * 0.22 + vec2(rr - 0.5) * 0.12 * rain;
          vec3 N = normalize(vec3(-g.x - detail.x, 1.0, -g.y - detail.y));
          vec3 V = normalize(cameraPosition - vWorld);
          vec3 R = reflect(-V, N);
          float fres = pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 4.0);
          vec3 refl = mix(horizonColor*0.55, skyColor*0.8, clamp(R.y*2.5, 0.0, 1.0));
          refl += cityGlow * 0.12 * pow(1.0 - clamp(R.y,0.0,1.0), 8.0);
          vec3 col = mix(waterColor, refl, fres*0.7 + 0.04);
          float sparkle = pow(max(n2 - 0.55, 0.0) * 2.2, 3.0) * fres;
          col += vec3(0.5, 0.6, 0.8) * sparkle * 0.25;
          float spec = pow(max(dot(R, moonDir), 0.0), 180.0) * moon * 2.5;
          col += vec3(0.75, 0.82, 1.0) * spec;
          col += flash * fres * vec3(0.6, 0.65, 0.85);
          if (riftStrength > 0.0) {
            vec2 rp = vWorld.xz - riftPos.xz;
            float rd = length(rp);
            float ang = atan(rp.y, rp.x);
            float swirl = sin(ang*5.0 + rd*0.12 - time*1.5)*0.5 + 0.5;
            float glow = exp(-rd/45.0) * (0.55 + 0.45*swirl) + exp(-rd/12.0)*1.5;
            col += riftColor * glow * riftStrength * (0.9 + 0.1*sin(time*3.0));
          }
          float d = length(vWorld - cameraPosition);
          float f = 1.0 - exp(-fogDensity*fogDensity*d*d);
          col = mix(col, fogColor, clamp(f, 0.0, 1.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const water = new THREE.Mesh(geo, this.waterMat);
    water.receiveShadow = false;
    this.group.add(water);
    this.water = water;
  }

  _city() {
    const p = this.preset;
    const rand = seeded(1234 + Math.round(p.fogDensity * 1e5));
    const tex = cityTextures(p.windows, Math.round(p.cityDist));
    const count = Math.round((this.quality.level === 'low' ? 160 : 320) * p.city);
    const geos = [];
    const tops = [];
    const neonSpots = [];
    // scala: il Titano e' alto ~9.4 unita' (~80 m), quindi 1 unita' ~ 8.5 m
    for (let i = 0; i < count; i++) {
      // arco di 250 gradi: lascia un'apertura sull'oceano aperto
      const a = -Math.PI * 0.69 + rand() * Math.PI * 1.38 + Math.PI / 2;
      const ring = rand();
      const r = p.cityDist + ring * ring * 220 + rand() * 8;
      const w = 3 + rand() * 5;
      const d = 3 + rand() * 5;
      let h = 3 + Math.pow(rand(), 2.4) * 22 + ring * 10;
      if (rand() > 0.93) h += 14 + rand() * 20;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const g = new THREE.BoxGeometry(w, h, d);
      const uv = g.attributes.uv;
      const ox = Math.floor(rand() * 8) / 8;
      const oy = Math.floor(rand() * 4) / 4;
      for (let k = 0; k < uv.count; k++) {
        const face = Math.floor(k / 4);
        const horiz = face === 2 || face === 3;
        const sx = ((face < 2 ? d : w) * 2.6) / 16;
        uv.setXY(k, horiz ? 0.01 : uv.getX(k) * sx + ox, horiz ? 0.01 : uv.getY(k) * ((h * 2.6) / 64) + oy);
      }
      g.rotateY(-a + Math.PI / 2 + (rand() - 0.5) * 0.3);
      g.translate(x, h / 2 - 1, z);
      geos.push(g);
      if (h > 22) tops.push(x, h - 0.5, z);
      if (rand() > 0.8 && r < p.cityDist + 70 && h > 8) neonSpots.push({ x, z, a, h, w });
    }
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    const mat = new THREE.MeshLambertMaterial({
      map: tex.map,
      emissiveMap: tex.emissive,
      emissive: new THREE.Color('#ffffff'),
      emissiveIntensity: 1.25,
      color: '#9aa3b5',
    });
    const city = new THREE.Mesh(merged, mat);
    this.group.add(city);

    // terraferma sotto gli edifici
    const land = new THREE.Mesh(
      new THREE.RingGeometry(p.cityDist - 6, p.cityDist + 260, 48, 1, Math.PI / 2 - Math.PI * 0.72, Math.PI * 1.44),
      new THREE.MeshLambertMaterial({ color: '#07090d' }),
    );
    land.rotation.x = -Math.PI / 2;
    land.position.y = 0.6;
    this.group.add(land);

    // luci rosse di segnalazione sui tetti
    if (tops.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(tops, 3));
      this.beaconMat = new THREE.PointsMaterial({
        color: new THREE.Color('#ff2a2a').multiplyScalar(3),
        size: 1.6,
        map: glowTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      this.group.add(new THREE.Points(g, this.beaconMat));
    }

    // insegne al neon
    const neonGeo = new THREE.PlaneGeometry(1, 1);
    for (const s of neonSpots) {
      const col = new THREE.Color(p.neon[Math.floor(Math.random() * p.neon.length)]);
      const m = new THREE.MeshBasicMaterial({ color: col.multiplyScalar(2.2), toneMapped: false, side: THREE.DoubleSide, fog: true });
      const sign = new THREE.Mesh(neonGeo, m);
      const vertical = Math.random() > 0.5;
      sign.scale.set(vertical ? 0.7 : s.w * 0.6, vertical ? 3 + Math.random() * 3 : 0.9 + Math.random() * 0.6, 1);
      const inward = new THREE.Vector3(-Math.cos(s.a), 0, -Math.sin(s.a));
      sign.position.set(s.x + inward.x * 4.5, 2 + Math.random() * Math.max(1, s.h - 6), s.z + inward.z * 4.5);
      sign.lookAt(0, sign.position.y, 0);
      this.group.add(sign);
    }
  }

  _wall() {
    const p = this.preset;
    const r = p.cityDist - 14;
    const mat = new THREE.MeshStandardMaterial({ color: '#59606a', roughness: 0.85, metalness: 0.2 });
    const segs = 34;
    const lights = [];
    for (let i = 0; i < segs; i++) {
      const a = Math.PI / 2 - Math.PI * 0.6 + (i / (segs - 1)) * Math.PI * 1.2;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(18, 15, 3), mat);
      seg.position.set(Math.cos(a) * r, 6.5, Math.sin(a) * r);
      seg.lookAt(0, 6.5, 0);
      this.group.add(seg);
      lights.push(Math.cos(a) * (r - 2), 14.3, Math.sin(a) * (r - 2));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(lights, 3));
    const pm = new THREE.PointsMaterial({
      color: new THREE.Color('#ffd27a').multiplyScalar(2.5),
      size: 2,
      map: glowTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.group.add(new THREE.Points(g, pm));
  }

  _bridge() {
    const mat = new THREE.MeshStandardMaterial({ color: '#a8402a', roughness: 0.6, metalness: 0.4 });
    const g = new THREE.Group();
    for (const x of [-60, 60]) {
      for (const z of [-4, 4]) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(3, 90, 3), mat);
        t.position.set(x, 43, z);
        g.add(t);
      }
      const cross = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 11), mat);
      cross.position.set(x, 80, 0);
      g.add(cross);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(260, 3, 12), mat);
    deck.position.y = 22;
    g.add(deck);
    const pts = [];
    for (const z of [-4, 4]) {
      for (let i = 0; i <= 40; i++) {
        const x = -130 + (i / 40) * 260;
        let y;
        if (Math.abs(x) <= 60) y = 26 + (Math.pow(x / 60, 2) * 62);
        else y = 88 - ((Math.abs(x) - 60) / 70) * 64;
        pts.push(new THREE.Vector3(x, y, z));
      }
    }
    const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color('#ffb070').multiplyScalar(1.5), toneMapped: false });
    for (let k = 0; k < 2; k++) {
      const geo = new THREE.BufferGeometry().setFromPoints(pts.slice(k * 41, k * 41 + 41));
      g.add(new THREE.Line(geo, lineMat));
    }
    g.scale.setScalar(0.38);
    g.position.set(-125, 0, 30);
    g.rotation.y = Math.PI / 2 - 0.3;
    this.group.add(g);
  }

  _rift() {
    // bagliore della Frattura sul fondale
    const mat = new THREE.SpriteMaterial({
      map: glowTexture(),
      color: new THREE.Color('#2ee6ff').multiplyScalar(2),
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(160, 50, 1);
    s.position.set(0, 4, 140);
    this.group.add(s);
    this.riftSprite = s;
    // piattaforme petrolifere in lontananza
    const rigMat = new THREE.MeshStandardMaterial({ color: '#3a3f47', roughness: 0.7, metalness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.6;
      const r = 150 + i * 30;
      const rig = new THREE.Group();
      for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 30), rigMat);
        leg.position.set(x, 15, z);
        rig.add(leg);
      }
      const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 4, 18), rigMat);
      deck.position.y = 31;
      rig.add(deck);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1, 3, 25, 4), rigMat);
      tower.position.set(3, 45, 3);
      rig.add(tower);
      rig.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      this.group.add(rig);
    }
  }

  _searchlights() {
    const p = this.preset;
    const mat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color('#bcd4ff') } },
      vertexShader: /* glsl */ `
        varying float vY;
        void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 color; varying float vY;
        void main(){ float a = pow(clamp(1.0 - vY, 0.0, 1.0), 1.6) * 0.16; gl_FragColor = vec4(color * a, a); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const geo = new THREE.CylinderGeometry(9, 0.8, 260, 16, 1, true);
    geo.translate(0, 130, 0); // uv.y = 0 alla base del fascio
    this.beams = [];
    for (let i = 0; i < p.searchlights; i++) {
      const a = Math.PI / 2 - 1.1 + (i / Math.max(1, p.searchlights - 1)) * 2.2;
      const r = p.cityDist + 10 + Math.random() * 40;
      const beam = new THREE.Mesh(geo, mat);
      beam.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      beam.userData = { phase: Math.random() * 10, speed: 0.15 + Math.random() * 0.2 };
      this.group.add(beam);
      this.beams.push(beam);
    }
  }

  _rain() {
    const count = Math.round(this.quality.rain * this.preset.rain);
    if (count <= 0) return;
    const seeds = new Float32Array(count * 2 * 3);
    const ends = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const sx = Math.random();
      const sy = Math.random();
      const sz = Math.random();
      for (let k = 0; k < 2; k++) {
        seeds.set([sx, sy, sz], (i * 2 + k) * 3);
        ends[i * 2 + k] = k;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
    this.rainMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        camPos: { value: new THREE.Vector3() },
        color: { value: new THREE.Color('#9fb6d8') },
        flash: { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform float time; uniform vec3 camPos;
        attribute float aEnd;
        varying float vA;
        void main(){
          float area = 70.0; float height = 45.0;
          vec3 p;
          p.x = camPos.x + (fract(position.x - camPos.x/area) - 0.5) * area;
          p.z = camPos.z + (fract(position.z - camPos.z/area) - 0.5) * area;
          float y = fract(position.y - time*1.15 - position.x*0.3) * height;
          p.y = y - 2.0 + aEnd * 1.6;
          p.x += aEnd * 0.35;
          vA = aEnd;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 color; uniform float flash; varying float vA;
        void main(){ float a = (1.0 - vA) * 0.45; gl_FragColor = vec4(color * (1.0 + flash*2.0), a); }`,
      transparent: true,
      depthWrite: false,
    });
    const rain = new THREE.LineSegments(g, this.rainMat);
    rain.frustumCulled = false;
    this.group.add(rain);
  }

  _snow() {
    const count = Math.round(this.quality.rain * 0.8);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = Math.random();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snowMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        camPos: { value: new THREE.Vector3() },
        map: { value: glowTexture() },
        scale: { value: window.innerHeight / 2 },
      },
      vertexShader: /* glsl */ `
        uniform float time; uniform vec3 camPos; uniform float scale;
        void main(){
          float area = 70.0; float height = 40.0;
          vec3 p;
          float t = time;
          p.x = camPos.x + (fract(position.x - camPos.x/area + sin(t*0.5 + position.y*30.0)*0.01 + t*0.012) - 0.5) * area;
          p.z = camPos.z + (fract(position.z - camPos.z/area + cos(t*0.4 + position.x*30.0)*0.01) - 0.5) * area;
          p.y = fract(position.y - t*0.09) * height - 2.0;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_PointSize = scale * 0.07 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vec3(0.9,0.95,1.0), c.a*0.8); }`,
      transparent: true,
      depthWrite: false,
    });
    const snow = new THREE.Points(g, this.snowMat);
    snow.frustumCulled = false;
    this.group.add(snow);
  }

  _bolt() {
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color('#d8e4ff').multiplyScalar(3),
      transparent: true,
      opacity: 0,
      toneMapped: false,
      fog: false,
    });
    this.boltGeo = new THREE.BufferGeometry();
    this.boltGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(60 * 3), 3));
    this.bolt = new THREE.LineSegments(this.boltGeo, mat);
    this.bolt.frustumCulled = false;
    this.group.add(this.bolt);
  }

  _strike() {
    const a = Math.random() * Math.PI * 2;
    const r = 180 + Math.random() * 200;
    let x = Math.cos(a) * r;
    let z = Math.sin(a) * r;
    let y = 260;
    const pts = [];
    for (let i = 0; i < 30 && y > 0; i++) {
      const nx = x + (Math.random() - 0.5) * 30;
      const nz = z + (Math.random() - 0.5) * 30;
      const ny = y - 8 - Math.random() * 14;
      pts.push(x, y, z, nx, ny, nz);
      x = nx;
      y = ny;
      z = nz;
    }
    const arr = this.boltGeo.attributes.position.array;
    arr.fill(0);
    arr.set(pts.slice(0, arr.length));
    this.boltGeo.attributes.position.needsUpdate = true;
    this.boltGeo.setDrawRange(0, pts.length / 3);
    this.bolt.material.opacity = 1;
    this.flash = 1;
    const dist = r / 340;
    if (this.onThunder) this.onThunder(dist);
  }

  /** Forza un fulmine (usato nei momenti drammatici). */
  lightning() {
    this._strike();
  }

  update(dt, camera, focus) {
    this.time += dt;
    const t = this.time;
    const p = this.preset;
    this.skyMat.uniforms.time.value = t;
    this.waterMat.uniforms.time.value = t;

    if (p.lightning > 0) {
      this.nextLightning -= dt;
      if (this.nextLightning <= 0) {
        this._strike();
        this.nextLightning = (3 + Math.random() * 10) / p.lightning;
      }
    }
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 3.2);
      const f = this.flash * (0.6 + 0.4 * Math.sin(t * 60));
      this.skyMat.uniforms.flash.value = f;
      this.waterMat.uniforms.flash.value = f * 0.6;
      this.hemi.intensity = this.hemiBase + f * 2.5;
      this.bolt.material.opacity = Math.max(0, this.flash * 1.4 - 0.4);
      if (this.rainMat) this.rainMat.uniforms.flash.value = f;
    }

    if (this.rainMat) {
      this.rainMat.uniforms.time.value = t;
      this.rainMat.uniforms.camPos.value.copy(camera.position);
    }
    if (this.snowMat) {
      this.snowMat.uniforms.time.value = t;
      this.snowMat.uniforms.camPos.value.copy(camera.position);
    }
    if (this.beaconMat) this.beaconMat.opacity = Math.sin(t * 2.5) > 0.2 ? 1 : 0.15;
    if (this.beams) {
      for (const b of this.beams) {
        const u = b.userData;
        b.rotation.z = Math.sin(t * u.speed + u.phase) * 0.45;
        b.rotation.x = -0.35 + Math.cos(t * u.speed * 0.7 + u.phase) * 0.25;
      }
    }
    if (this.riftSprite) {
      const s = 1 + Math.sin(t * 2) * 0.06;
      this.riftSprite.scale.set(160 * s, 50 * s, 1);
    }
    if (this.moon.castShadow && focus) {
      this.moon.position.set(focus.x - 40, 90, focus.z - 50);
      this.moon.target.position.copy(focus);
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
    this.scene.fog = null;
  }
}
