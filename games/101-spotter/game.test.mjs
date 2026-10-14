import test from 'node:test';
import assert from 'node:assert/strict';
import { quarterOf, maker, decoys } from './game.js';
import { makeRng } from '../../engine/core.js';

test('quarterOf maps December to the winter bucket', () => {
  assert.equal(quarterOf('2020-12-31'), 0);
  assert.equal(quarterOf('2020-01-05'), 0);
  assert.equal(quarterOf('2019-07-01'), 2);
});
test('maker', () => assert.equal(maker('Boeing 737-800'), 'Boeing'));
test('decoys exclude answer, prefer same group', () => {
  const rng = makeRng ? makeRng(1) : { shuffle: (a) => a };
  const d = decoys(rng, ['Boeing 737', 'Boeing 777', 'Airbus A320', 'Boeing 747', 'Embraer E190'], 'Boeing 737', 3, maker);
  assert.equal(d.length, 3);
  assert.ok(!d.includes('Boeing 737'));
  assert.ok(d.includes('Boeing 777') && d.includes('Boeing 747'));
});
