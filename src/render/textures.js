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

function finish(tex, repeat = true) {
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

const cache = new Map();
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


/** Facciate dei grattacieli in stile anime: finestre nitide, piani accesi a gruppi. */
export function facadeTextures(warm = '#ffd59a', seed = 5) {
  const id = `facade|${warm}|${seed}`;
  if (cache.has(id)) return cache.get(id);
  const W = 512;
  const H = 1024;
  const rand = rng(seed);
  const [c, g] = canvas(W, H);
  const [c2, e] = canvas(W, H);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);
  const cols = 16;
  const rows = 64;
  const cw = W / cols;
  const rh = H / rows;
  const warmC = new THREE.Color(warm);
  const tints = [warmC, new THREE.Color('#bfe0ff'), new THREE.Color('#fff3d6'), new THREE.Color('#9fd8ff')];
  for (let y = 0; y < rows; y++) {
    const floorLit = rand();
    const tint = tints[Math.floor(rand() * tints.length)];
    let run = 0;
    for (let x = 0; x < cols; x++) {
      const px = x * cw + 4;
      const py = y * rh + 3;
      // vetro spento
      g.fillStyle = '#3a4560';
      g.fillRect(px, py, cw - 8, rh - 6);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(px, py, cw - 8, 2);
      if (run <= 0 && rand() < (floorLit > 0.55 ? 0.5 : 0.08)) run = 1 + Math.floor(rand() * 6);
      if (run > 0) {
        run--;
        const k = 0.65 + rand() * 0.35;
        const col = `rgb(${Math.round(tint.r * 255 * k)},${Math.round(tint.g * 255 * k)},${Math.round(tint.b * 255 * k)})`;
        g.fillStyle = col;
        g.fillRect(px, py, cw - 8, rh - 6);
        e.fillStyle = col;
        e.fillRect(px, py, cw - 8, rh - 6);
        // tende abbassate
        if (rand() < 0.3) {
          g.fillStyle = 'rgba(0,0,0,0.35)';
          g.fillRect(px, py, cw - 8, (rh - 6) * 0.45);
          e.fillStyle = 'rgba(0,0,0,0.55)';
          e.fillRect(px, py, cw - 8, (rh - 6) * 0.45);
        }
      }
    }
  }
  // fasce verticali dei pilastri
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let x = 0; x < W; x += cw * 4) g.fillRect(x, 0, 3, H);
  const map = finish(new THREE.CanvasTexture(c));
  const emissive = finish(new THREE.CanvasTexture(c2));
  const res = { map, emissive };
  cache.set(id, res);
  return res;
}

/** Skyline dipinto per lo sfondo lontano (sagome, finestre, antenne e luci rosse). */
export function skylineTexture(preset, seed = 9) {
  const id = `skyline|${preset.fog}|${preset.horizon}|${preset.windows}|${seed}`;
  if (cache.has(id)) return cache.get(id);
  const W = 4096;
  const H = 512;
  const rand = rng(seed);
  const [c, g] = canvas(W, H);
  g.clearRect(0, 0, W, H);
  const fog = new THREE.Color(preset.fog);
  const hor = new THREE.Color(preset.horizon);
  const layer = (count, minH, maxH, color, windows, lightAlpha) => {
    for (let i = 0; i < count; i++) {
      const w = 30 + rand() * 90;
      const x = rand() * W;
      const h = H * (minH + Math.pow(rand(), 1.8) * (maxH - minH));
      const y = H - h;
      g.fillStyle = color;
      // corpo, gradoni e antenne
      g.fillRect(x, y, w, h);
      if (rand() < 0.35) g.fillRect(x + w * 0.2, y - h * 0.12, w * 0.6, h * 0.12);
      if (rand() < 0.3) {
        g.fillRect(x + w * 0.48, y - h * 0.28, 3, h * 0.28);
        g.fillStyle = `rgba(255,60,60,${lightAlpha})`;
        g.fillRect(x + w * 0.48 - 2, y - h * 0.28 - 3, 7, 5);
      }
      if (windows) {
        const tint = new THREE.Color(rand() < 0.7 ? preset.windows : '#bfe0ff');
        for (let yy = y + 6; yy < H - 4; yy += 9) {
          if (rand() < 0.45) continue;
          for (let xx = x + 4; xx < x + w - 6; xx += 8) {
            if (rand() < 0.55) continue;
            const k = 0.4 + rand() * 0.6;
            g.fillStyle = `rgba(${Math.round(tint.r * 255)},${Math.round(tint.g * 255)},${Math.round(tint.b * 255)},${k * lightAlpha})`;
            g.fillRect(xx, yy, 4, 4);
          }
        }
      }
    }
  };
  const far = fog.clone().lerp(hor, 0.35).multiplyScalar(1.15);
  const mid = fog.clone().multiplyScalar(0.7);
  layer(220, 0.18, 0.75, `#${far.getHexString()}`, true, 0.45);
  layer(160, 0.12, 0.55, `#${mid.getHexString()}`, true, 0.85);
  // bagliore della citta' dietro le sagome
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  cache.set(id, tex);
  return tex;
}

/** Insegne al neon con ideogrammi stilizzati (atlante 4 x 2). */
export function neonSignsTexture(colors) {
  const id = `neon|${colors.join(',')}`;
  if (cache.has(id)) return cache.get(id);
  const W = 1024;
  const H = 512;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const rand = rng(42);
  const cellW = W / 4;
  const cellH = H / 2;
  for (let i = 0; i < 8; i++) {
    const cx = (i % 4) * cellW;
    const cy = Math.floor(i / 4) * cellH;
    const col = colors[i % colors.length];
    g.save();
    g.translate(cx, cy);
    g.strokeStyle = col;
    g.shadowColor = col;
    g.shadowBlur = 14;
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.strokeRect(14, 14, cellW - 28, cellH - 28);
    g.lineWidth = 9;
    // ideogrammi inventati: tratti orizzontali, verticali e diagonali
    const n = 2 + Math.floor(rand() * 2);
    for (let k = 0; k < n; k++) {
      const gx = 40 + k * ((cellW - 80) / n);
      const gw = (cellW - 80) / n - 16;
      for (let s = 0; s < 4; s++) {
        g.beginPath();
        const x0 = gx + rand() * gw;
        const y0 = 50 + rand() * (cellH - 100);
        const kind = rand();
        if (kind < 0.4) {
          g.moveTo(gx, y0);
          g.lineTo(gx + gw, y0);
        } else if (kind < 0.75) {
          g.moveTo(x0, 50);
          g.lineTo(x0, cellH - 50);
        } else {
          g.moveTo(x0, y0);
          g.lineTo(x0 + (rand() - 0.5) * gw, y0 + 40);
        }
        g.stroke();
      }
    }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(id, tex);
  return tex;
}
