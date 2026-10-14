import test from 'node:test';
import assert from 'node:assert/strict';
import { redact } from './game.js';
test('redact hides repo name tokens', () => {
  assert.equal(redact('fix linux kernel bug', 'linux'), 'fix ▇▇▇ kernel bug');
  assert.equal(redact('Update React docs', 'react'), 'Update ▇▇▇ docs');
  assert.equal(redact('home assistant', 'home-assistant'), '▇▇▇ ▇▇▇');
});
