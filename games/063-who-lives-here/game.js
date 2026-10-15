// #63 Who Lives Here — interview a "resident" of a Census tract (5 questions from a menu),
// then pin where in the USA that neighbourhood is. The resident only repeats ACS numbers.

const $ = (n) => '$' + Math.round(n).toLocaleString('en-US');
const p0 = (x) => `${Math.round(x)}%`;
/** Vague-but-honest phrasing of a percentage (resident talks like a person, numbers stay true). */
export function vague(x) {
  if (x < 1) return 'almost none';
  if (x < 6) return `very few (about ${p0(x)})`;
  if (x < 20) return `not many (about ${p0(x)})`;
  if (x < 40) return `a good chunk, but under half (about ${p0(x)})`;
  if (x < 60) return `around half (about ${p0(x)})`;
  if (x < 80) return `most of them (about ${p0(x)})`;
  return `nearly all (about ${p0(x)})`;
}

/** Keyword router (stands in for the LLM front-end of the original idea): free text -> question id. */
export const KEYWORDS = {
  housing: /\b(rent\w*|price\w*|cost\w*|expensive|afford\w*|landlord|mortgage)\b/i,
  money: /\b(income|earn\w*|salary|wages?|paid|pay|money|make|poor|poverty|rich|wealth\w*)\b/i,
  commute: /\b(commut\w*|transit|subway|bus|train|metro|drive|driving|walk\w*|bike|biking|work)\b/i,
  cars: /\b(cars?|vehicles?|automobiles?)\b/i,
  neighbors: /\b(neighbou?rs?|neighbou?rhood|race|races|racial|ethnic\w*|immigra\w*|foreign|white|black|asian|latino|hispanic|divers\w*)\b/i,
  age: /\b(age|ages|old|older|young|younger|elderly|retire\w*|kids|children)\b/i,
  school: /\b(school|schools|college|university|degrees?|educat\w*|graduat\w*|bachelor\w*)\b/i,
  homes: /\b(own|owns|owners?|apartments?|houses?|homes?|housing|detached|built|buildings?|condos?)\b/i,
};
/** Route a typed question to a menu question id, or null. Earlier entries win on ties. */
export function route(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  for (const id of Object.keys(KEYWORDS)) if (KEYWORDS[id].test(s)) return id;
  return null;
}

const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const FIELDS = [
  ['inc', 'Median household income', (v) => $(v)], ['rent', 'Median rent', (v) => $(v)], ['val', 'Median home value', (v) => $(v)],
  ['transit', 'Public-transit commuters', p0], ['walk', 'Walking commuters', p0], ['home', 'Work from home', p0], ['drive', 'Driving commuters', p0], ['noCar', 'Households with no car', p0],
  ['bach', 'Bachelor\'s degree or higher', p0], ['owner', 'Homeowners', p0], ['white', 'White share', p0], ['black', 'Black share', p0], ['asian', 'Asian share', p0],
  ['hisp', 'Hispanic share', p0], ['fb', 'Foreign-born', p0], ['pov', 'Poverty rate', p0], ['detached', 'Detached houses', p0], ['big', 'Buildings with 20+ units', p0],
  ['age', 'Median age', (v) => `${v} yrs`], ['yr', 'Median year homes were built', (v) => String(v)],
];
/** The 3 most unusual numbers of this tract vs. the pool (by rank distance from the median), as teaching bullets. */
export function standouts(t, tracts) {
  const out = [];
  for (const [k, label, f] of FIELDS) {
    const vals = tracts.map((x) => x[k]).filter((v) => Number.isFinite(v));
    const m = med(vals), lo = vals.filter((v) => v < t[k]).length / vals.length;
    const dev = Math.abs(lo - 0.5);
    out.push({ k, dev, text: `${label}: ${f(t[k])} (sample median ${f(m)}; ${lo >= 0.5 ? 'higher' : 'lower'} than ${Math.min(99, Math.round((lo >= 0.5 ? lo : 1 - lo) * 100))}% of tracts)` });
  }
  return out.sort((a, b) => b.dev - a.dev).slice(0, 3).map((x) => x.text);
}
/** Region/urbanity reading of a tract, specific to its numbers. */
export function reading(t) {
  const bits = [];
  if (t.transit >= 15 || t.noCar >= 30) bits.push(`Transit ${p0(t.transit)}, no-car households ${p0(t.noCar)}: a commuting pattern found only in the cores of a few big cities (New York, Chicago, Boston, San Francisco, Washington...)`);
  else if (t.drive >= 85 && t.noCar < 4) bits.push(`Driving to work ${p0(t.drive)} and nearly every household has a car: a typical suburb or small town, which all but rules out a big-city core`);
  if (t.hisp >= 40) bits.push(`Hispanic ${p0(t.hisp)}: common in California, Texas, Florida, Arizona, New Mexico and a few Northeastern cities`);
  if (t.black >= 40) bits.push(`Black ${p0(t.black)}: common in the Deep South (Mississippi, Georgia, Louisiana, the Carolinas) and older Northern industrial cities`);
  if (t.asian >= 25) bits.push(`Asian ${p0(t.asian)}: concentrated in California, New York, Seattle, New Jersey, Houston and similar places`);
  if (t.white >= 85 && t.fb < 5) bits.push(`White ${p0(t.white)}, foreign-born only ${p0(t.fb)}: leans toward rural areas and small towns in the North, the mountains and the Midwest`);
  if (t.val >= 800000) bits.push(`Median home value ${$(t.val)}: prices like this appear only in coastal California, the New York metro, Seattle, Boston, Hawaii and other high-cost areas`);
  else if (t.val < 150000) bits.push(`Median home value only ${$(t.val)}: common in small cities and rural areas of the South, the Midwest and the Rust Belt`);
  if (t.yr >= 2000) bits.push(`Homes were built around ${t.yr} (median): a new development, mostly in the Sun Belt (Texas, Florida, Arizona, Nevada, the Carolinas)`);
  else if (t.yr <= 1955) bits.push(`Homes were built around ${t.yr} (median): an older neighborhood, most common in the Northeast and Midwestern industrial cities`);
  if (t.home >= 18) bits.push(`Work from home ${p0(t.home)}: a highly educated, high-income tech or white-collar community`);
  if (!bits.length) bits.push('Every number sits near the national average, so there is no strong regional signature; a tract like this can only be placed roughly from the mix of income and home values');
  return bits.slice(0, 3);
}

export const QUESTIONS = [
  { id: 'money', label: 'How much does your family earn?', say: (t) => `Median household income around here is ${$(t.inc)}, and about ${p0(t.pov)} of people live below the poverty line.` },
  { id: 'housing', label: 'What does it cost to live here?', say: (t) => `Rent is a median of ${$(t.rent)} a month, and the median home is worth about ${$(t.val)}.` },
  { id: 'commute', label: 'How do you get to work?', say: (t) => `${p0(t.drive)} drive to work, ${p0(t.transit)} take public transit, ${p0(t.walk)} walk and ${p0(t.home)} work from home.` },
  { id: 'cars', label: 'Does everyone have a car?', say: (t) => `Households with no car: ${vague(t.noCar)}.` },
  { id: 'neighbors', label: 'Who are your neighbors?', say: (t) => `White (non-Hispanic) ${p0(t.white)}, Black ${p0(t.black)}, Asian ${p0(t.asian)}, Hispanic ${p0(t.hisp)}. Foreign-born residents: ${vague(t.fb)}.` },
  { id: 'age', label: 'How old is everyone?', say: (t) => `The median age here is ${t.age}.` },
  { id: 'school', label: 'Did people go to college?', say: (t) => `Among people 25 and over, ${p0(t.bach)} have a bachelor's degree or higher.` },
  { id: 'homes', label: 'What kind of homes are there?', say: (t) => `${p0(t.owner)} of households own their home. ${p0(t.detached)} of buildings are detached houses and ${p0(t.big)} are buildings with 20+ units. The median home was built in ${t.yr}.` },
];

/** Score helper kept pure for tests: closer pin = more points. */
export const pinScore = (km, scale = 700) => Math.round(100 * Math.exp(-km / scale));

export const STATE_NAMES = { AL: 'Alabama', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };

export default {
  meta: {
    num: 63,
    slug: 'who-lives-here',
    title: 'Who Lives Here',
    tagline: 'A resident answers only with Census numbers. Ask five questions, then pin their neighborhood on the US map.',
    category: 'model',
    data: 'snapshot',
    howTo: [
      'Today a resident of one US Census tract (a neighborhood of about 4,000 people) is waiting. Tap the menu or type to ask 5 questions (typed questions are matched by keyword to the 8 topics below).',
      'Every answer comes straight from the American Community Survey (ACS) statistics for that tract. Nothing is made up.',
      'Then pin where they live on the map of the contiguous US (the pool covers the lower 48 states and Washington, DC). Income, rent, commute mode, ethnicity, age of homes... together they can point to a city or at least a region.',
      'Choosing questions is the skill: pick ones that carry a lot of information and tell regions apart.',
    ],
    scoring: '100 × e^(−distance/700 km): 0 km from the answer is a perfect score, about 700 km earns 37 and about 2,000 km earns 6.',
    sources: [
      { name: 'U.S. Census Bureau, ACS 5-year 2020–2024(tables B01002, B03002, B05002, B08301, B15003, B17001, B19013, B25003, B25024, B25035, B25044, B25064, B25077)', url: 'https://www.census.gov/programs-surveys/acs', note: 'Retrieved through the Census Reporter API' },
      { name: 'Census Reporter API', url: 'https://censusreporter.org/' },
      { name: 'Census Gazetteer (tract centroids)', url: 'https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html' },
    ],
    dataNote: 'There is no language model in the browser: the resident\'s lines are templates that turn statistics into speech, and typed questions are routed by keyword rules to 8 fixed topics (matching the original idea of routing to statistical fields and letting a model handle only the wording). All numbers are real ACS estimates. The pool is about 227 randomly sampled, state-balanced tracts in the lower 48 (Alaska and Hawaii are off the map and were dropped). The official Census API needs a key, so this uses Census Reporter, which serves the same ACS data.',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.tracts).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const t = ctx.data.tracts.find((x) => x.id === p.id);
    const N = 5;
    const asked = [];
    const log = ctx.log.scope('who');
    log('tract', t.id, t.county, t.state);

    const list = ui.h('div', { class: 'ds-stack' });
    const left = ui.h('span', { class: 'mono small' }, `${N} questions left`);
    const asks = ui.h('div', { class: 'ds-grid', style: { '--min': '160px' } });
    const panel = ui.panel({ kicker: 'Resident interview', title: 'What do you want to ask?', aside: left }, asks, ui.h('div', { style: { marginTop: '12px' } }, list));
    ctx.stage.append(panel);

    const typed = ui.h('input', { class: 'ds-input', placeholder: 'Or type a question, e.g. "Is rent high?"', autocomplete: 'off', 'aria-label': 'Type your question', maxlength: 60 });
    const note = ui.h('div', { class: 'small muted', style: { minHeight: '1.4em' } });
    const sendBtn = ui.button('Ask', { variant: 'accent', small: true });
    const typedRow = ui.h('div', { class: 'ds-row', style: { marginTop: '10px', flexWrap: 'nowrap' } }, typed, sendBtn);
    asks.after(typedRow, note);

    await new Promise((resolve) => {
      const ask = (q, btn, said) => {
        if (asked.includes(q.id)) { note.textContent = 'You already asked that one. Try another.'; return; }
        if (asked.length >= N) return;
        asked.push(q.id);
        log('ask', q.id, said ? 'typed' : 'menu');
        const b2 = btn || asks.querySelector(`[data-q="${q.id}"]`);
        if (b2) b2.disabled = true;
        note.textContent = '';
        list.append(ui.h('div', {}, ui.h('div', { class: 'small muted' }, `You: ${said || q.label}`), ui.quote(q.say(t))));
        left.textContent = asked.length >= N ? 'All asked. Now pin the location on the map.' : `${N - asked.length} ${N - asked.length === 1 ? 'question' : 'questions'} left`;
        if (asked.length >= N) {
          asks.querySelectorAll('button').forEach((b) => (b.disabled = true));
          typed.disabled = true; sendBtn.disabled = true; typedRow.style.display = 'none';
          setTimeout(resolve, ctx.autoplay ? 0 : 600);
        }
      };
      const send = () => {
        const text = typed.value.trim();
        if (!text) return;
        const id = route(text);
        log('typed', text, '->', id);
        if (!id) { note.textContent = 'They did not catch that. They can only talk about: income, rent and home prices, commuting, cars, neighbors, age, education and housing.'; return; }
        typed.value = '';
        ask(QUESTIONS.find((q) => q.id === id), null, text);
      };
      sendBtn.addEventListener('click', send);
      typed.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
      QUESTIONS.forEach((q) => {
        const b = ui.button(q.label, { variant: 'ghost', small: true, onClick: () => ask(q, b) });
        b.dataset.q = q.id;
        asks.append(b);
      });
      if (ctx.autoplay) QUESTIONS.slice(0, N).forEach((q) => ask(q, null));
    });

    const res = await ctx.pin({
      answer: { lat: t.lat, lng: t.lng, label: `${t.county}, ${t.state}` },
      view: { bounds: [[24, -125], [50, -66]] },
      scale: 700,
      title: 'Where do they live?',
      prompt: 'Click the map to place this neighborhood.',
    });
    const unasked = QUESTIONS.filter((q) => !asked.includes(q.id));
    const askedLabels = asked.map((id) => QUESTIONS.find((q) => q.id === id).label.replace(/\?$/, ''));
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['Answer', `${t.county} County, ${STATE_NAMES[t.state] || t.state} (${t.state}), Census tract ${t.tract}`], ['Population', t.pop.toLocaleString('en-US')], ['You asked', askedLabels.join(' / ')]]),
      ui.callout('The three most unusual numbers for this tract (versus the sample median):', 'good'),
      ui.h('ul', { class: 'small', style: { margin: '0', paddingLeft: '1.2em' } }, ...standouts(t, ctx.data.tracts).map((x) => ui.h('li', {}, x))),
      ui.callout('How the clues point here:', 'good'),
      ui.h('ul', { class: 'small', style: { margin: '0', paddingLeft: '1.2em' } }, ...reading(t).map((x) => ui.h('li', {}, x))),
      ...(unasked.length ? [ui.callout('Questions you did not ask, and how they would have answered:', 'warn'), ...unasked.map((q) => ui.h('div', {}, ui.h('div', { class: 'small muted' }, q.label), ui.quote(q.say(t))))] : []));
    return res;
  },
};
