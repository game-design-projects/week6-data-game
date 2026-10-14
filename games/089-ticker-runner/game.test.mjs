import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { buildCourse, simulate, botJumps, scoreRun } from './game.js';
const data = JSON.parse(fs.readFileSync(new URL('./data.json', import.meta.url)));
test('course has coins and spikes for every day', () => {
  for (const d of data.days) { const c = buildCourse(d.bars); assert.ok(c.coins.length >= 12); assert.ok(c.spikes.length >= 3); }
});
test('bot beats idle runner', () => {
  for (const d of data.days.slice(0, 30)) {
    const c = buildCourse(d.bars);
    const idle = scoreRun(c, simulate(c, [])), bot = scoreRun(c, simulate(c, botJumps(c)));
    assert.ok(bot > idle, `${d.date} ${bot} ${idle}`); assert.ok(bot >= 80, `bot ${bot}`);
  }
});
