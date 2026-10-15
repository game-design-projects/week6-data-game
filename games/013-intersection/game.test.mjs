import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import game, { scriptsOf, commonWord, patternsIn, scoreFor } from './game.js';
import { findJunctions, leaks, baseKey, chooseJunction } from './build/build.mjs';
import { makeRng, dailyIndex } from '../../engine/core.js';

const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

test('scripts', () => {
  assert.deepEqual(scriptsOf(['长安街', '王府井大街']), ['汉字']);
  assert.match(scriptsOf(['Rue de Rivoli', 'Avenue de l’Opéra'])[0], /é/);
  assert.ok(scriptsOf(['Тверская улица']).includes('西里尔字母'));
  assert.match(scriptsOf(['Oxford Street'])[0], /无变音/);
});
test('common word', () => {
  assert.deepEqual(commonWord(['Rue A', 'Rue B', 'Foo']), { word: 'Rue', count: 2 });
  assert.equal(commonWord(['A one', 'B two']), null);
});
test('patterns', () => {
  assert.match(patternsIn(['Rue Dauphine', 'Quai de Conti'])[0].text, /法语/);
  assert.match(patternsIn(['Torstraße'])[0].text, /德语/);
  assert.match(patternsIn(['West 49th Street', '5th Avenue'])[0].text, /北美/);
  assert.equal(patternsIn(['Zzz']).length, 0);
});
test('scoring extremes', () => {
  assert.equal(scoreFor(1, true), 100);
  assert.equal(scoreFor(3, true), 67);
  assert.equal(scoreFor(6, true), 17);
  assert.equal(scoreFor(6, false), 0);
  for (let n = 1; n < 6; n++) assert.ok(scoreFor(n, true) > scoreFor(n + 1, true));
});
test('junctions', () => {
  const w = (n, g, en) => ({ n, g, en });
  const c = [0, 0];
  const J = findJunctions([w('A', [c, [1, 1]]), w('B', [c, [1, 2]]), w('C', [c, [2, 2]]), w('D', [[3, 3], c]), w('E', [[5, 5], [6, 6]])]);
  assert.equal(J.length, 1); assert.equal(J[0].names.size, 4);
  // North/South halves of one street and a same-street-in-two-scripts pair count once
  const J2 = findJunctions([w('East 1st Street', [c, [1, 1]]), w('West 1st Street', [c, [1, 2]]), w('Main', [c, [2, 2]]), w('প্রগতি সরণী', [c, [2, 3]], 'Pragati Sarani'), w('Pragati Sarani', [c, [3, 3]])], 3);
  assert.equal(J2[0].names.size, 3);
  assert.equal(baseKey('Sherrard Street Lower'), baseKey('Sherrard Street Upper'));
});
test('leak detection', () => {
  const c = { city: 'Paris', zh: '巴黎', country: '法国' };
  assert.ok(leaks('Rue de Paris', c, 'France'));
  assert.ok(leaks('Avenue de France', c, 'France'));
  assert.ok(leaks('巴黎路', c, 'France'));
  assert.ok(!leaks('Rue Dauphine', c, 'France'));
  const ways = [{ n: 'Rue de Paris', g: [[0, 0], [1, 1]] }, { n: 'B', g: [[0, 0], [1, 2]] }, { n: 'C', g: [[0, 0], [2, 2]] }, { n: 'D', g: [[0, 0], [3, 3]] }];
  assert.equal(chooseJunction(ways, { ...c, lat: 0, lng: 0 }, 'France'), null);
});

test('pool: 120 days of valid puzzles', () => {
  assert.ok(data.puzzles.length >= 60, `pool ${data.puzzles.length}`);
  const ids = data.puzzles.map((c) => c.city);
  assert.equal(new Set(ids).size, ids.length, 'duplicate city ids');
  const byId = new Map(data.puzzles.map((c) => [c.city, c]));
  const countryEn = (cc) => new Intl.DisplayNames(['en'], { type: 'region' }).of(cc);
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const date = new Date(Date.UTC(2026, 9, day)).toISOString().slice(0, 10);
    const rng = makeRng(`intersection:${date}`);
    const pick = (arr) => arr[dailyIndex('intersection', day, arr.length)];
    const pz = game.puzzle({ data, day, date, slug: 'intersection', rng, pick });
    assert.ok(byId.has(pz.city), `day ${day}: answer ${pz.city} missing`);
    seen.add(pz.city);
  }
  assert.ok(seen.size >= 40, 'too little variety');
  for (const c of data.puzzles) {
    const tag = c.city;
    for (const k of ['city', 'zh', 'country', 'continent', 'cc']) assert.ok(typeof c[k] === 'string' && c[k].trim() && !/undefined|NaN/.test(c[k]), `${tag}.${k}`);
    assert.match(c.cc, /^[A-Z]{2}$/);
    assert.ok(Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180, `${tag} centre`);
    assert.ok(Math.abs(c.junction[0] - c.lat) < 0.04 && Math.abs(c.junction[1] - c.lng) < 0.06, `${tag} junction far from centre`);
    assert.ok(c.streets.length >= 3 && c.streets.length <= 6, `${tag} street count`);
    const names = c.streets.map((s) => s.n);
    assert.equal(new Set(names.map(baseKey)).size, names.length, `${tag} duplicate streets`);
    for (const s of c.streets) {
      assert.ok(s.n && s.n.trim() === s.n && !/undefined|NaN|▇/.test(s.n), `${tag} bad name ${s.n}`);
      assert.ok(!leaks(s.n, c, countryEn(c.cc)), `${tag}: street "${s.n}" spells the city/country`);
    }
  }
  // distinct labels in the autocomplete (an answer label that differs from the rest would be a tell)
  const labels = data.puzzles.map((c) => c.zh);
  assert.equal(new Set(labels).size, labels.length, 'duplicate zh labels');
});
test('static page text has no answer', () => {
  assert.ok(!/city|answer/i.test(game.meta.tagline));
});
