// #98 Described — text-only GeoGuessr. A photo was described offline; you only read the description.
export const WORLD = [[-58, -170], [78, 180]];

/** Everything in `q` that is visible before the guess — used by tests to scan for answer leaks. */
export function visibleText(q) {
  return [q.desc, q.signs].filter(Boolean).join('\n');
}

export default {
  meta: {
    num: 98,
    slug: 'described',
    title: 'Described',
    tagline: '纯文字版 GeoGuessr：只读一段街景照片的描述，不看图，在世界地图上标点。',
    category: 'model',
    data: 'snapshot',
    howTo: [
      '读懂这段对照片的描述：车辆、建筑材料、植被、气候、行人穿着，都是线索。',
      '如果照片里有清晰的文字，会单独列出来。认出文字的语言或字母，往往就能缩到一两个国家。',
      '在世界地图上点出你认为照片拍摄的位置（地图在你确认之前没有任何地名），然后确认。',
      '揭晓时会显示原照片，并指出描述里的哪一点暴露了位置。',
    ],
    scoring: '100 × e^(−距离/2000 km)：误差 0 km 得 100 分，约 2,000 km 得 37 分，猜到正确大洲通常能拿 20 分以上。',
    sources: [
      { name: 'Wikimedia Commons：带坐标的街景照片', url: 'https://commons.wikimedia.org/wiki/Commons:Geocoding', note: '通过 MediaWiki geosearch API 取得照片与坐标，作者和许可证随照片显示' },
      { name: 'MediaWiki API: GeoData / geosearch', url: 'https://www.mediawiki.org/wiki/Extension:GeoData' },
    ],
    dataNote: '原计划使用 Mapillary，但它的接口需要 API 密钥，而且不能在浏览器里直接使用，所以换成了 Wikimedia Commons 上带地理坐标的街景照片（无需密钥）。浏览器里没有视觉模型：描述是在构建阶段由 AI 对每张照片逐张看图后离线写成的，只描述画面，不写地名。坐标是 Commons 用户给照片标注的位置，可能是拍摄点，也可能是被拍摄物体的位置，误差一般在几百米到几公里。',
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

    // Whole-world fit at any width: fractional zoom, minZoom 0, refit until the player touches the map.
    const fitWorld = async ({ map, el }) => {
      map.options.zoomSnap = 0;
      map.options.zoomDelta = 0.5;
      map.setMinZoom(0);
      let touched = false;
      for (const ev of ['pointerdown', 'wheel']) el.addEventListener(ev, () => { touched = true; }, { once: true, passive: true });
      const fit = () => { if (!touched && el.clientWidth) map.fitBounds(WORLD, { animate: false, padding: [2, 2] }); };
      fit();
      requestAnimationFrame(fit);
      map.on('resize', fit);
      ctx.log('fit world', { w: el.clientWidth, h: el.clientHeight });
    };

    const res = await ctx.pin({
      answer: { lat: q.lat, lng: q.lng, label: `${q.cityZh}，${q.country}` },
      view: { center: [20, 10], zoom: 1, minZoom: 0 },
      height: 'min(60vw, 420px)',
      scale: 2000,
      title: '它拍摄于哪里？',
      setup: fitWorld,
    });

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('img', { src: q.img, alt: `${q.cityZh}：${q.title}`, loading: 'lazy', style: { width: '100%', height: 'auto', borderRadius: 'var(--radius, 8px)', display: 'block' } }),
      ui.kv([
        ['地点', `${q.cityZh}（${q.city}），${q.country}`],
        ['线索', q.why],
        ['图片来源', `${q.artist || '未知作者'} · ${q.lic || ''}`],
        ['原页面', ui.h('a', { href: q.page, target: '_blank', rel: 'noopener' }, 'Wikimedia Commons')],
      ]));
    return res;
  },
};
