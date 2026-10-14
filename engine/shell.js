// engine/shell.js — boots play.html?g=<dir>: loads the game module, builds
// ctx, renders the page chrome, runs play(), persists and shares the result.
import * as core from './core.js';
import * as dom from './dom.js';
import * as libs from './libs.js';
import * as presets from './presets.js';
import * as store from './store.js';

const { h } = dom;

export const CATEGORIES = {
  geo: '地图与地球', nyc: '纽约开放数据', money: '钱与价格', science: '地球、生物与太空', words: '词语与文本',
  culture: '文化与媒体', society: '人与社会', tech: '互联网与技术', transit: '交通', levels: '数据即关卡',
  literacy: '数据素养', model: '模型驱动',
};
export const DATA_KINDS = { live: ['实时', 'live'], snapshot: ['快照', ''], computed: ['计算', ''], synthetic: ['合成数据', 'synthetic'] };
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

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
function fmtLongDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}年${m}月${d}日 周${WEEK[core.weekday(iso)]}`;
}

function howToBody(meta) {
  return h('div',
    h('ol', (meta.howTo ?? []).map((t) => h('li', t))),
    meta.scoring && h('p', { class: 'ink2' }, h('b', '计分 '), meta.scoring),
    h('p', { class: 'small muted' }, '每天本地时间 0 点换一题。所有玩家同一天拿到同一道题。'));
}

function sourcesBody(meta, dataKind) {
  return h('div', { class: 'ds-stack' },
    h('p', { class: 'ink2' }, `数据类型：${DATA_KINDS[dataKind]?.[0] ?? dataKind}`),
    h('ul', (meta.sources ?? []).map((s) => h('li', s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.name) : s.name, s.note ? h('span', { class: 'muted' }, ` — ${s.note}`) : null))),
    meta.dataNote && h('div', { class: 'ds-callout' }, meta.dataNote));
}

function statsBody(slug) {
  const s = store.stats(slug);
  return h('div', { class: 'ds-stack' },
    h('div', { class: 'ds-grid', style: { '--min': '110px' } },
      dom.stat({ label: '已玩', value: s.played }),
      dom.stat({ label: '平均', value: core.fmtPct(s.avg) }),
      dom.stat({ label: '最佳', value: core.fmtPct(s.best) }),
      dom.stat({ label: '连续天数', value: s.streak })),
    s.hist.length ? dom.table({
      columns: [{ key: 'date', label: '日期' }, { key: 'summary', label: '结果' }, { key: 'score', label: '分数', num: true, fmt: (v, r) => `${v}/${r.max}` }],
      rows: s.hist.slice(0, 14),
    }) : h('p', { class: 'muted' }, '还没有记录。'));
}

function countdown(el) {
  const tick = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    el.textContent = `下一题还有 ${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  tick();
  setInterval(tick, 1000);
}

function verdict(frac) {
  if (frac >= 0.95) return '完美。';
  if (frac >= 0.75) return '漂亮！';
  if (frac >= 0.5) return '不错。';
  if (frac > 0) return '差一点。';
  return '明天再来。';
}

function shareText(meta, day, r) {
  const url = `${location.origin}${location.pathname}?g=${encodeURIComponent(new URLSearchParams(location.search).get('g'))}`;
  return `${meta.title} №${day} · ${core.fmtNum(r.score, Number.isInteger(r.score) ? 0 : 1)}/${r.max}\n${r.emoji}${r.summary ? `\n${r.summary}` : ''}\n${url}`;
}

function resultCard({ meta, slug, day, r, ctx, revisit = false }) {
  const frac = r.max ? r.score / r.max : 0;
  const s = store.stats(slug);
  const next = h('div', { class: 'next' });
  const copy = dom.button('复制成绩', {
    variant: 'accent',
    onClick: async () => {
      const text = shareText(meta, day, r);
      try { await navigator.clipboard.writeText(text); dom.toast('已复制，可以贴到群里了'); } catch { dom.modal({ title: '分享', body: dom.code(text) }); }
    },
  });
  const again = dom.button(ctx.practice ? '再练一次' : '练习模式再玩', {
    variant: 'ghost',
    onClick: () => { const u = new URL(location.href); u.searchParams.set('practice', '1'); location.href = u.href; },
  });
  const card = h('section', { class: 'ds-result', 'aria-live': 'polite' },
    h('div', { class: 'head' },
      h('div', h('div', { class: 'ds-kicker' }, revisit ? '今天已经玩过' : ctx.practice ? '练习成绩（不计入统计）' : '今日成绩'), h('p', { class: 'verdict' }, verdict(frac)), r.summary && h('div', { class: 'ink2' }, r.summary)),
      dom.stat({ label: '得分', value: `${core.fmtNum(r.score, Number.isInteger(r.score) ? 0 : 1)}/${r.max}`, big: true })),
    h('div', { class: 'emoji', style: { whiteSpace: 'pre-line' } }, r.emoji),
    r.detail && h('div', { style: { marginTop: '12px' } }, dom.toNode(r.detail)),
    h('div', { class: 'actions' }, copy, again, h('a', { class: 'ds-btn ghost', href: './' }, '全部游戏')),
    h('div', { class: 'small muted', style: { marginTop: '14px' } }, `已玩 ${s.played} 次 · 平均 ${core.fmtPct(s.avg)} · 连续 ${s.streak} 天`),
    next);
  countdown(next);
  return card;
}

// ───────── boot ─────────
export async function boot() {
  store.applyTheme();
  const params = new URLSearchParams(location.search);
  const dir = params.get('g');
  const today = core.todayISO();
  const reqDate = params.get('date');
  const date = core.isISODate(reqDate) && reqDate <= today ? reqDate : today;
  const autoplay = params.has('autoplay');
  const smoke = params.has('smoke') || autoplay;
  const practice = params.has('practice') || autoplay;
  const day = core.dayNumber(date);
  document.body.dataset.state = 'loading';

  const root = document.getElementById('app');
  const stage = h('main', { class: 'ds-stage' });
  const log = makeLogger(dir ?? 'shell');
  if (smoke) { mirrorEl = document.body.appendChild(h('pre', { id: 'ddlog', hidden: true })); mirrorEl.textContent = LOG.join('\n') + '\n'; }
  if (params.has('debug')) { debugEl = document.body.appendChild(h('div', { class: 'ds-debug' })); debugEl.textContent = LOG.join('\n') + '\n'; }

  const fail = (err) => {
    log.error('fatal', err);
    document.body.dataset.state = 'error';
    document.body.dataset.error = String(err?.message ?? err);
    stage.append(dom.panel({ kicker: '出错了', title: '这道题没能加载' }, dom.callout(String(err?.message ?? err), 'bad'), h('p', { class: 'small muted', style: { marginTop: '10px' } }, '加上 ?debug=1 可以看到日志。')));
  };
  window.addEventListener('error', (e) => log.error('window.error', e.message, e.filename ?? '', e.lineno ?? ''));
  window.addEventListener('unhandledrejection', (e) => log.error('unhandledrejection', e.reason));

  if (!dir || !/^[\w-]+$/.test(dir)) {
    root.append(h('div', { class: 'ds-wrap' }, stage));
    fail(new Error('缺少或无效的游戏参数 ?g='));
    return;
  }

  const base = new URL(`../games/${dir}/`, import.meta.url);
  let game;
  try {
    game = (await import(new URL('game.js', base).href)).default;
    if (!game?.meta || typeof game.play !== 'function') throw new Error('game.js 必须 export default { meta, play }');
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
  const themeBtn = h('button', { class: 'ds-iconbtn', title: '切换主题', 'aria-label': '切换主题' }, '◐');
  themeBtn.addEventListener('click', () => {
    const order = ['auto', 'light', 'dark'];
    const t = order[(order.indexOf(store.getTheme()) + 1) % 3];
    store.setTheme(t);
    dom.toast({ auto: '跟随系统', light: '浅色', dark: '深色' }[t]);
  });
  const helpBtn = h('button', { class: 'ds-iconbtn', title: '玩法', 'aria-label': '玩法' }, '?');
  const statsBtn = h('button', { class: 'ds-iconbtn', title: '统计', 'aria-label': '统计' }, '▤');
  const srcBtn = h('button', { class: 'ds-iconbtn', title: '数据来源', 'aria-label': '数据来源' }, 'ⓘ');
  const dataBadge = h('span');
  const go = (iso) => { const u = new URL(location.href); u.searchParams.set('date', iso); u.searchParams.delete('practice'); location.href = u.href; };
  const prev = h('button', { class: 'pill', title: '前一天', disabled: day <= 1, onClick: () => go(core.addDays(date, -1)) }, '‹');
  const next = h('button', { class: 'pill', title: '后一天', disabled: date >= today, onClick: () => go(core.addDays(date, 1)) }, '›');
  const titleParts = String(meta.title).split(' ');
  root.append(
    h('div', { class: 'ds-topbar' }),
    h('div', { class: ['ds-wrap', meta.wide && 'wide'] },
      h('nav', { class: 'ds-nav' }, h('a', { class: 'back', href: './' }, '← Daily Data'), h('div', { class: 'tools' }, helpBtn, statsBtn, srcBtn, themeBtn)),
      h('header', { class: 'ds-masthead' },
        h('div', { class: 'ds-kicker' }, h('span', `№ ${String(meta.num).padStart(3, '0')}`), h('span', { class: 'dot' }), h('span', CATEGORIES[meta.category] ?? meta.category ?? '')),
        h('h1', { class: 'ds-title' }, titleParts.length > 1 ? [titleParts.slice(0, -1).join(' ') + ' ', h('em', titleParts.at(-1))] : h('span', meta.title)),
        h('p', { class: 'ds-tagline' }, meta.tagline),
        h('div', { class: 'ds-dateline' }, prev, h('span', { class: 'pill' }, `${fmtLongDate(date)} · 第 ${day} 期`), next, dataBadge, practice ? dom.badge('练习', 'practice') : null)),
      stage,
      h('footer', { class: 'ds-footer' }, '数据：', (meta.sources ?? []).map((s, i) => [i ? ' · ' : '', s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.name) : s.name]), h('br'), `Daily Data · ${meta.title} · NYU Lecture 6`)));
  helpBtn.addEventListener('click', () => dom.modal({ title: '怎么玩', body: howToBody(meta) }));
  statsBtn.addEventListener('click', () => dom.modal({ title: '统计', body: statsBody(slug) }));

  const loading = stage.appendChild(h('div', { class: 'ds-loading' }, h('div', { class: 'ds-spinner' }), '正在取今天的数据…'));

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
        if (meta.data === 'live') { dataKind = 'snapshot'; dom.toast('实时数据暂时取不到，改用快照'); }
      }
    }
    ctx.data = data;
    const [kindLabel, kindTone] = DATA_KINDS[dataKind] ?? [dataKind, ''];
    dataBadge.replaceWith(dom.badge(kindLabel, kindTone));
    srcBtn.addEventListener('click', () => dom.modal({ title: '数据来源', body: sourcesBody(meta, dataKind) }));

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
    if (!smoke && !store.seenHelp(slug)) { store.markHelp(slug); dom.modal({ title: '怎么玩', body: howToBody(meta) }); }

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
