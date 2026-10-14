// raw NYPL "What's on the Menu?" CSVs -> data.json (pool of menus with 4 priced dishes each)
import fs from 'node:fs';
import { parse } from './csv.mjs';
const R = (f) => parse(fs.readFileSync(new URL(`./raw/${f}`, import.meta.url), 'utf8'));
const rows = (t) => { const [h, ...r] = t; return r.map((x) => Object.fromEntries(h.map((k, i) => [k, x[i]]))); };

const menus = rows(R('Menu.csv'));
const pages = rows(R('MenuPage.csv'));
const dishes = new Map(rows(R('Dish.csv')).map((d) => [d.id, d]));
console.error('menus', menus.length, 'pages', pages.length, 'dishes', dishes.size);

const cur = {};
for (const m of menus) cur[m.currency] = (cur[m.currency] || 0) + 1;
console.error('currency', cur);

const okMenu = new Map();
for (const m of menus) {
  const y = +m.date.slice(0, 4);
  if (!(y >= 1880 && y <= 1990)) continue;
  if (m.currency && m.currency !== 'Dollars') continue;
  if (!m.sponsor || m.sponsor.length > 48 || !m.place) continue;
  if (!m.currency && !/(, ?\[?[A-Z]{2}\]?;?\s*$|NEW YORK|\bN\.? ?Y\b|U\.? ?S\.? ?A?)/.test(m.place.toUpperCase())) continue;
  okMenu.set(m.id, { id: m.id, year: y, sponsor: m.sponsor.trim(), place: m.place.replace(/[;\[\]]/g, '').trim(), event: (m.event || '').replace(/[\[\]?;]/g, '').trim(), venue: m.venue, items: [] });
}
const pageMenu = new Map(pages.filter((p) => okMenu.has(p.menu_id)).map((p) => [p.id, p.menu_id]));

// stream MenuItem
const items = R('MenuItem.csv');
const [h, ...rest] = items;
const ix = Object.fromEntries(h.map((k, i) => [k, i]));
for (const r of rest) {
  const mid = pageMenu.get(r[ix.menu_page_id]);
  if (!mid || !r[ix.price] || r[ix.high_price]) continue;
  const price = +r[ix.price];
  const d = dishes.get(r[ix.dish_id]);
  if (!d || !(price >= 0.02 && price <= 60)) continue;
  const name = d.name.trim();
  if (name.length < 4 || name.length > 38 || /\d|[^\x20-\x7e]/.test(name)) continue;
  if (+d.times_appeared < 3) continue;
  okMenu.get(mid).items.push({ name, price, dish: d.id });
}

function rngFn(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); }
const rnd = rngFn(24);
const cands = [];
for (const m of okMenu.values()) {
  // unique names & distinct prices
  const seen = new Set(); const it = [];
  for (const i of m.items) { const k = i.name.toLowerCase(); if (seen.has(k)) continue; seen.add(k); it.push(i); }
  if (it.length < 12) continue;
  const prices = new Set(it.map((i) => i.price));
  if (prices.size < 6) continue;
  // choose 4 items with clearly different prices: sort by price, take quantiles
  it.sort((a, b) => a.price - b.price);
  const q = [0.1, 0.4, 0.7, 0.95].map((f) => it[Math.floor(f * (it.length - 1))]);
  if (new Set(q.map((x) => x.price)).size < 4) continue;
  cands.push({ m, picks: q, n: it.length });
}
console.error('candidates', cands.length);
// stratify by decade, 8 per decade max
const byDec = {};
for (const c of cands) (byDec[Math.floor(c.m.year / 10)] ||= []).push(c);
const out = [];
for (const dec of Object.keys(byDec).sort()) {
  const arr = byDec[dec].map((x) => [rnd(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, 14);
  for (const c of arr) {
    // shuffle the 4 picks, first is the anchor
    const p = c.picks.map((x) => [rnd(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    out.push({ id: +c.m.id, y: c.m.year, who: c.m.sponsor, where: c.m.place, ev: c.m.event, n: c.n, d: p.map((x) => [x.name, x.price]) });
  }
  console.error(dec, arr.length);
}
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ menus: out }));
console.error('wrote', out.length);
