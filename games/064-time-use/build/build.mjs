// Eurostat HETUS tus_00age (mean time per day, all persons in the group) -> data.json
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const raw = join(here, 'raw', 'tus_00age.tsv');
mkdirSync(join(here, 'raw'), { recursive: true });
if (!existsSync(raw)) {
  const r = await fetch('https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/tus_00age?format=TSV', { headers: { 'User-Agent': 'daily-data-class student project' } });
  writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
}
const ACTS = ['AC01','AC02','AC1A','AC21A','AC31A','AC321','AC36','AC38A','AC82','AC812','AC7A','AC6A','AC611','AC51A','AC52','AC913','AC331','AC344'];
const lines = readFileSync(raw, 'utf8').split(/\r?\n/).filter(Boolean);
const years = lines[0].split('\t').slice(1).map((s) => s.trim());
const mins = (s) => { const m = /^(\d+):(\d\d)/.exec(s.trim()); return m ? +m[1] * 60 + +m[2] : null; };
const pct = (s) => { const m = /^([\d.]+)/.exec(s.trim()); return m ? Math.round(+m[1]) : null; };
const G = new Map();
for (const ln of lines.slice(1)) {
  const [key, ...cells] = ln.split('\t');
  const [, unit, sex, age, ac, geo] = key.split(',');
  if (!ACTS.includes(ac) || !['TIME_SP', 'PTP_RT'].includes(unit) || age === 'Y20-74' || age === 'Y_GE65') continue;
  cells.forEach((c, i) => {
    const v = unit === 'TIME_SP' ? mins(c) : pct(c);
    if (v == null) return;
    const k = [geo, years[i], sex, age].join('|');
    const g = G.get(k) ?? { c: geo, y: +years[i], s: sex, a: age, v: {} };
    g.v[ac] ??= [null, null];
    g.v[ac][unit === 'TIME_SP' ? 0 : 1] = v;
    G.set(k, g);
  });
}
const groups = [...G.values()].map((g) => {
  for (const k of Object.keys(g.v)) { const [m] = g.v[k]; if (m == null || m < 3) delete g.v[k]; }
  return g;
}).filter((g) => g.v.AC01 && Object.keys(g.v).length >= 8);
groups.sort((a, b) => (a.c + a.y + a.s + a.a).localeCompare(b.c + b.y + b.s + b.a));
writeFileSync(join(here, '..', 'data.json'), JSON.stringify({ groups }));
console.log('groups', groups.length);
