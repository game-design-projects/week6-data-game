// #95 Interrogate — 20 Questions about a hidden country; every answer is computed from World Bank data.
export const MAX_Q = 20;

const IND = {
  gdp: { zh: '人均 GDP', fmt: (v) => `$${Math.round(v).toLocaleString('en-US')}` },
  pop: { zh: '人口', fmt: (v) => (v >= 1e8 ? `${(v / 1e8).toFixed(1)} 亿` : `${Math.round(v / 1e4).toLocaleString('en-US')} 万`) },
  life: { zh: '预期寿命', fmt: (v) => `${v.toFixed(1)} 岁` },
  urban: { zh: '城镇人口占比', fmt: (v) => `${v.toFixed(0)}%` },
  area: { zh: '国土面积', fmt: (v) => `${Math.round(v / 1e4).toLocaleString('en-US')} 万 km²` },
  fert: { zh: '总和生育率', fmt: (v) => v.toFixed(2) },
  net: { zh: '网民占比', fmt: (v) => `${v.toFixed(0)}%` },
  forest: { zh: '森林覆盖率', fmt: (v) => `${v.toFixed(0)}%` },
  co2: { zh: '人均 CO₂ 排放', fmt: (v) => `${v.toFixed(1)} 吨` },
  health: { zh: '医疗支出占 GDP', fmt: (v) => `${v.toFixed(1)}%` },
};
const REGIONS = {
  'East Asia & Pacific': '东亚与太平洋', 'Europe & Central Asia': '欧洲与中亚', 'Latin America & Caribbean': '拉美与加勒比',
  'Middle East, North Africa, Afghanistan & Pakistan': '中东北非及阿富汗巴基斯坦', 'North America': '北美', 'South Asia': '南亚', 'Sub-Saharan Africa': '撒哈拉以南非洲',
};
const INCOMES = { 'Low income': '低收入', 'Lower middle income': '中低收入', 'Upper middle income': '中高收入', 'High income': '高收入' };

export const zhName = (cc, fallback) => { try { return new Intl.DisplayNames(['zh-Hans'], { type: 'region' }).of(cc); } catch { return fallback; } };

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
const nice = (v) => { const m = 10 ** (Math.floor(Math.log10(Math.abs(v) || 1)) - 1); return Math.round(v / m) * m; };

/** Build the question menu (pure): each question routes to a deterministic query over the dataset. */
export function buildQuestions(countries) {
  const qs = [];
  for (const [k, meta] of Object.entries(IND)) {
    const sorted = countries.map((c) => c.v[k]).sort((a, b) => a - b);
    for (const [q, label] of [[0.25, '后 25% 的门槛'], [0.5, '中位数'], [0.75, '前 25% 的门槛']]) {
      const t = nice(quantile(sorted, q));
      qs.push({ id: `${k}${q}`, group: meta.zh, text: `${meta.zh}是否不低于 ${meta.fmt(t)}？（${label}）`, test: (c) => c.v[k] >= t });
    }
  }
  for (const [r, zh] of Object.entries(REGIONS)) qs.push({ id: `r:${r}`, group: '地区与收入', text: `属于世界银行分区「${zh}」吗？`, test: (c) => c.region === r });
  for (const [i, zh] of Object.entries(INCOMES)) qs.push({ id: `i:${i}`, group: '地区与收入', text: `世界银行划为「${zh}」国家吗？`, test: (c) => c.income === i });
  qs.push({ id: 'north', group: '地区与收入', text: '首都在北半球吗？', test: (c) => c.lat > 0 });
  qs.push({ id: 'east', group: '地区与收入', text: '首都在本初子午线以东吗？', test: (c) => c.lng > 0 });
  qs.push({ id: 'tropic', group: '地区与收入', text: '首都位于南北回归线之间吗？', test: (c) => Math.abs(c.lat) < 23.44 });
  return qs;
}

export const scoreFor = (q, guesses, won) => (won ? Math.max(10, 100 - 3 * q - 12 * (guesses - 1)) : 0);

export default {
  meta: {
    num: 95,
    slug: 'interrogate',
    title: 'Interrogate',
    tagline: '二十个问题审问一个隐藏的国家：每个是非题都由世界银行的真实数据即时算出答案。',
    category: 'model',
    data: 'snapshot',
    howTo: [
      '今天有一个隐藏的国家。从题库里挑是非题提问（最多 20 问），答案由世界银行数据当场算出。',
      '每问一题，面板会显示还剩多少个候选国家。好问题能把候选对半切开。',
      '觉得有把握了就点「我要猜了」，从列表里选国家，最多 3 次机会。',
      '计分：猜中得 100 − 3×提问数 − 12×之前猜错次数（最低 10 分）；没猜中 0 分。问得越少、越准越高分。',
    ],
    scoring: '100 − 3×已问题数 − 12×猜错次数，下限 10；没猜中 0 分。',
    sources: [
      { name: 'World Bank Open Data API', url: 'https://api.worldbank.org/v2/', note: '人均 GDP、人口、预期寿命、城镇化、面积、生育率、网民、森林、CO₂、医疗支出；国家分区与收入分组；首都坐标' },
    ],
    dataNote: '没有运行时 LLM：「自然语言提问」由预置题库代替，每题对应一条固定的数据查询（门槛取候选国家的 25/50/75 分位数），因此答案永远客观。仅含人口 ≥ 150 万且指标齐全的国家，取各指标最近一年的数据（2024–2025）。',
  },

  puzzle({ data, pick }) {
    return { cc: pick(data.countries).cc };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const all = ctx.data.countries;
    const ans = all.find((c) => c.cc === p.cc);
    const qs = buildQuestions(all);
    const asked = [];
    let cand = all.slice();
    let group = qs[0].group;
    const groups = [...new Set(qs.map((q) => q.group))];
    const box = ui.h('div', { class: 'ds-stack' });
    ctx.stage.append(box);
    ctx.log('interrogate start', { answer: ans.cc, questions: qs.length, pool: all.length });

    let done;
    const finished = new Promise((r) => { done = r; });

    const ask = (q) => {
      const yes = q.test(ans);
      asked.push({ q, yes });
      cand = cand.filter((c) => q.test(c) === yes);
      ctx.log('ask', { q: q.id, yes, left: cand.length });
      if (asked.length >= MAX_Q) done();
      else if (!ctx.autoplay) render();
    };

    const render = () => {
      const left = MAX_Q - asked.length;
      const used = new Set(asked.map((a) => a.q.id));
      let pool = all;
      const rows = asked.map((a, i) => {
        pool = pool.filter((c) => a.q.test(c) === a.yes);
        return { n: i + 1, q: a.q.text.replace(/（.*）/, ''), a: a.yes ? '是' : '否', c: pool.length };
      });
      const log = asked.length
        ? ui.table({ columns: [{ key: 'n', label: '#', num: true }, { key: 'q', label: '问题' }, { key: 'a', label: '答' }, { key: 'c', label: '剩余', num: true }], rows })
        : ui.h('div', { class: 'muted' }, '还没有提问。先从大范围的问题开始切。');
      const list = cand.length <= 12 ? ui.h('div', { class: 'small ink2' }, '候选：' + cand.map((c) => zhName(c.cc, c.name)).join('、')) : null;
      box.replaceChildren(
        ui.panel({ kicker: `剩余提问 ${left} / ${MAX_Q}`, title: `还有 ${cand.length} 个候选国家` },
          ui.h('div', { class: 'ds-stack' }, log, list)),
        ui.panel({ kicker: '题库', title: '选一个问题' },
          ui.h('div', { class: 'ds-stack' },
            ui.chips(groups, { active: group, onClick: (g) => { group = g; render(); } }),
            ui.h('div', { class: 'ds-stack' }, qs.filter((q) => q.group === group).map((q) =>
              ui.button(q.text, { small: true, variant: used.has(q.id) ? 'ghost' : undefined, onClick: () => { if (!used.has(q.id)) ask(q); } }))),
            ui.button(asked.length ? '我要猜了 →' : '直接猜（不提问）', { variant: 'accent', onClick: () => done() }))));
    };

    if (ctx.autoplay) {
      for (const q of qs.filter((x) => x.group !== '地区与收入').slice(0, 6)) ask(q);
      done();
    } else render();
    await finished;

    box.replaceChildren(ui.panel({ kicker: '审问结束', title: `用了 ${asked.length} 问，剩 ${cand.length} 个候选` },
      ui.h('div', { class: 'small ink2' }, cand.length <= 12 ? `候选：${cand.map((c) => zhName(c.cc, c.name)).join('、')}` : '候选还很多，靠运气和常识吧。')));

    const q = asked.length;
    const res = await ctx.guess({
      options: all.map((c) => ({ id: c.cc, label: zhName(c.cc, c.name), hint: c.name, aliases: [c.name, c.cc] })),
      answer: ans.cc,
      maxGuesses: 3,
      title: '这是哪个国家？',
      placeholder: '输入国家名（中文或英文）…',
      clues: [`你的问答记录里有 ${q} 条线索，还剩 ${cand.length} 个候选。`],
      scoring: (n, won) => scoreFor(q, n, won),
    });

    const rows = Object.entries(IND).map(([k, m]) => {
      const sorted = all.map((c) => c.v[k]).sort((a, b) => b - a);
      return { k: m.zh, v: m.fmt(ans.v[k]), r: `第 ${sorted.findIndex((x) => x <= ans.v[k]) + 1} / ${all.length}` };
    });
    res.summary = `${zhName(ans.cc, ans.name)} · ${q} 问`;
    res.emoji = `${res.emoji || ''}\n❓×${q}`.trim();
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案：${zhName(ans.cc, ans.name)}（${ans.name}），首都 ${ans.capital}，${REGIONS[ans.region] || ans.region}，${INCOMES[ans.income] || ans.income}。`),
      ui.table({ columns: [{ key: 'k', label: '指标' }, { key: 'v', label: '数值', num: true }, { key: 'r', label: '在候选池中排名', num: true }], rows }),
      ui.h('div', { class: 'small muted' }, `${all.length} 个国家约等于 2^7.2，理想情况下每题对半切，约 8 问即可锁定；你的问答把候选从 ${all.length} 个压到了 ${cand.length} 个。`));
    return res;
  },
};
