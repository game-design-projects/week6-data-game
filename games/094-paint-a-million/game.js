// #94 Paint a Million — on a WorldPop 1 km population grid, paint the smallest
// area that holds ~1,000,000 people. Optimum = take cells densest-first.

export const TARGET = 1_000_000;
export const TOL = 0.05; // ±5 % counts as "exactly a million"

/** Fewest cells whose densest-first prefix reaches TARGET·(1−TOL). */
export function optimalCells(cells, target = TARGET, tol = TOL) {
  const order = cells.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  let s = 0;
  const idx = [];
  for (const [v, i] of order) {
    if (s >= target * (1 - tol)) break;
    s += v; idx.push(i);
  }
  return { k: idx.length, sum: s, idx };
}

/** Score 0..100: (area efficiency)² × accuracy (full marks inside ±5 %, linear fall-off to 0 at ±30 %).
 *  Efficiency is squared so that 10 % too many cells costs ~19 points: just "darkest first" is not enough, you must rank near-ties. */
export function scoreRun(sum, k, optK, target = TARGET, tol = TOL) {
  if (!k || !sum) return 0;
  const dev = Math.abs(sum / target - 1);
  const acc = dev <= tol ? 1 : Math.max(0, 1 - (dev - tol) / 0.25);
  const eff = Math.min(1, optK / k);
  return Math.round(100 * eff * eff * acc);
}

export default {
  meta: {
    num: 94,
    slug: 'paint-a-million',
    title: 'Paint a Million',
    tagline: 'On a population-density map, paint the smallest area that holds exactly one million people.',
    category: 'levels',
    data: 'snapshot',
    howTo: [
      'Each small cell is 1 km × 1 km; the darker it is, the more people live there. Tap or drag to paint cells, and tap again to unpaint.',
      'The live total of people you have painted is shown at the top. Aim for 1,000,000 (within ±5% counts as exact) using as few cells as possible.',
      'Tip: population is highly concentrated. Paint the darkest core first, and do not fill big pale suburbs just to make up the number.',
      'Tap or hover any cell to read its population; the color bar shows the scale. After you submit, green outlines mark the most area-efficient answer for this window.',
    ],
    scoring: 'Score = 100 × (optimal cells ÷ your cells)² × accuracy. Painting 10% too many cells costs about 19 points. Accuracy is 1 within ±5% of the target, then falls linearly to 0 at 30% off.',
    sources: [
      { name: 'WorldPop Global 1 km Aggregated Population 2020', url: 'https://hub.worldpop.org/geodata/listing?id=64', note: 'data.worldpop.org/GIS/Population/Global_2000_2020_1km/2020/' },
      { name: 'GeoNames cities15000', url: 'https://download.geonames.org/export/dump/', note: 'used to name each 30 km window' },
    ],
    dataNote: 'Each puzzle is a 30×30 km window cut from the WorldPop 2020 1 km grid (151 windows, 82 countries) holding 1.6-8 million people in total. Cell area varies slightly with latitude (about 0.6-1 km²), and scoring counts cells. This is a 2020 modeled estimate, not live data; place names come from the nearest GeoNames city. A few countries, such as Russia, failed to download and are not included.',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    const opt = optimalCells(p.cells);
    return { ...p, n: data.n, optK: opt.k, optSum: opt.sum, optIdx: opt.idx };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const N = p.n;
    const max = Math.max(...p.cells);
    const painted = new Set();
    let done = false;
    const sum = () => { let s = 0; for (const i of painted) s += p.cells[i]; return s; };
    const optSet = new Set(p.optIdx);
    const where = p.place ? `near ${p.place}` : `${p.lat.toFixed(2)}°, ${p.lng.toFixed(2)}°`;
    ctx.log('puzzle', p.iso, where, 'total', p.total, 'optK', p.optK);

    const vTotal = ui.h('span', { class: 'mono' }, '0');
    const vCells = ui.h('span', { class: 'mono' }, '0');
    const vGap = ui.h('span', { class: 'mono' }, '');
    const vCell = ui.h('span', { class: 'mono' }, 'Tap or hover a cell to read its population');
    const status = ui.h('div', { class: 'ds-grid', style: { '--min': '150px' } },
      ui.stat({ label: 'People painted', value: vTotal, sub: vGap }),
      ui.stat({ label: 'Cells', value: vCells, sub: `target 1 million · ${p.km2.toFixed(2)} km²/cell` }));
    const refresh = () => {
      const s = sum();
      vTotal.textContent = core.fmtNum(s);
      vCells.textContent = String(painted.size);
      const d = s - TARGET;
      vGap.textContent = !painted.size ? 'To target —' : 'To target ' + ( Math.abs(d) <= TARGET * TOL ? 'on target ✓' : (d > 0 ? '+' : '−') + core.fmtCompact(Math.abs(d)));
    };

    ctx.stage.append(ui.panel({ kicker: `${p.country} · ${where} · ${N}×${N} km`, title: 'Paint one million people' }, status,
      ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, `This window holds ${core.fmtNum(p.total)} people in total. The darker the cell, the more people in it (square-root scale).`),
      ui.h('div', { class: 'ds-row', style: { gap: '8px', marginTop: '8px', alignItems: 'center' } },
        ui.h('span', { class: 'small muted mono' }, '0'),
        ui.h('div', { style: { flex: '1', maxWidth: '240px', height: '10px', borderRadius: '5px', border: '1px solid var(--rule)', background: 'linear-gradient(90deg, var(--paper2), var(--accent))' } }),
        ui.h('span', { class: 'small muted mono' }, `${core.fmtNum(max)} people/cell`)),
      ui.h('div', { class: 'small', style: { marginTop: '6px' } }, vCell)));

    const draw = (g, st) => {
      const cs = st.w / N;
      g.clearRect(0, 0, st.w, st.h);
      for (let i = 0; i < p.cells.length; i++) {
        const x = (i % N) * cs, y = Math.floor(i / N) * cs, v = p.cells[i];
        g.fillStyle = st.colors.paper2; g.fillRect(x, y, cs, cs);
        if (v > 0) { g.globalAlpha = Math.min(1, 0.04 + 0.96 * Math.sqrt(v / max)); g.fillStyle = st.colors.accent; g.fillRect(x, y, cs, cs); g.globalAlpha = 1; }
        if (painted.has(i)) { g.fillStyle = st.colors.ink; g.globalAlpha = 0.55; g.fillRect(x, y, cs, cs); g.globalAlpha = 1; g.strokeStyle = st.colors.ink; g.lineWidth = 1.5; g.strokeRect(x + 1, y + 1, cs - 2, cs - 2); }
        if (done && optSet.has(i)) { g.strokeStyle = st.colors.hit; g.lineWidth = 2.5; g.strokeRect(x + 1.5, y + 1.5, cs - 3, cs - 3); }
      }
    };

    let mode = null;
    const cellAt = (pt, st) => {
      const cs = st.w / N, cx = Math.floor(pt.x / cs), cy = Math.floor(pt.y / cs);
      return cx < 0 || cy < 0 || cx >= N || cy >= N ? -1 : cy * N + cx;
    };
    const stage = ctx.canvas({
      aspect: 1,
      onFrame(dt, g, st) { draw(g, st); },
      onPointer(type, pt, st) {
        if (done) return;
        if (type === 'up') { mode = null; return; }
        const i = cellAt(pt, st);
        if (i >= 0 && type !== 'up') vCell.textContent = `Row ${Math.floor(i / N) + 1}, column ${(i % N) + 1}: ${core.fmtNum(p.cells[i])} people`;
        if (type === 'move' && !mode) return;
        if (i < 0) return;
        if (type === 'down') mode = painted.has(i) ? 'erase' : 'paint';
        if (mode === 'paint') painted.add(i); else painted.delete(i);
        refresh();
      },
    });
    stage.canvas.style.touchAction = 'none';
    stage.canvas.style.cursor = 'crosshair';

    const result = await new Promise((resolve) => {
      const finish = () => {
        done = true; stage.stop(); draw(stage.g, stage);
        const s = sum(), k = painted.size;
        const score = scoreRun(s, k, p.optK);
        ctx.log('submit', { sum: s, k, optK: p.optK, score });
        resolve({
          score, max: 100,
          emoji: `${Math.abs(s / TARGET - 1) <= TOL ? '🎯' : '🟡'} ${k}/${p.optK} cells`,
          summary: `${core.fmtNum(s)} people · ${k} cells (optimal ${p.optK})`,
        });
      };
      const bar = ui.h('div', { class: 'ds-row', style: { gap: '10px', marginTop: '12px' } },
        ui.button('Submit', { variant: 'accent', onClick: () => { if (!painted.size) return ui.toast('Paint a few cells first'); bar.remove(); finish(); } }),
        ui.button('Clear', { variant: 'ghost', onClick: () => { painted.clear(); refresh(); } }));
      stage.el.after(bar);
      refresh();
      stage.start();
      if (ctx.autoplay) setTimeout(() => {
        for (const i of p.optIdx.slice(0, Math.max(1, p.optIdx.length))) painted.add(i);
        refresh(); bar.remove(); finish();
      }, 200);
    });

    const sorted = [...p.cells].sort((x, y) => y - x);
    const top5 = sorted.slice(0, 5).reduce((x, y) => x + y, 0);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mine = [...painted];
    const wasted = mine.filter((i) => !optSet.has(i));
    const missed = p.optIdx.filter((i) => !painted.has(i));
    const avg = (arr) => (arr.length ? arr.reduce((x, i) => x + p.cells[i], 0) / arr.length : 0);
    const s = sum(), dev = s / TARGET - 1;
    const yours = [];
    if (Math.abs(dev) > TOL) yours.push(`${(Math.abs(dev) * 100).toFixed(0)}% ${dev > 0 ? 'over' : 'under'} the target; outside ±5% costs accuracy`);
    if (!wasted.length && Math.abs(dev) <= TOL) yours.push('Matches the optimal answer exactly');
    else if (wasted.length) yours.push(`${wasted.length} ${wasted.length === 1 ? 'cell is' : 'cells are'} not in the optimal answer (avg ${core.fmtNum(Math.round(avg(wasted)))} people each); the ${missed.length} you missed averaged ${core.fmtNum(Math.round(avg(missed)))}`);
    result.detail = ui.kv([
      ['Place', `${p.country} · ${where} (${p.lat.toFixed(2)}°, ${p.lng.toFixed(2)}°)`],
      ['Smallest area', `${p.optK} cells ≈ ${(p.optK * p.km2).toFixed(0)} km², holding ${core.fmtNum(p.optSum)} people (the optimum stops at 950,000, since anything within ±5% counts as exact)`],
      ['Concentration', `Just ${(100 * p.optK / (N * N)).toFixed(1)}% of the window area holds ${(100 * p.optSum / p.total).toFixed(0)}% of its people. The 5 densest cells alone hold ${core.fmtNum(top5)} people, while the median cell has only ${core.fmtNum(median)}`],
      ['The rule', `Sort cells from densest to sparsest and add them up until you reach 1 million: that is the minimum area. The densest cell (${core.fmtNum(max)} people) equals ${median > 0 ? Math.round(max / median) : 'hundreds of'} median cells; for near-identical shades, hover to read the numbers and rank them.`],
      ['Yours', `${painted.size} cells · ${core.fmtNum(s)} people. ${yours.join('; ')}`],
    ]);
    return result;
  },
};
