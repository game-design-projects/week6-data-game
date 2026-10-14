// #15 Fare — a real NYC yellow-cab trip (pickup zone, dropoff zone, time of day); guess the metered fare and the duration.
import { haversineKm } from '../../engine/core.js';

const BASE = 3.0; // 2023 NYC initial charge (USD)
const PER_MILE = 3.5; // 0.70 per 1/5 mile at speed
const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** Rough rule-of-thumb meter: base + 3.5/mile (ignores slow-traffic time charge). */
export function roughFare(mi) { return BASE + PER_MILE * mi; }
/** Parse "2023-03-04T08:15" (local NYC clock) into parts. */
export function whenParts(t) {
  const d = new Date(`${t}:00Z`);
  const h = d.getUTCHours();
  const slot = h < 5 ? '深夜' : h < 10 ? '早高峰前后' : h < 16 ? '白天' : h < 20 ? '晚高峰' : '夜晚';
  return { wd: WD[d.getUTCDay()], hhmm: t.slice(11, 16), md: t.slice(5, 10), slot, h };
}
export const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} 小时 ${Math.round(m % 60)} 分` : `${Math.round(m)} 分钟`);

export default {
  meta: {
    num: 15,
    slug: 'fare',
    title: 'Fare',
    tagline: '一趟真实的纽约黄色出租车行程：上车区、下车区和时段。猜计价器上的车费和行程时长。',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      '地图上标出了这趟真实行程的上车区（彩色）和下车区（深色），以及出发的星期、时刻。',
      '先估计计价器上的车费（不含小费），再估计从上车到下车用了多久。两题都按对数刻度计分，差一倍约得 37 分。',
      '提示：起步价 $3，之后大约每英里 $3.5；堵车时按分钟计费。机场、过桥、晚高峰都会拉高数字。',
    ],
    scoring: '每题 100 × e^(−|ln(猜/答案)|/0.3)，两题取平均。',
    sources: [
      { name: 'NYC TLC Yellow Taxi Trip Records 2023（NYC Open Data）', url: 'https://data.cityofnewyork.us/Transportation/2023-Yellow-Taxi-Trip-Data/4b4i-vvec' },
      { name: 'NYC Taxi Zones（边界与名称）', url: 'https://data.cityofnewyork.us/Transportation/NYC-Taxi-Zones/d3c5-ddgc' },
    ],
    dataNote: '行程来自 2023 年 TLC 官方记录，随机抽样：只保留标准费率、无过路费、3–90 分钟的行程。TLC 出于隐私只给出上下车“区域”，所以地图中心点只是区域中心，不是确切路线。',
  },

  puzzle({ data, pick }) {
    return { trip: pick(data.trips) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const t = p.trip;
    const Z = ctx.data.zones;
    const pu = Z[t.pu], dz = Z[t.do];
    const w = whenParts(t.t);
    const km = haversineKm({ lat: pu.c[0], lng: pu.c[1] }, { lat: dz.c[0], lng: dz.c[1] });
    ctx.log('trip', t, { crowKm: km.toFixed(1) });

    const m = await ui.createMap({ bounds: L2bounds([pu.c, dz.c]), height: 280 });
    const { L, map } = m;
    L.polygon(pu.ring, { color: '#e4572e', weight: 2, fillOpacity: 0.35 }).addTo(map);
    L.polygon(dz.ring, { color: '#5b9bd5', weight: 2, fillOpacity: 0.35 }).addTo(map);
    L.polyline([pu.c, dz.c], { color: '#888', dashArray: '5 6', weight: 2 }).addTo(map);
    L.circleMarker(pu.c, { radius: 6, color: '#e4572e', fillOpacity: 1 }).addTo(map);
    L.circleMarker(dz.c, { radius: 6, color: '#5b9bd5', fillOpacity: 1 }).addTo(map);

    ctx.stage.append(ui.panel(
      { kicker: '这趟行程', title: `${pu.name} → ${dz.name}` },
      m.el,
      ui.h('div', { class: 'ds-grid', style: { '--min': '110px', marginTop: '12px' } },
        ui.stat({ label: '出发', value: w.hhmm, sub: `${w.md} ${w.wd}` }),
        ui.stat({ label: '时段', value: w.slot, sub: '纽约当地时间' }),
        ui.stat({ label: '直线距离', value: `${(km / 1.609).toFixed(1)} mi`, sub: '区域中心之间' }),
        ui.stat({ label: '乘客', value: `${t.pax} 人` })),
      ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, `上车：${pu.name}（${pu.boro}）· 下车：${dz.name}（${dz.boro}）`),
    ));
    setTimeout(() => map.invalidateSize?.(), 50);

    const r1 = await ctx.estimate({
      title: '计价器车费是多少？', prompt: '不含小费、税费附加之外的纯里程时间费。',
      answer: t.fare, min: 3, max: 150, log: true, step: 0.5, initial: 20, format: (v) => core.fmtMoney(v),
      scoring: 'log', scale: 0.3,
    });
    const r2 = await ctx.estimate({
      title: '这趟开了多久？', answer: t.min, min: 2, max: 120, log: true, step: 1, initial: 20, format: (v) => fmtMin(v),
      scoring: 'log', scale: 0.3,
    });
    const res = ctx.combine([r1, r2]);

    const speed = t.mi / (t.min / 60);
    const rough = roughFare(t.mi);
    res.detail = ui.kv([
      ['车费', `${core.fmtMoney(t.fare)}（你猜 ${r1.guess != null ? core.fmtMoney(r1.guess) : '—'}）`],
      ['时长', `${fmtMin(t.min)}（你猜 ${r2.guess != null ? fmtMin(r2.guess) : '—'}）`],
      ['计价器里程', `${t.mi} mi · 平均 ${speed.toFixed(1)} mph`],
      ['为什么', `起步 $3 + 每英里约 $3.5 ≈ ${core.fmtMoney(rough)}，和实际 ${core.fmtMoney(t.fare)} ${Math.abs(rough - t.fare) < 3 ? '很接近' : t.fare > rough ? '相差较大：时速只有 ' + speed.toFixed(0) + ' mph，堵车时按分钟计费更贵' : '相差较大：路上很顺，实际更便宜'}。${speed < 9 ? '曼哈顿日间车速常低于 10 mph。' : speed > 20 ? '平均 20 mph 以上多半走了快速路或深夜行驶。' : ''}`],
    ]);
    return res;
  },
};

function L2bounds(pts) {
  const la = pts.map((q) => q[0]), ln = pts.map((q) => q[1]);
  const pad = 0.01;
  return [[Math.min(...la) - pad, Math.min(...ln) - pad], [Math.max(...la) + pad, Math.max(...ln) + pad]];
}
