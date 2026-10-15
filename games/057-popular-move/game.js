// #57 Popular Move — a chess position; guess the move 1500-rated players play most, then the move 2500+ players play most.

const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const PIECE_NAME = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight' };
const N_POS = 4; // positions per day; each is asked twice (once per rating band)

/** FEN placement -> 8 rows of 8 chars ('' for empty). Row 0 = rank 8. */
export function parseFen(fen) {
  return fen.split(' ')[0].split('/').map((row) => {
    const out = [];
    for (const ch of row) /\d/.test(ch) ? out.push(...Array(Number(ch)).fill('')) : out.push(ch);
    return out;
  });
}

/** Short description of a SAN move, e.g. "Nf3" -> "Knight \u2192 f3". */
export function describe(san) {
  if (san.startsWith('O-O-O')) return 'Castles long';
  if (san.startsWith('O-O')) return 'Castles short';
  const sq = san.match(/[a-h][1-8](?!.*[a-h][1-8])/)?.[0] ?? '';
  const piece = PIECE_NAME[san[0]] ?? 'Pawn';
  return `${piece}${san.includes('x') ? ' takes ' : ' \u2192 '}${sq}`;
}

export const pct = (n, total) => (total ? (100 * n) / total : 0);
export const topMove = (opts, band) => opts.reduce((a, b) => (b[band] > a[band] ? b : a)).san;
const nOf = (it, band) => (band === 'low' ? it.nLow : it.nHigh);
const share = (it, o, band) => pct(o[band], nOf(it, band));

/** Board as an SVG string, mover at the bottom. arrows: [{from,to,color}] in algebraic squares. Pure. */
export function boardSvg(fen, turn, arrows = []) {
  const rows = parseFen(fen), flip = turn === 'b', S = 10;
  const xy = (sq) => {
    const f = sq.charCodeAt(0) - 97, r = 8 - Number(sq[1]);
    return [((flip ? 7 - f : f) + 0.5) * S, ((flip ? 7 - r : r) + 0.5) * S];
  };
  let g = '';
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const rr = flip ? 7 - r : r, cc = flip ? 7 - c : c;
    const dark = (rr + cc) % 2 === 1;
    g += `<rect x="${c * S}" y="${r * S}" width="${S}" height="${S}" fill="${dark ? '#a98b6a' : '#eadfc4'}"/>`;
    const lab = dark ? '#eadfc4' : '#a98b6a';
    if (c === 0) g += `<text x="0.6" y="${r * S + 2.6}" font-size="2.4" fill="${lab}" font-family="sans-serif">${8 - rr}</text>`;
    if (r === 7) g += `<text x="${c * S + S - 0.6}" y="${r * S + S - 0.8}" font-size="2.4" text-anchor="end" fill="${lab}" font-family="sans-serif">${'abcdefgh'[cc]}</text>`;
  }
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const rr = flip ? 7 - r : r, cc = flip ? 7 - c : c, ch = rows[rr][cc];
    if (!ch) continue;
    const white = ch === ch.toUpperCase();
    g += `<text x="${c * S + S / 2}" y="${r * S + S / 2 + 0.4}" font-size="8.4" text-anchor="middle" dominant-baseline="central" font-family="'Apple Symbols','Segoe UI Symbol','DejaVu Sans','Noto Sans Symbols 2',sans-serif" fill="${white ? '#fff' : '#1b1b1b'}" stroke="${white ? '#1b1b1b' : '#f4ecd8'}" stroke-width="${white ? 0.55 : 0.35}" paint-order="stroke">${GLYPH[ch.toLowerCase()]}︎</text>`;
  }
  for (const a of arrows) {
    const [x1, y1] = xy(a.from), [x2, y2] = xy(a.to);
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, head = 3.2;
    const bx = x2 - ux * head, by = y2 - uy * head;
    g += `<g opacity="0.88" fill="${a.color}" stroke="${a.color}"><line x1="${x1}" y1="${y1}" x2="${bx}" y2="${by}" stroke-width="1.5" stroke-linecap="round"/>`
      + `<polygon stroke="none" points="${x2},${y2} ${bx - uy * 1.9},${by + ux * 1.9} ${bx + uy * 1.9},${by - ux * 1.9}"/></g>`;
  }
  return `<svg viewBox="0 0 80 80" role="img" aria-label="Chess position" style="display:block;width:100%;height:auto">${g}</svg>`;
}

/** The puzzle-specific teaching sentence for one position. Pure. */
export function insight(it) {
  const o = (san) => it.opts.find((x) => x.san === san);
  const lt = topMove(it.opts, 'low'), ht = topMove(it.opts, 'high');
  const f = (n) => `${n.toFixed(0)}%`;
  if (lt === ht) {
    return `Both bands play ${lt} most often (${f(share(it, o(lt), 'low'))} at 1500, ${f(share(it, o(lt), 'high'))} at 2500+): this move is a consensus at every level, so the answer is in the position itself.`;
  }
  const hiOfLt = share(it, o(lt), 'high'), loOfHt = share(it, o(ht), 'low');
  const conc = share(it, o(ht), 'high') > share(it, o(lt), 'low') ? 'strong players are more concentrated on this move' : 'strong players spread their choices more';
  return `1500-rated players favor ${lt} (${f(share(it, o(lt), 'low'))}); at 2500+ it drops to ${f(hiOfLt)} and ${ht} becomes the top choice (${f(share(it, o(ht), 'high'))}, versus only ${f(loOfHt)} at 1500). Also, ${conc}.`;
}

export default {
  meta: {
    num: 57,
    slug: 'popular-move',
    title: 'Popular Move',
    tagline: 'In the same chess position, the move 1500-rated players play most often is often not the one 2500+ players play most. Can you tell them apart?',
    category: 'culture',
    data: 'snapshot',
    howTo: [
      `Each day brings ${N_POS} positions from real games, with the side to move always at the bottom of the board.`,
      'Each position is asked twice: which move do 1500-rated players play most often? Which do 2500+ players play most often? All options are moves that were really played.',
      'The question is \u201cmost often played\u201d, not \u201cbest\u201d. What strong players play is not always what you expect, and club players have their own favorites.',
      'Moves use algebraic notation: N=knight B=bishop R=rook Q=queen K=king, no letter means a pawn, x=capture, O-O=castles short. After you answer, arrows on the board show each band\'s top move.',
    ],
    scoring: `${N_POS * 2} questions, 1 point per correct answer, ${N_POS * 2} points max.`,
    sources: [
      { name: 'Lichess open database (1500 band: January 2014 standard games)', url: 'https://database.lichess.org/' },
      { name: 'Lichess Elite Database (2500+ band: Dec 2021, Jan 2022)', url: 'https://database.nikonoel.fr/' },
      { name: 'lichess-org/chess-openings (opening names)', url: 'https://github.com/lichess-org/chess-openings' },
    ],
    dataNote: 'The Lichess opening explorer API (explorer.lichess.ovh / explorer.lichess.org) now needs a login token and cannot be called keylessly from a browser, so the counts come from the official public game databases instead, as a static snapshot. Stats are by the player making the move: 1500 band = mover rated 1400-1600 (opponent 1250-1750, non-Bullet); 2500+ band = mover rated 2500+ (the Elite database holds 2500+ vs 2300+ games). Identical positions (including move-order transpositions) are merged; every band has a large sample, and each band\'s top move leads the runner-up by at least 6 percentage points. The two databases come from different months (2014 versus 2021-22), and Lichess ratings drifted overall in between, so \u201c1500\u201d means the 1500 of its day.',
  },

  puzzle({ data, rng }) {
    const diff = data.puzzles.filter((p) => topMove(p.opts, 'low') !== topMove(p.opts, 'high'));
    const same = data.puzzles.filter((p) => topMove(p.opts, 'low') === topMove(p.opts, 'high'));
    // mostly "the bands disagree" positions (the point of the game) plus one consensus position as a counter-example
    const picks = same.length ? [...rng.sample(diff, N_POS - 1), ...rng.sample(same, 1)] : rng.sample(diff, N_POS);
    const items = rng.shuffle(picks);
    return { items: items.map((p) => ({ ...p, opts: rng.shuffle(p.opts.slice()) })) };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const { low, high } = ctx.data;
    const bands = [['low', low.label], ['high', high.label]];
    const COLOR = { low: '#d97706', high: '#2563eb', both: '#16a34a' };

    const boardNode = (svg) => {
      const el = ui.h('div', { style: { width: 'min(100%, 340px)', margin: '0 auto', border: '2px solid var(--ink2)', borderRadius: '4px', overflow: 'hidden' } });
      el.innerHTML = svg;
      return el;
    };
    const caption = (i, it) => ui.h('div', { class: 'small muted', style: { textAlign: 'center' } }, `Position ${i + 1}/${N_POS} \u00b7 ${it.turn === 'w' ? 'White' : 'Black'} to move (${it.turn === 'w' ? 'White' : 'Black'} at the bottom)`);

    const rounds = [];
    p.items.forEach((it, i) => {
      for (const [band, bandLabel] of bands) {
        const top = topMove(it.opts, band), n = nOf(it, band);
        rounds.push({
          prompt: `Which move do ${bandLabel} play most often here?`,
          body: ui.h('div', { class: 'ds-stack' }, boardNode(boardSvg(it.fen, it.turn)), caption(i, it)),
          options: it.opts.map((o) => ({ label: o.san, sub: describe(o.san) })),
          correct: it.opts.findIndex((o) => o.san === top),
          explain: `${bandLabel} (${n} moves): ${it.opts.slice().sort((a, b) => b[band] - a[band]).map((o) => `${o.san} ${share(it, o, band).toFixed(0)}%`).join(' · ')}`,
        });
      }
      ctx.log('position', i + 1, it.fen, 'low top', topMove(it.opts, 'low'), 'high top', topMove(it.opts, 'high'));
    });

    const res = await ctx.rounds({ rounds, title: 'Guess the most-played move' });

    res.detail = ui.h('div', { class: 'ds-stack' }, ...p.items.map((it, i) => {
      const lt = topMove(it.opts, 'low'), ht = topMove(it.opts, 'high');
      const mv = (san) => it.opts.find((o) => o.san === san);
      const arrows = lt === ht
        ? [{ ...mv(lt), color: COLOR.both }]
        : [{ ...mv(lt), color: COLOR.low }, { ...mv(ht), color: COLOR.high }];
      const legend = lt === ht
        ? [['Top move, both bands', lt, COLOR.both]]
        : [['1500 top move', lt, COLOR.low], ['2500+ top move', ht, COLOR.high]];
      return ui.h('div', { class: 'ds-stack' },
        ui.h('div', { class: 'ink2' }, `Position ${i + 1}${it.opening ? `: ${it.opening.eco} ${it.opening.name}` : ''} (${it.turn === 'w' ? 'White' : 'Black'} to move)`),
        boardNode(boardSvg(it.fen, it.turn, arrows)),
        ui.h('div', { class: 'small', style: { display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' } },
          ...legend.map(([k, san, c]) => ui.h('span', {}, ui.h('span', { style: { color: c } }, '\u2192 '), `${k} ${san}`))),
        ui.table({
          columns: [{ key: 'san', label: 'Move' }, { key: 'l', label: '1500', num: true }, { key: 'h', label: '2500+', num: true }],
          rows: it.opts.map((o) => ({ san: o.san, l: `${share(it, o, 'low').toFixed(1)}%`, h: `${share(it, o, 'high').toFixed(1)}%` })),
        }),
        ui.h('div', { class: 'small muted' }, `${insight(it)} (sample: ${it.nLow} / ${it.nHigh} moves)`));
    }));
    return res;
  },
};
