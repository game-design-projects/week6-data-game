// Stream a PGN on stdin and count next-move frequencies per position (first DEPTH plies),
// attributing each move to the PLAYER WHO MADE IT: a move counts only when the mover's rating is in
// [mlo, mhi] and the opponent's rating is in [olo, ohi]. Bullet games are skipped (the Elite DB has none).
// usage: node count.mjs mlo mhi olo ohi out.json   -> {epd: {san: n}}, plus a stats line on stderr
import { Chess } from './chess.mjs';
import readline from 'node:readline';
import fs from 'node:fs';
const [mlo, mhi, olo, ohi] = process.argv.slice(2, 6).map(Number);
const out = process.argv[6];
const DEPTH = 16;
const counts = new Map();
let games = 0, used = 0, moves = 0, w = 0, b = 0, bullet = false;
const key = (fen) => fen.split(' ').slice(0, 4).join(' ');
const inR = (x, lo, hi) => x >= lo && x <= hi;
function proc(mt) {
  const toks = mt.replace(/\{[^}]*\}/g, ' ').replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/).filter((t) => t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
  const okW = inR(w, mlo, mhi) && inR(b, olo, ohi), okB = inR(b, mlo, mhi) && inR(w, olo, ohi);
  if (!okW && !okB) return;
  const c = new Chess();
  let any = false;
  for (let i = 0; i < Math.min(DEPTH, toks.length); i++) {
    if (i % 2 === 0 ? okW : okB) {
      const k = key(c.fen());
      let m = counts.get(k); if (!m) counts.set(k, (m = new Map()));
      m.set(toks[i], (m.get(toks[i]) || 0) + 1);
      moves++; any = true;
    }
    try { c.move(toks[i]); } catch { break; }
  }
  if (any) used++;
}
const rl = readline.createInterface({ input: process.stdin });
for await (const line of rl) {
  if (line.startsWith('[')) {
    if (line.startsWith('[WhiteElo ')) w = Number(line.split('"')[1]);
    else if (line.startsWith('[BlackElo ')) b = Number(line.split('"')[1]);
    else if (line.startsWith('[Event ')) { games++; w = b = 0; bullet = /bullet/i.test(line); }
  } else if (line.startsWith('1.')) {
    if (!bullet) proc(line);
  }
}
const obj = {};
for (const [k, m] of counts) { let tot = 0; for (const v of m.values()) tot += v; if (tot >= 8) obj[k] = Object.fromEntries(m); }
fs.writeFileSync(out, JSON.stringify(obj));
console.error(JSON.stringify({ games, usedGames: used, moves, positions: Object.keys(obj).length }));
