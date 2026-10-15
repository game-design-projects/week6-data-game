// #95 Interrogate — 20 Questions about a hidden country; every answer is computed from World Bank data.
// Questions come from a menu OR free text: parseQuestion() routes English text to a data query,
// and asks the player to rephrase when it cannot tell which query was meant.
export const MAX_Q = 20;

const trim0 = (x) => x.toFixed(1).replace(/\.0$/, '');
export const IND = {
  gdp: { name: 'GDP per capita', words: ['gdp per capita', 'income per capita', 'per capita income', 'income per person', 'gdp', 'rich', 'wealthy', 'wealth', 'poor'], fmt: (v) => `$${Math.round(v).toLocaleString('en-US')}` },
  pop: { name: 'Population', words: ['population', 'inhabitants', 'populous', 'people'], fmt: (v) => (v >= 1e9 ? `${(v / 1e9).toFixed(2)} billion` : v >= 1e6 ? `${trim0(v / 1e6)} million` : `${Math.round(v / 1e3).toLocaleString('en-US')} thousand`) },
  life: { name: 'Life expectancy', words: ['life expectancy', 'lifespan', 'life span', 'longevity', 'life'], fmt: (v) => `${v.toFixed(1)} yrs` },
  urban: { name: 'Urban share', words: ['urban population', 'urbanization', 'urbanisation', 'urban', 'city dwellers', 'cities'], fmt: (v) => `${v.toFixed(0)}%` },
  area: { name: 'Land area', words: ['land area', 'surface area', 'area', 'size'], fmt: (v) => (v >= 1e6 ? `${trim0(v / 1e6)} million km²` : `${Math.round(v / 1e3).toLocaleString('en-US')} thousand km²`) },
  fert: { name: 'Fertility rate', words: ['fertility rate', 'fertility', 'birth rate', 'births'], fmt: (v) => v.toFixed(2) },
  net: { name: 'Internet users', words: ['internet', 'online', 'web users'], fmt: (v) => `${v.toFixed(0)}%` },
  forest: { name: 'Forest cover', words: ['forest', 'woodland'], fmt: (v) => `${v.toFixed(0)}%` },
  co2: { name: 'CO₂ per person', words: ['carbon dioxide', 'co2', 'carbon', 'emissions', 'emit'], fmt: (v) => `${v.toFixed(1)} t` },
  health: { name: 'Health spending', words: ['health spending', 'healthcare spending', 'health care spending', 'health expenditure', 'healthcare', 'health'], fmt: (v) => `${v.toFixed(1)}% of GDP` },
};
export const REGIONS = {
  'East Asia & Pacific': { name: 'East Asia & Pacific', words: ['east asia', 'pacific'] },
  'Europe & Central Asia': { name: 'Europe & Central Asia', words: ['europe', 'central asia'] },
  'Latin America & Caribbean': { name: 'Latin America & Caribbean', words: ['latin america', 'south america', 'central america', 'caribbean'] },
  'Middle East, North Africa, Afghanistan & Pakistan': { name: 'Middle East, N. Africa, Afghanistan & Pakistan', words: ['middle east', 'north africa', 'afghanistan', 'pakistan', 'mena'] },
  'North America': { name: 'North America', words: ['north america'] },
  'South Asia': { name: 'South Asia', words: ['south asia'] },
  'Sub-Saharan Africa': { name: 'Sub-Saharan Africa', words: ['sub saharan', 'subsaharan', 'southern africa'] },
};
export const INCOMES = {
  'Low income': { name: 'Low income', words: ['low income'] },
  'Lower middle income': { name: 'Lower middle income', words: ['lower middle income', 'lower middle'] },
  'Upper middle income': { name: 'Upper middle income', words: ['upper middle income', 'upper middle'] },
  'High income': { name: 'High income', words: ['high income'] },
};
const GEO = {
  north: { text: 'Is the capital in the Northern Hemisphere?', short: 'Northern Hemisphere', words: ['northern hemisphere', 'north of the equator', 'above the equator'], test: (c) => c.lat > 0 },
  south: { text: 'Is the capital in the Southern Hemisphere?', short: 'Southern Hemisphere', words: ['southern hemisphere', 'south of the equator', 'below the equator'], test: (c) => c.lat <= 0 },
  east: { text: 'Is the capital east of the Prime Meridian?', short: 'East of Prime Meridian', words: ['eastern hemisphere', 'east of the prime meridian', 'east of greenwich'], test: (c) => c.lng > 0 },
  west: { text: 'Is the capital west of the Prime Meridian?', short: 'West of Prime Meridian', words: ['western hemisphere', 'west of the prime meridian', 'west of greenwich'], test: (c) => c.lng <= 0 },
  tropic: { text: 'Is the capital between the Tropics of Cancer and Capricorn?', short: 'Within the tropics', words: ['tropics', 'tropical', 'tropic'], test: (c) => Math.abs(c.lat) < 23.44 },
};
const MENU_GEO = ['north', 'east', 'tropic'];
const MENU_Q = [[0.1, '10th pct'], [0.25, '25th pct'], [0.5, 'median'], [0.75, '75th pct'], [0.9, '90th pct']];
const GROUP_CAT = 'Region & income';

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
      push({ ...ge(k, t), group: meta.name, text: `${meta.name} at least ${meta.fmt(t)}?`, short: `≥ ${meta.fmt(t)} · ${label}` });
    }
  }
  for (const [r, m] of Object.entries(REGIONS)) push({ id: `r:${r}`, group: GROUP_CAT, text: `Is it in the World Bank region \u201c${m.name}\u201d?`, short: `Region: ${m.name}`, test: (c) => c.region === r });
  for (const [i, m] of Object.entries(INCOMES)) push({ id: `i:${i}`, group: GROUP_CAT, text: `Does the World Bank class it as \u201c${m.name}\u201d?`, short: `Income: ${m.name}`, test: (c) => c.income === i });
  for (const g of MENU_GEO) push({ id: g, group: GROUP_CAT, text: GEO[g].text, short: GEO[g].short, test: GEO[g].test });
  return qs;
}

const UNIT = { billion: 1e9, bn: 1e9, b: 1e9, million: 1e6, mil: 1e6, m: 1e6, thousand: 1e3, k: 1e3 };
const UNIT_WORDS = /square kilometers|square kilometres|square miles|sq km|sq\. km|km2|km²|kilometers|kilometres|years old|years|year|yrs|tonnes|tons|tonne|ton|dollars|usd|us\$|percent/g;
const HIGH_NEG = /not (?:lower|below|under|less|smaller|fewer)|at least|no (?:less|fewer)|≥|>=/;
const LOW_NEG = /not (?:above|over|higher|more|greater|larger|bigger)|at most|no more|≤|<=/;
const HIGH = /above|over|higher|greater|more than|exceed|larger|bigger|>/;
const LOW = /below|under|less than|lower|fewer|smaller|</;

/**
 * Route a free-text English question to a data query (pure).
 * → { ok: true, q } or { ok: false, msg, group? } (low confidence: ask the player to rephrase).
 */
export function parseQuestion(text, countries) {
  const s = String(text || '').toLowerCase().replace(/co₂/g, 'co2').replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/-/g, ' ').replace(/[^a-z0-9.%$<>=≤≥ ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length < 2) return { ok: false, msg: 'That is too short. Try \u201cIs the population over 50 million?\u201d or \u201cIs the capital in the Southern Hemisphere?\u201d.' };
  const hits = [];
  const scan = (topic, words) => { for (const w of words) if (s.includes(w)) hits.push({ topic, w }); };
  for (const [k, m] of Object.entries(IND)) scan(`ind:${k}`, m.words);
  for (const [k, m] of Object.entries(REGIONS)) scan(`r:${k}`, m.words);
  for (const [k, m] of Object.entries(INCOMES)) scan(`i:${k}`, m.words);
  for (const [k, m] of Object.entries(GEO)) scan(`g:${k}`, m.words);
  if (!hits.length) {
    if (/africa/.test(s)) return { ok: false, msg: 'The World Bank splits Africa in two: \u201cSub-Saharan Africa\u201d and \u201cMiddle East, North Africa\u2026\u201d. Say which one you mean.', group: GROUP_CAT };
    if (/asia/.test(s)) return { ok: false, msg: '\u201cAsia\u201d spans several World Bank regions (East Asia & Pacific, South Asia, Central Asia\u2026). Say East, South or Central Asia.', group: GROUP_CAT };
    return { ok: false, msg: 'I could not tell which statistic you mean. Ask about GDP per capita, population, life expectancy, urbanization, land area, fertility, internet users, forest, CO\u2082, health spending, or region, income group, hemisphere.' };
  }
  const maxLen = Math.max(...hits.map((h) => h.w.length));
  const best = hits.filter((h) => h.w.length === maxLen);
  const topics = [...new Set(best.map((h) => h.topic))];
  if (topics.length > 1) return { ok: false, msg: 'That sounds like several questions at once. Ask one condition at a time.' };
  const [kind, key] = [topics[0].slice(0, topics[0].indexOf(':')), topics[0].slice(topics[0].indexOf(':') + 1)];
  const finish = (q) => {
    const yes = countries.filter(q.test).length;
    if (yes === 0 || yes === countries.length) return { ok: false, msg: `The answer to this is the same for every country (${yes ? 'all yes' : 'all no'}), so it tells you nothing. Pick a different threshold.`, group: q.group };
    return { ok: true, q };
  };
  if (kind === 'r') return finish({ id: `r:${key}`, group: GROUP_CAT, text: `Is it in the World Bank region \u201c${REGIONS[key].name}\u201d?`, short: `Region: ${REGIONS[key].name}`, test: (c) => c.region === key });
  if (kind === 'i') return finish({ id: `i:${key}`, group: GROUP_CAT, text: `Does the World Bank class it as \u201c${INCOMES[key].name}\u201d?`, short: `Income: ${INCOMES[key].name}`, test: (c) => c.income === key });
  if (kind === 'g') return finish({ id: key, group: GROUP_CAT, text: GEO[key].text, short: GEO[key].short, test: GEO[key].test });
  // numeric indicator
  const m = IND[key];
  let rest = s;
  for (const h of hits.filter((x) => x.topic === `ind:${key}`)) rest = rest.split(h.w).join(' ');
  rest = rest.replace(UNIT_WORDS, ' ').replace(/\$/g, ' ').replace(/\bhow (?:much|many)\b/g, ' ');
  let high = HIGH_NEG.test(rest) ? true : LOW_NEG.test(rest) ? false : HIGH.test(rest) ? true : LOW.test(rest) ? false : null;
  if (high === null) high = /\b(?:high|large|big|many|long|fast)\b/.test(rest) ? true : /\b(?:low|small|few|short|slow)\b/.test(rest) ? false : null;
  if (high === null && key === 'gdp') high = /rich|wealth/.test(s) ? true : /poor/.test(s) ? false : null;
  const num = rest.match(/(\d+(?:\.\d+)?)\s*(billion|bn|million|mil|thousand|k|m|b)?\b/);
  const vals = countries.map((c) => c.v[key]).sort((a, b) => a - b);
  if (high === null && !num) return { ok: false, msg: `Which side of \u201c${m.name}\u201d do you mean? Say \u201chigher than\u201d or \u201clower than\u201d, ideally with a number, e.g. \u201c${m.name} higher than ${m.fmt(nice(quantile(vals, 0.5)))}\u201d.`, group: m.name };
  let t;
  if (num) {
    t = +num[1] * (UNIT[num[2]] || 1);
    if (key === 'pop' && !num[2] && t < 1000) return { ok: false, msg: 'Add a unit to the population, e.g. \u201c50 million\u201d or \u201c1 billion\u201d.', group: m.name };
    if (key === 'area' && !num[2] && t < 1000) return { ok: false, msg: 'Add a unit to the area, e.g. \u201c1 million km2\u201d.', group: m.name };
  } else t = nice(quantile(vals, 0.5));
  const dir = high === null ? true : high;
  const base = dir ? ge(key, t) : lt(key, t);
  const qtext = `${m.name} ${dir ? 'at least' : 'below'} ${m.fmt(t)}?`;
  return finish({ ...base, group: m.name, text: qtext, short: `${dir ? '≥' : '<'} ${m.fmt(t)}`, free: true });
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
    tagline: 'Twenty questions about a hidden country. Ask in your own words; answers are computed from World Bank data.',
    category: 'model',
    data: 'snapshot',
    howTo: [
      'A country is hidden today. Type yes/no questions in the box (\u201cIs the population over 50 million?\u201d, \u201cIs the capital in the Southern Hemisphere?\u201d) or tap them from the menu. 20 questions max.',
      'Your question is matched to one data query and answered on the spot from World Bank data. If it cannot be understood you are asked to rephrase, and that does not cost a question.',
      'After each question the panel shows how many candidate countries remain. A good question splits the field in half.',
      'When you feel ready, hit \u201cI\u2019m ready to guess\u201d and pick a country. You get 3 guesses.',
      'Scoring: a correct guess earns 100 - 3 x questions - 12 x earlier wrong guesses (minimum 10). No hit, 0. The result shows the shortest line of questioning for this country.',
    ],
    scoring: '100 - 3 x questions asked - 12 x wrong guesses, floor 10; 0 if you miss.',
    sources: [
      { name: 'World Bank Open Data API', url: 'https://api.worldbank.org/v2/', note: 'GDP per capita, population, life expectancy, urbanization, land area, fertility, internet users, forest, CO2, health spending; regions and income groups; capital coordinates' },
    ],
    dataNote: 'No LLM at runtime: free text is parsed by keyword rules (statistic word + direction + optional number and unit). When it is sure, it maps to one fixed data query; otherwise it asks you to rephrase, so answers are always objective. Menu thresholds are the 10th/25th/50th/75th/90th percentiles of the candidate pool. Only countries with at least 1.5 million people and every indicator present are included (144), using the latest year (2024-2025). The World Bank publishes yearly, not daily, so this stays a snapshot.',
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
    const names = (list) => list.map((c) => enName(c.cc, c.name)).join(', ');
    let note = null;
    let menuHost; let noteHost; let input;

    const logRows = () => {
      let pool = all;
      return asked.map((a, i) => {
        const before = pool.length;
        pool = pool.filter((c) => a.q.test(c) === a.yes);
        return { n: i + 1, q: a.q.text, a: a.yes ? 'Yes' : 'No', c: pool.length, cut: before - pool.length };
      });
    };
    const logTable = () => ui.table({ columns: [{ key: 'n', label: '#', num: true }, { key: 'q', label: 'Question' }, { key: 'a', label: 'Answer' }, { key: 'c', label: 'Left', num: true }], rows: logRows() });

    const ask = (q) => {
      if (asked.some((a) => a.q.id === q.id)) { setNote('You already asked that one.', 'warn'); return; }
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
      if (!r.ok) { if (r.group) group = r.group; setNote(`${r.msg} (This did not use up a question.)`, 'warn'); renderMenu(); return; }
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
      logHost.replaceChildren(ui.panel({ kicker: `${left} of ${MAX_Q} questions left`, title: `${cand.length} ${cand.length === 1 ? 'country' : 'countries'} still possible` },
        ui.h('div', { class: 'ds-stack' },
          asked.length ? logTable() : ui.h('div', { class: 'muted' }, 'No questions yet. Start with broad ones: a good question splits the field in half.'),
          cand.length <= 12 ? ui.h('div', { class: 'small ink2' }, 'Candidates: ' + names(cand)) : null)));
      if (!menuHost) {
        input = ui.h('input', { class: 'ds-input', type: 'text', maxlength: 60, placeholder: 'Try: population over 50M', 'aria-label': 'Type your question', onKeydown: (e) => { if (e.key === 'Enter') submit(); } });
        noteHost = ui.h('div');
        menuHost = ui.h('div', { class: 'ds-stack' });
        askHost.append(ui.panel({ kicker: 'Ask', title: 'Ask a yes/no question' },
          ui.h('div', { class: 'ds-stack' },
            ui.h('div', { class: 'ds-row' }, ui.h('div', { style: { flex: '1 1 220px' } }, input), ui.button('Ask', { variant: 'accent', onClick: submit })),
            noteHost,
            ui.h('div', { class: 'small muted' }, 'Or tap one from the menu (thresholds are percentiles of all countries):'),
            menuHost,
            ui.button(asked.length ? 'I\u2019m ready to guess \u2192' : 'Guess now (no questions)', { onClick: () => done() }))));
      }
      renderNote();
      renderMenu();
    };

    if (ctx.autoplay) {
      for (const q of qs.filter((x) => x.group !== GROUP_CAT).slice(0, 6)) ask(q);
      done();
    } else render();
    await finished;

    const q = asked.length;
    const clue = !q ? 'You asked nothing, so it is down to luck.' : cand.length <= 12 ? `After ${q} ${q === 1 ? 'question' : 'questions'}, only these remain: ${names(cand)}.` : `After ${q} ${q === 1 ? 'question' : 'questions'}, ${cand.length} candidates remain. Go with the likeliest.`;
    box.replaceChildren(ui.panel({ kicker: 'Interrogation over', title: `${q} ${q === 1 ? 'question' : 'questions'} used, ${cand.length} ${cand.length === 1 ? 'candidate' : 'candidates'} left` },
      ui.h('div', { class: 'ds-stack' },
        q ? logTable() : null,
        ui.h('div', { class: 'small ink2' }, cand.length <= 12 ? `Candidates: ${names(cand)}` : 'Still plenty of candidates: luck and common sense now.'))));

    const res = await ctx.guess({
      options: all.map((c) => ({ id: c.cc, label: enName(c.cc, c.name), aliases: [c.name, c.cc] })),
      answer: ans.cc,
      maxGuesses: 3,
      title: 'Which country is it?',
      placeholder: 'Type a country name\u2026',
      clues: [clue],
      cluesTitle: 'Status',
      scoring: (n, won) => scoreFor(q, n, won),
    });

    const rank = (k) => [...all].sort((a, b) => b.v[k] - a.v[k]).findIndex((c) => c.cc === ans.cc) + 1;
    const rows = Object.entries(IND).map(([k, m]) => ({ k: m.name, v: m.fmt(ans.v[k]), r: `${rank(k)}/${all.length}` }));
    const ext = Object.entries(IND).map(([k, m]) => ({ m, r: rank(k) })).filter((x) => x.r <= 15 || x.r > all.length - 15)
      .sort((a, b) => Math.min(a.r, all.length + 1 - a.r) - Math.min(b.r, all.length + 1 - b.r)).slice(0, 3);
    const best = bestPath(all, ans, qs);
    const path = best.steps.map((s, i) => ({ n: i + 1, q: s.q.text, a: s.yes ? 'Yes' : 'No', c: s.left }));
    res.summary = `${enName(ans.cc, ans.name)} · ${q} ${q === 1 ? 'question' : 'questions'}`;
    res.emoji = `${res.emoji || ''}\n❓×${q}`.trim();
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `Answer: ${enName(ans.cc, ans.name)}, capital ${ans.capital}, ${REGIONS[ans.region]?.name || ans.region}, ${(INCOMES[ans.income]?.name || ans.income).toLowerCase()}.`),
      ui.h('div', { class: 'ink2' }, ext.length
        ? `What gives it away: ${ext.map((x) => `${x.m.name.toLowerCase()} ranks ${x.r <= 15 ? 'near the top' : 'near the bottom'} (${x.r} of ${all.length})`).join('; ')}. Asking \u201chigher/lower than\u201d on an extreme like that cuts most candidates at once.`
        : 'It is not extreme on any indicator, so you have to squeeze it with category questions (region, income group, hemisphere) plus a few thresholds near the median.'),
      ui.h('div', { class: 'small muted' }, `Shortest line from the menu: ${best.left === 1 ? `${path.length} questions pin it down` : `after ${path.length} questions, ${best.left} indistinguishable countries remain`} (you used ${q} and had ${cand.length} left).`),
      ui.table({ columns: [{ key: 'n', label: '#', num: true }, { key: 'q', label: 'Question on the shortest path' }, { key: 'a', label: 'Answer' }, { key: 'c', label: 'Left', num: true }], rows: path }),
      ui.table({ columns: [{ key: 'k', label: 'Indicator' }, { key: 'v', label: 'Value', num: true }, { key: 'r', label: 'Rank', num: true }], rows }),
      ui.h('div', { class: 'small muted' }, `${all.length} countries is about 2^7.2: if every question halves the field, 8 are enough. Lopsided thresholds like \u201ctop 25%\u201d carry far less information.`));
    return res;
  },
};
