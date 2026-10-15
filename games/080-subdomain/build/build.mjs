// raw crt.sh JSON (build/raw/<domain>.json, from crt-fetch.mjs) → ../data.json
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import companies from './companies.mjs';
import { extractLabels, pickLabels, MIN_LABELS } from '../shape.js';
const here = path.dirname(fileURLToPath(import.meta.url));
const rows = [];
for (const [domain, name, cat] of companies) {
  const f = path.join(here, 'raw', `${domain}.json`); if (!fs.existsSync(f)) continue;
  const c = { id: domain.split('.')[0], name, cat, domain };
  const lab = extractLabels(JSON.parse(fs.readFileSync(f, 'utf8')), c);
  if (lab.size >= MIN_LABELS) rows.push({ c, lab });
}
// label frequency across companies = how generic a label is (kept for labels shared by ≥2 companies, for live shaping)
const freqAll = {};
for (const r of rows) for (const l of r.lab.keys()) freqAll[l] = (freqAll[l] || 0) + 1;
const freq = Object.fromEntries(Object.entries(freqAll).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
const out = rows.map(({ c, lab }) => ({ ...c, ...pickLabels(lab, freqAll) }));
const file = path.join(here, '..', 'data.json');
fs.writeFileSync(file, JSON.stringify({ fetched: '2026-10-14', freq, companies: out }));
console.log(out.length, 'companies', Object.keys(freq).length, 'shared labels', fs.statSync(file).size, 'bytes');
