// Pagina di prova per il disegno dei pezzi (solo sviluppo, non inclusa nel gioco).
import { buildRobotArt } from '../src/art/robotArt.js';
import { solveRobot, drawRobot } from '../src/art/rig.js';
import { DEFAULT_ROBOT } from '../src/data/parts.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 1600);
const H = +(params.get('h') || 900);
const c = document.getElementById('c');
c.width = W;
c.height = H;
const ctx = c.getContext('2d');
const g = ctx.createLinearGradient(0, 0, 0, H);
g.addColorStop(0, '#1a2440');
g.addColorStop(1, '#070a12');
ctx.fillStyle = g;
ctx.fillRect(0, 0, W, H);

const configs = [
  { ...DEFAULT_ROBOT },
  { ...DEFAULT_ROBOT, chassis: 'ch_scout', head: 'hd_dome', torso: 'tr_plasma', armL: 'wp_rocket', armR: 'wp_chainsword', legs: 'lg_digi', shoulders: 'sh_plate', pattern: 'hazard', colors: { primary: '#a3242b', secondary: '#2a2d33', accent: '#ffb030' } },
  { ...DEFAULT_ROBOT, chassis: 'ch_juggernaut', head: 'hd_crest', torso: 'tr_tesla', armL: 'wp_hammer', armR: 'wp_plasma', legs: 'lg_heavy', shoulders: 'sh_vents', pattern: 'camo', colors: { primary: '#4d5a32', secondary: '#c8a03c', accent: '#aaff3c' } },
  { ...DEFAULT_ROBOT, head: 'hd_tri', torso: 'tr_berserk', armL: 'wp_claws', armR: 'wp_claws', legs: 'lg_thrust', shoulders: 'sh_missile', pattern: 'split', colors: { primary: '#dfe4ea', secondary: '#2d3a4c', accent: '#46e8ff' } },
  { ...DEFAULT_ROBOT, head: 'hd_hunter', torso: 'tr_fission', armL: 'wp_fist', armR: 'wp_hammer', legs: 'lg_std', shoulders: 'sh_antenna', pattern: 'none', finish: 'matte', colors: { primary: '#c8a03c', secondary: '#3b2f2a', accent: '#ff5a1f' } },
];
const pick = params.get('only');
const list = pick ? [configs[+pick]] : configs;
const pose = {
  crouch: 0.1, lean: 0.06, head: 0, armF: 0.5, elbF: 1.55, armB: 0.35, elbB: 1.45,
  hipF: 0.22, kneeF: 0.32, hipB: -0.3, kneeB: 0.22,
};
const ppu = +(params.get('ppu') || (list.length === 1 ? 70 : 34));
const t0 = performance.now();
list.forEach((cfg, i) => {
  const art = buildRobotArt(cfg, Math.round(ppu * 1.2));
  const J = solveRobot(art, { ...pose, ...(art.leg.rest || {}) , armF: pose.armF, elbF: pose.elbF, armB: pose.armB, elbB: pose.elbB, crouch: 0.1, lean: 0.06 });
  const x = list.length === 1 ? W * 0.45 : W * (0.11 + i * 0.195);
  const y = H * 0.88;
  const base = [ppu * art.scale[0], 0, 0, ppu * art.scale[1], x, y];
  drawRobot(ctx, art, J, base, { glow: 1.2 });
});
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.fillStyle = '#fff';
ctx.font = '14px sans-serif';
ctx.fillText(`build+draw ${Math.round(performance.now() - t0)} ms`, 10, 20);
window.__done = true;
