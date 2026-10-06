// Rilevamento della piattaforma (browser, app installata, Android nativo, PC Electron).

export const isElectron = () => /Electron/i.test(navigator.userAgent);
export const isNative = () => !!window.Capacitor?.isNativePlatform?.();

export const isAndroid = () => /Android/i.test(navigator.userAgent);

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.matchMedia?.('(display-mode: fullscreen)').matches ||
  navigator.standalone === true ||
  isNative() ||
  isElectron();

/** Schermo intero + orientamento orizzontale sui telefoni (dove il browser lo consente). */
export function enterFullscreen() {
  if (isStandalone()) {
    screen.orientation?.lock?.('landscape').catch(() => {});
    return;
  }
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouch) return;
  const d = document.documentElement;
  const req = d.requestFullscreen || d.webkitRequestFullscreen;
  if (!req) return;
  try {
    Promise.resolve(req.call(d, { navigationUI: 'hide' }))
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => {});
  } catch {
    /* non supportato */
  }
}
