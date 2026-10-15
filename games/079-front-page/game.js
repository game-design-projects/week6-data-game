// #79 Front Page — guess the Hacker News score of four stories from one day (live: 2 UTC days ago).
const QUANTILES = [0, 0.04, 0.2, 0.55]; // top hit, hot, middle, ordinary
const MEDIAN_RATIO = 0.53; // median comments/points over the pool of picked stories
const MIN_HITS = 12;
const API = 'https://hn.algolia.com/api/v1/search';

// Algolia search response for ONE UTC day (points >= 15) -> puzzle day. Pure, shared with build/build.mjs.
export function toDay(raw, date) {
  const hits = (raw?.hits ?? [])
    .filter((h) => h && typeof h.title === 'string' && h.title.trim().length >= 4 && Number.isFinite(h.points) && h.points >= 15)
    .map((h) => ({ ...h, title: h.title.replace(/\s+/g, ' ').trim() }))
    .sort((a, b) => b.points - a.points || Number(a.objectID) - Number(b.objectID));
  const n = hits.length;
  if (n < MIN_HITS) return null;
  const idx = [...new Set(QUANTILES.map((q) => Math.min(n - 1, Math.round(q * n))))];
  if (idx.length !== QUANTILES.length) return null;
  const sorted = hits.map((h) => h.points);
  const median = sorted[n >> 1];
  const stories = idx.map((i) => {
    const h = hits[i];
    let domain = null;
    try { domain = h.url ? new URL(h.url).hostname.replace(/^www\./, '') : null; } catch { domain = null; }
    return {
      id: Number(h.objectID), title: h.title, domain,
      points: h.points, comments: h.num_comments || 0,
      hour: new Date(h.created_at_i * 1000).getUTCHours(),
      rank: i + 1,
    };
  });
  return { date, n, median, stories };
}

export function apiUrl(date) {
  const t0 = Date.parse(`${date}T00:00:00Z`) / 1000;
  const q = encodeURIComponent(`created_at_i>=${t0},created_at_i<${t0 + 86400},points>=15`);
  return `${API}?tags=story&numericFilters=${q}&hitsPerPage=1000&attributesToRetrieve=title,url,points,num_comments,created_at_i,objectID&attributesToHighlight=`;
}

export default {
  meta: {
    num: 79, slug: 'front-page', title: 'Front Page',
    tagline: 'Four Hacker News stories from one day. From the title, domain and comment count alone, guess how many points each earned.',
    category: 'tech', data: 'live',
    howTo: [
      'Each day takes the HN day two UTC days back (when scores have mostly settled) and picks 4 stories with 15+ points by rank: the day\'s top story, a hot one, a middling one and an ordinary one, in random order.',
      'For each story, drag the log-scale slider (or type a number) to guess its final score.',
      'Clue: comments are roughly 0.3 to 0.8 times the points (median 0.5). Far more comments than that means a controversial post, and far fewer is usually a niche link or a Show HN. The top tells you how many stories passed 15 points that day and the median score.',
    ],
    scoring: 'Each story is scored by log error: off by 2x is about 37 points, spot on is 100. The four add up to 400 at most.',
    sources: [
      { name: 'Hacker News Search API (Algolia)', url: 'https://hn.algolia.com/api', note: 'Live request, CORS-enabled, no key needed' },
      { name: 'Hacker News', url: 'https://news.ycombinator.com/' },
    ],
    dataNote: 'Live: when the page opens, it asks the Algolia HN search API for all 15+ point stories from two UTC days back (more than 24 hours old, so scores have mostly stopped moving), then picks 4 by rank, so every player sees the same puzzle. If the request fails it falls back to a 120-day snapshot taken at build time (build/fetch.mjs).',
  },

  async load(ctx) {
    const date = ctx.core.addDays(ctx.date, -2);
    const raw = await ctx.fetchJSON(apiUrl(date), { timeout: 9000 });
    const live = toDay(raw, date);
    ctx.log('live day', date, live ? `${live.n} hits` : 'too few hits');
    return live ? { ...ctx.data, live } : null;
  },

  puzzle({ data, pick, rng }) {
    const d = data.live ?? pick(data.days);
    return { date: d.date, n: d.n, median: d.median, stories: rng.shuffle([...d.stories]) };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    ctx.log('day', p.date, 'n', p.n);
    const max = Math.max(3000, Math.ceil((Math.max(...p.stories.map((s) => s.points)) * 1.5) / 500) * 500);
    ctx.stage.append(ui.callout(`HN ${p.date} (UTC) · ${p.n} stories got 15+ points that day, with a median of ${p.median}. The 4 below are from that day, shuffled.`));
    const rs = [];
    for (const [i, s] of p.stories.entries()) {
      const box = ui.h('div');
      ctx.stage.append(box);
      box.append(ui.panel({ kicker: `Story ${i + 1} of ${p.stories.length}`, title: s.title },
        ui.row(ui.badge(s.domain || 'Text post (no link)'), ui.badge(`${core.fmtNum(s.comments)} ${s.comments === 1 ? 'comment' : 'comments'}`, 'accent'), ui.badge(`Posted at ${s.hour}:00 UTC`))));
      const r = await ctx.estimate({
        container: box, answer: s.points, min: 10, max, log: true, initial: Math.min(p.median * 2, max), step: 1,
        unit: 'points', format: (v) => core.fmtNum(Math.round(v)), scoring: 'log', scale: 0.3,
        title: 'How many points did it get?',
      });
      ctx.log('story', s.id, s.points, r.guess);
      rs.push(r);
    }
    const res = ctx.combine(rs);
    const rows = p.stories.map((s, i) => {
      const byComments = Math.round(s.comments / MEDIAN_RATIO);
      const off = Math.max(byComments, s.points) / Math.max(1, Math.min(byComments, s.points));
      return {
        title: s.title, rank: `${s.rank}/${p.n}`, points: s.points, comments: s.comments,
        ratio: (s.comments / s.points).toFixed(2), byComments: `${core.fmtNum(byComments)} (×${off.toFixed(1)})`,
        guess: core.fmtNum(Math.round(rs[i].guess)),
      };
    });
    res.detail = ui.stack(
      ui.table({
        columns: [
          { key: 'title', label: 'Story' }, { key: 'rank', label: 'Rank', num: true }, { key: 'points', label: 'Points', num: true },
          { key: 'comments', label: 'Comments', num: true },
          { key: 'byComments', label: 'From comments', num: true }, { key: 'guess', label: 'Your guess', num: true },
        ],
        rows,
      }),
      ui.h('p', { class: 'ds-muted' }, `Tip: comments ÷ ${MEDIAN_RATIO} (the sample's median ratio) is a good starting point, and the figure in parentheses is how many times it is off the real score. A comments-to-points ratio well above 0.8 marks a controversial post, and below 0.3 is often a quiet link or a Show HN.`),
    );
    return res;
  },
};
