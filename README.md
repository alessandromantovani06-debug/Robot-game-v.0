# RIFT TITANS — Difesa Kaiju

Gioco d'azione 3D in stile *Pacific Rim* con robot alla *Gundam*: costruisci e personalizza il tuo robot gigante (un **Titano**) e difendi le città costiere dai **Kaiju** che emergono dalla Frattura nel Pacifico.

Funziona su **PC** (Windows e Linux) e **Android**. È scritto in JavaScript con [Three.js](https://threejs.org/) e ha una grafica in stile anime: ombreggiatura a toni netti (*cel shading*) e contorni neri. I Titani sono costruiti a piastre corazzate su un telaio interno, con antenne a V, prese d'aria, gonne corazzate, zaini con propulsori, sciabole laser e decalcomanie; i Kaiju hanno masse muscolose, placche, file di aculei, denti, artigli e vene luminose. Tutta la grafica e l'audio sono generati dal codice, senza file esterni da scaricare.

## Caratteristiche

- **Hangar di costruzione**: scegli telaio, testa, torso, braccio sinistro e destro (ognuno con la sua arma), gambe e spalle. Poi vernicia il Titano con colori, finitura, livrea e sigla sulla spalla. Puoi tenere fino a 6 Titani diversi.
- **27 pezzi** con statistiche diverse. Si sbloccano con i crediti guadagnati in battaglia, e prima dell'acquisto puoi provarli sul robot.
- **5 teste** in stile anime: V-Fin, Monocolo, Elmo Samurai, Ottica Tripla, Corno Unicorno.
- **6 armi**: Pugno d'Acciaio, Pugno a Razzo, Sciabola Laser, Martello Sismico, Fucile Beam, Artigli Elettrici.
- **4 mosse speciali** (una per torso): Raggio Nucleare, Salva di Missili, Impulso Tesla, Furia Overdrive.
- **5 Kaiju** dalla Categoria I alla V: Squalor, Krakos, Viperion, Tonitrus e Leviathan. Ognuno ha attacchi propri: morsi, cariche, sputi acidi, colpi di coda, impulsi EMP e balzi.
- **Campagna di 10 missioni** in città diverse (Tokyo, Manila, Sydney, Lima, Anchorage, San Francisco, Hong Kong, Vladivostok) fino alla Frattura. Alcune missioni hanno due Kaiju insieme.
- **Modalità Sopravvivenza** a ondate infinite, con record personale.
- **Sistema di combattimento**: combo alternando le braccia, parata e **parata perfetta**, scatto con invulnerabilità, sincronia neurale che carica la mossa speciale, Kaiju che si infuriano e possono essere sbilanciati.
- Città notturne con grattacieli illuminati, insegne al neon, skyline all'orizzonte, riflettori, pioggia, neve, fulmini e oceano animato. Musica e suoni sintetizzati, annunci vocali in italiano, vibrazione su Android.
- Controlli per **tastiera e mouse**, **touch** (joystick virtuale) e **gamepad**.
- Si gioca **offline** dopo la prima apertura, e i progressi vengono salvati sul dispositivo.

## Come installarlo

### Da browser (Android e PC) — consigliato

Il gioco è una *Progressive Web App*: si installa direttamente dal browser e poi si avvia da un'icona come una normale app, a schermo intero e anche senza connessione.

1. Apri la pagina del gioco (vedi "Pubblicare il gioco online" qui sotto).
2. Installalo:
   - **Android (Chrome)**: menu ⋮ → **Installa app** (oppure il pulsante *Installa il gioco* nel menu del gioco).
   - **PC (Chrome / Edge)**: icona di installazione nella barra degli indirizzi, oppure Menu → **Installa Rift Titans**.

### App Android (APK)

GitHub Actions compila automaticamente l'APK a ogni modifica:

1. Vai nella scheda **Actions** del repository → ultima esecuzione di **Build** → sezione *Artifacts* → scarica **RiftTitans-android**.
   Se è stata creata una Release, l'APK si trova anche nella pagina **Releases**.
2. Copia `RiftTitans-android.apk` sul telefono, aprilo e consenti l'installazione da "origini sconosciute".

### PC: Windows e Linux

Nella stessa pagina (Actions → Artifacts, oppure Releases) trovi:

- **Windows**: `RiftTitans-Setup-x.y.z.exe` (installer) oppure `RiftTitans-Portable-x.y.z.exe` (si avvia senza installazione).
- **Linux**: `RiftTitans-x.y.z.AppImage` (rendilo eseguibile e avvialo).

Nella versione PC: **F11** schermo intero.

## Pubblicare il gioco online (GitHub Pages)

1. Nel repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Unisci le modifiche nel branch principale (`main`): il workflow **Build** pubblica il gioco su
   `https://<tuo-utente>.github.io/<nome-repository>/`.
3. Apri quell'indirizzo da qualsiasi dispositivo e installa il gioco come descritto sopra.

## Creare una Release con tutti i file

Crea un tag che inizia con `v` (per esempio da **Releases → Draft a new release → tag `v1.0.0`**, oppure da terminale con `git tag v1.0.0 && git push origin v1.0.0`). Il workflow compila APK, Windows, Linux e versione web, poi li allega alla Release.

## Comandi

| Tastiera e mouse | Touch | Gamepad | Azione |
| --- | --- | --- | --- |
| W A S D / frecce | joystick a sinistra | stick sinistro | Movimento |
| J / click sinistro | SX | X (□) | Attacco braccio sinistro |
| K / click destro | DX | Y (△) | Attacco braccio destro |
| L / Shift (tieni premuto) | PARA | LB | Parata |
| Spazio | SCATTO | A (✕) | Scatto / schivata |
| E | SPEC. | B (○) | Mossa speciale (sincronia al 100%) |
| Q / Tab | ⌖ | RB | Cambia bersaglio |
| Esc / P | ❚❚ | Start | Pausa |

**Consigli**: para *appena prima* del colpo per una parata perfetta, che stordisce il Kaiju (in parata il Titano si gira da solo verso il Kaiju che attacca). Quando un Kaiju si illumina sta caricando un attacco: para o scatta di lato. Alterna le braccia per allungare le combo.

## Sviluppo

Servono [Node.js](https://nodejs.org/) 22 o più recente.

```bash
npm install
npm run dev            # server di sviluppo (apri l'indirizzo mostrato, anche dal telefono in rete locale)
npm run build          # versione di produzione in dist/
npm run preview        # prova la versione di produzione
npm run desktop        # avvia la versione PC con Electron
npm run dist:desktop   # crea l'installer per il sistema operativo in uso (cartella release/)
npm run android        # crea il progetto Android con Capacitor e lo apre in Android Studio
npm run icons          # rigenera le icone (richiede Playwright)
```

### Struttura del codice

```
src/
  main.js              avvio, renderer 3D, qualità grafica adattiva, navigazione
  data/                pezzi dei robot, Kaiju e mosse, missioni, ambientazioni
  core/                salvataggi, audio sintetizzato, input, piattaforma
  render/              stile anime (toni netti e contorni), geometrie, robot, Kaiju, città, effetti, hangar
  game/                combattimento, IA dei Kaiju, animazioni, telecamera
  ui/                  menu, hangar, HUD di battaglia, controlli touch
dev/mecha.html         pagina di prova dei modelli (solo sviluppo)
electron/main.cjs      versione PC
scripts/               icone e preparazione dei progetti nativi
.github/workflows/     compilazione automatica per tutte le piattaforme
```

---

*Rift Titans è un progetto originale ispirato al genere mecha/kaiju. Non è affiliato a Pacific Rim né ai suoi detentori dei diritti.*
