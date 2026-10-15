// #100 Data Connections — 16 items, 4 hidden groups; each group shares one real Wikidata statement.
export const PROPS = {
  P57: 'director (P57)', P50: 'author (P50)', P170: 'creator (P170)', P175: 'performer (P175)',
  P47: 'shares border with (P47)', P161: 'cast member (P161)', P178: 'developer (P178)',
};

/** Score: 25 per group found, −5 per mistake (mirrors ctx.groups). Pure helper for tests. */
export function groupScore(found, wrong) { return Math.max(0, found * 25 - wrong * 5); }

/** True when the 16 labels of a puzzle are all different (ambiguity check). */
export function unambiguous(groups) {
  const seen = new Set();
  for (const g of groups) for (const it of g.items) seen.add(it.l);
  return seen.size === groups.reduce((n, g) => n + g.items.length, 0);
}

/** Year span of a group's items, e.g. "1960–1999", or '' when no years are known. */
export function yearSpan(items) {
  const ys = items.map((i) => i.y).filter(Number.isFinite);
  if (ys.length < 2) return ys.length ? String(ys[0]) : '';
  const lo = Math.min(...ys); const hi = Math.max(...ys);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

/** One-line "how you could tell" for the result card, specific to this group and puzzle. */
export function why(g, groups) {
  const span = yearSpan(g.items);
  const twins = groups.filter((o) => o !== g && o.unit === g.unit).map((o) => o.n);
  const parts = [`On Wikidata all four have \u201c${PROPS[g.prop] ?? g.prop} = ${g.n}\u201d`];
  if (span && g.kind !== 'border') parts.push(`they span ${span}`);
  if (twins.length) parts.push(`easiest to mix up with the other ${g.unit} group${twins.length > 1 ? 's' : ''} (${twins.join(', ')})`);
  return parts.join('; ') + '.';
}

/** Types of item present today, for the rules hint (generic, not an answer). */
export function unitsOf(groups) { return [...new Set(groups.map((g) => g.unit))]; }

export default {
  meta: {
    num: 100,
    slug: 'data-connections',
    title: 'Data Connections',
    tagline: 'Sixteen items hide four groups, each sharing one real Wikidata statement. Find them.',
    category: 'model',
    data: 'snapshot',
    howTo: [
      'Sixteen items fall into four groups of four. Select the four you think belong together and press Submit; a correct group flips open and shows the relation it shares.',
      'Each group shares one Wikidata property, such as films by a director, works by an author, or countries bordering a given country. Items are the best-known entries for that relation.',
      'You get four mistakes. “One away” means three of your four are in the same group. Shuffle can give you a fresh view.',
      'Scoring: +25 for each group found, \u22125 for each mistake, 100 at most. The result card explains how each group could be spotted.',
    ],
    scoring: '+25 per group found, \u22125 per mistake (max 100, min 0).',
    sources: [
      { name: 'Wikidata Query Service (SPARQL)', url: 'https://query.wikidata.org/', note: 'best-known items per relation, ranked by number of Wikipedia language editions (sitelinks)' },
      { name: 'Wikidata', url: 'https://www.wikidata.org/', note: 'properties P57 director, P161 cast member, P50 author, P170 creator, P175 performer, P178 developer, P47 shares border with (land neighbours only)' },
    ],
    dataNote: 'Puzzles are generated offline, not live. From Wikidata we take over a hundred directors, actors, authors, singers and bands, game studios and countries, keep each one\u2019s best-known 14 items (films, books, albums or songs, games, countries), and combine four groups at random. An offline ambiguity filter stands in for human or LLM review: any item that also appears in another fetched group (say, a film that one person directed and another starred in) is dropped, and country groups keep only land neighbours. Wikidata is crowdsourced, so a few entries may be incomplete; that does not affect whether the answer is unique.',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { groups: p.groups };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    ctx.log('puzzle', p.groups.map((g) => g.qid));
    ctx.stage.append(ui.panel({ kicker: 'Rules', title: '4 \u00d7 4' },
      ui.h('p', { class: 'ink2' }, `Sixteen items, four groups; each group shares one Wikidata relation. Today\u2019s items include: ${unitsOf(p.groups).join(', ')}.`),
      ui.h('p', { class: 'small muted' }, 'Start with the least ambiguous group. Items of the same kind (say, films by different directors) can be told apart by era, genre and cast.')));
    const r = await ctx.groups({
      groups: p.groups.map((g) => ({ label: g.label, items: g.items.map((i) => i.l) })),
      mistakes: 4,
      title: 'Find the four groups',
    });
    r.detail = ui.h('div', { class: 'ds-stack' }, p.groups.map((g) => ui.h('div', {},
      ui.h('div', { style: { fontWeight: '600' } }, g.label),
      ui.h('div', {}, g.items.map((i) => (i.y ? `${i.l} (${i.y})` : i.l)).join(', ')),
      ui.h('div', { class: 'small muted' }, why(g, p.groups), ' ',
        ui.h('a', { href: `https://www.wikidata.org/wiki/${g.qid}`, target: '_blank', rel: 'noopener' }, g.qid)))));
    return r;
  },
};
