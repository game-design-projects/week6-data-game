// #55 Palette — five dominant colours of a painting; guess its year and movement.
export const decade = (y) => `${Math.floor(y / 10) * 10}s`;
export const YEAR_MIN = 1400, YEAR_MAX = 1940;

/** Four movement options. Distractors are movements whose usual period (+-10 y) does not contain the painting's
 *  year, so the year estimate and the movement question reinforce each other instead of being a coin flip. */
export const styleOptions = (styles, answerId, year, rng) => {
  const ans = styles.find((s) => s.id === answerId);
  const others = styles.filter((s) => s.id !== answerId);
  const far = others.filter((s) => year < s.from - 10 || year > s.to + 10);
  const pool = far.length >= 3 ? far : others;
  return rng.shuffle([ans, ...rng.sample(pool, 3)]);
};

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
/** Share-weighted mean lightness and saturation (HSL, 0..1) of a palette. */
export const paletteStats = (colors, share) => {
  let L = 0, S = 0, W = 0;
  colors.forEach((c, i) => {
    const [r, g, b] = rgb(c), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    const sat = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
    L += l * share[i]; S += sat * share[i]; W += share[i];
  });
  return { light: L / W, sat: S / W };
};
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const pc = (v) => `${Math.round(v * 100)}%`;
const tone = (d) => (d > 0.04 ? 1 : d < -0.04 ? -1 : 0);

/** Puzzle-specific explanation: how this palette compares with the rest of the pool. */
export const explain = (p, paintings, style) => {
  const st = paletteStats(p.colors, p.share);
  const same = paintings.filter((q) => q.style === p.style && q.id !== p.id).map((q) => paletteStats(q.colors, q.share));
  const all = paintings.filter((q) => q.id !== p.id).map((q) => paletteStats(q.colors, q.share));
  const ref = same.length >= 2 ? same : all;
  const refName = same.length >= 2 ? `other ${style.name} paintings` : 'all paintings';
  const dl = st.light - mean(ref.map((x) => x.light)), ds = st.sat - mean(ref.map((x) => x.sat));
  const parts = [];
  if (tone(dl)) parts.push(`${dl > 0 ? 'lighter' : 'darker'} overall`);
  if (tone(ds)) parts.push(`${ds > 0 ? 'more' : 'less'} saturated`);
  return {
    stats: `Average lightness ${pc(st.light)}, average saturation ${pc(st.sat)}; the average for ${refName} is ${pc(mean(ref.map((x) => x.light)))} / ${pc(mean(ref.map((x) => x.sat)))}`
      + (parts.length ? `, so this one is ${parts.join(' and ')}.` : ', so this one is very typical.'),
  };
};

export default {
  meta: {
    num: 55,
    slug: 'palette',
    title: 'Palette',
    tagline: 'A famous painting boiled down to five dominant colors. Guess the year it was painted and its movement.',
    category: 'culture',
    data: 'computed',
    howTo: [
      'The width of each stripe is that color\u2019s share of the picture. The five colors come from k-means clustering over the whole painting.',
      'First estimate the year. Murky earth browns and dark backgrounds are common in older paintings, highly saturated pure colors and big flat areas lean modern, and gold shows up mostly in early work.',
      'Then pick the movement from four options (the distractors all flourished in different periods from this painting). Afterwards the original is revealed, with its lightness and saturation compared against paintings of the same movement.',
      'Scoring: the year is worth up to 100 and falls to about a third for every 40 years off (about 98 for 1 year off, 8 for 100 years off); the right movement is worth 100. The two add up to 200.',
    ],
    scoring: 'Year: 100 \u00d7 e^(\u2212error / 40 years), over 1400\u20131940. Movement: 100 if right, 0 if wrong. Add the two for a maximum of 200.',
    sources: [
      { name: 'Art Institute of Chicago API (public-domain paintings, CC0 metadata)', url: 'https://api.artic.edu/docs/' },
      { name: 'AIC IIIF image service', url: 'https://api.artic.edu/docs/#iiif-image-api', note: 'thumbnails are used offline to extract the dominant colors and are embedded in the page' },
    ],
    dataNote: 'Dominant colors are computed offline by k-means (48\u00d748 thumbnails, RGB space) from real painting images. Movements come from the Art Institute of Chicago\u2019s style field; only clearly defined movements or traditions are used (entries giving only a century are excluded), and paintings whose year falls outside the movement\u2019s usual period are dropped (the museum labels are often loose). The year is the midpoint of the museum\u2019s date range, and only works with a range of 12 years or less are kept. The museum API allows cross-origin requests but its image service forbids hotlinking from web pages, so there is no live fetch and the data are an offline snapshot.',
  },

  puzzle({ data, rng, pick }) {
    const p = pick(data.paintings);
    return { p, options: styleOptions(data.styles, p.style, p.year, rng) };
  },

  async play(ctx, { p, options }) {
    const { ui, core } = ctx;
    ctx.log('painting', p.id, p.year, p.style);
    const bar = ui.h('div', { style: { display: 'flex', height: '110px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--rule)' } },
      p.colors.map((c, i) => ui.h('div', { title: `${c} ${Math.round(p.share[i] * 100)}%`, style: { flex: String(Math.max(p.share[i], 0.04)), background: c } })));
    const chips = ui.h('div', { class: 'ds-row small mono', style: { marginTop: '10px', gap: '12px', flexWrap: 'wrap' } },
      p.colors.map((c, i) => ui.h('span', ui.h('span', { style: { color: c, textShadow: '0 0 1px var(--ink)' } }, '■'), ` ${c} ${Math.round(p.share[i] * 100)}%`)));
    ctx.stage.append(ui.panel({ kicker: 'Five dominant colors', title: 'This painting\u2019s palette' }, bar, chips));

    const yr = await ctx.estimate({
      title: 'What year was it painted?', answer: p.year, min: YEAR_MIN, max: YEAR_MAX, step: 1, initial: 1750,
      format: (v) => String(Math.round(v)), scoring: 'abs', scale: 40,
    });
    ctx.log('year', yr.guess);
    const st = await ctx.rounds({
      rounds: [{ prompt: 'Which movement does it belong to?', options: options.map((o) => ({ label: o.name })), correct: options.findIndex((o) => o.id === p.style) }],
    });
    const res = ctx.combine([yr, { ...st, score: st.score * 100, max: 100 }]);
    const style = ctx.data.styles.find((s) => s.id === p.style);
    const ex = explain(p, ctx.data.paintings, style);
    const off = Math.round(Math.abs(yr.guess - p.year));
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('img', { src: p.thumb, alt: 'Today\u2019s painting', style: { width: '160px', maxWidth: '100%', borderRadius: '8px' } }),
      ui.kv([
        ['Painting', p.title], ['Artist', p.artist],
        ['Year', `${p.year} (you guessed ${Math.round(yr.guess)}, ${off} off)`],
        ['Movement', style.name],
        ['About the movement', style.note],
        ['This palette', ex.stats],
        ['Biggest block', `${p.colors[0]} at ${core.fmtPct ? core.fmtPct(p.share[0]) : Math.round(p.share[0] * 100) + '%'}`],
      ]),
      ui.h('div', { class: 'small muted' }, 'Thumbnail: Art Institute of Chicago, public domain.'));
    return res;
  },
};
