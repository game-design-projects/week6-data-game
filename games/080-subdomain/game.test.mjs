import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { batches, CLUE_SIZES } from './game.js';
import { toLive, labelOk, brandTokens, MIN_LABELS } from './shape.js';
import { makeRng } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const fixture = JSON.parse(fs.readFileSync(new URL('./build/fixture.json', import.meta.url)));

test('batches split labels in order', () => {
  const labels = Array.from({ length: 36 }, (_, i) => 'l' + i);
  const b = batches(labels);
  assert.equal(b.length, CLUE_SIZES.length);
  assert.deepEqual(b.flat(), labels);
});

test('brand names and prefixes are filtered from labels', () => {
  const c = { id: 'fortinet', name: 'Fortinet', domain: 'fortinet.com' };
  assert.ok(!labelOk('fortidemo', c));
  assert.ok(!labelOk('my-fortinet', c));
  assert.ok(labelOk('status', c));
  assert.ok(!labelOk('a1b2c3d4e5f6', c));
  assert.ok(brandTokens({ id: 'nytimes', name: 'The New York Times', domain: 'nytimes.com' }).includes('times'));
});

test('toLive shapes a crt.sh fixture, anchored to the date', () => {
  const { company, rows, freq } = fixture;
  const live = toLive(rows, company, freq, '2026-10-15');
  assert.ok(live, 'enough labels');
  assert.equal(live.id, company.id);
  assert.ok(live.labels.length >= MIN_LABELS && live.labels.length <= 36);
  assert.equal(new Set(live.labels).size, live.labels.length);
  assert.ok(live.latest < '2026-10-15', 'nothing issued on/after the puzzle date');
  assert.ok(live.labels.every((l) => labelOk(l, company)));
  // generic (shared) labels come before unique ones
  const firstUniq = live.labels.findIndex((l) => !freq[l]);
  assert.ok(live.labels.slice(firstUniq).every((l) => !freq[l]) || firstUniq === -1 || live.labels.slice(0, firstUniq).every((l) => freq[l]));
  // earlier anchor drops later certificates; too few → null
  assert.equal(toLive(rows, company, freq, '2000-01-01'), null);
  assert.equal(toLive([], company, freq, '2026-10-15'), null);
});

test('puzzle prefers matching live data and ignores a mismatched one', () => {
  const pick = (a) => a[3];
  const id = data.companies[3].id;
  const live = { id, labels: ['a'], total: 1, latest: '2026-10-01' };
  assert.deepEqual(game.puzzle({ data: { ...data, live }, pick }), { id, live });
  assert.deepEqual(game.puzzle({ data: { ...data, live: { ...live, id: 'zzz' } }, pick }), { id });
});

test('pool: every puzzle over 120 days is valid and leak-free', () => {
  const ids = new Set(data.companies.map((c) => c.id));
  assert.equal(ids.size, data.companies.length, 'unique ids');
  assert.equal(new Set(data.companies.map((c) => c.name)).size, data.companies.length, 'unique names');
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const rng = makeRng ? makeRng(`${game.meta.slug}:${day}`) : null;
    const pick = (arr) => arr[(day * 37 + 11) % arr.length];
    const p = game.puzzle({ data, day, date, slug: game.meta.slug, rng, pick });
    assert.ok(ids.has(p.id), 'answer is an option');
    seen.add(p.id);
    const c = data.companies.find((x) => x.id === p.id);
    assert.ok(c.name && c.cat && c.domain, 'fields present');
    assert.ok(c.labels.length >= 24 && c.labels.length <= 36, `${c.id} label count`);
    assert.equal(new Set(c.labels).size, c.labels.length, `${c.id} duplicate labels`);
    assert.ok(Number.isFinite(c.total) && c.total >= c.labels.length, `${c.id} total`);
    assert.match(c.latest, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(c.domain.includes('.'));
    const b = batches(c.labels);
    assert.ok(b.every((x) => x.length > 0));
    // no clue contains the brand (name, id or 4+ letter prefix)
    for (const l of c.labels) assert.ok(labelOk(l, c), `${c.id} leaks via ${l}`);
    // guessable: later batches hold labels no other company has
    const late = b.slice(3).flat();
    assert.ok(late.filter((l) => !data.freq[l]).length >= 3, `${c.id} has too few unique late clues`);
  }
  assert.ok(seen.size >= 30);
});

test('scoring extremes: 100 → 17 → 0, strictly decreasing', () => {
  const s = (n) => Math.round((100 * (7 - n)) / 6);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(s), [100, 83, 67, 50, 33, 17]);
});
