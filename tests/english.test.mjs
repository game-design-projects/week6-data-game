// The site is English-only: no Chinese characters or full-width punctuation in any
// file that ships (what scripts/dist.sh deploys: pages, engine, games minus build/ and tests, plus the
// Worker source that wrangler bundles).
//   node --test tests/english.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Han ideographs, CJK symbols/punctuation (。、「」), full-width forms (，：（）！？).
const CJK = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/u;
const TEXT = /\.(js|mjs|json|html|css|svg|txt|csv)$/;
// Files whose CJK text is the content itself (e.g. names in their own script), with the reason.
const ALLOW = {
  'games/013-intersection/data.json': 'the puzzle is reading local street names in their own script (OSM originals); the result shows name:en',
  'games/070-holiday/data.json': 'local holiday and country names for CN, HK and JP are clues, plus their redaction terms',
  'games/021-year-built/data.json': 'CC BY-SA photographer credit must keep the exact username',
  'games/098-described/data.json': 'CC BY-SA photographer credit must keep the exact username',
  'games/101-spotter/data.json': 'CC BY-SA photographer credits must keep the exact names',
  'games/102-trainspotter/data.json': 'CC BY-SA photographer credit must keep the exact username',
};

function shipped() {
  const out = ['index.html', 'play.html'];
  for (const f of readdirSync(path.join(ROOT, 'engine'))) if (/\.(js|css)$/.test(f)) out.push(`engine/${f}`);
  for (const f of readdirSync(path.join(ROOT, 'worker'))) if (/\.js$/.test(f)) out.push(`worker/${f}`);
  const walk = (rel) => {
    for (const e of readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
      const p = `${rel}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== 'build') walk(p); } else if (TEXT.test(e.name) && !e.name.endsWith('.test.mjs')) out.push(p);
    }
  };
  walk('games');
  return out;
}

test('shipped files contain no Chinese text', () => {
  const bad = [];
  for (const rel of shipped()) {
    if (ALLOW[rel]) continue;
    const lines = readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
    const hits = lines.map((l, i) => [i + 1, l]).filter(([, l]) => CJK.test(l));
    if (hits.length) {
      const [n, l] = hits[0];
      const at = l.search(CJK);
      bad.push(`${rel}: ${hits.length} line(s), first at ${n}: …${l.slice(Math.max(0, at - 30), at + 40).trim()}…`);
    }
  }
  console.log(`english: ${bad.length} file(s) with Chinese text`);
  assert.deepEqual(bad, []);
});

test('pages declare lang="en"', () => {
  for (const f of ['index.html', 'play.html']) assert.match(readFileSync(path.join(ROOT, f), 'utf8'), /<html lang="en">/, f);
});
