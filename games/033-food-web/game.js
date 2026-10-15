// #33 Food Web — six species, draw who eats whom, scored by edge F1 against GloBI records.
export const pairKey = (a, b) => `${a}>${b}`;

/** Edge-set F1 (0..1). truth/guess: arrays of 'pred>prey' keys. */
export function edgeF1(truth, guess) {
  const T = new Set(truth), G = new Set(guess);
  const tp = [...G].filter((k) => T.has(k)).length;
  if (!tp) return 0;
  const p = tp / G.size, r = tp / T.size;
  return (2 * p * r) / (p + r);
}

/**
 * Score a guess. truth = counted edges, weak = edges with a single GloBI record (neutral:
 * drawing them neither helps nor hurts). Returns { f1, hit, extra, missed, ignored }.
 */
export function gradeWeb(truth, weak, guess) {
  const T = new Set(truth), W = new Set(weak);
  const ignored = guess.filter((k) => !T.has(k) && W.has(k));
  const scored = guess.filter((k) => !ignored.includes(k));
  const hit = scored.filter((k) => T.has(k));
  return {
    f1: edgeF1(truth, scored), hit, ignored,
    extra: scored.filter((k) => !T.has(k)),
    missed: truth.filter((k) => !scored.includes(k)),
  };
}

/** Short English explanation of the web's shape, derived from the puzzle's own edges. */
export function webInsight(edges, nameOf, kindOf, species) {
  const out = new Map(), inn = new Map();
  for (const [a, b] of edges) { out.set(a, (out.get(a) || 0) + 1); inn.set(b, (inn.get(b) || 0) + 1); }
  const lines = [];
  const top = species.filter((s) => out.has(s) && !inn.has(s)).sort((x, y) => out.get(y) - out.get(x));
  if (top.length) lines.push(`Top: ${top.map((s) => `${nameOf(s)} (${kindOf(s).toLowerCase()}, eats ${out.get(s)} species)`).join(', ')}. Nothing here eats ${top.length === 1 ? 'it' : 'them'}.`);
  const base = species.filter((s) => inn.has(s) && !out.has(s)).sort((x, y) => inn.get(y) - inn.get(x));
  if (base.length) lines.push(`Bottom: ${base.map((s) => `${nameOf(s)} (eaten by ${inn.get(s)})`).join(', ')}. ${base.length === 1 ? 'It is' : 'They are'} only ever prey.`);
  const mid = species.filter((s) => out.has(s) && inn.has(s));
  if (mid.length) lines.push(`Middle: ${mid.map(nameOf).join(', ')}. ${mid.length === 1 ? 'It eats' : 'They eat'} and ${mid.length === 1 ? 'is' : 'are'} eaten.`);
  const lone = species.filter((s) => !out.has(s) && !inn.has(s));
  if (lone.length) lines.push(`No predation recorded for ${lone.map(nameOf).join(', ')}.`);
  return lines;
}

const COL = { hit: 'var(--hit)', miss: 'var(--bad)', extra: 'var(--bad)', mine: 'var(--accent)', weak: 'var(--muted)', none: 'var(--muted)' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Inline SVG food web: species on an ellipse, arrows predator -> prey. edges: [a, b, kind] */
export function webSvg(species, nameOf, edges) {
  const W = 400, H = 330, cx = W / 2, cy = H / 2 - 4, rx = 132, ry = 112;
  const pos = new Map(species.map((s, i) => { const t = (i / species.length) * 2 * Math.PI - Math.PI / 2; return [s, [cx + rx * Math.cos(t), cy + ry * Math.sin(t)]]; }));
  const kinds = [...new Set(edges.map((e) => e[2]))];
  const defs = kinds.map((k) => `<marker id="fw-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" style="fill:${COL[k]}"/></marker>`).join('');
  const lines = edges.map(([a, b, k]) => {
    const [x1, y1] = pos.get(a), [x2, y2] = pos.get(b);
    const d = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / d, uy = (y2 - y1) / d;
    // offset a little sideways so a pair drawn both ways would not overlap; trim by node radius
    const sx = x1 + ux * 15 - uy * 3, sy = y1 + uy * 15 + ux * 3, ex = x2 - ux * 19 - uy * 3, ey = y2 - uy * 19 + ux * 3;
    const dash = k === 'miss' || k === 'weak' ? ' stroke-dasharray="5 4"' : '';
    return `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" style="stroke:${COL[k]}" stroke-width="2.2"${dash} marker-end="url(#fw-${k})"/>`;
  }).join('');
  const nodes = species.map((s) => {
    const [x, y] = pos.get(s);
    const below = y > cy + 4;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" style="fill:var(--paper-2);stroke:var(--ink-2)" stroke-width="2"/>`
      + `<text x="${x.toFixed(1)}" y="${(y + (below ? 26 : -16)).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="600" style="fill:var(--ink)">${esc(nameOf(s))}</text>`;
  }).join('');
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Food web diagram" style="width:100%;max-width:440px;height:auto;display:block;margin:0 auto"><defs>${defs}</defs>${lines}${nodes}</svg>`;
  const el = document.createElement('div');
  el.innerHTML = svg;
  return el;
}

export default {
  meta: {
    num: 33,
    slug: 'food-web',
    title: 'Food Web',
    tagline: 'Six species, 15 pairs. Decide who eats whom and draw the food web, scored by edge F1.',
    category: 'science',
    data: 'snapshot',
    howTo: [
      'You get 6 species from one ecosystem, 15 pairs in all. Each species is tagged with a broad class (herbivore, fish, bird...).',
      'Tap the button beside each pair to cycle between "No link", "A eats B" and "B eats A". The diagram above draws your arrows live (each arrow points at the species being eaten).',
      'The answers come from GloBI field records of predation: a direction counts as an edge only with 2 or more records. Pairs with a single record are "uncertain": they are not scored either way.',
      'After you submit, you are scored by edge F1: missed edges, invented edges and reversed directions all pull it down.',
      'Tip: start with the top predators and the bottom of the web (plants, small prey). Two species of very different size, or from different layers of the water, usually have no link.',
    ],
    scoring: 'Score = edge F1 x 100 (F1 = 2 x precision x recall / (precision + recall)). A reversed direction counts as wrong. Drawing every pair earns roughly 20-30, drawing nothing earns 0, and a perfect web earns 100.',
    sources: [
      { name: 'GloBI — Global Biotic Interactions', url: 'https://www.globalbioticinteractions.org/', note: 'API: api.globalbioticinteractions.org/interaction, interactionType = eats / preysOn' },
    ],
    dataNote: 'GloBI collects species-interaction records from the literature and field observations. "No record" does not mean "never eats": the answer is recorded predation. Each day\'s 6 species are sampled offline from 6 ecosystems (13-14 species each); sets with a pair recorded in both directions are dropped, and pairs with just 1 record are marked "uncertain" (not scored). The broad class labels are common-knowledge groupings, not GloBI data. The GloBI API allows cross-origin requests, but results for the same query change as new data is ingested, which would give everyone a different puzzle on the same day, so this ships as a snapshot instead of loading live. The snapshot is reproducible with build/fetch.mjs and build/build.mjs.',
  },

  puzzle({ data, pick, rng }) {
    const p = pick(data.puzzles);
    return { eco: p.eco, sp: rng.shuffle(p.sp), e: p.e, w: p.w || [] };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const info = new Map(ctx.data.ecos.flatMap((e) => e.species).map((s) => [s.latin, s]));
    const name = (l) => info.get(l)?.en || l;
    const kind = (l) => info.get(l)?.kind || '';
    const truth = p.e.map(([a, b]) => pairKey(a, b));
    const weak = p.w.map(([a, b]) => pairKey(a, b));
    const pairs = [];
    for (let i = 0; i < p.sp.length; i++) for (let j = i + 1; j < p.sp.length; j++) pairs.push([p.sp[i], p.sp[j]]);
    const state = new Map(pairs.map(([a, b]) => [a + '|' + b, 0])); // 0 none, 1 a eats b, 2 b eats a
    ctx.log('puzzle', p.eco, p.sp, 'edges', truth.length, 'weak', weak.length);

    ctx.stage.append(ui.panel({ kicker: p.eco, title: 'Today\'s 6 species' },
      ui.grid(150, ...p.sp.map((l) => ui.stat({ label: kind(l), value: name(l), sub: l })))));

    const guessKeys = () => pairs.flatMap(([a, b]) => { const s = state.get(a + '|' + b); return s === 1 ? [pairKey(a, b)] : s === 2 ? [pairKey(b, a)] : []; });
    const summary = ui.h('div', { class: 'small muted' });
    const webBox = ui.h('div');
    const rows = ui.h('div', { class: 'ds-stack' });
    const refresh = () => {
      const g = guessKeys();
      summary.textContent = `${g.length} ${g.length === 1 ? 'edge' : 'edges'} drawn (of 15 pairs)`;
      webBox.replaceChildren(webSvg(p.sp, name, g.map((k) => [...k.split('>'), 'mine'])));
    };
    pairs.forEach(([a, b]) => {
      const k = a + '|' + b;
      const btn = ui.button('', { variant: 'ghost', small: true, onClick: () => { state.set(k, (state.get(k) + 1) % 3); paint(); } });
      const paint = () => {
        const s = state.get(k);
        btn.textContent = s === 0 ? 'No link' : s === 1 ? `${name(a)} eats ${name(b)} →` : `${name(b)} eats ${name(a)} ←`;
        btn.style.color = s ? 'var(--accent)' : 'var(--muted)';
        btn.setAttribute('aria-label', `${name(a)} and ${name(b)}: ${btn.textContent}`);
        refresh();
      };
      paint();
      rows.append(ui.h('div', { class: 'ds-row', style: { justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' } }, ui.h('span', { class: 'ink2' }, `${name(a)} · ${name(b)}`), btn));
    });

    const res = await new Promise((resolve) => {
      const done = () => {
        const g = guessKeys();
        const r = gradeWeb(truth, weak, g);
        ctx.log('submit', { guess: g.length, hit: r.hit.length, extra: r.extra.length, truth: truth.length, weakIgnored: r.ignored.length, f1: r.f1 });
        resolve({
          score: Math.round(r.f1 * 100), max: 100, win: r.f1 >= 0.8,
          emoji: '🕸️ ' + '🟩'.repeat(r.hit.length) + '🟥'.repeat(r.extra.length) + '⬜'.repeat(r.missed.length),
          summary: `F1 ${(r.f1 * 100).toFixed(0)}% · ${r.hit.length}/${truth.length} edges found`,
          guess: g, grade: r,
        });
      };
      ctx.stage.append(ui.panel({ kicker: 'Draw the web', title: 'Who eats whom?', aside: 'Arrows point at the one being eaten' }, webBox, rows, summary,
        ui.button('Submit web', { variant: 'accent', onClick: done })));
      if (ctx.autoplay) setTimeout(() => { state.set(pairs[0].join('|'), 1); done(); }, 50);
    });

    const r = res.grade;
    const arrow = (k) => k.split('>').map(name).join(' eats ');
    const edges = [
      ...r.hit.map((k) => [...k.split('>'), 'hit']),
      ...r.missed.map((k) => [...k.split('>'), 'miss']),
      ...r.extra.map((k) => [...k.split('>'), 'extra']),
      ...r.ignored.map((k) => [...k.split('>'), 'weak']),
    ];
    const cnt = new Map([...p.e, ...p.w].map(([a, b, n]) => [pairKey(a, b), n]));
    const rowsT = [
      ...p.e.map(([a, b, n]) => ({ who: arrow(pairKey(a, b)), n, you: r.hit.includes(pairKey(a, b)) ? '✓ Found' : '✗ Missed' })),
      ...p.w.map(([a, b, n]) => ({ who: arrow(pairKey(a, b)), n, you: r.ignored.includes(pairKey(a, b)) ? 'Uncertain · no penalty for drawing it' : 'Uncertain · not scored' })),
    ];
    const insight = webInsight(p.e, name, kind, p.sp);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `Answer: ${truth.length} predation ${truth.length === 1 ? 'link' : 'links'} recorded in GloBI (green = you found it, red dashed = you missed it, red solid = you drew extra, gray dashed = uncertain):`),
      webSvg(p.sp, name, edges),
      ui.table({
        columns: [{ key: 'who', label: 'Predation' }, { key: 'n', label: 'Records', num: true }, { key: 'you', label: 'You' }],
        rows: rowsT,
      }),
      r.extra.length
        ? ui.callout('Extra or reversed edges: ' + r.extra.map((k) => cnt.has(k.split('>').reverse().join('>')) ? `${arrow(k)} (wrong way; the records say ${arrow(k.split('>').reverse().join('>'))})` : `${arrow(k)} (no record)`).join('; '), 'warn')
        : ui.callout('No extra edges.', 'good'),
      ui.h('div', { class: 'small muted' }, ['Shape of this web:', ...insight].join(' ')),
      ui.h('div', { class: 'small muted' }, '"No record" does not prove it never happens in nature; edges with many records are usually a species\' main food.'));
    return res;
  },
};
