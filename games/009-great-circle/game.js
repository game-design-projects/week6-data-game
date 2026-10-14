// #9 Great Circle — draw the shortest flight path on a Mercator map; scored by
// the area between your line and the true great circle (measured on the map).
import { haversineKm } from '../../engine/core.js';

const RAD = Math.PI / 180;
/** Mercator y in "degrees" (so x and y share a unit). */
export const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD;

/** n+1 points [lat,lng] along the great circle a→b (a.lng < b.lng, no antimeridian crossing). */
export function gcPoints(a, b, n = 120) {
  const la = a.lat * RAD, lb = b.lat * RAD, lo1 = a.lng * RAD, lo2 = b.lng * RAD;
  const v = (la_, lo) => [Math.cos(la_) * Math.cos(lo), Math.cos(la_) * Math.sin(lo), Math.sin(la_)];
  const p = v(la, lo1), q = v(lb, lo2);
  const d = Math.acos(Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * p[0] + B * q[0], y = A * p[1] + B * q[1], z = A * p[2] + B * q[2];
    out.push([Math.atan2(z, Math.hypot(x, y)) / RAD, Math.atan2(y, x) / RAD]);
  }
  return out;
}

/** Mean Mercator-y of a polyline [[lat,lng]…] at map-x = lng (averages multiple crossings). */
function yAt(poly, x) {
  let s = 0, k = 0;
  for (let i = 1; i < poly.length; i++) {
    const [la1, x1] = poly[i - 1], [la2, x2] = poly[i];
    if ((x1 - x) * (x2 - x) > 0 || x1 === x2) continue;
    const f = (x - x1) / (x2 - x1);
    s += merc(la1) + f * (merc(la2) - merc(la1)); k++;
  }
  return k ? s / k : null;
}

/** Area between two polylines on the Mercator map (deg²) and mean gap (deg) over the x-span. */
export function areaBetween(p, q, x0, x1, N = 400) {
  let area = 0, last = 0;
  const dx = (x1 - x0) / N;
  for (let i = 0; i <= N; i++) {
    const x = x0 + i * dx;
    const a = yAt(p, Math.min(x, x1 - 1e-9)), b = yAt(q, Math.min(x, x1 - 1e-9));
    const g = a == null || b == null ? last : Math.abs(a - b);
    last = g;
    area += g * dx * (i === 0 || i === N ? 0.5 : 1);
  }
  return { area, mean: area / (x1 - x0) };
}

/** 100 at 0° mean gap, ≈37 at `scale` degrees of mean Mercator gap. */
export const scoreFor = (mean, scale = 5) => Math.round(100 * Math.exp(-mean / scale) * 10) / 10;

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
      '地图上标出了今天的起点和终点。点击地图添加航点，线会依次穿过它们，可「撤销」或「清空」。',
      '墨卡托地图把两极拉得很大，最短航线（大圆）在图上不是直线，而是向离极点更近的一侧弯曲。',
      '提交后会显示真实大圆航线，并比较两条线的实际飞行距离。',
      '计分：按两线在地图上围成的面积（折算为平均偏离）。0 偏离得 100 分，平均偏离约 5° 时降到约 37 分。',
    ],
    scoring: '100 × e^(−平均偏离/5°)，平均偏离 = 两线间面积 ÷ 横向跨度（墨卡托度）。',
    sources: [
      { name: 'GeoNames cities15000', url: 'https://download.geonames.org/export/dump/', note: '城市坐标与人口；大圆航线由球面插值离线/浏览器内计算' },
      { name: 'Great-circle distance', url: 'https://en.wikipedia.org/wiki/Great-circle_distance' },
    ],
    dataNote: '起终点城市对从 GeoNames 人口较多的城市中按条件筛选（跨国、3,500–13,000 km、不跨越日界线、大圆与直线差异明显）；航线不考虑风、空域限制，仅为几何最短路径。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.pairs);
    return { a: p.a, b: p.b, km: p.km, gap: p.gap };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const log = ctx.log.scope('great-circle');
    const A = [p.a.lat, p.a.lng], B = [p.b.lat, p.b.lng];
    const gc = gcPoints(p.a, p.b);
    const wps = [];
    log('route', { from: p.a.name, to: p.b.name, km: p.km });

    ctx.stage.append(ui.panel({ kicker: '今日航线', title: `${p.a.name} → ${p.b.name}` },
      ui.h('div', { class: 'ds-grid', style: { '--min': '140px' } },
        ui.stat({ label: '起点', value: p.a.name, sub: p.a.country }),
        ui.stat({ label: '终点', value: p.b.name, sub: p.b.country }),
        ui.stat({ label: '大圆距离', value: core.fmtKm(p.km), sub: '提交后揭晓路线' }))));

    const box = ui.panel({ title: '画出最短航线' });
    ctx.stage.append(box);
    const lat0 = (p.a.lat + p.b.lat) / 2, lng0 = (p.a.lng + p.b.lng) / 2;
    const pad = Math.max(8, (p.b.lng - p.a.lng) * 0.15);
    const m = await ui.createMap({
      center: [lat0, lng0], zoom: 3, height: 400,
      bounds: [[Math.min(p.a.lat, p.b.lat) - pad, p.a.lng - pad], [Math.max(p.a.lat, p.b.lat) + pad, p.b.lng + pad]],
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
      wps.forEach((w) => L.circleMarker(w, { radius: 6, color: col.accent, fillColor: col.paper, fillOpacity: 1, weight: 3 }).addTo(dots));
      status.textContent = wps.length ? `${wps.length} 个航点 · 当前飞行距离 ${core.fmtKm(pathKm(path()))}` : '点击地图添加航点（现在是起点→终点的直线）';
    };
    map.on('click', (e) => {
      let lng = e.latlng.lng;
      while (lng < p.a.lng - 180) lng += 360;
      while (lng > p.a.lng + 180) lng -= 360;
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
    const { area, mean } = areaBetween(mine, gc, p.a.lng, p.b.lng);
    const score = scoreFor(mean);
    const myKm = pathKm(mine);
    // the straight line on the Mercator map, for comparison
    const straightKm = pathKm(Array.from({ length: 121 }, (_, i) => {
      const f = i / 120, y = merc(p.a.lat) + f * (merc(p.b.lat) - merc(p.a.lat));
      return [(2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2) / RAD, p.a.lng + f * (p.b.lng - p.a.lng)];
    }));
    log('result', { wps: wps.length, mean: +mean.toFixed(2), score, myKm: Math.round(myKm) });

    L.polyline(gc, { color: col.hit, weight: 4 }).addTo(map);
    L.polyline(mine, { color: col.accent, weight: 3, dashArray: '6 6' }).addTo(map);
    const km2 = area * 111.19 * 111.19;

    const bars = Math.round(score / 10);
    return {
      score, max: 100,
      win: score >= 80,
      emoji: `✈️ ${'🟩'.repeat(bars)}${'⬜'.repeat(10 - bars)}`,
      summary: `平均偏离 ${mean.toFixed(1)}°`,
      detail: ui.panel({ plain: true },
        ui.kv([
          ['大圆航线（绿）', core.fmtKm(p.km)],
          ['你的航线（虚线）', `${core.fmtKm(myKm)}（多飞 ${core.fmtKm(Math.max(0, myKm - p.km))}）`],
          ['地图直线（墨卡托）', `${core.fmtKm(straightKm)}（比大圆多 ${core.fmtKm(straightKm - p.km)}）`],
          ['地图上围成的面积', `${core.fmtNum(Math.round(km2 / 10000))} 万 km²（图面）`],
          ['为什么', '墨卡托图上越靠近极地被放得越大，所以最短路线会绕向高纬度，看起来像拱起的弧线；起终点纬度越高、东西跨度越大，弧越明显。'],
        ])),
    };
  },
};
