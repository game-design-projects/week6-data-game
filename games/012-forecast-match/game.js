// #12 Forecast Match — five weather cards for one day, five cities. Pair them.
// Live: yesterday's hourly weather for 5 deterministically chosen cities (Open-Meteo).
import { makeRng, addDays, daysBetween } from '../../engine/core.js';

const API = 'https://api.open-meteo.com/v1/forecast';
const MIN_SPREAD = 3; // °C between the climatological means of any two chosen cities
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const r1 = (x) => Math.round(x * 10) / 10;
const hm = (iso) => (iso ? +iso.slice(11, 13) + +iso.slice(14, 16) / 60 : null);
const hhmm = (h) => (h == null ? '—' : `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`);
const dayLen = (c) => (c.rise == null || c.set == null ? null : (c.set - c.rise + 24) % 24);

/** Climatological mean temperature of city `c` around the calendar day of `date` (from the snapshot range). */
export function climMean(c, range, date) {
  const [start] = range;
  const n = c.dm.length;
  let best = null;
  for (const y of [-1, 0, 1]) {
    const idx = daysBetween(start, `${+date.slice(0, 4) + y}${date.slice(4)}`);
    if (idx >= 0 && idx < n && (best == null || Math.abs(idx - n / 2) < Math.abs(best - n / 2))) best = idx;
  }
  if (best == null) return mean(c.dm);
  const w = c.dm.slice(Math.max(0, best - 2), best + 3).filter((x) => x != null);
  return w.length ? mean(w) : mean(c.dm);
}

/** Deterministic pick of 5 cities (distinct countries, climatologically well separated) for a date. */
export function selectCities(cities, range, date) {
  const rng = makeRng(`forecast-match:${date}`);
  const order = rng.shuffle(cities);
  const chosen = [];
  for (const c of order) {
    const m = climMean(c, range, date);
    if (chosen.some((x) => x.c.country === c.country || Math.abs(x.m - m) < MIN_SPREAD)) continue;
    chosen.push({ c, m });
    if (chosen.length === 5) break;
  }
  return chosen.map((x) => x.c);
}

/** One city's card from an Open-Meteo response object (hourly for one local day + daily sunrise/sunset). */
export function toCard(city, j) {
  const h = j.hourly ?? {};
  const T = h.temperature_2m, cl = h.cloud_cover, w = h.wind_speed_10m, p = h.precipitation;
  if (![T, cl, w, p].every((a) => Array.isArray(a) && a.length === 24 && a.every((x) => Number.isFinite(x)))) return null;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  return {
    name: city.name, zh: city.zh, country: city.country, lat: city.lat,
    t: T.map(r1), cloud: Math.round(sum(cl) / 24), wind: Math.round(Math.max(...w)), rain: r1(sum(p)),
    rise: hm(j.daily?.sunrise?.[0]) == null ? null : Math.round(hm(j.daily.sunrise[0]) * 100) / 100,
    set: hm(j.daily?.sunset?.[0]) == null ? null : Math.round(hm(j.daily.sunset[0]) * 100) / 100,
  };
}

/** Open-Meteo multi-location response (array, same order as `cities`) → puzzle, or null if anything is missing. */
export function toPuzzle(raw, day, cities) {
  const arr = Array.isArray(raw) ? raw : [raw];
  if (arr.length !== cities.length) return null;
  const cards = cities.map((c, i) => toCard(c, arr[i]));
  if (cards.some((c) => !c)) return null;
  return { date: day, cities: cards };
}

export function liveUrl(cities, day) {
  const f = (k) => cities.map((c) => c[k]).join(',');
  return `${API}?latitude=${f('lat')}&longitude=${f('lng')}&start_date=${day}&end_date=${day}&hourly=temperature_2m,cloud_cover,wind_speed_10m,precipitation&daily=sunrise,sunset&timezone=auto`;
}

const seasonOf = (date, lat) => {
  const m = +date.slice(5, 7);
  const north = [12, 1, 2].includes(m) ? '冬' : [3, 4, 5].includes(m) ? '春' : [6, 7, 8].includes(m) ? '夏' : '秋';
  const flip = { 冬: '夏', 夏: '冬', 春: '秋', 秋: '春' };
  if (Math.abs(lat) < 20) return '热带，四季不分明';
  return `${lat >= 0 ? '北' : '南'}半球${lat >= 0 ? north : flip[north]}季`;
};

/** Teaching sentence for one card: what in the data gives the city away. */
export function explain(c, date) {
  const avg = mean(c.t), rng = Math.max(...c.t) - Math.min(...c.t), dl = dayLen(c);
  const bits = [`均温 ${avg.toFixed(1)}°`];
  bits.push(dl == null ? '极昼或极夜（日出日落缺失）→ 高纬度' : `白昼 ${dl.toFixed(1)} h → 纬度约 ${Math.abs(c.lat).toFixed(0)}°，${seasonOf(date, c.lat)}`);
  if (rng >= 10) bits.push(`昼夜温差 ${rng.toFixed(0)}° → 内陆或干燥`);
  else if (rng <= 3) bits.push(`温差仅 ${rng.toFixed(1)}° → 海洋/多云/湿润`);
  if (c.rain >= 5) bits.push(`降水 ${c.rain} mm`);
  if (c.wind >= 40) bits.push(`阵风 ${c.wind} km/h`);
  return bits.join('；');
}

export default {
  meta: {
    num: 12,
    slug: 'forecast-match',
    title: 'Forecast Match',
    tagline: '五座城市昨天的逐小时天气卡片，把气温曲线和日出日落一一配到城市上。',
    category: 'geo',
    data: 'live',
    howTo: [
      '每张卡片是某座城市「昨天」（卡片上标注的日期）的逐小时气温（当地时间）、平均云量、最大风速、总降水，以及日出日落时刻，数据实时取自 Open-Meteo。',
      '线索：气温水平和季节（南北半球相反）；日出日落的间隔暴露纬度；昼夜温差大说明内陆或干燥；云量高、降水多常见于海洋和热带。',
      '把每张卡片配到下拉框里的城市，共 2 次提交机会，对的卡片会锁定。',
    ],
    scoring: '每张卡片 20 分：第 1 次提交就配对满分，第 2 次配对得一半，两次都没配对得 0。',
    sources: [
      { name: 'Open-Meteo Forecast API（昨日逐小时数据）', url: 'https://open-meteo.com/en/docs' },
      { name: 'Open-Meteo Historical Weather API（ERA5，离线快照）', url: 'https://open-meteo.com/en/docs/historical-weather-api' },
    ],
    dataNote: '题目日期（北京/本地日期）的前一天，5 座城市由日期确定性地抽取（国家不重复、历史同期气候均温至少相差 3°C），所以所有玩家看到同一组城市；卡片数值在线取自 Open-Meteo 对昨天的分析场。联网失败时，改用 ERA5 再分析的离线快照（2025-10 至 2026-10 中的某一天），界面日期会随之显示为快照日。',
  },

  // live puzzle (from load) → else a snapshot puzzle
  puzzle({ data, rng, pick }) {
    const p = data.live ?? pick(data.puzzles);
    return { date: p.date, live: !!data.live, cities: p.cities, order: rng.shuffle(p.cities.map((_, i) => i)) };
  },

  async load(ctx) {
    const day = ctx.core.addDays(ctx.date, -1);
    if (day >= ctx.today) throw new Error('future puzzle day, no live data');
    const cities = selectCities(ctx.data.cities, ctx.data.range, day);
    ctx.log('forecast-match live', day, cities.map((c) => c.name).join(','));
    const raw = await ctx.fetchJSON(liveUrl(cities, day), { timeout: 9000 });
    const live = toPuzzle(raw, day, cities);
    if (!live) throw new Error('incomplete live data');
    return { ...ctx.data, live };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    ctx.log('forecast-match start', p.date, p.live ? 'live' : 'snapshot');
    const labels = 'ABCDE';
    const nameOf = (c) => `${c.zh} ${c.name}（${c.country}）`;
    const bodies = await Promise.all(p.cities.map(async (c, i) => {
      const data = c.t.map((v, h) => ({ h, v }));
      const lo = Math.floor(Math.min(...c.t)) - 1, hi = Math.ceil(Math.max(...c.t)) + 1;
      const chart = await ui.plot((Plot, col) => ({
        height: 120, marginLeft: 38, marginBottom: 24, width: 280,
        x: { domain: [0, 23], ticks: [6, 12, 18], label: null, tickFormat: (h) => `${h}时` },
        y: { label: null, ticks: 3, grid: true, domain: [lo, hi], tickFormat: (v) => `${v}°` },
        marks: [Plot.areaY(data, { x: 'h', y1: lo, y2: 'v', fill: col.accent, fillOpacity: 0.15 }), Plot.lineY(data, { x: 'h', y: 'v', stroke: col.accent, strokeWidth: 2 })],
      }));
      return ui.h('div', null,
        chart,
        ui.h('div', { class: 'small mono ink2' }, `日出 ${hhmm(c.rise)} · 日落 ${hhmm(c.set)}`),
        ui.h('div', { class: 'small mono muted' }, `云 ${c.cloud}% · 风 ${c.wind} km/h · 雨 ${c.rain} mm`));
    }));

    ctx.stage.append(ui.panel({ kicker: `${p.live ? '昨天' : '快照日'}（${p.date}）· 当地时间`, title: '五张天气卡片' },
      ui.h('div', { class: 'small ink2' }, '时间轴与日出日落都是当地钟表时间。每张卡片只显示该城市自己的气温范围，注意纵轴刻度。')));

    const answer = {};
    p.cities.forEach((c, i) => { answer[`c${i}`] = `n${i}`; });
    const r = await ctx.match({
      left: bodies.map((body, i) => ({ id: `c${i}`, label: `卡片 ${labels[i]}`, body })),
      right: p.order.map((i) => ({ id: `n${i}`, label: nameOf(p.cities[i]) })),
      answer,
      attempts: 2,
      title: '配对城市',
    });

    r.detail = ui.stack(
      ui.h('div', { class: 'small ink2' }, `答案与线索（${p.date}）：`),
      ...p.cities.map((c, i) => ui.h('div', { class: 'small' }, ui.h('b', null, `${labels[i]} = ${c.zh} ${c.name}`), `：${explain(c, p.date)}`)));
    ctx.log('forecast-match done', r.score);
    return r;
  },
};
