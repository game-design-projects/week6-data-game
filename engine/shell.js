// engine/shell.js — boots play.html?g=<dir>: loads the game module, builds
// ctx, renders the page chrome, runs play(), persists and shares the result.
import * as core from './core.js';
import * as dom from './dom.js';
import * as libs from './libs.js';
import * as presets from './presets.js';
import * as store from './store.js';

const { h } = dom;

export const CATEGORIES = {
  geo: 'Maps & Earth', nyc: 'NYC Open Data', money: 'Money & Prices', science: 'Earth, Life & Space', words: 'Words & Text',
  culture: 'Culture & Media', society: 'People & Society', tech: 'Internet & Tech', transit: 'Transit', levels: 'Data as Levels',
  literacy: 'Data Literacy', model: 'Model-driven',
};
export const DATA_KINDS = { live: ['Live', 'live'], snapshot: ['Snapshot', ''], computed: ['Computed', ''], synthetic: ['Synthetic', 'synthetic'] };

// ───────── logging ─────────
const LOG = (window.__dlog ??= []);
let debugEl = null;
let mirrorEl = null; // hidden <pre id="ddlog"> in smoke mode so headless checks can read logs from the DOM
function fmtArg(a) {
  if (a instanceof Error) return `${a.name}: ${a.message}`;
  if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
  return String(a);
}
export function makeLogger(prefix) {
  const mk = (scope) => {
    const tag = `[${prefix}${scope ? ':' + scope : ''}]`;
    const emit = (level, args) => {
      const line = `${new Date().toISOString().slice(11, 23)} ${level === 'log' ? '' : level.toUpperCase() + ' '}${tag} ${args.map(fmtArg).join(' ')}`;
      LOG.push(line);
      if (LOG.length > 500) LOG.shift();
      (level === 'error' ? console.error : level === 'warn' ? console.warn : console.debug)(line);
      if (debugEl) debugEl.textContent += line + '\n';
      if (mirrorEl) mirrorEl.textContent += line + '\n';
    };
    const f = (...a) => emit('log', a);
    f.warn = (...a) => emit('warn', a);
    f.error = (...a) => emit('error', a);
    f.scope = (s) => mk(scope ? `${scope}:${s}` : s);
    return f;
  };
  return mk('');
}

// ───────── fetch helpers ─────────
async function fetchWithTimeout(url, { timeout = 10000, ...init } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res;
  } finally { clearTimeout(t); }
}

/** fetch JSON with timeout + sessionStorage cache (per URL, per day). */
async function fetchJSON(url, { timeout, cache = true, log } = {}) {
  const key = `ddg:fetch:${url}`;
  if (cache) {
    try { const hit = sessionStorage.getItem(key); if (hit) return JSON.parse(hit); } catch { /* ignore */ }
  }
  log?.('fetch', url);
  const data = await (await fetchWithTimeout(url, { timeout })).json();
  if (cache) { try { sessionStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ } }
  return data;
}

// ───────── page chrome ─────────
/** '2026-10-15' → 'Thu, Oct 15, 2026' (style: 'short') or 'Thursday, October 15, 2026' ('long'). */
export function fmtLongDate(iso, style = 'short') {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: style, month: style, day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function howToBody(meta) {
  return h('div',
    h('ol', (meta.howTo ?? []).map((t) => h('li', t))),
    meta.scoring && h('p', { class: 'ink2' }, h('b', 'Scoring '), meta.scoring),
    h('p', { class: 'small muted' }, 'A new puzzle every day at local midnight. Everyone gets the same puzzle on the same day.'));
}

function sourcesBody(meta, dataKind) {
  return h('div', { class: 'ds-stack' },
    h('p', { class: 'ink2' }, `Data type: ${DATA_KINDS[dataKind]?.[0] ?? dataKind}`),
    h('ul', (meta.sources ?? []).map((s) => h('li', s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.name) : s.name, s.note ? h('span', { class: 'muted' }, ` — ${s.note}`) : null))),
    meta.dataNote && h('div', { class: 'ds-callout' }, meta.dataNote));
}

function statsBody(slug) {
  const s = store.stats(slug);
  return h('div', { class: 'ds-stack' },
    h('div', { class: 'ds-grid', style: { '--min': '110px' } },
      dom.stat({ label: 'Played', value: s.played }),
      dom.stat({ label: 'Average', value: core.fmtPct(s.avg) }),
      dom.stat({ label: 'Best', value: core.fmtPct(s.best) }),
      dom.stat({ label: 'Streak', value: s.streak })),
    s.hist.length ? dom.table({
      columns: [{ key: 'date', label: 'Date' }, { key: 'summary', label: 'Result' }, { key: 'score', label: 'Score', num: true, fmt: (v, r) => `${v}/${r.max}` }],
      rows: s.hist.slice(0, 14),
    }) : h('p', { class: 'muted' }, 'No results yet.'));
}

function countdown(el) {
  const tick = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    el.textContent = `Next puzzle in ${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  tick();
  setInterval(tick, 1000);
}

function verdict(frac) {
  if (frac >= 0.95) return 'Perfect.';
  if (frac >= 0.75) return 'Great!';
  if (frac >= 0.5) return 'Nice.';
  if (frac >= 0.25) return 'Close.';
  return 'Try again tomorrow.';
}

function shareText(meta, day, r) {
  const url = `${location.origin}${location.pathname}?g=${encodeURIComponent(new URLSearchParams(location.search).get('g'))}`;
  return `${meta.title} №${day} · ${core.fmtNum(r.score, Number.isInteger(r.score) ? 0 : 1)}/${r.max}\n${r.emoji}${r.summary ? `\n${r.summary}` : ''}\n${url}`;
}

function resultCard({ meta, slug, day, r, ctx, revisit = false }) {
  const frac = r.max ? r.score / r.max : 0;
  const s = store.stats(slug);
  const next = h('div', { class: 'next' });
  const copy = dom.button('Copy result', {
    variant: 'accent',
    onClick: async () => {
      const text = shareText(meta, day, r);
      try { await navigator.clipboard.writeText(text); dom.toast('Copied. Paste it anywhere.'); } catch { dom.modal({ title: 'Share', body: dom.code(text) }); }
    },
  });
  const again = dom.button(ctx.practice ? 'Practice again' : 'Replay in practice mode', {
    variant: 'ghost',
    onClick: () => { const u = new URL(location.href); u.searchParams.set('practice', '1'); location.href = u.href; },
  });
  const card = h('section', { class: 'ds-result', 'aria-live': 'polite' },
    h('div', { class: 'head' },
      h('div', h('div', { class: 'ds-kicker' }, revisit ? 'Already played today' : ctx.practice ? 'Practice result (not counted)' : "Today's result"), h('p', { class: 'verdict' }, verdict(frac)), r.summary && h('div', { class: 'ink2' }, r.summary)),
      dom.stat({ label: 'Score', value: `${core.fmtNum(r.score, Number.isInteger(r.score) ? 0 : 1)}/${r.max}`, big: true })),
    h('div', { class: 'emoji', style: { whiteSpace: 'pre-line' } }, r.emoji),
    r.detail && h('div', { style: { marginTop: '12px' } }, dom.toNode(r.detail)),
    h('div', { class: 'actions' }, copy, again, h('a', { class: 'ds-btn ghost', href: './' }, 'All games')),
    h('div', { class: 'small muted', style: { marginTop: '14px' } }, `Played ${s.played} · average ${core.fmtPct(s.avg)} · streak ${s.streak}`),
    next);
  countdown(next);
  return card;
}

// ───────── boot ─────────
export async function boot() {
  const params = new URLSearchParams(location.search);
  store.applyTheme(store.urlTheme());
  const dir = params.get('g');
  const today = core.todayISO();
  const reqDate = params.get('date');
  const date = core.isISODate(reqDate) && reqDate <= today ? reqDate : today;
  const autoplay = params.has('autoplay');
  const smoke = params.has('smoke') || autoplay;
  const practice = params.has('practice') || autoplay;
  const day = core.dayNumber(date);
  document.body.dataset.state = 'loading';
  if (smoke) document.documentElement.classList.add('ds-static'); // no animations → stable headless screenshots

  const root = document.getElementById('app');
  const stage = h('main', { class: 'ds-stage' });
  const log = makeLogger(dir ?? 'shell');
  if (smoke) { mirrorEl = document.body.appendChild(h('pre', { id: 'ddlog', hidden: true })); mirrorEl.textContent = LOG.join('\n') + '\n'; }
  if (params.has('debug')) { debugEl = document.body.appendChild(h('div', { class: 'ds-debug' })); debugEl.textContent = LOG.join('\n') + '\n'; }

  const fail = (err) => {
    log.error('fatal', err);
    document.body.dataset.state = 'error';
    document.body.dataset.error = String(err?.message ?? err);
    stage.append(dom.panel({ kicker: 'Something broke', title: "Today's puzzle didn't load" }, dom.callout(String(err?.message ?? err), 'bad'), h('p', { class: 'small muted', style: { marginTop: '10px' } }, 'Add ?debug=1 to the URL to see the log.')));
  };
  window.addEventListener('error', (e) => log.error('window.error', e.message, e.filename ?? '', e.lineno ?? ''));
  window.addEventListener('unhandledrejection', (e) => log.error('unhandledrejection', e.reason));

  if (!dir || !/^[\w-]+$/.test(dir)) {
    root.append(h('div', { class: 'ds-wrap' }, stage));
    fail(new Error('Missing or invalid game parameter ?g='));
    return;
  }

  const base = new URL(`../games/${dir}/`, import.meta.url);
  let game;
  try {
    game = (await import(new URL('game.js', base).href)).default;
    if (!game?.meta || typeof game.play !== 'function') throw new Error('game.js must export default { meta, play }');
  } catch (e) {
    root.append(h('div', { class: 'ds-wrap' }, stage));
    fail(e);
    return;
  }
  const meta = game.meta;
  const slug = meta.slug ?? dir;
  document.title = `${meta.title} · Daily Data №${day}`;
  document.body.dataset.cat = meta.category ?? '';
  log('boot', { dir, date, day, practice, autoplay });

  // ── chrome
  const themeBtn = h('button', { class: 'ds-iconbtn', title: 'Switch theme', 'aria-label': 'Switch theme' }, '◐');
  themeBtn.addEventListener('click', () => {
    const order = ['auto', 'light', 'dark'];
    const t = order[(order.indexOf(store.getTheme()) + 1) % 3];
    store.setTheme(t);
    dom.toast({ auto: 'Theme: match system', light: 'Theme: light', dark: 'Theme: dark' }[t]);
  });
  const helpBtn = h('button', { class: 'ds-iconbtn', title: 'How to play', 'aria-label': 'How to play' }, '?');
  const statsBtn = h('button', { class: 'ds-iconbtn', title: 'Stats', 'aria-label': 'Stats' }, '▤');
  const srcBtn = h('button', { class: 'ds-iconbtn', title: 'Data sources', 'aria-label': 'Data sources' }, 'ⓘ');
  const dataBadge = h('span');
  const go = (iso) => { const u = new URL(location.href); u.searchParams.set('date', iso); u.searchParams.delete('practice'); location.href = u.href; };
  const prev = h('button', { class: 'pill', title: 'Previous day', disabled: day <= 1, onClick: () => go(core.addDays(date, -1)) }, '‹');
  const next = h('button', { class: 'pill', title: 'Next day', disabled: date >= today, onClick: () => go(core.addDays(date, 1)) }, '›');
  const titleParts = String(meta.title).split(' ');
  root.append(
    h('div', { class: 'ds-topbar' }),
    h('div', { class: ['ds-wrap', meta.wide && 'wide'] },
      h('nav', { class: 'ds-nav' }, h('a', { class: 'back', href: './' }, '← Daily Data'), h('div', { class: 'tools' }, helpBtn, statsBtn, srcBtn, themeBtn)),
      h('header', { class: 'ds-masthead' },
        h('div', { class: 'ds-kicker' }, h('span', `№ ${String(meta.num).padStart(3, '0')}`), h('span', { class: 'dot' }), h('span', CATEGORIES[meta.category] ?? meta.category ?? '')),
        h('h1', { class: 'ds-title' }, titleParts.length > 1 ? [titleParts.slice(0, -1).join(' ') + ' ', h('em', titleParts.at(-1))] : h('span', meta.title)),
        h('p', { class: 'ds-tagline' }, meta.tagline),
        h('div', { class: 'ds-dateline' }, prev, h('span', { class: 'pill' }, `${fmtLongDate(date)} · №${day}`), next, dataBadge, practice ? dom.badge('Practice', 'practice') : null)),
      stage,
      h('footer', { class: 'ds-footer' }, 'Data: ', (meta.sources ?? []).map((s, i) => [i ? ' · ' : '', s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.name) : s.name]), h('br'), `Daily Data · ${meta.title} · NYU Lecture 6`)));
  helpBtn.addEventListener('click', () => dom.modal({ title: 'How to play', body: howToBody(meta) }));
  statsBtn.addEventListener('click', () => dom.modal({ title: 'Stats', body: statsBody(slug) }));

  const loading = stage.appendChild(h('div', { class: 'ds-loading' }, h('div', { class: 'ds-spinner' }), "Fetching today's data…"));

  try {
    // ── data: snapshot data.json (optional) then optional live loader
    let snapshot = null;
    try {
      const res = await fetch(new URL('data.json', base).href, { cache: 'no-cache' });
      if (res.ok) snapshot = await res.json();
      else if (res.status !== 404) log.warn('data.json', res.status);
    } catch (e) { log.warn('data.json unavailable', e); }

    const ctx = {
      dir, slug, meta, date, day, today, practice, autoplay, smoke,
      rng: core.makeRng(`${slug}:${date}:ui`),
      pick: (arr) => arr[core.dailyIndex(slug, day, arr.length)],
      data: snapshot,
      asset: (p) => new URL(p, base).href,
      fetchJSON: (url, o = {}) => fetchJSON(url, { ...o, log }),
      fetchText: async (url, o = {}) => (await fetchWithTimeout(url, o)).text(),
      log,
      stage,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      core,
      combine: core.combine,
      ui: { ...dom, plot: libs.plot, createMap: libs.createMap, lib: libs.lib, geo: libs.geo, tileUrl: libs.tileUrl },
    };
    for (const name of ['guess', 'estimate', 'pin', 'rounds', 'order', 'match', 'groups']) ctx[name] = (o) => presets[name](ctx, o);
    ctx.canvas = (o) => presets.canvasStage(ctx, o);

    let data = snapshot;
    let dataKind = meta.data ?? (snapshot ? 'snapshot' : 'computed');
    if (typeof game.load === 'function') {
      try {
        const live = await game.load(ctx);
        if (live != null) { data = live; log('live data ok'); }
      } catch (e) {
        log.warn('live load failed, using snapshot', e);
        if (meta.data === 'live') { dataKind = 'snapshot'; dom.toast('Live data is unavailable right now, so this uses the snapshot.'); }
      }
    }
    ctx.data = data;
    const [kindLabel, kindTone] = DATA_KINDS[dataKind] ?? [dataKind, ''];
    dataBadge.replaceWith(dom.badge(kindLabel, kindTone));
    srcBtn.addEventListener('click', () => dom.modal({ title: 'Data sources', body: sourcesBody(meta, dataKind) }));

    const puzzle = typeof game.puzzle === 'function'
      ? game.puzzle({ data, day, date, slug, rng: core.makeRng(`${slug}:${date}`), pick: ctx.pick })
      : null;
    log('puzzle ready');
    loading.remove();

    const prior = !practice ? store.getResult(slug, date) : null;
    if (prior) {
      document.body.dataset.state = 'done';
      stage.append(resultCard({ meta, slug, day, r: prior, ctx, revisit: true }));
      return;
    }
    if (!smoke && !store.seenHelp(slug)) { store.markHelp(slug); dom.modal({ title: 'How to play', body: howToBody(meta) }); }

    document.body.dataset.state = 'playing';
    const raw = await game.play(ctx, puzzle);
    const r = core.normalizeResult(raw);
    log('done', { score: r.score, max: r.max });
    if (!practice) store.saveResult(slug, date, r);
    document.body.dataset.state = 'done';
    const card = resultCard({ meta, slug, day, r, ctx });
    stage.append(card);
    if (!smoke) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    loading.remove();
    fail(e);
  }
}
