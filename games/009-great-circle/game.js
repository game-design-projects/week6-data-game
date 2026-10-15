// #9 Great Circle — draw the shortest flight path on a Mercator map; scored by
// the area between your line and the true great circle (measured on the map).
import { haversineKm } from '../../engine/core.js';

const RAD = Math.PI / 180;
/** Mercator y in "degrees" (so x and y share a unit). */
export const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD;

/** n+1 points [lat,lng] along the great circle a→b (a.lng < b.lng, b.lng may exceed 180 when the route crosses the antimeridian). */
export function gcPoints(a, b, n = 120) {
  const la = a.lat * RAD, lb = b.lat * RAD, lo1 = a.lng * RAD, lo2 = b.lng * RAD;
  const v = (la_, lo) => [Math.cos(la_) * Math.cos(lo), Math.cos(la_) * Math.sin(lo), Math.sin(la_)];
  const p = v(la, lo1), q = v(lb, lo2);
  const d = Math.acos(Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * p[0] + B * q[0], y = A * p[1] + B * q[1], z = A * p[2] + B * q[2];
    let lng = Math.atan2(y, x) / RAD;
    lng += 360 * Math.round(((out.length ? out[out.length - 1][1] : a.lng) - lng) / 360); // unwrap so lng stays continuous (may pass 180)
    out.push([Math.atan2(z, Math.hypot(x, y)) / RAD, lng]);
  }
  return out;
}

/**
 * Area (deg², Mercator map units) enclosed between a player path and the great circle.
 * Both run A→B; the closed polygon "path + reversed circle" is measured with the even-odd rule,
 * so lobes on both sides of the circle add up, zig-zags can't cancel out, and overshoots count.
 * Returns the area and the mean gap = area ÷ (east-west span of A→B).
 */
export function areaBetween(p, q, x0, x1, N = 720) {
  const poly = [...p, ...[...q].reverse()].map(([la, lo]) => [lo, merc(la)]);
  let xmin = Infinity, xmax = -Infinity;
  for (const [x] of poly) { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); }
  const dx = (xmax - xmin) / N;
  let area = 0;
  for (let i = 0; i < N; i++) {
    const x = xmin + (i + 0.5) * dx;
    const ys = [];
    for (let k = 0; k < poly.length; k++) {
      const [xa, ya] = poly[k], [xb, yb] = poly[(k + 1) % poly.length];
      if ((xa <= x) === (xb <= x)) continue;
      ys.push(ya + ((x - xa) / (xb - xa)) * (yb - ya));
    }
    ys.sort((u, v) => u - v);
    for (let k = 0; k + 1 < ys.length; k += 2) area += (ys[k + 1] - ys[k]) * dx;
  }
  return { area, mean: area / (x1 - x0) };
}

/** Share of the straight-line error that the player must beat: 100 at 0 gap, ≈37 when mean gap = 0.5 × the straight line's gap. */
export const scoreFor = (mean, base, k = 0.5) => Math.round(100 * Math.exp(-mean / (k * base)) * 10) / 10;

/** The straight map line a→b (constant bearing) as [lat,lng] points. */
export function rhumbPoints(a, b, n = 120) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const f = i / n, y = merc(a.lat) + f * (merc(b.lat) - merc(a.lat));
    return [(2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2) / RAD, a.lng + f * (b.lng - a.lng)];
  });
}

/** Highest-latitude point (vertex) of the great circle. */
export function vertex(gc) { return gc.reduce((m, p) => (Math.abs(p[0]) > Math.abs(m[0]) ? p : m), gc[0]); }

const norm = (lng) => ((((lng + 180) % 360) + 360) % 360) - 180;

const pathKm = (pts) => pts.reduce((s, p, i) => (i ? s + haversineKm({ lat: pts[i - 1][0], lng: pts[i - 1][1] }, { lat: p[0], lng: p[1] }) : s), 0);

export default {
  meta: {
    num: 9,
    slug: 'great-circle',
    title: 'Great Circle',
    tagline: '在墨卡托地图上画出两座城市之间的最短航线。你的线和真正的大圆航线之间的面积越小，分数越高。',
    category: 'geo',
    data: 'computed',
    howTo: [
      '地图上标出了今天的起点和终点（部分航线会跨过太平洋的日界线）。点击地图添加航点，线依次穿过它们，可「撤销」或「清空」。',
      '墨卡托地图把高纬度地区拉得很大：最短航线（大圆）在图上不是直线，而是向离极点更近的一侧拱起，起终点纬度越高、东西跨度越大，弧越明显。',
      '提交后会显示真实大圆航线，并比较两条线的实际飞行距离，以及大圆最北（南）能到哪里。',
      '计分：两条线在地图上围成的面积（折算为平均偏离）。以「直接连线」的偏离为基准：什么都不画只有约 13 分，偏离降到直线的一半约 37 分，贴着大圆得 100 分。来回折线不会抵消，两侧的面积都计入。',
    ],
    scoring: '100 × e^(−你的平均偏离 ÷ (0.5 × 直线的平均偏离))；平均偏离 = 两线围成的面积（偶奇规则）÷ 起终点的东西跨度，单位为墨卡托度。',
    sources: [
      { name: 'GeoNames cities15000', url: 'https://download.geonames.org/export/dump/', note: '城市坐标与人口（cities15000.zip、countryInfo.txt）' },
      { name: 'Great-circle distance', url: 'https://en.wikipedia.org/wiki/Great-circle_distance', note: '大圆航线由球面插值在浏览器内计算' },
    ],
    dataNote: '只有城市坐标来自 GeoNames 快照（城市没有"今日"数据，因此不联网取数）；起终点对按条件筛选：跨国、3,500–13,500 km、东西跨度 25°–170°（含跨日界线的航线）、直线与大圆的平均偏离 ≥ 3 墨卡托度。航线路径为球面几何计算，不考虑风、空域限制，所以角标为「计算」。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.pairs);
    return { a: p.a, b: p.b, km: p.km, gap: p.gap, vtx: p.vtx, vlng: p.vlng };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const log = ctx.log.scope('great-circle');
    const A = [p.a.lat, p.a.lng], B = [p.b.lat, p.b.lng];
    const gc = gcPoints(p.a, p.b);
    const straight = rhumbPoints(p.a, p.b);
    const base = areaBetween(straight, gc, p.a.lng, p.b.lng).mean;
    const wps = [];
    log('route', { from: p.a.name, to: p.b.name, km: p.km, base: +base.toFixed(2) });

    ctx.stage.append(ui.panel({ kicker: '今日航线', title: `${p.a.name} → ${p.b.name}` },
      ui.kv([
        ['起点', `${p.a.name}（${p.a.country}）`],
        ['终点', `${p.b.name}（${p.b.country}）`],
        ['大圆距离', `${core.fmtKm(p.km)}（提交后揭晓路线）`],
      ])));

    const box = ui.panel({ title: '画出最短航线' });
    ctx.stage.append(box);
    const lat0 = (p.a.lat + p.b.lat) / 2, lng0 = (p.a.lng + p.b.lng) / 2;
    const pad = Math.max(8, (p.b.lng - p.a.lng) * 0.15);
    const north = Math.max(p.a.lat, p.b.lat, p.vtx > 0 ? p.vtx : -90) + 4, south = Math.min(p.a.lat, p.b.lat, p.vtx < 0 ? p.vtx : 90) - 4;
    const m = await ui.createMap({
      center: [lat0, lng0], zoom: 3, height: 400,
      bounds: [[Math.max(-80, south - pad / 3), p.a.lng - pad], [Math.min(80, north + pad / 3), p.b.lng + pad]],
    });
    m.el.classList.add('crosshair');
    const { L, map } = m;
    const col = ui.colors();
    m.pin(A, 'answer', p.a.name);
    m.pin(B, 'answer', p.b.name);
    const line = L.polyline([A, B], { color: col.accent, weight: 4 }).addTo(map);
    const dots = L.layerGroup().addTo(map);
    const status = ui.h('div', { class: 'ink2 small' });
    const undo = ui.button('撤销', { variant: 'ghost', small: true });
    const clear = ui.button('清空', { variant: 'ghost', small: true });
    const submit = ui.button('提交航线', { variant: 'accent' });
    box.append(m.el, ui.h('div', { class: 'ds-row between', style: { marginTop: '12px', flexWrap: 'wrap', gap: '8px' } },
      status, ui.h('div', { class: 'ds-row', style: { gap: '8px' } }, undo, clear, submit)));

    const path = () => [A, ...wps, B];
    const redraw = () => {
      line.setLatLngs(path());
      dots.clearLayers();
      wps.forEach((w) => L.circleMarker(w, { radius: 7, color: col.accent, fillColor: col.paper, fillOpacity: 1, weight: 3 }).addTo(dots));
      status.textContent = wps.length ? `${wps.length} 个航点 · 当前飞行距离 ${core.fmtKm(pathKm(path()))}` : '点击地图添加航点（现在是起点→终点的直线）';
      undo.disabled = clear.disabled = !wps.length;
    };
    map.on('click', (e) => {
      let lng = e.latlng.lng;
      const mid = (p.a.lng + p.b.lng) / 2;
      while (lng < mid - 180) lng += 360;
      while (lng > mid + 180) lng -= 360;
      wps.push([Math.max(-82, Math.min(82, e.latlng.lat)), lng]);
      redraw();
    });
    undo.addEventListener('click', () => { wps.pop(); redraw(); });
    clear.addEventListener('click', () => { wps.length = 0; redraw(); });
    redraw();

    await new Promise((resolve) => {
      submit.addEventListener('click', resolve);
      if (ctx.autoplay) (async () => {
        await ctx.sleep(30);
        const g = gc[Math.floor(gc.length / 2)];
        wps.push([g[0] - 3, g[1]]); redraw();
        await ctx.sleep(30); resolve();
      })();
    });
    submit.remove(); undo.remove(); clear.remove();
    map.off('click');
    m.el.classList.remove('crosshair');

    const mine = path();
    const { mean } = areaBetween(mine, gc, p.a.lng, p.b.lng);
    const score = scoreFor(mean, base);
    const myKm = pathKm(mine);
    const straightKm = pathKm(straight);
    log('result', { wps: wps.length, mean: +mean.toFixed(2), score, myKm: Math.round(myKm) });

    L.polyline(gc, { color: col.hit, weight: 4 }).addTo(map);
    L.polyline(mine, { color: col.accent, weight: 3, dashArray: '6 6' }).addTo(map);
    m.setLabels(true);

    const v = vertex(gc);
    const hemi = v[0] >= 0 ? '北' : '南';
    const maxEnd = Math.max(Math.abs(p.a.lat), Math.abs(p.b.lat));
    const bars = Math.round(score / 10);
    return {
      score, max: 100,
      win: score >= 80,
      emoji: `✈️ ${'🟩'.repeat(bars)}${'⬜'.repeat(10 - bars)}`,
      summary: `平均偏离 ${mean.toFixed(1)}°（直线为 ${base.toFixed(1)}°）`,
      detail: ui.panel({ plain: true },
        ui.kv([
          ['大圆航线（绿）', core.fmtKm(p.km)],
          ['你的航线（虚线）', `${core.fmtKm(myKm)}（比大圆多 ${core.fmtKm(Math.max(0, myKm - p.km))}）`],
          ['地图直线（墨卡托）', `${core.fmtKm(straightKm)}（比大圆多 ${core.fmtKm(straightKm - p.km)}）`],
          ['你偏离了多少', `平均 ${mean.toFixed(2)}°，相当于直线偏离的 ${Math.round((mean / base) * 100)}%`],
          ['为什么', `${p.a.name}（${Math.abs(p.a.lat).toFixed(0)}°${p.a.lat >= 0 ? 'N' : 'S'}）到 ${p.b.name}（${Math.abs(p.b.lat).toFixed(0)}°${p.b.lat >= 0 ? 'N' : 'S'}）的大圆在 ${Math.abs(norm(v[1])).toFixed(0)}°${norm(v[1]) >= 0 ? 'E' : 'W'} 附近到达最${hemi}端 ${Math.abs(v[0]).toFixed(0)}°${v[0] >= 0 ? 'N' : 'S'}${Math.abs(v[0]) > maxEnd + 0.5 ? `，比两端城市还高 ${(Math.abs(v[0]) - maxEnd).toFixed(0)}°` : ''}。墨卡托图把高纬度放大，所以最短路线在图上向${hemi}极拱起；东西跨度 ${(p.b.lng - p.a.lng).toFixed(0)}° 越大、两端纬度越高，弧越明显。`],
        ])),
    };
  },
};
