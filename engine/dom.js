// engine/dom.js — tiny hyperscript + design-system components.
// Every component returns a plain DOM element styled by engine/ds.css.

/**
 * h('div', {class: 'x', onClick: fn, style: {color: 'red'}}, 'text', child, [more])
 * - on* props become event listeners
 * - style may be a string or an object (CSS custom properties allowed: {'--i': 2})
 * - null / false / undefined children are skipped; arrays are flattened
 */
export function h(tag, props, ...children) {
  if (props instanceof Node || typeof props !== 'object' || props === null || Array.isArray(props)) {
    children.unshift(props);
    props = {};
  }
  const svg = ['svg', 'path', 'g', 'circle', 'line', 'rect', 'polyline', 'polygon', 'text'].includes(tag);
  const el = svg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sv == null) continue;
        if (sk.startsWith('--')) el.style.setProperty(sk, sv);
        else el.style[sk] = sv;
      }
    } else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else if (k in el && !svg && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Resolve "a node, a string, or a function returning either". */
export function toNode(x) {
  if (typeof x === 'function') x = x();
  if (x == null) return document.createTextNode('');
  return x instanceof Node ? x : h('span', String(x));
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

// ───────── layout ─────────

/** Card with optional kicker/title. `body` may be node(s) or string. */
export function panel({ title, kicker, body, aside, flush = false, plain = false, className } = {}, ...children) {
  const head = title || kicker || aside
    ? h('header', h('div', kicker && h('div', { class: 'kicker' }, kicker), title && h('h2', title)), aside)
    : null;
  return h('section', { class: ['ds-panel', flush && 'flush', plain && 'plain', className] }, head, body, children);
}

export const row = (...c) => h('div', { class: 'ds-row' }, c);
export const stack = (...c) => h('div', { class: 'ds-stack' }, c);
export const grid = (min, ...c) => h('div', { class: 'ds-grid', style: { '--min': typeof min === 'number' ? `${min}px` : min } }, c);

// ───────── text & data display ─────────

export const quote = (text) => h('blockquote', { class: 'ds-quote' }, text);
export const code = (text) => h('pre', { class: 'ds-code' }, text);
export const callout = (text, tone) => h('div', { class: ['ds-callout', tone] }, text);
/** Redacted span — black bar the width of the original text. */
export const redact = (text) => h('span', { class: 'ds-redact', 'aria-label': 'redacted' }, text);

export function stat({ label, value, sub, big = false }) {
  return h('div', { class: ['ds-stat', big && 'big'] }, h('span', { class: 'label' }, label), h('span', { class: 'value' }, value), sub && h('span', { class: 'sub' }, sub));
}

/** Definition list from [[k, v], …] or {k: v}. */
export function kv(pairs) {
  const list = Array.isArray(pairs) ? pairs : Object.entries(pairs);
  return h('dl', { class: 'ds-kv' }, list.map(([k, v]) => [h('dt', k), h('dd', toNode(v))]));
}

/**
 * table({columns: [{key, label, num, fmt}], rows: [{…}]})
 * `fmt(value, row)` may return a node.
 */
export function table({ columns, rows }) {
  return h('div', { class: 'ds-table-wrap' },
    h('table', { class: 'ds-table' },
      h('thead', h('tr', columns.map((c) => h('th', { class: c.num && 'num' }, c.label ?? c.key)))),
      h('tbody', rows.map((r) => h('tr', columns.map((c) => h('td', { class: c.num && 'num' }, toNode(c.fmt ? c.fmt(r[c.key], r) : r[c.key] ?? '—'))))))));
}

export function chips(items, { onClick, active } = {}) {
  return h('div', { class: 'ds-chips' }, items.map((it) => {
    const label = typeof it === 'string' ? it : it.label;
    const tag = onClick ? 'button' : 'span';
    return h(tag, { class: ['ds-chip', active === (it.value ?? label) && 'on'], type: onClick ? 'button' : null, onClick: onClick && (() => onClick(it)) }, label);
  }));
}

export function badge(text, tone) {
  return h('span', { class: ['ds-badge', tone] }, text);
}

export function button(label, { variant, onClick, disabled, small, block, type = 'button' } = {}) {
  return h('button', { class: ['ds-btn', variant, small && 'small', block && 'block'], type, disabled, onClick }, label);
}

/** One feedback tile. state: hit | near | miss | bad | blank | undefined. */
export function tile(text, { state, lead, num, title, i = 0 } = {}) {
  return h('div', { class: ['ds-tile', state, lead && 'lead', num && 'num'], title, style: { '--i': i } }, toNode(text));
}

/** Attempt pips: ● ● ○ ○ ○ */
export function pips(total, used, { won = false } = {}) {
  return h('span', { class: 'ds-pips', 'aria-label': `${used}/${total}` },
    Array.from({ length: total }, (_, i) => h('i', { class: i < used ? (won && i === used - 1 ? 'hit' : 'used') : null })));
}

// ───────── overlays ─────────

let toastHost;
export function toast(msg, ms = 2200) {
  toastHost ??= document.body.appendChild(h('div', { class: 'ds-toasts', role: 'status', 'aria-live': 'polite' }));
  const t = toastHost.appendChild(h('div', { class: 'ds-toast' }, msg));
  setTimeout(() => t.remove(), ms);
}

/** Opens a modal; returns a close() function. */
export function modal({ title, body, onClose } = {}) {
  const close = () => {
    root.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  const root = h('div', { class: 'ds-modal', role: 'dialog', 'aria-modal': 'true', onClick: (e) => e.target === root && close() },
    h('div', { class: 'sheet' },
      h('header', h('h3', title), h('button', { class: 'ds-iconbtn', 'aria-label': 'Close', onClick: close }, '✕')),
      toNode(body)));
  document.addEventListener('keydown', onKey);
  document.body.append(root);
  root.querySelector('button')?.focus();
  return close;
}

export function shake(el) {
  el.classList.remove('ds-shake');
  void el.offsetWidth;
  el.classList.add('ds-shake');
}

/** Colors resolved from CSS tokens at call time (theme-aware) — use in charts/canvas. */
export function colors() {
  const cs = getComputedStyle(document.body);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    paper: v('--paper'), paper2: v('--paper-2'), card: v('--card'), ink: v('--ink'), ink2: v('--ink-2'), muted: v('--muted'),
    rule: v('--rule'), accent: v('--accent'), hit: v('--hit'), near: v('--near'), miss: v('--miss'), bad: v('--bad'),
    /** Categorical palette for multi-series charts (accent first). */
    series: [v('--accent'), v('--ink'), '#d19a1e', '#2f7da8', '#8a5cc2', '#3f8f4f', '#c2412d', '#6f6a60'],
    font: v('--font-ui'), mono: v('--font-mono'), display: v('--font-display'),
  };
}
