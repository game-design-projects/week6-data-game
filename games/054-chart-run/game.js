// #54 Chart Run — a song's weekly Billboard Hot 100 trajectory: guess the year, then the song.
export function yearOf(start) { return +start.slice(0, 4); }

/** Score for the year guess (0–100): exact 100, 5 years off ≈ 37, 15 years off ≈ 5. */
export function yearScore(guess, answer) { return Math.round(100 * Math.exp(-Math.abs(guess - answer) / 5)); }

/** Song guess: 1st try 100, then −1/6 per extra try (matches the engine default for 6 tries). */
export function songScore(n, won, max = 6) { return won ? Math.round((100 * (max - n + 1)) / max) : 0; }

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const era = (y) => (y < 1991 ? 0 : y < 2013 ? 1 : 2);
const ERA_TEXT = [
  'Before 1991 the chart relied on radio play and record-store reports, so songs rose and fell fast and stayed briefly.',
  'From 1991 the chart used actual sales and radio airplay data (SoundScan / BDS), and after 1998 a song no longer needed a physical single to chart, so No. 1 songs lingered longer.',
  'From 2013 streaming and video plays count toward the chart, and hit songs stay on it noticeably longer.',
];
const ERA_NAME = ['pre-1991', '1991–2012', '2013-onward'];

/** Describe the run in numbers. run = weekly ranks (null = week off the chart). */
export function runFacts(run) {
  const ranks = run.filter((x) => x != null);
  const peak = Math.min(...ranks);
  const peakIdx = run.indexOf(peak);
  const first = run[run.findIndex((x) => x != null)];
  const last = ranks.at(-1);
  return {
    first, last, peak, peakIdx, weeks: ranks.length, span: run.length,
    atPeak: ranks.filter((x) => x === peak).length,
    top10: ranks.filter((x) => x <= 10).length,
    gaps: run.length - ranks.length,
    tail: run.length - 1 - peakIdx,
  };
}

/** Learnability text: which shape in this particular run gives the era away. */
export function patternText(pz, ans, data) {
  const f = runFacts(pz.run);
  const y = yearOf(pz.start);
  const e = era(y);
  const peers = data.puzzles.filter((q) => era(yearOf(q.start)) === e).map((q) => q.run.filter((x) => x != null).length);
  const med = Math.round(median(peers));
  const parts = [];
  parts.push(f.first <= 20 ? `It entered the chart in its first week at No. ${f.first}` : `It started its first week at No. ${f.first}`);
  parts.push(f.peakIdx <= 3 ? `took just ${f.peakIdx} ${f.peakIdx === 1 ? 'week' : 'weeks'} to reach its peak of No. ${f.peak} (a blast-off)` : f.peakIdx >= 10 ? `took ${f.peakIdx} weeks to climb to a peak of No. ${f.peak} (a slow burn)` : `climbed to a peak of No. ${f.peak} in ${f.peakIdx} weeks`);
  parts.push(f.atPeak > 1 ? `stayed at the peak for ${f.atPeak} weeks` : 'held the peak for only 1 week');
  parts.push(f.tail <= 8 ? `and fell off the chart within ${f.tail} ${f.tail === 1 ? 'week' : 'weeks'}` : `and lingered another ${f.tail} weeks before leaving the chart (last week at No. ${f.last})`);
  if (f.gaps > 0) parts.push(`dropped off the chart for ${f.gaps} ${f.gaps === 1 ? 'week' : 'weeks'} in the middle and came back`);
  const cmp = f.weeks > med ? 'above' : f.weeks < med ? 'below' : 'equal to';
  return `${parts.join(', ')}. Total ${f.weeks} weeks on the chart, ${cmp} the ${med}-week median for ${ERA_NAME[e]} songs in the pool. ${ERA_TEXT[e]}`;
}

export function buildClues(ans, year) {
  const words = ans.p.split(/\s+/);
  return [
    `Year charted: ${year}.`,
    `Peak position No. ${ans.k}, ${ans.w} weeks on the chart.`,
    `The artist name has ${words.length} ${words.length === 1 ? 'word' : 'words'}, with initials: ${words.map((w) => w[0]).join(' · ')}.`,
    `The title has ${ans.t.length} characters and starts with “${ans.t[0]}”.`,
    `Artist: ${ans.p.replace(/[A-Za-z]/g, (ch, i) => (i % 2 ? '▇' : ch))}`,
  ];
}

export default {
  meta: {
    num: 54,
    slug: 'chart-run',
    title: 'Chart Run',
    tagline: 'A song\'s week-by-week rank curve on the Billboard Hot 100. Guess the year first, then the song.',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      'The chart shows a song\'s rank each week after it entered the Billboard Hot 100: the higher the line, the better the rank, and the dashed line is the top-10 cutoff. From the speed of its climb and how long it stayed, estimate which year it charted (chart rules differ by era, and how long songs linger varies a lot).',
      'Once the year is revealed, pick the song from the list. You get up to 6 guesses, and each miss unlocks another clue.',
      'Each guess shows that song\'s chart year, peak rank and weeks on the chart. An arrow means the answer is later, higher-ranked or longer (↑) or earlier, lower-ranked or shorter (↓) on that item; yellow means close.',
    ],
    scoring: 'The year is worth 100, with about 37 for being 5 years off. The song is 100 for a first-guess win, about 17 fewer for each extra guess, and 0 if missed. The two parts add up to 200.',
    sources: [
      { name: 'Billboard Hot 100 historical charts (utdata/rwd-billboard-data mirror)', url: 'https://github.com/utdata/rwd-billboard-data' },
      { name: 'Billboard Hot 100', url: 'https://www.billboard.com/charts/hot-100/' },
    ],
    dataNote: 'The data is a snapshot of the weekly charts from 1958 to 2026, from the utdata GitHub mirror (Billboard has no free public API). The puzzle pool is songs that reached the top 3, spent 20 or more weeks on the chart and have finished their run, at most 3 per year; the guess list includes many more top-10 songs.',
  },

  puzzle({ data, pick }) {
    return { i: data.puzzles.indexOf(pick(data.puzzles)) };
  },

  async play(ctx, p) {
    const { ui, data } = ctx;
    const pz = data.puzzles[p.i];
    const ans = data.options[pz.o];
    const year = yearOf(pz.start);
    const [y0, y1] = data.span;
    ctx.log('chart-run', ans.t, ans.p, year);

    const pts = pz.run.map((r, i) => ({ w: i + 1, r }));
    const chart = await ui.plot((Plot, c) => ({
      height: 240,
      x: { label: 'Week on the chart' },
      y: { label: 'Rank', reverse: true, domain: [1, 100], type: 'sqrt', ticks: [1, 5, 10, 20, 40, 70, 100] },
      marks: [
        Plot.ruleY([10], { stroke: c.muted, strokeDasharray: '4 3' }),
        Plot.text([{ w: 1, r: 10 }], { x: 'w', y: 'r', text: () => 'Top 10', dy: -7, textAnchor: 'start', fill: c.muted, fontSize: 10 }),
        Plot.areaY(pts, { x: 'w', y1: 100, y2: 'r', fill: c.accent, fillOpacity: 0.15 }),
        Plot.lineY(pts, { x: 'w', y: 'r', stroke: c.accent, strokeWidth: 2 }),
        Plot.dot(pts, { x: 'w', y: 'r', fill: c.accent, r: 2.5 }),
      ],
    }));
    ctx.stage.append(ui.panel({ kicker: 'Clue', title: 'This song\'s weekly rank' }, chart));

    const r1 = await ctx.estimate({
      title: 'Which year did it chart?', answer: year, min: y0, max: y1, step: 1, initial: Math.round((y0 + y1) / 2),
      format: (v) => `${Math.round(v)}`, scoring: (g, a) => yearScore(Math.round(g), a) / 100,
    });

    const options = data.options.map((o, i) => ({ id: String(i), label: o.t, hint: o.p, aliases: [o.p] }));
    const res = await ctx.guess({
      title: 'Which song is it?', options, answer: String(pz.o), maxGuesses: 6, clues: buildClues(ans, year), cluesTitle: 'Clues',
      columns: ['Year', 'Peak', 'Weeks'],
      scoring: (n, won) => songScore(n, won),
      near: (g) => Math.abs(data.options[+g.id].y - year) <= 2,
      feedback: (g) => {
        const o = data.options[+g.id]; const dy = year - o.y;
        const cmp = (a, b) => (a === b ? 'hit' : Math.abs(a - b) <= 3 ? 'near' : undefined);
        return [
          { text: dy === 0 ? `${o.y} same year` : `${o.y} ${dy > 0 ? '↑' : '↓'}`, state: dy === 0 ? 'hit' : Math.abs(dy) <= 2 ? 'near' : undefined, num: true },
          { text: `#${o.k} ${o.k > ans.k ? '↑' : o.k < ans.k ? '↓' : ''}`, state: cmp(o.k, ans.k), num: true },
          { text: `${o.w} ${ans.w > o.w ? '↑' : ans.w < o.w ? '↓' : ''}`, state: cmp(o.w, ans.w), num: true },
        ];
      },
    });

    const out = ctx.combine([r1, res]);
    const f = runFacts(pz.run);
    out.detail = ui.kv([
      ['Answer', `${ans.t} — ${ans.p}`],
      ['On the chart', `Entered ${pz.start}, peaked at No. ${f.peak}, ${f.weeks} weeks on the chart, reaching the peak in week ${f.peakIdx + 1}`],
      ['The pattern', patternText(pz, ans, data)],
    ]);
    return out;
  },
};
