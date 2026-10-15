// #93 Levee — rain on real terrain; place three levees to keep as many real buildings dry as possible.
import { N, LEN, WET, leveeCells, simulate, dryCount, cellCounts, scoreOf, marginals } from './sim.js';

const COMPASS = (r, c) => {
  const v = r < 5.33 ? '北' : r < 10.67 ? '中' : '南';
  const h = c < 5.33 ? '西' : c < 10.67 ? '中' : '东';
  return v === '中' && h === '中' ? '中心' : v === '中' ? `${h}侧` : h === '中' ? `${v}侧` : `${v}${h}角`;
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
    tagline: '暴雨落在一块真实的地形上。放三道堤坝，让尽可能多的真实建筑保持干燥。',
    category: 'levels',
    data: 'snapshot',
    howTo: [
      '地图是美国某个易涝城镇 1.6 km × 1.6 km 的真实地形（底色越亮地势越高，暗处是低洼）；每个小方块是 OpenStreetMap 里的一栋真实建筑，位置就是它的真实位置。',
      '雨水落在每一格上，沿着低处流动、汇集。蓝色是当前方案下的积水，红色方块是被淹的建筑，米白色是干燥的。',
      '点一格放一道 500 m 长的堤坝（先用按钮选横向或纵向），最多三道；点已有的堤坝可以移除，画面会实时重新模拟。',
      '确认后与算法参考解比较：你比"什么都不放"多保住的建筑，占参考解多保住数量的百分比就是得分（可超过参考解，满分 100）。',
    ],
    scoring: '100 × (你保住 − 不设堤坝) ÷ (参考解保住 − 不设堤坝)，限制在 0–100；随手乱放通常只有 10 分上下。',
    sources: [
      { name: 'AWS Terrain Tiles (Terrarium)', url: 'https://registry.opendata.aws/terrain-tiles/', note: '美国境内高程来自 USGS 3DEP 10 m 数据，夏威夷等地区来自其他 DEM' },
      { name: 'OpenStreetMap buildings via Overpass API', url: 'https://overpass-api.de/' },
    ],
    dataNote: '高程与建筑位置都是真实数据（建筑取 OSM 轮廓的中心点，一点一栋）。水流是自己写的简化浅水模型（每格 100 m，雨水均匀落下后按水位差向低处流动，边界外泄，堤坝视为不可越过的墙），不是 USGS 水文工程模拟；"暴雨量"是为每块地形选定的相对雨量，使不设堤坝时约一半建筑被淹，并不对应真实降雨毫米数。参考解由贪心搜索加局部调整离线算出，不一定是全局最优，玩家完全可能超过它。',
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
        ui.h('span', `保住 ${dry}/${nb}`),
        ui.h('span', { class: 'muted' }, `不设堤坝 ${base}`),
        ui.h('span', `堤坝 ${levees.length}/3`));
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
        else if (levees.length >= 3) { ui.toast('最多三道堤坝，点已有的堤坝可移除'); return; }
        else { levees.push({ r, c, o: orient }); log('place', { r, c, o: orient }); }
        refresh(); updateStatus();
      },
    });
    stage.el.setAttribute('role', 'img');
    stage.el.setAttribute('aria-label', '地形与建筑平面图，点击放置堤坝');

    const bh = ui.button('横向 ━', { variant: 'accent', small: true, onClick: () => setO('h') });
    const bv = ui.button('纵向 ┃', { variant: 'ghost', small: true, onClick: () => setO('v') });
    function setO(o) {
      orient = o;
      bh.className = bh.className.replace(/\b(accent|ghost)\b/g, '') + (o === 'h' ? ' accent' : ' ghost');
      bv.className = bv.className.replace(/\b(accent|ghost)\b/g, '') + (o === 'v' ? ' accent' : ' ghost');
    }

    const describe = (lv) => { const [r, c] = leveeMid(lv); return `${COMPASS(r, c)}${lv.o === 'h' ? '东西向' : '南北向'}`; };

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
        ctx.stage.append(ui.panel({ kicker: '参考解', title: `算法的三道堤坝：保住 ${refDry}/${nb} 栋` }, refStage.el,
          ui.h('div', { class: 'small muted', style: { marginTop: '6px' } }, '绿色 = 参考解的堤坝；同样的雨，同样的地形。')));
        refStage.start();
        const share = refDry > base ? Math.round((100 * refM.reduce((a, x) => a + Math.max(0, x), 0)) / (refDry - base)) : 0;
        resolve({
          score, max: 100, win: score >= 60,
          emoji: `🌧️ ${'🛡️'.repeat(levees.length)}\n保住 ${got}/${nb}`,
          summary: `保住 ${got}/${nb} 栋 · 参考 ${refDry}`,
          detail: ui.kv([
            ['地点', `${p.name}（${p.lat.toFixed(3)}°, ${p.lng.toFixed(3)}°），窗口内最大高差 ${relief.toFixed(0)} m，共 ${nb} 栋建筑`],
            ['不设堤坝', `保住 ${base}/${nb} 栋`],
            ['你的方案', levees.length
              ? `保住 ${got} 栋（${got - base >= 0 ? '+' : ''}${got - base}）；各堤坝单独贡献：${levees.map((lv, i) => `${describe(lv)} ${mine[i] >= 0 ? '+' : ''}${mine[i]}`).join('、')}`
              : `没放堤坝，保住 ${got} 栋`],
            ['参考解', `保住 ${refDry} 栋（${refDry - base >= 0 ? '+' : ''}${refDry - base}）：${p.ref.map((lv, i) => `${describe(lv)} ${refM[i] >= 0 ? '+' : ''}${refM[i]}`).join('、')}`],
            ['规律', `水从高处流向低处，在洼地聚集；堤坝的价值取决于它切断了多大的汇水面积和流向建筑的路径。本题最好的一道堤坝挡在${describe(p.ref[refM.indexOf(Math.max(...refM))])}，单独保住 ${Math.max(...refM)} 栋${share > 105 ? '（三道之间有叠加效果）' : ''}；堵低洼出口比围住建筑本身更有效。`],
          ]),
        });
      };
      const done = ui.button('确认方案', { variant: 'accent', onClick: finish });
      const clear = ui.button('清空', { variant: 'ghost', small: true, onClick: () => { levees = []; refresh(); updateStatus(); } });
      ctx.stage.append(ui.panel(
        { kicker: `${p.name} · 1.6 × 1.6 km · 高差 ${relief.toFixed(0)} m`, title: '放三道堤坝' },
        stage.el, status,
        ui.h('div', { class: 'small muted', style: { marginTop: '4px' } }, `底色越亮地势越高 · 蓝 = 积水 · 红点 = 被淹建筑 · 黄条 = 你的堤坝（每道 ${LEN * 100} m）`),
        ui.h('div', { class: 'ds-row', style: { marginTop: '12px', gap: '10px', flexWrap: 'wrap' } }, bh, bv, clear, done)));
      updateStatus();
      stage.start();
      if (ctx.autoplay) setTimeout(() => { levees = p.ref.slice(); refresh(); updateStatus(); finish(); }, 100);
    });
  },
};
