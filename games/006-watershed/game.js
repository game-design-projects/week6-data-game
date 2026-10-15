// #6 Watershed — the outline of a river's whole drainage basin; name the river.
import { haversineKm, bearingDeg, arrow, fmtKm, fmtNum } from '../../engine/core.js';

const REGION = {
  Africa: '非洲',
  Asia: '亚洲',
  Europe: '欧洲',
  'North America, Central America and the Caribbean': '北美洲',
  'South America': '南美洲',
  'South-West Pacific': '大洋洲',
};
export const regionZh = (r) => REGION[r] || r;
export const fmtLat = (v) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? 'N' : 'S'}`;
export const fmtLng = (v) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? 'E' : 'W'}`;

/** Area clue band, e.g. 1.2M km² -> "80 万 – 160 万 km²" — coarse on purpose. */
export function areaBand(km2) {
  const steps = [100e3, 200e3, 400e3, 800e3, 1.6e6, 3.2e6, 7e6];
  const lo = [0, ...steps].filter((s) => s <= km2).pop();
  const hi = steps.find((s) => s > km2);
  const f = (v) => `${fmtNum(v / 1e4)} 万`;
  if (!hi) return `大于 ${f(lo)} km²`;
  return lo === 0 ? `小于 ${f(hi)} km²` : `${f(lo)} – ${f(hi)} km²`;
}

/** 6 guesses: 100 for the first, then 83, 67, 50, 33, 17; 0 if never found. */
export const scoreFor = (n, won) => (won ? Math.round((100 * (7 - n)) / 6) : 0);

/** Area feedback relative to the answer, from the guessed basin's point of view. */
export function areaCell(guessArea, ansArea) {
  const ratio = ansArea / guessArea;
  if (ratio >= 0.87 && ratio <= 1.15) return { text: '相近', num: true, state: 'near' };
  return ratio > 1
    ? { text: `答案更大 ×${ratio.toFixed(1)}`, num: true }
    : { text: `答案更小 ×${(1 / ratio).toFixed(1)}`, num: true };
}

/** Geometry for Plot: all outer rings as one MultiPolygon. */
export const toMulti = (r) => ({ type: 'MultiPolygon', coordinates: r.rings.map((ring) => [ring]) });

export default {
  meta: {
    num: 6,
    slug: 'watershed',
    title: 'Watershed',
    tagline: '一条河的整个流域，只剩一块没有标注的轮廓。猜是哪条河。',
    category: 'geo',
    data: 'snapshot',
    howTo: [
      '图里是某条河的完整流域（所有雨水最终汇入这条河的土地），指北朝上，已用等积投影，形状不变形。',
      '从列表里选一条河来猜，最多 6 次。每猜错一次多解锁一条线索：面积范围、大洲、经纬度范围、名字字母数、精确面积。',
      '每次猜测会告诉你：猜的流域中心离答案多远、答案在哪个方向，以及答案的面积比你猜的大还是小。',
      '读图提示：树枝状、狭长的多半是单一干流；一大块圆的往往是内流盆地；缺口和凸起对应分水岭上的大山脉。',
    ],
    scoring: '第 1 次猜中 100 分，之后依次 83、67、50、33、17 分，6 次都没猜中 0 分。',
    sources: [
      { name: 'WMO Basins and Sub-basins, 3rd ed. (GRDC, 2020)', url: 'https://services1.arcgis.com/RTK5Unh1Z71JKIiR/arcgis/rest/services/WMO_Basins_and_Sub_Basins_3rd_ed_GRDC_2020/FeatureServer', note: '全球径流数据中心（德国联邦水文研究所）发布的 WMO 流域边界' },
      { name: 'HydroSHEDS', url: 'https://www.hydrosheds.org/', note: '原计划数据源；其下载站点（data.hydrosheds.org）对脚本返回 403 Cloudflare 验证，且 HydroBASINS 不带河名，故改用带官方名称的 WMO/GRDC 流域数据' },
    ],
    dataNote: '数据是 WMO/GRDC 的流域与子流域多边形，在服务器端做了简化（约 0.02° 精度，已去掉流域内的小湖洞）。同一条河的各子流域（例如密西西比 = 密西西比+密苏里+俄亥俄+……）合并成一个流域；只收录面积 ≥ 约 6 万 km² 的 86 个有名字的流域。内流盆地（如乍得湖、艾尔湖）按其湖名收录，墨累-达令、幼发拉底-底格里斯等按 WMO 分组合并。“去向”和“形状线索”文字由人工根据通行地理资料撰写。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.rivers).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const rivers = ctx.data.rivers;
    const ans = rivers.find((r) => r.id === p.id);
    const byId = new Map(rivers.map((r) => [r.id, r]));
    ctx.log('answer', ans.name, ans.area, ans.subs);

    const geom = toMulti(ans);
    const cx = (ans.bbox[0] + ans.bbox[2]) / 2;
    const cy = (ans.bbox[1] + ans.bbox[3]) / 2;
    const outline = await ui.plot((Plot, c) => ({
      height: 320,
      axis: false,
      projection: { type: 'azimuthal-equal-area', rotate: [-cx, -cy], domain: geom, inset: 8 },
      marks: [
        Plot.geo(geom, { fill: c.accent, fillOpacity: 0.85, stroke: c.accent, strokeWidth: 0.6, strokeLinejoin: 'round' }),
      ],
    }), { axis: false });
    ctx.stage.append(ui.panel({ kicker: '等积投影 · 北向上 · 无比例尺', title: '这条河的流域' }, outline));

    const fmtRange = (a, b, pos, neg) => {
      const f = (v) => `${Math.abs(Math.round(v))}°${v >= 0 ? pos : neg}`;
      return `${f(a)} ~ ${f(b)}`;
    };
    const letters = ans.name.replace(/[^A-Za-zÀ-ÿ]/g, '');
    const clues = [
      `流域面积在 ${areaBand(ans.area)} 之间。`,
      `它位于 ${regionZh(ans.region)}（按 WMO 分区）。`,
      ui.h('div', `流域大致覆盖：纬度 ${fmtRange(ans.bbox[1], ans.bbox[3], 'N', 'S')}，经度 ${fmtRange(ans.bbox[0], ans.bbox[2], 'E', 'W')}。`),
      `英文名共 ${letters.length} 个字母，以 “${ans.name[0]}” 开头。`,
      `更精确的面积：约 ${fmtNum(Math.round(ans.area / 1000) * 1000)} km²。` + (ans.subs > 1 ? `它由 ${ans.subs} 个 WMO 子流域拼成。` : ''),
    ];

    const options = rivers.map((r) => ({
      id: r.id,
      label: r.zh,
      hint: r.name,
      aliases: [r.name, ...(r.aliases || [])],
    }));
    const res = await ctx.guess({
      options,
      answer: ans.id,
      maxGuesses: 6,
      scoring: scoreFor,
      title: '是哪条河？',
      placeholder: '输入河名（中文或英文）…',
      clues,
      cluesTitle: '线索',
      columns: ['距离', '方向', '面积'],
      near: (g, a) => haversineKm(byId.get(g.id), byId.get(a.id)) < 1500,
      feedback: (g) => {
        const gr = byId.get(g.id);
        if (gr.id === ans.id) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, { text: '一致', state: 'hit' }];
        const km = haversineKm(gr, ans);
        return [
          { text: fmtKm(km), num: true, state: km < 1500 ? 'near' : undefined },
          { text: arrow(bearingDeg(gr, ans)) },
          areaCell(gr.area, ans.area),
        ];
      },
    });

    // Reveal: where on the globe this basin sits, so the shape can be tied to a place.
    let locator = null;
    try {
      const land = await ui.geo('land');
      locator = await ui.plot((Plot, c) => ({
        height: 240,
        axis: false,
        projection: { type: 'orthographic', rotate: [-ans.lng, -ans.lat] },
        marks: [
          Plot.sphere({ fill: c.paper2, stroke: c.rule }),
          Plot.geo(land, { fill: c.rule, fillOpacity: 0.7, stroke: c.muted, strokeWidth: 0.3 }),
          Plot.geo(geom, { fill: c.accent, stroke: c.accent, strokeWidth: 0.8 }),
        ],
      }), { axis: false });
    } catch (e) {
      ctx.log.warn('locator map failed', e);
    }
    const kv = ui.kv([
      ['答案', `${ans.zh}（${ans.name}）`],
      ['流域面积', `${fmtNum(ans.area)} km²`],
      ['位置', `${regionZh(ans.region)} · 中心约 ${fmtLat(ans.lat)}, ${fmtLng(ans.lng)}`],
      ['去向', ans.mouth],
      ['形状线索', ans.note],
    ]);
    res.detail = locator ? ui.stack(locator, kv) : kv;
    return res;
  },
};
