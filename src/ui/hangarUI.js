import { h, button, clear, formatCredits, modal, toast, statRow } from './dom.js';
import { save, MAX_ROBOTS } from '../core/save.js';
import { audio } from '../core/audio.js';
import {
  CATEGORIES, listFor, getPart, statBars, COLOR_PRESETS, SWATCHES, ACCENT_SWATCHES, FINISHES, PATTERNS,
} from '../data/parts.js';

const MOD_LABELS = {
  hp: 'Corazza',
  power: 'Potenza',
  speed: 'Velocità',
  energy: 'Reattore',
  regen: 'Ricarica',
  sync: 'Sincronia',
  dash: 'Scatto',
  special: 'Speciale',
};

function modsText(p) {
  const out = [];
  if (p.base) {
    out.push(h('span', {}, `Corazza ${p.base.hp} · Vel. ${Math.round(p.base.speed * 100)}%`));
  }
  if (p.weapon) {
    const w = p.weapon;
    const speed = w.windup + w.active + w.recovery;
    const tempo = speed < 0.5 ? 'Rapido' : speed < 0.8 ? 'Medio' : 'Lento';
    out.push(h('span', {}, `Danno ${w.dmg}${w.hits > 1 ? '×' + w.hits : ''} · ${w.type === 'ranged' ? 'A distanza' : 'Portata ' + w.range} · ${tempo}`));
    if (w.energy) out.push(h('span', { class: 'neg' }, ` · Energia ${w.energy}`));
  }
  if (p.mods) {
    const parts = Object.entries(p.mods).map(([k, v]) => {
      const txt = k === 'hp' || k === 'energy' ? `${v > 0 ? '+' : ''}${v} ${MOD_LABELS[k]}` : `${v > 0 ? '+' : ''}${Math.round(v * 100)}% ${MOD_LABELS[k]}`;
      return h('span', { class: v < 0 ? 'neg' : '' }, txt);
    });
    parts.forEach((x, i) => out.push(i ? ' · ' : '', x));
  }
  if (p.specialName) out.push(h('div', { style: { color: '#ffb3ff' } }, '★ ' + p.specialName));
  return out;
}

export class HangarUI {
  constructor(app, el, screens) {
    this.app = app;
    this.el = el;
    this.screens = screens;
    this.cat = 'chassis';
    this._load(save.activeRobot.id);
    this.render();
  }

  _load(id) {
    const r = save.robots.find((x) => x.id === id) || save.activeRobot;
    this.robotId = r.id;
    this.saved = structuredClone(r);
    this.display = structuredClone(r);
  }

  get view() {
    return this.app.view;
  }

  _rebuild() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = null;
      this.view?.setRobot?.(this.display);
    });
  }

  _persist() {
    this.saved = save.saveRobot(this.saved);
    this.display = structuredClone(this.saved);
  }

  render() {
    clear(this.el);
    const robots = save.robots;
    const idx = robots.findIndex((r) => r.id === this.robotId);
    const switchRobot = (d) => {
      const n = robots.length;
      this._load(robots[(idx + d + n) % n].id);
      this._rebuild();
      this.render();
    };
    this.creditsEl = h('div', { class: 'credits' }, formatCredits(save.credits));
    this.el.append(
      h(
        'div',
        { class: 'topbar' },
        button('◀ Menu', () => this.app.showMenu(), 'small'),
        h('h2', {}, 'HANGAR'),
        robots.length > 1
          ? h(
              'div',
              { class: 'robot-switch' },
              button('◀', () => switchRobot(-1), 'small icon'),
              h('div', { class: 'rname' }, `${idx + 1}/${robots.length}`),
              button('▶', () => switchRobot(1), 'small icon'),
            )
          : null,
        this.creditsEl,
      ),
    );

    this.panel = h('div', { class: 'robot-panel panel scroll' });
    this.el.append(h('div', { class: 'hangar-mid' }, this.panel));
    this._renderPanel();

    this.drawer = h('div', { class: 'drawer panel' });
    this.el.append(this.drawer);
    this._renderDrawer();
  }

  _renderPanel() {
    const p = this.panel;
    clear(p);
    const isActive = save.data.activeRobot === this.robotId;
    const name = h('input', { type: 'text', value: this.saved.name, maxlength: 18, spellcheck: 'false' });
    name.addEventListener('change', () => {
      this.saved.name = name.value.toUpperCase().trim() || 'TITANO';
      this._persist();
      this._renderPanel();
    });
    const code = h('input', { type: 'text', value: this.saved.code, maxlength: 6, spellcheck: 'false' });
    code.addEventListener('change', () => {
      this.saved.code = code.value.toUpperCase().trim();
      this._persist();
      this._rebuild();
    });
    const savedBars = statBars(this.saved);
    const bars = statBars(this.display);
    const torso = getPart(this.display.torso);
    name.style.flex = '2';
    code.style.flex = '1';
    code.style.minWidth = '0';
    name.style.minWidth = '0';
    p.append(
      h('label', {}, 'NOME TITANO · SIGLA'),
      h('div', { class: 'row' }, name, code),
      ...bars.map((b, i) => statRow(b, b.norm - savedBars[i].norm)),
      h('div', { class: 'special-info' }, '★ ' + torso.specialName),
      h(
        'div',
        { style: { fontSize: '0.78em', color: 'var(--muted)' } },
        `SX: ${getPart(this.display.armL).name} · DX: ${getPart(this.display.armR).name}`,
      ),
      h(
        'div',
        { class: 'row', style: { flexWrap: 'wrap', marginTop: '4px' } },
        isActive
          ? h('span', { class: 'active-badge' }, '✓ TITANO ATTIVO')
          : button(
              'Usa in battaglia',
              () => {
                save.setActive(this.robotId);
                audio.ui('confirm');
                this._renderPanel();
              },
              'primary small',
            ),
        button(
          '+ Nuovo',
          () => {
            const r = save.newRobot();
            if (!r) return toast(this.app.ui, `Puoi avere al massimo ${MAX_ROBOTS} Titani`);
            this._load(r.id);
            this._rebuild();
            this.render();
            toast(this.app.ui, 'Nuovo Titano creato!');
          },
          'small',
        ),
        save.robots.length > 1 ? button('Elimina', () => this._confirmDelete(), 'danger small') : null,
      ),
    );
  }

  _confirmDelete() {
    const m = modal(this.app.ui, 'ELIMINARE IL TITANO?', [h('p', {}, `${this.saved.name} verrà smantellato. I pezzi sbloccati restano disponibili.`)], [
      button('Annulla', () => m.remove()),
      button(
        'Elimina',
        () => {
          save.deleteRobot(this.robotId);
          m.remove();
          this._load(save.activeRobot.id);
          this._rebuild();
          this.render();
        },
        'danger',
      ),
    ]);
  }

  _renderDrawer() {
    const d = this.drawer;
    clear(d);
    const tabs = h(
      'div',
      { class: 'tabs scroll-x' },
      CATEGORIES.map((c) =>
        h(
          'button',
          {
            class: 'tab' + (c.id === this.cat ? ' sel' : ''),
            onClick: () => {
              audio.ui('click');
              this.cat = c.id;
              if (JSON.stringify(this.display) !== JSON.stringify(this.saved)) {
                this.display = structuredClone(this.saved);
                this._rebuild();
                this._renderPanel();
              }
              this.view?.focus?.(c.id);
              this._renderDrawer();
            },
          },
          c.icon + ' ' + c.label,
        ),
      ),
    );
    d.append(tabs);
    if (this.cat === 'paint') d.append(this._paintPanel());
    else d.append(this._partCards());
  }

  _partCards() {
    const slot = this.cat;
    const wrap = h('div', { class: 'cards scroll-x' });
    for (const part of listFor(slot)) {
      const owned = save.isUnlocked(part.id);
      const equipped = this.saved[slot] === part.id;
      const preview = this.display[slot] === part.id && !owned;
      let status;
      if (equipped) status = h('div', { class: 'pcost equipped' }, '✓ EQUIPAGGIATO');
      else if (owned) status = h('div', { class: 'pcost owned' }, 'DISPONIBILE');
      else if (preview)
        status = button(
          `Sblocca ${formatCredits(part.cost)}`,
          (e) => {
            e.stopPropagation();
            this._buy(part);
          },
          save.credits >= part.cost ? 'primary small' : 'small',
          { sound: 'click' },
        );
      else status = h('div', { class: 'pcost' }, formatCredits(part.cost));
      const card = h(
        'button',
        {
          class: 'part-card' + (equipped || preview ? ' sel' : '') + (owned ? '' : ' locked'),
          onClick: () => this._select(part),
        },
        h('div', { class: 'pname' }, part.name),
        h('div', { class: 'pdesc' }, part.desc),
        h('div', { class: 'pmods' }, modsText(part)),
        status,
      );
      wrap.append(card);
      if (equipped || preview) requestAnimationFrame(() => card.scrollIntoView({ inline: 'nearest', block: 'nearest' }));
    }
    return wrap;
  }

  _select(part) {
    const slot = this.cat;
    if (save.isUnlocked(part.id)) {
      if (this.saved[slot] !== part.id) {
        this.saved[slot] = part.id;
        this._persist();
        audio.ui('equip');
      }
      this.display = structuredClone(this.saved);
    } else {
      this.display = structuredClone(this.saved);
      this.display[slot] = part.id;
      audio.ui('click');
    }
    this._rebuild();
    this._renderPanel();
    this._renderDrawer();
  }

  _buy(part) {
    if (save.unlock(part.id)) {
      audio.ui('buy');
      this.saved[this.cat] = part.id;
      this._persist();
      toast(this.app.ui, `Sbloccato: ${part.name}`);
      this.creditsEl.textContent = formatCredits(save.credits);
      this._rebuild();
      this._renderPanel();
      this._renderDrawer();
    } else {
      audio.ui('error');
      toast(this.app.ui, `Crediti insufficienti: servono ${formatCredits(part.cost)}. Completa missioni per guadagnarne!`);
    }
  }

  _setPaint(fn) {
    fn(this.saved);
    this._persist();
    this._rebuild();
    this._renderDrawer();
  }

  _paintPanel() {
    const c = this.saved.colors;
    const wrap = h('div', { class: 'paint scroll-x' });
    const section = (title, ...kids) => h('div', { class: 'paint-section' }, h('div', { class: 'ptitle' }, title), ...kids);
    const swatches = (key, list, cls = '') => {
      const box = h('div', { class: 'swatches ' + cls });
      for (const col of list) {
        box.append(
          h('button', {
            class: 'swatch' + (c[key].toLowerCase() === col.toLowerCase() ? ' sel' : ''),
            style: { background: col },
            title: col,
            onClick: () => {
              audio.ui('click');
              this._setPaint((r) => (r.colors[key] = col));
            },
          }),
        );
      }
      const custom = h('input', { type: 'color', value: c[key] });
      custom.addEventListener('change', () => this._setPaint((r) => (r.colors[key] = custom.value)));
      box.append(h('label', { class: 'swatch custom', title: 'Colore personalizzato' }, custom));
      return box;
    };
    wrap.append(
      section(
        'SCHEMI',
        h(
          'div',
          { class: 'preset-grid' },
          COLOR_PRESETS.map((p) =>
            h(
              'button',
              {
                class: 'preset',
                onClick: () => {
                  audio.ui('equip');
                  this._setPaint((r) => (r.colors = { primary: p.primary, secondary: p.secondary, accent: p.accent }));
                },
              },
              h('i', { style: { background: p.primary } }),
              h('i', { style: { background: p.secondary } }),
              h('i', { style: { background: p.accent } }),
              p.name,
            ),
          ),
        ),
      ),
      section('PRIMARIO', swatches('primary', SWATCHES)),
      section('SECONDARIO', swatches('secondary', SWATCHES)),
      section('LUCI E NUCLEO', swatches('accent', ACCENT_SWATCHES, 'accent')),
      section(
        'FINITURA',
        h(
          'div',
          { class: 'chips' },
          FINISHES.map((f) =>
            h(
              'button',
              {
                class: 'chip' + (this.saved.finish === f.id ? ' sel' : ''),
                onClick: () => {
                  audio.ui('click');
                  this._setPaint((r) => (r.finish = f.id));
                },
              },
              f.name,
            ),
          ),
        ),
        h('div', { class: 'ptitle', style: { marginTop: '6px' } }, 'LIVREA'),
        h(
          'div',
          { class: 'chips' },
          PATTERNS.map((pt) =>
            h(
              'button',
              {
                class: 'chip' + (this.saved.pattern === pt.id ? ' sel' : ''),
                onClick: () => {
                  audio.ui('click');
                  this._setPaint((r) => (r.pattern = pt.id));
                },
              },
              pt.name,
            ),
          ),
        ),
      ),
    );
    return wrap;
  }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
  }
}
