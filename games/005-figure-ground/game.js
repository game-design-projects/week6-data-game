// #5 Figure-Ground — a 1 km² street network, white on black, no labels. Which city?
// Street grids carry history: Roman/Hippodamian orthogonal grids, medieval tangles,
// Haussmann stars, American superblocks, planned capitals, informal settlements.
import { expScore } from '../../engine/core.js';

/** Decode delta-encoded ways [cls, x0, y0, dx, dy, …] into absolute polylines. */
export function decode(ways) {
  return ways.map((w) => {
    const pts = [[w[1], w[2]]];
    for (let i = 3; i < w.length; i += 2) pts.push([pts.at(-1)[0] + w[i], pts.at(-1)[1] + w[i + 1]]);
    return { cls: w[0], pts };
  });
}

/**
 * Street-pattern stats: total length (km), grid-ness (share of length within 10° of the dominant axis pair),
 * axis = compass bearing (0–89°, clockwise from north) of that axis pair.
 */
export function stats(ways) {
  const bins = new Array(90).fill(0);
  let total = 0;
  for (const { cls, pts } of decode(ways)) {
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      const len = Math.hypot(dx, dy); if (!len) continue;
      total += len;
      const a = ((Math.atan2(-dy, dx) * 180 / Math.PI) % 90 + 90) % 90; // maths angle (ccw from east) mod 90
      bins[Math.floor(a) % 90] += len;
    }
  }
  let best = 0, bestV = -1;
  for (let c = 0; c < 90; c++) { let s = 0; for (let d = -10; d <= 10; d++) s += bins[(c + d + 90) % 90]; s += bins[c] * 1e-6; /* tie-break to the plateau's centre */ if (s > bestV) { bestV = s; best = c; } }
  return { km: total / 1000, grid: total ? Math.min(1, bestV / total) : 0, axis: (90 - best) % 90 };
}

/** Human wording of a compass axis bearing (0–89). */
export function axisText(b) {
  if (b <= 3 || b >= 87) return 'almost exactly north-south and east-west';
  return b <= 45 ? `about ${b}° east of north` : `about ${90 - b}° west of north`;
}

/** Final score of the pin preset (engine: expScore × max(0.4, 1 − 0.15 per extra try)); mirrored here for tests and copy. */
export const SCALE_KM = 2500, ATTEMPTS = 4, HIT_KM = SCALE_KM * 0.02;
export const finalScore = (km, tries) => Math.round(expScore(km, SCALE_KM, 100) * Math.max(0.4, 1 - 0.15 * (tries - 1)));

const TEMPS = [[300, '🔥 Scorching'], [1000, '♨️ Hot'], [2500, '🌡️ Warm'], [5000, '🌤️ Cool'], [9000, '❄️ Cold']];
export const temp = (km) => (TEMPS.find(([lim]) => km < lim) ?? [0, '🧊 Freezing'])[1];

export default {
  meta: {
    num: 5,
    slug: 'figure-ground',
    title: 'Figure-Ground',
    tagline: 'One square kilometer of streets, white on black, with no labels. From the texture of the street net, name the city.',
    category: 'geo',
    data: 'snapshot',
    howTo: [
      'The white lines on black are the drivable roads within a 1 km × 1 km square at the heart of a city, north up. Thicker lines are wider roads; thin ones are side streets and alleys.',
      'Read the texture: tidy grids are common in the Americas and colonial cities; radial rings and diagonal boulevards look like old European capitals; winding, dense alleys mean an old town or a hill town; huge blocks and interchanges suggest a modern planned city.',
      'Drop a pin on the world map. You have 4 tries. Each miss tells you how hot or cold you are and how many kilometers off, but not the direction, so use a couple of distances to triangulate.',
      'Within 50 km counts as a hit and ends the round; otherwise your last try is scored after all 4.',
    ],
    scoring: 'Your last guess counts: 100 × e^(−distance / 2500 km). Each extra try costs another 15% of the total (up to 45%). A first-try hit is 100; a hit on the 4th try is about 55.',
    sources: [
      { name: 'OpenStreetMap (Overpass API)', url: 'https://overpass-api.de/', note: 'Highway line features within 1 km² of each city center. © OpenStreetMap contributors, ODbL' },
    ],
    dataNote: 'A one-time snapshot of OpenStreetMap (build scripts in build/), with roads simplified to a 2-3 m tolerance. Only drivable roads are drawn (including side streets and service roads). Footpaths, cycleways, steps and tracks are left out, because how completely they are mapped varies enormously between cities and would make \u201cwho mapped more\u201d louder than the street texture. The square is centered on a point in the city core (some cities deliberately avoid interchanges, big parks or water and use an old-town block instead); that center is the answer.',
  },

  puzzle({ data, pick }) {
    const c = pick(data.cities);
    return { city: c };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const c = p.city;
    const st = stats(c.ways);
    ctx.log('figure-ground', { city: c.name, ways: c.ways.length, ...st });

    const canvas = ui.h('canvas', { role: 'img', 'aria-label': 'Street network in white lines on black, with no text labels', style: { width: '100%', aspectRatio: '1', display: 'block', background: '#000', borderRadius: '8px', maxWidth: '560px', margin: '0 auto' } });
    const scale = ui.h('div', { class: 'small mono muted', style: { textAlign: 'center', marginTop: '8px' } }, 'White bar at the bottom = 200 m', ui.h('br'), 'Whole image 1 km × 1 km · north is up');
    ctx.stage.append(ui.panel({ kicker: 'Clue', title: 'Which city\'s square kilometer is this?' }, canvas, scale));

    const draw = () => {
      const px = canvas.clientWidth || 360, dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.height = Math.round(px * dpr);
      const g = canvas.getContext('2d'); const k = canvas.width / 1000;
      g.fillStyle = '#000'; g.fillRect(0, 0, canvas.width, canvas.height);
      g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
      const W = [[2.6 * px / 560 + 1.2, 1], [1.5 * px / 560 + 0.6, 0.9], [0.8 * px / 560 + 0.3, 0.6]];
      for (const cls of [2, 1, 0]) {
        g.lineWidth = W[cls][0] * dpr; g.globalAlpha = W[cls][1];
        g.beginPath();
        for (const w of decode(c.ways)) {
          if (w.cls !== cls) continue;
          g.moveTo(w.pts[0][0] * k, w.pts[0][1] * k);
          for (let i = 1; i < w.pts.length; i++) g.lineTo(w.pts[i][0] * k, w.pts[i][1] * k);
        }
        g.stroke();
      }
      g.globalAlpha = 1; g.fillStyle = '#fff'; g.fillRect(40 * k, 960 * k, 200 * k, 6 * dpr);
    };
    draw();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => draw()) : null;
    ro?.observe(canvas);

    const res = await ctx.pin({
      answer: { lat: c.lat, lng: c.lng, label: `${c.name}, ${c.country}` },
      view: { center: [25, 10], zoom: 2, bounds: [[-56, -170], [74, 178]] }, // whole world, fits 390 px too
      scale: SCALE_KM,
      attempts: ATTEMPTS,
      title: 'Pin it on the map',
      prompt: 'A world map with no place names. After each try you only learn hot or cold and the distance in km, not the direction.',
      hint: (km) => `${temp(km)} · ${core.fmtKm(km)} from the answer`,
      reveal: async ({ L, map }) => {
        L.rectangle([[c.lat - 0.0045, c.lng - 0.0045 / Math.cos(c.lat * Math.PI / 180)], [c.lat + 0.0045, c.lng + 0.0045 / Math.cos(c.lat * Math.PI / 180)]], { color: ui.colors().accent, weight: 2, fillOpacity: 0.15 }).addTo(map);
      },
    });
    ro?.disconnect();

    // where does this square sit among the whole pool? (learn what "grid-ness" means)
    const all = ctx.data.cities.map((x) => stats(x.ways).grid);
    const rank = all.filter((g) => g > st.grid).length + 1;
    const style = st.grid > 0.75 ? 'Highly gridded: nearly all streets share one pair of perpendicular directions, almost surely a planned grid district'
      : st.grid > 0.5 ? 'Semi-regular: the main streets form a grid, mixed with diagonals or irregular blocks'
        : 'Irregular: streets point every which way, most likely an organically grown old town or a radial or curvilinear layout';
    res.detail = ui.panel({ plain: true }, ui.kv([
      ['Answer', `${c.name}, ${c.country} (${c.lat.toFixed(3)}°, ${c.lng.toFixed(3)}°)`],
      ['What marks this square', c.note],
      ['Total road length', `${st.km.toFixed(1)} km (${c.ways.length} segments): the denser and more broken the net, the more it tends to be an old town`],
      ['Grid-ness', `${Math.round(st.grid * 100)}% (rank ${rank} of ${all.length} cities), main axis ${axisText(st.axis)}`],
      ['How to read it', style],
      ['General clues', 'First check whether block size and orientation are uniform, then look for diagonal arterials, ring roads, interchanges and dead-end alleys: they are fingerprints of different eras and planning traditions.'],
    ]));
    return res;
  },
};
