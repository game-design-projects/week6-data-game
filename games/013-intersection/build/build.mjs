import fs from 'node:fs'; import zlib from 'node:zlib'; import cities from './cities.mjs';
export function findJunctions(ways, min = 4) {
  const m = new Map();
  for (const w of ways) {
    if (!w.g || !w.n) continue;
    for (const [la, lo] of w.g) {
      const k = la.toFixed(6) + ',' + lo.toFixed(6);
      let e = m.get(k); if (!e) m.set(k, e = { lat: la, lng: lo, names: new Map() });
      if (!e.names.has(w.n)) e.names.set(w.n, w.en || null);
    }
  }
  for (const e of m.values()) for (const n of [...e.names.keys()]) if ([...e.names.keys()].some((o) => o !== n && o.length < n.length && n.includes(o))) e.names.delete(n);
  return [...m.values()].filter((e) => e.names.size >= min).sort((a, b) => b.names.size - a.names.size);
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = [];
  for (const [name, zh, country, continent, cc, clat, clng] of cities) {
    const f = `raw/${name.replace(/\W/g, '_')}.json.gz`;
    if (!fs.existsSync(f)) { console.log('missing', name); continue; }
    const ways = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
    let J = findJunctions(ways); if (!J.length) J = findJunctions(ways, 3);
    if (!J.length) { console.log('none', name); continue; }
    const best = J[0];
    const streets = [...best.names.entries()].slice(0, 6).map(([n, en]) => (en && en !== n ? { n, en } : { n }));
    out.push({ city: name, zh, country, continent, cc, lat: clat, lng: clng, junction: [+best.lat.toFixed(5), +best.lng.toFixed(5)], total: best.names.size, streets, nJ5: J.filter((j) => j.names.size >= 5).length });
    console.log(name, best.names.size, streets.map((s) => s.n).join(' | '));
  }
  fs.writeFileSync('../data.json', JSON.stringify({ osmDate: new Date().toISOString().slice(0, 10), puzzles: out }));
  console.log('puzzles', out.length);
}
