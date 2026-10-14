// #96 Missing Number — a World Bank "news brief" with three numbers blanked out; fill them in.
const zh = (cc) => { try { return new Intl.DisplayNames(['zh-Hans'], { type: 'region' }).of(cc); } catch { return cc; } };

export const fmtPop = (n) => (n >= 1e8 ? `${(n / 1e8).toFixed(2)} 亿` : `${(n / 1e4).toFixed(0).replace(/\B(?=(\d{3})+$)/g, ',')} 万`) + '人';
export const fmtSigned = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;

// how each fact is asked: estimate config + display text
export const FACTS = {
  pop:    { label: '总人口', min: 3e6, max: 1.5e9, log: true, scoring: 'log', scale: 0.3, unit: '人', fmt: fmtPop },
  gdp:    { label: '人均 GDP', min: 200, max: 150000, log: true, scoring: 'log', scale: 0.3, unit: '美元', fmt: (v) => `${Math.round(v).toLocaleString('en-US')} 美元` },
  growth: { label: '2012–2022 人口变化', min: -20, max: 80, scoring: 'abs', scale: 8, step: 0.1, unit: '%', fmt: fmtSigned },
  life:   { label: '人均预期寿命', min: 45, max: 90, scoring: 'abs', scale: 4, step: 0.1, unit: '岁', fmt: (v) => `${v.toFixed(1)} 岁` },
  urban:  { label: '城镇人口占比', min: 0, max: 100, scoring: 'abs', scale: 15, step: 0.1, unit: '%', fmt: (v) => `${v.toFixed(1)}%` },
  net:    { label: '互联网使用率', min: 0, max: 100, scoring: 'abs', scale: 15, step: 0.1, unit: '%', fmt: (v) => `${v.toFixed(1)}%` },
  unemp:  { label: '失业率', min: 0, max: 35, scoring: 'abs', scale: 4, step: 0.1, unit: '%', fmt: (v) => `${v.toFixed(1)}%` },
};
const KEYS = Object.keys(FACTS);
const LETTERS = ['甲', '乙', '丙'];

/** Sentence fragments of the brief; `k` marks a number slot. */
export function storyParts(c) {
  return [
    `据世界银行数据，${zh(c.cc)} ${c.year} 年总人口为 `, { k: 'pop' }, '，较 2012 年变化 ', { k: 'growth' },
    '。人均 GDP 为 ', { k: 'gdp' }, '；人均预期寿命 ', { k: 'life' }, '；城镇人口占比 ', { k: 'urban' },
    '；互联网使用率 ', { k: 'net' }, '；失业率 ', { k: 'unemp' }, '。',
  ];
}

const TIPS = {
  net: (c) => `互联网使用率和人均 GDP 高度相关：人均 GDP ${Math.round(c.gdp).toLocaleString('en-US')} 美元的国家，通常落在这个区间附近。`,
  urban: () => '城镇化率随收入上升，但产油国和小岛国是例外；高度城镇化的国家人口增长通常较慢。',
  life: () => '预期寿命随人均收入对数上升，且在 70 岁以上增速明显放缓。',
  gdp: () => '人均 GDP 跨度超过 100 倍，必须按数量级（对数）来估。',
  pop: () => '人口跨度超过 400 倍，先判断位数，再微调。',
  growth: () => '十年人口变化大约等于年增长率 × 10：非洲多数国家 25–35%，东欧部分国家为负。',
  unemp: () => '失业率大多在 3–10% 之间，南非等少数国家超过 20%。',
};

export default {
  meta: {
    num: 96,
    slug: 'missing-number',
    title: 'Missing Number',
    tagline: '一则世界银行数据快讯，三个数字被挖空了。读读剩下的数字，把空填回去。',
    category: 'model',
    data: 'snapshot',
    howTo: [
      '今天的快讯讲一个国家 2022 年的人口、经济与民生指标，其中三个数字被挖成【甲】【乙】【丙】。',
      '没被挖掉的数字就是线索：富裕国家上网率高、寿命长、城镇化率高；人口增长和失业率要结合其余数字判断。',
      '人口和人均 GDP 跨度巨大，滑块按数量级（对数）计；其余按差多少个单位计。',
      '每个空 100 分，三空取平均。',
    ],
    scoring: '人口、人均 GDP：差 2 倍约 37 分；其余指标按绝对误差衰减（寿命 4 岁、占比 15 个百分点、人口变化 8 点、失业 4 点 ≈ 37 分）。',
    sources: [
      { name: 'World Bank Open Data API', url: 'https://data.worldbank.org/', note: 'SP.POP.TOTL、NY.GDP.PCAP.CD、SP.DYN.LE00.IN、SP.URB.TOTL.IN.ZS、IT.NET.USER.ZS、SL.UEM.TOTL.ZS（2022）' },
    ],
    dataNote: '没有运行时 LLM：新闻稿由固定模板填入真实数值生成；每天挖空哪三个数字由日期随机决定。仅选取 2022 年六项指标齐全且人口超过 300 万的 123 个国家。',
  },

  puzzle({ data, rng, pick }) {
    const c = pick(data.countries);
    const blanks = rng.sample(KEYS, 3).sort((a, b) => KEYS.indexOf(a) - KEYS.indexOf(b)); // letters follow reading order
    return { cc: c.cc, blanks };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const c = ctx.data.countries.find((x) => x.cc === p.cc);
    const slot = Object.fromEntries(p.blanks.map((k, i) => [k, LETTERS[i]]));
    ctx.log('story', c.cc, p.blanks);

    const body = storyParts(c).map((s) => {
      if (typeof s === 'string') return s;
      return slot[s.k]
        ? ui.h('b', { style: { color: 'var(--accent)' }, class: 'mono' }, `【${slot[s.k]}】`)
        : ui.h('b', { class: 'mono' }, FACTS[s.k].fmt(c[s.k]));
    });
    ctx.stage.append(ui.panel({ kicker: '今日快讯', title: `${zh(c.cc)}：数字去哪了？` }, ui.h('p', { style: { lineHeight: 1.9, margin: 0 } }, ...body)));

    const results = [];
    for (const [i, k] of p.blanks.entries()) {
      const f = FACTS[k];
      const r = await ctx.estimate({
        title: `【${LETTERS[i]}】${f.label}`,
        prompt: `快讯里的【${LETTERS[i]}】是多少？`,
        answer: c[k], min: f.min, max: f.max, log: !!f.log, step: f.step,
        format: f.fmt, scoring: f.scoring, scale: f.scale,
      });
      ctx.log('blank', k, c[k], r.guess, r.score);
      results.push(r);
    }
    const res = ctx.combine(results);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({
        columns: [{ key: 'slot', label: '空' }, { key: 'what', label: '指标' }, { key: 'ans', label: '答案', num: true }, { key: 'you', label: '你的估计', num: true }],
        rows: p.blanks.map((k, i) => ({ slot: LETTERS[i], what: FACTS[k].label, ans: FACTS[k].fmt(c[k]), you: results[i].guess != null ? FACTS[k].fmt(results[i].guess) : '—' })),
      }),
      ...p.blanks.map((k) => ui.h('div', { class: 'small ink2' }, `${FACTS[k].label}：${TIPS[k](c)}`)));
    return res;
  },
};
