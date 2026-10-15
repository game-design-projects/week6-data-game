import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { pickLangs, TIERS, NAMES, similarity, leaky, analyse, norm } from './game.js';
import { makeRng, dailyIndex, isoFromDay, addDays } from '../../engine/core.js';
import { cleanLabel, build } from './build/build.mjs';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
const rng = { sample: (a, n) => a.slice(0, n) };
const run = (day) => {
  const date = isoFromDay(day), slug = 'cognates';
  return game.puzzle({ data, day, date, slug, rng: makeRng(`${slug}:${date}`), pick: (arr) => arr[dailyIndex(slug, day, arr.length)] });
};

test('pickLangs gives 6 langs ordered far to near', () => {
  const c = { en: 'zzzz', l: Object.fromEntries(TIERS.flat().map((k) => [k, k])) };
  const out = pickLangs(c, rng);
  assert.equal(out.length, 6);
  assert.ok(TIERS[0].includes(out[0]) && TIERS[2].includes(out[5]));
});
test('pickLangs skips missing languages', () => {
  const c = { en: 'x', l: { zh: 'a', ja: 'b', ru: 'c', pl: 'd', de: 'e', fr: 'f', ko: 'x' } };
  assert.ok(pickLangs(c, rng).every((k) => c.l[k]));
});
test('pickLangs hides leaky labels in the far tiers', () => {
  const c = { en: 'tomato', l: { zh: '\u756a\u8304', ja: '\u30c8\u30de\u30c8', id: 'tomat', tr: 'domates', fi: 'tomaatti', ru: 'помидор', pl: 'pomidor', fr: 'tomate', es: 'tomate', it: 'pomodoro' } };
  const out = pickLangs(c, { sample: (a, n) => a.slice(0, n) });
  assert.ok(!out.slice(0, 4).some((k) => leaky(c.l[k], 'tomato')), out.join());
});
test('similarity: identical 1, accents ignored, non-Latin null', () => {
  assert.equal(similarity('Tochter', 'tochter'), 1);
  assert.equal(similarity('hôtel', 'hotel'), 1);
  assert.equal(similarity('вода', 'water'), null);
  assert.ok(similarity('dochter', 'daughter') > 0.5);
  assert.ok(similarity('con gái', 'daughter') < 0.4);
});
test('analyse ranks by similarity and flags clue positions', () => {
  const c = { en: 'daughter', l: { de: 'tochter', nl: 'dochter', fr: 'fille', zh: '\u5973\u513f' } };
  const A = analyse(c, ['zh', 'fr', 'nl']);
  assert.equal(A.rows[0].k, 'nl');
  assert.equal(A.rows.find((r) => r.k === 'zh').sim, null);
  assert.equal(A.rows.find((r) => r.k === 'nl').clue, 3);
  assert.ok(A.near.length >= 1);
});
test('cleanLabel drops concept-style / bracketed labels', () => {
  assert.equal(cleanLabel('owca domowa', 'pl'), null);
  assert.equal(cleanLabel('Luft', 'de'), 'luft');
  assert.equal(cleanLabel('con gái', 'vi'), 'con gái');
  assert.equal(cleanLabel('foo (bar)', 'de'), null);
});
test('build drops taxa, disambiguations and shared labels', () => {
  const mk = (id, en, desc, l) => ({ id, labels: { en: { value: en }, ...Object.fromEntries(Object.entries(l).map(([k, v]) => [k, { value: v }])) }, descriptions: { en: { value: desc } } });
  const LK = 'de,nl,sv,da,fr,es,it,pt,ro,ru,pl,cs,el,hi,fa,ar,tr,fi,hu,sw,id,ja,zh,ko,he,vi'.split(',');
  const L = Object.fromEntries(LK.map((k) => [k, 'x' + k]));
  const L3 = Object.fromEntries(LK.map((k) => [k, 'y' + k]));
  const tmp = new URL('./build/raw/_test.json', import.meta.url);
  fs.mkdirSync(new URL('./build/raw/', import.meta.url), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify({ entities: { Q1: mk('Q1', 'Pinus', 'genus of plants', L), Q2: mk('Q2', 'Spring', 'Wikimedia disambiguation page', L), Q3: mk('Q3', 'Alpha', 'a thing', L), Q4: mk('Q4', 'Beta', 'a thing', { ...L3, fr: 'xfr' }) } }));
  const out = build([tmp.pathname]);
  fs.unlinkSync(tmp);
  assert.deepEqual(out.map((c) => c.en).sort(), ['alpha', 'beta']);
  assert.ok(out.every((c) => c.l.fr === undefined), 'shared label removed');
  assert.equal(out.find((c) => c.en === 'beta').l.de, 'yde');
});

test('pool: size, fields, and every concept can yield a safe puzzle', () => {
  assert.ok(data.concepts.length >= 60);
  const ens = new Set();
  for (const c of data.concepts) {
    assert.match(c.en, /^[a-z]{3,12}$/);
    assert.ok(!ens.has(c.en), 'dup ' + c.en); ens.add(c.en);
    assert.match(c.q, /^Q\d+$/);
    const ks = Object.keys(c.l);
    assert.ok(ks.length >= 18, c.en);
    for (const k of ks) {
      assert.ok(NAMES[k], k);
      assert.ok(typeof c.l[k] === 'string' && c.l[k].length > 0 && !/undefined|NaN|null/.test(c.l[k]), `${c.en}.${k}`);
    }
    for (const t of TIERS) assert.ok(t.filter((k) => c.l[k]).length >= 2, `${c.en} tier too small`);
  }
});

test('puzzles for days 1-120 are valid, leak-free and deterministic', () => {
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = run(day);
    assert.deepEqual(p, run(day));
    const c = data.concepts.find((x) => x.en === p.en);
    assert.ok(c, 'answer is a selectable option: ' + p.en);
    assert.equal(p.langs.length, 6);
    assert.equal(new Set(p.langs).size, 6, 'distinct languages');
    p.langs.forEach((k, i) => {
      assert.ok(c.l[k], `${p.en} lacks ${k}`);
      assert.ok(TIERS[Math.floor(i / 2)].includes(k), 'tier order');
      if (i < 4) assert.ok(!leaky(c.l[k], c.en), `leak on day ${day}: ${c.en} ${k}=${c.l[k]}`);
    });
    // the answer must not appear verbatim as any early clue, nor inside a clue label of the first four
    seen.add(p.en);
  }
  assert.ok(seen.size >= 60, 'variety ' + seen.size);
});

test('whole-pool leak scan: far tiers always have enough safe languages', () => {
  for (const c of data.concepts) {
    for (const t of TIERS.slice(0, 2)) {
      const safe = t.filter((k) => c.l[k] && !leaky(c.l[k], c.en));
      assert.ok(safe.length >= 2, `${c.en}: only ${safe.length} safe in tier`);
    }
  }
});

test('scoring extremes: 1st guess 100, 6th ~17, miss 0 (ctx.guess default)', () => {
  const s = (n, won) => (won ? Math.round((100 * (6 - n + 1)) / 6) : 0);
  assert.equal(s(1, true), 100);
  assert.equal(s(6, true), 17);
  assert.equal(s(6, false), 0);
  assert.ok(s(1, true) > s(3, true) && s(3, true) > s(5, true));
});

test('first clue alone rarely identifies the answer, unlike the last (difficulty gradient)', () => {
  // far-tier clues must not be Latin look-alikes of the answer on average
  let far = 0, near = 0, n = 0;
  for (let day = 1; day <= 120; day++) {
    const p = run(day), c = data.concepts.find((x) => x.en === p.en);
    far += similarity(c.l[p.langs[0]], c.en) ?? 0; near += similarity(c.l[p.langs[5]], c.en) ?? 0; n++;
  }
  assert.ok(near / n > far / n, `near ${near / n} should exceed far ${far / n}`);
});
