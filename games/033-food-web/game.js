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

export default {
  meta: {
    num: 33,
    slug: 'food-web',
    title: 'Food Web',
    tagline: '六个物种，两两判断谁吃谁，画出食物网，按边的 F1 分数计分。',
    category: 'science',
    data: 'snapshot',
    howTo: [
      '今天给你同一片生态系统里的 6 个物种，共 15 对组合。',
      '点每一对右侧的按钮：在「无捕食关系」「左吃右」「右吃左」之间切换。',
      '答案来自 GloBI 里真实的野外捕食记录：有记录就算一条边。提交后按 F1 计分，既不能漏边，也不能乱画。',
      '提示：先找最顶端的捕食者和最底端的植物/小型猎物；体型差距悬殊的两种往往没有关系。',
    ],
    scoring: '边的 F1 × 100：F1 = 2·精确率·召回率 / (精确率 + 召回率)。方向画反算错。',
    sources: [
      { name: 'GloBI — Global Biotic Interactions', url: 'https://www.globalbioticinteractions.org/', note: 'API: api.globalbioticinteractions.org/interaction，interactionType = eats / preysOn' },
    ],
    dataNote: 'GloBI 汇集了文献和野外观测中的物种互作记录。没有记录不等于一定不吃：答案是「被记录到的捕食」。每天的 6 个物种是从 6 个生态系统（各 13-14 种）里离线抽样、并剔除了记录方向矛盾的组合。每条边附带 GloBI 记录条数。',
  },

  puzzle({ data, pick, rng }) {
    const p = pick(data.puzzles);
    return { eco: p.eco, sp: rng.shuffle(p.sp), e: p.e };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const info = new Map(ctx.data.ecos.flatMap((e) => e.species).map((s) => [s.latin, s]));
    const name = (l) => info.get(l)?.zh || l;
    const truth = p.e.map(([a, b]) => pairKey(a, b));
    const pairs = [];
    for (let i = 0; i < p.sp.length; i++) for (let j = i + 1; j < p.sp.length; j++) pairs.push([p.sp[i], p.sp[j]]);
    const state = new Map(pairs.map(([a, b]) => [a + '|' + b, 0])); // 0 none, 1 a eats b, 2 b eats a
    ctx.log('puzzle', p.eco, p.sp, 'edges', truth.length);

    ctx.stage.append(ui.panel({ kicker: p.eco, title: '今天的 6 个物种' },
      ui.grid(150, ...p.sp.map((l) => ui.stat({ label: info.get(l).en, value: name(l), sub: l })))));

    const summary = ui.h('div', { class: 'small muted' });
    const rows = ui.h('div', { class: 'ds-stack' });
    const guessKeys = () => pairs.flatMap(([a, b]) => { const s = state.get(a + '|' + b); return s === 1 ? [pairKey(a, b)] : s === 2 ? [pairKey(b, a)] : []; });
    const refresh = () => { summary.textContent = `已画 ${guessKeys().length} 条边（共 15 对组合）`; };
    const btns = pairs.map(([a, b]) => {
      const k = a + '|' + b;
      const btn = ui.button('', { variant: 'ghost', small: true, onClick: () => { state.set(k, (state.get(k) + 1) % 3); paint(); } });
      const paint = () => {
        const s = state.get(k);
        btn.textContent = s === 0 ? '无关系' : s === 1 ? `${name(a)} 吃 ${name(b)} →` : `← ${name(b)} 吃 ${name(a)}`;
        btn.style.color = s ? 'var(--accent)' : 'var(--muted)';
        refresh();
      };
      paint();
      rows.append(ui.h('div', { class: 'ds-row', style: { justifyContent: 'space-between', gap: '8px' } }, ui.h('span', { class: 'ink2' }, `${name(a)} · ${name(b)}`), btn));
      return btn;
    });

    const res = await new Promise((resolve) => {
      const done = () => {
        const g = guessKeys();
        const f1 = edgeF1(truth, g);
        const hit = g.filter((k) => truth.includes(k)).length;
        ctx.log('submit', { guess: g.length, hit, truth: truth.length, f1 });
        resolve({
          score: Math.round(f1 * 100), max: 100, win: f1 >= 0.8,
          emoji: '🕸️ ' + '🟩'.repeat(hit) + '🟥'.repeat(g.length - hit) + '⬜'.repeat(truth.length - hit),
          summary: `F1 ${(f1 * 100).toFixed(0)}% · 命中 ${hit}/${truth.length}`,
          guess: g, hit,
        });
      };
      ctx.stage.append(ui.panel({ kicker: '画食物网', title: '谁吃谁？' }, rows, summary,
        ui.button('提交食物网', { variant: 'accent', onClick: done })));
      if (ctx.autoplay) setTimeout(() => { state.set(pairs[0].join('|'), 1); done(); }, 50);
    });

    const g = new Set(res.guess);
    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('div', { class: 'ink2' }, `GloBI 记录到的 ${truth.length} 条捕食关系（右列为你的结果）：`),
      ui.table({
        columns: [{ key: 'who', label: '捕食关系' }, { key: 'n', label: '记录数', num: true }, { key: 'you', label: '你' }],
        rows: p.e.map(([a, b, n]) => ({ who: `${name(a)} 吃 ${name(b)}`, n, you: g.has(pairKey(a, b)) ? '✓ 命中' : '✗ 漏了' })),
      }),
      res.guess.some((k) => !truth.includes(k))
        ? ui.callout('多画的边：' + res.guess.filter((k) => !truth.includes(k)).map((k) => k.split('>').map(name).join(' 吃 ')).join('；'), 'warn')
        : ui.callout('没有多画的边。', 'good'),
      ui.h('div', { class: 'small muted' }, '线索：捕食者通常比猎物大；记录数多的边多半是该物种的主要食物。'));
    return res;
  },
};
