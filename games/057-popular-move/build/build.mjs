// raw/low.json + raw/high.json (from count.mjs) + opening names -> ../data.json
import { Chess } from './chess.mjs';
import fs from 'node:fs';
const low = JSON.parse(fs.readFileSync('raw/low.json'));
const high = JSON.parse(fs.readFileSync('raw/high.json'));
const key = (fen) => fen.split(' ').slice(0, 4).join(' ');
const sum = (m) => Object.values(m).reduce((a, b) => a + b, 0);

// opening names: EPD -> {eco, name}, keeping the deepest (longest pgn) entry per position
const names = new Map();
for (const f of 'abcde') {
  for (const line of fs.readFileSync(`raw/${f}.tsv`, 'utf8').split('\n').slice(1)) {
    const [eco, name, pgn] = line.split('\t');
    if (!pgn) continue;
    const c = new Chess();
    try { for (const t of pgn.replace(/\d+\./g, ' ').split(/\s+/).filter(Boolean)) c.move(t); } catch { continue; }
    names.set(key(c.fen()), { eco, name });
  }
}

const cands = [];
for (const [k, lm] of Object.entries(low)) {
  const hm = high[k];
  if (!hm) continue;
  const nl = sum(lm), nh = sum(hm);
  if (nl < 60 || nh < 150) continue;
  const c = new Chess(k + ' 0 1');
  const legal = new Set(c.moves());
  const all = {};
  for (const m of Object.keys(lm)) all[m] = (all[m] || 0) + lm[m] / nl;
  for (const m of Object.keys(hm)) all[m] = (all[m] || 0) + hm[m] / nh;
  const top = Object.keys(all).filter((m) => legal.has(m)).sort((a, b) => all[b] - all[a]).slice(0, 4);
  if (top.length < 3) continue;
  const rank = (m) => top.slice().sort((a, b) => (m[b] || 0) - (m[a] || 0));
  const rl = rank(lm), rh = rank(hm);
  const gap = (m, r, n) => ((m[r[0]] || 0) - (m[r[1]] || 0)) / n;
  if (gap(lm, rl, nl) < 0.06 || gap(hm, rh, nh) < 0.06) continue; // a clear winner in both bands
  // ply = number of half-moves played
  const fen = k + ' 0 1';
  cands.push({ k, fen, turn: k.split(' ')[1], opts: top.map((m) => ({ san: m, low: lm[m] || 0, high: hm[m] || 0 })), nl, nh, topLow: rl[0], topHigh: rh[0], opening: names.get(k) || null, diff: rl[0] !== rh[0] });
}
// ply from move search is not stored; recover it from fullmove via a replay-free trick: unknown -> use piece count heuristic skip
console.log('candidates', cands.length, 'divergent', cands.filter((c) => c.diff).length);
// diversify: rank by total weight, drop positions that are a single move apart from an already chosen one
const bySize = cands.sort((a, b) => (b.diff - a.diff) * 1e6 + (b.nl + b.nh) - (a.nl + a.nh) * 1);
const chosen = [];
const dist = (a, b) => { let d = 0; const x = a.k.split(' ')[0], y = b.k.split(' ')[0]; for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) d++; return d; };
for (const c of [...cands.filter((c) => c.diff).sort((a, b) => b.nl + b.nh - a.nl - a.nh), ...cands.filter((c) => !c.diff).sort((a, b) => b.nl + b.nh - a.nl - a.nh)]) {
  if (c.fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')) continue;
  if (chosen.some((d) => d.k.split(' ')[0] === c.k.split(' ')[0])) continue;
  if (chosen.length < 90) chosen.push(c);
}
const puzzles = chosen.map((c) => ({ fen: c.fen, turn: c.turn, nLow: c.nl, nHigh: c.nh, opening: c.opening, opts: c.opts }));
const out = {
  low: { label: '1500 分段', desc: 'Lichess 2013-01 标准对局，双方评分 1350–1650', games: 37479 },
  high: { label: '2500 分段', desc: 'Lichess Elite Database 2020-06，双方评分 ≥ 2400', games: 190185 },
  puzzles,
};
fs.writeFileSync('../data.json', JSON.stringify(out));
console.log('puzzles', puzzles.length, 'divergent', puzzles.filter((p) => { const t = (b) => p.opts.slice().sort((x, y) => y[b] - x[b])[0].san; return t('low') !== t('high'); }).length, 'bytes', fs.statSync('../data.json').size);
