// #83 Departures — the full list of destinations from one airport; guess the airport.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

/** Count of destinations two airports share. */
export function sharedCount(a, b) {
  const s = new Set(a);
  return b.filter((x) => s.has(x)).length;
}

export default {
  meta: {
    num: 83,
    slug: 'departures',
    title: 'Departures',
    tagline: '某个机场的全部直飞航点列表。从目的地的分布，猜出这是哪个机场。',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      '给你一个机场所有直飞的目的地。机场名字和所在城市都被藏起来了。',
      '从列表里选一个机场来猜，最多 6 次。每猜错一次多解锁一条线索。',
      '每次猜测会显示你猜的机场离答案多远、在哪个方向，以及两个机场有多少个共同航点。',
      '提示：国内航点占比高说明是大国的内陆枢纽；一堆岛屿或同一国家的小机场，往往是某个区域航线网络的中心。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [{ name: 'OpenFlights routes & airports database', url: 'https://openflights.org/data.html', note: '数据快照约为 2014 年，航线可能已有变化' }],
    dataNote: 'OpenFlights 的航线数据停更于 2014 年前后，部分航线已停飞、新航线缺失；这里只当作一份“历史航班表”来玩。',
  },

  puzzle({ data, pick }) {
    return { code: pick(data.puzzles).a };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const by = new Map(ctx.data.airports.map((a) => [a.c, a]));
    const pz = ctx.data.puzzles.find((x) => x.a === p.code);
    const ans = by.get(p.code);
    const dests = pz.d.map((c) => by.get(c));
    ctx.log('answer', p.code, 'destinations', dests.length);

    const tally = {};
    for (const d of dests) tally[d.co] = (tally[d.co] ?? 0) + 1;
    const countries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const domestic = tally[ans.co] ?? 0;
    const hide = (s) => s.replace(new RegExp(ans.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '▇▇▇');
    const byDist = dests.map((d) => ({ ...d, km: haversineKm(ans, d) })).sort((a, b) => a.km - b.km);

    const clues = [
      ui.h('div', { class: 'ds-stack' },
        ui.h('div', { class: 'ds-grid', style: { '--min': '110px' } },
          ui.stat({ label: '直飞航点', value: String(dests.length) }),
          ui.stat({ label: '涉及国家', value: String(countries.length) }),
          ui.stat({ label: '同国航点', value: `${Math.round((domestic / dests.length) * 100)}%` })),
        ui.chips(countries.slice(0, 8).map(([c, n]) => `${c} ×${n}`))),
      ui.h('div', '全部航点的 IATA 代码：', ui.h('div', { class: 'mono small', style: { marginTop: '6px', lineHeight: 1.7 } }, pz.d.slice().sort().join(' '))),
      ui.h('div', '航点城市：', ui.h('div', { class: 'small ink2', style: { marginTop: '6px' } }, [...new Set(dests.map((d) => d.city))].sort().join(' · '))),
      ui.h('div', '最常飞这些航线的航空公司：', ui.h('div', { class: 'small ink2', style: { marginTop: '6px' } }, pz.al.map(([n, k]) => `${n}（${k} 条）`).join('、'))),
      `最近的航点：${byDist[0].city}（${fmtKm(byDist[0].km)}）；最远的航点：${byDist.at(-1).city}（${fmtKm(byDist.at(-1).km)}）。`,
      `机场所在国家：${ans.co}；城市名以 “${ans.city[0]}” 开头。`,
    ];

    const options = ctx.data.optionCodes.map((c) => {
      const a = by.get(c);
      return { id: c, label: `${a.city} · ${c}`, hint: `${a.n}, ${a.co}`, aliases: [a.n, a.co, c] };
    });
    const res = await ctx.guess({
      options, answer: p.code, maxGuesses: 6,
      title: '这是哪个机场？', placeholder: '输入城市、机场名或 IATA 代码…',
      clues, cluesTitle: '航班表和线索',
      columns: ['距离', '方向', '共同航点'],
      near: (g) => haversineKm(by.get(g.id), ans) < 800,
      feedback: (g) => {
        const ga = by.get(g.id);
        if (g.id === p.code) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, { text: `${dests.length}/${dests.length}`, state: 'hit', num: true }];
        const gp = ctx.data.puzzles.find((x) => x.a === g.id);
        const km = haversineKm(ga, ans);
        return [
          { text: fmtKm(km), num: true, state: km < 800 ? 'near' : undefined },
          { text: arrow(bearingDeg(ga, ans)) },
          gp ? { text: `${sharedCount(gp.d, pz.d)}`, num: true } : { text: '—' },
        ];
      },
    });
    ctx.log('result', res.score);

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['机场', `${ans.n}（${p.code}）`], ['城市', `${ans.city}，${ans.co}`], ['直飞航点', `${dests.length} 个，同国占 ${domestic} 个`], ['主要航司', pz.al.slice(0, 3).map((x) => x[0]).join('、')]]),
      ui.h('div', { class: 'small ink2' }, `线索：航点最集中在 ${countries.slice(0, 3).map((c) => c[0]).join('、')}。最远飞到 ${hide(byDist.at(-1).city)}（${fmtKm(byDist.at(-1).km)}）。`));
    return res;
  },
};
