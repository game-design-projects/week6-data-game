// #95 Interrogate — 20 Questions about a hidden country; every answer is computed from World Bank data.
// Questions come from a menu OR free text: parseQuestion() routes Chinese text to a data query,
// and asks the player to rephrase when it cannot tell which query was meant.
export const MAX_Q = 20;

export const IND = {
  gdp: { zh: '人均 GDP', words: ['人均gdp', '人均国内生产总值', '人均收入', 'gdp', '富裕', '贫穷'], fmt: (v) => `$${Math.round(v).toLocaleString('en-US')}` },
  pop: { zh: '人口', words: ['人口', '人数'], fmt: (v) => (v >= 1e8 ? `${(v / 1e8).toFixed(1)} 亿` : `${Math.round(v / 1e4).toLocaleString('en-US')} 万`) },
  life: { zh: '预期寿命', words: ['预期寿命', '寿命', '长寿'], fmt: (v) => `${v.toFixed(1)} 岁` },
  urban: { zh: '城镇人口占比', words: ['城镇人口', '城镇化', '城市化', '城市人口', '城镇'], fmt: (v) => `${v.toFixed(0)}%` },
  area: { zh: '国土面积', words: ['国土面积', '面积', '国土'], fmt: (v) => `${Math.round(v / 1e4).toLocaleString('en-US')} 万 km²` },
  fert: { zh: '总和生育率', words: ['总和生育率', '生育率', '生育', '出生率'], fmt: (v) => v.toFixed(2) },
  net: { zh: '网民占比', words: ['网民', '互联网', '上网'], fmt: (v) => `${v.toFixed(0)}%` },
  forest: { zh: '森林覆盖率', words: ['森林覆盖', '森林', '绿化'], fmt: (v) => `${v.toFixed(0)}%` },
  co2: { zh: '人均 CO₂ 排放', words: ['二氧化碳', 'co2', '碳排放', '排放'], fmt: (v) => `${v.toFixed(1)} 吨` },
  health: { zh: '医疗支出占 GDP', words: ['医疗支出', '医疗', '卫生'], fmt: (v) => `${v.toFixed(1)}%` },
};
export const REGIONS = {
  'East Asia & Pacific': { zh: '东亚与太平洋', words: ['东亚', '太平洋'] },
  'Europe & Central Asia': { zh: '欧洲与中亚', words: ['欧洲', '中亚'] },
  'Latin America & Caribbean': { zh: '拉美与加勒比', words: ['拉美', '拉丁美洲', '加勒比'] },
  'Middle East, North Africa, Afghanistan & Pakistan': { zh: '中东北非及阿富汗巴基斯坦', words: ['中东', '北非', '阿富汗', '巴基斯坦'] },
  'North America': { zh: '北美', words: ['北美'] },
  'South Asia': { zh: '南亚', words: ['南亚'] },
  'Sub-Saharan Africa': { zh: '撒哈拉以南非洲', words: ['撒哈拉', '南部非洲'] },
};
export const INCOMES = {
  'Low income': { zh: '低收入', words: ['低收入'] },
  'Lower middle income': { zh: '中低收入', words: ['中低收入'] },
  'Upper middle income': { zh: '中高收入', words: ['中高收入'] },
  'High income': { zh: '高收入', words: ['高收入'] },
};
const GEO = {
  north: { text: '首都在北半球吗？', words: ['北半球'], test: (c) => c.lat > 0 },
  south: { text: '首都在南半球吗？', words: ['南半球'], test: (c) => c.lat <= 0 },
  east: { text: '首都在本初子午线以东吗？', words: ['东半球', '子午线以东'], test: (c) => c.lng > 0 },
  west: { text: '首都在本初子午线以西吗？', words: ['西半球', '子午线以西'], test: (c) => c.lng <= 0 },
  tropic: { text: '首都位于南北回归线之间吗？', words: ['热带', '回归线'], test: (c) => Math.abs(c.lat) < 23.44 },
};
const MENU_GEO = ['north', 'east', 'tropic'];
const MENU_Q = [[0.1, '低端 10%'], [0.25, '低端 25%'], [0.5, '中位数'], [0.75, '高端 25%'], [0.9, '高端 10%']];

export const zhName = (cc, fallback) => { try { return new Intl.DisplayNames(['zh-Hans'], { type: 'region' }).of(cc); } catch { return fallback; } };
export const enName = (cc, fallback) => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc); } catch { return fallback; } };

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
const nice = (v) => { const m = 10 ** (Math.floor(Math.log10(Math.abs(v) || 1)) - 1); return Math.round(v / m) * m; };
const ge = (k, t) => ({ id: `${k}>=${t}`, test: (c) => c.v[k] >= t });
const lt = (k, t) => ({ id: `${k}<${t}`, test: (c) => c.v[k] < t });

/** Build the fixed question menu (pure): each question is one deterministic query over the dataset. */
export function buildQuestions(countries) {
  const qs = [];
  const seen = new Set();
  const push = (q) => { if (!seen.has(q.id)) { seen.add(q.id); qs.push(q); } };
  for (const [k, meta] of Object.entries(IND)) {
    const sorted = countries.map((c) => c.v[k]).sort((a, b) => a - b);
    for (const [p, label] of MENU_Q) {
      const t = nice(quantile(sorted, p));
      push({ ...ge(k, t), group: meta.zh, text: `${meta.zh} 不低于 ${meta.fmt(t)}？`, short: `≥ ${meta.fmt(t)} · ${label}` });
    }
  }
  for (const [r, m] of Object.entries(REGIONS)) push({ id: `r:${r}`, group: '地区与收入', text: `属于世界银行分区「${m.zh}」吗？`, short: `地区：${m.zh}`, test: (c) => c.region === r });
  for (const [i, m] of Object.entries(INCOMES)) push({ id: `i:${i}`, group: '地区与收入', text: `世界银行划为「${m.zh}」国家吗？`, short: `收入：${m.zh}`, test: (c) => c.income === i });
  for (const g of MENU_GEO) push({ id: g, group: '地区与收入', text: GEO[g].text, short: GEO[g].text.replace('首都', '').replace('？', ''), test: GEO[g].test });
  return qs;
}

const half = (s) => s.replace(/[０-９．]/g, (ch) => (ch === '．' ? '.' : String.fromCharCode(ch.charCodeAt(0) - 0xfee0)));
const UNIT = { 亿: 1e8, 百万: 1e6, 万: 1e4, 千: 1e3, k: 1e3, m: 1e6 };

/**
 * Route a free-text Chinese question to a data query (pure).
 * → { ok: true, q } or { ok: false, msg, group? } (low confidence: ask the player to rephrase).
 */
export function parseQuestion(text, countries) {
  let s = half(String(text || '')).toLowerCase().replace(/co₂/g, 'co2').replace(/[\s,，。？?！!、]/g, '');
  if (s.length < 2) return { ok: false, msg: '问题太短了。试试「人口超过 5000 万吗」「首都在北半球吗」。' };
  const hits = [];
  const scan = (topic, words) => { for (const w of words) if (s.includes(w)) hits.push({ topic, w }); };
  for (const [k, m] of Object.entries(IND)) scan(`ind:${k}`, m.words);
  for (const [k, m] of Object.entries(REGIONS)) scan(`r:${k}`, m.words);
  for (const [k, m] of Object.entries(INCOMES)) scan(`i:${k}`, m.words);
  for (const [k, m] of Object.entries(GEO)) scan(`g:${k}`, m.words);
  if (!hits.length) {
    if (/非洲/.test(s)) return { ok: false, msg: '世界银行把非洲拆成两块：「撒哈拉以南非洲」和「中东北非…」。请说清楚是哪一块。', group: '地区与收入' };
    if (/亚洲/.test(s)) return { ok: false, msg: '「亚洲」跨了好几个世界银行分区（东亚与太平洋、南亚、中亚…）。请指明是东亚、南亚还是中亚。', group: '地区与收入' };
    return { ok: false, msg: '我没看懂你想问哪项数据。可以问：人均 GDP、人口、寿命、城镇化、面积、生育率、网民、森林、CO₂、医疗支出，或地区、收入分组、半球。' };
  }
  const maxLen = Math.max(...hits.map((h) => h.w.length));
  const best = hits.filter((h) => h.w.length === maxLen);
  const topics = [...new Set(best.map((h) => h.topic))];
  if (topics.length > 1) return { ok: false, msg: '这句话同时像在问好几件事，请一次只问一个条件。' };
  const [kind, key] = [topics[0].slice(0, topics[0].indexOf(':')), topics[0].slice(topics[0].indexOf(':') + 1)];
  const finish = (q) => {
    const yes = countries.filter(q.test).length;
    if (yes === 0 || yes === countries.length) return { ok: false, msg: `这条问题对所有国家的答案都一样（${yes ? '全是' : '全不是'}），问了没有信息。换个门槛吧。`, group: q.group };
    return { ok: true, q };
  };
  if (kind === 'r') return finish({ id: `r:${key}`, group: '地区与收入', text: `属于世界银行分区「${REGIONS[key].zh}」吗？`, short: `地区：${REGIONS[key].zh}`, test: (c) => c.region === key });
  if (kind === 'i') return finish({ id: `i:${key}`, group: '地区与收入', text: `世界银行划为「${INCOMES[key].zh}」国家吗？`, short: `收入：${INCOMES[key].zh}`, test: (c) => c.income === key });
  if (kind === 'g') return finish({ id: key, group: '地区与收入', text: GEO[key].text, short: GEO[key].text.replace('首都', '').replace('？', ''), test: GEO[key].test });
  // numeric indicator
  const m = IND[key];
  let rest = s;
  for (const h of hits.filter((x) => x.topic === `ind:${key}`)) rest = rest.split(h.w).join('');
  rest = rest.replace(/多少|几个|是多少/g, "").replace(/平方公里|平方千米|km2|km|美元|岁|吨|\$|元/g, (x) => (x === '$' ? '$' : ''));
  const high = /不低于|不少于|不小于|至少|以上|超过|高于|大于|多于|≥|>=|>/.test(rest) ? true
    : /低于|少于|小于|不到|不足|以下|≤|<=|</.test(rest) ? false
      : /高|大|多|长|富|快/.test(rest) ? true : /低|小|少|短|穷|慢/.test(rest) ? false : null;
  const num = rest.match(/(\d+(?:\.\d+)?)(亿|百万|万|千|k|m|%)?/);
  const vals = countries.map((c) => c.v[key]).sort((a, b) => a - b);
  if (high === null && !num) return { ok: false, msg: `你想问「${m.zh}」的哪一边？请说「高于/低于」，最好带一个数字，例如「${m.zh}高于 ${m.fmt(nice(quantile(vals, 0.5)))}」。`, group: m.zh };
  let t;
  if (num) {
    t = +num[1] * (UNIT[num[2]] || 1);
    if (key === 'pop' && !num[2] && t < 1000) return { ok: false, msg: '人口请带上单位，例如「5000 万」或「1 亿」。', group: m.zh };
    if (key === 'area' && !num[2] && t < 1000) return { ok: false, msg: '面积请带上单位，例如「100 万平方公里」。', group: m.zh };
  } else t = nice(quantile(vals, 0.5));
  const dir = high === null ? true : high;
  const base = dir ? ge(key, t) : lt(key, t);
  const qtext = `${m.zh} ${dir ? "不低于" : "低于"} ${m.fmt(t)}？`;
  return finish({ ...base, group: m.zh, text: qtext, short: `${dir ? '≥' : '<'} ${m.fmt(t)}`, free: true });
}

/** Greedy best path with menu questions (for the "how to solve it" explanation). */
export function bestPath(countries, ans, qs, limit = 14) {
  let cand = countries.slice();
  const steps = [];
  const used = new Set();
  while (cand.length > 1 && steps.length < limit) {
    let pick = null;
    let worst = cand.length;
    for (const q of qs) {
      if (used.has(q.id)) continue;
      const yes = cand.filter(q.test).length;
      const w = Math.max(yes, cand.length - yes);
      if (w < worst) { worst = w; pick = q; }
    }
    if (!pick) break;
    used.add(pick.id);
    const a = pick.test(ans);
    cand = cand.filter((c) => pick.test(c) === a);
    steps.push({ q: pick, yes: a, left: cand.length });
  }
  return { steps, left: cand.length };
}

export const scoreFor = (q, guesses, won) => (won ? Math.max(10, 100 - 3 * q - 12 * (guesses - 1)) : 0);

export default {
  meta: {
    num: 95,
    slug: 'interrogate',
    title: 'Interrogate',
    tagline: '二十个问题审问一个隐藏的国家：用自己的话提问，答案由世界银行数据算出。',
    category: 'model',
    data: 'snapshot',
    howTo: [
      '今天有一个隐藏的国家。在输入框里用中文提是非题（如「人口超过 5000 万吗」「首都在南半球吗」），或从题库里点选，最多 20 问。',
      '系统把你的问题对应到一条数据查询，答案由世界银行数据当场算出；没看懂时会请你换个问法（不扣提问次数）。',
      '每问一题，面板会显示还剩多少个候选国家。好问题能把候选对半切开。',
      '觉得有把握了就点「我要猜了」，从列表里选国家，最多 3 次机会。',
      '计分：猜中得 100 − 3×提问数 − 12×之前猜错次数（最低 10 分）；没猜中 0 分。结算时会给出这个国家的最短问法。',
    ],
    scoring: '100 − 3×已问题数 − 12×猜错次数，下限 10；没猜中 0 分。',
    sources: [
      { name: 'World Bank Open Data API', url: 'https://api.worldbank.org/v2/', note: '人均 GDP、人口、预期寿命、城镇化、面积、生育率、网民、森林、CO₂、医疗支出；国家分区与收入分组；首都坐标' },
    ],
    dataNote: '没有运行时 LLM：自由输入由关键词规则解析（指标词 + 高低方向 + 可选数字与单位），能确定时对应到一条固定的数据查询，不确定时请你换个问法，因此答案永远客观。题库的门槛取候选池的 10/25/50/75/90 分位数。仅含人口 ≥ 150 万且指标齐全的国家（144 个），取各指标最近一年数据（2024–2025）。世界银行数据按年发布，不随日更新，所以保持快照。',
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
    const logHost = ui.h('div', { class: 'ds-stack' });
    const askHost = ui.h('div', { class: 'ds-stack' });
    const box = ui.h('div', { class: 'ds-stack' }, logHost, askHost);
    ctx.stage.append(box);
    ctx.log('interrogate start', { answer: ans.cc, questions: qs.length, pool: all.length });

    let done;
    const finished = new Promise((r) => { done = r; });
    const names = (list) => list.map((c) => zhName(c.cc, c.name)).join('、');
    let note = null;
    let menuHost; let noteHost; let input;

    const logRows = () => {
      let pool = all;
      return asked.map((a, i) => {
        const before = pool.length;
        pool = pool.filter((c) => a.q.test(c) === a.yes);
        return { n: i + 1, q: a.q.text, a: a.yes ? '是' : '否', c: pool.length, cut: before - pool.length };
      });
    };
    const logTable = () => ui.table({ columns: [{ key: 'n', label: '#', num: true }, { key: 'q', label: '问题' }, { key: 'a', label: '答' }, { key: 'c', label: '剩余', num: true }], rows: logRows() });

    const ask = (q) => {
      if (asked.some((a) => a.q.id === q.id)) { setNote('这个问题已经问过了。', 'warn'); return; }
      const yes = q.test(ans);
      asked.push({ q, yes });
      cand = cand.filter((c) => q.test(c) === yes);
      ctx.log('ask', { q: q.id, free: !!q.free, yes, left: cand.length });
      if (asked.length >= MAX_Q) done();
      else if (!ctx.autoplay) { note = null; render(); }
    };

    const setNote = (msg, tone) => { note = msg ? { msg, tone } : null; renderNote(); };
    const renderNote = () => { if (noteHost) noteHost.replaceChildren(...(note ? [ui.callout(note.msg, note.tone)] : [])); };

    const submit = () => {
      const text = input.value.trim();
      if (!text) return;
      const r = parseQuestion(text, all);
      ctx.log('parse', { text, ok: r.ok, q: r.q?.id });
      if (!r.ok) { if (r.group) group = r.group; setNote(`${r.msg}（这次不扣提问次数）`, 'warn'); renderMenu(); return; }
      input.value = '';
      ask(r.q);
    };

    const renderMenu = () => {
      const used = new Set(asked.map((a) => a.q.id));
      menuHost.replaceChildren(
        ui.chips(groups, { active: group, onClick: (g) => { group = g; renderMenu(); } }),
        ui.grid(170, ...qs.filter((q) => q.group === group).map((q) =>
          ui.button(q.short, { small: true, variant: used.has(q.id) ? 'ghost' : undefined, onClick: () => { if (!used.has(q.id)) ask(q); } }))));
    };

    const render = () => {
      const left = MAX_Q - asked.length;
      logHost.replaceChildren(ui.panel({ kicker: `剩余提问 ${left} / ${MAX_Q}`, title: `还有 ${cand.length} 个候选国家` },
        ui.h('div', { class: 'ds-stack' },
          asked.length ? logTable() : ui.h('div', { class: 'muted' }, '还没有提问。先从大范围的问题开始切：好问题会把候选对半分。'),
          cand.length <= 12 ? ui.h('div', { class: 'small ink2' }, '候选：' + names(cand)) : null)));
      if (!menuHost) {
        input = ui.h('input', { class: 'ds-input', type: 'text', maxlength: 60, placeholder: '如：人口超过5000万吗？', 'aria-label': '输入你的问题', onKeydown: (e) => { if (e.key === 'Enter') submit(); } });
        noteHost = ui.h('div');
        menuHost = ui.h('div', { class: 'ds-stack' });
        askHost.append(ui.panel({ kicker: '提问', title: '问一个是非题' },
          ui.h('div', { class: 'ds-stack' },
            ui.h('div', { class: 'ds-row' }, ui.h('div', { style: { flex: '1 1 220px' } }, input), ui.button('提问', { variant: 'accent', onClick: submit })),
            noteHost,
            ui.h('div', { class: 'small muted' }, '或者从题库点选（门槛取全部国家的分位数）：'),
            menuHost,
            ui.button(asked.length ? '我要猜了 →' : '直接猜（不提问）', { onClick: () => done() }))));
      }
      renderNote();
      renderMenu();
    };

    if (ctx.autoplay) {
      for (const q of qs.filter((x) => x.group !== '地区与收入').slice(0, 6)) ask(q);
      done();
    } else render();
    await finished;

    const q = asked.length;
    const clue = !q ? '你没有提问，只能凭运气。' : cand.length <= 12 ? `${q} 问之后只剩：${names(cand)}。` : `${q} 问之后仍有 ${cand.length} 个候选，凭常识挑最像的。`;
    box.replaceChildren(ui.panel({ kicker: '审问结束', title: `用了 ${q} 问，剩 ${cand.length} 个候选` },
      ui.h('div', { class: 'ds-stack' },
        q ? logTable() : null,
        ui.h('div', { class: 'small ink2' }, cand.length <= 12 ? `候选：${names(cand)}` : '候选还很多，靠运气和常识吧。'))));

    const res = await ctx.guess({
      options: all.map((c) => ({ id: c.cc, label: zhName(c.cc, c.name), hint: enName(c.cc, c.name), aliases: [enName(c.cc, c.name), c.name, c.cc] })),
      answer: ans.cc,
      maxGuesses: 3,
      title: '这是哪个国家？',
      placeholder: '输入国家名（中文或英文）…',
      clues: [clue],
      cluesTitle: '现状',
      scoring: (n, won) => scoreFor(q, n, won),
    });

    const rank = (k) => [...all].sort((a, b) => b.v[k] - a.v[k]).findIndex((c) => c.cc === ans.cc) + 1;
    const rows = Object.entries(IND).map(([k, m]) => ({ k: m.zh, v: m.fmt(ans.v[k]), r: `第 ${rank(k)} / ${all.length}` }));
    const ext = Object.entries(IND).map(([k, m]) => ({ m, r: rank(k) })).filter((x) => x.r <= 15 || x.r > all.length - 15)
      .sort((a, b) => Math.min(a.r, all.length + 1 - a.r) - Math.min(b.r, all.length + 1 - b.r)).slice(0, 3);
    const best = bestPath(all, ans, qs);
    const path = best.steps.map((s, i) => ({ n: i + 1, q: s.q.text, a: s.yes ? '是' : '否', c: s.left }));
    res.summary = `${zhName(ans.cc, ans.name)} · ${q} 问`;
    res.emoji = `${res.emoji || ''}\n❓×${q}`.trim();
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案：${zhName(ans.cc, ans.name)}（${enName(ans.cc, ans.name)}），首都 ${ans.capital}，${REGIONS[ans.region]?.zh || ans.region}，${INCOMES[ans.income]?.zh || ans.income}。`),
      ui.h('div', { class: 'ink2' }, ext.length
        ? `最容易暴露它的特征：${ext.map((x) => `${x.m.zh}${x.r <= 15 ? '排名靠前' : '排名靠后'}（第 ${x.r}/${all.length}）`).join('、')}。对这类极端值问「高于/低于」会一下子砍掉大半候选。`
        : '它在各项指标上都不极端，只能靠地区、收入分组和半球这类类别问题，加上几个中位数附近的门槛慢慢夹。'),
      ui.h('div', { class: 'small muted' }, `题库的最短问法：${best.left === 1 ? `${path.length} 问就能锁定` : `${path.length} 问后还剩 ${best.left} 个无法区分的国家`}（你用了 ${q} 问，剩 ${cand.length} 个）`),
      ui.table({ columns: [{ key: 'n', label: '#', num: true }, { key: 'q', label: '最短路径上的问题' }, { key: 'a', label: '答' }, { key: 'c', label: '剩余', num: true }], rows: path }),
      ui.table({ columns: [{ key: 'k', label: '指标' }, { key: 'v', label: '数值', num: true }, { key: 'r', label: '全池排名', num: true }], rows }),
      ui.h('div', { class: 'small muted' }, `${all.length} 个国家约等于 2^7.2：每题都对半切，8 问就够；一路问「前 25%」这种偏门槛，信息量会差很多。`));
    return res;
  },
};
