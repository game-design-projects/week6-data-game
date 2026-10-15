import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import g, { redactName, band, roundScore, ROUNDS } from './game.js';
import { ent, list } from './build/lib.mjs';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const mk = async () => (await import('../../engine/core.js'));

test('redactName hides title and its words', () => {
  const o = redactName('In Pandemic, players fight. The Pandemic board is big.', 'Pandemic');
  assert.ok(!/pandemic/i.test(o));
  assert.ok(o.includes('players fight'));
});
test('redactName handles multiword, accents, punctuation', () => {
  assert.ok(!/mars|terraform/i.test(redactName('Terraforming Mars is set on Mars colonies.', 'Terraforming Mars')));
  assert.ok(!/orl/i.test(redactName('Around Orleans and Orléans, you build.', 'Orléans')));
  assert.ok(!/tzolk/i.test(redactName("Tzolkin presents; Tzolk'in rules.", "Tzolk'in: The Mayan Calendar")));
  assert.ok(!/sid|meier/i.test(redactName("Sid Meier's Civilization is a game.", "Sid Meier's Civilization: The Board Game")));
});
test('band', () => { assert.match(band(1.2), /light/); assert.match(band(4.5), /heavy/); });
test('ent decodes mojibake and named entities', () => {
  assert.equal(ent('Orl&eacute;ans &amp; caf&#195;&#169; &mdash; x&#10;y'), 'Orléans & café — x y');
});
test('list parses python-style lists', () => {
  assert.deepEqual(list(`['Card Game', "Children's Game", 'Dice']`), ['Card Game', "Children's Game", 'Dice']);
});

test('scoring extremes', () => {
  assert.equal(roundScore(3, 3), 100);
  assert.ok(roundScore(1, 5) < 1);
  assert.ok(Math.abs(roundScore(2.5, 3) - 36.8) < 0.5);
  assert.ok(roundScore(3.1, 3) > 80);
});

test('pool fields sane', () => {
  assert.ok(data.games.length >= 60);
  const ids = new Set();
  for (const x of data.games) {
    assert.ok(!ids.has(x.id)); ids.add(x.id);
    assert.ok(x.name && x.desc.length >= 100, x.name);
    assert.ok(x.weight > 1 && x.weight <= 5 && x.votes >= 150);
    assert.ok(x.time > 0 && x.minp > 0 && x.maxp >= x.minp && x.age >= 0 && x.year <= 2026 && x.year !== 0, x.name);
    assert.ok(Array.isArray(x.mechs) && Array.isArray(x.cats));
    for (const s of [...x.mechs, ...x.cats]) assert.ok(s && !/["']\s*$|^\s*["']/.test(s), `${x.name}:${s}`);
    assert.ok(!/[�&<>]\w*;|<\w/.test(x.desc) && !/[ÃÂ]/.test(x.desc), x.name);
    assert.ok(Number.isFinite(x.rating) && Number.isFinite(x.rank), x.name);
  }
});

test('puzzle days 1-120: valid, distinct rounds, no leaks', async () => {
  const core = await mk();
  const byId = new Map(data.games.map((x) => [x.id, x]));
  const STOPW = /^(the|and|of|for|game|games|board|card|with|from|second|third|edition|new|old|one|two|sea|war|art|hex|big|age|all|you|who|its|her|his|out|red|day|man)$/i;
  for (let day = 1; day <= 120; day++) {
    const date = core.addDays('2026-10-01', day - 1);
    const p = g.puzzle({ data, day, date, slug: 'weight', rng: core.makeRng(`weight:${date}`), pick: (arr) => arr[core.dailyIndex('weight', day, arr.length)] });
    assert.equal(p.ids.length, ROUNDS);
    assert.equal(new Set(p.ids).size, ROUNDS, `day ${day}`);
    const gs = p.ids.map((id) => byId.get(id));
    gs.forEach((x) => assert.ok(x, `day ${day}`));
    for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) assert.ok(Math.abs(gs[i].weight - gs[j].weight) >= 0.6, `day ${day} gap`);
    for (const x of gs) {
      const r = redactName(x.desc, x.name);
      assert.ok(!r.toLowerCase().includes(x.name.toLowerCase()), `${x.name} full title visible`);
      for (const w of x.name.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4 && !STOPW.test(w))) {
        const fw = w.normalize('NFD').replace(/\p{M}/gu, '');
        assert.ok(!new RegExp(`(?<![\\p{L}])${fw}`, 'iu').test(r.normalize('NFD').replace(/\p{M}/gu, '')), `day ${day} ${x.name} leaks "${w}"`);
      }
      assert.ok(!/▇▇▇\p{L}/u.test(r), `fragment in ${x.name}`);
    }
  }
});
test('every game redacts cleanly across the whole pool', () => {
  for (const x of data.games) {
    const r = redactName(x.desc, x.name);
    assert.ok(!/▇▇▇\p{L}|\p{L}▇▇▇/u.test(r), `fragment: ${x.name}: ${r.match(/.{0,12}(▇▇▇\p{L}|\p{L}▇▇▇).{0,8}/u)?.[0]}`);
    assert.ok(r.replace(/▇/g, '').trim().length > 60, x.name);
  }
});

