// #70 Holiday — a year of public holidays with the names hidden; guess the country.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

const zh = (cc) => { try { return new Intl.DisplayNames(['zh-Hans'], { type: 'region' }).of(cc); } catch { return cc; } };
const WEEKEND = (y, md) => [0, 6].includes(new Date(`${y}-${md}T00:00:00Z`).getUTCDay());

/** Hide the country's own name/capital inside holiday names. */
export function redact(text, country) {
  const words = [country.name, country.capital.name, ...country.name.split(/[\s,]+/)]
    .filter((w) => w && w.length > 3 && !/^(and|the|of|republic|islands?)$/i.test(w));
  let out = text;
  // match on a stem so "Mexico" also hides "Mexican", "Norway" hides "Norwegian"
  const stems = words.map((w) => (w.includes(' ') ? w : w.slice(0, Math.max(4, w.length - 2))));
  for (const w of stems) out = out.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*', 'gi'), '▇▇▇');
  return out;
}

export default {
  meta: {
    num: 70,
    slug: 'holiday',
    title: 'Holiday',
    tagline: '一整年的法定假日日历，名字全部藏起来。看日期猜国家。',
    category: 'society',
    data: 'snapshot',
    howTo: [
      '日历上标出了某个国家今年所有的法定假日：主色是全国假日，黄色只在部分地区放假。',
      '从列表里选一个国家来猜，最多 6 次。每猜错一次多解锁一条线索。',
      '每次猜测会显示你猜的国家首都离答案多远、在哪个方向，以及两国有几个假日落在同一天。',
      '提示：复活节前后的连休说明是基督教国家；日期每年漂移的假日多半跟着阴历或伊斯兰历。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'Nager.Date Public Holiday API', url: 'https://date.nager.at/' },
      { name: 'GeoNames（首都坐标）', url: 'https://download.geonames.org/export/dump/' },
    ],
  },

  puzzle({ data, pick }) {
    const country = pick(data.countries);
    return { year: data.year, cc: country.cc };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const byCC = new Map(ctx.data.countries.map((c) => [c.cc, c]));
    const ans = byCC.get(p.cc);
    const H = ans.holidays;

    // clue 0 — the calendar
    const cells = [];
    for (let m = 1; m <= 12; m++) {
      const days = new Date(Date.UTC(p.year, m, 0)).getUTCDate();
      for (let d = 1; d <= days; d++) {
        const md = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const hol = H.find((x) => x.d === md);
        cells.push({ m, d, md, kind: hol ? (hol.global ? '全国假日' : '地区假日') : WEEKEND(p.year, md) ? '周末' : '平日' });
      }
    }
    const calendar = await ui.plot((Plot, c) => ({
      height: 300,
      marginLeft: 36,
      padding: 0.12,
      x: { label: null, ticks: [1, 5, 10, 15, 20, 25, 31], tickSize: 0 },
      y: { label: null, tickFormat: (m) => `${m}月`, tickSize: 0 },
      color: { domain: ['全国假日', '地区假日', '周末', '平日'], range: [c.accent, c.near, c.rule, c.paper2] },
      marks: [
        Plot.cell(cells, { x: 'd', y: 'm', fill: 'kind', rx: 2, title: (x) => `${x.md} · ${x.kind}` }),
      ],
    }));

    const uniq = (xs) => xs.filter((x, i) => xs.findIndex((y) => y.name === x.name) === i);
    const generic = uniq(H.slice().sort((a, b) => b.common - a.common)).slice(0, 3);
    const rare = uniq(H.slice().sort((a, b) => a.common - b.common)).slice(0, 2);
    const regional = H.filter((x) => !x.global).length;
    const onWeekend = H.filter((x) => WEEKEND(p.year, x.d)).length;
    const nameList = (xs, key = 'name') => ui.h('ul', { style: { margin: '4px 0 0', paddingLeft: '1.2em' } }, xs.map((x) => ui.h('li', ui.h('span', { class: 'mono small muted' }, `${x.d}  `), redact(x[key], ans))));

    const clues = [
      ui.h('div', calendar, ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '14px', marginTop: '6px' } },
        ui.h('span', ui.h('span', { style: { color: 'var(--accent)' } }, '■'), ' 全国假日'),
        ui.h('span', ui.h('span', { style: { color: 'var(--near)' } }, '■'), ' 地区假日'),
        ui.h('span', ui.h('span', { style: { color: 'var(--rule)' } }, '■'), ' 周末'))),
      `今年共 ${H.length} 个假日，其中 ${regional} 个只在部分地区放假，${onWeekend} 个落在周末。`,
      ui.h('div', '最常见的三个假日（很多国家都有）：', nameList(generic)),
      ui.h('div', '最独特的两个假日（英文名，国名已涂掉）：', nameList(rare)),
      ui.h('div', '其中一个假日的当地语言名称：', nameList([rare[0]], 'local')),
      `首都的英文名以 “${ans.capital.name[0]}” 开头。`,
    ];

    const options = ctx.data.countries.map((c) => ({ id: c.cc, label: zh(c.cc), hint: c.name, aliases: [c.name, c.cc] }));
    const res = await ctx.guess({
      options,
      answer: ans.cc,
      maxGuesses: 6,
      title: '这是哪个国家？',
      placeholder: '输入国家名（中文或英文）…',
      clues,
      cluesTitle: '日历和线索',
      columns: ['首都距离', '方向', '同日假日'],
      near: (g, a) => haversineKm(byCC.get(g.id).capital, byCC.get(a.id).capital) < 1000,
      feedback: (g) => {
        const gc = byCC.get(g.id);
        if (gc.cc === ans.cc) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, { text: `${H.length}/${H.length}`, state: 'hit', num: true }];
        const km = haversineKm(gc.capital, ans.capital);
        const shared = gc.holidays.filter((x) => H.some((y) => y.d === x.d)).length;
        return [
          { text: fmtKm(km), num: true, state: km < 1000 ? 'near' : undefined },
          { text: arrow(bearingDeg(gc.capital, ans.capital)) },
          { text: `${shared}/${H.length}`, num: true, state: shared >= H.length * 0.6 ? 'near' : undefined },
        ];
      },
    });

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `${zh(ans.cc)}（${ans.name}）${p.year} 年的全部假日：`),
      ui.table({
        columns: [{ key: 'd', label: '日期' }, { key: 'name', label: '名称' }, { key: 'local', label: '当地名称' }],
        rows: H,
      }));
    return res;
  },
};
