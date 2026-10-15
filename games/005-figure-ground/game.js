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
  if (b <= 3 || b >= 87) return '几乎正南北、正东西';
  return b <= 45 ? `北偏东约 ${b}°` : `北偏西约 ${90 - b}°`;
}

/** Final score of the pin preset (engine: expScore × max(0.4, 1 − 0.15 per extra try)); mirrored here for tests and copy. */
export const SCALE_KM = 2500, ATTEMPTS = 4, HIT_KM = SCALE_KM * 0.02;
export const finalScore = (km, tries) => Math.round(expScore(km, SCALE_KM, 100) * Math.max(0.4, 1 - 0.15 * (tries - 1)));

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
      '黑底上的白线是某座城市市中心 1 km × 1 km 范围内的机动车道路，上北下南；线越粗，路越宽，细线是小街、小巷。',
      '读肌理：整齐的方格网多见于美洲和殖民城市，放射环路和斜向大道像欧洲古都，蜿蜒细密的窄巷是老城或山城，巨大的街区和立交是现代规划新城。',
      '在世界地图上点出你的答案，一共 4 次机会；每次没猜中会告诉你「冷热」和离答案的公里数，但不告诉方向，可以用几次距离交叉定位。',
      '离答案不到 50 km 即算命中，直接结束；否则用完 4 次后以最后一次为准。',
    ],
    scoring: '以最后一次猜测的距离计：100 × e^(−距离 / 2500 km)；每多用一次机会，总分再 −15%（最多 −45%）。第一次就命中 100 分，第 4 次才命中约 55 分。',
    sources: [
      { name: 'OpenStreetMap（Overpass API）', url: 'https://overpass-api.de/', note: '各城市中心 1 km² 内的 highway 线要素，© OpenStreetMap contributors，ODbL' },
    ],
    dataNote: '数据是对 OpenStreetMap 的一次快照（构建脚本见 build/），道路按 2–3 m 容差简化。只画机动车道路（含小街、服务路）；步行道、自行车道、台阶、土路不画，因为这类线在各城市的 OSM 里录入完整度差别极大，会让「谁画得全」比「街网肌理」更显眼。方块的中心点是城市核心区的一个坐标（部分城市刻意避开立交、大片公园或水面，改选老城里的街区），答案就是这个中心点。',
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

    const canvas = ui.h('canvas', { role: 'img', 'aria-label': '黑底白线的街道网络图，没有文字标注', style: { width: '100%', aspectRatio: '1', display: 'block', background: '#000', borderRadius: '8px', maxWidth: '560px', margin: '0 auto' } });
    const scale = ui.h('div', { class: 'small mono muted', style: { textAlign: 'center', marginTop: '8px' } }, '底部白条 = 200 m', ui.h('br'), '全图 1 km × 1 km · 上为北');
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
      view: { center: [25, 10], zoom: 2, bounds: [[-56, -170], [74, 178]] }, // whole world, fits 390 px too
      scale: SCALE_KM,
      attempts: ATTEMPTS,
      title: '点出它在哪',
      prompt: '没有地名的世界地图。每次提交后只告诉你冷热和公里数，不告诉方向。',
      hint: (km) => `${temp(km)} · 离答案 ${core.fmtKm(km)}`,
      reveal: async ({ L, map }) => {
        L.rectangle([[c.lat - 0.0045, c.lng - 0.0045 / Math.cos(c.lat * Math.PI / 180)], [c.lat + 0.0045, c.lng + 0.0045 / Math.cos(c.lat * Math.PI / 180)]], { color: ui.colors().accent, weight: 2, fillOpacity: 0.15 }).addTo(map);
      },
    });
    ro?.disconnect();

    // where does this square sit among the whole pool? (learn what "grid-ness" means)
    const all = ctx.data.cities.map((x) => stats(x.ways).grid);
    const rank = all.filter((g) => g > st.grid).length + 1;
    const style = st.grid > 0.75 ? '高度方格化：街道近乎全部落在同一对垂直方向上，几乎一定是规划出来的格网城区'
      : st.grid > 0.5 ? '半规整：主要街道成网格，但夹着斜街或不规则街区'
        : '不规则：街道朝向各异，多半是自然生长的老城，或放射、曲线式布局';
    res.detail = ui.panel({ plain: true }, ui.kv([
      ['答案', `${c.name}，${c.country}（${c.lat.toFixed(3)}°, ${c.lng.toFixed(3)}°）`],
      ['这一方块的特征', c.note],
      ['道路总长', `${st.km.toFixed(1)} km（${c.ways.length} 段）：街网越密、越碎，往往越像老城`],
      ['格网度', `${Math.round(st.grid * 100)}%（在 ${all.length} 座城市里排第 ${rank}），主轴${axisText(st.axis)}`],
      ['怎么读', style],
      ['通用线索', '先看街区大小和朝向是否统一，再看有没有斜向干道、环路、立交和断头小巷：它们是不同时代、不同规划传统留下的指纹。'],
    ]));
    return res;
  },
};
