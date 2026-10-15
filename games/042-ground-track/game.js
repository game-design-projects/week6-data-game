// #42 Ground Track — a satellite's sub-satellite track over 12 hours; classify its orbit.
import { latBucket, LAT_BUCKETS, LAT_EDGES, periodBucket, PERIOD_LADDER, toPuzzle } from './orbit.mjs';

export { toPuzzle };
export const CLASSES = [
  { id: 'leo', label: '近地倾斜圆轨道', sub: 'ISS / 天宫 / Starlink', why: '倾角 40°–75°、周期约 90 分钟的圆轨道：12 小时绕地 8 圈左右，轨迹是一束斜向的波浪，最高纬度等于倾角。' },
  { id: 'sso', label: '太阳同步极轨', sub: '对地观测 / 气象卫星', why: '倾角约 98°（逆行近极地），轨迹几乎擦过两极，波浪最高点接近 ±82°。' },
  { id: 'meo', label: '中轨导航星', sub: 'GPS / GLONASS / 伽利略 / 北斗', why: '周期约 12–14 小时：12 小时内只绕约一圈，轨迹是一条大波浪，倾角 55°–65°。' },
  { id: 'mol', label: 'Molniya 大椭圆', sub: '12 小时周期 · 高偏心率', why: '偏心率约 0.7、倾角 63.4°：在北半球远地点附近走得极慢，轨迹在高纬度“悬停”，南半球则飞掠。' },
  { id: 'geo', label: '地球同步轨道', sub: 'GEO / 倾斜 GSO', why: '周期等于 1 个恒星日，几乎不动；倾角为 0 时是一个点，倾斜时画出“8”字。' },
];

/** Puzzle-specific explanation of which feature of the track gave the class away. */
export function clue(s) {
  const laps = +(720 / s.periodMin).toFixed(1);
  switch (s.cls) {
    case 'leo': return `12 小时绕了约 ${laps} 圈（周期 ${s.periodMin} 分钟），轨迹是密集的斜向波浪；波峰在 ${s.maxLat}° 就是倾角（${s.inc}°）。倾角不到 75° 且圆形，是 ISS / 天宫 / Starlink 一类。`;
    case 'sso': return `波峰几乎碰到极区（${s.maxLat}°），因为倾角 ${s.inc}° 超过 90°，是逆行近极轨道；周期 ${s.periodMin} 分钟，12 小时约 ${laps} 圈。`;
    case 'meo': return `12 小时只绕了约 ${laps} 圈（周期 ${s.periodMin} 分钟），轨道高度约 ${Math.round((s.perigeeKm + s.apogeeKm) / 2 / 1000)} 千 km，倾角 ${s.inc}° 在 55°–65° 之间：典型的导航卫星。`;
    case 'mol': return `偏心率 ${s.ecc}：近地点 ${s.perigeeKm} km、远地点 ${s.apogeeKm} km。远地点在北半球，卫星在那里走得很慢，所以轨迹在高纬度“挤”在一起；倾角 ${s.inc}° 接近 63.4° 临界倾角。`;
    default: return s.inc < 1 ? `周期 ${s.periodMin} 分钟 ≈ 恒星日，倾角仅 ${s.inc}°：星下点几乎不动，12 小时里只是一个点。` : `周期 ${s.periodMin} 分钟 ≈ 恒星日，但倾角 ${s.inc}° 让星下点在南北 ±${s.maxLat}° 之间画出“8”字（倾斜同步轨道）。`;
  }
}

export default {
  meta: {
    num: 42,
    slug: 'ground-track',
    title: 'Ground Track',
    tagline: '一颗卫星 12 小时的星下点轨迹。认出它是 ISS / Starlink、极轨、GPS、Molniya 还是同步卫星。',
    category: 'science',
    data: 'live',
    howTo: [
      '地图上的橙线是某颗真实卫星 12 小时内在地面的投影，绿点是起点，白点标出 +3 / +6 / +9 / +12 小时的位置。',
      '先判断轨道类别，再判断它绕地球一圈要多久、最高到达哪个纬度带。共 3 题。',
      '线索：最高纬度 = 轨道倾角（地图上有每 15° 一条的纬线）；白点间隔越远 = 速度越快 = 周期越短；几乎不动 = 同步轨道；在高纬度挤成一堆 = Molniya。',
      '每题答对得 1 分，满分 3 分。',
    ],
    scoring: '3 题，每题 1 分，满分 3。选项里的纬度档位边界都落在地图的纬线上。',
    sources: [
      { name: 'CelesTrak GP 轨道要素（JSON）', url: 'https://celestrak.org/NORAD/elements/gp.php', note: 'stations / starlink / gps-ops / glo-ops / galileo / beidou / geo / weather / resource / science 组及 MOLNIYA 名称查询；当天卫星由 CATNR 查询最新根数' },
    ],
    dataNote: '每天的卫星是固定的（按日期从 79 颗真实卫星池中抽取）。打开游戏时会向 CelesTrak 取这颗卫星的最新轨道根数，并以当天 UTC 00:00 为起点重算 12 小时轨迹；取不到时退回随游戏打包的快照（2026-10-14 的根数，从根数历元起算）。轨迹用二体开普勒方程加地球自转算出（未含 SGP4 摄动与 J2），形状与类别判断足够准确，但不宜用于精确定位。原想法中的 ISS 与 Starlink 轨迹几乎一样（51.6° vs 53°），无法单凭星下点区分，所以合并为一类，另加极轨与同步轨道。',
    wide: false,
  },

  puzzle({ data, pick }) {
    const base = pick(data.sats);
    return { sat: data.live && data.live.id === base.id ? data.live : base };
  },

  async load(ctx) {
    if (ctx.date !== ctx.today) return null; // current elements only describe today's sky; other days use the snapshot
    const base = ctx.pick(ctx.data.sats);
    // elements keep updating through the day, so the window is anchored to 00:00 UTC of the puzzle date
    const raw = await ctx.fetchJSON(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${base.id}&FORMAT=json`, { timeout: 8000 });
    const live = toPuzzle(raw, ctx.date, base);
    if (!live) { ctx.log('live elements unusable, using snapshot for', base.name); return null; }
    ctx.log('live elements', live.name, live.epoch);
    return { ...ctx.data, live };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const s = p.sat;
    ctx.log('sat', s.name, s.cls);
    const c = ui.colors();
    const m = await ui.createMap({ center: [0, 0], zoom: 0, minZoom: 0, maxZoom: 6, height: 'clamp(240px, 70vw, 440px)' });
    const { L, map } = m;
    map.options.zoomSnap = 0.1;
    const fit = () => { map.invalidateSize(); map.setMaxBounds(null); map.fitBounds([[-82, -180], [82, 180]], { animate: false }); map.setMaxBounds([[-86, -180], [86, 180]]); map.options.maxBoundsViscosity = 1; };
    // graticule at the bucket edges (15/45/60/75) so the maximum latitude can be read off the map
    const lats = [0, ...LAT_EDGES.flatMap((e) => [e, -e]), 30, -30];
    lats.forEach((la) => {
      L.polyline([[la, -180], [la, 180]], { color: c.ink2, weight: la === 0 ? 1.2 : 0.8, opacity: la === 0 ? 0.55 : 0.3, dashArray: la === 0 ? null : '2 5', interactive: false }).addTo(map);
      L.marker([la, 180], { interactive: false, icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<span style="position:relative;top:-7px;left:-3px;transform:translateX(-100%);display:inline-block;font:600 10px var(--font-mono);color:var(--ink-2,#ccc);text-shadow:0 0 3px var(--paper,#000),0 0 3px var(--paper,#000)">${la === 0 ? '0°' : Math.abs(la) + '°' + (la > 0 ? 'N' : 'S')}</span>` }) }).addTo(map);
    });
    const line = '#ff9f1c';
    s.track.forEach((seg) => {
      if (seg.length < 2) return;
      const pts = seg.map(([a, b]) => [a / 10, b / 10]);
      L.polyline(pts, { color: c.paper, weight: 6, opacity: 0.7, interactive: false }).addTo(map);
      L.polyline(pts, { color: line, weight: 3, opacity: 1, interactive: false }).addTo(map);
    });
    (s.marks ?? []).forEach(([h, a, b]) => {
      L.circleMarker([a / 10, b / 10], { radius: 4, color: '#222', weight: 1, fillColor: '#fff', fillOpacity: 1 })
        .bindTooltip(`+${h} h`, { permanent: true, direction: 'top', offset: [0, -4], opacity: 0.9 }).addTo(map);
    });
    const [la, ln] = s.track[0][0];
    const startDot = L.circleMarker([la / 10, ln / 10], { radius: 7, color: '#fff', weight: 2, fillColor: '#2a9d4b', fillOpacity: 1 }).bindTooltip('起点', { direction: 'bottom', offset: [0, 6] }).addTo(map);
    ctx.stage.append(ui.panel({ kicker: `12 小时${s.from ? ` · UTC ${s.from.replace('T', ' ')} 起` : ''}`, title: '这颗卫星的星下点轨迹' }, m.el));
    fit(); requestAnimationFrame(fit); setTimeout(fit, 300);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => fit()).observe(m.el);

    const cls = CLASSES.findIndex((x) => x.id === s.cls);
    const pb = periodBucket(s.periodMin);
    const lb = latBucket(s.maxLat);
    const r = await ctx.rounds({
      rounds: [
        { prompt: '它属于哪一类轨道？', options: CLASSES.map((x) => ({ label: x.label, sub: x.sub })), correct: cls, explain: clue(s) },
        { prompt: '它绕地球一圈大约多久？（白点之间的间隔是 3 小时）', options: PERIOD_LADDER.map((x) => ({ label: x.label })), correct: pb, explain: `实际周期 ${s.periodMin} 分钟（${(s.periodMin / 60).toFixed(1)} 小时），12 小时约 ${(720 / s.periodMin).toFixed(1)} 圈。` },
        { prompt: '轨迹到达的最高纬度（南北均可）是？', options: LAT_BUCKETS.map((x) => ({ label: x })), correct: lb, explain: `轨迹最高 ${s.maxLat}°，等于轨道倾角 ${s.inc}°（倾角超过 90° 的逆行轨道取 180° 减去它）。` },
      ],
      minWidth: 150,
    });
    ctx.log('result', r.score);
    m.setLabels(true);
    startDot.unbindTooltip().bindTooltip(s.name, { permanent: true, direction: 'bottom', offset: [0, 6] }).openTooltip();
    r.detail = ui.panel({ plain: true }, ui.kv([
      ['卫星', `${s.name}（NORAD ${s.id}）`],
      ['类别', `${CLASSES[cls].label}（${CLASSES[cls].sub}）`],
      ['看点', clue(s)],
      ['轨道', `周期 ${s.periodMin} 分钟 · 倾角 ${s.inc}° · 偏心率 ${s.ecc}`],
      ['高度', `近地点 ${ctx.core.fmtNum(s.perigeeKm)} km · 远地点 ${ctx.core.fmtNum(s.apogeeKm)} km`],
      ['根数历元', s.epoch + ' UTC' + (s.from ? ` · 轨迹起点 ${s.from.replace('T', ' ')} UTC` : '')],
    ]));
    return r;
  },
};
