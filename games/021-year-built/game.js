// #21 Year Built — three photos of NYC buildings (Wikidata/Commons, year cross-checked against NYC PLUTO); guess the year each was built.
export const SCALE = 30;
export const MIN_YEAR = 1750;
export const MAX_YEAR = 2025;
/** 1 at 0 years off, 1/e at 30 years off. */
export const yearScore = (guess, answer) => Math.exp(-Math.abs(guess - answer) / SCALE);

export const thumb = (f) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=640`;

/** Era tiers: every daily puzzle has one early, one mid-century and one recent building (order shuffled). */
export const TIERS = [[0, 1900], [1900, 1950], [1950, 3000]];
export const tierOf = (items, [lo, hi]) => items.filter((b) => b.year >= lo && b.year < hi);

const CLASS = {
  A: 'Single-family house', B: 'Two-family house', C: 'Walk-up apartments', D: 'Elevator apartments', E: 'Warehouse', F: 'Factory', G: 'Garage', H: 'Hotel', I: 'Health / social facility',
  J: 'Theater', K: 'Retail', L: 'Loft building', M: 'Church / religious', N: 'Institutional housing', O: 'Office building', P: 'Cultural / public facility', Q: 'Recreation facility',
  R: 'Condominium', S: 'Mixed residential and retail', U: 'Utility', W: 'Educational facility', Y: 'Government', Z: 'Other',
};
export const classLabel = (c) => CLASS[(c || '')[0]] || 'Building';

/** Era-specific teaching text used in the result card. */
export function eraClue(year) {
  if (year < 1830) return 'Federal or colonial style: low brick, stone or timber, small-paned windows and a symmetrical front. Very few of these survive in New York.';
  if (year < 1880) return 'Mid-19th century: brownstone or brick row houses, Greek Revival doorways, cast-iron fronts and tall, narrow windows, rarely above 5 or 6 stories.';
  if (year < 1915) return '1880-1915: steel frames and elevators let buildings climb. Limestone or red-brick fronts with ornate Beaux-Arts or Romanesque detail (cornices, arched windows, carvings).';
  if (year < 1945) return '1915-1945: the 1916 zoning law forced stepped-back setback towers. Art Deco vertical lines, geometric reliefs and tan-brown brick are the giveaways.';
  if (year < 1975) return 'Postwar modernism: ornament stripped away, light brick, long ribbon windows and glass curtain walls. Slab towers and public-housing blocks multiply.';
  if (year < 2000) return '1975-2000: postmodernism gives up the plain box for color blocks, arches and shaped tops, often in dark brick and reflective glass.';
  return 'After 2000: big glass curtain walls, irregular massing and metal panels, a very high window-to-wall ratio and almost no traditional ornament.';
}

export function floorClue(b) {
  if (!b.fl) return '';
  if (b.fl >= 30) return `A ${b.fl}-story skyscraper is only possible in the steel-frame era, so its height alone puts it after 1890.`;
  if (b.fl >= 12) return `A ${b.fl}-story tower needs a steel frame and elevators, so it is almost certainly post-1890.`;
  if (b.fl <= 4) return `Only ${b.fl} ${b.fl === 1 ? 'story' : 'stories'}: low masonry buildings were the norm in the 19th century, but this could also be a later low-rise.`;
  return `A mid-rise of ${b.fl} stories; judge it by the facade material and window style.`;
}

export default {
  meta: {
    num: 21,
    slug: 'year-built',
    title: 'Year Built',
    tagline: 'Three photos of New York buildings. Read the windows, materials and ornament to guess the year each was built.',
    category: 'nyc',
    data: 'snapshot',
    howTo: [
      'Three NYC buildings a day: one from before 1900, one from 1900-1949 and one from 1950 on. Names stay hidden; you only get the borough.',
      'Study the windows, materials, ornament and silhouette, then drag the slider or type the year it was built (1750-2025).',
      'Scoring: each building earns 100·e^(-error/30). Exactly right is 100, 30 years off is about 37, 100 years off is nearly 0. Three buildings, 300 points max.',
    ],
    scoring: 'Each building scores 100·e^(-years off/30); three buildings, 300 max.',
    sources: [
      { name: 'Wikidata SPARQL (year built P571, coordinates, image P18)', url: 'https://query.wikidata.org/' },
      { name: 'Wikimedia Commons (photos and licenses)', url: 'https://commons.wikimedia.org/' },
      { name: 'NYC PLUTO tax-lot data (NYC Open Data; used to cross-check year, floors and use)', url: 'https://data.cityofnewyork.us/City-Government/Primary-Land-Use-Tax-Lot-Output-PLUTO-/64uk-42ks' },
    ],
    dataNote: 'The original idea was Mapillary street imagery plus PLUTO. The Mapillary API needs a key that cannot ship in a front-end, so photos come from Wikimedia Commons buildings that have a year built.'
      + ' To weed out Wikidata "opened" years and plain errors, we keep only buildings where a PLUTO lot within 45 m has a yearbuilt within 3 years of the Wikidata year. PLUTO years are administrative records, so a heavily renovated building may not match its look.'
      + ' Photos are a snapshot, not live street views.',
  },

  puzzle({ data, pick, rng }) {
    const items = TIERS.map((t) => pick(tierOf(data.items, t)));
    return { items: rng.shuffle(items) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const n = p.items.length;
    for (const b of p.items) { const im = new Image(); im.src = thumb(b.file); } // warm the cache
    const results = [];
    for (let i = 0; i < n; i++) {
      const b = p.items[i];
      ctx.log('round', i + 1, b.id);
      const img = ui.h('img', {
        src: thumb(b.file), alt: 'Photo of a New York City building', referrerpolicy: 'no-referrer',
        style: { display: 'block', margin: '0 auto', maxWidth: '100%', maxHeight: '420px', objectFit: 'contain', borderRadius: 'var(--radius, 8px)', background: 'var(--paper2)', minHeight: '160px' },
      });
      const holder = ui.h('div', {}, img);
      img.addEventListener('error', () => {
        ctx.log.warn('image failed', b.id);
        holder.replaceChildren(ui.callout('The photo did not load (Wikimedia Commons may be down). Go on the borough and your gut for a first guess.', 'warn'));
      });
      const panel = ui.panel({ kicker: `Building ${i + 1} of ${n}`, title: 'What year was this built?' }, holder,
        ui.h('div', { class: 'small muted' }, `📍 ${b.boro || 'New York'}`));
      ctx.stage.append(panel);
      const r = await ctx.estimate({
        answer: b.year, min: MIN_YEAR, max: MAX_YEAR, step: 1, initial: 1900, format: (v) => String(Math.round(v)),
        scoring: yearScore, title: 'Year built', prompt: 'Drag the slider or type a year.',
      });
      const g = Math.round(r.guess);
      const off = Math.abs(g - b.year);
      panel.append(ui.callout(`${b.name} · ${b.year}`, off <= 10 ? 'good' : off <= 40 ? 'warn' : 'bad'));
      r.detail = ui.h('div', { class: 'ds-stack' },
        ui.kv([
          ['Building', b.name],
          ['Location', b.addr ? `${b.boro} · ${b.addr}` : b.boro],
          ['Built', `${b.year} (Wikidata) · ${b.py} (PLUTO lot record)`],
          ['Your guess', `${g} (${off} ${off === 1 ? 'year' : 'years'} off, ${Math.round(100 * yearScore(g, b.year))} pts)`],
          ['Use and height', `${classLabel(b.cls)}${b.fl ? ` · ${b.fl} ${b.fl === 1 ? 'story' : 'stories'}` : ''}`],
          ['Photo', `${b.author} · ${b.lic}`],
        ]),
        ui.h('div', { class: 'small' }, `How to tell: ${eraClue(b.year)}${floorClue(b) ? ' ' + floorClue(b) : ''}`));
      results.push(r);
    }
    const res = ctx.combine(results);
    res.detail = ui.h('div', { class: 'ds-stack' }, results.map((r) => r.detail));
    return res;
  },
};
