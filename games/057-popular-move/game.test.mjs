import test from 'node:test';
import assert from 'node:assert/strict';
import game, { parseFen, describe, topMove, pct } from './game.js';

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

test('data: every puzzle has a clear winner per band', async () => {
  const { readFileSync } = await import('node:fs');
  const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
  assert.ok(data.puzzles.length >= 60);
  for (const p of data.puzzles) {
    for (const [band, n] of [['low', p.nLow], ['high', p.nHigh]]) {
      const s = p.opts.map((o) => o[band]).sort((a, b) => b - a);
      assert.ok(s[0] > s[1], p.fen);
      assert.ok(s.reduce((a, b) => a + b, 0) <= n);
    }
  }
});
