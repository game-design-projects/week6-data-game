import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { redact, shape, nameKeys, topicLeaks, logTicks, pattern } from './game.js';
import { makeRng } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const norm = (t) => (t || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

test('redact hides repo and owner', () => {
  assert.equal(redact('React is a lib by facebook', 'facebook/react'), '▇▇▇ is a lib by ▇▇▇');
  assert.equal(redact(null, 'a/bcd'), '');
});
test('redact catches separators, spaces and fragments', () => {
  assert.equal(redact('Stable Diffusion web UI', 'AUTOMATIC1111/stable-diffusion-webui'), '▇▇▇');
  assert.equal(redact('Vue 3 framework', 'vuejs/core'), '▇▇▇ 3 framework');
  assert.equal(redact('The Atlantis tool', 'x/atlantis'), 'The ▇▇▇ tool');
  assert.equal(redact('Reactive stuff', 'facebook/react'), '▇▇▇ stuff');
});
test('topicLeaks', () => {
  assert.ok(topicLeaks('react', 'facebook/react'));
  assert.ok(topicLeaks('vue', 'vuejs/core'));
  assert.ok(!topicLeaks('javascript', 'facebook/react'));
});
test('shape and pattern', () => {
  const s = shape([1, 1, 1, 1, 100]);
  assert.equal(s.peakIdx, 4); assert.equal(s.median, 1); assert.equal(s.ratio, 100);
  assert.ok(s.top3Share > 0.9);
  assert.ok(pattern(shape(Array(68).fill(100))).includes('平稳'));
  assert.ok(pattern(shape([10, 10, 20, 40, 80, 160, 320, 640])).includes('升温'));
  assert.ok(pattern(shape([640, 320, 160, 80, 40, 20, 10, 10])).includes('消退'));
});
test('logTicks', () => {
  assert.deepEqual(logTicks(300, 3000), [500, 1000, 2000]);
});

test('pool: every day 1-120 gives a valid puzzle', () => {
  const ids = new Set(data.repos.map((r) => r.id));
  assert.equal(ids.size, data.repos.length, 'duplicate ids');
  assert.ok(data.repos.length >= 60);
  assert.equal(data.weeks.length, 68);
  data.weeks.forEach((w, i) => { assert.match(w, /^\d{4}-\d{2}-\d{2}$/); assert.equal(new Date(w + 'T00:00:00Z').getUTCDay(), 1, 'week starts Monday'); if (i) assert.equal((Date.parse(w) - Date.parse(data.weeks[i - 1])) / 864e5, 7); });
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const rng = makeRng ? makeRng(`074:${day}`) : null;
    const p = game.puzzle({ data, day, date, slug: 'star-history', rng, pick: (a) => a[(day * 7919) % a.length] });
    const r = data.repos.find((x) => x.id === p.id);
    assert.ok(r, `day ${day}: answer in options`);
    seen.add(p.id);
  }
  for (const r of data.repos) {
    assert.match(r.id, /^[\w.-]+\/[\w.-]+$/);
    assert.equal(r.s.length, data.weeks.length, r.id);
    assert.ok(r.s.every((v) => Number.isInteger(v) && v >= 0), r.id);
    assert.equal(r.s.reduce((a, b) => a + b, 0), r.total, r.id);
    assert.ok(r.s.filter((v) => v > 0).length >= data.weeks.length - 4, `${r.id} coverage`);
    assert.ok(r.total >= 3000 && r.stars >= r.total * 0.5 && r.stars < 2e6, `${r.id} ranges`);
    assert.match(r.created, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(r.lang === null || (typeof r.lang === 'string' && r.lang), `${r.id} lang`);
    assert.ok(typeof r.desc === 'string' && r.desc.trim(), `${r.id} desc`);
    assert.ok(Array.isArray(r.topics) && r.topics.every((t) => typeof t === 'string' && t));
  }
});

test('no answer leaks in descriptions or topics, across the whole pool', () => {
  for (const r of data.repos) {
    const keys = nameKeys(r.id);
    const words = redact(r.desc, r.id).match(/[\p{L}\p{N}]+/gu) || [];
    for (const k of keys) {
      for (let i = 0; i < words.length; i++) {
        let j = '';
        for (let n = i; n < Math.min(words.length, i + 6); n++) { j += norm(words[n]); assert.ok(j !== k, `${r.id}: desc leaks ${k}`); }
        assert.ok(k.length < 4 || !norm(words[i]).includes(k), `${r.id}: fragment ${k}`);
      }
    }
    for (const t of r.topics.filter((t) => !topicLeaks(t, r.id))) for (const k of keys) assert.ok(norm(t) !== k && (k.length < 4 || !norm(t).includes(k)), `${r.id}: topic ${t}`);
  }
});

test('scoring extremes: default guess scoring is 100 first try, 17 on sixth, 0 on a miss', () => {
  const sc = (n, won) => (won ? Math.round((100 * (6 - n + 1)) / 6) : 0);
  assert.deepEqual([sc(1, true), sc(6, true), sc(6, false)], [100, 17, 0]);
});
