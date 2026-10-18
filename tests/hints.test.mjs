import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leaks, parseLadder, ladderPrompt } from '../scripts/hints.mjs';

test('name words leak, modifiers do not', () => {
  assert.deepEqual(leaks('A slice of cold watermelon', 'watermelon', false).name, ['watermelon']);
  assert.deepEqual(leaks('A deep, dark velvet curtain', 'dark rose', false).name, []);
});
test('color words are caught unless the clue is the plain one', () => {
  assert.deepEqual(leaks('Pool water, bright blue', 'azure', false).color, ['blue']);
  assert.deepEqual(leaks('A vivid orange with a pink lean', 'orange red', true), { name: [], color: [], words: 7 });
  assert.deepEqual(leaks('A vivid melon shade', 'watermelon', true).name, []);
  assert.deepEqual(leaks('Like a ripe watermelon', 'watermelon', true).name, ['watermelon']);
});
test('ladder replies parse from bare or fenced JSON, junk is rejected', () => {
  const j = { vague: 'a', object: 'b', plain: 'c' };
  assert.deepEqual(parseLadder(JSON.stringify(j)), j);
  assert.deepEqual(parseLadder('```json\n' + JSON.stringify(j) + '\n```'), j);
  assert.equal(parseLadder('{"vague": "a"}'), null);
  assert.equal(parseLadder('no json here'), null);
});
test('the prompt carries the data the model needs', () => {
  const p = ladderPrompt({ hex: '#FF724C', name: 'pinkish orange', L: 0.72, C: 0.17, h: 37 });
  assert.match(p, /#FF724C/);
  assert.match(p, /sRGB 255, 114, 76/);
  assert.match(p, /"pinkish orange"/);
});
