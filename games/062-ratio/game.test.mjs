import test from 'node:test';
import assert from 'node:assert/strict';
import { cmp, ratioText } from './game.js';
const a = { pct: { flour: 50, liquid: 20, fat: 20, egg: 10 } };
test('cmp hit/arrow', () => {
  const r = cmp({ pct: { flour: 49, liquid: 40, fat: 5, egg: 10 } }, a);
  assert.equal(r[0].state, 'hit'); assert.match(r[1].text, /↓/); assert.match(r[2].text, /↑/);
});
test('ratioText', () => assert.equal(ratioText(a.pct), '50 : 20 : 20 : 10'));
