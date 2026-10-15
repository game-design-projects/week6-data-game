import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { parseVector, sevOf, vecMap, vectorStory, descCues } from './game.js';
import { redactDesc, cleanDesc, RULES, contentWords } from './build/redact.mjs';
import { expScore } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));

// CVSS 3.1 base score calculator (FIRST spec) — independent check that every stored score matches its vector.
const roundup = (x) => { const i = Math.round(x * 100000); return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10; };
function base(vec) {
  const m = vecMap(vec);
  const av = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }[m.AV], ac = { L: 0.77, H: 0.44 }[m.AC], ui = { N: 0.85, R: 0.62 }[m.UI];
  const ch = m.S === 'C';
  const pr = { N: 0.85, L: ch ? 0.68 : 0.62, H: ch ? 0.5 : 0.27 }[m.PR];
  const cia = { H: 0.56, L: 0.22, N: 0 };
  const iss = 1 - (1 - cia[m.C]) * (1 - cia[m.I]) * (1 - cia[m.A]);
  const imp = ch ? 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15 : 6.42 * iss;
  const ex = 8.22 * av * ac * pr * ui;
  if (imp <= 0) return 0;
  return roundup(Math.min(ch ? 1.08 * (imp + ex) : imp + ex, 10));
}

test('parseVector', () => { const v = parseVector('AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N'); assert.equal(v.length, 8); assert.deepEqual(v[0], ['Attack vector', 'Network (remote)']); });
test('sevOf', () => { assert.equal(sevOf(9.8), 'Critical'); assert.equal(sevOf(7.5), 'High'); assert.equal(sevOf(4.3), 'Medium'); assert.equal(sevOf(0.1), 'Low'); });
test('vectorStory is specific to the vector', () => {
  assert.match(vectorStory('AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', 9.8), /reachable over the network.*no privileges needed.*all high/);
  assert.match(vectorStory('AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H', 7.8), /holds down: local only, needs the user to click/);
  assert.match(vectorStory('AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H', 7.5), /only availability is high/);
});
test('descCues reads wording against the vector', () => {
  const cues = descCues('An authenticated remote attacker can crash the service.', 'AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:H');
  assert.ok(cues.length >= 3 && cues.every((c) => c.ok));
  assert.equal(descCues('A remote attacker', 'AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H')[0].ok, false);
  assert.deepEqual(descCues('Something neutral happens.', 'AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'), []);
});

test('redactDesc masks names and the weakness, drops leaks', () => {
  const d = 'The Acme Widgets plugin for WordPress is vulnerable to SQL Injection via the id parameter in all versions up to 1.2.3, allowing unauthenticated attackers to extract data from the database.';
  const r = redactDesc(d, new Set(['acme widgets', 'Acme']), 'CWE-89');
  assert.ok(r && !/sql/i.test(r) && !/acme/i.test(r) && r.includes('◆◆◆') && r.includes('▇▇▇'));
  assert.equal(redactDesc('Acme is affected by a bug that links to https://example.com/x for details and more words here to pass length.', new Set(['Acme']), 'CWE-89'), null);
  assert.ok(!/critical/i.test(redactDesc('A vulnerability was found in Foo Bar 1.0. It has been declared as critical. The manipulation of the argument id leads to SQL injection. The attack can be launched remotely over the network by anyone.', new Set(['Foo Bar']), 'CWE-89')));
  assert.equal(contentWords('◆◆◆ in ▇▇▇.'), 0);
});

test('pool: every puzzle of days 1-120 is valid', () => {
  const ids = new Set(); const seenIds = new Set();
  assert.ok(data.puzzles.length >= 60, 'pool size ' + data.puzzles.length);
  assert.ok(Object.keys(data.cwes).length === 24);
  for (const [k, w] of Object.entries(data.cwes)) {
    assert.match(k, /^CWE-\d+$/);
    for (const f of ['label', 'en', 'grp', 'tip']) assert.ok(typeof w[f] === 'string' && w[f].length >= 3, k + f);
    assert.ok(data.groups[w.grp], k + ' group');
    assert.ok(RULES[k], k + ' has redaction rules');
  }
  const labels = Object.entries(data.cwes).map(([k, w]) => `${k} ${w.label}`);
  assert.equal(new Set(labels).size, labels.length, 'option labels distinct');
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const p = game.puzzle({ data, day, date, slug: 'cvss', rng: null, pick: (arr) => arr[(day * 7919) % arr.length] });
    const c = data.puzzles.find((x) => x.id === p.id);
    assert.ok(c, 'puzzle id found ' + p.id);
    ids.add(p.id);
  }
  assert.ok(ids.size >= 40);
  for (const c of data.puzzles) {
    assert.ok(!seenIds.has(c.id), 'dup ' + c.id); seenIds.add(c.id);
    assert.match(c.id, /^CVE-\d{4}-\d{4,}$/);
    assert.ok(data.cwes[c.cwe], 'answer is an option: ' + c.id);
    assert.ok(Number.isFinite(c.score) && c.score > 0 && c.score <= 10);
    assert.equal(base(c.vec), c.score, `${c.id} score ${c.score} vs vector ${c.vec}`);
    assert.equal(parseVector(c.vec).length, 8);
    assert.ok(parseVector(c.vec).every(([a, b]) => a && b), 'vector parse ' + c.vec);
    assert.match(c.pub, /^2024-\d\d-\d\d$/);
    for (const f of ['desc', 'orig']) { assert.ok(typeof c[f] === 'string' && c[f].length > 60, f); assert.ok(!/undefined|NaN/.test(c[f]), `${c.id} ${f}`); }
    assert.ok(!/https?:|CVE-\d|CWE-\d/.test(c.desc), 'ids/urls in desc ' + c.id);
  }
});

test('pool: no answer leaks in any description', () => {
  for (const c of data.puzzles) {
    for (const l of RULES[c.cwe].leak) assert.ok(!new RegExp(l, 'i').test(c.desc), `${c.id} (${c.cwe}) leaks /${l}/: ${c.desc}`);
    assert.ok(!c.desc.includes(c.id));
    assert.ok(!/\b(declared|classified|rated) as (critical|problematic|important|high|medium|low)\b/i.test(c.desc), 'severity leak ' + c.id);
    assert.ok(!/severity:? (low|medium|moderate|high|critical)/i.test(c.desc), 'severity leak ' + c.id);
    // CWE names (English) never appear verbatim
    assert.ok(!c.desc.toLowerCase().includes(data.cwes[c.cwe].en.toLowerCase()), 'name leak ' + c.id);
  }
});

test('pool: coverage and spread', () => {
  const per = {}; for (const c of data.puzzles) per[c.cwe] = (per[c.cwe] || 0) + 1;
  assert.ok(Object.keys(per).length >= 18, 'CWE coverage ' + Object.keys(per).length);
  assert.ok(Math.max(...Object.values(per)) <= 6);
  const scores = data.puzzles.map((c) => c.score);
  assert.ok(Math.min(...scores) < 4 && Math.max(...scores) >= 9.8, 'score range');
  const first = new Set(); for (const c of data.puzzles) first.add(c.cwe);
  assert.ok(first.size === Object.keys(per).length);
});

test('score estimate: skill is rewarded, constant guessing is not', () => {
  const avg = (g) => data.puzzles.reduce((s, c) => s + expScore(Math.abs(g(c) - c.score), 1.5), 0) / data.puzzles.length;
  assert.equal(expScore(0, 1.5), 100);
  assert.ok(expScore(5, 1.5) <= 4 && expScore(10, 1.5) === 0);
  let best = 0; for (let g = 0; g <= 10; g += 0.1) best = Math.max(best, avg(() => g));
  assert.ok(best < 45, 'best constant guess averages ' + best.toFixed(1));
  const byCwe = {}; for (const c of data.puzzles) (byCwe[c.cwe] ||= []).push(c.score);
  const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const informed = avg((c) => med(byCwe[c.cwe]));
  assert.ok(informed > best, `knowing the weakness helps (${informed.toFixed(1)} > ${best.toFixed(1)})`);
  assert.ok(avg((c) => c.score + 0.4) > 75, 'near-perfect reading scores high');
});
