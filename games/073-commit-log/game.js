// #73 Commit Log — five real commit messages; guess the repository.
const BAR = '▇▇▇';
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Words that identify a repo: name tokens, the joined name ("nextjs"), owner tokens, and whole short names ("go"). */
export function nameTokens(id) {
  const [owner, name] = id.includes('/') ? id.split('/') : ['', id];
  const toks = new Set();
  const nameParts = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  for (const t of nameParts) if (t.length >= 3 || nameParts.length === 1) toks.add(t.toLowerCase());
  if (nameParts.length > 1) toks.add(nameParts.join('').toLowerCase());
  for (const t of owner.split(/[^A-Za-z0-9]+/)) if (t.length >= 3) toks.add(t.toLowerCase());
  return [...toks];
}

/** Black out everything that names the repo (name, owner, joined forms, "Next.js"-style suffixes). */
export function redact(text, id) {
  let out = String(text ?? '');
  for (const t of nameTokens(id)) {
    out = out.replace(new RegExp(`\\b${esc(t)}${t.length >= 4 ? '\\w*' : ''}\\b`, 'gi'), BAR);
  }
  return out.replace(new RegExp(`${BAR}\\.(js|rs|py|io|go|ts)\\b`, 'gi'), BAR);
}

// ---- style fingerprint: which formatting habits give a repo away ----
const FEATURES = [
  { key: 'prefix', test: (m) => /^[\w./+-]+(\([^)]*\))?!?: /.test(m), say: (p, a) => `${p}% of its commits start with a “subsystem: ” prefix (pool average ${a}%)` },
  { key: 'conv', test: (m) => /^(feat|fix|chore|docs|refactor|test|tests|perf|build|ci|style)(\([^)]*\))?!?: /i.test(m), say: (p, a) => `${p}% of its commits use a Conventional Commits prefix like feat/fix/chore (pool average ${a}%)` },
  { key: 'pr', test: (m) => /\(#\d+\)\s*$/.test(m), say: (p, a) => `${p}% of its commits end with a PR number like “(#1234)” (pool average ${a}%)` },
  { key: 'cap', test: (m) => /^[A-Z]/.test(m), say: (p, a) => `${p}% of its commits start with a capital letter (pool average ${a}%)` },
  { key: 'dot', test: (m) => /\.$/.test(m), say: (p, a) => `${p}% of its commits end with a period (pool average ${a}%)` },
  { key: 'long', test: (m) => m.length > 60, say: (p, a) => `${p}% of its commit titles are over 60 characters (pool average ${a}%)` },
];
export const shareOf = (msgs, f) => msgs.filter(f.test).length / Math.max(1, msgs.length);

/** Two most distinctive style habits of `repo` relative to the pool, as English sentences. */
export function styleNotes(repo, repos) {
  const rows = FEATURES.map((f) => {
    const mine = shareOf(repo.msgs, f);
    const avg = repos.reduce((s, r) => s + shareOf(r.msgs, f), 0) / repos.length;
    return { f, mine, avg, d: Math.abs(mine - avg) };
  }).filter((x) => x.d >= 0.2).sort((a, b) => b.d - a.d).slice(0, 2);
  return rows.map((x) => x.f.say(Math.round(x.mine * 100), Math.round(x.avg * 100)));
}

export default {
  meta: {
    num: 73,
    slug: 'commit-log',
    title: 'Commit Log',
    tagline: 'Five real commit messages. Guess which open-source repository they came from.',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      'You start with two real commit messages (repository and author names blacked out). Pick the repository from the list. You get up to 6 guesses.',
      'Each miss unlocks another clue: more commits, the main language, the creation year and the description.',
      'Feedback for each guess: a matching language turns yellow, and the arrows beside year and stars point toward the answer (↑ the answer is newer / has more, ↓ older / fewer).',
      'Read the format: “subsystem: verb” is kernel style; a feat/fix prefix is front-end tooling; a trailing (#1234) is a GitHub PR merge.',
    ],
    scoring: 'A correct first guess scores 100, and each extra guess costs about 17 points (about 17 on the 6th). Six misses score 0.',
    sources: [
      { name: 'GitHub REST API: commits', url: 'https://docs.github.com/en/rest/commits/commits', note: 'The latest 100 commits on each default branch, filtering out merges, version bumps, dependency updates and commits with links or non-ASCII text' },
      { name: 'GitHub REST API: repos', url: 'https://docs.github.com/en/rest/repos/repos', note: 'Main language, creation year, star count, description' },
    ],
    dataNote: 'The pool is a snapshot of 100 well-known open-source repositories (commits are the latest 100 at fetch time, and star counts are as of then). The originally suggested hourly GH Archive event dumps are too big, so the GitHub API supplies the same kind of facts instead; anonymous GitHub API access is limited to 60 requests an hour, so nothing is fetched live in the browser.',
  },

  puzzle({ data, pick, rng }) {
    const repo = pick(data.repos);
    return { id: repo.id, msgs: rng.sample(repo.msgs, 5) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const repos = ctx.data.repos;
    const by = new Map(repos.map((r) => [r.id, r]));
    const ans = by.get(p.id);
    const R = (t) => redact(t, ans.id);
    const msgBox = (xs, f = (x) => x) => ui.h('div', { class: 'ds-stack' }, xs.map((m) => line(ui, f(m))));
    ctx.log('puzzle', p.id);
    const clues = [
      msgBox(p.msgs.slice(0, 2), R),
      msgBox([p.msgs[2]], R),
      `Main language: ${R(ans.lang)}`,
      msgBox([p.msgs[3]], R),
      `Created in ${ans.year}. Description: ${R(ans.desc) || '(none)'}`,
      msgBox([p.msgs[4]], R),
    ];
    const options = repos.map((r) => ({ id: r.id, label: r.id, aliases: [r.name] }));
    const dir = (d) => (d > 0 ? '↑' : '↓');
    const res = await ctx.guess({
      options, answer: ans.id, maxGuesses: 6,
      title: 'Which repository is this?', placeholder: 'Type a repository name…',
      clues, cluesTitle: 'Commits and clues',
      columns: ['Language', 'Created', 'Stars'],
      near: (g, a) => by.get(g.id).lang === by.get(a.id).lang,
      feedback: (g) => {
        const gr = by.get(g.id);
        const stars = ctx.core.fmtCompact(gr.stars);
        if (gr.id === ans.id) return [{ text: gr.lang, state: 'hit' }, { text: String(gr.year), state: 'hit', num: true }, { text: `★${stars}`, state: 'hit', num: true }];
        const dy = ans.year - gr.year;
        const ratio = ans.stars / Math.max(1, gr.stars);
        return [
          { text: gr.lang, state: gr.lang === ans.lang ? 'near' : undefined },
          { text: dy === 0 ? `${gr.year} ✓` : `${gr.year} ${dir(dy)}`, num: true, state: Math.abs(dy) <= 2 ? 'near' : undefined },
          { text: `${stars} ${dir(ans.stars - gr.stars)}`, num: true, state: ratio > 0.5 && ratio < 2 ? 'near' : undefined },
        ];
      },
    });
    const notes = styleNotes(ans, repos);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['Answer', `${ans.id} (${ans.lang}, ${ans.year}, ★${ctx.core.fmtCompact(ans.stars)})`], ['Description', ans.desc || '—']]),
      ui.h('div', { class: 'ink2' }, 'The original commit messages (unredacted):'),
      msgBox(p.msgs),
      ui.callout(notes.length
        ? `This repository's format fingerprint: ${notes.join('; ')}.`
        : `${ans.name}'s commit format is pretty generic, with no standout habits, so you would have to recognize it by the proper nouns in the content (module, function and tool names).`, 'good'));
    return res;
  },
};

function line(ui, t) { return ui.h('div', { class: 'mono small', style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: '6px 10px', border: '1px solid var(--rule)', borderRadius: '8px' } }, t); }
