import { ECO } from './species.mjs';
import fs from 'node:fs';
const UA = 'daily-data-games-class-project/1.0 (student)';
const names = [...new Set(Object.values(ECO).flat().map((s) => s[0]))];
fs.mkdirSync('raw', { recursive: true });
for (const t of ['eats', 'preysOn']) for (const n of names) {
  const f = `raw/${n.replace(' ', '_')}.${t}.json`;
  if (fs.existsSync(f)) continue;
  const u = `https://api.globalbioticinteractions.org/interaction?sourceTaxon=${encodeURIComponent(n)}&interactionType=${t}&field=source_taxon_name&field=target_taxon_name&limit=3000&type=json.v2`;
  for (let k = 0; k < 3; k++) {
    try { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(r.status); fs.writeFileSync(f, await r.text()); console.log('ok', f); break; }
    catch (e) { console.log('retry', f, String(e)); await new Promise((r) => setTimeout(r, 3000)); }
  }
  await new Promise((r) => setTimeout(r, 400));
}
