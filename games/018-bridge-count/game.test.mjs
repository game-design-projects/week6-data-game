import test from 'node:test'; import assert from 'node:assert/strict';
import { weatherLabel, total } from './game.js';
test('weatherLabel', () => {
  assert.equal(weatherLabel(0), '晴天');
  assert.equal(weatherLabel(3), '阴天');
  assert.equal(weatherLabel(63, 0, 0.8), '大雨');
  assert.equal(weatherLabel(73, 1), '下雪');
  assert.equal(weatherLabel(95), '雷暴');
});
test('total', () => assert.equal(total([1, 2, 3]), 6));
