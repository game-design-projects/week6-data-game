// #102 Trainspotter — a railway photo from Wikimedia Commons: name the operator,
// name the train type, then pin where the photographer stood.

/** Pick `n` wrong options (distinct labels, never the answer) and shuffle with the answer. */
export function buildChoices(all, answer, key, n, rng) {
  const seen = new Set([answer[key]]);
  const wrong = [];
  for (const m of rng.shuffle(all.slice())) {
    if (wrong.length >= n) break;
    if (!seen.has(m[key])) { seen.add(m[key]); wrong.push(m); }
  }
  return rng.shuffle([answer, ...wrong]).map((m) => m[key]);
}

export default {
  meta: {
    num: 102,
    slug: 'trainspotter',
    title: 'Trainspotter',
    tagline: '一张铁路照片：认出运营商和车型，再在地图上标出拍摄地。',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      '看照片：涂装、车头形状、受电弓、站台和信号灯都是线索。',
      '先选运营商，再选车型（各 4 选 1，每题 1 分）。',
      '最后在地图上标出摄影师所站的位置。地图上叠了 OpenRailwayMap 铁路网，顺着线路找。',
      '定位按距离计分：0 km 得 100 分，每差约 500 km 降到约三分之一。',
    ],
    scoring: '选择题各占 1 题；定位 100 × e^(−距离/500 km)；总分三项平均。',
    sources: [
      { name: 'Wikimedia Commons 铁路车型分类（照片、拍摄坐标、作者、许可证）', url: 'https://commons.wikimedia.org/wiki/Category:Trains_by_type' },
      { name: 'OpenRailwayMap / OpenStreetMap（地图铁路网叠加层）', url: 'https://www.openrailwaymap.org/' },
    ],
    dataNote: '照片来自 Commons 中 18 个车型分类里带拍摄坐标的图片，车型与运营商对应关系为人工整理；个别分类（如 Eurostar、Fuxing）里可能混有同系列其他涂装。照片经过过滤，仅保留 CC/公有领域授权。',
  },

  puzzle({ data, pick, rng }) {
    const photo = pick(data.photos);
    const model = data.models.find((m) => m.id === photo.model);
    return {
      photo: photo.id,
      ops: buildChoices(data.models, model, 'op', 3, rng),
      names: buildChoices(data.models, model, 'name', 3, rng),
    };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const photo = ctx.data.photos.find((x) => x.id === p.photo);
    const model = ctx.data.models.find((m) => m.id === photo.model);
    ctx.log('photo', photo.id, model.name);

    ctx.stage.append(ui.panel(
      { kicker: '今日照片', title: '这是什么车？' },
      ui.h('img', { src: photo.img, alt: '铁路照片', style: { width: '100%', borderRadius: 'var(--radius, 10px)', display: 'block' } }),
      ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, `Wikimedia Commons · ${photo.author} · ${photo.lic}`),
    ));

    const rd = await ctx.rounds({
      title: '运营商与车型',
      rounds: [
        { prompt: '它属于哪家运营商？', options: p.ops.map((label) => ({ label })), correct: p.ops.indexOf(model.op), explain: `${model.op}（${model.country}）` },
        { prompt: '它是哪种车型？', options: p.names.map((label) => ({ label })), correct: p.names.indexOf(model.name), explain: model.name },
      ],
    });

    const pinRes = await ctx.pin({
      title: '摄影师站在哪里？',
      prompt: '在地图上标出拍摄位置（车站或沿线）。',
      answer: { lat: photo.lat, lng: photo.lng, label: '拍摄位置' },
      view: { center: [40, 20], zoom: 2 },
      scale: 500,
      setup: async ({ map, L }) => {
        try {
          L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', { maxZoom: 19, opacity: 0.8, attribution: '© OpenRailwayMap' }).addTo(map);
        } catch (e) { ctx.log.warn('openrailwaymap overlay failed', String(e)); }
      },
    });
    ctx.log('pin', Math.round(pinRes.km), 'km');

    const res = ctx.combine([rd, pinRes]);
    res.detail = ui.kv([
      ['车型', `${model.name}（${model.op}，${model.country}）`],
      ['照片', ui.h('a', { href: photo.page, target: '_blank', rel: 'noopener' }, photo.title)],
      ['拍摄坐标', `${photo.lat.toFixed(3)}°, ${photo.lng.toFixed(3)}°`],
      ['你的误差', ctx.core.fmtKm(pinRes.km)],
      ['线索', '车头流线型和涂装决定车型；受电弓与接触网样式、站台高度、信号灯形状则暴露国家，国家一定，运营商和大致位置基本也就定了。'],
    ]);
    return res;
  },
};
