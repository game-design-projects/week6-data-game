// Build data.json from NCBI GENOME_REPORTS. Run: node build/build.mjs  (downloads into build/raw/ once).
import fs from 'node:fs';
import { SPECIES, MICRO, NOTES, GROUP_EN } from './species.mjs';
import { estimateSize, median } from './estimate.mjs';

const rawDir = new URL('./raw/', import.meta.url);
fs.mkdirSync(rawDir, { recursive: true });
for (const f of ['eukaryotes', 'prokaryotes', 'viruses']) {
  const p = new URL(`${f}.txt`, rawDir);
  if (fs.existsSync(p)) continue;
  console.error('downloading', f);
  const r = await fetch(`https://ftp.ncbi.nlm.nih.gov/genomes/GENOME_REPORTS/${f}.txt`, { headers: { 'User-Agent': 'daily-data-games/1.0 (class project)' } });
  if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
  fs.writeFileSync(p, await r.text());
}

function load(f) {
  const lines = fs.readFileSync(new URL(`${f}.txt`, rawDir), 'utf8').split('\n').filter(Boolean);
  const head = lines[0].replace(/^#/, '').split('\t');
  const idx = (n) => head.indexOf(n);
  const kb = idx('Size (Kb)') >= 0;
  return lines.slice(1).map((l) => {
    const c = l.split('\t');
    const raw = parseFloat(c[kb ? idx('Size (Kb)') : idx('Size (Mb)')]);
    return {
      name: c[0], taxid: c[idx('TaxID')], group: c[idx('Group')] ?? '', sub: c[idx('SubGroup')] ?? '',
      mb: kb ? raw / 1000 : raw, acc: c[idx('Assembly Accession')] ?? '', status: c[idx('Status')] ?? '',
    };
  }).filter((r) => r.mb > 0);
}
const tabs = { euk: load('eukaryotes'), prok: load('prokaryotes'), vir: load('viruses') };
const INFRA = /^(var\.|subsp\.|f\.|cv\.|x |×|ssp\.)/;
const matches = (name, sci) => {
  if (name === sci) return true;
  if (!name.startsWith(sci + ' ')) return false;
  return !INFRA.test(name.slice(sci.length + 1));
};

const out = [];
const missing = [];
const add = (sci, name, tab) => {
  const all = tabs[tab].filter((r) => matches(r.name, sci));
  if (!all.length) { missing.push(sci); return; }
  // drop fragments (organelle / single-chromosome / macronuclear-minichromosome entries) before anything else
  const sorted = all.map((r) => r.mb).sort((a, b) => a - b);
  const upper = median(sorted.slice(sorted.length >> 1));
  const rows = all.filter((r) => r.mb >= 0.25 * upper);
  // prefer the best assembly level (chromosome/complete) when it leaves enough rows, else use all rows
  const rank = { Chromosome: 3, Complete: 3, 'Complete Genome': 3, Scaffold: 2, Contig: 1 };
  const best = Math.max(...rows.map((r) => rank[r.status] ?? 0));
  const top = rows.filter((r) => (rank[r.status] ?? 0) === best);
  const est = estimateSize((top.length >= 3 || best === 3 ? top : rows).map((r) => r.mb));
  const ref = rows.find((r) => r.mb === est.mb) ?? rows[0];
  const group = tab === 'vir' ? 'Viruses' : tab === 'prok' ? (ref.group === 'Archaea' ? 'Archaea' : 'Bacteria') : (GROUP_EN[ref.sub] ?? GROUP_EN[ref.group] ?? ref.group);
  out.push({
    sci, name, mb: +est.mb.toPrecision(4), group, n: est.used, taxid: ref.taxid, acc: ref.acc,
    ...(NOTES[sci] ? { note: NOTES[sci] } : {}),
  });
};
SPECIES.forEach(([s, z]) => add(s, z, 'euk'));
MICRO.forEach(([s, z, t]) => add(s, z, t));
console.error('missing:', missing.join(' | '));
// de-dupe by scientific name; sort by size
const seen = new Set();
const uniq = out.filter((o) => (seen.has(o.sci) ? false : (seen.add(o.sci), true))).sort((a, b) => a.mb - b.mb);
console.error(uniq.map((o) => `${o.name}\t${o.mb}\t${o.group}\tn=${o.n}`).join('\n'));
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ built: '2026-10-15', species: uniq }));
console.error('wrote', uniq.length);
