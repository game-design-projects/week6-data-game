// #92 Storm Run — fly a courier through a real NEXRAD radar snapshot; cost = how hard the weather hits you.
import { solve, pathCost, routeScore, decodeGrid, line } from './route.js';
import { decodePNG, toPuzzle, pickBest, livePath, TIERS, W, H } from './shape.js';

export const LIVE_HOURS = ['18', '21', '23']; // UTC hours of the previous day tried for a live storm window

// radar level (dBZ/5) → colour, roughly the NWS reflectivity ramp
const RAMP = ['', '#9fe3ee', '#9fe3ee', '#6cc7f0', '#58c85a', '#2f9f3a', '#f2e04a', '#e8b82e', '#f39a2c', '#e8601c', '#d62a1f', '#b3151b', '#e43fc7', '#e43fc7', '#8a4bc0', '#8a4bc0'];
const LEGEND = [['<20 dBZ 晴/小雨', 1, '#9fe3ee'], ['20–30 中雨', 1.5, '#58c85a'], ['30–40 强降水', 3, '#f2e04a'], ['40–50 雷暴', 8, '#f39a2c'], ['≥50 核心/冰雹', 25, '#d62a1f']];

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
    tagline: '穿过真实的雷达回波去送快递：在昨天的美国天气雷达图上，画出最省"风险"的航线。',
    category: 'levels',
    data: 'live',
    howTo: [
      '地图是美国某片区域真实的 NEXRAD 雷达回波（有州界做参照）。从左边的"起"出发，一路送到右边的"终"。',
      '在图上按住并拖动，路线会一格一格跟着你的手指；往回拖可以撤销。到达"终"后点"送达"。',
      '每一格的代价取决于雷达强度：<20 dBZ 晴/小雨 1，20–30 中雨 1.5，30–40 强降水 3，40–50 雷暴 8，≥50 强核心 25。斜着走多算 √2 倍。',
      '绕远还是硬穿？你的代价和最优航线（Dijkstra 算出）相比，越接近得分越高；揭晓后会在图上画出最优航线。',
    ],
    scoring: '100 × (最优代价 ÷ 你的代价)^1.5：多付 10% 约 87 分，多付 20% 约 76 分，多付一倍约 35 分，直飞通常不到 40 分。',
    sources: [
      { name: 'Iowa Environmental Mesonet — NEXRAD N0R 全美雷达合成图存档', url: 'https://mesonet.agron.iastate.edu/docs/nexrad_composites/', note: '每 5 分钟一张，0.01° 网格；游戏在浏览器里直接下载并降采样为 0.25° 格' },
      { name: '雷达图文件目录（示例月份）', url: 'https://mesonet.agron.iastate.edu/archive/data/2025/06/', note: '路径 /YYYY/MM/DD/GIS/uscomp/n0r_YYYYMMDDHH00.png' },
      { name: 'NOAA MRMS（灵感来源）', url: 'https://www.nssl.noaa.gov/projects/mrms/' },
      { name: 'us-atlas 州界', url: 'https://github.com/topojson/us-atlas', note: '仅用于底图轮廓' },
    ],
    dataNote: '想法里的 NOAA MRMS 是 GRIB2 大文件、没有带 CORS 的公开接口，浏览器读不了，所以改用 IEM 存档的 NEXRAD 全美合成雷达图（2021 年起为 IEM 由 N0Q 合成的 N0R，5 dBZ 一级，CORS 开放）。每天的题目取"前一天 UTC"当天 18、21、23 时三张图，在里面搜出对流最合适的 9°×6° 窗口（每格取 0.25° 内 88 分位反射率），起终点定在左右两侧晴空格、且直飞代价至少是最优的 1.5–1.8 倍。若前一天全美几乎没有雷暴、或下载失败，则改用内置的 2022–2023 年 80 个历史强对流日快照（页面上会标"快照"）。',
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
    const title = p.live ? (ctx.date === ctx.today ? '昨天的雷达图' : '前一天的雷达图') : '一张历史雷达图';
    const kicker = p.live ? `${p.date} ${p.utc} UTC · 实时抓取的真实雷达` : `${p.date} ${p.utc} UTC · 真实雷达（历史快照）`;
    ctx.stage.append(ui.panel({ kicker, title },
      ui.h('div', { class: 'small ink2' }, `窗口 ${p.lat0.toFixed(1)}°N–${lat1.toFixed(1)}°N，${Math.abs(p.lon0).toFixed(1)}°W–${Math.abs(lon1).toFixed(1)}°W${p.live ? '' : '（前一天没有合适的雷暴，改用历史日）'}。直飞要付 ${core.fmtNum(Math.round(direct))}，你能压到多低？`),
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
        ui.h('span', {}, '当前代价 ', costEl), refEl));
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
            g.fillStyle = t === '起' ? st.colors.paper : '#fff'; g.font = `700 ${cw * 1.2}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText(t, mx, my + cw * 0.06);
          };
          const head = path[path.length - 1];
          g.fillStyle = st.colors.accent; g.beginPath(); g.arc((head[0] + 0.5) * cw, (head[1] + 0.5) * ch, cw * 0.55, 0, 7); g.fill();
          mark(p.start, '起', st.colors.ink); mark(p.end, '终', st.colors.accent);
          const c = cost();
          if (!hudDone || hudKey !== c) { // update the readout only when the cost changed
            hudDone = true; hudKey = c;
            costEl.textContent = c.toFixed(1);
            refEl.textContent = revealed ? `最优 ${opt.cost.toFixed(1)}` : `直飞 ${direct.toFixed(0)}`;
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
          ? `这张图 ${wetPct}% 的格子有回波，直线要穿过 ${dirCross} 格 ≥40 dBZ 的雷暴，代价 ${direct.toFixed(0)}。最优航线向${bulge < 0 ? '北' : '南'}最多绕出 ${Math.abs(Math.round(bulge))} 格（约 ${bulgeKm} km），航程从 ${directKm} km 增到 ${optKm} km，${optCross < dirCross ? `却只穿过 ${optCross} 格雷暴` : `穿过的雷暴仍有 ${optCross} 格，但都是边缘`}，代价降到 ${opt.cost.toFixed(1)}（省 ${saving}%）：多飞一段晴空，比直切 ×8 / ×25 的强回波便宜得多。`
          : `这张图 ${wetPct}% 的格子有回波，但起终点之间的最优线几乎就是直线（最大偏离 ${Math.abs(Math.round(bulge))} 格）：它没有硬闯，而是贴着 ×1 的晴空格和 ×1.5 的小雨格走，直线代价 ${direct.toFixed(0)} 之所以更贵，是因为它多踩了${dirCross > optCross ? ` ${dirCross - optCross} 格雷暴` : '一些中到强的雨区'}。`;
        const gap = mine / opt.cost;
        const verdict = gap < 1.005 ? '和最优航线一样好。' : `比最优多付 ${Math.round((gap - 1) * 100)}%` + (crossings > optCross ? `，多穿了 ${crossings - optCross} 格雷暴核心——这是最大的失分点。` : '，主要是多走了不必要的雨区或多绕了路。');
        const emoji = `⛈️ Storm Run №${ctx.day}\n${'🟩'.repeat(Math.round(score / 20))}${'⬜'.repeat(5 - Math.round(score / 20))} ${score}`;
        optAnim = 0; // keep the frame loop running so a resize never leaves the canvas blank
        ctx.log('storm-run result', mine.toFixed(1), opt.cost.toFixed(1), score);
        resolve({
          score, max: 100, win: score >= 70, emoji,
          summary: `代价 ${mine.toFixed(1)}（最优 ${opt.cost.toFixed(1)}）`,
          detail: ui.kv([
            ['你的航线', `${path.length - 1} 步（约 ${myKm} km），代价 ${mine.toFixed(1)}，穿过 ${crossings} 格 ≥40 dBZ 雷暴。${verdict}`],
            ['最优航线', `${opt.path.length - 1} 步（约 ${optKm} km），代价 ${opt.cost.toFixed(1)}，穿过 ${optCross} 格雷暴（图上虚线）`],
            ['直飞', `约 ${directKm} km，代价 ${direct.toFixed(1)}，穿过 ${dirCross} 格雷暴`],
            ['为什么', why],
            ['数据', p.live ? `IEM NEXRAD N0R 合成雷达，${p.date} ${p.utc} UTC（前一天，浏览器实时抓取）` : `IEM NEXRAD N0R 合成雷达存档，${p.date} ${p.utc} UTC（历史快照）`],
          ]),
        });
      };
      doneBtn = ui.button('送达', { variant: 'accent', onClick: () => { if (atEnd() && !revealed) finishRun(cost()); } });
      doneBtn.disabled = true;
      const reset = ui.button('重来', { variant: 'ghost', onClick: () => { if (!revealed) { path = [p.start]; refresh(); } } });
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
