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
    tagline: '在一张人口密度图上，用最小的面积涂出正好 100 万人。',
    category: 'levels',
    data: 'snapshot',
    howTo: [
      '每个小格是 1 km × 1 km，颜色越深人越多。点按或拖动来涂格子，再点一次取消。',
      '顶部实时显示你涂到的人数。目标是 100 万（±5% 都算准），同时让涂的格子尽量少。',
      '诀窍：人口是高度集中的——先涂最深的核心，别为了凑数去涂大片浅色的郊区。',
      '点按/鼠标悬停任意格可读出它的人数；颜色条给出色阶。提交后用绿框标出这片区域里“最省面积”的答案。',
    ],
    scoring: '分数 = 100 × (最优格数 ÷ 你的格数)² × 准确度；多涂 10% 的格子约扣 19 分；人数在 ±5% 内准确度为 1，之后线性下降，偏差 30% 归零。',
    sources: [
      { name: 'WorldPop Global 1 km Aggregated Population 2020', url: 'https://hub.worldpop.org/geodata/listing?id=64', note: 'data.worldpop.org/GIS/Population/Global_2000_2020_1km/2020/' },
      { name: 'GeoNames cities15000', url: 'https://download.geonames.org/export/dump/', note: '用于给 30 km 窗口命名' },
    ],
    dataNote: '每题是 WorldPop 2020 年 1 km 栅格上截取的 30×30 km 窗口（共 151 个窗口、82 个国家），窗口内总人口 160–800 万；格子面积随纬度略有差别（约 0.6–1 km²），按格数计分。这是 2020 年的建模估计，不是实时数据；地名取自 GeoNames 最近的城市。俄罗斯等少数国家的栅格下载失败，未收录。',
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
    const where = p.place ? `${p.place} 附近` : `${p.lat.toFixed(2)}°, ${p.lng.toFixed(2)}°`;
    ctx.log('puzzle', p.iso, where, 'total', p.total, 'optK', p.optK);

    const vTotal = ui.h('span', { class: 'mono' }, '0');
    const vCells = ui.h('span', { class: 'mono' }, '0');
    const vGap = ui.h('span', { class: 'mono' }, '');
    const vCell = ui.h('span', { class: 'mono' }, '点按或悬停一格，读出它的人数');
    const status = ui.h('div', { class: 'ds-grid', style: { '--min': '150px' } },
      ui.stat({ label: '已涂人数', value: vTotal, sub: vGap }),
      ui.stat({ label: '格数', value: vCells, sub: `目标 100 万 · ${p.km2.toFixed(2)} km²/格` }));
    const refresh = () => {
      const s = sum();
      vTotal.textContent = core.fmtNum(s);
      vCells.textContent = String(painted.size);
      const d = s - TARGET;
      vGap.textContent = !painted.size ? '距目标 —' : '距目标 ' + ( Math.abs(d) <= TARGET * TOL ? '命中 ✓' : (d > 0 ? '+' : '−') + core.fmtCompact(Math.abs(d)));
    };

    ctx.stage.append(ui.panel({ kicker: `${p.country} · ${where} · ${N}×${N} km`, title: '涂出 100 万人' }, status,
      ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, `这个窗口共有 ${core.fmtNum(p.total)} 人。颜色越深，一格里的人越多（平方根色阶）。`),
      ui.h('div', { class: 'ds-row', style: { gap: '8px', marginTop: '8px', alignItems: 'center' } },
        ui.h('span', { class: 'small muted mono' }, '0'),
        ui.h('div', { style: { flex: '1', maxWidth: '240px', height: '10px', borderRadius: '5px', border: '1px solid var(--rule)', background: 'linear-gradient(90deg, var(--paper2), var(--accent))' } }),
        ui.h('span', { class: 'small muted mono' }, `${core.fmtNum(max)} 人/格`)),
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
        if (i >= 0 && type !== 'up') vCell.textContent = `第 ${Math.floor(i / N) + 1} 行 · 第 ${(i % N) + 1} 列：${core.fmtNum(p.cells[i])} 人`;
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
          emoji: `${Math.abs(s / TARGET - 1) <= TOL ? '🎯' : '🟡'} ${k}/${p.optK} 格`,
          summary: `${core.fmtNum(s)} 人 · ${k} 格（最优 ${p.optK}）`,
        });
      };
      const bar = ui.h('div', { class: 'ds-row', style: { gap: '10px', marginTop: '12px' } },
        ui.button('提交', { variant: 'accent', onClick: () => { if (!painted.size) return ui.toast('先涂几格'); bar.remove(); finish(); } }),
        ui.button('清空', { variant: 'ghost', onClick: () => { painted.clear(); refresh(); } }));
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
    if (Math.abs(dev) > TOL) yours.push(`人数${dev > 0 ? '多' : '少'}了 ${(Math.abs(dev) * 100).toFixed(0)}%，超出 ±5% 要扣准确度`);
    if (!wasted.length && Math.abs(dev) <= TOL) yours.push('和最优解完全重合');
    else if (wasted.length) yours.push(`有 ${wasted.length} 格不在最优解里，平均每格 ${core.fmtNum(Math.round(avg(wasted)))} 人；漏掉的 ${missed.length} 格平均 ${core.fmtNum(Math.round(avg(missed)))} 人`);
    result.detail = ui.kv([
      ['地点', `${p.country} · ${where}（${p.lat.toFixed(2)}°, ${p.lng.toFixed(2)}°）`],
      ['最省面积', `${p.optK} 格 ≈ ${(p.optK * p.km2).toFixed(0)} km²，装下 ${core.fmtNum(p.optSum)} 人（最优解数到 95 万就算够，因为 ±5% 内都算准）`],
      ['集中度', `只用窗口 ${(100 * p.optK / (N * N)).toFixed(1)}% 的面积就装下了窗口内 ${(100 * p.optSum / p.total).toFixed(0)}% 的人；最密的 5 格就有 ${core.fmtNum(top5)} 人，而窗口中位数格只有 ${core.fmtNum(median)} 人`],
      ['规律', `人口按密度从高到低排序后累加，数到 100 万就停——这就是最小面积。最深的一格（${core.fmtNum(max)} 人）抵得上中位数格的 ${median > 0 ? Math.round(max / median) : '数百'} 倍；颜色相近的格子要靠悬停读数来排先后。`],
      ['你的', `${painted.size} 格 · ${core.fmtNum(s)} 人。${yours.join('；')}`],
    ]);
    return result;
  },
};
