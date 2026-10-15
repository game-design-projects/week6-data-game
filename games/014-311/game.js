// #14 311 — a ZIP code's 311 complaint mix; pin where in NYC it is.
const DIRS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];

export function borough(zip) {
  const p = String(zip).slice(0, 3), n = +p;
  if (n >= 100 && n <= 102) return '曼哈顿';
  if (n === 103) return '史坦顿岛';
  if (n === 104) return '布朗克斯';
  if (n === 112) return '布鲁克林';
  return '皇后区';
}

// rows for the clue bars: name, share %, citywide share %, lift ×
export function rowsFor(z, zh) {
  return z.top.map(([t, pct, avg]) => ({ t, name: zh[t] || t, pct, avg, lift: avg > 0 ? pct / avg : null }));
}

export default {
  meta: {
    num: 14,
    slug: '311',
    title: '311',
    tagline: '给出纽约某个邮编区一整年的 311 投诉构成，在地图上标出这个街区。',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      '条形图是 2025 年某个邮编区最常见的 311 投诉类型占比，竖线是全市平均占比。',
      '别看谁最长，要看谁“比竖线长得多”：摊贩、露宿、出租车投诉多在中城；供暖、漏水多在老公寓区；堵车库、废弃车辆多在外围居民区。',
      '在地图上点出这个邮编区的位置（图钉离区域中心越近越好）。你有 2 次机会，第一次偏了会提示方向和距离。',
      '揭晓时会画出该邮编区的轮廓，并告诉你哪几类投诉最“反常”。',
    ],
    scoring: '100 × e^(−距离/4 km)，距离指图钉到邮编区中心；第二次尝试扣 10%。',
    sources: [
      { name: 'NYC Open Data · 311 Service Requests from 2020 to Present', url: 'https://data.cityofnewyork.us/resource/erm2-nwe9.json', note: '2025 全年，按邮编与投诉类型聚合' },
      { name: 'NYC Open Data · Modified Zip Code Tabulation Areas (MODZCTA)', url: 'https://data.cityofnewyork.us/resource/pri4-ifjk.geojson', note: '邮编区边界、中心点与人口估计' },
    ],
    dataNote: '数据为 2025 全年快照（311 公开接口每日更新，但本游戏固定用整年数据，保证每天题目一致）。邮编区采用 NYC 的 MODZCTA 划分（个别小邮编合并，如 10001/10118）；只保留全年投诉量 ≥ 4,000 条且面积不太大的邮编区。投诉类型名称为中文意译。',
  },

  puzzle({ data, pick }) {
    return { zip: pick(data.zips).zip };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const z = ctx.data.zips.find((x) => x.zip === p.zip);
    const zh = ctx.data.zh;
    ctx.log('zip', z.zip, z.total, z.poly.length);
    const rows = rowsFor(z, zh);
    const maxV = Math.max(...rows.map((r) => Math.max(r.pct, r.avg ?? 0))) * 1.08;
    const pc = (v) => `${(100 * v / maxV).toFixed(2)}%`;
    const bars = ui.h('div', { class: 'ds-stack', style: { gap: '10px' } }, rows.map((r) =>
      ui.h('div', { class: 'ds-stack', style: { gap: '3px' } },
        ui.h('div', { class: 'ds-row', style: { justifyContent: 'space-between', gap: '8px', flexWrap: 'nowrap', alignItems: 'baseline' } },
          ui.h('span', { style: { flex: '1 1 auto', minWidth: 0 } }, r.name, ' ', ui.h('span', { class: 'small muted' }, r.name === r.t ? '' : r.t)),
          ui.h('span', { class: 'mono small', style: { flex: '0 0 auto', whiteSpace: 'nowrap' } }, `${r.pct}%`, ui.h('span', { class: 'muted' }, ` · 全市 ${r.avg}%`))),
        ui.h('div', { style: { position: 'relative', height: '12px', background: 'var(--paper2)', borderRadius: '3px' } },
          ui.h('div', { style: { width: pc(r.pct), height: '100%', background: 'var(--accent)', borderRadius: '3px' } }),
          ui.h('div', { style: { position: 'absolute', top: '-3px', bottom: '-3px', left: pc(r.avg), width: '3px', marginLeft: '-1px', background: 'var(--ink)', borderRadius: '1px' } })))));
    ctx.stage.append(ui.panel({ kicker: `2025 年 · 共 ${core.fmtNum(z.total)} 条投诉`, title: '这个邮编区在抱怨什么' }, bars,
      ui.h('div', { class: 'small muted', style: { marginTop: '10px' } }, '橙色条 = 该区占比，黑色竖线 = 全市平均占比。')));

    const res = await ctx.pin({
      answer: { lat: z.lat, lng: z.lng, label: `邮编 ${z.zip}` },
      view: { bounds: [[40.49, -74.27], [40.92, -73.69]] },
      scale: 4,
      attempts: 2,
      title: '它在纽约的哪里？',
      hint: (km, bearing) => `差 ${km.toFixed(1)} km，再往${DIRS[Math.round(bearing / 45) % 8]}找找`,
      reveal: async ({ map, L }) => {
        const layer = L.polygon(z.poly, { color: '#e8590c', weight: 2, fillOpacity: 0.18 }).addTo(map);
        try { map.fitBounds(layer.getBounds().pad(2.5), { maxZoom: 14 }); } catch (e) { ctx.log.warn('fit', e); }
      },
    });
    const top = z.lift[0];
    const topRow = z.top.find((t) => t[0] === top[0]);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['邮编', z.zip], ['行政区', borough(z.zip)], ['居住人口（估计）', core.fmtNum(z.pop)], ['人均投诉', `${(z.total / Math.max(z.pop, 1)).toFixed(2)} 条/人·年`]]),
      ui.h('div', {}, `最关键的线索：“${zh[top[0]] || top[0]}”是全市平均的 ${top[1]} 倍${topRow ? `（占该区 ${topRow[1]}%）` : ''}。最“反常”的三类：`),
      ui.table({ columns: [{ key: 't', label: '类型' }, { key: 'x', label: '占比是全市的', num: true }], rows: z.lift.map(([t, x]) => ({ t: zh[t] || t, x: `${x}×` })) }));
    return res;
  },
};
