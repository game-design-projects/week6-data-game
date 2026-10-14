// Stream a PGN on stdin, count next-move frequencies per position (first DEPTH plies)
// for games where BOTH players are within [lo, hi]. Output JSON: {fen: {san: n}}.
import { Chess } from './chess.mjs';
import readline from 'node:readline';
const [lo, hi, out] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
const DEPTH = 16;
const counts = new Map();
let games = 0, used = 0, w = 0, b = 0, ok = false, cls = true;
const key = (fen) => fen.split(' ').slice(0, 4).join(' ');
function process_(mt) {
  const toks = mt.replace(/\{[^}]*\}/g, ' ').replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/).filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
  const c = new Chess();
  for (let i = 0; i < Math.min(DEPTH, toks.length); i++) {
    const k = key(c.fen());
    let m = counts.get(k); if (!m) counts.set(k, (m = new Map()));
    m.set(toks[i], (m.get(toks[i]) || 0) + 1);
    try { c.move(toks[i]); } catch { return; }
  }
  used++;
}
const rl = readline.createInterface({ input: process.stdin });
for await (const line of rl) {
  if (line.startsWith('[')) {
    if (line.startsWith('[WhiteElo ')) w = Number(line.split('"')[1]);
    else if (line.startsWith('[BlackElo ')) b = Number(line.split('"')[1]);
    else if (line.startsWith('[Event ')) { games++; w = b = 0; }
  } else if (line.startsWith('1.')) {
    if (w >= lo && w <= hi && b >= lo && b <= hi) process_(line);
    if (games % 100000 === 0) console.error(games, used);
  }
}
const obj = {};
for (const [k, m] of counts) { let tot = 0; for (const v of m.values()) tot += v; if (tot >= 8) obj[k] = Object.fromEntries(m); }
(await import('node:fs')).writeFileSync(out, JSON.stringify(obj));
console.error('games', games, 'used', used, 'positions', Object.keys(obj).length);
