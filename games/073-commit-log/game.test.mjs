import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { redact, nameTokens, styleNotes } from './game.js';
import { makeRng, dailyIndex, addDays, EPOCH } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const slug = game.meta.slug;
const puzzleFor = (day) => game.puzzle({ data, day, date: addDays(EPOCH, day - 1), slug, rng: makeRng(`${slug}:${addDays(EPOCH, day - 1)}`), pick: (arr) => arr[dailyIndex(slug, day, arr.length)] });

test('redact hides repo name tokens', () => {
  assert.equal(redact('fix linux kernel bug', 'torvalds/linux'), 'fix ▇▇▇ kernel bug');
  assert.equal(redact('Update React docs', 'facebook/react'), 'Update ▇▇▇ docs');
  assert.equal(redact('home assistant', 'home-assistant/core'), '▇▇▇ ▇▇▇');
  assert.equal(redact('support Next.js and nextjs', 'vercel/next.js'), 'support ▇▇▇ and ▇▇▇');
  assert.equal(redact('cmd/go: fix', 'golang/go'), 'cmd/▇▇▇: fix');
  assert.equal(redact('github actions for git', 'git/git'), 'github actions for ▇▇▇');
});

test('nameTokens include owner and joined name', () => {
  const t = nameTokens('ggerganov/llama.cpp');
  for (const x of ['llama', 'llamacpp', 'ggerganov']) assert.ok(t.includes(x), x);
});

test('pool: enough repos, sane fields, no duplicate ids', () => {
  assert.ok(data.repos.length >= 60, `only ${data.repos.length} repos`);
  const ids = new Set();
  for (const r of data.repos) {
    assert.ok(/^[\w.-]+\/[\w.-]+$/.test(r.id), r.id);
    assert.ok(!ids.has(r.id), `dup ${r.id}`); ids.add(r.id);
    assert.ok(r.name && r.lang, r.id);
    assert.ok(Number.isInteger(r.year) && r.year >= 1998 && r.year <= 2026, `${r.id} year ${r.year}`);
    assert.ok(Number.isInteger(r.stars) && r.stars > 100 && r.stars < 2e6, `${r.id} stars ${r.stars}`);
    assert.ok(r.msgs.length >= 12, r.id);
    assert.equal(new Set(r.msgs.map((m) => m.toLowerCase())).size, r.msgs.length, `${r.id} dup msgs`);
    for (const m of r.msgs) assert.ok(m.length >= 18 && m.length <= 90 && !/\[object /.test(m), `${r.id}: ${m}`);
  }
});

test('puzzles for days 1-120 are valid and answerable', () => {
  const ids = new Set(data.repos.map((r) => r.id));
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = puzzleFor(day);
    assert.ok(ids.has(p.id), `day ${day} answer missing`);
    assert.equal(p.msgs.length, 5);
    assert.equal(new Set(p.msgs).size, 5, `day ${day} duplicate messages`);
    const repo = data.repos.find((r) => r.id === p.id);
    for (const m of p.msgs) assert.ok(repo.msgs.includes(m));
    assert.deepEqual(puzzleFor(day), p, 'deterministic');
    if (day <= data.repos.length) seen.add(p.id);
  }
  assert.ok(seen.size >= 60, 'no repeats until the pool is used up');
});

test('answer leaks: nothing shown before the guess names the repo', () => {
  for (const r of data.repos) {
    const shown = [...r.msgs.map((m) => redact(m, r.id)), redact(r.desc, r.id)];
    for (const t of nameTokens(r.id)) {
      const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${t.length >= 4 ? "" : "\\b"}`, "i");
      for (const s of shown) assert.ok(!re.test(s), `${r.id} leaks "${t}" in: ${s}`);
    }
    // no stray fragments next to a redaction bar ("▇▇▇lantis", "▇▇▇.js")
    for (const s of shown) assert.ok(!/▇▇▇[A-Za-z]|[A-Za-z]▇▇▇/.test(s), `${r.id} fragment: ${s}`);
  }
});

test('every puzzle keeps at least 60% of its text readable', () => {
  for (let day = 1; day <= 120; day++) {
    const p = puzzleFor(day);
    const red = p.msgs.map((m) => redact(m, p.id)).join('');
    const bars = (red.match(/▇/g) || []).length;
    assert.ok(bars / red.length < 0.4, `day ${day} ${p.id} too redacted`);
  }
});

test('styleNotes is specific to the repo', () => {
  const linux = data.repos.find((r) => r.id === 'torvalds/linux');
  const notes = styleNotes(linux, data.repos);
  assert.ok(notes.length >= 1 && notes.some((n) => n.includes('子系统')), notes.join('|'));
  const fake = { msgs: ['Add a thing to the thing', 'Fix another thing here ok'] };
  assert.ok(styleNotes(fake, data.repos).every((n) => /\d+%/.test(n)));
});
