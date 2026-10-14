import fs from 'node:fs';
import { SPECIES, MICRO } from './species.mjs';
const rawDir = new URL('./raw/', import.meta.url);
const URLS = { eukaryotes: 'eukaryotes', prokaryotes: 'prokaryotes', viruses: 'viruses' };
if (!fs.existsSync(new URL('eukaryotes.txt', rawDir))) {
  for (const f of Object.values(URLS)) await fetch(`https://ftp.ncbi.nlm.nih.gov/genomes/GENOME_REPORTS/${f}.txt`, { headers: { 'User-Agent': 'daily-data-games/1.0' } }).then(r => r.text()).then(t => fs.writeFileSync(new URL(`${f}.txt`, rawDir), t));
}
function load(f) {
  const lines = fs.readFileSync(new URL(`${f}.txt`, rawDir), 'utf8').split('\n').filter(Boolean);
  const head = lines[0].replace(/^#/, '').split('\t');
  const idx = (n) => head.indexOf(n);
  return lines.slice(1).map((l) => { const c = l.split('\t'); return { name: c[0], taxid: c[idx('TaxID')], group: c[idx('Group')] || c[idx('Segments')] , size: idx('Size (Mb)')>=0 ? parseFloat(c[idx('Size (Mb)')]) : parseFloat(c[idx('Size (Kb)')])/1000, acc: c[idx('Assembly Accession')] || '', status: c[idx('Status')] || '' }; }).filter(r => r.size > 0);
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) * 0.25)]; }; // lower quartile: avoids diploid/doubled assemblies
const tabs = { euk: load('eukaryotes'), prok: load('prokaryotes'), vir: load('viruses') };
const rank = { Chromosome: 3, Complete: 3, 'Complete Genome': 3, Scaffold: 2, Contig: 1 };
const out = []; const missing = [];
const add = (sci, zh, tab, kind) => {
  let rows = tabs[tab].filter(r => r.name === sci || r.name.startsWith(sci + ' ') );
  if (tab === 'euk') rows = rows.filter(r => r.name === sci || r.name.startsWith(sci));
  if (!rows.length) { missing.push(sci); return; }
  const best = Math.max(...rows.map(r => rank[r.status] || 0));
  const good = rows.filter(r => (rank[r.status] || 0) === best);
  const mb = med(good.map(r => r.size));
  const group = tab === 'euk' ? good[0].group : tab === 'prok' ? '细菌/古菌' : '病毒';
  out.push({ sci, zh, mb: +mb.toFixed(mb < 1 ? 5 : 1), group, n: rows.length, taxid: good[0].taxid, acc: good[0].acc });
};
SPECIES.forEach(([s, z]) => add(s, z, 'euk'));
MICRO.forEach(([s, z, t]) => add(s, z, t));
console.error('missing', missing);
out.sort((a, b) => a.mb - b.mb);
console.error(out.map(o => `${o.zh} ${o.mb} (${o.group},${o.n})`).join('\n'));
fs.writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify({ built: new Date().toISOString().slice(0, 10), species: out }));
