// #86 Rail Time — two stations, how long does the fastest scheduled train take?
export const hm = (min) => (min >= 60 ? `${Math.floor(min / 60)} 小时 ${String(Math.round(min % 60)).padStart(2, '0')} 分` : `${Math.round(min)} 分`);
export const speed = (km, min) => Math.round((km / min) * 60);

export default {
  meta: {
    num: 86,
    slug: 'rail-time',
    title: 'Rail Time',
    tagline: '给你两个车站和它们的直线距离，猜 Amtrak 时刻表上最快一班车要开多久。',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      '地图上标出了今天的出发站和到达站，并给出直线距离。',
      '估计时刻表上最快的一班直达列车，从出发站开出到到站要多少分钟。',
      '最多猜 2 次；第一次不准会提示偏高还是偏低。拖滑块或直接输入分钟数。',
      '想想看：走的是高速的东北走廊，还是慢吞吞的长途线？沿途停站多不多？客货混跑的线路常常只有 40–50 km/h。',
    ],
    scoring: '按倍数误差计分：差 1.35 倍约 63 分，差 2 倍约 37 分；第二次猜扣 10%。',
    sources: [
      { name: 'Amtrak GTFS 时刻表', url: 'https://content.amtrak.com/content/gtfs/GTFS.zip', note: '2026-10-14 版；站点时间为当地时间，已换算成 UTC 后相减' },
      { name: 'GTFS 规范', url: 'https://gtfs.org/' },
    ],
    dataNote: '只统计同一趟车上两站都允许上/下车的直达区间；时间为时刻表计划值，不含晚点。每个区间取所有班次中最快的一趟。为避免全是东北走廊，每条线路最多选 8 个区间。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.pairs);
    // flip display order deterministically by id so both directions look natural
    return { p };
  },

  async play(ctx, { p }) {
    const { ui } = ctx;
    const { a, b } = p;
    ctx.log('puzzle', a.id, b.id, p.km, p.min);
    const m = await ui.createMap({ bounds: [[Math.min(a.lat, b.lat), Math.min(a.lng, b.lng)], [Math.max(a.lat, b.lat), Math.max(a.lng, b.lng)]], height: 240 });
    const info = ui.panel({ kicker: '今天的区间', title: `${a.name} → ${b.name}` },
      m.el,
      ui.row(
        ui.stat({ label: '直线距离', value: `${p.km} km` }),
        ui.stat({ label: '车站代码', value: `${a.id} → ${b.id}` }),
      ));
    ctx.stage.append(info);
    try {
      const { L, map } = m;
      L.marker([a.lat, a.lng]).addTo(map).bindTooltip(a.name, { permanent: true });
      L.marker([b.lat, b.lng]).addTo(map).bindTooltip(b.name, { permanent: true });
      L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { dashArray: '6 6', weight: 2 }).addTo(map);
      map.fitBounds([[a.lat, a.lng], [b.lat, b.lng]], { padding: [40, 40] });
    } catch (e) { ctx.log.warn('map overlay failed', String(e)); }

    const res = await ctx.estimate({
      title: '最快一班要开多久？',
      prompt: '单位：分钟（60 分 = 1 小时）',
      answer: p.min, min: 20, max: 3000, log: true, step: 1, initial: Math.round(p.km / 1.1),
      format: (v) => hm(v),
      attempts: 2, scoring: 'log', scale: 0.3, tolerance: 0.03,
    });
    res.detail = ui.kv([
      ['答案', `${hm(p.min)}（${p.min} 分钟）`],
      ['平均时速', `${speed(p.km, p.min)} km/h（按直线距离，实际线路更长）`],
      ['最快的一班', `${p.train}${p.no ? ` ${p.no} 次` : ''}`],
      ['班次数 / 最慢班次', `${p.n} 班 · 最慢 ${hm(p.max ?? p.slow)}`],
      ['规律', p.km / p.min * 60 > 75 ? '时速高，说明是东北走廊或停站很少的快车。' : '时速低，说明沿途停站多、线路弯曲或与货运共线。'],
    ]);
    return res;
  },
};
