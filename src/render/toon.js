// Stile anime: ombreggiatura a toni netti (cel shading), riflesso a gradino,
// luce di contorno e linee nere attorno alle sagome (contorno a "scafo rovesciato").
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Valori condivisi da tutti i contorni: risoluzione del canvas in pixel reali. */
export const toonShared = {
  resolution: { value: new THREE.Vector2(1280, 720) },
  pixelRatio: { value: 1 },
};

export function setToonResolution(width, height, pixelRatio) {
  toonShared.resolution.value.set(width * pixelRatio, height * pixelRatio);
  toonShared.pixelRatio.value = pixelRatio;
}

// tre toni (ombra, mezzo tono, luce) con bordi antialiasing
const GRADIENT = /* glsl */ `
uniform float uToneDark;
uniform float uToneMid;
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
  float x = dot( normal, lightDirection ) * 0.5 + 0.5;
  float fw = fwidth( x ) * 0.75 + 0.002;
  float a = smoothstep( 0.46 - fw, 0.46 + fw, x );
  float b = smoothstep( 0.68 - fw, 0.68 + fw, x );
  return vec3( mix( mix( uToneDark, uToneMid, a ), 1.0, b ) );
}
`;

const EXTRA = /* glsl */ `
{
  vec3 toonView = normalize( vViewPosition );
  #if NUM_DIR_LIGHTS > 0
    vec3 toonH = normalize( directionalLights[ 0 ].direction + toonView );
    float toonNH = max( dot( normal, toonH ), 0.0 );
    float toonFw = fwidth( toonNH ) + 0.002;
    float toonSpec = smoothstep( 0.955 - toonFw, 0.955 + toonFw, toonNH );
    outgoingLight += directionalLights[ 0 ].color * toonSpec * uSpec * 0.3;
  #endif
  float toonNV = 1.0 - max( dot( normal, toonView ), 0.0 );
  float toonFr = fwidth( toonNV ) + 0.002;
  outgoingLight += uRimColor * diffuseColor.rgb * smoothstep( 0.64 - toonFr, 0.64 + toonFr, toonNV ) * uRim;
  // lampo dei colpi subiti
  outgoingLight = mix( outgoingLight, uFlashColor, uFlash );
}
`;

/**
 * Materiale in stile cartone animato.
 * spec = forza del riflesso a gradino (finitura), rim = luce di contorno.
 */
export function toonMaterial({
  color = '#ffffff',
  vertexColors = false,
  map = null,
  emissive = '#000000',
  spec = 0.5,
  rim = 0.28,
  rimColor = '#a8c8ff',
  dark = 0.42,
  mid = 0.74,
  side = THREE.FrontSide,
  transparent = false,
  opacity = 1,
} = {}) {
  const m = new THREE.MeshToonMaterial({ color, vertexColors, map, emissive, side, transparent, opacity });
  const uniforms = {
    uSpec: { value: spec },
    uRim: { value: rim },
    uRimColor: { value: new THREE.Color(rimColor) },
    uToneDark: { value: dark },
    uToneMid: { value: mid },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color('#ffffff') },
  };
  m.userData.toon = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <gradientmap_pars_fragment>', GRADIENT + '\nuniform float uSpec;\nuniform float uRim;\nuniform vec3 uRimColor;\nuniform float uFlash;\nuniform vec3 uFlashColor;')
      .replace('#include <opaque_fragment>', EXTRA + '\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'rt-toon-2';
  return m;
}

// ---------------------------------------------------------------- contorni
const OUTLINE_VS = /* glsl */ `
attribute vec3 outlineNormal;
uniform float uThickness;
uniform float uMinPx;
uniform float uMaxPx;
uniform vec2 uResolution;
uniform float uPixelRatio;
#include <common>
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  vec4 clip = projectionMatrix * mvPosition;
  vec3 n = normalize( normalMatrix * outlineNormal );
  vec2 dir = ( projectionMatrix * vec4( n, 0.0 ) ).xy;
  float len = length( dir );
  dir = len > 1e-5 ? dir / len : vec2( 0.0 );
  float w = max( clip.w, 1e-3 );
  // spessore in pixel di uThickness unita' a questa distanza, limitato tra min e max
  float px = uThickness * projectionMatrix[ 1 ][ 1 ] * uResolution.y * 0.5 / w;
  px = clamp( px, uMinPx * uPixelRatio, uMaxPx * uPixelRatio );
  clip.xy += dir * px * 2.0 / uResolution * w;
  gl_Position = clip;
  #include <fog_vertex>
}
`;

const OUTLINE_FS = /* glsl */ `
uniform vec3 uColor;
#include <common>
#include <fog_pars_fragment>
void main() {
  gl_FragColor = vec4( uColor, 1.0 );
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export function outlineMaterial({ color = '#07080c', thickness = 0.045, minPx = 0.7, maxPx = 2.6 } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uColor: { value: new THREE.Color(color) },
        uThickness: { value: thickness },
        uMinPx: { value: minPx },
        uMaxPx: { value: maxPx },
      },
    ]),
    vertexShader: OUTLINE_VS,
    fragmentShader: OUTLINE_FS,
    side: THREE.BackSide,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 2,
  });
  // risoluzione condivisa (aggiornata al ridimensionamento della finestra)
  mat.uniforms.uResolution = toonShared.resolution;
  mat.uniforms.uPixelRatio = toonShared.pixelRatio;
  return mat;
}

/** Il contorno usa normali "ammorbidite" cosi' resta continuo anche sugli spigoli vivi. */
export function computeOutlineNormals(geo) {
  if (geo.attributes.outlineNormal) return geo;
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const map = new Map();
  const key = (i) => `${Math.round(pos.getX(i) * 1e3)},${Math.round(pos.getY(i) * 1e3)},${Math.round(pos.getZ(i) * 1e3)}`;
  const keys = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    keys[i] = k;
    let acc = map.get(k);
    if (!acc) map.set(k, (acc = [0, 0, 0]));
    acc[0] += nor.getX(i);
    acc[1] += nor.getY(i);
    acc[2] += nor.getZ(i);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = map.get(keys[i]);
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l;
    out[i * 3 + 1] = a[1] / l;
    out[i * 3 + 2] = a[2] / l;
  }
  geo.setAttribute('outlineNormal', new THREE.BufferAttribute(out, 3));
  return geo;
}

/** Aggiunge il contorno a una mesh (condivide la geometria). */
export function addOutline(mesh, mat) {
  computeOutlineNormals(mesh.geometry);
  const o = new THREE.Mesh(mesh.geometry, mat);
  o.castShadow = false;
  o.receiveShadow = false;
  o.userData.outline = true;
  o.userData.keep = true;
  o.raycast = () => {};
  mesh.add(o);
  return o;
}

// ---------------------------------------------------------------- unione per colore
const _col = new THREE.Color();

function prepare(mesh, color) {
  mesh.updateMatrix();
  let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.applyMatrix4(mesh.matrix);
  // una scala negativa ribalta i triangoli: si ripristina l'ordine corretto
  if (mesh.matrix.determinant() < 0) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const u = g.attributes.uv;
    for (let i = 0; i < p.count; i += 3) {
      for (const a of [p, n, u]) {
        const s = a.itemSize;
        for (let k = 0; k < s; k++) {
          const t = a.array[(i + 1) * s + k];
          a.array[(i + 1) * s + k] = a.array[(i + 2) * s + k];
          a.array[(i + 2) * s + k] = t;
        }
      }
    }
  }
  if (color) {
    _col.set(color);
    const c = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < c.length; i += 3) {
      c[i] = _col.r;
      c[i + 1] = _col.g;
      c[i + 2] = _col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  return g;
}

/**
 * Trasforma le mesh "segnaposto" del costruttore in poche mesh vere:
 * per ogni giunto tutte le corazze diventano una sola mesh a colori per vertice
 * (con contorno), e le parti luminose / decalcomanie una mesh ciascuna.
 * paints: { chiave: colore } ; mats: { armor, outline, [chiave]: materiale }
 */
export function finalizeModel(root, { paints, mats, shadows = false, outline = true, colorOf }) {
  const nodes = [];
  root.traverse((o) => nodes.push(o));
  const created = [];
  for (const node of nodes) {
    const groups = new Map();
    for (const child of [...node.children]) {
      if (!child.isMesh || child.userData.keep || child.children.length) continue;
      const key = child.userData.paint;
      if (!key) continue;
      const isArmor = key in paints;
      const gk = isArmor ? '__armor' : key;
      if (!groups.has(gk)) groups.set(gk, []);
      groups.get(gk).push(child);
    }
    for (const [gk, meshes] of groups) {
      const armor = gk === '__armor';
      const geos = meshes.map((m) => prepare(m, armor ? (colorOf ? colorOf(m) : paints[m.userData.paint]) : null));
      const geo = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      for (const m of meshes) node.remove(m);
      if (!geo) continue;
      const mat = armor ? mats.armor : mats[gk];
      if (!mat) continue;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.merged = true;
      mesh.userData.paint = gk;
      mesh.castShadow = shadows && (armor || gk === 'glow');
      mesh.receiveShadow = shadows && armor;
      node.add(mesh);
      created.push(mesh);
      if (armor && outline && mats.outline) addOutline(mesh, mats.outline);
    }
  }
  return created;
}

export function disposeFinalized(root) {
  root.traverse((o) => {
    if (o.isMesh && o.userData.merged) o.geometry.dispose();
  });
}
