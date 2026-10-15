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

/** Map window for the guess: track bbox + padding, clamped. Must always contain the landfall (tested over the pool). */
export function viewBounds(t, pad = 12) {
  const la = t.map((p) => p[0]), ln = t.map((p) => p[1]);
  return [[Math.max(-5, Math.min(...la) - pad), Math.min(...ln) - pad], [Math.min(70, Math.max(...la) + pad + 5), Math.max(...ln) + pad]];
}

/** Straight-line extrapolation of the last leg's heading and the recent mean speed for `hours`. */
export function extrapolate(track, hours, hav) {
  const n = track.length, last = track[n - 1];
  const spd = speedKmh(track, 3, hav), brg = bearing(track[Math.max(0, n - 4)], last);
  const R = Math.PI / 180, d = (spd * hours) / 6371, b = brg * R, la = last[0] * R, ln = last[1] * R;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const ln2 = ln + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return [la2 / R, ln2 / R];
}

/** Score: 100 * e^(-km/scale). */
export const SCALE = 400;
export const scoreFor = (km) => Math.round(100 * Math.exp(-km / SCALE));

const DIRS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
export const dirName = (deg) => DIRS[Math.round(deg / 45) % 8];
export const cat = (kt) => (kt >= 137 ? '5 级' : kt >= 113 ? '4 级' : kt >= 96 ? '3 级' : kt >= 83 ? '2 级' : kt >= 64 ? '1 级' : kt >= 34 ? '热带风暴' : '热带低压');

export default {
  meta: {
    num: 39,
    slug: 'landfall',
    title: 'Landfall',
    tagline: '一场历史飓风登陆前一天多的路径。预测它会在哪里登陆，然后在地图上标出来。',
    category: 'science',
    data: 'snapshot',
    howTo: [
      '地图上是一场真实飓风（大西洋或东北太平洋，1950 年后）登陆前至少 24 小时为止的最佳路径，圆点越大风越强。',
      '看它的前进方向、转向趋势和速度：飓风会被副热带高压“推着”走，常在西风带里向东北拐弯。',
      '在地图上点出它首次登陆的位置（包括岛屿）。0 km 得 100 分，每差约 400 km 分数降到约三分之一。',
    ],
    scoring: '100 × e^(−距离/400 km)，距离按大圆计算。',
    sources: [
      { name: 'NOAA NHC HURDAT2 Atlantic (1851–2025)', url: 'https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2025-02272026.txt', note: '最佳路径数据集，记录标记 L 的点即登陆' },
      { name: 'NOAA NHC HURDAT2 NE Pacific (1949–2025)', url: 'https://www.nhc.noaa.gov/data/hurdat/hurdat2-nepac-1949-2025-02272026.txt', note: '东北太平洋同格式数据' },
    ],
    dataNote: '数据为离线快照（NHC 的最佳路径是赛后修订的历史数据，不随日更新，也没有提供带 CORS 的接口）。只选 1950 年以后、有名字、最大风速 ≥ 64 节、登陆前至少有 8 个 6 小时观测点的飓风；展示到首次登陆（被标记为 L 的点，可能是岛屿）前至少 24 小时。西北太平洋、印度洋等其他海域不在 NHC 的这两个数据集里，未收录。',
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

    const hav = (a, b, c, d) => core.haversineKm({ lat: a, lng: b }, { lat: c, lng: d });
    const ext = extrapolate(t, s.hoursToLand, hav);
    const res = await ctx.pin({
      title: '它会在哪里登陆？',
      answer: { lat: s.land.lat, lng: s.land.lng, label: `${s.name} (${s.year}) 首次登陆` },
      view: { bounds: viewBounds(t) },
      basemap: 'gray',
      scale: SCALE,
      setup: async ({ L, map }) => {
        L.polyline(t.map((p) => [p[0], p[1]]), { color: ui.colors().accent, weight: 3 }).addTo(map);
        t.forEach((p) => L.circleMarker([p[0], p[1]], { radius: 2 + p[2] / 18, color: ui.colors().ink, weight: 1, fillColor: ui.colors().accent, fillOpacity: 0.8 }).addTo(map));
      },
      reveal: async ({ L, map }) => {
        L.polyline(s.full.map((p) => [p[0], p[1]]), { color: ui.colors().ink, weight: 2, dashArray: '5 6' }).addTo(map);
        L.polyline([[t[n - 1][0], t[n - 1][1]], ext], { color: ui.colors().muted, weight: 2, dashArray: '2 6' }).addTo(map);
        L.circleMarker(ext, { radius: 5, color: ui.colors().muted, weight: 2, fillOpacity: 0 }).addTo(map);
      },
    });
    const extKm = Math.round(hav(ext[0], ext[1], s.land.lat, s.land.lng));
    res.detail = ui.kv([
      ['飓风', `${s.name}（${s.year}）`],
      ['首次登陆', `${s.land.date}，${s.land.lat.toFixed(1)}°, ${s.land.lng.toFixed(1)}°，${cat(s.land.w)}（${s.land.w} 节）`],
      ['海域', s.basin === 'EP' ? '东北太平洋' : '大西洋'],
      ['生命周期峰值', `${s.maxW} 节 · ${cat(s.maxW)}`],
      ['你的误差', `${Math.round(res.km)} km`],
      ['线索', `最后一个观测点（登陆前 ${s.hoursToLand} 小时）距登陆点 ${s.distKm} km，要的平均速度约 ${Math.round(s.distKm / s.hoursToLand)} km/h；此前一段向${dirName(brg)}推进约 ${Math.round(spd)} km/h，${Math.abs(turn) > 12 ? (turn > 0 ? '路径右拐（北半球典型的转向）' : '路径左拐') : '路径基本笔直'}。地图上的灰色虚线圈是按此航向和速度直线外推的落点，离真实登陆点 ${extKm} km；${extKm < s.distKm * 0.6 ? '外推已经很接近，沿航向找海岸线即可。' : '它偏得更远，说明风暴中途转向或变速，要结合海岸线形状判断。'}`],
    ]);
    return res;
  },
};
