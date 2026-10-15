// raw (build/raw/*) -> ../data.json. Run: node build.mjs  (after node fetch.mjs)
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPOS, commitsFile, metaFile } from './fetch.mjs';
import { redact } from '../game.js';
const HERE = dirname(fileURLToPath(import.meta.url));
const out = [];
for (const r of REPOS) {
  if (!existsSync(commitsFile(r)) || !existsSync(metaFile(r))) { console.log('skip (no raw)', r); continue; }
  const meta = JSON.parse(readFileSync(metaFile(r), 'utf8'));
  const raw = JSON.parse(readFileSync(commitsFile(r), 'utf8'));
  const seen = new Set();
  const msgs = [];
  for (const { m } of raw) {
    const line = m.split('\n')[0].trim();
    if (line.length < 18 || line.length > 90) continue;
    if (/^(merge|revert|bump|release|update dependency|chore\(deps|build\(deps|chore: release|\[bot\])/i.test(line) || /\[bot\]|^v?\d+\.\d+|^\d+(\.\d+)+/.test(line)) continue;
    if (/[^\x20-\x7e]/.test(line)) continue;            // keep the clues plain ASCII (no CJK / emoji / mojibake)
    if (/https?:\/\/|@\w+\.\w+/.test(line)) continue;   // no URLs / e-mail addresses
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    // a message that is mostly redaction bars carries no information
    const red = redact(line, r);
    if ((red.match(/▇▇▇/g) || []).length * 3 > line.length / 3) continue;
    seen.add(key); msgs.push(line);
  }
  if (msgs.length < 12) { console.log('skip (too few msgs)', r, msgs.length); continue; }
  out.push({ id: r, name: meta.name, lang: meta.lang || '—', stars: meta.stars, year: +meta.created.slice(0, 4), desc: (meta.desc || '').slice(0, 100), msgs: msgs.slice(0, 24) });
}
writeFileSync(join(HERE, '..', 'data.json'), JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), repos: out }));
console.log(out.length, 'repos');
