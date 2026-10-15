// #74 Star History — weekly new-star curve of a famous GitHub repo; guess the repo.

const norm = (t) => (t || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Normalised forms of the repo name and the owner (also without a trailing "js") that must never be visible. */
export function nameKeys(full) {
  const [owner, repo] = full.split('/');
  const keys = new Set();
  for (const w of [repo, owner]) {
    const n = norm(w);
    for (const v of [n, n.replace(/js$/, '')]) if (v.length >= 3) keys.add(v);
  }
  return [...keys];
}

/** Hide the repo's own name / owner inside text — also across spaces ("web UI"), and inside longer words. */
export function redact(text, full) {
  const src = text || '';
  const keys = nameKeys(full);
  const words = [...src.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ s: m.index, e: m.index + m[0].length, n: norm(m[0]) }));
  let out = '';
  let pos = 0;
  for (let i = 0; i < words.length;) {
    if (words[i].s < pos) { i++; continue; }
    let hit = -1;
    let joined = '';
    for (let j = i; j < Math.min(words.length, i + 6) && hit < 0; j++) {
      joined += words[j].n;
      if (keys.includes(joined)) hit = j;
    }
    if (hit < 0 && keys.some((k) => k.length >= 4 && words[i].n.includes(k))) hit = i;
    if (hit < 0) { i++; continue; }
    out += src.slice(pos, words[i].s) + '▇▇▇';
    pos = words[hit].e;
    i = hit + 1;
  }
  return out + src.slice(pos);
}

/** Does this topic tag give the repo away? */
export function topicLeaks(topic, full) {
  const n = norm(topic);
  return nameKeys(full).some((k) => n === k || (k.length >= 4 && n.includes(k)));
}

/** Shape stats of a weekly series: peak week, peak vs median, share of stars in the top 3 weeks, early-vs-late trend. */
export function shape(s) {
  const sorted = [...s].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 1;
  const peak = Math.max(...s);
  const total = s.reduce((a, b) => a + b, 0);
  const top3 = sorted.slice(-3).reduce((a, b) => a + b, 0);
  const q = Math.max(1, Math.floor(s.length / 4));
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const trend = avg(s.slice(-q)) / Math.max(1, avg(s.slice(0, q)));
  return { peak, peakIdx: s.indexOf(peak), median, ratio: peak / median, top3Share: top3 / total, total, trend };
}

/** Log-axis ticks at 1-2-5 steps. */
export function logTicks(lo, hi) {
  const t = [];
  for (let p = Math.pow(10, Math.floor(Math.log10(Math.max(lo, 1)))); p <= hi; p *= 10) for (const m of [1, 2, 5]) if (p * m >= lo && p * m <= hi) t.push(p * m);
  return t;
}

/** Explanation of which pattern in the series identifies the repo. */
export function pattern(st) {
  const bits = [];
  if (st.top3Share > 0.3) bits.push('a few weeks account for most of the stars, the classic Hacker News / social media burst');
  else if (st.ratio < 2.5) bits.push('a very smooth curve, the long-tail growth of an established project');
  else bits.push('moderate ups and downs, with steady interest and occasional peaks');
  if (st.trend > 1.5) bits.push(`the last quarter averages ${st.trend.toFixed(1)}x the weekly stars of the first quarter, so it is still heating up`);
  else if (st.trend < 0.5) bits.push(`the last quarter averages only ${(st.trend * 100).toFixed(0)}% of the first quarter's weekly stars, so interest is fading`);
  else bits.push('interest is about the same early and late');
  return bits.join('; ').replace(/^./, (c) => c.toUpperCase()) + '.';
}

const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));
const bucket = (n) => `${fmt(Math.floor(n / 10000) * 10000)}–${fmt(Math.floor(n / 10000) * 10000 + 10000)}`;

export default {
  meta: {
    num: 74,
    slug: 'star-history',
    title: 'Star History',
    tagline: 'The weekly new-star curve of a GitHub repo. Guess the repo from its shape.',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      'The chart shows the new stars per week for a popular repo over 68 weeks, Feb 2023 to May 2024 (log scale on the y-axis). Clue 2 adds the cumulative curve.',
      'Pick a repo from the list, up to 6 guesses. Each wrong guess unlocks another clue (cumulative curve, language and creation year, topics, description, total stars).',
      'A wrong guess tells you whether the language matches, whether the creation year is earlier (↑) or later (↓) than the answer, and how many times the answer\'s star gain your guess gained in these 68 weeks.',
      'Hint: sharp spikes usually mean a Hacker News front page or a big release, a steady climb is often a new AI project, and a smooth long tail is an old classic.',
    ],
    scoring: '100 points for a first-guess hit, about 17 fewer for each extra guess, and 0 if all 6 miss.',
    sources: [
      { name: 'GH Archive (WatchEvent), via the github_events table on the public ClickHouse playground', url: 'https://www.gharchive.org/' },
      { name: 'GitHub REST API (repo metadata: language, creation date, topics, total stars)', url: 'https://docs.github.com/rest/search/search#search-repositories' },
    ],
    dataNote: 'GitHub\'s stargazers endpoints (REST and GraphQL) return 404 / totalCount 0 for this account, so per-star timestamps are unavailable and the full growth curve since creation cannot be rebuilt. Instead, GH Archive WatchEvents (star clicks) are summed by week. The mirror table has no data between 2024-06 and 2025-08, so the curve covers 68 weeks, 2023-02-06 to 2024-05-26. The mirror has data after 2025-09, but weekly event totals drop from 800k to under 100k, which looks incomplete, so it is not used. For repos created before the window, the cumulative curve starts at 0 at the window start. Total stars, language and topics are a snapshot taken in Oct 2026. Nothing loads live: GitHub\'s keyless API is limited to 60 requests an hour and has no stargazer timestamps, and the ClickHouse mirror lags and is incomplete. Repo descriptions that were written in Chinese are shown in English translation.',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.repos).id };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const repos = ctx.data.repos;
    const byId = new Map(repos.map((r) => [r.id, r]));
    const ans = byId.get(p.id);
    const st = shape(ans.s);
    ctx.log('answer', ans.id, 'peak', st.peak, 'ratio', st.ratio.toFixed(1));
    const dates = ctx.data.weeks.map((w) => new Date(`${w}T00:00:00Z`));
    const rows = ans.s.map((v, i) => ({ d: dates[i], v: Math.max(v, 1) }));

    const lo = Math.max(1, Math.min(...ans.s) * 0.6);
    const hi = st.peak * 1.3;
    const chart = await ui.plot((Plot, c) => ({
      height: 260,
      marginLeft: 48,
      y: { type: 'log', label: 'New stars per week', grid: true, ticks: logTicks(lo, hi), tickFormat: '~s', domain: [lo, hi] },
      x: { label: null },
      marks: [Plot.areaY(rows, { x: 'd', y: 'v', y1: lo, fill: c.accent, fillOpacity: 0.18 }), Plot.lineY(rows, { x: 'd', y: 'v', stroke: c.accent, strokeWidth: 2 }), Plot.tip(rows, Plot.pointerX({ x: 'd', y: 'v' }))],
    }));
    let run = 0;
    const cum = ans.s.map((v, i) => ({ d: dates[i], v: (run += v) }));
    const cumChart = await ui.plot((Plot, c) => ({
      height: 170,
      marginLeft: 48,
      y: { label: 'Cumulative new stars in window', grid: true, tickFormat: '~s', domain: [0, ans.total] },
      x: { label: null },
      marks: [Plot.areaY(cum, { x: 'd', y: 'v', fill: c.accent, fillOpacity: 0.18 }), Plot.lineY(cum, { x: 'd', y: 'v', stroke: c.accent, strokeWidth: 2 }), Plot.tip(cum, Plot.pointerX({ x: 'd', y: 'v' }))],
    }));

    const topics = ans.topics.filter((t) => !topicLeaks(t, ans.id));
    const clues = [
      chart,
      ui.stack(`It gained ${core.fmtNum(ans.total)} stars over these ${ans.s.length} weeks. The best week had ${core.fmtNum(st.peak)}, ${st.ratio.toFixed(1)}x the median week. Below is the cumulative curve for the same period:`, cumChart),
      `Main language: ${ans.lang || 'none'}. Created in ${ans.created.slice(0, 4)}.`,
      topics.length ? `GitHub topics (any matching the name are hidden): ${topics.join(', ')}` : 'This repo has no public topic tags.',
      `Description (name blacked out): ${redact(ans.desc, ans.id) || 'none'}`,
      `Its total star count today is between ${bucket(ans.stars)}.`,
    ];

    const res = await ctx.guess({
      options: repos.map((r) => ({ id: r.id, label: r.id, hint: r.lang || '', aliases: [r.id.split('/')[1]] })),
      answer: ans.id,
      maxGuesses: 6,
      title: 'Which repo is this?',
      placeholder: 'Type a repo name or owner/repo…',
      clues,
      cluesTitle: 'The curve and clues',
      columns: ['Language', 'Created', 'Star gain'],
      near: (g, a) => Math.abs(byId.get(g.id).total / byId.get(a.id).total - 1) < 0.35,
      feedback: (g) => {
        const gr = byId.get(g.id);
        if (gr.id === ans.id) return [{ text: ans.lang || '—', state: 'hit' }, { text: ans.created.slice(0, 4), state: 'hit', num: true }, { text: '1×', state: 'hit', num: true }];
        const dy = +gr.created.slice(0, 4) - +ans.created.slice(0, 4);
        const k = gr.total / ans.total;
        return [
          { text: gr.lang || '—', state: gr.lang === ans.lang ? 'hit' : 'miss' },
          { text: `${gr.created.slice(0, 4)} ${dy === 0 ? '=' : dy > 0 ? '↓' : '↑'}`, state: Math.abs(dy) <= 1 ? 'near' : undefined, num: true },
          { text: `${k >= 10 ? k.toFixed(0) : k.toFixed(1)}×`, state: k > 0.7 && k < 1.4 ? 'near' : undefined, num: true },
        ];
      },
    });

    res.detail = ui.kv([
      ['Answer', `${ans.id} (${ans.lang || '—'}, created ${ans.created.slice(0, 4)})`],
      ['About', ans.desc || '—'],
      ['Best week', `Week of ${ctx.data.weeks[st.peakIdx]}: +${core.fmtNum(st.peak)} stars (median week ${core.fmtNum(st.median)})`],
      ['Curve shape', `Best week / median week = ${st.ratio.toFixed(1)}; the top 3 weeks hold ${(st.top3Share * 100).toFixed(0)}% of stars. ${pattern(st)}`],
      ['Total stars', `${core.fmtNum(ans.stars)} (${core.fmtNum(ans.total)} of them gained in these ${ans.s.length} weeks)`],
    ]);
    return res;
  },
};
