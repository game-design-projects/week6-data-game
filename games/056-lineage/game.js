// #56 Lineage — a royal family tree with every name blacked out; name the dynasty.
import { fmtNum } from '../../engine/core.js';

export const yearStr = (y) => (y == null ? '?' : y < 0 ? `${-y} BC` : String(y));
export const spanStr = (n) => `${yearStr(n.by)}–${n.dy == null ? (n.by > 1910 ? '' : '?') : yearStr(n.dy)}`;
export const mid = (h) => Math.round((h.first + h.last) / 2);
export const CONTINENTS = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'];
export const contList = (cs) => cs.join(', ');
/** "House of Orange-Nassau" -> "Orange-Nassau"; "Ming dynasty" -> "Ming". */
export const keyName = (name) => name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/^(Imperial |Capetian )?House of\s+/i, '').replace(/\s+(dynasty|house|clan)$/i, '').replace(/\s+dynasty of .*$/i, '').trim();
const plain = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Short alias list so "Bourbon" / "Habsburg" / "Zahringen" also find the house. */
export const aliasesOf = (name) => {
  const k = keyName(name);
  return [...new Set([k, plain(k), plain(name)])].filter((x) => x && x !== name);
};
/** Linear score: 100 on the 1st guess, then −100/6 per extra guess, 0 when never found. */
export const scoreFor = (n, won, max = 6) => (won ? Math.round((100 * (max - n + 1)) / max) : 0);
/** Flatten houses into puzzles: one per (house, tree). */
export const poolOf = (data) => data.houses.flatMap((h, hi) => h.trees.map((_, ti) => ({ q: h.q, t: ti, hi })));
/** Feedback for a guessed house vs the answer: era direction + continent match. */
export function compare(g, a) {
  const d = mid(g) - mid(a);
  const era = Math.abs(d) < 60 ? { text: 'Same era', state: 'hit' }
    : { text: `${d > 0 ? 'Later' : 'Earlier'} by ~${fmtNum(Math.round(Math.abs(d) / 50) * 50)} yrs`, state: Math.abs(d) < 200 ? 'near' : undefined, num: true };
  const shared = g.cont.filter((c) => a.cont.includes(c));
  const reg = !g.cont.length || !a.cont.length ? { text: '—' } : shared.length ? { text: 'Same continent', state: 'hit' } : { text: 'Other continent', state: 'miss' };
  return [era, reg];
}

export default {
  meta: {
    num: 56,
    slug: 'lineage',
    title: 'Lineage',
    tagline: 'A royal family tree with every name blacked out, leaving only birth and death years and sex. Name the dynasty.',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      'The chart is a real family tree of one royal house from Wikidata: indentation shows parent and child, ♂/♀ is sex, black bars are blacked-out names, followed by birth-death years and title (place names blacked out).',
      'Guess a dynasty from the list (up to 6 tries). Each wrong guess unlocks another clue: statistics, titles, members\' first names, regions, and the first letter of the house name.',
      'Each guess tells you whether your dynasty is earlier or later than the answer, and whether it is on the same continent.',
      'Reading tips: dense generations and short lives usually mean an early or war-torn era; a high share of women and many Queens points to a dynasty that allowed female succession; words like Pharaoh, Shah or Sultan narrow the region at once.',
    ],
    scoring: '100 points for a correct first guess, then about 17 fewer for each extra guess (100 / 83 / 67 / 50 / 33 / 17). No correct guess in 6 tries scores 0.',
    sources: [
      { name: 'Wikidata Query Service (family P53, father P22, mother P25, titles P39/P97, continents of citizenship P27/P30)', url: 'https://query.wikidata.org/' },
      { name: 'Wikidata entity search API (resolving well-known dynasties)', url: 'https://www.wikidata.org/w/api.php?action=help&modules=wbsearchentities' },
    ],
    dataNote: 'Snapshot data, fetched on Oct 14, 2026. The endpoints query.wikidata.org and wikidata.org/w/api.php support CORS but the queries are heavy and often rate-limited, so they are not called live from the browser; the build/ scripts generate the data offline. Trees only include members for whom Wikidata records a birth year and parents, so they are not complete genealogies. Each dynasty contributes up to 3 non-overlapping subtrees of at most 14 people each (famous members first). Titles keep only generic ranks (King, Duke, Emperor, etc.); all other wording and place names are removed so they do not give the answer away. The era and region feedback is computed over all members of the dynasty with a birth year.',
  },

  puzzle({ data, pick }) {
    const p = pick(poolOf(data));
    return { q: p.q, t: p.t };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const houses = ctx.data.houses;
    const ans = houses.find((h) => h.q === p.q);
    const { tree: nodes, names } = ans.trees[p.t];
    const byQ = new Map(houses.map((h) => [h.q, h]));
    ctx.log('lineage answer', ans.name, 'tree', p.t, 'nodes', nodes.length);

    const depth = (i) => { let d = 0; for (let k = nodes[i].p; k >= 0; k = nodes[k].p) d++; return d; };
    const depths = nodes.map((_, i) => depth(i));
    const tree = ui.h('div', { class: 'mono small', style: { lineHeight: '1.8' } },
      nodes.map((n, i) => ui.h('div', { style: { paddingLeft: `${Math.min(depths[i], 6) * 8}px`, display: 'flex', flexWrap: 'wrap', columnGap: '0.6em', alignItems: 'baseline' } },
        ui.h('span', { style: { whiteSpace: 'nowrap' } },
          ui.h('span', { class: 'muted' }, depths[i] ? '└ ' : ''),
          ui.h('span', { style: { color: n.w ? 'var(--accent)' : 'var(--ink2)' }, 'aria-label': n.w ? 'female' : 'male' }, n.w ? '♀ ' : '♂ '),
          ui.redact('▇▇▇▇▇')),
        ui.h('span', { style: { whiteSpace: 'nowrap' } }, spanStr(n)),
        n.t ? ui.h('span', { class: 'muted', style: { whiteSpace: 'nowrap' } }, n.t) : null)));

    const treeMin = Math.min(...nodes.map((n) => n.by)), treeMax = Math.max(...nodes.map((n) => n.by));
    const gens = Math.max(...depths) + 1;
    const stats = ui.h('div', { class: 'ds-grid', style: { '--min': '120px' } },
      ui.stat({ label: 'Birth-year span in tree', value: `${fmtNum(treeMax - treeMin)} yrs`, sub: `${nodes.length} members` }),
      ui.stat({ label: 'Generations in tree', value: gens, sub: gens > 1 ? `about ${Math.round((treeMax - treeMin) / (gens - 1))} yrs per generation` : '' }),
      ui.stat({ label: 'Average lifespan', value: ans.avgLife ? `${ans.avgLife} yrs` : '—', sub: `${ans.female}% women` }),
      ui.stat({ label: 'Members on record', value: ans.total, sub: 'with a birth year' }));
    const titles = ans.titles.length
      ? ui.h('div', 'Most common title ranks in this dynasty:', ui.h('ul', { style: { margin: '4px 0 0', paddingLeft: '1.2em' } }, ans.titles.map(([t, c]) => ui.h('li', `${t}  ×${c}`))))
      : 'Wikidata has almost no titles recorded for this dynasty.';
    const key = keyName(ans.name);
    const clues = [
      tree,
      stats,
      titles,
      ui.h('div', 'Names of the members in the tree (given names only, no surname or title):', ui.h('div', { style: { marginTop: '6px' } }, ui.chips(names))),
      `This family was mainly active in: ${contList(ans.cont)}.`,
      ui.h('div', `The dynasty name (without "House of" / "dynasty") starts with "${key[0].toUpperCase()}" and has ${key.replace(/[^\p{L}]/gu, '').length} letters. A famous member:`, ui.h('b', ` ${ans.famous}`)),
    ];

    const options = houses.map((h) => ({ id: h.q, label: h.name, aliases: aliasesOf(h.name) }));
    const res = await ctx.guess({
      options,
      answer: ans.q,
      maxGuesses: 6,
      title: 'Which dynasty is this?',
      placeholder: 'Type a dynasty, e.g. Bourbon…',
      clues,
      cluesTitle: 'Family tree and clues',
      columns: ['Era', 'Region'],
      near: (g, a) => Math.abs(mid(byQ.get(g.id)) - mid(byQ.get(a.id))) < 150 && compare(byQ.get(g.id), byQ.get(a.id))[1].state === 'hit',
      feedback: (g, a) => (g.id === a.id ? [{ text: '🎯', state: 'hit' }, { text: '🎯', state: 'hit' }] : compare(byQ.get(g.id), byQ.get(a.id))),
      scoring: scoreFor,
    });

    const topT = ans.titles.slice(0, 3).map(([t, c]) => `${t} (${c})`).join(', ');
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `Answer: ${ans.name}. ${ans.total} members have a recorded birth year, mostly born between ${yearStr(ans.first)} and ${yearStr(ans.last)}.`),
      ui.table({
        columns: [{ key: 'n', label: 'Member' }, { key: 'y', label: 'Lived' }, { key: 'tr', label: 'Title' }],
        rows: nodes.map((n, i) => ({ n: `${depths[i] ? '└ ' : ''}${n.w ? '♀' : '♂'} ${n.n}`, y: spanStr(n), tr: n.tr || '' })),
      }),
      ui.h('div', { class: 'small muted' }, `Giveaways in this chart: births fall in ${yearStr(treeMin)}-${yearStr(treeMax)}, across ${gens} generations of about ${gens > 1 ? Math.round((treeMax - treeMin) / (gens - 1)) : '—'} years each; ${topT ? `common titles are ${topT}; ` : ''}the members were mainly active in ${contList(ans.cont)}; average lifespan ${ans.avgLife ?? '—'} years, ${ans.female}% women; the best-known member is ${ans.famous}.`));
    return res;
  },
};
