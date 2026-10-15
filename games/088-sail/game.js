// #88 Sail — plan the fastest sailing route across a strait on a real, changing wind field.
// Wind = Open-Meteo 10 m wind on a 9x9 grid, 5 time frames (00/06/12/18/23 UTC) of one day; the boat sails from 00:00 UTC.
// Live: yesterday's archived model run (Open-Meteo Historical Forecast API). Fallback: ERA5 snapshot in data.json.

const RAD = Math.PI / 180;
const KM_NM = 1.852;
const ANG = [0, 45, 90, 120, 150, 180];
const SHAPE = [0.72, 0.72, 1.0, 1.04, 0.9, 0.74]; // relative boat speed by true wind angle
export const MAX_WP = 5;
export const HOURS = [0, 6, 12, 18, 23];
export const MEAN_RANGE = [6, 30]; // region-mean wind (kn) outside this makes a boring / unsafe day
const MIN_CHALLENGE = 97; // a straight line scoring ≥ this makes the puzzle trivial

/** Boat speed (kn) for true wind speed and angle off the wind (deg, 0 = head to wind). Upwind is sailed by tacking. */
export function boatSpeed(tws, twa) {
  const base = Math.min(0.75 * tws, 9) + 1; // reefs out around 12 kn, +1 kn engine/current floor
  const shape = (a) => {
    for (let i = 1; i < ANG.length; i++) if (a <= ANG[i]) return SHAPE[i - 1] + ((SHAPE[i] - SHAPE[i - 1]) * (a - ANG[i - 1])) / (ANG[i] - ANG[i - 1]);
    return SHAPE[SHAPE.length - 1];
  };
  if (twa >= 45) return base * shape(twa);
  return (base * shape(45) * Math.cos(45 * RAD)) / Math.cos(twa * RAD); // tacking at ±45°: progress along the course
}

/** Build a flat-earth model of a puzzle: km coordinates, time-dependent wind and land lookups. */
export function model(p) {
  const { strait: st, n: N, w: frames } = p;
  const hours = p.hours ?? HOURS;
  const [s, west, nn, e] = st.box;
  const lat0 = (s + nn) / 2, kx = 111.32 * Math.cos(lat0 * RAD), ky = 110.57;
  const toXY = (lat, lng) => [(lng - west) * kx, (lat - s) * ky];
  const toLL = (x, y) => [s + y / ky, west + x / kx];
  const W = (e - west) * kx, H = (nn - s) * ky;
  const dx = W / (N - 1), dy = H / (N - 1);
  const uvF = frames.map((f) => f.map(([spd, dir]) => [-spd * Math.sin(dir * RAD), -spd * Math.cos(dir * RAD)])); // blowing TOWARD (east, north)
  const node = (i, j) => i * N + j; // row i counts from north
  const spatial = (uv, x, y) => {
    const fj = Math.min(N - 1.001, Math.max(0, x / dx)), fi = Math.min(N - 1.001, Math.max(0, (H - y) / dy));
    const j = Math.floor(fj), i = Math.floor(fi), tj = fj - j, ti = fi - i;
    const m = (k) => uv[node(i, j)][k] * (1 - ti) * (1 - tj) + uv[node(i, j + 1)][k] * (1 - ti) * tj + uv[node(i + 1, j)][k] * ti * (1 - tj) + uv[node(i + 1, j + 1)][k] * ti * tj;
    return [m(0), m(1)];
  };
  /** wind vector (toward east, north; kn) at km position and hours since departure */
  const wind = (x, y, t = 0) => {
    const last = hours.length - 1;
    if (t <= hours[0] || last === 0) return spatial(uvF[0], x, y);
    if (t >= hours[last]) return spatial(uvF[last], x, y);
    let k = 0; while (t >= hours[k + 1]) k++;
    const f = (t - hours[k]) / (hours[k + 1] - hours[k]), a = spatial(uvF[k], x, y), b = spatial(uvF[k + 1], x, y);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
  const { mw, mh } = st;
  const land = (x, y) => {
    const j = Math.min(mw - 1, Math.max(0, Math.floor((x / W) * mw))), i = Math.min(mh - 1, Math.max(0, Math.floor(((H - y) / H) * mh)));
    return st.mask[i * mw + j] === '1';
  };
  /** hours to sail the straight segment when leaving at t0 hours, or null if it touches land */
  const leg = (a, b, t0 = 0) => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d < 1e-6) return 0;
    const steps = Math.max(1, Math.ceil(d / 2.5));
    const hdg = Math.atan2(b[0] - a[0], b[1] - a[1]); // bearing, radians from north
    let hours_ = 0;
    for (let k = 0; k < steps; k++) {
      const f = (k + 0.5) / steps, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
      if (land(x, y)) return null;
      const [u, v] = wind(x, y, t0 + hours_), tws = Math.hypot(u, v);
      const windFrom = Math.atan2(-u, -v); // direction wind comes from
      const twa = Math.abs((((hdg - windFrom) / RAD) + 540) % 360 - 180);
      hours_ += d / steps / KM_NM / boatSpeed(tws, twa);
    }
    return hours_;
  };
  return { toXY, toLL, W, H, dx, dy, wind, land, leg, A: toXY(st.a.lat, st.a.lng), B: toXY(st.b.lat, st.b.lng) };
}

/** Total hours of a polyline of [x,y] points (null if any leg hits land); departure at t = 0. */
export function routeHours(m, pts) {
  let t = 0;
  for (let i = 1; i < pts.length; i++) { const h = m.leg(pts[i - 1], pts[i], t); if (h == null) return null; t += h; }
  return t;
}
export const routeKm = (pts) => pts.slice(1).reduce((a, q, i) => a + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0);

function dijkstra(m, cells) {
  const long = Math.max(m.W, m.H), sp = long / cells, nx = Math.max(2, Math.ceil(m.W / sp)), ny = Math.max(2, Math.ceil(m.H / sp));
  const nodes = [m.A, m.B];
  for (let i = 0; i <= ny; i++) for (let j = 0; j <= nx; j++) {
    const q = [(m.W * j) / nx, (m.H * i) / ny];
    if (!m.land(q[0], q[1])) nodes.push(q);
  }
  const R = sp * 3.3;
  const dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = nodes.map(() => false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let k = 0; k < nodes.length; k++) if (!done[k] && (u < 0 || dist[k] < dist[u])) u = k;
    if (u < 0 || u === 1 || dist[u] === Infinity) break;
    done[u] = true;
    for (let k = 0; k < nodes.length; k++) {
      if (done[k] || (Math.hypot(nodes[k][0] - nodes[u][0], nodes[k][1] - nodes[u][1]) > R && !(u === 0 && k === 1))) continue;
      const h = m.leg(nodes[u], nodes[k], dist[u]); // time-dependent: arrival time is the label
      if (h != null && dist[u] + h < dist[k]) { dist[k] = dist[u] + h; prev[k] = u; }
    }
  }
  if (!Number.isFinite(dist[1])) return null;
  const path = [];
  for (let k = 1; k >= 0; k = prev[k]) path.unshift(nodes[k]);
  return path;
}

// at most MAX_WP interior points (so the benchmark is reachable by a player), dropping points that barely help
function simplify(m, path) {
  let out = path.slice();
  for (;;) {
    const base = routeHours(m, out);
    let best = -1, bestH = Infinity;
    for (let i = 1; i < out.length - 1; i++) {
      const h = routeHours(m, out.filter((_, k) => k !== i));
      if (h != null && h < bestH) { bestH = h; best = i; }
    }
    if (best < 0) break;
    if (out.length - 2 > MAX_WP || bestH <= base * 1.01) out = out.filter((_, k) => k !== best); else break;
  }
  return out;
}

// local coordinate descent on the interior points
function polish(m, path) {
  let out = path.map((q) => q.slice()), best = routeHours(m, out);
  let step = Math.max(m.W, m.H) / 24;
  for (let round = 0; round < 5; round++, step /= 2) {
    for (let it = 0; it < 12; it++) {
      let moved = false;
      for (let i = 1; i < out.length - 1; i++) {
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const cand = out.map((q) => q.slice()); cand[i] = [out[i][0] + ox * step, out[i][1] + oy * step];
          const h = routeHours(m, cand);
          if (h != null && h < best - 1e-4) { out = cand; best = h; moved = true; }
        }
      }
      if (!moved) break;
    }
  }
  return out;
}

/** Near-optimal route: time-dependent Dijkstra on a lattice, thinned to ≤ MAX_WP waypoints and polished. */
export function optimalRoute(m) {
  let path = null;
  for (const cells of [18, 30, 48]) { path = dijkstra(m, cells); if (path) break; }
  const direct = routeHours(m, [m.A, m.B]);
  if (!path) return { hours: Infinity, path: [m.A, m.B] };
  path = polish(m, simplify(m, path));
  let hours = routeHours(m, path);
  if (direct != null && direct <= hours) { path = [m.A, m.B]; hours = direct; }
  return { hours, path };
}

export const scoreFor = (opt, mine) => (mine == null ? 0 : Math.round(100 * Math.min(1, opt / mine) ** 3));
const hm = (h) => { const t = Math.round(h * 60); return `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, '0')} min`; };
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const compass = (deg) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** Region-mean wind speed (kn) over the grid and all frames. */
export const meanWind = (w) => { let s = 0, n = 0; for (const f of w) for (const [v] of f) { s += v; n++; } return +(s / n).toFixed(1); };

/** Puzzle-shaped object from a pool entry. */
export const toPuzzleObj = (data, q) => ({ strait: data.straits[q.s], n: data.n, hours: data.hours ?? HOURS, w: q.w, when: q.date, mean: q.mean, live: !!q.live });

/** Difficulty probe: optimal hours, direct hours and the score a straight line would get. */
export function difficulty(p) {
  const m = model(p), o = optimalRoute(m), direct = routeHours(m, [m.A, m.B]);
  return { opt: o.hours, direct, directScore: scoreFor(o.hours, direct), path: o.path };
}

/**
 * Shape one Open-Meteo multi-location response (81 grid points, hourly speed+direction for `date`) into a pool entry.
 * Throws when anything is missing, so the engine falls back to the snapshot.
 */
export function toPuzzle(raw, sIdx, date, hours = HOURS, n = 9) {
  const locs = Array.isArray(raw) ? raw : [raw];
  if (locs.length !== n * n) throw new Error(`expected ${n * n} grid points, got ${locs.length}`);
  const w = hours.map((h) => {
    const key = `${date}T${String(h).padStart(2, '0')}:00`;
    return locs.map((l) => {
      const ti = l?.hourly?.time?.indexOf(key);
      const spd = l?.hourly?.wind_speed_10m?.[ti], dir = l?.hourly?.wind_direction_10m?.[ti];
      if (!(ti >= 0) || !Number.isFinite(spd) || !Number.isFinite(dir)) throw new Error(`no wind for ${key}`);
      return [Math.round(spd), Math.round(dir) % 360];
    });
  });
  return { s: sIdx, date, mean: meanWind(w), w, live: true };
}

export const gridUrl = (st, n, date) => {
  const [s, w, nn, e] = st.box, la = [], lo = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { la.push((nn - ((nn - s) * i) / (n - 1)).toFixed(3)); lo.push((w + ((e - w) * j) / (n - 1)).toFixed(3)); }
  return `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${la.join(',')}&longitude=${lo.join(',')}&start_date=${date}&end_date=${date}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&timezone=UTC`;
};

const speedKn = (pts, hours) => routeKm(pts) / KM_NM / hours;

/** Puzzle-specific explanation of what made the optimal route win. */
export function explain(m, p, opt, direct, mine) {
  const { A, B } = m, dxy = [B[0] - A[0], B[1] - A[1]], dist = Math.hypot(...dxy);
  const brg = ((Math.atan2(dxy[0], dxy[1]) / RAD) + 360) % 360;
  // wind vector-averaged along the straight line while sailing
  const tEnd = direct ?? opt.hours;
  let su = 0, sv = 0;
  for (let k = 0; k < 7; k++) { const f = (k + 0.5) / 7, [u, v] = m.wind(A[0] + dxy[0] * f, A[1] + dxy[1] * f, tEnd * f); su += u; sv += v; }
  const wspd = Math.hypot(su, sv) / 7, wfrom = ((Math.atan2(-su, -sv) / RAD) + 360) % 360;
  const twa = Math.round(Math.abs((((brg - wfrom) + 540) % 360) - 180));
  // lateral offset of the optimal path
  let off = 0, side = '';
  for (const q of opt.path.slice(1, -1)) {
    const cross = (dxy[0] * (q[1] - A[1]) - dxy[1] * (q[0] - A[0])) / dist;
    if (Math.abs(cross) > Math.abs(off)) { off = cross; side = cross > 0 ? 'left' : 'right'; }
  }
  const seaMean = (t) => { let s = 0, n = 0; for (let i = 0; i < p.n; i++) for (let j = 0; j < p.n; j++) { const x = (m.W * j) / (p.n - 1), y = m.H - (m.H * i) / (p.n - 1); if (m.land(x, y)) continue; const [u, v] = m.wind(x, y, t); s += Math.hypot(u, v); n++; } return n ? s / n : 0; };
  const w0 = seaMean(0), w1 = seaMean(Math.min(opt.hours, 23));
  const type = twa < 50 ? 'Almost dead upwind: a sailboat cannot sail straight into the wind and has to tack at about 45°, which cuts its real progress sharply, so the best route bends toward a beam wind first.'
    : twa > 140 ? 'Nearly dead downwind: this is a slow gear for a sailboat, which goes faster with the wind on the quarter, so veering slightly off course to catch it usually pays.'
      : 'The wind is on the beam: the straight line is already decent, and the win comes from avoiding light-air zones and catching stronger bands.';
  const parts = [`The straight-line heading is ${Math.round(brg)}°, with an average ${compass(wfrom)} wind (blowing from ${Math.round(wfrom)}°) of ${wspd.toFixed(0)} kn along the way, about ${twa}° off the course. ${type}`];
  if (direct == null) parts.push('The straight line is blocked by land, so you must go around an island or headland first.');
  else if (opt.path.length > 2) parts.push(`The best route strays up to ${Math.abs(off).toFixed(0)} km from the straight line (to the ${side} of the direction of travel) and averages ${speedKn(opt.path, opt.hours).toFixed(1)} kn, against only ${speedKn([A, B], direct).toFixed(1)} kn on the straight line.`);
  else parts.push('Today the straight line is almost optimal: the wind field offers no better route beside it.');
  const dw = w1 - w0;
  if (Math.abs(dw) >= 1.5) parts.push(`The wind ${dw > 0 ? 'builds' : 'eases'} over time: mean wind over the sea goes from ${w0.toFixed(0)} kn at 00:00 UTC to ${w1.toFixed(0)} kn when the crossing ends, so ${dw > 0 ? 'the later wind is worth waiting for' : 'the early wind is worth grabbing'}.`);
  else parts.push(`The wind barely changes over time (sea average ${w0.toFixed(0)} → ${w1.toFixed(0)} kn), so what matters is where it is strong or weak.`);
  if (mine != null && mine.pts) parts.push(`Your route averaged ${speedKn(mine.pts, mine.hours).toFixed(1)} kn (${mine.pts.length - 2} ${mine.pts.length - 2 === 1 ? 'waypoint' : 'waypoints'}).`);
  return parts;
}

export default {
  meta: {
    num: 88,
    slug: 'sail',
    title: 'Sail',
    tagline: 'Study a real wind field over the sea and set up to 5 waypoints to sail across the strait as fast as you can.',
    category: 'transit',
    data: 'live',
    howTo: [
      'The arrows on the map are yesterday\'s real wind over the sea: each points the way the wind blows, and bigger, bolder arrows mean stronger wind (blue light, orange moderate, red strong). Gray blocks are land and cannot be crossed. The wind changes through the day: drag the wind-time slider to see 00:00 to 23:00 UTC. The boat leaves at 00:00 UTC.',
      'Click the water to add waypoints (up to 5); the boat sails through them in order. A sailboat cannot sail straight into the wind and has to zigzag, which is slow; wind from behind the beam is fastest; more wind means more speed, but above about 12 kn the boat reefs and stops speeding up.',
      'Press Set sail and the same boat model and wind field work out your total time, compared with the best route the algorithm found (green dashed line).',
      'Scoring: 100 × (best time ÷ your time)³, capped at 100. Twice as slow is only 12 points, 10% slower is about 75.',
    ],
    scoring: '100 × (best time ÷ your time)³, capped at 100. A route that crosses land cannot set sail.',
    sources: [
      { name: 'Open-Meteo Historical Forecast API (yesterday\'s wind, live)', url: 'https://open-meteo.com/en/docs/historical-forecast-api', note: '10 m wind speed and direction, 9×9 grid, 00/06/12/18/23 UTC' },
      { name: 'Open-Meteo Historical Weather API (ERA5 reanalysis, snapshot fallback)', url: 'https://open-meteo.com/en/docs/historical-weather-api' },
      { name: 'Natural Earth 1:50m land (world-atlas)', url: 'https://github.com/topojson/world-atlas', note: 'Used to build the land mask' },
    ],
    dataNote: 'Each day we read the whole of yesterday\'s 10 m wind field from the Open-Meteo historical forecast archive (an archived model run that no longer changes), on a 9×9 grid at 5 times of day. The boat leaves at 00:00 UTC and the wind is interpolated linearly in time. The strait is fixed by the day\'s number so everyone gets the same puzzle. If the live API is down, the wind is too light or too strong, or the straight line is already optimal, the next strait in a fixed order is tried, and if all fail the ERA5 reanalysis snapshot is used. The land mask comes from the Natural Earth 1:50m coastline (about 3 km per cell), and ports sit in open water just off the harbor. Boat speed is a simplified polar model, not a real hull, and the wind grid is about 25–40 km, so local effects such as island wind shadows and sea breezes are not captured.',
    wide: true,
  },

  puzzle({ data, pick }) {
    return toPuzzleObj(data, data.live ?? pick(data.puzzles));
  },

  async load(ctx) {
    const day = ctx.core.addDays(ctx.date, -1); // yesterday UTC: the archived model run is final all day
    if (day > ctx.core.addDays(ctx.today, -1)) throw new Error('future puzzle date');
    const straits = ctx.data.straits, first = straits.indexOf(ctx.pick(straits));
    for (let k = 0; k < 3; k++) {
      const s = (first + k) % straits.length, st = straits[s];
      try {
        const key = `sail:${day}:${st.id}`;
        let q = null;
        try { q = JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { /* storage unavailable */ }
        if (q?.w?.length === HOURS.length) ctx.log('live cache hit', key);
        else {
          const raw = await ctx.fetchJSON(gridUrl(st, ctx.data.n, day), { timeout: 12000 });
          q = toPuzzle(raw, s, day, ctx.data.hours ?? HOURS, ctx.data.n);
          try { localStorage.setItem(key, JSON.stringify(q)); } catch { /* ignore */ }
        }
        const diff = difficulty(toPuzzleObj(ctx.data, q));
        ctx.log('live', st.id, day, 'mean', q.mean, 'directScore', diff.directScore);
        if (q.mean < MEAN_RANGE[0] || q.mean > MEAN_RANGE[1]) { ctx.log(`skip ${st.id}: mean wind ${q.mean}`); continue; }
        if (!Number.isFinite(diff.opt) || diff.directScore >= MIN_CHALLENGE) { ctx.log(`skip ${st.id}: trivial or unreachable`); continue; }
        return { ...ctx.data, live: q };
      } catch (e) { ctx.log.warn('live fetch failed', st.id, e?.message ?? e); }
    }
    throw new Error('no usable live wind field, using the ERA5 snapshot'); // engine falls back to data.json and relabels the badge
  },

  async play(ctx, p) {
    const { ui, log } = ctx;
    const m = model(p);
    const st = p.strait;
    log('sail start', st.id, p.when, p.live ? 'live' : 'snapshot');
    const opt = optimalRoute(m);
    const direct = routeHours(m, [m.A, m.B]);
    log('optimal hours', opt.hours.toFixed(2), 'direct', direct, 'wp', opt.path.length - 2);

    const cw = Math.max(300, (ctx.stage.clientWidth || 360) - 40);
    const mapH = Math.round(Math.min(620, Math.max(360, (cw * m.H) / m.W)));
    const mp = await ui.createMap({ bounds: [[st.box[0], st.box[1]], [st.box[2], st.box[3]]], basemap: 'hillshade', height: mapH });
    const { L, map } = mp;
    map.options.zoomSnap = 0; // fractional zoom so the whole crossing fills the map
    // land mask, merged into horizontal runs
    const cx = m.W / st.mw, cy = m.H / st.mh;
    for (let i = 0; i < st.mh; i++) {
      let j = 0;
      while (j < st.mw) {
        if (st.mask[i * st.mw + j] !== '1') { j++; continue; }
        let k = j; while (k < st.mw && st.mask[i * st.mw + k] === '1') k++;
        L.rectangle([m.toLL(j * cx, m.H - (i + 1) * cy), m.toLL(k * cx, m.H - i * cy)], { stroke: false, fillColor: '#8a8478', fillOpacity: 0.5, interactive: false }).addTo(map);
        j = k;
      }
    }
    // wind arrows (rebuilt when the time slider moves)
    const N = p.n, arrows = L.layerGroup().addTo(map);
    const drawWind = (t) => {
      arrows.clearLayers();
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const x = j * m.dx, y = m.H - i * m.dy;
        if (m.land(x, y)) continue;
        const [u, v] = m.wind(x, y, t), spd = Math.hypot(u, v), toward = ((Math.atan2(u, v) / RAD) + 360) % 360, sz = 12 + Math.min(spd, 30) * 0.7;
        L.marker(m.toLL(x, y), { interactive: false, keyboard: false, icon: L.divIcon({ className: '', iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
          html: `<svg width="${sz}" height="${sz}" viewBox="-10 -10 20 20" style="transform:rotate(${toward}deg);opacity:${0.4 + Math.min(spd, 25) / 40}"><path d="M0 -9 L5 3 L0 0 L-5 3 Z" fill="${spd > 18 ? '#c0392b' : spd > 11 ? '#d98a1f' : '#2a7ab0'}"/></svg>` }) }).addTo(arrows);
      }
    };
    drawWind(0);
    const mk = (pt, txt) => L.marker(m.toLL(...pt), { interactive: false, icon: L.divIcon({ className: '', iconSize: [104, 22], iconAnchor: [52, 11], html: `<div style="text-align:center;background:var(--ink);color:var(--paper);padding:2px 0;border-radius:99px;font:600 12px var(--font-mono);white-space:nowrap">${txt}</div>` }) }).addTo(map);
    mk(m.A, `⚓ ${st.a.name}`); mk(m.B, `🏁 ${st.b.name}`);

    const info = ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '14px', marginTop: '10px' } });
    const route = [m.A];
    const line = L.polyline([], { color: '#e0561b', weight: 4 }).addTo(map);
    const dots = L.layerGroup().addTo(map);
    const redraw = () => {
      line.setLatLngs([...route].map((q) => m.toLL(...q)));
      dots.clearLayers();
      route.slice(1).forEach((q) => L.circleMarker(m.toLL(...q), { radius: 7, color: '#e0561b', fillOpacity: 1, fillColor: '#fff', interactive: false }).addTo(dots));
      const km = routeKm([...route, m.B]);
      info.textContent = `Waypoints ${route.length - 1}/${MAX_WP} · about ${Math.round(km)} km in all · mean wind ${p.mean} kn`;
    };
    redraw();

    const clock = ui.h('span', { class: 'mono' }, '00:00 UTC');
    const slider = ui.h('input', { type: 'range', class: 'ds-range', min: 0, max: 23, step: 1, value: 0, 'aria-label': 'Wind time (UTC hour)', style: { flex: '1 1 160px', minWidth: '140px' } });
    const sync = () => { const t = +slider.value; clock.textContent = `${String(t).padStart(2, '0')}:00 UTC`; slider.style.setProperty('--fill', `${(t / 23) * 100}%`); drawWind(t); };
    slider.addEventListener('input', sync);
    slider.style.setProperty('--fill', '0%');

    return new Promise((resolve) => {
      let finished = false;
      const finish = (pts) => {
        if (finished) return; finished = true;
        const mine = routeHours(m, pts), score = scoreFor(opt.hours, mine);
        L.polyline(opt.path.map((q) => m.toLL(...q)), { color: '#1a9850', weight: 4, dashArray: '8 8' }).addTo(map);
        opt.path.slice(1, -1).forEach((q) => L.circleMarker(m.toLL(...q), { radius: 5, color: '#1a9850', fillOpacity: 1, fillColor: '#fff', interactive: false }).addTo(map));
        line.setLatLngs(pts.map((q) => m.toLL(...q)));
        log('submitted', mine, 'score', score);
        const saved = direct == null ? null : Math.round((1 - opt.hours / direct) * 100);
        const bars = Math.round(score / 20);
        const why = explain(m, p, opt, direct, { pts, hours: mine });
        resolve({
          score, max: 100, win: score >= 80,
          emoji: `⛵ ${st.a.name}→${st.b.name}\n${'🟦'.repeat(bars)}${'⬜'.repeat(5 - bars)} ${score}`,
          summary: `${hm(mine)} vs best ${hm(opt.hours)}`,
          detail: ui.kv([
            ['Your time', hm(mine)],
            ['Best time', `${hm(opt.hours)} (green dashed line, ${opt.path.length - 2} ${opt.path.length - 2 === 1 ? 'turning point' : 'turning points'})`],
            ['Straight line', direct == null ? 'Blocked by land' : `${hm(direct)}${saved > 0 ? `; the best route is ${saved}% faster` : ''}`],
            ['Wind', `${p.live ? 'Live data, yesterday: ' : 'ERA5 reanalysis snapshot: '}${p.when} (UTC, leaving at 00:00), mean ${p.mean} kn`],
            ['What decided it', ui.h('div', { class: 'stack', style: { gap: '6px' } }, ...why.map((t) => ui.h('div', {}, t)))],
          ]),
        });
      };
      const go = ui.button('Set sail', { variant: 'accent', onClick: () => {
        const pts = [...route, m.B];
        if (routeHours(m, pts) == null) return ui.toast('The last leg crosses land. Add another waypoint.');
        finish(pts);
      } });
      const undo = ui.button('Undo', { variant: 'ghost', small: true, onClick: () => { if (route.length > 1) { route.pop(); redraw(); } } });
      const clear = ui.button('Clear', { variant: 'ghost', small: true, onClick: () => { route.length = 1; redraw(); } });
      const timeRow = ui.h('div', { class: 'ds-row small ink2', style: { gap: '10px', marginTop: '10px', alignItems: 'center', flexWrap: 'wrap' } }, 'Wind time', slider, clock);
      ctx.stage.append(ui.panel({ kicker: `${st.name} · ${p.live ? 'Yesterday\'s wind ' : 'Historical wind '}${p.when}`, title: `${st.a.name} to ${st.b.name}`, aside: 'Click the water to add waypoints' },
        mp.el, timeRow, info, ui.h('div', { class: 'ds-row', style: { gap: '8px', marginTop: '10px' } }, go, undo, clear)));
      const fit = () => { map.invalidateSize(); map.options.zoomSnap = 0; map.fitBounds([[st.box[0], st.box[1]], [st.box[2], st.box[3]]]); };
      setTimeout(fit, 50); setTimeout(fit, 400);
      map.on('click', (ev) => {
        if (finished) return;
        if (route.length > MAX_WP) return ui.toast(`At most ${MAX_WP} waypoints`);
        const q = m.toXY(ev.latlng.lat, ev.latlng.lng);
        if (m.leg(route[route.length - 1], q, 0) == null) return ui.toast('That is land, or this leg crosses land');
        route.push(q); redraw();
      });
      if (ctx.autoplay) setTimeout(() => finish(opt.path), 200);
    });
  },
};
