import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { toDay, apiUrl } from './game.js';
import { makeRng } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
const fixture = JSON.parse(fs.readFileSync(new URL('./build/fixture.json', import.meta.url), 'utf8'));

function checkDay(d, label) {
  assert.match(d.date, /^\d{4}-\d\d-\d\d$/, label);
  assert.equal(d.stories.length, 4, label);
  assert.ok(d.n >= 12 && d.median >= 15, label);
  const ids = new Set();
  for (const s of d.stories) {
    assert.ok(Number.isInteger(s.id) && !ids.has(s.id), `${label} id`);
    ids.add(s.id);
    assert.ok(typeof s.title === 'string' && s.title.trim().length > 3, `${label} title`);
    assert.ok(!/^(undefined|NaN|null)$/.test(s.title), `${label} title junk`);
    assert.ok(s.domain === null || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s.domain), `${label} domain ${s.domain}`);
    assert.ok(Number.isFinite(s.points) && s.points >= 15 && s.points < 20000, `${label} points`);
    assert.ok(Number.isInteger(s.comments) && s.comments >= 0 && s.comments < 10000, `${label} comments`);
    assert.ok(s.hour >= 0 && s.hour <= 23, `${label} hour`);
    assert.ok(s.rank >= 1 && s.rank <= d.n, `${label} rank`);
    assert.ok(!s.title.includes(String(s.points)) || s.points < 100, `${label} title leaks points`);
  }
  const pts = d.stories.map((s) => s.points);
  assert.equal(new Set(pts).size >= 3, true, `${label} spread`);
  assert.ok(pts[0] >= pts[1] && pts[1] >= pts[2] && pts[2] >= pts[3], `${label} sorted by rank`);
}

test('toDay shapes the committed API fixture', () => {
  assert.ok(fs.statSync(new URL('./build/fixture.json', import.meta.url)).size <= 50_000);
  const d = toDay(fixture, fixture.date);
  assert.ok(d);
  checkDay(d, 'fixture');
  assert.equal(d.n, fixture.hits.filter((h) => h.points >= 15).length);
  assert.equal(d.stories[0].points, Math.max(...fixture.hits.map((h) => h.points)));
});

test('toDay rejects thin or malformed days', () => {
  assert.equal(toDay({ hits: fixture.hits.slice(0, 5) }, '2026-01-01'), null);
  assert.equal(toDay(null, '2026-01-01'), null);
  assert.equal(toDay({ hits: [{ title: '', points: 50 }] }, '2026-01-01'), null);
});

test('apiUrl covers exactly one UTC day', () => {
  const u = decodeURIComponent(apiUrl('2026-10-13'));
  const t0 = Date.parse('2026-10-13T00:00:00Z') / 1000;
  assert.ok(u.includes(`created_at_i>=${t0},created_at_i<${t0 + 86400}`));
});

test('pool of >= 60 valid days with unique dates', () => {
  assert.ok(data.days.length >= 60);
  assert.equal(new Set(data.days.map((d) => d.date)).size, data.days.length);
  for (const d of data.days) checkDay(d, d.date);
});

test('puzzle() valid for days 1-120, shuffled order, same stories', () => {
  const seenFirstTop = new Set();
  for (let day = 1; day <= 120; day++) {
    const rng = makeRng(`${game.meta.slug}:${day}`);
    const p = game.puzzle({ data, day, date: '2026-10-01', slug: game.meta.slug, rng, pick: (a) => a[(day * 7) % a.length] });
    assert.equal(p.stories.length, 4);
    assert.ok(p.date && p.n && p.median);
    assert.equal(new Set(p.stories.map((s) => s.id)).size, 4);
    JSON.stringify(p);
    seenFirstTop.add(p.stories[0].rank === Math.min(...p.stories.map((s) => s.rank)));
  }
  assert.ok(seenFirstTop.has(false), 'order must not always start with the top story');
});

test('log scoring: perfect, typical, worst', () => {
  const sc = (g, a) => Math.exp(-Math.abs(Math.log10(g / a)) / 0.3) * 100;
  assert.equal(Math.round(sc(100, 100)), 100);
  assert.ok(Math.abs(sc(200, 100) - 37) < 6);
  assert.ok(sc(10, 3000) < 1);
});
