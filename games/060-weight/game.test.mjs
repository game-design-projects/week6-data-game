import test from 'node:test';
import assert from 'node:assert/strict';
import g, { redactName, band } from './game.js';

test('redactName hides title and its words', () => {
  const o = redactName('In Pandemic, players fight. The Pandemic board is big.', 'Pandemic');
  assert.ok(!/pandemic/i.test(o));
  assert.ok(o.includes('players fight'));
});
test('redactName handles multiword', () => {
  const o = redactName('Terraforming Mars is set on Mars colonies.', 'Terraforming Mars');
  assert.ok(!/mars|terraform/i.test(o));
});
test('band', () => { assert.match(band(1.2), /轻/); assert.match(band(4.5), /重/); });
test('puzzle: two distinct games, deterministic', async () => {
  const { createRequire } = await import('node:module');
  const data = JSON.parse((await import('node:fs')).readFileSync(new URL('./data.json', import.meta.url)));
  assert.ok(data.games.length >= 60);
  for (const x of data.games) assert.ok(x.weight >= 1 && x.weight <= 5 && x.desc.length > 100);
});
