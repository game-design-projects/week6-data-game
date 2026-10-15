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
/** Tolerance scale (km) for scoring: 0 km -> 100, `scale` km -> ~37. Faster drifters wander further, so they are forgiven more. */
export function scaleFor(d10) { return Math.round(Math.max(300, Math.min(1000, 250 + 3 * d10))); }
/** Map bounds centred on day 10, wide enough to contain the day-90 spot without panning. */
export function viewFor(track) {
  const d10 = km(track[0], track[10]), c = track[10];
  const half = Math.max(12, Math.min(35, (d10 * 16) / 111));
  return [[Math.max(-85, c[0] - half), c[1] - half * 1.5], [Math.min(85, c[0] + half), c[1] + half * 1.5]];
}
export const inBounds = (b, p) => p[0] >= b[0][0] && p[0] <= b[1][0] && p[1] >= b[0][1] && p[1] <= b[1][1];
const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const latBand = (lat) => {
  const a = Math.abs(lat), hemi = lat >= 0 ? '北' : '南';
  if (a < 12) return '赤道附近：信风驱动的赤道流，整体偏向西，而赤道逆流会把浮标往东送。';
  if (a < 40) return `${hemi}半球副热带：浮标被${lat >= 0 ? '顺时针' : '逆时针'}的大环流裹着转，大洋西侧有湾流、黑潮这类强劲的西边界流，东侧慢而散。`;
  if (lat < 0) return '南纬 40° 以南：西风带与南极绕极流，浮标总体向东漂，速度快。';
  return '北纬 40° 以北：西风与亚极地环流，漂移方向容易随涡旋变化。';
};
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
      '按距离计分：0 km 得 100 分，每差一个“尺度”（300–1000 km，快的浮标更宽松）分数降到约三分之一。揭晓后会画出真实轨迹，并和“直线外推”对比。',
    ],
    scoring: '100 × e^(−距离/尺度)，尺度 300–1000 km，随前 10 天的速度而定（越快越宽容），题目里会写明。',
    sources: [
      { name: 'NOAA Global Drifter Program (AOML) — 6 小时质控轨迹', url: 'https://erddap.aoml.noaa.gov/gdp/erddap/tabledap/drifter_6hour_qc.html', note: '取每日 00:00 UTC 的位置' },
      { name: 'Global Drifter Program', url: 'https://www.aoml.noaa.gov/phod/gdp/' },
    ],
    dataNote: '题库是预先下载的真实浮标轨迹快照（2019–2024 年间 91 天窗口，每枚浮标只出现一次）。GDP 的 ERDDAP 接口没有 CORS 头，浏览器无法实时读取，且质控轨迹有数月延迟；已排除跨越日界线以及 90 天内漂移不足 150 km 的浮标。',
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

    const b = viewFor(t), scale = scaleFor(d10);
    const res = await ctx.pin({
      title: '第 90 天，它在哪里？',
      answer: { lat: end[0], lng: end[1], label: '第 90 天' },
      view: { bounds: b },
      scale,
      prompt: `把图钉放在你认为它第 90 天所在的位置。离真实位置 ${scale} km 约得 37 分。`,
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
    const net = km(t[0], end), rest = km(t[10], end), path10 = t.slice(1, 11).reduce((a, q, k) => a + km(t[k], q), 0), restPath = total - path10;
    const b1 = bearing(t[0], t[10]), b2 = bearing(t[10], end), turn = angDiff(b1, b2);
    const early = path10 / 10, late = restPath / 80, straight = net / total;
    const shape = straight < 0.35 ? `路程 ${core.fmtKm(total)} 但净位移只有 ${core.fmtKm(net)}（${Math.round(straight * 100)}%），典型的涡旋式打转。`
      : straight > 0.75 ? `路程 ${core.fmtKm(total)}，净位移 ${core.fmtKm(net)}（${Math.round(straight * 100)}%），几乎一路直行。`
      : `路程 ${core.fmtKm(total)}，净位移 ${core.fmtKm(net)}（${Math.round(straight * 100)}%），走了一条弯弯的路。`;
    const dir = turn > 90 ? `前 10 天朝${compass(b1)}，之后整体朝${compass(b2)}：方向几乎掉头，直线外推会错得很远。`
      : turn > 45 ? `前 10 天朝${compass(b1)}，之后整体转向${compass(b2)}。`
      : `前 10 天朝${compass(b1)}，之后整体仍朝${compass(b2)}，方向基本延续。`;
    const spd = late > early * 1.3 ? `后 80 天均速 ${late.toFixed(0)} km/天，比前 10 天的 ${early.toFixed(0)} 快。` : late < early * 0.7 ? `后 80 天均速 ${late.toFixed(0)} km/天，比前 10 天的 ${early.toFixed(0)} 慢。` : `后 80 天均速 ${late.toFixed(0)} km/天，与前 10 天（${early.toFixed(0)}）相近。`;
    res.detail = ui.kv([
      ['真实位置', `${end[0].toFixed(1)}°, ${end[1].toFixed(1)}°（离第 10 天位置 ${core.fmtKm(rest)}）`],
      ['你的成绩', `${core.fmtKm(res.km)}；直线外推 ${core.fmtKm(exErr)}${exErr > res.km ? '，你比它准' : '，它比你准'}`],
      ['路径形状', shape],
      ['方向与速度', `${dir}${spd}`],
      ['这片海域', latBand(t[0][0])],
      ['水帆', p.drogued ? '这枚浮标 15 m 深的水帆还在，跟着上层洋流走。' : '这枚浮标的水帆已脱落，更容易被风吹着走。'],
    ]);
    return res;
  },
};
