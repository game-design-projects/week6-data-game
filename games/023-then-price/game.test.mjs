import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import game, { fmtPrice, zhMonth, priceScore, sliderRange, explainItem } from './game.js';
import { makeRng, dailyIndex } from '../../engine/core.js';

const data = JSON.parse(readFileSync(new URL('./data.json', import.meta.url)));
const slug = 'then-price';
const mk = (day) => game.puzzle({ data, day, date: String(day), slug, rng: makeRng(`${slug}:${day}`), pick: (a) => a[dailyIndex(slug, day, a.length)] });

test('fmtPrice', () => {
  assert.equal(fmtPrice(0.046), '$0.046');
  assert.equal(fmtPrice(2.272), '$2.27');
});
test('zhMonth', () => assert.equal(zhMonth('1983-03'), '1983 年 3 月'));

test('scoring: perfect, typical, worst, symmetric', () => {
  assert.equal(priceScore(2, 2), 1);
  assert.ok(Math.abs(priceScore(1.6, 1) - Math.exp(-1)) < 1e-9);
  assert.ok(Math.abs(priceScore(1, 1.6) - priceScore(1.6, 1)) < 1e-9);
  assert.ok(priceScore(1.1, 1) > 0.8);
  assert.ok(priceScore(10, 1) < 0.03);
  assert.equal(priceScore(0, 1), 0);
  // a lazy "today's price / 2.5" strategy must not score well on the whole pool
  let tot = 0; let n = 0;
  for (const e of data.pool) for (const k of e.items) { const it = data.items[k]; tot += priceScore(sliderRange(it.s[it.to]).initial, it.s[e.ym]); n++; }
  assert.ok(tot / n < 0.55, `lazy mean ${tot / n}`);
});

test('pool validity over days 1-120', () => {
  const ids = new Set();
  for (let day = 1; day <= 120; day++) {
    const p = mk(day);
    assert.match(p.ym, /^\d{4}-\d{2}$/);
    assert.equal(p.keys.length, 3);
    assert.equal(new Set(p.keys).size, 3, `dup items day ${day}`);
    ids.add(p.ym);
    for (const k of p.keys) {
      const it = data.items[k];
      assert.ok(it, k);
      assert.ok(it.name && it.per, k);
      const then = it.s[p.ym]; const now = it.s[it.to];
      assert.ok(Number.isFinite(then) && then > 0, `${k} ${p.ym}`);
      assert.ok(Number.isFinite(now) && now > 0 && now < 100, `${k} now`);
      const rg = sliderRange(now);
      assert.ok(then > rg.min * 1.2 && then < rg.max / 1.2, `${k} ${p.ym} inside slider`);
      assert.ok(rg.initial > rg.min && rg.initial < rg.max);
      const ex = explainItem(it, data.cpi, p.ym);
      for (const v of Object.values(ex)) assert.ok(Number.isFinite(v), `${k} ${p.ym} explain`);
      assert.ok(ex.mult >= 1.1 && ex.mult <= 15);
      assert.ok(data.cpi[p.ym] > 0 && data.cpi[it.to] > 0);
    }
  }
  assert.ok(data.pool.length >= 60);
  assert.equal(new Set(data.pool.map((e) => e.ym)).size, data.pool.length, 'duplicate months');
});

test('no answer leak in visible static text', () => {
  const blob = JSON.stringify(game.meta) + Object.values(data.items).map((i) => i.name + i.per).join('');
  // the only month named in static copy is the idea's opener; items' names carry no prices
  assert.ok(!/\$\d/.test(Object.values(data.items).map((i) => i.name).join('')));
  assert.ok(blob.includes('1983'));
});
