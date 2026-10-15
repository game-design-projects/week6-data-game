// #7 Parallel — which of five cities lie farther north than today's city?
export function northOf(ref, cands) {
  return cands.map((c, i) => (c.lat > ref.lat ? i : -1)).filter((i) => i >= 0);
}
export const latLabel = (v) => `${v >= 0 ? '北纬' : '南纬'}${Math.abs(v).toFixed(1)}°`;
const gap = (a, b) => Math.abs(a.lat - b.lat);

// The closest call of a round: the candidate whose latitude is nearest to the reference.
export function closestCall(ref, cands) {
  return cands.reduce((best, c) => (gap(c, ref) < gap(best, ref) ? c : best));
}
// Teaching sentence for one round, specific to its data.
export function lesson(ref, cands) {
  const c = closestCall(ref, cands);
  const dir = c.lat > ref.lat ? '更靠北' : '更靠南';
  const d = gap(c, ref).toFixed(1);
  const far = Math.abs(c.lng - ref.lng) > 40;
  return `最险的一对：${c.name}（${c.country}，${latLabel(c.lat)}）比 ${ref.name}（${latLabel(ref.lat)}）${dir}，只差 ${d}°${far ? '——两地相隔大半个地球，气候和直觉都帮不上忙，只能靠纬度本身' : ''}。`;
}

export default {
  meta: {
    num: 7,
    slug: 'parallel',
    title: 'Parallel',
    tagline: '五个城市，点出比今天这座城市更靠北的那几个。罗马可比纽约更靠北哦。',
    category: 'geo',
    data: 'snapshot',
    howTo: [
      '每局三轮，难度递增。每轮给出一座参照城市和五座候选城市（来自不同国家）。',
      '选出所有纬度比参照城市更高（更靠北）的候选城市，可能是 1 到 4 个，然后提交。南半球的城市看“偏北”：南纬 12° 比南纬 34° 更靠北。',
      '别被气候骗了：冷不等于北。暖流让欧洲比同纬度的北美暖得多，罗马（北纬 41.9°）就比纽约（40.7°）更靠北。',
      '提交后会显示每座城市的确切纬度，以及这一轮最险的一对。',
    ],
    scoring: '每轮按选对的重合度（Jaccard：选对的个数 ÷ 选中或应选的个数）计分，三轮满分 3 分。全选或乱点只能拿到零碎的分，漏选和多选都会扣分。',
    sources: [
      { name: 'GeoNames cities15000', url: 'https://download.geonames.org/export/dump/', note: '城市坐标与人口（人口 150 万以上）' },
      { name: 'Wikidata', url: 'https://www.wikidata.org/', note: '城市的简体中文名（通过 GeoNames ID 匹配）' },
    ],
    dataNote: '数据是快照：GeoNames 的城市坐标几乎不变，没有每日更新的版本，因此未做实时加载。仅收录有简体中文名、人口 150 万以上的城市。纬度取城市中心点。每天的三轮由固定题库抽出，难度依次为：纬度差 ≥3°、≥1.2°、≥0.4°。',
  },

  puzzle({ data, pick }) {
    return pick(data.puzzles);
  },

  async play(ctx, p) {
    ctx.log('rounds', p.rounds.length);
    const rounds = p.rounds.map(({ ref, cands }) => {
      const correct = northOf(ref, cands);
      const rows = cands.slice().sort((a, b) => b.lat - a.lat)
        .map((c) => `${c.name} ${latLabel(c.lat)}${c.lat > ref.lat ? ' ↑' : ' ↓'}`).join(' · ');
      return {
        prompt: `哪些比 ${ref.name}（${ref.country}）更靠北？`,
        options: cands.map((c) => ({ label: c.name, sub: c.country })),
        correct,
        explain: `${ref.name} ${latLabel(ref.lat)}。${rows}`,
      };
    });
    const res = await ctx.rounds({ rounds, multi: true, title: '比参照城市更靠北的有哪些？' });
    res.detail = ctx.ui.stack(
      ...p.rounds.map(({ ref, cands }, i) => ctx.ui.callout(`第 ${i + 1} 轮：${lesson(ref, cands)}`, 'good')),
      ctx.ui.quote('规律：看纬度，别看气候。暖流（如北大西洋暖流）让欧洲的冬天比同纬度的北美温和，所以“更冷”的城市不一定更靠北。'),
    );
    return res;
  },
};
