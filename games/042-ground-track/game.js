// #42 Ground Track — a satellite's sub-satellite track over 12 hours; classify its orbit.
import { latBucket, LAT_BUCKETS, periodBucket, PERIOD_LADDER } from './orbit.mjs';

export const CLASSES = [
  { id: 'leo', label: '近地中倾角轨道', sub: 'ISS / Starlink', why: '倾角 40°–75°、周期约 90 分钟的圆轨道：12 小时绕地 8 圈左右，轨迹像一束斜向波浪，最高纬度等于倾角。' },
  { id: 'sso', label: '太阳同步极轨', sub: '对地观测 / 气象卫星', why: '倾角约 98°（逆行近极地），轨迹几乎擦过两极，波浪最高点接近 ±82°。' },
  { id: 'meo', label: '中轨导航星', sub: 'GPS / GLONASS / Galileo', why: '周期约 12–14 小时：12 小时内只绕约一圈，轨迹是一条大波浪，倾角 55°–65°。' },
  { id: 'mol', label: 'Molniya 大椭圆', sub: '12 小时高偏心率', why: '偏心率约 0.7、倾角 63.4°：在北半球远地点附近走得极慢，轨迹在高纬度“悬停”，南半球则飞掠。' },
  { id: 'geo', label: '地球同步轨道', sub: 'GEO / 倾斜 GSO', why: '周期等于 1 个恒星日，几乎不动；倾角为 0 时是一个点，倾斜时画出“8”字。' },
];

export default {
  meta: {
    num: 42,
    slug: 'ground-track',
    title: 'Ground Track',
    tagline: '一颗卫星 12 小时的星下点轨迹。认出它是 ISS 系、极轨、GPS、Molniya 还是同步卫星。',
    category: 'science',
    data: 'snapshot',
    howTo: [
      '地图上的线是某颗真实卫星今后 12 小时在地面的投影，绿点是起点。',
      '先判断轨道类别，再判断它一圈要多久、最高到达哪个纬度带。共 3 题。',
      '线索：最高纬度 = 轨道倾角；曲线越密 = 周期越短；几乎不动 = 同步轨道；在高纬度停留很久 = Molniya。',
      '每题答对得 1 分，满分 3 分。',
    ],
    scoring: '3 题，每题 1 分。',
    sources: [
      { name: 'CelesTrak GP 轨道要素（JSON）', url: 'https://celestrak.org/NORAD/elements/', note: 'stations / gps-ops / glo-ops / galileo / starlink / geo / weather / resource / science 组及 MOLNIYA 名称查询' },
    ],
    dataNote: '轨迹由 CelesTrak 的真实平均轨道根数用二体开普勒方程加地球自转离线算出（未含 SGP4 摄动），形状与类别判断足够准确，但不宜用于精确定位。',
    wide: true,
  },

  puzzle({ data, pick }) {
    return { sat: pick(data.sats) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const s = p.sat;
    ctx.log('sat', s.name, s.cls);
    const m = await ui.createMap({ center: [10, 0], zoom: 1, height: 340 });
    const { L, map } = m;
    map.options.zoomSnap = 0.25;
    map.fitBounds([[-70, -180], [80, 180]]);
    s.track.forEach((seg) => { if (seg.length > 1) L.polyline(seg.map(([a, b]) => [a / 10, b / 10]), { color: ui.colors().accent, weight: 3, opacity: 0.9 }).addTo(map); });
    const [la, ln] = s.track[0][0];
    L.circleMarker([la / 10, ln / 10], { radius: 6, color: '#fff', weight: 2, fillColor: '#2a9d4b', fillOpacity: 1 }).addTo(map);
    if (s.track.flat().length <= 2) L.circleMarker([la / 10, ln / 10], { radius: 10, color: ui.colors().accent, fillOpacity: 0.2 }).addTo(map);
    ctx.stage.append(ui.panel({ kicker: '未来 12 小时', title: '这颗卫星的星下点轨迹' }, m.el));

    const cls = CLASSES.findIndex((c) => c.id === s.cls);
    const pb = periodBucket(s.periodMin);
    const lb = latBucket(s.maxLat);
    const r = await ctx.rounds({
      rounds: [
        { prompt: '它属于哪一类轨道？', options: CLASSES.map((c) => ({ label: c.label, sub: c.sub })), correct: cls, explain: CLASSES[cls].why },
        { prompt: '它绕地球一圈大约多久？', options: PERIOD_LADDER.map((x) => ({ label: x.label })), correct: pb, explain: `实际周期 ${s.periodMin} 分钟。` },
        { prompt: '轨迹到达的最高纬度（南北均可）是？', options: LAT_BUCKETS.map((x) => ({ label: x })), correct: lb, explain: `轨迹最高 ${s.maxLat}°，倾角 ${s.inc}°。` },
      ],
      minWidth: 150,
    });
    ctx.log('result', r.score);
    r.detail = ui.panel({ plain: true }, ui.kv([
      ['卫星', `${s.name}（NORAD ${s.id}）`],
      ['类别', `${CLASSES[cls].label}（${CLASSES[cls].sub}）`],
      ['轨道', `周期 ${s.periodMin} 分钟 · 倾角 ${s.inc}° · 偏心率 ${s.ecc}`],
      ['高度', `近地点 ${ctx.core.fmtNum(s.perigeeKm)} km · 远地点 ${ctx.core.fmtNum(s.apogeeKm)} km`],
      ['看点', CLASSES[cls].why],
      ['根数历元', s.epoch + ' UTC'],
    ]));
    return r;
  },
};
