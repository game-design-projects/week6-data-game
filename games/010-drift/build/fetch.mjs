// Fetch NOAA GDP 6-hourly drifter positions (AOML ERDDAP) -> raw/*.csv
import fs from 'node:fs'; import path from 'node:path';
const BASE = 'https://erddap.aoml.noaa.gov/gdp/erddap/tabledap/drifter_6hour_qc.csv';
const RAW = new URL('./raw/', import.meta.url).pathname; fs.mkdirSync(RAW, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(q, file) {
  const f = path.join(RAW, file);
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  const r = await fetch(`${BASE}?${q}`, { headers: { 'User-Agent': 'daily-data-games-class/1.0' } });
  if (!r.ok) throw new Error(`${r.status} ${q}`);
  const t = await r.text(); fs.writeFileSync(f, t); await sleep(1500); return t;
}
const iso = (d) => d.toISOString().slice(0, 19) + 'Z';
// 30 start dates between 2019-01 and 2024-10, ~every 70 days
const starts = [];
for (let t = Date.UTC(2019, 0, 5); t < Date.UTC(2024, 9, 1); t += 70 * 86400000) starts.push(new Date(t));
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const picked = [];
for (const s of starts) {
  const day = iso(s).slice(0, 10);
  const t = await get(`ID,latitude,longitude&time%3E=${iso(s)}&time%3C=${iso(s)}`, `snap_${day}.csv`);
  const rows = t.trim().split('\n').slice(2).map((l) => l.split(',')).filter((r) => r.length === 3);
  const bins = new Map();
  for (const [id, la, lo] of rows) { const k = `${Math.floor((+la + 90) / 30)}_${Math.floor((+lo + 180) / 60)}`; (bins.get(k) || bins.set(k, []).get(k)).push(id); }
  const keys = [...bins.keys()].sort(() => rnd() - 0.5).slice(0, 6);
  for (const k of keys) { const a = bins.get(k); picked.push({ id: a[Math.floor(rnd() * a.length)], start: iso(s) }); }
}
console.log('candidates', picked.length);
for (const p of picked) {
  const end = new Date(Date.parse(p.start) + 92 * 86400000);
  try { await get(`ID,time,latitude,longitude,drogue_lost_date&ID=%22${p.id}%22&time%3E=${p.start}&time%3C=${iso(end)}`, `trk_${p.id}_${p.start.slice(0, 10)}.csv`); }
  catch (e) { console.error('fail', p.id, e.message); }
}
