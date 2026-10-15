// #86 Rail Time — two stations, how long does the fastest scheduled train take?
export const hm = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min` : `${Math.round(min)} min`);
export const speed = (km, min) => Math.round((km / min) * 60);
// slider start: the middle of the log scale, identical for every puzzle (so it leaks nothing)
export const initialGuess = () => 245;
export const tier = (kmh) => (kmh >= 150 ? 3 : kmh >= 100 ? 2 : kmh >= 60 ? 1 : 0);

export function explain(p) {
  const v = speed(p.km, p.min);
  const stops = p.st === 0 ? 'no stops in between' : `${p.st} ${p.st === 1 ? 'stop' : 'stops'} in between`;
  const spread = p.slow > p.min * 1.15 ? `The slowest departure takes ${hm(p.slow)}, ${Math.round((p.slow / p.min - 1) * 100)}% longer than the fastest: some trains make more stops or take a detour.` : `All departures take about the same (slowest: ${hm(p.slow)}).`;
  const why = [
    `Average speed is only ${v} km/h (as the crow flies): a slow line or shared freight track, plus ${stops} and a winding route, so it takes longer than you would think. `,
    `Average speed ${v} km/h: a conventional passenger line, with ${stops}; stops and curves hold the speed down. `,
    `Average speed ${v} km/h: an express service, with ${stops}, so the train can run close to line speed. `,
    `Average speed ${v} km/h: a high-speed line, with ${stops}; the straight-line distance is almost the real route length. `,
  ][tier(v)];
  return `${why}${spread}`;
}

export default {
  meta: {
    num: 86,
    slug: 'rail-time',
    title: 'Rail Time',
    tagline: 'Two stations and the distance between them. How long does the fastest scheduled train take? US, Canada, Germany and France.',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      'The map marks today\'s departure station A and arrival station B, with the straight-line distance and the operator.',
      'Estimate how many minutes the fastest scheduled direct train takes from leaving A to arriving at B. Drag the slider (log scale) or type the minutes.',
      'You get 2 guesses; if the first is off, you are told whether it was too high or too low.',
      'Think: is it a high-speed line (ICE, TGV, Acela) or a slow line shared with freight? How many stops along the way?',
    ],
    scoring: 'Scored by ratio error: off by a factor of 1.35 earns about 63 points, a factor of 2 about 37; the second guess is docked 10%.',
    sources: [
      { name: 'Amtrak GTFS timetable', url: 'https://content.amtrak.com/content/gtfs/GTFS.zip', note: 'Oct 14, 2026 version' },
      { name: 'VIA Rail GTFS timetable', url: 'https://www.viarail.ca/sites/all/files/gtfs/viarail.zip', note: 'Oct 13, 2026 version' },
      { name: 'gtfs.de German long-distance GTFS (DELFI)', url: 'https://gtfs.de/', note: 'Download: https://download.gtfs.de/germany/fv_free/latest.zip' },
      { name: 'SNCF TGV GTFS timetable', url: 'https://eu.ftp.opendatasoft.com/sncf/plandata/export_gtfs_voyages.zip', note: 'Latest SNCF release, the 2025–26 winter timetable' },
      { name: 'GTFS specification', url: 'https://gtfs.org/' },
    ],
    dataNote: 'Only direct runs where both stations allow boarding or alighting on the same train are counted. Times are scheduled values with no delays, converted to UTC before subtracting. Each pair uses the fastest of all departures. The pool comes from timetable snapshots of 4 operators (Amtrak 40 puzzles, Germany 40, TGV 22, VIA 12), with a per-line cap so they are not all the same route. The French data is the latest public SNCF release (winter 2025–26). None of these GTFS files allow CORS, so the browser cannot fetch current data and this is a snapshot.',
  },

  puzzle({ data, pick }) {
    return { p: pick(data.pairs) };
  },

  async play(ctx, { p }) {
    const { ui } = ctx;
    const { a, b } = p;
    ctx.log('puzzle', a.id, b.id, p.km, p.min, p.op);
    // headroom north of the stations so the permanent tooltips are not clipped; keep the whole route in view
    const dLat = Math.max(Math.abs(a.lat - b.lat), 0.5), dLng = Math.max(Math.abs(a.lng - b.lng), 0.5);
    const box = [[Math.min(a.lat, b.lat) - dLat * 0.15, Math.min(a.lng, b.lng) - dLng * 0.12], [Math.max(a.lat, b.lat) + dLat * 0.3, Math.max(a.lng, b.lng) + dLng * 0.12]];
    const m = await ui.createMap({ bounds: box, height: 280 });
    ctx.stage.append(ui.panel({ kicker: 'Today\'s route', title: `${a.name} → ${b.name}` },
      m.el,
      ui.grid(140,
        ui.stat({ label: 'Distance', value: `${p.km} km` }),
        ui.stat({ label: 'Operator', value: p.op }),
      )));
    try {
      const { L, map } = m;
      const tip = () => ({ permanent: true, direction: 'top', offset: [-14, -8], opacity: 0.95 });
      L.marker([a.lat, a.lng]).addTo(map).bindTooltip('A Departure', tip());
      L.marker([b.lat, b.lng]).addTo(map).bindTooltip('B Arrival', tip());
      L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { dashArray: '6 6', weight: 2 }).addTo(map);
      await ctx.sleep(60);
      map.invalidateSize();
      map.fitBounds(box, { maxZoom: 9 });
    } catch (e) { ctx.log.warn('map overlay failed', String(e)); }

    const res = await ctx.estimate({
      title: 'How long does the fastest train take?',
      prompt: `${a.name} → ${b.name}, in minutes (60 min = 1 hour)`,
      answer: p.min, min: 20, max: 3000, log: true, step: 1, initial: initialGuess(p.km),
      format: (v) => hm(v),
      attempts: 2, scoring: 'log', scale: 0.3, tolerance: 0.03,
    });
    res.detail = ui.kv([
      ['Answer', `${hm(p.min)} (${p.min} minutes)`],
      ['Fastest departure', `${p.op} · ${p.train}${p.no ? ` ${p.no}` : ''}`],
      ['Average speed', `${speed(p.km, p.min)} km/h (by straight-line distance; the real route is longer)`],
      ['Departures', `${p.n} to choose from · the fastest makes ${p.st === 0 ? 'no stops in between' : `${p.st} ${p.st === 1 ? 'stop' : 'stops'} in between`}`],
      ['Pattern', explain(p)],
    ]);
    return res;
  },
};
