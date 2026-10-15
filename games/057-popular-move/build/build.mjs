// raw/057-low.json + raw/057-high.json (from count.mjs) + raw/{a..e}.tsv (opening names) -> ../data.json
// run from build/:  node build.mjs     (see fetch.sh for the downloads and the count.mjs invocations)
import { Chess } from './chess.mjs';
import fs from 'node:fs';
const low = JSON.parse(fs.readFileSync('raw/057-low.json'));
const high = JSON.parse(fs.readFileSync('raw/057-high.json'));
const key = (fen) => fen.split(' ').slice(0, 4).join(' ');
const sum = (m) => Object.values(m).reduce((a, b) => a + b, 0);
const MIN_N = Number(process.env.MIN_N || 150), GAP = 0.06, MAX_PER_OPENING = 3, MAX = 100;

// opening names: EPD -> {eco, name}; keep the deepest (longest pgn) entry per position
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
  if (nl < MIN_N || nh < MIN_N) continue;
  const c = new Chess(k + ' 0 1');
  const verbose = c.moves({ verbose: true });
  const bySan = new Map(verbose.map((m) => [m.san, m]));
  const sl = (m) => (lm[m] || 0) / nl, sh = (m) => (hm[m] || 0) / nh;
  const legal = [...bySan.keys()];
  const rl = legal.slice().sort((a, b) => sl(b) - sl(a)), rh = legal.slice().sort((a, b) => sh(b) - sh(a));
  if (sl(rl[0]) - sl(rl[1]) < GAP || sh(rh[0]) - sh(rh[1]) < GAP) continue; // a clear winner in both bands
  if (rl[0] === rh[0] && sl(rl[0]) > 0.8 && sh(rh[0]) > 0.8) continue; // forced move, no skill involved
  // 4 options: both bands' winners, then the next most played (by the larger share) with >= 2% in some band
  const opts = [...new Set([rl[0], rh[0]])];
  for (const m of legal.slice().sort((a, b) => Math.max(sl(b), sh(b)) - Math.max(sl(a), sh(a)))) {
    if (opts.length >= 4) break;
    if (!opts.includes(m) && Math.max(sl(m), sh(m)) >= 0.02) opts.push(m);
  }
  if (opts.length < 4) continue;
  const fen = k + ' 0 1';
  cands.push({
    fen, turn: k.split(' ')[1], nLow: nl, nHigh: nh, opening: names.get(k) || null,
    opts: opts.map((san) => ({ san, from: bySan.get(san).from, to: bySan.get(san).to, low: lm[san] || 0, high: hm[san] || 0 })),
    diff: rl[0] !== rh[0],
  });
}
console.log('candidates', cands.length, 'divergent', cands.filter((c) => c.diff).length);

// pick: divergent first (they are the point of the game), then agreeing ones; <= MAX_PER_OPENING per opening family;
// the start position is excluded. Order by sample size so well-supported positions win.
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const fam = (c) => (c.opening ? c.opening.name.split(':')[0].split(',')[0] : c.fen.split(' ')[0]);
const order = (a, b) => (b.nLow * b.nHigh) ** 0.5 - (a.nLow * a.nHigh) ** 0.5;
const chosen = [], seen = new Set(), perFam = new Map();
const take = (c) => {
  if (c.fen.startsWith(START) || seen.has(c.fen)) return;
  if ((perFam.get(fam(c)) || 0) >= MAX_PER_OPENING || chosen.length >= MAX) return;
  perFam.set(fam(c), (perFam.get(fam(c)) || 0) + 1); seen.add(c.fen); chosen.push(c);
};
cands.filter((c) => c.diff).sort(order).forEach((c) => { if (chosen.length < 70) take(c); });
// keep a minority of "everyone agrees" positions so the answer is not always "they differ"
cands.filter((c) => !c.diff).sort(order).forEach(take);
const puzzles = chosen.map(({ diff, ...p }) => p);
const st = (f) => JSON.parse(fs.readFileSync(f, 'utf8').trim().split('\n').pop());
const sl = st('raw/057-low.log'), sh = st('raw/057-high.log');
const meta = {
  low: { label: '1500-rated players', desc: 'Lichess January 2014 standard games (non-Bullet), mover rated 1400-1600', games: sl.usedGames, moves: sl.moves },
  high: { label: '2500+ rated players', desc: 'Lichess Elite Database Dec 2021 and Jan 2022, mover rated 2500+', games: sh.usedGames, moves: sh.moves },
};
fs.writeFileSync('../data.json', JSON.stringify({ ...meta, puzzles }));
const topOf = (p, b) => p.opts.slice().sort((x, y) => y[b] - x[b])[0].san;
console.log('puzzles', puzzles.length, 'divergent', puzzles.filter((p) => topOf(p, 'low') !== topOf(p, 'high')).length, 'bytes', fs.statSync('../data.json').size);
