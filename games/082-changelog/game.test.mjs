import test from 'node:test';
import assert from 'node:assert/strict';
import { redact, redactTag } from './game.js';
const r = { id: 'nodejs/node', name: 'Node.js', lang: 'C++' };
test('redact hides names', () => {
  assert.equal(redact('Node.js 12 and nodejs fixed', r).includes('Node'), false);
  assert.ok(redact('Fix crash', r) === 'Fix crash');
});
test('redactTag keeps version', () => {
  assert.equal(redactTag('v12.1.0', r), 'v12.1.0');
  assert.match(redactTag('node-1.2', r), /1\.2/);
});
