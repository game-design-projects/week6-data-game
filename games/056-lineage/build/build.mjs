// raw Wikidata house-member dumps -> data.json (family trees with names hidden at play time)
import fs from 'node:fs';
const dir = new URL('./raw/', import.meta.url).pathname;
const houses = JSON.parse(fs.readFileSync(dir + 'houselist.json', 'utf8'));
const id = (u) => u?.value.split('/').pop();
const yr = (s) => { const m = /^(-?\d+)-/.exec(s || ''); return m ? parseInt(m[1], 10) : null; };
const TITLE_RANK = [/emperor|empress|augustus|caesar|basileus|negus|tsar|czar|kaiser|shah|pharaoh|mikado|tenno|caliph/i, /king|queen|sultan|khan|monarch|raja|maharaja|emir|doge/i, /grand duke|archduke|elector|duke|duchess|prince|princess|despot|margrave|landgrave/i, /count|countess|lord|regent|governor|viscount|baron/i];
const FEMALE = 'Q6581072';

import { redactTitle } from './build-helpers.mjs';
const rankOf = (t) => { const i = TITLE_RANK.findIndex((r) => r.test(t)); return i < 0 ? 9 : i; };
const HON = /^(saint|st\.?|sultan|shah|king|queen|prince|princess|duke|duchess|count|emperor|empress|lord|sir|lady|infante|infanta|archduke|archduchess|grand|margrave|abu|al|ibn)$/i;
const given = (n) => n.replace(/\(.*?\)/g, '').replace(/,.*$/, '').trim().split(/\s+/).filter((w) => !HON.test(w))[0] || '';

const out = [];
for (const h of houses) {
  const f = dir + `house-${h.qid}.json`;
  if (!fs.existsSync(f)) continue;
  let rows;
  try { rows = JSON.parse(fs.readFileSync(f, 'utf8')).results.bindings; } catch { continue; }
  const P = new Map();
  for (const r of rows) {
    const pid = id(r.p);
    if (!P.has(pid)) {
      P.set(pid, { id: pid, name: r.pLabel?.value || pid, by: yr(r.b?.value), dy: yr(r.d?.value), f: id(r.f), m: id(r.m), fem: id(r.g) === FEMALE, sl: +(r.sl?.value || 0), titles: new Set(), cont: new Set() });
    }
    const p = P.get(pid);
    if (r.titleLabel && !/^Q\d+$/.test(r.titleLabel.value)) p.titles.add(r.titleLabel.value);
    if (r.contLabel) p.cont.add(r.contLabel.value);
    if (r.d && p.dy == null) p.dy = yr(r.d.value);
  }
  const people = [...P.values()].filter((p) => p.by != null && !/^Q\d+$/.test(p.name) && p.by > -3000 && p.by < 2010);
  const byId = new Map(people.map((p) => [p.id, p]));
  for (const p of people) { p.par = byId.has(p.f) ? p.f : byId.has(p.m) ? p.m : null; p.kids = []; }
  for (const p of people) if (p.par) byId.get(p.par).kids.push(p);
  // best root: biggest descendant subtree
  const size = (p, seen = new Set()) => { if (seen.has(p.id)) return 0; seen.add(p.id); return 1 + p.kids.reduce((s, k) => s + size(k, seen), 0); };
  const roots = people.filter((p) => !p.par && p.kids.length).map((p) => ({ p, n: size(p) })).sort((a, b) => b.n - a.n);
  if (!roots.length || roots[0].n < 8) continue;
  // BFS pick up to 14 nodes, preferring famous (many sitelinks) members, but always keeping connectivity
  const root = roots[0].p;
  const pick = [root], seen = new Set([root.id]);
  const frontier = [...root.kids];
  while (pick.length < 14 && frontier.length) {
    frontier.sort((a, b) => (b.sl + b.kids.length * 3) - (a.sl + a.kids.length * 3));
    const nx = frontier.shift();
    if (seen.has(nx.id)) continue;
    seen.add(nx.id); pick.push(nx); frontier.push(...nx.kids);
  }
  pick.sort((a, b) => a.by - b.by);
  const idx = new Map(pick.map((p, i) => [p.id, i]));
  const nodes = pick.map((p) => {
    const ts = [...p.titles].sort((a, b) => rankOf(a) - rankOf(b));
    return { n: p.name, by: p.by, dy: p.dy, w: p.fem ? 1 : 0, p: p.par && idx.has(p.par) ? idx.get(p.par) : -1, t: ts[0] ? redactTitle(ts[0]) : null, tr: ts[0] || null };
  });
  // parent must precede child in order for rendering; fix by re-sorting topologically
  const order = []; const add = (i) => { if (order.includes(i)) return; order.push(i); nodes.forEach((n, j) => n.p === i && add(j)); };
  nodes.forEach((n, i) => n.p === -1 && add(i));
  const remap = new Map(order.map((o, k) => [o, k]));
  const tree = order.map((o) => ({ ...nodes[o], p: nodes[o].p < 0 ? -1 : remap.get(nodes[o].p) }));
  // house-wide stats from ALL dated members
  const all = people;
  const births = all.map((p) => p.by).sort((a, b) => a - b);
  const lifespans = all.filter((p) => p.dy != null && p.dy >= p.by && p.dy - p.by < 110).map((p) => p.dy - p.by);
  const conts = {};
  for (const p of all) for (const c of p.cont) conts[c] = (conts[c] || 0) + 1;
  const cont = Object.entries(conts).sort((a, b) => b[1] - a[1]).map((e) => e[0]).slice(0, 2);
  const titleCount = {};
  for (const p of all) for (const t of p.titles) { const k = redactTitle(t); titleCount[k] = (titleCount[k] || 0) + 1; }
  const topTitles = Object.entries(titleCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, c]) => [t, c]);
  const famous = [...all].sort((a, b) => b.sl - a.sl)[0];
  out.push({
    q: h.qid, name: h.name, total: all.length, tree,
    first: births[Math.floor(births.length * 0.05)], last: births[Math.floor(births.length * 0.95)],
    avgLife: lifespans.length >= 4 ? Math.round(lifespans.reduce((a, b) => a + b, 0) / lifespans.length) : null,
    female: Math.round((100 * all.filter((p) => p.fem).length) / all.length),
    cont, titles: topTitles, famous: famous.name, names: [...new Set(pick.map((p) => given(p.name)).filter(Boolean))].slice(0, 9),
  });
}
// keep houses whose tree has ≥ 7 nodes and at least 4 given names; stable order by id
const keep = out.filter((h) => !/Elros/.test(h.name)).filter((h) => h.tree.length >= 7 && h.names.length >= 4).sort((a, b) => a.q.localeCompare(b.q, 'en', { numeric: true }));
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ houses: keep, fetched: new Date().toISOString().slice(0, 10) }));
console.log('houses kept', keep.length, 'of', out.length, 'bytes', fs.statSync(new URL('../data.json', import.meta.url)).size);
