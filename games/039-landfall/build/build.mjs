// raw HURDAT2 (Atlantic + NE Pacific) -> data.json. Run from games/039-landfall/: node build/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const ll = (s) => { const v = parseFloat(s); return /[SW]$/.test(s.trim()) ? -v : v; };
const rad = Math.PI / 180;
const hav = (a, b, c, d) => { const x = Math.sin((c - a) * rad / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin((d - b) * rad / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
const ms = (p) => Date.UTC(+p.d.slice(0, 4), +p.d.slice(4, 6) - 1, +p.d.slice(6, 8), +p.t.slice(0, 2), +p.t.slice(2));
const title = (n) => n[0] + n.slice(1).toLowerCase();

function parse(file) {
  const storms = [];
  let cur = null;
  for (const ln of readFileSync(file, 'utf8').split('\n')) {
    const f = ln.split(',').map((x) => x.trim());
    if (/^(AL|EP|CP)\d{6}$/.test(f[0])) { cur = { id: f[0], name: f[1], pts: [] }; storms.push(cur); continue; }
    if (!cur || f.length < 7) continue;
    cur.pts.push({ d: f[0], t: f[1], rec: f[2], st: f[3], lat: ll(f[4]), lng: ll(f[5]), w: +f[6] });
  }
  return storms;
}

const out = [];
const drops = {};
const drop = (why) => { drops[why] = (drops[why] || 0) + 1; };
for (const [file, basin] of [['build/raw/hurdat2-atl.txt', 'AL'], ['build/raw/hurdat2-nepac.txt', 'EP']]) {
  for (const s of parse(file)) {
    const year = +s.id.slice(4);
    if (year < 1950 || s.name === 'UNNAMED') continue;
    const li = s.pts.findIndex((p) => p.rec === 'L');
    if (li < 0) continue;
    const L = s.pts[li];
    const maxW = Math.max(...s.pts.map((p) => p.w));
    if (maxW < 64) { drop('weak'); continue; }
    if (s.pts.some((p) => p.lng > 0 || p.w < 0)) { drop('dateline/missing wind'); continue; }
    const tL = ms(L);
    const syn = s.pts.slice(0, li).filter((p) => ['0000', '0600', '1200', '1800'].includes(p.t));
    const shown = syn.filter((p) => tL - ms(p) >= 24 * 3600e3);
    if (shown.length < 8) { drop('short track'); continue; }
    const last = shown[shown.length - 1];
    const distKm = Math.round(hav(last.lat, last.lng, L.lat, L.lng));
    if (distKm > 1800) { drop('landfall too far from cut'); continue; }
    const hoursToLand = Math.round((tL - ms(last)) / 3600e3);
    out.push({
      id: s.id, basin, name: title(s.name), year, maxW,
      track: shown.map((p) => [p.lat, p.lng, p.w]),
      hoursToLand, distKm,
      land: { lat: L.lat, lng: L.lng, date: `${L.d.slice(0, 4)}-${L.d.slice(4, 6)}-${L.d.slice(6)}`, w: L.w },
      full: s.pts.slice(0, li + 5).filter((p) => ['0000', '0600', '1200', '1800'].includes(p.t) || p === L).map((p) => [p.lat, p.lng, p.w]),
    });
  }
}
console.log(out.length, 'storms', drops, out.filter((s) => s.basin === 'EP').length, 'EP');
writeFileSync('data.json', JSON.stringify({ storms: out }));
