import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeOf, scoreGuess } from './game.js';
test('gradeOf', () => { assert.equal(gradeOf(13), 'A'); assert.equal(gradeOf(14), 'B'); assert.equal(gradeOf(27), 'B'); assert.equal(gradeOf(28), 'C'); });
test('scoreGuess', () => { assert.equal(scoreGuess(10, 10), 100); assert.ok(scoreGuess(20, 10) < scoreGuess(12, 10)); });
