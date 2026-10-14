import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
test('shares are sane', () => {
  assert.ok(data.counties.length >= 60);
  for (const c of data.counties) {
    const s = c.drive + c.carpool + c.transit + c.bike + c.walk + c.wfh + c.other;
    assert.ok(s > 90 && s < 101, `${c.name} sums to ${s}`);
  }
});
