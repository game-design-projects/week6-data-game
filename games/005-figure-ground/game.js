// #5 Figure-Ground — a 1 km² street network, white on black, no labels. Which city?
// Street grids carry history: Roman/Hippodamian orthogonal grids, medieval tangles,
// Haussmann stars, American superblocks, planned capitals, informal settlements.

/** Decode delta-encoded ways [cls, x0, y0, dx, dy, …] into absolute polylines. */
export function decode(ways) {
  return ways.map((w) => {
    const pts = [[w[1], w[2]]];
    for (let i = 3; i < w.length; i += 2) pts.push([pts.at(-1)[0] + w[i], pts.at(-1)[1] + w[i + 1]]);
    return { cls: w[0], pts };
  });
}

/** Street-pattern stats: total length (km), grid-ness (share of length within 10° of the dominant axis pair), axis bearing. */
export function stats(ways) {
  const bins = new Array(90).fill(0);
  let total = 0;
  for (const { pts } of decode(ways)) {
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
      const len = Math.hypot(dx, dy); if (!len) continue;
      total += len;
      const a = ((Math.atan2(-dy, dx) * 180 / Math.PI) % 90 + 90) % 90; // compass-ish angle mod 90
      bins[Math.floor(a) % 90] += len;
    }
  }
  let best = 0, bestV = -1;
  for (let c = 0; c < 90; c++) { let s = 0; for (let d = -10; d <= 10; d++) s += bins[(c + d + 90) % 90]; if (s > bestV) { bestV = s; best = c; } }
  return { km: total / 1000, grid: total ? bestV / total : 0, axis: best };
}

const TEMPS = [[300, '🔥 滚烫'], [1000, '♨️ 很热'], [2500, '🌡️ 温热'], [5000, '🌤️ 微凉'], [9000, '❄️ 很冷']];
export const temp = (km) => (TEMPS.find(([lim]) => km < lim) ?? [0, '🧊 冰冷'])[1];

export default {
  meta: {
    num: 5,
    slug: 'figure-ground',
    title: 'Figure-Ground',
    tagline: '一平方公里的街道，黑底白线，没有任何文字。凭街网的肌理，猜出这是哪座城市。',
    category: 'geo',
    data: 'snapshot',
    howTo: [
      '黑底上的白线是某座城市市中心 1 km × 1 km 范围内的全部道路，上北下南，粗线是干道，细线是小街小巷。',
      '读肌理：整齐的方格网像美国或殖民城市，放射环路像欧洲古都，蜿蜒细密的窄巷像老城或山城，巨大的街区像规划新城。',
      '在世界地图上点出你的答案，一共 4 次机会，每次提交后只告诉你「冷热」和距离，不告诉方向。',
      '越早命中分数越高：用的次数越少、最终离得越近越好。',
    ],
    scoring: '以最后一次猜测的距离计：100 × e^(−距离/2500 km)，每多用一次机会扣 10%。',
    sources: [
      { name: 'OpenStreetMap（Overpass API）', url: 'https://overpass-api.de/', note: '各城市中心 1 km² 内的 highway 线要素，© OpenStreetMap contributors，ODbL' },
    ],
    dataNote: '数据是对 OpenStreetMap 的一次快照（构建脚本见 build/），道路已按 2–4 m 容差简化。中心点取自各城市的市中心坐标，答案即这个中心点。',
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

    const canvas = ui.h('canvas', { style: { width: '100%', aspectRatio: '1', display: 'block', background: '#000', borderRadius: '8px', maxWidth: '560px', margin: '0 auto' } });
    const scale = ui.h('div', { class: 'ds-row small mono muted', style: { justifyContent: 'center', marginTop: '8px' } }, '底部白条 = 200 m　·　全图 1 km × 1 km　·　上为北');
    ctx.stage.append(ui.panel({ kicker: '线索', title: '这是哪座城市的 1 km²？' }, canvas, scale));

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
      answer: { lat: c.lat, lng: c.lng, label: `${c.name}，${c.country}` },
      view: { center: [28, 10], zoom: 2 },
      scale: 2500,
      attempts: 4,
      title: '点出它在哪',
      hint: (km) => `${temp(km)} · 离答案 ${core.fmtKm(km)}`,
    });
    ro?.disconnect();

    const style = st.grid > 0.6 ? '高度方格化：一套近乎垂直的街道网，多半是规划出来的格网城区'
      : st.grid > 0.4 ? '半规整：主要街道成网格，但夹着斜街或不规则街区'
        : '不规则：街道朝向各异，多半是自然生长的老城或放射、曲线式布局';
    res.detail = ui.panel({ plain: true }, ui.kv([
      ['答案', `${c.name}，${c.country}（${c.lat.toFixed(3)}°, ${c.lng.toFixed(3)}°）`],
      ['道路总长', `${st.km.toFixed(1)} km（${c.ways.length} 段）`],
      ['格网度', `${Math.round(st.grid * 100)}%（主轴约 ${st.axis}°）`],
      ['怎么读', style],
      ['线索', '先看街区大小和朝向是否统一，再看有没有斜向干道、环路和断头小巷：这些是不同时代、不同规划传统留下的指纹。'],
    ]));
    return res;
  },
};
