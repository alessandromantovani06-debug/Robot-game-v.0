// Genera tutte le icone del gioco a partire da un disegno SVG.
// Uso: npm run icons   (richiede Playwright: npm i -D playwright)
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();
    const require = createRequire(path.join(root, 'noop.js'));
    return require(path.join(root, 'playwright'));
  }
}

function head(scale = 1) {
  return `
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <ellipse cx="512" cy="905" rx="430" ry="55" fill="#3fd2ff" opacity="0.45" filter="url(#glow)"/>
    <path d="M 90 890 L 330 872 L 420 905 L 540 860 L 640 900 L 930 878" stroke="#9ff0ff" stroke-width="12" fill="none" filter="url(#glow)" stroke-linejoin="round"/>
    <path d="M512 150 L 712 250 L 776 470 L 732 700 L 604 800 L 420 800 L 292 700 L 248 470 L 312 250 Z" fill="url(#metal)" stroke="#a9cdf2" stroke-width="10" stroke-linejoin="round"/>
    <path d="M512 150 L 712 250 L 744 360 L 512 300 L 280 360 L 312 250 Z" fill="#ffffff" opacity="0.12"/>
    <path d="M512 92 L 566 280 L 512 338 L 458 280 Z" fill="url(#light)" stroke="#1d3a66" stroke-width="6"/>
    <path d="M 300 420 L 724 420 L 696 512 L 328 512 Z" fill="#06121f" stroke="#0b2236" stroke-width="6"/>
    <path d="M 318 438 L 706 438 L 688 494 L 336 494 Z" fill="#7ff0ff" filter="url(#glow)"/>
    <path d="M 340 452 L 684 452 L 676 478 L 348 478 Z" fill="#ffffff" opacity="0.85"/>
    <path d="M 372 572 L 652 572 L 616 742 L 408 742 Z" fill="url(#light)" stroke="#1d3a66" stroke-width="6"/>
    <g stroke="#1d3a66" stroke-width="10" stroke-linecap="round">
      <line x1="430" y1="610" x2="430" y2="700"/>
      <line x1="477" y1="610" x2="477" y2="710"/>
      <line x1="547" y1="610" x2="547" y2="710"/>
      <line x1="594" y1="610" x2="594" y2="700"/>
    </g>
    <path d="M 248 470 L 312 560 L 292 700 Z" fill="#16294a"/>
    <path d="M 776 470 L 712 560 L 732 700 Z" fill="#16294a"/>
    <path d="M 312 560 L 372 572 L 408 742 L 304 690 Z" fill="#ffb030" opacity="0.9"/>
    <path d="M 712 560 L 652 572 L 616 742 L 720 690 Z" fill="#ffb030" opacity="0.9"/>
  </g>`;
}

function svg({ size, scale = 1, background = true, transparent = false }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="58%" r="72%">
      <stop offset="0" stop-color="#18395c"/>
      <stop offset="0.55" stop-color="#0a1626"/>
      <stop offset="1" stop-color="#03060c"/>
    </radialGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7a9cc8"/>
      <stop offset="0.45" stop-color="#2f5f9e"/>
      <stop offset="1" stop-color="#132644"/>
    </linearGradient>
    <linearGradient id="light" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eef3f8"/>
      <stop offset="1" stop-color="#8c99aa"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="16" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  ${background && !transparent ? '<rect width="1024" height="1024" fill="url(#bg)"/>' : ''}
  ${head(scale)}
</svg>`;
}

function splash(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#04060c"/>
  <svg x="1066" y="820" width="600" height="600" viewBox="0 0 1024 1024">${svg({ size: 1024, background: false }).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>
  <text x="1366" y="1620" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="190" fill="#e8f7ff" letter-spacing="20">RIFT TITANS</text>
  <text x="1366" y="1730" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="70" fill="#ffb030" letter-spacing="40">DIFESA KAIJU</text>
</svg>`;
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage();

async function render(markup, w, h, file, omitBackground = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  const buf = await page.screenshot({ omitBackground, clip: { x: 0, y: 0, width: w, height: h } });
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, buf);
  console.log('✓', file);
}

await render(svg({ size: 192 }), 192, 192, 'public/icons/icon-192.png');
await render(svg({ size: 512 }), 512, 512, 'public/icons/icon-512.png');
await render(svg({ size: 512, scale: 0.78 }), 512, 512, 'public/icons/maskable-512.png');
await render(svg({ size: 180, scale: 0.92 }), 180, 180, 'public/icons/apple-touch-icon.png');
await render(svg({ size: 64 }), 64, 64, 'public/icons/favicon.png');
await render(svg({ size: 1024 }), 1024, 1024, 'build/icon.png');
// risorse per le app native (Capacitor)
await render(svg({ size: 1024 }), 1024, 1024, 'assets/icon-only.png');
await render(svg({ size: 1024, scale: 0.62, transparent: true }), 1024, 1024, 'assets/icon-foreground.png', true);
await render(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#0a1626"/></svg>`, 1024, 1024, 'assets/icon-background.png');
await render(splash(2732), 2732, 2732, 'assets/splash.png');
await render(splash(2732), 2732, 2732, 'assets/splash-dark.png');

await browser.close();
