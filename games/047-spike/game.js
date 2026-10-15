// #47 Spike — the hottest-rising English Wikipedia article of a day, shown as a nameless pageview curve.
// Each wrong guess reveals another article that spiked the same day.
// Live: load() rebuilds the puzzle for (puzzle date − 2 days) from the Wikimedia Pageviews API; data.json is the fallback.

const API = 'https://wikimedia.org/api/rest_v1/metrics/pageviews';
const MIN_VIEWS = 40000; // a day's spike must reach this many views to count
const MIN_RATIO = 3; // ... and be at least this many times the previous-3-day level
const CO_RATIO = 2.2;
const NSFW = /porn|sex|xxx|nude|erotic|fetish|hentai|onlyfans/i;

/** Pages that are never puzzles (and never options): special pages, lists, years, adult content. */
export function isBad(a) {
  return /:/.test(a) || a === 'Main_Page' || a === '-' || /^\./.test(a) || /^Deaths_in_|^List_of_/.test(a) || /^\d{4}$/.test(a) || NSFW.test(a);
}

/** Top-list JSON from the API → Map(article → views), in rank order. */
export function topMap(json) {
  return new Map((json?.items?.[0]?.articles ?? []).map((x) => [x.article, x.views]));
}

/** Every article of day `cur` with ≥ 40k views, ranked by views ÷ mean of the 3 previous days. prev = [Map, Map, Map]. */
export function rankSpikes(prev, cur) {
  const floors = prev.map((m) => Math.min(...m.values()));
  const spikes = [];
  let rank = 0;
  for (const [a, v] of cur) {
    rank++;
    if (isBad(a) || v < MIN_VIEWS) continue;
    const base = prev.reduce((s, m, i) => s + (m.get(a) ?? floors[i]), 0) / 3;
    spikes.push({ a, v, rank, ratio: v / base, exact: prev.every((m) => m.has(a)) });
  }
  return spikes.sort((x, y) => y.ratio - x.ratio);
}

const stamp = (iso) => `${iso.replaceAll('-', '')}00`;
const shift = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const topUrl = (day) => `${API}/top/en.wikipedia/all-access/${day.replaceAll('-', '/')}`;
export const seriesUrl = (article, day) => `${API}/per-article/en.wikipedia/all-access/user/${encodeURIComponent(article)}/daily/${stamp(shift(day, -20))}/${stamp(day)}`;

/** Per-article JSON → 21 daily user views ending on `day`, or null if incomplete / not a real (human) spike. */
export function checkSeries(json, day) {
  const items = json?.items;
  if (!Array.isArray(items) || items.length !== 21) return null;
  for (let i = 0; i < 21; i++) {
    if (items[i].timestamp !== stamp(shift(day, i - 20)) || !Number.isFinite(items[i].views)) return null;
  }
  const series = items.map((x) => x.views);
  const base = series.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
  if (series[20] < MIN_VIEWS / 2 || series[20] < MIN_RATIO * Math.max(base, 1)) return null; // bot traffic in the all-access list
  return series;
}

const norm = (t) => t.toLowerCase().replace(/\s*\(.*\)$/, '');

/** One puzzle object from a ranked spike list, the chosen index and its series. */
export function makePuzzle(day, spikes, idx, series) {
  const w = spikes[idx];
  if (!w || w.ratio < MIN_RATIO) return null;
  const title = w.a.replaceAll('_', ' ');
  const wn = norm(title);
  const co = spikes
    .filter((s, i) => i !== idx && s.ratio >= CO_RATIO && !norm(s.a.replaceAll('_', ' ')).includes(wn) && !wn.includes(norm(s.a.replaceAll('_', ' '))))
    .slice(0, 5)
    .map((c) => ({ t: c.a.replaceAll('_', ' '), v: c.v, r: +c.ratio.toFixed(1) }));
  if (co.length < 3) return null;
  return { date: day, title, id: w.a, views: w.v, ratio: +w.ratio.toFixed(1), exact: w.exact, rank: w.rank, series, co };
}

/** Pure: 4 top-list JSONs (day−3 … day) + a lookup of per-article JSON → puzzle. First candidate with a valid series wins. */
export function toPuzzle(day, topJsons, seriesFor, tries = 4) {
  const maps = topJsons.map(topMap);
  const spikes = rankSpikes(maps.slice(0, 3), maps[3]);
  for (let i = 0; i < Math.min(tries, spikes.length); i++) {
    const series = checkSeries(seriesFor(spikes[i].a), day);
    if (!series) continue;
    const p = makePuzzle(day, spikes, i, series);
    if (p) return p;
  }
  return null;
}

/** Shape of the surge: how many days of calm before the spike, and the jump factor. */
export function describeSpike(series) {
  const last = series.at(-1);
  const prior = series.slice(0, -1);
  const base = prior.reduce((a, b) => a + b, 0) / prior.length;
  const calm = prior.filter((v) => v < base * 2).length;
  return { last, base: Math.round(base), factor: base > 0 ? last / base : 0, calm, prior: series.at(-2), peak: Math.max(...prior) };
}

/** Score for solving on guess n of 6 (0 if lost). */
export const scoreFor = (n, won) => (won ? Math.round((100 * (7 - n)) / 6) : 0);

export default {
  meta: {
    num: 47,
    slug: 'spike',
    title: 'Spike',
    tagline: 'The Wikipedia article that surged hardest two days ago, shown only as a nameless pageview curve. Each wrong guess reveals another article that spiked the same day.',
    category: 'words',
    data: 'live',
    howTo: [
      'The chart shows 21 days of daily pageviews (log scale) for one English Wikipedia article. The last day is the spike, and its date is given. Today\u2019s puzzle uses the day two days ago, when the ranking is final, so players everywhere see the same curve.',
      'Pick an article from the list to guess, up to 6 times (the list is recent popular articles, not just answer candidates). Each wrong guess reveals another article that also spiked that day; if your guess was also surging, it turns yellow.',
      'The clues connect: articles that surge on the same day are often people, teams or works from one event. Put them together and work out what happened.',
      'The curve\u2019s shape tells you something too: a steep climb after calm usually means breaking news, while a curve that was already high points to a sustained trend.',
    ],
    scoring: 'Solve on guess 1 for 100 points, guess 2 for 83, guess 3 for 67, guess 4 for 50, guess 5 for 33, guess 6 for 17, and 0 if you never find it.',
    sources: [
      { name: 'Wikimedia Pageviews API: daily top list', url: 'https://wikimedia.org/api/rest_v1/#/Pageviews%20data/get_metrics_pageviews_top__project___access___year___month___day_', note: 'en.wikipedia, all-access, top 1,000 per day' },
      { name: 'Wikimedia Pageviews API: per-article daily views', url: 'https://wikimedia.org/api/rest_v1/#/Pageviews%20data/get_metrics_pageviews_per_article__project___access___agent___article___granularity___start___end_', note: 'curves use human (user) traffic' },
    ],
    dataNote: 'Live data: when the page opens, your browser fetches the daily top lists for the two days before the puzzle date straight from Wikimedia and picks the article with the highest views \u00f7 previous-3-day average that day (at least 40,000 views, excluding the Main Page, special pages, \u201cDeaths in \u2026\u201d and \u201cList of \u2026\u201d). It then fetches that article\u2019s 21-day human traffic curve; if the curve cannot show a genuine human surge (bot traffic), the next candidate is used. Articles outside the top 1,000 in the prior three days get a baseline estimated from the 1,000th-ranked article\u2019s views, so the ratios are conservative. If fetching fails, the game falls back to the archived puzzles in data.json from July to October 2026. The \u201csame-day surge\u201d clues come from the all-access list, which includes bot traffic, so a few entries may be caused by crawlers.',
  },

  puzzle({ data, pick }) {
    return data.live ?? pick(data.puzzles);
  },

  async load(ctx) {
    const day = ctx.core.addDays(ctx.date, -2);
    const days = [-3, -2, -1, 0].map((k) => ctx.core.addDays(day, k));
    ctx.log('live: fetching top lists', days[0], '…', day);
    const tops = await Promise.all(days.map((d) => ctx.fetchJSON(topUrl(d), { timeout: 8000 })));
    const maps = tops.map(topMap);
    if (maps.some((m) => m.size < 500)) throw new Error('top list incomplete');
    const spikes = rankSpikes(maps.slice(0, 3), maps[3]);
    const cache = {};
    const cands = spikes.slice(0, 4);
    const got = await Promise.all(cands.map((s) => ctx.fetchJSON(seriesUrl(s.a, day), { timeout: 8000 })));
    cands.forEach((s, i) => { cache[s.a] = got[i]; });
    const live = toPuzzle(day, tops, (a) => cache[a]);
    if (!live) throw new Error('no valid spike for ' + day);
    const opts = new Set(ctx.data.options);
    for (const m of maps) for (const [a] of [...m].slice(0, 300)) if (!isBad(a)) opts.add(a.replaceAll('_', ' '));
    for (const c of live.co) opts.add(c.t);
    opts.add(live.title);
    ctx.log('live ok', live.date, live.title, `x${live.ratio}`);
    return { ...ctx.data, live, options: [...opts].sort() };
  },

  async play(ctx, P) {
    const { ui, core } = ctx;
    const sp = describeSpike(P.series);
    const start = new Date(Date.parse(`${P.date}T00:00:00Z`) - 20 * 86400000);
    const rows = P.series.map((v, i) => ({ date: new Date(start.getTime() + i * 86400000), v }));
    ctx.log('puzzle', P.date, P.title, `x${P.ratio}`);

    const lo = Math.max(1, Math.min(...P.series) * 0.6);
    const hi = Math.max(...P.series) * 1.5;
    const ticks = [10, 30, 100, 300, 1e3, 3e3, 1e4, 3e4, 1e5, 3e5, 1e6, 3e6, 1e7].filter((t) => t >= lo * 1.3 && t <= hi);
    const chart = await ui.plot((Plot, c) => ({
      height: 240,
      marginLeft: 52,
      marginBottom: 32,
      x: { type: 'utc', tickFormat: '%m-%d', label: null, ticks: 5 },
      y: { type: 'log', domain: [lo, hi], grid: true, label: null, ticks, tickFormat: (v) => core.fmtCompact(v) },
      marks: [
        Plot.areaY(rows, { x: 'date', y: 'v', y1: lo, fill: c.accent, fillOpacity: 0.15 }),
        Plot.lineY(rows, { x: 'date', y: 'v', stroke: c.accent, strokeWidth: 2 }),
        Plot.dot(rows.slice(-1), { x: 'date', y: 'v', fill: c.accent, r: 5 }),
        Plot.tip(rows, Plot.pointerX({ x: 'date', y: 'v', title: (d) => `${d.date.toISOString().slice(0, 10)}\n${core.fmtNum(d.v)} views` })),
      ],
    }));
    const coClue = (c) => `Also surging that day: \u201c${c.t}\u201d (${core.fmtNum(c.v)} views, about ${c.r.toFixed(1)}\u00d7)`;
    const clues = [
      ui.h('div', chart,
        ui.h('div', { class: 'ds-grid', style: { '--min': '110px', marginTop: '12px' } },
          ui.stat({ label: 'Spike day', value: P.date.slice(5), sub: P.date.slice(0, 4) }),
          ui.stat({ label: 'Views that day', value: core.fmtCompact(sp.last) }),
          ui.stat({ label: 'Daily average before', value: core.fmtCompact(sp.base) }),
          ui.stat({ label: 'Surge factor', value: `${sp.factor.toFixed(1)}\u00d7`, sub: 'log scale' }))),
      ...P.co.map(coClue),
    ];
    while (clues.length < 6) clues.push(`The article title starts with \u201c${P.title[0]}\u201d.`);

    const coSet = new Map(P.co.map((c) => [c.t, c]));
    const res = await ctx.guess({
      title: 'Which article is this?',
      options: ctx.data.options.map((t) => ({ id: t, label: t })),
      answer: P.title,
      maxGuesses: 6,
      placeholder: 'Type an article title, e.g. Taylor Swift\u2026',
      clues,
      cluesTitle: `Clues for the ${P.date} spike`,
      columns: ['Same-day spike'],
      near: (g) => coSet.has(g.id),
      scoring: scoreFor,
      feedback: (g) => (g.id === P.title
        ? [{ text: 'That\u2019s it', state: 'hit' }]
        : coSet.has(g.id) ? [{ text: `Yes \u00b7 ${coSet.get(g.id).r.toFixed(1)}\u00d7`, state: 'near', num: true }] : [{ text: 'No', state: 'miss' }]),
      onGuess: (opt, { correct }) => ctx.log('guess', opt.id, correct),
    });

    const shape = sp.calm >= 15
      ? `For ${sp.calm} days before the spike the curve stayed under twice its average, with only ${core.fmtNum(sp.prior)} views the day before, then it leapt to ${core.fmtNum(sp.last)} in a day: a bolt from the blue, typical of breaking events (news, a match, an obituary, a release).`
      : `This curve was never quiet (the highest of the prior 20 days was ${core.fmtNum(sp.peak)} views), and the spike day pushed it up to ${core.fmtNum(sp.last)}: more like a new wave on a sustained trend.`;
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['Answer', ui.h('a', { href: `https://en.wikipedia.org/wiki/${encodeURIComponent(P.id)}`, target: '_blank', rel: 'noopener' }, P.title)],
        ['Date', P.date],
        ['Views that day', `${core.fmtNum(sp.last)} human views, about ${sp.factor.toFixed(1)}\u00d7 the daily average of the prior 20 days; by the ranking\u2019s measure (against the prior three days) ${P.ratio.toFixed(1)}\u00d7, and #${P.rank} sitewide that day`],
        ['Curve shape', shape],
        ['How to work it out', `Also surging the same day: ${P.co.map((c) => c.t).join(', ')}. Whatever connects them is the reason \u201c${P.title}\u201d spiked that day.`],
      ]),
      ui.table({
        columns: [{ key: 't', label: 'Same-day surges' }, { key: 'v', label: 'Views', num: true, fmt: (v) => core.fmtNum(v) }, { key: 'r', label: 'Factor', num: true, fmt: (v) => `${v.toFixed(1)}\u00d7` }],
        rows: P.co,
      }));
    return res;
  },
};
