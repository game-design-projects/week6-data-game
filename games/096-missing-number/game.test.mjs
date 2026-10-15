import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import g, { fmtPop, fmtSigned, FACTS, CKEYS, QKEYS, storyParts, quakeParts, countryTip, quakeTip, toQuake } from './game.js';
import { dayStats } from './quake.js';
import { makeRng, dailyIndex, isoFromDay, expScore } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const fixture = JSON.parse(fs.readFileSync(new URL('./build/fixture.json', import.meta.url)));
const inRange = (k, v) => Number.isFinite(v) && v >= FACTS[k].min && v <= FACTS[k].max;

test('formatters', () => {
  assert.equal(fmtPop(333996304), '3.34 亿人');
  assert.equal(fmtPop(5200000), '520 万人');
  assert.equal(fmtSigned(-2.34), '−2.3%');
  assert.equal(FACTS.qmag.fmt(6.15), 'M6.2');
});

test('data sanity', () => {
  assert.ok(data.countries.length >= 60);
  assert.ok(data.quakes.length >= 60);
  for (const c of data.countries) for (const k of CKEYS) assert.ok(inRange(k, c[k]), `${c.cc}.${k}=${c[k]}`);
  for (const s of data.quakes) for (const k of QKEYS) assert.ok(inRange(k, s[k]), `${s.d}.${k}=${s[k]}`);
  assert.equal(new Set(data.countries.map((c) => c.cc)).size, data.countries.length);
  assert.equal(new Set(data.quakes.map((s) => s.d)).size, data.quakes.length);
  for (const s of data.quakes) {
    assert.match(s.d, /^\d{4}-\d\d-\d\d$/);
    assert.ok(s.q25 >= s.q45 && s.q45 >= s.q5, s.d);
    assert.ok(s.q5 > 0 ? s.qmag >= 5 : s.qmag < 5, `${s.d} max mag vs M5 count`);
    assert.ok(s.magPlace && s.depPlace && !/undefined|NaN/.test(s.magPlace + s.depPlace));
  }
});

test('stories mention every fact once', () => {
  assert.deepEqual(storyParts(data.countries[0]).filter((s) => s.k).map((s) => s.k).sort(), [...CKEYS].sort());
  assert.deepEqual(quakeParts(data.quakes[0]).filter((s) => s.k).map((s) => s.k).sort(), [...QKEYS].sort());
});

test('scoring tolerances: a blind mid-range guess is never near-perfect', () => {
  for (const [k, f] of Object.entries(FACTS)) {
    if (f.scoring === 'abs') assert.ok(f.scale <= (f.max - f.min) / 4, k);
    else assert.ok(f.scale <= 0.4, k);
  }
});

test('live toQuake shapes a real USGS day (fixture)', () => {
  const s = toQuake(fixture, '2026-10-10');
  const snap = data.quakes.find((x) => x.d === '2026-10-10');
  assert.ok(s);
  assert.deepEqual(s, snap); // the live path and the build path agree
  assert.equal(toQuake({ features: fixture.features.slice(0, 5) }, 'x'), null); // too few events
  assert.equal(toQuake(null, 'x'), null);
  assert.equal(dayStats([...fixture.features, { properties: { mag: 9.9, place: 'x of Y' }, geometry: { coordinates: [0, 0, 5] } }], 'x'), null); // out of slider range
});

test('pool validity, days 1-120', () => {
  const seen = new Set();
  const kinds = { quake: 0, country: 0 };
  for (let day = 1; day <= 120; day++) {
    const date = isoFromDay(day);
    const rng = makeRng(`missing-number:${date}`);
    const pick = (arr) => arr[dailyIndex('missing-number', day, arr.length)];
    const p = g.puzzle({ data, day, date, slug: 'missing-number', rng, pick });
    assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
    assert.equal(p.blanks.length, 3);
    assert.equal(new Set(p.blanks).size, 3);
    kinds[p.kind]++;
    const src = p.kind === 'quake' ? p.s : data.countries.find((c) => c.cc === p.cc);
    assert.ok(src, `day ${day}`);
    const keys = p.kind === 'quake' ? QKEYS : CKEYS;
    for (const k of p.blanks) { assert.ok(keys.includes(k)); assert.ok(inRange(k, src[k])); }
    const tips = p.blanks.map((k) => (p.kind === 'quake' ? quakeTip(k, src, data.quakes) : countryTip(k, src, data.countries, p.blanks)));
    for (const t of tips) assert.ok(t && !/undefined|NaN|Infinity/.test(t), `${day}: ${t}`);
    const text = JSON.stringify(p.kind === 'quake' ? quakeParts(src) : storyParts(src));
    assert.ok(!/undefined|NaN/.test(text));
    seen.add(p.kind === 'quake' ? src.d + p.blanks : src.cc + p.blanks);
  }
  assert.equal(kinds.quake, 40);
  assert.ok(seen.size >= 100);
});

test('answer leak: only numbers that are not blanked are printed; blanks show letters', () => {
  for (const s of data.quakes) {
    const prose = quakeParts(s).filter((x) => typeof x === 'string').join('').replace(s.d, '');
    // the prose between slots may contain thresholds (M2.5 / M4.5 / M5) and place names, but no free-standing count/magnitude/depth
    assert.ok(!/\d/.test(prose.replace(/M2\.5|M4\.5|M5/g, '').replace(s.magPlace, '').replace(s.depPlace, '')), s.d);
  }
  for (const c of data.countries) assert.ok(!/\d/.test(storyParts(c).filter((x) => typeof x === 'string').join('').replace(/\d{4}/g, '')), c.cc);
});

test('scoring extremes via engine curve', () => {
  for (const f of Object.values(FACTS).filter((x) => x.scoring === 'abs')) {
    assert.equal(expScore(0, f.scale), 100);
    const typical = expScore(f.scale * 0.5, f.scale);
    assert.ok(typical > 50 && typical < 80);
    assert.ok(expScore((f.max - f.min) / 2, f.scale) < 5); // blind mid-range guess at the worst
  }
});
