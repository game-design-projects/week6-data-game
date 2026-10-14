// #39 Landfall — a hurricane's track up to ~24 h before its first landfall; pin where it comes ashore.
// Real HURDAT2 best tracks. Clue: track curvature, forward speed, intensity, nearby coastline.

/** Mean forward speed (km/h) over the last k legs of a [lat,lng,w] track, 6 h per leg. */
export function speedKmh(track, k = 3, hav) {
  const n = track.length;
  const a = track[Math.max(0, n - 1 - k)], b = track[n - 1];
  return hav(a[0], a[1], b[0], b[1]) / (Math.min(k, n - 1) * 6);
}

/** Compass bearing (deg, 0 = N) from a to b. */
export function bearing(a, b) {
  const R = Math.PI / 180;
  const y = Math.sin((b[1] - a[1]) * R) * Math.cos(b[0] * R);
  const x = Math.cos(a[0] * R) * Math.sin(b[0] * R) - Math.sin(a[0] * R) * Math.cos(b[0] * R) * Math.cos((b[1] - a[1]) * R);
  return (Math.atan2(y, x) / R + 360) % 360;
}

const DIRS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
export const dirName = (deg) => DIRS[Math.round(deg / 45) % 8];
export const cat = (kt) => (kt >= 137 ? '5 级' : kt >= 113 ? '4 级' : kt >= 96 ? '3 级' : kt >= 83 ? '2 级' : kt >= 64 ? '1 级' : kt >= 34 ? '热带风暴' : '热带低压');

export default {
  meta: {
    num: 39,
    slug: 'landfall',
    title: 'Landfall',
    tagline: '一场历史飓风的前半段路径。预测它会在哪里登陆，然后在地图上标出来。',
    category: 'science',
    data: 'snapshot',
    howTo: [
      '地图上是一场真实飓风（1950 年后）登陆前约 24 小时为止的最佳路径，圆点越大风越强。',
      '看它的前进方向、转向趋势和速度：飓风会被副热带高压“推着”走，常在西风带里向东北拐弯。',
      '在地图上点出它首次登陆的位置（包括岛屿）。0 km 得 100 分，每差约 300 km 分数降到约三分之一。',
    ],
    scoring: '100 × e^(−距离/300 km)。',
    sources: [
      { name: 'NOAA NHC HURDAT2 (Atlantic, 1851–2025)', url: 'https://www.nhc.noaa.gov/data/hurdat/', note: '最佳路径数据集，记录标记 L 的点即登陆' },
    ],
    dataNote: '只选 1950 年以后、有名字、最大风速 ≥ 64 节、登陆前至少有 8 个 6 小时观测点的大西洋飓风；展示到首次登陆前至少 24 小时。',
  },

  puzzle({ data, pick }) {
    return { s: pick(data.storms) };
  },

  async play(ctx, { s }) {
    const { ui, core } = ctx;
    const t = s.track;
    const n = t.length;
    const spd = speedKmh(t, 3, (a, b, c, d) => core.haversineKm({ lat: a, lng: b }, { lat: c, lng: d }));
    const brg = bearing(t[Math.max(0, n - 4)], t[n - 1]);
    const turn = ((bearing(t[n - 2], t[n - 1]) - bearing(t[Math.max(0, n - 5)], t[Math.max(0, n - 3)]) + 540) % 360) - 180;
    ctx.log('storm', s.id, s.name, s.year);

    ctx.stage.append(ui.panel({ kicker: '线索', title: '这场飓风还没有名字' },
      ui.h('div', { class: 'ds-grid', style: { '--min': '110px' } },
        ui.stat({ label: '当前强度', value: cat(t[n - 1][2]), sub: `${t[n - 1][2]} 节` }),
        ui.stat({ label: '前进方向', value: `向${dirName(brg)}`, sub: `${Math.round(brg)}°` }),
        ui.stat({ label: '前进速度', value: `${Math.round(spd)} km/h`, sub: Math.abs(turn) > 12 ? (turn > 0 ? '正在右拐' : '正在左拐') : '路径较直' }),
        ui.stat({ label: '距登陆', value: `≥ ${s.hoursToLand} 小时` }))));

    const [la0, ln0] = [Math.min(...t.map((p) => p[0])), Math.min(...t.map((p) => p[1]))];
    const [la1, ln1] = [Math.max(...t.map((p) => p[0])), Math.max(...t.map((p) => p[1]))];
    const pad = 9;
    const res = await ctx.pin({
      title: '它会在哪里登陆？',
      answer: { lat: s.land.lat, lng: s.land.lng, label: `${s.name} (${s.year}) 首次登陆` },
      view: { bounds: [[Math.max(-5, la0 - pad), ln0 - pad], [Math.min(60, la1 + pad), ln1 + pad]] },
      basemap: 'topo',
      scale: 300,
      setup: async ({ L, map }) => {
        L.polyline(t.map((p) => [p[0], p[1]]), { color: ui.colors().accent, weight: 3 }).addTo(map);
        t.forEach((p) => L.circleMarker([p[0], p[1]], { radius: 2 + p[2] / 18, color: ui.colors().ink, weight: 1, fillColor: ui.colors().accent, fillOpacity: 0.8 }).addTo(map));
      },
      reveal: async ({ L, map }) => {
        L.polyline(s.full.map((p) => [p[0], p[1]]), { color: ui.colors().ink, weight: 2, dashArray: '5 6' }).addTo(map);
      },
    });
    res.detail = ui.kv([
      ['飓风', `${s.name}（${s.year}）`],
      ['首次登陆', `${s.land.date}，${s.land.lat.toFixed(1)}°, ${s.land.lng.toFixed(1)}°，${cat(s.land.w)}（${s.land.w} 节）`],
      ['生命周期峰值', `${s.maxW} 节 · ${cat(s.maxW)}`],
      ['线索', `最后一段向${dirName(brg)}推进，约 ${Math.round(spd)} km/h，${Math.abs(turn) > 12 ? (turn > 0 ? '路径右拐（北半球典型的转向）' : '路径左拐') : '路径基本笔直'}；沿这个方向延伸到最近的海岸线即可。`],
    ]);
    return res;
  },
};
