// #21 Year Built — three photos of NYC buildings (Wikidata/Commons, year cross-checked against NYC PLUTO); guess the year each was built.
export const SCALE = 30;
export const MIN_YEAR = 1750;
export const MAX_YEAR = 2025;
/** 1 at 0 years off, 1/e at 30 years off. */
export const yearScore = (guess, answer) => Math.exp(-Math.abs(guess - answer) / SCALE);

export const thumb = (f) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=640`;

/** Era tiers: every daily puzzle has one early, one mid-century and one recent building (order shuffled). */
export const TIERS = [[0, 1900], [1900, 1950], [1950, 3000]];
export const tierOf = (items, [lo, hi]) => items.filter((b) => b.year >= lo && b.year < hi);

const CLASS = {
  A: '独栋住宅', B: '双户住宅', C: '无电梯公寓', D: '电梯公寓', E: '仓库', F: '厂房', G: '车库', H: '酒店', I: '医疗/社福设施',
  J: '剧院', K: '商铺', L: '阁楼式工业楼', M: '教堂/宗教建筑', N: '收容机构', O: '办公楼', P: '文化/公共设施', Q: '体育休闲设施',
  R: '住宅公寓', S: '底商住宅', U: '公用设施', W: '教育设施', Y: '政府机构', Z: '其他',
};
export const classLabel = (c) => CLASS[(c || '')[0]] || '建筑';

/** Era-specific teaching text used in the result card. */
export function eraClue(year) {
  if (year < 1830) return '联邦/殖民风格：低矮的砖石或木构，小窗格、对称立面，纽约这样的老房子极少。';
  if (year < 1880) return '19 世纪中叶：褐石或砖砌排屋、希腊复兴的门廊、铸铁立面和高而窄的窗，通常不超过 5–6 层。';
  if (year < 1915) return '1880–1915：钢框架和电梯让楼越盖越高，石灰岩/红砖立面配学院派或罗马式的繁复装饰（檐口、拱窗、雕饰）。';
  if (year < 1945) return '1915–1945：1916 年分区法逼出阶梯退台的塔楼，装饰艺术风格的竖线条、几何浮雕和棕黄色砖面是标志。';
  if (year < 1975) return '战后现代主义：去掉装饰，用白砖/浅色砖、通长的窗带和玻璃幕墙，板楼和公共住房塔楼大量出现。';
  if (year < 2000) return '1975–2000：后现代——抛弃纯盒子，回到色块、拱形与顶部造型，外墙常用深色砖和反光玻璃。';
  return '2000 年后：大面积玻璃幕墙、不规则体量和金属板，窗墙比极高，很少有传统装饰。';
}

export function floorClue(b) {
  if (!b.fl) return '';
  if (b.fl >= 30) return `${b.fl} 层的超高层只有钢框架时代才可能出现，它的高度本身就把年份限定在 1890 年之后。`;
  if (b.fl >= 12) return `${b.fl} 层的高楼需要钢框架和电梯，基本是 1890 年之后的产物。`;
  if (b.fl <= 4) return `只有 ${b.fl} 层：低层砖石建筑在 19 世纪最常见，但也可能是后来的低层公共或住宅楼。`;
  return `${b.fl} 层的中层楼，需要和立面材料、窗型一起判断。`;
}

export default {
  meta: {
    num: 21,
    slug: 'year-built',
    title: 'Year Built',
    tagline: '三张纽约建筑的照片，凭窗户、材料和装饰猜它们是哪一年建成的。',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      '每天三栋纽约建筑：一栋 1900 年前、一栋 1900–1949、一栋 1950 年后。名字先藏起来，只告诉你它在哪个区。',
      '看窗户、材料、装饰和轮廓，拖动滑块或输入建成年份（1750–2025）。',
      '计分：每栋 100·e^(−误差/30)，误差 0 年 100 分，30 年约 37 分，100 年几乎 0 分；三栋相加，满分 300。',
    ],
    scoring: '每栋 100·e^(−误差年数/30)，三栋相加，满分 300。',
    sources: [
      { name: 'Wikidata SPARQL（建成年份 P571、坐标、照片 P18）', url: 'https://query.wikidata.org/' },
      { name: 'Wikimedia Commons（照片与授权）', url: 'https://commons.wikimedia.org/' },
      { name: 'NYC PLUTO 地块数据（NYC Open Data，用于核对年份、层数和用途）', url: 'https://data.cityofnewyork.us/City-Government/Primary-Land-Use-Tax-Lot-Output-PLUTO-/64uk-42ks' },
    ],
    dataNote: '原想法是 Mapillary 街景 + PLUTO。Mapillary API 需要 key，不能放进前端，所以照片改用 Wikimedia Commons 上带建成年份的纽约建筑。'
      + '为避免维基数据里的“落成/启用年”或错误年份，只保留 PLUTO 中 45 米内某个地块的 yearbuilt 与 Wikidata 年份相差 ≤ 3 年的建筑；PLUTO 的年份仍是行政记录，改建过的楼可能与外观不完全一致。'
      + '照片是快照，不是实时街景。',
  },

  puzzle({ data, pick, rng }) {
    const items = TIERS.map((t) => pick(tierOf(data.items, t)));
    return { items: rng.shuffle(items) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const n = p.items.length;
    for (const b of p.items) { const im = new Image(); im.src = thumb(b.file); } // warm the cache
    const results = [];
    for (let i = 0; i < n; i++) {
      const b = p.items[i];
      ctx.log('round', i + 1, b.id);
      const img = ui.h('img', {
        src: thumb(b.file), alt: '一栋纽约建筑的照片', referrerpolicy: 'no-referrer',
        style: { display: 'block', margin: '0 auto', maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: 'var(--radius, 8px)', background: 'var(--paper2)', minHeight: '160px' },
      });
      const holder = ui.h('div', {}, img);
      img.addEventListener('error', () => {
        ctx.log.warn('image failed', b.id);
        holder.replaceChildren(ui.callout('照片没加载出来（Wikimedia Commons 暂时不可用）。可以凭所在区和直觉先猜一个年份。', 'warn'));
      });
      const panel = ui.panel({ kicker: `第 ${i + 1} / ${n} 栋`, title: '这栋楼哪年建成？' }, holder,
        ui.h('div', { class: 'small muted' }, `📍 ${b.boro || '纽约'}`));
      ctx.stage.append(panel);
      const r = await ctx.estimate({
        answer: b.year, min: MIN_YEAR, max: MAX_YEAR, step: 1, initial: 1900, format: (v) => String(Math.round(v)),
        scoring: yearScore, title: '建成年份', prompt: '拖动滑块或直接输入年份。',
      });
      const g = Math.round(r.guess);
      const off = Math.abs(g - b.year);
      panel.append(ui.callout(`${b.name} · ${b.year} 年`, off <= 10 ? 'good' : off <= 40 ? 'warn' : 'bad'));
      r.detail = ui.h('div', { class: 'ds-stack' },
        ui.kv([
          ['建筑', b.name],
          ['位置', b.addr ? `${b.boro} · ${b.addr}` : b.boro],
          ['建成', `${b.year} 年（Wikidata）· ${b.py} 年（PLUTO 地块记录）`],
          ['你猜', `${g} 年（差 ${off} 年，${Math.round(100 * yearScore(g, b.year))} 分）`],
          ['用途与层数', `${classLabel(b.cls)}${b.fl ? ` · ${b.fl} 层` : ''}`],
          ['照片', `${b.author} · ${b.lic}`],
        ]),
        ui.h('div', { class: 'small' }, `怎么看出来：${eraClue(b.year)}${floorClue(b) ? ' ' + floorClue(b) : ''}`));
      results.push(r);
    }
    const res = ctx.combine(results);
    res.detail = ui.h('div', { class: 'ds-stack' }, results.map((r) => r.detail));
    return res;
  },
};
