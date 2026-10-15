// #59 Tour Map — a tour's stops drawn on a map; name the artist, then the year.
// Data: MusicBrainz events that belong to a "Tour" series (CC0).
import { haversineKm } from '../../engine/core.js';

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtMd = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`;
const PLACE_TYPES = ['Stadium', 'Arena', 'Indoor arena', 'Venue', 'Religious building', 'Studio'];
const countryName = (cc) => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc); } catch { return cc; } };

/** Rough continent of a coordinate (coarse boxes, enough for a clue). */
export function regionOf(lat, lng) {
  if (lng < -30) return lat <= 12 && lng >= -82 && !(lat > 8 && lng < -77) ? 'South America' : 'North America';
  if (lat < -10 && lng > 110) return 'Oceania';
  if (lng >= -20 && lng < 52 && lat < 35.5 && (lng < 34.5 || lat < 12)) return 'Africa';
  if (lng >= -30 && lng < 45 && lat >= 35.5) return 'Europe';
  return 'Asia';
}
export const cityOf = (s) => s[3] || s[4];

/** stop = [date, lat, lng, city, venue, placeType] */
export function summarize(stops) {
  const cityCount = new Map();
  const types = new Map();
  const regions = new Map();
  for (const s of stops) {
    if (s[3]) cityCount.set(s[3], (cityCount.get(s[3]) || 0) + 1);
    const rg = regionOf(s[1], s[2]);
    regions.set(rg, (regions.get(rg) || 0) + 1);
    const t = PLACE_TYPES.includes(s[5]) ? s[5] : 'Other';
    types.set(t, (types.get(t) || 0) + 1);
  }
  const first = stops[0][0];
  const last = stops[stops.length - 1][0];
  let km = 0;
  for (let i = 1; i < stops.length; i++) km += haversineKm({ lat: stops[i - 1][1], lng: stops[i - 1][2] }, { lat: stops[i][1], lng: stops[i][2] });
  return {
    n: stops.length,
    cities: cityCount.size,
    top: [...cityCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3),
    types: [...types.entries()].sort((a, b) => b[1] - a[1]),
    regions: [...regions.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    first, last,
    spanDays: Math.round((Date.parse(last) - Date.parse(first)) / 864e5),
    km: Math.round(km),
  };
}

/** Years in [lo,hi] in which month-day `md` ('05-10') falls on weekday `wd` (0=Sun). */
export function yearsWithWeekday(md, wd, lo = 1965, hi = 2026) {
  const out = [];
  for (let y = lo; y <= hi; y++) if (new Date(`${y}-${md}T12:00:00Z`).getUTCDay() === wd) out.push(y);
  return out;
}

export default {
  meta: {
    num: 59,
    slug: 'tour-map',
    title: 'Tour Map',
    tagline: 'Every stop of a tour drawn on a map, with no names and no years. Name the artist first, then the year.',
    category: 'culture',
    data: 'snapshot',
    wide: true,
    howTo: [
      'Each dot is one stop on a tour (the thick ring is the first stop), joined by a dashed line in show order. The map has no labels; the clue panel gives show counts, continents, venue types and more.',
      'Step 1: pick the artist from the list, 6 guesses. Every miss unlocks a new clue, and after you finish the map shows place names.',
      'Step 2: guess the year of the tour\u2019s earliest show. We tell you the weekday it fell on; only a few years put that date on that weekday, so combine it with the artist\u2019s career.',
      'Venue type is a size fingerprint: stadium tours belong to superstars at their peak, theaters and clubs to early or niche tours.',
    ],
    scoring: 'Artist: 100 points on guess 1, about 17 fewer for each extra guess. Year: 100 for exact, falling to about 37 at roughly 2 years off (2 attempts, the second costs 10%). 200 in total.',
    sources: [
      { name: 'MusicBrainz Web Service (events, series, places)', url: 'https://musicbrainz.org/doc/MusicBrainz_API', note: 'CC0 data; artist events grouped by their \u201cTour\u201d series' },
      { name: 'setlist.fm API', url: 'https://api.setlist.fm/docs/1.0/index.html', note: 'The idea\u2019s original suggestion; it needs an API key that cannot ship in a browser, so we use the equivalent facts from MusicBrainz' },
    ],
    dataNote: 'MusicBrainz is community-edited and its tour listings are incomplete (shows are often missing, popular artists are better covered), so \u201cearliest show\u201d means the earliest one in the database. We keep only tours with at least 8 shows in 6 or more distinct places, dominated by a single artist, and prepare them offline as a snapshot; this is not live data (setlist.fm needs a key and MusicBrainz tour data does not change daily). Artists skew Western; Asian artists have few tour records in MusicBrainz. Venue names are shown in English.',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.tours).id };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const tour = ctx.data.tours.find((t) => t.id === p.id);
    const artist = ctx.data.artists.find((a) => a.id === tour.artist);
    const sum = summarize(tour.stops);
    const place = (x) => x[3] || x[4];
    ctx.log('tour', tour.tour, artist.name, tour.year, sum);

    // map of stops (label-free basemap while guessing; names come back on reveal)
    const bounds = tour.stops.reduce(([[s, w], [n, e]], x) => [[Math.min(s, x[1]), Math.min(w, x[2])], [Math.max(n, x[1]), Math.max(e, x[2])]], [[90, 180], [-90, -180]]);
    const m = await ui.createMap({ bounds, height: window.innerWidth < 600 ? 300 : 380, basemap: 'gray', minZoom: 1 });
    const c = ui.colors();
    const pts = tour.stops.map((x) => [x[1], x[2]]);
    m.L.polyline(pts, { color: c.accent, weight: 1.5, opacity: 0.55, dashArray: '4 5' }).addTo(m.map);
    const markers = tour.stops.map((x, i) => m.L.circleMarker([x[1], x[2]], { radius: i === 0 ? 8 : 5, color: i === 0 ? c.ink : c.accent, weight: i === 0 ? 2 : 1, fillColor: c.accent, fillOpacity: 0.8 })
      .bindTooltip(i === 0 ? 'First stop' : `Stop ${i + 1}`).addTo(m.map));
    ctx.stage.append(ui.panel({ kicker: 'Clues', title: 'Where this tour went' }, m.el,
      ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '14px', marginTop: '8px' } },
        ui.h('span', `${sum.n} shows`), ui.h('span', `${sum.cities} ${sum.cities === 1 ? 'city' : 'cities'}`), ui.h('span', `dashed line about ${core.fmtNum(sum.km)} km`), ui.h('span', 'thick ring = first stop'))));
    // the map can be measured before layout settles: refit once the panel is in the page and on every resize
    const fit = () => { if (!m.el.clientWidth) return; m.map.invalidateSize(); m.map.fitBounds(bounds, { padding: [24, 24], maxZoom: 7 }); };
    requestAnimationFrame(fit);
    setTimeout(fit, 300);
    if (typeof ResizeObserver !== 'undefined') { let w = 0; new ResizeObserver(() => { if (m.el.clientWidth && m.el.clientWidth !== w) { w = m.el.clientWidth; fit(); } }).observe(m.el); }

    const cityList = (xs) => xs.map(([n, k]) => (k > 1 ? `${n} ×${k}` : n)).join(', ');
    const first = tour.stops[0];
    const last = tour.stops.at(-1);
    const clues = [
      `The database lists ${sum.n} shows in ${sum.cities} ${sum.cities === 1 ? 'city' : 'cities'}, spanning ${core.fmtNum(sum.spanDays)} ${sum.spanDays === 1 ? 'day' : 'days'} from first to last.`,
      `Shows by continent: ${sum.regions.map(([r, k]) => `${r} ${k}`).join(', ')}.`,
      `It opens in ${place(first)}${first[3] ? ` (${first[4]})` : ''} and closes in ${place(last)}${last[3] ? ` (${last[4]})` : ''}.`,
      `Most-visited cities: ${cityList(sum.top)}. Venue types: ${sum.types.map(([t, k]) => `${t} ${k}`).join(', ')}.`,
      `A few of the venues: ${[...new Set(tour.stops.map((x) => x[4]))].slice(2, 6).join(', ')}.`,
      `The artist is from ${artist.country ? countryName(artist.country) : 'an unknown country'}, and the name starts with \u201c${artist.name[0].toUpperCase()}\u201d.`,
    ];
    const byId = new Map(ctx.data.artists.map((a) => [a.id, a]));
    const r1 = await ctx.guess({
      title: 'Whose tour is this?',
      placeholder: 'Type an artist\u2026',
      options: ctx.data.artists.map((a) => ({ id: a.id, label: a.name, hint: a.country ? countryName(a.country) : '', aliases: [a.query] })),
      answer: artist.id,
      maxGuesses: 6,
      clues,
      cluesTitle: 'Clues',
      columns: ['Country'],
      near: (g) => byId.get(g.id).country && byId.get(g.id).country === artist.country,
      feedback: (g) => {
        const ga = byId.get(g.id);
        const same = ga.country && ga.country === artist.country;
        return [{ text: ga.country ? countryName(ga.country) : '—', state: same ? 'near' : undefined }];
      },
    });
    ctx.log('artist stage', r1.win, r1.summary);
    // reveal: place names on the map
    m.setLabels(true);
    markers.forEach((mk, i) => mk.setTooltipContent(`${i + 1}. ${place(tour.stops[i])} · ${tour.stops[i][0]}`));

    // stage 2: year
    const [d0] = first;
    const wd = new Date(`${d0}T12:00:00Z`).getUTCDay();
    const cand = yearsWithWeekday(d0.slice(5), wd);
    const md = fmtMd(d0);
    const stadium = sum.types.find((t) => t[0] === 'Stadium')?.[1] || 0;
    ctx.stage.append(ui.panel({ kicker: `Answer: ${artist.name}`, title: 'Year clue' },
      ui.h('div', { class: 'ds-stack' },
        ui.h('div', `The earliest show in the database is on ${md}, a ${WD[wd]}.`),
        ui.h('div', { class: 'small ink2' }, `Years from 1965 to 2026 when ${md} fell on a ${WD[wd]}: `, ui.h('span', { class: 'mono' }, cand.join(', '))),
        ui.h('div', { class: 'small ink2' }, `${stadium} of ${sum.n} shows were in stadiums. Combine that with ${artist.name}\u2019s career and pick a year.`))));
    const r2 = await ctx.estimate({
      title: 'What year was the earliest show?',
      answer: tour.year, min: 1965, max: 2026, step: 1, initial: 2005,
      format: (v) => String(Math.round(v)), scoring: 'abs', scale: 2, attempts: 2, tolerance: 0.5,
    });

    const res = ctx.combine([r1, r2]);
    const nearest = cand.filter((y) => y !== tour.year).sort((a, b) => Math.abs(a - tour.year) - Math.abs(b - tour.year))[0];
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['Tour', tour.tour], ['Artist', artist.name], ['Earliest show', `${first[0]} · ${place(first)}`], ['Latest show', `${last[0]} · ${place(last)}`], ['Scale', `${sum.n} shows / ${sum.cities} ${sum.cities === 1 ? 'city' : 'cities'} / about ${core.fmtNum(sum.km)} km`]]),
      ui.h('div', { class: 'small ink2' }, `How to tell: shows by continent were ${sum.regions.map(([r, k]) => `${r} ${k}`).join(', ')}, mostly ${sum.types.slice(0, 2).map(([t, k]) => `${t} ${k}`).join(' and ')} venues` +
        `${stadium / sum.n >= 0.4 ? ' (a high stadium share means a top-tier superstar tour)' : stadium === 0 ? ' (no stadiums: a tour of small and mid-size venues)' : ''}. ${md} was a ${WD[wd]}, and only ${cand.length} ${cand.length === 1 ? 'year' : 'years'} between 1965 and 2026 fit` +
        `${nearest ? ` (the nearest other one is ${nearest})` : ''}; the answer, ${tour.year}, is among them.` + (artist.country ? ` ${artist.name} is from ${countryName(artist.country)}.` : '')),
      ui.table({ columns: [{ key: 'd', label: 'Date' }, { key: 'c', label: 'City' }, { key: 'v', label: 'Venue' }], rows: tour.stops.slice(0, 12).map((x) => ({ d: x[0], c: x[3] || '—', v: x[4] })) }),
      tour.stops.length > 12 ? ui.h('div', { class: 'small muted' }, `Showing the first 12 of ${tour.stops.length} shows.`) : null);
    return res;
  },
};
