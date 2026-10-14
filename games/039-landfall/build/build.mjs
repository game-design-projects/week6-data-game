import { readFileSync, writeFileSync } from 'node:fs';
const lines = readFileSync('build/raw/hurdat2-atl.txt', 'utf8').split('\n');
const ll = (s) => { const v = parseFloat(s); return /[SW]$/.test(s.trim()) ? -v : v; };
const storms = [];
let cur = null;
for (const ln of lines) {
  const f = ln.split(',').map((x) => x.trim());
  if (/^AL\d{6}$/.test(f[0])) { cur = { id: f[0], name: f[1], pts: [] }; storms.push(cur); continue; }
  if (!cur || f.length < 7) continue;
  cur.pts.push({ d: f[0], t: f[1], rec: f[2], st: f[3], lat: ll(f[4]), lng: ll(f[5]), w: +f[6] });
}
const out = [];
for (const s of storms) {
  const year = +s.id.slice(4);
  if (year < 1950 || s.name === 'UNNAMED') continue;
  const li = s.pts.findIndex((p) => p.rec === 'L');
  if (li < 0) continue;
  const L = s.pts[li];
  const maxW = Math.max(...s.pts.map((p) => p.w));
  if (maxW < 64) continue;
  // show up to ~24h before landfall, on synoptic hours only
  const syn = s.pts.slice(0, li).filter((p) => ['0000', '0600', '1200', '1800'].includes(p.t));
  const tL = Date.UTC(+L.d.slice(0, 4), +L.d.slice(4, 6) - 1, +L.d.slice(6, 8), +L.t.slice(0, 2), +L.t.slice(2));
  const ms = (p) => Date.UTC(+p.d.slice(0, 4), +p.d.slice(4, 6) - 1, +p.d.slice(6, 8), +p.t.slice(0, 2));
  const shown = syn.filter((p) => tL - ms(p) >= 24 * 3600e3);
  if (shown.length < 8) continue;
  const last = shown[shown.length - 1];
  out.push({
    id: s.id, name: s.name[0] + s.name.slice(1).toLowerCase(), year, maxW,
    track: shown.map((p) => [p.lat, p.lng, p.w]),
    hoursToLand: Math.round((tL - ms(last)) / 3600e3),
    land: { lat: L.lat, lng: L.lng, date: `${L.d.slice(0, 4)}-${L.d.slice(4, 6)}-${L.d.slice(6)}`, w: L.w, st: L.st },
    full: s.pts.slice(0, li + 5).map((p) => [p.lat, p.lng, p.w]),
  });
}
console.log(out.length, 'storms');
writeFileSync('data.json', JSON.stringify({ storms: out }));
