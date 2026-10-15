// raw Wikidata house-member dumps (build/raw/, from fetch.mjs) -> data.json
// Each house gets up to MAX_TREES disjoint family trees; titles are reduced to a generic rank vocabulary.
import fs from 'node:fs';
import { redactTitle, givenName, houseTokens } from './build-helpers.mjs';
const dir = new URL('./raw/', import.meta.url).pathname;
const houses = JSON.parse(fs.readFileSync(dir + 'houselist.json', 'utf8'));
const MAX_TREES = 3, TREE_CAP = 14, MIN_TREE = 8;
const id = (u) => u?.value.split('/').pop();
const yr = (s) => { const m = /^(-?\d+)-/.exec(s || ''); return m ? parseInt(m[1], 10) : null; };
const FEMALE = 'Q6581072';
const RANK_ORDER = ['Emperor', 'Empress', 'Tsar', 'Shah', 'Sultan', 'Caliph', 'Pharaoh', 'Negus', 'King', 'Queen', 'Khan', 'Grand Duke', 'Archduke', 'Elector', 'Duke', 'Duchess', 'Crown Prince', 'Prince', 'Princess', 'Margrave', 'Landgrave', 'Count', 'Countess', 'Regent', 'Doge', 'Consort', 'Pretender', 'Viscount', 'Marquess'];
const rankOf = (t) => { const i = RANK_ORDER.indexOf(t.replace(/ of ▇▇▇$/, '')); return i < 0 ? 99 : i; };
const CONT = { Eurasia: ['Europe', 'Asia'], 'Afro-Eurasia': ['Europe', 'Asia', 'Africa'] };
// drop near-duplicate / unguessable houses (overlapping membership, tiny or place-less data)
const DROP = /Boteirid|Orontid|Capetian House of Anjou|Holstein-Gottorp|Elros/;

const out = [];
for (const h of houses) {
  if (DROP.test(h.name)) continue;
  const f = dir + `house-${h.qid}.json`;
  if (!fs.existsSync(f)) continue;
  let rows;
  try { rows = JSON.parse(fs.readFileSync(f, 'utf8')).results.bindings; } catch { continue; }
  const P = new Map();
  for (const r of rows) {
    const pid = id(r.p);
    if (!P.has(pid)) P.set(pid, { id: pid, name: r.pLabel?.value || pid, by: yr(r.b?.value), dy: yr(r.d?.value), f: id(r.f), m: id(r.m), fem: id(r.g) === FEMALE, sl: +(r.sl?.value || 0), titles: new Set(), cont: new Set() });
    const p = P.get(pid);
    if (r.titleLabel && !/^Q\d+$/.test(r.titleLabel.value)) p.titles.add(r.titleLabel.value);
    if (r.contLabel) for (const c of CONT[r.contLabel.value] || [r.contLabel.value]) p.cont.add(c);
    if (r.d && p.dy == null) p.dy = yr(r.d.value);
  }
  for (const p of P.values()) if (p.dy != null && p.by != null && (p.dy <= p.by || p.dy - p.by > 120)) p.dy = null; // inconsistent dates
  const people = [...P.values()].filter((p) => p.by != null && !/^Q\d+$/.test(p.name) && p.by > -3000 && p.by < 2010);
  const byId = new Map(people.map((p) => [p.id, p]));
  for (const p of people) { p.par = byId.has(p.f) ? p.f : byId.has(p.m) ? p.m : null; p.kids = []; }
  for (const p of people) if (p.par) byId.get(p.par).kids.push(p);
  const tokens = houseTokens(h.name);
  const size = (p, used, seen = new Set()) => { if (seen.has(p.id) || used.has(p.id)) return 0; seen.add(p.id); return 1 + p.kids.reduce((s, k) => s + size(k, used, seen), 0); };

  const used = new Set(), trees = [];
  while (trees.length < MAX_TREES) {
    const cands = people.filter((p) => !used.has(p.id) && p.kids.length).map((p) => ({ p, n: size(p, used) }))
      .filter((c) => c.n >= MIN_TREE).sort((a, b) => (trees.length === 0 ? (!a.p.par === !b.p.par ? 0 : a.p.par ? 1 : -1) : 0) || b.n - a.n || a.p.by - b.p.by);
    if (!cands.length) break;
    const root = cands[0].p;
    const pick = [root], seen = new Set([root.id]);
    const frontier = root.kids.filter((k) => !used.has(k.id));
    while (pick.length < TREE_CAP && frontier.length) {
      frontier.sort((a, b) => (b.sl + b.kids.length * 3) - (a.sl + a.kids.length * 3) || a.by - b.by);
      const nx = frontier.shift();
      if (seen.has(nx.id)) continue;
      seen.add(nx.id); pick.push(nx); frontier.push(...nx.kids.filter((k) => !used.has(k.id)));
    }
    pick.forEach((p) => used.add(p.id));
    const idx = new Map(pick.map((p, i) => [p.id, i]));
    const nodes = pick.map((p) => {
      const ts = [...p.titles].map((t) => redactTitle(t)).filter(Boolean);
      const raw = [...p.titles].sort();
      ts.sort((a, b) => rankOf(a) - rankOf(b));
      const best = ts[0] || null;
      const full = best ? raw.find((t) => redactTitle(t) === best) : null;
      return { n: p.name, by: p.by, dy: p.dy, w: p.fem ? 1 : 0, p: p.par && idx.has(p.par) ? idx.get(p.par) : -1, t: best, tr: full };
    });
    // parents must precede children: depth-first from the roots, children by birth year
    const order = [], add = (i) => { order.push(i); nodes.map((n, j) => [n, j]).filter(([n]) => n.p === i).sort((a, b) => a[0].by - b[0].by).forEach(([, j]) => add(j)); };
    nodes.forEach((n, i) => n.p === -1 && add(i));
    const remap = new Map(order.map((o, k) => [o, k]));
    const tree = order.map((o) => ({ ...nodes[o], p: nodes[o].p < 0 ? -1 : remap.get(nodes[o].p) }));
    const names = [...new Set(pick.map((p) => givenName(p.name, tokens)).filter(Boolean))].slice(0, 9);
    if (tree.length >= MIN_TREE && names.length >= 4) trees.push({ tree, names });
    else if (trees.length === 0 && cands.length === 1) break;
  }
  if (!trees.length) continue;
  const births = people.map((p) => p.by).sort((a, b) => a - b);
  const lifespans = people.filter((p) => p.dy != null && p.dy >= p.by && p.dy - p.by < 110).map((p) => p.dy - p.by);
  const withCont = people.filter((p) => p.cont.size), conts = {};
  for (const p of withCont) for (const c of p.cont) conts[c] = (conts[c] || 0) + 1;
  const cont = Object.entries(conts).filter(([, n]) => n >= 0.3 * withCont.length).sort((a, b) => b[1] - a[1]).map((e) => e[0]).slice(0, 3);
  const titleCount = {};
  for (const p of people) for (const t of new Set([...p.titles].map((x) => redactTitle(x)?.replace(/ of ▇▇▇$/, '')).filter(Boolean))) titleCount[t] = (titleCount[t] || 0) + 1;
  const titles = Object.entries(titleCount).sort((a, b) => b[1] - a[1] || rankOf(a[0]) - rankOf(b[0])).slice(0, 5);
  const famous = [...people].sort((a, b) => b.sl - a.sl)[0];
  out.push({
    q: h.qid, name: h.name, total: people.length, trees,
    first: births[Math.floor(births.length * 0.05)], last: births[Math.floor(births.length * 0.95)],
    avgLife: lifespans.length >= 4 ? Math.round(lifespans.reduce((a, b) => a + b, 0) / lifespans.length) : null,
    female: Math.round((100 * people.filter((p) => p.fem).length) / people.length),
    cont, titles, famous: famous.name,
  });
}
const keep = out.filter((h) => h.cont.length).sort((a, b) => a.q.localeCompare(b.q, 'en', { numeric: true }));
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ houses: keep, fetched: '2026-10-14' }));
console.log('houses', keep.length, 'trees', keep.reduce((s, h) => s + h.trees.length, 0), 'bytes', fs.statSync(new URL('../data.json', import.meta.url)).size);
