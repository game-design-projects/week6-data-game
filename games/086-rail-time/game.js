// #86 Rail Time — two stations, how long does the fastest scheduled train take?
export const hm = (min) => (min >= 60 ? `${Math.floor(min / 60)} 小时 ${String(Math.round(min % 60)).padStart(2, '0')} 分` : `${Math.round(min)} 分`);
export const speed = (km, min) => Math.round((km / min) * 60);
// slider start: the middle of the log scale, identical for every puzzle (so it leaks nothing)
export const initialGuess = () => 245;
export const tier = (kmh) => (kmh >= 150 ? 3 : kmh >= 100 ? 2 : kmh >= 60 ? 1 : 0);

export function explain(p) {
  const v = speed(p.km, p.min);
  const stops = p.st === 0 ? '中途一站不停' : `中途停 ${p.st} 站`;
  const spread = p.slow > p.min * 1.15 ? `最慢的一班要 ${hm(p.slow)}，比最快的多 ${Math.round((p.slow / p.min - 1) * 100)}%——有的班次停站更多或绕行。` : `所有班次时间相近（最慢 ${hm(p.slow)}）。`;
  const why = [
    `平均时速只有 ${v} km/h（按直线距离算）：慢线或客货混跑，加上 ${stops}、线路弯曲，所以比想象的久。`,
    `平均时速 ${v} km/h：常规客运线路，${stops}，速度被停站和弯道拖住。`,
    `平均时速 ${v} km/h：快车或快线，${stops}，基本能跑满线路速度。`,
    `平均时速 ${v} km/h：高速线路，${stops}，直线距离几乎就是实际里程。`,
  ][tier(v)];
  return `${why}${spread}`;
}

export default {
  meta: {
    num: 86,
    slug: 'rail-time',
    title: 'Rail Time',
    tagline: '给你两个车站和直线距离，猜美、加、德、法的列车时刻表上最快一班要开多久。',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      '地图上标出了今天的出发站 A 和到达站 B，并给出直线距离和运营商。',
      '估计时刻表上最快的一班直达列车，从 A 开出到 B 到站要多少分钟。拖滑块（对数刻度）或直接输入分钟数。',
      '最多猜 2 次；第一次不准会提示偏高还是偏低。',
      '想想看：是高速线（ICE、TGV、Acela），还是客货混跑的慢线？沿途停站多不多？',
    ],
    scoring: '按倍数误差计分：差 1.35 倍约 63 分，差 2 倍约 37 分；第二次猜扣 10%。',
    sources: [
      { name: 'Amtrak GTFS 时刻表', url: 'https://content.amtrak.com/content/gtfs/GTFS.zip', note: '2026-10-14 版' },
      { name: 'VIA Rail GTFS 时刻表', url: 'https://www.viarail.ca/sites/all/files/gtfs/viarail.zip', note: '2026-10-13 版' },
      { name: 'gtfs.de 德国长途列车 GTFS（DELFI）', url: 'https://gtfs.de/', note: '下载 https://download.gtfs.de/germany/fv_free/latest.zip' },
      { name: 'SNCF TGV 时刻表 GTFS', url: 'https://eu.ftp.opendatasoft.com/sncf/plandata/export_gtfs_voyages.zip', note: '法国国铁发布的最新一版，为 2025–26 冬季时刻表' },
      { name: 'GTFS 规范', url: 'https://gtfs.org/' },
    ],
    dataNote: '只统计同一趟车上两站都允许上/下车的直达区间；时间是时刻表计划值，不含晚点，站点时间换算成 UTC 后相减。每个区间取所有班次中最快的一趟。题库来自 4 个运营商的时刻表快照（Amtrak 40 题、德国 40 题、TGV 22 题、VIA 12 题），每条线路限题以免都是同一条线。法国数据是 SNCF 最新公开的版本（2025–26 冬季）。这些 GTFS 文件都没有开放 CORS，浏览器无法直接取最新数据，所以是快照。',
  },

  puzzle({ data, pick }) {
    return { p: pick(data.pairs) };
  },

  async play(ctx, { p }) {
    const { ui } = ctx;
    const { a, b } = p;
    ctx.log('puzzle', a.id, b.id, p.km, p.min, p.op);
    // headroom north of the stations so the permanent tooltips are not clipped; keep the whole route in view
    const dLat = Math.max(Math.abs(a.lat - b.lat), 0.5), dLng = Math.max(Math.abs(a.lng - b.lng), 0.5);
    const box = [[Math.min(a.lat, b.lat) - dLat * 0.15, Math.min(a.lng, b.lng) - dLng * 0.12], [Math.max(a.lat, b.lat) + dLat * 0.3, Math.max(a.lng, b.lng) + dLng * 0.12]];
    const m = await ui.createMap({ bounds: box, height: 280 });
    ctx.stage.append(ui.panel({ kicker: '今天的区间', title: `${a.name} → ${b.name}` },
      m.el,
      ui.grid(140,
        ui.stat({ label: '直线距离', value: `${p.km} km` }),
        ui.stat({ label: '运营商', value: p.op }),
      )));
    try {
      const { L, map } = m;
      const tip = () => ({ permanent: true, direction: 'top', offset: [-14, -8], opacity: 0.95 });
      L.marker([a.lat, a.lng]).addTo(map).bindTooltip('A 出发', tip());
      L.marker([b.lat, b.lng]).addTo(map).bindTooltip('B 到达', tip());
      L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { dashArray: '6 6', weight: 2 }).addTo(map);
      await ctx.sleep(60);
      map.invalidateSize();
      map.fitBounds(box, { maxZoom: 9 });
    } catch (e) { ctx.log.warn('map overlay failed', String(e)); }

    const res = await ctx.estimate({
      title: '最快一班要开多久？',
      prompt: `${a.name} → ${b.name}，单位：分钟（60 分 = 1 小时）`,
      answer: p.min, min: 20, max: 3000, log: true, step: 1, initial: initialGuess(p.km),
      format: (v) => hm(v),
      attempts: 2, scoring: 'log', scale: 0.3, tolerance: 0.03,
    });
    res.detail = ui.kv([
      ['答案', `${hm(p.min)}（${p.min} 分钟）`],
      ['最快的一班', `${p.op} · ${p.train}${p.no ? ` ${p.no} 次` : ''}`],
      ['平均时速', `${speed(p.km, p.min)} km/h（按直线距离，实际线路更长）`],
      ['班次', `${p.n} 班可选 · ${p.st === 0 ? '最快这班中途不停' : `最快这班中途停 ${p.st} 站`}`],
      ['规律', explain(p)],
    ]);
    return res;
  },
};
