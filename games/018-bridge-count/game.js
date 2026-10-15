// #18 Bridge Count — given a day's weather, rank the four East River bike bridges by cyclists and guess the total.
// Live: the most recent day (at least 2 days old) on which all four DOT counters have a complete record.

const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export const BRIDGES = ['布鲁克林桥', '曼哈顿桥', '威廉斯堡桥', '皇后区桥'];
/** NYC DOT sensor ids, in BRIDGES order, and the number of 15-minute rows a complete day has for each. */
export const SENSOR_IDS = ['300020904', '100062893', '100009427', '100009428'];
export const FULL_ROWS = { 300020904: 192, 100062893: 384, 100009427: 384, 100009428: 384 };
export const LAG_DAYS = 2;
export const WINDOW_DAYS = 24;
export const MIN_GAP = 1.04; // adjacent bridges must differ by >= 4%, else the ranking is a coin flip
export const EST_MIN = 1000;
export const EST_MAX = 50000;

const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
export const total = (c) => c.reduce((a, b) => a + b, 0);
export const dayType = (date) => { const w = new Date(`${date}T00:00:00Z`).getUTCDay(); return w === 0 || w === 6 ? 1 : 0; };
export const fToC = (f) => Math.round(((f - 32) * 5) / 9);

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

/**
 * Shape raw rows into complete puzzle days.
 * dotRows: [{ sensor_id, d: 'YYYY-MM-DD…', n, k }]  (per sensor per day: summed counts, number of 15-min rows)
 * weather: Open-Meteo `daily` object. A day needs all four counters complete and a weather record.
 */
export function shapeDays(dotRows, weather) {
  const by = new Map();
  for (const r of dotRows ?? []) {
    const id = String(r.sensor_id);
    if (!(id in FULL_ROWS) || +r.k !== FULL_ROWS[id]) continue;
    const date = String(r.d).slice(0, 10);
    if (!by.has(date)) by.set(date, {});
    by.get(date)[id] = Math.round(+r.n);
  }
  const days = [];
  (weather?.time ?? []).forEach((date, i) => {
    const e = by.get(date);
    if (!e || SENSOR_IDS.some((id) => !Number.isFinite(e[id]))) return;
    const w = (k) => weather[k]?.[i];
    if ([w('temperature_2m_max'), w('temperature_2m_min'), w('precipitation_sum'), w('wind_speed_10m_max'), w('weather_code')].some((v) => v == null || !Number.isFinite(+v))) return;
    days.push({
      date, c: SENSOR_IDS.map((id) => e[id]), hi: Math.round(w('temperature_2m_max')), lo: Math.round(w('temperature_2m_min')),
      rain: +(+w('precipitation_sum')).toFixed(2), snow: +(+(w('snowfall_sum') ?? 0)).toFixed(1), wind: Math.round(w('wind_speed_10m_max')), wc: Math.round(w('weather_code')),
    });
  });
  return days.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Is this day a fair puzzle? No dead sensors and no near-ties in the ranking. */
export function isFair(day) {
  if (day.c.some((v) => !Number.isFinite(v) || v < 100)) return false;
  const s = [...day.c].sort((a, b) => b - a);
  return s.every((v, i) => i === 0 || s[i - 1] / v >= MIN_GAP);
}

/** Median counts per [month][weekday|weekend] per bridge over the given days. */
export function buildTypical(days) {
  const buckets = Array.from({ length: 12 }, () => [[], []]);
  for (const d of days) buckets[+d.date.slice(5, 7) - 1][dayType(d.date)].push(d);
  return buckets.map((pair) => pair.map((ds) => BRIDGES.map((_, j) => median(ds.map((d) => d.c[j])))));
}
export const typicalFor = (typ, date) => typ[+date.slice(5, 7) - 1][dayType(date)];

/** Newest fair day that is at least LAG_DAYS old relative to the puzzle date; null if none. */
export function pickLive(days, date) {
  const last = addDays(date, -LAG_DAYS);
  const ok = days.filter((d) => d.date <= last && d.date >= addDays(date, -WINDOW_DAYS) && isFair(d));
  return ok.length ? ok[ok.length - 1] : null;
}

/** Plain-language explanation of why a day looked the way it did. */
export function explainDay(day, typical) {
  const sum = total(day.c);
  const tsum = total(typical);
  const ratio = sum / tsum;
  const ord = day.c.map((v, i) => i).sort((a, b) => day.c[b] - day.c[a]);
  const rs = day.c.map((v, i) => v / typical[i]);
  const lo = rs.indexOf(Math.min(...rs));
  const hi = rs.indexOf(Math.max(...rs));
  let why;
  if (day.snow > 0.1) why = `下雪（${day.snow} 英寸）`;
  else if (day.rain > 0.3) why = `降水 ${day.rain} 英寸`;
  else if (day.rain > 0.05) why = `有小雨（${day.rain} 英寸）`;
  else if (day.hi < 40) why = `最高气温只有 ${day.hi}°F（${fToC(day.hi)}°C）`;
  else if (day.hi > 90) why = `酷热（最高 ${day.hi}°F）`;
  else if (day.wind >= 20) why = `大风（最大 ${day.wind} mph）`;
  else why = '天气没有明显的捣乱因素';
  const verdict = ratio < 0.6 ? '人流大幅低于平常' : ratio < 0.85 ? '人流低于平常' : ratio <= 1.15 ? '人流接近平常' : '人流高于平常';
  const lines = [
    `排名：${ord.map((i) => `${BRIDGES[i]} ${day.c[i].toLocaleString('en-US')}`).join(' > ')}。`,
    `总计 ${sum.toLocaleString('en-US')} 人次，是同月同类日中位数（${tsum.toLocaleString('en-US')}）的 ${Math.round(ratio * 100)}%：${verdict}。关键线索：${why}。`,
  ];
  if (lo !== hi) lines.push(`相对平常，${BRIDGES[hi]}最稳（${Math.round(rs[hi] * 100)}%），${BRIDGES[lo]}最敏感（${Math.round(rs[lo] * 100)}%）。` +
    (dayType(day.date) ? ' 周末通勤骑行少，游客多的布鲁克林桥相对更占优。' : ' 工作日以通勤为主，威廉斯堡桥通常领先，天气一差通勤客也会少骑。'));
  return lines;
}

export default {
  meta: {
    num: 18,
    slug: 'bridge-count',
    title: 'Bridge Count',
    tagline: '看一天的天气，猜东河四座桥上过了多少骑车人：先给四座桥排名，再估总数。',
    category: 'nyc',
    data: 'live',
    howTo: [
      '给你一天（最近一个四座桥计数器都完整的日子，通常是前天）的日期、星期、气温、降水和风速，以及「同月同类日（工作日/周末）」的骑行人次中位数作参照。',
      '第一步：把布鲁克林桥、曼哈顿桥、威廉斯堡桥、皇后区桥按这天的骑行人数从多到少排序（最多 3 次，每次告诉你几个位置对了）。',
      '第二步：估这四座桥当天骑行人次的总和（对数滑块，偏差约 22% 得 37 分，差一倍几乎不得分）。',
      '计分：排序最多 100 分（第 1 次排对满分，3 次内排对依次递减，排不对按对的位置给少量分），总数最多 100 分，两部分相加。',
      '提示：下雨、下雪、低温会让人数骤降；周末布鲁克林桥（游客多）相对更强。',
    ],
    scoring: '排序 100 分 + 总数 100 分：排序每多用一次机会少 1/3，总数按倍数误差计分（偏差约 22% 得 37 分）。',
    sources: [
      { name: 'NYC DOT Bicycle and Pedestrian Counts (ct66-47at)', url: 'https://data.cityofnewyork.us/d/ct66-47at', note: '各桥自行车道的 15 分钟计数器，按日汇总；每天更新' },
      { name: 'NYC DOT Bicycle and Pedestrian Count Sensors (6up2-gnw8)', url: 'https://data.cityofnewyork.us/d/6up2-gnw8', note: '计数器位置' },
      { name: 'Open-Meteo Historical Weather API', url: 'https://open-meteo.com/en/docs/historical-weather-api', note: '曼哈顿下城每日天气（ERA5 再分析）' },
    ],
    dataNote: '实时：浏览器直接读取纽约市交通局的计数器数据（Socrata，ct66-47at）和 Open-Meteo 天气，取「前天及更早、四座桥计数器全天完整」的最近一天，保证所有人拿到同一天。有些计数器会停摆几天，所以有时会往前回溯，页面会写明日期。若联网失败则回退到内置的 2022 年至今的历史日。计数器只覆盖自行车道（不含行人），为双向合计；与最近一天差距不足 4% 的日子会被跳过，避免排名变成抛硬币。「同类日」指同一个月份内的工作日或周末。',
  },

  async load(ctx) {
    const date = ctx.date;
    const end = addDays(date, -LAG_DAYS);
    const start = addDays(date, -WINDOW_DAYS);
    const u = new URL('https://data.cityofnewyork.us/resource/ct66-47at.json');
    u.searchParams.set('$select', 'sensor_id, date_trunc_ymd(timestamp) as d, sum(counts) as n, count(*) as k');
    u.searchParams.set('$where', `sensor_id in(${SENSOR_IDS.map((s) => `'${s}'`).join(',')}) AND travelmode='bike' AND timestamp>='${start}T00:00:00' AND timestamp<'${addDays(end, 1)}T00:00:00'`);
    u.searchParams.set('$group', 'sensor_id, d');
    u.searchParams.set('$order', 'd');
    u.searchParams.set('$limit', '500');
    const wu = `https://archive-api.open-meteo.com/v1/archive?latitude=40.71&longitude=-73.99&start_date=${start}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,wind_speed_10m_max,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York`;
    const [rows, wx] = await Promise.all([ctx.fetchJSON(u.toString(), { timeout: 9000 }), ctx.fetchJSON(wu, { timeout: 9000 })]);
    const live = pickLive(shapeDays(rows, wx.daily), date);
    ctx.log('live', live ? live.date : 'no complete day in window', { rows: rows.length });
    if (!live) throw new Error('no complete live day');
    return { ...ctx.data, live };
  },

  puzzle({ data, pick }) {
    return data.live ?? pick(data.days);
  },

  async play(ctx, day) {
    const { ui, core } = ctx;
    const typical = typicalFor(ctx.data.typical, day.date);
    const dt = new Date(`${day.date}T00:00:00Z`);
    const wd = WD[dt.getUTCDay()];
    const wx = weatherLabel(day.wc, day.snow, day.rain);
    ctx.log('puzzle', day.date, wx, day.c);

    ctx.stage.append(ui.panel({ kicker: '线索 · 最近一个数据完整的日子', title: `${dt.getUTCMonth() + 1} 月 ${dt.getUTCDate()} 日 ${wd}` },
      ui.grid(110,
        ui.stat({ label: '天气', value: wx }),
        ui.stat({ label: '气温 °F', value: `${day.lo}–${day.hi}`, sub: `${fToC(day.lo)}–${fToC(day.hi)}°C` }),
        ui.stat({ label: '降水 英寸', value: String(day.rain) }),
        ui.stat({ label: '最大风速 mph', value: String(day.wind) })),
      ui.h('div', { class: 'small muted', style: { marginTop: '10px' } }, `参照：${dt.getUTCMonth() + 1} 月${dayType(day.date) ? '周末' : '工作日'}的骑行人次中位数（2022 年至今）`),
      ui.table({ columns: [{ key: 'b', label: '桥' }, { key: 't', label: '平常一天', num: true }],
        rows: BRIDGES.map((b, i) => ({ b, t: core.fmtNum(typical[i]) })) })));

    const items = BRIDGES.map((b, i) => ({ id: String(i), label: b, value: day.c[i] }));
    const r1 = await ctx.order({ title: '1 / 2 · 给四座桥排名', prompt: '这天骑行人数从多到少排列', items: ctx.rng.shuffle(items), direction: 'desc', attempts: 3, format: (v) => core.fmtNum(v) });
    const sum = total(day.c);
    const r2 = await ctx.estimate({ title: '2 / 2 · 四座桥当天骑行总人次', answer: sum, min: EST_MIN, max: EST_MAX, log: true, step: 100, unit: '人次', format: (v) => core.fmtNum(Math.round(v)), scoring: 'log', scale: 0.2 });

    const res = ctx.combine([r1, r2]);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({ columns: [{ key: 'b', label: '桥' }, { key: 'n', label: `${day.date} 人次`, num: true }, { key: 'r', label: '相对平常', num: true }],
        rows: BRIDGES.map((b, i) => ({ b, n: core.fmtNum(day.c[i]), r: `${Math.round((day.c[i] / typical[i]) * 100)}%` })) }),
      ...explainDay(day, typical).map((t) => ui.h('div', { class: 'ink2' }, t)));
    return res;
  },
};
