// #11 Aftershock — a day of USGS earthquakes with the biggest one hidden.
// Find where it struck (clusters of small quakes = foreshocks/aftershocks), then guess its magnitude.

/** Score for a magnitude guess: 100 at exact, ~37 at 0.6 off. */
export function magScore(guess, answer) {
  return Math.round(100 * Math.exp(-Math.abs(guess - answer) / 0.6));
}

const MIN_TOP = 4.8, MIN_GAP = 0.2, MIN_N = 25;
const r2 = (x) => Math.round(x * 100) / 100;

/**
 * Shape a USGS GeoJSON feed (one UTC day, M2.5+) into a puzzle, or null if the day
 * has no clear "biggest" quake (top < M4.8, < 0.2 above the runner-up, or < 25 quakes).
 */
export function toPuzzle(geo, date) {
  const qs = [];
  for (const f of geo?.features ?? []) {
    const p = f.properties ?? {}, c = f.geometry?.coordinates ?? [];
    if (p.type !== 'earthquake' || !Number.isFinite(p.mag) || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || !Number.isFinite(p.time)) continue;
    if (new Date(p.time).toISOString().slice(0, 10) !== date) continue;
    qs.push({ mag: p.mag, lat: c[1], lng: c[0], place: p.place, id: String(f.id), t: p.time });
  }
  const seen = new Set();
  const uniq = qs.filter((q) => !seen.has(q.id) && seen.add(q.id));
  uniq.sort((a, b) => b.mag - a.mag || (a.id < b.id ? -1 : 1));
  if (uniq.length < MIN_N) return null;
  const [top, second] = uniq;
  if (top.mag < MIN_TOP || top.mag - second.mag < MIN_GAP) return null;
  return {
    date, n: uniq.length,
    top: { lat: r2(top.lat), lng: r2(top.lng), mag: top.mag, place: top.place || `${r2(top.lat)}°, ${r2(top.lng)}°`, id: top.id, time: new Date(top.t).toISOString().slice(11, 16) },
    others: uniq.slice(1).map((q) => [r2(q.lat), r2(q.lng), q.mag]),
  };
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
    data: 'live',
    wide: true,
    howTo: [
      '地图上每个圆点是昨天（UTC）全球的一次 M2.5 以上地震，圆越大震级越高。当天最大的一次已被隐藏。',
      '大地震前后常有一串小震（前震、余震）。找到异常密集、却缺了「主角」的那一簇，在那里落点。',
      '落点后再猜它的震级：看周围小震的最大值和数量——主震总比余震大，通常大 1 级左右。',
    ],
    scoring: '位置 100 × e^(−距离/1200 km)；震级 100 × e^(−误差/0.6)；总分取两者平均。',
    sources: [
      { name: 'USGS Earthquake Catalog (FDSN event API)', url: 'https://earthquake.usgs.gov/fdsnws/event/1/', note: 'M2.5+，按 UTC 日历日分组；仅选取最大震 ≥ M4.8 且比第二名至少大 0.2 级的日子' },
    ],
    dataNote: '谜题取自 USGS 目录中「昨天（UTC）」整日的地震，次日起数据已定稿，所有玩家看到同一天；为保证公平不用滚动的「过去 24 小时」。若昨天没有明显的最大震（< M4.8 或与第二名相差 < 0.2 级）或网络失败，则从 2026-04 至 2026-10 的快照中按日抽取一天。',
  },

  async load(ctx) {
    const day = ctx.core.addDays(ctx.date, -1); // yesterday UTC: the catalog is final for everyone
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${day}&endtime=${ctx.date}&minmagnitude=2.5&orderby=time-asc&limit=20000`;
    const geo = await ctx.fetchJSON(url, { timeout: 12000 });
    const live = toPuzzle(geo, day);
    ctx.log('live', day, live ? `${live.n} quakes, hidden M${live.top.mag}` : 'no clear biggest quake, using snapshot');
    return live ? { ...ctx.data, live } : null;
  },

  puzzle({ data, pick }) {
    return data.live ?? pick(data.puzzles);
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    ctx.log('puzzle', p.date, 'quakes', p.others.length, 'hidden', p.top.id);
    ctx.stage.append(ui.panel({ kicker: `UTC ${p.date}`, title: '被藏起来的最大地震' },
      ui.h('div', { class: 'ds-grid', style: { '--min': '140px' } },
        ui.stat({ label: '当天地震数', value: String(p.others.length + 1), sub: 'M2.5 及以上' }),
        ui.stat({ label: '可见最大', value: `M${p.others[0][2].toFixed(1)}`, sub: '隐藏的更大' }))));

    let revealed = false;
    const pinRes = await ctx.pin({
      title: '1 · 它在哪里？',
      answer: { lat: p.top.lat, lng: p.top.lng, label: `M${p.top.mag} · ${p.top.place}` },
      view: { bounds: [[-55, -175], [72, 175]] },
      scale: 1200,
      height: (ctx.stage.clientWidth || 390) < 700 ? Math.round((ctx.stage.clientWidth || 390) * 0.8) : undefined,
      reveal: async () => {
        revealed = true;
      },
      setup: async ({ L, map }) => {
        // fit the whole world at any width (fractional zoom so 390 px phones see everything)
        map.setMinZoom(0);
        map.options.zoomSnap = 0;
        map.options.zoomDelta = 0.5;
        const fit = () => { if (revealed) return; map.invalidateSize(); map.fitBounds([[-58, -170], [75, 170]], { padding: [4, 4], animate: false }); };
        fit(); setTimeout(fit, 120);
        for (const [lat, lng, m] of p.others) {
          L.circleMarker([lat, lng], { radius: Math.max(2, (m - 1.5) * 2.2), weight: 1, color: '#555', fillColor: '#e0a030', fillOpacity: 0.45, interactive: false }).addTo(map);
        }
      },
    });

    const g = pinRes.guess;
    const nearG = nearby(p.others, g.lat, g.lng, 300, core.haversineKm);
    const maxG = nearG.reduce((a, q) => Math.max(a, q[2]), 0);
    const magRes = await ctx.estimate({
      title: '2 · 它有多大？',
      prompt: nearG.length
        ? `你的落点 300 km 内有 ${nearG.length} 次可见小震，最大 M${maxG.toFixed(1)}。主震通常比最大的余震高 1 级左右（Båth 定律）。`
        : '你的落点 300 km 内没有可见小震——孤立的大震没有余震线索，只能凭板块边界猜。',
      answer: p.top.mag, min: 4, max: 9.5, step: 0.1, initial: 6,
      format: (v) => `M${Number(v).toFixed(1)}`,
      scoring: (gg, a) => magScore(gg, a) / 100,
    });

    const near = nearby(p.others, p.top.lat, p.top.lng, 300, core.haversineKm);
    const maxNear = near.reduce((a, q) => Math.max(a, q[2]), 0);
    const res = ctx.combine([pinRes, magRes]);
    res.detail = ui.kv([
      ['答案', `M${p.top.mag} · ${p.top.place}（UTC ${p.date} ${p.top.time}）`],
      ['你的结果', `位置偏差 ${core.fmtKm(pinRes.km)}，震级猜 M${Number(magRes.guess).toFixed(1)}（差 ${Math.abs(magRes.guess - p.top.mag).toFixed(1)} 级）`],
      ['线索', near.length
        ? `${p.top.place} 周围 300 km 内有 ${near.length} 次小震，最大 M${maxNear.toFixed(1)}，比主震低 ${(p.top.mag - maxNear).toFixed(1)} 级——那一簇缺了「主角」的密集点就是它的余震/前震。`
        : `${p.top.place} 周围 300 km 内没有一次可见小震：这次是孤立的大震，只能靠板块边界（俯冲带、洋中脊）的位置判断，震级则只能按全球统计推测。`],
      ['规律', '大地震的余震数量随震级指数增长，最大余震约比主震小 1.2 级（Båth 定律），所以一簇异常密集的小震往往指向被藏起来的主震，簇里最大的点加 1 级多就是它的震级。'],
    ]);
    return res;
  },
};
