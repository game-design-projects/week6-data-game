// #1 Daylight — a city's sunrise/sunset curve for the year; pin the city.
// Amplitude ↔ latitude, clock offset of solar noon ↔ longitude within the
// time zone, DST jumps ↔ country rules.

const RAD = Math.PI / 180;

/** UTC instants (ms) of sunrise and sunset on a date (sunrise equation). */
export function sunUTC(iso, lat, lng) {
  const jdNoon = Date.parse(`${iso}T12:00:00Z`) / 86400000 + 2440587.5;
  const n = Math.round(jdNoon - 2451545.0 + 0.0008);
  const jStar = n - lng / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const sinD = Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD);
  const cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * sinD) / (Math.cos(lat * RAD) * cosD);
  const toMs = (jd) => (jd - 2440587.5) * 86400000;
  if (cosW > 1) return { rise: null, set: null, noon: toMs(jTransit) }; // polar night
  if (cosW < -1) return { rise: null, set: null, noon: toMs(jTransit), allDay: true }; // midnight sun
  const w = Math.acos(cosW) / RAD;
  return { rise: toMs(jTransit - w / 360), set: toMs(jTransit + w / 360), noon: toMs(jTransit) };
}

/** Local clock hours (e.g. 6.5 = 06:30) of a UTC instant in an IANA zone. */
export function clockHours(ms, fmt) {
  const parts = fmt.formatToParts(new Date(ms));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return get('hour') + get('minute') / 60;
}

/** Hours (may exceed 24) → HH:MM, rounding whole minutes first so 11.999 never prints 11:00. */
export const hhmm = (h) => {
  const m = Math.round((((h % 24) + 24) % 24) * 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const mdLabel = (iso) => `${MON[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
const dur = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} h ${m % 60} min`; };
const fmtMin = (m) => { const a = Math.round(Math.abs(m)); return a >= 60 ? `${Math.floor(a / 60)} h ${a % 60} min` : `${a} min`; };
const fmtUtc = (h) => `UTC${h < 0 ? '−' : '+'}${Math.floor(Math.abs(h))}${Math.abs(h) % 1 ? `:${String(Math.round((Math.abs(h) % 1) * 60)).padStart(2, '0')}` : ''}`;

/** Standard-time UTC offset (hours) of a zone in a year: the smaller of the Jan and Jul offsets. */
export function stdOffsetHours(year, fmt) {
  const off = (m) => { let o = clockHours(Date.UTC(year, m, 1, 12), fmt) - 12; if (o > 14) o -= 24; if (o < -12) o += 24; return o; };
  return Math.min(off(0), off(6));
}

/** Dates (MM-DD) where the clock jumps: DST changes. */
export function dstJumps(days) {
  return days.filter((d, i) => i && Math.abs(d.noon - days[i - 1].noon) > 0.2).map((d) => d.iso.slice(5));
}

/** Puzzle-specific lesson: how latitude, longitude and DST show up in the curve. */
export function explain(city, days, year, fmt) {
  const rows = days.filter((d) => d.rise != null).map((d) => ({ ...d, len: d.set - d.rise }));
  const longest = rows.reduce((a, b) => (b.len > a.len ? b : a));
  const shortest = rows.reduce((a, b) => (b.len < a.len ? b : a));
  const range = longest.len - shortest.len;
  const north = Number(longest.iso.slice(5, 7)) >= 4 && Number(longest.iso.slice(5, 7)) <= 9;
  const std = stdOffsetHours(year, fmt);
  const dMin = (city.lng - std * 15) * 4; // minutes the sun reaches the meridian before (+) the zone's central meridian
  const jumps = dstJumps(days);
  const lat = `Longest day ${hhmm(longest.len)} (${mdLabel(longest.iso)}), shortest ${hhmm(shortest.len)} (${mdLabel(shortest.iso)}), a difference of ${dur(range)}. ` +
    `The longest day falls ${north ? 'mid-year' : 'around the turn of the year'}, so this is the ${north ? 'Northern' : 'Southern'} Hemisphere. Latitude ${Math.abs(city.lat).toFixed(1)}°${city.lat < 0 ? 'S' : 'N'}: ${Math.abs(city.lat) < 15 ? 'a tiny swing, close to the equator' : Math.abs(city.lat) > 50 ? 'a huge swing, close to the polar circle' : 'a moderate swing, in the mid-latitudes'}.`;
  const lng = `The central meridian of time zone ${fmtUtc(std)} is ${Math.abs(std * 15).toFixed(0)}°${std < 0 ? 'W' : 'E'}, and the city sits at ${Math.abs(city.lng).toFixed(1)}°${city.lng < 0 ? 'W' : 'E'}, ` +
    (Math.abs(dMin) < 1 ? 'almost exactly on the central meridian' : `${dMin > 0 ? 'east' : 'west'} of it, so solar noon comes about ${fmtMin(dMin)} ${dMin > 0 ? 'before' : 'after'} 12:00 standard time`) + ' (plus or minus 16 minutes from the equation of time).';
  const dst = jumps.length ? `Daylight saving: the clocks shift by 1 hour on ${jumps.map((j) => mdLabel(`2000-${j}`)).join(' and ')}, a pair of dates that matches the rules around ${city.country}.` : 'No shift all year, so the place does not observe daylight saving time.';
  return { lat, lng, dst, jumps, longest, shortest, std };
}

export default {
  meta: {
    num: 1,
    slug: 'daylight',
    title: 'Daylight',
    tagline: 'A city\'s sunrise and sunset curves for a whole year. Read its latitude, longitude and daylight saving time, then pin it on the map.',
    category: 'geo',
    data: 'computed',
    howTo: [
      'The chart shows the city\'s sunrise (lower edge) and sunset (upper edge) for every day of this year in local clock time; the dotted line is solar noon. At high latitudes the summer sunset can run past 24:00.',
      'The swing of the curves tells you the latitude: the bigger the gap between summer and winter days, the farther from the equator. Long days in June mean the Northern Hemisphere.',
      'How far noon sits from 12:00 shows whether the city is east or west within its time zone. A sudden 1-hour shift in the curve is daylight saving time, and the dates of the jump can give away the country.',
      'Tap the map to place your answer. Scoring is by distance: 100 points at 0 km, dropping to about a third for every 1,500 km off.',
    ],
    scoring: '100 × e^(−distance / 1500 km): 100 points at 0 km, about 37 at 1,500 km, and close to 0 across continents. One guess only.',
    dataNote: 'Cities come from GeoNames (cities of 1 million or more, plus capitals of 100,000 or more; when two are within 150 km only the larger is kept), 389 in all. Sunrise and sunset are computed in the browser from coordinates with the sunrise equation (including −0.833° of atmospheric refraction), accurate to a few minutes. Daylight saving and time-zone rules come from the browser\'s built-in IANA time zone database; nothing is fetched and there is no live data.',
    sources: [
      { name: 'GeoNames cities15000 (CC BY 4.0)', url: 'https://download.geonames.org/export/dump/' },
      { name: 'Sunrise equation', url: 'https://en.wikipedia.org/wiki/Sunrise_equation', note: 'sunrise and sunset computed from coordinates; time-zone rules from the browser\'s built-in IANA tz database' },
    ],
  },

  puzzle({ data, date, pick }) {
    const city = pick(data.cities);
    const year = Number(date.slice(0, 4));
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: city.tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
    const days = [];
    for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += 86400000) {
      const iso = new Date(t).toISOString().slice(0, 10);
      const s = sunUTC(iso, city.lat, city.lng);
      const rise = s.rise == null ? null : +clockHours(s.rise, fmt).toFixed(3);
      let set = s.set == null ? null : +clockHours(s.set, fmt).toFixed(3);
      if (rise != null && set <= rise) set = +(set + 24).toFixed(3); // sunset after local midnight (e.g. Reykjavik in summer)
      days.push({ iso, rise, set, noon: +clockHours(s.noon, fmt).toFixed(3) });
    }
    return { city, year, days };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const rows = p.days.filter((d) => d.rise != null).map((d) => ({ ...d, date: new Date(`${d.iso}T00:00:00Z`), len: d.set - d.rise }));
    const longest = rows.reduce((a, b) => (b.len > a.len ? b : a));
    const shortest = rows.reduce((a, b) => (b.len < a.len ? b : a));
    const today = rows.find((d) => d.iso.slice(5) === ctx.date.slice(5));

    const yMax = Math.max(24, Math.ceil(Math.max(...rows.map((d) => d.set)) / 3) * 3);
    const yTicks = Array.from({ length: yMax / 3 + 1 }, (_, i) => i * 3);
    const chart = await ui.plot((Plot, c) => ({
      height: 320,
      marginLeft: 48,
      x: { type: 'utc', tickFormat: '%b', label: null },
      y: { domain: [0, yMax], ticks: yTicks, tickFormat: (h) => h === 24 ? "24:00" : `${String(h % 24).padStart(2, "0")}:00`, label: null, grid: true },
      marks: [
        Plot.areaY(rows, { x: 'date', y1: 'rise', y2: 'set', fill: c.accent, fillOpacity: 0.16, curve: 'step' }),
        Plot.lineY(rows, { x: 'date', y: 'rise', stroke: c.accent, strokeWidth: 2, curve: 'step' }),
        Plot.lineY(rows, { x: 'date', y: 'set', stroke: c.ink, strokeWidth: 2, curve: 'step' }),
        Plot.lineY(rows, { x: 'date', y: 'noon', stroke: c.muted, strokeDasharray: '3 4', curve: 'step' }),
        Plot.ruleY([12], { stroke: c.muted, strokeOpacity: 0.5 }),
        today && Plot.ruleX([today.date], { stroke: c.ink, strokeOpacity: 0.35 }),
        Plot.tip(rows, Plot.pointerX({ x: 'date', y: 'set', title: (d) => `${d.iso}\nSunrise ${hhmm(d.rise)} · Sunset ${hhmm(d.set)}\nDaylight ${dur(d.len)}` })),
      ],
    }));

    ctx.stage.append(ui.panel(
      { kicker: `${p.year} · local clock time`, title: 'A year of daylight in this city' },
      chart,
      ui.h('div', { class: 'ds-row small mono ink2', style: { marginTop: '10px', gap: '16px' } },
        ui.h('span', ui.h('span', { style: { color: 'var(--accent)' } }, '━'), ' Sunrise'),
        ui.h('span', '━ Sunset'),
        ui.h('span', { class: 'muted' }, '┄ Solar noon')),
      ui.h('div', { class: 'ds-grid', style: { '--min': '150px', marginTop: '14px' } },
        ui.stat({ label: 'Longest day', value: hhmm(longest.len), sub: mdLabel(longest.iso) }),
        ui.stat({ label: 'Shortest day', value: hhmm(shortest.len), sub: mdLabel(shortest.iso) }),
        ui.stat({ label: 'Sunrise today', value: today ? hhmm(today.rise) : '—', sub: today ? `Sunset ${hhmm(today.set)}` : '' })),
    ));

    const res = await ctx.pin({
      answer: { lat: p.city.lat, lng: p.city.lng, label: `${p.city.name}, ${p.city.country}` },
      view: ctx.stage.clientWidth < 600 ? { bounds: [[-58, -170], [75, 180]] } : { center: [10, 10], zoom: 1 },
      scale: 1500,
      title: 'Where is it?',
    });

    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: p.city.tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
    const ex = explain(p.city, p.days, p.year, fmt);
    res.detail = ui.panel({ plain: true },
      ui.kv([
        ['Answer', `${p.city.name}, ${p.city.country} (population ${core.fmtCompact(p.city.pop)})`],
        ['Coordinates · time zone', `${p.city.lat.toFixed(2)}°, ${p.city.lng.toFixed(2)}° · ${p.city.tz}`],
        ['Latitude clue', ex.lat],
        ['Longitude clue', ex.lng],
        ['Daylight saving clue', ex.dst],
      ]));
    return res;
  },
};
