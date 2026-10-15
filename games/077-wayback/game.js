// #77 Wayback — an archived homepage with its brand scrubbed out. Name the site, then the year.

/** Human-readable notes on what the page's markup says about its era. Pure; unit-tested. */
export function eraNotes(fp) {
  const n = [];
  if (fp.frames) n.push('Uses <frameset> frames: common before 2005');
  if (fp.marquee) n.push('Has <marquee>/<blink> animation tags: common before 2004');
  if (fp.fonts >= 5) n.push(`${fp.fonts} <font> tags: styling still lives in the HTML and CSS is not yet widespread (mostly before 2010)`);
  if (fp.tables >= 8) n.push(`${fp.tables} <table> tags: layout done with tables (mostly before 2012)`);
  if (fp.flash) n.push('Embeds Flash: roughly 1999\u20132012');
  if (fp.fw.includes('jquery')) n.push('Loads jQuery: roughly after 2007');
  if (fp.fw.includes('bootstrap')) n.push('Loads Bootstrap: roughly after 2012');
  if (fp.fw.some((f) => ['react', 'angular', 'webpack', '__next'].includes(f))) n.push('Shows a modern front-end framework or bundler: roughly after 2015');
  if (fp.viewport) n.push('Has a viewport meta tag, built for phones: after 2010');
  else if (!fp.html5 && fp.css === 0) n.push('No viewport tag and no external stylesheet');
  if (fp.og) n.push('Has Open Graph meta tags: after 2010');
  if (fp.https > 5) n.push('Many https:// links on the page: more common after 2014');
  if (!n.length) n.push('No particularly telling technical markers');
  return n;
}

const SHOT_STYLE = { width: '100%', maxHeight: '340px', objectFit: 'cover', objectPosition: 'top', display: 'block', border: '1px solid var(--rule)', borderRadius: '6px', background: '#fff', cursor: 'zoom-in' };

export const tld = (dom) => dom.slice(dom.indexOf('.'));

/** Year window (inclusive) that the markup alone allows, from the same rules as eraNotes. Pure; unit-tested. */
export function eraRange(fp) {
  let lo = 1995, hi = 2025;
  const up = (y) => { lo = Math.max(lo, y); }, down = (y) => { hi = Math.min(hi, y); };
  if (fp.frames) down(2005);
  if (fp.marquee) down(2004);
  if (fp.fonts >= 5) down(2010);
  if (fp.tables >= 8) down(2012);
  if (fp.fw.includes('jquery')) up(2007);
  if (fp.fw.includes('bootstrap')) up(2012);
  if (fp.fw.some((f) => ['react', 'angular', 'webpack', '__next'].includes(f))) up(2015);
  if (fp.viewport) up(2010);
  if (fp.og) up(2010);
  if (lo > hi) hi = lo;
  return [lo, hi];
}

/** Score for the year round (0..100): perfect = 100, 2 years off ≈ 61, 10 years off ≈ 8. */
export const yearScore = (guess, answer) => Math.exp(-Math.abs(Math.round(guess) - answer) / 4);

export default {
  meta: {
    num: 77,
    slug: 'wayback',
    title: 'Wayback',
    tagline: 'A homepage from the Internet Archive with the brand and images scrubbed out. Name the site, then the year.',
    category: 'tech',
    data: 'snapshot',
    howTo: [
      'You see a well-known site\'s homepage as archived by the Wayback Machine: images become gray blocks, and the site name, domain and year numbers are blacked out as \u2587\u2587\u2587.',
      'First guess the site from the list, up to 5 times. Every miss unlocks a clue: title text and description, technical fingerprint, domain suffix, first letter of the domain.',
      'Then use the layout and technical fingerprint (table layout, Flash, jQuery, viewport\u2026) to estimate which year the snapshot was taken.',
      'Scoring: up to 100 for the site (the earlier the better); the year scores about 61 when 2 years off, 29 when 5 off and 8 when 10 off. Maximum 200.',
    ],
    scoring: 'Site: 100 \u00b7 (6 \u2212 guesses used) / 5. Year: 100 \u00b7 exp(\u2212years off / 4). The two add up to a maximum of 200.',
    sources: [
      { name: 'Internet Archive Wayback Machine CDX API', url: 'https://web.archive.org/cdx/search/cdx?url=mit.edu&limit=1', note: 'For each (site, year), the first HTML capture with status 200 after June of that year' },
      { name: 'Wayback raw snapshots (id_ mode)', url: 'https://web.archive.org/web/20070601033900id_/http://www.mit.edu/', note: 'Raw HTML downloaded at build time, then redacted offline and rendered into wireframe screenshots' },
    ],
    dataNote: 'Browsers cannot render third-party archives live, so at build time (build/shoot.mjs) each capture is rendered in headless Chrome: scripts removed, images replaced by gray blocks, and every site name, domain and year number blacked out, giving a wireframe screenshot. The title, navigation, section text and technical fingerprint are extracted too. This is snapshot data: the Internet Archive\'s CDX and snapshot endpoints send no CORS headers, so browsers cannot read them live. Only odd years (1997\u20132023) are used, and some sites have no early captures. Site blurbs are hand-written. Link texts in non-Latin scripts (such as Wikipedia\'s language links) are left out.',
  },

  puzzle({ data, pick }) {
    const s = pick(data.snaps);
    return { id: s.id, y: s.y, ts: s.ts };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const snap = ctx.data.snaps.find((s) => s.id === p.id && s.y === p.y);
    const site = ctx.data.sites.find((s) => s.id === p.id);
    ctx.log('puzzle', p.id, p.y);

    const shot = snap.img ? ui.h('img', {
      src: ctx.asset(snap.img), alt: 'Wireframe screenshot of the redacted archived homepage', loading: 'eager',
      style: SHOT_STYLE,
      onClick: () => ui.modal({ title: 'Archived page (redacted)', body: ui.h('img', { src: ctx.asset(snap.img), alt: '', style: { width: '100%', height: 'auto', background: '#fff' } }) }),
    }) : null;

    const page = ui.h('div', { class: 'ds-stack' },
      shot,
      ui.h('div', { class: 'mono small muted' }, '<title>'),
      ui.h('div', { style: { fontWeight: '600' } }, snap.title || '(no title)'),
      ui.h('div', { class: 'mono small muted', style: { marginTop: '6px' } }, `Navigation and link text (${snap.links.length})`),
      ui.chips(snap.links.slice(0, 24)));

    const fpNode = (fp) => ui.kv([
      ['HTML size', `${fp.kb} KB`], ['<table> / <font> / <img>', `${fp.tables} / ${fp.fonts} / ${fp.imgs}`],
      ['<script> / stylesheets', `${fp.scripts} / ${fp.css}`], ['Flash / framesets', `${fp.flash} / ${fp.frames}`],
      ['viewport / HTML5', `${fp.viewport ? 'yes' : 'no'} / ${fp.html5 ? 'yes' : 'no'}`], ['Front-end libraries', fp.fw.join(', ') || 'none'],
    ]);

    const clues = [
      page,
      snap.heads.length || snap.desc
        ? ui.h('div', { class: 'ds-stack' }, snap.desc && ui.quote(snap.desc), snap.heads.length ? ui.h('ul', { style: { margin: 0, paddingLeft: '1.2em' } }, snap.heads.map((t) => ui.h('li', t))) : null)
        : 'This page has almost no heading text or description, so you only have the navigation links.',
      ui.h('div', 'Technical fingerprint of the page:', fpNode(snap.fp)),
      `The domain suffix is \u201c${tld(site.dom)}\u201d.`,
      `The domain (without www) starts with \u201c${site.dom[0].toUpperCase()}\u201d.`,
    ];

    const options = ctx.data.sites.map((s) => ({ id: s.id, label: s.name, hint: s.dom, aliases: [s.dom, s.dom.split('.')[0]] }));
    const byId = new Map(ctx.data.sites.map((s) => [s.id, s]));
    const r1 = await ctx.guess({
      options, answer: p.id, maxGuesses: 5, title: 'Which site is this?', placeholder: 'Type a site name or domain\u2026',
      clues, cluesTitle: 'Archive contents', columns: ['Suffix'],
      near: (g) => tld(byId.get(g.id).dom) === tld(site.dom),
      feedback: (g) => [{ text: tld(byId.get(g.id).dom), state: tld(byId.get(g.id).dom) === tld(site.dom) ? 'near' : undefined }],
      onGuess: (o, { correct, n }) => ctx.log('guess', o.id, correct, n),
    });

    ctx.stage.append(ui.panel({ kicker: 'Step two', title: 'Which year is this capture from?' },
      ui.h('div', { class: 'ds-stack' }, shot && ui.h('img', { src: ctx.asset(snap.img), alt: 'Wireframe screenshot of the redacted archived homepage', style: SHOT_STYLE }),
        ui.h('div', { class: 'ink2' }, 'Look at the layout and the technical fingerprint:'), fpNode(snap.fp))));
    const r2 = await ctx.estimate({
      answer: p.y, min: 1996, max: 2025, step: 1, initial: 2010, title: 'Capture year',
      format: (v) => `${Math.round(v)}`,
      scoring: yearScore,
    });
    ctx.log('year', p.y, r2.guess);

    const res = ctx.combine([r1, r2]);
    const [lo, hi] = eraRange(snap.fp);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.kv([['Site', `${site.name} (${site.dom})`], ['About', site.about || '\u2014'], ['Captured', `${snap.ts.slice(0, 4)}-${snap.ts.slice(4, 6)}-${snap.ts.slice(6, 8)}`],
        ['Era per markup', `${lo}\u2013${hi}`], ['Your year', r2.guess != null ? `${Math.round(r2.guess)}` : '\u2014']]),
      ui.h('div', { class: 'ink2' }, `Era clues on this page (actual year ${p.y}):`),
      ui.h('ul', { style: { margin: 0, paddingLeft: '1.2em' } }, eraNotes(snap.fp).map((t) => ui.h('li', t))),
      ui.h('a', { href: snap.url, target: '_blank', rel: 'noopener' }, 'Open the original capture on the Wayback Machine \u2192'));
    return res;
  },
};
