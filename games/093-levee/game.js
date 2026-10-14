// #93 Levee — rain on real terrain; place three levees to keep as many real buildings dry as possible.
import { N, LEN, WET, leveeCells, simulate, dryCount, total, scoreOf } from './sim.js';

export default {
  meta: {
    num: 93,
    slug: 'levee',
    title: 'Levee',
    tagline: '暴雨落在一块真实的地形上。放三道堤坝，让尽可能多的真实建筑保持干燥。',
    category: 'levels',
    data: 'snapshot',
    howTo: [
      '地图是美国某个易涝城镇 1.6 km × 1.6 km 的真实地形（底色明暗随高程变化，低洼处雨水会聚集）；小方块是 OpenStreetMap 里的真实建筑。',
      '雨水落在每一格上，沿着低处流动、汇集。蓝色是当前方案下的积水，红色方块是被淹的建筑。',
      '点一格放一道 500 m 长的堤坝（先用按钮选横向或纵向），最多三道；点已有的堤坝可以移除。画面会实时重新模拟。',
      '确认后与算法参考解比较：你比"什么都不放"多保住的建筑，占参考解多保住数量的百分比就是得分（可超过参考解，满分 100）。',
    ],
    scoring: '100 × (你保住 − 不设堤坝) ÷ (参考解保住 − 不设堤坝)，限制在 0–100。',
    sources: [
      { name: 'AWS Terrain Tiles (Terrarium)', url: 'https://registry.opendata.aws/terrain-tiles/', note: '美国境内高程来自 USGS 3DEP 10 m 数据，夏威夷等地区来自其他 DEM' },
      { name: 'OpenStreetMap buildings via Overpass API', url: 'https://overpass-api.de/' },
    ],
    dataNote: '水流是一个简化的浅水模型（每格 100 m，雨水均匀落下后按水位差向低处流动，边界外泄），不是水文工程模拟；"暴雨量"是为每块地形选定的相对雨量，使不设堤坝时约一半建筑被淹。参考解由贪心搜索离线计算，玩家完全可能超过它。',
  },

  puzzle({ data, pick }) {
    const s = pick(data.sites);
    return { name: s.name, lat: s.lat, lng: s.lng, rain: s.rain, z: s.z, b: s.b, ref: s.ref };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const log = ctx.log.scope('levee');
    const nb = total(p.b);
    const base = dryCount(p.b, simulate(p.z, p.rain));
    const refDry = dryCount(p.b, simulate(p.z, p.rain, p.ref));
    log('start', p.name, { buildings: nb, base, refDry, rain: p.rain });
    const zmax = Math.max(...p.z, 1);

    let levees = [];
    let orient = 'h';
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
      onFrame(dt, g, st) {
        const cs = st.w / N;
        g.clearRect(0, 0, st.w, st.h);
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const i = r * N + c;
          g.fillStyle = st.colors.paper2; g.fillRect(c * cs, r * cs, cs + 0.5, cs + 0.5);
          g.globalAlpha = 0.08 + 0.5 * (p.z[i] / zmax); g.fillStyle = st.colors.muted; g.fillRect(c * cs, r * cs, cs + 0.5, cs + 0.5);
          g.globalAlpha = 1;
          if (depth[i] > 0.05) { g.globalAlpha = Math.min(0.85, 0.2 + depth[i] * 0.5); g.fillStyle = '#2f7fd8'; g.fillRect(c * cs, r * cs, cs + 0.5, cs + 0.5); g.globalAlpha = 1; }
        }
        for (let i = 0; i < N * N; i++) {
          if (!p.b[i]) continue;
          const sz = Math.min(cs * 0.8, cs * (0.25 + 0.15 * Math.log2(1 + p.b[i])));
          const x = (i % N) * cs + (cs - sz) / 2, y = Math.floor(i / N) * cs + (cs - sz) / 2;
          g.fillStyle = depth[i] >= WET ? st.colors.bad : st.colors.ink;
          g.fillRect(x, y, sz, sz);
        }
        if (revealed) {
          g.setLineDash([4, 3]); g.strokeStyle = st.colors.hit; g.lineWidth = 3;
          for (const lv of p.ref) {
            const cells = leveeCells(lv); const a = cells[0], z2 = cells[cells.length - 1];
            g.beginPath(); g.moveTo((a % N + 0.5) * cs, (Math.floor(a / N) + 0.5) * cs + 6); g.lineTo((z2 % N + 0.5) * cs, (Math.floor(z2 / N) + 0.5) * cs + 6); g.stroke();
          }
          g.setLineDash([]);
        }
        g.lineCap = 'round';
        for (const [col, wd] of [[st.colors.ink, 9], [st.colors.near, 5]]) {
          g.strokeStyle = col; g.lineWidth = wd;
          for (const lv of levees) {
            const cells = leveeCells(lv); const a = cells[0], z2 = cells[cells.length - 1];
            g.beginPath(); g.moveTo((a % N + 0.5) * cs, (Math.floor(a / N) + 0.5) * cs); g.lineTo((z2 % N + 0.5) * cs, (Math.floor(z2 / N) + 0.5) * cs); g.stroke();
          }
        }
      },
      onPointer(type, pt, st) {
        if (type !== 'down' || revealed) return;
        const cs = st.w / N;
        const c = Math.min(N - 1, Math.max(0, Math.floor(pt.x / cs))), r = Math.min(N - 1, Math.max(0, Math.floor(pt.y / cs)));
        const hit = levees.findIndex((lv) => leveeCells(lv).includes(r * N + c));
        if (hit >= 0) { levees.splice(hit, 1); log('remove', r, c); }
        else if (levees.length >= 3) { ui.toast('最多三道堤坝，点已有的堤坝可移除'); return; }
        else { levees.push({ r, c, o: orient }); log('place', { r, c, o: orient }); }
        refresh(); updateStatus();
      },
    });

    const bh = ui.button('横向 ━', { variant: 'accent', small: true, onClick: () => setO('h') });
    const bv = ui.button('纵向 ┃', { variant: 'ghost', small: true, onClick: () => setO('v') });
    function setO(o) {
      orient = o;
      bh.className = bh.className.replace(/\b(accent|ghost)\b/g, '') + (o === 'h' ? ' accent' : ' ghost');
      bv.className = bv.className.replace(/\b(accent|ghost)\b/g, '') + (o === 'v' ? ' accent' : ' ghost');
    }

    return new Promise((resolve) => {
      const finish = () => {
        const got = dryCount(p.b, depth);
        const score = scoreOf(base, refDry, got);
        revealed = true;
        log('submit', { got, base, refDry, score });
        resolve({
          score, max: 100, win: score >= 60,
          emoji: `🌧️ ${'🛡️'.repeat(levees.length)}\n保住 ${got}/${nb}`,
          summary: `保住 ${got}/${nb} 栋 · 参考 ${refDry}`,
          detail: ui.kv([
            ['地点', `${p.name}（${p.lat.toFixed(3)}°, ${p.lng.toFixed(3)}°）`],
            ['不设堤坝', `保住 ${base}/${nb} 栋`],
            ['你的方案', `保住 ${got} 栋（${got - base >= 0 ? '+' : ''}${got - base}）`],
            ['参考解', `保住 ${refDry} 栋（绿色虚线）：堤坝应该堵在汇水的低洼出口，而不是围住建筑本身`],
            ['规律', '水从高处流向低处并在洼地聚集；一道堤坝的价值取决于它切断了多大的汇水面积。'],
          ]),
        });
      };
      const done = ui.button('确认方案', { variant: 'accent', onClick: finish });
      const clear = ui.button('清空', { variant: 'ghost', small: true, onClick: () => { levees = []; refresh(); updateStatus(); } });
      ctx.stage.append(ui.panel(
        { kicker: `${p.name} · 1.6 km × 1.6 km · 每道堤坝 ${LEN * 100} m`, title: '放三道堤坝' },
        stage.el, status,
        ui.h('div', { class: 'small muted', style: { marginTop: '4px' } }, '蓝 = 积水 · 红块 = 被淹建筑 · 黄条 = 你的堤坝'),
        ui.h('div', { class: 'ds-row', style: { marginTop: '12px', gap: '10px', flexWrap: 'wrap' } }, bh, bv, clear, done)));
      updateStatus();
      stage.start();
      if (ctx.autoplay) setTimeout(() => { levees = p.ref.slice(); refresh(); updateStatus(); finish(); }, 100);
    });
  },
};
