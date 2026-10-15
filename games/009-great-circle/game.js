// #9 Great Circle — draw the shortest flight path on a Mercator map; scored by
// the area between your line and the true great circle (measured on the map).
import { haversineKm } from '../../engine/core.js';

const RAD = Math.PI / 180;
/** Mercator y in "degrees" (so x and y share a unit). */
export const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD;

/** n+1 points [lat,lng] along the great circle a→b (a.lng < b.lng, b.lng may exceed 180 when the route crosses the antimeridian). */
export function gcPoints(a, b, n = 120) {
  const la = a.lat * RAD, lb = b.lat * RAD, lo1 = a.lng * RAD, lo2 = b.lng * RAD;
  const v = (la_, lo) => [Math.cos(la_) * Math.cos(lo), Math.cos(la_) * Math.sin(lo), Math.sin(la_)];
  const p = v(la, lo1), q = v(lb, lo2);
  const d = Math.acos(Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * p[0] + B * q[0], y = A * p[1] + B * q[1], z = A * p[2] + B * q[2];
    let lng = Math.atan2(y, x) / RAD;
    lng += 360 * Math.round(((out.length ? out[out.length - 1][1] : a.lng) - lng) / 360); // unwrap so lng stays continuous (may pass 180)
    out.push([Math.atan2(z, Math.hypot(x, y)) / RAD, lng]);
  }
  return out;
}

/**
 * Area (deg², Mercator map units) enclosed between a player path and the great circle.
 * Both run A→B; the closed polygon "path + reversed circle" is measured with the even-odd rule,
 * so lobes on both sides of the circle add up, zig-zags can't cancel out, and overshoots count.
 * Returns the area and the mean gap = area ÷ (east-west span of A→B).
 */
export function areaBetween(p, q, x0, x1, N = 720) {
  const poly = [...p, ...[...q].reverse()].map(([la, lo]) => [lo, merc(la)]);
  let xmin = Infinity, xmax = -Infinity;
  for (const [x] of poly) { xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); }
  const dx = (xmax - xmin) / N;
  let area = 0;
  for (let i = 0; i < N; i++) {
    const x = xmin + (i + 0.5) * dx;
    const ys = [];
    for (let k = 0; k < poly.length; k++) {
      const [xa, ya] = poly[k], [xb, yb] = poly[(k + 1) % poly.length];
      if ((xa <= x) === (xb <= x)) continue;
      ys.push(ya + ((x - xa) / (xb - xa)) * (yb - ya));
    }
    ys.sort((u, v) => u - v);
    for (let k = 0; k + 1 < ys.length; k += 2) area += (ys[k + 1] - ys[k]) * dx;
  }
  return { area, mean: area / (x1 - x0) };
}

/** Share of the straight-line error that the player must beat: 100 at 0 gap, ≈37 when mean gap = 0.5 × the straight line's gap. */
export const scoreFor = (mean, base, k = 0.5) => Math.round(100 * Math.exp(-mean / (k * base)) * 10) / 10;

/** The straight map line a→b (constant bearing) as [lat,lng] points. */
export function rhumbPoints(a, b, n = 120) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const f = i / n, y = merc(a.lat) + f * (merc(b.lat) - merc(a.lat));
    return [(2 * Math.atan(Math.exp(y * RAD)) - Math.PI / 2) / RAD, a.lng + f * (b.lng - a.lng)];
  });
}

/** Highest-latitude point (vertex) of the great circle. */
export function vertex(gc) { return gc.reduce((m, p) => (Math.abs(p[0]) > Math.abs(m[0]) ? p : m), gc[0]); }

const norm = (lng) => ((((lng + 180) % 360) + 360) % 360) - 180;

const pathKm = (pts) => pts.reduce((s, p, i) => (i ? s + haversineKm({ lat: pts[i - 1][0], lng: pts[i - 1][1] }, { lat: p[0], lng: p[1] }) : s), 0);

export default {
  meta: {
    num: 9,
    slug: 'great-circle',
    title: 'Great Circle',
    tagline: 'Draw the shortest flight path between two cities on a Mercator map. The smaller the area between your line and the true great circle, the higher your score.',
    category: 'geo',
    data: 'computed',
    howTo: [
      'The map marks today\'s start and end (some routes cross the Pacific date line). Click the map to add waypoints; the line passes through them in order, and you can Undo or Clear.',
      'A Mercator map stretches high latitudes: the shortest route (the great circle) is not a straight line on it but bows toward the pole, and the higher the latitudes and the wider the east-west span, the stronger the arc.',
      'After you submit, the true great circle is shown, comparing the actual flight distance of both lines and how far north (or south) the great circle reaches.',
      'Scoring: the area enclosed between the two lines on the map (converted to a mean gap). The straight connecting line is the baseline: drawing nothing earns only about 13, halving the straight line\'s gap earns about 37, and hugging the great circle earns 100. Zig-zags do not cancel out; the area on both sides counts.',
    ],
    scoring: '100 × e^(−your mean gap ÷ (0.5 × the straight line\'s mean gap)); mean gap = the area between the two lines (even-odd rule) ÷ the east-west span of the endpoints, in Mercator degrees.',
    sources: [
      { name: 'GeoNames cities15000', url: 'https://download.geonames.org/export/dump/', note: 'City coordinates and population (cities15000.zip, countryInfo.txt)' },
      { name: 'Great-circle distance', url: 'https://en.wikipedia.org/wiki/Great-circle_distance', note: 'Great-circle routes are computed in the browser by spherical interpolation' },
    ],
    dataNote: 'Only the city coordinates come from a GeoNames snapshot (cities have no "today" data, so nothing is fetched live). Pairs are filtered to: different countries, 3,500–13,500 km apart, 25°–170° of east-west span (including routes across the date line), and a mean gap between straight line and great circle of at least 3 Mercator degrees. Routes are pure spherical geometry with no wind or airspace restrictions, hence the "computed" badge.',
  },

  puzzle({ data, pick }) {
    const p = pick(data.pairs);
    return { a: p.a, b: p.b, km: p.km, gap: p.gap, vtx: p.vtx, vlng: p.vlng };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const log = ctx.log.scope('great-circle');
    const A = [p.a.lat, p.a.lng], B = [p.b.lat, p.b.lng];
    const gc = gcPoints(p.a, p.b);
    const straight = rhumbPoints(p.a, p.b);
    const base = areaBetween(straight, gc, p.a.lng, p.b.lng).mean;
    const wps = [];
    log('route', { from: p.a.name, to: p.b.name, km: p.km, base: +base.toFixed(2) });

    ctx.stage.append(ui.panel({ kicker: 'Today\'s route', title: `${p.a.name} → ${p.b.name}` },
      ui.kv([
        ['From', `${p.a.name} (${p.a.country})`],
        ['To', `${p.b.name} (${p.b.country})`],
        ['Distance', `${core.fmtKm(p.km)} (the route is revealed after you submit)`],
      ])));

    const box = ui.panel({ title: 'Draw the shortest route' });
    ctx.stage.append(box);
    const lat0 = (p.a.lat + p.b.lat) / 2, lng0 = (p.a.lng + p.b.lng) / 2;
    const pad = Math.max(8, (p.b.lng - p.a.lng) * 0.15);
    const north = Math.max(p.a.lat, p.b.lat, p.vtx > 0 ? p.vtx : -90) + 4, south = Math.min(p.a.lat, p.b.lat, p.vtx < 0 ? p.vtx : 90) - 4;
    const m = await ui.createMap({
      center: [lat0, lng0], zoom: 3, height: 400,
      bounds: [[Math.max(-80, south - pad / 3), p.a.lng - pad], [Math.min(80, north + pad / 3), p.b.lng + pad]],
    });
    m.el.classList.add('crosshair');
    const { L, map } = m;
    const col = ui.colors();
    m.pin(A, 'answer', p.a.name);
    m.pin(B, 'answer', p.b.name);
    const line = L.polyline([A, B], { color: col.accent, weight: 4 }).addTo(map);
    const dots = L.layerGroup().addTo(map);
    const status = ui.h('div', { class: 'ink2 small' });
    const undo = ui.button('Undo', { variant: 'ghost', small: true });
    const clear = ui.button('Clear', { variant: 'ghost', small: true });
    const submit = ui.button('Submit route', { variant: 'accent' });
    box.append(m.el, ui.h('div', { class: 'ds-row between', style: { marginTop: '12px', flexWrap: 'wrap', gap: '8px' } },
      status, ui.h('div', { class: 'ds-row', style: { gap: '8px' } }, undo, clear, submit)));

    const path = () => [A, ...wps, B];
    const redraw = () => {
      line.setLatLngs(path());
      dots.clearLayers();
      wps.forEach((w) => L.circleMarker(w, { radius: 7, color: col.accent, fillColor: col.paper, fillOpacity: 1, weight: 3 }).addTo(dots));
      status.textContent = wps.length ? `${wps.length} ${wps.length === 1 ? 'waypoint' : 'waypoints'} · flight distance so far ${core.fmtKm(pathKm(path()))}` : 'Click the map to add waypoints (for now it is the straight line from start to end)';
      undo.disabled = clear.disabled = !wps.length;
    };
    map.on('click', (e) => {
      let lng = e.latlng.lng;
      const mid = (p.a.lng + p.b.lng) / 2;
      while (lng < mid - 180) lng += 360;
      while (lng > mid + 180) lng -= 360;
      wps.push([Math.max(-82, Math.min(82, e.latlng.lat)), lng]);
      redraw();
    });
    undo.addEventListener('click', () => { wps.pop(); redraw(); });
    clear.addEventListener('click', () => { wps.length = 0; redraw(); });
    redraw();

    await new Promise((resolve) => {
      submit.addEventListener('click', resolve);
      if (ctx.autoplay) (async () => {
        await ctx.sleep(30);
        const g = gc[Math.floor(gc.length / 2)];
        wps.push([g[0] - 3, g[1]]); redraw();
        await ctx.sleep(30); resolve();
      })();
    });
    submit.remove(); undo.remove(); clear.remove();
    map.off('click');
    m.el.classList.remove('crosshair');

    const mine = path();
    const { mean } = areaBetween(mine, gc, p.a.lng, p.b.lng);
    const score = scoreFor(mean, base);
    const myKm = pathKm(mine);
    const straightKm = pathKm(straight);
    log('result', { wps: wps.length, mean: +mean.toFixed(2), score, myKm: Math.round(myKm) });

    L.polyline(gc, { color: col.hit, weight: 4 }).addTo(map);
    L.polyline(mine, { color: col.accent, weight: 3, dashArray: '6 6' }).addTo(map);
    m.setLabels(true);

    const v = vertex(gc);
    const maxEnd = Math.max(Math.abs(p.a.lat), Math.abs(p.b.lat));
    const bars = Math.round(score / 10);
    return {
      score, max: 100,
      win: score >= 80,
      emoji: `✈️ ${'🟩'.repeat(bars)}${'⬜'.repeat(10 - bars)}`,
      summary: `Mean gap ${mean.toFixed(1)}° (straight line: ${base.toFixed(1)}°)`,
      detail: ui.panel({ plain: true },
        ui.kv([
          ['Great circle', core.fmtKm(p.km)],
          ['Your route', `${core.fmtKm(myKm)} (${core.fmtKm(Math.max(0, myKm - p.km))} longer)`],
          ['Map line', `${core.fmtKm(straightKm)} (${core.fmtKm(straightKm - p.km)} longer)`],
          ['Your gap', `${mean.toFixed(2)}° on average, ${Math.round((mean / base) * 100)}% of the straight line\'s gap`],
          ['Why', `The great circle from ${p.a.name} (${Math.abs(p.a.lat).toFixed(0)}°${p.a.lat >= 0 ? 'N' : 'S'}) to ${p.b.name} (${Math.abs(p.b.lat).toFixed(0)}°${p.b.lat >= 0 ? 'N' : 'S'}) peaks at ${Math.abs(v[0]).toFixed(0)}°${v[0] >= 0 ? 'N' : 'S'}, near ${Math.abs(norm(v[1])).toFixed(0)}°${norm(v[1]) >= 0 ? 'E' : 'W'}${Math.abs(v[0]) > maxEnd + 0.5 ? `, ${(Math.abs(v[0]) - maxEnd).toFixed(0)}° beyond either city` : ''}. Mercator stretches high latitudes, so the shortest route bows toward the ${v[0] >= 0 ? 'north' : 'south'} pole on the map; the wider the span and the higher the latitudes, the stronger the arc.`],
        ])),
    };
  },
};
