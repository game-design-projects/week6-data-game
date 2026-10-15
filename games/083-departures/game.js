// #83 Departures — the full list of destinations from one airport; guess the airport.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

export const MAX_GUESSES = 6;
const REDACT = '▇▇▇';

/** Count of destinations two airports share. */
export function sharedCount(a, b) {
  const s = new Set(a);
  return b.filter((x) => s.has(x)).length;
}

/** 100 for a first-try hit, then -1/6 per extra guess, 0 if never found. */
export function scoreFor(n, won) {
  return won ? Math.round((100 * (MAX_GUESSES - n + 1)) / MAX_GUESSES) : 0;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Mask every occurrence of the answer's city name. */
export function maskCity(text, city) {
  return city ? text.replace(new RegExp(`(?<![\\p{L}])${esc(city)}(?![\\p{L}])`, 'giu'), REDACT) : text;
}

export const destCodes = (data, code) => (data.routes[code] ? data.routes[code].split(' ') : []);

/** Everything the clues and the explanation need, computed from the snapshot. Pure. */
export function analyze(data, code) {
  const by = new Map(data.airports.map((a) => [a.c, a]));
  const ans = by.get(code);
  const pz = data.puzzles.find((x) => x.a === code);
  const codes = destCodes(data, code);
  const dests = codes.map((c) => by.get(c));
  const tally = {};
  for (const d of dests) tally[d.co] = (tally[d.co] ?? 0) + 1;
  const countries = Object.entries(tally).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const domestic = tally[ans.co] ?? 0;
  const byDist = dests.map((d) => ({ ...d, km: haversineKm(ans, d) })).sort((a, b) => a.km - b.km || (a.c < b.c ? -1 : 1));
  const zh = (co) => data.countries[co] ?? co;
  const airlines = pz.al.map(([n, k]) => [maskCity(n, ans.city), k]);
  return { by, ans, pz, codes, dests, tally, countries, domestic, byDist, zh, airlines };
}

/** Plain-text view of clues 1–5 (before the country is given away) — used by the leak test. */
export function preCountryText(data, code) {
  const a = analyze(data, code);
  return [
    a.countries.slice(0, 8).map(([c, n]) => `${a.zh(c)} ×${n}`).join(' '),
    a.codes.join(' '),
    [...new Set(a.dests.map((d) => d.city))].join(' '),
    a.airlines.map(([n, k]) => `${n} ${k}`).join(' '),
    `${a.byDist[0].city} ${a.byDist.at(-1).city}`,
  ].join('\n');
}

export function explain(a, code) {
  const n = a.dests.length;
  const pct = Math.round((a.domestic / n) * 100);
  const [topAl, topK] = a.pz.al[0];
  const alPct = Math.round((topK / n) * 100);
  const far = a.byDist.at(-1);
  const bits = [];
  if (pct >= 60) bits.push(`同国航点占 ${pct}%（${a.domestic}/${n}）：以国内航线为主，是大国的国内枢纽。`);
  else if (pct <= 10) bits.push(`同国航点只占 ${pct}%（${a.domestic}/${n}）：几乎全是国际航线，常见于小国或中转枢纽。`);
  else bits.push(`同国航点占 ${pct}%（${a.domestic}/${n}）：国内与国际航线并重。`);
  const [c1, k1] = a.countries[0];
  bits.push(`最大的目的国是${a.zh(c1)}（${k1} 个，${Math.round((k1 / n) * 100)}%）。`);
  bits.push(alPct >= 50
    ? `${topAl} 一家就飞了其中 ${topK} 个航点（${alPct}%），说明它是这家航司的基地。`
    : `最大的航司 ${topAl} 只占 ${alPct}%，多家航司共用，是开放型枢纽。`);
  bits.push(`最远飞到 ${far.city}（${fmtKm(far.km)}），最近的是 ${a.byDist[0].city}（${fmtKm(a.byDist[0].km)}）。`);
  return bits.join('');
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
      '给你一个机场所有直飞的目的地，机场名字和所在城市都被藏起来了。',
      '从列表里选一个机场来猜，最多 6 次。每猜错一次多解锁一条线索：航点代码、航点城市、航空公司、最近和最远的航点，最后给出国家。',
      '每次猜测会显示你猜的机场离答案多远、在哪个方向，以及两个机场有多少个共同航点（占答案航点的比例）。',
      '计分：第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
      '提示：同国航点占比高说明是大国的国内枢纽；航点遍布很多国家则多是国际中转枢纽。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'OpenFlights routes, airports & airlines database', url: 'https://openflights.org/data.html', note: '航线数据停更于约 2014 年（仅取直飞、非代码共享的航司统计）' },
      { name: 'OpenFlights data on GitHub', url: 'https://github.com/jpatokal/openflights/tree/master/data' },
    ],
    dataNote: 'OpenFlights 航线数据停更于 2014 年前后，部分航线已停飞、新航线缺失，这里当作一份“历史航班表”来玩，不代表今天的航班。只统计从该机场出发的直飞航线；国家名为本游戏的中文译名，沿用 OpenFlights 当年的国别划分。没有找到可在浏览器里免密钥调用的较新航线接口（OpenSky 需账号，航司时刻表 API 需密钥），所以不做实时数据。',
  },

  puzzle({ data, pick }) {
    return { code: pick(data.puzzles).a };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const a = analyze(ctx.data, p.code);
    const { ans, by, dests, countries, domestic, byDist, zh } = a;
    const n = dests.length;
    ctx.log('answer', p.code, 'destinations', n);

    const clues = [
      ui.h('div', { class: 'ds-stack' },
        ui.h('div', { class: 'ds-grid', style: { '--min': '110px' } },
          ui.stat({ label: '直飞航点', value: String(n) }),
          ui.stat({ label: '涉及国家', value: String(countries.length) }),
          ui.stat({ label: '同国航点', value: `${Math.round((domestic / n) * 100)}%` })),
        ui.chips(countries.slice(0, 8).map(([c, k]) => `${zh(c)} ×${k}`))),
      ui.h('div', '全部航点的 IATA 代码：', ui.h('div', { class: 'mono small', style: { marginTop: '6px', lineHeight: 1.7 } }, a.codes.join(' '))),
      ui.h('div', '航点城市：', ui.h('div', { class: 'small ink2', style: { marginTop: '6px' } }, [...new Set(dests.map((d) => d.city))].sort().join(' · '))),
      ui.h('div', '承担这些航线最多的航空公司：', ui.h('div', { class: 'small ink2', style: { marginTop: '6px' } }, a.airlines.map(([nm, k]) => `${nm}（${k} 个航点）`).join('、'))),
      `最近的航点：${byDist[0].city}（${fmtKm(byDist[0].km)}）；最远的航点：${byDist.at(-1).city}（${fmtKm(byDist.at(-1).km)}）。`,
      `机场所在国家：${zh(ans.co)}（${ans.co}）；城市名以 “${ans.city[0]}” 开头。`,
    ];

    const options = ctx.data.optionCodes.map((c) => {
      const o = by.get(c);
      return { id: c, label: `${o.city} · ${c}`, hint: `${o.n}，${zh(o.co)}`, aliases: [o.n, o.co, zh(o.co), c] };
    });
    const res = await ctx.guess({
      options, answer: p.code, maxGuesses: MAX_GUESSES, scoring: scoreFor,
      title: '这是哪个机场？', placeholder: '输入城市或 IATA 代码…',
      clues, cluesTitle: '航班表和线索',
      columns: ['距离', '方向', '共同航点'],
      near: (g) => haversineKm(by.get(g.id), ans) < 800,
      feedback: (g) => {
        if (g.id === p.code) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, { text: `${n}/${n}`, state: 'hit', num: true }];
        const ga = by.get(g.id);
        const km = haversineKm(ga, ans);
        const sh = sharedCount(destCodes(ctx.data, g.id), a.codes);
        return [
          { text: fmtKm(km), num: true, state: km < 800 ? 'near' : undefined },
          { text: arrow(bearingDeg(ga, ans)) },
          { text: `${sh}/${n}`, num: true, state: sh / n >= 0.25 ? 'near' : undefined },
        ];
      },
    });
    ctx.log('result', res.score);

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['机场', `${ans.n}（${p.code}）`], ['城市', `${ans.city}，${zh(ans.co)}`], ['直飞航点', `${n} 个，同国 ${domestic} 个`], ['主要航司', a.pz.al.slice(0, 3).map((x) => x[0]).join('、')]]),
      ui.h('div', { class: 'small ink2' }, '线索解读：' + explain(a, p.code)));
    return res;
  },
};
