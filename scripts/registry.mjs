#!/usr/bin/env node
// Builds games/index.json (the gallery's list) from every games/*/game.js meta.
//   node scripts/registry.mjs
import { readdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './serve.mjs';

const dir = path.join(ROOT, 'games');
const out = [];
const failed = [];
for (const d of (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
  const file = path.join(dir, d, 'game.js');
  try {
    await access(file);
    const { meta } = (await import(pathToFileURL(file).href)).default;
    if (meta.hidden) continue;
    out.push({
      dir: d, num: meta.num, slug: meta.slug ?? d, title: meta.title, tagline: meta.tagline,
      category: meta.category, data: meta.data, sources: (meta.sources ?? []).map((s) => s.name),
    });
  } catch (e) {
    failed.push(`${d}: ${e.message}`);
  }
}
out.sort((a, b) => a.num - b.num);
await writeFile(path.join(dir, 'index.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`registry: ${out.length} games → games/index.json`);
if (failed.length) { console.error(`registry: ${failed.length} failed\n  ${failed.join('\n  ')}`); process.exitCode = 1; }
