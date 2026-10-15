import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { vague, QUESTIONS, pinScore, route, standouts, reading, STATE_NAMES } from './game.js';
import { makeRng, dailyIndex } from '../../engine/core.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
const PCT = ['transit', 'walk', 'home', 'drive', 'noCar', 'bach', 'owner', 'white', 'black', 'asian', 'hisp', 'fb', 'pov', 'detached', 'big'];
const KEYS = ['pop', 'inc', 'rent', 'val', 'age', 'yr', ...PCT];
const runDay = (day) => game.puzzle({ data, day, date: '2026-10-01', slug: 'who-lives-here', rng: makeRng(`w:${day}`), pick: (arr) => arr[dailyIndex('who-lives-here', day, arr.length)] });

test('vague buckets', () => { assert.match(vague(0.2), /几乎没有/); assert.match(vague(50), /一半/); assert.match(vague(95), /几乎都是/); });
test('every question answers every tract with no NaN', () => {
  for (const t of data.tracts) for (const q of QUESTIONS) { const s = q.say(t); assert.ok(s.length > 5); assert.ok(!/NaN|undefined|null/.test(s), `${t.id} ${q.id}: ${s}`); }
});
test('pool is big, unique, lower-48 only, sane ranges', () => {
  assert.ok(data.tracts.length >= 60);
  assert.equal(new Set(data.tracts.map((t) => t.id)).size, data.tracts.length);
  for (const t of data.tracts) {
    assert.match(t.id, /^\d{11}$/);
    assert.ok(STATE_NAMES[t.state], `state ${t.state}`);
    assert.ok(t.lat >= 24 && t.lat <= 50 && t.lng >= -125 && t.lng <= -66, `${t.id} outside map`);
    assert.ok(t.county && t.tract);
    for (const k of KEYS) assert.ok(Number.isFinite(t[k]), `${t.id}.${k}`);
    for (const k of PCT) assert.ok(t[k] >= 0 && t[k] <= 100, `${t.id}.${k}=${t[k]}`);
    assert.ok(t.inc > 5000 && t.inc < 400000 && t.rent > 200 && t.rent < 5000 && t.val > 20000 && t.age > 15 && t.age < 80 && t.yr > 1900 && t.yr < 2025);
  }
});
test('puzzle days 1-120 are valid', () => {
  const ids = new Set(data.tracts.map((t) => t.id));
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const a = runDay(day);
    assert.ok(ids.has(a.id));
    assert.deepEqual(Object.keys(a), ['id']); // location only comes from play() after the guess
    assert.deepEqual(a, runDay(day));
    seen.add(a.id);
  }
  assert.ok(seen.size >= 60);
});
test('no place name appears in any resident answer (no answer leaks)', () => {
  for (const t of data.tracts) for (const q of QUESTIONS) {
    const s = q.say(t);
    assert.ok(!s.includes(t.county) && !s.includes(STATE_NAMES[t.state]), `${t.id} ${q.id}`);
  }
});
test('pinScore extremes', () => {
  assert.equal(pinScore(0), 100);
  assert.ok(pinScore(700) < 40 && pinScore(700) > 35);
  assert.ok(pinScore(4500) <= 1);
  assert.ok(pinScore(50) > 90);
  const ts = data.tracts; let sum = 0, n = 0;
  for (let i = 0; i < ts.length; i += 3) for (let j = 1; j < ts.length; j += 11) {
    const R = 6371, r = Math.PI / 180, a = ts[i], b = ts[j];
    const d = 2 * R * Math.asin(Math.sqrt(Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lng - a.lng) * r / 2) ** 2));
    sum += pinScore(d); n++;
  }
  assert.ok(sum / n < 25, `random mean ${sum / n}`);
});
test('typed question routing', () => {
  const cases = { '房租贵不贵？': 'housing', '你们家一年挣多少': 'money', '怎么去上班': 'commute', '家里有车吗': 'cars', '邻居是什么人': 'neighbors', '大家多大年纪': 'age', '读过大学吗': 'school', '住的是什么房子': 'homes', '今天天气怎么样': null, '': null };
  for (const [q, id] of Object.entries(cases)) assert.equal(route(q), id, q);
  for (const q of QUESTIONS) assert.equal(route(q.label), q.id, q.label);
});
test('learnability text exists for every tract', () => {
  for (const t of data.tracts) {
    const s = standouts(t, data.tracts), r = reading(t);
    assert.equal(s.length, 3); assert.ok(r.length >= 1);
    for (const x of [...s, ...r]) assert.ok(!/NaN|undefined/.test(x), `${t.id}: ${x}`);
  }
});
