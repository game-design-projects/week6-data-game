// #15 Fare — a real NYC yellow-cab trip (pickup zone, dropoff zone, time of day); guess the metered fare and the duration.
import { haversineKm } from '../../engine/core.js';

const BASE = 3.0; // 2023 NYC initial charge (USD)
const PER_MILE = 3.5; // 0.70 per 1/5 mile at speed
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Rough rule-of-thumb meter: base + 3.5/mile (ignores slow-traffic time charge). */
export function roughFare(mi) { return BASE + PER_MILE * mi; }
/** Parse "2023-03-04T08:15" (local NYC clock) into parts. */
export function whenParts(t) {
  const d = new Date(`${t}:00Z`);
  const h = d.getUTCHours();
  const slot = h < 5 ? 'Late night' : h < 10 ? 'Morning' : h < 16 ? 'Daytime' : h < 20 ? 'Evening rush' : 'Night';
  return { wd: WD[d.getUTCDay()], hhmm: t.slice(11, 16), md: t.slice(5, 10), slot, h };
}
/** Distance-only and time-only meter estimates (USD). 2023: $3 + $0.70 per 1/5 mile, or $0.70/min when slower than ~12 mph. */
export function meterBounds(mi, min) { return { byDist: BASE + PER_MILE * mi, byTime: BASE + 0.7 * min }; }
/** Crow-fly miles between two zone centres. */
export const crowMiles = (a, b) => haversineKm({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) / 1.609344;
/** Teaching text for the result card: which pattern in this trip's data explains the fare. */
export function explain(t, crowMi) {
  const speed = t.mi / (t.min / 60);
  const { byDist, byTime } = meterBounds(t.mi, t.min);
  const wind = crowMi > 0.2 ? t.mi / crowMi : null;
  const parts = [];
  parts.push(`The meter ran ${t.mi} mi in ${fmtMin(t.min)}, an average of ${speed.toFixed(1)} mph. `);
  if (speed < 12) parts.push(`Below 12 mph the meter switches to time charging ($0.70/min): $3 + 0.70 × ${t.min.toFixed(0)} ≈ $${byTime.toFixed(2)}, ${byTime > byDist ? 'more' : 'less'} than the $${byDist.toFixed(2)} by distance alone. The actual fare was $${t.fare.toFixed(2)}. `);
  else parts.push(`Above 12 mph it is mostly distance-based: $3 + 3.5 × ${t.mi} ≈ $${byDist.toFixed(2)} (by time alone only $${byTime.toFixed(2)}). The actual fare was $${t.fare.toFixed(2)}. `);
  if (wind) parts.push(`The straight line between zone centers is ${crowMi.toFixed(1)} mi; the real route was ${wind.toFixed(1)}× that${wind > 1.5 ? ' (street grid or a detour)' : ''}. `);
  parts.push(speed < 8 ? 'At that speed the cab was stuck in city traffic, so time mattered more than distance for the fare.' : speed > 20 ? 'Above 20 mph it was probably an expressway or late-night traffic, so the fare is almost all distance.' : '');
  return parts.filter(Boolean).join('').trim();
}
export const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);

export default {
  meta: {
    num: 15,
    slug: 'fare',
    title: 'Fare',
    tagline: 'A real NYC yellow-cab trip: pickup zone, dropoff zone and time of day. Guess the metered fare and how long it took.',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      'The map marks the pickup zone (orange) and dropoff zone (blue) of a real 2023 trip, plus its date, weekday and departure time.',
      'First estimate the base fare on the meter (no tip, surcharges or tolls), then how long the ride took. Both are scored on a log scale: off by a factor of 2 earns about 37 points.',
      'Hint: $3 to start, then roughly $3.50 per mile; below 12 mph the meter charges $0.70 per minute instead. The map only shows zones, so estimate the real route yourself.',
    ],
    scoring: '100 points each for fare and duration, 200 in total; each is 100 × e^(−|log10(guess/answer)|/0.3): off by 2× is about 37, within 5% is nearly full marks.',
    sources: [
      { name: 'NYC TLC Yellow Taxi Trip Records 2023 (NYC Open Data)', url: 'https://data.cityofnewyork.us/Transportation/2023-Yellow-Taxi-Trip-Data/4b4i-vvec' },
      { name: 'NYC Taxi Zones (boundaries and names)', url: 'https://data.cityofnewyork.us/Transportation/NYC-Taxi-Zones/d3c5-ddgc' },
    ],
    dataNote: 'Trips come from the official 2023 TLC records, randomly sampled: only standard-rate trips with no tolls and 3 to 90 minutes are kept. For privacy the TLC publishes only pickup and dropoff zones (263 of them), not coordinates, so the dots on the map are zone centers, not the exact route. The data is released monthly with a lag of several months, so it cannot be live and is a snapshot. Sampling is 3 random dates per month × 5 time slots, drawn at random within each slot so the start of a slot is not favored.',
  },

  puzzle({ data, pick }) {
    return { trip: pick(data.trips) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const t = p.trip;
    const Z = ctx.data.zones;
    const pu = Z[t.pu], dz = Z[t.do];
    const w = whenParts(t.t);
    const crowMi = crowMiles(pu.c, dz.c);
    const km = crowMi * 1.609344;
    ctx.log('trip', t, { crowKm: km.toFixed(1) });

    const m = await ui.createMap({ bounds: L2bounds([pu.c, dz.c]), height: 280 });
    const { L, map } = m;
    L.polygon(pu.ring, { color: '#e4572e', weight: 2, fillOpacity: 0.35 }).addTo(map);
    L.polygon(dz.ring, { color: '#5b9bd5', weight: 2, fillOpacity: 0.35 }).addTo(map);
    L.polyline([pu.c, dz.c], { color: '#888', dashArray: '5 6', weight: 2 }).addTo(map);
    L.circleMarker(pu.c, { radius: 6, color: '#e4572e', fillOpacity: 1 }).addTo(map);
    L.circleMarker(dz.c, { radius: 6, color: '#5b9bd5', fillOpacity: 1 }).addTo(map);

    ctx.stage.append(ui.panel(
      { kicker: 'This trip', title: `${pu.name} → ${dz.name}` },
      m.el,
      ui.h('div', { class: 'ds-grid', style: { '--min': '110px', marginTop: '12px' } },
        ui.stat({ label: 'Departure', value: w.hhmm, sub: `${t.t.slice(0, 10)} ${w.wd}` }),
        ui.stat({ label: 'Time slot', value: w.slot, sub: 'New York local time' }),
        ui.stat({ label: 'Straight line', value: `${crowMi.toFixed(1)} mi`, sub: 'between zone centers' }),
        ui.stat({ label: 'Passengers', value: String(t.pax) })),
      ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, `Pickup: ${pu.name} (${pu.boro}) · Dropoff: ${dz.name} (${dz.boro})`),
    ));
    setTimeout(() => map.invalidateSize?.(), 50);

    const r1 = await ctx.estimate({
      title: 'What was the metered fare?', prompt: 'The base fare on the meter: initial charge plus distance or time charges, excluding tip, surcharges and tolls.',
      answer: t.fare, min: 3, max: 150, log: true, step: 0.5, initial: 20, format: (v) => core.fmtMoney(v),
      scoring: 'log', scale: 0.3,
    });
    const r2 = await ctx.estimate({
      title: 'How long was the ride?', answer: t.min, min: 2, max: 120, log: true, step: 1, initial: 20, format: (v) => fmtMin(v),
      scoring: 'log', scale: 0.3,
    });
    const res = ctx.combine([r1, r2]);

    res.detail = ui.kv([
      ['Fare', `${core.fmtMoney(t.fare)} (you guessed ${r1.guess != null ? core.fmtMoney(r1.guess) : '—'})`],
      ['Duration', `${fmtMin(t.min)} (you guessed ${r2.guess != null ? fmtMin(r2.guess) : '—'})`],
      ['Trip', `${pu.name} (${pu.boro}) → ${dz.name} (${dz.boro}), ${t.t.slice(0, 10)} ${w.hhmm}`],
      ['Why', explain(t, crowMi)],
    ]);
    return res;
  },
};

function L2bounds(pts) {
  const la = pts.map((q) => q[0]), ln = pts.map((q) => q[1]);
  const pad = 0.012;
  return [[Math.min(...la) - pad, Math.min(...ln) - pad], [Math.max(...la) + pad, Math.max(...ln) + pad]];
}
