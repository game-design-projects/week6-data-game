// #11 Aftershock — a day of USGS earthquakes with the biggest one hidden.
// Find where it struck (clusters of small quakes = foreshocks/aftershocks), then guess its magnitude.

/** Score for a magnitude guess: 100 at exact, ~37 at 0.6 off. */
export function magScore(guess, answer) {
  return Math.round(100 * Math.exp(-Math.abs(guess - answer) / 0.6));
}

/** Count quakes within `km` of a point (used for the teaching detail). */
export function nearby(others, lat, lng, km, hav) {
  return others.filter((q) => hav(lat, lng, q[0], q[1]) <= km);
}

export default {
  meta: {
    num: 11,
    slug: 'aftershock',
    title: 'Aftershock',
    tagline: '这一天全球的地震都在图上，唯独最大的那次被藏起来了。找出它的位置，再猜它有多大。',
    category: 'geo',
    data: 'snapshot',
    wide: true,
    howTo: [
      '地图上每个圆点是当天一次 M2.5 以上的地震，圆越大震级越高。当天最大的一次已被隐藏。',
      '大地震前后常有一串小震（前震、余震）。找到异常密集、却缺了「主角」的那一簇，在那里落点。',
      '落点后再猜它的震级：看周围小震的最大值和数量——主震总比余震大，通常大 1 级左右。',
    ],
    scoring: '位置 100 × e^(−距离/1200 km)；震级 100 × e^(−误差/0.6)；总分取两者平均。',
    sources: [
      { name: 'USGS Earthquake Catalog (FDSN event API)', url: 'https://earthquake.usgs.gov/fdsnws/event/1/', note: 'M2.5+，按 UTC 日历日分组；仅选取最大震 ≥ M5.0 且明显大于第二名的日子' },
    ],
    dataNote: '数据为预先下载的 2026-04 至 2026-09 的 USGS 目录快照；谜题按日期从快照中抽取，不是实时的「过去 24 小时」。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return p;
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    ctx.log('puzzle', p.date, 'quakes', p.others.length, 'hidden', p.top.id);
    ctx.stage.append(ui.panel({ kicker: `UTC ${p.date}`, title: '被藏起来的最大地震' },
      ui.h('div', { class: 'ds-grid', style: { '--min': '140px' } },
        ui.stat({ label: '当天地震数', value: String(p.others.length + 1), sub: 'M2.5 及以上' }),
        ui.stat({ label: '可见最大', value: `M${p.others[0][2].toFixed(1)}`, sub: '隐藏的更大' }))));

    const pinRes = await ctx.pin({
      title: '1 · 它在哪里？',
      answer: { lat: p.top.lat, lng: p.top.lng, label: `M${p.top.mag} · ${p.top.place}` },
      view: { bounds: [[-55, -175], [72, 175]] },
      scale: 1200,
      setup: async ({ L, map }) => {
        for (const [lat, lng, m] of p.others) {
          L.circleMarker([lat, lng], { radius: Math.max(2, (m - 1.5) * 2.2), weight: 1, color: '#555', fillColor: '#e0a030', fillOpacity: 0.45, interactive: false }).addTo(map);
        }
      },
    });

    const magRes = await ctx.estimate({
      title: '2 · 它有多大？',
      prompt: '参考周边小震：主震通常比最大的余震高 1 级以上（Båth 定律）。',
      answer: p.top.mag, min: 4.5, max: 9.5, step: 0.1, initial: 6,
      format: (v) => `M${Number(v).toFixed(1)}`,
      scoring: (g, a) => magScore(g, a) / 100,
    });

    const near = nearby(p.others, p.top.lat, p.top.lng, 300, core.haversineKm);
    const maxNear = near.reduce((a, q) => Math.max(a, q[2]), 0);
    const res = ctx.combine([pinRes, magRes]);
    res.detail = ui.kv([
      ['答案', `M${p.top.mag} · ${p.top.place}（UTC ${p.top.time}）`],
      ['线索', near.length ? `300 km 内有 ${near.length} 次小震，最大 M${maxNear.toFixed(1)}——比主震低 ${(p.top.mag - maxNear).toFixed(1)} 级。` : '附近几乎没有小震：这次是孤立的大震，只能靠板块边界位置判断。'],
      ['规律', '大地震的余震数量随震级指数增长（Båth 定律：最大余震约比主震小 1.2 级），所以一簇异常密集的小震往往指向被藏起来的主震。'],
    ]);
    return res;
  },
};
