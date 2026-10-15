// #85 Ship Lane — a crop of the vessel-density heat map; name the strait or port.
import { distKm, bearing, arrow, axisWords } from './geo.js';

const MAX_GUESSES = 6;
const R_EARTH = 6378137;
const SEA = '#0c1f2e', LAND = '#3b4048';

/** 100·(max−n+1)/max when solved on guess n, else 0. */
export function scoreFor(n, won, max = MAX_GUESSES) {
  return won ? Math.round((100 * (max - n + 1)) / max) : 0;
}

/** Coarse 5-degree box for the last clue (so it narrows the field without naming the place). */
export function coordClue(p) {
  const la = Math.floor(p.lat / 5) * 5, lo = Math.floor(p.lng / 5) * 5;
  const ew = (v) => `${Math.abs(v)}°${v < 0 ? 'W' : 'E'}`;
  return `大致位置：${la}°–${la + 5}°N，${ew(lo)}–${ew(lo + 5)}`;
}

/** The result-card explanation, built from this place's own data. */
export function explain(place) {
  const lines = [place.note];
  if (place.axis && place.axis.elong >= 2) lines.push(`图中黄、红色的高密度带大致是${axisWords(place.axis.bearing)}。`);
  else lines.push('图中没有一条特别突出的高密度主航道，船流比较分散。');
  return lines;
}

export default {
  meta: {
    num: 85,
    slug: 'ship-lane',
    title: 'Ship Lane',
    tagline: '一小块欧洲海域的船舶密度热力图，认出这是哪个海峡、海域或港口。',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      '图里是 EMODnet 的船舶密度图（2023 年平均）：绿色表示船少，黄、红表示船多，灰色是陆地，深蓝是没有船信号的海面。图上没有任何地名，海岸线形状和航线走向就是线索。',
      '先看最近的特写，猜错一次就多解锁一条线索：中等视野、广角视野、地点类型、大致坐标。',
      '从列表里选一个地点。每次猜测会告诉你相距多少公里、答案在哪个方向。最多猜 6 次。',
      '越早猜中分数越高：第 1 次 100 分，之后每多猜一次少约 17 分，没猜中为 0。',
    ],
    scoring: '100 × (7 − 猜测次数) / 6，没猜中为 0。',
    sources: [
      { name: 'EMODnet Human Activities: Vessel density', url: 'https://emodnet.ec.europa.eu/en/human-activities', note: '全部船型，年平均（2023）' },
      { name: 'EMODnet WMS (vesseldensity_allavg)', url: 'https://ows.emodnet-humanactivities.eu/wms', note: 'GetMap 截图，EPSG:3857' },
      { name: 'Natural Earth via world-atlas', url: 'https://github.com/topojson/world-atlas', note: '陆地底图' },
    ],
    dataNote: '密度图来自 EMODnet（基于 AIS 信号，只覆盖欧盟及邻近海域），选取 2023 年平均值，已预先裁成 3 种缩放存成图片，因此不是实时数据，且列表只含欧洲水域。陆地由 Natural Earth 绘制，不含任何地名；坐标为地点的大致中心。',
  },

  puzzle({ data, pick }) {
    return { place: pick(data.places) };
  },

  async play(ctx, { place }) {
    const { ui } = ctx;
    const P = ctx.data.places;
    const byId = Object.fromEntries(P.map((p) => [p.id, p]));
    ctx.log('ship-lane answer', place.id, 'pool', P.length);

    let land = null, d3 = null;
    try { [land, d3] = await Promise.all([ui.geo('countries50'), ui.lib('d3')]); } catch (e) { ctx.log.warn('ship-lane land layer unavailable', String(e)); }

    // one crop = sea colour, Natural Earth land, then the transparent density PNG on top
    const crop = async (i) => {
      const W = 480, cv = ui.h('canvas', { width: W, height: W, role: 'img', 'aria-label': '船舶密度热力图，地名已隐藏',
        style: { width: '100%', height: 'auto', display: 'block', aspectRatio: '1' } });
      const g = cv.getContext('2d');
      g.fillStyle = SEA; g.fillRect(0, 0, W, W);
      if (land && d3) {
        const proj = d3.geoMercator().scale(W / ((2 * place.half[i]) / R_EARTH)).center([place.lng, place.lat]).translate([W / 2, W / 2]).precision(0.1);
        g.fillStyle = LAND; g.beginPath(); d3.geoPath(proj, g)(land); g.fill();
      }
      const img = new Image();
      await new Promise((res) => { img.onload = res; img.onerror = () => { ctx.log.warn('ship-lane image failed', place.files[i]); res(); }; img.src = ctx.asset('img/' + place.files[i]); });
      g.imageSmoothingEnabled = false;
      if (img.naturalWidth) g.drawImage(img, 0, 0, W, W);
      return ui.stack(
        ui.h('div', { style: { borderRadius: '10px', overflow: 'hidden', width: '100%', maxWidth: '320px', margin: '0 auto' } }, cv),
        ui.h('div', { class: 'ds-muted', style: { textAlign: 'center', fontSize: '.85em' } }, `图幅约 ${place.spanKm[i]} km 见方 · 绿→红＝船越来越多`));
    };
    const views = await Promise.all([0, 1, 2].map(crop));

    const kind = place.kind === 'strait' ? '海峡 / 海域通道' : '港口 / 河口';
    const r = await ctx.guess({
      title: '这是哪里？',
      options: P.map((p) => ({ id: p.id, label: p.zh, hint: p.en, aliases: [p.en] })),
      answer: place.id,
      maxGuesses: MAX_GUESSES,
      clues: [views[0], views[1], views[2], `类型：${kind}`, coordClue(place)],
      cluesTitle: '密度图',
      columns: ['距离', '方向'],
      feedback: (g, a) => {
        const gp = byId[g.id], ap = byId[a.id];
        const d = distKm(gp, ap);
        return [{ text: `${Math.round(d).toLocaleString()} km`, num: true, state: d < 150 ? 'hit' : d < 600 ? 'near' : 'miss' },
          { text: d < 1 ? '✓' : arrow(bearing(gp, ap)), state: d < 1 ? 'hit' : undefined }];
      },
      near: (g, a) => distKm(byId[g.id], byId[a.id]) < 500,
      scoring: (n, won) => scoreFor(n, won),
    });
    r.detail = ui.kv([
      ['答案', `${place.zh}（${place.en}）`],
      ['类型', kind],
      ['线索', ui.stack(...explain(place).map((t) => ui.h('div', {}, t)))],
    ]);
    return r;
  },
};
