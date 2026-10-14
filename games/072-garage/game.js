// #72 Garage — the ten most-registered car brands of a New York county; guess the county.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

const cap = (s) => s.toLowerCase().replace(/(^|[\s-])\w/g, (m) => m.toUpperCase());
const brand = (data, k) => data.makes[k] || k;

/** Ratio line used in the "over-represented" clue. */
export function liftText(x) { return `${x[1].toFixed(1)}× 全州平均`; }

export default {
  meta: {
    num: 72,
    slug: 'garage',
    title: 'Garage',
    tagline: '纽约州某个县注册量前十的汽车品牌。看车库猜县。',
    category: 'society',
    data: 'snapshot',
    howTo: [
      '给你一个纽约州县的乘用车注册量前十品牌（占该县全部乘用车的百分比）。',
      '从 62 个县里选一个来猜，最多 6 次。每猜错一次多解锁一条线索。',
      '每次猜测会显示你猜的县离答案多远、在哪个方向。',
      '提示：皮卡和 GMC/Ram 多半在上州乡下；宝马、奔驰、保时捷、特斯拉扎堆在纽约市和长岛；斯巴鲁偏爱山区。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'NY DMV Vehicle, Snowmobile, and Boat Registrations（data.ny.gov）', url: 'https://data.ny.gov/Transportation/Vehicle-Snowmobile-and-Boat-Registrations/w4pv-hbkt' },
      { name: 'US Census Gazetteer 2023（县中心点）', url: 'https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html' },
    ],
    dataNote: '只统计 record_type=VEH、registration_class=PAS（乘用车）的有效注册，按车主所在县统计，2026 年 10 月快照；已排除州外注册。品牌取 DMV 的 5 字符缩写并人工映射为品牌名。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.counties).id };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const byId = new Map(data.counties.map((c) => [c.id, c]));
    const ans = byId.get(p.id);
    ctx.log('answer county', ans.id);

    const bars = await ui.plot((Plot, c) => ({
      height: 300,
      marginLeft: 110, marginRight: 36,
      x: { label: '占该县乘用车 %', grid: true },
      y: { label: null, domain: ans.top.map((t) => brand(data, t[0])) },
      marks: [
        Plot.barX(ans.top, { x: (t) => t[1], y: (t) => brand(data, t[0]), fill: c.accent, sort: null }),
        Plot.text(ans.top, { x: (t) => t[1], y: (t) => brand(data, t[0]), text: (t) => `${t[1]}%`, dx: 4, textAnchor: 'start', fill: c.ink }),
        Plot.ruleX([0]),
      ],
    }), { width: 310 });

    const side = ans.lng < -76.5 ? '西部' : ans.lng < -74.2 ? '中部' : '东部';
    const clues = [
      ui.h('div', bars),
      ui.h('div', '和全州平均相比，这个县特别偏爱：', ui.h('ul', { style: { margin: '4px 0 0', paddingLeft: '1.2em' } },
        ans.over.map((x) => ui.h('li', `${brand(data, x[0])}（${x[2]}%，${liftText(x)}）`)))),
      `特斯拉占 ${ans.tesla}%（全州 ${data.stateShare.TESLA}%）；最不爱的品牌：${ans.under.map((x) => brand(data, x[0])).join('、')}。`,
      `该县共有约 ${ctx.core.fmtNum(Math.round(ans.total / 1000) * 1000)} 辆注册乘用车。`,
      `它位于纽约州的${side}（西经 ${Math.abs(ans.lng).toFixed(1)}°，北纬 ${ans.lat.toFixed(1)}°N）。`,
      `县名的英文以 “${ans.id[0]}” 开头。`,
    ];

    const options = data.counties.map((c) => ({ id: c.id, label: c.zh, hint: cap(c.id), aliases: [c.id, cap(c.id)] }));
    const res = await ctx.guess({
      options,
      answer: ans.id,
      maxGuesses: 6,
      title: '这是纽约州哪个县？',
      placeholder: '输入县名（中文或英文）…',
      clues,
      cluesTitle: '车库线索',
      columns: ['距离', '方向'],
      near: (g, a) => haversineKm(byId.get(g.id), byId.get(a.id)) < 80,
      feedback: (g) => {
        const gc = byId.get(g.id);
        if (gc.id === ans.id) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }];
        const km = haversineKm(gc, ans);
        return [{ text: fmtKm(km), num: true, state: km < 80 ? 'near' : undefined }, { text: arrow(bearingDeg(gc, ans)) }];
      },
    });
    ctx.log('result', res.score);

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案：${ans.zh}（${cap(ans.id)} County），约 ${ctx.core.fmtNum(ans.total)} 辆乘用车。`),
      ui.h('div', '最能暴露它的是相对全州的“偏爱”：'),
      ui.table({
        columns: [{ key: 'b', label: '品牌' }, { key: 's', label: '本县占比', num: true }, { key: 'st', label: '全州占比', num: true }, { key: 'r', label: '倍数', num: true }],
        rows: ans.over.map((x) => ({ b: brand(data, x[0]), s: `${x[2]}%`, st: `${data.stateShare[x[0]]}%`, r: `${x[1].toFixed(1)}×` })),
      }));
    return res;
  },
};
