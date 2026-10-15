// #48 Dialect Pin — the NYT dialect quiz run backwards: read five answers, name the state they grew up in.
import { haversineKm, bearingDeg, arrow, fmtKm } from '../../engine/core.js';

/** Naive-Bayes share (0..1) of each state given [[qid, optionKey], …] (uniform prior, +1% smoothing). */
export function posterior(data, picks) {
  const codes = Object.keys(data.states);
  const ll = codes.map((c) => picks.reduce((a, [q, k]) => a + Math.log((data.questions[q].opts[k].p[c] ?? 0) / 100 + 0.01), 0));
  const mx = Math.max(...ll);
  const ex = ll.map((v) => Math.exp(v - mx));
  const z = ex.reduce((a, b) => a + b, 0);
  return Object.fromEntries(codes.map((c, i) => [c, ex[i] / z]));
}

/** Per-clue "tell": how many times more common the answer is in the true state than the 48-state average. */
export function clueLifts(data, st, clues) {
  return clues.map(([q, k]) => {
    const o = data.questions[q].opts[k];
    const mine = o.p[st] / 100;
    return { q, k, mine, nat: o.nat, lift: mine / Math.max(o.nat, 0.005) };
  });
}

/** Top-n states by posterior after all given picks (the "lookalikes"), excluding `skip`. */
export function lookalikes(data, picks, skip, n = 2) {
  return Object.entries(posterior(data, picks)).filter(([c]) => c !== skip).sort((a, b) => b[1] - a[1]).slice(0, n);
}

/** Clue lines to scan for answer leaks: everything the player sees before guessing. */
export function clueTexts(data, p) {
  return [...p.clues.map(([q, k]) => `${data.questions[q].label} ${data.questions[q].opts[k].t}`)];
}

/** How many answers are visible after `n` guesses have been made (2 at the start, +1 per wrong guess, max 5). */
export const visibleAnswers = (n) => Math.min(5, n + 2);

export default {
  meta: {
    num: 48,
    slug: 'dialect-pin',
    title: 'Dialect Pin',
    tagline: 'The dialect quiz played backwards: read how someone says soda or pop, and guess which US state they grew up in.',
    category: 'words',
    data: 'snapshot',
    howTo: [
      'The Harvard Dialect Survey asked Americans over a hundred questions about word choice: is it soda or pop? Kitty-corner or catty-corner?',
      'At first you see just 2 answers from one speaker. Each wrong guess reveals one more answer, up to 6 guesses.',
      'Each guess tells you how far that state is from the answer, in which direction, and its "fit": looking only at the answers revealed so far, how likely people in that state are to talk this way, as a share of the 48 states. Guessed states are shaded on the map below, and place names appear only after the reveal.',
      'Trick: look for phrases unique to one region, like y\'all, buggy, bubbler or rolling. They help far more than words used everywhere, like sneakers or soda.',
    ],
    scoring: '100 points for a first-guess hit, about 17 fewer for each extra guess, and 0 if all 6 miss.',
    sources: [
      { name: 'Harvard Dialect Survey (Bert Vaux & Scott Golder, 2003)', url: 'http://www4.uwm.edu/FLL/linguistics/dialect/maps.html', note: 'Answer shares by state' },
      { name: 'State result text mirror at asucbi/BDSR2', url: 'https://github.com/asucbi/BDSR2/tree/main/proc/hds', note: 'Where this game actually downloads from (the original site is hard to reach)' },
    ],
    dataNote: 'This is a static 2003 survey with no live API (the original uwm.edu site is flaky and has no CORS or API), so it is a snapshot. The data are answer shares by state, not one real person\'s full questionnaire. The "speaker" is a typical stand-in built from a state\'s 5 most distinctive phrasings (options used by at least 12% of the state and at least 1.7 times the national average). The survey has no Alaska, Hawaii or Washington, DC, and 5 states are skipped because their phrasing is too close to the national average. Each state has up to 4 clue sets, 145 puzzles in all (no repeats until the pool runs out); each set must put the true state in the top 4 of 48. Only word-choice questions are used, since the phonetic symbols of pronunciation questions are lost in the mirror.',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { st: p.st, clues: p.clues, rank: p.rank };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const D = ctx.data;
    const S = D.states;
    const Q = D.questions;
    const ans = S[p.st];
    const line = ([q, k]) => ui.h('div', { style: { marginBottom: '4px' } },
      ui.h('span', { class: 'muted small' }, Q[q].label, ':'), ' ', ui.h('b', `“${Q[q].opts[k].t}”`));
    const clues = [
      ui.h('div', { class: 'ds-stack' }, ui.h('div', { class: 'small muted' }, 'One speaker answered:'), line(p.clues[0]), line(p.clues[1])),
      ...p.clues.slice(2).map(line),
      `Region: ${{ NE: 'the Northeast', S: 'the South', MW: 'the Midwest', W: 'the West' }[ans.reg]} of the US.`,
    ];
    const options = Object.entries(S).map(([c, s]) => ({ id: c, label: s.en, hint: c, aliases: [c] }));
    let calls = 0;
    const tried = [];
    const mapper = makeMap(ctx, S);
    const gp = ctx.guess({
      title: 'Which state did they grow up in?',
      placeholder: 'Type a state, e.g. TX or Texas…',
      options,
      answer: p.st,
      maxGuesses: 6,
      clues,
      cluesTitle: 'What the speaker said',
      columns: ['Distance', 'Direction', 'Fit'],
      near: (g, a) => haversineKm(S[g.id], S[a.id]) < 450,
      feedback: (g) => {
        calls++;
        tried.push(g.id);
        mapper.update(tried, g.id === p.st ? p.st : null);
        const shown = p.clues.slice(0, visibleAnswers(calls - 1));
        const post = posterior(D, shown)[g.id];
        ctx.log('guess', { g: g.id, shown: shown.length, post: +post.toFixed(3) });
        const pct = `${Math.round(post * 100)}%`;
        const fit = { text: pct, num: true, state: post >= 0.25 ? 'hit' : post >= 0.08 ? 'near' : undefined };
        if (g.id === p.st) return [{ text: '0 km', state: 'hit', num: true }, { text: '🎯', state: 'hit' }, fit];
        const km = haversineKm(S[g.id], ans);
        return [{ text: fmtKm(km), num: true, state: km < 450 ? 'near' : undefined }, { text: arrow(bearingDeg(S[g.id], ans)) }, fit];
      },
    });
    mapper.mount(gp);
    const res = await gp;
    mapper.update(tried, p.st, true);

    const lifts = clueLifts(D, p.st, p.clues);
    const best = lifts.reduce((a, b) => (b.lift > a.lift ? b : a));
    const weak = lifts.reduce((a, b) => (b.lift < a.lift ? b : a));
    const rows = p.clues.map(([q, k], i) => {
      const o = Q[q].opts[k];
      const top = Object.entries(o.p).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => `${S[c].en} ${v}%`).join(', ');
      return { q: Q[q].label, a: o.t, mine: `${o.p[p.st]}%`, nat: `${(o.nat * 100).toFixed(0)}%`, lift: `×${lifts[i].lift.toFixed(1)}`, top };
    });
    const like = lookalikes(D, p.clues, p.st, 2).map(([c, v]) => `${S[c].en} (${Math.round(v * 100)}%)`).join(', ');
    const bq = Q[best.q];
    const wq = Q[weak.q];
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `Answer: ${ans.en} (${p.st}). What identifies a state is how many times more common an answer is there than the national average (the "Lift" column):`),
      ui.table({
        columns: [{ key: 'q', label: 'Question' }, { key: 'a', label: 'Answer' }, { key: 'mine', label: ans.en, num: true }, { key: 'nat', label: 'State avg', num: true }, { key: 'lift', label: 'Lift', num: true }, { key: 'top', label: 'Top 3 states' }],
        rows,
      }),
      ui.callout(`The biggest giveaway: for “${bq.label}”, the answer “${bq.opts[best.k].t}”. ${(best.mine * 100).toFixed(0)}% of ${ans.en} says it, ${best.lift.toFixed(1)}x the national average. The least useful: “${wq.label}”, “${wq.opts[weak.k].t}” (only ×${weak.lift.toFixed(1)}).`),
      ui.callout(`Taken together, the 5 answers give ${ans.en} a ${Math.round(posterior(D, p.clues)[p.st] * 100)}% share among the 48 states, ranked #${p.rank}. The closest lookalikes: ${like}.`));
    ctx.log('done', { st: p.st, score: res.score });
    return res;
  },
};

/**
 * Small US map under the guess panel: every guessed state is shaded, the answer is revealed on the last step.
 * Basemap is label-free while guessing; labels only after the reveal. Never throws (the game works without it).
 */
function makeMap(ctx, S) {
  const byName = Object.fromEntries(Object.entries(S).map(([c, s]) => [s.en, c]));
  let api = null;
  let pending = null;
  let layers = {};
  const paint = () => {
    if (!api || !pending) return;
    const col = ctx.ui.colors();
    const { tried, answer, final } = pending;
    for (const [c, l] of Object.entries(layers)) {
      const guessed = tried.includes(c);
      const hit = answer === c && (final || guessed);
      l.setStyle({
        fillOpacity: hit ? 0.7 : guessed ? 0.4 : 0.04,
        fillColor: hit ? col.hit : col.near,
        color: guessed || hit ? col.ink2 : col.muted,
        weight: guessed || hit ? 1.6 : 0.6,
      });
    }
    if (final) api.setLabels(true);
  };
  return {
    update(tried, answer, final = false) { pending = { tried: [...tried], answer, final }; paint(); },
    async mount(guessPromise) {
      try {
        await ctx.sleep(0);
        const box = ctx.ui.panel({ kicker: 'Map', title: 'States you guessed' });
        ctx.stage.append(box);
        const m = await ctx.ui.createMap({ bounds: [[24.3, -125.5], [49.8, -66.2]], height: 340, minZoom: 3, maxZoom: 6 });
        box.append(m.el);
        const gj = await ctx.ui.geo('states');
        for (const f of gj.features) {
          const c = byName[f.properties?.name];
          if (!c) continue;
          layers[c] = m.L.geoJSON(f, { style: { fillOpacity: 0.04, weight: 0.6, color: '#888' }, interactive: false }).addTo(m.map);
          layers[c].setStyle = layers[c].setStyle.bind(layers[c]);
        }
        api = m;
        paint();
        ctx.log('map ready', { states: Object.keys(layers).length });
      } catch (e) {
        ctx.log.warn('map failed', String(e));
      }
    },
  };
}
