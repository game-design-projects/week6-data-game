// raw HUD FY26 FMR workbook -> ../data.json (run fetch.sh first)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = new URL('./raw/', import.meta.url).pathname;
if (!existsSync(dir + 'x/xl/sharedStrings.xml')) { execFileSync('unzip', ['-oq', dir + 'FY26_FMRs_revised.xlsx', '-d', dir + 'x']); execFileSync('chmod', ['-R', 'u+rwX', dir + 'x']); }
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const ss = [...readFileSync(dir + 'x/xl/sharedStrings.xml', 'utf8').matchAll(/<si>(.*?)<\/si>/gs)].map((m) => dec([...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => t[1]).join('')));
const xml = readFileSync(dir + 'x/xl/worksheets/sheet1.xml', 'utf8');
const rows = [];
for (const r of xml.matchAll(/<row [^>]*>(.*?)<\/row>/gs)) {
  const o = {};
  for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(?:<v>(.*?)<\/v>)?<\/c>)/gs)) o[c[1]] = c[3] == null ? '' : /t="s"/.test(c[2]) ? ss[+c[3]] : +c[3];
  rows.push(o);
}
const H = rows.shift();
console.log('header', Object.values(H).join(','), 'rows', rows.length);
const byFips = new Map();
for (const r of rows) {
  if (!r.A || !r.N === undefined || !r.L) continue;
  const name = r.E || r.D; // county or town
  const k = r.H;
  if (byFips.has(k)) continue;
  byFips.set(k, { st: r.A, name, pop: r.I, fmr: [r.J, r.K, r.L, r.M, r.N], area: r.G, metro: r.F === '1' || r.F === 1 });
}
const TERR = new Set(['GU', 'AS', 'MP', 'VI']); // tiny territories: unguessable, drop
const all = [...byFips.values()].filter((x) => x.pop && x.fmr.every((v) => v > 0) && !TERR.has(x.st));
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const states = {};
for (const x of all) (states[x.st] ||= []).push(x.fmr[2]);
const stateMed = Object.fromEntries(Object.entries(states).map(([k, v]) => [k, med(v)]));
const counties = all.filter((x) => x.pop >= 40000).sort((a, b) => b.pop - a.pop).map((x) => ({ ...x, metro: x.metro ? 1 : 0 }));
const out = { fy: 2026, nat: med(all.map((x) => x.fmr[2])), stateMed, counties };
writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out));
console.log('counties', counties.length, 'states', Object.keys(stateMed).length, 'national median', out.nat);
console.log(counties.slice(0, 3), counties.filter((c) => c.fmr[2] > 3000).length);
