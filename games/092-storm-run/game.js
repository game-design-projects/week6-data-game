// #92 Storm Run — fly a courier through a real NEXRAD radar snapshot; cost = how hard the weather hits you.
import { solve, pathCost, routeScore, decodeGrid, line } from './route.js';
import { decodePNG, toPuzzle, pickBest, livePath, TIERS, W, H } from './shape.js';

export const LIVE_HOURS = ['18', '21', '23']; // UTC hours of the previous day tried for a live storm window

// radar level (dBZ/5) → colour, roughly the NWS reflectivity ramp
const RAMP = ['', '#9fe3ee', '#9fe3ee', '#6cc7f0', '#58c85a', '#2f9f3a', '#f2e04a', '#e8b82e', '#f39a2c', '#e8601c', '#d62a1f', '#b3151b', '#e43fc7', '#e43fc7', '#8a4bc0', '#8a4bc0'];
const LEGEND = [['<20 dBZ clear/light rain', 1, '#9fe3ee'], ['20–30 moderate rain', 1.5, '#58c85a'], ['30–40 heavy rain', 3, '#f2e04a'], ['40–50 thunderstorm', 8, '#f39a2c'], ['≥50 core/hail', 25, '#d62a1f']];

/** Approximate length in km of a grid path at latitude lat (cells are 0.25° square in lat/lon). */
export function pathKm(path, cell, lat) {
  const kx = 111.32 * Math.cos((lat * Math.PI) / 180) * cell, ky = 110.57 * cell;
  let km = 0;
  for (let i = 1; i < path.length; i++) km += Math.hypot((path[i][0] - path[i - 1][0]) * kx, (path[i][1] - path[i - 1][1]) * ky);
  return km;
}

/** Largest sideways bulge (in cells, signed: + = south) of a route away from the straight start→end line. */
export function maxBulge(path, start, end) {
  let best = 0;
  for (const [x, y] of path) {
    const ly = start[1] + ((end[1] - start[1]) * (x - start[0])) / ((end[0] - start[0]) || 1);
    if (Math.abs(y - ly) > Math.abs(best)) best = y - ly;
  }
  return best;
}

/** Live puzzle for one UTC day from already-decoded composites [{ hh, img }]; strict tier first, relaxed if a quiet day. */
export function liveFromImages(day, imgs) {
  for (const tier of TIERS) {
    const p = pickBest(imgs.map(({ hh, img }) => toPuzzle(img, day, hh, { tier })));
    if (p) return { ...p, live: true };
  }
  return null;
}

export default {
  meta: {
    num: 92,
    slug: 'storm-run',
    title: 'Storm Run',
    tagline: 'Fly a courier through real radar echoes: draw the lowest-risk route across yesterday\u2019s US weather radar.',
    category: 'levels',
    data: 'live',
    howTo: [
      'The map is a real NEXRAD radar mosaic of a patch of the US (state borders for reference). Start at the S on the left and deliver to the E on the right.',
      'Press and drag on the map and the route follows your finger cell by cell; drag back to undo. When you reach E, hit Deliver.',
      'Each cell costs by radar intensity: <20 dBZ clear/light rain 1, 20–30 moderate rain 1.5, 30–40 heavy rain 3, 40–50 thunderstorm 8, 50+ core 25. Diagonal steps cost √2 times more.',
      'Detour or punch through? Your cost is compared with the optimal route (computed with Dijkstra): the closer you get, the higher the score. After the reveal the optimal route is drawn on the map.',
    ],
    scoring: '100 × (optimal cost ÷ your cost)^1.5: paying 10% extra is about 87, 20% extra about 76, double about 35, and flying straight usually scores under 40.',
    sources: [
      { name: 'Iowa Environmental Mesonet: NEXRAD N0R US composite archive', url: 'https://mesonet.agron.iastate.edu/docs/nexrad_composites/', note: 'One image every 5 minutes on a 0.01° grid; the game downloads it in the browser and downsamples to 0.25° cells' },
      { name: 'Radar image file directory (sample month)', url: 'https://mesonet.agron.iastate.edu/archive/data/2025/06/', note: 'Path /YYYY/MM/DD/GIS/uscomp/n0r_YYYYMMDDHH00.png' },
      { name: 'NOAA MRMS (inspiration)', url: 'https://www.nssl.noaa.gov/projects/mrms/' },
      { name: 'us-atlas state borders', url: 'https://github.com/topojson/us-atlas', note: 'Base-map outlines only' },
    ],
    dataNote: 'The original idea used NOAA MRMS, which is large GRIB2 files with no public CORS endpoint, so browsers cannot read it. Instead we use the IEM archive of NEXRAD national composites (from 2021 these are N0R mosaics IEM builds from N0Q, 5 dBZ steps, CORS-enabled). Each day\u2019s puzzle uses the previous UTC day\u2019s 18, 21 and 23 UTC images and searches them for the best 9° × 6° convective window (each cell takes the 88th-percentile reflectivity within 0.25°). Start and end sit on clear cells on the left and right, with a direct flight costing at least 1.5 to 1.8 times the optimum. If the previous day had almost no thunderstorms nationwide, or the download fails, a built-in snapshot of 80 strong-convection days from 2022-2023 is used (the page then shows \u201cSnapshot\u201d).',
  },

  // Live: the previous UTC day's composites (final all day, same for everyone), reduced to one storm-run window.
  async load(ctx) {
    const day = ctx.core.addDays(ctx.date, -1);
    const fetchPng = async (hh) => {
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), 15000);
      try {
        const r = await fetch(livePath(day, hh), { signal: ac.signal });
        if (!r.ok) throw new Error(`${r.status} ${hh}`);
        return { hh, img: await decodePNG(await r.arrayBuffer()) };
      } catch (e) { ctx.log.warn('storm-run composite', hh, String(e)); return null; } finally { clearTimeout(t); }
    };
    const imgs = (await Promise.all(LIVE_HOURS.map(fetchPng))).filter(Boolean);
    if (!imgs.length) throw new Error('no composites for ' + day);
    const p = liveFromImages(day, imgs);
    if (!p) { ctx.log('storm-run: no usable storm window on', day, '→ snapshot'); return null; }
    ctx.log('storm-run live', day, p.utc, p.lat0, p.lon0);
    return { ...ctx.data, live: p };
  },

  puzzle({ data, pick }) {
    const p = data.live ?? pick(data.puzzles);
    return { ...p, w: data.w, h: data.h };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const { w, h } = p;
    const grid = decodeGrid(p.grid);
    const opt = solve(grid, w, h, p.start, p.end);
    const direct = opt.straight;
    ctx.log('storm-run', p.date, p.utc, 'opt', opt.cost.toFixed(1), 'direct', direct.toFixed(1));

    const lat1 = p.lat0 - h * p.cell, lon1 = p.lon0 + w * p.cell;
    const title = p.live ? (ctx.date === ctx.today ? 'Yesterday\u2019s radar' : 'The previous day\u2019s radar') : 'A historical radar image';
    const kicker = p.live ? `${p.date} ${p.utc} UTC · real radar fetched live` : `${p.date} ${p.utc} UTC · real radar (historical snapshot)`;
    ctx.stage.append(ui.panel({ kicker, title },
      ui.h('div', { class: 'small ink2' }, `Window ${p.lat0.toFixed(1)}°N–${lat1.toFixed(1)}°N, ${Math.abs(p.lon0).toFixed(1)}°W–${Math.abs(lon1).toFixed(1)}°W${p.live ? '' : ' (no usable storms the previous day, so a historical day is used)'}. Flying straight costs ${core.fmtNum(Math.round(direct))}. How low can you go?`),
      ui.h('div', { class: 'ds-row small', style: { gap: '10px', marginTop: '10px', flexWrap: 'wrap' } },
        ...LEGEND.map(([t, c, col]) => ui.h('span', {}, ui.h('span', { style: { color: col } }, '■'), ` ${t} ×${c}`)))));

    let path = [p.start];
    let revealed = false;
    let dragging = false;
    let optAnim = 0, hudDone = false, hudKey = -1;
    const cost = () => pathCost(grid, w, path);
    const atEnd = () => path[path.length - 1][0] === p.end[0] && path[path.length - 1][1] === p.end[1];

    // state outlines (grid coordinates) so the radar has a geographic anchor; best effort
    let rings = [];
    try {
      const gj = await ctx.ui.geo('states');
      const proj = ([lo, la]) => [(lo - p.lon0) / p.cell, (p.lat0 - la) / p.cell];
      const add = (ring) => {
        const q = ring.map(proj);
        if (q.some(([x, y]) => x > -2 && x < w + 2 && y > -2 && y < h + 2)) rings.push(q);
      };
      for (const f of gj.features) {
        const gm = f.geometry;
        if (!gm) continue;
        if (gm.type === 'Polygon') gm.coordinates.forEach(add); else if (gm.type === 'MultiPolygon') gm.coordinates.forEach((pl) => pl.forEach(add));
      }
    } catch (e) { ctx.log.warn('storm-run states overlay failed', String(e)); }
    return await new Promise((resolve) => {
      let doneBtn;
      const costEl = ui.h('b', { class: 'mono' }, '0.0'), refEl = ui.h('span', { class: 'mono muted' }, '');
      ctx.stage.append(ui.h('div', { class: 'ds-row', style: { justifyContent: 'space-between', margin: '4px 2px 8px', flexWrap: 'wrap' } },
        ui.h('span', {}, 'Current cost ', costEl), refEl));
      const refresh = () => { doneBtn.disabled = !atEnd(); };
      const s = ctx.canvas({
        aspect: w / h,
        onFrame(dt, g, st) {
          const cw = st.w / w, ch = st.h / h;
          g.clearRect(0, 0, st.w, st.h);
          g.fillStyle = st.colors.paper2; g.fillRect(0, 0, st.w, st.h);
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const L = grid[y * w + x];
            if (!L) continue;
            g.fillStyle = RAMP[L]; g.globalAlpha = L <= 3 ? 0.55 : 0.9;
            g.fillRect(x * cw, y * ch, cw + 0.5, ch + 0.5);
          }
          g.globalAlpha = 1;
          if (rings.length) {
            g.beginPath(); g.strokeStyle = st.colors.ink; g.globalAlpha = 0.4; g.lineWidth = 1; g.lineJoin = 'round';
            for (const r of rings) r.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, x * cw, y * ch));
            g.stroke(); g.globalAlpha = 1;
          }
          const trace = (pts, col, wid, dash) => {
            g.beginPath(); g.setLineDash(dash || []); g.strokeStyle = col; g.lineWidth = wid; g.lineJoin = 'round'; g.lineCap = 'round';
            pts.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, (x + 0.5) * cw, (y + 0.5) * ch));
            g.stroke(); g.setLineDash([]);
          };
          if (revealed) { optAnim = Math.min(1, optAnim + dt * 1.2); trace(opt.path.slice(0, Math.max(2, Math.round(opt.path.length * optAnim))), st.colors.ink, Math.max(2, cw * 0.28), [cw * 0.5, cw * 0.5]); }
          trace(path, st.colors.accent, Math.max(3, cw * 0.4));
          const mark = (pt, t, col) => {
            const mx = Math.max(cw * 1.1, Math.min(st.w - cw * 1.1, (pt[0] + 0.5) * cw)), my = (pt[1] + 0.5) * ch;
            g.fillStyle = col; g.beginPath(); g.arc(mx, my, cw * 1.05, 0, 7); g.fill();
            g.fillStyle = t === 'S' ? st.colors.paper : '#fff'; g.font = `700 ${cw * 1.2}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(t, mx, my + cw * 0.06);
          };
          const head = path[path.length - 1];
          g.fillStyle = st.colors.accent; g.beginPath(); g.arc((head[0] + 0.5) * cw, (head[1] + 0.5) * ch, cw * 0.55, 0, 7); g.fill();
          mark(p.start, 'S', st.colors.ink); mark(p.end, 'E', st.colors.accent);
          const c = cost();
          if (!hudDone || hudKey !== c) { // update the readout only when the cost changed
            hudDone = true; hudKey = c;
            costEl.textContent = c.toFixed(1);
            refEl.textContent = revealed ? `Optimal ${opt.cost.toFixed(1)}` : `Straight ${direct.toFixed(0)}`;
          }
        },
        onPointer(type, pt, st) {
          if (revealed) return;
          if (type === 'down') dragging = true;
          if (type === 'up') { dragging = false; return; }
          if (!dragging) return;
          const tx = Math.max(0, Math.min(w - 1, Math.floor(pt.x / (st.w / w)))), ty = Math.max(0, Math.min(h - 1, Math.floor(pt.y / (st.h / h))));
          for (let i = 0; i < 60; i++) {
            const [hx, hy] = path[path.length - 1];
            if (hx === tx && hy === ty) break;
            const nx = hx + Math.sign(tx - hx), ny = hy + Math.sign(ty - hy);
            const back = path.length > 1 && path[path.length - 2][0] === nx && path[path.length - 2][1] === ny;
            if (back) { path.pop(); continue; }
            const loop = path.findIndex(([x, y]) => x === nx && y === ny);
            if (loop >= 0) { path = path.slice(0, loop + 1); continue; }
            if (atEnd()) break;
            path.push([nx, ny]);
          }
          refresh();
        },
      });

      const finishRun = (mine) => {
        revealed = true; hudDone = false;
        const score = routeScore(opt.cost, mine);
        const cells = (pts, min) => pts.filter(([x, y]) => grid[y * w + x] >= min).length;
        const lat = p.lat0 - (h * p.cell) / 2;
        const optKm = Math.round(pathKm(opt.path, p.cell, lat)), directKm = Math.round(pathKm(line(p.start, p.end), p.cell, lat));
        const myKm = Math.round(pathKm(path, p.cell, lat));
        const crossings = cells(path, 8), optCross = cells(opt.path, 8), dirCross = cells(line(p.start, p.end), 8);
        const bulge = maxBulge(opt.path, p.start, p.end), bulgeKm = Math.round(Math.abs(bulge) * p.cell * 110);
        const wetPct = Math.round((100 * grid.filter((v) => v >= 4).length) / grid.length);
        const saving = Math.round((100 * (direct - opt.cost)) / direct);
        const why = Math.abs(bulge) >= 2
          ? `${wetPct}% of this map's cells have echoes, and the straight line crosses ${dirCross} cells of 40+ dBZ thunderstorm, costing ${direct.toFixed(0)}. The optimal route swings up to ${Math.abs(Math.round(bulge))} cells (about ${bulgeKm} km) ${bulge < 0 ? 'north' : 'south'}, growing the trip from ${directKm} km to ${optKm} km, ${optCross < dirCross ? `yet crosses only ${optCross} storm cells` : `still crosses ${optCross} storm cells, but only at the edges`}, and cuts the cost to ${opt.cost.toFixed(1)} (${saving}% less). A longer hop through clear sky is far cheaper than cutting through ×8 / ×25 echoes.`
          : `${wetPct}% of this map's cells have echoes, yet the best route between start and end is nearly a straight line (largest deviation ${Math.abs(Math.round(bulge))} cells). It does not barge through; it hugs ×1 clear cells and ×1.5 light rain. The straight line costs ${direct.toFixed(0)} because it also steps on ${dirCross > optCross ? `${dirCross - optCross} more storm cells` : 'some moderate-to-heavy rain'}.`;
        const gap = mine / opt.cost;
        const verdict = gap < 1.005 ? 'As good as the optimal route.' : `You paid ${Math.round((gap - 1) * 100)}% more than optimal` + (crossings > optCross ? `, crossing ${crossings - optCross} more storm-core cells: your biggest loss.` : ', mostly from needless rain or extra detours.');
        const emoji = `⛈️ Storm Run №${ctx.day}\n${'🟩'.repeat(Math.round(score / 20))}${'⬜'.repeat(5 - Math.round(score / 20))} ${score}`;
        optAnim = 0; // keep the frame loop running so a resize never leaves the canvas blank
        ctx.log('storm-run result', mine.toFixed(1), opt.cost.toFixed(1), score);
        resolve({
          score, max: 100, win: score >= 70, emoji,
          summary: `Cost ${mine.toFixed(1)} (optimal ${opt.cost.toFixed(1)})`,
          detail: ui.kv([
            ['Your route', `${path.length - 1} steps (about ${myKm} km), cost ${mine.toFixed(1)}, crossing ${crossings} cells of 40+ dBZ storm. ${verdict}`],
            ['Optimal route', `${opt.path.length - 1} steps (about ${optKm} km), cost ${opt.cost.toFixed(1)}, crossing ${optCross} storm cells (dashed line on the map)`],
            ['Straight line', `About ${directKm} km, cost ${direct.toFixed(1)}, crossing ${dirCross} storm cells`],
            ['Why', why],
            ['Data', p.live ? `IEM NEXRAD N0R composite radar, ${p.date} ${p.utc} UTC (previous day, fetched live in your browser)` : `IEM NEXRAD N0R composite radar archive, ${p.date} ${p.utc} UTC (historical snapshot)`],
          ]),
        });
      };
      doneBtn = ui.button('Deliver', { variant: 'accent', onClick: () => { if (atEnd() && !revealed) finishRun(cost()); } });
      doneBtn.disabled = true;
      const reset = ui.button('Reset', { variant: 'ghost', onClick: () => { if (!revealed) { path = [p.start]; refresh(); } } });
      ctx.stage.append(ui.h('div', { class: 'ds-row', style: { gap: '10px', marginTop: '12px' } }, doneBtn, reset));
      s.hud.style.display = 'none';
      for (const ev of ['pointercancel', 'lostpointercapture']) s.canvas.addEventListener(ev, () => { dragging = false; });
      s.canvas.addEventListener('pointerdown', (e) => { try { s.canvas.setPointerCapture(e.pointerId); } catch {} });
      s.start();
      if (ctx.autoplay) {
        // autoplay bot: flies the optimal route
        path = opt.path.slice();
        setTimeout(() => finishRun(pathCost(grid, w, path)), 100);
      }
    });
  },
};
