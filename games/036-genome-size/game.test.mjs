import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { fmtMb, vsHuman } from './game.js';

test('fmtMb units', () => {
  assert.equal(fmtMb(3000), '3 Gb');
  assert.equal(fmtMb(134), '134 Mb');
  assert.equal(fmtMb(0.0299), '29.9 kb');
});
test('vsHuman', () => {
  assert.match(vsHuman(15000, 3000), /5\.0 倍/);
  assert.match(vsHuman(3, 3000), /1\/1,000/);
});
test('data is sane and onion ~5x human', () => {
  const d = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
  const m = Object.fromEntries(d.species.map((s) => [s.zh, s.mb]));
  assert.ok(d.species.length >= 100);
  assert.ok(m['洋葱'] / m['人类'] > 4 && m['洋葱'] / m['人类'] < 6);
  for (let i = 1; i < d.species.length; i++) assert.ok(d.species[i].mb >= d.species[i - 1].mb);
});
