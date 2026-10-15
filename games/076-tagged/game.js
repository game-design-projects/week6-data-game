// #76 Tagged — Stack Overflow titles with the tags removed; pick the tags, scored by Jaccard overlap.
import { jaccard, titleHits } from './tagged-core.js';
export { jaccard, titleHits };

export const N_Q = 5;
export const N_OPT = 10;

// weighted sample without replacement (weights = how often a tag is used, so rare tags are not a giveaway)
function weighted(rng, items, weights, n) {
  const pool = items.map((x, i) => ({ x, w: weights[i] }));
  const out = [];
  while (out.length < n && pool.length) {
    let r = rng.float() * pool.reduce((s, p) => s + p.w, 0);
    let i = 0;
    while (i < pool.length - 1 && (r -= pool[i].w) > 0) i++;
    out.push(pool.splice(i, 1)[0].x);
  }
  return out;
}

export function buildRound(data, qi, rng) {
  const q = data.q[qi];
  const want = N_OPT - q.g.length;
  const nearCand = (data.rel[q.g[0]] ? q.g : []).flatMap((t) => data.rel[t] || []).filter((u) => !q.g.includes(u));
  const score = {};
  nearCand.forEach((u) => { score[u] = (score[u] || 0) + 1; });
  const nearList = Object.keys(score).sort((a, b) => score[b] - score[a] || (a < b ? -1 : 1)).slice(0, 14);
  const fromNear = rng.sample(nearList, Math.min(nearList.length, Math.ceil(want / 2)));
  const restTags = data.tags.filter((t) => !q.g.includes(t) && !fromNear.includes(t));
  const restW = restTags.map((t) => data.f[data.tags.indexOf(t)]);
  const rest = weighted(rng, restTags, restW, want - fromNear.length);
  return { id: q.id, title: q.t, year: q.y, score: q.s, tags: q.g, options: rng.shuffle([...q.g, ...fromNear, ...rest]) };
}

export default {
  meta: {
    num: 76,
    slug: 'tagged',
    title: 'Tagged',
    tagline: 'Top-voted Stack Overflow questions with the tags removed. From the title alone, pick the real tags out of 10 candidates, scored by Jaccard overlap.',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      'Each day brings 5 real, highly voted Stack Overflow questions (top questions from each year, 2009-2022). You only see the title; the tags are hidden.',
      'Each question offers 10 candidate tags, 2-5 of which the asker really used. Select all the ones you think are right, then submit.',
      'Each question scores your selection\'s intersection \u00f7 union with the real tags (Jaccard, 0-1). Over-picking, missing tags and wrong picks all cost points; 5 is a perfect score over 5 questions.',
      'Half of the decoys are \u201cclose relatives\u201d that often appear with the real tags (such as swift and swiftui); the other half are other tags sampled by how often they are used.',
    ],
    scoring: 'Each question scores |selected \u2229 real| \u00f7 |selected \u222a real|; the 5 questions add up to 5 max. Selecting all 10 only earns about 0.3 per question.',
    sources: [
      { name: 'Stack Exchange API /questions (Stack Overflow)', url: 'https://api.stackexchange.com/docs/questions', note: 'Top 400 questions by votes for each year, 2009-2022; content is CC BY-SA 4.0' },
    ],
    dataNote: 'A snapshot: from each year\'s 400 most-voted questions, those with 2-5 tags that are all in the common tag list were kept, then the top 38 per year, 532 questions in all, arranged into 106 daily sets (each set takes one question from each of five difficulty tiers, easy to hard). Only titles are used: the API does not return bodies, and bodies would spell out the technology names. The original idea was free-text tags; to make Jaccard scoring fair and fun, this version uses candidate selection instead. The Stack Exchange API needs no key and supports CORS, but the game does not need \u201ctoday\u2019s\u201d data, so nothing is fetched live.',
  },

  puzzle({ data, rng, pick }) {
    const k = pick(data.sets.map((_, i) => i));
    return { rounds: data.sets[k].map((qi) => buildRound(data, qi, rng)) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    ctx.log('puzzle', p.rounds.map((r) => r.id));
    const rounds = p.rounds.map((r) => ({
      prompt: r.title,
      body: ui.h('div', { class: 'small muted' }, `Posted ${r.year} \u00b7 ${r.score.toLocaleString('en-US')} votes \u00b7 select all the tags (2-5)`),
      options: r.options.map((t) => ({ label: t })),
      correct: r.tags.map((t) => r.options.indexOf(t)),
      explain: `Real tags: ${r.tags.join(', ')}`,
    }));
    const res = await ctx.rounds({ rounds, multi: true, minWidth: 110, title: 'Which tags does this question have?' });
    let seen = 0, total = 0;
    const rows = p.rounds.map((r) => {
      const hit = titleHits(r.title, r.tags), hid = r.tags.filter((t) => !hit.includes(t));
      seen += hit.length; total += r.tags.length;
      const why = hit.length === r.tags.length ? `The title names every tag directly (${hit.join(', ')}).`
        : hit.length ? `The title names ${hit.join(', ')} directly; the rest (${hid.join(', ')}) has to be inferred from context, for example a framework implies its language and a platform implies its tools.`
          : `The title names no tag directly; ${hid.join(', ')} all have to be inferred from context.`;
      return { q: ui.h('a', { href: `https://stackoverflow.com/q/${r.id}`, target: '_blank', rel: 'noopener' }, r.title), tags: r.tags.join(', '), why };
    });
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `Of today\'s ${total} real tags, ${seen} appear directly in the titles. The pattern: a technology named in the title is almost always a tag; frameworks bring their language along (swiftui \u2192 swift, ios), and \u201chow do I\u201d questions often carry concept tags (sorting, regex, string).`),
      ui.table({
        columns: [{ key: 'q', label: 'Question' }, { key: 'tags', label: 'Real tags' }, { key: 'why', label: 'Clue' }],
        rows,
      }));
    return res;
  },
};
