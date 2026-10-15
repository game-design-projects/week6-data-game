// #102 Trainspotter — a railway photo from Wikimedia Commons: name the operator,
// name the train type, then pin where the photographer stood.

/** Pick `n` wrong options (distinct labels, never the answer) and shuffle with the answer.
 *  `skip(m)` drops lookalikes of the answer; `prefer(m)` fronts plausible decoys (e.g. same country). */
export function buildChoices(all, answer, key, n, rng, { skip = () => false, prefer = () => false } = {}) {
  const seen = new Set([answer[key]]);
  const wrong = [];
  const pool = rng.shuffle(all.slice().filter((m) => m !== answer && !skip(m)));
  pool.sort((a, b) => Number(prefer(b)) - Number(prefer(a)));
  for (const m of pool) {
    if (wrong.length >= n) break;
    if (!seen.has(m[key])) { seen.add(m[key]); wrong.push(m); }
  }
  return rng.shuffle([answer, ...wrong]).map((m) => m[key]);
}

/** Three equal parts: operator (0/1), train type (0/1) and the pin (0..100) → 0..300. */
export function totalScore(opOk, typeOk, pinScore) {
  return (opOk ? 100 : 0) + (typeOk ? 100 : 0) + Math.max(0, Math.min(100, pinScore));
}

/** Short verdict on the pin, specific to how far off the player was. */
export function pinVerdict(km) {
  if (km < 30) return '几乎就在同一个站台附近，太准了。';
  if (km < 300) return '落在了同一个国家、同一片区域，方向对了。';
  if (km < 1500) return '大致在对的地区，但差了一个国家左右；先用涂装和接触网判断国家，再沿铁路线找大站。';
  return '落在了另一个大洲或另一端；先认出国家（涂装、文字、站台），再缩小到大城市。';
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
      '先选运营商，再选车型（各 4 选 1，各占 100 分）。车型选项里会混入同国家的车型，别只看国家。',
      '最后在地图上标出摄影师所站的位置（缩放到 6 级以上会显示 OpenRailwayMap 铁路线，方便沿线找站）。',
      '定位 100 × e^(−距离/600 km)：0 km 得 100 分，差 600 km 约 37 分。满分 300。',
    ],
    scoring: '运营商 100 + 车型 100 + 定位 100 × e^(−距离/600 km)，满分 300。',
    sources: [
      { name: 'Wikimedia Commons 铁路车型分类（照片、拍摄坐标、作者、许可证）', url: 'https://commons.wikimedia.org/wiki/Category:Trains_by_type' },
      { name: 'OpenRailwayMap / OpenStreetMap（地图铁路线叠加层）', url: 'https://www.openrailwaymap.org/' },
    ],
    dataNote: '照片来自 Wikimedia Commons 17 个车型分类中带拍摄坐标的图片，每张都经人工逐张检查（排除了车内、特写、看得清运营商大标志或站名牌的照片）；车型与运营商对应关系为人工整理。坐标是摄影师的站位，不一定是车站。外挂 OpenRailwayMap 瓦片由第三方提供：没有 OSM 铁路线的离线处理版本——整个欧亚大陆的线路矢量无法放进浏览器端，所以直接叠加其栅格图层。Commons 现在只允许 960 px 缩略图。',
  },

  puzzle({ data, pick, rng }) {
    const photo = pick(data.photos);
    const model = data.models.find((m) => m.id === photo.model);
    return {
      photo: photo.id,
      ops: buildChoices(data.models, model, 'op', 3, rng),
      names: buildChoices(data.models, model, 'name', 3, rng, {
        skip: (m) => m.family === model.family,
        prefer: (m) => m.country === model.country,
      }),
    };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const photo = ctx.data.photos.find((x) => x.id === p.photo);
    const model = ctx.data.models.find((m) => m.id === photo.model);
    ctx.log('photo', photo.id, model.name);

    // author and licence are shown after the answer (an author's home town can give the place away)
    const credit = ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, 'Wikimedia Commons · 作者与许可证在结算后显示');
    const img = ui.h('img', { src: photo.img, alt: '铁路照片', decoding: 'async', style: { width: '100%', borderRadius: 'var(--radius, 10px)', display: 'block' } });
    img.addEventListener('error', () => { ctx.log.warn('photo failed to load', photo.id); credit.textContent = '照片加载失败，请刷新重试（Wikimedia Commons 暂时不可用）。'; });
    ctx.stage.append(ui.panel({ kicker: '今日照片', title: '这是什么车？' }, img, credit));

    const opRes = await ctx.rounds({
      title: '运营商',
      rounds: [{ prompt: '它属于哪家运营商？', options: p.ops.map((label) => ({ label })), correct: p.ops.indexOf(model.op), explain: `${model.op}（${model.country}）` }],
    });
    const typeRes = await ctx.rounds({
      title: '车型',
      rounds: [{ prompt: '它是哪种车型？', options: p.names.map((label) => ({ label })), correct: p.names.indexOf(model.name), explain: model.name }],
    });

    const pinRes = await ctx.pin({
      title: '摄影师站在哪里？',
      prompt: '在地图上标出拍摄位置（车站或沿线）。放大到 6 级以上会出现铁路线。',
      answer: { lat: photo.lat, lng: photo.lng, label: '拍摄位置' },
      view: { bounds: [[18, -82], [62, 143]] },
      scale: 600,
      setup: async ({ map, L }) => {
        try {
          L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', { minZoom: 6, maxZoom: 19, opacity: 0.85, attribution: '© OpenRailwayMap' }).addTo(map);
        } catch (e) { ctx.log.warn('openrailwaymap overlay failed', String(e)); }
      },
    });
    ctx.log('pin', Math.round(pinRes.km), 'km');
    credit.textContent = `Wikimedia Commons · ${photo.author} · ${photo.lic}`;

    const opOk = opRes.score >= 1;
    const typeOk = typeRes.score >= 1;
    const res = ctx.combine([
      { ...opRes, score: opOk ? 100 : 0, max: 100 },
      { ...typeRes, score: typeOk ? 100 : 0, max: 100 },
      pinRes,
    ]);
    res.score = totalScore(opOk, typeOk, pinRes.score);
    res.max = 300;
    res.summary = `运营商${opOk ? '✓' : '✗'} · 车型${typeOk ? '✓' : '✗'} · 误差 ${ctx.core.fmtKm(pinRes.km)}`;
    res.detail = ui.kv([
      ['车型', `${model.name}（${model.op}，${model.country}）`],
      ['怎么认出来', model.tell],
      ['这次的车型选项', p.names.join(' / ')],
      ['拍摄地', ui.h('span', {}, ui.h('a', { href: photo.page, target: '_blank', rel: 'noopener' }, photo.title), ` · ${photo.lat.toFixed(3)}°, ${photo.lng.toFixed(3)}°`)],
      ['你的定位', `${ctx.core.fmtKm(pinRes.km)}。${pinVerdict(pinRes.km)}`],
      ['作者与许可证', `${photo.author} · ${photo.lic}`],
    ]);
    return res;
  },
};
