import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { redact, redactTag, aliases, leaks, eraHints, firstLine, yearMentions } from './game.js';
import { dailyIndex, makeRng, isoFromDay, expScore } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const byId = new Map(data.repos.map((r) => [r.id, r]));
const puzzleFor = (day) => {
  const date = isoFromDay(day);
  return game.puzzle({ data, day, date, slug: 'changelog', rng: makeRng(`changelog:${date}`), pick: (a) => a[dailyIndex('changelog', day, a.length)] });
};
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

test('redact hides names, aliases and compounds', () => {
  const node = byId.get('nodejs/node');
  assert.ok(!/node/i.test(redact('Node.js 12 and nodejs, node:fs fixed', node).replace(/▇/g, '')));
  assert.equal(redact('Fix crash', node), 'Fix crash');
  const ha = byId.get('home-assistant/core');
  assert.ok(!/home|assistant/i.test(redact('Home Assistant and home-assistant and homeassistant', ha)));
  assert.ok(!/torch/i.test(redact('torch.compile in PyTorch', byId.get('pytorch/pytorch'))));
});

test('short or common-word names only redact whole words', () => {
  const bun = byId.get('oven-sh/bun');
  assert.equal(redact('Bundle the bun runtime', bun), 'Bundle the ▇▇▇ runtime');
  const uv = byId.get('astral-sh/uv');
  assert.equal(redact('uv pip and uvx; but not UV or vuv', uv), '▇▇▇ pip and ▇▇▇; but not UV or vuv');
});

test('redactTag keeps the version and drops name prefixes and years', () => {
  const r = byId.get('nginx/nginx');
  assert.equal(redactTag('release-1.27.3', r), '1.27.3');
  assert.equal(redactTag('v12.1.0', byId.get('nodejs/node')), 'v12.1.0');
  assert.equal(redactTag('2026.10.1', byId.get('home-assistant/core')), '▇▇▇▇.10.1');
});

test('yearMentions', () => {
  assert.deepEqual(yearMentions(['Fix CVE-2026-1234 now', 'nothing']), ['CVE-2026-1234']);
  assert.deepEqual(yearMentions(['no years 12345']), []);
});

test('eraHints and firstLine', () => {
  assert.deepEqual(eraHints(['Supports Python 3.12 and Node 18.', 'macOS 12 dropped']), ['Python 3.12', 'Node 18', 'macOS 12']);
  assert.deepEqual(eraHints(['Fix a typo']), []);
  assert.equal(firstLine(['a', 'bbb', 'cc']), 'bbb');
});

test('pool: structure, sizes and ranges', () => {
  assert.ok(data.puzzles.length >= 60, 'pool size');
  const ids = new Set(), urls = new Set();
  for (const r of data.repos) {
    assert.ok(!ids.has(r.id), `dup repo ${r.id}`); ids.add(r.id);
    assert.match(r.id, /^[\w.-]+\/[\w.-]+$/);
    assert.ok(r.name && Number.isFinite(r.stars) && r.stars > 1000, r.id);
    assert.ok(r.since >= 2005 && r.since <= 2026, r.id);
  }
  const names = data.repos.map((r) => r.name.toLowerCase());
  assert.equal(new Set(names).size, names.length, 'duplicate option labels');
  const keys = new Set();
  for (const p of data.puzzles) {
    const k = p.repo + p.tag; assert.ok(!keys.has(k), `dup puzzle ${k}`); keys.add(k);
    const R = byId.get(p.repo); assert.ok(R, `unknown repo ${p.repo}`);
    assert.ok(p.tag && !/undefined|NaN/.test(p.tag));
    assert.ok(Number.isInteger(p.year) && p.year >= R.since && p.year <= 2026, `${k} year`);
    assert.match(p.date, /^\d{4}-\d\d-\d\d$/); assert.equal(+p.date.slice(0, 4), p.year);
    assert.match(p.url, /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/releases\/tag\//);
    assert.ok(p.lines.length >= 3 && p.lines.length <= 7, `${k} lines`);
    for (const l of p.lines) assert.ok(typeof l === 'string' && l.length > 8 && !/NaN|\[object/.test(l), `${k} line`);
    if (p.raw) assert.equal(p.raw.length, p.lines.length);
    urls.add(p.url);
  }
  assert.equal(urls.size, data.puzzles.length, 'duplicate urls');
});

test('pool: no year or date is visible in any clue', () => {
  for (const p of data.puzzles) {
    const R = byId.get(p.repo);
    const seen = [...p.lines.map((l) => redact(l, R)), redactTag(p.tag, R), firstLine(p.lines)].join('\n');
    assert.ok(!/\b(19|20)\d\d\b/.test(seen), `${p.repo} ${p.tag} shows a year: ${seen.match(/.{0,30}\b(19|20)\d\d\b.{0,10}/)?.[0]}`);
  }
});

test('pool: the software name never survives redaction (all clues, whole pool)', () => {
  for (const p of data.puzzles) {
    const R = byId.get(p.repo);
    const [owner, repo] = R.id.split('/');
    const seen = [...p.lines.map((l) => redact(l, R)), redactTag(p.tag, R)].join('\n');
    assert.ok(!leaks(seen, R), `${p.repo} ${p.tag} leaks an alias`);
    const flat = norm(seen.replace(/▇+/g, ' '));
    for (const w of [R.name, repo, owner, ...(R.alias || [])]) {
      const n = norm(w.replace(/\$$/, ''));
      if (n.length >= 4 && !['core', 'framework'].includes(n)) assert.ok(!flat.includes(n), `${p.repo} ${p.tag} still contains "${w}"`);
    }
    // no half-redacted fragment such as "▇▇▇lantis" glued to letters on the left
    assert.ok(!/[A-Za-z]▇/.test(seen.replace(/[A-Za-z]▇▇▇▇/g, '')), `${p.repo} ${p.tag} glued fragment`);
  }
});

test('puzzle(): days 1-120 are valid, selectable and well-formed', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const pz = puzzleFor(day);
    const P = data.puzzles.find((x) => x.repo === pz.repo && x.tag === pz.tag);
    assert.ok(P, `day ${day}: puzzle not in pool`);
    assert.ok(byId.has(pz.repo));
    assert.deepEqual(pz, puzzleFor(day), 'deterministic');
    seen.add(pz.repo + pz.tag);
  }
  assert.ok(seen.size >= 100, `only ${seen.size} distinct puzzles in 120 days`);
});

test('every option is distinct and selectable by id and label', () => {
  const labels = new Set(data.repos.map((r) => r.name));
  assert.equal(labels.size, data.repos.length);
  assert.ok(aliases(byId.get('rust-lang/rust')).includes('rustc'));
});

test('year scoring: perfect, typical, worst', () => {
  const s = (err) => expScore(err, 2);
  assert.equal(s(0), 100);
  assert.ok(s(1) > 55 && s(1) < 65);
  assert.ok(s(2) > 33 && s(2) < 40);
  assert.ok(s(5) < 10);
  assert.ok(s(18) < 0.1);
});

test('difficulty: the pool spans several eras and languages', () => {
  const years = new Set(data.puzzles.map((p) => p.year));
  assert.ok(years.size >= 10);
  assert.ok(new Set(data.repos.map((r) => r.lang)).size >= 8);
});
