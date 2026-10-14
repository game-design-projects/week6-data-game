import { mkdirSync, existsSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
mkdirSync('raw/meta', { recursive: true });
for (const f of readdirSync('raw').filter((x) => x.endsWith('.csv'))) {
  const s = f.replace('.csv', ''); const p = `raw/meta/${s}.html`;
  if (!existsSync(p)) { const r = await fetch(`https://fred.stlouisfed.org/series/${s}`, { headers: { 'User-Agent': 'daily-data-game/1.0' } }); writeFileSync(p, await r.text()); await new Promise((x) => setTimeout(x, 800)); }
  console.log(s, (readFileSync(p, 'utf8').match(/<title>([^<]*)/) || [])[1]);
}
