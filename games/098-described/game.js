// #98 Described — text-only GeoGuessr. A photo was described offline; you only read the description.
export default {
  meta: {
    num: 98,
    slug: 'described',
    title: 'Described',
    tagline: '纯文字版 GeoGuessr：只给你一段对街景照片的描述，不给图，你来地图上标点。',
    category: 'model',
    data: 'snapshot',
    howTo: [
      '读懂这段对照片的描述：文字、招牌、车辆、行人穿着、建筑材料和气候，都是线索。',
      '如果照片里有清晰的文字，会单独列出来，认出文字的语言往往就能缩到一两个国家。',
      '在世界地图上点出你认为照片拍摄的位置，然后确认。',
      '揭晓时会显示原照片，并说明是描述里的哪一点暴露了位置。',
    ],
    scoring: '100 × e^(−距离/2000 km)：误差 0 km 得 100 分，约 2,000 km 得 37 分。',
    sources: [
      { name: 'Wikimedia Commons（带坐标的街景照片）', url: 'https://commons.wikimedia.org/wiki/Special:Search?search=geotagged+street', note: '通过 MediaWiki geosearch API 取得照片与坐标，作者和许可证随照片显示' },
    ],
    dataNote: '浏览器里没有视觉模型：这里的描述是在构建阶段由 AI 对每张照片逐张看图后离线写成的，只描述画面，不写地名。坐标是 Commons 用户给照片标注的位置（可能是拍摄点，也可能是被拍摄物体的位置）。原计划使用 Mapillary，但它需要 API 密钥，所以换成了同类的 Commons 地理标注照片。',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.puzzles).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const q = ctx.data.puzzles.find((x) => x.id === p.id);
    ctx.log('puzzle', { id: q.id, city: q.city });

    ctx.stage.append(ui.panel({ kicker: '视觉模型的描述', title: '照片里有什么？' },
      ui.quote(q.desc),
      q.signs ? ui.callout(`画面里的文字：${q.signs}`, 'warn') : null,
      ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, '你看不到照片，只能依靠描述推断它在世界上的哪里。')));

    const res = await ctx.pin({
      answer: { lat: q.lat, lng: q.lng, label: `${q.city}，${q.country}` },
      view: { center: [25, 10], zoom: 2 },
      scale: 2000,
      title: '它拍摄于哪里？',
    });

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('img', { src: q.img, alt: q.title, loading: 'lazy', style: { width: '100%', borderRadius: 'var(--radius, 8px)', display: 'block' } }),
      ui.kv([
        ['地点', `${q.city}，${q.country}`],
        ['线索', q.why],
        ['图片来源', `${q.artist || '未知作者'} · ${q.lic || ''}`],
        ['原页面', ui.h('a', { href: q.page, target: '_blank', rel: 'noopener' }, 'Wikimedia Commons')],
      ]));
    return res;
  },
};
