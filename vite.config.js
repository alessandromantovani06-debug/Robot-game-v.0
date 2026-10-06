import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/**
 * Genera il service worker con la lista dei file da mettere in cache,
 * cosi' il gioco funziona offline una volta installato come app (PWA).
 */
function serviceWorkerPlugin() {
  return {
    name: 'rift-titans-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const publicFiles = [
        'manifest.webmanifest',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/maskable-512.png',
        'icons/apple-touch-icon.png',
        'icons/favicon.png',
      ];
      const precache = ['./', ...new Set([...files, ...publicFiles])].map((f) =>
        f === './' ? f : `./${f}`,
      );
      const version = `${pkg.version}-${Date.now().toString(36)}`;
      const template = readFileSync(new URL('./src/pwa/sw-template.js', import.meta.url), 'utf8');
      const source = template
        .replace('__CACHE_VERSION__', version)
        .replace('__PRECACHE_LIST__', JSON.stringify(precache, null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // Percorsi relativi: necessari per GitHub Pages, Capacitor (Android/iOS) ed Electron (PC).
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: 0,
  },
  plugins: [serviceWorkerPlugin()],
});
