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
    tagline: '从某个地铁站出发 30 分钟能到的站点连成一片“等时圈”。看形状，猜出发站在哪。',
    category: 'nyc',
    data: 'computed',
    howTo: [
      '地图上的圆点是从一个神秘地铁站出发、30 分钟内（含候车、换乘和最多一段步行）能到达的所有地铁站，没有任何标签；起点本身和紧挨着它的同名站不画。',
      '深色点 15 分钟内可达，浅色点 15–30 分钟，实线/虚线圈是两个时间段的外轮廓。快车线会把等时圈沿线拉成长长的“触手”，慢车和换乘多的方向则很短。',
      '起点在深色点的中央或某条线的端头、触手的根部——那里会留下一个空位。在地图上点出你认为的出发站。',
      '按距离计分：0 km 得 100 分，每差约 2 km 分数降到约三分之一。',
    ],
    scoring: '100 × e^(−距离/2 km)。',
    sources: [
      { name: 'MTA NYC Transit subway GTFS (static)', url: 'http://web.mta.info/developers/data/nyct/subway/google_transit.zip' },
      { name: 'MTA developer resources', url: 'https://www.mta.info/developers' },
    ],
    dataNote: '想法里的“公交 + GTFS + OpenTripPlanner”在浏览器里无法运行（OTP 需要服务器，纽约公交 GTFS 又是数百 MB 级别）。这里改用 MTA 地铁静态 GTFS，在 build/ 里自己做最短路并预先算好：工作日 10–15 点各区间运行时间中位数，每次上车计 4 分钟平均候车，换乘用 transfers.txt 的最短换乘时间，另允许步行（直线距离×1.3，每分钟 80 米，≤600 米）去另一个站，且最多走一段。没有逐班时刻表，也没有实时数据，因此标为“计算”。',
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

    ctx.stage.append(ui.panel({ kicker: '等时圈', title: '30 分钟能到哪儿' },
      ui.h('div', { class: 'ds-grid', style: { '--min': '120px' } },
        ui.stat({ label: '可达站点', value: p.reached.length }),
        ui.stat({ label: '15 分钟内', value: near.length }),
        ui.stat({ label: '15–30 分钟', value: far.length }))));

    const markers = [];
    const res = await ctx.pin({
      title: '出发站在哪？',
      prompt: '深色 = 15 分钟内，浅色 = 15–30 分钟。起点在圈中央的空位，或在线路端头。',
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
        for (const [s, m] of markers) m.bindTooltip(`${s[3]} · ${Math.round(s[2])} 分钟`);
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
        ['出发站', `${p.name}（${p.routes.join(' ')} 线）`],
        ['最远可达', f ? `${f.s[3]}，直线 ${core.fmtKm(f.d)}，${Math.round(f.s[2])} 分钟` : '—'],
        ['线索', (off != null && off < 0.8
          ? `15 分钟圈（${near.length} 个站）的中心离起点只有 ${core.fmtKm(off)}：起点处在圈的中央，圈里的那个空位就是它。`
          : `15 分钟圈（${near.length} 个站）的中心离起点 ${core.fmtKm(off ?? 0)}：起点在圈的一端（多半是线路的终点或支线端头），所以圈只朝一个方向展开。`) +
          ` 离起点最近的点也有 ${core.fmtKm(nearest)}，因为同一站的换乘站不画出来。` +
          `最远的点 ${f ? f.s[3] : '—'} 在 ${f ? core.fmtKm(f.d) : '—'} 外，圈越细长，说明沿线有快车；圈越圆，说明靠换乘和步行。`],
      ]));
    ctx.log('result', res.score);
    return res;
  },
};
