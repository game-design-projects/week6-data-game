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

/** Short Chinese explanation of the web's shape, derived from the puzzle's own edges. */
export function webInsight(edges, nameOf, kindOf, species) {
  const out = new Map(), inn = new Map();
  for (const [a, b] of edges) { out.set(a, (out.get(a) || 0) + 1); inn.set(b, (inn.get(b) || 0) + 1); }
  const lines = [];
  const top = species.filter((s) => out.has(s) && !inn.has(s)).sort((x, y) => out.get(y) - out.get(x));
  if (top.length) lines.push(`顶端：${top.map((s) => `${nameOf(s)}（${kindOf(s)}，吃 ${out.get(s)} 种）`).join('、')}，题里没有谁吃它。`);
  const base = species.filter((s) => inn.has(s) && !out.has(s)).sort((x, y) => inn.get(y) - inn.get(x));
  if (base.length) lines.push(`底端：${base.map((s) => `${nameOf(s)}（被 ${inn.get(s)} 种吃）`).join('、')}，它们只当猎物。`);
  const mid = species.filter((s) => out.has(s) && inn.has(s));
  if (mid.length) lines.push(`中层：${mid.map(nameOf).join('、')}，既吃别人也被吃。`);
  const lone = species.filter((s) => !out.has(s) && !inn.has(s));
  if (lone.length) lines.push(`没有记录到任何捕食：${lone.map(nameOf).join('、')}。`);
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
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="食物网示意图" style="width:100%;max-width:440px;height:auto;display:block;margin:0 auto"><defs>${defs}</defs>${lines}${nodes}</svg>`;
  const el = document.createElement('div');
  el.innerHTML = svg;
  return el;
}

export default {
  meta: {
    num: 33,
    slug: 'food-web',
    title: 'Food Web',
    tagline: '六个物种、15 对组合，判断谁吃谁，画出食物网，按边的 F1 计分。',
    category: 'science',
    data: 'snapshot',
    howTo: [
      '今天给你同一片生态系统里的 6 个物种，共 15 对组合，每个物种标有大类（食草兽、鱼类、鸟类……）。',
      '点每一对右侧的按钮，在「无关系」「A 吃 B」「B 吃 A」之间切换；上方的示意图会随你的选择实时画出箭头（箭头指向被吃的一方）。',
      '答案来自 GloBI 的野外捕食记录：同一方向有 2 条及以上记录才算一条边。只有 1 条记录的「存疑」组合不计分，画了也不扣分。',
      '提交后按边的 F1 计分：漏边、乱画边、画反方向都会拉低分数。',
      '提示：先找顶端捕食者和只当猎物的底端（植物、小型猎物）；体型悬殊或生活在不同水层的两种，多半没有关系。',
    ],
    scoring: '得分 = 边的 F1 × 100（F1 = 2·精确率·召回率 / (精确率 + 召回率)）。方向画反算错；全画满约 20-30 分，不画得 0 分，全对 100 分。',
    sources: [
      { name: 'GloBI — Global Biotic Interactions', url: 'https://www.globalbioticinteractions.org/', note: 'API: api.globalbioticinteractions.org/interaction，interactionType = eats / preysOn' },
    ],
    dataNote: 'GloBI 汇集了文献和野外观测中的物种互作记录。「没有记录」不等于「一定不吃」：答案是「被记录到的捕食」。每天的 6 个物种是从 6 个生态系统（各 13-14 种）里离线抽样的，剔除了两个方向都有记录的组合，并把只有 1 条记录的组合设为「存疑」（不计分）。物种大类标签是常识性分类，不是 GloBI 数据。GloBI 接口虽然支持跨域，但同一查询的结果会随新数据入库而变化，会让每个人当天拿到的题目不一致，所以保留快照，不在浏览器里实时拉取；快照由 build/fetch.mjs 与 build/build.mjs 复现。',
  },

  puzzle({ data, pick, rng }) {
    const p = pick(data.puzzles);
    return { eco: p.eco, sp: rng.shuffle(p.sp), e: p.e, w: p.w || [] };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const info = new Map(ctx.data.ecos.flatMap((e) => e.species).map((s) => [s.latin, s]));
    const name = (l) => info.get(l)?.zh || l;
    const kind = (l) => info.get(l)?.kind || '';
    const truth = p.e.map(([a, b]) => pairKey(a, b));
    const weak = p.w.map(([a, b]) => pairKey(a, b));
    const pairs = [];
    for (let i = 0; i < p.sp.length; i++) for (let j = i + 1; j < p.sp.length; j++) pairs.push([p.sp[i], p.sp[j]]);
    const state = new Map(pairs.map(([a, b]) => [a + '|' + b, 0])); // 0 none, 1 a eats b, 2 b eats a
    ctx.log('puzzle', p.eco, p.sp, 'edges', truth.length, 'weak', weak.length);

    ctx.stage.append(ui.panel({ kicker: p.eco, title: '今天的 6 个物种' },
      ui.grid(150, ...p.sp.map((l) => ui.stat({ label: info.get(l).en, value: name(l), sub: `${kind(l)} · ${l}` })))));

    const guessKeys = () => pairs.flatMap(([a, b]) => { const s = state.get(a + '|' + b); return s === 1 ? [pairKey(a, b)] : s === 2 ? [pairKey(b, a)] : []; });
    const summary = ui.h('div', { class: 'small muted' });
    const webBox = ui.h('div');
    const rows = ui.h('div', { class: 'ds-stack' });
    const refresh = () => {
      const g = guessKeys();
      summary.textContent = `已画 ${g.length} 条边（共 15 对组合）`;
      webBox.replaceChildren(webSvg(p.sp, name, g.map((k) => [...k.split('>'), 'mine'])));
    };
    pairs.forEach(([a, b]) => {
      const k = a + '|' + b;
      const btn = ui.button('', { variant: 'ghost', small: true, onClick: () => { state.set(k, (state.get(k) + 1) % 3); paint(); } });
      const paint = () => {
        const s = state.get(k);
        btn.textContent = s === 0 ? '无关系' : s === 1 ? `${name(a)} 吃 ${name(b)} →` : `${name(b)} 吃 ${name(a)} ←`;
        btn.style.color = s ? 'var(--accent)' : 'var(--muted)';
        btn.setAttribute('aria-label', `${name(a)} 与 ${name(b)}：${btn.textContent}`);
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
          summary: `F1 ${(r.f1 * 100).toFixed(0)}% · 命中 ${r.hit.length}/${truth.length}`,
          guess: g, grade: r,
        });
      };
      ctx.stage.append(ui.panel({ kicker: '画食物网', title: '谁吃谁？', aside: '箭头指向被吃的一方' }, webBox, rows, summary,
        ui.button('提交食物网', { variant: 'accent', onClick: done })));
      if (ctx.autoplay) setTimeout(() => { state.set(pairs[0].join('|'), 1); done(); }, 50);
    });

    const r = res.grade;
    const arrow = (k) => k.split('>').map(name).join(' 吃 ');
    const edges = [
      ...r.hit.map((k) => [...k.split('>'), 'hit']),
      ...r.missed.map((k) => [...k.split('>'), 'miss']),
      ...r.extra.map((k) => [...k.split('>'), 'extra']),
      ...r.ignored.map((k) => [...k.split('>'), 'weak']),
    ];
    const cnt = new Map([...p.e, ...p.w].map(([a, b, n]) => [pairKey(a, b), n]));
    const rowsT = [
      ...p.e.map(([a, b, n]) => ({ who: arrow(pairKey(a, b)), n, you: r.hit.includes(pairKey(a, b)) ? '✓ 命中' : '✗ 漏了' })),
      ...p.w.map(([a, b, n]) => ({ who: arrow(pairKey(a, b)), n, you: r.ignored.includes(pairKey(a, b)) ? '存疑 · 画了不扣分' : '存疑 · 不计分' })),
    ];
    const insight = webInsight(p.e, name, kind, p.sp);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `答案：GloBI 记录到的 ${truth.length} 条捕食关系（绿＝你命中，红虚线＝你漏了，红实线＝你多画的，灰虚线＝存疑）：`),
      webSvg(p.sp, name, edges),
      ui.table({
        columns: [{ key: 'who', label: '捕食关系' }, { key: 'n', label: '记录数', num: true }, { key: 'you', label: '你' }],
        rows: rowsT,
      }),
      r.extra.length
        ? ui.callout('多画或画反的边：' + r.extra.map((k) => cnt.has(k.split('>').reverse().join('>')) ? `${arrow(k)}（方向反了，记录里是${arrow(k.split('>').reverse().join('>'))}）` : `${arrow(k)}（没有记录）`).join('；'), 'warn')
        : ui.callout('没有多画的边。', 'good'),
      ui.h('div', { class: 'small muted' }, ['这张网的规律：', ...insight].join(' ')),
      ui.h('div', { class: 'small muted' }, '「没有记录」不代表自然界里一定没有发生；记录数多的边多半是该物种的主要食物。'));
    return res;
  },
};
