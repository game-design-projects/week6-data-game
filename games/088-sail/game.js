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
const hm = (h) => { const t = Math.round(h * 60); return `${Math.floor(t / 60)} 小时 ${String(t % 60).padStart(2, '0')} 分`; };
const COMPASS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
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
    if (Math.abs(cross) > Math.abs(off)) { off = cross; side = cross > 0 ? '左' : '右'; }
  }
  const seaMean = (t) => { let s = 0, n = 0; for (let i = 0; i < p.n; i++) for (let j = 0; j < p.n; j++) { const x = (m.W * j) / (p.n - 1), y = m.H - (m.H * i) / (p.n - 1); if (m.land(x, y)) continue; const [u, v] = m.wind(x, y, t); s += Math.hypot(u, v); n++; } return n ? s / n : 0; };
  const w0 = seaMean(0), w1 = seaMean(Math.min(opt.hours, 23));
  const type = twa < 50 ? '几乎正迎风：帆船无法直接逆风，只能以约 45° 之字形换舷，实际前进速度被大幅压低，所以最优路线会先绕向侧风的方向。'
    : twa > 140 ? '接近正顺风：这是帆船的慢档，侧后方来风的船速反而更高，所以略微偏离航向、改吃侧后风通常更划算。'
      : '风向与航向呈侧风：直线本身已经不差，胜负取决于能否避开弱风区、蹭上强风带。';
  const parts = [`直线航向 ${Math.round(brg)}°，途中平均是${compass(wfrom)}风（风从 ${Math.round(wfrom)}° 吹来）${wspd.toFixed(0)} 节，与航向夹角约 ${twa}°。${type}`];
  if (direct == null) parts.push('直线航线被陆地挡住，必须先绕过岛屿或海岬。');
  else if (opt.path.length > 2) parts.push(`最优路线偏离直线最多 ${Math.abs(off).toFixed(0)} km（偏向前进方向的${side}侧），平均船速 ${speedKn(opt.path, opt.hours).toFixed(1)} 节；直线只有 ${speedKn([A, B], direct).toFixed(1)} 节。`);
  else parts.push('这一天直线几乎就是最优：风场没有把更好的路线送到航线旁边。');
  const dw = w1 - w0;
  if (Math.abs(dw) >= 1.5) parts.push(`风力随时间${dw > 0 ? '增强' : '减弱'}：海面平均风速从 00:00 UTC 的 ${w0.toFixed(0)} 节变为航行结束时的 ${w1.toFixed(0)} 节，${dw > 0 ? '后半程的风更值得等待' : '前半程的风更值得抢'}。`);
  else parts.push(`风力随时间变化不大（海面平均 ${w0.toFixed(0)} → ${w1.toFixed(0)} 节），关键在空间上的强弱分布。`);
  if (mine != null && mine.pts) parts.push(`你的路线平均船速 ${speedKn(mine.pts, mine.hours).toFixed(1)} 节（${mine.pts.length - 2} 个航点）。`);
  return parts;
}

export default {
  meta: {
    num: 88,
    slug: 'sail',
    title: 'Sail',
    tagline: '看着真实的海上风场，布下最多 5 个航点，让帆船最快横渡海峡。',
    category: 'transit',
    data: 'live',
    howTo: [
      '地图上的箭头是昨天的真实海面风：箭头指向风吹去的方向，越大越粗风越强（蓝色弱、橙色中、红色强）。灰色块是陆地，不能穿越。风会随时间变化，拖动「风场时刻」滑块可以看到 00:00–23:00 UTC 的风怎么变；帆船在 00:00 UTC 出发。',
      '点击海面添加航点（最多 5 个），船依次驶过。帆船不能正对着风走，只能之字形迎风换舷，很慢；侧后方来风最快；风越强越快，但约 12 节后船会收帆、不再加速。',
      '点「出发」后用同一套船速模型和同一个风场，计算你的总用时，并与算法找到的最优路线（绿色虚线）比较。',
      '计分：100 × (最优用时 ÷ 你的用时)³，封顶 100。慢一倍只有 12 分，慢 10% 约 75 分。',
    ],
    scoring: '100 × (最优用时 ÷ 你的用时)³，封顶 100；路线穿过陆地不能出发。',
    sources: [
      { name: 'Open-Meteo Historical Forecast API（昨日风场，实时）', url: 'https://open-meteo.com/en/docs/historical-forecast-api', note: '10 米风速风向，9×9 网格，00/06/12/18/23 UTC' },
      { name: 'Open-Meteo Historical Weather API（ERA5 再分析，快照备用）', url: 'https://open-meteo.com/en/docs/historical-weather-api' },
      { name: 'Natural Earth 1:50m 陆地（world-atlas）', url: 'https://github.com/topojson/world-atlas', note: '生成陆地遮罩' },
    ],
    dataNote: '每天从 Open-Meteo 历史预报存档读取「昨天」整天的 10 米风场（预报模型的存档运行，当天不再变动），取 9×9 网格、5 个时刻，帆船 00:00 UTC 出发，风随时间线性插值。海峡由当天序号固定，所有人拿到同一题；如果实时接口不可用、当天风太小太大或直线就是最优，会按固定顺序换下一个海峡，全部失败则改用 ERA5 再分析快照。陆地遮罩来自 Natural Earth 1:50m 海岸线（约 3 km 一格），港口取在港外开阔水域。船速为简化极坐标模型，不代表真实船型；风场分辨率约 25–40 km，岛屿背风、海陆风等局地效应没有体现。',
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
      info.textContent = `航点 ${route.length - 1}/${MAX_WP} · 全程约 ${Math.round(km)} km · 区域平均风 ${p.mean} 节`;
    };
    redraw();

    const clock = ui.h('span', { class: 'mono' }, '00:00 UTC');
    const slider = ui.h('input', { type: 'range', class: 'ds-range', min: 0, max: 23, step: 1, value: 0, 'aria-label': '风场时刻（UTC 小时）', style: { flex: '1 1 160px', minWidth: '140px' } });
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
          summary: `${hm(mine)} vs 最优 ${hm(opt.hours)}`,
          detail: ui.kv([
            ['你的用时', hm(mine)],
            ['最优用时', `${hm(opt.hours)}（绿色虚线，${opt.path.length - 2} 个转折点）`],
            ['直线航行', direct == null ? '被陆地挡住' : `${hm(direct)}${saved > 0 ? `，最优路线快 ${saved}%` : ''}`],
            ['风场', `${p.live ? '实时数据：昨天' : 'ERA5 再分析快照：'} ${p.when}（UTC，00:00 出发），区域平均 ${p.mean} 节`],
            ['答案在哪', ui.h('div', { class: 'stack', style: { gap: '6px' } }, ...why.map((t) => ui.h('div', {}, t)))],
          ]),
        });
      };
      const go = ui.button('出发', { variant: 'accent', onClick: () => {
        const pts = [...route, m.B];
        if (routeHours(m, pts) == null) return ui.toast('最后一段穿过了陆地，请再加一个航点');
        finish(pts);
      } });
      const undo = ui.button('撤销', { variant: 'ghost', small: true, onClick: () => { if (route.length > 1) { route.pop(); redraw(); } } });
      const clear = ui.button('清除', { variant: 'ghost', small: true, onClick: () => { route.length = 1; redraw(); } });
      const timeRow = ui.h('div', { class: 'ds-row small ink2', style: { gap: '10px', marginTop: '10px', alignItems: 'center', flexWrap: 'wrap' } }, '风场时刻', slider, clock);
      ctx.stage.append(ui.panel({ kicker: `${st.name} · ${p.live ? '昨日实况 ' : '历史风场 '}${p.when}`, title: `从${st.a.name}驶向${st.b.name}`, aside: '点海面加航点' },
        mp.el, timeRow, info, ui.h('div', { class: 'ds-row', style: { gap: '8px', marginTop: '10px' } }, go, undo, clear)));
      const fit = () => { map.invalidateSize(); map.options.zoomSnap = 0; map.fitBounds([[st.box[0], st.box[1]], [st.box[2], st.box[3]]]); };
      setTimeout(fit, 50); setTimeout(fit, 400);
      map.on('click', (ev) => {
        if (finished) return;
        if (route.length > MAX_WP) return ui.toast(`最多 ${MAX_WP} 个航点`);
        const q = m.toXY(ev.latlng.lat, ev.latlng.lng);
        if (m.leg(route[route.length - 1], q, 0) == null) return ui.toast('那里是陆地，或这一段穿过陆地');
        route.push(q); redraw();
      });
      if (ctx.autoplay) setTimeout(() => finish(opt.path), 200);
    });
  },
};
