import fs from 'node:fs'; import { SITES, YEARS } from './sites.mjs';
const UA = 'daily-data-games-class-project/1.0 (NYU assignment; contact lishuyustevenli@gmail.com)';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
fs.mkdirSync('raw/html', { recursive: true });
async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(40000) });
      if (r.ok) return await r.text(); if (r.status === 404) return null; } catch {}
    await sleep(3000 * (i + 1));
  }
  return null;
}
const [K, N] = (process.argv[2] || "0/1").split("/").map(Number);
for (const [id,, dom] of SITES.filter((_, i) => i % N === K)) {
  for (const y of YEARS) {
    const f = `raw/html/${id}-${y}.json`;
    if (fs.existsSync(f)) continue;
    const cdx = await get(`https://web.archive.org/cdx/search/cdx?url=${dom}&output=json&limit=1&filter=statuscode:200&filter=mimetype:text/html&from=${y}0601&to=${y}1231&fl=timestamp,original`);
    await sleep(1200);
    if (cdx === null) { console.log(id, y, 'NETFAIL'); await sleep(20000); continue; }
    let rec = { id, y, ok: false };
    try {
      const rows = JSON.parse(cdx || '[]');
      if (rows.length > 1) {
        const [ts, orig] = rows[1];
        const html = await get(`https://web.archive.org/web/${ts}id_/${orig}`);
        if (html) rec = { id, y, ok: true, ts, orig, html: html.slice(0, 400000) };
        else { await sleep(10000); continue; }
        await sleep(1500);
      }
    } catch {}
    fs.writeFileSync(f, JSON.stringify(rec));
    console.log(id, y, rec.ok ? rec.ts : 'none');
  }
}
