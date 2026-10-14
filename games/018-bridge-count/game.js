// #18 Bridge Count — given yesterday's weather, rank the East River bridges by cyclists and guess the total.

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** WMO weather code -> short Chinese label. */
export function weatherLabel(code, snow = 0, rain = 0) {
  if (snow > 0.1 || (code >= 71 && code <= 77) || code === 85 || code === 86) return '下雪';
  if (code >= 95) return '雷暴';
  if (code >= 61 || (code >= 80 && code <= 82) || rain > 0.05) return rain > 0.5 ? '大雨' : '有雨';
  if (code >= 51) return '毛毛雨';
  if (code >= 45) return '有雾';
  if (code === 3) return '阴天';
  if (code >= 1) return '晴间多云';
  return '晴天';
}

export const total = (c) => c.reduce((a, b) => a + b, 0);

export default {
  meta: {
    num: 18,
    slug: 'bridge-count',
    title: 'Bridge Count',
    tagline: '看一天的天气，猜东河四座桥上过了多少骑车人：先给四座桥排名，再估总数。',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      '给你一天的日期（含星期）、气温、降水和风速，以及四座桥「平常一天」的骑行人数作参照。',
      '第一步：把布鲁克林桥、曼哈顿桥、威廉斯堡桥、皇后区桥按这天的骑行人数从多到少排序。',
      '第二步：估这四座桥当天骑行人次的总和（对数滑块，差一倍约得 37 分）。',
      '提示：下雨、下雪、低温会让人数骤降；周末和暖和的夏日，布鲁克林桥（游客多）会明显反超。',
    ],
    scoring: '排序最多 3 次机会；总数按倍数误差计分；两部分各占一半。',
    sources: [
      { name: 'NYC DOT Bicycle Counts (Historical)', url: 'https://data.cityofnewyork.us/d/uczf-rk3c', note: '各桥自行车道的 15 分钟计数器，按日汇总' },
      { name: 'NYC DOT Bicycle Counters', url: 'https://data.cityofnewyork.us/d/smn3-rzf9', note: '计数器位置' },
      { name: 'Open-Meteo Historical Weather API', url: 'https://open-meteo.com/en/docs/historical-weather-api', note: '曼哈顿下城每日天气' },
    ],
    dataNote: '数据为 2022–2025 年的历史日数据（只取四座桥计数器全天完整的日子），不是「昨天」的实时数据，以保证每个人拿到同一天。曼哈顿桥等计数器只覆盖自行车道，不含行人。',
  },

  puzzle({ data, pick }) {
    const d = pick(data.days);
    return { date: d.date };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const D = ctx.data;
    const day = D.days.find((x) => x.date === p.date);
    const dt = new Date(`${day.date}T00:00:00Z`);
    const wd = WD[dt.getUTCDay()];
    const wx = weatherLabel(day.wc, day.snow, day.rain);
    ctx.log('puzzle', day.date, wx, day.c);

    ctx.stage.append(ui.panel({ kicker: '线索', title: `某一天：${wd}，${dt.getUTCMonth() + 1} 月` },
      ui.grid(110,
        ui.stat({ label: '天气', value: wx }),
        ui.stat({ label: '气温 °F', value: `${day.lo}–${day.hi}` }),
        ui.stat({ label: '降水 英寸', value: String(day.rain) }),
        ui.stat({ label: '最大风速 mph', value: String(day.wind) })),
      ui.h('div', { class: 'small muted', style: { marginTop: '10px' } }, '四座桥「平常一天」（2022–2025 中位数）的骑行人次：'),
      ui.table({ columns: [{ key: 'b', label: '桥' }, { key: 't', label: '平常一天', num: true }],
        rows: D.bridges.map((b, i) => ({ b, t: core.fmtNum(D.typical[i]) })) })));

    const items = D.bridges.map((b, i) => ({ id: String(i), label: b, value: day.c[i] }));
    const r1 = await ctx.order({ title: '1 / 2 · 给四座桥排名', prompt: '这天骑行人数从多到少排列', items: ctx.rng.shuffle(items), direction: 'desc', attempts: 3, format: (v) => core.fmtNum(v) });
    const sum = total(day.c);
    const r2 = await ctx.estimate({ title: '2 / 2 · 四座桥当天骑行总人次', answer: sum, min: 1000, max: 60000, log: true, step: 100, initial: total(D.typical), unit: '人次', format: (v) => core.fmtNum(Math.round(v)), scoring: 'log', scale: 0.3 });

    const res = ctx.combine([r1, r2]);
    const ratio = sum / total(D.typical);
    const top = items.slice().sort((a, b) => b.value - a.value)[0];
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({ columns: [{ key: 'b', label: '桥' }, { key: 'n', label: `${day.date} 人次`, num: true }, { key: 'r', label: '相对平常', num: true }],
        rows: D.bridges.map((b, i) => ({ b, n: core.fmtNum(day.c[i]), r: `${Math.round((day.c[i] / D.typical[i]) * 100)}%` })) }),
      ui.h('div', { class: 'ink2' }, `总计 ${core.fmtNum(sum)}，约为平常的 ${Math.round(ratio * 100)}%。${wd}、${wx}、${day.lo}–${day.hi}°F；${top.label}最多。` +
        (ratio < 0.6 ? ' 恶劣天气让通勤骑行大幅减少。' : ratio > 1.2 ? ' 好天气带来远高于平常的人流。' : '')));
    return res;
  },
};
