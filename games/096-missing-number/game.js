// #96 Missing Number — a data "news brief" with three numbers blanked out; fill them in.
// Two kinds of brief: World Bank country profile (snapshot) and the USGS global earthquake tally of a recent UTC day (live).
import { dayStats, QUAKE_RANGE } from './quake.js';

const zh = (cc) => { try { return new Intl.DisplayNames(['zh-Hans'], { type: 'region' }).of(cc); } catch { return cc; } };

export const fmtPop = (n) => (n >= 1e8 ? `${(n / 1e8).toFixed(2)} 亿` : `${(n / 1e4).toFixed(0).replace(/\B(?=(\d{3})+$)/g, ',')} 万`) + '人';
export const fmtSigned = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;
const fmtTimes = (v) => `${Math.round(v)} 次`;
const fmtPct = (v) => `${v.toFixed(1)}%`;

const [Q25, Q45, Q5, QMAG, QDEP] = ['q25', 'q45', 'q5', 'qmag', 'qdep'].map((k) => QUAKE_RANGE[k]);
// how each fact is asked: estimate config + display text
export const FACTS = {
  pop:    { label: '总人口', min: 3e6, max: 1.5e9, log: true, scoring: 'log', scale: 0.3, unit: '人', fmt: fmtPop },
  gdp:    { label: '人均 GDP', min: 200, max: 150000, log: true, scoring: 'log', scale: 0.3, unit: '美元', fmt: (v) => `${Math.round(v).toLocaleString('en-US')} 美元` },
  growth: { label: '2012–2022 人口变化', min: -20, max: 80, scoring: 'abs', scale: 8, step: 0.1, unit: '%', fmt: fmtSigned },
  life:   { label: '人均预期寿命', min: 45, max: 90, scoring: 'abs', scale: 4, step: 0.1, unit: '岁', fmt: (v) => `${v.toFixed(1)} 岁` },
  urban:  { label: '城镇人口占比', min: 0, max: 100, scoring: 'abs', scale: 15, step: 0.1, unit: '%', fmt: fmtPct },
  net:    { label: '互联网使用率', min: 0, max: 100, scoring: 'abs', scale: 15, step: 0.1, unit: '%', fmt: fmtPct },
  unemp:  { label: '失业率', min: 0, max: 35, scoring: 'abs', scale: 4, step: 0.1, unit: '%', fmt: fmtPct },
  q25:    { label: 'M2.5 以上地震次数', min: Q25[0], max: Q25[1], scoring: 'abs', scale: 25, step: 1, unit: '次', fmt: fmtTimes },
  q45:    { label: 'M4.5 以上地震次数', min: Q45[0], max: Q45[1], scoring: 'abs', scale: 8, step: 1, unit: '次', fmt: fmtTimes },
  q5:     { label: 'M5 以上地震次数', min: Q5[0], max: Q5[1], scoring: 'abs', scale: 3, step: 1, unit: '次', fmt: fmtTimes },
  qmag:   { label: '当天最强震级', min: QMAG[0], max: QMAG[1], scoring: 'abs', scale: 0.5, step: 0.1, unit: '级', fmt: (v) => `M${v.toFixed(1)}` },
  qdep:   { label: '当天最深震源', min: QDEP[0], max: QDEP[1], scoring: 'abs', scale: 100, step: 1, unit: '公里', fmt: (v) => `${Math.round(v)} 公里` },
};
export const CKEYS = ['pop', 'growth', 'gdp', 'life', 'urban', 'net', 'unemp'];
export const QKEYS = ['q25', 'q45', 'q5', 'qmag', 'qdep'];
const LETTERS = ['甲', '乙', '丙'];
export const LAG_DAYS = 3; // USGS catalogue is still being reviewed for the last ~2 days; 3 days back is stable for every player

/** Sentence fragments of the brief; `k` marks a number slot. */
export function storyParts(c) {
  return [
    `据世界银行数据，${zh(c.cc)} ${c.year} 年总人口为 `, { k: 'pop' }, '，较 2012 年变化 ', { k: 'growth' },
    '。人均 GDP 为 ', { k: 'gdp' }, '；人均预期寿命 ', { k: 'life' }, '；城镇人口占比 ', { k: 'urban' },
    '；互联网使用率 ', { k: 'net' }, '；失业率 ', { k: 'unemp' }, '。',
  ];
}
export function quakeParts(s) {
  return [
    `据美国地质调查局（USGS）统计，${s.d}（UTC）全球共记录到 M2.5 以上地震 `, { k: 'q25' }, '，其中 M4.5 以上 ', { k: 'q45' },
    '、M5 以上 ', { k: 'q5' }, `。当天最强的一次为 `, { k: 'qmag' }, `，震中在 ${s.magPlace}；震源最深的一次达 `, { k: 'qdep' }, `，位于 ${s.depPlace}。`,
  ];
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

// which known fact predicts which blank (first one that is not itself blanked wins)
const PREDICT = {
  life: ['gdp', 'net', 'urban'], urban: ['gdp', 'net', 'life'], net: ['gdp', 'life', 'urban'], unemp: ['gdp', 'life', 'net'],
  growth: ['gdp', 'life', 'urban'], gdp: ['net', 'life', 'urban'],
};
const logKeys = new Set(['pop', 'gdp']);

/** The country-brief explanation for one blank: how the nearest neighbours on a known fact answer it. */
export function countryTip(k, c, countries, blanks) {
  const f = FACTS[k];
  if (k === 'pop') {
    const rank = countries.filter((x) => x.pop > c.pop).length + 1;
    return `人口无法从收入、寿命等指标推断，只能靠地理常识：${zh(c.cc)}在 ${countries.length} 个样本国家中排第 ${rank}，正确答案 ${f.fmt(c.pop)}。`;
  }
  const p = PREDICT[k].find((x) => !blanks.includes(x));
  const pf = FACTS[p];
  const v = (x, key) => (logKeys.has(key) ? Math.log(x[key]) : x[key]);
  const near = countries.filter((x) => x.cc !== c.cc).sort((a, b) => Math.abs(v(a, p) - v(c, p)) - Math.abs(v(b, p) - v(c, p))).slice(0, 15);
  const vals = near.map((x) => x[k]);
  return `线索是【${pf.label} ${pf.fmt(c[p])}】：与它最接近的 15 个国家，${f.label}中位数是 ${f.fmt(median(vals))}（常见范围 ${f.fmt(quant(vals, 0.1))} 至 ${f.fmt(quant(vals, 0.9))}）；${zh(c.cc)}实际为 ${f.fmt(c[k])}。`;
}

/** The earthquake-brief explanation for one blank, using the pool of other days as the base rate. */
export function quakeTip(k, s, pool) {
  const f = FACTS[k];
  const others = pool.filter((x) => x.d !== s.d);
  const med = median(others.map((x) => x[k]));
  const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(0)}%` : '—');
  const base = `近半年 ${others.length} 天的中位数是 ${f.fmt(med)}`;
  if (k === 'q25') return `${base}。M4.5 以上通常占 M2.5 以上的 ${pct(median(others.map((x) => x.q45)), median(others.map((x) => x.q25)))}：当天 ${s.q45} 次 ÷ 比例，就能反推总次数（实际 ${s.q25} 次，占 ${pct(s.q45, s.q25)}）。`;
  if (k === 'q45') return `${base}。震级每高 0.5 级，次数大约减半：当天 M2.5 以上 ${s.q25} 次，M4.5 以上占 ${pct(s.q45, s.q25)}（实际 ${s.q45} 次）。`;
  if (k === 'q5') return `${base}。次数随震级递减（古登堡–里克特定律）：M5 以上约为 M4.5 以上的 ${pct(median(others.map((x) => x.q5)), median(others.map((x) => x.q45)))}，当天 ${s.q5} / ${s.q45}。`;
  if (k === 'qmag') {
    const sim = [...others].sort((a, b) => Math.abs(a.q5 - s.q5) - Math.abs(b.q5 - s.q5)).slice(0, 12).map((x) => x.qmag);
    return `当天 M5 以上共 ${s.q5} 次；历史上 M5 以上次数最接近的 ${sim.length} 天里，最强震级中位数是 M${median(sim).toFixed(1)}。实际最强 M${s.qmag.toFixed(1)}（${s.magPlace}）。`;
  }
  const deepShare = others.filter((x) => x.qdep > 300).length / others.length;
  return `${base}；约 ${(deepShare * 100).toFixed(0)}% 的日子里最深震源超过 300 公里，这类深震集中在汤加–斐济、印尼、日本和南美俯冲带。当天最深 ${s.qdep} 公里（${s.depPlace}）。`;
}

/** Live: yesterday-ish (UTC, LAG_DAYS back) tally from the USGS FDSN API. Returns null when the day is unusable. */
export function toQuake(geojson, date) {
  return dayStats(geojson?.features, date);
}

export default {
  meta: {
    num: 96,
    slug: 'missing-number',
    title: 'Missing Number',
    tagline: '一则数据快讯，三个数字被挖空了。读读剩下的数字，把空填回去。',
    category: 'model',
    data: 'live',
    howTo: [
      '每天一则快讯，其中三个数字被挖成【甲】【乙】【丙】：每逢第 3、6、9…期是 USGS 全球地震快讯（前几天的真实统计），其余日子是一个国家 2022 年的人口与民生概况（世界银行）。',
      '没被挖掉的数字就是线索：地震次数随震级成比例递减；富裕国家上网率高、寿命长、城镇化率高。',
      '人口和人均 GDP 跨度巨大，滑块按数量级（对数）计；其余按差多少个单位计。',
      '每个空 100 分，三空取平均。结果页会告诉你每个空本可以怎样推出来。',
    ],
    scoring: '人口、人均 GDP：差 2 倍约 37 分；其余按绝对误差衰减，误差等于「容差」时约 37 分（寿命 4 岁、占比 15 个百分点、人口变化 8 点、失业 4 点、地震次数 25/8/3 次、震级 0.5 级、深度 100 公里）。',
    sources: [
      { name: 'USGS Earthquake Catalog (FDSN Event API)', url: 'https://earthquake.usgs.gov/fdsnws/event/1/', note: '地震快讯：全球 M2.5 以上、按 UTC 日统计，实时拉取 3 天前那一天' },
      { name: 'World Bank Open Data API', url: 'https://data.worldbank.org/', note: 'SP.POP.TOTL、NY.GDP.PCAP.CD、SP.DYN.LE00.IN、SP.URB.TOTL.IN.ZS、IT.NET.USER.ZS、SL.UEM.TOTL.ZS（2022）' },
    ],
    dataNote: '没有运行时 LLM：新闻稿由固定模板填入真实数值生成，每天挖空哪三个数字由日期随机决定。地震快讯在浏览器里实时请求 USGS（取 3 天前的 UTC 日，此时目录已审核完毕，所有玩家拿到同一份数字），失败时用 2026-04-16 至 2026-10-12 的快照；国家快讯用世界银行 2022 年数据（年度指标，世界银行没有按日更新的版本，所以这一部分是快照），只选取六项指标齐全、人口超过 300 万、答案落在滑块范围内的 122 个国家，因此中非共和国（预期寿命 18.8 岁）等极端值被排除。',
  },

  puzzle({ data, day, rng, pick }) {
    if (day % 3 === 0) {
      const s = data.live ?? pick(data.quakes);
      const blanks = rng.sample(QKEYS, 3).sort((a, b) => QKEYS.indexOf(a) - QKEYS.indexOf(b));
      return { kind: 'quake', s, blanks };
    }
    const c = pick(data.countries);
    const blanks = rng.sample(CKEYS, 3).sort((a, b) => CKEYS.indexOf(a) - CKEYS.indexOf(b)); // letters follow reading order
    return { kind: 'country', cc: c.cc, blanks };
  },

  async load(ctx) {
    if (ctx.day % 3 !== 0) return null; // country days use the (annual, final) snapshot
    const date = ctx.core.addDays(ctx.date, -LAG_DAYS);
    const next = ctx.core.addDays(date, 1);
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${date}&endtime=${next}&minmagnitude=2.5&orderby=time&limit=2000`;
    const raw = await ctx.fetchJSON(url, { timeout: 9000 });
    const live = toQuake(raw, date);
    if (!live) throw new Error(`USGS ${date}: unusable day`);
    ctx.log('live quake day', date, live);
    return { ...ctx.data, live };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const quake = p.kind === 'quake';
    const c = quake ? p.s : ctx.data.countries.find((x) => x.cc === p.cc);
    const slot = Object.fromEntries(p.blanks.map((k, i) => [k, LETTERS[i]]));
    ctx.log('story', p.kind, quake ? c.d : c.cc, p.blanks);

    const body = (quake ? quakeParts(c) : storyParts(c)).map((s) => {
      if (typeof s === 'string') return s;
      return slot[s.k]
        ? ui.h('b', { style: { color: 'var(--accent)' }, class: 'mono' }, `【${slot[s.k]}】`)
        : ui.h('b', { class: 'mono' }, FACTS[s.k].fmt(c[s.k]));
    });
    ctx.stage.append(ui.panel(
      { kicker: quake ? '今日快讯 · 实时数据' : '今日快讯', title: quake ? '全球地震日报：数字去哪了？' : `${zh(c.cc)}：数字去哪了？` },
      ui.h('p', { style: { lineHeight: 1.9, margin: 0 } }, ...body)));

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
    const tip = (k) => (quake ? quakeTip(k, c, ctx.data.quakes) : countryTip(k, c, ctx.data.countries, p.blanks));
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.table({
        columns: [{ key: 'slot', label: '空' }, { key: 'what', label: '指标' }, { key: 'ans', label: '答案', num: true }, { key: 'you', label: '你的估计', num: true }],
        rows: p.blanks.map((k, i) => ({ slot: LETTERS[i], what: FACTS[k].label, ans: FACTS[k].fmt(c[k]), you: results[i].guess != null ? FACTS[k].fmt(results[i].guess) : '—' })),
      }),
      ...p.blanks.map((k, i) => ui.h('div', { class: 'small ink2' }, `【${LETTERS[i]}】${FACTS[k].label}：${tip(k)}`)));
    return res;
  },
};
