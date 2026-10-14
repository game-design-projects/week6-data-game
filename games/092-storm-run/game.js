// #92 Storm Run — fly a courier through a real NEXRAD radar snapshot; cost = how hard the weather hits you.
import { hazard, solve, pathCost, routeScore, decodeGrid } from './route.js';

// radar level (dBZ/5) → colour, roughly the NWS reflectivity ramp
const RAMP = ['', '#9fe3ee', '#9fe3ee', '#6cc7f0', '#58c85a', '#2f9f3a', '#f2e04a', '#e8b82e', '#f39a2c', '#e8601c', '#d62a1f', '#b3151b', '#e43fc7', '#e43fc7', '#8a4bc0', '#8a4bc0'];
const LEGEND = [['≤15 dBZ 晴/小雨', 1, '#9fe3ee'], ['20–25 中雨', 1.5, '#58c85a'], ['30–35 强降水', 3, '#f2e04a'], ['40–45 雷暴', 8, '#f39a2c'], ['≥50 核心/冰雹', 25, '#d62a1f']];

export default {
  meta: {
    num: 92,
    slug: 'storm-run',
    title: 'Storm Run',
    tagline: '穿过真实的雷达回波去送快递：在一张真实的美国天气雷达图上画出最省"风险"的航线。',
    category: 'levels',
    data: 'snapshot',
    howTo: [
      '地图是某一天某一时刻的真实美国雷达回波。从左边的"起"出发，一路送到右边的"终"。',
      '在图上按住并拖动，路线会一格一格跟着你的手指；往回拖可以撤销。到达"终"后点"送达"。',
      '每一格的代价取决于雷达强度：晴空 1，中雨 1.5，强降水 3，雷暴 8，强核心 25。斜着走多算 √2 倍。',
      '绕远还是硬穿？你的代价和最优航线（Dijkstra 算出）相比，越接近得分越高。',
    ],
    scoring: '100 × (最优代价 ÷ 你的代价)^1.5。',
    sources: [
      { name: 'Iowa Environmental Mesonet — NEXRAD N0R 全美雷达合成图存档', url: 'https://mesonet.agron.iastate.edu/archive/data/', note: '由 NOAA/NWS NEXRAD 雷达合成，0.01° 网格，本游戏降采样为 0.25° 格' },
      { name: 'NOAA MRMS（灵感来源）', url: 'https://www.nssl.noaa.gov/projects/mrms/' },
    ],
    dataNote: 'NOAA MRMS 原始数据是 GRIB2 大文件，这里改用 IEM 存档的同源 NEXRAD 全美合成雷达图（0.01°，每 5 dBZ 一级）。每题截取 9°×6° 窗口，每格取 0.25° 内 88 分位反射率。非实时，使用 2022–2025 年的历史强对流日。',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
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
    ctx.stage.append(ui.panel({ kicker: `${p.date} · ${p.utc} UTC · 真实雷达`, title: '今天的雷达图' },
      ui.h('div', { class: 'small ink2' }, `窗口 ${p.lat0.toFixed(1)}°N–${lat1.toFixed(1)}°N，${Math.abs(p.lon0).toFixed(1)}°W–${Math.abs(lon1).toFixed(1)}°W。直飞要付 ${core.fmtNum(Math.round(direct))}，你能压到多低？`),
      ui.h('div', { class: 'ds-row small', style: { gap: '10px', marginTop: '10px', flexWrap: 'wrap' } },
        ...LEGEND.map(([t, c, col]) => ui.h('span', {}, ui.h('span', { style: { color: col } }, '■'), ` ${t} ×${c}`)))));

    let path = [p.start];
    let revealed = false;
    let dragging = false;
    let optAnim = 0;
    const cost = () => pathCost(grid, w, path);
    const atEnd = () => path[path.length - 1][0] === p.end[0] && path[path.length - 1][1] === p.end[1];

    const finish = ctx.autoplay ? null : null;
    return await new Promise((resolve) => {
      let doneBtn;
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
            g.fillStyle = t === '起' ? st.colors.paper : '#fff'; g.font = `700 ${cw * 1.2}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(t, mx, my + cw * 0.06);
          };
          mark(p.start, '起', st.colors.ink); mark(p.end, '终', st.colors.accent);
          const head = path[path.length - 1];
          g.fillStyle = st.colors.accent; g.beginPath(); g.arc((head[0] + 0.5) * cw, (head[1] + 0.5) * ch, cw * 0.55, 0, 7); g.fill();
          st.hud.textContent = '';
          st.hud.append(ui.h('span', `代价 ${cost().toFixed(1)}`), ui.h('span', revealed ? `最优 ${opt.cost.toFixed(1)}` : `直飞 ${direct.toFixed(0)}`));
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
        revealed = true;
        const score = routeScore(opt.cost, mine);
        const detourKm = Math.round((path.length - 1) * p.cell * 111);
        const crossings = path.filter(([x, y]) => grid[y * w + x] >= 8).length;
        const optCross = opt.path.filter(([x, y]) => grid[y * w + x] >= 8).length;
        const emoji = `⛈️ Storm Run №${ctx.day}\n${'🟩'.repeat(Math.round(score / 20))}${'⬜'.repeat(5 - Math.round(score / 20))} ${score}`;
        if (ctx.autoplay) { s.stop(); } else { optAnim = 0; s.start(); setTimeout(() => s.stop(), 1500); }
        ctx.log('storm-run result', mine.toFixed(1), opt.cost.toFixed(1), score);
        resolve({
          score, max: 100, win: score >= 70, emoji,
          summary: `代价 ${mine.toFixed(1)}（最优 ${opt.cost.toFixed(1)}）`,
          detail: ui.kv([
            ['你的航线', `${path.length - 1} 步，代价 ${mine.toFixed(1)}，穿过 ${crossings} 格雷暴核心`],
            ['最优航线', `${opt.path.length - 1} 步，代价 ${opt.cost.toFixed(1)}，穿过 ${optCross} 格雷暴核心（图上虚线）`],
            ['直飞', `代价 ${direct.toFixed(1)}`],
            ['为什么', optCross < crossings ? '最优路线利用回波之间的缝隙绕行：多走几格晴空远比穿过 40 dBZ 以上的雷暴便宜。' : '这张图里雷暴核心挡不住去路，窗口里最便宜的做法就是少绕路、避开成片强回波。'],
            ['数据', `IEM 存档的 NEXRAD 合成雷达图，${p.date} ${p.utc} UTC，约 ${detourKm} km 航程`],
          ]),
        });
      };
      doneBtn = ui.button('送达', { variant: 'accent', onClick: () => { if (atEnd() && !revealed) finishRun(cost()); } });
      doneBtn.disabled = true;
      const reset = ui.button('重来', { variant: 'ghost', onClick: () => { if (!revealed) { path = [p.start]; refresh(); } } });
      ctx.stage.append(ui.h('div', { class: 'ds-row', style: { gap: '10px', marginTop: '12px' } }, doneBtn, reset));
      s.start();
      if (ctx.autoplay) {
        // bot: fly the optimal route, with a small detour so the score is realistic
        path = opt.path.slice();
        setTimeout(() => finishRun(pathCost(grid, w, path)), 100);
      }
    });
  },
};
