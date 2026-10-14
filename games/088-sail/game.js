// #88 Sail — plan the fastest sailing route across a strait on a real wind field.
// Wind = ERA5-based reanalysis from Open-Meteo (noon UTC snapshot, frozen for the whole crossing).

const RAD = Math.PI / 180;
const KM_NM = 1.852;
const ANG = [0, 45, 90, 120, 150, 180];
const SHAPE = [0.72, 0.72, 1.0, 1.04, 0.9, 0.74]; // relative boat speed by true wind angle

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

/** Build a flat-earth model of a puzzle: km coordinates, wind and land lookups. */
export function model(p) {
  const { strait: st, n: N, w } = p;
  const [s, west, nn, e] = st.box;
  const lat0 = (s + nn) / 2, kx = 111.32 * Math.cos(lat0 * RAD), ky = 110.57;
  const toXY = (lat, lng) => [(lng - west) * kx, (lat - s) * ky];
  const toLL = (x, y) => [s + y / ky, west + x / kx];
  const W = (e - west) * kx, H = (nn - s) * ky;
  const dx = W / (N - 1), dy = H / (N - 1);
  const uv = w.map(([spd, dir]) => [-spd * Math.sin(dir * RAD), -spd * Math.cos(dir * RAD)]); // blowing TOWARD (east, north)
  const node = (i, j) => i * N + j; // row i counts from north
  const wind = (x, y) => {
    const fj = Math.min(N - 1.001, Math.max(0, x / dx)), fi = Math.min(N - 1.001, Math.max(0, (H - y) / dy));
    const j = Math.floor(fj), i = Math.floor(fi), tj = fj - j, ti = fi - i;
    const m = (k) => uv[node(i, j)][k] * (1 - ti) * (1 - tj) + uv[node(i, j + 1)][k] * (1 - ti) * tj + uv[node(i + 1, j)][k] * ti * (1 - tj) + uv[node(i + 1, j + 1)][k] * ti * tj;
    return [m(0), m(1)];
  };
  const land = (x, y) => {
    const j = Math.round(Math.min(N - 1, Math.max(0, x / dx))), i = Math.round(Math.min(N - 1, Math.max(0, (H - y) / dy)));
    return st.mask[node(i, j)] === '1';
  };
  /** hours to sail the straight segment, or null if it touches land */
  const leg = (a, b) => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d < 1e-6) return 0;
    const steps = Math.max(1, Math.ceil(d / 3));
    const hdg = Math.atan2(b[0] - a[0], b[1] - a[1]); // bearing, radians from north
    let hours = 0;
    for (let k = 0; k < steps; k++) {
      const t = (k + 0.5) / steps, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      if (land(x, y)) return null;
      const [u, v] = wind(x, y), tws = Math.hypot(u, v);
      const windFrom = Math.atan2(-u, -v); // direction wind comes from
      let twa = Math.abs(((hdg - windFrom) / RAD + 540) % 360 - 180);
      hours += d / steps / KM_NM / boatSpeed(tws, twa);
    }
    return hours;
  };
  return { toXY, toLL, W, H, dx, dy, wind, land, leg, A: toXY(st.a.lat, st.a.lng), B: toXY(st.b.lat, st.b.lng) };
}

/** Total hours of a polyline of [x,y] points (null if any leg hits land). */
export function routeHours(m, pts) {
  let t = 0;
  for (let i = 1; i < pts.length; i++) { const h = m.leg(pts[i - 1], pts[i]); if (h == null) return null; t += h; }
  return t;
}

/** Dijkstra on a fine lattice (plus the two ports): near-optimal route. */
export function optimalRoute(m, cells = 16) {
  const nodes = [m.A, m.B];
  for (let i = 0; i <= cells; i++) for (let j = 0; j <= cells; j++) {
    const q = [(m.W * j) / cells, (m.H * i) / cells];
    if (!m.land(q[0], q[1])) nodes.push(q);
  }
  const R = Math.max(m.W, m.H) / cells * 3.2;
  const dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = nodes.map(() => false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let k = 0; k < nodes.length; k++) if (!done[k] && (u < 0 || dist[k] < dist[u])) u = k;
    if (u < 0 || u === 1 || dist[u] === Infinity) break;
    done[u] = true;
    for (let k = 0; k < nodes.length; k++) {
      if (done[k] || Math.hypot(nodes[k][0] - nodes[u][0], nodes[k][1] - nodes[u][1]) > R && !(u === 0 && k === 1)) continue;
      const h = m.leg(nodes[u], nodes[k]);
      if (h != null && dist[u] + h < dist[k]) { dist[k] = dist[u] + h; prev[k] = u; }
    }
  }
  const path = [];
  for (let k = 1; k >= 0; k = prev[k]) path.unshift(nodes[k]);
  return { hours: dist[1], path: simplify(m, path) };
}

// drop waypoints that don't help (keeps the player-facing route short)
function simplify(m, path) {
  let out = path.slice(), improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < out.length - 1; i++) {
      const cut = out.filter((_, k) => k !== i);
      const a = routeHours(m, out), b = routeHours(m, cut);
      if (b != null && b <= a * 1.01) { out = cut; improved = true; break; }
    }
  }
  return out;
}

export const scoreFor = (opt, mine) => (mine == null ? 0 : Math.round(100 * Math.min(1, opt / mine) ** 3));
const hm = (h) => `${Math.floor(h)} 小时 ${String(Math.round((h % 1) * 60)).padStart(2, '0')} 分`;
const MAX_WP = 5;

export default {
  meta: {
    num: 88,
    slug: 'sail',
    title: 'Sail',
    tagline: '看着当天真实的风场，在海峡里布下航点，让帆船最快抵达对岸。',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      '地图上的箭头是某一天中午真实的风：箭头指向风吹去的方向，越大越粗风越强。灰色方块是陆地。',
      '点击海面添加航点（最多 5 个），船会依次驶过。帆船不能正对着风走，只能之字形迎风换舷，所以很慢；侧后方来风最快。',
      '点「出发」后按同一套船速模型计算总用时，与最优路线（算法求出）比较。',
      '计分：100 × (最优用时 / 你的用时)³。',
    ],
    scoring: '100 × (最优用时 ÷ 你的用时)³，封顶 100。',
    sources: [
      { name: 'Open-Meteo Historical Weather API (ERA5 / IFS 再分析)', url: 'https://open-meteo.com/en/docs/historical-weather-api', note: '10 米风速风向，网格点 12:00 UTC' },
      { name: 'Copernicus ERA5', url: 'https://cds.climate.copernicus.eu/' },
    ],
    dataNote: '风场来自 Open-Meteo 历史再分析（非实时 GFS：实时接口在构建时被限流），每个谜题冻结当天 12:00 UTC 的 9×9 风场，航行全程风不变。陆地由格点海拔推得，仅为粗略遮罩。船速为简化极坐标模型，不代表真实船型。',
    wide: true,
  },

  puzzle({ data, pick }) {
    const q = pick(data.puzzles);
    return { strait: data.straits[q.s], n: data.n, w: q.w, when: q.date, mean: q.mean };
  },

  async play(ctx, p) {
    const { ui, log } = ctx;
    const m = model(p);
    const st = p.strait;
    log('sail start', st.id, p.when);
    const opt = optimalRoute(m);
    const direct = routeHours(m, [m.A, m.B]);
    log('optimal hours', opt.hours.toFixed(2), 'direct', direct);

    const mp = await ui.createMap({ bounds: [[st.box[0], st.box[1]], [st.box[2], st.box[3]]], basemap: 'gray', height: 440 });
    const { L, map } = mp;
    const cellLL = (i, j) => m.toLL(j * m.dx, m.H - i * m.dy);
    const N = p.n;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const [lat, lng] = cellLL(i, j), k = i * N + j;
      if (st.mask[k] === '1') {
        L.rectangle([m.toLL(j * m.dx - m.dx / 2, m.H - i * m.dy - m.dy / 2), m.toLL(j * m.dx + m.dx / 2, m.H - i * m.dy + m.dy / 2)], { stroke: false, fillColor: '#8a8478', fillOpacity: 0.45, interactive: false }).addTo(map);
        continue;
      }
      const [spd, dir] = p.w[k], sz = 12 + Math.min(spd, 30) * 0.7;
      L.marker([lat, lng], { interactive: false, icon: L.divIcon({ className: '', iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
        html: `<svg width="${sz}" height="${sz}" viewBox="-10 -10 20 20" style="transform:rotate(${(dir + 180) % 360}deg);opacity:${0.35 + Math.min(spd, 25) / 40}"><path d="M0 -9 L5 3 L0 0 L-5 3 Z" fill="${spd > 18 ? '#c0392b' : spd > 11 ? '#d98a1f' : '#2a7ab0'}"/></svg>` }) }).addTo(map);
    }
    const mk = (pt, txt) => L.marker(m.toLL(...pt), { icon: L.divIcon({ className: '', iconSize: [96, 22], iconAnchor: [48, 11], html: `<div style="text-align:center;background:var(--ink);color:var(--paper);padding:2px 0;border-radius:99px;font:600 12px var(--font-mono);color:var(--paper)">${txt}</div>` }) }).addTo(map);
    mk(m.A, `⚓ ${st.a.name}`); mk(m.B, `🏁 ${st.b.name}`);

    const info = ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '14px', marginTop: '10px' } });
    const route = [m.A];
    const line = L.polyline([], { color: '#e0561b', weight: 4 }).addTo(map);
    const dots = L.layerGroup().addTo(map);
    const redraw = () => {
      line.setLatLngs([...route, m.B].map((q) => m.toLL(...q)).slice(0, route.length + 1));
      dots.clearLayers();
      route.slice(1).forEach((q) => L.circleMarker(m.toLL(...q), { radius: 6, color: '#e0561b', fillOpacity: 1, fillColor: '#fff' }).addTo(dots));
      line.setLatLngs([...route, m.B].map((q) => m.toLL(...q)));
      info.textContent = `航点 ${route.length - 1}/${MAX_WP} · 平均风速 ${p.mean} 节 · ${p.when}`;
    };
    redraw();

    return new Promise((resolve) => {
      let finished = false;
      const finish = (pts) => {
        if (finished) return; finished = true;
        const mine = routeHours(m, pts), score = scoreFor(opt.hours, mine);
        L.polyline(opt.path.map((q) => m.toLL(...q)), { color: '#1a9850', weight: 4, dashArray: '8 8' }).addTo(map);
        line.setLatLngs(pts.map((q) => m.toLL(...q)));
        log('submitted', mine, 'score', score);
        const tw = Math.round(Math.abs(((Math.atan2(m.B[0] - m.A[0], m.B[1] - m.A[1]) - Math.atan2(...(() => { const [u, v] = m.wind((m.A[0] + m.B[0]) / 2, (m.A[1] + m.B[1]) / 2); return [-u, -v]; })())) / RAD + 540) % 360 - 180));
        const saved = direct == null ? null : Math.round((1 - opt.hours / direct) * 100);
        const bars = Math.round(score / 20);
        resolve({
          score, max: 100, win: score >= 80,
          emoji: `⛵ ${st.a.name}→${st.b.name}\n${'🟦'.repeat(bars)}${'⬜'.repeat(5 - bars)} ${score}`,
          summary: `${hm(mine)} vs 最优 ${hm(opt.hours)}`,
          detail: ui.kv([
            ['你的用时', hm(mine)],
            ['最优用时', `${hm(opt.hours)}（绿色虚线，${opt.path.length - 2} 个转折点）`],
            ['直线航行', direct == null ? '被陆地挡住' : `${hm(direct)}${saved > 0 ? `，最优路线快 ${saved}%` : ''}`],
            ['风场日期', `${p.when} 12:00 UTC，海面平均 ${p.mean} 节`],
            ['看点', `直线航向与风向夹角约 ${tw}°。${tw < 50 ? '这几乎是迎风：只能之字形换舷，绕向侧风的航线更划算。' : tw > 140 ? '几乎顺风，船速偏慢，略偏离航向换成侧后方风往往更快。' : '接近侧风，直线已不差，更多靠避开弱风区、蹭上强风带取胜。'}`],
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
      ctx.stage.append(ui.panel({ kicker: `${st.name} · ${p.when}`, title: `从${st.a.name}驶向${st.b.name}`, aside: '点海面加航点' },
        mp.el, info, ui.h('div', { class: 'ds-row', style: { gap: '8px', marginTop: '10px' } }, go, undo, clear)));
      const fit = () => { map.invalidateSize(); map.fitBounds([[st.box[0], st.box[1]], [st.box[2], st.box[3]]]); };
      setTimeout(fit, 50); setTimeout(fit, 400);
      map.on('click', (ev) => {
        if (finished) return;
        if (route.length > MAX_WP) return ui.toast(`最多 ${MAX_WP} 个航点`);
        const q = m.toXY(ev.latlng.lat, ev.latlng.lng);
        if (m.leg(route[route.length - 1], q) == null) return ui.toast('那里是陆地，或这一段穿过陆地');
        route.push(q); redraw();
      });
      if (ctx.autoplay) setTimeout(() => finish(opt.path), 200);
    });
  },
};
