// Decalcomanie dei Titani (sigla, emblema, scritte di servizio, strisce di pericolo)
// disegnate in un'unica texture: tutte le scritte di un giunto diventano una sola mesh.
import * as THREE from 'three';

const W = 1024;
const H = 512;

// regioni dell'atlante in pixel: [x0, y0, x1, y1]
export const REGIONS = {
  code: [0, 0, 512, 128],
  emblem: [512, 0, 640, 128],
  caution: [640, 0, 1024, 64],
  hazard: [640, 64, 1024, 128],
  number: [0, 128, 256, 256],
  label: [256, 128, 768, 192],
  label2: [256, 192, 768, 256],
  line: [768, 128, 1024, 140],
  lines: [768, 144, 1024, 172],
  arrow: [768, 176, 896, 256],
  ring: [896, 176, 1024, 256],
  chevron: [0, 256, 256, 384],
  grille: [256, 256, 512, 384],
  dots: [512, 256, 768, 320],
};

const cache = new Map();

function draw(code, accent) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const font = (w, px) => `${w} ${px}px Orbitron, "Arial Black", sans-serif`;
  const R = REGIONS;
  // sigla
  g.save();
  g.font = font(900, 92);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#f4f6f8';
  g.strokeStyle = 'rgba(10,12,16,0.85)';
  g.lineWidth = 8;
  g.strokeText(code || '', 256, 68);
  g.fillText(code || '', 256, 68);
  g.restore();
  // emblema: ali stilizzate attorno a una stella
  g.save();
  g.translate(576, 64);
  g.fillStyle = '#f4f6f8';
  g.strokeStyle = '#0c0e12';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(0, 0, 54, 0, Math.PI * 2);
  g.fillStyle = '#1b2f63';
  g.fill();
  g.stroke();
  g.fillStyle = '#f4f6f8';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * 8, -6);
    g.lineTo(s * 50, -26);
    g.lineTo(s * 44, -12);
    g.lineTo(s * 50, -8);
    g.lineTo(s * 40, 4);
    g.lineTo(s * 44, 10);
    g.lineTo(s * 10, 8);
    g.closePath();
    g.fill();
  }
  g.fillStyle = accent;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 9 : 22;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r + 2);
  }
  g.closePath();
  g.fill();
  g.restore();
  // etichetta di attenzione
  g.fillStyle = '#f1c21b';
  g.fillRect(R.caution[0] + 4, 6, 376, 52);
  g.fillStyle = '#121418';
  g.font = font(900, 34);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('ATTENZIONE', R.caution[0] + 192, 34);
  // strisce di pericolo
  g.save();
  g.beginPath();
  g.rect(R.hazard[0], R.hazard[1], 384, 64);
  g.clip();
  g.fillStyle = '#f1c21b';
  g.fillRect(R.hazard[0], R.hazard[1], 384, 64);
  g.fillStyle = '#121418';
  for (let x = R.hazard[0] - 64; x < R.hazard[2]; x += 48) {
    g.beginPath();
    g.moveTo(x, R.hazard[3]);
    g.lineTo(x + 24, R.hazard[3]);
    g.lineTo(x + 24 + 64, R.hazard[1]);
    g.lineTo(x + 64, R.hazard[1]);
    g.fill();
  }
  g.restore();
  // numero dell'unita'
  const digits = (code || '').replace(/\D/g, '').slice(-2) || '01';
  g.font = font(900, 104);
  g.fillStyle = '#f4f6f8';
  g.strokeStyle = 'rgba(10,12,16,0.9)';
  g.lineWidth = 8;
  g.strokeText(digits, 128, 196);
  g.fillText(digits, 128, 196);
  // scritte di servizio
  g.font = font(700, 30);
  g.fillStyle = '#e8ecf0';
  g.textAlign = 'left';
  g.fillText('RIFT DEFENSE FORCE', R.label[0] + 8, 162);
  g.font = font(700, 26);
  g.fillStyle = '#f1c21b';
  g.fillText('▲ SGANCIO EMERGENZA', R.label2[0] + 8, 226);
  // linee dei pannelli
  g.fillStyle = 'rgba(8,10,14,0.85)';
  g.fillRect(R.line[0], R.line[1] + 3, 256, 6);
  g.fillRect(R.lines[0], R.lines[1] + 3, 256, 6);
  g.fillRect(R.lines[0], R.lines[1] + 19, 256, 6);
  // freccia
  g.fillStyle = '#f1c21b';
  g.beginPath();
  g.moveTo(832, 186);
  g.lineTo(880, 246);
  g.lineTo(784, 246);
  g.closePath();
  g.fill();
  // anello
  g.strokeStyle = '#f4f6f8';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(960, 216, 30, 0, Math.PI * 2);
  g.stroke();
  // galloni
  g.fillStyle = '#f4f6f8';
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    const y = 276 + i * 34;
    g.moveTo(28, y + 28);
    g.lineTo(128, y);
    g.lineTo(228, y + 28);
    g.lineTo(228, y + 44);
    g.lineTo(128, y + 16);
    g.lineTo(28, y + 44);
    g.closePath();
    g.fill();
  }
  // griglia di sfiato
  g.fillStyle = 'rgba(8,10,14,0.9)';
  for (let i = 0; i < 6; i++) g.fillRect(268, 268 + i * 19, 232, 10);
  // puntini (bulloni)
  g.fillStyle = 'rgba(8,10,14,0.75)';
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.arc(540 + i * 40, 288, 8, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function decalAtlas(code, accent = '#46e8ff') {
  const key = `${code}|${accent}`;
  let t = cache.get(key);
  if (!t) {
    t = draw(code, accent);
    cache.set(key, t);
    if (cache.size > 12) {
      const first = cache.keys().next().value;
      cache.get(first).dispose();
      cache.delete(first);
    }
  }
  return t;
}

const geoCache = new Map();
/** Quadrato w x h che mostra una regione dell'atlante. */
export function decalGeo(region, w, h) {
  const key = `${region}|${w}|${h}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.PlaneGeometry(w, h);
    const [x0, y0, x1, y1] = REGIONS[region];
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      uv.setXY(i, (x0 + u * (x1 - x0)) / W, 1 - (y1 - v * (y1 - y0)) / H);
    }
    geoCache.set(key, g);
  }
  return g;
}
