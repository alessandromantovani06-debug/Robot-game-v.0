import { h, button, clear, formatCredits, formatTime, stars, modal, toast, statRow } from './dom.js';
import { save } from '../core/save.js';
import { audio } from '../core/audio.js';
import { isTouchDevice } from '../core/input.js';
import { isIOS, isAndroid, isStandalone, enterFullscreen } from '../core/platform.js';
import { MISSIONS } from '../data/missions.js';
import { KAIJU, CATEGORY_LABEL } from '../data/kaiju.js';
import { statBars, getPart } from '../data/parts.js';
import { HangarUI } from './hangarUI.js';

export class Screens {
  constructor(app) {
    this.app = app;
    this.root = app.ui;
    this.name = null;
  }

  clear() {
    this.hangarUI?.dispose();
    this.hangarUI = null;
    if (this._key) window.removeEventListener('keydown', this._key);
    this._key = null;
    clear(this.root);
    this.name = null;
  }

  _screen(cls, name) {
    this.clear();
    this.name = name;
    const el = h('div', { class: 'screen ' + cls });
    this.root.append(el);
    return el;
  }

  // ---------- titolo ----------
  title() {
    const el = this._screen('title-screen', 'title');
    el.append(
      h('div', { class: 'logo' }, 'RIFT TITANS', h('span', {}, 'DIFESA KAIJU')),
      h('div', { class: 'press' }, isTouchDevice() ? 'TOCCA PER INIZIARE' : 'PREMI UN TASTO PER INIZIARE'),
      h('div', { class: 'version' }, 'v' + __APP_VERSION__),
    );
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      audio.unlock();
      audio.ui('confirm');
      enterFullscreen();
      this.app.showMenu();
    };
    el.addEventListener('click', go);
    this._key = (e) => {
      if (e.repeat) return;
      go();
    };
    window.addEventListener('keydown', this._key);
  }

  // ---------- menu principale ----------
  menu() {
    const el = this._screen('menu-screen', 'menu');
    const r = save.activeRobot;
    const torso = getPart(r.torso);
    const item = (ico, label, fn, cls = '') => button([h('span', { class: 'ico' }, ico), label], fn, cls);
    const done = MISSIONS.filter((m) => save.missionResult(m.id)?.done).length;
    const left = h(
      'div',
      { class: 'menu-left' },
      h('div', { class: 'logo' }, 'RIFT TITANS', h('span', {}, 'DIFESA KAIJU')),
      item('▶', 'Campagna', () => this.app.showMissions(), 'primary'),
      item('∞', 'Sopravvivenza', () => this.app.startSurvival()),
      item('⚒', 'Hangar', () => this.app.showHangar()),
      item('⚙', 'Impostazioni', () => this.settings()),
      item('?', 'Come si gioca', () => this.help()),
    );
    if (!isStandalone()) left.append(item('⇩', 'Installa il gioco', () => this.install(), 'warn'));
    const card = h(
      'div',
      { class: 'pilot-card panel' },
      h('div', { class: 'label' }, 'TITANO ATTIVO · ' + (r.code || '')),
      h('div', { class: 'name' }, r.name),
      statBars(r).map((s) => statRow(s)),
      h('div', { class: 'special-info', style: { marginTop: '6px' } }, '★ Speciale: ' + torso.specialName),
      h(
        'div',
        { style: { marginTop: '6px', fontSize: '0.8em', color: 'var(--muted)' } },
        `Campagna ${done}/${MISSIONS.length} · Record sopravvivenza: ondata ${save.data.survivalBest || 0}`,
      ),
    );
    const right = h('div', { class: 'menu-right' }, h('div', { class: 'credits' }, formatCredits(save.credits)), card);
    el.append(left, right);
  }

  refreshInstall() {
    if (this.name === 'menu') this.menu();
  }

  // ---------- campagna ----------
  missions() {
    const el = this._screen('missions-screen', 'missions');
    el.append(
      h(
        'div',
        { class: 'topbar' },
        button('◀ Menu', () => this.app.showMenu(), 'small'),
        h('h2', {}, 'CAMPAGNA · DIFESA DEL PACIFICO'),
        h('div', { class: 'credits' }, formatCredits(save.credits)),
      ),
    );
    const list = h('div', { class: 'mission-list scroll' });
    const brief = h('div', { class: 'briefing panel' });
    el.append(h('div', { class: 'missions-body' }, list, brief));
    let sel = MISSIONS.findIndex((m, i) => save.isMissionUnlocked(i, MISSIONS) && !save.missionResult(m.id)?.done);
    if (sel < 0) sel = MISSIONS.length - 1;

    const renderList = () => {
      clear(list);
      MISSIONS.forEach((m, i) => {
        const unlocked = save.isMissionUnlocked(i, MISSIONS);
        const res = save.missionResult(m.id);
        const cat = Math.max(...m.enemies.map((e) => KAIJU[e.type].category));
        const card = h(
          'button',
          {
            class: 'mission-card' + (i === sel ? ' sel' : '') + (unlocked ? '' : ' locked'),
            onClick: () => {
              audio.ui('click');
              sel = i;
              renderList();
              renderBrief();
            },
          },
          h('div', { class: 'num' }, String(i + 1).padStart(2, '0')),
          h('div', {}, h('div', { class: 'mname' }, m.name), h('div', { class: 'mplace' }, m.place)),
          h('div', { style: { textAlign: 'right' } }, h('span', { class: 'tag cat' + cat }, 'CAT ' + CATEGORY_LABEL[cat]), h('div', {}, res?.done ? stars(res.stars) : unlocked ? '' : '🔒')),
        );
        list.append(card);
        if (i === sel) requestAnimationFrame(() => card.scrollIntoView({ block: 'nearest' }));
      });
    };

    const renderBrief = () => {
      clear(brief);
      const m = MISSIONS[sel];
      const unlocked = save.isMissionUnlocked(sel, MISSIONS);
      const res = save.missionResult(m.id);
      const robot = save.activeRobot;
      brief.append(
        h('div', { class: 'place' }, `MISSIONE ${sel + 1} · ${m.place.toUpperCase()}`),
        h('h3', {}, m.name),
        h('p', { class: 'scroll', style: { maxHeight: '7em' } }, m.brief),
        h(
          'div',
          { class: 'kaiju-info' },
          m.enemies.map((e) => {
            const k = KAIJU[e.type];
            const hp = Math.round(k.hp * (1 + 0.3 * (e.level - 1)));
            return h(
              'div',
              { class: 'kaiju-chip' },
              h('div', { class: 'kn' }, k.name, ' ', h('span', { class: 'tag cat' + k.category }, 'CAT ' + CATEGORY_LABEL[k.category]), e.level > 1 ? h('span', { class: 'tag', style: { marginLeft: '4px' } }, 'LV ' + e.level) : null),
              h('div', { class: 'kd' }, k.desc),
              h('div', { style: { fontSize: '0.8em', color: 'var(--muted)' } }, `Integrità: ${hp}`),
            );
          }),
        ),
        h(
          'div',
          { class: 'footer' },
          h(
            'div',
            {},
            h('div', { class: 'credits' }, 'Ricompensa: ' + formatCredits(m.reward)),
            res?.done ? h('div', { style: { fontSize: '0.85em', color: 'var(--muted)' } }, 'Miglior tempo ', formatTime(res.bestTime), ' · ', stars(res.stars)) : null,
            h('div', { style: { fontSize: '0.85em', color: 'var(--muted)' } }, 'Titano: ', h('b', { style: { color: 'var(--text)' } }, robot.name)),
          ),
          h(
            'div',
            { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
            button('Hangar', () => this.app.showHangar(), 'small'),
            unlocked ? button('Lancia Titano ▶', () => this.app.startMission(m), 'primary', { sound: 'confirm' }) : h('div', { class: 'tag' }, 'COMPLETA LA MISSIONE PRECEDENTE'),
          ),
        ),
      );
    };
    renderList();
    renderBrief();
  }

  // ---------- hangar ----------
  hangar() {
    const el = this._screen('hangar-screen', 'hangar');
    this.hangarUI = new HangarUI(this.app, el, this);
  }

  // ---------- risultati ----------
  results(result) {
    const { won, mode, mission, stats } = result;
    let reward = 0;
    let starsN = 0;
    let firstClear = false;
    let next = null;
    const lines = [
      ['Tempo', formatTime(stats.time)],
      ['Danni inflitti', Math.round(stats.dmgDealt).toLocaleString('it-IT')],
      ['Danni subiti', Math.round(stats.dmgTaken).toLocaleString('it-IT')],
      ['Combo massima', stats.maxCombo],
      ['Parate perfette', stats.perfect],
      ['Kaiju abbattuti', stats.kills],
    ];
    if (mode === 'survival') {
      const waves = stats.waves || 0;
      lines.unshift(['Ondate superate', waves]);
      reward = waves * 160 + stats.kills * 60 + Math.round(stats.dmgDealt * 0.04);
      const best = save.data.survivalBest || 0;
      if (waves > best) {
        save.data.survivalBest = waves;
        lines.push(['Nuovo record!', '★']);
      }
    } else if (won) {
      const par = 50 + mission.enemies.reduce((s, e) => s + KAIJU[e.type].category * 25 * (1 + 0.2 * (e.level - 1)), 0);
      starsN = 1 + (stats.hpLeft >= 0.5 ? 1 : 0) + (stats.time <= par ? 1 : 0);
      firstClear = save.completeMission(mission.id, { time: stats.time, stars: starsN });
      reward = mission.reward + starsN * 100 + (firstClear ? Math.round(mission.reward * 0.5) : 0);
      const idx = MISSIONS.findIndex((m) => m.id === mission.id);
      next = MISSIONS[idx + 1] || null;
      lines.push(['Tempo obiettivo', formatTime(par)]);
    } else {
      reward = Math.min(Math.round(mission.reward * 0.4), Math.round(stats.dmgDealt * 0.15));
    }
    save.addCredits(reward);
    save.recordBattle({ won, kills: stats.kills });

    const title = mode === 'survival' ? 'FINE SOPRAVVIVENZA' : won ? 'MISSIONE COMPIUTA' : 'TITANO ABBATTUTO';
    const box = h(
      'div',
      { class: 'results panel' },
      h('div', { class: 'rtitle ' + (won || mode === 'survival' ? 'win' : 'lose') }, title),
      mode !== 'survival' && won ? h('div', { class: 'rstars' }, Array.from({ length: 3 }, (_, i) => h('span', { class: i < starsN ? '' : 'off' }, '★'))) : null,
      h('div', { class: 'rgrid' }, lines.map(([a, b]) => [h('span', {}, a), h('b', {}, String(b))])),
      h('div', { class: 'reward' }, '+ ' + formatCredits(reward), firstClear ? h('div', { style: { fontSize: '0.6em' } }, 'BONUS PRIMA VITTORIA INCLUSO') : null),
      !won && mode !== 'survival'
        ? h('div', { style: { fontSize: '0.85em', color: 'var(--muted)' } }, 'Suggerimento: para appena prima che il Kaiju colpisca e potenzia il Titano nell\'hangar.')
        : null,
      h(
        'div',
        { style: { display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' } },
        next && mode !== 'survival' ? button('Prossima missione ▶', () => this.app.startMission(next), 'primary', { sound: 'confirm' }) : null,
        button('Riprova', () => this.app.restartBattle(), next ? '' : 'primary'),
        button(mode === 'survival' ? 'Menu' : 'Missioni', () => (mode === 'survival' ? this.app.showMenu() : (this.app.showMenu(), this.app.showMissions()))),
        button('Hangar', () => this.app.showHangar()),
      ),
    );
    const back = h('div', { class: 'modal-back', style: { background: 'rgba(2,4,10,0.55)' } }, box);
    back.dataset.dismiss = 'no';
    setTimeout(() => {
      this.root.append(back);
      if (reward > 0) audio.ui('buy');
    }, 300);
  }

  // ---------- impostazioni ----------
  settings() {
    const s = save.settings;
    const set = (k, v) => {
      save.setSetting(k, v);
      this.app.applySettings();
    };
    const slider = (label, key) => {
      const out = h('span', { style: { width: '3em', textAlign: 'right', fontFamily: 'Orbitron', fontSize: '0.8em' } }, Math.round(s[key] * 100) + '%');
      const inp = h('input', { type: 'range', min: 0, max: 100, value: Math.round(s[key] * 100) });
      inp.addEventListener('input', () => {
        set(key, inp.value / 100);
        out.textContent = inp.value + '%';
      });
      inp.addEventListener('change', () => audio.ui('click'));
      return h('div', { class: 'setting' }, h('span', {}, label), h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, inp, out));
    };
    const toggle = (label, key) => {
      const t = h('button', { class: 'toggle' + (s[key] ? ' on' : '') });
      t.addEventListener('click', () => {
        set(key, !save.settings[key]);
        t.classList.toggle('on', save.settings[key]);
        audio.ui('click');
        if (key === 'vibration' && save.settings[key]) audio.vibrate(40);
      });
      return h('div', { class: 'setting' }, h('span', {}, label), t);
    };
    const qualities = [
      ['auto', 'Auto'],
      ['low', 'Bassa'],
      ['medium', 'Media'],
      ['high', 'Alta'],
    ];
    const qualityNote = h('div', { style: { fontSize: '0.8em', color: 'var(--muted)' } }, '');
    const qChips = h(
      'div',
      { class: 'chips' },
      qualities.map(([id, name]) => {
        const c = h('button', { class: 'chip' + ((s.quality || 'auto') === id ? ' sel' : '') }, name);
        c.addEventListener('click', () => {
          set('quality', id);
          qChips.querySelectorAll('.chip').forEach((x) => x.classList.remove('sel'));
          c.classList.add('sel');
          audio.ui('click');
          clear(qualityNote);
          qualityNote.append('La nuova qualità sarà applicata al riavvio. ', button('Riavvia ora', () => location.reload(), 'small'));
        });
        return c;
      }),
    );
    const body = [
      slider('Musica', 'music'),
      slider('Effetti sonori', 'sfx'),
      h('div', { class: 'setting' }, h('span', {}, 'Qualità grafica'), qChips),
      qualityNote,
      toggle('Vibrazione', 'vibration'),
      toggle('Annunci vocali', 'voice'),
      toggle('Mostra FPS', 'showFps'),
      h(
        'div',
        { class: 'setting' },
        h('span', {}, 'Progressi'),
        h('div', {}, button('Azzera progressi', () => this._confirmReset(), 'danger small')),
      ),
    ];
    const m = modal(this.root, 'IMPOSTAZIONI', body, [button('Chiudi', () => m.remove(), 'primary')]);
  }

  _confirmReset() {
    const m = modal(this.root, 'AZZERARE I PROGRESSI?', [h('p', {}, 'Perderai crediti, pezzi sbloccati, Titani e missioni completate. Le impostazioni resteranno.')], [
      button('Annulla', () => m.remove()),
      button(
        'Azzera',
        () => {
          save.reset();
          document.querySelectorAll('.modal-back').forEach((x) => x.remove());
          this.app.showMenu();
          toast(this.root, 'Progressi azzerati');
        },
        'danger',
      ),
    ]);
  }

  // ---------- guida ----------
  help() {
    const keys = (rows) => h('div', { class: 'keys' }, rows.map(([k, v]) => [h('span', {}, k.split(' ').map((x) => h('kbd', {}, x)).reduce((a, b) => [a, ' ', b])), h('span', {}, v)]));
    const body = [
      h(
        'p',
        { style: { margin: 0, color: '#b9cfdd', lineHeight: 1.4 } },
        'I Kaiju emergono dalla Frattura nel Pacifico. Pilota il tuo Titano, sconfiggili e guadagna crediti per sbloccare nuovi pezzi nell\'hangar. Ogni braccio ha la sua arma: alterna i colpi per creare combo e riempire la Sincronia neurale.',
      ),
      h(
        'div',
        { class: 'help-grid' },
        h('div', {}, h('h3', {}, 'TASTIERA E MOUSE'), keys([['W A S D', 'Movimento'], ['J', 'Braccio sinistro (click sx)'], ['K', 'Braccio destro (click dx)'], ['L', 'Parata (tieni premuto)'], ['Spazio', 'Scatto / schivata'], ['E', 'Mossa speciale'], ['Q', 'Cambia bersaglio'], ['Esc', 'Pausa']])),
        h('div', {}, h('h3', {}, 'TOUCH'), keys([['Joystick', 'Trascina a sinistra per muoverti'], ['SX DX', 'Attacchi con le due braccia'], ['PARA', 'Tieni premuto per parare'], ['SCATTO', 'Schivata rapida'], ['SPEC.', 'Mossa speciale'], ['⌖', 'Cambia bersaglio']])),
        h('div', {}, h('h3', {}, 'GAMEPAD'), keys([['Stick', 'Movimento'], ['X Y', 'Braccio sinistro / destro'], ['LB', 'Parata'], ['A', 'Scatto'], ['B', 'Speciale'], ['RB', 'Cambia bersaglio'], ['Start', 'Pausa']])),
      ),
      h('h3', { style: { fontSize: '0.8em', color: 'var(--warn)' } }, 'CONSIGLI DA PILOTA'),
      h(
        'ul',
        { class: 'tips' },
        h('li', {}, 'Para appena prima dell\'impatto per una PARATA PERFETTA: il Kaiju resta stordito. Il mirino diventa rosso quando il Kaiju carica un colpo e bianco quando è il momento di parare.'),
        h('li', {}, 'Quando un Kaiju brilla sta caricando un attacco: scatta di lato o para.'),
        h('li', {}, 'Gli attacchi pesanti (Pugno a Razzo, Martello) sbilanciano i Kaiju più in fretta.'),
        h('li', {}, 'Il Cannone al Plasma consuma il reattore: tieni d\'occhio la barra gialla.'),
        h('li', {}, 'Ogni torso ha una mossa speciale diversa. Provale tutte nell\'hangar!'),
      ),
    ];
    const m = modal(this.root, 'COME SI GIOCA', body, [button('Chiudi', () => m.remove(), 'primary')]);
  }

  // ---------- installazione ----------
  async install() {
    if (this.app.deferredInstall) {
      const e = this.app.deferredInstall;
      e.prompt();
      const choice = await e.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') {
        this.app.deferredInstall = null;
        toast(this.root, 'Installazione avviata!');
      }
      return;
    }
    let steps;
    if (isIOS()) {
      steps = [
        'Apri questa pagina con Safari.',
        'Tocca il pulsante Condividi (il quadrato con la freccia verso l\'alto).',
        'Scegli "Aggiungi alla schermata Home" e conferma.',
        'Avvia Rift Titans dall\'icona: si aprirà a schermo intero e funzionerà anche offline.',
      ];
    } else if (isAndroid()) {
      steps = [
        'Apri questa pagina con Chrome.',
        'Tocca il menu ⋮ in alto a destra.',
        'Scegli "Installa app" (oppure "Aggiungi a schermata Home").',
        'In alternativa scarica l\'APK Android dalla pagina Releases del progetto su GitHub.',
      ];
    } else {
      steps = [
        'Con Chrome o Edge: clicca l\'icona di installazione nella barra degli indirizzi (monitor con freccia) oppure Menu → "Installa Rift Titans".',
        'In alternativa scarica la versione per Windows, macOS o Linux dalla pagina Releases del progetto su GitHub.',
      ];
    }
    const m = modal(this.root, 'INSTALLA RIFT TITANS', [h('ol', { class: 'tips' }, steps.map((s) => h('li', {}, s)))], [button('Ho capito', () => m.remove(), 'primary')]);
  }
}
