import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { vague, QUESTIONS, pinScore } from './game.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
test('vague buckets', () => { assert.match(vague(0.2), /几乎没有/); assert.match(vague(50), /一半/); assert.match(vague(95), /几乎都是/); });
test('every question answers every tract with no NaN', () => {
  for (const t of data.tracts) for (const q of QUESTIONS) { const s = q.say(t); assert.ok(s.length > 5); assert.ok(!/NaN|undefined|null/.test(s), `${t.id} ${q.id}: ${s}`); }
});
test('pinScore', () => { assert.equal(pinScore(0), 100); assert.ok(pinScore(700) < 40 && pinScore(700) > 35); });
test('pool is big and unique', () => { assert.ok(data.tracts.length >= 60); assert.equal(new Set(data.tracts.map((t) => t.id)).size, data.tracts.length); });
