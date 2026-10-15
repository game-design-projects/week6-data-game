// #82 Changelog — a release note with the software's name blacked out; guess the software, then the year.
const GENERIC = new Set(['core', 'cli', 'framework', 'releases', 'main']);
const BAR = '▇▇▇';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every name to hide for a repo: display name, repo name, owner, plus data.json's `alias` list. "X$" = whole word only. */
export function aliases(repo) {
  const [owner, name] = repo.id.split('/');
  const set = new Set([repo.name, name, owner, repo.name.replace(/\.js$/i, ''), name.replace(/-/g, ' '), ...(repo.alias || [])]);
  const exact = new Set([...set].filter((w) => w.endsWith('$')).map((w) => w.slice(0, -1).toLowerCase()));
  return [...set].filter((w) => w && w.replace(/\$$/, '').length >= 2 && !GENERIC.has(w.toLowerCase()) && (w.endsWith('$') || !exact.has(w.toLowerCase())));
}

/** Regex for one alias: separators (space - _ .) match each other or nothing, so "Home Assistant" hits home-assistant too. */
function aliasRegex(raw) {
  if (raw.startsWith('re:')) return new RegExp(raw.slice(3), 'g'); // raw regex, case-sensitive
  const exact = raw.endsWith('$');
  const w = exact ? raw.slice(0, -1) : raw;
  const body = w.split(/[\s\-_.]+/).filter(Boolean).map(esc).join('[\\s\\-_.]?');
  if (w.length < 3) return new RegExp(`(?<![\\w])${body}(?![\\w])`, 'g'); // short: case-sensitive whole word
  return new RegExp(`(?<![A-Za-z0-9])${body}${exact ? '(?![A-Za-z0-9])' : '[A-Za-z0-9]*'}`, 'gi');
}

export function redact(text, repo) {
  let out = text;
  for (const w of aliases(repo).sort((a, b) => b.length - a.length)) out = out.replace(aliasRegex(w), BAR);
  return out;
}

/** True if any alias of the repo still occurs in the (already redacted) text. */
export function leaks(text, repo) {
  return aliases(repo).some((w) => { const re = aliasRegex(w); return re.test(text); });
}

export function redactTag(tag, repo) {
  return redact(tag, repo).replace(/^[a-z][a-z-_]*?[-_]?(?=\d)/i, (m) => (/^v$/i.test(m) ? m : '')).replace(/\b(19|20)\d\d\b/g, '▇▇▇▇');
}

/** Dated/versioned tech mentioned in the note ("Python 3.12", "Node 18") — the hints that reveal the era. */
export function eraHints(lines) {
  const re = /\b(Python|Node(?:\.js)?|Java|JDK|PHP|Ruby|Rust|Go|Windows(?: Server)?|macOS|Ubuntu|Debian|Android|iOS|Xcode|Chrome|Electron|Angular|React|TypeScript|Kotlin|Swift|CUDA|OpenSSL|Qt|GCC|LLVM|Vue|Webpack|Vite|Kubernetes|Docker|ECMAScript|ES|C\+\+|Linux)\s*v?\d+(?:\.\d+){0,2}\b/g;
  const found = [];
  for (const l of lines) for (const m of l.matchAll(re)) if (!found.includes(m[0])) found.push(m[0]);
  return found.slice(0, 4);
}

/** Years that were blacked out of the note ("CVE-2026-1234", "Dec 2025") with a few characters of context. */
export function yearMentions(raw) {
  const out = [];
  for (const l of raw) for (const m of l.matchAll(/(\S{0,12}?)\b((?:19|20)\d\d)\b(\S{0,6})/g)) { const t = `${m[1]}${m[2]}${m[3]}`.trim(); if (!out.includes(t)) out.push(t); }
  return out.slice(0, 3);
}

/** The one-line clue: the most informative (longest) of the first four lines. */
export function firstLine(lines) {
  return lines.slice(0, 4).reduce((a, b) => (b.length > a.length ? b : a), lines[0]);
}

export default {
  meta: {
    num: 82,
    slug: 'changelog',
    title: 'Changelog',
    tagline: 'One line from an open-source changelog with the name blacked out. Guess the software, then the year it shipped.',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      'The screen shows one line from the release notes of an open-source project. The software\u2019s name, release date and year are blacked out.',
      'Step 1: pick the software from the list, up to 6 guesses. Each miss unlocks a clue: the first few lines, the full note, the language, the version tag, the year the project started, the first letter.',
      'Step 2: guess the year this version was released. Every year off costs a lot.',
      'Tip: the runtime versions it depends on (like Python 3.12), the platforms it supports and the kind of bug fixed all give away the era.',
    ],
    scoring: 'Software 100 points (full marks on guess 1, about 17 fewer for each extra guess) + year 100 points (exact is full, 1 year off is about 61, 2 years about 37, 5 years under 10), 200 in total.',
    sources: [
      { name: 'GitHub Releases API', url: 'https://docs.github.com/en/rest/releases/releases', note: 'Release notes for 53 popular open-source projects (GET /repos/{owner}/{repo}/releases)' },
      { name: 'GitHub Repos API', url: 'https://docs.github.com/en/rest/repos/repos#get-a-repository', note: 'Project language, star count and creation year' },
    ],
    dataNote: 'Notes come from each project\u2019s GitHub Release page, with links, commit hashes and dates removed and only the first few lines kept. Names are blacked out by rule matching plus a hand-written alias list, and the whole pool was scanned for leaks at build time. This is a snapshot: the unauthenticated GitHub API allows only 60 requests an hour and the puzzles need fixed historical releases, so nothing is fetched live in the browser.',
  },

  puzzle({ data, pick }) {
    const p = pick(data.puzzles);
    return { repo: p.repo, tag: p.tag };
  },

  async play(ctx, pz) {
    const { ui } = ctx;
    const repos = ctx.data.repos;
    const byId = new Map(repos.map((r) => [r.id, r]));
    const P = ctx.data.puzzles.find((x) => x.repo === pz.repo && x.tag === pz.tag);
    const R = byId.get(P.repo);
    ctx.log('puzzle', P.repo, P.tag, P.year);

    const list = (lines) => ui.h('ul', { style: { margin: 0, paddingLeft: '1.1em' } }, lines.map((l) => ui.h('li', redact(l, R))));
    const clues = [
      ui.quote(redact(firstLine(P.lines), R)),
      list(P.lines),
      `This project is mostly written in ${R.lang || 'several languages'}.`,
      ui.h('div', 'Version tag of this release: ', ui.code(redactTag(P.tag, R))),
      `The project was created in ${R.since}.`,
      `The name starts with \u201c${R.name[0].toUpperCase()}\u201d and it has about ${Math.round(R.stars / 1000)}k stars on GitHub.`,
    ];

    const options = repos.map((r) => ({ id: r.id, label: r.name, hint: r.lang || '', aliases: [r.id, r.id.split('/')[1]] }));
    const g = await ctx.guess({
      options, answer: R.id, maxGuesses: 6,
      title: 'Whose changelog is this?',
      placeholder: 'Type a software name\u2026',
      clues, cluesTitle: 'Release notes and clues',
      columns: ['Language', 'Created'],
      near: (a, b) => byId.get(a.id).lang === byId.get(b.id).lang,
      feedback: (a, b) => {
        const x = byId.get(a.id), y = byId.get(b.id);
        return [
          { text: x.lang || '—', state: x.lang === y.lang ? 'hit' : undefined },
          { text: `${x.since}${x.since === y.since ? '' : x.since < y.since ? ' ↑' : ' ↓'}`, num: true, state: Math.abs(x.since - y.since) <= 2 ? 'near' : undefined },
        ];
      },
    });
    ctx.log('software stage', g.score);

    ctx.stage.append(ui.callout(`The answer is ${R.name}, created in ${R.since}. Now guess the year this version shipped (take another look at the notes and version tag above).`, g.win ? 'good' : 'warn'));
    const y = await ctx.estimate({
      title: 'What year was this version released?',
      answer: P.year, min: R.since, max: 2026, step: 1, initial: Math.round((R.since + 2026) / 2),
      format: (v) => String(Math.round(v)), scoring: 'abs', scale: 2,
    });
    ctx.log('year stage', y.score, y.guess);

    const res = ctx.combine([g, y]);
    const raw = P.raw || P.lines;
    const hints = eraHints(raw);
    const age = P.year - R.since;
    const ys = yearMentions(raw);
    const why = (ys.length ? `Years blacked out of the note: ${ys.join(', ')}, which hand you the answer. ` : '')
      + (hints.length
        ? `Era clues in this note: ${hints.join(', ')}. Those dependency and platform versions were current only around ${P.year}.`
        : ys.length ? '' : `The note names no dependency versions, so you have to infer from the version tag ${P.tag}: the project started in ${R.since} and was ${age} years old at this release.`);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['Software', `${R.name} (${P.repo})`], ['Version', `${P.tag} · ${P.date}`], ['Project age', `${age} ${age === 1 ? 'year' : 'years'} old at release`], ['Your guess', y.guess != null ? String(Math.round(y.guess)) : '—']]),
      ui.h('ul', { style: { margin: 0, paddingLeft: '1.1em' } }, raw.map((l) => ui.h('li', l))),
      ui.h('div', { class: 'small muted' }, `How to tell: ${why.trim()}`),
      ui.h('a', { href: P.url, target: '_blank', rel: 'noopener' }, 'View the original release'));
    return res;
  },
};
