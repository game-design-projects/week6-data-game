// engine/gallery.js — the front page: every game as a card, filterable.
import { h, clear, badge } from './dom.js';
import { todayISO, dayNumber, normalize, fmtPct } from './core.js';
import * as store from './store.js';
import { CATEGORIES, DATA_KINDS, fmtLongDate } from './shell.js';

export async function gallery() {
  store.applyTheme(store.urlTheme());
  const root = document.getElementById('app');
  const today = todayISO();
  const day = dayNumber(today);
  let games = [];
  try {
    games = await (await fetch('games/index.json', { cache: 'no-cache' })).json();
  } catch (e) {
    console.error('[gallery] games/index.json missing — run `node scripts/registry.mjs`', e);
  }
  games.sort((a, b) => a.num - b.num);
  const played = games.filter((g) => store.getResult(g.slug, today)).length;

  const search = h('input', { class: 'ds-input', type: 'search', placeholder: 'Search games, mechanics, data sources…', 'aria-label': 'Search' });
  const chipsHost = h('div', { class: 'ds-chips' });
  const gridEl = h('div', { class: 'dd-cards' });
  const countEl = h('span', { class: 'small mono muted' });
  let cat = 'all';

  const counts = games.reduce((m, g) => m.set(g.category, (m.get(g.category) ?? 0) + 1), new Map());
  const renderChips = () => {
    clear(chipsHost);
    const all = [['all', `All ${games.length}`], ...Object.entries(CATEGORIES).filter(([k]) => counts.has(k)).map(([k, v]) => [k, `${v} ${counts.get(k)}`])];
    for (const [k, label] of all) {
      chipsHost.append(h('button', { class: ['ds-chip', cat === k && 'on'], type: 'button', dataset: { cat: k }, onClick: () => { cat = k; renderChips(); renderGrid(); } }, k !== 'all' && h('i', { class: 'dd-dot' }), label));
    }
  };
  const renderGrid = () => {
    const q = normalize(search.value);
    const list = games.filter((g) => (cat === 'all' || g.category === cat) && (!q || normalize(`${g.num} ${g.title} ${g.tagline} ${(g.sources ?? []).join(' ')}`).includes(q)));
    clear(gridEl);
    list.forEach((g, i) => {
      const r = store.getResult(g.slug, today);
      const [kindLabel, kindTone] = DATA_KINDS[g.data] ?? [g.data ?? '', ''];
      gridEl.append(h('a', { class: 'dd-card', href: `play.html?g=${encodeURIComponent(g.dir)}`, dataset: { cat: g.category }, style: { '--i': Math.min(i, 24) } },
        h('div', { class: 'top' }, h('span', { class: 'no' }, `№ ${String(g.num).padStart(3, '0')}`), r ? h('span', { class: 'done', title: 'Played today' }, `✓ ${r.max ? fmtPct(r.score / r.max) : ''}`) : null),
        h('h3', g.title),
        h('p', g.tagline),
        h('div', { class: 'foot' }, h('span', { class: 'cat' }, CATEGORIES[g.category] ?? g.category), kindLabel && badge(kindLabel, kindTone))));
    });
    countEl.textContent = `${list.length} ${list.length === 1 ? 'game' : 'games'}`;
    if (!list.length) gridEl.append(h('p', { class: 'muted' }, games.length ? 'No games match.' : 'No games registered yet. Run node scripts/registry.mjs.'));
  };
  search.addEventListener('input', renderGrid);

  const themeBtn = h('button', { class: 'ds-iconbtn', title: 'Switch theme', 'aria-label': 'Switch theme', onClick: () => { const o = ['auto', 'light', 'dark']; store.setTheme(o[(o.indexOf(store.getTheme()) + 1) % 3]); } }, '◐');
  root.append(
    h('div', { class: 'ds-topbar', style: { background: 'var(--ink)' } }),
    h('div', { class: 'ds-wrap wide' },
      h('nav', { class: 'ds-nav' }, h('span', { class: 'mono small muted' }, 'NYU · LECTURE 6 · DAILY DATA GAMES'), h('div', { class: 'tools' }, themeBtn)),
      h('header', { class: 'dd-mast' },
        h('div', { class: 'dd-rule' }, h('span', `№ ${day}`), h('span', fmtLongDate(today, 'long')), h('span', `Played today ${played}/${games.length}`)),
        h('h1', 'Daily ', h('em', 'Data')),
        h('p', { class: 'dd-lede' }, `${games.length} small games with a new puzzle every day, all built from public data: censuses, weather, earthquakes, dictionaries, Wikipedia pageviews, open government data… Everyone gets the same puzzle on the same day.`)),
      h('div', { class: 'dd-filters' }, h('div', { class: 'ds-row between' }, h('div', { style: { flex: '1 1 260px' } }, search), countEl), chipsHost),
      gridEl,
      h('footer', { class: 'ds-footer' }, 'Every game lists its data sources at the foot of its page and under ⓘ. Your scores stay in your browser.')));
  renderChips();
  renderGrid();
  document.body.dataset.state = 'done';
}
