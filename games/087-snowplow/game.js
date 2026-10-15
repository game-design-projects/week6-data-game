// #87 Snowplow — plan a plow route over a real OSM street grid after a real NOAA snowstorm.
import { speeds, adjacency, newState, goTo, simulate, done, scoreFor, ZERO_AT, RESET_COST } from './plow.js';

export { scoreFor };

/** Every (area, storm) combination where a naive nearest-road driver is at least 3% slower than the reference. */
export function pairs(data) {
  const out = [];
  for (const a of data.areas) data.refs[a.id].forEach((r, si) => { if (r.greedy / r.time >= 1.03) out.push({ area: a.id, si }); });
  return out;
}

const boundsOf = (g) => {
  const lats = g.nodes.map((n) => n[0]), lngs = g.nodes.map((n) => n[1]);
  return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
};

export default {
  meta: {
    num: 87,
    slug: 'snowplow',
    title: 'Snowplow',
    tagline: '一场真实的降雪，一片真实的街区路网。规划铲雪路线，把所有主干道清完，越快越好。',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      '你从车库（白色大圆点）出发。橙色粗线是必须铲的主干道（OSM 的 primary / secondary / tertiary），灰线是没铲的居民街。',
      '点地图上的任意路口（小圆点），铲雪车会沿「当前最省时」的路线开过去。第一次开过橙色路段会把雪铲掉（变蓝，较慢），之后再开就是畅通路面（快）。',
      '雪越深，铲雪越慢，居民街也越难走。已铲好的主干道是最快的回程通道，规划好顺序和方向，少走冤枉路。',
      '全部橙色路段铲完即收工，用时和参考路线比。重来一次扣 5 分。',
    ],
    scoring: `用时等于（或快于）参考路线 → 100 分；每慢 1% 扣 2 分，慢 ${ZERO_AT * 100}% → 0 分；每重来一次 −${RESET_COST} 分。`,
    sources: [
      { name: 'OpenStreetMap 路网（Overpass API）', url: 'https://overpass-api.de/', note: '© OpenStreetMap contributors, ODbL；忽略单行线与转弯限制' },
      { name: 'NOAA GHCN-Daily 日降雪量（NCEI Access Data Service）', url: 'https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries', note: '各城市主气象站历史上最大的单日降雪（2000–2026）' },
    ],
    dataNote: '街区是 15 座美国城市里的真实路网片段（约 400–900 m 见方），路段已合并简化；每个街区配该城市历史上的 10 场大雪，共约 180 道题，只保留「随手就近开」明显比最优慢的组合。行驶速度是游戏设定的模型：清过的路 40 km/h；铲雪 = 22 − 0.9×降雪英寸 km/h（最低 5）；未铲居民街 = 32 − 降雪英寸 km/h（最低 8）。参考路线由离线的 Held-Karp 动态规划 + 局部搜索得出，是已知的好解，不保证全局最优，所以你有机会追平甚至超过它。数据是快照：已试 NOAA NCEI（无 CORS 头，且「昨天」的数据未必有降雪）与 Overpass（公共实例限流、不适合每位玩家实时拉取），因此未做实时加载。',
  },

  puzzle({ data, pick }) {
    const p = pick(pairs(data));
    const area = data.areas.find((a) => a.id === p.area);
    return { area: p.area, storm: data.storms[area.city][p.si], ref: data.refs[p.area][p.si] };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const log = ctx.log.scope('snowplow');
    const g = ctx.data.areas.find((a) => a.id === p.area);
    const city = ctx.data.cities[g.city];
    const D = p.storm.snow;
    const sp = speeds(D);
    const adj = adjacency(g);
    const nReq = g.edges.filter((e) => e[3]).length;
    const f1 = (v) => v.toFixed(1);
    log('puzzle', { area: g.id, storm: p.storm, nodes: g.nodes.length, req: nReq, ref: p.ref.time });

    ctx.stage.append(ui.panel({ kicker: `${city.name} · ${p.storm.d}`, title: `${core.fmtNum(D, 1)} 英寸的暴雪` },
      ui.h('div', { class: 'ds-grid', style: { '--min': '110px' } },
        ui.stat({ label: '铲雪 km/h', value: f1(sp.plow), sub: '橙色主干道，首次经过' }),
        ui.stat({ label: '畅通路面 km/h', value: String(sp.free), sub: '已铲好的主干道' }),
        ui.stat({ label: '未铲居民街 km/h', value: f1(sp.res), sub: `需清主干道 ${nReq} 段` }))));

    const stats = ui.h('div', { class: 'ds-row mono small', style: { gap: '16px', flexWrap: 'wrap' } });
    const mapBox = ui.h('div');
    const btn = ui.button(`重来（−${RESET_COST} 分）`, { variant: 'ghost', small: true });
    ctx.stage.append(ui.panel({ kicker: '点路口开过去', title: '铲雪路线', aside: btn }, stats, mapBox));

    const B = boundsOf(g);
    const fit = (map, h) => { map.options.zoomSnap = 0.25; map.invalidateSize(); map.fitBounds(B, { padding: [h ? 22 : 18, h ? 22 : 18], maxZoom: 18 }); };
    const M = await ui.createMap({ bounds: B, basemap: 'gray', height: 420 });
    mapBox.append(M.el);
    const { map, L } = M;
    requestAnimationFrame(() => fit(map));
    const c = { ...ui.colors(), todo: '#f0902e', hit: '#3b9cff' };
    const pts = (e) => [g.nodes[e[0]], ...(e[4] || []), g.nodes[e[1]]];
    const lines = g.edges.map((e) => L.polyline(pts(e), e[3]
      ? { color: c.todo, weight: 7, opacity: 0.95, lineCap: 'round' }
      : { color: c.ink2, weight: 3, opacity: 0.6 }).addTo(map));
    g.nodes.forEach((n) => L.circleMarker(n, { radius: 4, color: c.ink, weight: 1.5, fillColor: c.paper, fillOpacity: 1, interactive: false }).addTo(map));
    L.circleMarker(g.nodes[g.depot], { radius: 10, color: c.ink, weight: 3, fillColor: c.paper, fillOpacity: 1, interactive: false }).addTo(map);
    const truck = L.circleMarker(g.nodes[g.depot], { radius: 6, color: c.ink, weight: 2, fillColor: c.ink, fillOpacity: 1, interactive: false }).addTo(map);

    let st, resets = 0, finish;
    const used = new Set();
    function paint() {
      st.cleared.forEach((on, i) => { if (on) lines[i].setStyle({ color: c.hit, weight: 7 }); });
      st.trail.forEach(([, , ei]) => { if (!g.edges[ei][3] && !used.has(ei)) { used.add(ei); lines[ei].setStyle({ color: c.ink, weight: 4, dashArray: '2 6', opacity: 1 }); } });
      truck.setLatLng(g.nodes[st.pos]);
      const left = g.edges.filter((e, i) => e[3] && !st.cleared[i]).length;
      stats.replaceChildren(ui.h('span', `⏱ ${f1(st.time)} 分钟`), ui.h('span', `已铲 ${nReq - left}/${nReq}`), ui.h('span', { class: 'muted' }, `参考 ${f1(p.ref.time)}`), ui.h('span', { class: 'muted' }, `重来 ${resets}`));
    }
    function reset() {
      st = newState(g);
      used.clear();
      lines.forEach((l, i) => l.setStyle(g.edges[i][3] ? { color: c.todo, weight: 7 } : { color: c.ink2, weight: 3, dashArray: null, opacity: 0.6 }));
      paint();
    }
    reset();

    map.on('click', (ev) => {
      if (!st || done(g, st)) return;
      const pt = map.latLngToContainerPoint(ev.latlng);
      let best = -1, bd = 1e9;
      g.nodes.forEach((n, i) => { const q = map.latLngToContainerPoint(n); const d = Math.hypot(q.x - pt.x, q.y - pt.y); if (d < bd) { bd = d; best = i; } });
      if (best < 0 || bd > 48 || best === st.pos) return;
      goTo(g, adj, D, st, best);
      log('move', { to: best, t: +st.time.toFixed(1) });
      paint();
      if (done(g, st)) finish(st);
    });
    btn.addEventListener('click', () => { if (done(g, st)) return; resets++; log('reset'); reset(); });

    const final = await new Promise((resolve) => {
      finish = resolve;
      if (ctx.autoplay) { const s = simulate(g, adj, D, p.ref.seq); st = s; paint(); resolve(s); }
    });

    const score = scoreFor(final.time, p.ref.time, resets);
    const ratio = final.time / p.ref.time;
    const bar = '🟩'.repeat(Math.round(score / 20)) + '⬜'.repeat(5 - Math.round(score / 20));
    const dead = final.time - final.plowMin;
    const R = simulate(g, adj, D, p.ref.seq); // the reference, replayed to explain it
    const refDead = R.time - R.plowMin;
    log('done', { time: final.time, ref: p.ref.time, score });

    // reveal: the reference route, numbered in plowing order
    const rbox = ui.h('div');
    const RM = await ui.createMap({ bounds: B, basemap: 'gray', height: 320 });
    rbox.append(RM.el);
    requestAnimationFrame(() => fit(RM.map, true));
    const seen = new Set();
    R.trail.forEach(([, , ei]) => {
      const e = g.edges[ei];
      if (e[3]) {
        if (seen.has(ei)) { RM.L.polyline(pts(e), { color: c.hit, weight: 4, opacity: 0.8 }).addTo(RM.map); return; }
        seen.add(ei);
        RM.L.polyline(pts(e), { color: c.todo, weight: 7, opacity: 0.95, lineCap: 'round' }).addTo(RM.map);
        const mid = pts(e)[Math.floor(pts(e).length / 2)];
        RM.L.marker(mid, { interactive: false, icon: RM.L.divIcon({ className: '', iconSize: [22, 22], html: `<div style="width:22px;height:22px;border-radius:11px;background:#222;color:#fff;font:600 12px/22px monospace;text-align:center;border:2px solid #fff">${seen.size}</div>` }) }).addTo(RM.map);
      } else RM.L.polyline(pts(e), { color: c.ink, weight: 3, dashArray: '2 6', opacity: 1 }).addTo(RM.map);
    });
    RM.L.circleMarker(g.nodes[g.depot], { radius: 9, color: c.ink, weight: 3, fillColor: c.paper, fillOpacity: 1, interactive: false }).addTo(RM.map);

    const sideDiff = final.sideMin - R.sideMin, mainDiff = final.mainMin - R.mainMin;
    const why = ratio <= 1.001
      ? `你的空驶（${f1(dead)} 分钟）不比参考多。铲 ${nReq} 段主干道本身就要 ${f1(p.ref.plowMin)} 分钟，这是下限，剩下的时间全看空驶。`
      : sideDiff > 0.3
        ? `你多花了约 ${f1(sideDiff)} 分钟在没铲的居民街上（${f1(final.sideMin)} 对参考的 ${f1(R.sideMin)}）。这场雪里居民街只有 ${f1(sp.res)} km/h，而铲好的主干道是 ${sp.free} km/h，每次回程都该先看看能不能借道已铲的主干道。`
        : mainDiff > 0.3
          ? `你在已铲主干道上多绕了约 ${f1(mainDiff)} 分钟的回头路。参考路线的做法是让上一段的终点正好接上下一段的起点（编号 1→${nReq}），铲的方向比顺序更重要。`
          : `你的空驶比参考多约 ${f1(dead - refDead)} 分钟，主要是铲每段的方向和顺序不同：参考路线让每一段的终点尽量贴着下一段的起点，几乎不掉头。`;
    return {
      score, max: 100, win: score >= 60,
      summary: `${f1(final.time)} 分钟`,
      emoji: `🚜 Snowplow №${ctx.day} · ${city.name} ${core.fmtNum(D, 1)}″\n${bar} ${f1(final.time)} / ${f1(p.ref.time)} 分钟`,
      detail: ui.panel({ plain: true },
        ui.kv([
          ['你的用时', `${f1(final.time)} 分钟（铲雪 ${f1(final.plowMin)} + 空驶 ${f1(dead)}：居民街 ${f1(final.sideMin)}、已铲主干道 ${f1(final.mainMin)}）`],
          ['参考路线', `${f1(p.ref.time)} 分钟（铲雪 ${f1(p.ref.plowMin)} + 空驶 ${f1(refDead)}：居民街 ${f1(R.sideMin)}、已铲主干道 ${f1(R.mainMin)}）`],
          ['比较', ratio <= 1.001 ? '你追平或超过了参考路线。' : `比参考慢 ${core.fmtNum((ratio - 1) * 100, 0)}%${resets ? `，另重来 ${resets} 次扣 ${resets * RESET_COST} 分` : ''}。`],
          ['规律', why],
          ['数据', `${city.name}气象站 ${p.storm.d} 日降雪 ${core.fmtNum(D, 1)} 英寸（NOAA GHCN-Daily）；路网来自 OpenStreetMap。`],
          ['参考路线图', '参考路线：圆圈里的数字是铲雪顺序，黑色虚线是在没铲的居民街上空驶，蓝线是借道已铲好的主干道回程。'],
        ]), rbox),
    };
  },
};
