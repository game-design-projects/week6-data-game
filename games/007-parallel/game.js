// #7 Parallel — which of five cities lie farther north than today's city?
export function northOf(ref, cands) {
  return cands.map((c, i) => (c.lat > ref.lat ? i : -1)).filter((i) => i >= 0);
}
const zh = (cc) => { try { return new Intl.DisplayNames(['zh-Hans'], { type: 'region' }).of(cc); } catch { return cc; } };
const lat = (v) => `${Math.abs(v).toFixed(1)}°${v >= 0 ? 'N' : 'S'}`;

export default {
  meta: {
    num: 7,
    slug: 'parallel',
    title: 'Parallel',
    tagline: '五个城市，点出比今天这座城市更靠北的那几个。罗马可比纽约更靠北哦。',
    category: 'geo',
    data: 'snapshot',
    howTo: [
      '每局三轮。每轮给出一座参照城市和五座候选城市。',
      '选出所有纬度比参照城市更靠北的候选城市（可能是 1 到 4 个），然后提交。',
      '别被气候骗了：冷不等于北，欧洲普遍比同气候带的北美更靠北。',
      '提交后会显示每座城市的确切纬度。',
    ],
    scoring: '每轮按选对的重合度（Jaccard）计分，三轮满分 3 分。',
    sources: [{ name: 'GeoNames cities15000', url: 'https://download.geonames.org/export/dump/', note: '人口 100 万以上城市的纬度' }],
  },

  puzzle({ data, pick }) {
    return pick(data.puzzles);
  },

  async play(ctx, p) {
    ctx.log('rounds', p.rounds.length);
    const name = (c) => `${c.name}（${zh(c.cc)}）`;
    const rounds = p.rounds.map(({ ref, cands }) => {
      const correct = northOf(ref, cands);
      const rows = cands.slice().sort((a, b) => b.lat - a.lat).map((c) => `${c.name} ${lat(c.lat)}${c.lat > ref.lat ? ' ↑' : ' ↓'}`).join(' · ');
      return {
        prompt: `哪些比 ${name(ref)} 更靠北？`,
        options: cands.map((c) => ({ label: c.name, sub: zh(c.cc) })),
        correct,
        explain: `${ref.name} ${lat(ref.lat)}。${rows}`,
      };
    });
    const res = await ctx.rounds({ rounds, multi: true, title: '比参照城市更靠北的有哪些？' });
    res.detail = ctx.ui.callout('纬度才是“北”：纽约 40.7°N，罗马 41.9°N，马德里 40.4°N——欧洲城市的纬度普遍比气候相似的北美城市更高，因为暖流让它们更暖。', 'good');
    return res;
  },
};
