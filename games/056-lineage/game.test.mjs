import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import game, { compare, aliasesOf, keyName, yearStr, spanStr, poolOf, scoreFor, CONT_ZH } from './game.js';
import { redactTitle, houseTokens, RANK_WORDS } from './build/build-helpers.mjs';
import { makeRng, dailyIndex } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
const H = (first, last, cont) => ({ first, last, cont });

test('era direction and continent', () => {
  const [era, reg] = compare(H(1500, 1700, ['Europe']), H(900, 1100, ['Europe']));
  assert.match(era.text, /偏晚/); assert.equal(reg.state, 'hit');
  const [e2, r2] = compare(H(1000, 1100, ['Asia']), H(1000, 1100, ['Europe']));
  assert.equal(e2.state, 'hit'); assert.equal(r2.state, 'miss');
});
test('aliases, key names and years', () => {
  assert.ok(aliasesOf('House of Bourbon').includes('Bourbon'));
  assert.ok(aliasesOf('Ming dynasty').includes('Ming'));
  assert.ok(aliasesOf('House of Zähringen').includes('Zahringen'));
  assert.equal(keyName('House of Glücksburg (Denmark)'), 'Glücksburg');
  assert.equal(keyName('Imperial House of Japan'), 'Japan');
  assert.equal(yearStr(-500), '前500');
  assert.equal(spanStr({ by: 1000, dy: null }), '1000–?');
  assert.equal(spanStr({ by: 1990, dy: null }), '1990–');
});
test('scoring extremes', () => {
  assert.equal(scoreFor(1, true), 100);
  assert.equal(scoreFor(3, true), 67);
  assert.equal(scoreFor(6, true), 17);
  assert.equal(scoreFor(6, false), 0);
  for (let n = 1; n < 6; n++) assert.ok(scoreFor(n, true) > scoreFor(n + 1, true));
});
test('title redaction yields generic ranks only', () => {
  assert.equal(redactTitle('King of England'), 'King of ▇▇▇');
  assert.equal(redactTitle('Pharaoh'), 'Pharaoh');
  assert.equal(redactTitle('Chinese king'), 'King');
  assert.equal(redactTitle('Seleucid ruler'), null);
  assert.equal(redactTitle('Mughal emperor'), 'Emperor');
});

const TITLE = new RegExp(`^(${[...RANK_WORDS].join('|')})( of ▇▇▇)?$`);
const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

test('house pool is sane', () => {
  assert.ok(data.houses.length >= 60);
  const qs = new Set(), names = new Set();
  for (const h of data.houses) {
    assert.ok(!qs.has(h.q) && !names.has(h.name)); qs.add(h.q); names.add(h.name);
    assert.match(h.q, /^Q\d+$/);
    assert.ok(h.name && h.famous && h.trees.length >= 1);
    assert.ok(Number.isFinite(h.first) && Number.isFinite(h.last) && h.first <= h.last, h.name);
    assert.ok(h.cont.length >= 1 && h.cont.every((c) => CONT_ZH[c]), h.name);
    assert.ok(h.total >= 8 && h.female >= 0 && h.female <= 100, h.name);
    assert.ok(h.avgLife == null || (h.avgLife > 15 && h.avgLife < 100), h.name);
    for (const [t, c] of h.titles) { assert.match(t, TITLE); assert.ok(c > 0); }
  }
});

test('every tree: structure, ranges and no leaks', () => {
  for (const h of data.houses) {
    const toks = houseTokens(h.name).filter((t) => t.length >= 3);
    for (const { tree, names } of h.trees) {
      assert.ok(tree.length >= 8 && tree.length <= 14, h.name);
      assert.ok(names.length >= 4 && new Set(names).size === names.length, h.name);
      tree.forEach((n, i) => {
        assert.ok(Number.isInteger(n.by) && n.by > -3000 && n.by < 2010, `${h.name} by`);
        assert.ok(n.dy == null || (n.dy > n.by && n.dy - n.by < 130), `${h.name} ${n.n} lifespan ${n.by}-${n.dy}`);
        assert.ok(n.p < i && n.p >= -1, `${h.name} parent order`);
        assert.ok(n.n && !/^Q\d+$/.test(n.n));
        if (n.t != null) assert.match(n.t, TITLE, `${h.name} title ${n.t}`);
      });
      assert.ok(tree.filter((n) => n.p === -1).length === 1, `${h.name} single root`);
      const vis = [...tree.map((n) => n.t || ''), ...names, ...h.titles.map((t) => t[0])].map(strip).join(' ');
      for (const t of toks) assert.ok(!vis.includes(t), `${h.name}: visible clue leaks "${t}"`);
    }
  }
});

test('puzzle() for days 1-120 gives a valid, selectable answer', () => {
  const pool = poolOf(data);
  assert.ok(pool.length >= 60);
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const rng = makeRng(`lineage:${day}`);
    const pick = (arr) => arr[dailyIndex('lineage', day, arr.length)];
    const p = game.puzzle({ data, day, date: '2026-10-01', slug: 'lineage', rng, pick });
    const h = data.houses.find((x) => x.q === p.q);
    assert.ok(h, `day ${day}`);
    assert.ok(Number.isInteger(p.t) && h.trees[p.t], `day ${day} tree`);
    assert.deepEqual(JSON.parse(JSON.stringify(p)), p);
    seen.add(`${p.q}/${p.t}`);
  }
  assert.ok(seen.size >= 30);
});
