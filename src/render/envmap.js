import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Mappe d'ambiente per i riflessi delle superfici metalliche dei Titani.
const cache = new Map();

/** Riflessi notturni: cielo scuro, bagliore della citta' all'orizzonte, luci sparse. */
export function nightEnvMap(renderer, preset) {
  const key = 'night|' + preset.skyTop + preset.horizon + preset.city;
  if (cache.has(key)) return cache.get(key);
  const scene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        top: { value: new THREE.Color(preset.skyTop).multiplyScalar(2.5) },
        mid: { value: new THREE.Color(preset.skyBottom).multiplyScalar(2.2) },
        horizon: { value: new THREE.Color(preset.horizon).multiplyScalar(2.6) },
        ground: { value: new THREE.Color(preset.water).multiplyScalar(1.5) },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 ground; varying vec3 vP;
        void main(){
          float h = vP.y;
          vec3 c = h > 0.0 ? mix(horizon, mix(mid, top, smoothstep(0.2, 0.9, h)), smoothstep(0.0, 0.25, h)) : mix(horizon*0.6, ground, smoothstep(0.0, -0.2, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(sky);
  // finestre/luci della citta' come piccoli pannelli luminosi
  const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color(preset.windows || '#ffd59a').multiplyScalar(preset.city > 0 ? 3 : 0.6) });
  const cool = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fc8ff').multiplyScalar(2.5) });
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2 + Math.random() * 4, 1 + Math.random() * 4), i % 5 === 0 ? cool : warm);
    m.position.set(Math.cos(a) * 40, -1 + Math.random() * 6, Math.sin(a) * 40);
    m.lookAt(0, 0, 0);
    scene.add(m);
  }
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color('#bcd0ff').multiplyScalar(2.2) }));
  moon.position.set(-20, 38, -22);
  moon.lookAt(0, 0, 0);
  scene.add(moon);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.035).texture;
  pmrem.dispose();
  scene.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  cache.set(key, tex);
  return tex;
}

/** Riflessi da studio per l'hangar. */
export function studioEnvMap(renderer) {
  if (cache.has('studio')) return cache.get('studio');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const tex = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  room.dispose?.();
  cache.set('studio', tex);
  return tex;
}
