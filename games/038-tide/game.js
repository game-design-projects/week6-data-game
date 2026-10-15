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

/** Shape a CO-OPS hourly prediction response (3 days) into a puzzle series; throws if unusable. */
export function toPuzzle(raw, id, begin) {
  const rows = raw?.predictions;
  if (!Array.isArray(rows) || rows.length < 72) throw new Error('tide: need 72 hourly predictions');
  const v = rows.slice(0, 72).map((p) => +(+p.v).toFixed(2));
  if (v.some((x) => !Number.isFinite(x))) throw new Error('tide: non-numeric prediction');
  if (Math.max(...v) - Math.min(...v) < 0.05) throw new Error('tide: flat series');
  return { id, begin, v };
}

/** Coarse, honest region label for the result card (from state code / coordinates). */
export function region(st) {
  const s = st.state;
  if (s === 'AK') return '阿拉斯加';
  if (s === 'HI') return '夏威夷';
  if (['WA', 'OR', 'CA'].includes(s)) return '北美太平洋沿岸';
  if (['TX', 'LA', 'MS', 'AL'].includes(s)) return '墨西哥湾北岸';
  if (['ME', 'NH', 'MA', 'RI', 'CT', 'NY', 'NJ', 'DE', 'MD', 'VA', 'NC', 'SC', 'GA'].includes(s)) return '北美大西洋沿岸';
  if (s === 'FL') return '佛罗里达';
  if (s === 'PR') return '加勒比海';
  if (st.lng > 60 || st.lng < -130) return '太平洋 / 印度洋岛屿';
  if (st.lng > -100 && st.lng < -60 && st.lat > 5) return '加勒比海 / 墨西哥湾';
  return '拉丁美洲太平洋沿岸';
}

/** Hours of the high tides on each of the 3 days (empty array when a day has none). */
export function dailyHighs(v) {
  const hi = peaks(v);
  return [0, 1, 2].map((d) => hi.filter((h) => h >= d * 24 && h < d * 24 + 24).map((h) => h % 24));
}

export default {
  meta: {
    num: 38,
    slug: 'tide',
    title: 'Tide',
    tagline: '三天的潮汐曲线，猜是哪个港口。一天只有一次高潮，就该想到墨西哥湾。',
    category: 'science',
    data: 'live',
    howTo: [
      '图里是某个验潮站从今天起 3 天（72 小时）的逐小时潮位预报，当地标准时间，0 为最低低潮面。',
      '数一数每天有几次高潮：一天一次（全日潮）常见于墨西哥湾、阿拉斯加部分海岸；一天两次且高度相近是大西洋沿岸的半日潮；两高两低不等是太平洋沿岸的混合潮。',
      '潮差也是线索：太平洋环礁只有几十厘米，漏斗形海湾可达数米甚至十米。',
      '在地图上标出验潮站（地图上先不显示地名）。按距离计分，可以再试一次，会提示你偏向哪个方向，第二次最多扣 15%。',
    ],
    scoring: '100 × e^(−距离/1500 km)，第二次尝试扣 15%。离得越近分越高：约 1000 km 内算不错，同一海岸线上通常 70 分以上。',
    sources: [
      { name: 'NOAA CO-OPS Tide Predictions API', url: 'https://api.tidesandcurrents.noaa.gov/api/prod/' },
      { name: 'NOAA CO-OPS Metadata API (stations)', url: 'https://api.tidesandcurrents.noaa.gov/mdapi/prod/' },
    ],
    dataNote: '曲线是 NOAA 官方调和分析预报（非实测水位）。每天的验潮站固定（从 109 个参考站里按日抽取，最远点采样，覆盖美国沿岸、阿拉斯加、夏威夷及太平洋/加勒比海外站），打开页面时实时向 NOAA CO-OPS Predictions API 取该站当天起 3 天的逐小时预报（调和预报是确定的，所有人看到同一条曲线）。取不到时退回快照：2026-10-01 至 10-03 的同一批预报。之所以让你在地图上标位置而不是从名单里选名字：CO-OPS 的很多参考站名字很冷门（如 Coon Key），按距离计分更公平。',
  },

  async load(ctx) {
    const st = ctx.pick(ctx.data.stations);
    const q = (d) => d.replaceAll('-', '');
    const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=dailygames&begin_date=${q(ctx.date)}&end_date=${q(ctx.core.addDays(ctx.date, 2))}&datum=MLLW&station=${st.id}&time_zone=lst&units=metric&interval=h&format=json`;
    const raw = await ctx.fetchJSON(url, { timeout: 8000 });
    return { ...ctx.data, live: toPuzzle(raw, st.id, ctx.date) };
  },

  puzzle({ data, pick }) {
    const st = pick(data.stations);
    const live = data.live?.id === st.id ? data.live : null;
    return { id: st.id, begin: live?.begin ?? data.begin, v: live?.v ?? st.v, live: !!live };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const st = ctx.data.stations.find((s) => s.id === p.id);
    const v = p.v;
    const a = analyse(v);
    ctx.log('station', st.name, 'live', p.live, 'begin', p.begin, 'range', a.range.toFixed(2), 'highs', a.hi.length);
    const rows = v.map((v, h) => ({ h, v }));
    const day = (h) => ctx.core.addDays(p.begin, Math.floor(h / 24)).slice(5);
    const chart = await ui.plot((Plot, c) => ({
      height: 260,
      marginLeft: 44,
      x: { domain: [0, 71], ticks: [0, 12, 24, 36, 48, 60, 71], tickFormat: (h) => (h % 24 === 0 ? day(h) : hhmm(h)), label: null },
      y: { label: '潮位 (m)', grid: true, domain: [Math.min(0, ...v) - 0.1, Math.max(...v) + 0.15] },
      marks: [
        Plot.ruleX([24, 48], { stroke: c.rule, strokeDasharray: '3 4' }),
        Plot.areaY(rows, { x: 'h', y: 'v', y1: Math.min(...v), fill: c.accent, fillOpacity: 0.14, curve: 'basis' }),
        Plot.lineY(rows, { x: 'h', y: 'v', stroke: c.accent, strokeWidth: 2.5, curve: 'basis' }),
        Plot.dot(a.hi.map((h) => rows[h]), { x: 'h', y: 'v', fill: c.ink, r: 3.5 }),
        Plot.tip(rows, Plot.pointerX({ x: 'h', y: 'v', title: (d) => `${day(d.h)} ${hhmm(d.h)}\n${d.v.toFixed(2)} m` })),
      ],
    }));
    ctx.stage.append(ui.panel({ kicker: `${p.begin.slice(5)} 起 3 天 · 逐小时 · 当地标准时间`, title: '这个港口的潮汐' }, chart,
      ui.h('div', { class: 'ds-grid', style: { '--min': '130px', marginTop: '12px' } },
        ui.stat({ label: '最大潮差', value: `${a.range.toFixed(2)} m` }),
        ui.stat({ label: '高潮次数', value: `${a.hi.length}`, sub: '3 天内（黑点）' }),
        ui.stat({ label: '首个高潮', value: hhmm(a.hi[0] ?? 0), sub: `${day(0)}` }))));

    const res = await ctx.pin({
      answer: { lat: st.lat, lng: st.lng, label: st.name },
      view: { center: [0, -150], zoom: 1 },
      scale: 1500,
      attempts: 2,
      title: '验潮站在哪里？',
    });
    const hs = dailyHighs(v);
    const times = hs.map((x, d) => `${day(d * 24)} ${x.length ? x.map((h) => hhmm(h)).join('、') : '无'}`).join('；');
    const where = region(st);
    const tip = { diurnal: '一天一次高潮：墨西哥湾、南海、阿拉斯加部分海岸的典型特征。', semi: '半日潮占主导：北大西洋沿岸最典型。', mixed: '日不等明显：北美太平洋沿岸典型的混合潮。' }[a.kind];
    res.detail = ui.kv([
      ['验潮站', `${st.name}${st.state ? '，' + st.state : ''}（${where}）`],
      ['坐标', `${st.lat.toFixed(2)}°, ${st.lng.toFixed(2)}°`],
      ['潮型', a.type],
      ['线索', `3 天内 ${a.hi.length} 次高潮，最大潮差 ${a.range.toFixed(2)} m。${tip}` +
        (a.range < 1 ? ' 潮差很小，多半是开阔大洋的岛屿/环礁、半封闭海或北冰洋沿岸。' : a.range > 4 ? ' 潮差很大，多半是漏斗形海湾或高纬度陆架（如阿拉斯加、芬迪湾）。' : '')],
      ['高潮时刻', `${times}。每天晚约 50 分钟（月亮日 24 小时 50 分），三天里的位移可以帮你判断潮型。`],
    ]);
    return res;
  },
};
