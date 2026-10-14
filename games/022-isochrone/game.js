// #22 Isochrone — the 30-minute subway reach of a hidden station; pin where it starts.
// (Simplified from "bus + OpenTripPlanner": subway GTFS, precomputed offline.)

/** Split reached stations into time bands. */
export function bands(reached) {
  return {
    near: reached.filter((s) => s[2] <= 15),
    far: reached.filter((s) => s[2] > 15),
  };
}

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
      '地图上的圆点是从神秘站出发、30 分钟内（含候车与换乘）能到达的所有地铁站，没有任何标签。',
      '深色点 15 分钟内可达，浅色点 15–30 分钟。快车线会把等时圈沿线拉成长长的“触手”，慢车和换乘多的方向则很短。',
      '起点通常在深色点的中心、触手的根部。在地图上点出你认为的出发站。',
      '按距离计分：0 km 得 100 分，每差约 2 km 分数降到约三分之一。',
    ],
    scoring: '100 × e^(−距离/2 km)。',
    sources: [
      { name: 'MTA NYC Transit subway GTFS (static)', url: 'http://web.mta.info/developers/data/nyct/subway/google_transit.zip' },
      { name: 'MTA developer resources', url: 'https://www.mta.info/developers' },
    ],
    dataNote: '原想用公交 GTFS + OpenTripPlanner；这里简化为地铁 GTFS，在 build/ 中自己做最短路：工作日 10–15 点各区间运行时间中位数，每次上车计 4 分钟候车，换乘用 transfers.txt 的最短换乘时间，不含步行到站。',
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

    const res = await ctx.pin({
      title: '出发站在哪？',
      answer: { lat: p.lat, lng: p.lng, label: p.name },
      view: { bounds },
      scale: 2,
      setup: async ({ map, L }) => {
        const c = ui.colors();
        for (const s of far) L.circleMarker([s[0], s[1]], { radius: 5, color: c.accent, weight: 1, fillColor: c.accent, fillOpacity: 0.25 }).addTo(map);
        for (const s of near) L.circleMarker([s[0], s[1]], { radius: 6, color: c.ink, weight: 1, fillColor: c.accent, fillOpacity: 0.9 }).addTo(map);
      },
    });

    const f = farthest(p, p.reached, core.haversineKm);
    res.detail = ui.panel({ plain: true },
      ui.kv([
        ['出发站', `${p.name}（${p.routes.join(' ')}）`],
        ['最远可达', f ? `${f.s[3]}，直线 ${core.fmtKm(f.d)}，${Math.round(f.s[2])} 分钟` : '—'],
        ['线索', `${near.length} 个站在 15 分钟内，聚在起点周围；越往外越稀疏，沿快车线延伸最远。`],
      ]));
    ctx.log('result', res.score);
    return res;
  },
};
