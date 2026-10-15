// #22 Isochrone — the 30-minute subway reach of a hidden station; pin where it starts.
// (Simplified from "bus + OpenTripPlanner": subway GTFS, precomputed offline.)

/** Split reached stations into time bands. */
export function bands(reached) {
  return {
    near: reached.filter((s) => s[2] <= 15),
    far: reached.filter((s) => s[2] > 15),
  };
}

/** Convex hull (monotone chain) of [lat, lng] points → [[lat, lng], …] ring. */
export function hull(points) {
  const p = [...new Map(points.map((q) => [q.join(','), q])).values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
  const lo = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = [];
  for (const q of [...p].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/** Score used by ctx.pin: 100·e^(−km/scale). */
export const pinScore = (km, scale = 2) => 100 * Math.exp(-km / scale);

/** Farthest reached station (by straight-line km) from the origin. */
export function farthest(origin, reached, distKm) {
  return reached.reduce((best, s) => {
    const d = distKm(origin, { lat: s[0], lng: s[1] });
    return !best || d > best.d ? { s, d } : best;
  }, null);
}

export default {
  meta: {
    num: 22,
    slug: 'isochrone',
    title: 'Isochrone',
    tagline: 'Every station you can reach in 30 minutes from one subway stop forms an isochrone. Read its shape and pin where it starts.',
    category: 'nyc',
    data: 'computed',
    howTo: [
      'The dots on the map are every subway station reachable within 30 minutes (waiting, transfers and at most one walking leg included) from one mystery station. Nothing is labeled, and the origin and its same-name neighbors are not drawn.',
      'Dark dots are within 15 minutes, light dots 15\u201330 minutes; the solid and dashed outlines enclose the two bands. Express lines stretch the isochrone into long tentacles, while local lines and transfer-heavy directions stay short.',
      'The origin sits in the middle of the dark cluster, or at the end of a line or the root of a tentacle: look for the gap. Tap the map where you think the origin is.',
      'Scored by distance: 0 km is 100 points, and the score falls to about a third for every 2 km off.',
    ],
    scoring: '100 \u00d7 e^(\u2212distance / 2 km).',
    sources: [
      { name: 'MTA NYC Transit subway GTFS (static)', url: 'http://web.mta.info/developers/data/nyct/subway/google_transit.zip' },
      { name: 'MTA developer resources', url: 'https://www.mta.info/developers' },
    ],
    dataNote: 'The original idea (bus + GTFS + OpenTripPlanner) cannot run in a browser: OTP needs a server, and the NYC bus GTFS runs to hundreds of MB. Instead we use the MTA subway static GTFS and run our own shortest-path search offline in build/: median weekday 10:00\u201315:00 running times between stops, an average 4-minute wait for each boarding, transfers using the minimum times in transfers.txt, plus at most one walking leg to another station (straight-line distance \u00d7 1.3, 80 m per minute, up to 600 m). There is no per-trip timetable and no live data, hence \u201ccomputed\u201d.',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { id: p.id, name: p.name, lat: p.lat, lng: p.lng, routes: p.routes, reached: p.reached };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const { near, far } = bands(p.reached);
    ctx.log('isochrone', p.name, 'reached', p.reached.length, 'near', near.length);
    const lat = p.reached.map((s) => s[0]).concat(p.lat);
    const lng = p.reached.map((s) => s[1]).concat(p.lng);
    const bounds = [[Math.min(...lat) - 0.01, Math.min(...lng) - 0.01], [Math.max(...lat) + 0.01, Math.max(...lng) + 0.01]];

    ctx.stage.append(ui.panel({ kicker: 'Isochrone', title: 'Where can you get in 30 minutes?' },
      ui.h('div', { class: 'ds-grid', style: { '--min': '120px' } },
        ui.stat({ label: 'Stations reached', value: p.reached.length }),
        ui.stat({ label: 'Within 15 min', value: near.length }),
        ui.stat({ label: '15\u201330 min', value: far.length }))));

    const markers = [];
    const res = await ctx.pin({
      title: 'Where does it start?',
      prompt: 'Dark = within 15 minutes, light = 15\u201330 minutes. The origin is the gap in the middle of the cluster, or at the end of a line.',
      answer: { lat: p.lat, lng: p.lng, label: p.name },
      view: { bounds },
      scale: 2,
      setup: async ({ map, L }) => {
        const c = ui.colors();
        const h30 = hull(p.reached.map((s) => [s[0], s[1]]));
        const h15 = hull(near.map((s) => [s[0], s[1]]));
        if (h30.length >= 3) L.polygon(h30, { color: c.accent, weight: 1.5, dashArray: '5 5', fillColor: c.accent, fillOpacity: 0.07, interactive: false }).addTo(map);
        if (h15.length >= 3) L.polygon(h15, { color: c.accent, weight: 2, fillColor: c.accent, fillOpacity: 0.12, interactive: false }).addTo(map);
        for (const s of far) markers.push([s, L.circleMarker([s[0], s[1]], { radius: 5, color: c.accent, weight: 1, fillColor: c.accent, fillOpacity: 0.3 }).addTo(map)]);
        for (const s of near) markers.push([s, L.circleMarker([s[0], s[1]], { radius: 6, color: c.ink, weight: 1, fillColor: c.accent, fillOpacity: 0.95 }).addTo(map)]);
      },
      reveal: async () => {
        // station names only appear after the guess
        for (const [s, m] of markers) m.bindTooltip(`${s[3]} \u00b7 ${Math.round(s[2])} min`);
      },
    });

    const f = farthest(p, p.reached, core.haversineKm);
    const nearest = p.reached.reduce((b, s) => Math.min(b, core.haversineKm(p, { lat: s[0], lng: s[1] })), Infinity);
    const cen = near.length ? {
      lat: near.reduce((a, s) => a + s[0], 0) / near.length,
      lng: near.reduce((a, s) => a + s[1], 0) / near.length,
    } : null;
    const off = cen ? core.haversineKm(p, cen) : null;
    res.detail = ui.panel({ plain: true },
      ui.kv([
        ['Origin', `${p.name} (${p.routes.join(' ')} ${p.routes.length === 1 ? 'train' : 'trains'})`],
        ['Farthest reached', f ? `${f.s[3]}, ${core.fmtKm(f.d)} as the crow flies, ${Math.round(f.s[2])} min` : '\u2014'],
        ['The clue', (off != null && off < 0.8
          ? `The center of the 15-minute cluster (${near.length} stations) is only ${core.fmtKm(off)} from the origin: the origin sits in the middle, and the gap in the cluster is where it hides.`
          : `The center of the 15-minute cluster (${near.length} stations) is ${core.fmtKm(off ?? 0)} from the origin: the origin is at one end (probably a terminal or branch end), so the cluster only spreads one way.`) +
          ` Even the nearest dot is ${core.fmtKm(nearest)} away, because the origin\u2019s own transfer stations are not drawn.` +
          ` The farthest dot, ${f ? f.s[3] : '\u2014'}, is ${f ? core.fmtKm(f.d) : '\u2014'} out. A long thin cluster means express service along the line; a round one means transfers and walking.`],
      ]));
    ctx.log('result', res.score);
    return res;
  },
};
