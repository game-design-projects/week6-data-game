// #49 Old News — real OCR text from a century-old US newspaper front page; guess the year.

/** Words/phrases that date a text, with the year they became common in print. */
export const LEXICON = [
  ['telegraph', 1844, '电报'], ['railroad', 1830, '铁路'], ['slave', 1800, '奴隶制仍是公共议题'],
  ['secession', 1860, '分离/内战前夕'], ['rebel', 1861, '内战用语'], ['confederate', 1861, '南部邦联（1861 年起）'],
  ['reconstruction', 1865, '战后重建（1865 年起）'], ['telephone', 1877, '电话（1876 年发明）'], ['electric', 1880, '电气时代'],
  ['bicycle', 1885, '自行车热'], ['automobile', 1900, '汽车（1900 年后常见）'], ['aeroplane', 1908, '飞机（1908 年前后）'],
  ['airplane', 1912, '飞机'], ['kaiser', 1914, '一战（德皇）'], ['armistice', 1918, '一战停战'], ['prohibition', 1919, '禁酒令'],
  ['radio', 1922, '广播（1920 年代）'], ['depression', 1930, '大萧条'], ['nazi', 1933, '纳粹'], ['rationing', 1942, '二战配给'],
  ['atomic', 1945, '原子弹之后'], ['television', 1950, '电视'], ['communist', 1949, '冷战'],
];

/** Score for a year guess: 100 at 0 off, ~37 at `scale` years off. */
export const yearScore = (guess, answer, scale = 8) => 100 * Math.exp(-Math.abs(guess - answer) / scale);

export function findHints(text) {
  const low = text.toLowerCase();
  return LEXICON.filter(([w]) => low.includes(w)).map(([w, y, note]) => ({ w, y, note }));
}

export default {
  meta: {
    num: 49,
    slug: 'old-news',
    title: 'Old News',
    tagline: '一段真实的旧报纸 OCR 文字，没有日期、没有报头。读语言和时事，猜它出版于哪一年。',
    category: 'words',
    data: 'snapshot',
    howTo: [
      '每天三段美国旧报纸头版的真实文字（OCR 识别，难免有错字），年份数字已被涂掉。',
      '看用词和话题：电报、铁路、汽车、广播、战争名称、拼写习惯和商品广告，都在暴露年代。',
      '拖动滑块或输入年份，作答后立刻揭晓报纸、日期和出处。三段各算一轮。',
      '计分：每轮 100 × e^(−误差年数/8)，猜中 100 分，差 8 年约 37 分；总分为三轮平均。',
    ],
    scoring: '每轮 100 × e^(−|猜测年−实际年|/8)，三轮取平均。',
    sources: [
      { name: 'Library of Congress · Chronicling America', url: 'https://chroniclingamerica.loc.gov/', note: '头版 OCR（ALTO XML），经 loc.gov API 取得，公有领域' },
      { name: 'loc.gov API', url: 'https://www.loc.gov/apis/' },
    ],
    dataNote: '文字是未经校对的机器识别结果，错字和断词都是原样保留的；只截取了每份头版里识别质量最好的一段，并把 1500–1999 的四位年份替换为 ____。',
  },

  puzzle({ data, pick, rng }) {
    const first = pick(data.items);
    const far = data.items.filter((x) => Math.abs(x.year - first.year) >= 12);
    const rest = rng.sample(far, 2);
    return { ids: [first.id, ...rest.map((x) => x.id)] };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const byId = new Map(ctx.data.items.map((x) => [x.id, x]));
    const items = p.ids.map((id) => byId.get(id));
    const results = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      ctx.log(`round ${i + 1}`, it.id, it.year);
      const holder = ui.h('div', { class: 'ds-stack' });
      ctx.stage.append(holder);
      holder.append(ui.panel({ kicker: `第 ${i + 1} / ${items.length} 段 · ${it.text.length} 字符`, title: '这是哪一年的报纸？' },
        ui.quote(it.text)));
      const r = await ctx.estimate({
        container: holder, title: '你的猜测', answer: it.year, min: 1836, max: 1963, step: 1, initial: 1900,
        format: (v) => `${Math.round(v)} 年`, scoring: (g, a) => yearScore(g, a) / 100,
      });
      const hints = findHints(it.text);
      holder.append(ui.panel({ plain: true },
        ui.kv([
          ['实际年份', `${it.year}（${it.date}）`],
          ['报纸', `${it.paper}${it.place ? ' · ' + it.place : ''}`],
          ['误差', `${Math.abs(Math.round(r.guess) - it.year)} 年`],
          ['年代线索词', hints.length ? hints.map((h) => `${h.w}（${h.note}）`).join('、') : '这段里没有明显的时代词，要靠拼写与语气'],
        ]),
        ui.h('a', { href: it.url, target: '_blank', rel: 'noopener', class: 'small' }, '在 Chronicling America 查看原页 →')));
      results.push(r);
    }
    const res = ctx.combine(results);
    res.detail = ui.kv(items.map((it, i) => [`第 ${i + 1} 段`, `${it.year} · ${it.paper} · 你猜 ${Math.round(results[i].guess)}`]));
    return res;
  },
};
