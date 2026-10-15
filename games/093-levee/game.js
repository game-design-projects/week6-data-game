// #93 Levee — rain on real terrain; place three levees to keep as many real buildings dry as possible.
import { N, LEN, WET, leveeCells, simulate, dryCount, cellCounts, scoreOf, marginals } from './sim.js';

const COMPASS = (r, c) => {
  const v = r < 5.33 ? 'north' : r < 10.67 ? 'middle' : 'south';
  const h = c < 5.33 ? 'west' : c < 10.67 ? 'middle' : 'east';
  return v === 'middle' && h === 'middle' ? 'center' : v === 'middle' ? `${h} side` : h === 'middle' ? `${v} side` : `${v}${h} corner`;
};
const leveeMid = (lv) => { const cs = leveeCells(lv); const a = cs[0], z = cs[cs.length - 1]; return [((Math.floor(a / N) + Math.floor(z / N)) / 2) + 0.5, (((a % N) + (z % N)) / 2) + 0.5]; };
const leveeEnds = (lv) => { const cs = leveeCells(lv); const a = cs[0], z = cs[cs.length - 1]; return [[(a % N) + 0.5, Math.floor(a / N) + 0.5], [(z % N) + 0.5, Math.floor(z / N) + 0.5]]; };

export function toPuzzle(s) {
  return { name: s.name, lat: s.lat, lng: s.lng, rain: s.rain, z: s.z, pts: s.pts, b: cellCounts(s.pts), ref: s.ref };
}

export default {
  meta: {
    num: 93,
    slug: 'levee',
    title: 'Levee',
    tagline: 'Storm rain falls on real terrain. Place three levees to keep as many real buildings dry as you can.',
    category: 'levels',
    data: 'snapshot',
    howTo: [
      'The map is real terrain for a 1.6 km × 1.6 km patch of a flood-prone US town (lighter ground is higher, dark spots are low). Each small square is a real OpenStreetMap building at its true location.',
      'Rain falls on every cell and flows downhill, pooling in low spots. Blue is standing water under your current plan, red squares are flooded buildings, cream ones are dry.',
      'Tap a cell to drop a 500 m levee (pick horizontal or vertical with the buttons first), up to three. Tap an existing levee to remove it; the map re-simulates instantly.',
      'When you confirm, you are compared with an algorithmic reference solution: the share of the reference\u2019s extra saved buildings (over doing nothing) that you saved is your score. You can beat the reference. Max 100.',
    ],
    scoring: '100 × (buildings you save − no levees) ÷ (reference saves − no levees), clamped to 0–100; random placement usually scores around 10.',
    sources: [
      { name: 'AWS Terrain Tiles (Terrarium)', url: 'https://registry.opendata.aws/terrain-tiles/', note: 'Elevation inside the US comes from USGS 3DEP 10 m data; Hawaii and similar areas from other DEMs' },
      { name: 'OpenStreetMap buildings via Overpass API', url: 'https://overpass-api.de/' },
    ],
    dataNote: 'Elevation and building locations are real (each building is the center point of its OSM outline, one dot per building). The water flow is our own simplified shallow-water model (100 m cells; rain falls evenly and flows toward lower water levels, drains off the edges, and levees act as walls that cannot be crossed), not a USGS hydrology simulation. The \u201cstorm size\u201d is a relative amount chosen per terrain so that about half the buildings flood with no levees; it does not correspond to real millimeters of rain. The reference solution is computed offline by greedy search plus local tweaks and is not necessarily the global optimum, so players can beat it.',
  },

  puzzle({ data, pick }) {
    return toPuzzle(pick(data.sites));
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const log = ctx.log.scope('levee');
    const nb = p.pts.length / 2;
    const base = dryCount(p.b, simulate(p.z, p.rain));
    const refDepth = simulate(p.z, p.rain, p.ref);
    const refDry = dryCount(p.b, refDepth);
    const relief = Math.max(...p.z);
    log('start', p.name, { buildings: nb, base, refDry, rain: p.rain, relief });
    const zmax = Math.max(...p.z, 1);

    // Smooth terrain image (hypsometric tint + hillshade), rebuilt when the theme changes.
    let terrain = null, terrainKey = '';
    const buildTerrain = (col) => {
      const S = 64, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
      const g = cv.getContext('2d'); const img = g.createImageData(S, S);
      const parse = (css) => { const t = document.createElement('canvas').getContext('2d'); t.fillStyle = css; t.fillRect(0, 0, 1, 1); return [...t.getImageData(0, 0, 1, 1).data]; };
      const lo = parse(col.paper2), hi = parse(col.muted);
      const zat = (x, y) => { // bilinear, cell-centre samples
        const fx = Math.min(N - 1, Math.max(0, x * N - 0.5)), fy = Math.min(N - 1, Math.max(0, y * N - 0.5));
        const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(N - 1, x0 + 1), y1 = Math.min(N - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
        const A = p.z[y0 * N + x0], B = p.z[y0 * N + x1], C = p.z[y1 * N + x0], D = p.z[y1 * N + x1];
        return (A * (1 - tx) + B * tx) * (1 - ty) + (C * (1 - tx) + D * tx) * ty;
      };
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const u = (x + 0.5) / S, v = (y + 0.5) / S, e = 1 / S * 2;
        const t = Math.min(1, zat(u, v) / zmax);
        const shade = (zat(u - e, v - e) - zat(u + e, v + e)) / (zmax * 0.12 + 1);
        const k = 0.12 + 0.7 * Math.sqrt(t);
        const o = (y * S + x) * 4;
        for (let ch = 0; ch < 3; ch++) img.data[o + ch] = Math.max(0, Math.min(255, (lo[ch] * (1 - k) + hi[ch] * k) * (1 + Math.max(-0.45, Math.min(0.45, shade)))));
        img.data[o + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      return cv;
    };

    const drawBoard = (g, st, depth, levees, opts = {}) => {
      const cs = st.w / N;
      const key = st.colors.paper2 + st.colors.muted;
      if (key !== terrainKey) { terrain = buildTerrain(st.colors); terrainKey = key; }
      g.clearRect(0, 0, st.w, st.h);
      g.imageSmoothingEnabled = true; g.drawImage(terrain, 0, 0, st.w, st.h);
      for (let i = 0; i < N * N; i++) {
        if (depth[i] <= 0.05) continue;
        g.globalAlpha = Math.min(0.85, 0.25 + depth[i] * 0.5); g.fillStyle = '#2f7fd8';
        g.fillRect((i % N) * cs, Math.floor(i / N) * cs, cs + 0.5, cs + 0.5);
      }
      g.globalAlpha = 1;
      const bs = Math.max(3, cs * 0.2);
      for (let k = 0; k < p.pts.length; k += 2) {
        const x = p.pts[k] / 10, y = p.pts[k + 1] / 10;
        const wet = depth[Math.min(N - 1, Math.floor(y)) * N + Math.min(N - 1, Math.floor(x))] >= WET;
        g.fillStyle = wet ? st.colors.bad : st.colors.paper; g.strokeStyle = wet ? st.colors.paper : st.colors.ink; g.lineWidth = 1;
        g.fillRect(x * cs - bs / 2, y * cs - bs / 2, bs, bs);
        g.strokeRect(x * cs - bs / 2 + 0.5, y * cs - bs / 2 + 0.5, bs - 1, bs - 1);
      }
      g.lineCap = 'round';
      const line = (lv, alpha) => {
        const [[x1, y1], [x2, y2]] = leveeEnds(lv);
        g.globalAlpha = alpha;
        for (const [col, wd] of [[st.colors.ink, 9], [opts.color || st.colors.near, 5]]) {
          g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); g.moveTo(x1 * cs, y1 * cs); g.lineTo(x2 * cs, y2 * cs); g.stroke();
        }
        g.globalAlpha = 1;
      };
      for (const lv of levees) line(lv, 1);
      if (opts.ghost) line(opts.ghost, 0.45);
    };

    let levees = [];
    let orient = 'h';
    let ghost = null;
    let depth = simulate(p.z, p.rain, levees);
    let revealed = false;
    const refresh = () => { depth = simulate(p.z, p.rain, levees); };

    const status = ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '16px', marginTop: '8px', flexWrap: 'wrap' } });
    const updateStatus = () => {
      const dry = dryCount(p.b, depth);
      status.replaceChildren(
        ui.h('span', `Saved ${dry}/${nb}`),
        ui.h('span', { class: 'muted' }, `No levees: ${base}`),
        ui.h('span', `Levees ${levees.length}/3`));
    };

    const stage = ctx.canvas({
      aspect: 1,
      onFrame(dt, g, st) { drawBoard(g, st, depth, levees, { ghost: revealed || levees.length >= 3 ? null : ghost }); },
      onPointer(type, pt, st) {
        const cs = st.w / N;
        const c = Math.min(N - 1, Math.max(0, Math.floor(pt.x / cs))), r = Math.min(N - 1, Math.max(0, Math.floor(pt.y / cs)));
        if (type === 'move') { ghost = { r, c, o: orient }; return; }
        if (type !== 'down' || revealed) return;
        const hit = levees.findIndex((lv) => leveeCells(lv).includes(r * N + c));
        if (hit >= 0) { levees.splice(hit, 1); log('remove', r, c); }
        else if (levees.length >= 3) { ui.toast('Three levees max. Tap an existing one to remove it.'); return; }
        else { levees.push({ r, c, o: orient }); log('place', { r, c, o: orient }); }
        refresh(); updateStatus();
      },
    });
    stage.el.setAttribute('role', 'img');
    stage.el.setAttribute('aria-label', 'Plan view of terrain and buildings; tap to place levees');

    const bh = ui.button('Horizontal ━', { variant: 'accent', small: true, onClick: () => setO('h') });
    const bv = ui.button('Vertical ┃', { variant: 'ghost', small: true, onClick: () => setO('v') });
    function setO(o) {
      orient = o;
      bh.className = bh.className.replace(/\b(accent|ghost)\b/g, '') + (o === 'h' ? ' accent' : ' ghost');
      bv.className = bv.className.replace(/\b(accent|ghost)\b/g, '') + (o === 'v' ? ' accent' : ' ghost');
    }

    const describe = (lv) => { const [r, c] = leveeMid(lv); return `${COMPASS(r, c)} (${lv.o === 'h' ? 'east-west' : 'north-south'})`; };

    return new Promise((resolve) => {
      const finish = () => {
        const got = dryCount(p.b, depth);
        const score = scoreOf(base, refDry, got);
        revealed = true;
        const mine = levees.length ? marginals(p.z, p.b, p.rain, levees) : [];
        const refM = marginals(p.z, p.b, p.rain, p.ref);
        log('submit', { got, base, refDry, score, mine, refM });
        // Second board: the reference solution's flood.
        const refStage = ctx.canvas({ aspect: 1, onFrame(dt, g, st) { drawBoard(g, st, refDepth, p.ref, { color: st.colors.hit }); } });
        ctx.stage.append(ui.panel({ kicker: 'Reference solution', title: `The algorithm\u2019s three levees: ${refDry}/${nb} buildings saved` }, refStage.el,
          ui.h('div', { class: 'small muted', style: { marginTop: '6px' } }, 'Green = the reference levees; same rain, same terrain.')));
        refStage.start();
        const share = refDry > base ? Math.round((100 * refM.reduce((a, x) => a + Math.max(0, x), 0)) / (refDry - base)) : 0;
        resolve({
          score, max: 100, win: score >= 60,
          emoji: `🌧️ ${'🛡️'.repeat(levees.length)}\nSaved ${got}/${nb}`,
          summary: `Saved ${got}/${nb} · reference ${refDry}`,
          detail: ui.kv([
            ['Place', `${p.name} (${p.lat.toFixed(3)}°, ${p.lng.toFixed(3)}°), ${relief.toFixed(0)} m maximum relief in the window, ${nb} buildings`],
            ['No levees', `${base}/${nb} buildings saved`],
            ['Your plan', levees.length
              ? `${got} saved (${got - base >= 0 ? '+' : ''}${got - base}); each levee on its own: ${levees.map((lv, i) => `${describe(lv)} ${mine[i] >= 0 ? '+' : ''}${mine[i]}`).join(', ')}`
              : `No levees placed, ${got} saved`],
            ['Reference', `${refDry} saved (${refDry - base >= 0 ? '+' : ''}${refDry - base}): ${p.ref.map((lv, i) => `${describe(lv)} ${refM[i] >= 0 ? '+' : ''}${refM[i]}`).join(', ')}`],
            ['Pattern', `Water runs downhill and pools in basins; a levee is worth what catchment area and flow paths toward buildings it cuts off. The best single levee here is at the ${describe(p.ref[refM.indexOf(Math.max(...refM))])}, saving ${Math.max(...refM)} on its own${share > 105 ? ' (the three levees reinforce each other)' : ''}. Blocking a low outlet beats ringing the buildings themselves.`],
          ]),
        });
      };
      const done = ui.button('Confirm plan', { variant: 'accent', onClick: finish });
      const clear = ui.button('Clear', { variant: 'ghost', small: true, onClick: () => { levees = []; refresh(); updateStatus(); } });
      ctx.stage.append(ui.panel(
        { kicker: `${p.name} · 1.6 × 1.6 km · relief ${relief.toFixed(0)} m`, title: 'Place three levees' },
        stage.el, status,
        ui.h('div', { class: 'small muted', style: { marginTop: '4px' } }, `Lighter = higher ground · blue = standing water · red = flooded building · yellow bar = your levee (${LEN * 100} m each)`),
        ui.h('div', { class: 'ds-row', style: { marginTop: '12px', gap: '10px', flexWrap: 'wrap' } }, bh, bv, clear, done)));
      updateStatus();
      stage.start();
      if (ctx.autoplay) setTimeout(() => { levees = p.ref.slice(); refresh(); updateStatus(); finish(); }, 100);
    });
  },
};
