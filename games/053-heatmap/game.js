// #53 Heatmap — a series' per-episode IMDb ratings as a season x episode heatmap; name the show.

const MAX_GUESSES = 6;
const STOP = new Set(['the', 'and', 'of', 'in', 'a', 'an', 'to', 'for', 'with', 'is', 'on', 'my']);
const BAR = '▇▇▇';
const OPACITY = [0.3, 0.45, 0.62, 0.8, 1];

/** Colour bucket for a rating (also used by tests). */
export function bucket(r) { return r >= 9 ? 4 : r >= 8.5 ? 3 : r >= 8 ? 2 : r >= 7 ? 1 : 0; }

/** Score for winning on guess n (1-based) of MAX_GUESSES; 0 when not won. */
export function scoreFor(n, won) { return won ? Math.round((100 * (MAX_GUESSES - n + 1)) / MAX_GUESSES) : 0; }

const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Hide the show's name inside an episode title. Whole words only (plus a plural / possessive
 * tail), so no fragments like "▇▇▇lantis" are left behind. The full title phrase goes first.
 */
export function redactTitle(text, show) {
  const L = '\\p{L}\\p{N}';
  const wrap = (src) => new RegExp(`(?<![${L}])(?:${src})(?:['’]?s)?(?![${L}])`, 'giu');
  const phrase = show.title.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const words = [...new Set(phrase.split(' ').filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()) && !/^\d+$/.test(w)))];
  let out = text;
  if (phrase) out = out.replace(wrap(phrase.split(' ').map(esc).join('[^\\p{L}\\p{N}]+')), BAR);
  if (words.length) out = out.replace(wrap(words.map(esc).join('|')), BAR);
  return out;
}

/** A title worth showing as a clue (not an IMDb placeholder). */
export const isNamed = (t) => !!t && !/^episode\s*#?\d/i.test(t.trim());

/** Autocomplete label: add the premiere year when two shows share a title. */
export function labelsFor(shows) {
  const n = new Map();
  for (const s of shows) n.set(s.title, (n.get(s.title) || 0) + 1);
  return shows.map((s) => (n.get(s.title) > 1 ? `${s.title} (${s.start})` : s.title));
}

const avg = (xs) => xs.reduce((a, x) => a + x.r, 0) / xs.length;

export default {
  meta: {
    num: 53,
    slug: 'heatmap',
    title: 'Heatmap',
    tagline: 'Every episode\'s IMDb rating of a TV show, laid out as a season \u00d7 episode heatmap. Read the ups and downs and name the show.',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      'Each row of the heatmap is a season and each cell an episode; the darker the cell, the higher the rating. Pale gray blanks are episodes with too few ratings to be included.',
      'Pick a show from the list, up to 6 guesses. Every miss unlocks a new clue: seasons and episode counts, genre and era, the names of the best and worst episodes (with the show\'s title masked), the first letter\u2026',
      'Read the shape: fading all the way down means a slide in reputation; a suddenly dark last season is probably a big finale; a dark last cell in every season means the show loves a season-ending bang.',
      'Scoring: 100 points for a first-try hit, about 17 fewer for each extra guess, 0 if you miss all six.',
    ],
    scoring: 'A hit on guess n scores 100 \u00b7 (7 \u2212 n) / 6; 0 if you miss all six.',
    sources: [
      { name: 'IMDb Non-Commercial Datasets', url: 'https://developer.imdb.com/non-commercial-datasets/', note: 'title.basics / title.episode / title.ratings' },
    ],
    dataNote: 'A snapshot of the public IMDb datasets (a database of several hundred MB with no CORS, so browsers cannot read it live; other IMDb-like APIs such as OMDb need a key). It covers 200 popular shows with over 100,000 ratings, at least 2 seasons and at least 20 rated episodes; each show is one puzzle. Ratings drift over time, and episodes with fewer than 50 ratings are left out.',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.shows).id };
  },

  async play(ctx, p) {
    const { ui, core } = ctx;
    const shows = ctx.data.shows;
    const labels = labelsFor(shows);
    const ans = shows.find((s) => s.id === p.id);
    ctx.log('answer', ans.title, ans.eps.length);

    const cells = ans.eps.map(([s, e, r, t]) => ({ s, e, r, t, k: bucket(r) }));
    const seasonList = [...new Set(cells.map((x) => x.s))].sort((a, b) => a - b);
    const maxEp = Math.max(...cells.map((x) => x.e));
    const have = new Set(cells.map((x) => `${x.s}-${x.e}`));
    const gaps = [];
    for (const s of seasonList) {
      const top = Math.max(...cells.filter((x) => x.s === s).map((x) => x.e));
      for (let e = 1; e <= top; e++) if (!have.has(`${s}-${e}`)) gaps.push({ s, e });
    }
    const epDomain = Array.from({ length: maxEp }, (_, i) => i + 1);
    const showNums = maxEp <= 14;
    const heat = await ui.plot((Plot, c) => ({
      height: Math.min(560, 44 + seasonList.length * (maxEp > 30 ? 16 : 26)),
      marginLeft: 40,
      padding: 0.1,
      x: { label: null, domain: epDomain, ticks: epDomain.filter((e) => e === 1 || e % 5 === 0), tickSize: 0 },
      y: { label: null, domain: seasonList, tickFormat: (s) => `S${s}`, tickSize: 0 },
      opacity: { type: 'identity' },
      marks: [
        Plot.cell(gaps, { x: 'e', y: 's', fill: c.muted, fillOpacity: 0.12, rx: 2 }),
        Plot.cell(cells, { x: 'e', y: 's', fill: c.accent, fillOpacity: (x) => OPACITY[x.k], rx: 2, title: (x) => `S${x.s}E${x.e} · ${x.r}` }),
        ...(showNums ? [Plot.text(cells, { x: 'e', y: 's', text: (x) => x.r.toFixed(1), fontSize: 8, fill: c.ink, fillOpacity: 0.85 })] : []),
      ],
    }));
    const legendLabels = ['< 7', '7–8', '8–8.5', '8.5–9', '≥ 9'];
    const legend = ui.h('div', { class: 'ds-row small mono ink2', style: { gap: '10px', marginTop: '6px', flexWrap: 'wrap' } },
      ...legendLabels.map((l, i) => ui.h('span', ui.h('span', { style: { color: 'var(--accent)', opacity: String(OPACITY[i]) } }, '■'), ' ' + l)));

    const named = cells.filter((x) => isNamed(x.t));
    const pool = named.length ? named : cells;
    const best = pool.reduce((a, b) => (b.r > a.r ? b : a));
    const worst = pool.reduce((a, b) => (b.r < a.r ? b : a));
    const first = cells.filter((x) => x.s === seasonList[0]), last = cells.filter((x) => x.s === seasonList[seasonList.length - 1]);
    const decade = Math.floor(ans.start / 10) * 10;
    const perSeason = Math.round(cells.length / seasonList.length);
    const clues = [
      ui.h('div', heat, legend),
      `${seasonList.length} season${seasonList.length === 1 ? '' : 's'}, ${cells.length} rated episodes (about ${perSeason} per season). Season 1 averages ${avg(first).toFixed(1)}, the last season ${avg(last).toFixed(1)}.`,
      `Genre: ${ans.genres.join(' / ')}. It premiered in the ${decade}s. ${ans.end ? 'It has ended.' : 'The data does not mark it as ended.'}`,
      `Best-rated episode, ${best.r} (S${best.s}E${best.e}): \u201c${redactTitle(best.t, ans)}\u201d`,
      `Worst-rated episode, ${worst.r} (S${worst.s}E${worst.e}): \u201c${redactTitle(worst.t, ans)}\u201d`,
      `The title starts with \u201c${ans.title[0]}\u201d and has ${ans.title.length} characters.`,
    ];

    const byId = new Map(shows.map((s, i) => [s.id, s]));
    const res = await ctx.guess({
      options: shows.map((s, i) => ({ id: s.id, label: labels[i], hint: String(s.start), aliases: /^the /i.test(s.title) ? [s.title.slice(4)] : [] })),
      answer: ans.id,
      maxGuesses: MAX_GUESSES,
      title: 'Which show is this?',
      placeholder: 'Type a show\u2026',
      clues,
      cluesTitle: 'Heatmap and clues',
      columns: ['Debut', 'Rating'],
      near: (g, a) => Math.abs(byId.get(g.id).start - byId.get(a.id).start) <= 2,
      scoring: scoreFor,
      feedback: (g, a) => {
        const gs = byId.get(g.id), as = byId.get(a.id);
        const yr = gs.start === as.start ? 'hit' : Math.abs(gs.start - as.start) <= 3 ? 'near' : undefined;
        const rt = Math.abs(gs.rating - as.rating) < 0.2 ? 'hit' : Math.abs(gs.rating - as.rating) < 0.5 ? 'near' : undefined;
        return [
          { text: `${gs.start} ${gs.start < as.start ? '↑' : gs.start > as.start ? '↓' : ''}`, state: yr, num: true },
          { text: `${gs.rating} ${gs.rating < as.rating ? '↑' : gs.rating > as.rating ? '↓' : ''}`, state: rt, num: true },
        ];
      },
    });
    ctx.log('result', res.score);

    // which pattern gave it away: per-season averages, the finale, the dip
    const seasonAvg = seasonList.map((s) => [s, avg(cells.filter((x) => x.s === s))]);
    const peak = seasonAvg.reduce((a, b) => (b[1] > a[1] ? b : a));
    const dip = seasonAvg.reduce((a, b) => (b[1] < a[1] ? b : a));
    const trend = avg(last) - avg(first);
    const lastEp = last.reduce((a, b) => (b.e > a.e ? b : a));
    const finale = lastEp.r - avg(last);
    const shape = trend < -0.3 ? `Slipping: season 1 ${avg(first).toFixed(1)} \u2192 last season ${avg(last).toFixed(1)}, the heatmap fades toward the bottom`
      : trend > 0.3 ? `Getting better: season 1 ${avg(first).toFixed(1)} \u2192 last season ${avg(last).toFixed(1)}, the heatmap darkens toward the bottom`
        : `Steady: season 1 ${avg(first).toFixed(1)} \u2192 last season ${avg(last).toFixed(1)}, the shading barely changes`;
    const finaleTxt = finale >= 0.4 ? `The finale, S${lastEp.s}E${lastEp.e}, is rated ${lastEp.r}, ${finale.toFixed(1)} above the last season\'s average: the bottom-right cell is especially dark`
      : `The finale, S${lastEp.s}E${lastEp.e}, is rated ${lastEp.r}, about the same as the last season\'s average`;
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([
        ['Answer', `${ans.title} (${ans.start}${ans.end ? '\u2013' + ans.end : '\u2013'}) \u00b7 ${ans.genres.join(' / ')}`],
        ['IMDb rating', `${ans.rating} \u00b7 ${core.fmtCompact(ans.votes)} votes`],
        ['Best episode', `S${best.s}E${best.e} “${best.t}” ${best.r}`],
        ['Worst episode', `S${worst.s}E${worst.e} “${worst.t}” ${worst.r}`],
        ['Trend', shape],
        ['Best / worst season', `S${peak[0]} avg ${peak[1].toFixed(1)} / S${dip[0]} avg ${dip[1].toFixed(1)}`],
        ['Finale', finaleTxt],
      ]));
    return res;
  },
};
