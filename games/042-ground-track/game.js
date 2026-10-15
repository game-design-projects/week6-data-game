// #42 Ground Track — a satellite's sub-satellite track over 12 hours; classify its orbit.
import { latBucket, LAT_BUCKETS, LAT_EDGES, periodBucket, PERIOD_LADDER, toPuzzle } from './orbit.mjs';

export { toPuzzle };
export const CLASSES = [
  { id: 'leo', label: 'Low inclined circular', sub: 'ISS / Tiangong / Starlink', why: 'A circular orbit inclined 40\u00b0\u201375\u00b0 with a period near 90 minutes: about 8 laps in 12 hours, a bundle of slanted waves whose peak latitude equals the inclination.' },
  { id: 'sso', label: 'Sun-synchronous polar', sub: 'Earth observation / weather satellites', why: 'Inclined about 98\u00b0 (retrograde, near-polar): the track nearly grazes the poles, with wave peaks close to \u00b182\u00b0.' },
  { id: 'meo', label: 'Medium Earth navigation', sub: 'GPS / GLONASS / Galileo / BeiDou', why: 'A period of about 12\u201314 hours: only about one lap in 12 hours, one big wave, inclination 55\u00b0\u201365\u00b0.' },
  { id: 'mol', label: 'Molniya highly elliptical', sub: '12-hour period \u00b7 high eccentricity', why: 'Eccentricity about 0.7 and inclination 63.4\u00b0: it crawls near apogee over the Northern Hemisphere, so the track \u201chovers\u201d at high latitude, then sweeps quickly past the south.' },
  { id: 'geo', label: 'Geosynchronous', sub: 'GEO / inclined GSO', why: 'The period equals one sidereal day, so it barely moves: a single point at zero inclination, a figure 8 when inclined.' },
];

/** Puzzle-specific explanation of which feature of the track gave the class away. */
export function clue(s) {
  const laps = +(720 / s.periodMin).toFixed(1);
  switch (s.cls) {
    case 'leo': return `${laps} laps in 12 hours (period ${s.periodMin} min): a dense bundle of slanted waves. The peaks at ${s.maxLat}\u00b0 equal the inclination (${s.inc}\u00b0). A circular orbit inclined under 75\u00b0 means ISS / Tiangong / Starlink.`;
    case 'sso': return `The peaks almost touch the polar regions (${s.maxLat}\u00b0) because the inclination, ${s.inc}\u00b0, is over 90\u00b0: a retrograde near-polar orbit. Period ${s.periodMin} min, about ${laps} laps in 12 hours.`;
    case 'meo': return `Only about ${laps} laps in 12 hours (period ${s.periodMin} min), altitude near ${Math.round((s.perigeeKm + s.apogeeKm) / 2 / 1000)} thousand km, and an inclination of ${s.inc}\u00b0, between 55\u00b0 and 65\u00b0: a typical navigation satellite.`;
    case 'mol': return `Eccentricity ${s.ecc}: perigee ${s.perigeeKm} km, apogee ${s.apogeeKm} km. Apogee is over the Northern Hemisphere, where the satellite moves slowly, so the track bunches up at high latitude; the ${s.inc}\u00b0 inclination is close to the 63.4\u00b0 critical inclination.`;
    default: return s.inc < 1 ? `Period ${s.periodMin} min \u2248 one sidereal day and inclination only ${s.inc}\u00b0: the sub-satellite point barely moves, just a dot over 12 hours.` : `Period ${s.periodMin} min \u2248 one sidereal day, but the ${s.inc}\u00b0 inclination makes the sub-satellite point trace a figure 8 between \u00b1${s.maxLat}\u00b0 (an inclined geosynchronous orbit).`;
  }
}

export default {
  meta: {
    num: 42,
    slug: 'ground-track',
    title: 'Ground Track',
    tagline: 'A satellite\'s ground track over 12 hours. Tell whether it is ISS / Starlink, polar, GPS, Molniya or geosynchronous.',
    category: 'science',
    data: 'live',
    howTo: [
      'The orange line on the map is the ground projection of a real satellite over 12 hours. The green dot is the start, and white dots mark the positions at +3 / +6 / +9 / +12 hours.',
      'First decide the orbit class, then how long one lap takes and the highest latitude band it reaches. Three questions in all.',
      'Clues: the peak latitude = the orbital inclination (the map has a parallel every 15\u00b0); wider spacing between white dots = faster = shorter period; barely moving = geosynchronous; bunched up at high latitude = Molniya.',
      'One point per correct answer, 3 in total.',
    ],
    scoring: '3 questions, 1 point each, 3 in total. The latitude bands in the options all have edges on the map\'s parallels.',
    sources: [
      { name: 'CelesTrak GP orbital elements (JSON)', url: 'https://celestrak.org/NORAD/elements/gp.php', note: 'Groups stations / starlink / gps-ops / glo-ops / galileo / beidou / geo / weather / resource / science plus a MOLNIYA name query; today\'s satellite is refreshed by CATNR' },
    ],
    dataNote: 'Each day\'s satellite is fixed (drawn by date from a pool of 79 real satellites). When the game opens it fetches that satellite\'s latest orbital elements from CelesTrak and recomputes the 12-hour track from 00:00 UTC of that day; if that fails it falls back to the bundled snapshot (Oct 14, 2026 elements, counted from the element epoch). Tracks use two-body Kepler equations plus Earth rotation (no SGP4 perturbations or J2), accurate enough for the shape and the class but not for precise positioning. In the original idea, ISS and Starlink tracks are nearly identical (51.6\u00b0 vs 53\u00b0) and cannot be told apart from the ground track alone, so they form one class, joined by polar and geosynchronous orbits.',
    wide: false,
  },

  puzzle({ data, pick }) {
    const base = pick(data.sats);
    return { sat: data.live && data.live.id === base.id ? data.live : base };
  },

  async load(ctx) {
    if (ctx.date !== ctx.today) return null; // current elements only describe today's sky; other days use the snapshot
    const base = ctx.pick(ctx.data.sats);
    // elements keep updating through the day, so the window is anchored to 00:00 UTC of the puzzle date
    const raw = await ctx.fetchJSON(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${base.id}&FORMAT=json`, { timeout: 8000 });
    const live = toPuzzle(raw, ctx.date, base);
    if (!live) { ctx.log('live elements unusable, using snapshot for', base.name); return null; }
    ctx.log('live elements', live.name, live.epoch);
    return { ...ctx.data, live };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const s = p.sat;
    ctx.log('sat', s.name, s.cls);
    const c = ui.colors();
    const m = await ui.createMap({ center: [0, 0], zoom: 0, minZoom: 0, maxZoom: 6, height: 'clamp(240px, 70vw, 440px)' });
    const { L, map } = m;
    map.options.zoomSnap = 0.1;
    const fit = () => { map.invalidateSize(); map.setMaxBounds(null); map.fitBounds([[-82, -180], [82, 180]], { animate: false }); map.setMaxBounds([[-86, -180], [86, 180]]); map.options.maxBoundsViscosity = 1; };
    // graticule at the bucket edges (15/45/60/75) so the maximum latitude can be read off the map
    const lats = [0, ...LAT_EDGES.flatMap((e) => [e, -e]), 30, -30];
    lats.forEach((la) => {
      L.polyline([[la, -180], [la, 180]], { color: c.ink2, weight: la === 0 ? 1.2 : 0.8, opacity: la === 0 ? 0.55 : 0.3, dashArray: la === 0 ? null : '2 5', interactive: false }).addTo(map);
      L.marker([la, 180], { interactive: false, icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<span style="position:relative;top:-7px;left:-3px;transform:translateX(-100%);display:inline-block;font:600 10px var(--font-mono);color:var(--ink-2,#ccc);text-shadow:0 0 3px var(--paper,#000),0 0 3px var(--paper,#000)">${la === 0 ? '0°' : Math.abs(la) + '°' + (la > 0 ? 'N' : 'S')}</span>` }) }).addTo(map);
    });
    const line = '#ff9f1c';
    s.track.forEach((seg) => {
      if (seg.length < 2) return;
      const pts = seg.map(([a, b]) => [a / 10, b / 10]);
      L.polyline(pts, { color: c.paper, weight: 6, opacity: 0.7, interactive: false }).addTo(map);
      L.polyline(pts, { color: line, weight: 3, opacity: 1, interactive: false }).addTo(map);
    });
    (s.marks ?? []).forEach(([h, a, b]) => {
      L.circleMarker([a / 10, b / 10], { radius: 4, color: '#222', weight: 1, fillColor: '#fff', fillOpacity: 1 })
        .bindTooltip(`+${h} h`, { permanent: true, direction: 'top', offset: [0, -4], opacity: 0.9 }).addTo(map);
    });
    const [la, ln] = s.track[0][0];
    const startDot = L.circleMarker([la / 10, ln / 10], { radius: 7, color: '#fff', weight: 2, fillColor: '#2a9d4b', fillOpacity: 1 }).bindTooltip('Start', { direction: 'bottom', offset: [0, 6] }).addTo(map);
    ctx.stage.append(ui.panel({ kicker: `12 hours${s.from ? ` \u00b7 from UTC ${s.from.replace('T', ' ')}` : ''}`, title: 'This satellite\'s ground track' }, m.el));
    fit(); requestAnimationFrame(fit); setTimeout(fit, 300);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => fit()).observe(m.el);

    const cls = CLASSES.findIndex((x) => x.id === s.cls);
    const pb = periodBucket(s.periodMin);
    const lb = latBucket(s.maxLat);
    const r = await ctx.rounds({
      rounds: [
        { prompt: 'Which class of orbit is it?', options: CLASSES.map((x) => ({ label: x.label, sub: x.sub })), correct: cls, explain: clue(s) },
        { prompt: 'About how long does one lap take? (White dots are 3 hours apart.)', options: PERIOD_LADDER.map((x) => ({ label: x.label })), correct: pb, explain: `Actual period: ${s.periodMin} minutes (${(s.periodMin / 60).toFixed(1)} hours), about ${(720 / s.periodMin).toFixed(1)} laps in 12 hours.` },
        { prompt: 'What is the highest latitude the track reaches (north or south)?', options: LAT_BUCKETS.map((x) => ({ label: x })), correct: lb, explain: `The track peaks at ${s.maxLat}\u00b0, equal to the orbital inclination ${s.inc}\u00b0 (for a retrograde orbit over 90\u00b0, use 180\u00b0 minus it).` },
      ],
      minWidth: 150,
    });
    ctx.log('result', r.score);
    m.setLabels(true);
    startDot.unbindTooltip().bindTooltip(s.name, { permanent: true, direction: 'bottom', offset: [0, 6] }).openTooltip();
    r.detail = ui.panel({ plain: true }, ui.kv([
      ['Satellite', `${s.name} (NORAD ${s.id})`],
      ['Class', `${CLASSES[cls].label} (${CLASSES[cls].sub})`],
      ['What gives it away', clue(s)],
      ['Orbit', `period ${s.periodMin} min \u00b7 inclination ${s.inc}\u00b0 \u00b7 eccentricity ${s.ecc}`],
      ['Altitude', `perigee ${ctx.core.fmtNum(s.perigeeKm)} km \u00b7 apogee ${ctx.core.fmtNum(s.apogeeKm)} km`],
      ['Element epoch', s.epoch + ' UTC' + (s.from ? ` \u00b7 track starts ${s.from.replace('T', ' ')} UTC` : '')],
    ]));
    return r;
  },
};
