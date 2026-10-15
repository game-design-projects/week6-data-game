// #72 Garage — the ten most-registered car brands of a New York county; guess the county.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

const cap = (s) => s.toLowerCase().replace(/(^|[\s-])\w/g, (m) => m.toUpperCase());
const brand = (data, k) => data.makes[k] || k;

/** Ratio line used in the "over-represented" clue. */
export function liftText(x) { return `${x[1].toFixed(1)}× 全州平均`; }

const ORIG = ['美系', '日韩系', '欧系'];
/** "美系 52% · 日韩系 36% · 欧系 7%" */
export function origText(o) { return o.map((v, i) => `${ORIG[i]} ${v}%`).join(' · '); }

/** Which brand-origin group deviates most from the state, as a sentence (used in the result card). */
export function patternText(c, data) {
  const diffs = c.orig.map((v, i) => v - data.stateOrig[i]);
  let k = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(diffs[i]) > Math.abs(diffs[k])) k = i;
  const d = diffs[k];
  const tone = k === 0 && d > 0 ? '美系（皮卡、SUV）偏多，通常是上州乡村或小城。'
    : k === 2 && d > 0 ? '欧系豪华品牌偏多，通常是纽约市区、长岛或哈德逊河谷的富裕郊区。'
    : k === 1 && d > 0 ? '日韩系偏多，通常是城区、大学城或山区（斯巴鲁）。'
    : k === 0 ? '美系比全州少，说明是都会区或日系占优的地方。'
    : k === 1 ? '日韩系比全州少，说明本地车主更偏爱美系或欧系。'
    : '欧系比全州少，说明很少有豪华品牌。';
  return `${ORIG[k]}占 ${c.orig[k]}%，比全州（${data.stateOrig[k]}%）${d > 0 ? '高' : '低'} ${Math.abs(d).toFixed(1)} 个百分点：${tone}`;
}

/** Score for winning on guess n of max (1-based); 0 when not won. */
export function scoreFor(n, won, max = 6) { return won ? Math.round(100 * (max - n + 1) / max) : 0; }

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
      '从纽约州 62 个县里选一个来猜，最多 6 次。每猜错一次多解锁一条线索（偏爱的品牌、美/日韩/欧系占比、总量、经纬度、首字母）。',
      '每次猜测会显示你猜的县离答案多远、在哪个方向。',
      '提示：皮卡和 GMC/Ram 多半在上州乡下；宝马、奔驰、保时捷、特斯拉扎堆在纽约市和长岛；斯巴鲁偏爱山区。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'NY DMV Vehicle, Snowmobile, and Boat Registrations（data.ny.gov）', url: 'https://data.ny.gov/Transportation/Vehicle-Snowmobile-and-Boat-Registrations/w4pv-hbkt' },
      { name: 'US Census Gazetteer 2023（县中心点）', url: 'https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html' },
    ],
    dataNote: '只统计 record_type=VEH、registration_class=PAS（乘用车）的有效注册，按车主所在县统计，2026 年 10 月快照；已排除州外注册。DMV 的品牌是 5 字符缩写（如 CHEVR），已人工映射为品牌名并合并同一品牌的不同拼写（CHEV/CHEVY 等）；占比分母是该县全部乘用车，房车、拖车等未映射品牌仅占约 0.3%。国别分组按品牌总部所在地粗分（特斯拉、Rivian、Lucid 归美系）。官方数据实时更新，但本游戏使用固定快照，保证每个县的谜题不随日期漂移。',
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
      marginLeft: 110, marginRight: 36, marginBottom: 44,
      x: { label: '占该县乘用车 %', grid: true, labelAnchor: 'right' },
      y: { label: null, domain: ans.top.map((t) => brand(data, t[0])) },
      marks: [
        Plot.barX(ans.top, { x: (t) => t[1], y: (t) => brand(data, t[0]), fill: c.accent, sort: null }),
        Plot.text(ans.top, { x: (t) => t[1], y: (t) => brand(data, t[0]), text: (t) => `${t[1]}%`, dx: 4, textAnchor: 'start', fill: c.ink }),
        Plot.ruleX([0]),
      ],
    }), { width: Math.max(280, Math.min(560, (ctx.stage.clientWidth || 360) - 80)) });

    const side = ans.lng < -76.5 ? '西部' : ans.lng < -74.2 ? '中部' : '东部';
    const clues = [
      ui.h('div', bars),
      ui.h('div', '和全州平均相比，这个县特别偏爱：', ui.h('ul', { style: { margin: '4px 0 0', paddingLeft: '1.2em' } },
        ans.over.map((x) => ui.h('li', `${brand(data, x[0])}（${x[2]}%，${liftText(x)}）`)))),
      `按车厂国别：${origText(ans.orig)}（全州：${origText(data.stateOrig)}）。特斯拉占 ${ans.tesla}%（全州 ${data.stateShare.TESLA}%）；最不爱的品牌：${ans.under.map((x) => brand(data, x[0])).join('、')}。`,
      `该县共有约 ${ctx.core.fmtNum(Math.round(ans.total / 1000) * 1000)} 辆注册乘用车。`,
      `它位于纽约州的${side}（西经 ${Math.abs(ans.lng).toFixed(1)}°，北纬 ${ans.lat.toFixed(1)}°N）。`,
      `县名的英文以 “${ans.id[0]}” 开头。`,
    ];

    const options = data.counties.map((c) => ({ id: c.id, label: c.zh, hint: cap(c.id), aliases: [c.id, cap(c.id)] }));
    const res = await ctx.guess({
      options,
      answer: ans.id,
      maxGuesses: 6,
      scoring: (n, won) => scoreFor(n, won),
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
      ui.h('div', patternText(ans, data)),
      ui.h('div', `第一名是${brand(data, ans.top[0][0])}（${ans.top[0][1]}%）；特斯拉 ${ans.tesla}%，全州 ${data.stateShare.TESLA}%。最能暴露它的是相对全州的“偏爱”：`),
      ui.table({
        columns: [{ key: 'b', label: '品牌' }, { key: 's', label: '本县占比', num: true }, { key: 'st', label: '全州占比', num: true }, { key: 'r', label: '倍数', num: true }],
        rows: ans.over.map((x) => ({ b: brand(data, x[0]), s: `${x[2]}%`, st: `${data.stateShare[x[0]]}%`, r: `${x[1].toFixed(1)}×` })),
      }));
    return res;
  },
};
