// raw Kickstarter CSV dump (Webrobots) -> data.json (stratified pool of finished projects)
import fs from 'node:fs';
import path from 'node:path';
const dir = path.join(import.meta.dirname, 'raw', 'x');
function parseCSV(s) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  return rows;
}
const J = (s) => { try { return JSON.parse(s); } catch { return null; } };
const LEAK = /(funded|fully[- ]funded|stretch goal|\bbackers?\b|% |percent|raised|successful|\$\s?\d|kickstarter|\bgoal\b|relaunch|reward tier|thank you)/i;
const ADULT = /\b(erotic\w*|nude|nudes|nudity|naked|nsfw|sex|sexy|sexual\w*|porn\w*|fetish\w*|shibari|kinbaku|bondage|boudoir|lingerie|hentai|kink\w*|18\+)/i;
const seen = new Set(), seenName = new Set(), pool = [], byPar = {};
for (const fn of fs.readdirSync(dir).filter((f) => f.endsWith('.csv'))) {
  const [hdr, ...rows] = parseCSV(fs.readFileSync(path.join(dir, fn), 'utf8'));
  const ix = Object.fromEntries(hdr.map((h, i) => [h, i]));
  for (const r of rows) {
    if (r.length < hdr.length) continue;
    const g = (k) => r[ix[k]];
    const id = g('id');
    if (seen.has(id)) continue; seen.add(id);
    const state = g('state');
    if (state !== 'successful' && state !== 'failed') continue;
    const cat = J(g('category')); const loc = J(g('location'));
    const goalUsd = Number(g('goal')) * Number(g('static_usd_rate'));
    const pct = Number(g('percent_funded'));
    const blurb = g('blurb').trim(), name = g('name').trim();
    const days = (Number(g('deadline')) - Number(g('launched_at'))) / 86400;
    if (!cat || !(goalUsd >= 100) || !(pct >= 1 && pct <= 20000) || blurb.length < 40 || !/^[\x20-\x7e’‘“”–—é]+$/.test(blurb + name)) continue;
    if (Number(g('backers_count')) < 1) continue;
    if (LEAK.test(`${name} ${blurb}`)) continue; // blurb must not hint at the outcome
    if (ADULT.test(`${name} ${blurb}`)) continue; // keep the daily pool safe for a class demo
    const parN = cat.parent_name || cat.name;
    (byPar[parN] ||= []).push(Number(g('usd_pledged')) / Number(g('backers_count')));
    if (seenName.has(name.toLowerCase())) continue; seenName.add(name.toLowerCase());
    pool.push({
      n: name, b: blurb, cat: cat.name, par: cat.parent_name || cat.name,
      cc: g('country'), loc: loc?.name || '', goal: Math.round(goalUsd), pct: Math.round(pct * 10) / 10,
      pledged: Math.round(Number(g('usd_pledged'))), backers: Number(g('backers_count')),
      days: Math.round(days), year: new Date(Number(g('launched_at')) * 1000).getUTCFullYear(),
      staff: g('staff_pick') === 'true', url: (J(g('urls'))?.web?.project || '').split('?')[0],
    });
  }
}
console.log('eligible', pool.length);
// deterministic stratified sample over log10(pct) bands
let h = 12345; const rnd = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const bands = [[1, 10], [10, 50], [50, 100], [100, 130], [130, 200], [200, 500], [500, 20001]];
const per = [14, 22, 22, 28, 24, 22, 14];
const out = [];
bands.forEach(([lo, hi], i) => {
  const c = pool.filter((p) => p.pct >= lo && p.pct < hi && p.year >= 2015);
  for (let k = c.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [c[k], c[j]] = [c[j], c[k]]; }
  out.push(...c.slice(0, per[i]));
});
for (let k = out.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [out[k], out[j]] = [out[j], out[k]]; }
const med = (a) => { a = a.sort((x, y) => x - y); return a[a.length >> 1]; };
const parAvg = Object.fromEntries(Object.entries(byPar).filter(([, v]) => v.length >= 200).map(([k, v]) => [k, Math.round(med(v))]));
console.log(parAvg);
const mean = out.reduce((a, p) => a + p.pledged / p.backers, 0) / out.length;
fs.writeFileSync(path.join(import.meta.dirname, '..', 'data.json'), JSON.stringify({ built: '2026-10-12 dump', parAvg, items: out }));
console.log(out.length, 'puzzles; mean pledge/backer', mean.toFixed(1));
