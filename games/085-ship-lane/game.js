// #85 Ship Lane — a crop of the vessel-density heat map; name the strait or port.
import { distKm, bearing, arrow } from './geo.js';

export default {
  meta: {
    num: 85,
    slug: 'ship-lane',
    title: 'Ship Lane',
    tagline: '一小块欧洲海域的船舶密度热力图，认出这是哪个海峡或港口。',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      '图里是 EMODnet 的船舶密度图：越红船越多，空白处是陆地（没有船信号），所以海岸线形状就是线索。',
      '先看最近的一张特写，猜错一次就多解锁一张：中等视野、广角视野、类型和大致坐标。',
      '从列表里选一个地点。每次猜测会告诉你相距多少公里、答案在哪个方向。',
      '越早猜中分数越高：第 1 次 100 分，每多猜一次少 1/6。',
    ],
    scoring: '100 × (6 − 已猜次数 + 1) / 6，没猜中为 0。',
    sources: [
      { name: 'EMODnet Human Activities: Vessel density', url: 'https://emodnet.ec.europa.eu/en/human-activities', note: '全部船型，WMS GetMap 截图（EPSG:3857）' },
      { name: 'EMODnet WMS', url: 'https://ows.emodnet-humanactivities.eu/wms' },
    ],
    dataNote: '密度图来自 EMODnet（基于 AIS，只覆盖欧洲海域），已预先裁成 3 种缩放存成图片；坐标为地点的大致中心。',
  },

  puzzle({ data, pick }) {
    return { place: pick(data.places) };
  },

  async play(ctx, { place }) {
    const { ui } = ctx;
    const P = ctx.data.places;
    const byId = Object.fromEntries(P.map((p) => [p.id, p]));
    ctx.log('ship-lane answer', place.id);
    const view = (i) => ui.stack(
      ui.h('div', { style: { background: '#0c1f2e', borderRadius: '10px', overflow: 'hidden', width: '100%', maxWidth: '300px', aspectRatio: '1', margin: '0 auto' } },
        ui.h('img', { src: ctx.asset('img/' + place.files[i]), alt: '船舶密度热力图', style: { width: '100%', display: 'block', height: '100%', objectFit: 'contain' } })),
      ui.h('div', { class: 'ds-muted', style: { textAlign: 'center', fontSize: '.85em' } }, `图幅约 ${place.spanKm[i]} km 见方`));
    const kind = place.kind === 'strait' ? '海峡 / 海域通道' : '港口 / 河口';
    const r = await ctx.guess({
      title: '这是哪里？',
      options: P.map((p) => ({ id: p.id, label: p.zh, hint: p.en, aliases: [p.en] })),
      answer: place.id,
      maxGuesses: 6,
      clues: [view(0), view(1), view(2), `类型：${kind}`, `大致坐标：${place.lat.toFixed(0)}°N，${Math.abs(place.lng).toFixed(0)}°${place.lng < 0 ? 'W' : 'E'}`],
      cluesTitle: '密度图',
      columns: ['距离', '方向'],
      feedback: (g, a) => {
        const gp = byId[g.id], ap = byId[a.id];
        const d = distKm(gp, ap);
        return [{ text: `${Math.round(d).toLocaleString()} km`, num: true, state: d < 150 ? 'hit' : d < 600 ? 'near' : 'miss' },
          { text: d < 1 ? '✓' : arrow(bearing(gp, ap)), state: d < 1 ? 'hit' : undefined }];
      },
      near: (g, a) => distKm(byId[g.id], byId[a.id]) < 500,
    });
    r.detail = ui.kv([
      ['答案', `${place.zh}（${place.en}）`],
      ['类型', kind],
      ['线索', place.kind === 'strait'
        ? '海峡处航线被陆地挤成一条或几条红色的“高速公路”，两侧海岸线几乎对称。'
        : '港口外是放射状汇聚的航线，红色最浓处是锚地和港池；河口则拖出一条沿河上行的红线。'],
    ]);
    return r;
  },
};
