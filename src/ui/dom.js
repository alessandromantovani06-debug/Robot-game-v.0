import { audio } from '../core/audio.js';

/** Crea un elemento DOM: h('div', { class: 'x', onClick: fn }, figli...) */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Pulsante con suono di click. */
export function button(label, onClick, cls = '', attrs = {}) {
  return h(
    'button',
    {
      class: 'btn ' + cls,
      ...attrs,
      onClick: (e) => {
        audio.unlock();
        audio.ui(attrs.sound || 'click');
        onClick?.(e);
      },
    },
    label,
  );
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function formatCredits(n) {
  return '₵ ' + Math.round(n).toLocaleString('it-IT');
}

export function formatTime(s) {
  s = Math.round(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function stars(n, max = 3) {
  return h(
    'span',
    { class: 'stars' },
    Array.from({ length: max }, (_, i) => h('span', { class: i < n ? '' : 'off' }, '★')),
  );
}

let toastTimer = null;
export function toast(root, text, ms = 1800) {
  root.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast panel' }, text);
  root.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

export function modal(root, title, body, actions = []) {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: 'modal panel' }, h('h2', {}, title), h('div', { class: 'body scroll' }, body), actions.length ? h('div', { class: 'actions' }, actions) : null);
  back.append(box);
  back.addEventListener('click', (e) => {
    if (e.target === back && back.dataset.dismiss !== 'no') back.remove();
  });
  root.append(back);
  return back;
}

/** Riga con barra di una statistica (con eventuale differenza evidenziata). */
export function statRow(s, diff = null) {
  const fill = h('i', { style: { width: Math.max(0.03, Math.min(1, s.norm)) * 100 + '%' } });
  const bar = h('div', { class: 'bar' }, fill);
  if (diff !== null && Math.abs(diff) > 0.005) {
    const a = Math.min(s.norm, s.norm - diff);
    const w = Math.abs(diff);
    bar.append(h('b', { class: diff < 0 ? 'neg' : '', style: { left: Math.max(0, a) * 100 + '%', width: w * 100 + '%' } }));
  }
  return h('div', { class: 'stat' }, h('span', {}, s.label), bar, h('span', { class: 'val' }, s.value));
}
