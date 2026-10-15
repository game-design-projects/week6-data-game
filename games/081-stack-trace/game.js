// #81 Stack Trace — real error stacks from GitHub issues; name the language and the library/framework.
export function buildRounds(data, ts, rng) {
  const out = [];
  for (const t of ts) {
    const langs = Object.keys(data.langNames);
    const lopts = rng.shuffle([t.lang, ...rng.sample(langs.filter((l) => l !== t.lang), 3)]);
    const pool = (data.libsByLang[t.lang] || []).filter((l) => !t.libs.includes(l));
    const lib = t.libs[0];
    const bopts = rng.shuffle([lib, ...rng.sample(pool, Math.min(3, pool.length))]);
    out.push({ t, lopts, bopts, lib });
  }
  return out;
}

export default {
  meta: {
    num: 81,
    slug: 'stack-trace',
    title: 'Stack Trace',
    tagline: 'Real error stacks pasted into GitHub issues: guess the language, and which framework or library it tripped over.',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      'Each day brings 3 error stacks lifted from real GitHub issues (long stacks have their middle folded away, and scroll sideways).',
      'Each one asks two questions: which language is this, and which framework or library appears in the stack? Only one of the library options really shows up in the trace.',
      'The clues are all in how the frames are written: path separators, file extensions, package prefixes and method naming style.',
      'Each correct answer is 1 point, 6 in all. Pure guessing averages only about 1.5.',
    ],
    scoring: '1 point per correct answer, 6 at most.',
    sources: [{ name: 'GitHub Search API (issues)', url: 'https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests' }],
    dataNote: 'Stacks come from code blocks in public GitHub issues (a snapshot taken 2026-10-14, about 120 stacks across 9 languages). Language and library are decided by rules from features of the stack itself (file extensions, package names, site-packages / node_modules paths and so on), not by the issue author\'s labels, and stacks longer than 18 lines have their middle frames folded. It is not live: the GitHub search API allows cross-origin calls, but unauthenticated it allows only 10 requests a minute and its results shift as the index updates, so it cannot guarantee that every player gets the same puzzle. Two issues written in Chinese have their title or log line translated.',
  },

  puzzle({ data, rng, pick }) {
    const first = pick(data.traces);
    const rest = data.traces.filter((t) => t.lang !== first.lang);
    const second = rng.pick(rest);
    const third = rng.pick(rest.filter((t) => t.lang !== second.lang));
    return { ids: [first.id, second.id, third.id] };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const ts = p.ids.map((id) => data.traces.find((t) => t.id === id));
    const rs = buildRounds(data, ts, ctx.rng);
    ctx.log('stack-trace: rounds', rs.map((r) => `${r.t.lang}/${r.lib}`));
    const rounds = [];
    rs.forEach((r, i) => {
      const body = ui.code(r.t.trace);
      body.style.maxHeight = '22em'; body.style.overflowY = 'auto';
      const again = ui.h('details', { class: 'small' }, ui.h('summary', { style: { cursor: 'pointer', padding: '6px 0' } }, `Look at stack ${i + 1} again`), ui.code(r.t.trace));
      again.lastChild.style.maxHeight = '16em'; again.lastChild.style.overflowY = 'auto';
      rounds.push({
        prompt: `Stack ${i + 1}: which language is this?`,
        body,
        options: r.lopts.map((l) => ({ label: data.langNames[l] })),
        correct: r.lopts.indexOf(r.t.lang),
        explain: `${data.langNames[r.t.lang]}. Clue: ${r.t.langHint}`,
      });
      rounds.push({
        prompt: `Stack ${i + 1}: which framework or library appears in this stack?`,
        body: again,
        options: r.bopts.map((l) => ({ label: l })),
        correct: r.bopts.indexOf(r.lib),
        explain: `${r.lib}. Clue: ${r.t.libHint}` + (r.t.libs.length > 1 ? ` (also in this stack: ${r.t.libs.slice(1).join(', ')})` : ''),
      });
    });
    const res = await ctx.rounds({ rounds, title: 'Read the stack, name its source', minWidth: 150 });
    res.detail = ui.h('div', { class: 'ds-stack' },
      ...rs.map((r, i) => ui.h('div', { class: 'small' },
        ui.h('div', ui.h('b', `Stack ${i + 1} · ${data.langNames[r.t.lang]} · ${r.lib}`), ' — ',
          ui.h('a', { href: `https://github.com/${r.t.repo}/issues/${r.t.n}`, target: '_blank', rel: 'noopener' }, `${r.t.repo}#${r.t.n}`)),
        ui.h('div', { class: 'muted' }, r.t.title),
        ui.h('div', ui.h('span', { class: 'muted' }, 'Language clue: '), ui.h('code', r.t.langHint)),
        ui.h('div', ui.h('span', { class: 'muted' }, 'Library clue: '), ui.h('code', r.t.libHint)))),
      ui.callout('Rules of thumb: Python has File "…", line N; Java / Kotlin have at package.Class(File.java:N / .kt:N); JS has node_modules paths; Go has goroutine; PHP lines start with #0; Ruby has in `method`; C# has .cs:line N; Rust has panicked at …rs.', 'good'));
    return res;
  },
};
