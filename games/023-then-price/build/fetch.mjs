// Downloads BLS Average Price series (via FRED CSV mirror) into raw/
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const raw = join(dirname(fileURLToPath(import.meta.url)), 'raw');
mkdirSync(raw, { recursive: true });
export const SERIES = ['APU0000708111','APU0000702111','APU0000709112','APU0000703112','APU0000701111','APU0000717311','APU0000706111','APU0000704111','APU0000711211','APU0000712311','APU0000FF1101','APU0000720111','APU0000701312','APU0000709111','APU0000FJ4101','APU0000713111','APU0000714233','APU0000715211','APU0000FN1101','APU0000702212','APU0000703111','APU0000706212','APU0000708112','APU0000711311','APU0000717112','APU000074714','APU000072610','APU000074712','APU0000725111','APU0000701322'];
for (const s of SERIES) {
  const f = join(raw, s + '.csv');
  if (existsSync(f)) continue;
  const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${s}`, { headers: { 'User-Agent': 'daily-data-game/1.0 (class project)' } });
  const t = await r.text();
  console.log(s, r.status, t.length);
  if (r.ok) writeFileSync(f, t);
  await new Promise((x) => setTimeout(x, 1200));
}
