// #58 World Record — a speedrun world-record progression curve; guess the game.

/** Seconds → "1:23:45" / "12:34.5" / "56.78 s". */
export function fmtT(s) {
  if (s >= 3600) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  if (s >= 60) {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${(sec < 10 ? '0' : '') + sec.toFixed(sec % 1 ? 1 : 0)}`;
  }
  return `${s < 10 ? s.toFixed(2) : s.toFixed(1)} s`;
}

const NICE = [1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 900, 1800, 3600, 5400, 7200, 10800, 14400, 21600, 36000, 54000, 72000, 108000, 172800];

/** Round time ticks (1 min, 10 min, 1 h…) inside [lo, hi] for the log axis. */
export function timeTicks(lo, hi) {
  const t = NICE.filter((v) => v >= lo && v <= hi);
  if (t.length < 3) { // narrow range: log-spaced ticks rounded to a sensible unit
    const unit = hi >= 3600 ? 60 : hi >= 300 ? 10 : 1;
    const out = [0, 1, 2, 3].map((i) => Math.round((lo * (hi / lo) ** ((i + 0.5) / 4)) / unit) * unit);
    return [...new Set(out)];
  }
  if (t.length <= 7) return t;
  const step = Math.ceil(t.length / 6);
  return t.filter((_, i) => i % step === 0);
}

/** Percentage the record fell from first to latest, 0..100. */
export const dropPct = (pts) => Math.round((1 - pts[pts.length - 1][1] / pts[0][1]) * 100);

/** Year-gap feedback cell for a guessed game vs the answer. */
export function yearCell(g, a) {
  const d = a.year - g.year;
  if (d === 0) return { text: `${g.year}`, state: 'hit', num: true };
  return { text: `${g.year} ${d > 0 ? '↑' : '↓'}`, state: Math.abs(d) <= 3 ? 'near' : undefined, num: true };
}

/** Magnitude feedback: current record length on a log scale. */
export function lengthCell(g, a) {
  const r = Math.log10(g.wr / a.wr);
  const text = fmtT(g.wr);
  if (Math.abs(r) < 0.05) return { text, state: 'hit', num: true };
  return { text: `${text} ${r > 0 ? '↓' : '↑'}`, state: Math.abs(r) < 0.3 ? 'near' : undefined, num: true };
}

/** Whole days between two ISO dates (b - a). */
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** Largest single relative drop between consecutive records. */
export function biggestDrop(pts) {
  let big = null;
  for (let i = 1; i < pts.length; i++) {
    const frac = 1 - pts[i][1] / pts[i - 1][1];
    if (!big || frac > big.frac) big = { frac, from: pts[i - 1], to: pts[i] };
  }
  return big;
}

/** Puzzle-specific "what gave it away" sentences, from the curve itself. */
export function readingNotes(g, today) {
  const pts = g.pts;
  const notes = [];
  const lag = +pts[0][0].slice(0, 4) - g.year;
  if (lag >= 8) notes.push(`Released in ${g.year}, but the first record only appears in ${pts[0][0].slice(0, 4)}: an old game the community dug up later, so the whole curve starts late.`);
  else if (lag <= 1) notes.push(`Released in ${g.year} with records that same year: the curve starts at launch, and the steep early steps show players quickly working out routes.`);
  else notes.push(`Released in ${g.year}; records start in ${pts[0][0].slice(0, 4)}, ${lag} years later.`);
  const big = biggestDrop(pts);
  if (big && big.frac >= 0.12) notes.push(`The biggest cliff is at ${big.to[0]}: ${fmtT(big.from[1])} \u2192 ${fmtT(big.to[1])} (\u2212${Math.round(big.frac * 100)}%), usually a new skip or glitch, or a new route.`);
  else notes.push(`No obvious cliff; even the biggest drop was only ${Math.round((big?.frac ?? 0) * 100)}% faster: a curve ground down bit by bit, close to the limit of the technique.`);
  const stale = daysBetween(pts.at(-1)[0], today) / 365.25;
  if (stale >= 3) notes.push(`The latest record was set on ${pts.at(-1)[0]}, ${stale.toFixed(1)} years ago: the scene has settled into the endgame.`);
  else if (stale < 0.5) notes.push(`The latest record was set on ${pts.at(-1)[0]}, within the last six months: the game is still active.`);
  const span = daysBetween(pts[0][0], pts.at(-1)[0]) / 365.25;
  notes.push(`${pts.length} records over ${span.toFixed(1)} years, about ${(pts.length / Math.max(span, 0.5)).toFixed(1)} per year.`);
  return notes;
}

export default {
  meta: {
    num: 58,
    slug: 'world-record',
    title: 'World Record',
    tagline: 'The progression of one game\u2019s speedrun world record, reduced to times and years. Guess the game.',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      'Each step on the staircase is a new world record: date along the bottom, completion time up the side (log scale), with a black dot for the latest.',
      'Pick a game from the list to guess, up to 6 times. Each miss unlocks a clue: the speedrun category, release year and total drop, platforms, first and latest record, and the first letter of the title.',
      'Read the curve. Old games usually grind down over a decade or more; a sudden cliff means someone found a new glitch or skip; the run length rules out many games.',
      'Each guess shows that game\u2019s release year and current record against the answer\u2019s (\u2191 the answer is higher, \u2193 the answer is lower).',
    ],
    scoring: 'Guess 1 earns 100 points, guess 2 about 83, and each further guess costs about 17 more; 0 if you never find it in 6.',
    sources: [
      { name: 'speedrun.com REST API v1', url: 'https://github.com/speedruncomorg/api/blob/master/version1/README.md', note: 'verified runs; each category\u2019s record progression is derived from submission dates' },
    ],
    dataNote: 'A snapshot (fetched 2026-10-15). The speedrun.com API allows CORS, but this puzzle does not need \u201cyesterday\u201d: the historical curve is the clue, so nothing is loaded live. The record curve is derived from verified historical runs by submission date: the fastest run submitted before a date was the world record then. Categories with subcategories use the default one. For each category we take at most the earliest and latest 10,000 runs (the API offset limit), which covers nearly all categories. Category names in the clues have words that contain the game\u2019s name removed, and platform lists drop later ports and remakes.',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.games).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const games = ctx.data.games;
    const byId = new Map(games.map((g) => [g.id, g]));
    const ans = byId.get(p.id);
    const pts = ans.pts;
    ctx.log('answer', ans.name, ans.cat, pts.length, 'records');

    const rows = pts.map(([d, s]) => ({ date: new Date(`${d}T00:00:00Z`), s }));
    const last = rows[rows.length - 1];
    const lo = Math.min(...pts.map((q) => q[1])) * 0.85, hi = Math.max(...pts.map((q) => q[1])) * 1.15;
    const chart = await ui.plot((Plot, c) => ({
      height: 300,
      marginLeft: 58,
      marginTop: 28,
      x: { type: 'utc', label: null },
      y: { type: 'log', label: 'Completion time', grid: true, tickFormat: (v) => fmtT(v), domain: [lo, hi], ticks: timeTicks(lo, hi) },
      marks: [
        Plot.line(rows, { x: 'date', y: 's', stroke: c.accent, strokeWidth: 2, curve: 'step-after' }),
        Plot.dot(rows, { x: 'date', y: 's', fill: c.accent, r: 2.5 }),
        Plot.dot([last], { x: 'date', y: 's', fill: c.ink, r: 5 }),
        Plot.tip(rows, Plot.pointerX({ x: 'date', y: 's', title: (d) => `${d.date.toISOString().slice(0, 10)}\n${fmtT(d.s)}` })),
      ],
    }));

    const clues = [
      ui.h('div', chart, ui.h('div', { class: 'small muted' }, `${pts.length} world records; the black dot is the latest.`)),
      `The speedrun category is \u201c${ans.cat}\u201d.`,
      `The game was released in ${ans.year}. From the first record to the latest, the time has dropped by ${dropPct(pts)}%.`,
      ans.platforms.length ? `Main platforms: ${ans.platforms.join(' / ')}.` : 'This game lists no platform on speedrun.com.',
      `The first record was ${fmtT(pts[0][1])} (${pts[0][0].slice(0, 4)}); now it is ${fmtT(ans.wr)}.`,
      `The title starts with \u201c${ans.name[0]}\u201d and is ${ans.name.length} characters long.`,
    ];

    const res = await ctx.guess({
      options: games.map((g) => ({ id: g.id, label: g.name, hint: String(g.year) })),
      answer: ans.id,
      maxGuesses: 6,
      title: 'Which game\u2019s world record is this?',
      placeholder: 'Type a game title, e.g. Super Mario 64\u2026',
      clues,
      cluesTitle: 'Record curve and clues',
      columns: ['Released', 'Record'],
      near: (g, a) => Math.abs(byId.get(g.id).year - byId.get(a.id).year) <= 3,
      feedback: (g, a) => [yearCell(byId.get(g.id), byId.get(a.id)), lengthCell(byId.get(g.id), byId.get(a.id))],
    });

    res.detail = ui.kv([
      ['Answer', `${ans.name} \u00b7 ${ans.cat}`],
      ['Released / platforms', `${ans.year}${ans.platforms.length ? ' \u00b7 ' + ans.platforms.join(' / ') : ''}`],
      ['Record progression', `${fmtT(pts[0][1])} \u2192 ${fmtT(ans.wr)} (${pts[0][0]} \u2192 ${pts.at(-1)[0]})`],
      ['What the curve says', ui.h('div', ...readingNotes(ans, ctx.date).map((t) => ui.h('div', { style: { marginBottom: '4px' } }, t)))],
    ]);
    return res;
  },
};
