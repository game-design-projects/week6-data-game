// #18 Bridge Count — given a day's weather, rank the four East River bike bridges by cyclists and guess the total.
// Live: the most recent day (at least 2 days old) on which all four DOT counters have a complete record.

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const BRIDGES = ['Brooklyn Bridge', 'Manhattan Bridge', 'Williamsburg Bridge', 'Queensboro Bridge'];
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

/** WMO weather code -> short English label. */
export function weatherLabel(code, snow = 0, rain = 0) {
  if (snow > 0.1 || (code >= 71 && code <= 77) || code === 85 || code === 86) return 'Snow';
  if (code >= 95) return 'Thunderstorm';
  if (code >= 61 || (code >= 80 && code <= 82) || rain > 0.05) return rain > 0.5 ? 'Heavy rain' : 'Rain';
  if (code >= 51) return 'Drizzle';
  if (code >= 45) return 'Fog';
  if (code === 3) return 'Overcast';
  if (code >= 1) return 'Partly cloudy';
  return 'Sunny';
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
  if (day.snow > 0.1) why = `snow (${day.snow} in)`;
  else if (day.rain > 0.3) why = `${day.rain} in of precipitation`;
  else if (day.rain > 0.05) why = `light rain (${day.rain} in)`;
  else if (day.hi < 40) why = `a high of only ${day.hi}°F (${fToC(day.hi)}°C)`;
  else if (day.hi > 90) why = `scorching heat (high of ${day.hi}°F)`;
  else if (day.wind >= 20) why = `strong wind (up to ${day.wind} mph)`;
  else why = 'no obvious weather spoiler';
  const verdict = ratio < 0.6 ? 'traffic far below normal' : ratio < 0.85 ? 'traffic below normal' : ratio <= 1.15 ? 'traffic close to normal' : 'traffic above normal';
  const lines = [
    `Ranking: ${ord.map((i) => `${BRIDGES[i]} ${day.c[i].toLocaleString('en-US')}`).join(' > ')}.`,
    `Total ${sum.toLocaleString('en-US')} crossings, ${Math.round(ratio * 100)}% of the median for the same kind of day that month (${tsum.toLocaleString('en-US')}): ${verdict}. Key clue: ${why}.`,
  ];
  if (lo !== hi) lines.push(`Relative to normal, the ${BRIDGES[hi]} held up best (${Math.round(rs[hi] * 100)}%) and the ${BRIDGES[lo]} was the most sensitive (${Math.round(rs[lo] * 100)}%).` +
    (dayType(day.date) ? ' Weekends have fewer commuters, so the tourist-heavy Brooklyn Bridge fares relatively better.' : ' Weekdays are mostly commuters, so the Williamsburg Bridge usually leads, and bad weather keeps commuters home too.'));
  return lines;
}

export default {
  meta: {
    num: 18,
    slug: 'bridge-count',
    title: 'Bridge Count',
    tagline: 'Given one day\'s weather, guess how many cyclists crossed the four East River bridges: rank the bridges, then estimate the total.',
    category: 'nyc',
    data: 'live',
    howTo: [
      'You get one day (the most recent day on which all four bridge counters have complete data, usually the day before yesterday): its date, weekday, temperature, precipitation and wind, plus the median crossings for the same kind of day that month (weekday or weekend) as a reference.',
      'Step 1: rank the Brooklyn, Manhattan, Williamsburg and Queensboro bridges by cyclists that day, from most to fewest (up to 3 tries; each try tells you how many positions are right).',
      'Step 2: estimate the combined number of crossings on the four bridges that day (log slider; about 22% off scores 37, twice off scores almost nothing).',
      'Scoring: the ranking is worth up to 100 (full marks on the 1st try, less on the 2nd and 3rd, and a little partial credit for correct positions otherwise); the total is worth up to 100; the two add up.',
      'Tip: rain, snow and cold make numbers plunge; on weekends the Brooklyn Bridge (tourists) holds up relatively better.',
    ],
    scoring: 'Ranking 100 + total 100: each extra ranking try costs a third, and the total is scored by ratio error (about 22% off earns 37).',
    sources: [
      { name: 'NYC DOT Bicycle and Pedestrian Counts (ct66-47at)', url: 'https://data.cityofnewyork.us/d/ct66-47at', note: '15-minute counters on each bridge\'s bike lane, summed by day; updated daily' },
      { name: 'NYC DOT Bicycle and Pedestrian Count Sensors (6up2-gnw8)', url: 'https://data.cityofnewyork.us/d/6up2-gnw8', note: 'Counter locations' },
      { name: 'Open-Meteo Historical Weather API', url: 'https://open-meteo.com/en/docs/historical-weather-api', note: 'Daily weather for Lower Manhattan (ERA5 reanalysis)' },
    ],
    dataNote: 'Live: the browser reads NYC DOT counter data (Socrata, ct66-47at) and Open-Meteo weather directly, and uses the most recent day that is at least two days old and has a full day of data on all four bridge counters, so everyone gets the same day. Some counters go dark for days, so it sometimes looks further back; the page shows the date. If the network fails it falls back to built-in historical days from 2022 on. Counters cover bike lanes only (no pedestrians), both directions combined; days where adjacent bridges differ by less than 4% are skipped so the ranking is not a coin flip. A "same kind of day" means a weekday or a weekend within the same month.',
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

    ctx.stage.append(ui.panel({ kicker: 'Clues · latest day with complete data', title: `${wd}, ${MON[dt.getUTCMonth()]} ${dt.getUTCDate()}, ${dt.getUTCFullYear()}` },
      ui.grid(110,
        ui.stat({ label: 'Weather', value: wx }),
        ui.stat({ label: 'Temp °F', value: `${day.lo}–${day.hi}`, sub: `${fToC(day.lo)}–${fToC(day.hi)}°C` }),
        ui.stat({ label: 'Precip. (in)', value: String(day.rain) }),
        ui.stat({ label: 'Max wind (mph)', value: String(day.wind) })),
      ui.h('div', { class: 'small muted', style: { marginTop: '10px' } }, `Reference: median crossings on a ${MON[dt.getUTCMonth()]} ${dayType(day.date) ? 'weekend day' : 'weekday'} (2022 to date)`),
      ui.table({ columns: [{ key: 'b', label: 'Bridge' }, { key: 't', label: 'Typical day', num: true }],
        rows: BRIDGES.map((b, i) => ({ b, t: core.fmtNum(typical[i]) })) })));

    const items = BRIDGES.map((b, i) => ({ id: String(i), label: b, value: day.c[i] }));
    const r1 = await ctx.order({ title: '1 / 2 · Rank the four bridges', prompt: 'Order them by cyclists that day, most to fewest', items: ctx.rng.shuffle(items), direction: 'desc', attempts: 3, format: (v) => core.fmtNum(v) });
    const sum = total(day.c);
    const r2 = await ctx.estimate({ title: '2 / 2 · Total crossings on the four bridges that day', answer: sum, min: EST_MIN, max: EST_MAX, log: true, step: 100, unit: 'crossings', format: (v) => core.fmtNum(Math.round(v)), scoring: 'log', scale: 0.2 });

    const res = ctx.combine([r1, r2]);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({ columns: [{ key: 'b', label: 'Bridge' }, { key: 'n', label: `${day.date} crossings`, num: true }, { key: 'r', label: 'vs. typical', num: true }],
        rows: BRIDGES.map((b, i) => ({ b, n: core.fmtNum(day.c[i]), r: `${Math.round((day.c[i] / typical[i]) * 100)}%` })) }),
      ...explainDay(day, typical).map((t) => ui.h('div', { class: 'ink2' }, t)));
    return res;
  },
};
