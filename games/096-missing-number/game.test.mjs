import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import g, { fmtPop, fmtSigned, FACTS, storyParts } from './game.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

test('formatters', () => {
  assert.equal(fmtPop(333996304), '3.34 亿人');
  assert.equal(fmtPop(5200000), '520 万人');
  assert.equal(fmtSigned(-2.34), '−2.3%');
});
test('data sanity', () => {
  assert.ok(data.countries.length >= 60);
  for (const c of data.countries) for (const k of Object.keys(FACTS)) assert.ok(Number.isFinite(c[k]), `${c.cc}.${k}`);
});
test('story mentions every fact once', () => {
  const ks = storyParts(data.countries[0]).filter((s) => s.k).map((s) => s.k).sort();
  assert.deepEqual(ks, Object.keys(FACTS).sort());
});
test('answers lie inside slider ranges', () => {
  for (const c of data.countries) for (const [k, f] of Object.entries(FACTS)) assert.ok(c[k] >= f.min && c[k] <= f.max, `${c.cc}.${k}=${c[k]}`);
});
