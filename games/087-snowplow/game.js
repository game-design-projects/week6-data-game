// #87 Snowplow — plan a plow route over a real OSM street grid after a real NOAA snowstorm.
import { speeds, adjacency, newState, goTo, simulate, done, scoreFor, ZERO_AT, RESET_COST } from './plow.js';

export { scoreFor };

/** Every (area, storm) combination where a naive nearest-road driver is at least 3% slower than the reference. */
export function pairs(data) {
  const out = [];
  for (const a of data.areas) data.refs[a.id].forEach((r, si) => { if (r.greedy / r.time >= 1.03) out.push({ area: a.id, si }); });
  return out;
}

/** 2012-03-04 -> "Mar 4, 2012" */
const fmtDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });

const boundsOf = (g) => {
  const lats = g.nodes.map((n) => n[0]), lngs = g.nodes.map((n) => n[1]);
  return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
};

export default {
  meta: {
    num: 87,
    slug: 'snowplow',
    title: 'Snowplow',
    tagline: 'A real snowstorm over a real street grid. Plan your plow route to clear every main road, as fast as you can.',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      'You start at the garage (the big white dot). The thick orange lines are the main roads you must plow (OSM primary / secondary / tertiary); the gray lines are unplowed residential streets.',
      'Tap any junction on the map (the small dots) and the plow drives there by the currently fastest route. The first pass over an orange segment plows it (it turns blue; slow), and after that it is clear pavement (fast).',
      'The deeper the snow, the slower the plowing and the harder residential streets are to drive. Plowed main roads are the fastest way back, so plan the order and direction to avoid wasted trips.',
      'The job is done when every orange segment is plowed; your time is compared with a reference route. Each restart costs 5 points.',
    ],
    scoring: `Matching (or beating) the reference route scores 100; every 1% slower costs 2 points, ${ZERO_AT * 100}% slower scores 0; each restart costs ${RESET_COST} points.`,
    sources: [
      { name: 'OpenStreetMap road network (Overpass API)', url: 'https://overpass-api.de/', note: '\u00a9 OpenStreetMap contributors, ODbL; one-way streets and turn restrictions are ignored' },
      { name: 'NOAA GHCN-Daily daily snowfall (NCEI Access Data Service)', url: 'https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries', note: 'The biggest single-day snowfalls at each city\'s main weather station (2000\u20132026)' },
    ],
    dataNote: 'The neighborhoods are real street-network patches (about 400\u2013900 m across) from 15 US cities, with segments merged and simplified. Each city is paired with its 10 biggest historical snowstorms, giving about 180 puzzles; only combinations where a naive nearest-road driver is clearly slower than the best route are kept. Driving speeds are a game model: plowed roads 40 km/h; plowing = 22 \u2212 0.9 \u00d7 inches of snow km/h (minimum 5); unplowed residential streets = 32 \u2212 inches of snow km/h (minimum 8). The reference route comes from an offline Held-Karp dynamic program plus local search: a known-good solution, not guaranteed optimal, so you can tie or even beat it. The data is a snapshot: NOAA NCEI (no CORS headers, and yesterday may have no snow) and Overpass (the public instance rate-limits and is unsuitable for every player to hit live) were both tried, so nothing is loaded live.',
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

    ctx.stage.append(ui.panel({ kicker: `${city.name} \u00b7 ${fmtDate(p.storm.d)}`, title: `${core.fmtNum(D, 1)}-inch snowstorm` },
      ui.h('div', { class: 'ds-grid', style: { '--min': '110px' } },
        ui.stat({ label: 'Plowing km/h', value: f1(sp.plow), sub: 'orange main roads, first pass' }),
        ui.stat({ label: 'Clear road km/h', value: String(sp.free), sub: 'plowed main roads' }),
        ui.stat({ label: 'Unplowed street km/h', value: f1(sp.res), sub: `${nReq} main segments to clear` }))));

    const stats = ui.h('div', { class: 'ds-row mono small', style: { gap: '16px', flexWrap: 'wrap' } });
    const mapBox = ui.h('div');
    const btn = ui.button(`Restart (\u2212${RESET_COST} pts)`, { variant: 'ghost', small: true });
    ctx.stage.append(ui.panel({ kicker: 'Tap a junction to drive there', title: 'Plow route', aside: btn }, stats, mapBox));

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
      stats.replaceChildren(ui.h('span', `\u23f1 ${f1(st.time)} min`), ui.h('span', `plowed ${nReq - left}/${nReq}`), ui.h('span', { class: 'muted' }, `reference ${f1(p.ref.time)}`), ui.h('span', { class: 'muted' }, `restarts ${resets}`));
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
      ? `Your deadheading (${f1(dead)} min) is no more than the reference. Plowing the ${nReq} main segments alone takes ${f1(p.ref.plowMin)} min, the floor; everything else is deadheading.`
      : sideDiff > 0.3
        ? `You spent about ${f1(sideDiff)} extra minutes on unplowed residential streets (${f1(final.sideMin)} vs. the reference's ${f1(R.sideMin)}). In this storm they run only ${f1(sp.res)} km/h while plowed main roads run ${sp.free} km/h, so on every trip back check whether you can cut through the plowed main roads.`
        : mainDiff > 0.3
          ? `You spent about ${f1(mainDiff)} extra minutes doubling back along plowed main roads. The reference ends each segment right where the next begins (numbered 1\u2192${nReq}); the direction you plow matters more than the order.`
          : `Your deadheading is about ${f1(dead - refDead)} minutes more than the reference, mostly from the direction and order of each segment: the reference ends each segment as close as possible to the start of the next and almost never turns around.`;
    return {
      score, max: 100, win: score >= 60,
      summary: `${f1(final.time)} min`,
      emoji: `🚜 Snowplow №${ctx.day} · ${city.name} ${core.fmtNum(D, 1)}″\n${bar} ${f1(final.time)} / ${f1(p.ref.time)} min`,
      detail: ui.panel({ plain: true },
        ui.kv([
          ['Your time', `${f1(final.time)} min (plowing ${f1(final.plowMin)} + deadheading ${f1(dead)}: residential ${f1(final.sideMin)}, plowed main roads ${f1(final.mainMin)})`],
          ['Reference', `${f1(p.ref.time)} min (plowing ${f1(p.ref.plowMin)} + deadheading ${f1(refDead)}: residential ${f1(R.sideMin)}, plowed main roads ${f1(R.mainMin)})`],
          ['Comparison', ratio <= 1.001 ? 'You tied or beat the reference route.' : `${core.fmtNum((ratio - 1) * 100, 0)}% slower than the reference${resets ? `, plus ${resets * RESET_COST} points for ${resets} restart${resets === 1 ? '' : 's'}` : ''}.`],
          ['Pattern', why],
          ['Data', `${core.fmtNum(D, 1)} inches of snow at the ${city.name} weather station on ${fmtDate(p.storm.d)} (NOAA GHCN-Daily); street network from OpenStreetMap.`],
          ['Reference map', 'The numbers in circles are the plowing order, black dashes are deadheading on unplowed residential streets, and blue lines are trips back along plowed main roads.'],
        ]), rbox),
    };
  },
};
