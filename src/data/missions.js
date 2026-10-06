// Campagna: ogni missione e' uno scontro in una citta' costiera.

export const MISSIONS = [
  {
    id: 'm1',
    name: 'Primo Contatto',
    place: 'Baia di Tokyo',
    env: 'tokyo',
    enemies: [{ type: 'squalor', level: 1 }],
    reward: 500,
    brief:
      'Un Kaiju di Categoria I è emerso dalla Frattura e punta dritto verso la baia. È il tuo primo lancio, pilota: sincronizzati con il Titano e fermalo prima che tocchi terra.',
    tutorial: true,
  },
  {
    id: 'm2',
    name: 'Chele nella Notte',
    place: 'Manila',
    env: 'manila',
    enemies: [{ type: 'krakos', level: 1 }],
    reward: 650,
    brief: 'Un Kaiju corazzato sta demolendo il porto di Manila. Attento alle cariche: para o schiva al momento giusto.',
  },
  {
    id: 'm3',
    name: 'Denti nella Tempesta',
    place: 'Sydney',
    env: 'sydney',
    enemies: [{ type: 'squalor', level: 2 }],
    reward: 700,
    brief: 'Una variante più aggressiva di Squalor si muove nella tempesta. Più veloce, più resistente.',
  },
  {
    id: 'm4',
    name: 'Veleno nel Porto',
    place: 'Lima',
    env: 'lima',
    enemies: [{ type: 'viperion', level: 1 }],
    reward: 850,
    brief: 'Categoria III. Il suo acido corrode la corazza: avvicinati in fretta e non dargli spazio.',
  },
  {
    id: 'm5',
    name: 'Doppia Minaccia',
    place: 'Anchorage',
    env: 'anchorage',
    enemies: [
      { type: 'squalor', level: 2 },
      { type: 'krakos', level: 1 },
    ],
    reward: 1000,
    brief: 'Per la prima volta due Kaiju escono insieme dalla Frattura. Usa Q / il pulsante bersaglio per cambiare obiettivo.',
  },
  {
    id: 'm6',
    name: 'Tempesta Elettrica',
    place: 'San Francisco',
    env: 'sanfrancisco',
    enemies: [{ type: 'tonitrus', level: 1 }],
    reward: 1200,
    brief: 'Categoria IV. Quando il suo corpo si illumina sta caricando un impulso EMP: allontanati o scatta via!',
  },
  {
    id: 'm7',
    name: 'Il Muro di Hong Kong',
    place: 'Hong Kong',
    env: 'hongkong',
    enemies: [
      { type: 'viperion', level: 2 },
      { type: 'krakos', level: 1 },
    ],
    reward: 1400,
    brief: 'Il muro costiero non reggerà. Sei l\'ultima linea di difesa tra i Kaiju e dieci milioni di persone.',
  },
  {
    id: 'm8',
    name: 'Allerta Categoria IV',
    place: 'Vladivostok',
    env: 'vladivostok',
    enemies: [{ type: 'tonitrus', level: 2 }],
    reward: 1600,
    brief: 'Un Tonitrus potenziato avanza nella bufera. Il gelo rallenta tutti, tranne lui.',
  },
  {
    id: 'm9',
    name: 'Sull\'Orlo della Frattura',
    place: 'Oceano Pacifico',
    env: 'rift',
    enemies: [
      { type: 'viperion', level: 2 },
      { type: 'tonitrus', level: 2 },
    ],
    reward: 1900,
    brief: 'Scorta la testata fino alla Frattura. Due Kaiju di guardia ti sbarrano la strada.',
  },
  {
    id: 'm10',
    name: 'Il Re dell\'Abisso',
    place: 'La Frattura',
    env: 'rift',
    enemies: [{ type: 'leviathan', level: 1 }],
    reward: 3000,
    boss: true,
    brief: 'Categoria V. La creatura più grande mai registrata. Annulla l\'apocalisse, pilota.',
  },
];

export const SURVIVAL_POOL = ['squalor', 'krakos', 'viperion', 'tonitrus', 'leviathan'];

/** Ondata della modalita' sopravvivenza: Kaiju sempre piu' forti. */
export function survivalWave(wave) {
  const tier = Math.min(SURVIVAL_POOL.length - 1, Math.floor((wave - 1) / 2));
  const type = SURVIVAL_POOL[Math.floor(Math.random() * (tier + 1))];
  const level = 1 + Math.floor((wave - 1) / 3);
  const enemies = [{ type, level }];
  if (wave >= 4 && wave % 3 === 1) {
    enemies.push({ type: SURVIVAL_POOL[Math.floor(Math.random() * Math.min(3, tier + 1))], level: Math.max(1, level - 1) });
  }
  return enemies;
}
