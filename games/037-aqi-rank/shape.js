// Pure helpers shared by game.js, build/build.mjs and the tests.
export const mean = (xs) => { const a = xs.filter((x) => x != null); return a.length ? a.reduce((p, q) => p + q, 0) / a.length : null; };

/** US EPA 24h PM2.5 AQI breakpoints (2024 revision). */
export const band = (v) => (v <= 9 ? 'Good' : v <= 35.4 ? 'Moderate' : v <= 55.4 ? 'Unhealthy for sensitive groups' : v <= 125.4 ? 'Unhealthy' : v <= 225.4 ? 'Very unhealthy' : 'Hazardous');

export const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

/** One Open-Meteo location response → { 'YYYY-MM-DD': daily mean µg/m³ (0.1) } ; days with < 20 valid hours are dropped. */
export function dailyMeans(j) {
  const by = {};
  j.hourly.time.forEach((t, i) => { const v = j.hourly.pm2_5[i]; if (v != null && Number.isFinite(v)) (by[t.slice(0, 10)] ||= []).push(v); });
  const out = {};
  for (const [d, a] of Object.entries(by)) if (a.length >= 20) out[d] = Math.round(mean(a) * 10) / 10;
  return out;
}

/** A 5-city set is a fair puzzle: clue data present, target values clearly separated. */
export function validSet(cs) {
  if (cs.length !== 5) return false;
  if (cs.some((c) => c.val == null || c.prev.length !== 14 || c.prev[13] == null || c.prev.filter((x) => x != null).length < 12)) return false;
  const v = cs.map((c) => c.val).sort((a, b) => a - b);
  if (v[0] < 2) return false;
  return v.every((x, i) => !i || (x / v[i - 1] >= 1.2 && x - v[i - 1] >= 1.5));
}

/** Open-Meteo multi-location response (array, or one object) for [day-14, day] → live data for the target `day`. */
export function toLive(raw, day, cities, min = 5) {
  const arr = Array.isArray(raw) ? raw : [raw];
  if (arr.length !== cities.length) throw new Error(`expected ${cities.length} locations, got ${arr.length}`);
  const dates = Array.from({ length: 14 }, (_, i) => addDays(day, i - 14));
  const list = [];
  arr.forEach((j, i) => {
    const m = dailyMeans(j);
    const val = m[day] ?? null;
    if (val == null) return;
    list.push({ en: cities[i].en, prev: dates.map((d) => m[d] ?? null), val });
  });
  if (list.length < min) throw new Error('too few cities with data');
  return { date: day, cities: list };
}
