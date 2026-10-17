import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upstreamTarget, secondsUntilNextUtcDay } from '../worker/allow.js';

test('upstreamTarget allows https hosts on the list only', () => {
  assert.equal(upstreamTarget('https://api.open-meteo.com/v1/forecast?x=1')?.hostname, 'api.open-meteo.com');
  assert.equal(upstreamTarget('https://earthquake.usgs.gov/fdsnws/event/1/query')?.hostname, 'earthquake.usgs.gov');
  assert.equal(upstreamTarget('http://crt.sh/?q=x'), null);
  assert.equal(upstreamTarget('https://evil.example.com/'), null);
  assert.equal(upstreamTarget('https://crt.sh.evil.example/'), null);
  assert.equal(upstreamTarget('/relative/path'), null);
  assert.equal(upstreamTarget(null), null);
});

test('secondsUntilNextUtcDay counts down to 00:00 UTC, at least a minute', () => {
  const noon = Date.UTC(2026, 9, 17, 12, 0, 0);
  assert.equal(secondsUntilNextUtcDay(noon), 12 * 3600);
  const almostMidnight = Date.UTC(2026, 9, 17, 23, 59, 50);
  assert.equal(secondsUntilNextUtcDay(almostMidnight), 60);
});
