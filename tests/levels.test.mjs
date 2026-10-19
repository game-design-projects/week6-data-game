// The shipped level file and images: enough days, every region inside its painting, answers that
// match the region, images where the game will look for them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { EPOCH, LEVELS } from '../web/levels.js';
import { distance } from '../web/color.js';
import { regionIndices } from '../web/painting.js';

const web = new URL('../web/', import.meta.url);
const survey = readFileSync(new URL('../data/xkcd-rgb.txt', import.meta.url), 'utf8').split('\n')
  .filter(l => l.trim() && !l.startsWith('#')).map(l => { const [name, hex] = l.split('\t'); return { name: name.trim(), hex: hex.trim().toUpperCase() }; });

/** Width and height from a JPEG's start-of-frame marker. */
function jpegSize(buf) {
  for (let i = 2; i < buf.length;) {
    const marker = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

test('at least a week of levels, starting on a real date', () => {
  assert.ok(LEVELS.length >= 7, `${LEVELS.length} levels`);
  assert.match(EPOCH, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Set(LEVELS.map(l => l.id)).size, LEVELS.length, 'no painting repeats');
});
test('every level has its two images at the size it says', () => {
  for (const l of LEVELS) {
    for (const name of [`${l.id}.jpg`, `${l.id}-full.jpg`]) {
      const file = new URL(`paintings/${name}`, web);
      assert.ok(existsSync(file), `missing ${name}`);
      assert.deepEqual(jpegSize(readFileSync(file)), { w: l.w, h: l.h }, name);
    }
  }
});
test('every region is inside its painting and a sensible size', () => {
  for (const l of LEVELS) {
    const idx = regionIndices(l.mask);
    assert.ok(idx.length > 0);
    for (let i = 1; i < idx.length; i++) assert.ok(idx[i] > idx[i - 1], `${l.id}: runs out of order`);
    assert.ok(idx[idx.length - 1] < l.w * l.h, `${l.id}: region runs off the image`);
    const area = idx.length / (l.w * l.h);
    assert.ok(Math.abs(area - l.area) < 0.002 && area > 0.02 && area < 0.25, `${l.id}: area ${area}`);
  }
});
test('answers are hex colors, and the crowd name is the nearest survey color', () => {
  for (const l of LEVELS) {
    assert.match(l.hex, /^#[0-9A-F]{6}$/);
    const nearest = survey.reduce((b, c) => (distance(c.hex, l.hex) < distance(b.hex, l.hex) ? c : b));
    assert.ok(survey.some(c => c.name === l.crowd), `${l.id}: ${l.crowd} is not a survey name`);
    const d = distance(survey.find(c => c.name === l.crowd).hex, l.hex);
    assert.ok(d - distance(nearest.hex, l.hex) < 1e-6, `${l.id}: ${l.crowd} is not the nearest name (${nearest.name} is)`);
  }
});
test('every painting is credited and linked', () => {
  for (const l of LEVELS) {
    assert.ok(l.title && l.artist, l.id);
    assert.match(l.url, /^https:\/\/www\.artic\.edu\/artworks\/\d+$/);
  }
});
test('the same artist never comes back within three days', () => {
  for (let i = 1; i < LEVELS.length; i++) {
    for (let j = Math.max(0, i - 3); j < i; j++) assert.notEqual(LEVELS[i].artist, LEVELS[j].artist, `days ${j + 1} and ${i + 1}`);
  }
});
