import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { fmtPrice, zhMonth } from './game.js';

test('fmtPrice', () => {
  assert.equal(fmtPrice(0.046), '$0.046');
  assert.equal(fmtPrice(2.272), '$2.27');
});
test('zhMonth', () => assert.equal(zhMonth('1983-03'), '1983 年 3 月'));
test('pool items exist in their month', () => {
  const d = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
  for (const e of d.pool) for (const k of e.items) assert.ok(d.items[k].s[e.ym] > 0, `${k} ${e.ym}`);
  assert.ok(d.pool.length >= 60);
});
