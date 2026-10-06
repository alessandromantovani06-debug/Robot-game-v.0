// Catalogo dei pezzi con cui costruire un Titano.
// Le statistiche finali vengono calcolate in computeStats().

export const CATEGORIES = [
  { id: 'chassis', label: 'Telaio', icon: '◆' },
  { id: 'head', label: 'Testa', icon: '◉' },
  { id: 'torso', label: 'Torso', icon: '⬢' },
  { id: 'armL', label: 'Braccio Sx', icon: '◧', list: 'arm' },
  { id: 'armR', label: 'Braccio Dx', icon: '◨', list: 'arm' },
  { id: 'legs', label: 'Gambe', icon: '▥' },
  { id: 'shoulders', label: 'Spalle', icon: '▲' },
  { id: 'paint', label: 'Vernice', icon: '✦' },
];

export const PARTS = {
  chassis: [
    {
      id: 'ch_ranger',
      name: 'Ranger',
      desc: 'Telaio medio di terza generazione. Equilibrato in ogni situazione.',
      cost: 0,
      scale: [1, 1, 1],
      base: { hp: 1000, power: 1, speed: 1, energy: 100 },
    },
    {
      id: 'ch_scout',
      name: 'Scout',
      desc: 'Telaio leggero e scattante. Meno corazza, molta più velocità.',
      cost: 800,
      scale: [0.88, 0.96, 0.88],
      base: { hp: 820, power: 0.92, speed: 1.22, energy: 110 },
    },
    {
      id: 'ch_juggernaut',
      name: 'Juggernaut',
      desc: 'Telaio pesante da prima linea. Lento ma devastante.',
      cost: 1300,
      scale: [1.16, 1.05, 1.12],
      base: { hp: 1340, power: 1.15, speed: 0.82, energy: 95 },
    },
  ],
  head: [
    { id: 'hd_visor', name: 'Visore Ranger', desc: 'Testa standard con visore panoramico.', cost: 0, mods: {} },
    { id: 'hd_dome', name: 'Cupola Guardian', desc: 'Cabina di pilotaggio blindata.', cost: 400, mods: { hp: 70 } },
    { id: 'hd_crest', name: 'Elmo Samurai', desc: 'Cresta da guerriero. Aumenta la potenza.', cost: 700, mods: { power: 0.05 } },
    { id: 'hd_tri', name: 'Ottica Tripla', desc: 'Tre sensori: sincronia neurale più rapida.', cost: 600, mods: { sync: 0.15 } },
    { id: 'hd_hunter', name: 'Muso Predatore', desc: 'Profilo aerodinamico da caccia.', cost: 900, mods: { speed: 0.05, power: 0.03 } },
  ],
  torso: [
    {
      id: 'tr_fission',
      name: 'Reattore a Fissione',
      desc: 'Nucleo nucleare classico. Speciale: RAGGIO NUCLEARE dal petto.',
      cost: 0,
      special: 'beam',
      specialName: 'Raggio Nucleare',
      mods: {},
    },
    {
      id: 'tr_plasma',
      name: 'Nucleo al Plasma',
      desc: 'Energia extra. Speciale: SALVA DI MISSILI a ricerca.',
      cost: 900,
      special: 'missiles',
      specialName: 'Salva di Missili',
      mods: { energy: 15 },
    },
    {
      id: 'tr_tesla',
      name: 'Cuore Tesla',
      desc: 'Ricarica rapida. Speciale: IMPULSO TESLA che stordisce i Kaiju.',
      cost: 1100,
      special: 'emp',
      specialName: 'Impulso Tesla',
      mods: { regen: 0.2 },
    },
    {
      id: 'tr_berserk',
      name: 'Motore Berserker',
      desc: 'Pura aggressività. Speciale: FURIA OVERDRIVE per 8 secondi.',
      cost: 1300,
      special: 'overdrive',
      specialName: 'Furia Overdrive',
      mods: { hp: -40, power: 0.06 },
    },
  ],
  arm: [
    {
      id: 'wp_fist',
      name: "Pugno d'Acciaio",
      desc: 'Colpi rapidi e affidabili. Ideale per le combo.',
      cost: 0,
      weapon: { type: 'melee', dmg: 42, range: 6, arc: 55, windup: 0.16, active: 0.08, recovery: 0.26, poise: 10, energy: 0, knock: 1.5 },
    },
    {
      id: 'wp_rocket',
      name: 'Pugno a Razzo',
      desc: 'Pugno spinto da propulsori nel gomito. Colpo pesante.',
      cost: 500,
      weapon: { type: 'melee', dmg: 88, range: 6.4, arc: 50, windup: 0.4, active: 0.1, recovery: 0.38, poise: 30, energy: 12, knock: 4, thruster: true },
    },
    {
      id: 'wp_chainsword',
      name: 'Spada a Catena',
      desc: 'Lama segmentata con grande portata e arco ampio.',
      cost: 900,
      weapon: { type: 'melee', dmg: 60, range: 8.6, arc: 80, windup: 0.26, active: 0.12, recovery: 0.34, poise: 16, energy: 4, knock: 2, slash: true },
    },
    {
      id: 'wp_hammer',
      name: 'Martello Sismico',
      desc: 'Lento ma rompe la guardia. Genera un\'onda d\'urto.',
      cost: 1100,
      weapon: { type: 'melee', dmg: 118, range: 7, arc: 60, windup: 0.55, active: 0.1, recovery: 0.52, poise: 45, energy: 15, knock: 5, shockwave: 5 },
    },
    {
      id: 'wp_plasma',
      name: 'Cannone al Plasma',
      desc: 'Arma a distanza. Consuma energia del reattore.',
      cost: 800,
      weapon: { type: 'ranged', dmg: 56, range: 60, arc: 0, windup: 0.22, active: 0.05, recovery: 0.3, poise: 12, energy: 18, knock: 1.5, speed: 70 },
    },
    {
      id: 'wp_claws',
      name: 'Artigli Elettrici',
      desc: 'Doppio colpo fulmineo. Aumenta la sincronia.',
      cost: 700,
      weapon: { type: 'melee', dmg: 27, hits: 2, range: 5.6, arc: 60, windup: 0.11, active: 0.12, recovery: 0.2, poise: 8, energy: 2, knock: 1, syncBonus: 0.5 },
    },
  ],
  legs: [
    { id: 'lg_std', name: 'Gambe Standard', desc: 'Attuatori idraulici bilanciati.', cost: 0, mods: {} },
    { id: 'lg_heavy', name: 'Colonne Corazzate', desc: 'Più corazza, meno velocità.', cost: 600, mods: { hp: 130, speed: -0.08 } },
    { id: 'lg_digi', name: 'Arti Digitigradi', desc: 'Gambe a ginocchio inverso: veloci e agili.', cost: 800, mods: { speed: 0.1, dash: 0.2 } },
    { id: 'lg_thrust', name: 'Propulsori Jet', desc: 'Razzi nei polpacci: scatti molto più lunghi.', cost: 1000, mods: { dash: 0.45, speed: 0.04 } },
  ],
  shoulders: [
    { id: 'sh_std', name: 'Spalle Standard', desc: 'Spallacci di serie.', cost: 0, mods: {} },
    { id: 'sh_plate', name: 'Piastre Titaniche', desc: 'Corazze extra sulle spalle.', cost: 500, mods: { hp: 110, speed: -0.03 } },
    { id: 'sh_vents', name: 'Turbine di Raffreddamento', desc: 'Il reattore si ricarica più in fretta.', cost: 600, mods: { regen: 0.3 } },
    { id: 'sh_missile', name: 'Pod Missilistici', desc: 'Potenziano l\'attacco speciale.', cost: 900, mods: { special: 0.25 } },
    { id: 'sh_antenna', name: 'Antenne Neurali', desc: 'Sincronia neurale molto più rapida.', cost: 700, mods: { sync: 0.25 } },
  ],
};

export const FINISHES = [
  { id: 'metal', name: 'Metallico', metalness: 0.8, roughness: 0.32 },
  { id: 'satin', name: 'Satinato', metalness: 0.55, roughness: 0.5 },
  { id: 'matte', name: 'Opaco', metalness: 0.2, roughness: 0.78 },
];

export const PATTERNS = [
  { id: 'none', name: 'Nessuna' },
  { id: 'stripes', name: 'Strisce' },
  { id: 'hazard', name: 'Pericolo' },
  { id: 'camo', name: 'Mimetica' },
  { id: 'split', name: 'Bicolore' },
];

export const COLOR_PRESETS = [
  { name: 'Tempesta Blu', primary: '#2f5f9e', secondary: '#c9d1da', accent: '#3fd2ff' },
  { name: 'Rosso Cremisi', primary: '#a3242b', secondary: '#2a2d33', accent: '#ffb030' },
  { name: 'Oro Imperiale', primary: '#c8a03c', secondary: '#3b2f2a', accent: '#ff5a1f' },
  { name: 'Verde Militare', primary: '#4d5a32', secondary: '#1f2420', accent: '#aaff3c' },
  { name: 'Bianco Artico', primary: '#dfe4ea', secondary: '#2d3a4c', accent: '#46e8ff' },
  { name: 'Ombra Nera', primary: '#202329', secondary: '#4a4f58', accent: '#ff2a55' },
  { name: 'Arancio Soccorso', primary: '#d8641e', secondary: '#33373d', accent: '#ffd23a' },
  { name: 'Viola Neon', primary: '#4b2a7a', secondary: '#1c1a26', accent: '#ff3df5' },
];

export const SWATCHES = [
  '#2f5f9e', '#1d3a66', '#a3242b', '#d8641e', '#c8a03c', '#e0c35a', '#4d5a32', '#2e6b4a',
  '#dfe4ea', '#8c96a3', '#4a4f58', '#202329', '#4b2a7a', '#7a1f4f', '#1f6f7a', '#5a3a22',
];

export const ACCENT_SWATCHES = [
  '#3fd2ff', '#46e8ff', '#ffb030', '#ff5a1f', '#ff2a55', '#ff3df5', '#aaff3c', '#ffd23a', '#ffffff', '#7a6bff',
];

const ALL = Object.values(PARTS).flat();

export function getPart(id) {
  return ALL.find((p) => p.id === id);
}

export function listFor(categoryId) {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  return PARTS[cat?.list || categoryId] || [];
}

export const STARTER_PARTS = ALL.filter((p) => p.cost === 0).map((p) => p.id);

export const DEFAULT_ROBOT = {
  name: 'AURORA PRIME',
  code: 'RT-01',
  chassis: 'ch_ranger',
  head: 'hd_visor',
  torso: 'tr_fission',
  armL: 'wp_fist',
  armR: 'wp_fist',
  legs: 'lg_std',
  shoulders: 'sh_std',
  colors: { primary: '#2f5f9e', secondary: '#c9d1da', accent: '#3fd2ff' },
  finish: 'metal',
  pattern: 'stripes',
};

/** Calcola le statistiche di combattimento di un robot dalla sua configurazione. */
export function computeStats(cfg) {
  const chassis = getPart(cfg.chassis) || PARTS.chassis[0];
  const s = {
    hp: chassis.base.hp,
    power: chassis.base.power,
    speed: chassis.base.speed,
    energy: chassis.base.energy,
    regen: 1,
    sync: 1,
    dash: 1,
    special: 1,
  };
  for (const slot of ['head', 'torso', 'legs', 'shoulders']) {
    const p = getPart(cfg[slot]);
    if (!p?.mods) continue;
    for (const [k, v] of Object.entries(p.mods)) {
      if (k === 'hp' || k === 'energy') s[k] += v;
      else s[k] += v;
    }
  }
  s.hp = Math.round(s.hp);
  s.energy = Math.round(s.energy);
  return s;
}

/** Valori 0..1 per le barre delle statistiche nell'hangar. */
export function statBars(cfg) {
  const s = computeStats(cfg);
  const wl = getPart(cfg.armL)?.weapon;
  const wr = getPart(cfg.armR)?.weapon;
  const dps = (w) => ((w.dmg * (w.hits || 1)) / (w.windup + w.active + w.recovery));
  const attack = ((dps(wl) + dps(wr)) / 2) * s.power;
  return [
    { label: 'Corazza', value: s.hp, norm: (s.hp - 650) / (1650 - 650) },
    { label: 'Potenza', value: Math.round(attack), norm: (attack - 60) / (200 - 60) },
    { label: 'Velocità', value: Math.round(s.speed * 100), norm: (s.speed - 0.7) / (1.4 - 0.7) },
    { label: 'Reattore', value: Math.round(s.energy * s.regen), norm: (s.energy * s.regen - 80) / (190 - 80) },
  ];
}
