// Pagina di prova per i modelli 3D (solo sviluppo, non inclusa nel gioco).
// ?robot=0..4  ?kaiju=tipo  ?views=front,34,side,back  ?zoom=head|torso|full  ?w= ?h=
import * as THREE from 'three';
import { buildRobot } from '../src/render/robotBuilder.js';
import { setToonResolution } from '../src/render/toon.js';
import { DEFAULT_ROBOT } from '../src/data/parts.js';
import { KaijuFighter } from '../src/game/kaijuFighter.js';

const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 1600);
const H = +(q.get('h') || 900);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);
setToonResolution(W, H, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(q.get('bg') || '#6b7c96');
scene.add(new THREE.HemisphereLight('#b8c8ff', '#2a2622', 1.1));
const key = new THREE.DirectionalLight('#fff4e6', 2.6);
key.position.set(6, 12, 9);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.03;
Object.assign(key.shadow.camera, { left: -8, right: 8, top: 14, bottom: -2, near: 1, far: 40 });
scene.add(key);
const fill = new THREE.DirectionalLight('#6aa8ff', 0.6);
fill.position.set(-8, 4, -6);
scene.add(fill);
const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ color: '#2a3140', roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const configs = [
  { ...DEFAULT_ROBOT, colors: { primary: '#e9edf2', secondary: '#2a4b9a', accent: '#46e8ff' } },
  { ...DEFAULT_ROBOT, chassis: 'ch_scout', head: 'hd_dome', torso: 'tr_plasma', armL: 'wp_rocket', armR: 'wp_chainsword', legs: 'lg_digi', shoulders: 'sh_antenna', pattern: 'hazard', colors: { primary: '#c2343b', secondary: '#6b1d22', accent: '#ff3df5' } },
  { ...DEFAULT_ROBOT, chassis: 'ch_juggernaut', head: 'hd_crest', torso: 'tr_tesla', armL: 'wp_hammer', armR: 'wp_plasma', legs: 'lg_heavy', shoulders: 'sh_plate', pattern: 'camo', colors: { primary: '#4d5a32', secondary: '#c8a03c', accent: '#aaff3c' } },
  { ...DEFAULT_ROBOT, head: 'hd_tri', torso: 'tr_berserk', armL: 'wp_claws', armR: 'wp_claws', legs: 'lg_thrust', shoulders: 'sh_vents', pattern: 'split', colors: { primary: '#e9edf2', secondary: '#1d1f24', accent: '#ff2a55' } },
  { ...DEFAULT_ROBOT, head: 'hd_hunter', torso: 'tr_fission', armL: 'wp_fist', armR: 'wp_plasma', legs: 'lg_std', shoulders: 'sh_missile', pattern: 'none', finish: 'matte', colors: { primary: '#1d1f24', secondary: '#c8a03c', accent: '#ff3a3a' } },
];
const kaijuType = q.get('kaiju');
let model;
let buildMs;
const t0 = performance.now();
if (kaijuType) {
  const k = new KaijuFighter(kaijuType, 1, scene, { shadows: true });
  k.state = 'idle';
  for (let i = 0; i < 40; i++) {
    k.time += 0.05;
    k._animate(0.05, null);
  }
  k.model.root.position.y = 0;
  model = k.model;
  buildMs = performance.now() - t0;
} else {
  const idx = +(q.get('robot') || 0);
  const cfg = configs[idx];
  model = buildRobot(cfg, { shadows: true });
  buildMs = performance.now() - t0;
  scene.add(model.root);
  model.root.position.y = 0.3;
  // posa di guardia leggera
  const j = model.joints;
  j.shL.rotation.set(-0.25, 0, 0.18);
  j.shR.rotation.set(-0.25, 0, -0.18);
  j.elL.rotation.x = -0.9;
  j.elR.rotation.x = -0.9;
  j.hipL.rotation.x = j.hipR.rotation.x = model.rest.hip;
  j.kneeL.rotation.x = j.kneeR.rotation.x = model.rest.knee;
  j.ankleL.rotation.x = j.ankleR.rotation.x = model.rest.ankle;
}
const views = (q.get('views') || 'front,34,side,back').split(',');
const zoom = q.get('zoom') || 'full';
const target = { full: kaijuType ? [0, 6, 32] : [0, 5.2, 20], big: [0, 8, 44], head: [0, 9.2, 4.5], torso: [0, 7.2, 9], legs: [0, 2.4, 10], arm: [1.8, 5.2, 9] }[zoom];
const cols = views.length > 2 ? Math.ceil(views.length / 2) : views.length;
const rows = Math.ceil(views.length / cols);
const cw = W / cols;
const ch = H / rows;
const cam = new THREE.PerspectiveCamera(30, cw / ch, 0.1, 200);
const angles = { front: 0, 34: 0.65, side: Math.PI / 2, back: Math.PI, '34b': 2.4, left: -Math.PI / 2 };
renderer.setScissorTest(true);
let tris = 0;
model.root.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
function renderAll() {
views.forEach((v, i) => {
  const a = angles[v] ?? 0;
  const [ty, dist] = [target[1], target[2]];
  cam.position.set(Math.sin(a) * dist + target[0], ty + (zoom === 'full' ? 1 : 0.4), Math.cos(a) * dist);
  cam.lookAt(target[0], ty, 0);
  const x = (i % cols) * cw;
  const y = H - (Math.floor(i / cols) + 1) * ch;
  renderer.setViewport(x, y, cw, ch);
  renderer.setScissor(x, y, cw, ch);
  renderer.render(scene, cam);
});
}
renderAll();
window.__model = model;
window.__render = renderAll;
let calls = 0;
model.root.traverse((o) => { if (o.isMesh && o.visible !== false) calls++; });
console.log(`build ${buildMs.toFixed(0)}ms, meshes ${calls}, tris ${Math.round(tris)}`);
window.__done = true;
