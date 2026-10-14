// #17 Turnstile — a station's hourly ridership curve (weekday vs weekend); name the station.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

const sum = (a, i = 0, j = a.length) => a.slice(i, j).reduce((x, y) => x + y, 0);
const hh = (h) => `${String(h).padStart(2, '0')}:00`;
const peakHour = (a) => a.indexOf(Math.max(...a));

/** Summarise a station's curves into the pattern features used for clues and teaching. */
export function profile(s) {
  const day = sum(s.wk);
  const am = sum(s.wk, 6, 10), pm = sum(s.wk, 16, 20), night = sum(s.wk, 22, 24) + sum(s.wk, 0, 4);
  const weekend = sum(s.we);
  const ratio = weekend / day;
  let kind;
  if (am > pm * 1.35) kind = '早高峰远高于晚高峰：居民区，人们在这里出发去上班';
  else if (pm > am * 1.35) kind = '晚高峰远高于早高峰：办公区，人们在这里下班回家';
  else if (ratio > 0.85) kind = '周末几乎和工作日一样忙：游客、购物或娱乐目的地';
  else kind = '早晚双峰接近：换乘枢纽或混合功能区';
  return { day, am, pm, night, weekend, ratio, peakWk: peakHour(s.wk), peakWe: peakHour(s.we), nightShare: night / day, kind };
}

export const lines = (name) => (name.match(/\(([^)]*)\)\s*$/) || [, ''])[1];
export const shortName = (name) => name.replace(/\s*\([^)]*\)\s*$/, '');

export default {
  meta: {
    num: 17,
    slug: 'turnstile',
    title: 'Turnstile',
    tagline: '某个纽约地铁站一天 24 小时的进站人数曲线，工作日 vs 周末。读懂人流的节奏，猜出是哪一站。',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      '图里是某个地铁站 2025 年 9 月平均每小时的进站人数：实线是工作日，虚线是周末。',
      '早高峰高说明是居民区（人们从这里出发），晚高峰高说明是办公区；周末不降反升说明是游客或娱乐目的地；深夜不空说明在市中心或夜生活区。',
      '从列表里选站名来猜，最多 6 次。每猜错一次多解锁一条线索（行政区、线路、首字母）。',
      '每次猜测会告诉你那一站离答案多远、在哪个方向、客流大小的倍数差、高峰时刻是否一致。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'MTA Subway Hourly Ridership: Beginning 2025 (NY Open Data)', url: 'https://data.ny.gov/Transportation/MTA-Subway-Hourly-Ridership-Beginning-2025/5wq4-mkjj', note: '按站、按小时汇总 2025-09 的刷卡进站人数，工作日去掉劳动节' },
    ],
    dataNote: '数据是 2025 年 9 月（工作日 21 天、周末 8 天）的日均值；答案只从客流最大的 160 个车站综合体里抽取，但所有 424 个站都可以猜。',
  },

  puzzle({ data, pick }) {
    const s = pick(data.stations.filter((x) => x.pool));
    return { id: s.id };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const all = ctx.data.stations;
    const byId = new Map(all.map((s) => [s.id, s]));
    const ans = byId.get(p.id);
    const pf = profile(ans);
    ctx.log('answer', ans.name, pf);

    const rows = [];
    for (let h = 0; h < 24; h++) {
      rows.push({ h, v: ans.wk[h], k: '工作日' });
      rows.push({ h, v: ans.we[h], k: '周末' });
    }
    const chart = await ui.plot((Plot, c) => ({
      height: 280,
      marginLeft: 52,
      x: { label: null, domain: [0, 23], ticks: [0, 6, 12, 18], tickFormat: (h) => `${h}时` },
      y: { label: '每小时进站人数', grid: true, tickFormat: (v) => core.fmtCompact(v) },
      marks: [
        Plot.lineY(rows.filter((r) => r.k === '工作日'), { x: 'h', y: 'v', stroke: c.accent, strokeWidth: 2.5, curve: 'monotone-x' }),
        Plot.lineY(rows.filter((r) => r.k === '周末'), { x: 'h', y: 'v', stroke: c.ink, strokeWidth: 2, strokeDasharray: '5 4', curve: 'monotone-x' }),
        Plot.ruleY([0]),
        Plot.tip(rows, Plot.pointerX({ x: 'h', y: 'v', title: (d) => `${d.k} ${hh(d.h)}\n${core.fmtNum(d.v)} 人/小时` })),
      ],
    }));

    const fact = (t) => ui.h('div', t);
    const clues = [
      ui.h('div', chart, ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '16px', marginTop: '6px' } },
        ui.h('span', ui.h('span', { style: { color: 'var(--accent)' } }, '━'), ' 工作日'),
        ui.h('span', '┄ 周末'))),
      fact(`全天约 ${core.fmtNum(Math.round(pf.day / 100) * 100)} 人次（工作日）；周末是工作日的 ${core.fmtNum(pf.ratio * 100)}%。工作日高峰在 ${hh(pf.peakWk)}，周末高峰在 ${hh(pf.peakWe)}。`),
      fact(`它在 ${ans.borough}。`),
      fact(`经过的线路：${lines(ans.name).split(',').join(' ')}`),
      fact(`站名首字母：“${shortName(ans.name)[0]}”，共 ${shortName(ans.name).length} 个字符。`),
    ];

    const label = (s) => s.name;
    const options = all.map((s) => ({ id: s.id, label: label(s), hint: s.borough, aliases: [shortName(s.name)] }));

    const res = await ctx.guess({
      options,
      answer: ans.id,
      maxGuesses: 6,
      title: '这是哪一站？',
      placeholder: '输入站名或线路…',
      cluesTitle: '人流曲线和线索',
      clues,
      columns: ['距离', '方向', '客流', '高峰'],
      near: (g, a) => haversineKm(byId.get(g.id), byId.get(a.id)) < 1.5,
      feedback: (g) => {
        const gs = byId.get(g.id);
        const gp = profile(gs);
        if (gs.id === ans.id) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, { text: '1.0×', state: 'hit', num: true }, { text: hh(gp.peakWk), state: 'hit', num: true }];
        const km = haversineKm(gs, ans);
        const q = pf.day / gp.day;
        return [
          { text: fmtKm(km), num: true, state: km < 1.5 ? 'near' : undefined },
          { text: arrow(bearingDeg(gs, ans)) },
          { text: q >= 1 ? `×${q.toFixed(1)}` : `÷${(1 / q).toFixed(1)}`, num: true, state: q > 0.75 && q < 1.33 ? 'near' : undefined },
          { text: hh(gp.peakWk), num: true, state: gp.peakWk === pf.peakWk ? 'hit' : Math.abs(gp.peakWk - pf.peakWk) <= 1 ? 'near' : undefined },
        ];
      },
    });

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['答案', ans.name],
        ['行政区', ans.borough],
        ['工作日客流', `${core.fmtNum(pf.day)} 人次/天`],
        ['早 / 晚高峰', `${core.fmtNum(pf.am)} / ${core.fmtNum(pf.pm)}（06–10 / 16–20 点）`],
        ['周末 ÷ 工作日', `${core.fmtNum(pf.ratio * 100)}%`],
        ['深夜占比', `${core.fmtNum(pf.nightShare * 100)}%（22–04 点）`],
      ]),
      ui.callout(`线索在曲线里：${pf.kind}。`, 'good'));
    ctx.log('result', res.score);
    return res;
  },
};
