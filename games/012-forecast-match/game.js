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
    name: city.name, country: city.country, lat: city.lat,
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
  const north = [12, 1, 2].includes(m) ? 'winter' : [3, 4, 5].includes(m) ? 'spring' : [6, 7, 8].includes(m) ? 'summer' : 'autumn';
  const flip = { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' };
  if (Math.abs(lat) < 20) return 'tropics, no clear seasons';
  return `${lat >= 0 ? 'northern' : 'southern'} hemisphere ${lat >= 0 ? north : flip[north]}`;
};

/** Teaching sentence for one card: what in the data gives the city away. */
export function explain(c, date) {
  const avg = mean(c.t), rng = Math.max(...c.t) - Math.min(...c.t), dl = dayLen(c);
  const bits = [`mean ${avg.toFixed(1)}°`];
  bits.push(dl == null ? 'polar day or night (no sunrise/sunset) → high latitude' : `daylight ${dl.toFixed(1)} h → latitude about ${Math.abs(c.lat).toFixed(0)}°, ${seasonOf(date, c.lat)}`);
  if (rng >= 10) bits.push(`day-night swing ${rng.toFixed(0)}° → inland or dry`);
  else if (rng <= 3) bits.push(`swing of only ${rng.toFixed(1)}° → ocean, cloudy or humid`);
  if (c.rain >= 5) bits.push(`rain ${c.rain} mm`);
  if (c.wind >= 40) bits.push(`gusts ${c.wind} km/h`);
  return bits.join('; ');
}

export default {
  meta: {
    num: 12,
    slug: 'forecast-match',
    title: 'Forecast Match',
    tagline: 'Five cities, five weather cards from yesterday. Match each temperature curve and sunrise time to its city.',
    category: 'geo',
    data: 'live',
    howTo: [
      'Each card shows one city\'s hourly temperature for yesterday (the date is printed above the cards, local time), plus average cloud cover, peak wind, total rain and sunrise and sunset times. Pulled live from Open-Meteo.',
      'Clues: the temperature level and the season (flipped between hemispheres); day length gives away latitude; a big day-night swing means inland or dry; cloud and rain are typical of oceans and the tropics.',
      'Match each card to a city from the dropdown. You get 2 submissions, and correct cards lock in.',
    ],
    scoring: '20 points per card: a match on the 1st submission scores full, on the 2nd half, and 0 if neither.',
    sources: [
      { name: 'Open-Meteo Forecast API (yesterday\'s hourly data)', url: 'https://open-meteo.com/en/docs' },
      { name: 'Open-Meteo Historical Weather API (ERA5, offline snapshot)', url: 'https://open-meteo.com/en/docs/historical-weather-api' },
    ],
    dataNote: 'The cards show the day before the puzzle date. The 5 cities are drawn deterministically from the date (no repeated country, climatological means at least 3°C apart), so every player gets the same set; values come live from Open-Meteo\'s analysis of yesterday. If the network fails, an offline ERA5 reanalysis snapshot (one day between Oct 2025 and Oct 2026) is used and the page shows the snapshot date instead.',
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
    const nameOf = (c) => `${c.name} (${c.country})`;
    const bodies = await Promise.all(p.cities.map(async (c, i) => {
      const data = c.t.map((v, h) => ({ h, v }));
      const lo = Math.floor(Math.min(...c.t)) - 1, hi = Math.ceil(Math.max(...c.t)) + 1;
      const chart = await ui.plot((Plot, col) => ({
        height: 120, marginLeft: 38, marginBottom: 24, width: 280,
        x: { domain: [0, 23], ticks: [6, 12, 18], label: null, tickFormat: (h) => `${h}h` },
        y: { label: null, ticks: 3, grid: true, domain: [lo, hi], tickFormat: (v) => `${v}°` },
        marks: [Plot.areaY(data, { x: 'h', y1: lo, y2: 'v', fill: col.accent, fillOpacity: 0.15 }), Plot.lineY(data, { x: 'h', y: 'v', stroke: col.accent, strokeWidth: 2 })],
      }));
      return ui.h('div', null,
        chart,
        ui.h('div', { class: 'small mono ink2' }, `Sunrise ${hhmm(c.rise)} · Sunset ${hhmm(c.set)}`),
        ui.h('div', { class: 'small mono muted' }, `Cloud ${c.cloud}% · Wind ${c.wind} km/h · Rain ${c.rain} mm`));
    }));

    ctx.stage.append(ui.panel({ kicker: `${p.live ? 'Yesterday' : 'Snapshot day'} (${p.date}) · local time`, title: 'Five weather cards' },
      ui.h('div', { class: 'small ink2' }, 'The time axis and sunrise/sunset are local clock time. Each card scales to its own city\'s temperature range, so watch the y-axis.')));

    const answer = {};
    p.cities.forEach((c, i) => { answer[`c${i}`] = `n${i}`; });
    const r = await ctx.match({
      left: bodies.map((body, i) => ({ id: `c${i}`, label: `Card ${labels[i]}`, body })),
      right: p.order.map((i) => ({ id: `n${i}`, label: nameOf(p.cities[i]) })),
      answer,
      attempts: 2,
      title: 'Match the cities',
    });

    r.detail = ui.stack(
      ui.h('div', { class: 'small ink2' }, `Answers and clues (${p.date}):`),
      ...p.cities.map((c, i) => ui.h('div', { class: 'small' }, ui.h('b', null, `${labels[i]} = ${c.name}`), `: ${explain(c, p.date)}`)));
    ctx.log('forecast-match done', r.score);
    return r;
  },
};
