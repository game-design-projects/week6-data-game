// #57 Popular Move — a chess position; guess the move 1500-rated players play most, then the move 2500-rated players play most.

const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const PIECE_ZH = { K: '王', Q: '后', R: '车', B: '象', N: '马' };

/** FEN placement -> 8 rows of 8 chars ('' for empty). Row 0 = rank 8. */
export function parseFen(fen) {
  return fen.split(' ')[0].split('/').map((row) => {
    const out = [];
    for (const ch of row) /\d/.test(ch) ? out.push(...Array(Number(ch)).fill('')) : out.push(ch);
    return out;
  });
}

/** Short Chinese description of a SAN move, e.g. "Nf3" -> "马 → f3". */
export function describe(san) {
  if (san.startsWith('O-O-O')) return '长易位';
  if (san.startsWith('O-O')) return '短易位';
  const sq = san.match(/[a-h][1-8](?!.*[a-h][1-8])/)?.[0] ?? '';
  const piece = PIECE_ZH[san[0]] ?? '兵';
  return `${piece}${san.includes('x') ? ' 吃 ' : ' → '}${sq}`;
}

export const pct = (n, total) => (total ? (100 * n) / total : 0);
export const topMove = (opts, band) => opts.reduce((a, b) => (b[band] > a[band] ? b : a)).san;

export default {
  meta: {
    num: 57,
    slug: 'popular-move',
    title: 'Popular Move',
    tagline: '同一个棋局，1500 分的人和 2500 分的人最常走的一步，往往不一样。你能分辨吗？',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      '每天 3 个真实对局中出现过的开局局面（棋盘下方是走子方）。',
      '每个局面问两次：1500 分段的玩家最常走哪一步？2500 分段的玩家最常走哪一步？选项都是真实走过的着法。',
      '问的是“最常走”，不是“最好”。高手常走的并不总是你以为的那步，业余玩家也有自己的偏好。',
      '着法用代数记谱：N=马 B=象 R=车 Q=后 K=王，无字母为兵，x=吃子，O-O=短易位。每答对一问得 1 分。',
    ],
    scoring: '共 6 问，答对一问 1 分，满分 6 分。',
    sources: [
      { name: 'Lichess open database（1500 分段：2013-01 标准对局）', url: 'https://database.lichess.org/' },
      { name: 'Lichess Elite Database（2500 分段：2020-06）', url: 'https://database.nikonoel.fr/' },
      { name: 'lichess-org/chess-openings（开局名称）', url: 'https://github.com/lichess-org/chess-openings' },
    ],
    dataNote: 'Lichess 开局浏览器 API 现在需要登录令牌，所以改为自己用官方公开对局库统计：对局库按“局面 + 下一步”计数，局面相同（含着法顺序不同）合并。“1500 分段”= 双方评分 1350–1650 的对局；“2500 分段”= Elite 库中双方 ≥ 2400 的对局（该库的收录门槛）。只出现过样本足够多、且两个分段各自第一名领先第二名至少 6 个百分点的局面。',
  },

  puzzle({ data, rng }) {
    const picks = rng.sample(data.puzzles, 3);
    return { items: picks.map((p) => ({ ...p, opts: rng.shuffle(p.opts) })) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const { low, high } = ctx.data;
    const bands = [['low', low.label], ['high', high.label]];

    const board = (fen, turn) => {
      const rows = parseFen(fen);
      const flip = turn === 'b';
      const sq = [];
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const rr = flip ? 7 - r : r, cc = flip ? 7 - c : c;
        const ch = rows[rr][cc];
        const white = ch && ch === ch.toUpperCase();
        sq.push(ui.h('div', {
          style: {
            aspectRatio: '1', display: 'grid', placeItems: 'center', lineHeight: '1',
            background: (rr + cc) % 2 ? 'var(--rule)' : 'var(--paper2)',
            fontSize: 'min(8.4vw, 34px)',
            color: white ? '#fff' : '#111',
            textShadow: white ? '0 0 2px #000, 0 0 1px #000, 0 1px 1px #000' : '0 0 2px #fff, 0 0 1px #fff, 0 0 1px #fff',
          },
        }, ch ? GLYPH[ch.toLowerCase()] : ''));
      }
      return ui.h('div', { style: { width: 'min(100%, 320px)', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', border: '2px solid var(--ink2)', borderRadius: '4px', overflow: 'hidden' } }, sq);
    };

    const rounds = [];
    p.items.forEach((it, i) => {
      const side = it.turn === 'w' ? '白方' : '黑方';
      const label = it.opening ? `${it.opening.eco} ${it.opening.name}` : '';
      const body = ui.h('div', { class: 'ds-stack' },
        board(it.fen, it.turn),
        ui.h('div', { class: 'small muted', style: { textAlign: 'center' } }, `局面 ${i + 1}/3 · 轮到${side}走（${side}在下方）`));
      for (const [band, bandLabel] of bands) {
        const top = topMove(it.opts, band);
        const n = band === 'low' ? it.nLow : it.nHigh;
        rounds.push({
          prompt: `${bandLabel}的玩家在这里最常走哪一步？`,
          body,
          options: it.opts.map((o) => ({ label: o.san, sub: describe(o.san) })),
          correct: it.opts.findIndex((o) => o.san === top),
          explain: `${bandLabel}（${n} 局）：${it.opts.slice().sort((a, b) => b[band] - a[band]).map((o) => `${o.san} ${pct(o[band], n).toFixed(0)}%`).join(' · ')}`,
        });
      }
      ctx.log(`position ${i + 1}`, it.fen, 'low top', topMove(it.opts, 'low'), 'high top', topMove(it.opts, 'high'), label);
    });

    const res = await ctx.rounds({ rounds, title: '猜最常走的一步' });

    const sections = p.items.map((it, i) => {
      const side = it.turn === 'w' ? '白方' : '黑方';
      const lt = topMove(it.opts, 'low'), ht = topMove(it.opts, 'high');
      const verdict = lt === ht
        ? `两个分段都最常走 ${lt}：这步在各个水平都是共识。`
        : `分歧：1500 分段偏爱 ${lt}，2500 分段偏爱 ${ht}。`;
      return ui.h('div', { class: 'ds-stack' },
        ui.h('div', { class: 'ink2' }, `局面 ${i + 1}${it.opening ? `：${it.opening.eco} ${it.opening.name}` : ''}（${side}走）`),
        ui.table({
          columns: [{ key: 'san', label: '着法' }, { key: 'l', label: '1500 分段', num: true }, { key: 'h', label: '2500 分段', num: true }],
          rows: it.opts.map((o) => ({ san: o.san, l: `${pct(o.low, it.nLow).toFixed(1)}%`, h: `${pct(o.high, it.nHigh).toFixed(1)}%` })),
        }),
        ui.h('div', { class: 'small muted' }, `${verdict}（样本 ${it.nLow} / ${it.nHigh} 局）`));
    });
    res.detail = ui.h('div', { class: 'ds-stack' }, ...sections);
    return res;
  },
};
