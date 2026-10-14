// Downloads BLS Average Price Data flat files into build/raw/ (cached).
import fs from 'node:fs';
import path from 'node:path';
const dir = path.join(path.dirname(new URL(import.meta.url).pathname), 'raw');
fs.mkdirSync(dir, { recursive: true });
for (const f of ['ap.data.0.Current', 'ap.data.3.Food', 'ap.item']) {
  const out = path.join(dir, f);
  if (fs.existsSync(out)) { console.log('cached', f); continue; }
  const r = await fetch(`https://download.bls.gov/pub/time.series/ap/${f}`, { headers: { 'User-Agent': 'Mozilla/5.0 (research; lishuyustevenli@gmail.com)' } });
  if (!r.ok) throw new Error(`${f}: ${r.status}`);
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  console.log('saved', f);
  await new Promise((r) => setTimeout(r, 1500));
}
