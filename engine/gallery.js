// engine/gallery.js — the front page: every game as a card, filterable.
import { h, clear, badge } from './dom.js';
import { todayISO, dayNumber, weekday, normalize, fmtPct } from './core.js';
import * as store from './store.js';
import { CATEGORIES, DATA_KINDS } from './shell.js';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

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

  const [y, m, d] = today.split('-').map(Number);
  const search = h('input', { class: 'ds-input', type: 'search', placeholder: '搜索游戏、玩法、数据源…', 'aria-label': '搜索' });
  const chipsHost = h('div', { class: 'ds-chips' });
  const gridEl = h('div', { class: 'dd-cards' });
  const countEl = h('span', { class: 'small mono muted' });
  let cat = 'all';

  const counts = games.reduce((m, g) => m.set(g.category, (m.get(g.category) ?? 0) + 1), new Map());
  const renderChips = () => {
    clear(chipsHost);
    const all = [['all', `全部 ${games.length}`], ...Object.entries(CATEGORIES).filter(([k]) => counts.has(k)).map(([k, v]) => [k, `${v} ${counts.get(k)}`])];
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
        h('div', { class: 'top' }, h('span', { class: 'no' }, `№ ${String(g.num).padStart(3, '0')}`), r ? h('span', { class: 'done', title: '今天已玩' }, `✓ ${r.max ? fmtPct(r.score / r.max) : ''}`) : null),
        h('h3', g.title),
        h('p', g.tagline),
        h('div', { class: 'foot' }, h('span', { class: 'cat' }, CATEGORIES[g.category] ?? g.category), kindLabel && badge(kindLabel, kindTone))));
    });
    countEl.textContent = `${list.length} 个`;
    if (!list.length) gridEl.append(h('p', { class: 'muted' }, games.length ? '没有匹配的游戏。' : '还没有注册任何游戏。运行 node scripts/registry.mjs。'));
  };
  search.addEventListener('input', renderGrid);

  const themeBtn = h('button', { class: 'ds-iconbtn', title: '切换主题', 'aria-label': '切换主题', onClick: () => { const o = ['auto', 'light', 'dark']; store.setTheme(o[(o.indexOf(store.getTheme()) + 1) % 3]); } }, '◐');
  root.append(
    h('div', { class: 'ds-topbar', style: { background: 'var(--ink)' } }),
    h('div', { class: 'ds-wrap wide' },
      h('nav', { class: 'ds-nav' }, h('span', { class: 'mono small muted' }, 'NYU · LECTURE 6 · DAILY DATA GAMES'), h('div', { class: 'tools' }, themeBtn)),
      h('header', { class: 'dd-mast' },
        h('div', { class: 'dd-rule' }, h('span', `第 ${day} 期`), h('span', `${y}年${m}月${d}日 星期${WEEK[weekday(today)]}`), h('span', `今天已玩 ${played}/${games.length}`)),
        h('h1', 'Daily ', h('em', 'Data')),
        h('p', { class: 'dd-lede' }, `${games.length} 个每天自动换题的小游戏。题目全部来自公开数据：人口普查、气象、地震、词典、维基百科浏览量、开放政府数据……同一天所有人拿到同一道题。`)),
      h('div', { class: 'dd-filters' }, h('div', { class: 'ds-row between' }, h('div', { style: { flex: '1 1 260px' } }, search), countEl), chipsHost),
      gridEl,
      h('footer', { class: 'ds-footer' }, '每个游戏的数据来源写在游戏页底部和 ⓘ 里。成绩只存在你的浏览器里。')));
  renderChips();
  renderGrid();
  document.body.dataset.state = 'done';
}
