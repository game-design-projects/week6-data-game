import test from 'node:test'; import assert from 'node:assert/strict';
import { eraNotes, tld } from './game.js';
const base = { kb: 20, tables: 0, fonts: 0, imgs: 3, scripts: 1, frames: 0, flash: 0, marquee: 0, iframes: 0, viewport: false, html5: false, css: 0, fw: [], og: false, https: 0 };
test('tld', () => assert.equal(tld('bbc.co.uk'), '.co.uk'));
test('old page', () => { const n = eraNotes({ ...base, tables: 12, fonts: 9, flash: 1 }); assert.ok(n.some((x) => x.includes('table'))); assert.ok(n.some((x) => x.includes('Flash'))); });
test('modern page', () => { const n = eraNotes({ ...base, viewport: true, fw: ['react'], og: true }); assert.ok(n.some((x) => x.includes('viewport'))); assert.ok(n.some((x) => x.includes('框架'))); });
test('empty', () => assert.equal(eraNotes(base).length, 1));
