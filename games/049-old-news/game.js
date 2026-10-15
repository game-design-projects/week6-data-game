// #49 Old News — real OCR text from a century-old US newspaper front page; guess the year.

/** Words/phrases that date a text: [regex, Chinese note about the period]. */
export const LEXICON = [
  [/\btelegraph/i, '电报（1844 年起进入报纸）'], [/\brailroad|\brail-road/i, '铁路（1830 年代起）'],
  [/\bslave|\bnegro/i, '奴隶制 / 种族话题：内战前后的核心议题'], [/\bsecession|\bsecede/i, '分离问题：1860–61 年前后'],
  [/\brebel/i, '“叛军”：内战（1861–65）用语'], [/\bconfederate/i, '南部邦联（1861–65 年及战后回忆）'],
  [/\breconstruction/i, '战后重建（1865–77）'], [/\btelephone/i, '电话（1876 年发明）'], [/\belectric/i, '电气（1880 年代以后常见）'],
  [/\bbicycle/i, '自行车热（1880–90 年代）'], [/\bautomobile|\bmotor ?car/i, '汽车（1900 年后常见）'],
  [/\baeroplane|\baviator/i, '飞机（1908 年前后）'], [/\bairplane/i, '飞机（1912 年后）'], [/\bkaiser/i, '德皇：一战（1914–18）'],
  [/\barmistice/i, '一战停战（1918）'], [/\bprohibition|\bbootleg/i, '禁酒令（1920–33）'], [/\bradio/i, '广播（1920 年代起）'],
  [/\bdepression/i, '大萧条（1930 年代）'], [/\bnazi/i, '纳粹（1933 年后）'], [/\brationing|\bration board/i, '二战配给（1942–45）'],
  [/\batomic|\bnuclear/i, '原子能：1945 年之后'], [/\btelevision/i, '电视（1950 年代普及）'], [/\bcommunis/i, '共产主义：冷战（1947 年后）或红色恐慌'],
  [/\bpresident (lincoln|johnson|grant|hayes|garfield|cleveland|harrison|mckinley|roosevelt|taft|wilson|harding|coolidge|hoover|truman|eisenhower)/i, '文中提到的总统任期可以直接定位年代'],
  [/\bto-(day|morrow|night)\b/i, 'to-day / to-morrow 带连字符：1920 年前的老拼写'], [/\btho\b|\bthru\b|\bthro\b/i, 'tho / thru：1900 年代“简化拼写”运动'],
  [/&c\b/, '&c.（etc. 的旧写法）：多见于 19 世纪'], [/\bcents?\b.*\bper (pound|bushel|yard)/i, '商品按磅 / 蒲式耳标价：典型的 19 世纪广告'],
];

/** Historical backdrop by year range, shown after each guess to teach what to look for. */
export const ERAS = [
  [1840, 1849, '1840 年代：报纸四栏小字，辉格党与民主党之争、德州与墨西哥战争、电报刚刚出现。'],
  [1850, 1860, '1850 年代：逃奴法、堪萨斯—内布拉斯加之争，铁路迅速扩张，正文密排、几乎没有标题层次。'],
  [1861, 1865, '1861–65：内战。出现 rebel、Union、army、casualties 等战报用语。'],
  [1866, 1877, '1866–77：战后重建。自由人、选举权、国债、铁路特许是常见话题。'],
  [1878, 1899, '1878–99：镀金时代。电话、电灯、托拉斯、关税与专利药广告占据版面。'],
  [1900, 1913, '1900–13：进步时代。汽车、电话、托拉斯诉讼，开始使用大标题；简化拼写风潮。'],
  [1914, 1919, '1914–19：一战。战争债券、征兵、Kaiser、前线电讯和流感疫情。'],
  [1920, 1929, '1920 年代：禁酒、广播、爵士时代，股市热。'],
  [1930, 1939, '1930 年代：大萧条与新政缩写（WPA、NRA）、欧洲法西斯。'],
  [1940, 1945, '1940–45：二战。配给、战时生产、前线战报。'],
  [1946, 1963, '1946–63：战后与冷战。电视、郊区、民权运动、核威慑。'],
];
export const eraNote = (year) => (ERAS.find(([a, b]) => year >= a && year <= b) ?? [0, 0, ''])[2];

/** Score for a year guess: 100 at 0 off, ~37 at `scale` years off. */
export const yearScore = (guess, answer, scale = 10) => 100 * Math.exp(-Math.abs(guess - answer) / scale);

export function findHints(text) {
  return LEXICON.filter(([re]) => re.test(text)).map(([re, note]) => ({ w: (text.match(re) || [''])[0].trim(), note }));
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
      '每天三段美国旧报纸（1840–1962）头版的真实文字，OCR 识别，难免有错字；四位数年份已被涂成 ____。',
      '看用词和话题：电报、铁路、汽车、广播、战争名称、to-day 一类的老拼写、广告里的商品，都在暴露年代。',
      '拖动滑块或输入年份，作答后立刻揭晓报纸、日期、出处，以及这段文字里能定位年代的线索。三段各算一轮。',
      '计分：每轮 100 × e^(−误差年数/10)，猜中 100 分，差 10 年约 37 分；总分为三轮平均。',
    ],
    scoring: '每轮 100 × e^(−|猜测年−实际年|/10)，三轮取平均。',
    sources: [
      { name: 'Library of Congress · Chronicling America', url: 'https://chroniclingamerica.loc.gov/', note: '头版 OCR（ALTO XML），经 loc.gov API 取得，公有领域' },
      { name: 'loc.gov API', url: 'https://www.loc.gov/apis/' },
    ],
    dataNote: '文字是未经校对的机器识别结果，错字原样保留（仅按 ALTO 的断词标记还原了换行连字符）。每份头版只取识别置信度最高的一段；四位年份被替换为 ____，含“\'62”、星期+日期、卷号、报纸名等直接泄露年代的片段已剔除。数据为快照：来自 1840–1962 年每年随机抽取的头版，没有可靠的免密钥且允许跨域的实时来源，且题目本身不需要“当天”的数据。',
  },

  puzzle({ data, pick, rng }) {
    const first = pick(data.items);
    const chosen = [first];
    for (const x of rng.shuffle(data.items.slice())) {
      if (chosen.length === 3) break;
      if (chosen.every((c) => Math.abs(c.year - x.year) >= 12)) chosen.push(x);
    }
    return { ids: chosen.map((x) => x.id) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
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
        container: holder, title: '你的猜测', answer: it.year, min: 1840, max: 1963, step: 1, initial: 1900,
        format: (v) => `${Math.round(v)} 年`, scoring: (g, a) => yearScore(g, a) / 100,
      });
      const hints = findHints(it.text);
      r.hints = hints;
      holder.append(ui.panel({ plain: true },
        ui.kv([
          ['实际年份', `${it.year}（${it.date}）`],
          ['报纸', `${it.paper}${it.place ? ' · ' + it.place : ''}`],
          ['误差', `${Math.abs(Math.round(r.guess) - it.year)} 年`],
          ['文中的年代线索', hints.length ? hints.map((h) => `“${h.w}”：${h.note}`).join('；') : '这段里没有硬性的时代词，要靠拼写、话题与排印风格判断'],
          ['那个年代', eraNote(it.year)],
        ]),
        ui.h('a', { href: it.url, target: '_blank', rel: 'noopener', class: 'small' }, '在 Chronicling America 查看原页 →')));
      results.push(r);
    }
    const res = ctx.combine(results);
    res.detail = ui.kv(items.map((it, i) => [`第 ${i + 1} 段 · ${it.year}`,
      `${it.paper}（${it.date}）· 你猜 ${Math.round(results[i].guess)}，差 ${Math.abs(Math.round(results[i].guess) - it.year)} 年。${results[i].hints.length ? '线索：' + results[i].hints.map((h) => h.note).join('；') : eraNote(it.year)}`]));
    return res;
  },
};
