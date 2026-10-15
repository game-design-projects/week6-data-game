import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import game, { pathKm, maxBulge, liveFromImages, LIVE_HOURS } from './game.js';
import { hazard, solve, pathCost, routeScore, line, decodeGrid } from './route.js';
import { decodePNG, toPuzzle, crop, TIERS, W, H, livePath } from './shape.js';
import { makeRng, dailyIndex, addDays, isoFromDay } from '../../engine/core.js';

const read = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url)));
const data = read('./data.json');
const fx = read('./build/fixture.json');

/** Rebuild a sparse image from the fixture's stored samples (exactly the pixels crop() reads). */
function fixtureImage() {
  const s = zlib.inflateSync(Buffer.from(fx.z, 'base64'));
  const px = new Uint8Array(fx.w * fx.h);
  let k = 0;
  for (let cy = 0; cy < H; cy++) for (let cx = 0; cx < W; cx++) for (let y = 0; y < 25; y += 2) for (let x = 0; x < 25; x += 2) px[(fx.pad + cy * 25 + y) * fx.w + fx.pad + cx * 25 + x] = s[k++];
  return { w: fx.w, h: fx.h, px };
}
const fixOpts = (tier = TIERS[0]) => ({ tier, x0: 30, y0: 30, x1: fx.w, y1: fx.h, step: 30, composite: { lonW: fx.lonW, latN: fx.latN } });

const puzzleOn = (day, d = data) => game.puzzle({ data: d, day, date: isoFromDay(day), slug: 'storm-run', rng: makeRng(`storm-run:${isoFromDay(day)}`), pick: (arr) => arr[dailyIndex('storm-run', day, arr.length)] });

test('hazard is monotone and matches the legend bins', () => {
  let prev = 0;
  for (let L = 0; L <= 15; L++) { assert.ok(hazard(L) >= prev); prev = hazard(L); }
  assert.deepEqual([3, 5, 7, 9, 10].map(hazard), [1, 1.5, 3, 8, 25]);
});

test('solve beats or equals the straight line, path is contiguous and costs add up', () => {
  for (const p of data.puzzles) {
    const g = decodeGrid(p.grid);
    const r = solve(g, data.w, data.h, p.start, p.end);
    assert.ok(r.cost <= r.straight + 1e-9);
    assert.ok(Math.abs(pathCost(g, data.w, r.path) - r.cost) < 1e-6);
    assert.deepEqual(r.path[0], p.start); assert.deepEqual(r.path.at(-1), p.end);
    for (let i = 1; i < r.path.length; i++) assert.ok(Math.abs(r.path[i][0] - r.path[i - 1][0]) <= 1 && Math.abs(r.path[i][1] - r.path[i - 1][1]) <= 1);
  }
});

test('dijkstra finds known optimum on a hand-made grid', () => {
  // 5x3, a wall of level-10 cells (x25) in column 2 with a gap on the top row
  const g = [0, 0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 10, 0, 0];
  const r = solve(g, 5, 3, [0, 2], [4, 2]);
  assert.ok(r.cost < 25 && r.cost > 4);
  assert.ok(r.path.some(([x, y]) => x === 2 && y === 0));
});

test('routeScore extremes: perfect, typical, worst', () => {
  assert.equal(routeScore(10, 10), 100);
  assert.equal(routeScore(10, 11), 87);
  assert.equal(routeScore(10, 12), 76);
  assert.equal(routeScore(10, 20), 35);
  assert.equal(routeScore(10, 1000), 0);
  assert.equal(routeScore(10, 5), 100); // cannot beat the optimum
  // flying straight through every pool puzzle is a poor-but-not-zero score; a perfect route is always 100
  for (const p of data.puzzles) {
    const g = decodeGrid(p.grid), r = solve(g, data.w, data.h, p.start, p.end);
    assert.equal(routeScore(r.cost, r.cost), 100);
    assert.ok(routeScore(r.cost, r.straight) <= 45, `direct too good on ${p.date}`);
  }
});

test('line endpoints', () => {
  const l = line([0, 0], [10, 3]);
  assert.deepEqual(l[0], [0, 0]); assert.deepEqual(l.at(-1), [10, 3]);
});

test('pathKm and maxBulge', () => {
  assert.ok(Math.abs(pathKm([[0, 0], [4, 0]], 0.25, 0) - 111.32) < 0.5);
  assert.ok(pathKm([[0, 0], [4, 0]], 0.25, 60) < pathKm([[0, 0], [4, 0]], 0.25, 0));
  assert.equal(maxBulge([[0, 5], [1, 2], [2, 5]], [0, 5], [2, 5]), -3);
  assert.equal(maxBulge([[0, 5], [1, 8], [2, 5]], [0, 5], [2, 5]), 3);
  assert.equal(maxBulge([[0, 5], [1, 5], [2, 5]], [0, 5], [2, 5]), 0);
});

test('pool: 120 days of puzzle() are all valid', () => {
  assert.ok(data.puzzles.length >= 60);
  assert.equal(new Set(data.puzzles.map((p) => p.date)).size, data.puzzles.length);
  const seen = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = puzzleOn(day);
    const tag = `day ${day} (${p.date})`;
    assert.equal(p.w, 36, tag); assert.equal(p.h, 24, tag);
    assert.match(p.date, /^20(2[2-5])-\d\d-\d\d$/, tag);
    assert.match(p.utc, /^(00|20|21|22|23):00$/, tag);
    assert.equal(p.grid.length, p.w * p.h, tag);
    assert.match(p.grid, /^[0-9a-f]+$/, tag);
    for (const v of [p.lat0, p.lon0, p.cell]) assert.ok(Number.isFinite(v), tag);
    assert.ok(p.lat0 <= 50 && p.lat0 - p.h * p.cell >= 24 && p.lon0 >= -126 && p.lon0 + p.w * p.cell <= -66, `window outside CONUS ${tag}`);
    const g = decodeGrid(p.grid);
    for (const [x, y] of [p.start, p.end]) { assert.ok(Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < p.w && y < p.h, tag); assert.equal(hazard(g[y * p.w + x]), 1, `endpoint not clear ${tag}`); }
    assert.equal(p.start[0], 0); assert.equal(p.end[0], p.w - 1);
    const r = solve(g, p.w, p.h, p.start, p.end);
    assert.ok(Number.isFinite(r.cost) && r.cost >= p.w - 1, tag);
    assert.ok(r.straight / r.cost >= 1.8 - 1e-9, `no real detour needed ${tag}`);
    const wet = g.filter((v) => v >= 4).length / g.length;
    assert.ok(wet >= 0.18 && wet <= 0.5, `coverage ${wet} ${tag}`);
    JSON.stringify(p);
    seen.add(p.date);
  }
  assert.ok(seen.size >= 60);
});

test('data.json puzzle uses no live flag and every date label is a real date', () => {
  for (const p of data.puzzles) { assert.ok(!Number.isNaN(Date.parse(p.date))); assert.equal(p.live, undefined); }
});

test('decodePNG round-trips a synthetic palette PNG (all filter types)', async () => {
  const w = 7, h = 5, px = Uint8Array.from({ length: w * h }, (_, i) => (i * 37) % 23);
  const crc = (b) => zlib.crc32 ? zlib.crc32(b) : 0;
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td) >>> 0); return Buffer.concat([len, td, c]); };
  const rows = [];
  for (let y = 0; y < h; y++) {
    const f = y % 5, row = Buffer.alloc(w + 1); row[0] = f;
    for (let x = 0; x < w; x++) {
      const a = x ? px[y * w + x - 1] : 0, b = y ? px[(y - 1) * w + x] : 0, c = x && y ? px[(y - 1) * w + x - 1] : 0, v = px[y * w + x];
      const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      row[1 + x] = (v - pred) & 255;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', Buffer.alloc(768)), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
  const img = await decodePNG(png);
  assert.equal(img.w, w); assert.equal(img.h, h);
  assert.deepEqual(Array.from(img.px), Array.from(px));
  await assert.rejects(decodePNG(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', Buffer.alloc(13))])));
});

test('toPuzzle on the committed fixture reproduces the snapshot puzzle', () => {
  assert.ok(fs.statSync(new URL('./build/fixture.json', import.meta.url)).size <= 50 * 1024);
  const p = toPuzzle(fixtureImage(), fx.date, fx.hh, fixOpts());
  assert.ok(p);
  const snap = data.puzzles.find((q) => q.date === fx.date);
  assert.equal(p.grid, snap.grid);
  assert.deepEqual(p.start, snap.start); assert.deepEqual(p.end, snap.end);
  assert.equal(p.lat0, snap.lat0); assert.equal(p.lon0, snap.lon0);
  assert.equal(p.utc, `${fx.hh}:00`);
});

test('crop levels: palette 7..21 -> 1..15, others 0', () => {
  const img = { w: 900, h: 600, px: new Uint8Array(900 * 600).fill(10) };
  assert.ok(crop(img, 0, 0).every((v) => v === 4));
  img.px.fill(3); assert.ok(crop(img, 0, 0).every((v) => v === 0));
  img.px.fill(255); assert.ok(crop(img, 0, 0).every((v) => v === 0));
});

test('liveFromImages: picks a window, flags live, null on a quiet day', () => {
  const img = fixtureImage();
  const quiet = { w: 900, h: 600, px: new Uint8Array(900 * 600) };
  assert.equal(liveFromImages('2026-10-14', [{ hh: '23', img: quiet }]), null);
  // paste the fixture into an otherwise empty full-size composite and run the real (default-bounds) search
  const snap = data.puzzles.find((q) => q.date === fx.date);
  const full = { w: 6000, h: 2600, px: new Uint8Array(6000 * 2600) };
  const ox = Math.round((snap.lon0 + 126) / 0.01), oy = Math.round((50 - snap.lat0) / 0.01);
  for (let y = 0; y < fx.h; y++) for (let x = 0; x < fx.w; x++) full.px[(oy - fx.pad + y) * 6000 + ox - fx.pad + x] = img.px[y * fx.w + x];
  const lp = liveFromImages('2026-10-14', [{ hh: '21', img: quiet }, { hh: '23', img: full }]);
  assert.ok(lp && lp.live === true && lp.date === '2026-10-14' && lp.utc === '23:00');
  assert.equal(lp.grid, snap.grid); assert.equal(lp._sc, undefined);
  const p = toPuzzle(img, '2026-10-14', '23', fixOpts());
  assert.ok(p && p._sc > 0);
  assert.deepEqual(LIVE_HOURS, ['18', '21', '23']);
  assert.equal(livePath('2026-10-14', '23'), 'https://mesonet.agron.iastate.edu/archive/data/2026/10/14/GIS/uscomp/n0r_202610142300.png');
});

test('puzzle() prefers data.live and keeps grid size', () => {
  const live = { ...data.puzzles[0], date: '2026-10-14', live: true };
  const p = puzzleOn(15, { ...data, live });
  assert.equal(p.date, '2026-10-14'); assert.equal(p.live, true); assert.equal(p.w, 36);
  assert.equal(puzzleOn(15).live, undefined);
  assert.equal(addDays('2026-10-15', -1), '2026-10-14');
});
