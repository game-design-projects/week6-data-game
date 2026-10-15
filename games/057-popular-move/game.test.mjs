import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { parseFen, describe, topMove, pct, boardSvg, insight } from './game.js';
import { Chess } from './build/chess.mjs';
import { makeRng } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const SAN = /^(O-O(-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?)[+#]?$/;
const SQ = /^[a-h][1-8]$/;
const dayPuzzle = (day) => game.puzzle({ data, day, date: '2026-10-01', slug: 'popular-move', rng: makeRng(`popular-move:${day}`) });

test('parseFen lays out the start position', () => {
  const b = parseFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
  assert.equal(b.length, 8);
  assert.ok(b.every((r) => r.length === 8));
  assert.equal(b[0][4], 'k');
  assert.equal(b[4][4], 'P');
  assert.equal(b[3][3], '');
});

test('describe names pieces and squares', () => {
  assert.equal(describe('Nf3'), '马 → f3');
  assert.equal(describe('e5'), '兵 → e5');
  assert.equal(describe('Bxc6+'), '象 吃 c6');
  assert.equal(describe('exd5'), '兵 吃 d5');
  assert.equal(describe('O-O'), '短易位');
  assert.equal(describe('e8=Q'), '兵 → e8');
});

test('topMove / pct', () => {
  const opts = [{ san: 'a', low: 5, high: 1 }, { san: 'b', low: 2, high: 9 }];
  assert.equal(topMove(opts, 'low'), 'a');
  assert.equal(topMove(opts, 'high'), 'b');
  assert.equal(pct(1, 4), 25);
  assert.equal(pct(1, 0), 0);
});

test('boardSvg: 32 pieces at the start, flipped for black, arrows drawn, no NaN', () => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const w = boardSvg(start, 'w'), b = boardSvg(start, 'b', [{ from: 'e2', to: 'e4', color: '#f00' }]);
  assert.equal((w.match(/<text[^>]*font-size="8.4"/g) || []).length, 32);
  assert.ok(w.indexOf('>a<') < w.indexOf('>h<') && b.indexOf('>h<') < b.indexOf('>a<'));
  assert.ok(b.includes('<polygon') && !w.includes('<polygon'));
  assert.ok(!/NaN|undefined/.test(w + b));
});

test('insight is specific to the numbers of the position', () => {
  const it = { nLow: 100, nHigh: 200, opts: [{ san: 'd5', low: 60, high: 40 }, { san: 'c5', low: 10, high: 120 }, { san: 'e6', low: 20, high: 20 }, { san: 'c6', low: 10, high: 20 }] };
  const t = insight(it);
  assert.match(t, /d5（60%）/); assert.match(t, /c5（60%/); assert.match(t, /20%/);
  const same = { nLow: 100, nHigh: 100, opts: [{ san: 'Nf3', low: 70, high: 60 }, { san: 'c4', low: 10, high: 30 }] };
  assert.match(insight(same), /共识/);
});

test('data: pool size, size, band metadata', () => {
  assert.ok(data.puzzles.length >= 60);
  assert.ok(readFileSync(new URL('./data.json', import.meta.url)).length < 1.5e6);
  for (const b of ['low', 'high']) assert.ok(data[b].label && data[b].games > 10000);
  const diff = data.puzzles.filter((p) => topMove(p.opts, 'low') !== topMove(p.opts, 'high'));
  assert.ok(diff.length >= 40 && data.puzzles.length - diff.length >= 10);
});

test('data: every puzzle is well-formed, legal and has a clear winner per band', () => {
  const fens = new Set();
  for (const p of data.puzzles) {
    assert.ok(!fens.has(p.fen), `duplicate ${p.fen}`); fens.add(p.fen);
    const c = new Chess(p.fen);
    assert.equal(c.turn(), p.turn);
    assert.equal(p.opts.length, 4, p.fen);
    const legal = new Map(c.moves({ verbose: true }).map((m) => [m.san, m]));
    assert.equal(new Set(p.opts.map((o) => o.san)).size, 4, 'distinct options');
    for (const o of p.opts) {
      assert.ok(SAN.test(o.san), o.san);
      assert.ok(legal.has(o.san), `${p.fen} ${o.san} legal`);
      assert.ok(SQ.test(o.from) && SQ.test(o.to) && legal.get(o.san).from === o.from && legal.get(o.san).to === o.to);
      assert.ok(Number.isInteger(o.low) && Number.isInteger(o.high) && o.low >= 0 && o.high >= 0);
    }
    for (const [band, n] of [['low', p.nLow], ['high', p.nHigh]]) {
      assert.ok(Number.isInteger(n) && n >= 150 && n < 1e7);
      const s = p.opts.map((o) => o[band]).sort((a, b) => b - a);
      assert.ok(s.reduce((a, b) => a + b, 0) <= n, 'option counts <= sample');
      assert.ok(pct(s[0] - s[1], n) >= 6 - 1e-9, `${p.fen} ${band} gap`);
    }
    assert.ok(p.opening === null || (p.opening.eco && p.opening.name), p.fen);
  }
});

test('puzzle(): days 1-120 are valid, deterministic, answer selectable, no leaks', () => {
  for (let day = 1; day <= 120; day++) {
    const a = dayPuzzle(day), b = dayPuzzle(day);
    assert.deepEqual(a, b);
    assert.equal(a.items.length, 4);
    assert.equal(new Set(a.items.map((i) => i.fen)).size, 4, 'no duplicate positions in a day');
    assert.ok(a.items.some((i) => topMove(i.opts, 'low') !== topMove(i.opts, 'high')));
    for (const it of a.items) {
      assert.equal(it.opts.length, 4);
      for (const band of ['low', 'high']) assert.ok(it.opts.some((o) => o.san === topMove(it.opts, band)));
      // the answer must not be flagged: nothing visible before the guess may carry the opening name or the counts
      const visible = JSON.stringify(it.opts.map((o) => [o.san, describe(o.san)]));
      assert.ok(!/undefined|NaN/.test(visible));
      if (it.opening) assert.ok(!visible.includes(it.opening.name));
      assert.ok(!/undefined|NaN/.test(boardSvg(it.fen, it.turn)));
    }
  }
});

test('puzzle(): ≥ 7 distinct days, option order is not a tell', () => {
  const sig = new Set(Array.from({ length: 14 }, (_, i) => dayPuzzle(i + 1).items.map((x) => x.fen).join('|')));
  assert.ok(sig.size >= 7);
  // correct-answer position must be spread over all four slots across the pool of days
  const slots = [0, 0, 0, 0];
  for (let d = 1; d <= 120; d++) for (const it of dayPuzzle(d).items) for (const band of ['low', 'high']) slots[it.opts.findIndex((o) => o.san === topMove(it.opts, band))]++;
  for (const s of slots) assert.ok(s > 120 * 8 * 0.15, `slots ${slots}`);
});

test('fairness: score = #correct; chance ≈ 25%; naive "just pick the most popular overall" is far from perfect', () => {
  // perfect = all correct by construction; a naive bot that picks the move with the larger combined share:
  let hit = 0, tot = 0;
  for (let d = 1; d <= 120; d++) for (const it of dayPuzzle(d).items) for (const band of ['low', 'high']) {
    const guess = it.opts.reduce((a, b) => (b.low / it.nLow + b.high / it.nHigh > a.low / it.nLow + a.high / it.nHigh ? b : a)).san;
    hit += guess === topMove(it.opts, band) ? 1 : 0; tot++;
  }
  const rate = hit / tot;
  assert.ok(rate > 0.35 && rate < 0.9, `naive rate ${rate}`); // better than the 25% chance, but not trivial
});
