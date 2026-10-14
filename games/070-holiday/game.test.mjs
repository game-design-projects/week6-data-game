import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { redact } from './game.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));

test('every country has a capital and ≥ 5 holidays', () => {
  for (const c of data.countries) {
    assert.ok(Number.isFinite(c.capital.lat), c.cc);
    assert.ok(c.holidays.length >= 5, c.cc);
  }
});

test('redact hides the country name and capital', () => {
  const c = { name: 'Mexico', capital: { name: 'Mexico City' } };
  assert.equal(redact('Mexican Independence Day', c), '▇▇▇ Independence Day');
  assert.ok(!/Norway/i.test(redact('Norway Constitution Day', { name: 'Norway', capital: { name: 'Oslo' } })));
});

test('puzzle returns a known country code', () => {
  const p = game.puzzle({ data, pick: (a) => a[3] });
  assert.ok(data.countries.some((c) => c.cc === p.cc));
});
