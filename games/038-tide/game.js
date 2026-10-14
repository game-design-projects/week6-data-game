// #38 Tide — three days of a harbour's predicted tide curve; pin the port.
// One high tide a day -> Gulf of Mexico / Alaska diurnal; huge range -> funnel bays (Cook Inlet); tiny range -> Pacific atolls.

/** Local maxima of a series (strict on the left, non-strict on the right to handle plateaus). */
export function peaks(v) {
  const out = [];
  for (let i = 1; i < v.length - 1; i++) if (v[i] > v[i - 1] && v[i] >= v[i + 1]) out.push(i);
  return out;
}

/** Classify the tide type from hourly heights over 3 days. */
export function analyse(v) {
  const hi = peaks(v);
  const lo = peaks(v.map((x) => -x));
  const range = Math.max(...v) - Math.min(...v);
  const perDay = hi.length / (v.length / 24);
  // diurnal inequality: how unequal are consecutive lows (or highs)?
  const ineq = (idx) => (idx.length < 2 ? 0 : idx.slice(1).reduce((s, i, k) => s + Math.abs(v[i] - v[idx[k]]), 0) / (idx.length - 1) / (range || 1));
  const unequal = Math.max(ineq(hi), ineq(lo)) > 0.22;
  const kind = perDay < 1.35 ? 'diurnal' : unequal ? 'mixed' : 'semi';
  const type = { diurnal: '全日潮（每天约 1 次高潮）', mixed: '混合潮（两次高潮或低潮高低不等）', semi: '半日潮（每天约 2 次高潮，高度相近）' }[kind];
  return { hi, lo, range, perDay, type, kind };
}

const hhmm = (h) => `${String(h % 24).padStart(2, '0')}:00`;

export default {
  meta: {
    num: 38,
    slug: 'tide',
    title: 'Tide',
    tagline: '三天的潮汐曲线，猜是哪个港口。一天只有一次高潮，就该想到墨西哥湾。',
    category: 'science',
    data: 'snapshot',
    howTo: [
      '图里是某个验潮站 3 天（72 小时）的逐小时潮位预报，当地标准时间，0 为最低低潮面。',
      '数一数每天有几次高潮：一天一次（全日潮）常见于墨西哥湾、阿拉斯加部分海岸；一天两次且高度相近是大西洋沿岸的半日潮；两高两低不等是太平洋沿岸的混合潮。',
      '潮差也是线索：太平洋环礁只有几十厘米，漏斗形海湾可达数米甚至十米。',
      '在地图上标出验潮站。按距离计分，可以再试一次，会提示你偏向哪个方向。',
    ],
    scoring: '100 × e^(−距离/1500 km)，第二次尝试扣 10%。',
    sources: [
      { name: 'NOAA CO-OPS Tide Predictions API', url: 'https://api.tidesandcurrents.noaa.gov/api/prod/' },
      { name: 'NOAA CO-OPS Metadata API (stations)', url: 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/' },
    ],
    dataNote: '数据是 NOAA 官方调和分析预报（非实测水位），取 2026-10-01 至 10-03 三天、逐小时，共 110 个参考验潮站（最远点采样，覆盖美国沿岸、阿拉斯加、夏威夷及太平洋/加勒比海外站）。每个站固定一段曲线，每天抽一个站。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.stations).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const st = ctx.data.stations.find((s) => s.id === p.id);
    const a = analyse(st.v);
    ctx.log('station', st.name, 'range', a.range.toFixed(2), 'highs', a.hi.length);
    const rows = st.v.map((v, h) => ({ h, v }));
    const day = (h) => `第${Math.floor(h / 24) + 1}天`;
    const chart = await ui.plot((Plot, c) => ({
      height: 260,
      marginLeft: 44,
      x: { domain: [0, 71], ticks: [0, 12, 24, 36, 48, 60, 71], tickFormat: (h) => (h % 24 === 0 ? day(h) : hhmm(h)), label: null },
      y: { label: '潮位 (m)', grid: true, domain: [Math.min(0, ...st.v) - 0.1, Math.max(...st.v) + 0.15] },
      marks: [
        Plot.ruleX([24, 48], { stroke: c.rule, strokeDasharray: '3 4' }),
        Plot.areaY(rows, { x: 'h', y: 'v', y1: Math.min(...st.v), fill: c.accent, fillOpacity: 0.14, curve: 'basis' }),
        Plot.lineY(rows, { x: 'h', y: 'v', stroke: c.accent, strokeWidth: 2.5, curve: 'basis' }),
        Plot.dot(a.hi.map((h) => rows[h]), { x: 'h', y: 'v', fill: c.ink, r: 3.5 }),
        Plot.tip(rows, Plot.pointerX({ x: 'h', y: 'v', title: (d) => `${day(d.h)} ${hhmm(d.h)}\n${d.v.toFixed(2)} m` })),
      ],
    }));
    ctx.stage.append(ui.panel({ kicker: '3 天 · 逐小时 · 当地标准时间', title: '这个港口的潮汐' }, chart,
      ui.h('div', { class: 'ds-grid', style: { '--min': '130px', marginTop: '12px' } },
        ui.stat({ label: '最大潮差', value: `${a.range.toFixed(2)} m` }),
        ui.stat({ label: '高潮次数', value: `${a.hi.length}`, sub: '3 天内（黑点）' }),
        ui.stat({ label: '首个高潮', value: hhmm(a.hi[0] ?? 0), sub: '第 1 天' }))));

    const res = await ctx.pin({
      answer: { lat: st.lat, lng: st.lng, label: st.name },
      view: { center: [28, -120], zoom: 2 },
      scale: 1500,
      attempts: 2,
      title: '验潮站在哪里？',
    });
    const gap = a.hi.length > 1 ? (st.v.length / a.hi.length).toFixed(1) : '—';
    res.detail = ui.kv([
      ['验潮站', `${st.name}${st.state ? '，' + st.state : ''}`],
      ['坐标', `${st.lat.toFixed(2)}°, ${st.lng.toFixed(2)}°`],
      ['潮型', a.type],
      ['线索', `3 天内 ${a.hi.length} 次高潮（平均每 ${gap} 小时一次），最大潮差 ${a.range.toFixed(2)} m。` +
        ({ diurnal: '一天一次高潮：墨西哥湾、南海、阿拉斯加部分海岸的典型特征。', semi: '半日潮占主导：北大西洋沿岸最典型。', mixed: '日不等明显：北美太平洋沿岸典型的混合潮。' }[a.kind]) +
        (a.range < 1 ? ' 潮差很小，多半是开阔大洋的岛屿/环礁或半封闭海。' : a.range > 4 ? ' 潮差很大，多半是漏斗形海湾或高纬度陆架。' : '')],
    ]);
    return res;
  },
};
