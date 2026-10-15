// #39 Landfall — a hurricane's track up to ~24 h before its first landfall; pin where it comes ashore.
// Real HURDAT2 best tracks. Clue: track curvature, forward speed, intensity, nearby coastline.

/** Mean forward speed (km/h) over the last k legs of a [lat,lng,w] track, 6 h per leg. */
export function speedKmh(track, k = 3, hav) {
  const n = track.length;
  const a = track[Math.max(0, n - 1 - k)], b = track[n - 1];
  return hav(a[0], a[1], b[0], b[1]) / (Math.min(k, n - 1) * 6);
}

/** Compass bearing (deg, 0 = N) from a to b. */
export function bearing(a, b) {
  const R = Math.PI / 180;
  const y = Math.sin((b[1] - a[1]) * R) * Math.cos(b[0] * R);
  const x = Math.cos(a[0] * R) * Math.sin(b[0] * R) - Math.sin(a[0] * R) * Math.cos(b[0] * R) * Math.cos((b[1] - a[1]) * R);
  return (Math.atan2(y, x) / R + 360) % 360;
}

/** Map window for the guess: track bbox + padding, clamped. Must always contain the landfall (tested over the pool). */
export function viewBounds(t, pad = 12) {
  const la = t.map((p) => p[0]), ln = t.map((p) => p[1]);
  return [[Math.max(-5, Math.min(...la) - pad), Math.min(...ln) - pad], [Math.min(70, Math.max(...la) + pad + 5), Math.max(...ln) + pad]];
}

/** Straight-line extrapolation of the last leg's heading and the recent mean speed for `hours`. */
export function extrapolate(track, hours, hav) {
  const n = track.length, last = track[n - 1];
  const spd = speedKmh(track, 3, hav), brg = bearing(track[Math.max(0, n - 4)], last);
  const R = Math.PI / 180, d = (spd * hours) / 6371, b = brg * R, la = last[0] * R, ln = last[1] * R;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const ln2 = ln + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return [la2 / R, ln2 / R];
}

/** Score: 100 * e^(-km/scale). */
export const SCALE = 400;
export const scoreFor = (km) => Math.round(100 * Math.exp(-km / SCALE));

const DIRS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
export const dirName = (deg) => DIRS[Math.round(deg / 45) % 8];
export const cat = (kt) => (kt >= 137 ? 'Category 5' : kt >= 113 ? 'Category 4' : kt >= 96 ? 'Category 3' : kt >= 83 ? 'Category 2' : kt >= 64 ? 'Category 1' : kt >= 34 ? 'Tropical storm' : 'Tropical depression');

export default {
  meta: {
    num: 39,
    slug: 'landfall',
    title: 'Landfall',
    tagline: 'The track of a historic hurricane, ending more than a day before landfall. Predict where it comes ashore and pin it on the map.',
    category: 'science',
    data: 'snapshot',
    howTo: [
      'The map shows the best track of a real hurricane (Atlantic or Northeast Pacific, after 1950) up to at least 24 hours before landfall. Bigger dots mean stronger wind.',
      'Look at its heading, how it is turning, and its speed: hurricanes are steered by the subtropical high and often curve northeast once they reach the westerlies.',
      'Pin the spot of its first landfall (islands count). 0 km scores 100, and every ~400 km cuts the score to about a third.',
    ],
    scoring: '100 × e^(−distance/400 km), with great-circle distance.',
    sources: [
      { name: 'NOAA NHC HURDAT2 Atlantic (1851–2025)', url: 'https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2025-02272026.txt', note: 'Best-track dataset; the record flagged L is the landfall' },
      { name: 'NOAA NHC HURDAT2 NE Pacific (1949–2025)', url: 'https://www.nhc.noaa.gov/data/hurdat/hurdat2-nepac-1949-2025-02272026.txt', note: 'Same format for the Northeast Pacific' },
    ],
    dataNote: 'An offline snapshot (NHC best tracks are post-season revised history that does not update daily, and there is no CORS-enabled API). Only named hurricanes after 1950 with peak wind of at least 64 knots and at least 8 six-hourly fixes before landfall are used; the track is shown up to at least 24 hours before the first landfall (the point flagged L, which may be an island). The Northwest Pacific, Indian Ocean and other basins are not in these two NHC datasets and are not included.',
  },

  puzzle({ data, pick }) {
    return { s: pick(data.storms) };
  },

  async play(ctx, { s }) {
    const { ui, core } = ctx;
    const t = s.track;
    const n = t.length;
    const spd = speedKmh(t, 3, (a, b, c, d) => core.haversineKm({ lat: a, lng: b }, { lat: c, lng: d }));
    const brg = bearing(t[Math.max(0, n - 4)], t[n - 1]);
    const turn = ((bearing(t[n - 2], t[n - 1]) - bearing(t[Math.max(0, n - 5)], t[Math.max(0, n - 3)]) + 540) % 360) - 180;
    ctx.log('storm', s.id, s.name, s.year);

    ctx.stage.append(ui.panel({ kicker: 'Clues', title: 'This hurricane has no name yet' },
      ui.h('div', { class: 'ds-grid', style: { '--min': '110px' } },
        ui.stat({ label: 'Intensity now', value: cat(t[n - 1][2]), sub: `${t[n - 1][2]} kt` }),
        ui.stat({ label: 'Heading', value: dirName(brg), sub: `${Math.round(brg)}°` }),
        ui.stat({ label: 'Forward speed', value: `${Math.round(spd)} km/h`, sub: Math.abs(turn) > 12 ? (turn > 0 ? 'turning right' : 'turning left') : 'fairly straight' }),
        ui.stat({ label: 'Time to landfall', value: `≥ ${s.hoursToLand} h` }))));

    const hav = (a, b, c, d) => core.haversineKm({ lat: a, lng: b }, { lat: c, lng: d });
    const ext = extrapolate(t, s.hoursToLand, hav);
    const res = await ctx.pin({
      title: 'Where will it make landfall?',
      answer: { lat: s.land.lat, lng: s.land.lng, label: `${s.name} (${s.year}) first landfall` },
      view: { bounds: viewBounds(t) },
      basemap: 'gray',
      scale: SCALE,
      setup: async ({ L, map }) => {
        L.polyline(t.map((p) => [p[0], p[1]]), { color: ui.colors().accent, weight: 3 }).addTo(map);
        t.forEach((p) => L.circleMarker([p[0], p[1]], { radius: 2 + p[2] / 18, color: ui.colors().ink, weight: 1, fillColor: ui.colors().accent, fillOpacity: 0.8 }).addTo(map));
      },
      reveal: async ({ L, map }) => {
        L.polyline(s.full.map((p) => [p[0], p[1]]), { color: ui.colors().ink, weight: 2, dashArray: '5 6' }).addTo(map);
        L.polyline([[t[n - 1][0], t[n - 1][1]], ext], { color: ui.colors().muted, weight: 2, dashArray: '2 6' }).addTo(map);
        L.circleMarker(ext, { radius: 5, color: ui.colors().muted, weight: 2, fillOpacity: 0 }).addTo(map);
      },
    });
    const extKm = Math.round(hav(ext[0], ext[1], s.land.lat, s.land.lng));
    res.detail = ui.kv([
      ['Hurricane', `${s.name} (${s.year})`],
      ['First landfall', `${s.land.date}, ${s.land.lat.toFixed(1)}°, ${s.land.lng.toFixed(1)}°, ${cat(s.land.w)} (${s.land.w} kt)`],
      ['Basin', s.basin === 'EP' ? 'Northeast Pacific' : 'Atlantic'],
      ['Lifetime peak', `${s.maxW} kt · ${cat(s.maxW)}`],
      ['Your error', `${Math.round(res.km)} km`],
      ['Clue', `The last fix (${s.hoursToLand} hours before landfall) was ${s.distKm} km from the landfall point, which takes an average of about ${Math.round(s.distKm / s.hoursToLand)} km/h; before that the storm moved ${dirName(brg)} at about ${Math.round(spd)} km/h, ${Math.abs(turn) > 12 ? (turn > 0 ? 'curving right (the typical turn in the Northern Hemisphere)' : 'curving left') : 'on a fairly straight path'}. The gray dotted circle on the map is where a straight-line extrapolation of that heading and speed lands, ${extKm} km from the real landfall; ${extKm < s.distKm * 0.6 ? 'the extrapolation is already close, so just follow the heading to the coast.' : 'it misses by more, meaning the storm turned or changed speed along the way, so you have to read the shape of the coastline.'}`],
    ]);
    return res;
  },
};
