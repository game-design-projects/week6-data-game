// #101 Spotter — a plane-spotter's photo; name the airport, then the airline, type and season.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

const QUARTERS = [
  { label: '12–2 月', months: [12, 1, 2] },
  { label: '3–5 月', months: [3, 4, 5] },
  { label: '6–8 月', months: [6, 7, 8] },
  { label: '9–11 月', months: [9, 10, 11] },
];
export const quarterOf = (date) => QUARTERS.findIndex((q) => q.months.includes(+date.slice(5, 7)));
/** First word of a type ("Boeing 737-800" -> "Boeing") groups manufacturers for plausible decoys. */
export const maker = (t) => t.split(' ')[0];

/** Airlines whose liveries look alike (Lufthansa / Lufthansa Cargo, Air Canada / Air Canada Rouge) share a brand key. */
export function opBrand(op) {
  const w = op.split(/\s+/);
  if (['Air', 'Eastern', 'Western', 'Hong', 'China'].includes(w[0])) return w.slice(0, 2).join(' ').toLowerCase();
  return w[0].toLowerCase();
}

/** Pick `n` decoys, preferring same-group values, never equal to the answer nor `clash`-ing with it. */
export function decoys(rng, pool, answer, n, group = () => 0, clash = () => false) {
  const uniq = [...new Set(pool)].filter((x) => x !== answer && !clash(x, answer));
  const near = rng.shuffle(uniq.filter((x) => group(x) === group(answer)));
  const far = rng.shuffle(uniq.filter((x) => group(x) !== group(answer)));
  return [...near, ...far].slice(0, n);
}

export default {
  meta: {
    num: 101,
    slug: 'spotter',
    title: 'Spotter',
    tagline: '一张飞友拍的真实照片：先猜机场，再认航司、机型和拍摄月份。',
    category: 'transit',
    data: 'snapshot',
    howTo: [
      '看一张飞友在机场拍的真实照片，从列表里猜它是在哪个机场拍的，最多 6 次。每猜错一次多解锁一条线索（大洲、国家、半球、IATA 首字母）。',
      '每次猜测会显示你猜的机场离答案多远、在哪个方向、是否同国。',
      '猜完机场后再答三道选择题：这是哪家航司？什么机型？照片拍于哪几个月？',
      '窍门：机身涂装和尾翼是航司的指纹；发动机数量、机身长度和翼尖小翼是机型的指纹；背景里的植被、积雪、日照角度和地勤车辆透露地点与季节。',
    ],
    scoring: '共 200 分：机场 100 分（第 1 次猜中满分，之后每多猜一次少约 17 分，6 次内没猜中为 0），三道选择题合占 100 分（每题约 33 分）。',
    sources: [
      { name: 'Wikimedia Commons（照片与分类）', url: 'https://commons.wikimedia.org/wiki/Category:Aircraft_by_airport', note: '分类名 “机型 of 航司 at 机场” 即答案；拍摄日期来自照片 EXIF / 描述' },
      { name: 'Wikimedia Commons API', url: 'https://commons.wikimedia.org/w/api.php' },
    ],
    dataNote: '照片取自 Commons 的 “机型 of 航司 at 机场” 分类，分类即答案来源，由志愿者维护，偶有误标；构建时已用文件名/描述交叉核对，剔除明显误标（标题写着别家航司或别的制造商）、竖构图和缺拍摄月份的照片，机型已合并为系列（如 A320neo 并入 A320），并避免把涂装相近的子品牌（如 Lufthansa / Lufthansa Cargo）同时放进选项。原创意中的“打码注册号 + OpenSky 历史航线”未实现：OpenSky 的历史航班接口需要账号（匿名访问已不可用），浏览器端也无法可靠地给注册号打码，所以替换为“机场 + 航司 + 机型 + 月份”四问；照片上可能看得到注册号，这是真实照片的一部分。答题前不显示原图页面链接，以免从文件名泄露答案。',
  },

  puzzle({ data, rng, pick }) {
    const photo = pick(data.photos);
    const ap = data.airports.find((a) => a.iata === photo.iata);
    const sameCont = data.photos.filter((p) => data.airports.find((a) => a.iata === p.iata).cont === ap.cont);
    const ops = decoys(rng, [...sameCont, ...data.photos].map((p) => p.op), photo.op, 3, () => 0, (a, b) => opBrand(a) === opBrand(b));
    const types = decoys(rng, data.photos.map((p) => p.type), photo.type, 3, maker);
    const opts = (ans, ds) => { const all = rng.shuffle([ans, ...ds]); return { opts: all, correct: all.indexOf(ans) }; };
    return { photo, op: opts(photo.op, ops), type: opts(photo.type, types) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const ph = p.photo;
    const byIata = new Map(ctx.data.airports.map((a) => [a.iata, a]));
    const ans = byIata.get(ph.iata);
    ctx.log('photo', ph.iata, ph.op, ph.type, ph.date);

    ctx.stage.append(ui.panel({ kicker: '今日照片', title: '这架飞机在哪拍的？' },
      ui.h('div', { style: { background: 'var(--paper-2, rgba(128,128,128,.12))', borderRadius: '8px', overflow: 'hidden' } },
        ui.h('img', { src: ph.thumb, alt: '一张飞机照片（出处在答题后显示）', referrerpolicy: 'no-referrer', style: { width: '100%', maxHeight: '62vh', objectFit: 'contain', display: 'block' } })),
      ui.h('div', { class: 'small muted', style: { marginTop: '6px' } }, '摄影者与原图链接在答题结束后显示。')));

    const clues = [
      '看照片：涂装、地勤车辆、背景地形和植被。',
      `大洲：${ans.cont}`,
      `国家 / 地区：${ans.country}`,
      `半球：${ans.lat >= 0 ? "北半球" : "南半球"}（季节与此相关）`,
      `机场 IATA 代码以 “${ans.iata[0]}” 开头。`,
    ];
    const ap = await ctx.guess({
      options: ctx.data.airports.map((a) => ({ id: a.iata, label: a.zh, hint: a.iata, aliases: [a.en, a.iata, a.country] })),
      answer: ans.iata,
      maxGuesses: 6,
      title: '第一问：哪个机场？',
      placeholder: '输入机场名或 IATA 代码…',
      clues,
      cluesTitle: '线索',
      columns: ['距离', '方向', '同国'],
      near: (g, a) => haversineKm(byIata.get(g.id), byIata.get(a.id)) < 1500,
      feedback: (g) => {
        const ga = byIata.get(g.id);
        if (ga.iata === ans.iata) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, { text: '✓', state: 'hit' }];
        const km = haversineKm(ga, ans);
        return [
          { text: fmtKm(km), num: true, state: km < 1500 ? 'near' : undefined },
          { text: arrow(bearingDeg(ga, ans)) },
          ga.country === ans.country ? { text: '同国', state: 'near' } : { text: '不同', state: undefined },
        ];
      },
    });
    ctx.log('airport stage', ap.score);

    const q = quarterOf(ph.date);
    const rd = await ctx.rounds({
      rounds: [
        { prompt: '第二问：这是哪家航司的飞机？', options: p.op.opts.map((label) => ({ label })), correct: p.op.correct, explain: `答案：${ph.op}` },
        { prompt: '第三问：这是什么机型？', options: p.type.opts.map((label) => ({ label })), correct: p.type.correct, explain: `答案：${ph.type}` },
        { prompt: '第四问：照片拍于哪几个月？', options: QUARTERS.map((x) => ({ label: x.label })), correct: q, explain: `拍摄日期 ${ph.date}` },
      ],
    });

    const res = ctx.combine([ap, { ...rd, score: (rd.score / rd.max) * 100, max: 100 }]);
    res.summary = `${ans.iata} · ${rd.score}/${rd.max}`;
    const mon = +ph.date.slice(5, 7);
    const north = ans.lat >= 0;
    const NORTH = ['冬', '冬', '春', '春', '春', '夏', '夏', '夏', '秋', '秋', '秋', '冬'];
    const season = (north ? NORTH[mon - 1] : NORTH[(mon + 5) % 12]) + '季';
    res.detail = ui.kv([
      ['机场', `${ans.zh}（${ans.iata}，${ans.en}，${ans.country}）`],
      ['航司', ph.op],
      ['机型', ph.type],
      ['拍摄日期', `${ph.date}（${north ? '北' : '南'}半球${season}）`],
      ['出处', ui.h('a', { href: ph.page, target: '_blank', rel: 'noopener' }, `${ph.by} · ${ph.lic} · Wikimedia Commons`)],
      ['这张照片的线索', `涂装是 ${ph.op}：看它的主要运营地区，就能把 ${ans.zh} 缩到${ans.cont}；${ph.type} 是这家航司的常见机型。${north ? '北' : '南'}半球 ${mon} 月是${season}——画面里的植被、积雪与光线角度要和这个季节对得上。`],
      ['怎么认机型', '数发动机（2 台或 4 台）、看机身长度与有没有翼尖小翼；波音多为尖锥形尾椎和锯齿状发动机罩，空客多为圆润的机头与大舱门。'],
    ]);
    return res;
  },
};
