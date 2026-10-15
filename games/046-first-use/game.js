// #46 First Use — guess the year a word first appeared in written English (Online Etymology Dictionary dates).
export const MIN_YEAR = 1500;
export const MAX_YEAR = 2020;

/** Free zone (years): exact-year entries ±2, decade entries ("1560s") cover the whole decade (±5 around the midpoint). */
export const freeZone = (item) => (item.d ? 5 : 2);

/** Score 0..1: full marks inside the free zone, then decays with the error (scale 60 years). */
export function yearScore(guess, answer, free = 2, scale = 60) {
  const err = Math.max(0, Math.abs(guess - answer) - free);
  return Math.exp(-err / scale);
}

/** "1560 年代" for decade entries, "1862 年" for exact ones. */
export const fmtYear = (item) => (item.d ? `${item.y - 5} 年代` : `${item.y} 年`);

const IBERIAN = /西班牙语|葡萄牙语|纳瓦特尔|加勒比|阿拉瓦克/;
const CLASSICAL = /拉丁语|希腊语/;

/** One sentence tying this puzzle's origin language and date to a general pattern in how English grew. */
export function pattern(item) {
  const { o, y } = item;
  if (IBERIAN.test(o) && y < 1800) return '西班牙、葡萄牙商船把美洲和亚洲的作物、器物带回欧洲，名字也跟着借进英语——这类词集中在 16–17 世纪。';
  if (/意大利语/.test(o)) return y < 1700 ? '文艺复兴时期意大利的科学、建筑、音乐和航海词汇大量流入英语，16–17 世纪是高峰。' : '18 世纪起英国人游学意大利，音乐、饮食和旅行相关的意大利词汇随之进入英语。';
  if (/法语/.test(o)) return y < 1700 ? '法语长期是英语最大的借词来源，16–17 世纪又有大批学术、宫廷和军事词汇从法语转入。' : '18–19 世纪借自法语的词多与时尚、餐饮、外交和艺术沙龙有关。';
  if (CLASSICAL.test(o)) return y < 1700 ? '文艺复兴学者直接从拉丁语、希腊语搬词进英语，学术和医学词汇在 16–17 世纪大量出现。' : y < 1900 ? '19 世纪科学分科迅速增多，新学科和新物质常用拉丁、希腊词根现造名字。' : '20 世纪的医学和化学新名词仍沿用拉丁、希腊词根来造。';
  if (/德语|荷兰语|低地德语|挪威语|古诺尔斯语/.test(o)) return y < 1700 ? '航海、贸易和战争把低地国家与北欧的词汇带进了英语，多是与船、钱、日用品有关的词。' : '19–20 世纪德语在化学、心理学、医学等科学领域贡献了大量术语。';
  if (/日语/.test(o)) return '日语借词在 18 世纪起零星出现，真正增多要到 19 世纪末开放通商之后，现代流行文化词更晚。';
  if (/印地|梵语/.test(o)) return '英国东印度公司和殖民统治期间（18–19 世纪），印度的宗教与日常用语陆续借入英语。';
  if (/西非/.test(o)) return '来自非洲语言的词多经加勒比和美国南方的奴隶社会进入英语，书面记录往往要到 19 世纪。';
  if (/来源不明/.test(o)) return '来源不明的口语、俚语词，书面记录往往比口头出现晚得多，年代难以靠词形推断——要靠它指代的事物和语体来猜。';
  if (/人名/.test(o)) return '以人名命名的新事物，往往在这个人活跃的那几十年里立刻有了名字。';
  if (y >= 1950) return '二战后的科技（电子、计算机、网络）不断用合成词、缩略词和商标造新词，这类词几乎都出自 20 世纪下半叶。';
  if (y >= 1900) return '20 世纪初的新发明和大众文化（交通、电影、广播、营养学）用拼合、缩写的方式快速造出新词。';
  if (y >= 1800) return '工业革命带来的新事物和新休闲方式，常用现成的英语词拼合或缩略而成。';
  return '这类词在英语内部拼合、派生或缩略而成，不靠借词，所以年代主要跟着它所指的新事物出现的时间走。';
}

export default {
  meta: {
    num: 46,
    slug: 'first-use',
    title: 'First Use',
    tagline: '给你一个英语单词和中文释义，猜它最早见于书面英语的年份。',
    category: 'words',
    data: 'snapshot',
    howTo: [
      '屏幕上是一个英语单词、它的中文释义和词源语言。想想这件事物是什么时候才有的、这个词是从哪种语言借来的。',
      '拖动滑块或直接输入年份（1500–2020），每天最多 3 次机会；每次提交后提示“更早”或“更晚”。',
      '词典对较早的词只记录到“某某年代”，这类词落在那十年内都算命中；其余词误差 2 年以内算命中。',
      '计分：命中得满分，之后每差 60 年左右分数降到约 37%；每多用一次机会 −10%。',
    ],
    scoring: '100 × e^(−(|误差|−容差)/60)，容差 2 年（十年期词条为整个十年）；每多用一次机会 −10%。',
    sources: [
      { name: 'Online Etymology Dictionary（etymonline.com）', url: 'https://www.etymonline.com/', note: '每个词条开头的年份即该词（该义项）最早的书面证据' },
      { name: 'yosevu/etymonline（GitHub 上的词条数据镜像）', url: 'https://github.com/yosevu/etymonline', note: '本游戏使用其中的 index.json' },
    ],
    dataNote: '原想用 Merriam-Webster 的 First Known Use，但它没有开放 API 且禁止抓取，所以改用 Online Etymology Dictionary 的词条首年。从 etymonline 数据里手工挑出 130 个释义明确、词义没有大变化的词，中文释义为人工撰写；1500 年以前的词条只写到“14 世纪晚期”这类世纪精度，无法出成“猜年份”题，所以没有收录。个别年份与 MW/OED 可能差几年——各词典对“最早”的判定不同。',
  },

  puzzle({ data, pick }) {
    const x = pick(data.words);
    return { w: x.w, zh: x.zh, p: x.p, y: x.y, d: x.d, o: x.o, ex: x.ex };
  },

  async play(ctx, item) {
    const { ui, core } = ctx;
    ctx.log('word', item.w, item.y, item.d ? 'decade' : 'exact', item.o);
    const POS = { n: '名词', v: '动词', adj: '形容词', adv: '副词' };

    ctx.stage.append(ui.panel({ kicker: '英语单词', title: item.w },
      ui.h('p', { class: 'ink2' }, `${POS[item.p] ? POS[item.p] + ' · ' : ''}${item.zh}`),
      ui.h('div', { class: 'ds-row' }, ui.badge(`词源：${item.o}`), ui.badge(`${item.w.length} 个字母`))));

    const res = await ctx.estimate({
      title: '它最早出现在哪一年？',
      answer: item.y, min: MIN_YEAR, max: MAX_YEAR, step: 1, initial: 1800,
      format: (v) => `${Math.round(v)} 年`,
      attempts: 3, tolerance: freeZone(item),
      scoring: (g, a) => yearScore(g, a, freeZone(item)),
    });

    const same = ctx.data.words.filter((x) => x.w !== item.w && Math.abs(x.y - item.y) <= 20).slice(0, 5);
    res.detail = ui.kv([
      ['答案', `${item.w}（${item.zh}）：${fmtYear(item)}${item.d ? '（词典只记到十年）' : ''}`],
      ['规律', pattern(item)],
      ['词典原文', item.ex],
      ['同期的词', same.length ? same.map((x) => `${x.w} (${x.d ? `${x.y - 5}s` : x.y})`).join('、') : '—'],
    ]);
    ctx.log('result', res.score, res.guess);
    return res;
  },
};
