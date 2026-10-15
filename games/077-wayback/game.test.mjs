import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import game, { eraNotes, eraRange, yearScore, tld } from './game.js';
import { makeRng, dailyIndex, EPOCH, isoFromDay, addDays } from '../../engine/core.js';
import { makeRedactor } from './build/redact.mjs';
import { SITES } from './build/sites.mjs';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const base = { kb: 20, tables: 0, fonts: 0, imgs: 3, scripts: 1, frames: 0, flash: 0, marquee: 0, iframes: 0, viewport: false, html5: false, css: 0, fw: [], og: false, https: 0 };
const slug = 'wayback';
const puzzleFor = (day) => game.puzzle({ data, day, date: isoFromDay(day), slug, rng: makeRng(`${slug}:${isoFromDay(day)}`), pick: (arr) => arr[dailyIndex(slug, day, arr.length)] });

test('tld', () => assert.equal(tld('bbc.co.uk'), '.co.uk'));
test('old page', () => { const n = eraNotes({ ...base, tables: 12, fonts: 9, flash: 1 }); assert.ok(n.some((x) => x.includes('table'))); assert.ok(n.some((x) => x.includes('Flash'))); });
test('modern page', () => { const n = eraNotes({ ...base, viewport: true, fw: ['react'], og: true }); assert.ok(n.some((x) => x.includes('viewport'))); assert.ok(n.some((x) => x.includes('框架'))); });
test('empty', () => assert.equal(eraNotes(base).length, 1));

test('eraRange windows', () => {
  assert.deepEqual(eraRange(base), [1995, 2025]);
  assert.deepEqual(eraRange({ ...base, frames: 1 }), [1995, 2005]);
  assert.deepEqual(eraRange({ ...base, viewport: true, fw: ['react'] }), [2015, 2025]);
  const [lo, hi] = eraRange({ ...base, frames: 1, viewport: true }); assert.ok(lo <= hi);
});

test('year score extremes', () => {
  assert.equal(yearScore(2007, 2007), 1);
  assert.equal(yearScore(2007.4, 2007), 1); // slider rounds to whole years
  assert.ok(Math.abs(yearScore(2009, 2007) - 0.607) < 0.01);
  assert.ok(yearScore(1996, 2023) < 0.002);
  assert.ok(yearScore(2000, 2007) < yearScore(2005, 2007));
});

test('site score: first guess 100, last 20, miss 0 (preset default)', () => {
  const sc = (n, won) => (won ? (100 * (5 - n + 1)) / 5 : 0);
  assert.equal(sc(1, true), 100); assert.equal(sc(5, true), 20); assert.equal(sc(5, false), 0);
});

test('pool: size and shape', () => {
  assert.ok(data.snaps.length >= 60, `pool ${data.snaps.length}`);
  assert.ok(data.sites.length >= 20);
  assert.ok(fs.statSync(new URL('./data.json', import.meta.url)).size < 1.5e6);
  const ids = data.sites.map((s) => s.id); assert.equal(new Set(ids).size, ids.length);
  const keys = data.snaps.map((s) => `${s.id}-${s.y}`); assert.equal(new Set(keys).size, keys.length, 'duplicate snapshot');
  for (const s of data.sites) { assert.ok(s.name && /^[a-z0-9-]+(\.[a-z]+)+$/.test(s.dom), s.id); assert.ok(s.about, `${s.id} about`); }
});

test('pool: every snapshot is valid and leak-free', () => {
  const byId = new Map(data.sites.map((s) => [s.id, s]));
  for (const sn of data.snaps) {
    const site = byId.get(sn.id); assert.ok(site, sn.id);
    const tag = `${sn.id}-${sn.y}`;
    assert.ok(Number.isInteger(sn.y) && sn.y >= 1996 && sn.y <= 2025, tag);
    assert.equal(sn.ts.slice(0, 4), String(sn.y), `${tag} ts year`);
    assert.match(sn.url, /^https:\/\/web\.archive\.org\/web\/\d{14}\/https?:\/\//, tag);
    assert.ok(sn.links.length >= 6 || sn.heads.length >= 2, `${tag} too thin`);
    assert.ok(sn.img && fs.existsSync(new URL('./' + sn.img, import.meta.url)), `${tag} missing screenshot`);
    for (const [k, v] of Object.entries(sn.fp)) { assert.ok(v !== undefined && !(typeof v === 'number' && Number.isNaN(v)), `${tag} fp.${k}`); }
    const text = [sn.title, sn.desc, ...sn.heads, ...sn.links];
    for (const t of text) assert.equal(typeof t, 'string', tag);
    assert.equal(new Set(sn.links).size, sn.links.length, `${tag} dup links`);
    const joined = text.join(' \n ');
    assert.doesNotMatch(joined, /undefined|NaN|�|&[a-z]+;/, `${tag} junk`);
    // answer leaks: brand, domain, years, any domain-looking token
    const def = SITES.find((s) => s[0] === sn.id); const red = makeRedactor(def);
    assert.equal(red(joined).replace(/▇+/g, ''), joined.replace(/▇+/g, ''), `${tag} unredacted brand/domain/year in: ${red.re.map((r) => joined.match(r)).flat().filter(Boolean)}`);
    assert.doesNotMatch(joined, /(?<!\d)(?:19[89]\d|20[0-2]\d)(?!\d)/, `${tag} year`);
    // name words (>=4 letters) must not survive
    for (const w of site.name.split(/[^A-Za-z]+/).filter((w) => w.length >= 4 && !/^(the|new|york)$/i.test(w))) {
      assert.doesNotMatch(joined, new RegExp(`\\b${w}`, 'i'), `${tag} name word ${w}`);
    }
  }
});

test('pool: fingerprint window mostly agrees with the true year', () => {
  let ok = 0;
  for (const sn of data.snaps) { const [lo, hi] = eraRange(sn.fp); if (sn.y >= lo && sn.y <= hi) ok++; }
  assert.ok(ok / data.snaps.length >= 0.93, `${ok}/${data.snaps.length}`);
});

test('puzzle(): days 1-120 are valid and the answer is selectable', () => {
  const ids = new Set(data.sites.map((s) => s.id)); const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = puzzleFor(day);
    assert.ok(ids.has(p.id), `day ${day}`);
    const sn = data.snaps.find((s) => s.id === p.id && s.y === p.y); assert.ok(sn, `day ${day} snapshot`);
    assert.equal(p.ts, sn.ts);
    assert.deepEqual(puzzleFor(day), p);
    if (day <= data.snaps.length) assert.ok(!seen.has(`${p.id}-${p.y}`), `repeat on day ${day}`);
    seen.add(`${p.id}-${p.y}`);
  }
  // option labels are distinct and none contains the answer's redaction targets
  assert.equal(new Set(data.sites.map((s) => s.name)).size, data.sites.length);
});

test('pool: difficulty spread across eras and sites', () => {
  const decades = new Set(data.snaps.map((s) => Math.floor(s.y / 10)));
  assert.ok(decades.size >= 3);
  const perSite = {}; for (const s of data.snaps) perSite[s.id] = (perSite[s.id] || 0) + 1;
  assert.ok(Math.max(...Object.values(perSite)) <= 14);
});
