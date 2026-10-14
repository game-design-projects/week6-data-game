import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedCount } from './game.js';
test('sharedCount', () => { assert.equal(sharedCount(['A', 'B', 'C'], ['B', 'C', 'D']), 2); assert.equal(sharedCount([], ['A']), 0); });
