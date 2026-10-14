// #10 Drift — 看一枚真实漂流浮标前 10 天的轨迹，推断它第 90 天漂到了哪里。
const R = 6371, RAD = Math.PI / 180;

/** Great-circle km between [lat,lng] points. */
export function km(a, b) {
  const dLa = (b[0] - a[0]) * RAD, dLo = (b[1] - a[1]) * RAD;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
/** Compass bearing (deg, 0=N) from a to b. */
export function bearing(a, b) {
  const dLo = (b[1] - a[1]) * RAD, y = Math.sin(dLo) * Math.cos(b[0] * RAD);
  const x = Math.cos(a[0] * RAD) * Math.sin(b[0] * RAD) - Math.sin(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.cos(dLo);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}
/** Straight-line extrapolation of the day0->day10 velocity to day 90 (flat-earth, cos-lat corrected). */
export function extrapolate(track) {
  const a = track[0], b = track[10], k = 80 / 10;
  const lat = Math.max(-85, Math.min(85, b[0] + (b[0] - a[0]) * k));
  return [lat, b[1] + (b[1] - a[1]) * k];
}
const DIRS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
export const compass = (deg) => DIRS[Math.round(deg / 45) % 8];

export default {
  meta: {
    num: 10,
    slug: 'drift',
    title: 'Drift',
    tagline: '一枚真实海洋漂流浮标前 10 天的轨迹已经画好。顺着洋流往下推，标出它第 90 天的位置。',
    category: 'geo',
    data: 'snapshot',
    howTo: [
      '地图上是一枚 NOAA 全球漂流浮标（GDP）最初 10 天的轨迹，每个小圆点间隔 1 天，空心圆是起点，旁边标“第 10 天”的是线索终点。',
      '浮标没有动力，完全随洋流走。看轨迹的方向、弯曲和速度，想想它在哪个大洋、哪个纬度带，是否会被环流带着拐弯。',
      '在地图上点出你认为它第 90 天所在的位置，可以拖动调整。',
      '按距离计分：0 km 得 100 分，每差约 600 km 分数降到约三分之一。揭晓后会画出真实轨迹，并和“直线外推”对比。',
    ],
    scoring: '100 × e^(−距离/600 km)。',
    sources: [
      { name: 'NOAA Global Drifter Program (AOML) — 6 小时质控轨迹', url: 'https://erddap.aoml.noaa.gov/gdp/erddap/tabledap/drifter_6hour_qc.html', note: '取每日 00:00 UTC 的位置' },
      { name: 'Global Drifter Program', url: 'https://www.aoml.noaa.gov/phod/gdp/' },
    ],
    dataNote: '题库是预先下载的真实浮标轨迹快照（2019–2025 年间 91 天窗口）；已排除跨越日界线以及 90 天内漂移不足 150 km 的浮标。',
  },

  puzzle({ data, pick }) {
    const d = pick(data.drifters);
    return { id: d.id, start: d.start, drogued: d.drogued, track: d.track };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const t = p.track, hint = t.slice(0, 11), end = t[90];
    const d10 = km(t[0], t[10]);
    const brg = bearing(t[0], t[10]);
    ctx.log('puzzle', { id: p.id, start: p.start, d10: Math.round(d10) });

    ctx.stage.append(ui.panel({ kicker: `浮标 #${p.id} · ${p.start} 起`, title: '线索：前 10 天' },
      ui.h('div', { class: 'ds-grid', style: { '--min': '150px' } },
        ui.stat({ label: '10 天位移', value: core.fmtKm(d10) }),
        ui.stat({ label: '平均速度', value: `${(d10 / 10).toFixed(0)} km/天` }),
        ui.stat({ label: '大致朝向', value: compass(brg) }),
        ui.stat({ label: '起点纬度', value: `${t[0][0].toFixed(1)}°` }))));

    const half = Math.max(7, Math.min(30, (d10 * 9) / 111)); // 90-day reach is typically several x the 10-day displacement
    const b = [[Math.max(-85, t[10][0] - half), t[10][1] - half * 1.2], [Math.min(85, t[10][0] + half), t[10][1] + half * 1.2]];
    const res = await ctx.pin({
      title: '第 90 天，它在哪里？',
      answer: { lat: end[0], lng: end[1], label: '第 90 天' },
      view: { bounds: b },
      scale: 600,
      setup: ({ map, L }) => {
        const c = ui.colors();
        L.polyline(hint, { color: c.accent, weight: 3 }).addTo(map);
        hint.forEach((q, i) => L.circleMarker(q, { radius: i === 0 || i === 10 ? 6 : 3, color: c.accent, weight: 2, fillColor: i === 0 ? c.paper : c.accent, fillOpacity: 1 }).addTo(map));
        L.marker(hint[10], { icon: L.divIcon({ className: '', html: '<b style="color:var(--ink);font-size:12px;white-space:nowrap;text-shadow:0 0 3px var(--paper)">第 10 天</b>', iconAnchor: [-8, 8] }) }).addTo(map);
      },
      reveal: ({ map, L }) => {
        const c = ui.colors();
        L.polyline(t.slice(10), { color: c.ink, weight: 2, dashArray: '2 5' }).addTo(map);
        const ex = extrapolate(t);
        L.circleMarker(ex, { radius: 5, color: c.muted, weight: 2, fillOpacity: 0.4 }).addTo(map).bindTooltip('直线外推');
        map.fitBounds(L.latLngBounds([...t, ex]).pad(0.15));
      },
    });

    const ex = extrapolate(t), total = t.slice(1).reduce((s, q, i) => s + km(t[i], q), 0);
    const exErr = km(ex, end);
    res.detail = ui.kv([
      ['真实位置', `${end[0].toFixed(1)}°, ${end[1].toFixed(1)}°`],
      ['90 天路程', `${core.fmtKm(total)}（直线位移 ${core.fmtKm(km(t[0], end))}）`],
      ['直线外推', `预测位置离真实 ${core.fmtKm(exErr)}${exErr > res.km ? '，你比它准' : '，它比你准'}`],
      ['规律', total / 90 > d10 / 10 ? '后 80 天比前 10 天走得更快，洋流在加速。' : '后 80 天比前 10 天走得更慢或在打转，洋流方向发生了变化。'],
      ['提示', p.drogued ? '这枚浮标带着 15 m 深的水帆，随上层洋流而不是风漂。' : '这枚浮标的水帆已脱落，更容易被风吹着走。'],
    ]);
    return res;
  },
};
