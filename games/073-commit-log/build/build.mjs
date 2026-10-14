import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { REPOS } from './fetch.mjs';
const out = [];
for (const r of REPOS) {
  const mf = `raw/meta_${r.replace('/', '__')}.json`;
  if (!existsSync(mf)) {
    writeFileSync(mf, execFileSync('gh', ['api', `repos/${r}`, '--jq', '{name:.name,full:.full_name,lang:.language,stars:.stargazers_count,created:.created_at,desc:.description}']).toString());
    await new Promise((s) => setTimeout(s, 300));
  }
  const meta = JSON.parse(readFileSync(mf, 'utf8'));
  const raw = JSON.parse(readFileSync(`raw/${r.replace('/', '__')}.json`, 'utf8'));
  const seen = new Set();
  const msgs = [];
  for (const { m } of raw) {
    const line = m.split('\n')[0].trim();
    if (line.length < 18 || line.length > 90) continue;
    if (/^(merge|revert|bump|release|update dependency|chore\(deps)/i.test(line) || /\[bot\]|^v?\d+\.\d+/.test(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key); msgs.push(line);
  }
  if (msgs.length < 10) { console.log('skip', r, msgs.length); continue; }
  out.push({ id: r, name: meta.name, lang: meta.lang || '—', stars: meta.stars, year: +meta.created.slice(0, 4), desc: (meta.desc || '').slice(0, 100), msgs: msgs.slice(0, 22) });
}
writeFileSync('../data.json', JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), repos: out }));
console.log(out.length, 'repos');
