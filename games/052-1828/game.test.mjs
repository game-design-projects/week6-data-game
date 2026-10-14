import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseEntry, redactWord, compareWords } from './parse.js';
import game from './game.js';

test('parseEntry extracts pos, etymology and numbered senses', () => {
  const h = '<p><b>TUBE</b>, <i>noun</i> [Latin tubus.]</p><p><b>1.</b> A vessel; as a <i>tube</i>.</p><p><b>2.</b> A pipe.</p>';
  const e = parseEntry(h, 'tube');
  assert.equal(e.pos, '名词');
  assert.equal(e.ety, 'Latin tubus.');
  assert.deepEqual(e.senses, ['A vessel; as a tube.', 'A pipe.']);
  assert.equal(parseEntry(h, 'other'), null);
});
test('redactWord hides inflections', () => {
  assert.equal(redactWord('To improve; improvement of improved things', 'improve'), 'To ▇▇▇; ▇▇▇ of ▇▇▇ things');
  assert.equal(redactWord('A cat sat', 'cat'), 'A ▇▇▇ sat');
});
test('compareWords', () => {
  assert.deepEqual(compareWords('apple', 'zebra'), { dir: '↓', len: 0, first: false });
  assert.equal(compareWords('x', 'x').dir, '=');
});
test('puzzle deterministic and answer in options', () => {
  const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
  const days = new Set();
  for (const e of data.pool) assert.ok(data.options.includes(e.w), e.w);
  assert.ok(data.pool.length >= 60);
  assert.ok(game.puzzle);
});
