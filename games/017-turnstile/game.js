// #17 Turnstile — a station's hourly ridership curve (weekday vs weekend); name the station.
import { haversineKm, bearingDeg, arrow } from '../../engine/core.js';

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
  if (ratio > 0.85) kind = '周末几乎和工作日一样忙：游客、购物或娱乐目的地';
  else if (am > pm * 1.35) kind = '早高峰远高于晚高峰：居民区，人们在这里出发去上班';
  else if (pm > am * 1.35) kind = '晚高峰远高于早高峰：办公区，人们在这里下班回家';
  else kind = '早晚双峰接近：换乘枢纽或混合功能区';
  return { day, am, pm, night, weekend, ratio, peakWk: peakHour(s.wk), peakWe: peakHour(s.we), nightShare: night / day, kind };
}

export const lines = (name) => (name.match(/\(([^)]*)\)\s*$/) || [, ''])[1];
export const shortName = (name) => name.replace(/\s*\([^)]*\)\s*$/, '');

/** Stops between two stations (fewest rail hops; a transfer inside a station complex costs 0). */
export function hopsBetween(data, i, j) {
  const c = data.hops[i][j];
  return c === '~' ? null : c.charCodeAt(0) - 48;  // one char per station: '0' + stops, '~' = unreachable
}

export const MAX_GUESSES = 6;
/** Win: 100 → 17 by guess count. Loss: up to 15 for getting close, measured in stops from the nearest miss. */
export function scoreGuess(n, won, best, max = MAX_GUESSES) {
  if (won) return Math.round((100 * (max - n + 1)) / max);
  return Math.round(15 * Math.max(0, 1 - (best ?? 12) / 12));
}

export default {
  meta: {
    num: 17,
    slug: 'turnstile',
    title: 'Turnstile',
    tagline: '某个纽约地铁站一天 24 小时的进站人数曲线，工作日 vs 周末。读懂人流的节奏，猜出是哪一站，误差按相隔站数计。',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      '图里是某个地铁站 2025 年 9 月平均每小时的进站人数：实线是工作日，虚线是周末。',
      '早高峰高说明是居民区（人们从这里出发），晚高峰高说明是办公区；周末不降反升说明是游客或娱乐目的地；深夜不空说明在市中心或夜生活区。',
      '从列表里选站名来猜，最多 6 次。每猜错一次多解锁一条线索（行政区、线路、客流排名、首字母）。',
      '每次猜测会告诉你它和答案之间隔了几站（沿线路最少站数，站内换乘不计）、所在方向、客流是答案的几倍、高峰时刻是否一致。',
    ],
    scoring: '第 1 次猜中 100 分，之后每多用一次少约 17 分；6 次都没猜中时，按离答案最近的那次猜测给 0–15 分（相隔 0 站满分，12 站及以上 0 分）。',
    sources: [
      { name: 'MTA Subway Hourly Ridership: Beginning 2025 (NY Open Data)', url: 'https://data.ny.gov/Transportation/MTA-Subway-Hourly-Ridership-Beginning-2025/5wq4-mkjj', note: '按站、按小时汇总 2025-09 的刷卡进站人数，工作日去掉劳动节' },
      { name: 'MTA Subway Stations (NY Open Data)', url: 'https://data.ny.gov/Transportation/MTA-Subway-Stations/39hk-dx4f', note: '车站综合体与 GTFS 站点编号对照' },
      { name: 'MTA static GTFS: subway', url: 'https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip', note: '用列车停靠顺序算出站与站之间隔几站' },
    ],
    dataNote: '数据是 2025 年 9 月（工作日 21 天、周末 8 天）的日均值，不是实时闸机计数；答案只从客流最大的 160 个车站综合体里抽取，但所有 424 个站都可以猜。“相隔站数”按 GTFS 列车停靠顺序取最少站数，站内换乘不计、步行换乘不计，且不区分快慢车。没有做实时抓取：题目要求每位玩家看到同一份数据，所以固定使用这个月度快照。',
  },

  puzzle({ data, pick }) {
    const s = pick(data.stations.filter((x) => x.pool));
    return { id: s.id };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const data = ctx.data;
    const all = data.stations;
    const byId = new Map(all.map((s) => [s.id, s]));
    const index = new Map(all.map((s, i) => [s.id, i]));
    const ans = byId.get(p.id);
    const pf = profile(ans);
    const profs = new Map(all.map((s) => [s.id, profile(s)]));
    const rank = 1 + all.filter((s) => profs.get(s.id).day > pf.day).length;
    const hopsTo = (id) => hopsBetween(data, index.get(id), index.get(ans.id));
    ctx.log('answer', ans.name, pf, 'rank', rank);

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
    const sn = shortName(ans.name);
    const clues = [
      ui.h('div', chart, ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '16px', marginTop: '6px' } },
        ui.h('span', ui.h('span', { style: { color: 'var(--accent)' } }, '━'), ' 工作日'),
        ui.h('span', '┄ 周末'))),
      fact(`所在行政区：${ans.borough}。`),
      fact(`经过的线路：${lines(ans.name).split(',').join(' ')}`),
      fact(`工作日客流在全部 ${all.length} 个站里排第 ${rank}。周末是工作日的 ${core.fmtNum(pf.ratio * 100)}%，周末高峰在 ${hh(pf.peakWe)}。`),
      fact(`站名首字母：“${sn[0]}”，共 ${sn.length} 个字符。`),
    ];

    const options = all.map((s) => ({ id: s.id, label: s.name, hint: s.borough, aliases: [shortName(s.name)] }));

    let best = null;
    const res = await ctx.guess({
      options,
      answer: ans.id,
      maxGuesses: MAX_GUESSES,
      title: '这是哪一站？',
      placeholder: '输入站名或线路…',
      cluesTitle: '人流曲线和线索',
      clues,
      columns: ['站数', '方向', '客流', '高峰'],
      near: (g) => (hopsTo(g.id) ?? 99) <= 3,
      onGuess: (g) => { const k = hopsTo(g.id); if (k != null && (best == null || k < best)) best = k; ctx.log('guess', g.label, k, 'stops'); },
      scoring: (n, won) => scoreGuess(n, won, best),
      feedback: (g) => {
        const gs = byId.get(g.id);
        const gp = profs.get(gs.id);
        if (gs.id === ans.id) return [{ text: '0 站', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, { text: '1.0×', state: 'hit', num: true }, { text: hh(gp.peakWk), state: 'hit', num: true }];
        const k = hopsTo(gs.id);
        const q = pf.day / gp.day;
        return [
          { text: k == null ? '—' : `${k} 站`, num: true, state: k != null && k <= 3 ? 'near' : undefined },
          { text: arrow(bearingDeg(gs, ans)) },
          { text: q >= 1 ? `×${q.toFixed(1)}` : `÷${(1 / q).toFixed(1)}`, num: true, state: q > 0.75 && q < 1.33 ? 'near' : undefined },
          { text: hh(gp.peakWk), num: true, state: gp.peakWk === pf.peakWk ? 'hit' : Math.abs(gp.peakWk - pf.peakWk) <= 1 ? 'near' : undefined },
        ];
      },
    });

    const pm = pf.pm / pf.am;
    const tells = [
      `早高峰（06–10 点）${core.fmtNum(pf.am)}，晚高峰（16–20 点）${core.fmtNum(pf.pm)}，晚/早 = ${pm.toFixed(2)}：${pm > 1.35 ? (pf.ratio > 0.85 ? '晚高峰更高，但周末同样热闹，不只是通勤' : '晚高峰明显更高，下班回家的人多，偏办公区') : pm < 1 / 1.35 ? (pf.ratio > 0.85 ? '早高峰更高，但周末同样热闹，不只是通勤' : '早高峰明显更高，出门上班的人多，偏居民区') : '早晚接近，没有明显的单向通勤'}。`,
      `周末是工作日的 ${core.fmtNum(pf.ratio * 100)}%：${pf.ratio > 0.85 ? '几乎不掉，说明靠游客和休闲人流撑着' : pf.ratio < 0.5 ? '大幅下降，说明主要靠通勤' : '中等程度下降，通勤和休闲各占一部分'}。`,
      `深夜（22–04 点）占全天 ${core.fmtNum(pf.nightShare * 100)}%：${pf.nightShare > 0.12 ? '夜里依然有人，多在市中心或夜生活区' : '夜里很安静，更像居住或办公区'}。`,
    ];
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['答案', ans.name],
        ['行政区', ans.borough],
        ['工作日客流', `${core.fmtNum(pf.day)} 人次/天（全市第 ${rank}）`],
        ['高峰时刻', `工作日 ${hh(pf.peakWk)}，周末 ${hh(pf.peakWe)}`],
        ['你的最近一猜', best == null ? '—' : best === 0 ? '命中' : `相隔 ${best} 站`],
      ]),
      ui.callout(`线索在曲线里：${pf.kind}。`, 'good'),
      ui.h('ul', { class: 'small ink2' }, ...tells.map((t) => ui.h('li', t))));
    ctx.log('result', res.score);
    return res;
  },
};
