// #10 Drift — read the first 10 days of a real drifting buoy's track and work out where it is on day 90.
const R = 6371, RAD = Math.PI / 180;

/** Great-circle km between [lat,lng] points. */
export function km(a, b) {
  const dLa = (b[0] - a[0]) * RAD, dLo = (b[1] - a[1]) * RAD;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
/** Compass bearing (deg, 0=N) from a to b. */
export function bearing(a, b) {
  const dLo = (b[1] - a[1]) * RAD, y = Math.sin(dLo) * Math.cos(b[0] * RAD);
  const x = Math.cos(a[0] * RAD) * Math.sin(b[0] * RAD) - Math.sin(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.cos(dLo);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}
/** Straight-line extrapolation of the day0->day10 velocity to day 90 (flat-earth, cos-lat corrected). */
export function extrapolate(track) {
  const a = track[0], b = track[10], k = 80 / 10;
  const lat = Math.max(-85, Math.min(85, b[0] + (b[0] - a[0]) * k));
  return [lat, b[1] + (b[1] - a[1]) * k];
}
/** Tolerance scale (km) for scoring: 0 km -> 100, `scale` km -> ~37. Faster drifters wander further, so they are forgiven more. */
export function scaleFor(d10) { return Math.round(Math.max(300, Math.min(1000, 250 + 3 * d10))); }
/** Map bounds centred on day 10, wide enough to contain the day-90 spot without panning. */
export function viewFor(track) {
  const d10 = km(track[0], track[10]), c = track[10];
  const half = Math.max(12, Math.min(35, (d10 * 16) / 111));
  return [[Math.max(-85, c[0] - half), c[1] - half * 1.5], [Math.min(85, c[0] + half), c[1] + half * 1.5]];
}
export const inBounds = (b, p) => p[0] >= b[0][0] && p[0] <= b[1][0] && p[1] >= b[0][1] && p[1] <= b[1][1];
const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const latBand = (lat) => {
  const a = Math.abs(lat), hemi = lat >= 0 ? 'northern' : 'southern';
  if (a < 12) return 'Near the equator: trade winds drive the equatorial current, which runs mostly west, while the equatorial countercurrent carries buoys east.';
  if (a < 40) return `Subtropics of the ${hemi} hemisphere: buoys get swept around a ${lat >= 0 ? 'clockwise' : 'counterclockwise'} gyre, with strong western boundary currents (the Gulf Stream, the Kuroshio) on the western side of the ocean and slow, diffuse flow on the eastern side.`;
  if (lat < 0) return 'South of 40°S: the westerlies and the Antarctic Circumpolar Current push buoys east, fast.';
  return 'North of 40°N: the westerlies and subpolar gyres, where drift direction can change with eddies.';
};
const DIRS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
export const compass = (deg) => DIRS[Math.round(deg / 45) % 8];

export default {
  meta: {
    num: 10,
    slug: 'drift',
    title: 'Drift',
    tagline: 'The first 10 days of a real ocean drifter\'s track are drawn. Follow the current and mark where it will be on day 90.',
    category: 'geo',
    data: 'snapshot',
    howTo: [
      'The map shows the first 10 days of a NOAA Global Drifter Program (GDP) buoy. Each small dot is one day, the hollow circle is the start, and the dot labeled “Day 10” is the end of your clue.',
      'The buoy has no engine and goes wherever the current takes it. Read the track\'s direction, curvature and speed, and think about which ocean and latitude band it is in and whether a gyre will bend its path.',
      'Drop a pin where you think it is on day 90. You can drag it to adjust.',
      'Scoring is by distance: 0 km is 100 points, and every “scale” of error (300–1,000 km; faster buoys get more slack) drops it to about a third. After the reveal, the real track is drawn and compared with a straight-line extrapolation.',
    ],
    scoring: '100 × e^(−distance / scale), with a scale of 300–1,000 km set by the buoy\'s speed over the first 10 days (faster is more forgiving). The scale is shown in the puzzle.',
    sources: [
      { name: 'NOAA Global Drifter Program (AOML): 6-hour quality-controlled tracks', url: 'https://erddap.aoml.noaa.gov/gdp/erddap/tabledap/drifter_6hour_qc.html', note: 'Positions at 00:00 UTC each day' },
      { name: 'Global Drifter Program', url: 'https://www.aoml.noaa.gov/phod/gdp/' },
    ],
    dataNote: 'The pool is a pre-downloaded snapshot of real buoy tracks (91-day windows between 2019 and 2024, each buoy used once). The GDP ERDDAP server sends no CORS headers, so a browser cannot read it live, and quality-controlled tracks lag by several months. Buoys that cross the date line, or that drift less than 150 km in 90 days, were excluded.',
  },

  puzzle({ data, pick }) {
    const d = pick(data.drifters);
    return { id: d.id, start: d.start, drogued: d.drogued, track: d.track };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const t = p.track, hint = t.slice(0, 11), end = t[90];
    const d10 = km(t[0], t[10]);
    const brg = bearing(t[0], t[10]);
    ctx.log('puzzle', { id: p.id, start: p.start, d10: Math.round(d10) });

    ctx.stage.append(ui.panel({ kicker: `Buoy #${p.id} · from ${p.start}`, title: 'The clue: the first 10 days' },
      ui.h('div', { class: 'ds-grid', style: { '--min': '150px' } },
        ui.stat({ label: '10-day displacement', value: core.fmtKm(d10) }),
        ui.stat({ label: 'Average speed', value: `${(d10 / 10).toFixed(0)} km/day` }),
        ui.stat({ label: 'Heading', value: compass(brg) }),
        ui.stat({ label: 'Starting latitude', value: `${t[0][0].toFixed(1)}°` }))));

    const b = viewFor(t), scale = scaleFor(d10);
    const res = await ctx.pin({
      title: 'Where is it on day 90?',
      answer: { lat: end[0], lng: end[1], label: 'Day 90' },
      view: { bounds: b },
      scale,
      prompt: `Place the pin where you think it is on day 90. Being ${scale} km from the real spot scores about 37.`,
      setup: ({ map, L }) => {
        const c = ui.colors();
        L.polyline(hint, { color: c.accent, weight: 3 }).addTo(map);
        hint.forEach((q, i) => L.circleMarker(q, { radius: i === 0 || i === 10 ? 6 : 3, color: c.accent, weight: 2, fillColor: i === 0 ? c.paper : c.accent, fillOpacity: 1 }).addTo(map));
        L.marker(hint[10], { icon: L.divIcon({ className: '', html: '<b style="color:var(--ink);font-size:12px;white-space:nowrap;text-shadow:0 0 3px var(--paper)">Day 10</b>', iconAnchor: [-8, 8] }) }).addTo(map);
      },
      reveal: ({ map, L }) => {
        const c = ui.colors();
        L.polyline(t.slice(10), { color: c.ink, weight: 2, dashArray: '2 5' }).addTo(map);
        const ex = extrapolate(t);
        L.circleMarker(ex, { radius: 5, color: c.muted, weight: 2, fillOpacity: 0.4 }).addTo(map).bindTooltip('Straight-line extrapolation');
        map.fitBounds(L.latLngBounds([...t, ex]).pad(0.15));
      },
    });

    const ex = extrapolate(t), total = t.slice(1).reduce((s, q, i) => s + km(t[i], q), 0);
    const exErr = km(ex, end);
    const net = km(t[0], end), rest = km(t[10], end), path10 = t.slice(1, 11).reduce((a, q, k) => a + km(t[k], q), 0), restPath = total - path10;
    const b1 = bearing(t[0], t[10]), b2 = bearing(t[10], end), turn = angDiff(b1, b2);
    const early = path10 / 10, late = restPath / 80, straight = net / total;
    const shape = straight < 0.35 ? `It traveled ${core.fmtKm(total)} but its net displacement is only ${core.fmtKm(net)} (${Math.round(straight * 100)}%), a classic eddy-style loop.`
      : straight > 0.75 ? `It traveled ${core.fmtKm(total)} with a net displacement of ${core.fmtKm(net)} (${Math.round(straight * 100)}%), nearly a straight run.`
      : `It traveled ${core.fmtKm(total)} with a net displacement of ${core.fmtKm(net)} (${Math.round(straight * 100)}%), taking a winding path.`;
    const dir = turn > 90 ? `It headed ${compass(b1)} for the first 10 days, then ${compass(b2)} overall: almost a U-turn, so a straight-line extrapolation misses by a lot.`
      : turn > 45 ? `It headed ${compass(b1)} for the first 10 days, then turned toward the ${compass(b2)} overall.`
      : `It headed ${compass(b1)} for the first 10 days and kept going ${compass(b2)} overall, so its direction mostly held.`;
    const spd = late > early * 1.3 ? `Over the last 80 days it averaged ${late.toFixed(0)} km/day, faster than the ${early.toFixed(0)} of the first 10.` : late < early * 0.7 ? `Over the last 80 days it averaged ${late.toFixed(0)} km/day, slower than the ${early.toFixed(0)} of the first 10.` : `Over the last 80 days it averaged ${late.toFixed(0)} km/day, close to the first 10 days (${early.toFixed(0)}).`;
    res.detail = ui.kv([
      ['Actual position', `${end[0].toFixed(1)}°, ${end[1].toFixed(1)}° (${core.fmtKm(rest)} from its day-10 spot)`],
      ['Your result', `${core.fmtKm(res.km)} off; straight-line extrapolation ${core.fmtKm(exErr)} off${exErr > res.km ? ', so you beat it' : ', so it beat you'}`],
      ['Path shape', shape],
      ['Direction and speed', `${dir} ${spd}`],
      ['This stretch of ocean', latBand(t[0][0])],
      ['Drogue', p.drogued ? 'This buoy still has its drogue (a sea anchor at 15 m depth), so it follows the upper-ocean current.' : 'This buoy has lost its drogue, so the wind pushes it around more.'],
    ]);
    return res;
  },
};
