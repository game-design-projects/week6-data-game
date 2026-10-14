import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, readdirSync } from 'node:fs';
for (const f of readdirSync('raw')) {
  if (f.startsWith('_') || !f.endsWith('.json')) continue;
  const r = f.replace('.json', '').replace('__', '/');
  const o = `raw/_meta_${f}`;
  if (existsSync(o)) continue;
  try { writeFileSync(o, execFileSync('gh', ['api', `repos/${r}`, '--jq', '{language,stargazers_count,created_at,topics}'], { encoding: 'utf8' })); } catch { console.log('FAIL', r); }
  await new Promise((s) => setTimeout(s, 200));
}
