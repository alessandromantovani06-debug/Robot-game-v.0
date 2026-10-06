import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}

function finish(tex, repeat = true) {
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

const cache = new Map();

/** Texture a pannelli per le corazze del robot (con livrea opzionale). */
export function panelTexture(base, second, pattern = 'none', key = '') {
  const id = `panel|${base}|${second}|${pattern}|${key}`;
  if (cache.has(id)) return cache.get(id);
  const S = 256;
  const [c, g] = canvas(S, S);
  const rand = rng(hashString(id));
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);

  // leggero gradiente per dare profondita'
  const grad = g.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, 'rgba(255,255,255,0.07)');
  grad.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);

  // livrea
  if (pattern === 'stripes') {
    g.fillStyle = second;
    g.fillRect(0, S * 0.1, S, S * 0.045);
    g.globalAlpha = 0.7;
    g.fillRect(0, S * 0.17, S, S * 0.015);
    g.globalAlpha = 1;
  } else if (pattern === 'hazard') {
    g.save();
    g.beginPath();
    g.rect(0, S * 0.78, S, S * 0.16);
    g.clip();
    g.fillStyle = '#e8c21a';
    g.fillRect(0, S * 0.78, S, S * 0.16);
    g.fillStyle = '#16181b';
    for (let x = -S; x < S * 2; x += 36) {
      g.beginPath();
      g.moveTo(x, S * 0.94);
      g.lineTo(x + 18, S * 0.94);
      g.lineTo(x + 18 + 40, S * 0.78);
      g.lineTo(x + 40, S * 0.78);
      g.fill();
    }
    g.restore();
  } else if (pattern === 'camo') {
    const cols = [shade(base, -0.12), shade(base, 0.08), second];
    for (let i = 0; i < 26; i++) {
      g.fillStyle = cols[i % 3];
      g.globalAlpha = 0.85;
      g.beginPath();
      const x = rand() * S;
      const y = rand() * S;
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const r = 14 + rand() * 26;
        g.lineTo(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
  } else if (pattern === 'split') {
    g.fillStyle = second;
    g.beginPath();
    g.moveTo(S * 0.55, 0);
    g.lineTo(S, 0);
    g.lineTo(S, S);
    g.lineTo(S * 0.35, S);
    g.closePath();
    g.fill();
  }

  // linee dei pannelli
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 2;
  g.strokeRect(6, 6, S - 12, S - 12);
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  g.lineWidth = 1;
  g.strokeRect(9, 9, S - 18, S - 18);
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 1.5;
  const splits = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < splits; i++) {
    g.beginPath();
    if (rand() > 0.5) {
      const y = 30 + rand() * (S - 60);
      g.moveTo(8, y);
      g.lineTo(S - 8, y);
    } else {
      const x = 30 + rand() * (S - 60);
      g.moveTo(x, 8);
      g.lineTo(x, S - 8);
    }
    g.stroke();
  }

  // rivetti
  g.fillStyle = 'rgba(0,0,0,0.45)';
  const rivet = (x, y) => {
    g.beginPath();
    g.arc(x, y, 2.4, 0, Math.PI * 2);
    g.fill();
  };
  for (let i = 18; i < S - 10; i += 22) {
    rivet(i, 15);
    rivet(i, S - 15);
  }

  // sporco e colature di pioggia
  for (let i = 0; i < 220; i++) {
    g.fillStyle = `rgba(0,0,0,${rand() * 0.12})`;
    g.fillRect(rand() * S, rand() * S, 1 + rand() * 3, 1 + rand() * 3);
  }
  for (let i = 0; i < 14; i++) {
    const x = rand() * S;
    const y = rand() * S * 0.6;
    const h = 30 + rand() * 90;
    const lg = g.createLinearGradient(0, y, 0, y + h);
    lg.addColorStop(0, 'rgba(0,0,0,0.18)');
    lg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = lg;
    g.fillRect(x, y, 2 + rand() * 3, h);
  }
  // graffi
  g.strokeStyle = 'rgba(255,255,255,0.10)';
  g.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    const x = rand() * S;
    const y = rand() * S;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rand() - 0.5) * 30, y + (rand() - 0.5) * 12);
    g.stroke();
  }

  const tex = finish(new THREE.CanvasTexture(c));
  cache.set(id, tex);
  return tex;
}

/** Texture per le parti meccaniche scure (giunti, telaio). */
export function frameTexture() {
  const id = 'frame';
  if (cache.has(id)) return cache.get(id);
  const S = 128;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#3a3f47';
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 8) {
    g.fillStyle = y % 16 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.06)';
    g.fillRect(0, y, S, 3);
  }
  const rand = rng(77);
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(0,0,0,${rand() * 0.2})`;
    g.fillRect(rand() * S, rand() * S, 2, 2);
  }
  const tex = finish(new THREE.CanvasTexture(c));
  cache.set(id, tex);
  return tex;
}

/** Testo dipinto sulla corazza (sigla del robot). */
export function decalTexture(text, color = '#ffffff') {
  const [c, g] = canvas(256, 128);
  g.clearRect(0, 0, 256, 128);
  g.font = '900 78px Orbitron, Arial Black, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.globalAlpha = 0.92;
  g.fillText(text || '', 128, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Pelle squamosa dei Kaiju + mappa delle venature bioluminescenti. */
export function kaijuTextures(skin, glow, seed = 1) {
  const id = `kaiju|${skin}|${glow}|${seed}`;
  if (cache.has(id)) return cache.get(id);
  const S = 256;
  const rand = rng(seed * 9973 + 17);
  const [c, g] = canvas(S, S);
  g.fillStyle = skin;
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 3 + rand() * 9;
    g.fillStyle = rand() > 0.5 ? shade(skin, -0.05 - rand() * 0.06) : shade(skin, 0.03 + rand() * 0.05);
    g.beginPath();
    g.ellipse(x, y, r, r * 0.7, rand() * Math.PI, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 1;
    g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.lineWidth = 1 + rand() * 2;
    g.beginPath();
    let x = rand() * S;
    let y = rand() * S;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rand() - 0.5) * 40;
      y += (rand() - 0.5) * 40;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const map = finish(new THREE.CanvasTexture(c));

  const [c2, g2] = canvas(S, S);
  g2.fillStyle = '#000';
  g2.fillRect(0, 0, S, S);
  g2.strokeStyle = '#fff';
  g2.shadowColor = '#fff';
  g2.shadowBlur = 6;
  for (let i = 0; i < 9; i++) {
    g2.lineWidth = 1.5 + rand() * 2.5;
    g2.beginPath();
    let x = rand() * S;
    let y = rand() * S;
    g2.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (rand() - 0.5) * 50;
      y += (rand() - 0.3) * 40;
      g2.lineTo(x, y);
    }
    g2.stroke();
  }
  g2.fillStyle = '#fff';
  for (let i = 0; i < 36; i++) {
    g2.globalAlpha = 0.5 + rand() * 0.5;
    g2.beginPath();
    g2.arc(rand() * S, rand() * S, 1.5 + rand() * 3.5, 0, Math.PI * 2);
    g2.fill();
  }
  const emissive = finish(new THREE.CanvasTexture(c2));
  emissive.colorSpace = THREE.SRGBColorSpace;
  const res = { map, emissive };
  cache.set(id, res);
  return res;
}

/** Facciate dei grattacieli con finestre illuminate. */
export function cityTextures(windowTint, seed = 3) {
  const id = `city|${windowTint}|${seed}`;
  if (cache.has(id)) return cache.get(id);
  const W = 256;
  const H = 512;
  const rand = rng(seed);
  const [c, g] = canvas(W, H);
  const [c2, g2] = canvas(W, H);
  g.fillStyle = '#0d1016';
  g.fillRect(0, 0, W, H);
  g2.fillStyle = '#000';
  g2.fillRect(0, 0, W, H);
  const cols = 16;
  const rows = 64;
  const cw = W / cols;
  const rh = H / rows;
  const tint = new THREE.Color(windowTint);
  for (let y = 0; y < rows; y++) {
    const floorLit = rand() > 0.15;
    for (let x = 0; x < cols; x++) {
      const px = x * cw + 2;
      const py = y * rh + 2;
      g.fillStyle = '#161b24';
      g.fillRect(px, py, cw - 4, rh - 3);
      if (floorLit && rand() > 0.62) {
        const k = 0.45 + rand() * 0.55;
        const tc = tint.clone().offsetHSL((rand() - 0.5) * 0.06, 0, (rand() - 0.5) * 0.15);
        const col = `rgb(${Math.round(tc.r * 255 * k)},${Math.round(tc.g * 255 * k)},${Math.round(tc.b * 255 * k)})`;
        g.fillStyle = col;
        g.fillRect(px, py, cw - 4, rh - 3);
        g2.fillStyle = col;
        g2.fillRect(px, py, cw - 4, rh - 3);
      }
    }
  }
  const map = finish(new THREE.CanvasTexture(c));
  const emissive = finish(new THREE.CanvasTexture(c2));
  const res = { map, emissive };
  cache.set(id, res);
  return res;
}

/** Sprite morbido per particelle e bagliori. */
export function glowTexture() {
  if (cache.has('glow')) return cache.get('glow');
  const S = 64;
  const [c, g] = canvas(S, S);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  cache.set('glow', tex);
  return tex;
}

/** Anello per onde d'urto e increspature dell'acqua. */
export function ringTexture() {
  if (cache.has('ring')) return cache.get('ring');
  const S = 128;
  const [c, g] = canvas(S, S);
  const grad = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.85, 'rgba(255,255,255,0.4)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  cache.set('ring', tex);
  return tex;
}

/** Pavimento dell'hangar con griglia e segnaletica. */
export function hangarFloorTexture() {
  if (cache.has('floor')) return cache.get('floor');
  const S = 512;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#1a1d22';
  g.fillRect(0, 0, S, S);
  const rand = rng(5);
  for (let i = 0; i < 3000; i++) {
    g.fillStyle = `rgba(${rand() > 0.5 ? '255,255,255' : '0,0,0'},${rand() * 0.05})`;
    g.fillRect(rand() * S, rand() * S, 2, 2);
  }
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 3;
  for (let i = 0; i <= S; i += 64) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, S);
    g.moveTo(0, i);
    g.lineTo(S, i);
    g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,0.05)';
  g.lineWidth = 1;
  for (let i = 2; i <= S; i += 64) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, S);
    g.moveTo(0, i);
    g.lineTo(S, i);
    g.stroke();
  }
  const tex = finish(new THREE.CanvasTexture(c));
  cache.set('floor', tex);
  return tex;
}

export { shade, hashString };
