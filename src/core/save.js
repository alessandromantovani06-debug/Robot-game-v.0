import { DEFAULT_ROBOT, STARTER_PARTS, getPart } from '../data/parts.js';

const KEY = 'rift-titans.save.v1';
export const MAX_ROBOTS = 6;

export const DEFAULT_SETTINGS = {
  music: 0.6,
  sfx: 0.85,
  quality: 'auto',
  vibration: true,
  voice: true,
  showFps: false,
  invertCamera: false,
};

function uid() {
  return 'r' + Math.random().toString(36).slice(2, 9);
}

function freshSave() {
  const robot = { ...structuredClone(DEFAULT_ROBOT), id: uid() };
  return {
    version: 1,
    credits: 600,
    unlocked: [...STARTER_PARTS],
    robots: [robot],
    activeRobot: robot.id,
    campaign: {},
    survivalBest: 0,
    stats: { kills: 0, battles: 0, wins: 0 },
    settings: { ...DEFAULT_SETTINGS },
    seenTutorial: false,
  };
}

function sanitizeRobot(r) {
  const base = structuredClone(DEFAULT_ROBOT);
  const out = { ...base, ...r, colors: { ...base.colors, ...(r.colors || {}) } };
  for (const slot of ['chassis', 'head', 'torso', 'armL', 'armR', 'legs', 'shoulders']) {
    if (!getPart(out[slot])) out[slot] = base[slot];
  }
  if (!out.id) out.id = uid();
  out.name = String(out.name || base.name).slice(0, 18);
  out.code = String(out.code ?? base.code).slice(0, 6);
  return out;
}

class SaveStore {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return freshSave();
      const parsed = JSON.parse(raw);
      const base = freshSave();
      const data = { ...base, ...parsed };
      data.settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
      data.unlocked = Array.from(new Set([...(parsed.unlocked || []), ...STARTER_PARTS]));
      data.robots = (parsed.robots || []).map(sanitizeRobot);
      if (!data.robots.length) data.robots = base.robots;
      if (!data.robots.find((r) => r.id === data.activeRobot)) data.activeRobot = data.robots[0].id;
      data.stats = { ...base.stats, ...(parsed.stats || {}) };
      data.campaign = parsed.campaign || {};
      return data;
    } catch (e) {
      console.warn('Salvataggio non leggibile, ne creo uno nuovo', e);
      return freshSave();
    }
  }

  persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Impossibile salvare', e);
    }
  }

  reset() {
    const settings = this.data.settings;
    this.data = freshSave();
    this.data.settings = settings;
    this.persist();
  }

  get settings() {
    return this.data.settings;
  }

  setSetting(key, value) {
    this.data.settings[key] = value;
    this.persist();
  }

  get credits() {
    return this.data.credits;
  }

  addCredits(n) {
    this.data.credits = Math.max(0, Math.round(this.data.credits + n));
    this.persist();
  }

  isUnlocked(partId) {
    return this.data.unlocked.includes(partId);
  }

  unlock(partId) {
    const part = getPart(partId);
    if (!part || this.isUnlocked(partId)) return true;
    if (this.data.credits < part.cost) return false;
    this.data.credits -= part.cost;
    this.data.unlocked.push(partId);
    this.persist();
    return true;
  }

  get robots() {
    return this.data.robots;
  }

  get activeRobot() {
    return this.data.robots.find((r) => r.id === this.data.activeRobot) || this.data.robots[0];
  }

  setActive(id) {
    if (this.data.robots.find((r) => r.id === id)) {
      this.data.activeRobot = id;
      this.persist();
    }
  }

  saveRobot(robot) {
    const clean = sanitizeRobot(structuredClone(robot));
    const idx = this.data.robots.findIndex((r) => r.id === clean.id);
    if (idx >= 0) this.data.robots[idx] = clean;
    else this.data.robots.push(clean);
    this.persist();
    return clean;
  }

  newRobot() {
    if (this.data.robots.length >= MAX_ROBOTS) return null;
    const n = this.data.robots.length + 1;
    const names = ['STORM HUNTER', 'IRON VALKYRIE', 'TITAN OMEGA', 'CRIMSON TIDE', 'NOVA GUARDIAN', 'ECHO BREAKER'];
    const robot = sanitizeRobot({
      ...structuredClone(DEFAULT_ROBOT),
      id: uid(),
      name: names[(n - 1) % names.length],
      code: `RT-${String(n).padStart(2, '0')}`,
    });
    this.data.robots.push(robot);
    this.persist();
    return robot;
  }

  deleteRobot(id) {
    if (this.data.robots.length <= 1) return false;
    this.data.robots = this.data.robots.filter((r) => r.id !== id);
    if (this.data.activeRobot === id) this.data.activeRobot = this.data.robots[0].id;
    this.persist();
    return true;
  }

  missionResult(id) {
    return this.data.campaign[id];
  }

  isMissionUnlocked(index, missions) {
    if (index === 0) return true;
    return !!this.data.campaign[missions[index - 1].id]?.done;
  }

  completeMission(id, { time, stars }) {
    const prev = this.data.campaign[id];
    const first = !prev?.done;
    this.data.campaign[id] = {
      done: true,
      bestTime: prev?.bestTime ? Math.min(prev.bestTime, time) : time,
      stars: Math.max(prev?.stars || 0, stars),
    };
    this.persist();
    return first;
  }

  recordBattle({ won, kills }) {
    this.data.stats.battles++;
    if (won) this.data.stats.wins++;
    this.data.stats.kills += kills;
    this.persist();
  }
}

export const save = new SaveStore();
