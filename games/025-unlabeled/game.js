// #25 Unlabeled — a macro time series with the axes removed and recessions shaded.
// Name the indicator (typed, from a list of 15), then date the 15-year window.
export const WIN = 180; // months shown
export const MIN_YEAR = 1948; // earliest window start, so one shared slider range fits every indicator
const STEP = 15; // months between candidate windows (not a multiple of 12, so start months vary)

export const monthKey = (start, off) => { const [y, m] = start.split('-').map(Number); const t = y * 12 + m - 1 + off; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; };

/** Candidate windows: every series, every 15 months, starting no earlier than MIN_YEAR. Pure helper. */
export function windows(data) {
  const out = [];
  for (const s of data.series) {
    for (let off = 0; off + WIN <= s.vals.length; off += STEP) if (monthKey(s.start, off).y >= MIN_YEAR) out.push({ id: s.id, off });
  }
  return out;
}
/** Shared slider range so the range itself does not reveal the indicator. */
export function yearRange(data) {
  let hi = MIN_YEAR;
  for (const w of windows(data)) { const s = data.series.find((x) => x.id === w.id); hi = Math.max(hi, monthKey(s.start, w.off).y); }
  return [MIN_YEAR, hi];
}
/** 0..100 for the year guess: exact = 100, 6 years off ≈ 37. */
export const yearScore = (guess, answer) => Math.round(100 * Math.exp(-Math.abs(guess - answer) / 6));
/** 0..50 for the indicator: 1st guess 50, 2nd 33, 3rd 17, miss 0. */
export const nameScore = (n, won, max = 3) => (won ? Math.round((50 * (max - n + 1)) / max) : 0);
export const recAt = (rec, y, m) => {
  const [ry, rm] = rec.start.split('-').map(Number);
  return rec.vals[(y - ry) * 12 + (m - rm)] === '1';
};
export const fmtV = (v) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : String(Math.round(v * 10) / 10));
const ym = (k) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][k.m - 1]} ${k.y}`;

/** Everything the view and the result card need about one puzzle window. Pure. */
export function windowInfo(data, p) {
  const s = data.series.find((x) => x.id === p.id);
  const vals = s.vals.slice(p.off, p.off + WIN);
  const pts = vals.map((v, i) => { const k = monthKey(s.start, p.off + i); return { i, v, k, rec: recAt(data.rec, k.y, k.m) }; });
  const spans = [];
  for (const q of pts) {
    if (!q.rec) continue;
    const last = spans.at(-1);
    if (last && last.x2 === q.i) { last.x2 = q.i + 1; last.end = q.k; } else spans.push({ x1: q.i, x2: q.i + 1, start: q.k, end: q.k });
  }
  let hi = pts[0]; let lo = pts[0];
  for (const q of pts) { if (q.v > hi.v) hi = q; if (q.v < lo.v) lo = q; }
  // net move across each recession that starts inside the window
  const moves = spans.filter((sp) => sp.x1 > 0).map((sp) => pts[sp.x2 - 1].v - pts[sp.x1 - 1].v);
  const up = moves.filter((d) => d > 0).length;
  return { s, pts, spans, hi, lo, up, down: moves.length - up, nMoves: moves.length };
}

export default {
  meta: {
    num: 25,
    slug: 'unlabeled',
    title: 'Unlabeled',
    tagline: 'A US macro curve with the axes removed and only the recessions shaded. Name the indicator, then date the decade.',
    category: 'money',
    data: 'snapshot',
    howTo: [
      'The chart is a 15-year monthly curve of a US macroeconomic indicator with no scale or units. Gray bars mark NBER-dated recessions.',
      'Step 1: type to pick the indicator from 15 candidates (names and FRED codes both work). 3 guesses; each miss unlocks a clue: type, value range, data start.',
      'Step 2: guess the year the curve starts. Anchor on big events: 1970s inflation, the 1981 rate peak, the 2008 crisis, the 2020 pandemic.',
      'Scoring: 50 points for the indicator (50 on guess 1, 33 on guess 2, 17 on guess 3) and 50 for the year (about a third left at 6 years off).',
    ],
    scoring: 'Indicator 50 × (4 − guesses) / 3, plus year 50 × e^(−years off / 6).',
    sources: [
      { name: 'FRED (St. Louis Fed)', url: 'https://fred.stlouisfed.org/', note: 'UNRATE, CPIAUCSL, FEDFUNDS, GS10, INDPRO, PAYEMS, HOUST, UMCSENT, M2SL, DEXJPUS, GDPC1, TOTALSA, MORTGAGE30US, CIVPART, PSAVERT' },
      { name: 'NBER recession dates (FRED: USREC)', url: 'https://fred.stlouisfed.org/series/USREC' },
    ],
    dataNote: 'A snapshot: the FRED CSV endpoint has no CORS headers, so browsers cannot fetch it directly and the build/ scripts download it offline. Daily and weekly series are averaged to months, quarterly GDP is filled across months (hence the staircase), and price and output series are converted to year-over-year change. The October 2025 federal shutdown left gaps, so UNRATE, CPI and others end before the gap; consumer sentiment starts in 1978. Puzzle windows start no earlier than 1948.',
  },

  puzzle({ data, pick }) {
    const w = pick(windows(data));
    const s = data.series.find((x) => x.id === w.id);
    const a = monthKey(s.start, w.off);
    return { id: s.id, off: w.off, year: a.y, month: a.m };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const info = windowInfo(data, p);
    const { s, pts, spans } = info;
    ctx.log('puzzle', p.id, p.year, 'recessions', spans.length);

    const chart = await ui.plot((Plot, c) => ({
      height: 260,
      marginLeft: 8, marginRight: 8, marginBottom: 8, marginTop: 8,
      x: { axis: null, domain: [0, WIN] },
      y: { axis: null, grid: false },
      marks: [
        Plot.rectX(spans, { x1: 'x1', x2: 'x2', fill: c.rule, fillOpacity: 0.55 }),
        Plot.lineY(pts, { x: 'i', y: 'v', stroke: c.accent, strokeWidth: 2 }),
      ],
    }), { axis: false });
    ctx.stage.append(ui.panel({ kicker: 'Clue', title: 'The unlabeled curve' }, chart,
      ui.h('div', { class: 'small muted' }, `15 years · one point per month · gray bars = recessions (${spans.length})`)));

    const options = data.series.map((x) => ({ id: x.id, label: x.name, aliases: [x.id, x.id.toLowerCase()] }));
    ctx.stage.append(ui.h('div', { class: 'small muted', style: { margin: '-4px 4px 4px' } }, `${options.length} candidate indicators: ${data.series.map((x) => x.name).join(', ')}`));
    const unit = s.unit === '%' ? '%' : ` ${s.unit}`;
    const r1 = await ctx.guess({
      title: 'Which indicator is this?',
      options, answer: p.id, maxGuesses: 3,
      placeholder: 'Indicator name or code\u2026',
      cluesTitle: 'Indicator clues',
      clues: [
        s.yoy ? 'Type: year-over-year change (percent vs 12 months earlier).' : 'Type: a level, not a rate of change.',
        `Value range: low ${fmtV(info.lo.v)}${unit}, high ${fmtV(info.hi.v)}${unit}.`,
        `This indicator\u2019s data starts in ${s.start.slice(0, 4)}.`,
      ],
      scoring: (n, won) => nameScore(n, won),
      max: 50,
    });

    const [lo, hi] = yearRange(data);
    const r2 = await ctx.estimate({
      title: 'What year does the curve start?',
      prompt: `The indicator is \u201c${s.name}\u201d. It is a 15-year window: estimate the start year.`,
      answer: p.year, min: lo, max: hi, step: 1, initial: Math.round((lo + hi) / 2),
      format: (v) => String(Math.round(v)),
      scoring: yearScore,
    });

    const res = ctx.combine([
      { ...r1, score: r1.score, max: 50 },
      { ...r2, score: r2.score / 2, max: 50 },
    ]);
    const recs = spans.map((sp) => (sp.start.y === sp.end.y ? `${sp.start.y}` : `${sp.start.y}–${sp.end.y}`)).join(', ') || 'none';
    const behave = info.nMoves ? `; across ${info.nMoves} ${info.nMoves === 1 ? 'recession' : 'recessions'} the curve rose ${info.up} and fell ${info.down}` : '';
    res.detail = ui.kv([
      ['Indicator', `${s.name} (FRED: ${s.id})${s.yoy ? ', year over year' : ''}`],
      ['Period', `${ym(pts[0].k)} to ${ym(pts.at(-1).k)} (you guessed ${Math.round(r2.guess)}, the answer is ${p.year})`],
      ['What this stretch shows', `High ${fmtV(info.hi.v)}${unit} (${ym(info.hi.k)}), low ${fmtV(info.lo.v)}${unit} (${ym(info.lo.k)})${behave}`],
      ['Recessions in window', `${spans.length} (${recs})`],
      ['How to tell', s.tip],
    ]);
    return res;
  },
};
