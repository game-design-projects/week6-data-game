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
/** Distance-only and time-only meter estimates (USD). 2023: $3 + $0.70 per 1/5 mile, or $0.70/min when slower than ~12 mph. */
export function meterBounds(mi, min) { return { byDist: BASE + PER_MILE * mi, byTime: BASE + 0.7 * min }; }
/** Crow-fly miles between two zone centres. */
export const crowMiles = (a, b) => haversineKm({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] }) / 1.609344;
/** Teaching text for the result card: which pattern in this trip's data explains the fare. */
export function explain(t, crowMi) {
  const speed = t.mi / (t.min / 60);
  const { byDist, byTime } = meterBounds(t.mi, t.min);
  const wind = crowMi > 0.2 ? t.mi / crowMi : null;
  const parts = [];
  parts.push(`计价器走了 ${t.mi} mi、${fmtMin(t.min)}，平均 ${speed.toFixed(1)} mph。`);
  if (speed < 12) parts.push(`车速低于 12 mph，计价器改按时间计费（$0.70/分钟）：$3 + 0.70 × ${t.min.toFixed(0)} ≈ $${byTime.toFixed(2)}，比单按里程的 $${byDist.toFixed(2)} ${byTime > byDist ? '更贵' : '便宜'}。实际 $${t.fare.toFixed(2)}。`);
  else parts.push(`车速高于 12 mph，主要按里程计费：$3 + 3.5 × ${t.mi} ≈ $${byDist.toFixed(2)}（按时间只有 $${byTime.toFixed(2)}）。实际 $${t.fare.toFixed(2)}。`);
  if (wind) parts.push(`区域中心直线 ${crowMi.toFixed(1)} mi，实际路程是它的 ${wind.toFixed(1)} 倍${wind > 1.5 ? '（街区网格或绕路）' : ''}。`);
  parts.push(speed < 8 ? '时速这么低，说明堵在市区路上，时长比里程更能决定车费。' : speed > 20 ? '时速 20 mph 以上，多半走了快速路或深夜路况，车费几乎只看里程。' : '');
  return parts.filter(Boolean).join('');
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
      '地图上标出了这趟 2023 年真实行程的上车区（橙色）和下车区（蓝色），以及出发的日期、星期和时刻。',
      '先估计计价器上的基本车费（不含小费、附加费和过路费），再估计从上车到下车用了多久。两题都按对数刻度计分，差一倍约得 37 分。',
      '提示：起步价 $3，之后约每英里 $3.5；车速低于 12 mph 时改按每分钟 $0.70 计费。地图只给出区域，实际路线要自己估。',
    ],
    scoring: '车费、时长各 100 分，合计 200 分；每题 100 × e^(−|lg(猜/答案)|/0.3)，差一倍约 37 分，差 5% 以内几乎满分。',
    sources: [
      { name: 'NYC TLC Yellow Taxi Trip Records 2023（NYC Open Data）', url: 'https://data.cityofnewyork.us/Transportation/2023-Yellow-Taxi-Trip-Data/4b4i-vvec' },
      { name: 'NYC Taxi Zones（边界与名称）', url: 'https://data.cityofnewyork.us/Transportation/NYC-Taxi-Zones/d3c5-ddgc' },
    ],
    dataNote: '行程来自 2023 年 TLC 官方记录，随机抽样：只保留标准费率、无过路费、3–90 分钟的行程。TLC 出于隐私只公布上下车“区域”（共 263 个），不公布经纬度，所以地图上的圆点只是区域中心，不是确切路线。数据每月一发布且滞后数月，无法做成当天实时，因此是快照；抽样为每月 3 个随机日期 × 5 个时段，在每个时段内随机取样，不偏向时段开头。',
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
    const crowMi = crowMiles(pu.c, dz.c);
    const km = crowMi * 1.609344;
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
        ui.stat({ label: '出发', value: w.hhmm, sub: `${t.t.slice(0, 10)} ${w.wd}` }),
        ui.stat({ label: '时段', value: w.slot, sub: '纽约当地时间' }),
        ui.stat({ label: '直线距离', value: `${crowMi.toFixed(1)} mi`, sub: '区域中心之间' }),
        ui.stat({ label: '乘客', value: `${t.pax} 人` })),
      ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, `上车：${pu.name}（${pu.boro}）· 下车：${dz.name}（${dz.boro}）`),
    ));
    setTimeout(() => map.invalidateSize?.(), 50);

    const r1 = await ctx.estimate({
      title: '计价器车费是多少？', prompt: '计价器上的基本车费：起步价 + 里程 / 时间费，不含小费、附加费和过路费。',
      answer: t.fare, min: 3, max: 150, log: true, step: 0.5, initial: 20, format: (v) => core.fmtMoney(v),
      scoring: 'log', scale: 0.3,
    });
    const r2 = await ctx.estimate({
      title: '这趟开了多久？', answer: t.min, min: 2, max: 120, log: true, step: 1, initial: 20, format: (v) => fmtMin(v),
      scoring: 'log', scale: 0.3,
    });
    const res = ctx.combine([r1, r2]);

    res.detail = ui.kv([
      ['车费', `${core.fmtMoney(t.fare)}（你猜 ${r1.guess != null ? core.fmtMoney(r1.guess) : '—'}）`],
      ['时长', `${fmtMin(t.min)}（你猜 ${r2.guess != null ? fmtMin(r2.guess) : '—'}）`],
      ['行程', `${pu.name}（${pu.boro}）→ ${dz.name}（${dz.boro}），${t.t.slice(0, 10)} ${w.hhmm}`],
      ['为什么', explain(t, crowMi)],
    ]);
    return res;
  },
};

function L2bounds(pts) {
  const la = pts.map((q) => q[0]), ln = pts.map((q) => q[1]);
  const pad = 0.012;
  return [[Math.min(...la) - pad, Math.min(...ln) - pad], [Math.max(...la) + pad, Math.max(...ln) + pad]];
}
