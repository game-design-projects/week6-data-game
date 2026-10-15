// #51 Toponym — a place name's literal meaning is the only clue; find the place on the map.

/** Round score weights: 3 places per day. Pure helper for tests. */
export function pickThree(places, pick, rng) {
  const first = pick(places);
  const rest = rng.sample(places.filter((p) => p.id !== first.id), 2);
  return [first, ...rest].map((p) => p.id);
}

export default {
  meta: {
    num: 51,
    slug: 'toponym',
    title: 'Toponym',
    tagline: '给你一个地名的字面意思——“黑色水塘”——在世界地图上找出这个地方。',
    category: 'words',
    data: 'snapshot',
    howTo: [
      '每天 3 个地名。题目只给出它的字面意思、原语言和类型（城市/国家/地区），地图上没有任何地名标注。',
      '先想：这是什么语言？说这种语言（或殖民者说这种语言）的人在哪里？再在地图上点出位置，每题 2 次机会，第二次会有方向提示。',
      '语言就是最大的线索：西班牙语、葡萄牙语、法语、阿拉伯语、梵语、古诺尔斯语各自留下了很不同的足迹。',
      '揭晓后会显示原文拼写，看看你是不是早就认识它。',
    ],
    scoring: '每题按距离计分：0 km 得 100 分，差约 1,500 km 约 37 分；第二次尝试扣 10%。三题得分相加，满分 300。',
    sources: [
      { name: 'Wikidata（坐标与条目）', url: 'https://www.wikidata.org/', note: 'wbgetentities API 取 P625 坐标' },
      { name: 'Wikipedia 各地名条目的 Etymology 章节', url: 'https://en.wikipedia.org/', note: '字面意思由条目词源章节整理为中文' },
    ],
    dataNote: '字面意思取自各条目 Wikipedia 词源章节的通行说法，已避开词源有争议的地名；坐标为 Wikidata 的中心点（国家/地区取其中心）。题库为人工筛选的 90 个地名；字面意思与“语言指纹”说明为人工整理，并非从 Wiktionary 自动解析（其词源是自由文本，无法可靠抽取）。每个意思已去掉直接暗示名字的字样。',
  },

  puzzle({ data, pick, rng }) {
    return { ids: pickThree(data.places, pick, rng) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const byId = new Map(ctx.data.places.map((x) => [x.id, x]));
    // world band lat -58..80 is ~0.59x as tall as wide in Mercator; size the map to it so no empty strip shows
    const mapHeight = Math.max(260, Math.min(480, Math.round(((ctx.stage?.clientWidth || 390) - 40) * 0.6)));
    const results = [];
    const details = [];
    for (let i = 0; i < p.ids.length; i++) {
      const pl = byId.get(p.ids[i]);
      ctx.log(`round ${i + 1}`, pl.id, pl.name);
      const prompt = ui.h('div', { class: 'ds-stack' },
        ui.h('div', { style: { fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent)' } }, `“${pl.zh}”`),
        ui.h('div', { class: 'ds-row', style: { gap: '8px' } }, ui.badge(pl.kind), ui.badge(`原语言：${pl.lang}`)),
        ui.h('div', { class: 'small muted' }, '这个地名按字面翻译就是上面这几个字。它在哪里？'));
      const r = await ctx.pin({
        title: `第 ${i + 1} / ${p.ids.length} 题`,
        prompt,
        answer: { lat: pl.lat, lng: pl.lng, label: pl.name },
        view: { bounds: [[-58, -180], [80, 180]] },
        height: mapHeight,
        basemap: 'gray',
        scale: 1500,
        attempts: 2,
        hint: (km, bearing) => {
          const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
          return `差约 ${ctx.core.fmtKm(km)}，答案在偏${dirs[Math.round((((bearing % 360) + 360) % 360) / 45) % 8]}方向`;
        },
      });
      results.push(r);
      details.push(ui.h('div', { class: 'ds-stack' },
        ui.h('div', {}, ui.h('b', pl.name), `　${pl.kind}`),
        ui.kv([['原文', pl.orig], ['语言', pl.lang], ['字面意思', pl.zh], ['你的误差', ctx.core.fmtKm(r.km ?? 0)]]),
        ui.callout(`线索在语言：${ctx.data.langNotes?.[pl.lang] ?? ''}所以“${pl.zh}”（${pl.lang}）指向${pl.name.split(' ')[0]}。`, 'good'),
        ui.h('a', { href: `https://en.wikipedia.org/wiki/${encodeURIComponent(pl.wiki.replace(/ /g, '_'))}`, target: '_blank', rel: 'noopener' }, 'Wikipedia 词源 ↗')));
    }
    const res = ctx.combine(results);
    res.detail = ui.h('div', { class: 'ds-stack' }, ...details);
    return res;
  },
};
