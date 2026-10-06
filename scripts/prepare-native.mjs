// Prepara il progetto nativo Android con Capacitor.
// Uso: node scripts/prepare-native.mjs android
// (eseguire prima "npm run build")
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const platform = process.argv[2];
if (platform !== 'android') {
  console.error('Uso: node scripts/prepare-native.mjs android');
  process.exit(1);
}
if (!existsSync('dist/index.html')) {
  console.error('Manca la cartella dist: esegui prima "npm run build".');
  process.exit(1);
}

const run = (cmd, optional = false) => {
  console.log('> ' + cmd);
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    if (!optional) throw e;
    console.warn('  (passaggio facoltativo non riuscito, continuo)');
  }
};

function patch(file, fn) {
  if (!existsSync(file)) {
    console.warn('  file non trovato: ' + file);
    return;
  }
  const before = readFileSync(file, 'utf8');
  const after = fn(before);
  if (after !== before) {
    writeFileSync(file, after);
    console.log('  aggiornato ' + file);
  }
}

if (!existsSync(platform)) run(`npx cap add ${platform}`);

// icone e schermata di avvio generate da assets/
run(`npx --yes @capacitor/assets@3 generate --${platform} --iconBackgroundColor "#0a1626" --splashBackgroundColor "#04060c"`, true);

if (platform === 'android') {
  // gioco solo in orizzontale
  patch('android/app/src/main/AndroidManifest.xml', (xml) =>
    xml.includes('screenOrientation')
      ? xml
      : xml.replace(/<activity\b/, '<activity\n            android:screenOrientation="sensorLandscape"'),
  );
  // schermo intero, senza barra di stato
  patch('android/app/src/main/res/values/styles.xml', (xml) =>
    xml.includes('android:windowFullscreen')
      ? xml
      : xml.replace(
          /(<style name="AppTheme.NoActionBar"[^>]*>)/,
          '$1\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>',
        ),
  );
}

run(`npx cap sync ${platform}`);
console.log(`\nProgetto ${platform} pronto.`);
