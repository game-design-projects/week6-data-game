// #12 Forecast Match — five weather cards for one day, five cities. Pair them.
const hhmm = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

export default {
  meta: {
    num: 12,
    slug: 'forecast-match',
    title: 'Forecast Match',
    tagline: '五座城市同一天的天气卡片，把气温曲线和日出日落一一配到城市上。',
    category: 'geo',
    data: 'snapshot',
    howTo: [
      '每张卡片是某座城市当天的逐小时气温（当地时间）、云量、风、降水，以及日出日落时刻。',
      '线索：气温水平和季节（南北半球相反）；日出日落的间隔暴露纬度；昼夜温差大说明内陆或干燥；云量高 + 降水多常见于海洋和热带。',
      '把每张卡片配到右边的城市，共 3 次提交机会。',
    ],
    scoring: '每配对正确一张得分；用的提交次数越少分越高。',
    sources: [
      { name: 'Open-Meteo Historical Weather API (ERA5)', url: 'https://open-meteo.com/en/docs/historical-weather-api' },
    ],
    dataNote: '卡片使用 ERA5 再分析的真实逐小时数据（过去 12 个月内的某一天），而不是实时预报：这样每位玩家当天看到的题目完全一致，也能事后核对。',
  },

  puzzle({ data, rng, pick }) {
    const p = pick(data.puzzles);
    return { date: p.date, cities: p.cities, order: rng.shuffle(p.cities.map((_, i) => i)) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    ctx.log('forecast-match start', p.date);
    const labels = 'ABCDE';
    const bodies = await Promise.all(p.cities.map(async (c, i) => {
      const data = c.t.map((v, h) => ({ h, v }));
      const chart = await ui.plot((Plot, col) => ({
        height: 110, marginLeft: 34, marginBottom: 22, width: 300,
        x: { domain: [0, 23], ticks: [0, 6, 12, 18], label: null, tickFormat: (h) => `${h}时` },
        y: { label: null, ticks: 3, grid: true, tickFormat: (v) => `${v}°` },
        marks: [Plot.areaY(data, { x: 'h', y: 'v', fill: col.accent, fillOpacity: 0.15 }), Plot.lineY(data, { x: 'h', y: 'v', stroke: col.accent, strokeWidth: 2 })],
      }));
      return ui.h('div', null,
        ui.h('div', { class: 'small mono', style: { fontWeight: 700, marginBottom: '2px' } }, `卡片 ${labels[i]}`),
        chart,
        ui.h('div', { class: 'small mono ink2' }, `日出 ${hhmm(c.rise)} · 日落 ${hhmm(c.set)}`),
        ui.h('div', { class: 'small mono muted' }, `云 ${c.cloud}% · 风 ${c.wind} km/h · 雨 ${c.rain} mm`));
    }));

    ctx.stage.append(ui.panel({ kicker: `当天（${p.date}）· 当地时间`, title: '五张天气卡片' },
      ui.h('div', { class: 'small ink2' }, '时间轴为当地钟表时间；日出日落的钟点也是当地时间。')));

    const answer = {};
    p.cities.forEach((c, i) => { answer[`c${i}`] = `n${i}`; });
    const r = await ctx.match({
      left: bodies.map((body, i) => ({ id: `c${i}`, body })),
      right: p.order.map((i) => ({ id: `n${i}`, label: `${p.cities[i].name}（${p.cities[i].country}）` })),
      answer,
      attempts: 3,
      title: '配对城市',
    });

    r.detail = ui.table({
      columns: [{ key: 'card', label: '卡片' }, { key: 'city', label: '城市' }, { key: 'avg', label: '均温', num: true }, { key: 'rng', label: '温差', num: true }, { key: 'day', label: '白昼', num: true }],
      rows: p.cities.map((c, i) => ({
        card: labels[i], city: `${c.name}（纬度 ${c.lat.toFixed(0)}°）`,
        avg: `${mean(c.t).toFixed(1)}°`, rng: `${(Math.max(...c.t) - Math.min(...c.t)).toFixed(1)}°`, day: `${(c.set - c.rise + 24) % 24 < 0.1 ? '—' : ((c.set - c.rise + 24) % 24).toFixed(1)} h`,
      })),
    });
    ctx.log('forecast-match done', r.score);
    return r;
  },
};
